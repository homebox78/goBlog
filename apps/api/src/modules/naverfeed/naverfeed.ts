// 네이버 뉴스 검색 API 기반 '연예·스포츠' 이슈 큐레이션 발행 (AI 미사용 = 무과금).
// 각 기사 = 원문 요약(og/snippet) + 출처 표기 + 원문 링크. 자체 뉴스에만 노출, 외부 자동발행 없음.
// 저작권: 원문 전문을 복제하지 않고 요약+출처링크만. 이미지는 대표 1장 재호스팅(출처 캡션).
import { prisma } from "../../common/prisma.js";
import { getSettingValues } from "../settings/settings.service.js";
import { insertImageFromUrl } from "../images/image-service.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

// 어그로 유입용 가벼운 주제 — 연예·방송·영화·음악·스포츠 폭넓게(다양성 확보)
const QUERIES = [
  "드라마", "영화", "예능", "아이돌", "K팝", "걸그룹", "보이그룹", "배우", "가수",
  "연예인 열애", "컴백", "시청률", "넷플릭스", "티빙", "디즈니플러스", "박스오피스",
  "트로트", "방송", "콘서트", "OST", "뮤지컬", "유튜버", "예능 프로그램",
  "축구", "손흥민", "이강인", "야구", "KBO", "프리미어리그", "농구", "골프", "e스포츠",
];

function decodeHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 제목 정규화 — 근접 중복(같은 사건 다른 언론사) 판정용 */
function normTitle(s: string): string {
  return s.replace(/[^0-9a-z가-힣]+/gi, "").toLowerCase();
}

interface NewsItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  query: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function fetchNaverNews(query: string, clientId: string, clientSecret: string): Promise<NewsItem[]> {
  try {
    const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&display=20&sort=date`;
    const res = await fetch(url, {
      headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      items?: Array<{ title: string; description: string; pubDate?: string; link?: string; originallink?: string }>;
    };
    return (data.items ?? [])
      .map((it) => ({
        title: decodeHtml(it.title || ""),
        description: decodeHtml(it.description || ""),
        link: it.link || it.originallink || "",
        pubDate: it.pubDate || "",
        query,
      }))
      .filter((it) => it.title && it.link);
  } catch {
    return [];
  }
}

/** 개별 기사 og 메타(대표이미지·요약) */
async function fetchMeta(url: string): Promise<{ description: string; image: string }> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { description: "", image: "" };
    const html = await res.text();
    const og = (p: string): string => {
      const m = html.match(new RegExp(`<meta\\s+property="og:${p}"\\s+content="([^"]*)"`, "i"));
      return m ? decodeHtml(m[1]) : "";
    };
    return { description: og("description"), image: og("image") };
  } catch {
    return { description: "", image: "" };
  }
}

/**
 * 네이버 뉴스에서 연예·스포츠 이슈 count건을 큐레이션 발행.
 * 이미 처리한 원문 URL(ArticleSource) + 근접 중복 제목은 건너뛴다. AI 미사용 → 과금 0.
 */
export async function publishNaverFeed(count = 10): Promise<{ created: number; titles: string[]; skipped: number }> {
  const values = await getSettingValues(["naver.datalabClientId", "naver.datalabClientSecret"]);
  const clientId = values["naver.datalabClientId"];
  const clientSecret = values["naver.datalabClientSecret"];
  if (!clientId || !clientSecret) return { created: 0, titles: [], skipped: 0 };

  // 다양성 — 매 실행마다 쿼리 순서를 섞어 서로 다른 주제가 나오게
  const pool: NewsItem[] = [];
  const seen = new Set<string>();
  for (const q of shuffle(QUERIES)) {
    if (pool.length >= count * 4) break;
    const items = await fetchNaverNews(q, clientId, clientSecret);
    for (const it of items) {
      if (!seen.has(it.link)) {
        seen.add(it.link);
        pool.push(it);
      }
    }
  }
  // 최신순
  pool.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  // 최근 발행 제목(근접 중복 방지)
  const recent = await prisma.article.findMany({
    where: { articleType: "curation" },
    orderBy: { id: "desc" },
    take: 300,
    select: { title: true },
  });
  const recentTitles = new Set(recent.map((r) => normTitle(r.title)));

  const titles: string[] = [];
  let skipped = 0;
  for (const item of pool) {
    if (titles.length >= count) break;
    const nt = normTitle(item.title);
    if (nt.length < 6 || recentTitles.has(nt)) {
      skipped++;
      continue;
    }
    const dup = await prisma.articleSource.findFirst({ where: { url: item.link } });
    if (dup) {
      skipped++;
      continue;
    }
    const meta = await fetchMeta(item.link);
    const summary = (meta.description || item.description || "").slice(0, 600);
    if (summary.length < 40) {
      skipped++;
      continue;
    }
    let publisher = "네이버뉴스";
    try {
      publisher = new URL(item.link).host.replace(/^www\./, "");
    } catch {
      /* keep default */
    }

    const body =
      `<p>${escapeHtml(summary)}</p>` +
      `<p style="color:#71717a;font-size:14px">이 소식은 <b>${escapeHtml(publisher)}</b> 등 언론 보도를 요약·정리한 것입니다. ` +
      `전체 내용과 사진은 아래 원문에서 확인하실 수 있습니다.</p>` +
      `<p><a href="${escapeHtml(item.link)}" target="_blank" rel="nofollow noopener">👉 원문 기사 전체 보기</a></p>`;

    const article = await prisma.article.create({
      data: {
        title: item.title.slice(0, 190),
        language: "ko",
        articleType: "curation",
        status: "PUBLISHED",
        excerpt: summary.slice(0, 300),
        metaDescription: summary.slice(0, 300),
        contentHtml: body,
        contentMarkdown: summary,
        qualityScore: 80,
        publishAt: new Date(),
      },
    });

    if (meta.image) {
      try {
        const img = await insertImageFromUrl(article.id, meta.image, `출처: ${publisher}`);
        if (img.figure) {
          await prisma.article.update({
            where: { id: article.id },
            data: { contentHtml: `${img.figure}\n${body}` },
          });
        }
      } catch {
        /* 이미지 실패해도 기사는 유지 */
      }
    }

    await prisma.articleSource.create({
      data: {
        articleId: article.id,
        url: item.link,
        title: item.title,
        publisher,
        status: "VERIFIED",
        verifiedAt: new Date(),
      },
    });
    recentTitles.add(nt);
    titles.push(item.title);
  }
  return { created: titles.length, titles, skipped };
}
