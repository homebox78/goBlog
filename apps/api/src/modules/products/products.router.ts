import { Router } from "express";
import { z } from "zod";
import { asyncHandler, HttpError, parseBody } from "../../common/http.js";
import { requireAuth } from "../../middleware/auth.js";
import { createCoupangDeeplink, getCoupangGoldbox, searchCoupangProducts } from "./coupang.js";
import { analyzeProductUrl } from "./analyze.js";

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

const analyzeSchema = z.object({ url: z.string().url("올바른 URL을 입력해주세요.") });

/** 상품 URL 분석 — 쿠팡·네이버 등 상품 페이지에서 정보 자동 추출 */
productsRouter.post(
  "/analyze",
  asyncHandler(async (req, res) => {
    const { url } = parseBody(analyzeSchema, req.body);
    res.json({ product: await analyzeProductUrl(url) });
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
