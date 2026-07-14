import { Router } from "express";
import { prisma } from "../../common/prisma.js";
import { asyncHandler } from "../../common/http.js";
import { requireAuth } from "../../middleware/auth.js";
import { minQualityScore } from "../articles/quality-gate.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    try {
      const minScore = await minQualityScore();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [keywordsToday, articleCount, publishStats, recentArticles, recentJobs, usage] =
        await Promise.all([
          prisma.dailyKeywordRecommendation.count({ where: { date: { gte: todayStart } } }),
          prisma.article.count(),
          prisma.publishJob.groupBy({ by: ["status"], _count: { _all: true } }),
          prisma.article.findMany({
            orderBy: { updatedAt: "desc" },
            take: 5,
            select: {
              id: true,
              title: true,
              status: true,
              language: true,
              articleType: true,
              qualityScore: true,
              updatedAt: true,
            },
          }),
          prisma.publishJob.findMany({
            orderBy: { updatedAt: "desc" },
            take: 5,
            select: {
              id: true,
              platform: true,
              status: true,
              publishedUrl: true,
              error: true,
              updatedAt: true,
              article: { select: { id: true, title: true } },
            },
          }),
          prisma.modelUsageLog.groupBy({
            by: ["provider"],
            where: { createdAt: { gte: monthStart } },
            _sum: { inputTokens: true, outputTokens: true },
            _count: { _all: true },
          }),
        ]);

      // '오늘 할 일' 콕핏 — 원스톱 운영: 무엇을 하면 되는지 숫자로 바로 보여준다
      const [reviewCount, noImageCount, lowQualityCount, notPublishedCount] = await Promise.all([
        // 검토 대기 (REVIEW 상태)
        prisma.article.count({ where: { status: "REVIEW" } }),
        // 이미지가 아직 안 만들어진 글 (프롬프트만 있고 webpUrl 없는 미디어 보유)
        prisma.article.count({ where: { media: { some: { webpUrl: null, prompt: { not: null } } } } }),
        // 품질 기준 미만 — 기준선은 설정값이다 (85 하드코딩이면 설정을 90으로 올려도 화면이 거짓말한다)
        prisma.article.count({ where: { qualityScore: { lt: minScore }, status: { not: "PUBLISHED" } } }),
        // 아직 발행 안 된 글 (발행완료 체크도 안 됨)
        prisma.article.count({ where: { status: { notIn: ["PUBLISHED"] }, extensionDoneAt: null } }),
      ]);

      // Claude Sonnet 단가($/1M): input 3, output 15. Gemini 이미지는 건당 소액(추정).
      const USD_KRW = 1380;
      let claudeCostUsd = 0;
      let geminiImages = 0;
      for (const row of usage) {
        if (row.provider === "anthropic") {
          claudeCostUsd +=
            ((row._sum.inputTokens ?? 0) / 1_000_000) * 3 +
            ((row._sum.outputTokens ?? 0) / 1_000_000) * 15;
        } else if (row.provider === "gemini") {
          geminiImages += row._count._all;
        }
      }
      const geminiCostUsd = geminiImages * 0.039; // 이미지 1장 약 $0.039 추정
      const monthlyCostKrw = Math.round((claudeCostUsd + geminiCostUsd) * USD_KRW);

      res.json({
        db: true,
        // 화면이 "85점 미만" 같은 문구를 하드코딩하지 않도록 기준선을 함께 내려준다
        minQualityScore: minScore,
        keywordsToday,
        articleCount,
        todo: {
          review: reviewCount,
          noImage: noImageCount,
          lowQuality: lowQualityCount,
          notPublished: notPublishedCount,
        },
        publishStats: Object.fromEntries(
          publishStats.map((row) => [row.status, row._count._all]),
        ),
        recentArticles,
        recentJobs,
        usage: {
          monthlyCostKrw,
          claudeCostKrw: Math.round(claudeCostUsd * USD_KRW),
          geminiCostKrw: Math.round(geminiCostUsd * USD_KRW),
          geminiImages,
        },
      });
    } catch {
      res.json({
        db: false,
        keywordsToday: 0,
        articleCount: 0,
        publishStats: {},
        recentArticles: [],
        recentJobs: [],
      });
    }
  }),
);

/**
 * 글별 검색 성과 — 최근 N일 합계 기준 상위/하위.
 * 데이터가 0건이면 빈 배열을 준다(화면에서 "아직 수집 전"으로 안내한다).
 */
