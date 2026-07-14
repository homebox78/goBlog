import { prisma } from "../../common/prisma.js";

/**
 * 티스토리 발행 URL 자기치유 — **확장의 URL 포착을 믿지 않는다.**
 *
 * 확장은 "발행 후 브라우저가 글 주소로 이동하는 것"을 엿봐서 URL을 잡는다.
 * 그런데 티스토리는 발행하면 글이 아니라 **관리 목록으로 간다.** 게다가 대기 슬롯이 하나뿐이라
 * 연속 발행하면 앞 건이 덮어써진다. 실측: 47건 중 4건 누락 — 성공/누락이 번갈아 났다.
 *
 * 그래서 **블로그 RSS를 정답으로 삼는다.** 제목을 맞춰 URL을 채운다.
 * 확장이 무엇을 놓쳤든, 티스토리에 글이 실제로 있으면 여기서 복구된다.
 *
 * 덤으로 **유령 발행**도 잡는다: 발행 성공이라고 기록됐는데 티스토리에 글이 없는 경우
 * (실측: 글 #40 "BBQ 신제품 할인" — SUCCEEDED인데 블로그에 없다). **200이 성공이 아니다.**
 */

interface RssPost {
  key: string;
  url: string;
}

const decode = (text: string): string =>
  text
    .replace(/&amp;/g, "&")
    .replace(/&mdash;/g, "—")
    .replace(/&middot;/g, "·")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .trim();

/** 제목 비교용 — 공백·문장부호는 발행 과정에서 바뀔 수 있으니 다 걷어내고 맞춘다 */
const norm = (text: string): string =>
  decode(text)
    .replace(/[\s·—–\-…"'`,.!?]/g, "")
    .toLowerCase();

async function fetchRss(blog: string): Promise<{ posts: RssPost[]; oldest: Date | null }> {
  const res = await fetch(`https://${blog}.tistory.com/rss`, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`티스토리 RSS 조회 실패 (HTTP ${res.status})`);
  const xml = await res.text();

  const posts: RssPost[] = [];
  let oldest: Date | null = null;
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const item = match[1];
    const title = item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1] ?? "";
    const link = item.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/)?.[1] ?? "";
    const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1];
    if (!title || !/\.tistory\.com\/\d+/.test(link.trim())) continue;
    posts.push({ key: norm(title), url: link.trim() });

    // RSS는 최근 글만 준다. **어디까지 보이는지**를 알아야 "RSS에 없다 = 글이 없다"고 말할 수 있다.
    if (pubDate) {
      const date = new Date(pubDate);
      if (!Number.isNaN(date.getTime()) && (!oldest || date < oldest)) oldest = date;
    }
  }
  return { posts, oldest };
}

export interface TistorySyncResult {
  rssPosts: number;
  filled: Array<{ articleId: number; url: string }>;
  phantom: Array<{ articleId: number; title: string }>; // 발행됐다는데 블로그에 없는 글
}

/**
 * URL이 빈 티스토리 발행 기록을 RSS로 채운다.
 *
 * @param markPhantom RSS 수집 범위 안인데도 글이 없으면 발행 실패로 되돌린다.
 *                    ⚠️ RSS 범위 밖(오래된 글)은 **절대 유령으로 몰지 않는다** —
 *                       "RSS에 안 보임"과 "글이 없음"은 다르다.
 */
export async function syncTistoryUrls(blog = "hom2box", markPhantom = true): Promise<TistorySyncResult> {
  const { posts, oldest } = await fetchRss(blog);

  const jobs = await prisma.publishJob.findMany({
    where: { platform: "TISTORY", status: "SUCCEEDED", publishedUrl: null },
    include: { article: { select: { id: true, title: true } } },
  });

  const filled: TistorySyncResult["filled"] = [];
  const phantom: TistorySyncResult["phantom"] = [];

  for (const job of jobs) {
    const hit = posts.find((post) => post.key === norm(job.article.title));
    if (hit) {
      await prisma.publishJob.update({ where: { id: job.id }, data: { publishedUrl: hit.url } });
      filled.push({ articleId: job.article.id, url: hit.url });
      continue;
    }

    // 여기부터는 "RSS에 없다". 글이 정말 없는 건지, RSS가 안 보여주는 옛 글인지 구분해야 한다.
    const finishedAt = job.finishedAt ?? job.createdAt;
    const withinRssWindow = oldest !== null && finishedAt > oldest;
    if (!withinRssWindow) continue; // 판단 불가 — 건드리지 않는다

    phantom.push({ articleId: job.article.id, title: job.article.title });
    if (markPhantom) {
      // 성공이라고 남겨두면 "발행됐다"고 믿고 다시는 안 올린다. 실패로 되돌려야 재발행 대상이 된다.
      await prisma.publishJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          error: "발행 성공으로 기록됐으나 티스토리에 글이 없습니다 (확장으로 재발행 필요)",
        },
      });
    }
  }

  return { rssPosts: posts.length, filled, phantom };
}
