import { Router } from "express";
import { asyncHandler } from "../../common/http.js";
import { requireAuth } from "../../middleware/auth.js";
import { prisma } from "../../common/prisma.js";

// article_views.viewedAt / newsletter_subscribers.createdAt 은 UTC 저장 → KST(+9h) 기준으로 집계
const KST = "INTERVAL 9 HOUR";
const num = (v: unknown): number => (typeof v === "bigint" ? Number(v) : Number(v ?? 0));

// ─────────────────────────────────────────────────────────────
// 구독자 관리
// ─────────────────────────────────────────────────────────────
export const subscribersRouter = Router();
subscribersRouter.use(requireAuth);

subscribersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const status = String(req.query.status ?? "").trim().toUpperCase();
    const sort = String(req.query.sort ?? "createdAt");
    const order = String(req.query.order ?? "desc").toLowerCase() === "asc" ? "asc" : "desc";
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const pageSize = Math.min(200, Math.max(10, parseInt(String(req.query.pageSize ?? "50"), 10) || 50));

    const where: Record<string, unknown> = {};
    if (q) where.email = { contains: q };
    if (status === "ACTIVE" || status === "UNSUBSCRIBED") where.status = status;

    const sortField = ["createdAt", "email", "status"].includes(sort) ? sort : "createdAt";

    const [total, active, unsub, rows] = await Promise.all([
      prisma.newsletterSubscriber.count(),
      prisma.newsletterSubscriber.count({ where: { status: "ACTIVE" } }),
      prisma.newsletterSubscriber.count({ where: { status: "UNSUBSCRIBED" } }),
      prisma.newsletterSubscriber.findMany({
        where,
        orderBy: { [sortField]: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    const filtered = await prisma.newsletterSubscriber.count({ where });

    res.json({
      subscribers: rows,
      counts: { total, active, unsubscribed: unsub },
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(filtered / pageSize)),
      filtered,
    });
  }),
);

// CSV 내보내기
subscribersRouter.get(
  "/export",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.newsletterSubscriber.findMany({ orderBy: { createdAt: "desc" } });
    const esc = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const csv = [
      "email,status,source,createdAt",
      ...rows.map((r) => [esc(r.email), esc(r.status), esc(r.source), esc(r.createdAt.toISOString())].join(",")),
    ].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="subscribers.csv"`);
    res.send("﻿" + csv); // BOM(엑셀 한글)
  }),
);

subscribersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const status = String(req.body?.status ?? "").toUpperCase();
    if (status !== "ACTIVE" && status !== "UNSUBSCRIBED") {
      res.status(400).json({ error: "status는 ACTIVE 또는 UNSUBSCRIBED" });
      return;
    }
    const row = await prisma.newsletterSubscriber.update({ where: { id }, data: { status } });
    res.json({ subscriber: row });
  }),
);

subscribersRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    await prisma.newsletterSubscriber.delete({ where: { id } });
    res.json({ ok: true });
  }),
);

// ─────────────────────────────────────────────────────────────
// 통계 (조회수·IP)
// ─────────────────────────────────────────────────────────────
export const statsRouter = Router();
statsRouter.use(requireAuth);

statsRouter.get(
  "/overview",
  asyncHandler(async (_req, res) => {
    // v: 조회수, u: 순방문(IP). 각 기간과 직전 동일 기간을 함께 구해 증감률을 낸다.
    const one = async (filter: string) => {
      const [r] = await prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*) v, COUNT(DISTINCT ip) u FROM article_views ${filter}`,
      );
      return { views: num(r.v), uniques: num(r.u) };
    };
    const D = `(viewedAt + ${KST})`;
    const NOW = `(NOW() + ${KST})`;
    const [today, yesterday, month, lastMonth, year, lastYear, all] = await Promise.all([
      one(`WHERE DATE(${D}) = DATE(${NOW})`),
      one(`WHERE DATE(${D}) = DATE(${NOW}) - INTERVAL 1 DAY`),
      one(`WHERE YEAR(${D}) = YEAR(${NOW}) AND MONTH(${D}) = MONTH(${NOW})`),
      one(`WHERE ${D} >= DATE_FORMAT(${NOW} - INTERVAL 1 MONTH, '%Y-%m-01') AND ${D} < DATE_FORMAT(${NOW}, '%Y-%m-01')`),
      one(`WHERE YEAR(${D}) = YEAR(${NOW})`),
      one(`WHERE YEAR(${D}) = YEAR(${NOW}) - 1`),
      one(``),
    ]);
    const subActive = await prisma.newsletterSubscriber.count({ where: { status: "ACTIVE" } });
    const subTotal = await prisma.newsletterSubscriber.count();
    res.json({
      today: { ...today, prev: yesterday.views },
      month: { ...month, prev: lastMonth.views },
      year: { ...year, prev: lastYear.views },
      all: { ...all, prev: null },
      subscribers: { active: subActive, total: subTotal },
    });
  }),
);

