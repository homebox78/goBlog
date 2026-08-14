// 네이버 뉴스 검색 API 기반 연예·엔터 중심 큐레이션 발행 (AI 미사용 = 무과금).
// 섹션: 연예·스포츠 / 연예 속보 / 경제·금융 / IT·게임 — 토픽 그룹별 키워드로 섹션 분류.
// 각 기사 = 원문 요약(og/snippet) + 출처 표기 + 원문 링크. 자체 뉴스에만 노출.
import { prisma } from "../../common/prisma.js";
import { getSettingValues } from "../settings/settings.service.js";
import { insertImageFromUrl } from "../images/image-service.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

// 토픽 그룹 — kw(키워드 텍스트, 섹션 분류용 category 겸용)·weight(발행 비중)·queries(네이버 검색어)
interface TopicGroup {
  kw: string;
  category: string;
  weight: number;
  queries: string[];
}
const TOPIC_GROUPS: TopicGroup[] = [
  {
    kw: "연예·스포츠 큐레이션",
    category: "엔터",
    weight: 4,
    queries: [
      "드라마", "영화", "예능", "아이돌", "K팝", "걸그룹", "보이그룹", "배우", "가수", "컴백",
      "넷플릭스", "티빙", "박스오피스", "OST", "콘서트", "방송", "트로트",
      "축구", "손흥민", "이강인", "야구", "KBO", "프리미어리그", "농구", "골프",
    ],
  },
  {
    kw: "연예 속보 큐레이션",
    category: "연예속보",
    weight: 3,
    queries: [
      "연예 속보", "연예인 열애", "열애설", "결별", "연예인 논란", "입장문", "소속사 입장",
      "해명", "포착", "목격", "화제", "라방", "SNS 화제", "예능 화제",
    ],
  },
  {
    kw: "경제·금융 큐레이션",
    category: "머니",
    weight: 2,
    queries: ["증시", "코스피", "코스닥", "부동산", "비트코인", "코인", "금리", "환율", "재테크", "주가"],
  },
  {
    kw: "IT·게임 큐레이션",
    category: "테크",
    weight: 1,
    queries: ["AI", "인공지능", "챗GPT", "스마트폰", "갤럭시", "아이폰", "신작 게임", "IT 신제품", "앱"],
  },
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

function normTitle(s: string): string {
  return s.replace(/[^0-9a-z가-힣]+/gi, "").toLowerCase();
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface NewsItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
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
      }))
      .filter((it) => it.title && it.link);
  } catch {
    return [];
  }
}

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

/** 섹션 분류용 키워드 upsert(재사용). status=USED로 생성 파이프라인에서 제외. */
async function ensureKeyword(text: string, category: string): Promise<number> {
  const k = await prisma.keyword.upsert({
    where: { text },
    create: { text, category, status: "USED" },
    update: { category },
  });
  return k.id;
}

/**
 * 네이버 뉴스에서 연예·엔터 중심 이슈 count건을 큐레이션 발행(토픽 그룹 비중대로).
 * URL·근접 제목 중복 제거. AI 미사용 → 과금 0.
 */
export async function publishNaverFeed(count = 10): Promise<{ created: number; titles: string[]; skipped: number }> {
  const values = await getSettingValues(["naver.datalabClientId", "naver.datalabClientSecret"]);
  const clientId = values["naver.datalabClientId"];
  const clientSecret = values["naver.datalabClientSecret"];
  if (!clientId || !clientSecret) return { created: 0, titles: [], skipped: 0 };

  // 최근 발행 제목(근접 중복 방지)
  const recent = await prisma.article.findMany({
    where: { articleType: "curation" },
    orderBy: { id: "desc" },
    take: 400,
    select: { title: true },
  });
  const recentTitles = new Set(recent.map((r) => normTitle(r.title)));

  const totalWeight = TOPIC_GROUPS.reduce((s, g) => s + g.weight, 0);
  const titles: string[] = [];
  let skipped = 0;

  for (const group of TOPIC_GROUPS) {
    const target = Math.max(1, Math.round((count * group.weight) / totalWeight));
    if (titles.length >= count) break;

    // 그룹 내 쿼리를 섞어 다양성 확보 후 풀 구성(URL 중복 제거)
    const pool: NewsItem[] = [];
    const seen = new Set<string>();
    for (const q of shuffle(group.queries)) {
      if (pool.length >= target * 5) break;
      const items = await fetchNaverNews(q, clientId, clientSecret);
      for (const it of items) {
        if (!seen.has(it.link)) {
          seen.add(it.link);
          pool.push(it);
        }
      }
    }
    pool.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    const keywordId = await ensureKeyword(group.kw, group.category);
    let madeInGroup = 0;
    for (const item of pool) {
      if (madeInGroup >= target || titles.length >= count) break;
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
          keywordId,
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
      madeInGroup++;
    }
  }
  return { created: titles.length, titles, skipped };
}
