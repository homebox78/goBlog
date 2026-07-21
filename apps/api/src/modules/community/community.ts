// 주식 커뮤니티 — 사용자·세션·글·댓글·투자의견 + 모더레이션.
// 테이블은 raw SQL(마이그레이션 무접촉). PHP 뉴스사이트가 같은 테이블을 읽어 로그인 상태·글을 렌더한다.
import crypto from "node:crypto";
import type { Request, Response } from "express";
import { prisma } from "../../common/prisma.js";

export const SESSION_COOKIE = "h2b_uid";
const SESSION_DAYS = 30;

let schemaReady = false;
export async function ensureCommunitySchema(): Promise<void> {
  if (schemaReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS community_users (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      provider   VARCHAR(10)  NOT NULL,
      providerId VARCHAR(80)  NOT NULL,
      email      VARCHAR(160) NULL,
      name       VARCHAR(60)  NOT NULL,
      avatar     VARCHAR(300) NULL,
      banned     TINYINT      NOT NULL DEFAULT 0,
      createdAt  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_provider (provider, providerId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS community_sessions (
      token     CHAR(48)  NOT NULL PRIMARY KEY,
      userId    INT       NOT NULL,
      expiresAt DATETIME  NOT NULL,
      createdAt DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_sess_user (userId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS community_posts (
      id        INT AUTO_INCREMENT PRIMARY KEY,
      ticker    VARCHAR(6)  NOT NULL,
      userId    INT         NOT NULL,
      body      TEXT        NOT NULL,
      stance    VARCHAR(4)  NULL,
      likes     INT         NOT NULL DEFAULT 0,
      comments  INT         NOT NULL DEFAULT 0,
      hidden    TINYINT     NOT NULL DEFAULT 0,
      createdAt DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_posts_ticker (ticker, hidden, createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS community_comments (
      id        INT AUTO_INCREMENT PRIMARY KEY,
      postId    INT      NOT NULL,
      userId    INT      NOT NULL,
      body      TEXT     NOT NULL,
      hidden    TINYINT  NOT NULL DEFAULT 0,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_comments_post (postId, hidden, createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS community_post_likes (
      postId INT NOT NULL,
      userId INT NOT NULL,
      PRIMARY KEY (postId, userId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  schemaReady = true;
}

export interface CommunityUser {
  id: number;
  name: string;
  email: string | null;
  avatar: string | null;
  banned: number;
}

/** 쿠키 세션 토큰으로 현재 사용자를 찾는다(없으면 null). */
export async function currentUser(req: Request): Promise<CommunityUser | null> {
  await ensureCommunitySchema();
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token || typeof token !== "string") return null;
  const rows = (await prisma.$queryRaw`
    SELECT u.id, u.name, u.email, u.avatar, u.banned
    FROM community_sessions s JOIN community_users u ON u.id = s.userId
    WHERE s.token = ${token} AND s.expiresAt > NOW()
    LIMIT 1`) as CommunityUser[];
  return rows[0] ?? null;
}

/** 구글 로그인 성공 → 사용자 upsert + 세션 발급 + 쿠키 설정. */
export async function loginUser(
  res: Response,
  profile: { provider: string; providerId: string; email: string | null; name: string; avatar: string | null },
): Promise<void> {
  await ensureCommunitySchema();
  await prisma.$executeRaw`
    INSERT INTO community_users (provider, providerId, email, name, avatar)
    VALUES (${profile.provider}, ${profile.providerId}, ${profile.email}, ${profile.name}, ${profile.avatar})
    ON DUPLICATE KEY UPDATE email=VALUES(email), name=VALUES(name), avatar=VALUES(avatar)`;
  const rows = (await prisma.$queryRaw`
    SELECT id FROM community_users WHERE provider=${profile.provider} AND providerId=${profile.providerId} LIMIT 1`) as Array<{
    id: number;
  }>;
  const userId = rows[0]?.id;
  if (!userId) throw new Error("사용자 생성 실패");
  const token = crypto.randomBytes(24).toString("hex"); // 48 chars
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.$executeRaw`INSERT INTO community_sessions (token, userId, expiresAt) VALUES (${token}, ${userId}, ${expires})`;
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export async function logoutUser(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) await prisma.$executeRaw`DELETE FROM community_sessions WHERE token = ${token}`.catch(() => undefined);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

// 리딩·펌핑·불법 유도 차단 — 주식 커뮤니티 모더레이션(유사투자자문·시세조종 방지)
const BLOCK_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /리딩|풀매수|몰빵|영끌|목표가\s*\d|단타\s*추천|확정\s*수익|수익\s*보장|원금\s*보장/, label: "리딩·수익보장" },
  { re: /세력|작전주|상한가\s*(간다|갑니다|예약)|급등\s*예약|내일\s*오른다|따상/, label: "시세조종·선동" },
  { re: /텔레그램|텔레\s*방|카톡방|오픈채팅|오카방|카카오\s*방|무료\s*리딩|종목\s*방|입장/, label: "외부 리딩방 유도" },
  { re: /수익\s*인증|계좌\s*인증|비법|비밀\s*정보|내부\s*정보|미공개\s*정보/, label: "미검증·불법정보" },
];
const PROFANITY = /(씨발|시발|병신|개새끼|좆|지랄|꺼져|엿먹)/;

/** 게시 가능 여부 검사. ok=false면 사유. */
export function moderate(text: string): { ok: boolean; reason?: string } {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 2) return { ok: false, reason: "내용이 너무 짧습니다." };
  if (t.length > 2000) return { ok: false, reason: "내용이 너무 깁니다(2000자 이내)." };
  for (const { re, label } of BLOCK_PATTERNS) {
    if (re.test(t)) return { ok: false, reason: `게시 불가: ${label} 관련 표현은 허용되지 않습니다.` };
  }
  if (PROFANITY.test(t)) return { ok: false, reason: "비속어는 사용할 수 없습니다." };
  return { ok: true };
}

/** id_token(JWT) 페이로드 디코드 — 구글에서 코드교환으로 직접 받은 것이라 서명검증 생략(TLS 신뢰). */
export function decodeIdToken(idToken: string): { sub?: string; email?: string; email_verified?: boolean; name?: string; picture?: string } {
  const parts = idToken.split(".");
  if (parts.length < 2) return {};
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return {};
  }
}
