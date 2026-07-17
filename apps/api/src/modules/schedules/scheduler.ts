import { Cron } from "croner";
import { prisma } from "../../common/prisma.js";
import { runDailyDiscovery, kstToday, isExcludedTopic } from "../keywords/engine.js";
import { finishArticlePipeline, generateArticle, type ProductInput } from "../articles/generator.js";
import { searchCoupangProducts } from "../products/coupang.js";
import { overlapScore, isNonCommercialKeyword, hasBuyingIntent } from "../products/product-match.js";

let keywordJob: Cron | null = null;
let citationJob: Cron | null = null;
let analyticsJob: Cron | null = null;
let imageSweepJob: Cron | null = null;
let tistorySyncJob: Cron | null = null;
let dripJob: Cron | null = null;

function toProductInput(p: {
  source: string;
  name: string;
  brand: string | null;
  price: number | null;
  imageUrl: string | null;
  productUrl: string;
  description: string | null;
  isRocket: boolean;
}): ProductInput {
  return {
    source: p.source === "BRANDCONNECT" ? "BRANDCONNECT" : "COUPANG",
    name: p.name,
    brand: p.brand ?? undefined,
    price: p.price ?? undefined,
    imageUrl: p.imageUrl ?? undefined,
    productUrl: p.productUrl,
    description: p.description ?? undefined,
    isRocket: p.isRocket,
  };
}

/**
 * 키워드에 어울리는 제휴 상품을 찾아 홍보 배너용 product로 변환한다.
 * ① 사용자가 /products에 등록한 상품 중 이 키워드에 매칭된 것 우선(쿠팡 검색 API가 없어 수동 등록).
 * ② 없으면 쿠팡 상품검색 API(키 있을 때만).
 * 둘 다 없으면 null → 광고 없는 정보성 글로 폴백(도배·정책 위험 방지).
 */
async function findProductForKeyword(keywordId: number, text: string): Promise<ProductInput | null> {
  // 제휴 배너 전역 스위치 — off면 어떤 글에도 상품을 붙이지 않는다(순수 정보성 블로그 운영).
  const { getSettingValues } = await import("../settings/settings.service.js");
  const bannersOn = (await getSettingValues(["affiliate.bannersEnabled"]))["affiliate.bannersEnabled"];
  if (bannersOn === "false") return null;

  // 사건·사고·재난·뉴스·금융 등엔 광고를 붙이지 않는다 (부적절·정책 위험).
  if (isNonCommercialKeyword(text)) return null;

  // ① 등록 상품: 명시 매칭 우선 → 없으면 활성 상품 중 토큰 겹침 최고.
  // ⚠️ 제휴 트래킹 링크가 있는 상품만 쓴다 — 원본 상품 URL(coupang.com·smartstore)은
  //    수수료 추적이 안 돼 광고를 붙이는 의미가 없다(크롤 직후 링크 미발급 상품 제외).
  const hasAffiliateLink = (p: { source: string; productUrl: string }) =>
    p.source === "COUPANG"
      ? /link\.coupang\.com|coupa\.ng/i.test(p.productUrl)
      : /naver\.me/i.test(p.productUrl);
  const explicit = await prisma.product.findFirst({
    where: { status: "ACTIVE", matchedKeywordId: keywordId },
    orderBy: { createdAt: "asc" },
  });
  let chosen = explicit && hasAffiliateLink(explicit) ? explicit : null;
  if (!chosen) {
    // 크롤 적재로 수천 건 — 전량을 보되 토큰매칭은 인메모리라 충분히 빠르다.
    const actives = await prisma.product.findMany({ where: { status: "ACTIVE" }, take: 5000 });
    let bestScore = 0;
    let bestRating = -1;
    for (const p of actives) {
      if (!hasAffiliateLink(p)) continue;
      const score = overlapScore({ name: p.name, brand: p.brand }, text);
      // 동점이면 리뷰 수 많은 상품(검증된 상품) 우선
      const rating = p.ratingCount ?? 0;
      if (score >= 1 && (score > bestScore || (score === bestScore && rating > bestRating))) {
        bestScore = score;
        bestRating = rating;
        chosen = p;
      }
    }
  }
  if (chosen) {
    // 한 상품이 여러 글에 도배되지 않게 사용 후 USED 처리
    await prisma.product.update({ where: { id: chosen.id }, data: { status: "USED" } }).catch(() => undefined);
    return toProductInput(chosen);
  }

  // ② 폴백: 쿠팡 상품검색 API (키 설정 시)
  try {
    const products = await searchCoupangProducts(text, 5);
    const best = products.find((p) => p.productUrl && p.productName);
    if (!best) return null;
    return {
      source: "COUPANG",
      name: best.productName,
      price: best.productPrice,
      imageUrl: best.productImage,
      productUrl: best.productUrl,
      isRocket: best.isRocket,
    };
  } catch (error) {
    console.error(`[scheduler] 쿠팡 상품 검색 실패 (${text}):`, (error as Error).message);
    return null;
  }
}

