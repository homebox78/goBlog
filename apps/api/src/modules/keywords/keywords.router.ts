import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../common/prisma.js";
import { asyncHandler, HttpError, parseBody } from "../../common/http.js";
import { requireAuth } from "../../middleware/auth.js";
import { isDiscoveryRunning, kstToday, runDailyDiscovery } from "./engine.js";

export const keywordsRouter = Router();

keywordsRouter.use(requireAuth);

/** 오늘의 추천 키워드 (지표 포함) */
keywordsRouter.get(
  "/today",
  asyncHandler(async (req, res) => {
    const { ymd, date } = kstToday();

    const recommendations = await prisma.dailyKeywordRecommendation.findMany({
      where: { date },
      orderBy: { finalScore: "desc" },
      take: 30,
      include: {
        keyword: {
          include: {
            metrics: { where: { date } },
          },
        },
      },
    });

    res.json({
      date: ymd,
      running: isDiscoveryRunning(),
      items: recommendations.map((row, index) => {
        const google = row.keyword.metrics.find((metric) => metric.source === "GOOGLE_ADS");
        const naver = row.keyword.metrics.find((metric) => metric.source === "NAVER_SEARCHAD");
        return {
          id: row.keyword.id,
          rank: index + 1,
          keyword: row.keyword.text,
          category: row.keyword.category,
          type: (row.data as { type?: string } | null)?.type ?? row.keyword.sourceType,
          searchIntent: row.keyword.searchIntent,
          status: row.keyword.status,
          reason: row.reason,
          totalDocs: (row.data as { totalDocs?: number } | null)?.totalDocs ?? null,
          competitionScore: (row.data as { competitionScore?: number } | null)?.competitionScore ?? null,
          scores: {
            revenue: row.revenueScore,
            value: row.valueScore,
            opportunity: row.opportunityScore,
            final: row.finalScore,
          },
          metrics: {
            googleMonthlySearches: google?.avgMonthlySearches ?? null,
            // BigInt는 JSON 직렬화 불가 — 원 단위 숫자로 변환
            googleCpcKrw:
              google?.cpcMicros !== null && google?.cpcMicros !== undefined
                ? Math.round(Number(google.cpcMicros) / 1_000_000)
                : null,
            googleCompetition: google?.competition ?? null,
            naverMonthlySearches: naver?.avgMonthlySearches ?? null,
          },
        };
      }),
    });
  }),
);

/** 저장(북마크)한 키워드 목록 — 날짜 무관 */
keywordsRouter.get(
  "/saved",
  asyncHandler(async (req, res) => {
    const keywords = await prisma.keyword.findMany({
      where: { status: "SAVED" },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        metrics: { orderBy: { date: "desc" }, take: 2 },
        recommendations: { orderBy: { date: "desc" }, take: 1 },
      },
    });

    res.json({
      items: keywords.map((keyword, index) => {
        const google = keyword.metrics.find((metric) => metric.source === "GOOGLE_ADS");
        const naver = keyword.metrics.find((metric) => metric.source === "NAVER_SEARCHAD");
        const rec = keyword.recommendations[0];
        return {
          id: keyword.id,
          rank: index + 1,
          keyword: keyword.text,
          category: keyword.category,
          type: keyword.sourceType,
          searchIntent: keyword.searchIntent,
          status: keyword.status,
          reason: rec?.reason ?? null,
          totalDocs: (rec?.data as { totalDocs?: number } | null)?.totalDocs ?? null,
          scores: {
            revenue: rec?.revenueScore ?? null,
            value: rec?.valueScore ?? null,
            opportunity: rec?.opportunityScore ?? null,
            final: rec?.finalScore ?? null,
          },
          metrics: {
            googleMonthlySearches: google?.avgMonthlySearches ?? null,
            googleCpcKrw:
              google?.cpcMicros !== null && google?.cpcMicros !== undefined
                ? Math.round(Number(google.cpcMicros) / 1_000_000)
                : null,
            googleCompetition: google?.competition ?? null,
            naverMonthlySearches: naver?.avgMonthlySearches ?? null,
          },
        };
      }),
    });
  }),
);

