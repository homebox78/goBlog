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
      take: 60,
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

/** 수동 수집 실행 (수집만) */
keywordsRouter.post(
  "/discover",
  asyncHandler(async (req, res) => {
    const result = await runDailyDiscovery("manual");
    res.json(result);
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
