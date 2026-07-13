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

/* ──────────────────────────────────────────────────────────────────────────
 * 말투 학습 (StyleProfile)
 *
 * ⚠️ Claude 에게 "말투를 요약해줘"라고 물으면 인상평을 지어낸다. 실제로 첫 분석에서
 * "존댓말 기반 친근한 반말체(~이에요/~해요)"라고 했지만, 인용 상위 10개 글을 실측하니
 * **'~습니다/~입니다'가 압도적이고 '해요체'는 거의 없었다.** 이모지도 8/10 글이 0개인데,
 * 우리 생성 프롬프트는 "문단마다 이모지를 넣어라"고 지시하고 있었다(정반대).
 *
 * 그래서 말투는 **결정적으로 측정**한 뒤, 그 수치를 Claude 에게 주고 규칙만 뽑게 한다.
 * ────────────────────────────────────────────────────────────────────────── */

const ENDINGS = ["습니다", "합니다", "입니다", "이에요", "예요", "해요", "죠", "네요", "거든요", "이다", "한다"];

export interface StyleMetrics {
  posts: number;
  avgSentenceChars: number;
  /** 어미 사용 비율 (%) — 하십시오체(습니다/입니다) vs 해요체(이에요/해요) vs 평서체(이다/한다) */
  endingRatio: Record<string, number>;
  formalRatio: number; // 습니다·입니다·합니다 비율
  politeCasualRatio: number; // 이에요·예요·해요·죠·네요 비율
  plainRatio: number; // 이다·한다 (신문체)
  emojiPerPost: number;
  questionsPerPost: number;
  firstPersonPerPost: number;
  /** 1,000자당 수치 표현(퍼센트·원·년·배 등) 개수 — AI 인용의 핵심 신호 */
  numbersPer1000Chars: number;
  avgChars: number;

  /* ── 줄바꿈·문단 형태 (사람이 쓴 티가 가장 크게 나는 지점) ────────────────
   * AI 글은 한 문단에 3~5문장을 몰아넣는다. 사람이 쓴 네이버 블로그는 **한 문장을 쓰고 엔터**를 친다.
   * 실측: 인용 상위 8명 중 한 문장짜리 문단이 85%, 30자 이하 짧은 문단이 63%. */
  paragraphsPerPost: number;
  avgParagraphChars: number;
  /** 한 문장으로만 이뤄진 문단 비율 (%) — 이게 높을수록 사람이 쓴 글처럼 보인다 */
  oneSentenceParagraphRatio: number;
  /** 30자 이하 짧은 문단 비율 (%) */
  shortParagraphRatio: number;
}

/** 인용된 글들의 문체를 결정적으로 측정한다 (LLM 인상평 금지). */
export function measureStyle(bodies: PostBody[]): StyleMetrics {
  let sentTotal = 0;
  let sentChars = 0;
  const endCount: Record<string, number> = {};
  let endTotal = 0;
  let emoji = 0;
  let questions = 0;
  let firstPerson = 0;
  let numbers = 0;
  let chars = 0;
  let paraTotal = 0;
  let paraChars = 0;
  let oneSentParas = 0;
  let shortParas = 0;

  for (const b of bodies) {
    chars += b.charCount;

    // 문단(= 사람이 엔터를 친 단위) 형태 측정
    const paras = b.text.split("\n").map((p) => p.trim()).filter(Boolean);
    paraTotal += paras.length;
    paraChars += paras.reduce((sum, p) => sum + p.length, 0);
    for (const p of paras) {
      const sentences = (p.match(/[.!?]/g) ?? []).length || 1;
      if (sentences === 1) oneSentParas += 1;
      if (p.length <= 30) shortParas += 1;
    }
    const sentences = b.text
      .split(/(?<=[.!?])\s+|\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 3);
    sentTotal += sentences.length;
    sentChars += sentences.reduce((sum, s) => sum + s.length, 0);

    for (const s of sentences) {
      const stripped = s.replace(/[.!?…\s]+$/, "");
      for (const e of ENDINGS) {
        if (stripped.endsWith(e)) {
          endCount[e] = (endCount[e] ?? 0) + 1;
          endTotal += 1;
          break;
        }
      }
      if (s.includes("?")) questions += 1;
    }
    emoji += (b.text.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) ?? []).length;
    firstPerson += (b.text.match(/저는|제가|저도|필자|직접 (?:써|해|가)/g) ?? []).length;
    numbers += (b.text.match(/\d[\d,.]*\s*(?:%|원|만|억|년|배|개|위|월|일)/g) ?? []).length;
  }

  const n = Math.max(bodies.length, 1);
  const pct = (keys: string[]) =>
    endTotal === 0 ? 0 : Math.round((keys.reduce((sum, k) => sum + (endCount[k] ?? 0), 0) / endTotal) * 100);

  const endingRatio: Record<string, number> = {};
  for (const [k, v] of Object.entries(endCount)) {
    endingRatio[k] = Math.round((v / Math.max(endTotal, 1)) * 100);
  }

  return {
    posts: bodies.length,
    avgSentenceChars: sentTotal ? Math.round(sentChars / sentTotal) : 0,
    endingRatio,
    formalRatio: pct(["습니다", "합니다", "입니다"]),
    politeCasualRatio: pct(["이에요", "예요", "해요", "죠", "네요", "거든요"]),
    plainRatio: pct(["이다", "한다"]),
    emojiPerPost: Math.round((emoji / n) * 10) / 10,
    questionsPerPost: Math.round((questions / n) * 10) / 10,
    firstPersonPerPost: Math.round((firstPerson / n) * 10) / 10,
    numbersPer1000Chars: chars ? Math.round((numbers / chars) * 1000 * 10) / 10 : 0,
    avgChars: Math.round(chars / n),
    paragraphsPerPost: Math.round(paraTotal / n),
    avgParagraphChars: paraTotal ? Math.round(paraChars / paraTotal) : 0,
    oneSentenceParagraphRatio: paraTotal ? Math.round((oneSentParas / paraTotal) * 100) : 0,
    shortParagraphRatio: paraTotal ? Math.round((shortParas / paraTotal) * 100) : 0,
  };
}

