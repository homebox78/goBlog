import { Router } from "express";
import { z } from "zod";
import { asyncHandler, HttpError, parseBody } from "../../common/http.js";
import { requireAuth } from "../../middleware/auth.js";
import { prisma } from "../../common/prisma.js";
import { createCoupangDeeplink, getCoupangGoldbox, searchCoupangProducts } from "./coupang.js";
import { analyzeProductInput } from "./analyze.js";
import { bestKeywordForProduct } from "./product-match.js";

export const productsRouter = Router();

productsRouter.use(requireAuth);

/**
 * 상품 매칭용 키워드 풀 — 활성(추천·저장) 키워드 최근순.
 * '오늘 날짜' 추천만 보면 날짜가 바뀐 직후(수집 전)엔 비어 매칭이 안 되므로, 활성 키워드 전체를 본다.
 */
async function matchableKeywords() {
  return prisma.keyword.findMany({
    where: { status: { in: ["RECOMMENDED", "SAVED"] } },
    orderBy: { updatedAt: "desc" },
    take: 500,
    select: { id: true, text: true },
  });
}

// 분석 결과는 미상 필드를 null로 보내므로(예: description:null) optional이 아니라 nullish로 받는다.
const saveProductSchema = z.object({
  source: z.enum(["COUPANG", "BRANDCONNECT"]),
  name: z.string().min(1, "상품명은 필수입니다."),
  brand: z.string().nullish(),
  price: z.number().int().positive().nullish(),
  imageUrl: z.string().nullish(),
  productUrl: z.string().min(1, "상품 링크는 필수입니다."),
  description: z.string().nullish(),
  isRocket: z.boolean().nullish(),
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
    const keywords = await matchableKeywords();
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
        matchedAt: match ? new Date() : null,
      },
      include: { matchedKeyword: { select: { id: true, text: true } } },
    });
    res.json({ product, matched: match ? { keyword: match.keyword.text, score: match.score } : null });
  }),
);

const bulkMatchSchema = z.object({
  source: z.enum(["COUPANG", "BRANDCONNECT"]),
  text: z.string().min(1, "상품 목록을 붙여넣어주세요."),
});

/**
 * 대량 상품 목록(긁어붙인 텍스트)에서 오늘의 키워드와 매칭되는 상품만 골라준다.
 * 사용자는 매칭된 상품의 제휴 링크만 가져와 등록하면 되므로 작업이 크게 줄어든다.
 */
productsRouter.post(
  "/bulk-match",
  asyncHandler(async (req, res) => {
    const { text, source } = parseBody(bulkMatchSchema, req.body);
    const keywords = await matchableKeywords();
    const lines = [
      ...new Set(
        text
          .split(/\r?\n/)
          .map((line) => line.replace(/\s+/g, " ").trim())
          .filter((line) => line.length >= 2 && line.length <= 120)
          // '[생활/건강]' 같은 카테고리 헤더 줄(대괄호만으로 구성)은 상품명이 아니므로 제외
          .filter((line) => !/^\[[^\]]*\]$/.test(line)),
      ),
    ].slice(0, 800);

    const matched: Array<{ name: string; keyword: string; score: number }> = [];
    for (const name of lines) {
      const m = bestKeywordForProduct({ name }, keywords);
      if (m) matched.push({ name, keyword: m.keyword.text.slice(0, 191), score: m.score });
    }
    matched.sort((a, b) => b.score - a.score);

    // DB에 누적 저장(중복은 무시) — 새로고침·기기 바뀌어도 히스토리 유지
    let added = 0;
    if (matched.length) {
      const result = await prisma.bulkMatchHit.createMany({
        data: matched.map((m) => ({ source, name: m.name.slice(0, 191), keyword: m.keyword, score: m.score })),
        skipDuplicates: true,
      });
      added = result.count;
    }
    res.json({ scanned: lines.length, matchedCount: matched.length, added, matched });
  }),
);

