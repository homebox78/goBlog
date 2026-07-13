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
