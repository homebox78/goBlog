import { prisma } from "../../common/prisma.js";
import { getSettingValues } from "../settings/settings.service.js";

/**
 * 연령·성별 수요층 — **누가 이걸 검색하는가**를 알아야 말투·예시·상품을 맞출 수 있다.
 *
 * ⚠️ 데이터랩 **검색** API로는 이걸 못 구한다 (실측으로 확인함).
 *    ages/gender 필터를 받긴 하는데, 응답의 ratio가 **요청마다 자기 최대값을 100으로** 다시 정규화된다.
 *    그래서 "10대 임플란트 100"과 "50대 임플란트 100"이 나란히 나온다 — 시간 변화만 담겨 있고
 *    **그룹 간 비중은 담겨 있지 않다.** 이걸 비중으로 읽으면 완전히 틀린 타깃을 잡는다.
 *
 * ✅ **쇼핑인사이트**는 한 응답 안에 연령대를 전부 담아 준다 → 그룹 간 비교가 유효하다.
 *    실측: 무선이어폰 = 40대(100)·50대(89) 남성 / 건강기능식품 = 50대(100) 여성.
 *
 * 한계(정직하게): **쇼핑성 키워드만 나온다.** "주택담보대출" 같은 건 어느 카테고리에도 안 잡혀 null이다.
 * 그래도 상품 배너로 수익이 나는 글이 바로 쇼핑성 글이라, 필요한 자리에는 값이 있다.
 */

const CATEGORIES: Record<string, string> = {
  "50000000": "패션의류",
  "50000001": "패션잡화",
  "50000002": "화장품/미용",
  "50000003": "디지털/가전",
  "50000004": "가구/인테리어",
  "50000005": "출산/육아",
  "50000006": "식품",
  "50000007": "스포츠/레저",
  "50000008": "생활/건강",
  "50000009": "여가/생활편의",
};

const SOURCE = "NAVER_SHOPPING_DEMO";
/** 수요층은 하루이틀에 안 바뀐다. 매번 재조회하면 데이터랩 일일 쿼터(1,000회)를 태운다. */
const CACHE_DAYS = 30;

export interface Demographics {
  category: string; // 패션의류 | 디지털/가전 ...
  term: string; // 실제로 조회에 쓴 검색어 (원문이 길면 상품명으로 줄여 물었다)
  ages: Array<{ group: string; ratio: number }>; // group: "10" ~ "60", ratio: 최대 100 기준 상대값
  genders: Array<{ group: "f" | "m"; ratio: number }>;
  summary: string; // "40대·50대 남성" — 프롬프트에 바로 넣는 한 줄
}

interface DataLabRow {
  group?: string;
  ratio?: number;
}

/**
 * 응답을 그룹별로 합친다.
 *
 * ⚠️ 네이버는 **우리가 보낸 종료일을 무시하고 오늘까지 늘려서** 돌려준다
 *    (6/30까지 요청 → 응답 endDate 7/14). 그래서 timeUnit=month면 한 그룹이 **여러 번** 나온다.
 *    이걸 안 합치면 "40대 100, 40대 96"처럼 같은 그룹이 두 줄로 잡혀 요약이 "40대·40대"가 된다.
 *    기간별 값을 평균 내고, 1위를 다시 100으로 맞춘다.
 */
const aggregate = (rows: DataLabRow[]): Array<{ group: string; ratio: number }> => {
  const sums = new Map<string, { total: number; count: number }>();
  for (const row of rows) {
    if (!row.group || typeof row.ratio !== "number") continue;
    const entry = sums.get(row.group) ?? { total: 0, count: 0 };
    entry.total += row.ratio;
    entry.count += 1;
    sums.set(row.group, entry);
  }
  const means = [...sums.entries()].map(([group, { total, count }]) => ({
    group,
    ratio: total / count,
  }));
  const max = Math.max(...means.map((row) => row.ratio), 0);
  if (max <= 0) return [];
  return means.map((row) => ({ group: row.group, ratio: Math.round((row.ratio / max) * 100) }));
};

/** 상위 그룹을 사람이 읽는 한 줄로. 1등의 60% 이상인 그룹까지 '주 수요층'으로 본다. */
function summarize(ages: Array<{ group: string; ratio: number }>, genders: Array<{ group: string; ratio: number }>): string {
  const topAges = ages
    .filter((age) => age.ratio >= 60)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 2)
    .map((age) => `${age.group}대`);
  const topGender = [...genders].sort((a, b) => b.ratio - a.ratio)[0];
  // 성별이 팽팽하면(2등이 1등의 80% 이상) 한쪽으로 몰아붙이지 않는다 — 틀린 타깃보다 무성별이 낫다
  const second = [...genders].sort((a, b) => b.ratio - a.ratio)[1];
  const skewed = topGender && (!second || second.ratio < topGender.ratio * 0.8);
  const genderLabel = skewed ? (topGender.group === "f" ? " 여성" : " 남성") : "";
  return `${topAges.join("·")}${genderLabel}`.trim();
}

