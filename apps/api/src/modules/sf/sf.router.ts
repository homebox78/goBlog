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
 * 데이터는 **별도 `redfood` DB**에 저장(사용자 지시 2026-07-20 — goBlog DB와 분리,
 * goblog MySQL 유저에 redfood.* 권한 부여로 같은 커넥션에서 교차 DB 쿼리).
 * 테이블은 lazy 생성(goBlog Prisma 스키마와 분리, 마이그레이션 불필요).
 *
 * sf_state = 앱 상태 동기화 저장소(refs·대본·URL큐·성과) — PC를 옮겨도 영상
 * 폴더만 옮기면 나머지는 여기서 복원. LWW(updated_at ms) 업서트, data NULL=삭제.
 */
const DB = "redfood";
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
    CREATE TABLE IF NOT EXISTS ${DB}.sf_events (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      ts DATETIME NOT NULL,
      kind VARCHAR(32) NOT NULL,
      video_id VARCHAR(255) NULL,
      data JSON NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_sf_events_ts (ts), INDEX idx_sf_events_kind (kind)
    ) CHARACTER SET utf8mb4`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ${DB}.sf_stats (
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
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ${DB}.sf_state (
      scope VARCHAR(32) NOT NULL,
      k VARCHAR(191) NOT NULL,
      data MEDIUMTEXT NULL,
      updated_at BIGINT NOT NULL,
      PRIMARY KEY (scope, k),
      INDEX idx_sf_state_updated (updated_at)
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
        `INSERT INTO ${DB}.sf_events (ts, kind, video_id, data) VALUES (?, ?, ?, ?)`,
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
        `INSERT INTO ${DB}.sf_stats
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

/**
 * 상태 업서트 — LWW(updated_at ms). 같은 키에 더 새 값만 이긴다.
 * data NULL = 삭제 톰스톤(다른 PC가 pull 시 로컬 파일을 지운다).
 */
sfRouter.put(
  "/state",
  asyncHandler(async (req, res) => {
    await ensureTables();
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    let n = 0;
    for (const r of rows.slice(0, 500)) {
      if (!r?.scope || !r?.k || !Number(r.updated_at)) continue;
      await prisma.$executeRawUnsafe(
        `INSERT INTO ${DB}.sf_state (scope, k, data, updated_at)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           data = IF(VALUES(updated_at) >= updated_at, VALUES(data), data),
           updated_at = IF(VALUES(updated_at) >= updated_at,
                           VALUES(updated_at), updated_at)`,
        String(r.scope).slice(0, 32), String(r.k).slice(0, 191),
        r.data == null ? null : String(r.data).slice(0, 4_000_000),
        Number(r.updated_at),
      );
      n += 1;
    }
    res.json({ ok: true, saved: n, now: Date.now() });
  }),
);

/** 상태 내려받기 — since(ms) 이후 변경분만. now = 서버 시계(다음 since 기준). */
sfRouter.get(
  "/state",
  asyncHandler(async (req, res) => {
    await ensureTables();
    const since = Number(req.query.since) || 0;
    const scope = req.query.scope ? String(req.query.scope).slice(0, 32) : null;
    const rows = await prisma.$queryRawUnsafe<
      { scope: string; k: string; data: string | null; updated_at: bigint }[]
    >(
      scope
        ? `SELECT scope, k, data, updated_at FROM ${DB}.sf_state
           WHERE updated_at > ? AND scope = ? ORDER BY updated_at LIMIT 2000`
        : `SELECT scope, k, data, updated_at FROM ${DB}.sf_state
           WHERE updated_at > ? ORDER BY updated_at LIMIT 2000`,
      ...(scope ? [since, scope] : [since]),
    );
    res.json({
      now: Date.now(),
      rows: rows.map((r) => ({
        scope: r.scope, k: r.k, data: r.data,
        updated_at: Number(r.updated_at),
      })),
    });
  }),
);

/** 적재 현황 — 검증·추후 대시보드용. */
sfRouter.get(
  "/summary",
  asyncHandler(async (_req, res) => {
    await ensureTables();
    const [ev] = await prisma.$queryRawUnsafe<{ n: bigint; last: Date | null }[]>(
      `SELECT COUNT(*) AS n, MAX(ts) AS last FROM ${DB}.sf_events`);
    const [st] = await prisma.$queryRawUnsafe<{ n: bigint; last: Date | null }[]>(
      `SELECT COUNT(*) AS n, MAX(ts) AS last FROM ${DB}.sf_stats`);
    const [sn] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT COUNT(*) AS n FROM ${DB}.sf_state`);
    res.json({
      db: DB,
      events: { count: Number(ev?.n ?? 0), last: ev?.last ?? null },
      stats: { count: Number(st?.n ?? 0), last: st?.last ?? null },
      state: { count: Number(sn?.n ?? 0) },
    });
  }),
);
