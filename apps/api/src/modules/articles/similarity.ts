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

/**
 * 주제(키워드/상품명)가 기존 글과 얼마나 겹치는지 검사한다.
 * 제목 + 연결 키워드 텍스트 대비 최대 유사도를 반환.
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
      if (similarity >= threshold && (!best || similarity > best.similarity)) {
        best = { id: article.id, title: article.title, similarity };
      }
    }
  }
  return best;
}
