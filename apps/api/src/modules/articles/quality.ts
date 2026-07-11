/** 규칙 기반 콘텐츠 품질 검사 — 토큰 비용 없이 즉시 실행 */

export interface QualityCheckItem {
  label: string;
  ok: boolean;
  score: number;
  maxScore: number;
  note?: string;
}

export interface QualityReport {
  score: number;
  items: QualityCheckItem[];
  claimsToVerify: string[];
}

export function runQualityCheck(input: {
  keyword: string;
  title: string;
  metaDescription: string;
  excerpt: string;
  contentMarkdown: string;
  faqCount: number;
  faqRequested: boolean;
  imagePromptCount: number;
  claimsToVerify: string[];
}): QualityReport {
  const items: QualityCheckItem[] = [];
  const content = input.contentMarkdown;
  const plain = content.replace(/[#*`>\-|]/g, " ").replace(/\s+/g, " ");

  const add = (label: string, ok: boolean, maxScore: number, note?: string) => {
    items.push({ label, ok, score: ok ? maxScore : 0, maxScore, note });
  };

  add("제목 길이 (15~60자)", input.title.length >= 15 && input.title.length <= 60, 10, `${input.title.length}자`);
  add(
    "메타 설명 길이 (50~160자)",
    input.metaDescription.length >= 50 && input.metaDescription.length <= 160,
    10,
    `${input.metaDescription.length}자`,
  );
  add("본문 분량 (1,000자 이상)", plain.length >= 1000, 15, `${plain.length}자`);

  const h2Count = (content.match(/^##\s/gm) ?? []).length;
  add("H2 소제목 2개 이상", h2Count >= 2, 10, `${h2Count}개`);

  const hasStructure = /^###\s/m.test(content) || /^\s*[-*]\s/m.test(content) || /\|.*\|/.test(content);
  add("목록·표·H3 구조 사용", hasStructure, 10);

  add(
    "FAQ 구성",
    !input.faqRequested || input.faqCount >= 3,
    10,
    input.faqRequested ? `${input.faqCount}개` : "요청 안 함",
  );

  const keyword = input.keyword.replace(/\s+/g, "");
  const normalizedPlain = plain.replace(/\s+/g, "");
  const titleHasKeyword = input.title.replace(/\s+/g, "").includes(keyword);
  add("제목에 키워드 포함", titleHasKeyword, 5);

  const firstParagraph = plain.slice(0, 400).replace(/\s+/g, "");
  add("도입부에 키워드 포함", firstParagraph.includes(keyword), 5);

  const occurrences = normalizedPlain.split(keyword).length - 1;
  const density = normalizedPlain.length > 0 ? (occurrences * keyword.length) / normalizedPlain.length : 0;
  add(
    "키워드 반복 적정 (과도한 반복 금지)",
    occurrences >= 2 && density <= 0.05,
    10,
    `${occurrences}회`,
  );

  add("요약(excerpt) 작성", input.excerpt.length >= 30, 5);
  add("이미지 프롬프트 준비", input.imagePromptCount >= 1, 5);
  add(
    "확인 필요 주장 표시",
    true,
    5,
    input.claimsToVerify.length > 0 ? `${input.claimsToVerify.length}건 표시됨` : "없음",
  );

  const maxTotal = items.reduce((sum, item) => sum + item.maxScore, 0);
  const total = items.reduce((sum, item) => sum + item.score, 0);
  const score = Math.round((total / maxTotal) * 100);

  return { score, items, claimsToVerify: input.claimsToVerify };
}
