import { prisma } from "../../../common/prisma.js";
import { getSettingValues } from "../../settings/settings.service.js";

/**
 * Search Console 성과 수집 — 페이지별 노출수·클릭수·CTR·평균순위를 받아
 * `publish_jobs.publishedUrl` 과 매칭해 **글 단위 성과**로 저장한다.
 *
 * ⚠️ GSC 데이터는 2~3일 지연된다. 어제 데이터를 조회하면 대개 비어 있으므로
 *    기본 조회 구간을 '3일 전 ~ 2일 전'으로 잡는다.
 * ⚠️ 네이버 블로그는 GSC 대상이 아니다(네이버 서치어드바이저 별도) — 여기서는 수집하지 않는다.
 */

interface GscRow {
  keys: string[]; // [date, page]
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

async function accessToken(): Promise<string> {
  const values = await getSettingValues([
    "blogger.clientId",
    "blogger.clientSecret",
    "google.analyticsRefreshToken",
  ]);
  const clientId = values["blogger.clientId"];
  const clientSecret = values["blogger.clientSecret"];
  const refreshToken = values["google.analyticsRefreshToken"];
  if (!clientId || !clientSecret || !refreshToken) {
    // 조용히 0건 수집으로 넘어가면 "성과가 없다"고 착각한다 — 설정 누락은 설정 누락으로 보고한다
    throw new Error(
      "구글 성과수집 토큰이 없습니다. 설정 → 구글 연결(재동의)을 먼저 진행하세요.",
    );
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json()) as { access_token?: string; error_description?: string };
  if (!data.access_token) {
    throw new Error(`구글 토큰 갱신 실패: ${data.error_description ?? "토큰 없음"}`);
  }
  return data.access_token;
}

/** 등록된 GSC 속성 목록 — 설정에 없으면 API로 조회해 쓴다 */
async function siteUrls(token: string): Promise<string[]> {
  const values = await getSettingValues(["gsc.siteUrls"]);
  const configured = (values["gsc.siteUrls"] ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (configured.length > 0) return configured;

  const res = await fetch("https://searchconsole.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    // 본문을 함께 보여준다 — 403은 'API 미사용 설정' vs '권한 없음'이 완전히 다른 문제인데
    // 상태코드만 보면 구분이 안 돼 엉뚱한 곳을 뒤지게 된다.
    const body = await res.text();
    throw new Error(`GSC 속성 목록 조회 실패 (HTTP ${res.status}): ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    siteEntry?: Array<{ siteUrl: string; permissionLevel: string }>;
  };
  const verified = (data.siteEntry ?? [])
    .filter((entry) => entry.permissionLevel !== "siteUnverifiedUser")
    .map((entry) => entry.siteUrl);

  // ⚠️ 이 구글 계정에는 **우리 블로그가 아닌 사이트**도 등록돼 있다(실제로 mondayproject.co.kr가 섞여 들어와
  //    그 사이트의 성과 행을 우리 글에 매칭하려다 전부 unmatched 로 버려지고 있었다).
  //    우리가 **실제로 발행한 호스트**만 남긴다 — 발행 기록이 정답이지, 계정에 뭐가 등록됐는지는 우리 소관이 아니다.
  const published = await prisma.publishJob.findMany({
    where: { publishedUrl: { not: null } },
    select: { publishedUrl: true },
    distinct: ["publishedUrl"],
  });
  const ourHosts = new Set<string>();
  for (const job of published) {
    try {
      ourHosts.add(new URL(job.publishedUrl!).hostname);
    } catch {
      // 발행 URL이 깨져 있으면 그냥 건너뛴다
    }
  }
  if (ourHosts.size === 0) return verified; // 아직 발행 기록이 없으면 거를 근거가 없다

  return verified.filter((siteUrl) => {
    try {
      return ourHosts.has(new URL(siteUrl).hostname);
    } catch {
      return false;
    }
  });
}

/** 한 속성의 일자·페이지별 성과 */
async function queryRows(token: string, siteUrl: string, start: string, end: string): Promise<GscRow[]> {
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: start,
        endDate: end,
        dimensions: ["date", "page"],
        // ⚠️ 학습에는 **확정(final) 데이터만** 쓴다. "all"로 바꾸면 최신 2~3일의 미확정값이 섞여
        //    아직 덜 집계된 수치를 성과로 착각해 학습한다. 기본값이 final이지만 명시해 둔다.
        dataState: "final",
        rowLimit: 5000,
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GSC 조회 실패 ${siteUrl} (HTTP ${res.status}): ${body.slice(0, 120)}`);
  }
  const data = (await res.json()) as { rows?: GscRow[] };
  return data.rows ?? [];
}

/**
 * 발행 URL → articleId 맵.
 *
 * ⚠️ 한 정규화 키에 **두 개 이상의 글**이 걸리면 그 키는 통째로 버린다(AMBIGUOUS).
 *    억지로 하나를 고르면 남의 글 성과가 내 글에 붙는다 — 잘못된 성과로 학습하면
 *    데이터가 없는 것보다 나쁘다.
 */
async function urlToArticle(): Promise<{ map: Map<string, number>; ambiguous: string[] }> {
  const jobs = await prisma.publishJob.findMany({
    where: { publishedUrl: { not: null } },
    select: { articleId: true, publishedUrl: true },
  });

  const byKey = new Map<string, Set<number>>();
  for (const job of jobs) {
    if (!job.publishedUrl) continue;
    // 원본 주소 + 리다이렉트 최종 주소 + canonical — 셋 다 키로 등록해 어느 형태로 보고돼도 잡는다
    for (const form of await canonicalOf(job.publishedUrl)) {
      const key = normalizeUrl(form);
      const set = byKey.get(key) ?? new Set<number>();
      set.add(job.articleId);
      byKey.set(key, set);
    }
  }

  const map = new Map<string, number>();
  const ambiguous: string[] = [];
  for (const [key, ids] of byKey) {
    if (ids.size === 1) map.set(key, [...ids][0]);
    else ambiguous.push(key); // 같은 주소에 여러 글 — 어느 글의 성과인지 알 수 없다
  }
  return { map, ambiguous };
}

/**
 * 발행 URL의 **최종 주소**를 알아낸다 — GSC는 canonical 기준으로 집계한다.
 * 워드프레스가 `?p=6`을 예쁜 주소로 리다이렉트하거나 canonical을 따로 지정하면,
 * 우리가 저장한 주소와 GSC가 보고하는 주소가 **다르다** → 전부 미매칭이 된다.
 *
 * 실패하면 원본을 그대로 쓴다(네트워크 오류를 '주소가 바뀌었다'로 오판하지 않는다).
 */
const canonicalCache = new Map<string, string[]>();

async function canonicalOf(raw: string): Promise<string[]> {
  const cached = canonicalCache.get(raw);
  if (cached) return cached;

  const forms = new Set<string>([raw]);
  try {
    const res = await fetch(raw, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; goBlog/1.0)" },
      redirect: "follow",
    });
    if (res.url && res.url !== raw) forms.add(res.url); // 리다이렉트 최종 주소
    const html = await res.text();
    const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1];
    if (canonical) forms.add(canonical);
  } catch {
    // 네트워크 실패 — 원본만 쓴다 (다음 실행에서 다시 시도하도록 캐시에 넣지 않는다)
    return [...forms];
  }
  const result = [...forms];
  canonicalCache.set(raw, result);
  return result;
}

