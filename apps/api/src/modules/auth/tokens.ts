import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../../common/env.js";

const jwtSecret = crypto.createHash("sha256").update(env.SESSION_SECRET).digest();

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 15; // 15분
export const REFRESH_TOKEN_TTL_DAYS = 30;

export interface AccessTokenPayload {
  userId: number;
  email: string;
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(payload.userId))
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(jwtSecret);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret);
    if (!payload.sub) return null;
    return { userId: Number(payload.sub), email: String(payload.email ?? "") };
  } catch {
    return null;
  }
}