/** 키워드 문구·유형으로 어울리는 글 유형을 추천한다 (서버 자동 판단) */
function suggestArticleType(text: string, sourceType: string | null, intent: string | null): string {
  if (/후기|리뷰/.test(text)) return "product-review";
  if (/추천|비교|vs/i.test(text)) return "comparison";
  if (/신청|가입|접수/.test(text)) return "how-to-apply";
  if (/비용|가격|요금|수수료|예상가/.test(text)) return "pricing";
  if (/방법|사용법|하는 법/.test(text)) return "how-to";
  if (/해결|오류|대처|안 될 때/.test(text)) return "troubleshooting";
  if (sourceType === "ISSUE") return "news";
  switch (intent) {
    case "비교검토":
    case "구매전환":
      return "comparison";
    case "신청전환":
      return "how-to-apply";
    case "문제해결":
      return "troubleshooting";
    default:
      return "guide";
  }
}

// 금융·재테크 키워드 판별 — 주식·투자·환율·금리 등. category(수집기 분류)와 문구를 함께 본다.
const FINANCE_RE =
  /주식|주가|증시|코스피|코스닥|나스닥|환율|금리|배당|\betf\b|코인|비트코인|재테크|투자|증권|펀드|예금|적금|대출|시황|실적|관련주|수혜주|반대매매|공모주|시총|상장/i;

type MixCategory = "finance" | "product" | "issue" | "other";

/** 키워드를 하루 구성 버킷으로 분류 — 제휴(배너) > 금융 > 이슈 > 기타 우선순위 */
function classifyForMix(
  text: string,
  category: string | null,
  sourceType: string | null,
  intent: string | null,
): MixCategory {
  const articleType = suggestArticleType(text, sourceType, intent);
  if (hasBuyingIntent(text, articleType)) return "product"; // 추천·비교·후기·가격 → 배너 가능
  if (FINANCE_RE.test(text) || /금융|재테크|투자|증시|주식/.test(category ?? "")) return "finance";
  if (sourceType === "ISSUE") return "issue"; // 트렌드성 이슈 (금융·제휴 아닌 것)
  return "other";
}

/**
 * 하루 구성 목표 — 설정 상한을 2:2:1(금융:제휴:이슈)로 나눈다.
 * 상한이 늘면 비율대로 배분이 커진다 (5→2/2/1, 10→4/4/2).
 */
function dailyComposition(limit: number): Record<MixCategory, number> {
  const finance = Math.round(limit * 0.4);
  const product = Math.round(limit * 0.4);
  const issue = Math.max(0, limit - finance - product);
  return { finance, product, issue, other: 0 };
}

/** 키워드 하나로 글을 만든다. 성공 true. 중복·제외는 키워드를 EXCLUDED로 내리고 false. */
async function genOne(
  kw: { id: number; text: string; sourceType: string | null; searchIntent: string | null },
  withBanner: boolean,
): Promise<boolean> {
  if (isExcludedTopic(kw.text)) {
    await prisma.keyword.update({ where: { id: kw.id }, data: { status: "EXCLUDED" } }).catch(() => undefined);
    return false;
  }
  try {
    const articleType = suggestArticleType(kw.text, kw.sourceType, kw.searchIntent);
    // 배너는 '구매 의도 글'에만(전략 B). 금융·이슈 글은 트래픽용으로 깨끗하게 둔다.
    const product = withBanner ? await findProductForKeyword(kw.id, kw.text) : null;
    const result = await generateArticle({
      keywordId: kw.id,
      articleType,
      language: "ko",
      schemaTypes: ["BlogPosting", "FAQPage"],
      product: product ?? undefined,
    });
    // 원스톱: 최소 품질 미만 자동 보정 + 이미지 생성 → 검토만 하면 되는 완성 글
    await finishArticlePipeline(result.articleId, result.qualityScore);
    return true;
  } catch (error) {
    if ((error as { status?: number }).status === 409) {
      // 중복 소재 — EXCLUDED로 내려 회차마다 재시도되지 않게
      await prisma.keyword.update({ where: { id: kw.id }, data: { status: "EXCLUDED" } }).catch(() => undefined);
      return false;
    }
    console.error(`[scheduler] 자동 글 생성 실패 (${kw.text}):`, (error as Error).message);
    return false;
  }
}

