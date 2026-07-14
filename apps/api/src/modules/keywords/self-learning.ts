import { prisma } from "../../common/prisma.js";
import { callClaudeJson } from "../ai/claude.js";

/**
 * 자가학습 — **내 글의 실제 결과**를 관측해 다음 글에 반영한다.
 *
 * 지금까지의 학습은 전부 '남의 글'(인용 상위 블로거)을 보고 배운 것이었다.
 * 내 글이 실제로 어떻게 됐는지(검색 노출됐나·클릭됐나·AI에 인용됐나)는 아무도 안 봤다.
 * 발행하면 끝, 결과는 어둠 속. 그래서 같은 실수를 반복해도 알 방법이 없었다.
 *
 * 이 모듈이 그 고리를 닫는다:
 *   ① 관측 — 발행한 글마다 결과 지표를 모은다 (GSC 노출·클릭·순위 + 네이버 인용 여부 + 트렌드 맥락)
 *   ② 비교 — 잘된 글 vs 안된 글의 **실제 차이**를 실측한다 (제목 길이·구조·키워드·발행 시각 등)
 *   ③ 학습 — 그 차이에서 규칙을 뽑아 다음 글 생성에 주입한다
 *
 * ⚠️ 표본이 없으면 학습하지 않는다. 성과 신호가 붙은 글이 6개 미만이면 null을 반환한다.
 *    없는 데이터로 규칙을 지어내면 '배운 척'하는 시스템이 되고, 그건 아무것도 안 하느니만 못하다.
 */

const SELF_KEY = "__SELF__:PERFORMANCE";
const MIN_SAMPLE = 6;

/**
 * 표본 크기에 따라 **적용 강도를 달리한다.**
 * 6건에서 곧바로 "이대로 써라"라고 강제하면 우연을 법칙으로 굳힌다.
 * 표본이 커질수록 확신을 키운다 — 데이터가 말할 자격을 얻는 만큼만 말하게 한다.
 */
export type Confidence = "참고" | "권장" | "적용";

export function confidenceOf(sampleSize: number): Confidence {
  if (sampleSize >= 50) return "적용"; // 충분 — 그대로 따른다
  if (sampleSize >= 20) return "권장"; // 쓸 만하다 — 따르되 다른 지침과 충돌하면 재량
  return "참고"; // 6~19건 — 힌트일 뿐, 강제하지 않는다
}

export interface SelfLearning {
  /** 표본 크기에서 나온 적용 강도 — 프롬프트 주입 세기를 결정한다 */
  confidence: Confidence;
  /** 성과가 좋았던 글에서 반복 관찰된 특징 */
  worked: string[];
  /** 성과가 나빴던 글에서 반복 관찰된 특징 — 피해야 할 것 */
  failed: string[];
  /** 다음 글에 바로 적용할 지시 */
  rules: string[];
  sampleSize: number;
  measuredAt: string;
}

/** 글 하나의 관측 결과 — 지표가 하나도 없으면 학습 표본에서 뺀다 */
interface Observation {
  articleId: number;
  title: string;
  articleType: string;
  keyword: string | null;
  qualityScore: number | null;
  charCount: number;
  h2Count: number;
  hasTable: boolean;
  faqCount: number;
  titleLength: number;
  publishedHourKst: number | null;
  daysSincePublish: number | null;
  // 결과 신호
  impressions: number;
  clicks: number;
  avgPosition: number | null;
  citedByNaver: boolean; // 내 글이 네이버 인용 상위에 잡혔는가
}

/** 내 네이버 블로그 ID (설정의 작성 URL에서 뽑는다) */
async function myNaverBlogId(): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key: "naverBlog.writeUrl" } });
  return row?.value?.match(/blog\.naver\.com\/([\w-]+)/)?.[1] ?? null;
}

/**
 * 발행한 글들의 결과를 관측한다.
 * GSC 성과가 아직 없어도(신생 블로그) '인용 여부'와 '구조 지표'는 지금 당장 모을 수 있다.
 */
