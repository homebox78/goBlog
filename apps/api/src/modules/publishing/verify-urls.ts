import { prisma } from "../../common/prisma.js";

/**
 * 발행 URL 생존 검증 — 플랫폼에서 글이 삭제·이동됐는데 DB엔 '발행 성공'으로 남아 있으면
 * **내부 링크가 죽은 주소로 연결된다.**
 *
 * 죽은 URL을 발견하면 발행 기록을 FAILED로 되돌리고 URL을 지운다.
 * (기록을 지우지 않고 남겨 두면 "발행했다"는 사실은 유지되면서 링크만 안 걸린다 —
 *  틀린 링크보다 빈 링크가 낫다는 원칙 그대로.)
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/152.0";

/** 네이버는 삭제된 글도 HTTP 200을 주고 본문에 안내문만 넣는다 — 상태코드로 판단하면 속는다 */
async function isNaverDead(url: string): Promise<boolean> {
  const logNo = url.match(/\/(\d{9,})/)?.[1];
  if (!logNo) return false;
  const blogId = url.match(/blog\.naver\.com\/([\w-]+)/)?.[1];
  if (!blogId) return false;

  try {
    const res = await fetch(
      `https://blog.naver.com/PostView.naver?blogId=${blogId}&logNo=${logNo}`,
      { headers: { "User-Agent": UA } },
    );
    const html = await res.text();
    return /삭제되었거나|존재하지 않는|잘못된 접근/.test(html);
  } catch {
    return false; // 네트워크 실패를 '삭제됨'으로 오판하지 않는다
  }
}

/** 일반 플랫폼(워드프레스·티스토리·Blogger) — 404/410이면 죽은 것 */
async function isDead(url: string): Promise<boolean> {
  if (/blog\.naver\.com/.test(url)) return isNaverDead(url);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
    return res.status === 404 || res.status === 410;
  } catch {
    return false;
  }
}

export async function verifyPublishedUrls(): Promise<{
  checked: number;
  dead: Array<{ articleId: number; platform: string; url: string }>;
}> {
  const jobs = await prisma.publishJob.findMany({
    where: { status: "SUCCEEDED", publishedUrl: { not: null } },
    select: { id: true, articleId: true, platform: true, publishedUrl: true },
  });

  const dead: Array<{ articleId: number; platform: string; url: string }> = [];

  for (const job of jobs) {
    const url = job.publishedUrl!;
    if (await isDead(url)) {
      dead.push({ articleId: job.articleId, platform: job.platform, url });
      await prisma.publishJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          publishedUrl: null,
          error: "발행된 글이 플랫폼에서 삭제됨 (URL 검증에서 발견)",
        },
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 300)); // 플랫폼에 부담 주지 않게
  }

  return { checked: jobs.length, dead };
}
