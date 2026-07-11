import { Router, type Response } from "express";
import argon2 from "argon2";
import { z } from "zod";
import { prisma } from "../../common/prisma.js";
import { asyncHandler, HttpError, parseBody } from "../../common/http.js";
import { randomToken, sha256Hex } from "../../common/crypto.js";
import { env, isProduction } from "../../common/env.js";
import { ACCESS_COOKIE, REFRESH_COOKIE, requireAuth } from "../../middleware/auth.js";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_DAYS,
  signAccessToken,
} from "./tokens.js";

const MAX_FAILED_LOGINS = 10;
const LOCK_MINUTES = 15;

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
    path: "/",
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    path: "/api/auth",
  });
}

async function issueTokens(res: Response, user: { id: number; email: string }) {
  const accessToken = await signAccessToken({ userId: user.id, email: user.email });
  const refreshToken = randomToken();
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256Hex(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  });
  setAuthCookies(res, accessToken, refreshToken);
}

export const authRouter = Router();

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = parseBody(loginSchema, req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new HttpError(401, "이메일 또는 비밀번호가 올바르지 않습니다.");
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new HttpError(423, `로그인 시도가 너무 많습니다. ${minutes}분 후 다시 시도해주세요.`);
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      const failed = user.failedLoginCount + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: failed,
          lockedUntil:
            failed >= MAX_FAILED_LOGINS
              ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
              : null,
        },
      });
      throw new HttpError(401, "이메일 또는 비밀번호가 올바르지 않습니다.");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });

    await issueTokens(res, user);
    res.json({ user: { id: user.id, email: user.email } });
  }),
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!raw) throw new HttpError(401, "로그인이 필요합니다.");

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: sha256Hex(raw) },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new HttpError(401, "인증이 만료되었습니다. 다시 로그인해주세요.");
    }

    // 토큰 회전: 기존 토큰을 폐기하고 새 토큰을 발급한다.
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    await issueTokens(res, stored.user);
    res.json({ user: { id: stored.user.id, email: stored.user.email } });
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (raw) {
      await prisma.refreshToken.updateMany({
        where: { tokenHash: sha256Hex(raw), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    res.clearCookie(ACCESS_COOKIE, { path: "/" });
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    res.json({ ok: true });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: { id: req.auth!.userId, email: req.auth!.email } });
  }),
);

/** 최초 기동 시 관리자 계정이 없으면 환경변수 값으로 생성한다. */
export async function ensureAdminUser() {
  try {
    const count = await prisma.user.count();
    if (count > 0) return;

    if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
      console.warn("[auth] 사용자가 없고 ADMIN_EMAIL/ADMIN_PASSWORD도 없어 관리자 계정을 만들지 못했습니다.");
      return;
    }

    await prisma.user.create({
      data: {
        email: env.ADMIN_EMAIL,
        passwordHash: await argon2.hash(env.ADMIN_PASSWORD),
      },
    });
    console.log(`[auth] 관리자 계정 생성: ${env.ADMIN_EMAIL}`);
  } catch (error) {
    console.warn("[auth] 관리자 계정 확인 실패 (DB 미연결일 수 있음):", (error as Error).message);
  }
}
