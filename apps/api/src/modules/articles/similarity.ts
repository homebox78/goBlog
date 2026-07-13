import { prisma } from "../../common/prisma.js";

/** 한국어 텍스트 정규화 후 bigram 집합 */
function bigrams(text: string): Set<string> {
  const normalized = text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const grams = new Set<string>();
  for (let i = 0; i < normalized.length - 1; i++) {
    grams.add(normalized.slice(i, i + 2));
  }
  return grams;
}

/** Jaccard 유사도 (0~1) */
export function textSimilarity(a: string, b: string): number {
  const setA = bigrams(a);
  const setB = bigrams(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const gram of setA) if (setB.has(gram)) intersection += 1;
  return intersection / (setA.size + setB.size - intersection);
}

export interface SimilarArticle {
  id: number;
  title: string;
  similarity: number;
}

// 주제를 가르는 힘이 없는 흔한 말 — 이런 게 겹쳤다고 "같은 주제"로 볼 수는 없다.
const GENERIC = new Set([
  "가격", "비교", "추천", "방법", "가이드", "정리", "총정리", "완전", "완벽", "전망", "이유", "정보",
  "출시일", "스펙", "혜택", "신청", "가입", "구매", "후기", "리뷰", "종류", "선택법", "해결법", "차이",
  "올해", "내년", "최신", "인기", "순위", "필독", "핵심", "기준", "조건", "비용", "요금", "할인",
  "2025", "2026", "2027",
]);

/** 주제를 대표하는 토큰만 남긴다 (2자 이상, 흔한 말 제외) */
function subjectTokens(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !GENERIC.has(t));
  return new Set(tokens);
}

/**
 * 두 주제가 같은 대상을 다루는가.
 *
 * ① 대표 토큰이 2개 이상 겹치거나
 * ② 3자 이상 고유명사급 토큰이 하나라도 겹치면 같은 주제로 본다.
 *
 * ②가 핵심이다. "SK하이닉스 주가 전망" 과 "SK하이닉스 목표주가" 는 겹치는 토큰이
 * 'sk하이닉스' 하나뿐이라 ①로는 안 걸리지만, 명백히 같은 소재다.
 * 반대로 '여름'·'달러' 같은 2자 일반어가 겹친 건 같은 주제가 아니므로 3자 기준으로 거른다.
 */
function sameSubject(a: string, b: string): boolean {
  const ta = subjectTokens(a);
  const tb = subjectTokens(b);
  if (ta.size === 0 || tb.size === 0) return false;

  const shared: string[] = [];
  for (const t of ta) if (tb.has(t)) shared.push(t);
  if (shared.length === 0) return false;
  if (shared.length >= 2) return true;

  const longest = Math.max(...shared.map((t) => t.length));
  return longest >= 3;
}

/**
 * 주제(키워드/상품명)가 기존 글과 겹치는지 검사한다.
 *
 * 두 가지를 본다:
 * ① 글자(bigram) 유사도 — 제목이 거의 같은 재탕
 * ② **주제(토큰) 일치** — 제목은 다른데 같은 대상을 또 쓰는 경우
 *    ("SK하이닉스 주가 전망" / "SK하이닉스 ADR 증권사 계좌 개설" 은 bigram 으론 안 걸린다)
 *
 * ②가 없어서 SK하이닉스 3건·갤럭시 3건처럼 같은 소재가 반복 생성됐다.
 */
export async function findSimilarArticle(topic: string, threshold = 0.55): Promise<SimilarArticle | null> {
  const recent = await prisma.article.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, title: true, keyword: { select: { text: true } } },
  });

  let best: SimilarArticle | null = null;
  for (const article of recent) {
    const candidates = [article.title, article.keyword?.text ?? ""].filter(Boolean);
    for (const text of candidates) {
      const similarity = textSimilarity(topic, text);
      // 같은 주제면 글자 유사도가 낮아도 중복으로 본다 (점수는 최소 threshold 로 보고)
      const duplicate = similarity >= threshold || sameSubject(topic, text);
      if (!duplicate) continue;
      const score = Math.max(similarity, threshold);
      if (!best || score > best.similarity) {
        best = { id: article.id, title: article.title, similarity: score };
      }
    }
  }
  return best;
}
