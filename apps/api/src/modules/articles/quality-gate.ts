import { getSettingValue } from "../settings/settings.service.js";

/**
 * 자동발행 최소 품질 점수 — 설정(설정 → Claude → "자동발행 최소 품질 점수")에서 읽는다.
 *
 * ⚠️ 예전엔 85가 코드 5곳에 하드코딩돼 있어 **설정을 90으로 바꿔도 아무 효과가 없었다.**
 *    (생성 재시도 기준·보정 목표·자동보정 조건·발행 차단선이 전부 85 고정)
 *    설정 화면에 값이 보이는데 동작이 안 따라가면, 사용자는 설정이 먹은 줄 알고 방치하게 된다.
 */
export async function minQualityScore(): Promise<number> {
  const raw = await getSettingValue("anthropic.minQualityScore");
  const value = Number(raw);
  // 값이 비었거나 이상하면 기본 85 (0~100 밖 값도 신뢰하지 않는다)
  if (!Number.isFinite(value) || value < 50 || value > 100) return 85;
  return Math.round(value);
}