/** 키워드 수집 시계열 (빅데이터) — 년/월/일·키워드로 필터해 누적 스냅샷 조회 */
keywordsRouter.get(
  "/trends",
  asyncHandler(async (req, res) => {
    const num = (v: unknown) => (v !== undefined && v !== "" ? Number(v) : undefined);
    const year = num(req.query.year);
    const month = num(req.query.month);
    const day = num(req.query.day);
    const text = req.query.keyword ? String(req.query.keyword).trim() : undefined;
    const where = {
      ...(year ? { year } : {}),
      ...(month ? { month } : {}),
      ...(day ? { day } : {}),
      ...(text ? { keywordText: { contains: text } } : {}),
    };
    // 하루 4회 수집을 취합: 같은 날 같은 키워드는 최고 종합점수 1건으로 합치고, 일자별 종합점수 순 재랭크 후 상위 10만.
    const rows = await prisma.keywordTrend.findMany({
      where,
      orderBy: [{ date: "desc" }, { finalScore: "desc" }],
      take: 4000,
    });
    const byDay = new Map<string, Map<string, (typeof rows)[number]>>();
    for (const r of rows) {
      const dayKey = `${r.year}-${String(r.month).padStart(2, "0")}-${String(r.day).padStart(2, "0")}`;
      if (!byDay.has(dayKey)) byDay.set(dayKey, new Map());
      const kwMap = byDay.get(dayKey)!;
      const prev = kwMap.get(r.keywordText);
      if (!prev || (r.finalScore ?? 0) > (prev.finalScore ?? 0)) kwMap.set(r.keywordText, r);
    }
    const items: Array<(typeof rows)[number] & { rank: number }> = [];
    for (const dayKey of [...byDay.keys()].sort().reverse()) {
      const top10 = [...byDay.get(dayKey)!.values()]
        .sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0))
        .slice(0, 10);
      top10.forEach((r, i) => items.push({ ...r, rank: i + 1 }));
    }
    res.json({ total: items.length, items });
  }),
);

/** 수동 수집 실행 (수집만) */
keywordsRouter.post(
  "/discover",
  asyncHandler(async (req, res) => {
    const result = await runDailyDiscovery("manual");
    res.json(result);
  }),
);

/**
 * AI 브리핑 인용 게시물 — 내 키워드로 네이버 블로그 탭을 긁어 모은 상위 글.
 * 어떤 글·블로거가 AI에 잘 인용되는지 보는 벤치마크 화면용.
 */
keywordsRouter.get(
  "/citations",
  asyncHandler(async (req, res) => {
    const date = typeof req.query.date === "string" ? req.query.date : undefined;
    const where = date ? { date: new Date(date) } : {};

    const rows = await prisma.blogCitation.findMany({
      where,
      orderBy: [{ citedCount: "desc" }, { date: "desc" }],
      take: 300,
    });

    // 블로거별 집계 — 자주·많이 인용되는 채널 랭킹
    const byBlog = new Map<string, { blogId: string; blogName: string | null; citedCount: number; posts: number }>();
    for (const row of rows) {
      const entry = byBlog.get(row.blogId) ?? {
        blogId: row.blogId,
        blogName: row.blogName,
        citedCount: Number(row.citedCount ?? 0),
        posts: 0,
      };
      entry.posts += 1;
      entry.citedCount = Math.max(entry.citedCount, Number(row.citedCount ?? 0));
      byBlog.set(row.blogId, entry);
    }

    res.json({
      total: rows.length,
      collectedDates: [...new Set(rows.map((r) => r.date.toISOString().slice(0, 10)))],
      // BigInt 는 JSON 직렬화가 안 되므로 number 로 내린다.
      items: rows.map((row) => ({
        id: row.id,
        keyword: row.keywordText,
        date: row.date.toISOString().slice(0, 10),
        rank: row.rank,
        title: row.title,
        url: row.url,
        blogId: row.blogId,
        blogName: row.blogName,
        citedCount: row.citedCount === null ? null : Number(row.citedCount),
        citedLabel: row.citedLabel,
        postedAt: row.postedAt,
      })),
      topBlogs: [...byBlog.values()].sort((a, b) => b.citedCount - a.citedCount).slice(0, 20),
    });
  }),
);

/** 인용 게시물 수동 수집 (스케줄러는 하루 1회 자동 실행) */
keywordsRouter.post(
  "/citations/collect",
  asyncHandler(async (_req, res) => {
    const { collectBlogCitations } = await import("./citation.js");
    res.json(await collectBlogCitations());
  }),
);

