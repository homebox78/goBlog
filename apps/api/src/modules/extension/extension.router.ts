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

    // 내부 링크(goblog://article/<id>)를 그 플랫폼의 자기 글 URL로 바꾼다.
    // platform 이 안 오면(구버전 확장) 어느 플랫폼인지 모르므로 링크를 벗기고 글자만 남긴다 —
    // goblog:// 주소가 그대로 발행되는 것만은 절대 막는다.
    const platformParam = String(req.query.platform ?? "").toUpperCase();
    const platform = (["BLOGGER", "WORDPRESS", "TISTORY", "NAVER_BLOG"] as const).find(
      (name) => name === platformParam,
    );
    const { resolveInternalLinks } = await import("../publishing/internal-links.js");
    const contentHtml = await resolveInternalLinks(article.contentHtml ?? "", platform ?? "NAVER_BLOG");

    res.json({
      article: {
        id: article.id,
        title: article.title,
        category: suggestNaverCategory(article.keyword?.category, article.keyword?.text ?? article.title),
        titleForNaver: article.title,
        naverDisclosure: naverPrefix,
        contentHtml,
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

    // URL 없이 완료 보고가 오면(티스토리는 발행 후 관리 목록으로 가서 확장이 주소를 못 잡는다)
    // **20분 크론을 기다리지 않고 지금 바로** RSS에서 찾아 채운다. 목록에 링크가 빈 채로 보이면 안 된다.
    let resolved = url;
    if (!url && platform === "TISTORY") {
      try {
        const { syncTistoryUrls } = await import("../publishing/tistory-sync.js");
        // 방금 올린 글이 RSS에 아직 안 떴을 수 있다 → 유령으로 몰면 안 된다(markPhantom=false)
        const result = await syncTistoryUrls("hom2box", false);
        resolved = result.filled.find((row) => row.articleId === id)?.url ?? null;
      } catch {
        // 실패해도 발행 자체는 성공이다 — URL은 크론이 마저 채운다
      }
    }

    res.json({ ok: true, url: resolved });
  }),
);

/**
 * 제휴 실적 수집 — 확장이 **로그인된 브라우저**로 대시보드의 JSON을 받아 보내준다.
 *
 * 왜 이렇게 하나: 네이버 쇼핑커넥트는 **공개 API가 없고**(개발자센터·커머스 API센터 어디에도 없다),
 * 쿠팡 파트너스는 Open API 키 **발급이 중지**됐다. 서버에서 부를 방법이 없다.
 * 남는 길은 이미 로그인돼 있는 사용자 브라우저뿐이라, 발행과 똑같이 확장에 맡긴다.
 *
 * 실적은 나중에 정정된다(주문 취소·정산 확정) → 같은 (날짜, 출처)는 **덮어쓴다.**
 * 그래서 며칠치를 다시 보내도 중복되지 않고, 최신 값으로 갱신된다.
 */
extensionRouter.post(
  "/affiliate",
  asyncHandler(async (req, res) => {
    const raw = String(req.body?.source ?? "");
    const source = raw === "COUPANG" ? "COUPANG" : raw === "NAVER_CONNECT" ? "NAVER_CONNECT" : null;
    if (!source) throw new HttpError(400, "source 는 NAVER_CONNECT 또는 COUPANG 이어야 합니다.");

    const rows: unknown[] = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (rows.length === 0) throw new HttpError(400, "rows 가 비어 있습니다.");

    const num = (value: unknown): number => {
      const parsed = Math.round(Number(value));
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    };

    let saved = 0;
    for (const item of rows as Array<Record<string, unknown>>) {
      const day = String(item.date ?? "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue; // 날짜가 아니면 버린다 (오염된 행으로 그래프를 그리지 않는다)
      const date = new Date(`${day}T00:00:00.000Z`);

      const data = {
        date,
        source,
        clicks: num(item.clicks),
        orders: num(item.orders),
        salesAmount: num(item.salesAmount),
        commission: num(item.commission),
        raw: (item.raw ?? null) as never,
        collectedAt: new Date(),
      };
      await prisma.affiliateDaily.upsert({
        where: { date_source: { date, source } },
        update: data,
        create: data,
      });
      saved += 1;
    }

    res.json({ ok: true, source, saved });
  }),
);

/**
 * 확장이 쓰는 설정 — **서버가 정답이다.**
 *
 * 커넥트 회원번호를 관리자에도 넣고 확장에도 또 넣게 하는 건 말이 안 된다.
 * (실제로 관리자에 넣어뒀는데 확장이 "회원번호를 입력하세요"라고 우겼다.)
 * 확장은 여기서 읽어간다. 설정은 한 군데에만 있어야 한다.
 */
extensionRouter.get(
  "/config",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.setting.findMany({
      where: { key: { in: ["naver.brandconnectMemberId"] } },
    });
    const get = (key: string) => rows.find((row) => row.key === key)?.value ?? "";
    res.json({ connectMemberId: get("naver.brandconnectMemberId").replace(/\D/g, "") });
  }),
);

/**
 * 쿠팡 리포트 API 주소 찾기 — 확장이 **화면이 실제로 부른 XHR 주소들**을 보내준다.
 *
 * 쿠팡은 Open API 키 발급이 중지됐고 자동화 브라우저는 403으로 막는다.
 * 로그인된 실제 크롬 안에서만 리포트 주소를 알 수 있는데, 사용자에게 콘솔을 읽어 오라고 할 순 없다.
 * 그래서 확장이 후보 주소를 서버로 보내고, 여기 저장해 두면 개발자가 바로 확인할 수 있다.
 */
extensionRouter.post(
  "/affiliate/debug",
  asyncHandler(async (req, res) => {
    const source = String(req.body?.source ?? "UNKNOWN");
    const endpoints: string[] = Array.isArray(req.body?.endpoints)
      ? req.body.endpoints.map((value: unknown) => String(value)).slice(0, 60)
      : [];
    const key = `debug.affiliateEndpoints.${source}`;
    const value = JSON.stringify({ at: new Date().toISOString(), endpoints });
    await prisma.setting.upsert({
      where: { key },
      create: { key, value, isSecret: false },
      update: { value },
    });
    res.json({ ok: true, saved: endpoints.length });
  }),
);
