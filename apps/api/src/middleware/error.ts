import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { HttpError } from "../common/http.js";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: "요청한 경로를 찾을 수 없습니다." });
}

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(err);

  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    console.error("[db] 연결 실패:", err.message);
    return res.status(503).json({
      error: "데이터베이스에 연결할 수 없습니다. MySQL이 실행 중인지 확인해주세요. (pnpm db:up)",
    });
  }

  console.error("[api] 처리되지 않은 오류:", err);
  return res.status(500).json({ error: "서버 내부 오류가 발생했습니다." });
}