const bulkImportSchema = z.object({
  source: z.enum(["COUPANG", "BRANDCONNECT"]),
  items: z
    .array(z.object({ name: z.string().min(1), keyword: z.string().min(1), score: z.number().int().nonnegative().default(0) }))
    .max(2000),
});

/** 기존 로컬(브라우저) 히스토리를 DB로 이관 — 일회성 마이그레이션용(중복 무시). */
productsRouter.post(
  "/bulk-match/import",
  asyncHandler(async (req, res) => {
    const { source, items } = parseBody(bulkImportSchema, req.body);
    if (!items.length) return res.json({ added: 0 });
    const { count } = await prisma.bulkMatchHit.createMany({
      data: items.map((it) => ({
        source,
        name: it.name.slice(0, 191),
        keyword: it.keyword.slice(0, 191),
        score: it.score,
      })),
      skipDuplicates: true,
    });
    res.json({ added: count });
  }),
);

/**
 * 대량 매칭 히스토리 — 무한스크롤(오프셋 페이지네이션) + 정렬.
 * ?source=&offset=&take=&sort=latest|score|keyword
 *   latest  = 최신순(등록 역순)
 *   score   = 매칭순(매칭 점수 높은 순)
 *   keyword = 추천순(매칭된 키워드의 트렌드 finalScore 높은 순 — 상위 키워드에 걸린 상품 먼저)
 */
productsRouter.get(
  "/bulk-match/history",
  asyncHandler(async (req, res) => {
    const source = String(req.query.source ?? "");
    if (source !== "COUPANG" && source !== "BRANDCONNECT") throw new HttpError(400, "source가 올바르지 않습니다.");
    const take = Math.min(100, Math.max(1, Number(req.query.take) || 30));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const sort = String(req.query.sort ?? "latest");

    const all = await prisma.bulkMatchHit.findMany({
      where: { source },
      orderBy: { id: "desc" },
      take: 3000,
      select: { id: true, name: true, keyword: true, score: true, usedAt: true, articleId: true },
    });
    const total = all.length;

    if (sort === "score") {
      all.sort((a, b) => b.score - a.score || b.id - a.id);
    } else if (sort === "keyword") {
      // 키워드 텍스트 → 트렌드 finalScore(최댓값) 맵. 상위 키워드에 매칭된 상품을 먼저 보여준다.
      const trends = await prisma.keywordTrend.findMany({
        orderBy: { collectedAt: "desc" },
        take: 4000,
        select: { keywordText: true, finalScore: true },
      });
      const rankMap = new Map<string, number>();
      for (const t of trends) {
        const cur = rankMap.get(t.keywordText) ?? -1;
        if ((t.finalScore ?? 0) > cur) rankMap.set(t.keywordText, t.finalScore ?? 0);
      }
      all.sort(
        (a, b) =>
          (rankMap.get(b.keyword) ?? -1) - (rankMap.get(a.keyword) ?? -1) || b.score - a.score || b.id - a.id,
      );
    }
    // latest는 이미 id desc

    const items = all.slice(offset, offset + take);
    const nextOffset = offset + take < total ? offset + take : null;
    res.json({ items, total, nextOffset });
  }),
);

/** 대량 매칭 히스토리 비우기 */
productsRouter.delete(
  "/bulk-match/history",
  asyncHandler(async (req, res) => {
    const source = String(req.query.source ?? "");
    if (source !== "COUPANG" && source !== "BRANDCONNECT") throw new HttpError(400, "source가 올바르지 않습니다.");
    const { count } = await prisma.bulkMatchHit.deleteMany({ where: { source } });
    res.json({ ok: true, deleted: count });
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
    try {
      res.json({ product: await analyzeProductInput(input) });
    } catch (error) {
      if (error instanceof HttpError) throw error;
      // 관리자 전용 도구 — 원인 파악을 위해 에러 메시지를 그대로 노출
      throw new HttpError(500, `분석 실패: ${(error as Error).message}`);
    }
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
