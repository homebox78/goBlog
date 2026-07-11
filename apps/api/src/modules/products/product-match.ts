/**
 * 등록된 상품 ↔ 오늘의 키워드 매칭.
 * 쿠팡 검색 API가 없어 사용자가 상품을 직접 등록하므로, 상품명·브랜드와 키워드 문구의
 * 토큰 겹침으로 어울리는 키워드를 찾는다. (완벽한 의미매칭이 아니라 사용자 검토용 추천)
 */

function tokenize(text: string | null | undefined): string[] {
  return (text ?? "")
    .toLowerCase()
    .replace(/[^\w가-힣\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

/** 두 토큰이 관련 있는가 (동일 또는 한쪽이 다른 쪽을 포함) */
function related(a: string, b: string): boolean {
  return a === b || (a.length >= 2 && b.length >= 2 && (a.includes(b) || b.includes(a)));
}

/** 키워드 문구 토큰 중 상품(이름+브랜드)과 겹치는 개수 */
export function overlapScore(productText: string, keywordText: string): number {
  const p = tokenize(productText);
  const k = tokenize(keywordText);
  if (!p.length || !k.length) return 0;
  let hits = 0;
  for (const kt of k) {
    if (p.some((pt) => related(pt, kt))) hits += 1;
  }
  return hits;
}

export interface MatchableKeyword {
  id: number;
  text: string;
}

/** 상품에 가장 잘 맞는 키워드 (겹치는 토큰 최소 1개). 없으면 null. */
export function bestKeywordForProduct(
  product: { name: string; brand?: string | null },
  keywords: MatchableKeyword[],
): { keyword: MatchableKeyword; score: number } | null {
  const productText = `${product.name} ${product.brand ?? ""}`;
  let best: { keyword: MatchableKeyword; score: number } | null = null;
  for (const keyword of keywords) {
    const score = overlapScore(productText, keyword.text);
    if (score >= 1 && (!best || score > best.score)) {
      best = { keyword, score };
    }
  }
  return best;
}
