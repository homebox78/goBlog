import { Router, type NextFunction, type Request, type Response } from "express";
import { prisma } from "../../common/prisma.js";
import { asyncHandler, HttpError } from "../../common/http.js";
import { env } from "../../common/env.js";
import { disclosureText } from "../articles/generator.js";

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

/** 발행 가능한 글 목록 (검수 완료·승인 상태) */
extensionRouter.get(
  "/articles",
  asyncHandler(async (req, res) => {
    const articles = await prisma.article.findMany({
      where: { status: { in: ["REVIEW", "APPROVED"] } },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: { id: true, title: true, status: true, qualityScore: true, language: true, updatedAt: true },
    });
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
      },
    });
    if (!article) throw new HttpError(404, "글을 찾을 수 없습니다.");

    // 쇼핑커넥트/쿠팡 글이면 네이버 규정(제목 앞 표기)용 제목도 제공
    const isPromo = /쇼핑 커넥트 활동의 일환|쿠팡 파트너스 활동의 일환/.test(article.contentMarkdown ?? "");
    const naverPrefix = article.contentMarkdown?.includes("쇼핑 커넥트 활동의 일환")
      ? disclosureText({ source: "BRANDCONNECT" })
      : article.contentMarkdown?.includes("쿠팡 파트너스 활동의 일환")
        ? disclosureText({ source: "COUPANG" })
        : null;

    res.json({
      article: {
        id: article.id,
        title: article.title,
        titleForNaver: isPromo && naverPrefix ? `(${naverPrefix.slice(0, 24)}...) ${article.title}` : article.title,
        naverDisclosure: naverPrefix,
        contentHtml: article.contentHtml,
        contentMarkdown: article.contentMarkdown,
        excerpt: article.excerpt,
        tags: article.tags.map((row) => row.tag.name),
        hashtags: article.tags.map((row) => `#${row.tag.name.replace(/\s+/g, "")}`).join(" "),
        images: article.media.map((asset) => ({ url: asset.webpUrl, alt: asset.altText })),
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

    await prisma.publishJob.create({
      data: {
        articleId: id,
        platform: platform === "TISTORY" ? "TISTORY" : "NAVER_BLOG",
        status: "SUCCEEDED",
        finishedAt: new Date(),
        publishedUrl: url,
      },
    });
    await prisma.article.update({ where: { id }, data: { status: "PUBLISHED" } });
    res.json({ ok: true });
  }),
);
