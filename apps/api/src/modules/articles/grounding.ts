import { getSettingValues } from "../settings/settings.service.js";

export interface RecentNewsItem {
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  /** 원문 링크 — '참고자료' 섹션의 재료. 지어낸 링크가 아니라 실제 검색 결과의 주소다. */
  link?: string;
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

function toDate(pubDate?: string): string {
  if (!pubDate) return "";
  const d = new Date(pubDate);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/**
 * 키워드에 대한 최신 뉴스를 네이버 뉴스 검색으로 가져온다 (생성 시점 그라운딩용).
 * Claude 학습 데이터가 오래돼 최근 사실(상장·출시·발표 등)을 틀리게 쓰는 문제를 막는다.
 * 자격증명이 없거나 실패하면 빈 배열 — 그라운딩 없이 진행(시점 단정은 프롬프트가 막음).
 */
export async function fetchRecentNews(keyword: string, limit = 8): Promise<RecentNewsItem[]> {
  const query = keyword.trim();
  if (!query) return [];
  try {
    const values = await getSettingValues(["naver.datalabClientId", "naver.datalabClientSecret"]);
    const clientId = values["naver.datalabClientId"];
    const clientSecret = values["naver.datalabClientSecret"];
    if (!clientId || !clientSecret) return [];

    // 최신순(sort=date)으로 조회해 '가장 최근 사실'을 우선 확보
    const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&display=${limit}&sort=date`;
    const res = await fetch(url, {
      headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      items?: Array<{ title: string; description: string; pubDate?: string; originallink?: string; link?: string }>;
    };
    return (data.items ?? [])
      .map((it) => ({
        title: stripTags(it.title),
        description: stripTags(it.description),
        date: toDate(it.pubDate),
        // 언론사 원문(originallink) 우선 — 네이버 뷰어 링크보다 출처 표기에 적합하다
        link: (it.originallink || it.link || "").trim() || undefined,
      }))
      .filter((it) => it.title.length > 4)
      .slice(0, limit);
  } catch {
    return [];
  }
}
