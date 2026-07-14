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
  ages: Array<{ group: string; ratio: number }>; // group: "10" ~ "60", ratio: 최대 100 기준 상대값
  genders: Array<{ group: "f" | "m"; ratio: number }>;
  summary: string; // "40대·50대 남성" — 프롬프트에 바로 넣는 한 줄
}

interface DataLabRow {
  group?: string;
  ratio?: number;
}

const midpoint = (rows: DataLabRow[]): Array<{ group: string; ratio: number }> =>
  rows
    .filter((row): row is Required<DataLabRow> => Boolean(row.group) && typeof row.ratio === "number")
    .map((row) => ({ group: row.group, ratio: Math.round(row.ratio) }));

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
 * 키워드의 수요층을 구한다. 쇼핑 키워드가 아니면 null.
 * 30일 캐시 — 캐시가 있으면 API를 아예 안 부른다.
 */
export async function fetchDemographics(keywordId: number, keyword: string): Promise<Demographics | null> {
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

  // 카테고리를 모르니 전 카테고리를 훑어 **데이터가 가장 풍부한 곳**을 고른다.
  // (키워드에 맞는 카테고리를 틀리게 넣으면 그룹 1개짜리 빈껍데기가 온다 — 실측으로 데였다)
  let best: { category: string; ages: Array<{ group: string; ratio: number }> } | null = null;
  for (const [cid, name] of Object.entries(CATEGORIES)) {
    const ages = midpoint(await callShopping(headers, "age", cid, keyword, range));
    if (ages.length > (best?.ages.length ?? 0)) best = { category: name, ages };
    if (ages.length >= 6) break; // 전 연령대가 다 왔으면 더 볼 것 없다
  }

  const date = new Date();
  date.setHours(0, 0, 0, 0);

  // 연령대가 3개 미만이면 신호로 못 쓴다 (쇼핑 키워드가 아니거나 표본이 너무 얇다)
  if (!best || best.ages.length < 3) {
    await prisma.keywordMetric.upsert({
      where: { keywordId_date_source: { keywordId, date, source: SOURCE } },
      create: { keywordId, date, source: SOURCE, raw: { none: true } },
      update: { raw: { none: true } },
    });
    return null;
  }

  const cid = Object.entries(CATEGORIES).find(([, name]) => name === best.category)?.[0] ?? "";
  const genders = midpoint(await callShopping(headers, "gender", cid, keyword, range)).filter(
    (row): row is { group: "f" | "m"; ratio: number } => row.group === "f" || row.group === "m",
  );

  const result: Demographics = {
    category: best.category,
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