/** 추적용 파라미터만 버리고, 글을 식별하는 쿼리(?p=6 같은 것)는 반드시 남긴다 */
const TRACKING_PARAMS = /^(utm_|fbclid|gclid|msclkid|ref|source|napm|originchannelinfo)/i;

function normalizeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    // ⚠️ 쿼리를 통째로 버리면 안 된다.
    //    워드프레스 기본 퍼머링크는 `?p=6` 형태라, 쿼리를 버리면 **모든 글이 같은 키로 뭉개진다**
    //    (실제로 그랬다 — 44개 글의 성과가 한 글에 몰아서 붙을 뻔했다).
    const params = [...url.searchParams.entries()]
      .filter(([key]) => !TRACKING_PARAMS.test(key))
      .sort(([a], [b]) => a.localeCompare(b));
    const query = params.length > 0 ? `?${params.map(([k, v]) => `${k}=${v}`).join("&")}` : "";
    const host = url.hostname.replace(/^www\./, "");
    const path = url.pathname.replace(/\/+$/, "");
    return `${host}${path}${query}`.toLowerCase();
  } catch {
    return raw.replace(/\/+$/, "").toLowerCase();
  }
}

/**
 * 어제까지의 성과를 수집해 저장한다 (기본: 3일 전 ~ 2일 전 — GSC 지연 감안).
 * 같은 (날짜, 글, 출처)는 덮어쓴다 — 하루에 여러 번 돌려도 중복되지 않는다.
 */