/**
 * 하루 구성(금융 2·제휴 2·이슈 1, 상한 연동)에 맞춰 자동 생성한다.
 *
 * - 하루 총량은 설정 `scheduler.dailyLimit` (기본 5). 4회 크론이 나눠 채운다.
 * - 오늘 이미 만든 글을 분류별로 세어, **부족한 버킷만** 채운다(회차마다 목표에 수렴).
 * - **인용 매칭**: 후보를 고를 때 AI 인용 학습 데이터(citation_insights)가 있는 키워드를 우선한다
 *   → 인용될 만한 글쓰기 규칙이 실제로 프롬프트에 주입되는 키워드부터 쓴다.
 */
async function autoGenerateDailyMix(): Promise<number> {
  const { getSettingValues } = await import("../settings/settings.service.js");
  const rawLimit = (await getSettingValues(["scheduler.dailyLimit"]))["scheduler.dailyLimit"];
  const limit = Math.max(0, Number(rawLimit ?? 5) || 5);
  if (limit === 0) return 0;
  const target = dailyComposition(limit);

  // 오늘(KST) 이미 만든 글을 분류별로 센다
  const now = new Date();
  const kstMidnightUtc = new Date(now);
  kstMidnightUtc.setUTCHours(15, 0, 0, 0);
  if (kstMidnightUtc > now) kstMidnightUtc.setUTCDate(kstMidnightUtc.getUTCDate() - 1);
  const todayArts = await prisma.article.findMany({
    where: { createdAt: { gte: kstMidnightUtc } },
    select: { keyword: { select: { text: true, category: true, sourceType: true, searchIntent: true } } },
  });
  const made: Record<MixCategory, number> = { finance: 0, product: 0, issue: 0, other: 0 };
  for (const a of todayArts) {
    const k = a.keyword;
    made[k ? classifyForMix(k.text, k.category, k.sourceType, k.searchIntent) : "other"] += 1;
  }
  let budget = limit - todayArts.length; // 총 상한
  if (budget <= 0) {
    console.log(`[scheduler] 하루 상한 ${limit}개 도달 (오늘 ${todayArts.length}개) — 생성 안 함`);
    return 0;
  }

  // 후보 키워드 풀 — 오늘 추천 + 인용 데이터 보유 여부로 우선순위
  const { date } = kstToday();
  const recs = await prisma.dailyKeywordRecommendation.findMany({
    where: { date, keyword: { status: { in: ["RECOMMENDED", "SAVED"] } } },
    orderBy: { finalScore: "desc" },
    take: 60,
    include: { keyword: true },
  });
  // 인용 학습 데이터가 있는 키워드 집합 (매칭 우선용)
  const cited = new Set(
    (await prisma.citationInsight.findMany({ select: { keywordText: true } })).map((c) => c.keywordText),
  );
  const buckets: Record<MixCategory, typeof recs> = { finance: [], product: [], issue: [], other: [] };
  for (const r of recs) {
    const cat = classifyForMix(r.keyword.text, r.keyword.category, r.keyword.sourceType, r.keyword.searchIntent);
    buckets[cat].push(r);
  }
  // 각 버킷 안에서 인용 데이터 보유 키워드를 앞으로 (finalScore 순서는 유지)
  for (const cat of ["finance", "product", "issue"] as const) {
    buckets[cat].sort((a, b) => Number(cited.has(b.keyword.text)) - Number(cited.has(a.keyword.text)));
  }

  let generated = 0;
  const fill = async (cat: "finance" | "product" | "issue", withBanner: boolean) => {
    for (const r of buckets[cat]) {
      if (budget <= 0 || made[cat] >= target[cat]) break; // 총 상한 or 이 버킷 목표 도달
      const ok = await genOne(r.keyword, withBanner);
      if (ok) {
        made[cat] += 1;
        generated += 1;
        budget -= 1;
        console.log(`[scheduler] 자동 글(${cat}): "${r.keyword.text.slice(0, 28)}"${cited.has(r.keyword.text) ? " ★인용매칭" : ""}`);
      }
      if (budget <= 0) break;
    }
  };

  // 제휴 버킷은 **등록 상품 매칭(bulk-match)을 먼저** 쓴다 — 트래킹 링크가 확실히 있는 키워드라 전환에 유리.
  const fillProductFromBulk = async () => {
    if (made.product >= target.product || budget <= 0) return;
    const hits = await prisma.bulkMatchHit.findMany({
      where: { usedAt: null },
      orderBy: { score: "desc" },
      take: 30,
    });
    for (const hit of hits) {
      if (budget <= 0 || made.product >= target.product) break;
      const keyword = await prisma.keyword.findFirst({ where: { text: hit.keyword } });
      if (!keyword) continue;
      // 이미 이 키워드로 글이 있으면 매칭만 소진 처리
      const existing = await prisma.article.findFirst({ where: { keywordId: keyword.id }, select: { id: true } });
      if (existing) {
        await prisma.bulkMatchHit
          .update({ where: { id: hit.id }, data: { usedAt: new Date(), articleId: existing.id } })
          .catch(() => undefined);
        continue;
      }
      const ok = await genOne(keyword, true);
      if (ok) {
        const art = await prisma.article.findFirst({
          where: { keywordId: keyword.id },
          orderBy: { id: "desc" },
          select: { id: true },
        });
        await prisma.bulkMatchHit
          .update({ where: { id: hit.id }, data: { usedAt: new Date(), articleId: art?.id ?? null } })
          .catch(() => undefined);
        made.product += 1;
        generated += 1;
        budget -= 1;
        console.log(`[scheduler] 자동 글(product·매칭): "${hit.keyword.slice(0, 24)}" (상품: ${hit.name.slice(0, 24)})`);
      }
    }
  };

  await fill("finance", false); // 주식·재테크 — 배너 없이 트래픽용
  await fillProductFromBulk(); // 제휴 — 등록 상품 매칭 우선(배너)
  await fill("product", true); // 제휴 — 남은 목표는 구매 의도 추천 키워드로(배너)
  await fill("issue", false); // 이슈 — 배너 없이 트래픽용

  console.log(
    `[scheduler] 하루 구성 진행: 금융 ${made.finance}/${target.finance} · 제휴 ${made.product}/${target.product} · 이슈 ${made.issue}/${target.issue} (이번 회차 ${generated}건)`,
  );
  return generated;
}

