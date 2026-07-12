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
    // 키워드 + 제목을 함께 매칭 (제목에만 등장하는 브랜드·주제도 잡는다: 예 'SK하이닉스發' 기사에 하이닉스 상품).
    // 수동 추천 맥락이므로 뉴스·금융 키워드 가드는 건너뛴다 — 삽입 여부는 사람이 결정.
    const matchText = `${keywordText} ${article.title}`.trim();
    const fuzzy = matchText
      ? recent
          .filter((h) => !exactIds.has(h.id))
          .map((h) => ({ ...h, matchScore: overlapScore({ name: h.name }, matchText, { ignoreNonCommercial: true }) }))
          .filter((h) => h.matchScore >= 1)
          .sort((a, b) => b.matchScore - a.matchScore)
      : [];
    const hits = [...exact, ...fuzzy].slice(0, 10);

    // 네이버 배너: 클릭 시 브랜드커넥트 상품검색(상품명 채움)으로 열 URL 프리픽스
    const { getSettingValues } = await import("../settings/settings.service.js");
    const values = await getSettingValues(["naver.brandconnectMemberId"]);
    const memberId = (values["naver.brandconnectMemberId"] ?? "").trim();
    const naverSearchBase = memberId
      ? `https://brandconnect.naver.com/${memberId}/affiliate/products/search`
      : null;

    res.json({ keyword: keywordText, hits, naverSearchBase });
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

/**
 * 대가성 고시(경제적 이해관계 문구) 삽입 — 본문 최상단에 가이드 준수 박스를 넣는다.
 * 이미 있으면 중복 삽입하지 않는다. 사이드 버튼(수동)과 백필에서 사용.
 */
articlesRouter.post(
  "/:id/disclosure",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const source = req.body?.source === "BRANDCONNECT" ? "BRANDCONNECT" : "COUPANG";
    const article = await prisma.article.findUnique({
      where: { id },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    if (!article) throw new HttpError(404, "글을 찾을 수 없습니다.");
    const md = article.contentMarkdown ?? "";
    const { disclosureHtml, hasDisclosure } = await import("./generator.js");
    if (hasDisclosure(md)) return res.json({ ok: true, already: true });

    const next = `${disclosureHtml({ source })}\n\n${md}`;
    const contentHtml = await renderContentHtml(next);
    await prisma.article.update({
      where: { id },
      data: {
        contentMarkdown: next,
        contentHtml,
        versions: {
          create: {
            version: (article.versions[0]?.version ?? 0) + 1,
            title: article.title,
            contentMarkdown: next,
            contentHtml,
            changeNote: `대가성 고시 삽입 (${source === "COUPANG" ? "쿠팡" : "네이버"})`,
          },
        },
      },
    });
    res.json({ ok: true, already: false });
  }),
);

/**
 * 고시 백필/갱신 — ① 배너 있는데 고시 없는 글엔 삽입 ② 이미 고시가 있는 글은 최신 디자인·문구 박스로 교체.
 * (폰트·문구 지침 변경 시 기존 글 일괄 반영)
 */
articlesRouter.post(
  "/backfill-disclosures",
  asyncHandler(async (_req, res) => {
    const articles = await prisma.article.findMany({
      select: { id: true, title: true, contentMarkdown: true },
      take: 500,
    });
    const { upsertDisclosure, hasDisclosure } = await import("./generator.js");
    const fixed: Array<{ id: number; title: string; source: string; action: string }> = [];
    for (const a of articles) {
      const md = a.contentMarkdown ?? "";
      const already = hasDisclosure(md);
      const hasBanner = /link\.coupang|coupangcdn|smartstore|brandconnect|naver\.me|쿠팡에서 최저가|쇼핑하기/.test(md);
      if (!already && !hasBanner) continue; // 고시도 배너도 없으면 대상 아님
      // 소스 판별: 기존 고시 문구 우선, 없으면 배너 링크로
      const source = /쿠팡 파트너스 활동|link\.coupang|coupangcdn/.test(md)
        ? ("COUPANG" as const)
        : ("BRANDCONNECT" as const);
      const next = upsertDisclosure(md, source);
      if (next === md) continue; // 변화 없음
      const contentHtml = await renderContentHtml(next);
      const last = await prisma.articleVersion.findFirst({ where: { articleId: a.id }, orderBy: { version: "desc" } });
      await prisma.article.update({
        where: { id: a.id },
        data: {
          contentMarkdown: next,
          contentHtml,
          versions: {
            create: {
              version: (last?.version ?? 0) + 1,
              title: a.title,
              contentMarkdown: next,
              contentHtml,
              changeNote: already ? "대가성 고시 갱신(디자인·문구)" : "대가성 고시 삽입",
            },
          },
        },
      });
      fixed.push({ id: a.id, title: a.title.slice(0, 40), source, action: already ? "갱신" : "삽입" });
    }
    res.json({ scanned: articles.length, fixedCount: fixed.length, fixed });
  }),
);

