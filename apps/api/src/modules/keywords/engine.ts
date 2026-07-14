import { prisma } from "../../common/prisma.js";
import { HttpError } from "../../common/http.js";
import { getSettingValues } from "../settings/settings.service.js";
import { callClaudeJson } from "../ai/claude.js";
import { collectDailyIssues } from "./collectors.js";
import {
  fetchGoogleAdsMetrics,
  fetchNaverSearchAdMetrics,
  normalizeKeyword,
  type KeywordMetricData,
} from "./metrics.js";
import { fetchNaverBlogCompetition, lowCompetitionScore } from "./competition.js";
import { trendSignals } from "./trend-signal.js";
import { findNearDuplicate } from "./near-duplicate.js";
import { bestKeywordForProduct } from "../products/product-match.js";

/**
 * 아직 키워드에 매칭 안 된 등록 상품을, 현재 키워드 풀 기준으로 다시 매칭한다.
 * 새로 매칭되면 matchedAt을 갱신해 프론트에서 '매칭완료' 알림·뱃지를 띄운다.
 */
async function rematchUnmatchedProducts(): Promise<void> {
  const unmatched = await prisma.product.findMany({
    where: { status: "ACTIVE", matchedKeywordId: null },
    select: { id: true, name: true, brand: true },
  });
  if (unmatched.length === 0) return;
  const pool = await prisma.keyword.findMany({
    where: { status: { in: ["RECOMMENDED", "SAVED"] } },
    orderBy: { updatedAt: "desc" },
    take: 500,
    select: { id: true, text: true },
  });
  for (const product of unmatched) {
    const match = bestKeywordForProduct({ name: product.name, brand: product.brand }, pool);
    if (match) {
      await prisma.product
        .update({ where: { id: product.id }, data: { matchedKeywordId: match.keyword.id, matchedAt: new Date() } })
        .catch(() => undefined);
    }
  }
}

interface Candidate {
  keyword: string;
  type: "ISSUE" | "EVERGREEN" | "REVENUE";
  category: string;
  searchIntent: string;
  commercialIntent: number;
  freshness: number;
  problemSolving: number;
  contentGap: number;
  reason: string;
}

export interface DiscoveryResult {
  date: string;
  issuesCollected: Record<string, number>;
  candidateCount: number;
  recommendedCount: number;
  metrics: { googleAds: number; naverSearchAd: number };
}

let running = false;

// 제외 주제: 스포츠·연예(인물 가십/근황)·정치 — 홍보 가치 낮고, 초상권/공감 실패, 상품 매칭 불가.
const PERSON_GOSSIP =
  /프로필|본명|열애|결혼설|이혼설?|재혼|결별설?|불화설|스캔들|근황|전참시|전지적\s*참견|나\s*혼자\s*산다|나혼산|미운\s*우리\s*새끼|런닝맨|무한도전|라디오스타|유\s*퀴즈|아는\s*형님|복면가왕|출연진|등장인물|누구인가|정체는|열애설|은퇴|이적설?|이적료|영입|방출|경질|데뷔|복귀전|발탁|맹활약|해트트릭|결승골|득점왕|선발\s*명단|라인업|국가대표|올스타|시상식|수상소감|입대|전역|병역/;
// 스포츠 종목·리그·경기
const SPORTS =
  /축구|야구|농구|배구|골프|테니스|올림픽|월드컵|아시안게임|프리미어리그|분데스리가|라리가|챔스|챔피언스리그|kbo|mlb|epl|nba|손흥민|이강인|김민재|류현진|프로야구|프로축구|경기\s*결과|경기\s*일정|중계|하이라이트|선발\s*투수|타율|골\s*장면/i;
// 정치·정당·선거·정부 인사
const POLITICS =
  /정치|정당|여당|야당|국회|의원|대통령|장관|총리|청와대|대통령실|선거|공천|탄핵|개헌|국정감사|여론조사|지지율|민주당|국민의힘|조국|이재명|윤석열|한동훈|대선|총선|지방선거|정상회담|외교|규탄|시위|집회|성명|브리핑/;
