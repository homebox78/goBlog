import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "../../common/prisma.js";
import { HttpError } from "../../common/http.js";
import { getSettingValues } from "../settings/settings.service.js";
import { callClaudeJson } from "../ai/claude.js";
import { kstToday } from "../keywords/engine.js";
import { createCoupangDeeplink } from "../products/coupang.js";
import { mediaDir, mediaPublicUrl } from "../images/image-service.js";
import {
  buildArticleJsonLd,
  buildFaqJsonLd,
  buildProductJsonLd,
  type FaqEntry,
  type ProductReviewData,
} from "./jsonld.js";
import { runQualityCheck } from "./quality.js";
import { renderContentHtml } from "./render.js";
import { findSimilarArticle } from "./similarity.js";

export interface ProductInput {
  source: "COUPANG" | "BRANDCONNECT";
  name: string;
  brand?: string;
  price?: number;
  imageUrl?: string;
  productUrl: string;
  description?: string;
  isRocket?: boolean;
}

export interface GenerateOptions {
  keywordId?: number;
  articleType: string;
  language: string;
  schemaTypes: string[];
  length?: number;
  tone?: string;
  product?: ProductInput;
  /** 유사 글 검사 건너뛰기 (의도적 재작성 시) */
  allowSimilar?: boolean;
}

interface GeneratedContent {
  title: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  contentMarkdown: string;
  faq: FaqEntry[];
  tags: string[];
  productReview: ProductReviewData | null;
  imagePrompts: Array<{
    role: "FEATURED" | "CONTENT";
    prompt: string;
    altText: string;
    caption?: string;
    position?: number;
    characters?: string[];
  }>;
  claimsToVerify: string[];
  // 인스타그램 캐러셀용 — 3장 슬라이드 각 짧은 제목 + 캡션(요약본). 이미지는 블로그 3장을 그대로 사용.
  instagram?: {
    slides: Array<{ title: string; summary: string }>;
    caption: string;
  };
}

const VALID_CHARACTER_KEYS = ["girl", "boy", "man_20s", "woman_20s", "man_middle", "woman_middle"];

const LANGUAGE_NAME: Record<string, string> = {
  ko: "한국어",
  en: "영어(English)",
  "zh-CN": "중국어 간체(简体中文)",
  hi: "힌디어(हिन्दी)",
  es: "스페인어(Español)",
};

const ARTICLE_TYPE_GUIDE: Record<string, string> = {
  guide: "정보성 가이드 — 개념 설명과 단계별 실행 방법",
  news: "뉴스·이슈 해설 — 사실 요약과 배경, 영향 분석",
  comparison: "비교 콘텐츠 — 선택 기준과 항목별 비교표",
  "product-review": "상품 소개·리뷰 — 특징·장단점·적합한 사용자 (직접 사용 경험 창작 금지)",
  "how-to-apply": "신청·가입 방법 — 대상 조건, 준비물, 절차",
  pricing: "비용·가격 안내 — 가격 구성과 절약 방법 (확인 안 된 가격 단정 금지)",
  troubleshooting: "문제 해결 — 원인 진단과 해결 단계",
  faq: "FAQ 중심 — 자주 묻는 질문과 명확한 답변",
  checklist: "체크리스트 — 실행 전 확인 목록",
  "how-to": "사용 방법 — 단계별 튜토리얼",
};

/**
 * 대가성 표기 문구 — 플랫폼이 지정한 원문 그대로 사용해야 한다 (임의 변경 시 페널티).
 * 네이버 쇼핑 커넥트는 블로그 게시 시 "제목 앞 + 본문 최상단" 두 곳 표기가 규정 (제목 처리는 발행 단계).
 */
export function disclosureText(product: Pick<ProductInput, "source">): string {
  if (product.source === "COUPANG") {
    return "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";
  }
  return "이 포스팅은 네이버 쇼핑 커넥트 활동의 일환으로, 판매 발생 시 수수료를 제공받습니다.";
}

/**
 * 대가성(경제적 이해관계) 표기 박스 — 쿠팡 「경제적 이해관계 표시 가이드」/공정위 심사지침 준수.
 *  · 위치: 게시물 최상단(소비자가 클릭 없이 바로 인식)
 *  · 가시성: 흐린 회색·초소형 금지 → 13px, 진한 글자(#222), 본문과 구분되는 박스(배경·테두리)
 *  · 표현: 플랫폼 지정 원문 + "광고" 명시(추천·보증의 경제적 이해관계임을 분명히)
 */
export function disclosureHtml(product: Pick<ProductInput, "source">): string {
  return `<p style="font-size:15px;color:#222;background:#f5f6f8;border:1px solid #e2e5ea;border-radius:6px;padding:12px 14px;margin:0 0 18px;line-height:1.6;"><strong style="color:#c0392b;">[광고]</strong> ${disclosureText(product)}</p>`;
}

/** 본문에 이미 대가성 문구가 있는가 (중복 삽입 방지·백필 판별용) */
export function hasDisclosure(markdown: string): boolean {
  return /활동의 일환/.test(markdown);
}

/** 기존 대가성 고시 <p> 박스(옛 스타일 포함)를 제거하고 최신 박스를 최상단에 넣는다(디자인·문구 일괄 갱신용). */
export function upsertDisclosure(markdown: string, source: "COUPANG" | "BRANDCONNECT"): string {
  const stripped = markdown
    .replace(/<p\b[^>]*>(?:(?!<\/p>)[\s\S])*?활동의 일환(?:(?!<\/p>)[\s\S])*?<\/p>\s*/g, "")
    .replace(/^\s+/, "");
  return `${disclosureHtml({ source })}\n\n${stripped}`;
}