/**
 * 상품명이 아닌 말들 — 붙어 있으면 쇼핑인사이트가 못 알아보거나 엉뚱한 카테고리로 샌다.
 * '배달'·'세트'처럼 **아무 상품에나 붙는 일반어**도 뺀다.
 * (실측: "여름 보양식 배달 추천"에서 '배달'로 물었더니 스포츠/레저에 잡혔다 — 완전히 틀린 타깃)
 */
const MODIFIERS =
  /^(추천|비교|후기|리뷰|가격|순위|best|베스트|고르는법|고르는|방법|정리|총정리|브랜드|인기|저렴한|싼|좋은|배달|세트|구매|할인|선물|용품|제품|상품)$/i;

/**
 * 쇼핑인사이트에 물어볼 검색어 후보를 **좁은 순서로** 만든다.
 * "여름 립틴트 추천" → ["여름 립틴트 추천", "여름 립틴트", "립틴트"]
 * 원문을 먼저 시도하는 건, 원문 그대로 값이 있으면 그게 가장 정확하기 때문이다.
 *
 * 마지막 후보는 **가장 긴 단어**다. 마지막 단어가 아니다 —
 * "여름 보양식 배달"의 마지막은 '배달'이지만 상품은 '보양식'이다.
 * 한국어에서 긴 단어일수록 구체적인 상품명일 확률이 높다.
 */
function searchVariants(keyword: string): string[] {
  const words = keyword.split(/\s+/).filter(Boolean);
  const core = words.filter((word) => !MODIFIERS.test(word));
  const longest = [...core].sort((a, b) => b.length - a.length)[0] ?? "";
  return [...new Set([keyword, core.join(" "), longest])].filter((term) => term.length >= 2);
}

