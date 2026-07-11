import { Router } from "express";
import { z } from "zod";
import { asyncHandler, HttpError, parseBody } from "../../common/http.js";
import { requireAuth } from "../../middleware/auth.js";
import { createCoupangDeeplink, getCoupangGoldbox, searchCoupangProducts } from "./coupang.js";
import { analyzeProductInput } from "./analyze.js";

export const productsRouter = Router();

productsRouter.use(requireAuth);

productsRouter.get(
  "/coupang/search",
  asyncHandler(async (req, res) => {
    const keyword = String(req.query.keyword ?? "").trim();
    if (!keyword) throw new HttpError(400, "검색어를 입력해주세요.");
    const limit = Math.min(50, Number(req.query.limit) || 20);
    res.json({ products: await searchCoupangProducts(keyword, limit) });
  }),
);

productsRouter.get(
  "/coupang/goldbox",
  asyncHandler(async (req, res) => {
    res.json({ products: await getCoupangGoldbox() });
  }),
);

const analyzeSchema = z.object({ input: z.string().min(1, "링크 또는 HTML을 입력해주세요.") });

/** 상품 분석 — 쿠팡 이미지+텍스트 HTML 태그 또는 상품 URL에서 정보 자동 추출 */
productsRouter.post(
  "/analyze",
  asyncHandler(async (req, res) => {
    const { input } = parseBody(analyzeSchema, req.body);
    res.json({ product: await analyzeProductInput(input) });
  }),
);

const deeplinkSchema = z.object({ url: z.string().url() });

productsRouter.post(
  "/coupang/deeplink",
  asyncHandler(async (req, res) => {
    const { url } = parseBody(deeplinkSchema, req.body);
    res.json({ deeplink: await createCoupangDeeplink(url) });
  }),
);
