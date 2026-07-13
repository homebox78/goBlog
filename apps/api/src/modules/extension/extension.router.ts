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
 * 발행 대기 글 목록 — **플랫폼별로** 아직 발행하지 않은 글만 내려준다.
 *
 * 예전엔 글 단위 플래그(extensionDoneAt)로 숨겨서, 티스토리에 발행하면 네이버 목록에서도
 * 사라져 "발행 대기 글이 없습니다"가 됐다. 한 글을 여러 플랫폼에 올리는 게 정상이므로
 * 해당 플랫폼에 SUCCEEDED 발행 기록이 있는 글만 제외한다.
 */
extensionRouter.get(
  "/articles",
  asyncHandler(async (req, res) => {
    const platform = typeof req.query.platform === "string" ? req.query.platform : null;
    const isExtPlatform = platform === "NAVER_BLOG" || platform === "TISTORY";

    const rows = await prisma.article.findMany({
      where: isExtPlatform
        ? { publishJobs: { none: { platform, status: "SUCCEEDED" } } }
        : { extensionDoneAt: null }, // 플랫폼 미지정(감지 전)은 기존 동작 유지
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
        // 어디에 이미 올렸는지 보여준다 (목록에서 바로 판단 가능하게)
        publishJobs: {
          where: { status: "SUCCEEDED" },
          select: { platform: true, publishedUrl: true },
        },
      },
    });
    const articles = rows.map(({ keyword, publishJobs, ...a }) => ({
      ...a,
      category: suggestNaverCategory(keyword?.category, keyword?.text ?? a.title),
      published: publishJobs.map((j) => ({ platform: j.platform, url: j.publishedUrl })),
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

/**
 * 발행 결과 기록 (확장에서 발행 완료 보고).
 *
 * 티스토리는 발행 후 게시글이 아니라 관리 목록으로 이동해서, 확장이 탭 URL 폴링만으론
 * 게시글 주소를 못 잡는다(그래서 목록에 링크가 안 걸렸다). 확장이 뒤늦게 URL 을 찾아
 * 같은 플랫폼으로 다시 보고하면, 새 기록을 만들지 않고 **기존 기록의 URL 만 채운다.**
 */
extensionRouter.post(
  "/articles/:id/published",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const raw = String(req.body?.platform ?? "NAVER_BLOG");
    const platform = raw === "TISTORY" ? "TISTORY" : "NAVER_BLOG";
    const url = req.body?.url ? String(req.body.url) : null;
    // hide=true(사용자가 '발행완료' 버튼 클릭)면 그 플랫폼 기준으로 완료 처리한다.
    const hide = req.body?.hide === true;

    const existing = await prisma.publishJob.findFirst({
      where: { articleId: id, platform, status: "SUCCEEDED" },
      orderBy: { id: "desc" },
    });

    if (existing) {
      // 이미 기록된 발행 — URL 이 비어 있을 때만 뒤늦게 보강한다 (중복 기록 방지).
      if (url && !existing.publishedUrl) {
        await prisma.publishJob.update({ where: { id: existing.id }, data: { publishedUrl: url } });
      }
    } else {
      await prisma.publishJob.create({
        data: {
          articleId: id,
          platform,
          status: "SUCCEEDED",
          finishedAt: new Date(),
          publishedUrl: url,
        },
      });
    }

    await prisma.article.update({
      where: { id },
      data: { status: "PUBLISHED", ...(hide ? { extensionDoneAt: new Date() } : {}) },
    });
    res.json({ ok: true, url });
  }),
);
