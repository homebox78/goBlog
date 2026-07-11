import { Router } from "express";
import { z } from "zod";
import { asyncHandler, HttpError, parseBody } from "../../common/http.js";
import { requireAuth } from "../../middleware/auth.js";
import { prisma } from "../../common/prisma.js";
import { createCoupangDeeplink, getCoupangGoldbox, searchCoupangProducts } from "./coupang.js";
import { analyzeProductInput } from "./analyze.js";
import { bestKeywordForProduct } from "./product-match.js";
import { kstToday } from "../keywords/engine.js";

export const productsRouter = Router();

productsRouter.use(requireAuth);

/** 오늘 추천된 키워드 목록 (상품 매칭용) */
async function todayKeywords() {
  const { date } = kstToday();
  const recs = await prisma.dailyKeywordRecommendation.findMany({
    where: { date },
    orderBy: { finalScore: "desc" },
    take: 60,
    include: { keyword: { select: { id: true, text: true } } },
  });
  return recs.map((r) => r.keyword);
}

const saveProductSchema = z.object({
  source: z.enum(["COUPANG", "BRANDCONNECT"]),
  name: z.string().min(1, "상품명은 필수입니다."),
  brand: z.string().optional(),
  price: z.number().int().positive().optional(),
  imageUrl: z.string().optional(),
  productUrl: z.string().min(1, "상품 링크는 필수입니다."),
  description: z.string().optional(),
  isRocket: z.boolean().optional(),
});

/** 등록 상품 목록 (매칭된 키워드 포함) */
productsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { matchedKeyword: { select: { id: true, text: true } } },
    });
    res.json({ products });
  }),
);

/** 상품 등록 → 오늘의 키워드와 자동 매칭 */
productsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = parseBody(saveProductSchema, req.body);
    const keywords = await todayKeywords();
    const match = bestKeywordForProduct(input, keywords);

    const product = await prisma.product.create({
      data: {
        source: input.source,
        name: input.name,
        brand: input.brand ?? null,
        price: input.price ?? null,
        imageUrl: input.imageUrl ?? null,
        productUrl: input.productUrl,
        description: input.description ?? null,
        isRocket: input.isRocket ?? false,
        matchedKeywordId: match?.keyword.id ?? null,
      },
      include: { matchedKeyword: { select: { id: true, text: true } } },
    });
    res.json({ product, matched: match ? { keyword: match.keyword.text, score: match.score } : null });
  }),
);

/** 상품 삭제 */
productsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(400, "잘못된 상품 ID입니다.");
    await prisma.product.delete({ where: { id } }).catch(() => undefined);
    res.json({ ok: true });
  }),
);

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