export async function collectSearchConsole(daysBack = 3): Promise<{
  sites: number;
  rows: number;
  matched: number;
  unmatched: number;
  unmatchedSamples: string[];
  ambiguous: string[]; // 같은 주소에 여러 글이 걸려 제외된 키 (수집 성공과 구분해야 한다)
}> {
  const token = await accessToken();
  const sites = await siteUrls(token);
  if (sites.length === 0) {
    throw new Error("Search Console에 확인된 속성이 없습니다. 사이트 등록·소유확인을 먼저 하세요.");
  }

  const end = new Date();
  end.setDate(end.getDate() - 2); // GSC 지연
  const start = new Date();
  start.setDate(start.getDate() - daysBack);
  const iso = (date: Date) => date.toISOString().slice(0, 10);

  const { map: articleMap, ambiguous } = await urlToArticle();
  if (ambiguous.length > 0) {
    // 조용히 넘기지 않는다 — 같은 주소를 쓰는 글이 있다는 건 발행 URL 기록이 잘못됐다는 뜻이다
    console.warn(
      `[gsc] ⚠️ 같은 URL에 여러 글이 걸려 성과 매칭에서 제외: ${ambiguous.slice(0, 3).join(", ")}${ambiguous.length > 3 ? ` 외 ${ambiguous.length - 3}건` : ""}`,
    );
  }
  let rowCount = 0;
  let matched = 0;
  let unmatched = 0;
  // 매칭이 0건일 때 "성과가 없다"와 "URL이 안 맞는다"를 구분하려면 실제 주소를 봐야 한다
  const unmatchedSamples: string[] = [];

  for (const site of sites) {
    const rows = await queryRows(token, site, iso(start), iso(end));
    rowCount += rows.length;

    for (const row of rows) {
      const [dateKey, page] = row.keys;
      const articleId = articleMap.get(normalizeUrl(page)) ?? null;
      if (articleId) {
        matched += 1;
      } else {
        unmatched += 1;
        if (unmatchedSamples.length < 5) unmatchedSamples.push(page);
      }

      // 글과 못 이은 페이지(목록·태그 페이지 등)는 저장하지 않는다 — 글 단위 성과만 다룬다
      if (!articleId) continue;

      // 정합성 — 클릭이 노출보다 많을 수는 없다. 이런 행은 저장하지 않는다(오염된 값으로 학습 금지).
      if (row.clicks > row.impressions) {
        console.warn(`[gsc] ⚠️ 불가능한 값 무시 (클릭 ${row.clicks} > 노출 ${row.impressions}): ${page}`);
        continue;
      }

      const date = new Date(`${dateKey}T00:00:00.000Z`);
      const data = {
        date,
        articleId,
        source: "SEARCH_CONSOLE",
        impressions: Math.round(row.impressions),
        clicks: Math.round(row.clicks),
        avgPosition: row.position,
        raw: { site, page, ctr: row.ctr },
      };
      await prisma.analyticsDaily.upsert({
        where: { date_articleId_source: { date, articleId, source: "SEARCH_CONSOLE" } },
        update: data,
        create: data,
      });
    }
  }

  return { sites: sites.length, rows: rowCount, matched, unmatched, unmatchedSamples, ambiguous };
}
