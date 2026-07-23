import { Router } from "express";
import { asyncHandler } from "../../common/http.js";
import { requireAuth } from "../../middleware/auth.js";
import { prisma } from "../../common/prisma.js";
import { ensureStatsSchema, resolvePendingGeo } from "./geo.js";

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

// ─────────────────────────────────────────────────────────────
// 페이지뷰 통계 (메뉴별 / 계산기 / 문서 / 지역 / 방문자) — page_views 기반
// ─────────────────────────────────────────────────────────────

// period → viewedAt WHERE 절 (KST 보정)
function pageFilter(period: string, extra = ""): string {
  const D = `(viewedAt + ${KST})`;
  const NOW = `(NOW() + ${KST})`;
  let cond = "";
  if (period === "today") cond = `DATE(${D}) = DATE(${NOW})`;
  else if (period === "month") cond = `YEAR(${D}) = YEAR(${NOW}) AND MONTH(${D}) = MONTH(${NOW})`;
  else if (period === "year") cond = `YEAR(${D}) = YEAR(${NOW})`;
  const parts = [cond, extra].filter(Boolean);
  return parts.length ? `WHERE ${parts.join(" AND ")}` : "";
}

// 메뉴(페이지 유형)별 조회수·순방문
statsRouter.get(
  "/pages",
  asyncHandler(async (req, res) => {
    await ensureStatsSchema();
    const period = String(req.query.period ?? "month");
    const filter = pageFilter(period);
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT type, COUNT(*) v, COUNT(DISTINCT ip) u FROM page_views ${filter} GROUP BY type ORDER BY v DESC`,
    );
    const [tot] = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) v, COUNT(DISTINCT ip) u FROM page_views ${filter}`,
    );
    res.json({
      total: { views: num(tot?.v), uniques: num(tot?.u) },
      pages: rows.map((r) => ({ type: String(r.type), views: num(r.v), uniques: num(r.u) })),
    });
  }),
);

// 계산기(type=tool) / 문서(type=doc) 인기 순위 — 공용 핸들러
function popularityHandler(type: "tool" | "doc") {
  return asyncHandler(async (req: any, res: any) => {
    await ensureStatsSchema();
    const period = String(req.query.period ?? "month");
    const limit = Math.min(200, Math.max(5, parseInt(String(req.query.limit ?? "50"), 10) || 50));
    const filter = pageFilter(period, `type = '${type}' AND pkey IS NOT NULL AND pkey <> ''`);
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT pkey, MAX(title) title, COUNT(*) v, COUNT(DISTINCT ip) u, MAX(viewedAt) last
       FROM page_views ${filter} GROUP BY pkey ORDER BY v DESC LIMIT ${limit}`,
    );
    res.json({
      items: rows.map((r) => ({
        key: String(r.pkey),
        title: r.title ? String(r.title) : String(r.pkey),
        views: num(r.v),
        uniques: num(r.u),
        lastViewedAt: r.last,
      })),
    });
  });
}
statsRouter.get("/tools", popularityHandler("tool"));
statsRouter.get("/docs", popularityHandler("doc"));

// 지역별 방문 — 국가·시/도 집계 (ip_geo 조인)
statsRouter.get(
  "/geo",
  asyncHandler(async (req, res) => {
    await ensureStatsSchema();
    const period = String(req.query.period ?? "month");
    const filter = pageFilter(period);
    const byCountry = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(g.country, '미확인') country, COUNT(*) v, COUNT(DISTINCT pv.ip) u
       FROM page_views pv LEFT JOIN ip_geo g ON g.ip = pv.ip
       ${filter} GROUP BY country ORDER BY u DESC LIMIT 30`,
    );
    const byRegion = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(NULLIF(g.region, ''), '미확인') region, COALESCE(g.country, '') country,
              COUNT(*) v, COUNT(DISTINCT pv.ip) u
       FROM page_views pv LEFT JOIN ip_geo g ON g.ip = pv.ip
       ${filter} GROUP BY region, country ORDER BY u DESC LIMIT 40`,
    );
    const [pend] = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) c FROM (
         SELECT DISTINCT ip FROM page_views WHERE ip IS NOT NULL AND ip <> '' AND ip NOT IN (SELECT ip FROM ip_geo)
       ) t`,
    );
    res.json({
      byCountry: byCountry.map((r) => ({ country: String(r.country), views: num(r.v), uniques: num(r.u) })),
      byRegion: byRegion.map((r) => ({
        region: String(r.region),
        country: String(r.country),
        views: num(r.v),
        uniques: num(r.u),
      })),
      pendingGeo: num(pend?.c),
    });
  }),
);

// 최근 방문자 — IP·지역·본 페이지 목록
statsRouter.get(
  "/visitors",
  asyncHandler(async (req, res) => {
    await ensureStatsSchema();
    const limit = Math.min(300, Math.max(10, parseInt(String(req.query.limit ?? "100"), 10) || 100));
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT pv.ip, pv.type, pv.pkey, pv.title, pv.referer, pv.viewedAt,
              g.country, g.region, g.city, g.isp
       FROM page_views pv LEFT JOIN ip_geo g ON g.ip = pv.ip
       ORDER BY pv.id DESC LIMIT ${limit}`,
    );
    res.json({
      visitors: rows.map((r) => ({
        ip: r.ip ? String(r.ip) : "",
        type: String(r.type),
        key: r.pkey ? String(r.pkey) : null,
        title: r.title ? String(r.title) : null,
        referer: r.referer ? String(r.referer) : null,
        country: r.country ? String(r.country) : null,
        region: r.region ? String(r.region) : null,
        city: r.city ? String(r.city) : null,
        isp: r.isp ? String(r.isp) : null,
        viewedAt: r.viewedAt,
      })),
    });
  }),
);

// 미해석 IP를 즉시 지역 변환(관리자 수동 트리거). 크론이 5분마다 자동 처리하나 즉시 반영용.
statsRouter.post(
  "/geo/resolve",
  asyncHandler(async (req, res) => {
    const limit = Math.min(200, Math.max(1, parseInt(String(req.body?.limit ?? "60"), 10) || 60));
    const r = await resolvePendingGeo(limit);
    res.json(r);
  }),
);