/**
 * 드립 발행 — 검토 끝난 글을 **하루 상한만큼 카테고리 고르게** 발행 큐에 올린다.
 *
 * 왜: 이전에 5일간 55개를 한꺼번에 쏟아낸 게 대량 배포(스팸)로 보였다. 앞으로는 하루 5개씩만,
 * 카테고리를 고르게 섞어 자연스러운 속도로 내보낸다.
 *
 * 동작:
 *  - 아직 발행·릴리즈 안 된 준비 글(품질 통과)을 카테고리 라운드로빈으로 최대 `dailyLimit`개 고른다.
 *  - 각 글에 `publishAt`(릴리즈 시각)을 찍고 WP·블로거 발행 잡을 큐에 넣는다(러너가 1분 내 처리).
 *  - 네이버·티스토리는 API가 없어 확장이 발행하는데, 확장 대기목록은 `publishAt` 찍힌 글만 보이므로
 *    그쪽도 하루 5개씩만 뜬다(확장 실행 시 그만큼만 올라간다).
 *  - 하루 이미 릴리즈한 수를 세어 상한을 넘지 않는다.
 */
export async function dripPublishDaily(): Promise<number> {
  const { getSettingValues } = await import("../settings/settings.service.js");
  const cfg = await getSettingValues(["scheduler.autoPublishDaily", "scheduler.dailyLimit"]);
  if (cfg["scheduler.autoPublishDaily"] === "false") return 0; // 드립 꺼짐 → 수동 발행
  const limit = Math.max(0, Number(cfg["scheduler.dailyLimit"] ?? 5) || 5);
  if (limit === 0) return 0;

  const { minQualityScore } = await import("../articles/quality-gate.js");
  const minScore = await minQualityScore();

  // 오늘(KST) 이미 릴리즈한 글 수
  const now = new Date();
  const kstMidnightUtc = new Date(now);
  kstMidnightUtc.setUTCHours(15, 0, 0, 0);
  if (kstMidnightUtc > now) kstMidnightUtc.setUTCDate(kstMidnightUtc.getUTCDate() - 1);
  const releasedToday = await prisma.article.count({ where: { publishAt: { gte: kstMidnightUtc } } });
  let budget = limit - releasedToday;
  if (budget <= 0) return 0;

  // 준비 풀: 아직 어디에도 발행 안 됐고, 릴리즈 안 됐고, 품질 통과한 글 (오래된 것부터)
  const ready = await prisma.article.findMany({
    where: {
      publishAt: null,
      status: { in: ["REVIEW", "APPROVED", "DRAFT"] },
      qualityScore: { gte: minScore },
      publishJobs: { none: { status: "SUCCEEDED" } },
    },
    orderBy: { createdAt: "asc" },
    take: 60,
    include: { keyword: { select: { text: true, category: true, sourceType: true, searchIntent: true } } },
  });
  if (ready.length === 0) return 0;

  // 카테고리 라운드로빈으로 고르게 섞어 뽑는다
  const byCat: Record<MixCategory, typeof ready> = { finance: [], product: [], issue: [], other: [] };
  for (const a of ready) {
    const k = a.keyword;
    byCat[k ? classifyForMix(k.text, k.category, k.sourceType, k.searchIntent) : "other"].push(a);
  }
  const order: MixCategory[] = ["finance", "product", "issue", "other"];
  const picked: typeof ready = [];
  let round = 0;
  while (picked.length < budget && order.some((c) => byCat[c].length > 0)) {
    const cat = order[round % order.length];
    const next = byCat[cat].shift();
    if (next) picked.push(next);
    round += 1;
  }

  let released = 0;
  for (let i = 0; i < picked.length; i += 1) {
    const article = picked[i];
    // WP·블로거 발행은 하루 중에 흩어서 (한꺼번에 안 나가게). 90분 간격.
    const scheduledAt = new Date(now.getTime() + i * 90 * 60 * 1000);
    try {
      await prisma.article.update({
        where: { id: article.id },
        data: { publishAt: now, status: "SCHEDULED" },
      });
      for (const platform of ["WORDPRESS", "BLOGGER"] as const) {
        await prisma.publishJob.create({
          data: { articleId: article.id, platform, status: "QUEUED", scheduledAt },
        });
      }
      released += 1;
      console.log(
        `[drip] 발행 예약: "${article.title.slice(0, 28)}" → ${scheduledAt.toLocaleTimeString("ko-KR")} 경`,
      );
    } catch (error) {
      console.error(`[drip] 예약 실패 (글 ${article.id}):`, (error as Error).message);
    }
  }
  console.log(`[drip] 오늘 릴리즈 ${releasedToday + released}/${limit} (이번 ${released}건)`);
  return released;
}

