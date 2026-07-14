import { Cron } from "croner";
import { prisma } from "../../common/prisma.js";
import { runDailyDiscovery, kstToday, isExcludedTopic } from "../keywords/engine.js";
import { finishArticlePipeline, generateArticle, type ProductInput } from "../articles/generator.js";
import { searchCoupangProducts } from "../products/coupang.js";
import { overlapScore, isNonCommercialKeyword } from "../products/product-match.js";

let keywordJob: Cron | null = null;
let citationJob: Cron | null = null;
let analyticsJob: Cron | null = null;
let imageSweepJob: Cron | null = null;
let tistorySyncJob: Cron | null = null;

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
  // 사건·사고·재난·뉴스·금융 등엔 광고를 붙이지 않는다 (부적절·정책 위험).
  if (isNonCommercialKeyword(text)) return null;

  // ① 등록 상품: 명시 매칭 우선 → 없으면 활성 상품 중 토큰 겹침 최고
  const explicit = await prisma.product.findFirst({
    where: { status: "ACTIVE", matchedKeywordId: keywordId },
    orderBy: { createdAt: "asc" },
  });
  let chosen = explicit;
  if (!chosen) {
    const actives = await prisma.product.findMany({ where: { status: "ACTIVE" }, take: 200 });
    let bestScore = 0;
    for (const p of actives) {
      const score = overlapScore({ name: p.name, brand: p.brand }, text);
      if (score >= 1 && score > bestScore) {
        bestScore = score;
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
    // 스포츠·연예·정치·사건사고는 글로 쓰지 않는다 (수집 필터를 통과해 들어온 옛 키워드 방어).
    if (isExcludedTopic(rec.keyword.text)) {
      await prisma.keyword.update({ where: { id: rec.keywordId }, data: { status: "EXCLUDED" } }).catch(() => undefined);
      continue;
    }
    try {
      // 제휴 수익화: 키워드에 어울리는 상품(등록 상품 우선)을 붙이면 배너·딥링크·대가성 문구가 자동 삽입된다.
      const product = await findProductForKeyword(rec.keywordId, rec.keyword.text);
      const result = await generateArticle({
        keywordId: rec.keywordId,
        articleType: suggestArticleType(rec.keyword.text, rec.keyword.sourceType, rec.keyword.searchIntent),
        language: "ko",
        schemaTypes: ["BlogPosting", "FAQPage"],
        product: product ?? undefined,
      });
      // 원스톱: 85점 미만 자동 보정 + 이미지 3장 자동 생성 → 검토만 하면 되는 완성 글
      await finishArticlePipeline(result.articleId, result.qualityScore);
      made += 1;
    } catch (error) {
      // 중복(409)이면 그 키워드는 이미 다룬 소재다 — 그대로 두면 회차마다(하루 4회) 계속 재시도된다.
      // EXCLUDED 로 내려 다음 키워드로 넘어간다.
      if ((error as { status?: number }).status === 409) {
        console.log(`[scheduler] 중복 소재 스킵 (${rec.keyword.text}): ${(error as Error).message}`);
        await prisma.keyword
          .update({ where: { id: rec.keywordId }, data: { status: "EXCLUDED" } })
          .catch(() => undefined);
        continue;
      }
      console.error(`[scheduler] 자동 글 생성 실패 (${rec.keyword.text}):`, (error as Error).message);
    }
  }
  return made;
}

/**
 * 누적 대량매칭(BulkMatchHit)에서 미사용 매칭을 골라 자동으로 글을 생성한다.
 * 사용자는 '매칭되는 상품 찾기'로 쌓아두기만 하면 되고, 스케줄러가 알아서 글을 만든다.
 *  - 매칭 점수 높은 순, 키워드당 1건 (중복 글 방지)
 *  - 같은 키워드로 글이 이미 있으면 소진 처리만
 *  - 등록 상품(트래킹 링크 보유)이 있으면 배너까지, 없으면 정보성 글(배너는 나중에 삽입)
 */
async function autoGenerateFromBulkMatches(count: number): Promise<number> {
  const hits = await prisma.bulkMatchHit.findMany({
    where: { usedAt: null },
    orderBy: { score: "desc" },
    take: 50,
  });
  let made = 0;
  const usedKeywords = new Set<string>();
  for (const hit of hits) {
    if (made >= count) break;
    if (usedKeywords.has(hit.keyword)) continue;
    const keyword = await prisma.keyword.findFirst({ where: { text: hit.keyword } });
    if (!keyword) continue;

    // 같은 키워드로 이미 글이 있으면 이 매칭은 소진 처리 (중복 글 방지)
    const existing = await prisma.article.findFirst({ where: { keywordId: keyword.id }, select: { id: true } });
    if (existing) {
      await prisma.bulkMatchHit
        .update({ where: { id: hit.id }, data: { usedAt: new Date(), articleId: existing.id } })
        .catch(() => undefined);
      usedKeywords.add(hit.keyword);
      continue;
    }

    try {
      const product = await findProductForKeyword(keyword.id, keyword.text);
      const result = await generateArticle({
        keywordId: keyword.id,
        articleType: suggestArticleType(keyword.text, keyword.sourceType, keyword.searchIntent),
        language: "ko",
        schemaTypes: ["BlogPosting", "FAQPage"],
        product: product ?? undefined,
      });
      await finishArticlePipeline(result.articleId, result.qualityScore);
      await prisma.bulkMatchHit
        .update({ where: { id: hit.id }, data: { usedAt: new Date(), articleId: result.articleId } })
        .catch(() => undefined);
      usedKeywords.add(hit.keyword);
      made += 1;
      console.log(`[scheduler] 매칭 기반 자동 글: "${hit.keyword}" (상품: ${hit.name.slice(0, 30)})`);
    } catch (error) {
      // 82점 이하 폐기 등 — 소진 처리하지 않고 다음 회차에 재시도
      console.error(`[scheduler] 매칭 기반 글 생성 실패 (${hit.keyword}):`, (error as Error).message);
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
          const promoMade = await autoGenerateFromBulkMatches(2);
          console.log(`[scheduler] 매칭 기반 자동 글 ${promoMade}건 생성`);
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
  } catch (error) {
    console.warn("[scheduler] 예약 실패 (DB 미연결일 수 있음):", (error as Error).message);
  }
}

/** 수동 트리거 — 지금 수집 + 자동 글 2건 (테스트/즉시 실행용) */
export async function runCollectionNow(): Promise<{ recommendedCount: number; articlesMade: number }> {
  const result = await runDailyDiscovery("manual");
  const made = await autoGenerateTopArticles(2);
  const promoMade = await autoGenerateFromBulkMatches(2);
  return { recommendedCount: result.recommendedCount, articlesMade: made + promoMade };
}
