import { getSettingValues } from "../settings/settings.service.js";

/**
 * 텔레그램 운영 알림 — 일일 보고·발행 실패 알림 채널.
 * 봇 생성: 텔레그램 @BotFather → /newbot → 토큰 발급.
 * chat_id: 봇에게 아무 메시지 1회 전송 후 https://api.telegram.org/bot<토큰>/getUpdates 에서 chat.id 확인
 *          (연결 테스트가 자동으로 찾아 안내해 준다).
 */
async function getConfig(): Promise<{ token: string; chatId: string } | null> {
  const values = await getSettingValues(["telegram.botToken", "telegram.chatId"]);
  const token = values["telegram.botToken"];
  const chatId = values["telegram.chatId"];
  if (!token || !chatId) return null;
  return { token, chatId };
}

/** 알림 전송 — 설정이 없으면 조용히 스킵(파이프라인을 알림이 방해하면 안 된다). HTML 파스 모드. */
export async function sendTelegram(text: string): Promise<boolean> {
  try {
    const cfg = await getConfig();
    if (!cfg) return false;
    const res = await fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: cfg.chatId,
        text: text.slice(0, 4000), // 텔레그램 메시지 한도 4096자
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function tgEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 연결 테스트 — chatId 미입력 시 getUpdates에서 후보를 찾아 안내한다. */
export async function testTelegram(): Promise<{ ok: boolean; message: string }> {
  const values = await getSettingValues(["telegram.botToken", "telegram.chatId"]);
  const token = values["telegram.botToken"];
  if (!token) return { ok: false, message: "봇 토큰이 없습니다. @BotFather에서 봇을 만들고 토큰을 입력해주세요." };

  try {
    const me = (await (await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(10000) })).json()) as {
      ok?: boolean;
      result?: { username?: string };
    };
    if (!me.ok) return { ok: false, message: "봇 토큰이 올바르지 않습니다." };

    if (!values["telegram.chatId"]) {
      // chat_id를 아직 모르면 최근 대화에서 후보를 찾아 안내
      const upd = (await (
        await fetch(`https://api.telegram.org/bot${token}/getUpdates`, { signal: AbortSignal.timeout(10000) })
      ).json()) as { result?: Array<{ message?: { chat?: { id?: number; first_name?: string } } }> };
      const chat = upd.result?.map((u) => u.message?.chat).find((c) => c?.id);
      if (chat?.id) {
        return {
          ok: false,
          message: `봇(@${me.result?.username}) 연결 확인. Chat ID가 비어 있습니다 — 최근 대화에서 발견한 ID: ${chat.id} (${chat.first_name ?? ""}) 를 입력해주세요.`,
        };
      }
      return {
        ok: false,
        message: `봇(@${me.result?.username}) 연결 확인. 텔레그램에서 이 봇에게 아무 메시지나 1개 보낸 뒤 다시 테스트하면 Chat ID를 찾아드립니다.`,
      };
    }

    const sent = await sendTelegram("✅ goBlog 텔레그램 알림 연결 테스트");
    return sent
      ? { ok: true, message: `연결 성공 — @${me.result?.username} 봇으로 테스트 메시지를 보냈습니다.` }
      : { ok: false, message: "테스트 메시지 전송 실패 — Chat ID를 확인해주세요 (봇에게 먼저 말을 걸어야 합니다)." };
  } catch (error) {
    return { ok: false, message: `텔레그램 연결 실패: ${(error as Error).message}` };
  }
}

/**
 * 일일 운영 보고 — goBlog 전체 시스템 현황을 한 장으로 요약해 전송한다.
 * 콘텐츠 · 발행 · 홈박스 뉴스 · 키워드 · 제휴(상품 풀·링크 보유율) · 학습 · 성과(GSC) · AI 비용 · 실패 내역
 */
