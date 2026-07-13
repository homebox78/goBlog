import { Router } from "express";
import { prisma } from "../../common/prisma.js";
import { asyncHandler } from "../../common/http.js";
import { requireAuth } from "../../middleware/auth.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    try {
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
        // 85점 미만 (82점 초과 — 이하는 생성 시 폐기됨)
        prisma.article.count({ where: { qualityScore: { lt: 85 }, status: { not: "PUBLISHED" } } }),
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
