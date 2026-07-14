import crypto from "node:crypto";
import { getSettingValues } from "../settings/settings.service.js";
import { normalizeKeyword } from "./metrics.js";

/**
 * 연관 키워드 — **이미 받아오고 있는데 버리던 데이터**를 살린다.
 *
 * 네이버 검색광고 `keywordstool` 은 힌트 키워드 하나를 물으면 **연관 키워드를 수백 개**
 * 검색량·경쟁도와 함께 돌려준다 (실측: "무선이어폰추천" → 426개).
 * 그런데 `fetchNaverSearchAdMetrics` 는 **내가 물어본 키워드만 골라 쓰고 나머지를 전부 버렸다.**
 * 돈 한 푼 더 안 들이고 얻을 수 있는 키워드 발굴 소스를 통째로 낭비하고 있었던 셈이다.
 *
 * ⚠️ 여기서 나오는 건 '후보'다. 그대로 쓰면 안 된다:
 *    - 브랜드명·단일 상품명이 많다 (블로그 주제로 안 맞는 것)
 *    - 우리가 이미 다룬 키워드, 제외 주제(사건·연예·정치)를 걸러야 한다
 *    걸러내는 책임은 호출부(엔진)에 있다.
 */

export interface RelatedKeyword {
  keyword: string;
  monthlySearches: number;
  competition: string | null; // 낮음 | 중간 | 높음
}

const parseCount = (value: number | string | undefined): number => {
  // 네이버는 10 미만을 "< 10" 문자열로 준다 — 숫자로 못 바꾸면 0
  const parsed = typeof value === "string" ? parseInt(value.replace(/[^\d]/g, ""), 10) : value;
  return Number.isFinite(parsed) ? (parsed as number) : 0;
};

/**
 * 힌트 키워드들의 연관 키워드를 모아 검색량 내림차순으로 돌려준다.
 * 실패하면 빈 배열 (연관 키워드가 없다고 글 생성이 막히면 안 된다).
 */
export async function fetchRelatedKeywords(
  hints: string[],
  limit = 40,
): Promise<RelatedKeyword[]> {
  const values = await getSettingValues([
    "naver.searchAdApiKey",
    "naver.searchAdSecret",
    "naver.searchAdCustomerId",
  ]);
  const apiKey = values["naver.searchAdApiKey"];
  const secret = values["naver.searchAdSecret"];
  const customerId = values["naver.searchAdCustomerId"];
  if (!apiKey || !secret || !customerId) return [];

  const uri = "/keywordstool";
  const collected = new Map<string, RelatedKeyword>();

  // 호출당 힌트는 최대 5개
  for (let i = 0; i < hints.length; i += 5) {
    const chunk = hints.slice(i, i + 5).map((keyword) => keyword.replace(/\s+/g, ""));
    const timestamp = String(Date.now());
    const signature = crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}.GET.${uri}`)
      .digest("base64");

    try {
      const res = await fetch(
        `https://api.searchad.naver.com${uri}?hintKeywords=${encodeURIComponent(chunk.join(","))}&showDetail=1`,
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

      for (const row of data.keywordList ?? []) {
        const keyword = (row.relKeyword ?? "").trim();
        if (!keyword) continue;
        const key = normalizeKeyword(keyword);
        if (collected.has(key)) continue;

        collected.set(key, {
          keyword,
          monthlySearches: parseCount(row.monthlyPcQcCnt) + parseCount(row.monthlyMobileQcCnt),
          competition: row.compIdx ?? null,
        });
      }
    } catch {
      // 한 청크 실패가 전체를 깨지 않게
    }
  }

  return [...collected.values()]
    .sort((a, b) => b.monthlySearches - a.monthlySearches)
    .slice(0, limit);
}