export async function sendDailyReport(): Promise<boolean> {
  const { prisma } = await import("../../common/prisma.js");
  const now = new Date();
  const kstMidnightUtc = new Date(now);
  kstMidnightUtc.setUTCHours(15, 0, 0, 0);
  if (kstMidnightUtc > now) kstMidnightUtc.setUTCDate(kstMidnightUtc.getUTCDate() - 1);
  const since = kstMidnightUtc;

  const [
    created,
    released,
    avgQuality,
    jobs,
    extWaiting,
    totalPublished,
    kwToday,
    kwActive,
    productTotal,
    productMatched,
    productMatchedToday,
    coupangLinked,
    coupangTotal,
    bcLinked,
    bcTotal,
    adArticlesToday,
    citationsToday,
    insightsTotal,
    gsc,
    aiCost,
  ] = await Promise.all([
    prisma.article.count({ where: { createdAt: { gte: since } } }),
    prisma.article.count({ where: { publishAt: { gte: since } } }),
    prisma.article.aggregate({ where: { createdAt: { gte: since } }, _avg: { qualityScore: true } }),
    prisma.publishJob.findMany({
      where: { updatedAt: { gte: since }, status: { in: ["SUCCEEDED", "FAILED"] } },
      select: { platform: true, status: true, error: true, article: { select: { title: true } } },
    }),
    prisma.article.count({
      where: {
        status: { in: ["APPROVED", "SCHEDULED", "PUBLISHED"] },
        publishAt: { not: null },
        OR: ["NAVER_BLOG", "TISTORY"].map((platform) => ({
          publishJobs: { none: { platform: platform as never, status: "SUCCEEDED" as never } },
        })),
      },
    }),
    prisma.article.count({
      where: {
        OR: [
          { publishJobs: { some: { status: "SUCCEEDED" } } },
          { publishAt: { not: null }, status: { in: ["SCHEDULED", "PUBLISHED"] } },
        ],
      },
    }),
    prisma.keyword.count({ where: { createdAt: { gte: since } } }),
    prisma.keyword.count({ where: { status: { in: ["RECOMMENDED", "SAVED"] } } }),
    prisma.product.count(),
    prisma.product.count({ where: { matchedKeywordId: { not: null } } }),
    prisma.product.count({ where: { matchedAt: { gte: since } } }),
    prisma.product.count({
      where: { source: "COUPANG", OR: [{ productUrl: { contains: "link.coupang.com" } }, { productUrl: { contains: "coupa.ng" } }] },
    }),
    prisma.product.count({ where: { source: "COUPANG" } }),
    prisma.product.count({ where: { source: "BRANDCONNECT", productUrl: { contains: "naver.me" } } }),
    prisma.product.count({ where: { source: "BRANDCONNECT" } }),
    prisma.article.count({ where: { createdAt: { gte: since }, adSource: { not: null } } }),
    prisma.blogCitation.count({ where: { collectedAt: { gte: since } } }),
    prisma.citationInsight.count(),
    prisma.analyticsDaily.aggregate({
      where: { createdAt: { gte: new Date(now.getTime() - 3 * 86400000) }, source: "SEARCH_CONSOLE" },
      _sum: { impressions: true, clicks: true },
    }),
    prisma.modelUsageLog.groupBy({
      by: ["provider"],
      where: { createdAt: { gte: since } },
      _sum: { costMicros: true },
    }),
  ]);

  const byPlatform: Record<string, { ok: number; fail: number }> = {};
  const failures: string[] = [];
  for (const j of jobs) {
    const p = (byPlatform[j.platform] ??= { ok: 0, fail: 0 });
    if (j.status === "SUCCEEDED") p.ok += 1;
    else {
      p.fail += 1;
      if (failures.length < 5)
        failures.push(`· [${j.platform}] ${tgEscape(j.article.title.slice(0, 28))}: ${tgEscape((j.error ?? "?").slice(0, 60))}`);
    }
  }
  const platformLine =
    Object.entries(byPlatform)
      .map(([p, c]) => `${p} ${c.ok}${c.fail ? `(실패${c.fail})` : ""}`)
      .join(" · ") || "없음";

  const costLine =
    aiCost
      .map((c) => `${c.provider} $${(Number(c._sum.costMicros ?? 0) / 1_000_000).toFixed(2)}`)
      .join(" · ") || "기록 없음";

  const gscLine =
    (gsc._sum.impressions ?? 0) > 0 || (gsc._sum.clicks ?? 0) > 0
      ? `노출 ${gsc._sum.impressions ?? 0} · 클릭 ${gsc._sum.clicks ?? 0} (최근 3일 수집분)`
      : "수집 대기 (표본 없음)";

  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
  const dateStr = new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const lines = [
    `📰 <b>goBlog 전체 운영 보고 — ${dateStr}</b>`,
    ``,
    `✍️ <b>콘텐츠</b>: 오늘 생성 ${created}건(평균 품질 ${Math.round(avgQuality._avg.qualityScore ?? 0)}점) · 릴리즈 ${released}건`,
    `🚀 <b>발행</b>: ${platformLine}`,
    `⏳ 확장(네이버·티스토리) 수동 대기 ${extWaiting}건`,
    `🏠 <b>홈박스 뉴스</b>: 노출 기사 누적 ${totalPublished}건`,
    `🔑 <b>키워드</b>: 오늘 신규 ${kwToday}개 · 활성 풀 ${kwActive}개`,
    `🛒 <b>제휴</b>: 상품 ${productTotal}개 · 매칭 ${productMatched}개(오늘 ${productMatchedToday}) · 오늘 광고 포함 글 ${adArticlesToday}건`,
    `　└ 트래킹 링크: 쿠팡 ${coupangLinked}/${coupangTotal} (${pct(coupangLinked, coupangTotal)}%) · 커넥트 ${bcLinked}/${bcTotal} (${pct(bcLinked, bcTotal)}%)`,
    `📚 <b>학습</b>: 오늘 인용 수집 ${citationsToday}건 · 누적 인사이트 ${insightsTotal}개`,
    `📈 <b>성과(GSC)</b>: ${gscLine}`,
    `💸 <b>AI 비용(오늘)</b>: ${costLine}`,
  ];
  if (failures.length) lines.push(``, `⚠️ <b>발행 실패</b>`, ...failures);
  lines.push(``, `홈 https://hom2box.com · 관리 https://hom2box.com/goBlog`);
  return sendTelegram(lines.join("\n"));
}
