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