// 사건·사고·재난·논란 — 피해자가 있는 소재라 홍보·수익 목적 글로 다루면 안 된다.
// ("장윤기 사건 정리", "구자욱 정수빈 논란", "관람차 추락 사고 환불 방법" 류가 여기서 걸린다.)
const INCIDENT =
  /사건|사고|논란|의혹|폭로|고소|고발|기소|구속|체포|수사|재판|판결|형량|피의자|가해자|피해자|유족|참사|재난|추락|붕괴|화재|폭발|침몰|실종|사망|숨져|부상자|중상|압사|충돌|전복|누출|감전|익사|투신|살인|폭행|성범죄|음주운전|뺑소니|학대|괴롭힘|갑질|리콜|결함|급발진/;
/** 수집·자동작성에서 제외할 주제인가 — 스포츠·연예·정치·사건사고. 다른 모듈에서도 재사용한다. */
export const isExcludedTopic = (kw: string): boolean =>
  PERSON_GOSSIP.test(kw) || SPORTS.test(kw) || POLITICS.test(kw) || INCIDENT.test(kw);

/** KST 기준 오늘 날짜 (Prisma @db.Date 저장용) */
export function kstToday(): { ymd: string; date: Date } {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  return { ymd, date: new Date(`${ymd}T00:00:00.000Z`) };
}

const clamp = (value: unknown, min = 0, max = 100) =>
  Math.min(max, Math.max(min, Number(value) || 0));

function logScore(value: number | null, max: number): number | null {
  if (value === null || value <= 0 || max <= 0) return value === null ? null : 0;
  return Math.round((Math.log10(value + 1) / Math.log10(max + 1)) * 100);
}

/** 가용한 컴포넌트만으로 가중 평균 (없는 데이터는 임의 생성하지 않고 가중치 재분배) */
function weighted(parts: Array<{ score: number | null; weight: number }>): number {
  const available = parts.filter((part) => part.score !== null);
  const totalWeight = available.reduce((sum, part) => sum + part.weight, 0);
  if (totalWeight === 0) return 0;
  return Math.round(
    available.reduce((sum, part) => sum + (part.score as number) * part.weight, 0) / totalWeight,
  );
}

