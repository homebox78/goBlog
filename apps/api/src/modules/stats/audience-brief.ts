// 우리 사이트 독자 관심사 브리핑 — 글 생성 시 참고자료로 주입한다.
// 방문 통계(page_views·article_views)와 Search Console 유입 검색어에서 "지금 독자가 실제로 보는·찾는 것"을 요약.
import { prisma } from "../../common/prisma.js";
import { ensureStatsSchema } from "./geo.js";

export interface AudienceBrief {
  popularTools: string[]; // 자주 쓰는 계산기
  popularDocs: string[]; // 자주 찾는 문서
  popularArticles: string[]; // 최근 인기 기사 제목
  searchQueries: string[]; // 유입 검색어(Search Console)
}

/** 최근 30일 방문 통계 + 유입 검색어 요약. 데이터가 없으면 null. 실패는 조용히 null. */
export async function siteAudienceBrief(): Promise<AudienceBrief | null> {
  try {
    await ensureStatsSchema();
    const pop = async (type: string): Promise<string[]> => {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT MAX(title) t, COUNT(*) c FROM page_views
         WHERE type = ? AND pkey IS NOT NULL AND pkey <> '' AND viewedAt >= NOW() - INTERVAL 30 DAY
         GROUP BY pkey ORDER BY c DESC LIMIT 8`,
        type,
      );
      return rows.map((r) => (r.t ? String(r.t) : "")).filter(Boolean);
    };
    const [popularTools, popularDocs] = await Promise.all([pop("tool"), pop("doc")]);

    // 인기 기사 (article_views 30일 → 제목)
    let popularArticles: string[] = [];
    try {
      const arts = await prisma.$queryRawUnsafe<any[]>(
        `SELECT articleId, COUNT(*) c FROM article_views WHERE viewedAt >= NOW() - INTERVAL 30 DAY
         GROUP BY articleId ORDER BY c DESC LIMIT 10`,
      );
      const ids = arts.map((a) => Number(a.articleId)).filter((n) => n > 0);
      if (ids.length) {
        const rows = await prisma.article.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } });
        const map = new Map(rows.map((a) => [a.id, a.title]));
        popularArticles = arts.map((a) => map.get(Number(a.articleId))).filter((t): t is string => Boolean(t)).slice(0, 8);
      }
    } catch {
      /* article_views 없거나 조인 실패 — 생략 */
    }

    // 유입 검색어 (Search Console, 최근 28일)
    let searchQueries: string[] = [];
    try {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      since.setDate(since.getDate() - 28);
      const qs = await prisma.searchQueryDaily.groupBy({
        by: ["query"],
        where: { date: { gte: since } },
        _sum: { impressions: true },
        orderBy: { _sum: { impressions: "desc" } },
        take: 12,
      });
      searchQueries = qs.map((q) => q.query).filter(Boolean);
    } catch {
      /* 아직 수집 전 — 생략 */
    }

    if (!popularTools.length && !popularDocs.length && !popularArticles.length && !searchQueries.length) return null;
    return { popularTools, popularDocs, popularArticles, searchQueries };
  } catch {
    return null;
  }
}