/** 네이버·쿠팡 CDN 이미지는 blogspot 등에서 hotlink가 막히므로 서버에 재호스팅한다. */
async function rehostProductImage(url: string, key: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const webp = await sharp(buffer).resize({ width: 600, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    const dir = mediaDir();
    await fs.mkdir(dir, { recursive: true });
    const name = `product-${key}.webp`;
    await fs.writeFile(path.join(dir, name), webp);
    return `${mediaPublicUrl()}/${name}`;
  } catch {
    return null;
  }
}

/**
 * 본문에 삽입할 상품 배너 HTML — [이미지][정보+CTA] 카드형.
 * Blogger 등은 <a> 안의 block 요소(div)를 제거하므로, div 컨테이너 + CTA만 링크로 구성한다.
 */
export function buildProductBanner(product: ProductInput, linkUrl: string, imageUrl: string | null): string {
  const isCoupang = product.source === "COUPANG";
  const accent = isCoupang ? "#e52528" : "#03c75a"; // 쿠팡 레드 / 네이버 그린
  const accentDark = isCoupang ? "#c41f22" : "#02b350";
  const tintBg = isCoupang ? "#fff4f4" : "#f2fdf6";
  const shadowRgba = isCoupang ? "229,37,40" : "3,199,90";
  const ctaText = isCoupang ? "쿠팡에서 최저가 확인하기" : "네이버에서 상품 보기";

  // 에디터 호환 배너 — 링크가 살아남게 '분리형'으로 구성한다.
  // 네이버 SmartEditor는 이미지+텍스트를 통째로 감싼 <a>를 제거해 링크가 사라진다.
  // → 카드 전체 링크(단일 <a>) 대신, 이미지 링크 + CTA 텍스트 링크(단순 <a>)를 각각 둔다.
  //   단순 텍스트 링크는 SmartEditor·Blogger·티스토리 모두에서 보존된다.
  void accentDark;
  void shadowRgba;
  const rel = 'target="_blank" rel="sponsored nofollow noopener"';
  const price = product.price
    ? `<span style="display:block;margin:0 0 12px;font-size:22px;font-weight:800;color:${accent};line-height:1.2;">${new Intl.NumberFormat("ko-KR").format(product.price)}원${product.isRocket ? ' <span style="font-size:12px;font-weight:700;color:#2c7fff;">🚀 로켓배송</span>' : ""}</span>`
    : "";

  const image = imageUrl
    ? `<a href="${linkUrl}" ${rel}><img src="${imageUrl}" alt="${escapeHtml(product.name)}" style="width:180px;height:180px;object-fit:contain;background:#ffffff;border:1px solid #f0f0f0;border-radius:12px;display:inline-block;" /></a>`
    : "";

  return [
    `<div style="text-align:center;border:2px solid ${accent};border-radius:14px;padding:20px 18px;margin:22px auto;max-width:440px;background:${tintBg};">`,
    '<span style="display:block;text-align:right;font-size:11px;color:#c4c4c4;margin-bottom:4px;">광고</span>',
    image,
    `<span style="display:block;margin:14px 0 8px;font-weight:700;font-size:18px;line-height:1.45;color:#1a1a1a;">${escapeHtml(product.name)}</span>`,
    price,
    // CTA 버튼 — 티스토리·블로거·워드프레스에서 클릭 링크로 작동.
    `<a href="${linkUrl}" ${rel} style="display:inline-block;background:${accent};color:#ffffff;padding:13px 28px;border-radius:10px;font-size:16px;font-weight:800;text-decoration:none;">${ctaText} →</a>`,
    // 구매 URL을 '보이는 텍스트'로도 넣는다 — 네이버 SmartEditor는 붙여넣기 <a>를 모두 제거하지만
    // 텍스트 URL은 자동 링크화하므로, 이 줄 덕분에 네이버에서도 수수료 추적 링크가 살아난다.
    `<span style="display:block;margin-top:10px;font-size:13px;color:#555;word-break:break-all;">👉 구매하기 ${linkUrl}</span>`,
    "</div>",
  ].join("");
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 키워드 또는 상품으로 글을 생성해 Article + 버전 + 스키마 + 이미지 프롬프트를 저장한다. */
export async function generateArticle(
  options: GenerateOptions,
): Promise<{ articleId: number; qualityScore: number }> {
  const keyword = options.keywordId
    ? await prisma.keyword.findUnique({
        where: { id: options.keywordId },
        include: {
          recommendations: { orderBy: { date: "desc" }, take: 1 },
          metrics: { orderBy: { date: "desc" }, take: 4 },
        },
      })
    : null;

  if (!keyword && !options.product) {
    throw new HttpError(400, "키워드 또는 상품 정보가 필요합니다.");
  }

  const product = options.product ?? null;
  const topic = keyword?.text ?? product!.name;

  // 중복·유사 글 방지 — 같은 블로그에 비슷한 글이 쌓이면 검색 품질이 떨어진다
  if (!options.allowSimilar) {
    const similar = await findSimilarArticle(topic);
    if (similar) {
      throw new HttpError(
        409,
        `유사한 글이 이미 있습니다 (${Math.round(similar.similarity * 100)}% 유사): "${similar.title}" — 기존 글을 보강하거나 다른 키워드를 선택하세요.`,
      );
    }
  }

  const settings = await getSettingValues(["anthropic.defaultLength"]);
  const length = options.length ?? Number(settings["anthropic.defaultLength"] ?? 2000) ?? 2000;

  // 실시간 그라운딩 — 생성 시점의 최신 뉴스를 주입해 학습 데이터의 옛 사실(상장·출시·발표 등) 오류를 막는다.
  const { fetchRecentNews } = await import("./grounding.js");
  const recentNews = await fetchRecentNews(topic).catch(() => []);
  // 문체는 사용자가 고르지 않고 AI가 글 성격에 맞게 판단한다 (options.tone이 있으면만 힌트로 사용)
  const tone = options.tone;
  const language = LANGUAGE_NAME[options.language] ? options.language : "ko";

  const wantsFaq = options.schemaTypes.includes("FAQPage") || options.articleType === "faq";
  const wantsProduct =
    Boolean(product) ||
    options.schemaTypes.includes("Product") ||
    options.articleType === "product-review";
  const mainSchema =
    options.schemaTypes.find((type) => ["Article", "NewsArticle", "BlogPosting"].includes(type)) ??
    (options.articleType === "news" ? "NewsArticle" : "BlogPosting");

  const recommendation = keyword?.recommendations[0];
  const naverMetric = keyword?.metrics.find((metric) => metric.source === "NAVER_SEARCHAD");

  // 현재 날짜(KST) — AI가 지난 연도를 '최신/올해'로 쓰는 것을 막는다.
  const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
  const curYear = kstNow.getUTCFullYear();
  const curMonth = kstNow.getUTCMonth() + 1;
  const curDay = kstNow.getUTCDate();

  const claudeSystem = [
      "당신은 검색 유입과 조회수를 폭발적으로 끌어올리는 수익형 블로그 전문 에디터다. 이 글의 최우선 목표는 '검색 노출 극대화 + 클릭 + 끝까지 읽게 만들기'다.",
      `본문 언어: ${LANGUAGE_NAME[language]}.`,
      "",
      "[현재 날짜 — 반드시 준수]",
      `- 오늘은 ${curYear}년 ${curMonth}월 ${curDay}일(한국 시간)이다. 모든 시점 표현('최신·올해·현재·작년·요즘·${curYear}년')은 이 날짜를 기준으로 한다.`,
      `- 제목·본문에 연도를 넣을 때는 반드시 현재 연도(${curYear})를 쓴다. 지난 연도(${curYear - 1}년 등)를 '최신'·'올해'인 것처럼 절대 쓰지 않는다.`,
      `- 사건·사고·이슈의 발생 시점을 모르면 특정 연도를 지어내지 말고 시점 표현을 생략한다(추측 금지).`,
      "",
      "[⚠️ 최신 사실 — 학습 데이터보다 우선. 반드시 준수]",
      "- 아래 userPayload의 recentNews(최신 뉴스)는 '지금 시점'의 사실이다. 네 학습 데이터의 옛 정보와 충돌하면 무조건 recentNews를 따른다.",
      "- 상장·출시·발표·인수·수치·순위처럼 시점에 민감한 사실은 recentNews에 근거해서만 단정한다. recentNews에 근거가 없으면 '아직 확정되지 않았다'는 식으로 단정하지 말고, '최신 상황은 공식 발표를 확인'처럼 열어둔다.",
      "- 특히 '~는 아직 안 했다 / 미정 / 예정'처럼 부정·미확정으로 단정하는 것은 매우 위험하다(이미 일어난 일을 안 일어난 것처럼 쓰는 오류). recentNews에 반대 사실이 있으면 절대 그렇게 쓰지 않는다.",
      recentNews.length === 0
        ? "- (이번엔 최신 뉴스가 없다) 그러므로 시점 민감 사실을 새로 단정하지 말고, 변하지 않는 정보 위주로 쓰고 최신 사항은 '공식 발표·최신 뉴스 확인'으로 안내한다."
        : "",
      "",
      "[조회수 극대화 — 최우선]",
      "- 제목: 핵심 키워드를 앞쪽에 자연스럽게 넣고, 구체적 숫자·연도·대상·결과를 담아 클릭하고 싶게 만든다. 단 과장·허위 낚시는 금지(정책 위반).",
      "- 검색 의도를 100% 충족한다: 검색자가 정확히 원하는 답을 빠짐없이, 경쟁 글보다 더 완결적으로 담아 이탈을 막는다.",
      "- 도입부 첫 문장에서 바로 관심을 붙잡고, 스크롤을 멈추지 않게 문단마다 다음을 읽을 이유를 만든다.",
      "- 사람들이 함께 검색하는 연관 질문·롱테일 표현을 본문·소제목·FAQ에 자연스럽게 녹여 검색 노출 범위를 넓힌다.",
      "- '저장/스크랩하고 싶다'는 느낌이 들도록 표·체크리스트·핵심 요약을 배치한다.",
      "",
      "[검색엔진 최적화(SEO) — 네이버·구글·다음 색인·상위노출 강화. 반드시 준수]",
      `- 핵심 키워드는 '${topic}'다. 이 키워드(또는 자연스러운 변형)를 ① 제목 앞부분, ② 도입부 첫 문장, ③ H2 소제목 최소 1곳, ④ 마무리, ⑤ metaDescription 앞부분에 반드시 배치한다.`,
      "- 제목은 공백 포함 32자 내외로 맞춘다(네이버 검색결과 제목 잘림 방지). 핵심 키워드를 앞에 둔다.",
      "- 본문 전체에서 핵심 키워드를 자연스럽게 3~6회 노출한다. 단 어색한 반복(키워드 스터핑)은 검색 페널티이므로 금지 — 동의어·연관어(LSI)로 분산한다.",
      "- 사람들이 함께 검색하는 '연관 검색어·롱테일 질문'을 H2/H3 소제목과 FAQ로 흡수해 색인 키워드 범위를 넓힌다.",
      "- 도입부 첫 100자 안에서 검색 질문에 대한 핵심 답을 먼저 제시한다(검색 스니펫·체류시간 유리).",
      "- 각 이미지의 altText에는 핵심 키워드나 연관어를 자연스럽게 포함한다(이미지 검색 유입).",
      "- H1은 제목 하나뿐이라고 가정하고, 본문 구조는 H2>H3 위계를 지킨다(제목 건너뛰기 금지).",
      "- 표·번호목록·불릿을 적극 사용해 구조화한다(구글 리치결과·발췌 노출에 유리).",
      "- metaDescription은 150자 내외로, 핵심 키워드를 앞부분에 넣고 클릭을 부르는 요약으로 쓴다.",
      "- 본문은 목표 분량 이상으로 충분히 채워 정보량·체류시간을 확보한다(얇은 콘텐츠는 색인·순위에 불리).",
      "",
      "[문체 — AI가 글 성격에 맞게 스스로 판단]",
      "- 문체를 고정하지 말고 글의 주제·독자·목적에 맞춰 가장 자연스러운 톤을 스스로 고른다 (정보성은 차분한 설명체, 생활/후기성은 친근한 대화체 등).",
      tone ? `- 참고 톤 힌트: ${tone} (절대적 규칙 아님, 글에 안 맞으면 무시).` : "",
      "",
      "[사람이 쓴 것처럼 — AI 티 최소화]",
      "- 획일적인 AI 문투를 피한다: 문장 길이를 다양하게 섞고(짧은 문장·긴 문장 교차), 기계적인 나열·과도한 접속사를 줄인다.",
      "- '결론적으로', '종합적으로', '~하는 것이 중요합니다', '~라고 할 수 있습니다' 같은 상투적·형식적 표현을 남발하지 않는다.",
      "- 각 소제목·문단을 똑같은 틀(정의→예시→정리)로 찍어내지 말고 흐름을 자연스럽게 변주한다.",
      "- 실제 사람이 조언하듯 구체적이고 솔직하게 쓴다 (단, 없는 개인 경험·후기는 지어내지 않는다).",
      "- 불필요한 요약 반복, 뻔한 마무리 인사('오늘은 ~에 대해 알아봤습니다')를 피한다.",
      "- 문단 끝이나 소제목 옆에 어울리는 이모지(😊 🥲 😋 😙 👍 ✨ 💡 ☺️ 등)를 자연스럽게 군데군데 넣어 블로그처럼 친근하고 생기 있게 만든다. 단 과하지 않게 — 한 문단에 1개 정도, 딱딱한 정보·수치 문장에는 넣지 않는다.",
      "",
      "[독자를 사로잡는 글쓰기]",
      "- 첫 2~3문장에서 독자의 고민·상황에 공감하며 후킹하고, 이 글을 끝까지 읽으면 무엇을 얻는지 자연스럽게 제시한다.",
      "- 소제목(H2)은 독자의 궁금증을 자극하는 형태로 쓴다.",
      "- 핵심 결론·수치·판단 포인트는 **볼드**로 강조하되 과하지 않게.",
      "- 비교표, 체크리스트, 단계별 정리를 적절히 활용한다.",
      "- 실제 선택·구매·실행에 바로 도움이 되는 구체적인 기준과 팁을 담는다 (막연한 일반론 금지).",
      "",
      "[검색 유입·전환을 높이는 실행 정보 — 이 부분이 '돈이 되는 글'의 핵심]",
      "- 독자가 이 글 하나만 읽고도 실제로 행동할 수 있을 만큼 완결적으로 쓴다.",
      "- 주제에 맞는 실행 정보를 구체적으로 담는다: 신청 방법·자격 조건·준비 서류·조회 방법·계산 방법·비용·비교·예약/해지/변경 방법 등 (해당되는 것).",
      "- 단계(1·2·3)·조건·기준·수치를 명확히 제시한다. 막연한 일반론('잘 알아보세요' 같은)은 쓰지 않는다.",
      "- '어떤 사람에게/어떤 상황에 맞는지', '자주 하는 실수', '놓치기 쉬운 포인트'를 넣어 실용성을 높인다.",
      "",
      "[신뢰·정책 — 애드센스/검색 정책 준수]",
      "- 첫 문단에서 검색자의 핵심 질문에 바로 답한다.",
      "- H2(##)·H3(###) 구조를 지킨다.",
      "- 이미지는 정확히 3장. 본문 흐름에 맞는 3곳에 [IMAGE:1] [IMAGE:2] [IMAGE:3] 마커를 넣고, imagePrompts도 position 1·2·3으로 정확히 3개만 만든다. 첫 번째 이미지가 대표(썸네일)가 된다.",
      "[인스타그램 캐러셀]",
      "- instagram 필드를 반드시 채운다. 블로그 이미지 3장을 그대로 캐러셀 3장으로 쓰므로, 각 슬라이드(1·2·3)에 어울리는 '짧은 제목'(공백 포함 18자 이내, 후킹되게)과 한 줄 요약을 만든다.",
      "- instagram.caption은 인스타그램 게시물 캡션용 요약본(300~500자, 이모지 자연스럽게, 첫 줄에 후킹 문장). 블로그 전문을 복붙하지 말고 핵심만 재구성한다. 광고 클릭 유도·과장 금지.",
      "- 인스타 해시태그는 별도로 만들지 말고 tags를 그대로 재사용한다(캡션 하단에 붙는다).",
      "- 확인할 수 없는 통계·가격·법률·의료·금융 정보는 단정하지 않고 claimsToVerify에 표시한다. 공식 확인이 필요한 부분은 본문에서 '최신 기준은 공식 사이트에서 확인' 식으로 안내한다.",
      "- 존재하지 않는 URL·출처·개인 경험담·허위 후기·가상의 전문가 인용을 만들지 않는다.",
      "- 존재하지 않는 혜택·신청 기능·다운로드를 있는 것처럼 쓰지 않는다.",
      "- '광고를 클릭', '아래 광고' 같은 광고 클릭 유도 문구, '100% 보장·무조건 성공' 같은 과장·보장성 표현을 절대 쓰지 않는다.",
      "- 마무리(CTA)는 광고가 아니라 실제 관련 정보/공식 페이지로 안내하며, 과장 없이 다음 행동을 권한다.",
      "- 키워드를 부자연스럽게 반복하지 않는다.",
      product
        ? "- 홍보 글이지만 과장·허위 없이 특징·장점과 함께 '어떤 사람에게 잘 맞는지'를 짚어 설득력을 높인다. '직접 써보니' 같은 허위 경험담은 금지."
        : "",
      product
        ? "- '왜 지금 이 상품을 고려할 만한지'를 독자 상황과 연결해 자연스럽게 설득한다 (강매·과장 금지)."
        : "",
      product
        ? "- 본문에서 상품 구매 링크 배너가 들어갈 위치에 [PRODUCT_BANNER] 마커를 정확히 2번 넣는다 (도입부 다음 1번, 결론 직전 1번)."
        : "",
      "",
      "본문 목표 분량을 충분히 채우되 물타기 없이 밀도 있게 쓴다. 반드시 JSON만 출력한다.",
    ]
      .filter(Boolean)
      .join("\n");

  const userPayload = (revision?: { prev: GeneratedContent; issues: string[] }) =>
    JSON.stringify({
      task: product ? "제휴 상품 홍보 글 생성" : "SEO 블로그 글 생성",
      topic,
      // 실시간 그라운딩 — 학습 데이터보다 이 최신 뉴스를 우선해 시점 민감 사실을 판단
      recentNews: recentNews.length > 0 ? recentNews : "최신 뉴스 없음(시점 민감 사실 단정 금지)",
      keywordContext: keyword
        ? {
            category: keyword.category,
            searchIntent: keyword.searchIntent,
            recommendReason: recommendation?.reason,
            naverMonthlySearches: naverMetric?.avgMonthlySearches ?? null,
          }
        : null,
      product: product
        ? {
            source: product.source === "COUPANG" ? "쿠팡" : "네이버 브랜드커넥트",
            name: product.name,
            brand: product.brand,
            price: product.price,
            description: product.description,
            rocketDelivery: product.isRocket,
          }
        : null,
      articleType: options.articleType,
      articleTypeGuide: ARTICLE_TYPE_GUIDE[options.articleType] ?? options.articleType,
      language: LANGUAGE_NAME[language],
      targetLengthChars: length,
      tone,
      includeFaq: wantsFaq,
      imagePromptCount: 4,
      outputFormat: {
        title: "SEO 제목 (한 개)",
        slug: "english-url-slug",
        metaTitle: "검색 결과 제목 (60자 이내)",
        metaDescription: "검색 결과 설명 (80~155자)",
        excerpt: "글 요약 2~3문장",
        contentMarkdown: "마크다운 본문 (H2/H3, 표/목록, 이미지 자리 [IMAGE:n], 상품 배너 자리 [PRODUCT_BANNER])",
        faq: [{ question: "질문", answer: "답변" }],
        tags: ["SEO 태그 20~30개 — 핵심 키워드·연관 검색어·롱테일·카테고리 (해시(#) 없이, 각 1~4단어, 본문 끝 해시태그로 사용됨)"],
        productReview: wantsProduct
          ? { name: "상품명", brand: "브랜드", description: "객관적 설명", pros: ["장점"], cons: ["단점"], actuallyUsed: false }
          : null,
        imagePrompts: [
          {
            prompt: "이미지 생성 프롬프트 (영어). 밝고 긍정적인 분위기, 등장인물은 한국인만(외국인 금지). 이미지 속 글자·로고·브랜드 없이. 특정 제품 클로즈업 대신 장면/분위기. 사람이 등장하는 장면이면 아래 characters에 등장 인물을 지정",
            altText: "한국어 대체 텍스트",
            caption: "캡션",
            position: "본문 [IMAGE:n]의 n (정확히 1, 2, 3 세 장)",
            characters: "등장 인물 키 배열 (사람 없으면 빈 배열). 가능한 값: girl(여자아이), boy(남자아이), man_20s(20대남), woman_20s(20대여), man_middle(중년남), woman_middle(중년여)",
          },
        ],
        claimsToVerify: ["발행 전 확인이 필요한 주장·수치"],
        instagram: {
          slides: [
            { title: "슬라이드1 짧은 제목(18자 이내)", summary: "슬라이드1 한 줄 요약" },
            { title: "슬라이드2 짧은 제목", summary: "슬라이드2 한 줄 요약" },
            { title: "슬라이드3 짧은 제목", summary: "슬라이드3 한 줄 요약" },
          ],
          caption: "인스타그램 캡션 요약본 (300~500자, 이모지, 첫 줄 후킹)",
        },
      },
      ...(revision
        ? {
            previousDraft: {
              title: revision.prev.title,
              metaDescription: revision.prev.metaDescription,
              excerpt: revision.prev.excerpt,
              contentMarkdown: revision.prev.contentMarkdown,
            },
            qualityIssues: revision.issues,
            revisionInstruction:
              "이 previousDraft가 품질 기준(85점)에 미달했습니다. qualityIssues의 각 항목을 반드시 해결해 더 완성도 높은 새 버전을 작성하세요. 본문 분량·H2/H3 구조·표/목록·FAQ·제목/메타 길이를 보완하되, 자연스러운 문체·이모지·사람이 쓴 느낌은 유지하세요.",
          }
        : {}),
    });

  const claudeOp = product ? "promo-article-generate" : "article-generate";
  let generated = await callClaudeJson<GeneratedContent>({
    operation: claudeOp,
    maxTokens: 32000,
    system: claudeSystem,
    user: userPayload(),
  });

  const checkDraft = (g: GeneratedContent) =>
    runQualityCheck({
      keyword: topic,
      title: g.title || "",
      metaDescription: g.metaDescription || "",
      excerpt: g.excerpt || "",
      contentMarkdown: g.contentMarkdown || "",
      faqCount: (g.faq ?? []).filter((entry) => entry.question && entry.answer).length,
      faqRequested: wantsFaq,
      imagePromptCount: (g.imagePrompts ?? []).length,
      claimsToVerify: g.claimsToVerify ?? [],
    });

  // 품질 85점 미만이면 미달 항목을 알려주고 자동 개선한다 (최대 2회 재시도)
  let draftQuality = checkDraft(generated);
  for (let attempt = 1; attempt <= 2 && draftQuality.score < 85; attempt += 1) {
    const issues = draftQuality.items
      .filter((item) => !item.ok)
      .map((item) => item.label + (item.note ? ` — ${item.note}` : ""));
    if (draftQuality.policyRisks.length > 0) {
      issues.push("정책 위험 문구 제거: " + draftQuality.policyRisks.join(", "));
    }
    try {
      const revised = await callClaudeJson<GeneratedContent>({
        operation: `${claudeOp}-revise`,
        maxTokens: 32000,
        system: claudeSystem,
        user: userPayload({ prev: generated, issues }),
      });
      if (revised.title && revised.contentMarkdown) {
        generated = revised;
        draftQuality = checkDraft(generated);
      } else {
        break;
      }
    } catch {
      break;
    }
  }

  if (!generated.title || !generated.contentMarkdown) {
    throw new HttpError(502, "글 생성 결과가 올바르지 않습니다.");
  }

  let contentMarkdown = generated.contentMarkdown;
  let bannerImageUrl: string | null = null; // 상품 홍보 글의 대표 이미지로도 사용

  // 상품 배너·딥링크·대가성 문구 삽입
  if (product) {
    let linkUrl = product.productUrl;
    if (product.source === "COUPANG" && /coupang\.com/i.test(linkUrl)) {
      try {
        linkUrl = await createCoupangDeeplink(linkUrl);
      } catch {
        // 딥링크 실패 시 원본 URL 사용
      }
    }
    // 상품 이미지를 서버에 재호스팅 (네이버·쿠팡 CDN hotlink 차단 회피)
    bannerImageUrl = product.imageUrl
      ? await rehostProductImage(product.imageUrl, `p${keyword?.id ?? "x"}-${Date.now()}`)
      : null;
    const banner = buildProductBanner(product, linkUrl, bannerImageUrl);

    if (contentMarkdown.includes("[PRODUCT_BANNER]")) {
      contentMarkdown = contentMarkdown.replaceAll("[PRODUCT_BANNER]", banner);
    } else {
      // 마커가 없으면 첫 H2 앞과 본문 끝에 삽입
      const firstH2 = contentMarkdown.search(/^##\s/m);
      contentMarkdown =
        firstH2 > -1
          ? contentMarkdown.slice(0, firstH2) + banner + "\n\n" + contentMarkdown.slice(firstH2)
          : contentMarkdown + "\n\n" + banner;
      contentMarkdown += "\n\n" + banner;
    }

    // 대가성(경제적 이해관계) 표기 — 글 최상단, 쿠팡 표시 가이드 준수 박스.
    contentMarkdown = `${disclosureHtml(product)}\n\n${contentMarkdown}`;
  }

  // 삽입된 광고(상품) 요약 — 글 목록에서 어떤 광고가 들어갔는지 표시용
  const adSource = product ? product.source : null;
  const adProduct = product ? product.name : null;

  // SEO 태그 = 본문 최하단 해시태그 20~30개 (검색·발견성). 중복 제거 후 붙인다.
  const tags = [
    ...new Set(
      (generated.tags ?? [])
        .map((tag) => tag.replace(/^#/, "").trim())
        .filter((tag) => tag.length > 0 && tag.length <= 30),
    ),
  ].slice(0, 30);
  if (tags.length > 0) {
    contentMarkdown += `\n\n${tags.map((tag) => `#${tag.replace(/\s+/g, "")}`).join(" ")}`;
  }

  const faq = wantsFaq ? (generated.faq ?? []).filter((entry) => entry.question && entry.answer) : [];
  const imagePrompts = (generated.imagePrompts ?? []).filter((prompt) => prompt.prompt);
  const claims = generated.claimsToVerify ?? [];

  // 인스타그램 캐러셀 데이터 — 슬라이드 3개 제목 + 캡션 + 해시태그(tags 재사용). 상품 글이면 대가성 문구도 캡션 상단에 붙인다.
  const igSlides = (generated.instagram?.slides ?? [])
    .filter((s) => s?.title)
    .slice(0, 3)
    .map((s, i) => ({ position: i + 1, title: String(s.title).trim(), summary: String(s.summary ?? "").trim() }));
  const igHashtags = tags.map((t) => `#${t.replace(/\s+/g, "")}`);
  let igCaption = (generated.instagram?.caption ?? generated.excerpt ?? "").trim();
  if (product) igCaption = `${disclosureText(product)}\n\n${igCaption}`;
  const instagram =
    igSlides.length > 0 || igCaption
      ? { slides: igSlides, caption: igCaption, hashtags: igHashtags }
      : null;

  const quality = runQualityCheck({
    keyword: topic,
    title: generated.title,
    metaDescription: generated.metaDescription ?? "",
    excerpt: generated.excerpt ?? "",
    contentMarkdown,
    faqCount: faq.length,
    faqRequested: wantsFaq,
    imagePromptCount: imagePrompts.length,
    claimsToVerify: claims,
  });

  // 품질 82점 이하는 폐기 (저장하지 않음)
  if (quality.score <= 82) {
    throw new HttpError(422, `품질 ${quality.score}점(82점 이하)으로 폐기되었습니다. 다시 생성하거나 키워드를 바꿔주세요.`);
  }

  const contentHtml = await renderContentHtml(contentMarkdown);

  const article = await prisma.article.create({
    data: {
      keywordId: keyword?.id ?? null,
      title: generated.title,
      slug: generated.slug || null,
      language,
      articleType: options.articleType,
      status: "REVIEW",
      metaTitle: generated.metaTitle || generated.title,
      metaDescription: generated.metaDescription || null,
      excerpt: generated.excerpt || null,
      contentMarkdown,
      contentHtml,
      qualityScore: quality.score,
      qualityReport: JSON.parse(JSON.stringify(quality)),
      adSource,
      adProduct,
      instagram: instagram ? JSON.parse(JSON.stringify(instagram)) : undefined,
      versions: {
        create: {
          version: 1,
          title: generated.title,
          contentMarkdown,
          contentHtml,
          changeNote: "최초 생성",
        },
      },
      // 이미지는 정확히 3장, 모두 본문(CONTENT)에 삽입. 첫 번째(position 1)가 대표(썸네일)로 쓰인다.
      media: {
        create: imagePrompts.slice(0, 3).map((prompt, index) => {
          const characters = (prompt.characters ?? [])
            .filter((key) => VALID_CHARACTER_KEYS.includes(key))
            .join(",");
          return {
            kind: "CONTENT",
            prompt: prompt.prompt,
            altText: prompt.altText || null,
            caption: prompt.caption || null,
            position: index + 1,
            characterKeys: characters || null,
          };
        }),
      },
    },
  });

  const schemaRows: Array<{ schemaType: string; jsonLd: object; isEnabled: boolean }> = [
    {
      schemaType: mainSchema,
      jsonLd: buildArticleJsonLd({
        schemaType: mainSchema,
        headline: generated.title,
        description: generated.metaDescription || generated.excerpt || "",
        keywords: [topic, ...tags],
        inLanguage: language,
      }),
      isEnabled: true,
    },
  ];
  if (faq.length > 0) {
    schemaRows.push({ schemaType: "FAQPage", jsonLd: buildFaqJsonLd(faq), isEnabled: true });
  }
  const productData = generated.productReview?.name
    ? generated.productReview
    : product
      ? { name: product.name, brand: product.brand, description: product.description, url: product.productUrl, actuallyUsed: false }
      : null;
  if (wantsProduct && productData?.name) {
    schemaRows.push({
      schemaType: "Product",
      jsonLd: buildProductJsonLd({ ...productData, actuallyUsed: false }),
      isEnabled: false, // 실사용 검토 전 비활성
    });
  }
  for (const row of schemaRows) {
    await prisma.articleSchema.create({
      data: {
        articleId: article.id,
        schemaType: row.schemaType,
        jsonLd: JSON.parse(JSON.stringify(row.jsonLd)),
        isEnabled: row.isEnabled,
      },
    });
  }

  // SEO 태그 저장 (Blogger 라벨·인스타 해시태그·네이버/티스토리 태그로 사용) — 위에서 계산한 tags 재사용
  for (const name of tags) {
    try {
      const tag = await prisma.tag.upsert({
        where: { name },
        update: {},
        create: { name, slug: name.toLowerCase().replace(/\s+/g, "-") },
      });
      await prisma.articleTag.create({ data: { articleId: article.id, tagId: tag.id } }).catch(() => undefined);
    } catch {
      // 태그 저장 실패는 무시
    }
  }

  if (keyword) {
    await prisma.keyword.update({ where: { id: keyword.id }, data: { status: "USED" } });
  }

  return { articleId: article.id, qualityScore: quality.score };
}

export { kstToday };

/**
 * 붙여넣은 상품 링크/배너 HTML(쿠팡 [이미지+텍스트] 태그 등)로 스타일 배너 HTML을 만든다.
 * 사용자가 글 상세에서 원하는 위치에 직접 삽입할 때 사용. 쿠팡은 딥링크·이미지 재호스팅 적용.
 */
export async function buildManualBanner(input: string): Promise<{ banner: string; disclosure: string }> {
  const trimmed = input.trim();
  // 배너 HTML(<a>…<img>…</a>)을 붙여넣으면 링크·이미지·상품명을 추출해 '내 카드 포맷'으로 변환한다.
  // (쿠팡 기본 배너는 120px로 작고 밋밋해 클릭률이 낮다 — 트래킹 링크는 그대로 유지)
  if (/<a\s/i.test(trimmed) && /<img\s/i.test(trimmed)) {
    const source = /coupang/i.test(trimmed) ? ("COUPANG" as const) : ("BRANDCONNECT" as const);
    const linkUrl = trimmed.match(/<a[^>]+href=["']([^"']+)["']/i)?.[1];
    const imgUrl = trimmed.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? null;
    const name = trimmed.match(/<img[^>]+alt=["']([^"']+)["']/i)?.[1]?.trim() || "추천 상품";
    if (linkUrl) {
      // 쿠팡 CDN 배너 이미지는 hotlink가 막힐 수 있어 서버에 재호스팅
      const rehosted = imgUrl ? await rehostProductImage(imgUrl, `manual-${Date.now()}`) : null;
      const banner = buildProductBanner(
        { source, name, productUrl: linkUrl },
        linkUrl,
        rehosted ?? imgUrl,
      );
      return { banner, disclosure: disclosureHtml({ source }) };
    }
    // 링크를 못 찾으면(비정상 HTML) 원본 그대로 삽입
    return {
      banner: `<p style="text-align:center;margin:20px 0;">${trimmed}</p>`,
      disclosure: disclosureHtml({ source }),
    };
  }

  // 링크 URL만 붙여넣은 경우엔 카드형 배너를 생성한다.
  const { analyzeProductInput } = await import("../products/analyze.js");
  const product = await analyzeProductInput(trimmed);
  let linkUrl = product.productUrl;
  if (product.source === "COUPANG" && /coupang\.com/i.test(linkUrl)) {
    try {
      linkUrl = await createCoupangDeeplink(linkUrl);
    } catch {
      // 딥링크 실패 시 원본 링크 사용
    }
  }
  const bannerImageUrl = product.imageUrl
    ? await rehostProductImage(product.imageUrl, `manual-${Date.now()}`)
    : null;
  const banner = buildProductBanner(
    {
      source: product.source,
      name: product.name,
      price: product.price ?? undefined,
      imageUrl: product.imageUrl ?? undefined,
      productUrl: linkUrl,
      description: product.description ?? undefined,
    },
    linkUrl,
    bannerImageUrl,
  );
  return { banner, disclosure: disclosureHtml({ source: product.source }) };
}

/**
 * 기존 글을 품질 기준(85점)에 맞게 보강한다 (수동 '보정' 버튼).
 * 본문의 삽입 블록(상품 배너·대가성 문구·이미지·해시태그)은 보존하고, 품질검사 미달 항목만 보완한다.
 */
export async function improveArticle(
  articleId: number,
): Promise<{ before: number; after: number; passed: boolean }> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { keyword: true, tags: { include: { tag: true } } },
  });
  if (!article) throw new HttpError(404, "글을 찾을 수 없습니다.");
  const topic = article.keyword?.text ?? article.title;

  const faqCount = (article.contentMarkdown?.match(/^###?\s*Q[.:) ]/gm) ?? []).length;
  const runCheck = (title: string, meta: string, excerpt: string, markdown: string) =>
    runQualityCheck({
      keyword: topic,
      title,
      metaDescription: meta,
      excerpt,
      contentMarkdown: markdown,
      faqCount,
      faqRequested: false,
      imagePromptCount: 1,
      claimsToVerify: [],
    });

  let title = article.title;
  let meta = article.metaDescription ?? "";
  let excerpt = article.excerpt ?? "";
  let markdown = article.contentMarkdown ?? "";
  let quality = runCheck(title, meta, excerpt, markdown);
  const before = article.qualityScore ?? quality.score;

  // ── 결정적(무료) 선(先)보정 — Claude 호출 전에 규칙만으로 고칠 수 있는 항목부터 처리해 비용 절감 ──
  const countHashtags = (md: string) =>
    (md.match(/#[0-9A-Za-z가-힣_]{1,30}/g) ?? []).filter((h) => !/^#[0-9a-fA-F]{3,8}$/.test(h)).length;
  // ① 해시태그 20개 미만 → 저장된 태그로 본문 끝에 보충 (Claude 불필요)
  if (countHashtags(markdown) < 20 && article.tags.length > 0) {
    const existing = new Set((markdown.match(/#[0-9A-Za-z가-힣_]{1,30}/g) ?? []).map((h) => h.slice(1)));
    const add = article.tags
      .map((t) => t.tag.name.replace(/\s+/g, ""))
      .filter((t) => t && t.length <= 30 && !existing.has(t))
      .slice(0, 30 - existing.size);
    if (add.length > 0) {
      markdown = `${markdown}\n\n${add.map((t) => `#${t}`).join(" ")}`;
      quality = runCheck(title, meta, excerpt, markdown);
    }
  }

  const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
  const curYear = kstNow.getUTCFullYear();
  const curMonth = kstNow.getUTCMonth() + 1;
  const curDay = kstNow.getUTCDate();

  const system = [
    "당신은 한국어 SEO 블로그 에디터입니다. 기존 글의 품질 부족 항목만 보강해 완성도를 85점 이상으로 올립니다.",
    "규칙 ① 본문의 기존 HTML 블록(<a> 상품 배너, <p> 대가성 안내 문구, <figure> 이미지, 맨 끝 #해시태그 줄, 인용문)과 [IMAGE:n]·[PRODUCT_BANNER] 마커는 절대 삭제·변형하지 말고 그대로 보존한다.",
    "규칙 ② qualityIssues의 각 항목을 해결한다 — 특히 본문 끝 #해시태그가 20개 미만이면 관련 SEO 태그를 20~30개로 늘리고, 소제목(H2)에 핵심 키워드를 자연스럽게 넣고, 키워드를 본문 전반에 고르게 분포시키며, 부족한 분량은 유용한 정보로 보강한다.",
    "규칙 ③ 과장·보장성·광고클릭 유도 문구 금지. 사람이 쓴 자연스러운 문체·이모지를 유지한다.",
    `규칙 ④ 오늘은 ${curYear}년 ${curMonth}월 ${curDay}일이다. 제목·본문의 연도·시점 표현이 현재와 안 맞으면(예: 지난 연도를 '최신'·'올해'로 표기) 반드시 현재 연도(${curYear}) 기준으로 바로잡는다. 시점을 모르면 연도를 지어내지 말고 표현을 뺀다.`,
    // 품질검사는 키워드 문구가 '띄어쓰기 포함 그대로' 들어갔는지 본다 — 문구를 명시해 반드시 심게 한다.
    `규칙 ⑤ 핵심 키워드 문구는 "${topic}"이다. 이 문구를 토씨 하나 바꾸지 말고 그대로 ①도입부 첫 문단 ②본문 후반부에 각 1회 이상, 본문 전체 2~5회 자연스럽게 포함시킨다 (예: "${topic}에 대해...").`,
    "출력은 JSON만: {\"title\":\"\",\"metaDescription\":\"\",\"excerpt\":\"\",\"contentMarkdown\":\"\",\"tags\":[\"SEO 태그 25개, # 없이\"]}",
  ].join("\n");

  let lastTags: string[] = [];
  let claudeError: string | null = null;
  for (let attempt = 0; attempt < 2 && quality.score < 85; attempt += 1) {
    const issues = quality.items
      .filter((item) => !item.ok)
      .map((item) => item.label + (item.note ? ` — ${item.note}` : ""));
    if (quality.policyRisks.length > 0) {
      issues.push("정책 위험 문구 제거: " + quality.policyRisks.join(", "));
    }
    let revised: Partial<Pick<GeneratedContent, "title" | "metaDescription" | "excerpt" | "contentMarkdown">> & {
      tags?: string[];
    };
    try {
      revised = await callClaudeJson({
        operation: "article-improve",
        maxTokens: 32000,
        system,
        user: JSON.stringify({
          topic,
          keywordPhrase: topic,
          qualityIssues: issues,
          previousDraft: { title, metaDescription: meta, excerpt, contentMarkdown: markdown },
        }),
      });
    } catch (error) {
      claudeError = (error as Error).message;
      console.error(`[improve] Claude 호출 실패 (글 ${articleId}, 시도 ${attempt + 1}):`, claudeError);
      break;
    }
    if (revised.contentMarkdown) {
      title = revised.title || title;
      meta = revised.metaDescription || meta;
      excerpt = revised.excerpt || excerpt;
      markdown = revised.contentMarkdown;
      if (Array.isArray(revised.tags)) lastTags = revised.tags;
      quality = runCheck(title, meta, excerpt, markdown);
    } else {
      break;
    }
  }

  // 결정적 보정: 해시태그가 여전히 20개 미만이면 AI가 준 tags로 본문 끝에 직접 붙인다 (확실한 +10점)
  if (countHashtags(markdown) < 20 && lastTags.length > 0) {
    const tagLine = [
      ...new Set(lastTags.map((t) => t.replace(/^#/, "").replace(/\s+/g, "").trim()).filter((t) => t.length > 0 && t.length <= 30)),
    ]
      .slice(0, 30)
      .map((t) => `#${t}`)
      .join(" ");
    if (tagLine) {
      markdown = `${markdown}\n\n${tagLine}`;
      quality = runCheck(title, meta, excerpt, markdown);
    }
  }

  // AI 호출이 실패해 아무것도 못 고쳤으면 조용히 같은 점수를 저장하지 말고 에러를 알린다
  if (claudeError && quality.score <= before) {
    throw new HttpError(502, `보정 AI 호출 실패: ${claudeError}`);
  }

  const contentHtml = await renderContentHtml(markdown);
  const last = await prisma.articleVersion.findFirst({ where: { articleId }, orderBy: { version: "desc" } });
  await prisma.article.update({
    where: { id: articleId },
    data: {
      title,
      metaDescription: meta,
      excerpt,
      contentMarkdown: markdown,
      contentHtml,
      qualityScore: quality.score,
      qualityReport: JSON.parse(JSON.stringify(quality)),
      versions: {
        create: {
          version: (last?.version ?? 0) + 1,
          title,
          contentMarkdown: markdown,
          contentHtml,
          changeNote: `품질 보정 (${before}→${quality.score}점)`,
        },
      },
    },
  });

  return { before, after: quality.score, passed: quality.score >= 85 };
}

/**
 * 생성 후 마무리 파이프라인 (원스톱 자동화) — ① 85점 미만이면 자동 보정 1회 ② 이미지 3장 자동 생성.
 * 스케줄러(자동 글)는 await, 수동 생성 라우트는 응답 후 백그라운드로 호출한다.
 * 실패해도 글은 남으므로 예외는 로그만 남기고 삼킨다.
 */
export async function finishArticlePipeline(articleId: number, qualityScore: number): Promise<void> {
  if (qualityScore < 85) {
    try {
      const r = await improveArticle(articleId);
      console.log(`[pipeline] 자동 보정 ${r.before}→${r.after}점 (글 ${articleId})`);
    } catch (error) {
      console.error(`[pipeline] 자동 보정 실패 (글 ${articleId}):`, (error as Error).message);
    }
  }
  try {
    const { generateArticleImages } = await import("../images/image-service.js");
    const r = await generateArticleImages(articleId);
    console.log(`[pipeline] 이미지 자동 생성 ${r.generated}장${r.failed ? ` (실패 ${r.failed})` : ""} (글 ${articleId})`);
  } catch (error) {
    console.error(`[pipeline] 이미지 자동 생성 실패 (글 ${articleId}):`, (error as Error).message);
  }
}
