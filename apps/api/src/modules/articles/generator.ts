import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "../../common/prisma.js";
import { HttpError } from "../../common/http.js";
import { getSettingValues } from "../settings/settings.service.js";
import { callClaudeJson } from "../ai/claude.js";
import { kstToday } from "../keywords/engine.js";
import { createCoupangDeeplink } from "../products/coupang.js";
import { mediaDir, mediaPublicUrl } from "../images/image-service.js";
import {
  buildArticleJsonLd,
  buildFaqJsonLd,
  buildProductJsonLd,
  type FaqEntry,
  type ProductReviewData,
} from "./jsonld.js";
import { runQualityCheck } from "./quality.js";
import { renderContentHtml } from "./render.js";

export interface ProductInput {
  source: "COUPANG" | "BRANDCONNECT";
  name: string;
  brand?: string;
  price?: number;
  imageUrl?: string;
  productUrl: string;
  description?: string;
  isRocket?: boolean;
}

export interface GenerateOptions {
  keywordId?: number;
  articleType: string;
  language: string;
  schemaTypes: string[];
  length?: number;
  tone?: string;
  product?: ProductInput;
}

interface GeneratedContent {
  title: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  contentMarkdown: string;
  faq: FaqEntry[];
  productReview: ProductReviewData | null;
  imagePrompts: Array<{
    role: "FEATURED" | "CONTENT";
    prompt: string;
    altText: string;
    caption?: string;
    position?: number;
  }>;
  claimsToVerify: string[];
}

const LANGUAGE_NAME: Record<string, string> = {
  ko: "한국어",
  en: "영어(English)",
  "zh-CN": "중국어 간체(简体中文)",
  hi: "힌디어(हिन्दी)",
  es: "스페인어(Español)",
};

const ARTICLE_TYPE_GUIDE: Record<string, string> = {
  guide: "정보성 가이드 — 개념 설명과 단계별 실행 방법",
  news: "뉴스·이슈 해설 — 사실 요약과 배경, 영향 분석",
  comparison: "비교 콘텐츠 — 선택 기준과 항목별 비교표",
  "product-review": "상품 소개·리뷰 — 특징·장단점·적합한 사용자 (직접 사용 경험 창작 금지)",
  "how-to-apply": "신청·가입 방법 — 대상 조건, 준비물, 절차",
  pricing: "비용·가격 안내 — 가격 구성과 절약 방법 (확인 안 된 가격 단정 금지)",
  troubleshooting: "문제 해결 — 원인 진단과 해결 단계",
  faq: "FAQ 중심 — 자주 묻는 질문과 명확한 답변",
  checklist: "체크리스트 — 실행 전 확인 목록",
  "how-to": "사용 방법 — 단계별 튜토리얼",
};

/**
 * 대가성 표기 문구 — 플랫폼이 지정한 원문 그대로 사용해야 한다 (임의 변경 시 페널티).
 * 네이버 쇼핑 커넥트는 블로그 게시 시 "제목 앞 + 본문 최상단" 두 곳 표기가 규정 (제목 처리는 발행 단계).
 */
export function disclosureText(product: Pick<ProductInput, "source">): string {
  if (product.source === "COUPANG") {
    return "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";
  }
  return "이 포스팅은 네이버 쇼핑 커넥트 활동의 일환으로, 판매 발생 시 수수료를 제공받습니다.";
}

