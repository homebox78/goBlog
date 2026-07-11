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
  policyRisks: string[];
}

/**
 * 애드센스·검색 정책 위험 문구 감지 (토큰 0, 규칙 기반).
 * 발견 시 품질 점수를 크게 감점하고 자동발행을 차단한다.
 * 근거: Google AdSense 프로그램 정책 / 검색 스팸 정책.
 */
const POLICY_RISK_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /광고를?\s*클릭|아래\s*광고|하단\s*광고|배너\s*클릭|클릭\s*(부탁|해\s*주세요|바랍니다)/, label: "광고 클릭 유도 문구" },
  { re: /100\s*%\s*(보장|성공|환급|승인|합격)|무조건\s*(승인|성공|합격|가능)|반드시\s*(성공|승인|합격|됩니다)/, label: "과장·보장성 문구" },
  { re: /(월\s*\d+\s*만\s*원|일\s*\d+\s*만\s*원).{0,12}(보장|확정|가능합니다)/, label: "수익 보장성 표현" },
  { re: /클릭\s*한\s*번으로|누구나\s*쉽게\s*수익|자동으로\s*돈이/, label: "비현실적 수익 유도" },
];

function detectPolicyRisks(text: string): string[] {
  const found = new Set<string>();
  for (const { re, label } of POLICY_RISK_PATTERNS) {
    if (re.test(text)) found.add(label);
  }
  return [...found];
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

  // SEO: 키워드가 소제목(H2)에 들어갔는지 — 키워드 토큰 중 하나라도 포함
  const kwTokens = input.keyword.toLowerCase().split(/\s+/).filter((token) => token.length >= 2);
  const h2Texts = (content.match(/^##\s+(.+)$/gm) ?? []).map((line) => line.toLowerCase());
  const keywordInSubhead = kwTokens.length > 0 && h2Texts.some((h) => kwTokens.some((token) => h.includes(token)));
  add("소제목(H2)에 키워드 포함 (SEO)", keywordInSubhead, 5);

  // SEO: 키워드가 본문 앞·뒤 절반에 고르게 분포 (도입부에만 몰리지 않도록)
  const half = Math.floor(normalizedPlain.length / 2);
  const inFirstHalf = normalizedPlain.slice(0, half).includes(keyword);
  const inSecondHalf = normalizedPlain.slice(half).includes(keyword);
  add("키워드 본문 전반 분포 (SEO)", inFirstHalf && inSecondHalf, 5);

  // 해시태그 20개 이상 (본문 끝) — 배너의 hex 색상(#e52528 등)은 제외하고 센다
  const hashtags = (content.match(/#[0-9A-Za-z가-힣_]{1,30}/g) ?? []).filter(
    (h) => !/^#[0-9a-fA-F]{3,8}$/.test(h),
  );
  add("해시태그 20개 이상 (본문 끝, SEO)", hashtags.length >= 20, 10, `${hashtags.length}개`);

  add("요약(excerpt) 작성", input.excerpt.length >= 30, 5);
  add("이미지 프롬프트 준비", input.imagePromptCount >= 1, 5);
  add(
    "확인 필요 주장 표시",
    true,
    5,
    input.claimsToVerify.length > 0 ? `${input.claimsToVerify.length}건 표시됨` : "없음",
  );

  // 정책 위험 검사 — 제목·메타·본문 전체 대상
  const policyRisks = detectPolicyRisks(
    `${input.title}\n${input.metaDescription}\n${input.contentMarkdown}`,
  );
  add(
    "애드센스·검색 정책 위험 문구 없음",
    policyRisks.length === 0,
    10,
    policyRisks.length > 0 ? policyRisks.join(", ") : undefined,
  );

  const maxTotal = items.reduce((sum, item) => sum + item.maxScore, 0);
  const total = items.reduce((sum, item) => sum + item.score, 0);
  // 정책 위험은 발견 항목당 20점 추가 감점 (자동발행 차단 유도)
  const penalty = policyRisks.length * 20;
  const score = Math.max(0, Math.round((total / maxTotal) * 100) - penalty);

  return { score, items, claimsToVerify: input.claimsToVerify, policyRisks };
}
