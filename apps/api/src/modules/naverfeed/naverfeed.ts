// 네이버 뉴스 검색 API 기반 연예·엔터 중심 큐레이션 발행 (AI 미사용 = 무과금).
// 섹션: 연예·스포츠 / 연예 속보 / 경제·금융 / IT·게임 — 토픽 그룹별 키워드로 섹션 분류.
// 각 기사 = 원문 요약(og/snippet) + 출처 표기 + 원문 링크. 자체 뉴스에만 노출.
import { prisma } from "../../common/prisma.js";
import { getSettingValues } from "../settings/settings.service.js";
import { insertImageFromUrl } from "../images/image-service.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

// 연예·스포츠 사이트에 부적합한 기사 전역 차단(금융·증시·부동산·정치 등)
const EXCLUDE_ALL = [
  "주가", "증시", "코스피", "코스닥", "관리종목", "목표주가", "상장폐지", "증권사", "영업이익",
  "시가총액", "배당금", "동전주", "연저점", "연고점", "급등주", "급락주", "매출액", "실적 부진",
  "분양", "청약", "대출", "금리", "환율", "부동산", "국회", "대통령실", "여야", "장관",
];

// 토픽 그룹 — kw(키워드 텍스트, 섹션 분류용 category 겸용)·weight(발행 비중)·queries(네이버 검색어)
interface TopicGroup {
  kw: string;
  category: string;
  weight: number;
  queries: string[];
  match: string[]; // 제목/요약에 이 중 하나가 있어야만 발행(오분류·잡음 차단)
}
// 키워드 category = 섹션명(1:1). news_section이 in_array로 그대로 섹션 반환.
const TOPIC_GROUPS: TopicGroup[] = [
  { kw: "연예가화제", category: "연예가화제", weight: 3, queries: ["연예인 열애", "열애설", "연예인 결별", "연예인 논란", "배우 근황", "가수 근황"],
    match: ["열애", "결별", "결혼", "이혼", "논란", "배우", "가수", "방송인", "개그맨", "아나운서", "셀럽"] },
  { kw: "방송·가요", category: "방송·가요", weight: 3, queries: ["드라마", "예능", "가요", "음원차트", "시청률", "트로트"],
    match: ["드라마", "예능", "방송", "가요", "음원", "시청률", "무대", "컴백", "OST", "출연", "MC", "트로트"] },
  { kw: "영화", category: "영화", weight: 2, queries: ["영화 개봉", "박스오피스", "넷플릭스 영화", "영화 예고편", "영화제"],
    match: ["영화", "박스오피스", "개봉", "감독", "관객", "시사회", "예고편", "주연", "스크린"] },
  { kw: "해외연예", category: "해외연예", weight: 2, queries: ["할리우드", "빌보드", "팝스타", "해외 셀럽"],
    match: ["할리우드", "빌보드", "그래미", "팝스타", "팝가수", "해외 스타", "해외스타", "미국 배우", "일본 배우"] },
  { kw: "아이돌24시", category: "아이돌24시", weight: 3, queries: ["아이돌", "걸그룹", "보이그룹", "방탄소년단", "블랙핑크", "케이팝 컴백"],
    match: ["아이돌", "걸그룹", "보이그룹", "그룹", "멤버", "컴백", "데뷔", "앨범", "케이팝", "팬미팅", "타이틀곡"] },
  { kw: "야구", category: "야구", weight: 2, queries: ["KBO", "프로야구", "한국시리즈"],
    match: ["야구", "KBO", "투수", "타자", "홈런", "구단", "선발", "타율", "이닝", "포수"] },
  { kw: "해외야구", category: "해외야구", weight: 1, queries: ["MLB", "메이저리그", "오타니 야구"],
    match: ["MLB", "메이저리그", "오타니", "김하성", "이정후", "다저스", "양키스", "빅리그"] },
  { kw: "축구", category: "축구", weight: 2, queries: ["K리그", "축구 국가대표", "축구 대표팀"],
    match: ["축구", "K리그", "국가대표", "대표팀", "월드컵", "A매치"] },
  { kw: "해외축구", category: "해외축구", weight: 2, queries: ["손흥민", "이강인", "김민재", "프리미어리그", "챔피언스리그"],
    match: ["손흥민", "이강인", "김민재", "프리미어리그", "챔피언스리그", "EPL", "토트넘", "PSG", "분데스", "라리가"] },
  { kw: "농구·배구", category: "농구·배구", weight: 1, queries: ["KBL 농구", "프로농구", "프로배구", "V리그"],
    match: ["농구", "배구", "KBL", "V리그", "리바운드", "세터", "스파이크"] },
  { kw: "스포츠일반", category: "스포츠일반", weight: 1, queries: ["골프 대회", "UFC", "테니스", "e스포츠"],
    match: ["골프", "UFC", "올림픽", "테니스", "격투", "e스포츠", "롤드컵", "메달"] },
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
  // 엔티티 토큰 기반 근접중복(같은 사건·인물 다른 제목) 방지
  const tokenize = (s: string): string[] =>
    [...new Set((s.toLowerCase().match(/[가-힣a-z0-9]{2,}/g) ?? []).filter((t) => !["기자", "종합", "단독", "공식", "영상", "포토", "사진", "속보", "오늘"].includes(t)))];
  const recentTokenSets: Set<string>[] = recent.map((r) => new Set(tokenize(r.title)));

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
      // 금융/증시/부동산 등 비연예 기사 전역 차단(연예 기업 언급으로 새는 것 방지)
      const relHay = `${item.title} ${item.description}`;
      if (EXCLUDE_ALL.some((x) => relHay.includes(x))) {
        skipped++;
        continue;
      }
      // 관련성 필터 — 제목/요약에 섹션 핵심어가 없으면 오분류 잡음이므로 제외
      if (!group.match.some((m) => relHay.includes(m))) {
        skipped++;
        continue;
      }
      // 엔티티 토큰 2개 이상 겹치면 같은 사건 → 중복 제외
      const toks = new Set(tokenize(item.title));
      if (toks.size >= 2 && recentTokenSets.some((rs) => { let o = 0; for (const t of toks) if (rs.has(t)) o++; return o >= 2; })) {
        skipped++;
        continue;
      }
      const dup = await prisma.articleSource.findFirst({ where: { url: item.link } });
      if (dup) {
        skipped++;
        continue;
      }
      const meta = await fetchMeta(item.link);
      // 썸네일(대표이미지) 없는 기사는 발행하지 않는다
      if (!meta.image) {
        skipped++;
        continue;
      }
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
      recentTokenSets.push(toks);
      titles.push(item.title);
      madeInGroup++;
    }
  }
  return { created: titles.length, titles, skipped };
}
