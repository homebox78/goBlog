import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../common/prisma.js";
import { asyncHandler, HttpError, parseBody } from "../../common/http.js";
import { requireAuth } from "../../middleware/auth.js";
import { generateArticle } from "./generator.js";
import { runQualityCheck } from "./quality.js";
import { renderContentHtml } from "./render.js";

export const articlesRouter = Router();

articlesRouter.use(requireAuth);

/** 글 목록 */
articlesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const articles = await prisma.article.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        language: true,
        articleType: true,
        status: true,
        qualityScore: true,
        adSource: true,
        adProduct: true,
        contentMarkdown: true,
        extensionDoneAt: true,
        createdAt: true,
        updatedAt: true,
        keyword: { select: { id: true, text: true } },
        media: {
          orderBy: { position: "asc" },
          select: { webpUrl: true, prompt: true },
        },
      },
    });
    res.json({
      articles: articles.map((article) => {
        const { media, contentMarkdown, adSource, adProduct, ...rest } = article;
        // 광고 감지: adProduct(자동 매칭) 없어도 본문에 수동 삽입 배너가 있으면 광고로 표시
        const md = contentMarkdown ?? "";
        const hasBanner = /link\.coupang|coupangcdn|smartstore|brandconnect|naver\.me|쿠팡에서 최저가|쇼핑하기|활동의 일환/.test(md);
        const bannerAlt = md.match(/<img[^>]+alt=["']([^"']+)["']/i)?.[1];
        return {
          ...rest,
          adSource: adSource ?? (hasBanner ? (/coupang/i.test(md) ? "COUPANG" : "BRANDCONNECT") : null),
          adProduct: adProduct ?? (hasBanner ? bannerAlt ?? "삽입 배너" : null),
          // 대표 썸네일 = 첫 번째 생성된 이미지, 미생성 이미지 수(원스톱 액션 버튼용)
          thumbnailUrl: media.find((m) => m.webpUrl)?.webpUrl ?? null,
          pendingImages: media.filter((m) => m.prompt && !m.webpUrl).length,
        };
      }),
    });
  }),
);

const generateSchema = z.object({
  keywordId: z.number().int().optional(),
  articleType: z.string().min(1),
  language: z.string().default("ko"),
  schemaTypes: z.array(z.string()).default(["BlogPosting"]),
  length: z.number().int().min(500).max(6000).optional(),
  tone: z.string().optional(),
  allowSimilar: z.boolean().optional(),
  product: z
    .object({
      source: z.enum(["COUPANG", "BRANDCONNECT"]),
      name: z.string().min(1),
      // 분석 결과는 미상 필드를 null로 보내므로 nullish로 받는다 (Expected string, received null 방지)
      brand: z.string().nullish(),
      price: z.number().nullish(),
      imageUrl: z.string().nullish(),
      productUrl: z.string().url("상품/트래킹 링크가 올바른 URL이 아닙니다."),
      description: z.string().nullish(),
      isRocket: z.boolean().nullish(),
    })
    .optional(),
});

/** 글 생성 (Claude 호출 — 1~2분 소요) */
articlesRouter.post(
  "/generate",
  asyncHandler(async (req, res) => {
    const options = parseBody(generateSchema, req.body);
    // 상품 필드의 null(분석 미상)을 undefined로 정규화 (ProductInput은 string|undefined)
    const product = options.product
      ? {
          ...options.product,
          brand: options.product.brand ?? undefined,
          price: options.product.price ?? undefined,
          imageUrl: options.product.imageUrl ?? undefined,
          description: options.product.description ?? undefined,
          isRocket: options.product.isRocket ?? undefined,
        }
      : undefined;
    const result = await generateArticle({ ...options, product });
    res.json(result);
    // 원스톱: 응답 후 백그라운드로 85점 미만 자동 보정 + 이미지 3장 자동 생성
    const { finishArticlePipeline } = await import("./generator.js");
    void finishArticlePipeline(result.articleId, result.qualityScore);
  }),
);

/** Gemini 이미지 생성 + 본문 삽입 */
articlesRouter.post(
  "/:id/images",
  asyncHandler(async (req, res) => {
    const { generateArticleImages } = await import("../images/image-service.js");
    res.json(await generateArticleImages(Number(req.params.id)));
  }),
);

/**
 * 이 글과 매칭되는 누적 대량매칭 상품 — 우측 '상품 배너 삽입'에 추천으로 띄운다.
 * 클릭하면 파트너스 링크 발급 페이지가 새창으로 열리고, 발급한 링크를 붙여넣으면 된다.
 */