/** 인용 학습 결과 — 인용된 글들을 읽고 뽑은 말투·구조·빈 각도 (글 생성 프롬프트에 주입됨) */
keywordsRouter.get(
  "/citations/insights",
  asyncHandler(async (_req, res) => {
    // __STYLE__ 은 키워드가 아니라 전역 문체 프로파일 행이므로 목록에서 뺀다.
    const rows = await prisma.citationInsight.findMany({
      where: { NOT: { keywordText: { startsWith: "__STYLE__" } } },
      orderBy: { updatedAt: "desc" },
      take: 60,
    });

    // 제외된(근접 중복) 키워드의 인사이트는 감춘다.
    // 이걸 안 하면 사실상 같은 키워드가 여러 그룹으로 나뉘어 **같은 인용 글이 반복 표시된다**
    // (예: "…스마트 글래스 가격 기능" / "…스마트 글래스 기능 비교" 가 같은 글 1건을 각각 보여줌).
    const excluded = new Set(
      (
        await prisma.keyword.findMany({
          where: { status: "EXCLUDED", text: { in: rows.map((row) => row.keywordText) } },
          select: { text: true },
        })
      ).map((row) => row.text),
    );

    res.json({
      items: rows
        .filter((row) => !excluded.has(row.keywordText))
        .map((row) => ({
          keyword: row.keywordText,
          postsStudied: row.postsStudied,
          updatedAt: row.updatedAt,
          ...(row.data as object),
        })),
    });
  }),
);

/** 말투 프로파일 — 인용 상위 블로거들의 문체를 실측한 결과 (모든 글 생성에 적용됨) */
keywordsRouter.get(
  "/citations/style",
  asyncHandler(async (_req, res) => {
    const { getStyleForPrompt } = await import("./citation-study.js");
    res.json({ style: await getStyleForPrompt() });
  }),
);

/** 말투 학습 — 인용 상위 블로거 글들을 읽고 문체를 실측해 규칙화 (1~2분 소요) */
keywordsRouter.post(
  "/citations/study-style",
  asyncHandler(async (_req, res) => {
    const { studyStyle } = await import("./citation-study.js");
    const style = await studyStyle();
    if (!style) throw new HttpError(404, "학습할 인용 글이 부족합니다. 먼저 '지금 수집'을 눌러주세요.");
    res.json({ style });
  }),
);

/** 특정 키워드 인용 학습 (인용된 글들을 실제로 읽고 Claude 분석 — 1~2분 소요) */
keywordsRouter.post(
  "/citations/study",
  asyncHandler(async (req, res) => {
    const { studyKeyword, studyPendingKeywords } = await import("./citation-study.js");
    const keyword = typeof req.body?.keyword === "string" ? req.body.keyword : null;
    if (keyword) {
      const insight = await studyKeyword(keyword);
      if (!insight) throw new HttpError(404, "이 키워드에는 수집된 인용 글이 없습니다. 먼저 '지금 수집'을 눌러주세요.");
      return res.json({ keyword, insight });
    }
    res.json(await studyPendingKeywords(5));
  }),
);

const manualSchema = z.object({
  text: z.string().min(2).max(80),
  category: z.string().max(40).optional(),
  searchIntent: z.string().max(40).optional(),
});

/**
 * 수동 키워드 추가 — 자동 발굴과 별개로 직접 정한 주제로 글을 쓸 때 사용한다.
 * 이미 있는 키워드면 SAVED로 되살려 재사용한다(중복 생성 방지).
 */
keywordsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { text, category, searchIntent } = parseBody(manualSchema, req.body);
    const keyword = await prisma.keyword.upsert({
      where: { text },
      update: { status: "SAVED", category, searchIntent },
      create: { text, category, searchIntent, sourceType: "MANUAL", status: "SAVED" },
    });
    res.json({ id: keyword.id, text: keyword.text, status: keyword.status });
  }),
);

const statusSchema = z.object({
  status: z.enum(["RECOMMENDED", "SAVED", "EXCLUDED"]),
});

/** 키워드 저장/제외 */
keywordsRouter.patch(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(400, "잘못된 키워드 ID입니다.");
    const { status } = parseBody(statusSchema, req.body);

    const keyword = await prisma.keyword.update({ where: { id }, data: { status } });
    res.json({ id: keyword.id, status: keyword.status });
  }),
);

