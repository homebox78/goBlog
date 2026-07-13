/**
 * 근접 중복 키워드 판정.
 *
 * ⚠️ 왜 필요한가
 * 기존 중복 제거는 ① Claude 프롬프트에 "이건 빼줘"라고 부탁하는 힌트와
 * ② 정규화 문자열 '완전일치' 뿐이었다. 그래서 단어 순서만 바뀐 키워드가 그대로 통과했다.
 *   · "폭염 전기세 에어컨 절약법"  ⟷  "폭염 에어컨 전기세 절약법"   (단어가 완전히 같다)
 *   · "갤럭시 폴드8 출시일 예상 가격" ⟷ "갤럭시 폴드8 사전예약 가격 출시일"
 * 최근 키워드 200개 중 100쌍이 사실상 중복이었고, 그 결과
 *   · 같은 인용 글이 여러 키워드 그룹에 반복 표시되고
 *   · 서로 검색 순위를 잡아먹는(키워드 카니벌라이제이션) 글이 양산된다.
 *
 * 판정은 '단어 집합'으로 한다 — 순서를 무시하므로 위 사례를 모두 잡는다.
 */

/** 조사·접미사처럼 의미를 가르지 않는 낱말은 비교에서 뺀다 (있고 없고가 중복 여부를 바꾸면 안 된다). */
const NOISE = new Set([
  "방법",
  "정리",
  "총정리",
  "완벽",
  "가이드",
  "추천",
  "최신",
  "확인",
  "안내",
  "및",
  "그리고",
  "관련",
]);

/** 키워드를 비교용 낱말 집합으로 바꾼다. */
export function keywordTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ") // 기호 제거 (·, -, ? 등)
      .split(/\s+/)
      .filter((word) => word.length > 1 && !NOISE.has(word)),
  );
}

/**
 * 두 키워드의 낱말 집합 유사도 (자카드).
 * 0.6 이상이면 사실상 같은 글이 나온다 — 실제 데이터로 보정한 기준선이다.
 *   · "나보타 보톡스 가격 효과 비교" ⟷ "나보타 보톡스 비용 효과 비교"  = 0.67 → 중복 ✔
 *   · "갤럭시 폴드8 출시일"        ⟷ "갤럭시 폴드8 가격"             = 0.50 → 별개 ✔
 */
export function keywordSimilarity(a: string, b: string): number {
  const ta = keywordTokens(a);
  const tb = keywordTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  const shared = [...ta].filter((word) => tb.has(word)).length;
  const union = new Set([...ta, ...tb]).size;
  return shared / union;
}

export const NEAR_DUPLICATE_THRESHOLD = 0.6;

/**
 * 글자 2-gram 유사도 — 낱말 비교의 사각지대를 메운다.
 * 한국어는 띄어쓰기가 흔들린다: "통합회원"과 "통합 회원"은 낱말로는 안 겹치지만 같은 말이다.
 * 그래서 공백을 없앤 글자 단위로 한 번 더 본다.
 */
function charBigramSimilarity(a: string, b: string): number {
  const grams = (text: string) => {
    const flat = text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    const out = new Set<string>();
    for (let i = 0; i < flat.length - 1; i++) out.add(flat.slice(i, i + 2));
    return out;
  };
  const ga = grams(a);
  const gb = grams(b);
  if (ga.size === 0 || gb.size === 0) return 0;
  const shared = [...ga].filter((g) => gb.has(g)).length;
  const union = new Set([...ga, ...gb]).size;
  return shared / union;
}

/** 글자 단위는 낱말보다 잘 겹치므로 기준을 더 높게 잡는다 (0.6이면 별개 키워드까지 잡아먹는다). */
export const CHAR_DUPLICATE_THRESHOLD = 0.7;

export function isNearDuplicate(a: string, b: string): boolean {
  return (
    keywordSimilarity(a, b) >= NEAR_DUPLICATE_THRESHOLD ||
    charBigramSimilarity(a, b) >= CHAR_DUPLICATE_THRESHOLD
  );
}

/** keywords 중 text와 근접 중복인 첫 항목을 돌려준다 (없으면 null). */
export function findNearDuplicate(text: string, keywords: readonly string[]): string | null {
  return keywords.find((existing) => isNearDuplicate(text, existing)) ?? null;
}