articlesRouter.get(
  "/:id/matched-hits",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const article = await prisma.article.findUnique({
      where: { id },
      select: { title: true, keyword: { select: { text: true } } },
    });
    if (!article) throw new HttpError(404, "글을 찾을 수 없습니다.");
    const keywordText = article.keyword?.text ?? "";

    // ① 같은 키워드에 매칭된 상품 (정확 일치) ② 키워드/제목과 토큰이 겹치는 상품 (보조)
    const { overlapScore } = await import("../products/product-match.js");
    const recent = await prisma.bulkMatchHit.findMany({
      orderBy: { id: "desc" },
      take: 1000,
      select: { id: true, source: true, name: true, keyword: true, score: true },
    });
    const exact = recent.filter((h) => keywordText && h.keyword === keywordText);
    const exactIds = new Set(exact.map((h) => h.id));
    const fuzzy = keywordText
      ? recent
          .filter((h) => !exactIds.has(h.id))
          .map((h) => ({ ...h, matchScore: overlapScore({ name: h.name }, keywordText) }))
          .filter((h) => h.matchScore >= 1)
          .sort((a, b) => b.matchScore - a.matchScore)
      : [];
    const hits = [...exact, ...fuzzy].slice(0, 10);
    res.json({ keyword: keywordText, hits });
  }),
);

/** 붙여넣은 상품 링크/배너 HTML → 스타일 배너 HTML 생성 (프론트가 커서 위치에 삽입) */
articlesRouter.post(
  "/:id/banner",
  asyncHandler(async (req, res) => {
    const input = req.body?.input;
    if (!input || typeof input !== "string") throw new HttpError(400, "상품 링크나 배너 HTML을 입력해주세요.");
    const { buildManualBanner } = await import("./generator.js");
    res.json(await buildManualBanner(input));
  }),
);

/** 품질 보정 — 85점 미만 글의 미달 항목을 Claude로 보강 (Claude 호출, 수십 초) */
articlesRouter.post(
  "/:id/improve",
  asyncHandler(async (req, res) => {
    const { improveArticle } = await import("./generator.js");
    res.json(await improveArticle(Number(req.params.id)));
  }),
);

/** 사용자 이미지 직접 업로드 (Gemini로 못 만드는 사진용) — base64 dataUrl */
articlesRouter.post(
  "/:id/images/upload",
  asyncHandler(async (req, res) => {
    const dataUrl = req.body?.dataUrl;
    if (!dataUrl || typeof dataUrl !== "string") throw new HttpError(400, "이미지 데이터(dataUrl)가 필요합니다.");
    const { uploadArticleImage } = await import("../images/image-service.js");
    res.json(
      await uploadArticleImage(Number(req.params.id), dataUrl, {
        kind: req.body?.kind,
        caption: req.body?.caption,
        altText: req.body?.altText,
      }),
    );
  }),
);

/** 업로드 이미지(미디어) 삭제 */
articlesRouter.delete(
  "/:id/images/:mediaId",
  asyncHandler(async (req, res) => {
    const { deleteArticleImage } = await import("../images/image-service.js");
    res.json(await deleteArticleImage(Number(req.params.id), Number(req.params.mediaId)));
  }),
);

/** 글 상세 */
articlesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const article = await prisma.article.findUnique({
      where: { id },
      include: {
        keyword: { select: { id: true, text: true } },
        schemas: true,
        media: { orderBy: { position: "asc" } },
        versions: {
          orderBy: { version: "desc" },
          select: { id: true, version: true, title: true, changeNote: true, createdAt: true },
        },
      },
    });
    if (!article) throw new HttpError(404, "글을 찾을 수 없습니다.");
    res.json({ article });
  }),
);

/** 글 삭제 — 버전·미디어·스키마·발행작업은 FK cascade로 함께 삭제 */
articlesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(400, "잘못된 글 ID입니다.");
    const deleted = await prisma.article.delete({ where: { id } }).catch(() => null);
    if (!deleted) throw new HttpError(404, "글을 찾을 수 없습니다.");
    res.json({ ok: true });
  }),
);

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  excerpt: z.string().optional(),
  contentMarkdown: z.string().min(1).optional(),
  status: z.enum(["DRAFT", "REVIEW", "APPROVED"]).optional(),
  changeNote: z.string().optional(),
});

