import { XMLParser } from "fast-xml-parser";
import { getSettingValues } from "../settings/settings.service.js";

export interface IssueItem {
  title: string;
  source: string; // GOOGLE_TRENDS | GOOGLE_NEWS | NAVER_NEWS
  traffic?: string;
  publishedAt?: string;
}

const parser = new XMLParser({ ignoreAttributes: false });

async function fetchOnce(url: string, userAgent: string, headers?: Record<string, string>): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      headers: { "User-Agent": userAgent, ...headers },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchText(url: string, headers?: Record<string, string>): Promise<string | null> {
  // UA 취향이 매체마다 반대다: 매경은 풀 브라우저 UA 필요(축약 403), 한경(Cloudflare)은 축약 UA만 통과
  // → 풀 UA 실패 시 축약 UA로 1회 재시도
  const full =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
  return (await fetchOnce(url, full, headers)) ?? (await fetchOnce(url, "Mozilla/5.0", headers));
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

  // 재테크·투자 집중 (2026-07-21, 사용자 지시) — 주식·투자·재테크 글감을 최우선 공급한다.
  // 금융 쿼리를 다수로, 지원금·일반은 소수만 유지(생활·종합 섹션 최소 커버용).
  const queries = [
    "오늘 증시",
    "코스피 전망",
    "미국 증시 뉴스",
    "주식 급등주",
    "공모주 청약 일정",
    "배당주 추천",
    "금리 인상 영향",
    "환율 전망",
    "ETF 투자",
    "실적 발표 관련주",
    "반도체 관련주",
    "2차전지 관련주",
    "부동산 시장 전망",
    "정부 지원금",
    "청년 지원 정책",
  ];
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

/**
 * 언론사 RSS — 헤드라인을 글감(키워드 후보)으로 수집한다.
 * ⚠️ 제목만 소재로 쓴다(본문 수집 안 함). 글은 goBlog가 그라운딩+AI로 자체 작성하므로 저작권 문제 없음.
 * 프로그램(방송 클립) 피드는 제목이 문장형 노이즈가 많아 글감 소스에서 제외했다.
 */
const PRESS_SOURCES: Array<{ source: string; urls: string[] }> = [
  {
    source: "YNA_NEWS",
    urls: [
      "news", "politics", "economy", "industry", "society", "local",
      "international", "culture", "health", "entertainment", "sports", "opinion",
    ].map((c) => `https://www.yna.co.kr/rss/${c}.xml`),
  },
  {
    source: "JTBC_NEWS",
    urls: [
      "https://news-ex.jtbc.co.kr/v1/get/rss/newsflesh",
      "https://news-ex.jtbc.co.kr/v1/get/rss/issue",
      ...["politics", "economy", "society", "international", "culture", "entertainment", "sports", "weather"]
        .map((c) => `https://news-ex.jtbc.co.kr/v1/get/rss/section/${c}`),
    ],
  },
  {
    source: "SBS_NEWS",
    urls: [
      "https://news.sbs.co.kr/news/headlineRssFeed.do?plink=RSSREADER",
      "https://news.sbs.co.kr/news/TopicRssFeed.do?plink=RSSREADER",
      "https://news.sbs.co.kr/news/newsflashRssFeed.do?plink=RSSREADER",
      ...["01", "02", "03", "07", "08", "14", "09"]
        .map((s) => `https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=${s}&plink=RSSREADER`),
    ],
  },
  {
    // 증권 전문 피드 — 재테크·금융 글감 (매경은 실제 브라우저 UA 필요)
    source: "FINANCE_NEWS",
    urls: [
      "https://www.hankyung.com/feed/finance",
      "https://www.sedaily.com/rss/finance",
      "https://www.mk.co.kr/rss/50200011/",
      "https://news.bizwatch.co.kr/rss/service/market",
      "http://www.fnnews.com/rss/r20/fn_realnews_stock.xml",
      "https://mbnmoney.mbn.co.kr/rss/news/stock",
    ],
  },
];

async function collectPressFeed(source: string, urls: string[]): Promise<IssueItem[]> {
  const results = await Promise.all(urls.map((url) => fetchText(url)));
  const items: IssueItem[] = [];
  for (const xml of results) {
    if (!xml) continue;
    try {
      const doc = parser.parse(xml) as {
        rss?: { channel?: { item?: Array<Record<string, unknown>> | Record<string, unknown> } };
      };
      const raw = doc.rss?.channel?.item;
      const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
      // 재테크 집중 — 금융 전문 피드는 더 많이 취해 후보 풀의 금융 비중을 키운다.
      const cap = source === "FINANCE_NEWS" ? 20 : 10;
      for (const item of list.slice(0, cap)) {
        // 언론 관용구 제거: [속보]·(종합)·(2보)·[단독] 등 — 키워드 후보로서의 잡음
        const title = cleanTitle(item.title)
          .replace(/\[[^\]]{1,8}\]/g, "")
          .replace(/\((?:종합|상보|속보|\d보|포토|영상|게시판|사진)[^)]*\)/g, "")
          .replace(/\s+/g, " ")
          .trim();
        if (title.length > 4) {
          items.push({ title, source, publishedAt: cleanTitle(item.pubDate) || undefined });
        }
      }
    } catch {
      // 피드 하나 실패는 무시
    }
  }
  return items;
}

export async function collectPressNews(): Promise<Record<string, IssueItem[]>> {
  const results = await Promise.all(
    PRESS_SOURCES.map(async ({ source, urls }) => [source, await collectPressFeed(source, urls)] as const),
  );
  return Object.fromEntries(results);
}

/** 모든 소스에서 오늘의 이슈를 수집한다. */
export async function collectDailyIssues(): Promise<{
  issues: IssueItem[];
  sources: Record<string, number>;
}> {
  const [trends, news, naver, press] = await Promise.all([
    collectGoogleTrends(),
    collectGoogleNews(),
    collectNaverNews(),
    collectPressNews(),
  ]);

  const pressItems = Object.values(press).flat();
  const seen = new Set<string>();
  const issues: IssueItem[] = [];
  for (const item of [...trends, ...news, ...naver, ...pressItems]) {
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
      ...Object.fromEntries(Object.entries(press).map(([k, v]) => [k, v.length])),
    },
  };
}