async function callShopping(
  headers: Record<string, string>,
  path: "age" | "gender",
  category: string,
  keyword: string,
  range: { startDate: string; endDate: string },
): Promise<DataLabRow[]> {
  try {
    const res = await fetch(`https://openapi.naver.com/v1/datalab/shopping/category/keyword/${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...range, timeUnit: "month", category, keyword }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: Array<{ data?: DataLabRow[] }> };
    return data.results?.[0]?.data ?? [];
  } catch {
    return []; // 수요층을 못 구한다고 글 생성이 막히면 안 된다
  }
}

/**
 * 살 수 있는 물건이 아닌 주제 — 여기에 걸리면 **API를 아예 안 부른다.**
 *
 * 왜 필요한가: "비트코인 거래소 추천"이 '비트코인' 한 단어로 생활/건강(굿즈 몇 개)에 걸려
 * "50대 남성"이라는 그럴듯한 가짜 수요층을 만들어냈다. 쇼핑몰에 코인 굿즈가 팔린다고
 * 거래소를 찾는 사람의 나이가 그 나이인 건 아니다.
 *
 * 덤: 우리 키워드의 상당수가 뉴스·금융이라, 이걸 먼저 거르면 데이터랩 쿼터(하루 1,000회)를 크게 아낀다.
 */
const NOT_SHOPPING =
  /(주식|관련주|수혜주|증권|코인|비트코인|거래소|ETF|금리|대출|보험|세금|연금|청약|환율|채권|재테크|투자|판례|법안|정책|규제|사건|사고|파업|노조|지수|상장|공모|배당|실적|전망|시황)/;

/**
 * 키워드의 수요층을 구한다. 쇼핑 키워드가 아니면 null.
 * 30일 캐시 — 캐시가 있으면 API를 아예 안 부른다.
 */
export async function fetchDemographics(keywordId: number, keyword: string): Promise<Demographics | null> {
  if (NOT_SHOPPING.test(keyword)) return null;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - CACHE_DAYS);

  const cached = await prisma.keywordMetric.findFirst({
    where: { keywordId, source: SOURCE, date: { gte: cutoff } },
    orderBy: { date: "desc" },
  });
  if (cached) {
    const raw = cached.raw as (Demographics & { none?: boolean }) | null;
    // 쇼핑 키워드가 아니라고 판명난 것도 캐시한다 (매번 10회씩 헛되이 훑지 않도록)
    return raw?.none ? null : (raw ?? null);
  }

  const values = await getSettingValues(["naver.datalabClientId", "naver.datalabClientSecret"]);
  const clientId = values["naver.datalabClientId"];
  const clientSecret = values["naver.datalabClientSecret"];
  if (!clientId || !clientSecret) return null;

  const headers = {
    "X-Naver-Client-Id": clientId,
    "X-Naver-Client-Secret": clientSecret,
    "Content-Type": "application/json",
  };

  // 지난달 한 달 — 이번 달은 아직 안 끝나 데이터가 얇다
  const end = new Date();
  end.setDate(0);
  const start = new Date(end.getFullYear(), end.getMonth(), 1);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  const range = { startDate: iso(start), endDate: iso(end) };

  // ⚠️ 쇼핑인사이트는 **긴 문구를 통째로 물으면 빈손**이다 ("여름 립틴트 추천" → 0건).
  //    상품명으로 줄여서 물어야 값이 온다 ("립틴트" → 나온다).
  //    연관 키워드에서 겪은 것과 같은 함정이다.
  const variants = searchVariants(keyword);

  // 카테고리를 모르니 전 카테고리를 훑어 **데이터가 가장 풍부한 곳**을 고른다.
  // (키워드에 맞는 카테고리를 틀리게 넣으면 그룹 1개짜리 빈껍데기가 온다 — 실측으로 데였다)
  let best: { category: string; ages: Array<{ group: string; ratio: number }>; term: string } | null =
    null;
  outer: for (const term of variants) {
    for (const [cid, name] of Object.entries(CATEGORIES)) {
      const ages = aggregate(await callShopping(headers, "age", cid, term, range));
      if (ages.length > (best?.ages.length ?? 0)) best = { category: name, ages, term };
      if (ages.length >= 6) break outer; // 전 연령대가 다 왔으면 더 볼 것 없다
    }
    if (best && best.ages.length >= 5) break; // 이 변형으로 충분히 나왔다 (5개 미만은 잡음으로 본다)
  }

  const date = new Date();
  date.setHours(0, 0, 0, 0);

  // 잡음 걸러내기 — **틀린 타깃은 없는 것보다 나쁘다.**
  //
  // 실측 사고: "반도체 관련주 추천"이 '반도체' 한 단어로 생활/건강에 잡혀
  // "10대·50대"라는 수요층이 나왔다. 주식 글에 이걸 주입하면 완전히 헛다리다.
  // 쇼핑성이 아닌 키워드는 어딘가에 **얇게** 걸리고, 얇은 표본은 이렇게 튄다.
  //
  // 그래서 두 가지를 요구한다:
  //  1) 연령대가 5개 이상 (얇게 걸린 건 3~4개에서 끊긴다)
  //  2) 1위가 10대가 아닐 것 — 우리가 다루는 주제에서 10대가 쇼핑 수요 1위인 경우는 사실상 없다.
  //  3) 값이 전부 10의 배수가 아닐 것. 이게 결정적이다.
  //     실측: '항공기'는 50/100/50/100 으로 왔다 — 바구니에 몇 명 안 들어 있으면 비율이 이렇게 딱 떨어진다.
  //     반면 진짜 수요가 있는 '립틴트'는 1/6/35/100/61/18 처럼 지저분하다. **지저분한 게 진짜다.**
  const topAge = best ? [...best.ages].sort((a, b) => b.ratio - a.ratio)[0] : null;
  const noisy =
    !best ||
    best.ages.length < 5 ||
    topAge?.group === "10" ||
    best.ages.every((age) => age.ratio % 10 === 0);
  if (!best || noisy) {
    await prisma.keywordMetric.upsert({
      where: { keywordId_date_source: { keywordId, date, source: SOURCE } },
      create: { keywordId, date, source: SOURCE, raw: { none: true } },
      update: { raw: { none: true } },
    });
    return null;
  }

  // 성별은 **연령대를 찾아낸 그 검색어**로 물어야 한다 (원문으로 물으면 또 빈손이다)
  const cid = Object.entries(CATEGORIES).find(([, name]) => name === best.category)?.[0] ?? "";
  const genders = aggregate(await callShopping(headers, "gender", cid, best.term, range)).filter(
    (row): row is { group: "f" | "m"; ratio: number } => row.group === "f" || row.group === "m",
  );

  const result: Demographics = {
    category: best.category,
    term: best.term,
    ages: best.ages,
    genders,
    summary: summarize(best.ages, genders),
  };

  await prisma.keywordMetric.upsert({
    where: { keywordId_date_source: { keywordId, date, source: SOURCE } },
    create: { keywordId, date, source: SOURCE, raw: result },
    update: { raw: result },
  });

  return result;
}

/** 글 생성 프롬프트에 넣을 지시문. 수요층을 모르면 빈 문자열 (없는 걸 지어내지 않는다). */
export function demographicsPrompt(demo: Demographics | null): string {
  if (!demo || !demo.summary) return "";
  const ages = demo.ages
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 3)
    .map((age) => `${age.group}대(${age.ratio})`)
    .join(" · ");
  return [
    `## 이 키워드를 실제로 검색하는 사람 (네이버 쇼핑인사이트 실측)`,
    `- 주 수요층: **${demo.summary}**`,
    `- 연령 분포: ${ages}  (100 = 1위 그룹 기준 상대값)`,
    `- 쇼핑 카테고리: ${demo.category}`,
    ``,
    `이 층에 맞춰 써라 — 말투, 드는 예시, 가격대, 추천 상품 모두.`,
    `40~50대가 주 수요층인데 20대 밈으로 쓰면 안 읽힌다. 반대도 마찬가지다.`,
    `단, 독자를 나이로 규정하는 문장("40대라면 누구나~")은 쓰지 마라. 톤으로만 맞춘다.`,
  ].join("\n");
}