// 시계열 — granularity: day(최근 N일) | month(최근 N개월) | year
statsRouter.get(
  "/timeseries",
  asyncHandler(async (req, res) => {
    const g = String(req.query.granularity ?? "day");
    let sql: string;
    if (g === "year") {
      sql = `SELECT YEAR(viewedAt + ${KST}) k, COUNT(*) v, COUNT(DISTINCT ip) u
             FROM article_views GROUP BY k ORDER BY k`;
    } else if (g === "month") {
      const months = Math.min(36, Math.max(1, parseInt(String(req.query.n ?? "12"), 10) || 12));
      sql = `SELECT DATE_FORMAT(viewedAt + ${KST}, '%Y-%m') k, COUNT(*) v, COUNT(DISTINCT ip) u
             FROM article_views WHERE viewedAt + ${KST} >= (NOW() + ${KST}) - INTERVAL ${months} MONTH
             GROUP BY k ORDER BY k`;
    } else {
      const days = Math.min(365, Math.max(1, parseInt(String(req.query.n ?? "30"), 10) || 30));
      sql = `SELECT DATE_FORMAT(viewedAt + ${KST}, '%Y-%m-%d') k, COUNT(*) v, COUNT(DISTINCT ip) u
             FROM article_views WHERE viewedAt + ${KST} >= (NOW() + ${KST}) - INTERVAL ${days} DAY
             GROUP BY k ORDER BY k`;
    }
    const rows = await prisma.$queryRawUnsafe<any[]>(sql);
    res.json({
      series: rows.map((r) => ({ key: String(r.k), views: num(r.v), uniques: num(r.u) })),
    });
  }),
);

// 기사별 조회수 — period: all | today | month | year, 정렬 views|uniques
statsRouter.get(
  "/articles",
  asyncHandler(async (req, res) => {
    const period = String(req.query.period ?? "all");
    const sort = String(req.query.sort ?? "views") === "uniques" ? "u" : "v";
    const limit = Math.min(200, Math.max(5, parseInt(String(req.query.limit ?? "50"), 10) || 50));
    let filter = "";
    if (period === "today") filter = `WHERE DATE(viewedAt + ${KST}) = DATE(NOW() + ${KST})`;
    else if (period === "month")
      filter = `WHERE YEAR(viewedAt + ${KST}) = YEAR(NOW() + ${KST}) AND MONTH(viewedAt + ${KST}) = MONTH(NOW() + ${KST})`;
    else if (period === "year") filter = `WHERE YEAR(viewedAt + ${KST}) = YEAR(NOW() + ${KST})`;

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT articleId, COUNT(*) v, COUNT(DISTINCT ip) u, MAX(viewedAt) last
       FROM article_views ${filter} GROUP BY articleId ORDER BY ${sort} DESC LIMIT ${limit}`,
    );
    const ids = rows.map((r) => Number(r.articleId));
    const articles = ids.length
      ? await prisma.article.findMany({
          where: { id: { in: ids } },
          select: { id: true, title: true, keyword: { select: { category: true } } },
        })
      : [];
    const byId = new Map(articles.map((a) => [a.id, a]));
    res.json({
      articles: rows.map((r) => {
        const a = byId.get(Number(r.articleId));
        return {
          articleId: Number(r.articleId),
          title: a?.title ?? `#${r.articleId}`,
          category: a?.keyword?.category ?? null,
          views: num(r.v),
          uniques: num(r.u),
          lastViewedAt: r.last,
        };
      }),
    });
  }),
);
