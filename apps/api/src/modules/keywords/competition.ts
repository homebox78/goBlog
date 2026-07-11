import { getSettingValues } from "../settings/settings.service.js";
import { normalizeKeyword } from "./metrics.js";

/**
 * 네이버 블로그 검색의 총 문서 수 = 경쟁 문서 수.
 * 검색량 대비 문서 수가 적을수록(황금 키워드) 상위 노출 기회가 높다.
 * 네이버 개발자센터 앱에 '검색' API 권한이 있어야 한다 (없으면 빈 맵 — 임의 수치 생성 금지).
 */
export async function fetchNaverBlogCompetition(
  keywords: string[],
): Promise<Map<string, { totalDocs: number }>> {
  const result = new Map<string, { totalDocs: number }>();
  const values = await getSettingValues(["naver.datalabClientId", "naver.datalabClientSecret"]);
  const clientId = values["naver.datalabClientId"];
  const clientSecret = values["naver.datalabClientSecret"];
  if (!clientId || !clientSecret) return result;

  for (const keyword of keywords) {
    try {
      const res = await fetch(
        `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(keyword)}&display=1`,
        { headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret } },
      );
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) break; // 권한 없음 — 전체 중단
        continue;
      }
      const data = (await res.json()) as { total?: number };
      if (typeof data.total === "number") {
        result.set(normalizeKeyword(keyword), { totalDocs: data.total });
      }
    } catch {
      // 개별 실패 무시
    }
  }
  return result;
}

/**
 * 저경쟁 점수 (0~100): 검색량 대비 경쟁 문서 수 비율 기반.
 * 검색량 없이 문서 수만 있으면 문서 수 절대값으로만 보수적으로 계산.
 */
export function lowCompetitionScore(
  monthlySearches: number | null,
  totalDocs: number | null,
): number | null {
  if (totalDocs === null) return null;
  if (totalDocs <= 0) return 100;

  if (monthlySearches !== null && monthlySearches > 0) {
    // 비율 = 월간 검색량 / 경쟁 문서 수. 1.0 이상이면 황금 키워드급.
    const ratio = monthlySearches / totalDocs;
    return Math.round(Math.min(100, Math.max(0, Math.log10(ratio * 100 + 1) * 40)));
  }
  // 검색량 미상 — 문서 수 절대값 기준 (1만 이하 저경쟁 ~ 100만+ 고경쟁)
  return Math.round(Math.min(100, Math.max(0, 100 - Math.log10(totalDocs + 1) * 16)));
}
