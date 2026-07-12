import { Router, type NextFunction, type Request, type Response } from "express";
import { prisma } from "../../common/prisma.js";
import { asyncHandler, HttpError } from "../../common/http.js";
import { env } from "../../common/env.js";
import { disclosureText } from "../articles/generator.js";
import { NAVER_CATEGORIES, suggestNaverCategory } from "../articles/naver-category.js";

/** Chrome 확장은 쿠키 대신 X-Extension-Token 헤더로 인증한다 (서드파티 쿠키 차단 회피). */
function requireExtensionToken(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["x-extension-token"];
  if (!env.EXTENSION_TOKEN || token !== env.EXTENSION_TOKEN) {
    return res.status(401).json({ error: "확장 프로그램 토큰이 올바르지 않습니다." });
  }
  next();
}

export const extensionRouter = Router();

extensionRouter.use(requireExtensionToken);

/** 네이버 블로그에 만들면 되는 고정 카테고리 목록 */
extensionRouter.get(
  "/categories",
  asyncHandler(async (_req, res) => {
    res.json({ categories: NAVER_CATEGORIES });
  }),
);

/**
 * 발행 대기 글 목록 — 모든 글을 보여주고, 사용자가 '발행완료' 버튼을 눌러 숨긴 글(extensionDoneAt)만 제외한다.
 * (반자동 운영: 발행 감지가 완전 자동이 아니므로, 무엇을 끝냈는지는 사용자가 직접 체크한다.)
 */
extensionRouter.get(
  "/articles",
  asyncHandler(async (req, res) => {
    const rows = await prisma.article.findMany({
      where: { extensionDoneAt: null },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        status: true,
        qualityScore: true,
        language: true,
        updatedAt: true,
        keyword: { select: { category: true, text: true } },
      },
    });
    const articles = rows.map(({ keyword, ...a }) => ({
      ...a,
      category: suggestNaverCategory(keyword?.category, keyword?.text ?? a.title),
    }));
    res.json({ articles });
  }),
);

/** 글 본문 (플랫폼 입력용) */
extensionRouter.get(
  "/articles/:id",
  asyncHandler(async (req, res) => {
    const article = await prisma.article.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        schemas: { where: { isEnabled: true } },
        media: { where: { webpUrl: { not: null } }, orderBy: { position: "asc" } },
        tags: { include: { tag: true }, take: 10 },
        keyword: { select: { category: true, text: true } },
      },
    });
    if (!article) throw new HttpError(404, "글을 찾을 수 없습니다.");

    // 대가성 문구는 본문 최상단에 이미 들어가 있으므로 제목엔 넣지 않는다 (제목이 지저분해지고 쿠팡은 불필요).
    const naverPrefix = article.contentMarkdown?.includes("쇼핑 커넥트 활동의 일환")
      ? disclosureText({ source: "BRANDCONNECT" })
      : article.contentMarkdown?.includes("쿠팡 파트너스 활동의 일환")
        ? disclosureText({ source: "COUPANG" })
        : null;

    res.json({
      article: {
        id: article.id,
        title: article.title,
        category: suggestNaverCategory(article.keyword?.category, article.keyword?.text ?? article.title),
        titleForNaver: article.title,
        naverDisclosure: naverPrefix,
        contentHtml: article.contentHtml,
        contentMarkdown: article.contentMarkdown,
        excerpt: article.excerpt,
        tags: article.tags.map((row) => row.tag.name),
        hashtags: article.tags.map((row) => `#${row.tag.name.replace(/\s+/g, "")}`).join(" "),
        images: article.media.map((asset) => ({ url: asset.webpUrl, alt: asset.altText })),
        instagram: article.instagram ?? null, // 캐러셀: { slides:[{position,title,summary}], caption, hashtags:[] }
      },
    });
  }),
);

/** 발행 결과 기록 (확장에서 수동 발행 완료 보고) */
extensionRouter.post(
  "/articles/:id/published",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const platform = String(req.body?.platform ?? "NAVER_BLOG");
    const url = req.body?.url ? String(req.body.url) : null;
    // hide=true(사용자가 '발행완료' 버튼 클릭)면 대기목록에서 숨긴다. 백그라운드 자동감지는 숨기지 않음.
    const hide = req.body?.hide === true;

    await prisma.publishJob.create({
      data: {
        articleId: id,
        platform: platform === "TISTORY" ? "TISTORY" : "NAVER_BLOG",
        status: "SUCCEEDED",
        finishedAt: new Date(),
        publishedUrl: url,
      },
    });
    await prisma.article.update({
      where: { id },
      data: { status: "PUBLISHED", ...(hide ? { extensionDoneAt: new Date() } : {}) },
    });
    res.json({ ok: true });
  }),
);