/**
 * 배너 백필 — 옛 flex 배너(네이버 SmartEditor에서 깨짐)를 새 블록 배너로 일괄 교체한다.
 * 옛 배너 <a style="...display:flex...">에서 링크·이미지·상품명·가격·소스를 추출해 재생성.
 */
articlesRouter.post(
  "/backfill-banners",
  asyncHandler(async (_req, res) => {
    const { buildProductBanner } = await import("./generator.js");
    const articles = await prisma.article.findMany({
      select: { id: true, title: true, contentMarkdown: true },
      take: 500,
    });
    const unescape = (s: string) =>
      s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
    // 카드 배너 <a>…</a> (옛 flex / 현재 블록카드 모두. 링크가 통째로 감싸진 형태 → div+분리링크로 교체)
    const bannerRe = /<a\b[^>]*style="[^"]*display:(?:flex|block;text-align:center;border)[^"]*"[^>]*>[\s\S]*?<\/a>/g;
    const fixed: Array<{ id: number; title: string; count: number }> = [];

    for (const a of articles) {
      const md = a.contentMarkdown ?? "";
      const matches = md.match(bannerRe);
      if (!matches || matches.length === 0) continue;
      let next = md;
      let count = 0;
      for (const block of matches) {
        const href = block.match(/<a[^>]+href="([^"]+)"/i)?.[1];
        if (!href) continue;
        const imageUrl = block.match(/<img[^>]+src="([^"]+)"/i)?.[1] ?? null;
        const nameRaw = block.match(/<img[^>]+alt="([^"]*)"/i)?.[1] ?? "";
        const name = unescape(nameRaw).trim() || "추천 상품";
        const priceStr = block.match(/([\d,]{2,})\s*원/)?.[1];
        const price = priceStr ? Number(priceStr.replace(/[^\d]/g, "")) : undefined;
        const isRocket = /로켓/.test(block);
        const source: "COUPANG" | "BRANDCONNECT" =
          /#e52528|coupang|쿠팡/i.test(block) ? "COUPANG" : "BRANDCONNECT";
        const rebuilt = buildProductBanner(
          { source, name, price, imageUrl: imageUrl ?? undefined, productUrl: href, isRocket },
          href,
          imageUrl,
        );
        next = next.replace(block, rebuilt);
        count += 1;
      }
      if (count === 0 || next === md) continue;
      const contentHtml = await renderContentHtml(next);
      const last = await prisma.articleVersion.findFirst({ where: { articleId: a.id }, orderBy: { version: "desc" } });
      await prisma.article.update({
        where: { id: a.id },
        data: {
          contentMarkdown: next,
          contentHtml,
          versions: {
            create: {
              version: (last?.version ?? 0) + 1,
              title: a.title,
              contentMarkdown: next,
              contentHtml,
              changeNote: "배너 디자인 갱신(에디터 호환)",
            },
          },
        },
      });
      fixed.push({ id: a.id, title: a.title.slice(0, 34), count });
    }
    res.json({ scanned: articles.length, fixedCount: fixed.length, fixed });
  }),
);

/**
 * 해시태그 백필 — 본문 끝 해시태그가 20개 미만인 글에 SEO 태그 25개를 생성해 붙인다.
 * (해시태그 기능 이전에 생성된 옛 글 보정용. Claude 소형 호출 1회/글)
 */
