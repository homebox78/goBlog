import { Router } from "express";
import { asyncHandler } from "../../common/http.js";
import { requireAuth } from "../../middleware/auth.js";
import { publishNaverFeed } from "./naverfeed.js";

export const naverfeedRouter = Router();

// 수동 트리거(관리자) — count건 즉시 큐레이션 발행. 크론은 하루 여러 회 자동.
naverfeedRouter.post(
  "/run",
  requireAuth,
  asyncHandler(async (req, res) => {
    const count = Math.min(30, Math.max(1, Number(req.body?.count) || 10));
    const result = await publishNaverFeed(count);
    res.json(result);
  }),
);
