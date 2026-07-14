import { prisma } from "../../common/prisma.js";

/**
 * 내부 링크 해석 — 글 생성 시 본문에 박아둔 `goblog://article/<id>` 를
 * **발행하는 플랫폼의 자기 글 URL**로 바꾼다.
 *
 * 왜 플랫폼별로 다른가: 같은 글이 4곳에 발행되면 URL이 4개다.
 * 네이버 글에서 티스토리로 내보내면 독자가 남의 집으로 새고, 플랫폼 체류시간도 깎인다.
 *
 * ⚠️ 대상 글이 그 플랫폼에 아직 발행되지 않았으면 **링크를 지우고 글자만 남긴다.**
 *    "그럴듯한 다른 URL"로 대신 걸면 조용한 오연결이 된다 (티스토리 폴백 사고와 같은 함정).
 */

export type Platform = "BLOGGER" | "WORDPRESS" | "TISTORY" | "NAVER_BLOG";

const MARKER = /goblog:\/\/article\/(\d+)/g;

/** 그 플랫폼에서 실제로 발행 성공한 URL만 신뢰한다 */
async function platformUrls(articleIds: number[], platform: Platform): Promise<Map<number, string>> {
  const jobs = await prisma.publishJob.findMany({
    where: {
      articleId: { in: articleIds },
      platform,
      status: "SUCCEEDED",
      publishedUrl: { not: null },
    },
    select: { articleId: true, publishedUrl: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  const map = new Map<number, string>();
  for (const job of jobs) {
    if (job.publishedUrl && !map.has(job.articleId)) map.set(job.articleId, job.publishedUrl);
  }
  return map;
}

/**
 * html 안의 내부 링크 마커를 플랫폼 URL로 치환한다.
 * 해당 플랫폼에 대상 글이 없으면 `<a>` 를 통째로 벗겨 텍스트만 남긴다.
 */
export async function resolveInternalLinks(html: string, platform: Platform): Promise<string> {
  const ids = [...new Set([...html.matchAll(MARKER)].map((match) => Number(match[1])))];
  if (ids.length === 0) return html;

  const urls = await platformUrls(ids, platform);

  // 1) 이 플랫폼에 발행된 글 → 실제 URL로 치환
  let output = html.replace(MARKER, (whole, id: string) => urls.get(Number(id)) ?? whole);

  // 2) 아직 남아 있는 마커(= 그 플랫폼엔 없는 글) → 링크를 벗기고 글자만 남긴다
  output = output.replace(
    /<a\b[^>]*href="goblog:\/\/article\/\d+"[^>]*>([\s\S]*?)<\/a>/g,
    (_whole, text: string) => text,
  );
  // 마크다운 원문이 그대로 남은 경우까지 정리 (안전망)
  output = output.replace(/\[([^\]]+)\]\(goblog:\/\/article\/\d+\)/g, (_whole, text: string) => text);

  return output;
}

/**
 * 새 글에 걸 수 있는 내부 링크 후보 — 이미 발행된 글 중 주제가 가까운 것.
 * 제목 토큰이 겹칠수록 위로 올린다 (임베딩까지 갈 필요 없다 — 후보 몇 개면 충분하다).
 */
export async function internalLinkCandidates(topic: string, limit = 6): Promise<
  Array<{ id: number; title: string }>
> {
  const published = await prisma.article.findMany({
    where: { publishJobs: { some: { status: "SUCCEEDED", publishedUrl: { not: null } } } },
    select: { id: true, title: true, keyword: { select: { text: true } } },
    orderBy: { updatedAt: "desc" },
    take: 80,
  });

  const tokens = tokenize(`${topic}`);
  const scored = published
    .map((article) => {
      const target = tokenize(`${article.title} ${article.keyword?.text ?? ""}`);
      const overlap = tokens.filter((token) => target.includes(token)).length;
      return { id: article.id, title: article.title, overlap };
    })
    .filter((row) => row.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, limit);

  return scored.map(({ id, title }) => ({ id, title }));
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 2);
}
