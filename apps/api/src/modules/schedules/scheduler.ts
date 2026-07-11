import { Cron } from "croner";
import { getSettingValue } from "../settings/settings.service.js";
import { runDailyDiscovery } from "../keywords/engine.js";

let keywordJob: Cron | null = null;

/** 설정된 수집 시간(KST)으로 매일 키워드 수집을 예약한다. 설정 변경 시 재호출. */
export async function scheduleFromSettings(): Promise<void> {
  try {
    const collectTime = (await getSettingValue("keywords.collectTime")) ?? "07:00";
    const match = /^(\d{1,2}):(\d{2})$/.exec(collectTime.trim());
    const hour = match ? Math.min(23, Number(match[1])) : 7;
    const minute = match ? Math.min(59, Number(match[2])) : 0;

    keywordJob?.stop();
    keywordJob = new Cron(
      `${minute} ${hour} * * *`,
      { timezone: "Asia/Seoul", protect: true },
      async () => {
        console.log("[scheduler] 일일 키워드 수집 시작");
        try {
          const result = await runDailyDiscovery("cron");
          console.log(
            `[scheduler] 키워드 수집 완료: 추천 ${result.recommendedCount}개 (후보 ${result.candidateCount})`,
          );
        } catch (error) {
          console.error("[scheduler] 키워드 수집 실패:", (error as Error).message);
        }
      },
    );
    console.log(`[scheduler] 키워드 수집 예약: 매일 ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} KST`);
  } catch (error) {
    console.warn("[scheduler] 예약 실패 (DB 미연결일 수 있음):", (error as Error).message);
  }
}
