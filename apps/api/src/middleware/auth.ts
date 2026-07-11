import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken, type AccessTokenPayload } from "../modules/auth/tokens.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AccessTokenPayload;
    }
  }
}

export const ACCESS_COOKIE = "pap_access";
export const REFRESH_COOKIE = "pap_refresh";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : undefined;
  const token = (req.cookies?.[ACCESS_COOKIE] as string | undefined) ?? bearer;

  if (!token) {
    return res.status(401).json({ error: "로그인이 필요합니다." });
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
    return res.status(401).json({ error: "인증이 만료되었습니다. 다시 로그인해주세요." });
  }

  req.auth = payload;
  next();
}
