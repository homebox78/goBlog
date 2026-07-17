import { Router } from "express";
import { asyncHandler } from "../../common/http.js";
import { requireAuth } from "../../middleware/auth.js";
import { prisma } from "../../common/prisma.js";
import { ingestWelfareServices, testWelfare } from "./welfare-service.js";

export const welfareRouter = Router();

welfareRouter.use(requireAuth);

/** 복지서비스 전량 적재 (수동 트리거) */
welfareRouter.post(
  "/ingest",
  asyncHandler(async (_req, res) => {
    res.json(await ingestWelfareServices());
  }),
);

/** 연결 테스트 */
welfareRouter.post(
  "/test",
  asyncHandler(async (_req, res) => {
    res.json(await testWelfare());
  }),
);

/** 목록 — 검색·생애주기·지역 필터 + 페이지네이션 (관리 화면·확인용) */
welfareRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const source = String(req.query.source ?? "").trim();
    const take = Math.min(100, Math.max(1, Number(req.query.take) || 30));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const where = {
      ...(q ? { OR: [{ name: { contains: q } }, { summary: { contains: q } }] } : {}),
      ...(source === "CENTRAL" || source === "LOCAL" ? { source } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.welfareService.findMany({
        where,
        orderBy: [{ matchedAt: "desc" }, { id: "desc" }],
        skip: offset,
        take,
        include: { matchedKeyword: { select: { id: true, text: true } } },
      }),
      prisma.welfareService.count({ where }),
    ]);
    res.json({ items, total, nextOffset: offset + take < total ? offset + take : null });
  }),
);
