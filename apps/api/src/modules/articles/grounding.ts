import { getSettingValues } from "../settings/settings.service.js";

export interface RecentNewsItem {
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  /** 원문 링크 — '참고자료' 섹션의 재료. 지어낸 링크가 아니라 실제 검색 결과의 주소다. */
  link?: string;
  /**
   * 원문 본문 발췌 (사실 확인용 그라운딩).
   * ⚠️ 저작권 원칙: 서로 다른 매체 여러 곳에서 사실·수치만 추출해 자체 표현으로 쓰기 위한 재료다.
   * 프롬프트가 문장·표현 복사와 단일 기사 요약을 금지한다.
   */
  excerpt?: string;
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

/** HTML에서 본문 텍스트를 추출한다 — <article> 우선, 없으면 전체에서 태그 제거 */
function extractMainText(html: string): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const article = stripped.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1] ?? stripped;
  return stripTags(article.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/**
 * 상위 뉴스의 원문 본문 발췌를 붙인다 — **서로 다른 매체(호스트) 최대 max곳**.
 * 스니펫(description)만으로는 수치·일정 같은 사실 밀도가 부족해, 본문을 사실 확인 재료로 쓴다.
 * 다중 출처 종합 + 자체 표현 재작성(프롬프트 강제)이 전제라, 특정 기사의 파생물이 되지 않는다.
 */
export async function enrichWithBodies(items: RecentNewsItem[], max = 3): Promise<RecentNewsItem[]> {
  const seenHosts = new Set<string>();
  let enriched = 0;
  const out: RecentNewsItem[] = [];
  for (const it of items) {
    if (enriched >= max || !it.link) {
      out.push(it);
      continue;
    }
    let host = "";
    try {
      host = new URL(it.link).hostname.replace(/^www\./, "");
    } catch {
      out.push(it);
      continue;
    }
    if (seenHosts.has(host)) {
      out.push(it);
      continue;
    }
    try {
      const res = await fetch(it.link, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const text = extractMainText(await res.text());
        if (text.length >= 300) {
          out.push({ ...it, excerpt: text.slice(0, 1800) });
          seenHosts.add(host);
          enriched += 1;
          continue;
        }
      }
    } catch {
      // 본문을 못 가져오면 스니펫만으로 진행
    }
    out.push(it);
  }
  return out;
}
