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

      const [keywordsToday, articleCount, publishStats, recentArticles, recentJobs] =
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
        ]);

      res.json({
        db: true,
        keywordsToday,
        articleCount,
        publishStats: Object.fromEntries(
          publishStats.map((row) => [row.status, row._count._all]),
        ),
        recentArticles,
        recentJobs,
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