/** 글 수정 — 본문·제목 변경 시 새 버전 생성 + 품질 재검사 */
articlesRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = parseBody(updateSchema, req.body);

    const article = await prisma.article.findUnique({
      where: { id },
      include: { keyword: true, schemas: true, media: true, versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    if (!article) throw new HttpError(404, "글을 찾을 수 없습니다.");

    const title = body.title ?? article.title;
    const contentMarkdown = body.contentMarkdown ?? article.contentMarkdown ?? "";
    const contentChanged =
      (body.title !== undefined && body.title !== article.title) ||
      (body.contentMarkdown !== undefined && body.contentMarkdown !== article.contentMarkdown);

    const contentHtml = contentChanged ? await renderContentHtml(contentMarkdown) : article.contentHtml;

    const quality = runQualityCheck({
      keyword: article.keyword?.text ?? "",
      title,
      metaDescription: body.metaDescription ?? article.metaDescription ?? "",
      excerpt: body.excerpt ?? article.excerpt ?? "",
      contentMarkdown,
      faqCount: countFaq(article.schemas),
      faqRequested: article.schemas.some((schema) => schema.schemaType === "FAQPage"),
      imagePromptCount: article.media.length,
      claimsToVerify:
        (article.qualityReport as { claimsToVerify?: string[] } | null)?.claimsToVerify ?? [],
    });

    const updated = await prisma.article.update({
      where: { id },
      data: {
        title,
        metaTitle: body.metaTitle ?? article.metaTitle,
        metaDescription: body.metaDescription ?? article.metaDescription,
        excerpt: body.excerpt ?? article.excerpt,
        contentMarkdown,
        contentHtml,
        status: body.status ?? article.status,
        qualityScore: quality.score,
        qualityReport: JSON.parse(JSON.stringify(quality)),
        ...(contentChanged
          ? {
              versions: {
                create: {
                  version: (article.versions[0]?.version ?? 0) + 1,
                  title,
                  contentMarkdown,
                  contentHtml,
                  changeNote: body.changeNote ?? "수동 편집",
                },
              },
            }
          : {}),
      },
    });

    res.json({ id: updated.id, qualityScore: updated.qualityScore, status: updated.status });
  }),
);

/** 버전 복원 */
articlesRouter.post(
  "/:id/versions/:version/restore",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const versionNumber = Number(req.params.version);

    const version = await prisma.articleVersion.findUnique({
      where: { articleId_version: { articleId: id, version: versionNumber } },
    });
    if (!version) throw new HttpError(404, "해당 버전을 찾을 수 없습니다.");

    const latest = await prisma.articleVersion.findFirst({
      where: { articleId: id },
      orderBy: { version: "desc" },
    });

    await prisma.article.update({
      where: { id },
      data: {
        title: version.title,
        contentMarkdown: version.contentMarkdown,
        contentHtml: version.contentHtml,
        versions: {
          create: {
            version: (latest?.version ?? 0) + 1,
            title: version.title,
            contentMarkdown: version.contentMarkdown,
            contentHtml: version.contentHtml,
            changeNote: `v${versionNumber} 복원`,
          },
        },
      },
    });

    res.json({ ok: true });
  }),
);

const schemaUpdateSchema = z.object({
  jsonLd: z.unknown().optional(),
  isEnabled: z.boolean().optional(),
});

/** 스키마(JSON-LD) 수정·활성화 토글 */
articlesRouter.put(
  "/:id/schemas/:schemaId",
  asyncHandler(async (req, res) => {
    const schemaId = Number(req.params.schemaId);
    const body = parseBody(schemaUpdateSchema, req.body);

    const schema = await prisma.articleSchema.update({
      where: { id: schemaId },
      data: {
        ...(body.jsonLd !== undefined ? { jsonLd: JSON.parse(JSON.stringify(body.jsonLd)) } : {}),
        ...(body.isEnabled !== undefined ? { isEnabled: body.isEnabled } : {}),
      },
    });
    res.json({ schema });
  }),
);

articlesRouter.delete(
  "/:id/schemas/:schemaId",
  asyncHandler(async (req, res) => {
    await prisma.articleSchema.delete({ where: { id: Number(req.params.schemaId) } });
    res.json({ ok: true });
  }),
);

function countFaq(schemas: Array<{ schemaType: string; jsonLd: unknown }>): number {
  const faq = schemas.find((schema) => schema.schemaType === "FAQPage");
  if (!faq) return 0;
  const mainEntity = (faq.jsonLd as { mainEntity?: unknown[] } | null)?.mainEntity;
  return Array.isArray(mainEntity) ? mainEntity.length : 0;
}
