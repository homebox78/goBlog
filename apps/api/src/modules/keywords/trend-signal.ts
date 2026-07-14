import { prisma } from "../../common/prisma.js";
import { normalizeKeyword } from "./metrics.js";

/**
 * 키워드 트렌드 모멘텀 — 시계열(`keyword_trends`)을 **실제 판단에 쓰기 위한** 신호로 바꾼다.
 *
 * 그동안 트렌드는 **기록만 되고 아무 데도 안 쓰였다.** 190행이 쌓였는데 키워드 선정에도,
 * 글 생성에도 반영되지 않았다. 하루 4회 수집한 순위 변동이 그냥 창고에 쌓이기만 한 셈이다.
 *
 * 여기서 두 가지를 뽑는다:
 *   ① 상승세(momentum) — 순위가 올라가고 있는가. 지금 뜨는 소재는 먼저 쓸수록 유리하다.
 *   ② 지속성(persistence) — 며칠째 계속 잡히는가. 반짝 이슈와 진짜 수요를 가른다.
 *
 * ⚠️ 관측이 1회뿐인 키워드는 모멘텀을 계산하지 않는다(null). 한 점으로는 기울기를 못 그린다.
 */

export interface TrendSignal {
  /** 관측된 날짜 수 (며칠째 잡히는가) */
  daysSeen: number;
  /** 직전 관측 대비 순위 변화 (+면 상승) */
  rankDelta: number | null;
  /** 최근 순위 (작을수록 상위) */
  latestRank: number | null;
  /** 검색량 변화율 (%) — 데이터가 없으면 null */
  volumeChangePct: number | null;
  /** 종합 모멘텀 -20 ~ +20 (키워드 점수에 더하는 보정값) */
  momentum: number;
  /** 사람이 읽는 요약 — 글 생성 프롬프트에 그대로 넣는다 */
  summary: string;
}

/** 최근 N일 트렌드를 키워드별로 모아 신호를 계산한다 */
export async function trendSignals(days = 7): Promise<Map<string, TrendSignal>> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - days);

  const rows = await prisma.keywordTrend.findMany({
    where: { date: { gte: since } },
    select: {
      keywordText: true,
      date: true,
      collectedAt: true,
      rank: true,
      searchVolume: true,
    },
    orderBy: { collectedAt: "asc" },
  });

  const byKeyword = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = normalizeKeyword(row.keywordText);
    const list = byKeyword.get(key) ?? [];
    list.push(row);
    byKeyword.set(key, list);
  }

  const signals = new Map<string, TrendSignal>();

  for (const [key, list] of byKeyword) {
    const dates = new Set(list.map((row) => row.date.toISOString().slice(0, 10)));
    const daysSeen = dates.size;

    const ranked = list.filter((row) => row.rank !== null);
    const latestRank = ranked.length > 0 ? ranked[ranked.length - 1].rank! : null;
    // 한 점으로는 기울기를 못 그린다 — 관측 2회 미만이면 변화량은 null
    const rankDelta =
      ranked.length >= 2 ? ranked[0].rank! - ranked[ranked.length - 1].rank! : null;

    const volumes = list.map((row) => row.searchVolume).filter((v): v is number => v !== null && v > 0);
    const volumeChangePct =
      volumes.length >= 2
        ? Math.round(((volumes[volumes.length - 1] - volumes[0]) / volumes[0]) * 100)
        : null;

    // 모멘텀: 순위 상승(+) · 며칠째 지속(+) · 순위 하락(-)
    let momentum = 0;
    if (rankDelta !== null) momentum += Math.max(-12, Math.min(12, rankDelta * 1.5));
    if (daysSeen >= 3) momentum += 6; // 사흘 넘게 계속 잡힘 = 반짝 이슈가 아니다
    else if (daysSeen === 2) momentum += 3;
    if (volumeChangePct !== null && volumeChangePct > 20) momentum += 4;
    momentum = Math.round(Math.max(-20, Math.min(20, momentum)));

    const parts: string[] = [];
    if (rankDelta !== null && rankDelta > 0) parts.push(`순위 ${rankDelta}단계 상승 중`);
    else if (rankDelta !== null && rankDelta < 0) parts.push(`순위 ${-rankDelta}단계 하락 중`);
    if (daysSeen >= 3) parts.push(`${daysSeen}일째 연속 상위 노출`);
    else if (daysSeen === 1) parts.push("오늘 처음 등장 (신규 이슈)");
    if (volumeChangePct !== null && Math.abs(volumeChangePct) >= 20)
      parts.push(`검색량 ${volumeChangePct > 0 ? "+" : ""}${volumeChangePct}%`);

    signals.set(key, {
      daysSeen,
      rankDelta,
      latestRank,
      volumeChangePct,
      momentum,
      summary: parts.length > 0 ? parts.join(" · ") : "트렌드 변화 없음",
    });
  }

  return signals;
}

/** 키워드 하나의 트렌드 신호 (글 생성 시 프롬프트 주입용) */
export async function trendSignalFor(keywordText: string, days = 14): Promise<TrendSignal | null> {
  const signals = await trendSignals(days);
  return signals.get(normalizeKeyword(keywordText)) ?? null;
}