/** 네이버·쿠팡 CDN 이미지는 blogspot 등에서 hotlink가 막히므로 서버에 재호스팅한다. */
async function rehostProductImage(url: string, key: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const webp = await sharp(buffer).resize({ width: 600, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    const dir = mediaDir();
    await fs.mkdir(dir, { recursive: true });
    const name = `product-${key}.webp`;
    await fs.writeFile(path.join(dir, name), webp);
    return `${mediaPublicUrl()}/${name}`;
  } catch {
    return null;
  }
}

/**
 * 본문에 삽입할 상품 배너 HTML — [이미지][정보+CTA] 카드형.
 * Blogger 등은 <a> 안의 block 요소(div)를 제거하므로, div 컨테이너 + CTA만 링크로 구성한다.
 */
function buildProductBanner(product: ProductInput, linkUrl: string, imageUrl: string | null): string {
  const isCoupang = product.source === "COUPANG";
  const accent = isCoupang ? "#ff5722" : "#03c75a"; // 쿠팡 주황 / 네이버 그린
  const accentDark = isCoupang ? "#e64a19" : "#02b350";
  const ctaText = isCoupang ? "쿠팡에서 최저가 확인하기" : "네이버에서 상품 보기";

  const price = product.price
    ? `<p style="margin:0 0 14px;font-size:23px;font-weight:800;color:${accent};line-height:1.2;">${new Intl.NumberFormat("ko-KR").format(product.price)}원${product.isRocket ? ' <span style="font-size:12px;font-weight:700;color:#2c7fff;vertical-align:middle;">🚀 로켓배송</span>' : ""}</p>`
    : "";

  const image = imageUrl
    ? `<img src="${imageUrl}" alt="${escapeHtml(product.name)}" style="width:170px;height:170px;object-fit:contain;border-radius:14px;background:#fff;flex-shrink:0;border:1px solid #f0f0f0;" />`
    : "";

  return [
    `<div style="display:flex;gap:20px;align-items:center;border:2px solid ${accent};border-radius:18px;padding:20px;margin:20px 0;background:linear-gradient(135deg,${isCoupang ? "#fff8f4" : "#f2fdf6"},#ffffff);box-shadow:0 6px 20px ${isCoupang ? "rgba(255,87,34,0.15)" : "rgba(3,199,90,0.15)"};position:relative;">`,
    '<span style="position:absolute;top:11px;right:14px;font-size:11px;color:#c4c4c4;">광고</span>',
    image,
    '<div style="min-width:0;flex:1;">',
    `<p style="margin:0 0 8px;font-weight:700;font-size:18px;line-height:1.45;color:#1a1a1a;">${escapeHtml(product.name)}</p>`,
    price,
    `<a href="${linkUrl}" target="_blank" rel="sponsored nofollow noopener" style="display:inline-block;background:linear-gradient(135deg,${accent},${accentDark});color:#fff;padding:13px 26px;border-radius:12px;font-size:16px;font-weight:800;text-decoration:none;box-shadow:0 3px 10px ${isCoupang ? "rgba(255,87,34,0.35)" : "rgba(3,199,90,0.35)"};">${ctaText} →</a>`,
    "</div></div>",
  ].join("");
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 키워드 또는 상품으로 글을 생성해 Article + 버전 + 스키마 + 이미지 프롬프트를 저장한다. */
export async function generateArticle(
  options: GenerateOptions,
): Promise<{ articleId: number; qualityScore: number }> {
  const keyword = options.keywordId
    ? await prisma.keyword.findUnique({
        where: { id: options.keywordId },
        include: {
          recommendations: { orderBy: { date: "desc" }, take: 1 },
          metrics: { orderBy: { date: "desc" }, take: 4 },
        },
      })
    : null;

  if (!keyword && !options.product) {
    throw new HttpError(400, "키워드 또는 상품 정보가 필요합니다.");
  }

  const product = options.product ?? null;
  const topic = keyword?.text ?? product!.name;

  const settings = await getSettingValues(["anthropic.defaultLength", "anthropic.defaultTone"]);
  const length = options.length ?? Number(settings["anthropic.defaultLength"] ?? 2000) ?? 2000;
  const tone = options.tone ?? settings["anthropic.defaultTone"] ?? "친절한 설명체";
  const language = LANGUAGE_NAME[options.language] ? options.language : "ko";

  const wantsFaq = options.schemaTypes.includes("FAQPage") || options.articleType === "faq";
  const wantsProduct =
    Boolean(product) ||
    options.schemaTypes.includes("Product") ||
    options.articleType === "product-review";
  const mainSchema =
    options.schemaTypes.find((type) => ["Article", "NewsArticle", "BlogPosting"].includes(type)) ??
    (options.articleType === "news" ? "NewsArticle" : "BlogPosting");

  const recommendation = keyword?.recommendations[0];
  const naverMetric = keyword?.metrics.find((metric) => metric.source === "NAVER_SEARCHAD");

  const generated = await callClaudeJson<GeneratedContent>({
    operation: product ? "promo-article-generate" : "article-generate",
    maxTokens: 32000,
    system: [
      "당신은 조회수 높고 전환이 잘 되는 수익형 블로그 글을 쓰는 베테랑 콘텐츠 에디터다.",
      `본문 언어: ${LANGUAGE_NAME[language]}.`,
      "",
      "[독자를 사로잡는 글쓰기]",
      "- 첫 2~3문장에서 독자의 고민·상황에 공감하며 후킹하고, 이 글을 끝까지 읽으면 무엇을 얻는지 제시한다.",
      "- 소제목(H2)은 독자의 궁금증을 자극하는 형태로 쓴다 (예: '지금 바꿔도 될까? 교체 시기 판단 기준 3가지').",
      "- 각 단락의 핵심 결론·수치·판단 포인트는 **볼드**로 강조해 훑어보는 독자도 요점을 잡게 한다.",
      "- 비교표, 체크리스트, 단계별 정리를 적극 활용해 '스크랩하고 싶은 글'로 만든다.",
      "- 실제 선택·구매·실행에 바로 도움이 되는 구체적인 기준과 팁을 담는다 (막연한 일반론 금지).",
      "- 마지막에 독자가 다음 행동을 하도록 자연스러운 마무리(요약 + 권유)를 넣는다.",
      "",
      "[검색 유입·전환을 높이는 실행 정보 — 이 부분이 '돈이 되는 글'의 핵심]",
      "- 독자가 이 글 하나만 읽고도 실제로 행동할 수 있을 만큼 완결적으로 쓴다.",
      "- 주제에 맞는 실행 정보를 구체적으로 담는다: 신청 방법·자격 조건·준비 서류·조회 방법·계산 방법·비용·비교·예약/해지/변경 방법 등 (해당되는 것).",
      "- 단계(1·2·3)·조건·기준·수치를 명확히 제시한다. 막연한 일반론('잘 알아보세요' 같은)은 쓰지 않는다.",
      "- '어떤 사람에게/어떤 상황에 맞는지', '자주 하는 실수', '놓치기 쉬운 포인트'를 넣어 실용성을 높인다.",
      "",
      "[신뢰·정책 — 애드센스/검색 정책 준수]",
      "- 첫 문단에서 검색자의 핵심 질문에 바로 답한다.",
      "- H2(##)·H3(###) 구조를 지킨다.",
      "- 확인할 수 없는 통계·가격·법률·의료·금융 정보는 단정하지 않고 claimsToVerify에 표시한다. 공식 확인이 필요한 부분은 본문에서 '최신 기준은 공식 사이트에서 확인' 식으로 안내한다.",
      "- 존재하지 않는 URL·출처·개인 경험담·허위 후기·가상의 전문가 인용을 만들지 않는다.",
      "- 존재하지 않는 혜택·신청 기능·다운로드를 있는 것처럼 쓰지 않는다.",
      "- '광고를 클릭', '아래 광고' 같은 광고 클릭 유도 문구, '100% 보장·무조건 성공' 같은 과장·보장성 표현을 절대 쓰지 않는다.",
      "- 마무리(CTA)는 광고가 아니라 실제 관련 정보/공식 페이지로 안내하며, 과장 없이 다음 행동을 권한다.",
      "- 키워드를 부자연스럽게 반복하지 않는다.",
      product
        ? "- 홍보 글이지만 과장·허위 없이 특징·장점과 함께 '어떤 사람에게 잘 맞는지'를 짚어 설득력을 높인다. '직접 써보니' 같은 허위 경험담은 금지."
        : "",
      product
        ? "- '왜 지금 이 상품을 고려할 만한지'를 독자 상황과 연결해 자연스럽게 설득한다 (강매·과장 금지)."
        : "",
      product
        ? "- 본문에서 상품 구매 링크 배너가 들어갈 위치에 [PRODUCT_BANNER] 마커를 정확히 2번 넣는다 (도입부 다음 1번, 결론 직전 1번)."
        : "",
      "",
      "본문 목표 분량을 충분히 채우되 물타기 없이 밀도 있게 쓴다. 반드시 JSON만 출력한다.",
    ]
      .filter(Boolean)
      .join("\n"),
    user: JSON.stringify({
      task: product ? "제휴 상품 홍보 글 생성" : "SEO 블로그 글 생성",
      topic,
      keywordContext: keyword
        ? {
            category: keyword.category,
            searchIntent: keyword.searchIntent,
            recommendReason: recommendation?.reason,
            naverMonthlySearches: naverMetric?.avgMonthlySearches ?? null,
          }
        : null,
      product: product
        ? {
            source: product.source === "COUPANG" ? "쿠팡" : "네이버 브랜드커넥트",
            name: product.name,
            brand: product.brand,
            price: product.price,
            description: product.description,
            rocketDelivery: product.isRocket,
          }
        : null,
      articleType: options.articleType,
      articleTypeGuide: ARTICLE_TYPE_GUIDE[options.articleType] ?? options.articleType,
      language: LANGUAGE_NAME[language],
      targetLengthChars: length,
      tone,
      includeFaq: wantsFaq,
      imagePromptCount: 4,
      outputFormat: {
        title: "SEO 제목 (한 개)",
        slug: "english-url-slug",
        metaTitle: "검색 결과 제목 (60자 이내)",
        metaDescription: "검색 결과 설명 (80~155자)",
        excerpt: "글 요약 2~3문장",
        contentMarkdown: "마크다운 본문 (H2/H3, 표/목록, 이미지 자리 [IMAGE:n], 상품 배너 자리 [PRODUCT_BANNER])",
        faq: [{ question: "질문", answer: "답변" }],
        productReview: wantsProduct
          ? { name: "상품명", brand: "브랜드", description: "객관적 설명", pros: ["장점"], cons: ["단점"], actuallyUsed: false }
          : null,
        imagePrompts: [
          {
            role: "FEATURED|CONTENT",
            prompt: "이미지 생성 프롬프트 (영어). 밝고 긍정적인 분위기, 등장인물은 한국인만(외국인 금지). 사람이 필요하면 여자아이·남자아이·20대 남녀·중년 남녀 캐릭터를 일관된 플랫 일러스트 스타일로. 이미지 속 글자 없이",
            altText: "한국어 대체 텍스트",
            caption: "캡션",
            position: "본문 [IMAGE:n]의 n (대표는 0)",
          },
        ],
        claimsToVerify: ["발행 전 확인이 필요한 주장·수치"],
      },
    }),
  });

  if (!generated.title || !generated.contentMarkdown) {
    throw new HttpError(502, "글 생성 결과가 올바르지 않습니다.");
  }

  let contentMarkdown = generated.contentMarkdown;

  // 상품 배너·딥링크·대가성 문구 삽입
  if (product) {
    let linkUrl = product.productUrl;
    if (product.source === "COUPANG" && /coupang\.com/i.test(linkUrl)) {
      try {
        linkUrl = await createCoupangDeeplink(linkUrl);
      } catch {
        // 딥링크 실패 시 원본 URL 사용
      }
    }
    // 상품 이미지를 서버에 재호스팅 (네이버·쿠팡 CDN hotlink 차단 회피)
    const bannerImage = product.imageUrl
      ? await rehostProductImage(product.imageUrl, `p${keyword?.id ?? "x"}-${Date.now()}`)
      : null;
    const banner = buildProductBanner(product, linkUrl, bannerImage);

    if (contentMarkdown.includes("[PRODUCT_BANNER]")) {
      contentMarkdown = contentMarkdown.replaceAll("[PRODUCT_BANNER]", banner);
    } else {
      // 마커가 없으면 첫 H2 앞과 본문 끝에 삽입
      const firstH2 = contentMarkdown.search(/^##\s/m);
      contentMarkdown =
        firstH2 > -1
          ? contentMarkdown.slice(0, firstH2) + banner + "\n\n" + contentMarkdown.slice(firstH2)
          : contentMarkdown + "\n\n" + banner;
      contentMarkdown += "\n\n" + banner;
    }

    // 대가성 표기 — 글 최상단 (공정위 지침: 소비자가 쉽게 인식할 수 있는 위치)
    contentMarkdown = `> ${disclosureText(product)}\n\n${contentMarkdown}`;
  }

  const faq = wantsFaq ? (generated.faq ?? []).filter((entry) => entry.question && entry.answer) : [];
  const imagePrompts = (generated.imagePrompts ?? []).filter((prompt) => prompt.prompt);
  const claims = generated.claimsToVerify ?? [];

  const quality = runQualityCheck({
    keyword: topic,
    title: generated.title,
    metaDescription: generated.metaDescription ?? "",
    excerpt: generated.excerpt ?? "",
    contentMarkdown,
    faqCount: faq.length,
    faqRequested: wantsFaq,
    imagePromptCount: imagePrompts.length,
    claimsToVerify: claims,
  });

  const contentHtml = await renderContentHtml(contentMarkdown);

  const article = await prisma.article.create({
    data: {
      keywordId: keyword?.id ?? null,
      title: generated.title,
      slug: generated.slug || null,
      language,
      articleType: options.articleType,
      status: "REVIEW",
      metaTitle: generated.metaTitle || generated.title,
      metaDescription: generated.metaDescription || null,
      excerpt: generated.excerpt || null,
      contentMarkdown,
      contentHtml,
      qualityScore: quality.score,
      qualityReport: JSON.parse(JSON.stringify(quality)),
      versions: {
        create: {
          version: 1,
          title: generated.title,
          contentMarkdown,
          contentHtml,
          changeNote: "최초 생성",
        },
      },
      media: {
        create: imagePrompts.slice(0, 5).map((prompt, index) => {
          // Claude가 position을 문자열로 줄 수 있다 — Int로 강제
          const position = Number(prompt.position);
          return {
            kind: prompt.role === "FEATURED" ? "FEATURED" : "CONTENT",
            prompt: prompt.prompt,
            altText: prompt.altText || null,
            caption: prompt.caption || null,
            position: Number.isInteger(position) ? position : index,
          };
        }),
      },
    },
  });

  const schemaRows: Array<{ schemaType: string; jsonLd: object; isEnabled: boolean }> = [
    {
      schemaType: mainSchema,
      jsonLd: buildArticleJsonLd({
        schemaType: mainSchema,
        headline: generated.title,
        description: generated.metaDescription || generated.excerpt || "",
      }),
      isEnabled: true,
    },
  ];
  if (faq.length > 0) {
    schemaRows.push({ schemaType: "FAQPage", jsonLd: buildFaqJsonLd(faq), isEnabled: true });
  }
  const productData = generated.productReview?.name
    ? generated.productReview
    : product
      ? { name: product.name, brand: product.brand, description: product.description, url: product.productUrl, actuallyUsed: false }
      : null;
  if (wantsProduct && productData?.name) {
    schemaRows.push({
      schemaType: "Product",
      jsonLd: buildProductJsonLd({ ...productData, actuallyUsed: false }),
      isEnabled: false, // 실사용 검토 전 비활성
    });
  }
  for (const row of schemaRows) {
    await prisma.articleSchema.create({
      data: {
        articleId: article.id,
        schemaType: row.schemaType,
        jsonLd: JSON.parse(JSON.stringify(row.jsonLd)),
        isEnabled: row.isEnabled,
      },
    });
  }

  if (keyword) {
    await prisma.keyword.update({ where: { id: keyword.id }, data: { status: "USED" } });
  }

  return { articleId: article.id, qualityScore: quality.score };
}

export { kstToday };