export interface StyleProfile {
  metrics: StyleMetrics;
  /** 측정값을 근거로 뽑은, 글 생성에 바로 넣을 문체 규칙 */
  rules: string[];
  /** 관찰된 말투 요약 (측정값에 근거) */
  summary: string;
  /** 인용 상위 블로거들이 실제로 쓴 문장 예시 */
  samples: string[];
}

/**
 * 문체는 **플랫폼마다 다르다.**
 *  · NAVER  — AI 브리핑 인용이 목표. 인용 상위 블로거를 실측해 학습한다(하십시오체·짧은 문단).
 *  · 그 외   — 학습 데이터가 없다(인용 배지는 네이버만 노출). 기본 문체 규칙을 쓴다.
 * CitationInsight 를 `__STYLE__:<플랫폼>` 예약 키로 재사용한다(마이그레이션 불필요).
 */
export type StylePlatform = "NAVER" | "BLOGGER" | "WORDPRESS" | "TISTORY";
const styleKey = (platform: StylePlatform) => `__STYLE__:${platform}`;
const LEGACY_STYLE_KEY = "__STYLE__"; // 플랫폼 분기 이전에 저장된 행 (네이버 학습분)

/** 예약 키(전역 문체)인가 — 키워드 목록·학습 대상에서 제외해야 한다 */
export function isStyleKey(keywordText: string): boolean {
  return keywordText.startsWith(LEGACY_STYLE_KEY);
}

/**
 * 인용 상위 글들을 읽어 **네이버 말투 프로파일**을 학습한다.
 * 측정값(결정적)을 먼저 뽑고, 그 수치를 Claude 에게 근거로 줘서 규칙만 쓰게 한다.
 */
