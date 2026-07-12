/** 구조화 데이터(JSON-LD) 빌더 — Google 리치 결과 가이드 기준 최소 필수 필드 */

export interface FaqEntry {
  question: string;
  answer: string;
}

export interface ProductReviewData {
  name: string;
  brand?: string;
  description?: string;
  url?: string;
  price?: string;
  currency?: string;
  pros?: string[];
  cons?: string[];
  rating?: number;
  ratingBasis?: string;
  actuallyUsed: boolean;
}

export function buildArticleJsonLd(options: {
  schemaType: string; // Article | NewsArticle | BlogPosting
  headline: string;
  description: string;
  authorName?: string;
  datePublished?: string;
  keywords?: string[]; // 핵심 키워드·태그 (검색엔진 색인 강화)
  inLanguage?: string; // ko 등
}) {
  const now = new Date().toISOString();
  const published = options.datePublished ?? now;
  const keywords = (options.keywords ?? []).filter(Boolean).slice(0, 10);
  return {
    "@context": "https://schema.org",
    "@type": options.schemaType,
    headline: options.headline.slice(0, 110),
    description: options.description,
    author: { "@type": "Person", name: options.authorName ?? "관리자" },
    datePublished: published,
    dateModified: now, // 최신성 신호 — 검색엔진 재색인·순위에 유리
    inLanguage: options.inLanguage ?? "ko",
    ...(keywords.length ? { keywords: keywords.join(", ") } : {}),
  };
}

export function buildFaqJsonLd(faq: FaqEntry[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
  };
}

/**
 * 상품 리뷰 스키마.
 * 실제 사용·검토 근거(actuallyUsed)가 없으면 평점을 넣지 않는다 — 허위 리뷰 구조화 금지.
 */
export function buildProductJsonLd(data: ProductReviewData) {
  const product: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: data.name,
    description: data.description,
  };
  if (data.brand) product.brand = { "@type": "Brand", name: data.brand };
  if (data.url) product.url = data.url;

  if (data.actuallyUsed && data.rating) {
    product.review = {
      "@type": "Review",
      reviewRating: { "@type": "Rating", ratingValue: data.rating, bestRating: 5, worstRating: 1 },
      author: { "@type": "Person", name: "관리자" },
      positiveNotes: data.pros?.length
        ? { "@type": "ItemList", itemListElement: data.pros.map((note, index) => ({ "@type": "ListItem", position: index + 1, name: note })) }
        : undefined,
      negativeNotes: data.cons?.length
        ? { "@type": "ItemList", itemListElement: data.cons.map((note, index) => ({ "@type": "ListItem", position: index + 1, name: note })) }
        : undefined,
    };
  }
  return product;
}
