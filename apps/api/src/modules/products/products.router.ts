import { Router } from "express";
import { z } from "zod";
import { asyncHandler, HttpError, parseBody } from "../../common/http.js";
import { requireAuth } from "../../middleware/auth.js";
import { createCoupangDeeplink, getCoupangGoldbox, searchCoupangProducts } from "./coupang.js";

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

const deeplinkSchema = z.object({ url: z.string().url() });

productsRouter.post(
  "/coupang/deeplink",
  asyncHandler(async (req, res) => {
    const { url } = parseBody(deeplinkSchema, req.body);
    res.json({ deeplink: await createCoupangDeeplink(url) });
  }),
);
