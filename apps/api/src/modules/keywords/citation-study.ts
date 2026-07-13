import { prisma } from "../../common/prisma.js";
import { callClaudeJson } from "../ai/claude.js";

/**
 * 인용 학습 — AI 브리핑에 인용된 블로그 글을 실제로 읽고, 왜 인용됐는지 배운다.
 *
 * 네이버가 공개한 인용 5원칙(직접 경험·일관된 주제·진정성·읽기 쉬운 구조·최신성)은 원론이라
 * 그대로 프롬프트에 넣어봐야 글이 안 바뀐다. 대신 **실제로 인용된 글**을 읽어
 * 구조·말투·정보 밀도를 뽑아내고, 그걸 글 생성 프롬프트에 주입한다.
 *
 * 흐름: BlogCitation(수집된 인용 글) → 본문 크롤링 → Claude 분석 → CitationInsight 저장
 *       → generator 가 글 쓸 때 해당 키워드의 인사이트를 프롬프트에 넣는다.
 */

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

export interface PostBody {
  url: string;
  title: string;
  text: string;
  paragraphs: number;
  headings: string[];
  imageCount: number;
  hasTable: boolean;
  charCount: number;
}

function decode(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|​/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16))) // &#x27; 같은 16진수 엔티티
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 네이버 블로그 글 본문을 읽어온다.
 * 스마트에디터 ONE 본문은 `.se-text-paragraph` 문단들로 되어 있고, 모바일(m.blog)이 크롤링에 관대하다.
 */
