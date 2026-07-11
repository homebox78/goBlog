import { marked } from "marked";
import { prisma } from "../../common/prisma.js";
import { HttpError } from "../../common/http.js";
import { getSettingValues } from "../settings/settings.service.js";
import { callClaudeJson } from "../ai/claude.js";
import { kstToday } from "../keywords/engine.js";
import { createCoupangDeeplink } from "../products/coupang.js";
import {
  buildArticleJsonLd,
  buildFaqJsonLd,
  buildProductJsonLd,
  type FaqEntry,
  type ProductReviewData,
} from "./jsonld.js";
import { runQualityCheck } from "./quality.js";

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

/** 본문에 삽입할 상품 배너 HTML (인라인 스타일 — 플랫폼 에디터에서도 유지) */
function buildProductBanner(product: ProductInput, linkUrl: string): string {
  const price = product.price
    ? `<p style="margin:4px 0 10px;font-size:18px;font-weight:700;color:#e0451f;">${new Intl.NumberFormat("ko-KR").format(product.price)}원${product.isRocket ? ' <span style="font-size:12px;color:#2c7fff;">🚀 로켓배송</span>' : ""}</p>`
    : "";
  const image = product.imageUrl
    ? `<img src="${product.imageUrl}" alt="${escapeHtml(product.name)}" style="width:130px;height:130px;object-fit:contain;border-radius:8px;background:#fff;flex-shrink:0;" />`
    : "";
  return [
    '<div style="display:flex;gap:16px;align-items:center;border:1px solid #e4e8f1;border-radius:12px;padding:16px;margin:28px 0;background:#fafbfd;">',
    image,
    '<div style="min-width:0;">',
    `<p style="margin:0;font-weight:700;font-size:15px;line-height:1.4;">${escapeHtml(product.name)}</p>`,
    price,
    `<a href="${linkUrl}" target="_blank" rel="sponsored nofollow noopener" style="display:inline-block;background:#1a1a1a;color:#fff;padding:9px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;">${product.source === "COUPANG" ? "쿠팡 최저가 확인하기" : "자세히 보기"}</a>`,
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
    maxTokens: 20000,
    system: [
      "당신은 검색 사용자에게 실제로 도움이 되는 콘텐츠를 쓰는 전문 에디터다.",
      `본문 언어: ${LANGUAGE_NAME[language]}.`,
      "원칙:",
      "- 첫 문단에서 검색자의 핵심 질문에 바로 답한다.",
      "- H2(##)·H3(###) 구조, 표·목록·체크리스트를 활용한다.",
      "- 확인할 수 없는 통계·가격·법률·의료 정보는 단정하지 않고 claimsToVerify에 표시한다.",
      "- 존재하지 않는 URL·출처·개인 경험담·허위 후기를 만들지 않는다.",
      product
        ? "- 홍보 글이지만 과장·허위 표현 없이 특징과 장단점을 정직하게 쓴다. '직접 써보니' 같은 허위 경험담 금지."
        : "",
      product
        ? "- 본문에서 상품 구매 링크 배너가 들어갈 위치에 [PRODUCT_BANNER] 마커를 정확히 2번 넣는다 (도입부 다음 1번, 결론 직전 1번)."
        : "",
      "- 키워드를 부자연스럽게 반복하지 않는다.",
      "반드시 JSON만 출력한다.",
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
            prompt: "이미지 생성 프롬프트 (영어, 스타일 명시, 텍스트 넣지 말 것)",
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
    const banner = buildProductBanner(product, linkUrl);

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

  const contentHtml = await marked.parse(contentMarkdown);

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
