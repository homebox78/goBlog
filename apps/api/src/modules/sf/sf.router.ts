import { Router, type NextFunction, type Request, type Response } from "express";
import { prisma } from "../../common/prisma.js";
import { asyncHandler } from "../../common/http.js";
import { env } from "../../common/env.js";

/**
 * Shorts Factory(데스크톱 앱) 데이터 미러 수집.
 *
 * 앱의 실제 동작(합성·업로드)은 데스크톱에 두고, 성과·이벤트만 서버 MySQL에
 * 시계열로 쌓는다 — 두 PC 공유·추이 분석·추후 무인화 대비.
 * 로컬 파일이 단일 진리원이고 여기는 미러다(전송 실패해도 앱 무영향).
 *
 * 인증은 확장과 같은 EXTENSION_TOKEN 재사용(X-SF-Token 헤더) — .env 변경 없음.
 * 테이블은 sf_ 접두로 lazy 생성(goBlog Prisma 스키마와 분리, 마이그레이션 불필요).
 */
function requireSfToken(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["x-sf-token"];
  if (!env.EXTENSION_TOKEN || token !== env.EXTENSION_TOKEN) {
    return res.status(401).json({ error: "SF 토큰이 올바르지 않습니다." });
  }
  next();
}

let ensured = false;
async function ensureTables() {
  if (ensured) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS sf_events (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      ts DATETIME NOT NULL,
      kind VARCHAR(32) NOT NULL,
      video_id VARCHAR(255) NULL,
      data JSON NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_sf_events_ts (ts), INDEX idx_sf_events_kind (kind)
    ) CHARACTER SET utf8mb4`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS sf_stats (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      ts DATETIME NOT NULL,
      video_id VARCHAR(255) NOT NULL,
      yt_id VARCHAR(32) NULL,
      channel VARCHAR(64) NULL,
      title VARCHAR(512) NULL,
      views INT DEFAULT 0, likes INT DEFAULT 0, comments INT DEFAULT 0,
      avg_pct FLOAT NULL, duration INT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_sf_stats_video (video_id), INDEX idx_sf_stats_ts (ts)
    ) CHARACTER SET utf8mb4`);
  ensured = true;
}

const toDate = (v: unknown) => {
  const d = new Date(String(v ?? ""));
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

export const sfRouter = Router();
sfRouter.use(requireSfToken);

/** 이벤트 미러 — 사이드카 history.jsonl의 행을 그대로 받는다. */
sfRouter.post(
  "/events",
  asyncHandler(async (req, res) => {
    await ensureTables();
    const events = Array.isArray(req.body?.events) ? req.body.events : [];
    let n = 0;
    for (const e of events.slice(0, 200)) {
      const { ts, kind, video_id, ...data } = e ?? {};
      if (!kind) continue;
      await prisma.$executeRawUnsafe(
        "INSERT INTO sf_events (ts, kind, video_id, data) VALUES (?, ?, ?, ?)",
        toDate(ts), String(kind).slice(0, 32),
        video_id ? String(video_id).slice(0, 255) : null,
        JSON.stringify(data ?? {}).slice(0, 60000),
      );
      n += 1;
    }
    res.json({ ok: true, saved: n });
  }),
);

/** 성과 스냅샷 — 수집할 때마다 append = 시계열(추이 분석용). */
sfRouter.post(
  "/stats",
  asyncHandler(async (req, res) => {
    await ensureTables();
    const snaps = Array.isArray(req.body?.snapshots) ? req.body.snapshots : [];
    let n = 0;
    for (const s of snaps.slice(0, 200)) {
      if (!s?.video_id) continue;
      await prisma.$executeRawUnsafe(
        `INSERT INTO sf_stats
           (ts, video_id, yt_id, channel, title, views, likes, comments, avg_pct, duration)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        toDate(s.ts), String(s.video_id).slice(0, 255),
        s.yt_id ? String(s.yt_id).slice(0, 32) : null,
        s.channel ? String(s.channel).slice(0, 64) : null,
        s.title ? String(s.title).slice(0, 512) : null,
        Number(s.views) || 0, Number(s.likes) || 0, Number(s.comments) || 0,
        s.avg_pct == null ? null : Number(s.avg_pct),
        s.duration == null ? null : Number(s.duration),
      );
      n += 1;
    }
    res.json({ ok: true, saved: n });
  }),
);

/** 적재 현황 — 검증·추후 대시보드용. */
sfRouter.get(
  "/summary",
  asyncHandler(async (_req, res) => {
    await ensureTables();
    const [ev] = await prisma.$queryRawUnsafe<{ n: bigint; last: Date | null }[]>(
      "SELECT COUNT(*) AS n, MAX(ts) AS last FROM sf_events");
    const [st] = await prisma.$queryRawUnsafe<{ n: bigint; last: Date | null }[]>(
      "SELECT COUNT(*) AS n, MAX(ts) AS last FROM sf_stats");
    res.json({
      events: { count: Number(ev?.n ?? 0), last: ev?.last ?? null },
      stats: { count: Number(st?.n ?? 0), last: st?.last ?? null },
    });
  }),
);