export async function observeSelfPerformance(): Promise<Observation[]> {
  const blogId = await myNaverBlogId();

  const articles = await prisma.article.findMany({
    where: { publishJobs: { some: { status: "SUCCEEDED" } } },
    select: {
      id: true,
      title: true,
      articleType: true,
      contentMarkdown: true,
      qualityScore: true,
      keyword: { select: { text: true } },
      publishJobs: {
        where: { status: "SUCCEEDED" },
        select: { publishedUrl: true, finishedAt: true, updatedAt: true },
      },
      analytics: {
        where: { source: "SEARCH_CONSOLE" },
        select: { impressions: true, clicks: true, avgPosition: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 120,
  });

  // 내 글이 네이버 인용 상위에 잡혔는지 — blog_citations 에 내 blogId 로 들어온 URL 집합
  const citedUrls = new Set<string>();
  if (blogId) {
    const mine = await prisma.blogCitation.findMany({
      where: { blogId },
      select: { url: true },
    });
    mine.forEach((row) => citedUrls.add(row.url.replace(/\/+$/, "")));
  }

  const now = Date.now();

  return articles.map((article) => {
    const md = article.contentMarkdown ?? "";
    const urls = article.publishJobs.map((job) => job.publishedUrl ?? "").filter(Boolean);
    const publishedAt = article.publishJobs
      .map((job) => job.finishedAt ?? job.updatedAt)
      .sort((a, b) => a.getTime() - b.getTime())[0];

    const impressions = article.analytics.reduce((sum, row) => sum + (row.impressions ?? 0), 0);
    const clicks = article.analytics.reduce((sum, row) => sum + (row.clicks ?? 0), 0);
    const positions = article.analytics.map((row) => row.avgPosition).filter((v): v is number => v !== null);

    return {
      articleId: article.id,
      title: article.title,
      articleType: article.articleType,
      keyword: article.keyword?.text ?? null,
      qualityScore: article.qualityScore,
      charCount: md.replace(/\s+/g, "").length,
      h2Count: (md.match(/^##\s/gm) ?? []).length,
      hasTable: /\|.*\|/.test(md),
      faqCount: (md.match(/^###?\s*Q[.:) ]/gm) ?? []).length,
      titleLength: article.title.length,
      publishedHourKst: publishedAt
        ? new Date(publishedAt.getTime() + 9 * 3600 * 1000).getUTCHours()
        : null,
      daysSincePublish: publishedAt
        ? Math.round((now - publishedAt.getTime()) / 86400000)
        : null,
      impressions,
      clicks,
      avgPosition: positions.length > 0 ? positions.reduce((a, b) => a + b, 0) / positions.length : null,
      citedByNaver: urls.some((url) => citedUrls.has(url.replace(/\/+$/, ""))),
    };
  });
}

/** 성과 점수 — 노출·클릭·순위·인용을 하나의 값으로 (지표가 없으면 null = 표본 제외) */
function outcomeScore(row: Observation): number | null {
  const hasGsc = row.impressions > 0;
  if (!hasGsc && !row.citedByNaver) return null; // 결과 신호가 아예 없다 — 배울 게 없다

  let score = 0;
  score += Math.min(row.impressions, 500) / 5; // 노출 (최대 100)
  score += Math.min(row.clicks, 50) * 2; // 클릭 (최대 100) — 노출보다 강한 신호
  if (row.avgPosition !== null) score += Math.max(0, 40 - row.avgPosition) * 2; // 순위 (상위일수록)
  if (row.citedByNaver) score += 80; // AI 인용 = 우리 목표
  return Math.round(score);
}

/**
 * 관측 → 비교 → 규칙. 표본이 부족하면 null (배운 척하지 않는다).
 */
export async function buildSelfLearning(): Promise<SelfLearning | null> {
  const observations = await observeSelfPerformance();
  const scored = observations
    .map((row) => ({ row, score: outcomeScore(row) }))
    .filter((item): item is { row: Observation; score: number } => item.score !== null)
    .sort((a, b) => b.score - a.score);

  if (scored.length < MIN_SAMPLE) return null;

  const half = Math.max(2, Math.floor(scored.length / 3));
  const top = scored.slice(0, half);
  const bottom = scored.slice(-half);

  const strip = (item: { row: Observation; score: number }) => ({
    title: item.row.title,
    type: item.row.articleType,
    keyword: item.row.keyword,
    quality: item.row.qualityScore,
    chars: item.row.charCount,
    h2: item.row.h2Count,
    table: item.row.hasTable,
    faq: item.row.faqCount,
    titleLen: item.row.titleLength,
    publishedHourKst: item.row.publishedHourKst,
    daysLive: item.row.daysSincePublish,
    impressions: item.row.impressions,
    clicks: item.row.clicks,
    avgPosition: item.row.avgPosition,
    citedByNaver: item.row.citedByNaver,
    outcomeScore: item.score,
  });

  const result = await callClaudeJson<{ worked: string[]; failed: string[]; rules: string[] }>({
    operation: "self-learning",
    maxTokens: 4000,
    system: [
      "당신은 블로그 성과 분석가입니다. **같은 블로그가 쓴 글들**의 실제 성과 데이터를 받습니다.",
      "성과 상위 글과 하위 글의 **측정 가능한 차이**만 찾아내세요.",
      "- 지표는 실측값이다(노출·클릭·평균순위·AI 인용 여부·제목 길이·본문 길이·H2 수·표·FAQ·발행 시각).",
      "- ⚠️ 표본이 작다. **우연을 법칙으로 착각하지 마라.** 상위 3건에만 보이는 특징은 법칙이 아니다.",
      "- 근거가 약하면 항목 수를 줄여라. 억지로 채우면 다음 글이 그 헛소리를 따라 쓴다.",
      "- '좋은 제목을 써라' 같은 공허한 말 금지. 숫자와 관찰에서 나온 지시만.",
      "- 발행한 지 얼마 안 된 글(daysLive가 작은 글)은 성과가 낮은 게 당연하다. 이걸 '실패'로 오독하지 마라.",
      'JSON만 출력: {"worked":["..."],"failed":["..."],"rules":["다음 글에 바로 적용할 지시"]}',
    ].join("\n"),
    user: JSON.stringify({
      task: "내 블로그 글의 성과 상위/하위를 비교해 다음 글에 적용할 규칙 도출",
      sampleSize: scored.length,
      note: "outcomeScore = 노출+클릭+순위+AI인용을 합산한 값. citedByNaver=true는 네이버 AI 브리핑 인용 상위에 잡힌 것(최우선 목표).",
      topPerformers: top.map(strip),
      bottomPerformers: bottom.map(strip),
    }),
  });

  const learning: SelfLearning = {
    confidence: confidenceOf(scored.length),
    worked: (result.worked ?? []).slice(0, 8),
    failed: (result.failed ?? []).slice(0, 8),
    rules: (result.rules ?? []).slice(0, 10),
    sampleSize: scored.length,
    measuredAt: new Date().toISOString(),
  };

  await prisma.citationInsight.upsert({
    where: { keywordText: SELF_KEY },
    update: { data: learning as unknown as object, postsStudied: scored.length },
    create: {
      keywordText: SELF_KEY,
      data: learning as unknown as object,
      postsStudied: scored.length,
    },
  });

  return learning;
}

/** 글 생성 시 주입 (없으면 null — 없는 걸 지어내지 않는다) */
export async function getSelfLearning(): Promise<SelfLearning | null> {
  const row = await prisma.citationInsight.findUnique({ where: { keywordText: SELF_KEY } });
  return (row?.data as unknown as SelfLearning | undefined) ?? null;
}

/** 자가학습 상태 — 대시보드에 "관측 중 / 학습됨"을 정직하게 보여주기 위한 요약 */
export async function selfLearningStatus(): Promise<{
  published: number;
  withSignal: number;
  minSample: number;
  learned: SelfLearning | null;
}> {
  const observations = await observeSelfPerformance();
  const withSignal = observations.filter((row) => outcomeScore(row) !== null).length;
  return {
    published: observations.length,
    withSignal,
    minSample: MIN_SAMPLE,
    learned: await getSelfLearning(),
  };
}