dashboardRouter.get(
  "/performance",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 28, 7), 90);
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - days);

    const rows = await prisma.analyticsDaily.groupBy({
      by: ["articleId"],
      where: { source: "SEARCH_CONSOLE", date: { gte: since }, articleId: { not: null } },
      _sum: { impressions: true, clicks: true },
      _avg: { avgPosition: true },
    });

    if (rows.length === 0) {
      res.json({ days, collected: false, articles: [] });
      return;
    }

    const articles = await prisma.article.findMany({
      where: { id: { in: rows.map((row) => row.articleId!).filter(Boolean) } },
      select: { id: true, title: true, qualityScore: true },
    });
    const titleMap = new Map(articles.map((article) => [article.id, article]));

    const merged = rows
      .map((row) => {
        const impressions = row._sum.impressions ?? 0;
        const clicks = row._sum.clicks ?? 0;
        const article = titleMap.get(row.articleId!);
        return {
          articleId: row.articleId!,
          title: article?.title ?? "(삭제된 글)",
          qualityScore: article?.qualityScore ?? null,
          impressions,
          clicks,
          // CTR은 저장값을 평균 내지 않고 합계로 다시 계산한다 — 일별 CTR 평균은 노출수를 무시해 왜곡된다
          ctr: impressions > 0 ? clicks / impressions : 0,
          avgPosition: row._avg.avgPosition ?? null,
        };
      })
      .sort((a, b) => b.impressions - a.impressions);

    res.json({ days, collected: true, articles: merged });
  }),
);

/** Search Console 성과 수집 (수동 실행 — 스케줄러도 같은 함수를 쓴다) */
dashboardRouter.post(
  "/collect",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.body?.days) || 3, 2), 30);
    const { collectSearchConsole } = await import("./collectors/search-console.js");
    res.json(await collectSearchConsole(days));
  }),
);

/**
 * 최근 N일 추이 — 대시보드 그래프용.
 * 날짜별 집계는 Prisma groupBy로 못 하므로(날짜 자르기 필요) 원시 쿼리를 쓴다.
 * 값이 없는 날은 0으로 채워 그래프에 구멍이 생기지 않게 한다.
 */
dashboardRouter.get(
  "/trends",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 14, 7), 60);
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));

    type Row = { day: string; n: bigint | number; q?: number | null };

    const [articles, publishes, failures, cost] = await Promise.all([
      // ⚠️ 테이블명은 스네이크케이스다(@@map) — 모델명(Article)으로 쓰면 1146(테이블 없음)이 난다.
      prisma.$queryRaw<Row[]>`
        SELECT DATE(createdAt) AS day, COUNT(*) AS n, AVG(qualityScore) AS q
        FROM articles WHERE createdAt >= ${since} GROUP BY DATE(createdAt)`,
      prisma.$queryRaw<Row[]>`
        SELECT DATE(updatedAt) AS day, COUNT(*) AS n
        FROM publish_jobs WHERE status = 'SUCCEEDED' AND updatedAt >= ${since} GROUP BY DATE(updatedAt)`,
      prisma.$queryRaw<Row[]>`
        SELECT DATE(updatedAt) AS day, COUNT(*) AS n
        FROM publish_jobs WHERE status = 'FAILED' AND updatedAt >= ${since} GROUP BY DATE(updatedAt)`,
      prisma.$queryRaw<{ day: string; inTok: bigint | null; outTok: bigint | null; imgs: bigint }[]>`
        SELECT DATE(createdAt) AS day,
               SUM(CASE WHEN provider = 'anthropic' THEN inputTokens ELSE 0 END) AS inTok,
               SUM(CASE WHEN provider = 'anthropic' THEN outputTokens ELSE 0 END) AS outTok,
               SUM(CASE WHEN provider = 'gemini' THEN 1 ELSE 0 END) AS imgs
        FROM model_usage_logs WHERE createdAt >= ${since} GROUP BY DATE(createdAt)`,
    ]);

    const key = (value: unknown) =>
      value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
    const num = (value: unknown) => (value === null || value === undefined ? 0 : Number(value));

    const byDay = <T>(rows: T[], pick: (row: T) => number) =>
      new Map(rows.map((row) => [key((row as { day: unknown }).day), pick(row)]));

    const articleMap = byDay(articles, (r) => num(r.n));
    const qualityMap = byDay(articles, (r) => Math.round(num(r.q)));
    const publishMap = byDay(publishes, (r) => num(r.n));
    const failMap = byDay(failures, (r) => num(r.n));
    // Claude Sonnet $/1M: in 3, out 15 · Gemini 이미지 건당 $0.039 (대시보드 합계와 같은 단가)
    const costMap = new Map(
      cost.map((row) => [
        key(row.day),
        Math.round(
          ((num(row.inTok) / 1_000_000) * 3 + (num(row.outTok) / 1_000_000) * 15 + num(row.imgs) * 0.039) *
            1380,
        ),
      ]),
    );

    const series = [];
    for (let i = 0; i < days; i += 1) {
      const date = new Date(since);
      date.setDate(since.getDate() + i);
      const day = key(date);
      series.push({
        date: day,
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        articles: articleMap.get(day) ?? 0,
        published: publishMap.get(day) ?? 0,
        failed: failMap.get(day) ?? 0,
        // 글이 없는 날의 품질은 0이 아니라 '없음'이다 — 0으로 채우면 그래프가 바닥으로 떨어져 거짓말을 한다
        quality: qualityMap.get(day) ?? null,
        costKrw: costMap.get(day) ?? 0,
      });
    }

    res.json({ days, series });
  }),
);