/**
 * 하루 4회(06·12·18·00 KST) 키워드 수집 + 회차마다 구성(금융·제휴·이슈)에 맞춰 자동 작성.
 * 하루 총량은 설정 상한(기본 5), 구성은 2:2:1로 상한에 연동.
 */
export async function scheduleFromSettings(): Promise<void> {
  try {
    keywordJob?.stop();
    keywordJob = new Cron(
      "0 6,12,18,0 * * *",
      { timezone: "Asia/Seoul", protect: true },
      async () => {
        console.log("[scheduler] 정기 키워드 수집 시작");
        try {
          const result = await runDailyDiscovery("cron");
          console.log(`[scheduler] 키워드 수집: 추천 ${result.recommendedCount}개`);
          // 하루 구성(금융·제휴·이슈)에 맞춰, 상한 안에서 부족한 버킷만 채운다.
          const made = await autoGenerateDailyMix();
          console.log(`[scheduler] 자동 글 ${made}건 생성 (검토 대기)`);
        } catch (error) {
          console.error("[scheduler] 정기 작업 실패:", (error as Error).message);
        }
      },
    );
    console.log("[scheduler] 키워드 수집 4회/일 (06·12·18·00 KST) + 회차별 자동 글 2건 (검토 대기)");

    // AI 브리핑 인용 게시물 수집 — 하루 1회면 충분하다(누적 인용수라 하루 새 크게 안 변한다).
    // 07:30 = 06시 키워드 수집이 끝난 뒤라 그날 키워드 기준으로 긁는다.
    citationJob?.stop();
    citationJob = new Cron(
      "30 7 * * *",
      { timezone: "Asia/Seoul", protect: true },
      async () => {
        try {
          const { collectBlogCitations } = await import("../keywords/citation.js");
          const result = await collectBlogCitations();
          console.log(`[scheduler] 인용 수집: 키워드 ${result.keywords}개 → 게시물 ${result.posts}건`);
          // 수집한 인용 글을 실제로 읽고 학습 — 말투·구조·빈 각도를 뽑아 글 생성에 쓴다 (Claude 비용이라 5개씩)
          const { studyPendingKeywords, studyStyle } = await import("../keywords/citation-study.js");
          const study = await studyPendingKeywords(5);
          console.log(`[scheduler] 인용 학습: 키워드 ${study.studied}개 분석 완료`);
          // 말투 프로파일 — 인용 상위 블로거들의 문체를 실측해 전 글 생성에 적용한다 (하루 1회 갱신)
          // 누적 지식 갱신 — 새 인사이트가 쌓일수록 '주제 무관 법칙'을 다시 종합한다 (계속 증적되는 지식)
          const { rebuildKnowledge } = await import("../keywords/citation-knowledge.js");
          const knowledge = await rebuildKnowledge();
          if (knowledge)
            console.log(
              `[scheduler] 누적 지식 갱신: ${knowledge.basedOnKeywords}개 주제 종합 → 법칙 ${knowledge.laws.length}개`,
            );
          const style = await studyStyle();
          if (style) console.log(`[scheduler] 말투 학습: ${style.metrics.posts}명 실측 (하십시오체 ${style.metrics.formalRatio}%)`);
        } catch (error) {
          console.error("[scheduler] 인용 수집 실패:", (error as Error).message);
        }
      },
    );
    console.log("[scheduler] AI 브리핑 인용 수집 1회/일 (07:30 KST)");

    // 성과 수집 — GSC는 데이터가 2~3일 지연되므로 매일 새벽에 '3일 전~2일 전' 구간을 다시 긁는다.
    // (지연 구간을 재수집하므로 upsert로 덮어쓴다 — 중복 걱정 없음)
    analyticsJob?.stop();
    analyticsJob = new Cron(
      "0 5 * * *",
      { timezone: "Asia/Seoul", protect: true },
      async () => {
        try {
          const { collectSearchConsole } = await import("../analytics/collectors/search-console.js");
          const result = await collectSearchConsole(5);
          console.log(
            `[scheduler] 성과 수집: 속성 ${result.sites}개 · 행 ${result.rows}건 → 글 매칭 ${result.matched}건 (미매칭 ${result.unmatched})`,
          );
          // 성과가 갱신됐으니 자가학습을 다시 돌린다 — 표본이 모자라면 스스로 건너뛴다(배운 척 금지)
          const { buildSelfLearning } = await import("../keywords/self-learning.js");
          const learned = await buildSelfLearning();
          if (learned)
            console.log(
              `[scheduler] 자가학습: 표본 ${learned.sampleSize}건 → 규칙 ${learned.rules.length}개 갱신`,
            );
          else console.log("[scheduler] 자가학습: 성과 표본 부족 — 관측만 계속 (학습 보류)");
        } catch (error) {
          // 설정 누락·권한 없음도 여기서 드러나야 한다 — 조용히 0건으로 넘어가지 않는다
          console.error("[scheduler] 성과 수집 실패:", (error as Error).message);
        }
      },
    );
    console.log("[scheduler] Search Console 성과 수집 1회/일 (05:00 KST)");

    // 이미지 미생성 스윕 — 생성 파이프라인이 어떤 이유로든(재시작·중단) 이미지를 못 만들고 지나간 글을
    // 30분마다 찾아 마저 만든다. 원인 불명의 누락(글 52·55)이 실제로 있었다 — 자기치유가 답이다.
    imageSweepJob?.stop();
    imageSweepJob = new Cron(
      "*/30 * * * *",
      { timezone: "Asia/Seoul", protect: true },
      async () => {
        try {
          const since = new Date(Date.now() - 3 * 24 * 3600 * 1000);
          const targets = await prisma.article.findMany({
            where: {
              createdAt: { gte: since },
              media: { some: { prompt: { not: null }, webpUrl: null } },
            },
            select: { id: true },
            take: 2, // Gemini 비용 — 한 번에 몰아치지 않는다
            orderBy: { createdAt: "asc" },
          });
          if (targets.length === 0) return;
          const { generateArticleImages } = await import("../images/image-service.js");
          for (const target of targets) {
            const result = await generateArticleImages(target.id);
            console.log(
              `[scheduler] 이미지 스윕: 글 ${target.id} → ${result.generated}장 생성${result.failed ? ` (실패 ${result.failed})` : ""}`,
            );
          }
        } catch (error) {
          console.error("[scheduler] 이미지 스윕 실패:", (error as Error).message);
        }
      },
    );
    console.log("[scheduler] 이미지 미생성 스윕 30분 주기");

    // 티스토리 URL 자기치유 — 확장은 발행 후 '글 주소로 이동'을 엿봐서 URL을 잡는데,
    // 티스토리는 발행하면 **관리 목록으로 간다**. 그래서 링크가 어떤 건 잡히고 어떤 건 안 잡혔다(47건 중 4건 누락).
    // 확장을 고쳐도 놓칠 수 있으니, **RSS를 정답으로 삼아** 주기적으로 채운다.
    tistorySyncJob?.stop();
    tistorySyncJob = new Cron(
      "*/20 * * * *",
      { timezone: "Asia/Seoul", protect: true },
      async () => {
        try {
          const { syncTistoryUrls } = await import("../publishing/tistory-sync.js");
          const result = await syncTistoryUrls();
          if (result.filled.length > 0) {
            console.log(`[scheduler] 티스토리 URL 복구 ${result.filled.length}건`);
          }
          if (result.phantom.length > 0) {
            // 조용히 넘기면 안 된다 — '발행됐다'고 기록됐는데 실물이 없는 글이다
            console.warn(
              `[scheduler] ⚠️ 유령 발행 ${result.phantom.length}건 (성공 기록인데 티스토리에 글이 없음): ` +
                result.phantom.map((row) => `#${row.articleId}`).join(", "),
            );
          }
        } catch (error) {
          console.error("[scheduler] 티스토리 URL 동기화 실패:", (error as Error).message);
        }
      },
    );
    console.log("[scheduler] 티스토리 URL 자기치유 20분 주기");

    // 드립 발행 — 매일 10:00 KST에 검토 끝난 글을 하루 상한만큼 카테고리 고르게 발행 큐에 올린다.
    // (10시 = 06시 생성분이 이미지·보정까지 끝난 뒤라 준비된 글이 풀에 있다)
    dripJob?.stop();
    dripJob = new Cron("0 10 * * *", { timezone: "Asia/Seoul", protect: true }, async () => {
      try {
        const n = await dripPublishDaily();
        console.log(`[scheduler] 드립 발행 ${n}건 예약`);
      } catch (error) {
        console.error("[scheduler] 드립 발행 실패:", (error as Error).message);
      }
    });
    console.log("[scheduler] 드립 자동 발행 1회/일 (10:00 KST)");
  } catch (error) {
    console.warn("[scheduler] 예약 실패 (DB 미연결일 수 있음):", (error as Error).message);
  }
}

/** 수동 트리거 — 지금 수집 + 구성에 맞춰 자동 글 (하루 상한 안에서) */
export async function runCollectionNow(): Promise<{ recommendedCount: number; articlesMade: number }> {
  const result = await runDailyDiscovery("manual");
  const made = await autoGenerateDailyMix();
  return { recommendedCount: result.recommendedCount, articlesMade: made };
}
