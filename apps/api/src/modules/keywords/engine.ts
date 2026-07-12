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

    // 3) Claude로 후보 키워드 발굴·분류
    const askCount = Math.min(dailyCount * 2, 40);
    const { candidates } = await callClaudeJson<{ candidates: Candidate[] }>({
      operation: "keyword-discovery",
      maxTokens: 16000,
      system: [
        "당신은 한국어 SEO·수익형 블로그 키워드 리서처다.",
        "오늘 수집된 실시간 이슈·뉴스 목록을 분석해 블로그 글감으로 좋은 검색 키워드를 발굴한다.",
        "실제 사람들이 검색창에 입력할 형태의 한국어 키워드만 만든다 (문장 금지, 2~6어절).",
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

    // 특정 인물(연예인·스포츠 스타) 프로필·가십·근황 키워드 제외 — 홍보 가치가 낮고,
    // 초상권 문제에 더해 외국 선수 기사에 한국인 AI 이미지가 붙는 공감 실패, 상품 매칭 불가.
    const PERSON_GOSSIP =
      /프로필|본명|열애|결혼설|이혼설?|재혼|결별설?|불화설|스캔들|근황|전참시|전지적\s*참견|나\s*혼자\s*산다|나혼산|미운\s*우리\s*새끼|런닝맨|무한도전|라디오스타|유\s*퀴즈|아는\s*형님|복면가왕|출연진|등장인물|누구인가|정체는|열애설|은퇴|이적설?|이적료|영입|방출|경질|데뷔|복귀전|발탁|맹활약|해트트릭|결승골|득점왕|선발\s*명단|라인업|국가대표|올스타|시상식|수상소감|입대|전역|병역/;

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
          !excludedTexts.some((text) => normalizeKeyword(text) === normalizeKeyword(candidate.keyword)) &&
          list.findIndex((c) => normalizeKeyword(c.keyword) === normalizeKeyword(candidate.keyword)) === index,
      );

    if (cleanCandidates.length === 0) {
      throw new HttpError(502, "키워드 후보 생성에 실패했습니다.");
    }

    // 4) 실측 지표 (설정된 소스만 — 없으면 null 유지)
    const texts = cleanCandidates.map((candidate) => candidate.keyword);
    const [googleMetrics, naverMetrics, competition] = await Promise.all([
      fetchGoogleAdsMetrics(texts),
      fetchNaverSearchAdMetrics(texts),
      fetchNaverBlogCompetition(texts),
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
      const finalScore = Math.max(
        0,
        Math.round(
          opportunityScore * 0.45 + revenueScore * 0.3 + valueScore * 0.25 - (noCompetitionData ? 8 : 0),
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

      // 빅데이터 시계열 스냅샷 — 각 수집의 상위 10위(엑기스)만 append. 조회 시 하루 4회를 취합해 재랭크한다.
      if (rank <= 10)
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