export async function runDailyDiscovery(trigger: "cron" | "manual"): Promise<DiscoveryResult> {
  if (running) {
    throw new HttpError(409, "키워드 수집이 이미 진행 중입니다.");
  }
  running = true;

  try {
    const settings = await getSettingValues([
      "keywords.dailyCount",
      "keywords.issueRatio",
      "keywords.evergreenRatio",
      "keywords.revenueRatio",
    ]);
    const dailyCount = clamp(settings["keywords.dailyCount"], 5, 50) || 20;
    const ratios = {
      issue: clamp(settings["keywords.issueRatio"], 0, 100) || 20,
      evergreen: clamp(settings["keywords.evergreenRatio"], 0, 100) || 50,
      revenue: clamp(settings["keywords.revenueRatio"], 0, 100) || 30,
    };

    // 1) 오늘의 이슈 수집
    const { issues, sources } = await collectDailyIssues();
    if (issues.length === 0) {
      throw new HttpError(502, "이슈 수집에 실패했습니다. 네트워크 상태를 확인해주세요.");
    }

    // 2) 최근 사용·제외·추천된 키워드는 중복 추천하지 않는다
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const existing = await prisma.keyword.findMany({
      where: {
        OR: [
          { status: { in: ["USED", "EXCLUDED"] } },
          { recommendations: { some: { createdAt: { gte: cutoff } } } },
        ],
      },
      select: { text: true },
    });
    const excludedTexts = existing.map((row) => row.text);

    // 근접 중복 비교 대상은 '모든' 키워드다. 위 existing은 USED·EXCLUDED·최근 추천만 담아서,
    // 아직 안 쓴 추천 키워드끼리의 중복(실제로 가장 많았다)을 못 걸렀다.
    const allKeywordTexts = (await prisma.keyword.findMany({ select: { text: true } })).map((row) => row.text);

    // 3) 연관 키워드 확장 — 네이버 검색광고가 힌트당 수백 개를 검색량과 함께 돌려준다.
    //    (예전엔 이 응답에서 물어본 키워드만 쓰고 **나머지를 전부 버렸다** — 공짜 발굴 소스를 낭비)
    //    실제 검색량이 붙은 '사람들이 진짜 치는 말'이라, Claude가 상상해낸 후보보다 신뢰도가 높다.
    const hintPool = issues.slice(0, 10).map((issue) => issue.title.replace(/\s+/g, "").slice(0, 20));
    const { fetchRelatedKeywords } = await import("./related-keywords.js");
    const related = await fetchRelatedKeywords(hintPool, 60).catch(() => []);
    // 브랜드 단품·이미 다룬 것·제외 주제는 걸러낸다 (그대로 쓰면 블로그 주제로 안 맞는 게 섞인다)
    const relatedClean = related
      .filter((row) => row.monthlySearches >= 500) // 검색량 없는 롱테일은 글로 쓸 가치가 낮다
      .filter((row) => !isExcludedTopic(row.keyword))
      .filter((row) => !excludedTexts.some((text) => normalizeKeyword(text) === normalizeKeyword(row.keyword)))
      .slice(0, 40);
    if (relatedClean.length > 0) {
      console.log(`[keywords] 연관 키워드 ${relatedClean.length}개 확보 (네이버 실측 검색량 포함)`);
    }

    // 4) Claude로 후보 키워드 발굴·분류
    const askCount = Math.min(dailyCount * 2, 40);
    const { candidates } = await callClaudeJson<{ candidates: Candidate[] }>({
      operation: "keyword-discovery",
      maxTokens: 16000,
      system: [
        "당신은 한국어 SEO·수익형 블로그 키워드 리서처다.",
        "오늘 수집된 실시간 이슈·뉴스 목록을 분석해 블로그 글감으로 좋은 검색 키워드를 발굴한다.",
        "실제 사람들이 검색창에 입력할 형태의 한국어 키워드만 만든다 (문장 금지, 2~6어절).",
        "userPayload.relatedKeywordsWithVolume 은 네이버가 **실측한 월간 검색량**이 붙은 실제 검색어다(추측 아님).",
        "이 목록을 적극 활용해 후보를 만들어라 — 다만 그대로 베끼지 말고, 오늘의 이슈와 결합해 '글이 될 만한 형태'로 다듬는다.",
        "(예: 연관어 '골전도이어폰'(74,700) + 이슈 → '골전도이어폰 추천 2026 러닝용 비교')",
        "검색량이 큰 단어를 무작정 고르지 마라. 경쟁이 세다 — 검색량과 '우리가 이길 수 있는가'를 함께 본다.",
        "검증 불가능한 수치나 통계를 만들지 않는다.",
        "반드시 JSON만 출력한다.",
      ].join(" "),
      user: JSON.stringify({
        task: `오늘의 이슈에서 블로그 키워드 후보 ${askCount}개 발굴`,
        typeRatioPercent: {
          ISSUE: ratios.issue,
          EVERGREEN: ratios.evergreen,
          REVENUE: ratios.revenue,
        },
        typeGuide: {
          ISSUE: "오늘 이슈에서 파생된 시의성 키워드 (발행 시급, 수명 짧음)",
          EVERGREEN: "이슈와 연관되지만 꾸준히 검색되는 정보성 키워드 (방법·조건·비용·비교)",
          REVENUE: "구매·신청·가입 의도가 높은 상업형 키워드",
        },
        excludeKeywords: excludedTexts.slice(0, 300),
        // 네이버가 실측한 '사람들이 실제로 검색하는 말' — 상상이 아니라 관측이다
        relatedKeywordsWithVolume: relatedClean.map((row) => ({
          keyword: row.keyword,
          monthlySearches: row.monthlySearches,
          competition: row.competition,
        })),
        todaysIssues: issues.slice(0, 120).map((issue) => ({
          title: issue.title,
          source: issue.source,
          traffic: issue.traffic,
        })),
        outputFormat: {
          candidates: [
            {
              keyword: "검색 키워드",
              type: "ISSUE|EVERGREEN|REVENUE",
              category: "주제 카테고리 (예: 금융, 건강, IT, 생활)",
              searchIntent: "정보탐색|비교검토|구매전환|신청전환|문제해결",
              commercialIntent: "0~100 (구매·신청 의도)",
              freshness: "0~100 (이슈 최신성·시의성)",
              problemSolving: "0~100 (독자 문제 해결 가능성)",
              contentGap: "0~100 (기존 콘텐츠 대비 정보 공백 추정)",
              reason: "추천 이유 한 문장 (근거가 된 이슈 언급)",
            },
          ],
        },
      }),
    });


    const cleanCandidates = (candidates ?? [])
      .map((candidate) => ({
        ...candidate,
        keyword: String(candidate.keyword ?? "").replace(/\s+/g, " ").trim(),
        type: (["ISSUE", "EVERGREEN", "REVENUE"].includes(candidate.type)
          ? candidate.type
          : "EVERGREEN") as Candidate["type"],
        commercialIntent: clamp(candidate.commercialIntent),
        freshness: clamp(candidate.freshness),
        problemSolving: clamp(candidate.problemSolving),
        contentGap: clamp(candidate.contentGap),
      }))
      .filter(
        (candidate, index, list) =>
          candidate.keyword.length > 1 &&
          !isExcludedTopic(candidate.keyword) &&
          !excludedTexts.some((text) => normalizeKeyword(text) === normalizeKeyword(candidate.keyword)) &&
          list.findIndex((c) => normalizeKeyword(c.keyword) === normalizeKeyword(candidate.keyword)) === index,
      )
      // 근접 중복 제거 — 위 필터는 '완전일치'만 잡아서 단어 순서만 바꾼 키워드가 통과했다.
      // (예: "폭염 전기세 에어컨 절약법" vs "폭염 에어컨 전기세 절약법")
      // 실측 지표(검색량·경쟁문서) 조회 '전에' 걸러야 쓸데없는 API 호출도 아낀다.
      .filter((candidate, index, list) => {
        const dupOfExisting = findNearDuplicate(candidate.keyword, allKeywordTexts);
        if (dupOfExisting) {
          console.log(`[keywords] 근접 중복 제외: "${candidate.keyword}" ≈ 기존 "${dupOfExisting}"`);
          return false;
        }
        // 이번 배치 안에서의 중복 — 먼저 나온 후보(= Claude가 더 적합하다고 본 것)를 남긴다
        const dupOfEarlier = findNearDuplicate(
          candidate.keyword,
          list.slice(0, index).map((c) => c.keyword),
        );
        if (dupOfEarlier) {
          console.log(`[keywords] 근접 중복 제외: "${candidate.keyword}" ≈ "${dupOfEarlier}" (같은 배치)`);
          return false;
        }
        return true;
      });

    if (cleanCandidates.length === 0) {
      throw new HttpError(502, "키워드 후보 생성에 실패했습니다.");
    }

    // 4) 실측 지표 (설정된 소스만 — 없으면 null 유지)
    const texts = cleanCandidates.map((candidate) => candidate.keyword);
    const [googleMetrics, naverMetrics, competition, trendMomentum] = await Promise.all([
      fetchGoogleAdsMetrics(texts),
      fetchNaverSearchAdMetrics(texts),
      fetchNaverBlogCompetition(texts),
      // 시계열 모멘텀 — 순위가 오르고 며칠째 지속되는 키워드를 우선한다 (기록만 되던 데이터를 실제로 쓴다)
      trendSignals(7).catch(() => new Map()),
    ]);

    // 5) 점수 계산
    const maxVolume = Math.max(
      1,
      ...[...googleMetrics.values(), ...naverMetrics.values()].map(
        (metric) => metric.avgMonthlySearches ?? 0,
      ),
    );
    const maxCpc = Math.max(
      1,
      ...[...googleMetrics.values()].map((metric) => Number(metric.cpcMicros ?? 0)),
    );

    const scored = cleanCandidates.map((candidate) => {
      const key = normalizeKeyword(candidate.keyword);
      const trend = trendMomentum.get(key) ?? null;
      const google = googleMetrics.get(key) ?? null;
      const naver = naverMetrics.get(key) ?? null;
      const volume = google?.avgMonthlySearches ?? naver?.avgMonthlySearches ?? null;
      const cpc = google?.cpcMicros !== null && google?.cpcMicros !== undefined
        ? Number(google.cpcMicros)
        : null;

      const comp = competition.get(key) ?? null;
      const totalDocs = comp?.totalDocs ?? null;

      // 수익 가능성: CPC·구매의도·검색량. 신생 블로그라 검색량 비중은 낮춘다(검색량↑=경쟁↑).
      const revenueScore = weighted([
        { score: cpc !== null ? logScore(cpc, maxCpc) : null, weight: 0.35 },
        { score: candidate.commercialIntent, weight: 0.4 },
        { score: volume !== null ? logScore(volume, maxVolume) : null, weight: 0.15 },
        { score: google?.competitionIndex ?? null, weight: 0.1 },
      ]);

      // 콘텐츠 가치: 이슈 시의성·문제 해결
      const valueScore = weighted([
        { score: candidate.freshness, weight: 0.4 },
        { score: candidate.problemSolving, weight: 0.4 },
        { score: candidate.contentGap, weight: 0.2 },
      ]);

      // 상위노출 기회 = 경쟁 효율(검색량÷경쟁문서)이 핵심. 신생 블로그가 실제로 이길 수 있는지.
      const competitionScore = lowCompetitionScore(volume, totalDocs);
      const opportunityScore = weighted([
        { score: competitionScore, weight: 0.7 },
        { score: candidate.contentGap, weight: 0.15 },
        {
          score: google?.competitionIndex !== null && google?.competitionIndex !== undefined
            ? 100 - google.competitionIndex
            : null,
          weight: 0.15,
        },
      ]);

      // 신생 블로그 목표(조회수) → 상위노출 기회 45%, 수익 30%, 가치 25%.
      // 단 경쟁문서를 아직 못 구한 키워드는 기회 점수 신뢰도가 낮아 소폭 감점.
      const noCompetitionData = totalDocs === null;
      // 트렌드 모멘텀(-20~+20) — 순위가 오르고 며칠째 지속되는 키워드를 위로 올린다.
      // 그동안 시계열은 기록만 되고 선정에 전혀 안 쓰였다.
      const momentum = trend?.momentum ?? 0;
      const finalScore = Math.max(
        0,
        Math.round(
          opportunityScore * 0.45 +
            revenueScore * 0.3 +
            valueScore * 0.25 -
            (noCompetitionData ? 8 : 0) +
            momentum * 0.5,
        ),
      );

      return {
        candidate, google, naver, volume, revenueScore, valueScore, opportunityScore,
        competitionScore, finalScore, totalDocs,
      };
    });

    scored.sort((a, b) => b.finalScore - a.finalScore);
    const top = scored.slice(0, dailyCount);

    // 6) 저장 — 하루 4회 수집을 누적한다 (같은 키워드가 여러 회차에 나오면 중복 신호)
    const { date, ymd } = kstToday();
    const [ty, tm, td] = ymd.split("-").map(Number);
    let rank = 0;
    for (const row of top) {
      rank += 1;
      const keyword = await prisma.keyword.upsert({
        where: { text: row.candidate.keyword },
        update: {
          category: row.candidate.category,
          sourceType: row.candidate.type,
          searchIntent: row.candidate.searchIntent,
        },
        create: {
          text: row.candidate.keyword,
          category: row.candidate.category,
          sourceType: row.candidate.type,
          searchIntent: row.candidate.searchIntent,
          status: "RECOMMENDED",
        },
      });

      for (const metric of [row.google, row.naver]) {
        if (!metric) continue;
        await prisma.keywordMetric.upsert({
          where: {
            keywordId_date_source: { keywordId: keyword.id, date, source: metric.source },
          },
          update: {
            avgMonthlySearches: metric.avgMonthlySearches,
            cpcMicros: metric.cpcMicros,
            currency: metric.currency,
            competition: metric.competition,
            competitionIndex: metric.competitionIndex,
          },
          create: {
            keywordId: keyword.id,
            date,
            source: metric.source,
            avgMonthlySearches: metric.avgMonthlySearches,
            cpcMicros: metric.cpcMicros,
            currency: metric.currency,
            competition: metric.competition,
            competitionIndex: metric.competitionIndex,
          },
        });
      }

      await prisma.dailyKeywordRecommendation.upsert({
        where: { keywordId_date: { keywordId: keyword.id, date } },
        update: {
          rank,
          reason: row.candidate.reason,
          revenueScore: row.revenueScore,
          valueScore: row.valueScore,
          opportunityScore: row.opportunityScore,
          finalScore: row.finalScore,
          data: {
            trigger,
            type: row.candidate.type,
            category: row.candidate.category,
            totalDocs: row.totalDocs,
            competitionScore: row.competitionScore,
          },
        },
        create: {
          keywordId: keyword.id,
          date,
          rank,
          reason: row.candidate.reason,
          revenueScore: row.revenueScore,
          valueScore: row.valueScore,
          opportunityScore: row.opportunityScore,
          finalScore: row.finalScore,
          data: {
            trigger,
            type: row.candidate.type,
            category: row.candidate.category,
            totalDocs: row.totalDocs,
            competitionScore: row.competitionScore,
          },
        },
      });

      // 빅데이터 시계열 스냅샷 — 추천된 키워드 전체를 append 한다.
      // ⚠️ 예전엔 상위 10위만 저장했는데, 키워드가 회차마다 바뀌어 **같은 키워드의 이력이 안 쌓였다.**
      //    점이 하나뿐이면 기울기(모멘텀)를 못 그린다 — 190행이 쌓였는데 전부 "오늘 처음 등장"이었다.
      if (rank <= 30)
      await prisma.keywordTrend
        .create({
          data: {
            keywordId: keyword.id,
            keywordText: keyword.text,
            category: row.candidate.category,
            sourceType: row.candidate.type,
            date,
            year: ty,
            month: tm,
            day: td,
            trigger,
            naverSearches: row.naver?.avgMonthlySearches ?? null,
            googleSearches: row.google?.avgMonthlySearches ?? null,
            searchVolume: row.naver?.avgMonthlySearches ?? row.google?.avgMonthlySearches ?? null,
            competitionScore: row.competitionScore ?? null,
            totalDocs: row.totalDocs ?? null,
            revenueScore: row.revenueScore,
            valueScore: row.valueScore,
            opportunityScore: row.opportunityScore,
            finalScore: row.finalScore,
            rank,
          },
        })
        .catch(() => undefined);
    }

    // 미매칭 상품 재매칭 — 키워드 풀이 늘면 뒤늦게 어울리는 키워드가 생길 수 있다.
    await rematchUnmatchedProducts();

    return {
      date: kstToday().ymd,
      issuesCollected: sources,
      candidateCount: cleanCandidates.length,
      recommendedCount: top.length,
      metrics: { googleAds: googleMetrics.size, naverSearchAd: naverMetrics.size },
    };
  } finally {
    running = false;
  }
}

export function isDiscoveryRunning(): boolean {
  return running;
}
