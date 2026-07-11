import { XMLParser } from "fast-xml-parser";
import { getSettingValues } from "../settings/settings.service.js";

export interface IssueItem {
  title: string;
  source: string; // GOOGLE_TRENDS | GOOGLE_NEWS | NAVER_NEWS
  traffic?: string;
  publishedAt?: string;
}

const parser = new XMLParser({ ignoreAttributes: false });

async function fetchText(url: string, headers?: Record<string, string>): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (goBlog collector)", ...headers },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function cleanTitle(value: unknown): string {
  return String(value ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Google Trends 실시간 급상승 검색어 (한국) */
export async function collectGoogleTrends(): Promise<IssueItem[]> {
  const xml = await fetchText("https://trends.google.co.kr/trending/rss?geo=KR");
  if (!xml) return [];

  try {
    const doc = parser.parse(xml) as {
      rss?: { channel?: { item?: Array<Record<string, unknown>> | Record<string, unknown> } };
    };
    const items = doc.rss?.channel?.item;
    const list = Array.isArray(items) ? items : items ? [items] : [];
    return list
      .map((item) => ({
        title: cleanTitle(item.title),
        source: "GOOGLE_TRENDS",
        traffic: cleanTitle(item["ht:approx_traffic"]),
        publishedAt: cleanTitle(item.pubDate) || undefined,
      }))
      .filter((item) => item.title.length > 1);
  } catch {
    return [];
  }
}

/** Google 뉴스 헤드라인 (한국) */
export async function collectGoogleNews(): Promise<IssueItem[]> {
  const feeds = [
    "https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko",
    "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=ko&gl=KR&ceid=KR:ko",
    "https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=ko&gl=KR&ceid=KR:ko",
  ];

  const results = await Promise.all(feeds.map((feed) => fetchText(feed)));
  const items: IssueItem[] = [];

  for (const xml of results) {
    if (!xml) continue;
    try {
      const doc = parser.parse(xml) as {
        rss?: { channel?: { item?: Array<Record<string, unknown>> | Record<string, unknown> } };
      };
      const raw = doc.rss?.channel?.item;
      const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
      for (const item of list.slice(0, 20)) {
        const title = cleanTitle(item.title).replace(/ - [^-]+$/, ""); // 매체명 제거
        if (title.length > 4) {
          items.push({
            title,
            source: "GOOGLE_NEWS",
            publishedAt: cleanTitle(item.pubDate) || undefined,
          });
        }
      }
    } catch {
      // 피드 하나 실패는 무시
    }
  }
  return items;
}

/** 네이버 뉴스 검색 (개발자센터 Client ID/Secret 설정 시) */
export async function collectNaverNews(): Promise<IssueItem[]> {
  const values = await getSettingValues(["naver.datalabClientId", "naver.datalabClientSecret"]);
  const clientId = values["naver.datalabClientId"];
  const clientSecret = values["naver.datalabClientSecret"];
  if (!clientId || !clientSecret) return [];

  const queries = ["오늘 이슈", "정부 지원금", "신제품 출시"];
  const items: IssueItem[] = [];

  for (const query of queries) {
    const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&display=15&sort=date`;
    try {
      const res = await fetch(url, {
        headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { items?: Array<{ title: string; pubDate?: string }> };
      for (const item of data.items ?? []) {
        const title = cleanTitle(item.title);
        if (title.length > 4) {
          items.push({ title, source: "NAVER_NEWS", publishedAt: item.pubDate });
        }
      }
    } catch {
      // 무시
    }
  }
  return items;
}

/** 모든 소스에서 오늘의 이슈를 수집한다. */
export async function collectDailyIssues(): Promise<{
  issues: IssueItem[];
  sources: Record<string, number>;
}> {
  const [trends, news, naver] = await Promise.all([
    collectGoogleTrends(),
    collectGoogleNews(),
    collectNaverNews(),
  ]);

  const seen = new Set<string>();
  const issues: IssueItem[] = [];
  for (const item of [...trends, ...news, ...naver]) {
    const key = item.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    issues.push(item);
  }

  return {
    issues,
    sources: {
      GOOGLE_TRENDS: trends.length,
      GOOGLE_NEWS: news.length,
      NAVER_NEWS: naver.length,
    },
  };
}
