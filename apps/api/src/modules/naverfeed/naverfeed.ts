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
  // 금융·증시·부동산·정치
  "주가", "증시", "코스피", "코스닥", "관리종목", "목표주가", "상장폐지", "증권사", "영업이익",
  "시가총액", "배당금", "동전주", "연저점", "연고점", "급등주", "급락주", "매출액", "실적 부진",
  "분양", "청약", "대출", "금리", "환율", "부동산", "국회", "대통령실", "여야", "장관",
  // 여행·관광·생활정보(연예/스포츠 아님)
  "관광공사", "가볼 만한", "가볼만한", "명소", "나들이", "여행 코스", "여행코스", "축제 개막",
  "지자체", "시청", "군청", "행정", "채용 공고", "박람회", "설명회", "브리핑",
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
  { kw: "아이돌365", category: "아이돌365", weight: 3, queries: ["아이돌", "걸그룹", "보이그룹", "방탄소년단", "블랙핑크", "케이팝 컴백"],
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

const SECTION_NAMES = [
  "연예가화제", "방송·가요", "영화", "해외연예", "아이돌365",
  "야구", "해외야구", "축구", "해외축구", "농구·배구", "스포츠일반",
];

/**
 * Gemini(싼 텍스트 모델)로 기사 섹션을 정확 분류. 연예·스포츠가 아니면 "NONE".
 * 생성이 아니라 '분류'라 매우 저렴(글당 ~0.0001원). 실패 시 null(키워드 방식 폴백).
 */
async function classifySection(title: string, summary: string, apiKey: string): Promise<string | null> {
  const prompt =
    `아래 한국 뉴스가 어느 섹션인지 딱 하나만 골라 그 이름만 출력해.\n` +
    `섹션 목록: ${SECTION_NAMES.join(", ")}, NONE\n` +
    `규칙:\n` +
    `- 해외연예 = 외국(할리우드·빌보드·미국/일본 등) 연예인/작품 그 자체 기사만. 한국 연예인이 '할리우드'를 언급만 해도 해외연예 아님.\n` +
    `- 해외야구/해외축구 = 해외리그(MLB·프리미어리그 등) 또는 해외파 선수 기사.\n` +
    `- 아이돌365 = 아이돌 그룹/멤버 본인 활동. 아이돌 소속사 '주가' 같은 증권 기사는 NONE.\n` +
    `- 주식·증시·부동산·정치·경제·사회일반 등 연예/스포츠가 아니면 반드시 NONE.\n` +
    `제목: ${title}\n요약: ${summary}\n답(섹션명 하나만):`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 12, temperature: 0 },
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
        const text = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
        if (!text) return null;
        const found = SECTION_NAMES.find((s) => text.includes(s));
        if (found) return found;
        return text.includes("NONE") ? "NONE" : null;
      }
      // 429(rate limit) 등은 잠깐 대기 후 1회 재시도
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, res.status === 429 ? 2500 : 800));
        continue;
      }
      return null;
    } catch {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
      return null;
    }
  }
  return null;
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
  const values = await getSettingValues([
    "naver.datalabClientId",
    "naver.datalabClientSecret",
    "gemini.apiKey",
    "naverfeed.aiClassify",
  ]);
  const clientId = values["naver.datalabClientId"];
  const clientSecret = values["naver.datalabClientSecret"];
  if (!clientId || !clientSecret) return { created: 0, titles: [], skipped: 0 };
  const geminiKey = values["gemini.apiKey"] ?? "";
  const aiClassify = values["naverfeed.aiClassify"] === "true" && geminiKey !== "";

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
  // 동일 인물/엔티티(제목의 3자+ 고유명사) 1건만 — 같은 인물 도배 방지(전현무 3건 등)
  const ENTITY_STOP = new Set([
    "열애설", "아니잖아", "근황", "공개", "소식", "논란", "화제", "인터뷰", "이유", "이번", "지난", "오늘",
    "방송", "출연", "예정", "종영", "컴백", "활동", "연예인", "이야기", "프로그램", "스타일", "리메이크",
  ]);
  const entitiesOf = (s: string): string[] => (s.match(/[가-힣]{3,}/g) ?? []).filter((t) => !ENTITY_STOP.has(t));
  const recentEntities = new Set<string>(recent.flatMap((r) => entitiesOf(r.title)));

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
      if (!aiClassify && !group.match.some((m) => relHay.includes(m))) {
        skipped++;
        continue;
      }
      // 엔티티 토큰 2개 이상 겹치면 같은 사건 → 중복 제외
      const toks = new Set(tokenize(item.title));
      if (toks.size >= 2 && recentTokenSets.some((rs) => { let o = 0; for (const t of toks) if (rs.has(t)) o++; return o >= 2; })) {
        skipped++;
        continue;
      }
      // 동일 인물/엔티티(3자+ 고유명사) 이미 발행됐으면 제외 — 도배 방지
      const ents = entitiesOf(item.title);
      if (ents.some((e) => recentEntities.has(e))) {
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
      // 섹션 결정 — AI 분류(Gemini) 우선, 실패 시 그룹 키워드 폴백. NONE이면 발행 제외.
      let keywordId: number;
      if (aiClassify) {
        const aiSec = await classifySection(item.title, summary, geminiKey);
        if (aiSec === "NONE") {
          skipped++;
          continue;
        }
        if (aiSec) {
          keywordId = await ensureKeyword(aiSec, aiSec);
        } else {
          // AI 실패 → '해외' 섹션은 폴백 금지(키워드로 국내/해외 구분 불가 → 한국 기사 유입). 그 외는 키워드 관련성 통과분만.
          if (group.category.startsWith("해외") || !group.match.some((m) => relHay.includes(m))) {
            skipped++;
            continue;
          }
          keywordId = await ensureKeyword(group.kw, group.category);
        }
      } else {
        keywordId = await ensureKeyword(group.kw, group.category);
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
      for (const e of ents) recentEntities.add(e);
      titles.push(item.title);
      madeInGroup++;
    }
  }
  return { created: titles.length, titles, skipped };
}