articlesRouter.post(
  "/backfill-hashtags",
  asyncHandler(async (_req, res) => {
    const { callClaudeJson } = await import("../ai/claude.js");
    const { runQualityCheck } = await import("./quality.js");
    const articles = await prisma.article.findMany({
      select: { id: true, title: true, excerpt: true, metaDescription: true, contentMarkdown: true, keyword: { select: { text: true } } },
      take: 500,
    });
    const count = (md: string) =>
      (md.match(/#[0-9A-Za-z가-힣_]{1,30}/g) ?? []).filter((h) => !/^#[0-9a-fA-F]{3,8}$/.test(h)).length;
    const fixed: Array<{ id: number; title: string; added: number; score: number }> = [];
    for (const a of articles) {
      const md = a.contentMarkdown ?? "";
      if (!md || count(md) >= 20) continue;
      let tags: string[];
      try {
        const out = await callClaudeJson<{ tags: string[] }>({
          operation: "hashtag-backfill",
          maxTokens: 2000,
          system:
            '한국어 SEO 태그 생성기. 글 제목·키워드·요약을 보고 검색 유입에 도움되는 태그 25개를 만든다. 핵심 키워드·연관 검색어·롱테일·카테고리 포함, 각 1~4단어, # 없이. 출력은 JSON만: {"tags":["태그"]}',
          user: JSON.stringify({ title: a.title, keyword: a.keyword?.text, excerpt: a.excerpt }),
        });
        tags = Array.isArray(out.tags) ? out.tags : [];
      } catch {
        continue;
      }
      const line = [...new Set(tags.map((t) => t.replace(/^#/, "").replace(/\s+/g, "")).filter((t) => t && t.length <= 30))]
        .slice(0, 30)
        .map((t) => `#${t}`)
        .join(" ");
      if (!line) continue;
      const next = `${md}\n\n${line}`;
      const contentHtml = await renderContentHtml(next);
      const quality = runQualityCheck({
        keyword: a.keyword?.text ?? "",
        title: a.title,
        metaDescription: a.metaDescription ?? "",
        excerpt: a.excerpt ?? "",
        contentMarkdown: next,
        faqCount: 0,
        faqRequested: false,
        imagePromptCount: 1,
        claimsToVerify: [],
      });
      const last = await prisma.articleVersion.findFirst({ where: { articleId: a.id }, orderBy: { version: "desc" } });
      await prisma.article.update({
        where: { id: a.id },
        data: {
          contentMarkdown: next,
          contentHtml,
          qualityScore: quality.score,
          qualityReport: JSON.parse(JSON.stringify(quality)),
          versions: {
            create: {
              version: (last?.version ?? 0) + 1,
              title: a.title,
              contentMarkdown: next,
              contentHtml,
              changeNote: "해시태그 백필",
            },
          },
        },
      });
      fixed.push({ id: a.id, title: a.title.slice(0, 30), added: count(next), score: quality.score });
    }
    res.json({ scanned: articles.length, fixedCount: fixed.length, fixed });
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

/** 이미지 URL 크롤링 삽입 — 실제 출처 이미지를 재호스팅하고 '이미지 출처: XXX' 캡션 포함 figure 반환 */
articlesRouter.post(
  "/:id/images/from-url",
  asyncHandler(async (req, res) => {
    const imageUrl = req.body?.url;
    const source = req.body?.source;
    if (!imageUrl || typeof imageUrl !== "string") throw new HttpError(400, "이미지 URL이 필요합니다.");
    if (!source || typeof source !== "string" || !source.trim())
      throw new HttpError(400, "이미지 출처(예: 기아차 뉴스룸)를 입력해주세요.");
    const { insertImageFromUrl } = await import("../images/image-service.js");
    res.json(await insertImageFromUrl(Number(req.params.id), imageUrl, source));
  }),
);

/** 이미지 1장 재생성 — 같은 프롬프트로 다시 뽑고 본문 src 교체 */
articlesRouter.post(
  "/:id/images/:mediaId/regenerate",
  asyncHandler(async (req, res) => {
    const { regenerateArticleImage } = await import("../images/image-service.js");
    res.json(await regenerateArticleImage(Number(req.params.id), Number(req.params.mediaId)));
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

    // 검수 완료(→APPROVED) 시 API 자동발행 플랫폼(Blogger·워드프레스)에 발행 — 설정된 것만, 중복 없이.
    let autoPublished: string[] = [];
    if (body.status === "APPROVED" && article.status !== "APPROVED") {
      autoPublished = await maybeAutoPublishApi(id);
    }

    res.json({
      id: updated.id,
      qualityScore: updated.qualityScore,
      status: updated.status,
      autoPublished,
      bloggerQueued: autoPublished.includes("BLOGGER"), // 하위호환
    });
  }),
);

/**
 * 검수 완료 시 API 기반 플랫폼(Blogger·워드프레스) 자동 발행 큐잉.
 * 각 플랫폼은 필수 설정이 모두 있고, 같은 글에 해당 플랫폼 발행(성공/대기)이 없을 때만 작업을 만든다.
 * (네이버·티스토리는 공개 API가 없어 확장에서만 발행 — 여기서 제외)
 */
async function maybeAutoPublishApi(articleId: number): Promise<string[]> {
  const { getSettingValues } = await import("../settings/settings.service.js");
  const cfg = await getSettingValues([
    "blogger.blogId",
    "blogger.clientId",
    "blogger.clientSecret",
    "blogger.refreshToken",
    "wordpress.url",
    "wordpress.username",
    "wordpress.appPassword",
  ]);

  const targets: string[] = [];
  if (cfg["blogger.blogId"] && cfg["blogger.clientId"] && cfg["blogger.clientSecret"] && cfg["blogger.refreshToken"]) {
    targets.push("BLOGGER");
  }
  if (cfg["wordpress.url"] && cfg["wordpress.username"] && cfg["wordpress.appPassword"]) {
    targets.push("WORDPRESS");
  }
  if (targets.length === 0) return [];

  const queued: string[] = [];
  for (const platform of targets) {
    const existing = await prisma.publishJob.findFirst({
      where: { articleId, platform: platform as "BLOGGER" | "WORDPRESS", status: { in: ["QUEUED", "RUNNING", "SUCCEEDED"] } },
    });
    if (existing) continue; // 이미 발행됐거나 대기 중
    await prisma.publishJob.create({ data: { articleId, platform: platform as "BLOGGER" | "WORDPRESS", status: "QUEUED" } });
    queued.push(platform);
  }
  if (queued.length > 0) {
    const { processQueue } = await import("../publishing/publish-runner.js");
    void processQueue();
  }
  return queued;
}

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
