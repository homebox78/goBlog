import { prisma } from "../../common/prisma.js";

/**
 * 네이버 블로그 검색 상위 글의 AI 브리핑 인용수 수집.
 *
 * 네이버는 블로그 탭 결과에 블로거의 누적 인용수 배지를 노출한다("403만 인용").
 * 이 값은 서버 요청에도 HTML에 그대로 실려 오므로(스마트스토어와 달리 봇 차단 없음)
 * 확장 없이 서버에서 긁을 수 있다.
 *
 * 배지는 프로필 블록(글 링크보다 앞)에 있으므로, 배지에서 **앞이 아니라 뒤로** 스캔해
 * 가장 먼저 나오는 글 링크·제목과 짝지어야 한다.
 */

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

export interface CitedPost {
  rank: number;
  title: string;
  url: string;
  blogId: string;
  blogName: string | null;
  citedCount: number | null;
  citedLabel: string | null;
  postedAt: string | null;
}

/** "403만" → 4030000 / "85.3만" → 853000 / "1.2억" → 120000000 */
export function parseCitedCount(label: string): number | null {
  const match = label.match(/([\d.]+)\s*(억|만)?/);
  if (!match) return null;
  const num = Number(match[1]);
  if (!Number.isFinite(num)) return null;
  const unit = match[2];
  const scale = unit === "억" ? 100_000_000 : unit === "만" ? 10_000 : 1;
  return Math.round(num * scale);
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

/** 네이버 블로그 탭을 긁어 상위 글 + 블로거 인용수를 뽑는다. */
export async function fetchCitedPosts(keyword: string): Promise<CitedPost[]> {
  const url =
    "https://search.naver.com/search.naver?ssc=tab.blog.all&sm=tab_jum&query=" +
    encodeURIComponent(keyword);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let html: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    html = await res.text();
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }

  const posts: CitedPost[] = [];
  const seen = new Set<string>();

  // 인용 배지 → 그 뒤 4,000자 안의 첫 글 링크·제목과 짝짓는다.
  const badgeRe = /([\d.]+\s*[억만]?)\s*인용/g;
  let match: RegExpExecArray | null;
  while ((match = badgeRe.exec(html)) !== null) {
    const forward = html.slice(match.index + match[0].length, match.index + match[0].length + 4000);

    const link = forward.match(/https:\/\/blog\.naver\.com\/([\w-]+)\/(\d+)/);
    if (!link) continue;
    const postUrl = link[0];
    if (seen.has(postUrl)) continue;

    const titleRaw = forward.match(/sds-comps-text-type-headline1[^>]*>([\s\S]*?)<\/span>/);
    const title = titleRaw ? stripTags(titleRaw[1]) : "";
    if (!title) continue;

    // 블로그 표시 이름 · 상대 날짜는 배지 앞 프로필 블록에 있다.
    const back = html.slice(Math.max(0, match.index - 2500), match.index);
    const nameRaw = [...back.matchAll(/sds-comps-profile-info-title-text[^>]*>([\s\S]*?)<\/span>/g)].pop();
    const dateRaw = forward.match(/([\d]+\s*(?:분|시간|일|주|개월|년)\s*전|\d{4}\.\s?\d{1,2}\.\s?\d{1,2}\.?)/);

    seen.add(postUrl);
    posts.push({
      rank: posts.length + 1,
      title,
      url: postUrl,
      blogId: link[1],
      blogName: nameRaw ? stripTags(nameRaw[1]) || null : null,
      citedCount: parseCitedCount(match[1]),
      citedLabel: `${match[1].trim()} 인용`,
      postedAt: dateRaw ? dateRaw[1] : null,
    });
  }

  return posts;
}

/**
 * 오늘의 활성 키워드로 인용수를 수집해 저장한다 (하루 1회).
 * 같은 (키워드, 날짜, 글) 은 덮어쓴다 — 하루 여러 번 돌려도 중복되지 않는다.
 * 네이버에 부담을 주지 않도록 키워드마다 짧게 쉬어 간다.
 */
export async function collectBlogCitations(limit = 30): Promise<{ keywords: number; posts: number }> {
  const keywords = await prisma.keyword.findMany({
    where: { status: { in: ["RECOMMENDED", "SAVED"] } },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: { id: true, text: true },
  });

  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const date = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));

  let saved = 0;
  for (const keyword of keywords) {
    let posts: CitedPost[] = [];
    try {
      posts = await fetchCitedPosts(keyword.text);
    } catch {
      continue; // 한 키워드 실패가 전체 수집을 깨지 않게
    }

    for (const post of posts) {
      const data = {
        keywordId: keyword.id,
        keywordText: keyword.text,
        date,
        rank: post.rank,
        title: post.title,
        url: post.url,
        blogId: post.blogId,
        blogName: post.blogName,
        citedCount: post.citedCount === null ? null : BigInt(post.citedCount),
        citedLabel: post.citedLabel,
        postedAt: post.postedAt,
      };
      try {
        await prisma.blogCitation.upsert({
          where: { keywordText_date_url: { keywordText: keyword.text, date, url: post.url } },
          update: data,
          create: data,
        });
        saved += 1;
      } catch {
        // 개별 저장 실패는 무시 (수집 계속)
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 700));
  }

  return { keywords: keywords.length, posts: saved };
}
