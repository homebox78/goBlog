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
  return (data.siteEntry ?? [])
    .filter((entry) => entry.permissionLevel !== "siteUnverifiedUser")
    .map((entry) => entry.siteUrl);
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

/** 발행 URL → articleId 맵. URL 끝 슬래시·쿼리 차이를 흡수한다. */
async function urlToArticle(): Promise<Map<string, number>> {
  const jobs = await prisma.publishJob.findMany({
    where: { publishedUrl: { not: null } },
    select: { articleId: true, publishedUrl: true },
  });
  const map = new Map<string, number>();
  for (const job of jobs) {
    if (!job.publishedUrl) continue;
    map.set(normalizeUrl(job.publishedUrl), job.articleId);
  }
  return map;
}

function normalizeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`.toLowerCase();
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

  const articleMap = await urlToArticle();
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

  return { sites: sites.length, rows: rowCount, matched, unmatched, unmatchedSamples };
}
