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
        createdAt: true,
        updatedAt: true,
        keyword: { select: { id: true, text: true } },
        media: {
          where: { kind: "FEATURED", webpUrl: { not: null } },
          select: { webpUrl: true },
          take: 1,
        },
      },
    });
    res.json({
      articles: articles.map((article) => {
        const { media, ...rest } = article;
        return { ...rest, thumbnailUrl: media[0]?.webpUrl ?? null };
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
      brand: z.string().optional(),
      price: z.number().optional(),
      imageUrl: z.string().optional(),
      productUrl: z.string().url("상품/트래킹 링크가 올바른 URL이 아닙니다."),
      description: z.string().optional(),
      isRocket: z.boolean().optional(),
    })
    .optional(),
});

/** 글 생성 (Claude 호출 — 1~2분 소요) */
articlesRouter.post(
  "/generate",
  asyncHandler(async (req, res) => {
    const options = parseBody(generateSchema, req.body);
    const result = await generateArticle(options);
    res.json(result);
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