/**
 * 키워드 상세 — 흩어진 데이터를 **한 화면에** 모은다.
 * 지금까지 키워드는 표의 '한 줄'이 전부였다. 시계열·경쟁·인용 상위 글·학습 인사이트가
 * 전부 따로 있어서, 이 키워드로 글을 쓸지 판단하려면 여러 화면을 헤매야 했다.
 */
keywordsRouter.get(
  "/:id/detail",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const keyword = await prisma.keyword.findUnique({
      where: { id },
      include: {
        metrics: true,
        recommendations: { orderBy: { date: "desc" }, take: 1 },
      },
    });
    if (!keyword) throw new HttpError(404, "키워드를 찾을 수 없습니다.");

    const [trends, citations, insight, articles] = await Promise.all([
      // 시계열 — 검색량·순위 추세 그래프용
      prisma.keywordTrend.findMany({
        where: { keywordText: keyword.text },
        orderBy: { collectedAt: "asc" },
        take: 120,
        select: {
          date: true,
          collectedAt: true,
          rank: true,
          searchVolume: true,
          finalScore: true,
          competitionScore: true,
        },
      }),
      // 이 키워드에서 실제로 인용된 상위 글 (경쟁 글이 무엇을 썼는가)
      prisma.blogCitation.findMany({
        where: { keywordText: keyword.text },
        orderBy: [{ date: "desc" }, { rank: "asc" }],
        take: 10,
        select: { rank: true, title: true, url: true, blogName: true, citedLabel: true, citedCount: true },
      }),
      // 학습된 인사이트 (왜 인용됐나 · 빈 각도)
      prisma.citationInsight.findUnique({ where: { keywordText: keyword.text } }),
      // 이 키워드로 이미 쓴 글
      prisma.article.findMany({
        where: { keywordId: id },
        select: { id: true, title: true, status: true, qualityScore: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // 트렌드 모멘텀 (오르는 중인가 · 며칠째인가)
    const { trendSignalFor } = await import("./trend-signal.js");
    const trend = await trendSignalFor(keyword.text).catch(() => null);

    // 연관 키워드 — 네이버 실측 검색량 (예전엔 받아놓고 버리던 데이터)
    // ⚠️ 긴 문구를 통째로 물으면 네이버가 거의 못 준다("주담대 한도 줄었을 때 대안 대출" → 1개).
    //    **핵심 단어로 잘라서** 함께 묻는다 (앞 2어절 = 대개 주제어).
    const { fetchRelatedKeywords } = await import("./related-keywords.js");
    const words = keyword.text.split(/\s+/).filter(Boolean);
    const hints = [...new Set([keyword.text, words.slice(0, 2).join(" "), words[0]])].filter(
      (hint) => hint && hint.length >= 2,
    );
    const related = await fetchRelatedKeywords(hints, 15).catch(() => []);

    // ⚠️ metrics 는 소스별(구글/네이버) 배열이다 — 그대로 내려주면 화면이 못 읽는다.
    //    목록 API와 같은 모양으로 평평하게 정리해서 준다.
    const google = keyword.metrics.find((row) => row.source === "GOOGLE_ADS");
    const naver = keyword.metrics.find((row) => row.source === "NAVER_SEARCHAD");
    const recommendation = keyword.recommendations[0];

    res.json({
      keyword: {
        id: keyword.id,
        text: keyword.text,
        status: keyword.status,
        category: keyword.category,
        type: keyword.sourceType,
        searchIntent: keyword.searchIntent,
        reason: recommendation?.reason ?? null,
      },
      metrics: {
        naverMonthlySearches: naver?.avgMonthlySearches ?? null,
        googleMonthlySearches: google?.avgMonthlySearches ?? null,
        // CPC는 마이크로 단위로 저장된다 (1원 = 1,000,000 마이크로)
        googleCpcKrw:
          google?.cpcMicros != null ? Math.round(Number(google.cpcMicros) / 1_000_000) : null,
        totalDocs: recommendation?.totalDocs ?? null,
        competitionScore: recommendation?.competitionScore ?? null,
      },
      trend,
      trends: trends.map((row) => ({
        date: row.date.toISOString().slice(0, 10),
        at: row.collectedAt.toISOString(),
        rank: row.rank,
        searchVolume: row.searchVolume,
        finalScore: row.finalScore,
        competitionScore: row.competitionScore,
      })),
      citations,
      insight: insight?.data ?? null,
      related,
      articles,
    });
  }),
);