export async function studyStyle(maxPosts = 12): Promise<StyleProfile | null> {
  const citations = await prisma.blogCitation.findMany({
    orderBy: { citedCount: "desc" },
    take: maxPosts * 2,
    distinct: ["blogId"], // 같은 블로거 글이 여러 개면 한 번만 — 특정 블로거에 치우치지 않게
  });

  const bodies: PostBody[] = [];
  for (const citation of citations) {
    if (bodies.length >= maxPosts) break;
    const body = await fetchPostBody(citation.url);
    if (body && body.charCount > 500) bodies.push(body);
    await new Promise((r) => setTimeout(r, 500));
  }
  if (bodies.length < 3) return null; // 표본이 너무 적으면 학습하지 않는다

  const metrics = measureStyle(bodies);

  // 문장 표본 — Claude 가 실제 문장을 보고 규칙을 쓰게 한다
  const samples = bodies
    .flatMap((b) => b.text.split(/\n/).filter((s) => s.length > 25 && s.length < 120))
    .slice(0, 40);

  const result = await callClaudeJson<{ rules: string[]; summary: string }>({
    operation: "style-study",
    maxTokens: 4000,
    system: [
      "당신은 한국어 문체 분석가다. 네이버 AI 브리핑에 인용된 상위 블로그 글들의 말투와 '사람이 쓴 티'를 분석한다.",
      "⚠️ 인상으로 짐작하지 마라. 반드시 주어진 **측정값(metrics)** 에 근거해서만 판단한다.",
      "측정값과 어긋나는 서술을 하면 안 된다 (예: 이모지가 0개인데 '이모지를 활발히 쓴다'고 쓰면 틀린 것).",
      "특히 **줄바꿈·문단 형태**를 중요하게 다뤄라. AI 글은 한 문단에 여러 문장을 몰아넣지만,",
      "사람이 쓴 네이버 블로그는 한 문장 쓰고 엔터를 친다 — 이게 사람 글처럼 보이는 가장 큰 신호다.",
      "결과는 글 생성 프롬프트에 그대로 넣을 수 있는 구체적 규칙이어야 한다. '자연스럽게 쓰세요' 같은 일반론 금지.",
      "반드시 JSON만 출력한다.",
    ].join(" "),
    user: JSON.stringify({
      task: "AI 브리핑에 인용되는 글들의 말투와 문단 형태를 규칙으로 정리하라. 'AI가 쓴 티'를 없애는 데 초점을 둔다.",
      metrics,
      metricsGuide: {
        formalRatio: "문장 어미 중 '~습니다/~입니다/~합니다'(하십시오체) 비율 %",
        politeCasualRatio: "'~이에요/~해요/~죠/~네요'(해요체) 비율 %",
        plainRatio: "'~이다/~한다'(신문체) 비율 %",
        emojiPerPost: "글 1편당 이모지 개수",
        firstPersonPerPost: "글 1편당 1인칭 표현('저는','제가') 개수",
        numbersPer1000Chars: "본문 1,000자당 수치 표현 개수 (AI가 인용할 팩트 밀도)",
        avgSentenceChars: "평균 문장 길이(자)",
        paragraphsPerPost: "글 1편당 문단(엔터로 나뉜 덩어리) 수",
        avgParagraphChars: "문단 평균 길이(자)",
        oneSentenceParagraphRatio: "한 문장만으로 이뤄진 문단의 비율 % — 높을수록 '한 줄 쓰고 엔터' 스타일",
        shortParagraphRatio: "30자 이하 짧은 문단 비율 %",
      },
      sentenceSamples: samples,
      outputFormat: {
        summary: "측정값에 근거한 말투·문단 형태 요약 2~3문장 (수치와 함께 언급)",
        rules: [
          "글 생성 프롬프트에 넣을 규칙 8~12개. 각각 측정값에 근거한 명령형 한 문장.",
          "반드시 포함할 것: ① 어미 ② 문장 길이 ③ **줄바꿈/문단 형태(한 문장마다 엔터)** ④ 수치 밀도",
          "⑤ AI 티를 없애는 구체적 방법(상투어 금지·문장 길이 변주·기계적 병렬 나열 금지 등)",
          "예: '한 문단은 한 문장으로 쓰고 엔터를 친다(인용 상위 글의 85%가 한 문장 문단).'",
        ],
      },
    }),
  });

  const profile: StyleProfile = { metrics, rules: result.rules, summary: result.summary, samples: samples.slice(0, 8) };

  // 인용 배지는 네이버에서만 나오므로, 학습된 문체는 NAVER 프로파일이다.
  await prisma.citationInsight.upsert({
    where: { keywordText: styleKey("NAVER") },
    update: { data: profile as unknown as object, postsStudied: bodies.length, updatedAt: new Date() },
    create: { keywordText: styleKey("NAVER"), data: profile as unknown as object, postsStudied: bodies.length },
  });
  return profile;
}

/**
 * 글 생성 시 프롬프트에 넣을 말투 프로파일.
 * 네이버 외 플랫폼은 학습 데이터가 없으므로 null → generator 가 기본 문체 규칙을 쓴다.
 */
export async function getStyleForPrompt(platform: StylePlatform = "NAVER"): Promise<StyleProfile | null> {
  const row =
    (await prisma.citationInsight.findUnique({ where: { keywordText: styleKey(platform) } })) ??
    // 플랫폼 분기 이전에 저장된 행(네이버 학습분) 호환
    (platform === "NAVER"
      ? await prisma.citationInsight.findUnique({ where: { keywordText: LEGACY_STYLE_KEY } })
      : null);
  return (row?.data as StyleProfile | undefined) ?? null;
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
    if (isStyleKey(group.keywordText)) continue; // 예약 키(전역 문체)는 키워드가 아니다
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
