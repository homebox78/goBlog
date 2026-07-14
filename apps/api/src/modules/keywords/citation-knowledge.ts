import { prisma } from "../../common/prisma.js";
import { callClaudeJson } from "../ai/claude.js";
import { isStyleKey, type CitationInsightData } from "./citation-study.js";

/**
 * 인용 학습의 **전역 지식화**.
 *
 * 문제: 학습 결과(CitationInsight)가 **그 키워드에만 갇혀 있었다.**
 *   `getInsightForPrompt(키워드)` 는 문자열이 정확히 일치할 때만 인사이트를 준다.
 *   즉 새 키워드로 글을 쓰면 그동안 쌓은 학습이 **하나도 안 쓰인다.** 매번 백지에서 시작한 셈.
 *
 * 해결: 키워드별 인사이트들을 종합해 **주제와 무관하게 통하는 법칙**만 뽑아 하나의 지식으로 축적한다.
 *   - 이 지식은 모든 글 생성에 항상 주입된다 (키워드 인사이트가 있으면 그것과 함께).
 *   - 새 인사이트가 쌓일수록 다시 종합해 갱신한다 (빅데이터처럼 계속 증적).
 *   - 특정 AI 엔진에 묶이지 않는 **평문 지식**이라, 엔진이 바뀌어도 그대로 쓰인다.
 */

const KNOWLEDGE_KEY = "__KNOWLEDGE__:GLOBAL";

export interface CitationKnowledge {
  /** 주제를 가리지 않고 통하는, AI 인용을 부르는 법칙 */
  laws: string[];
  /** 인용되는 글이 정보를 담는 방식 (AI가 뽑아 쓰기 좋은 형태) */
  infoPatterns: string[];
  /** 반복 관찰된 실패 패턴 — 하지 말아야 할 것 */
  antiPatterns: string[];
  /** 종합 근거 */
  basedOnKeywords: number;
  updatedAt: string;
}

/** 지금까지 학습한 키워드별 인사이트 전부 (문체 프로파일·지식 자신은 제외) */
async function allInsights(): Promise<Array<{ keyword: string; data: CitationInsightData }>> {
  const rows = await prisma.citationInsight.findMany({ orderBy: { updatedAt: "desc" }, take: 100 });
  return rows
    .filter((row) => !isStyleKey(row.keywordText) && row.keywordText !== KNOWLEDGE_KEY)
    .map((row) => ({ keyword: row.keywordText, data: row.data as unknown as CitationInsightData }));
}

/**
 * 누적된 인사이트를 종합해 전역 지식을 갱신한다 (스케줄러가 인용 학습 직후 호출).
 * 인사이트가 3개 미만이면 일반화하지 않는다 — 표본이 적으면 우연을 법칙으로 착각한다.
 */
export async function rebuildKnowledge(): Promise<CitationKnowledge | null> {
  const insights = await allInsights();
  if (insights.length < 3) return null;

  const result = await callClaudeJson<{
    laws: string[];
    infoPatterns: string[];
    antiPatterns: string[];
  }>({
    operation: "citation-knowledge",
    maxTokens: 4000,
    system: [
      "당신은 검색·AI 인용 데이터를 분석하는 리서처입니다.",
      "여러 주제에서 각각 관찰된 '왜 이 글이 AI 브리핑에 인용됐는가' 분석 결과들을 받습니다.",
      "당신의 일은 **주제에 종속된 내용을 걷어내고, 주제를 가리지 않고 반복 관찰되는 법칙만** 추리는 것입니다.",
      "- 한 주제에서만 나온 특성은 법칙이 아니다. 2개 이상의 주제에서 반복돼야 법칙이다.",
      "- '좋은 글을 써라' 같은 공허한 말은 금지. 관찰에서 나온 **구체적이고 실행 가능한** 지시만 쓴다.",
      "- 근거가 약하면 항목 수를 줄여라. 억지로 채우지 마라 (없는 법칙을 지어내면 글 생성이 망가진다).",
      '출력은 JSON만: {"laws":["..."],"infoPatterns":["..."],"antiPatterns":["..."]}',
    ].join("\n"),
    user: JSON.stringify({
      task: "여러 주제의 인용 분석을 종합해 보편 법칙을 추출",
      observationCount: insights.length,
      observations: insights.slice(0, 30).map((row) => ({
        keyword: row.keyword,
        whyCited: row.data.whyCited,
        tone: row.data.tone,
        structure: row.data.structure,
        infoStyle: row.data.infoStyle,
      })),
    }),
  });

  const knowledge: CitationKnowledge = {
    laws: (result.laws ?? []).slice(0, 12),
    infoPatterns: (result.infoPatterns ?? []).slice(0, 10),
    antiPatterns: (result.antiPatterns ?? []).slice(0, 8),
    basedOnKeywords: insights.length,
    updatedAt: new Date().toISOString(),
  };

  await prisma.citationInsight.upsert({
    where: { keywordText: KNOWLEDGE_KEY },
    update: { data: knowledge as unknown as object, postsStudied: insights.length },
    create: {
      keywordText: KNOWLEDGE_KEY,
      data: knowledge as unknown as object,
      postsStudied: insights.length,
    },
  });

  return knowledge;
}

/** 글 생성 시 항상 주입되는 전역 지식 (없으면 null — 없는 걸 지어내지 않는다) */
export async function getKnowledge(): Promise<CitationKnowledge | null> {
  const row = await prisma.citationInsight.findUnique({ where: { keywordText: KNOWLEDGE_KEY } });
  return (row?.data as unknown as CitationKnowledge | undefined) ?? null;
}
