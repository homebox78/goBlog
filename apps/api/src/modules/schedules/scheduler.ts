import { Cron } from "croner";
import { prisma } from "../../common/prisma.js";
import { runDailyDiscovery, kstToday } from "../keywords/engine.js";
import { generateArticle, type ProductInput } from "../articles/generator.js";
import { searchCoupangProducts } from "../products/coupang.js";

let keywordJob: Cron | null = null;

/**
 * 키워드에 어울리는 쿠팡 상품을 찾아 홍보 배너용 product로 변환한다.
 * goBlog의 목적이 제휴 수익이므로 자동 생성 글에도 관련 상품 배너를 붙인다.
 * 상품을 못 찾거나 쿠팡 API가 안 되면 null → 광고 없는 정보성 글로 폴백(도배·정책 위험 방지).
 */
async function findProductForKeyword(text: string): Promise<ProductInput | null> {
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

/**
 * 오늘 누적 추천 중 아직 글로 쓰지 않은 상위 키워드로 글을 자동 생성한다 (검토 대기 상태).
 * 자동 발행이 아니라 자동 작성 — 발행은 관리자 검토 후 수동/예약.
 */
async function autoGenerateTopArticles(count: number): Promise<number> {
  const { date } = kstToday();
  const recommendations = await prisma.dailyKeywordRecommendation.findMany({
    where: { date, keyword: { status: { in: ["RECOMMENDED", "SAVED"] } } },
    orderBy: { finalScore: "desc" },
    take: 15,
    include: { keyword: true },
  });

  let made = 0;
  for (const rec of recommendations) {
    if (made >= count) break;
    try {
      // 제휴 수익화: 키워드에 어울리는 쿠팡 상품을 찾아 붙이면 배너·딥링크·대가성 문구가 자동 삽입된다.
      const product = await findProductForKeyword(rec.keyword.text);
      await generateArticle({
        keywordId: rec.keywordId,
        articleType: suggestArticleType(rec.keyword.text, rec.keyword.sourceType, rec.keyword.searchIntent),
        language: "ko",
        schemaTypes: ["BlogPosting", "FAQPage"],
        product: product ?? undefined,
      });
      made += 1;
    } catch (error) {
      console.error(`[scheduler] 자동 글 생성 실패 (${rec.keyword.text}):`, (error as Error).message);
    }
  }
  return made;
}

/**
 * 하루 4회(06·12·18·00 KST) 키워드 수집 + 회차마다 상위 키워드 2건 자동 작성.
 * 하루 총 8건 이상이 검토 대기 상태로 쌓인다.
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
          const made = await autoGenerateTopArticles(2);
          console.log(`[scheduler] 자동 글 ${made}건 생성 (검토 대기)`);
        } catch (error) {
          console.error("[scheduler] 정기 작업 실패:", (error as Error).message);
        }
      },
    );
    console.log("[scheduler] 키워드 수집 4회/일 (06·12·18·00 KST) + 회차별 자동 글 2건 (검토 대기)");
  } catch (error) {
    console.warn("[scheduler] 예약 실패 (DB 미연결일 수 있음):", (error as Error).message);
  }
}

/** 수동 트리거 — 지금 수집 + 자동 글 2건 (테스트/즉시 실행용) */
export async function runCollectionNow(): Promise<{ recommendedCount: number; articlesMade: number }> {
  const result = await runDailyDiscovery("manual");
  const made = await autoGenerateTopArticles(2);
  return { recommendedCount: result.recommendedCount, articlesMade: made };
}
