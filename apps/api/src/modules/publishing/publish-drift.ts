import { prisma } from "../../common/prisma.js";

/**
 * 발행 드리프트 — **DB의 글과 플랫폼에 올라간 글이 어긋난 상태**를 찾는다.
 *
 * 실제 사고: 발행한 뒤에 광고 배너를 삽입했는데 **재발행을 안 해서**,
 * 플랫폼에는 배너 없는 옛 버전이 남았다. 수익 링크가 통째로 누락된 채 서비스됐다.
 * (실측: 글 5개 · 발행 14건. 발행글에 배너 이미지·광고 라벨·대가성 문구가 전부 없었다.)
 *
 * ⚠️ 시각 비교만으로 판단하지 않는다. "수정됨"이 곧 "내용이 달라짐"은 아니다
 *    (품질 보정·이미지 재생성으로 updatedAt만 바뀌는 경우가 많다 — 실측 101건 중 대부분).
 *    **정말 중요한 것은 "제휴 링크가 발행글에 살아 있는가"** 이므로 그걸 직접 확인한다.
 */

const AFFILIATE = /link\.coupang|naver\.me|smartstore\.naver|brand\.naver/i;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/152.0";

export interface Drift {
  articleId: number;
  title: string;
  platform: string;
  url: string;
  dbLinks: number;
  liveLinks: number;
  /** 자동 재발행이 가능한가 (티스토리·네이버는 확장으로만 가능) */
  autoFixable: boolean;
  severity: "전멸" | "일부";
}

/** 네이버는 프레임 구조라 PostView로 본문을 받아야 한다 */
async function fetchLive(url: string): Promise<string> {
  const naver = url.match(/blog\.naver\.com\/([\w-]+)\/(\d+)/);
  const target = naver
    ? `https://blog.naver.com/PostView.naver?blogId=${naver[1]}&logNo=${naver[2]}`
    : url;
  const res = await fetch(target, { headers: { "User-Agent": UA } });
  return res.text();
}

function countAffiliate(html: string): number {
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/g)]
    .map((match) => match[1])
    .filter((href) => AFFILIATE.test(href));
  if (hrefs.length > 0) return hrefs.length;
  // 네이버 SmartEditor는 붙여넣기 <a>를 지우고 텍스트만 남긴다 — 자동 링크화되는 텍스트 URL도 링크로 친다
  return (html.match(/link\.coupang\.com\/a\/[A-Za-z0-9]+|naver\.me\/[A-Za-z0-9]+/g) ?? []).length;
}

/**
 * 광고가 들어간 발행글을 실제로 긁어 제휴 링크가 살아 있는지 확인한다.
 * 링크가 하나도 없으면 '전멸', DB보다 적으면 '일부'.
 */
export async function scanPublishDrift(): Promise<{ checked: number; drifts: Drift[] }> {
  const jobs = await prisma.publishJob.findMany({
    where: { status: "SUCCEEDED", publishedUrl: { not: null } },
    select: {
      platform: true,
      articleId: true,
      publishedUrl: true,
      article: { select: { title: true, contentHtml: true } },
    },
    orderBy: { articleId: "asc" },
  });

  const drifts: Drift[] = [];
  let checked = 0;

  for (const job of jobs) {
    const dbLinks = countAffiliate(job.article.contentHtml ?? "");
    if (dbLinks === 0) continue; // 광고 없는 글 — 검사 대상 아님
    checked += 1;

    let liveLinks = 0;
    try {
      liveLinks = countAffiliate(await fetchLive(job.publishedUrl!));
    } catch {
      continue; // 네트워크 실패를 '유실'로 오판하지 않는다
    }

    if (liveLinks >= dbLinks) continue; // 정상

    drifts.push({
      articleId: job.articleId,
      title: job.article.title,
      platform: job.platform,
      url: job.publishedUrl!,
      dbLinks,
      liveLinks,
      autoFixable: job.platform === "WORDPRESS" || job.platform === "BLOGGER",
      severity: liveLinks === 0 ? "전멸" : "일부",
    });

    await new Promise((resolve) => setTimeout(resolve, 200)); // 플랫폼에 부담 주지 않게
  }

  return { checked, drifts };
}

/**
 * 자동 복구 — 워드프레스·블로거의 '전멸' 건을 최신 본문으로 덮어쓴다.
 * 티스토리·네이버는 공개 쓰기 API가 없어 확장으로만 가능하다 → 목록만 돌려준다.
 */
export async function repairPublishDrift(): Promise<{
  repaired: Array<{ articleId: number; platform: string; url: string }>;
  needsExtension: Drift[];
  failed: Array<{ articleId: number; platform: string; error: string }>;
}> {
  const { drifts } = await scanPublishDrift();
  const { republish } = await import("./republish.js");

  const repaired: Array<{ articleId: number; platform: string; url: string }> = [];
  const failed: Array<{ articleId: number; platform: string; error: string }> = [];
  const needsExtension: Drift[] = [];

  for (const drift of drifts) {
    if (!drift.autoFixable) {
      needsExtension.push(drift);
      continue;
    }
    try {
      const result = await republish(drift.articleId, drift.platform as "WORDPRESS" | "BLOGGER");
      repaired.push({ articleId: drift.articleId, platform: drift.platform, url: result.url });
    } catch (error) {
      // 실패를 삼키지 않는다 — 링크 없는 글이 그대로 남는다
      failed.push({
        articleId: drift.articleId,
        platform: drift.platform,
        error: (error as Error).message,
      });
    }
  }

  return { repaired, needsExtension, failed };
}
