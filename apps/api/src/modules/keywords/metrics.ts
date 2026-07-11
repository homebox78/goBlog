import crypto from "node:crypto";
import { getSettingValues } from "../settings/settings.service.js";

export interface KeywordMetricData {
  avgMonthlySearches: number | null;
  cpcMicros: bigint | null;
  currency: string | null;
  competition: string | null;
  competitionIndex: number | null;
  source: string;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Google Ads Keyword Planner — 검색량·CPC·광고 경쟁도. 미설정 시 빈 맵 반환. */
export async function fetchGoogleAdsMetrics(
  keywords: string[],
): Promise<Map<string, KeywordMetricData>> {
  const result = new Map<string, KeywordMetricData>();
  const values = await getSettingValues([
    "googleAds.developerToken",
    "googleAds.clientId",
    "googleAds.clientSecret",
    "googleAds.refreshToken",
    "googleAds.customerId",
    "googleAds.loginCustomerId",
    "googleAds.apiVersion",
  ]);

  const required = [
    "googleAds.developerToken",
    "googleAds.clientId",
    "googleAds.clientSecret",
    "googleAds.refreshToken",
    "googleAds.customerId",
  ];
  if (required.some((key) => !values[key])) return result;

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: values["googleAds.clientId"]!,
        client_secret: values["googleAds.clientSecret"]!,
        refresh_token: values["googleAds.refreshToken"]!,
        grant_type: "refresh_token",
      }),
    });
    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) return result;

    const version = values["googleAds.apiVersion"] || "v21";
    const customerId = values["googleAds.customerId"]!.replace(/\D/g, "");
    const headers: Record<string, string> = {
      Authorization: `Bearer ${tokenData.access_token}`,
      "developer-token": values["googleAds.developerToken"]!,
      "Content-Type": "application/json",
    };
    if (values["googleAds.loginCustomerId"]) {
      headers["login-customer-id"] = values["googleAds.loginCustomerId"]!.replace(/\D/g, "");
    }

    // generateKeywordIdeas는 시드 최대 20개 — 청크로 나눠 호출
    for (let i = 0; i < keywords.length; i += 20) {
      const chunk = keywords.slice(i, i + 20);
      const res = await fetch(
        `https://googleads.googleapis.com/${version}/customers/${customerId}:generateKeywordIdeas`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            language: "languageConstants/1012", // 한국어
            geoTargetConstants: ["geoTargetConstants/2410"], // 대한민국
            includeAdultKeywords: false,
            keywordPlanNetwork: "GOOGLE_SEARCH",
            keywordSeed: { keywords: chunk },
          }),
        },
      );
      if (!res.ok) continue;

      const data = (await res.json()) as {
        results?: Array<{
          text?: string;
          keywordIdeaMetrics?: {
            avgMonthlySearches?: string | number;
            competition?: string;
            competitionIndex?: string | number;
            lowTopOfPageBidMicros?: string | number;
            highTopOfPageBidMicros?: string | number;
          };
        }>;
      };

      const wanted = new Set(chunk.map(normalize));
      for (const row of data.results ?? []) {
        const text = normalize(row.text ?? "");
        if (!wanted.has(text) || result.has(text)) continue;
        const metric = row.keywordIdeaMetrics ?? {};
        const low = Number(metric.lowTopOfPageBidMicros ?? 0);
        const high = Number(metric.highTopOfPageBidMicros ?? 0);
        const avgBid = low || high ? Math.round((low + high) / 2) : null;
        result.set(text, {
          avgMonthlySearches:
            metric.avgMonthlySearches !== undefined ? Number(metric.avgMonthlySearches) : null,
          cpcMicros: avgBid !== null ? BigInt(avgBid) : null,
          currency: "KRW",
          competition: metric.competition ?? null,
          competitionIndex:
            metric.competitionIndex !== undefined ? Number(metric.competitionIndex) : null,
          source: "GOOGLE_ADS",
        });
      }
    }
  } catch {
    // 미연결·오류 시 빈 결과 (임의 수치 생성 금지)
  }
  return result;
}

/** 네이버 검색광고 키워드도구 — 월간 검색수(PC+모바일). 미설정 시 빈 맵. */
export async function fetchNaverSearchAdMetrics(
  keywords: string[],
): Promise<Map<string, KeywordMetricData>> {
  const result = new Map<string, KeywordMetricData>();
  const values = await getSettingValues([
    "naver.searchAdApiKey",
    "naver.searchAdSecret",
    "naver.searchAdCustomerId",
  ]);
  const apiKey = values["naver.searchAdApiKey"];
  const secret = values["naver.searchAdSecret"];
  const customerId = values["naver.searchAdCustomerId"];
  if (!apiKey || !secret || !customerId) return result;

  const uri = "/keywordstool";

  // 힌트 키워드는 호출당 최대 5개, 공백 제거 필요
  for (let i = 0; i < keywords.length; i += 5) {
    const chunk = keywords.slice(i, i + 5);
    const hints = chunk.map((keyword) => keyword.replace(/\s+/g, "")).join(",");
    const timestamp = String(Date.now());
    const signature = crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}.GET.${uri}`)
      .digest("base64");

    try {
      const res = await fetch(
        `https://api.searchad.naver.com${uri}?hintKeywords=${encodeURIComponent(hints)}&showDetail=1`,
        {
          headers: {
            "X-Timestamp": timestamp,
            "X-API-KEY": apiKey,
            "X-Customer": customerId,
            "X-Signature": signature,
          },
        },
      );
      if (!res.ok) continue;

      const data = (await res.json()) as {
        keywordList?: Array<{
          relKeyword?: string;
          monthlyPcQcCnt?: number | string;
          monthlyMobileQcCnt?: number | string;
          compIdx?: string;
        }>;
      };

      // 네이버는 영문 relKeyword를 대문자로 반환한다 — 대소문자 무시 매칭
      const wanted = new Map(
        chunk.map((keyword) => [keyword.replace(/\s+/g, "").toUpperCase(), keyword]),
      );
      for (const row of data.keywordList ?? []) {
        const original = wanted.get((row.relKeyword ?? "").toUpperCase());
        if (!original) continue;
        const key = normalize(original);
        if (result.has(key)) continue;

        const pc = parseCount(row.monthlyPcQcCnt);
        const mobile = parseCount(row.monthlyMobileQcCnt);
        result.set(key, {
          avgMonthlySearches: pc === null && mobile === null ? null : (pc ?? 0) + (mobile ?? 0),
          cpcMicros: null,
          currency: null,
          competition: row.compIdx ?? null,
          competitionIndex: null,
          source: "NAVER_SEARCHAD",
        });
      }
    } catch {
      // 무시
    }
  }
  return result;
}

/** 네이버는 10 미만을 "< 10" 문자열로 준다. */
function parseCount(value: number | string | undefined): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return value;
  const numeric = Number(value.replace(/[^\d]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

export { normalize as normalizeKeyword };