export async function fetchPostBody(url: string): Promise<PostBody | null> {
  const mobile = url.replace("https://blog.naver.com/", "https://m.blog.naver.com/");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let html: string;
  try {
    const res = await fetch(mobile, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }

  const paragraphs = [...html.matchAll(/class="se-text-paragraph[^"]*"[^>]*>([\s\S]*?)<\/p>/g)]
    .map((m) => decode(m[1]))
    .filter(Boolean);
  if (paragraphs.length === 0) return null;

  // 소제목: 인용문·헤더 컴포넌트 (se-section-sectionTitle / se-quote)
  const headings = [...html.matchAll(/se-section-(?:sectionTitle|quotation)[\s\S]{0,400}?<p[^>]*>([\s\S]*?)<\/p>/g)]
    .map((m) => decode(m[1]))
    .filter((t) => t.length > 1 && t.length < 60)
    .slice(0, 12);

  const title = decode(html.match(/<title[^>]*>([^<]*)/)?.[1] ?? "").replace(/\s*:\s*네이버 블로그\s*$/, "");
  const text = paragraphs.join("\n");

  return {
    url,
    title,
    text,
    paragraphs: paragraphs.length,
    headings,
    imageCount: (html.match(/se-section-image/g) ?? []).length,
    hasTable: /se-section-table|<table/.test(html),
    charCount: text.length,
  };
}

export interface CitationInsightData {
  /** 왜 이 글들이 AI 브리핑에 인용되는가 — 관찰된 공통점 */
  whyCited: string[];
  /** 말투·문체 특징 */
  tone: string;
  /** 글 구조 패턴 (도입·소제목 구성·마무리) */
  structure: string;
  /** AI가 인용하기 좋은 형태로 정보를 담는 방식 */
  infoStyle: string[];
  /** 이 주제에서 이미 다뤄진 각도 — 우리는 피해야 할 것 */
  coveredAngles: string[];
  /** 아직 비어 있는 각도 — 우리가 공략할 틈 */
  gaps: string[];
  /** 글 생성 시 바로 쓸 수 있는 지시문 */
  writingRules: string[];
}

/** 인용된 글들을 읽고 Claude 로 분석해 인사이트를 뽑는다. */
export async function studyKeyword(keywordText: string, maxPosts = 5): Promise<CitationInsightData | null> {
  const citations = await prisma.blogCitation.findMany({
    where: { keywordText },
    orderBy: [{ citedCount: "desc" }, { rank: "asc" }],
    take: maxPosts,
  });
  if (citations.length === 0) return null;

  const bodies: Array<PostBody & { citedLabel: string | null; blogName: string | null }> = [];
  for (const citation of citations) {
    const body = await fetchPostBody(citation.url);
    if (body && body.charCount > 300) {
      bodies.push({ ...body, citedLabel: citation.citedLabel, blogName: citation.blogName });
    }
    await new Promise((r) => setTimeout(r, 600)); // 네이버에 부담 주지 않게
  }
  if (bodies.length === 0) return null;

  const insight = await callClaudeJson<CitationInsightData>({
    operation: "citation-study",
    maxTokens: 8000,
    system: [
      "당신은 네이버 블로그 SEO·AI 검색 최적화 분석가다.",
      "네이버 AI 브리핑에 실제로 인용된 블로그 글들을 읽고, 왜 인용되는지 패턴을 뽑아낸다.",
      "AI 브리핑은 검색 답변의 '출처'로 글을 인용한다 — 즉 AI가 사실을 뽑아 쓰기 좋은 글이 인용된다.",
      "관찰에 근거해서만 답한다. 일반론(좋은 글을 쓰세요)이 아니라, 이 글들에서 실제로 본 것을 쓴다.",
      "반드시 JSON만 출력한다.",
    ].join(" "),
    user: JSON.stringify({
      keyword: keywordText,
      task: "아래는 이 키워드 검색에서 AI 브리핑에 인용된 상위 블로그 글들이다. 왜 인용되는지 분석하라.",
      posts: bodies.map((b) => ({
        title: b.title,
        blogger: b.blogName,
        citation: b.citedLabel,
        charCount: b.charCount,
        paragraphs: b.paragraphs,
        images: b.imageCount,
        hasTable: b.hasTable,
        headings: b.headings,
        body: b.text.slice(0, 6000), // 토큰 절약 — 앞부분이 구조·말투를 가장 잘 보여준다
      })),
      outputFormat: {
        whyCited: ["이 글들이 AI에 인용되는 구체적 이유 3~5개 (관찰 근거 포함)"],
        tone: "공통된 말투·문체를 한 문단으로 (예: 존댓말 + 1인칭 경험 + 짧은 문장)",
        structure: "글 구조 패턴을 한 문단으로 (도입·소제목 흐름·마무리)",
        infoStyle: ["AI가 뽑아 쓰기 좋게 정보를 담는 방식 3~5개 (수치·표·정의문 등)"],
        coveredAngles: ["이미 다뤄진 각도 (우리가 반복하면 안 되는 것)"],
        gaps: ["아직 안 다뤄진 각도 — 우리가 공략할 틈 2~4개"],
        writingRules: ["글 생성 프롬프트에 그대로 넣을 지시문 5~8개 (명령형 한 문장씩)"],
      },
    }),
  });

  await prisma.citationInsight.upsert({
    where: { keywordText },
    update: { data: insight as object, postsStudied: bodies.length, updatedAt: new Date() },
    create: { keywordText, data: insight as object, postsStudied: bodies.length },
  });

  return insight;
}

/** 글 생성 시 프롬프트에 넣을 인사이트를 가져온다 (없으면 null). */
export async function getInsightForPrompt(keywordText: string): Promise<CitationInsightData | null> {
  const row = await prisma.citationInsight.findUnique({ where: { keywordText } });
  return (row?.data as CitationInsightData | undefined) ?? null;
}

/**
 * 인용 글이 수집된 키워드들을 학습한다 (스케줄러가 하루 1회, 인용 수집 직후 호출).
 * 이미 학습한 키워드는 건너뛴다 — Claude 비용이 든다.
 */
export async function studyPendingKeywords(limit = 5): Promise<{ studied: number }> {
  const groups = await prisma.blogCitation.groupBy({
    by: ["keywordText"],
    _max: { citedCount: true },
    orderBy: { _max: { citedCount: "desc" } },
    take: 40,
  });
  const done = await prisma.citationInsight.findMany({ select: { keywordText: true } });
  const doneSet = new Set(done.map((d) => d.keywordText));

  let studied = 0;
  for (const group of groups) {
    if (studied >= limit) break;
    if (doneSet.has(group.keywordText)) continue;
    try {
      const insight = await studyKeyword(group.keywordText);
      if (insight) studied += 1;
    } catch (error) {
      console.error(`[citation-study] 학습 실패 (${group.keywordText}):`, (error as Error).message);
    }
  }
  return { studied };
}
