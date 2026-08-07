import { Router } from "express";
import { asyncHandler } from "../../common/http.js";
import { requireAuth } from "../../middleware/auth.js";
import { publishIssuefeed } from "./issuefeed.js";

export const issuefeedRouter = Router();

// 수동 트리거(관리자) — count건 즉시 발행. 크론은 하루 2건 자동.
issuefeedRouter.post(
  "/run",
  requireAuth,
  asyncHandler(async (req, res) => {
    const count = Math.min(5, Math.max(1, Number(req.body?.count) || 2));
    const result = await publishIssuefeed(count);
    res.json(result);
  }),
);
