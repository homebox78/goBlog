// 디시이슈 피드(issuefeed.dcinside.com) 연예·이슈 기사 → 커스텀 리라이트 후 자체 뉴스로 발행.
// 소스: 뉴스 sitemap(제목·URL) + 개별 기사 og 메타(제목·요약·이미지). 이미지는 서버 재호스팅(출처 표기).
// 발행처와 협의된 제휴 전제(사용자 확인). 외부 플랫폼 자동발행은 하지 않고 자체 뉴스에만 노출.
import { prisma } from "../../common/prisma.js";
import { callClaudeJson } from "../ai/claude.js";
import { insertImageFromUrl } from "../images/image-service.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";
const NEWS_SITEMAP = "https://issuefeed.dcinside.com/sitemap-news.xml";

function decodeHtml(s: string): string {
  return s
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .trim();
}

interface Item {
  url: string;
  title: string;
}

/** 뉴스 sitemap에서 최신 이슈 기사(제목+URL) 목록. 최신순. */
async function fetchList(): Promise<Item[]> {
  const res = await fetch(NEWS_SITEMAP, { headers: { "User-Agent": UA } });
  if (!res.ok) return [];
  const xml = await res.text();
  const items: Item[] = [];
  const re = /<loc>([^<]+)<\/loc>[\s\S]*?<news:title>([^<]+)<\/news:title>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null && items.length < 40) {
    items.push({ url: m[1].trim(), title: decodeHtml(m[2]) });
  }
  return items;
}

/** 개별 기사 페이지의 og 메타(제목·요약·대표이미지). */
async function fetchMeta(url: string): Promise<{ title: string; description: string; image: string } | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    const html = await res.text();
    const og = (p: string): string => {
      const mm = html.match(new RegExp(`<meta\\s+property="og:${p}"\\s+content="([^"]*)"`, "i"));
      return mm ? decodeHtml(mm[1]) : "";
    };
    const title = og("title");
    const description = og("description");
    const image = html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/i)?.[1] || "";
    if (!title || !image) return null;
    return { title, description, image };
  } catch {
    return null;
  }
}

interface Rewritten {
  title: string;
  excerpt: string;
  contentHtml: string;
}

/** 원문 제목·요약 → 우리 매체 기사로 재작성(표절 금지·사실 유지). */
async function rewrite(title: string, desc: string): Promise<Rewritten | null> {
  try {
    return await callClaudeJson<Rewritten>({
      operation: "issuefeed-rewrite",
      maxTokens: 1600,
      system:
        "너는 연예·이슈 뉴스 에디터다. 주어진 원문 제목·요약을 참고해 우리 매체의 기사를 새로 쓴다. " +
        "규칙: (1) 원문 문장을 그대로 베끼지 말고 완전히 재구성한다 (2) 원문 요약에 없는 사실·수치·발언을 지어내지 않는다 " +
        "(3) 본문은 자연스러운 한국어 <p> 문단 3~5개(총 500~800자), 마지막에 과한 단정·낚시 금지 " +
        "(4) 제목은 원문과 다르게, 40자 이내, 자극적 낚시 금지 (5) 오직 JSON만 반환.",
      user:
        `원문 제목: ${title}\n원문 요약: ${desc}\n\n` +
        `아래 JSON 형식으로만 답하라:\n` +
        `{"title":"새 제목","excerpt":"1~2문장 요약","contentHtml":"<p>문단1</p><p>문단2</p><p>문단3</p>"}`,
    });
  } catch {
    return null;
  }
}

/**
 * 이슈피드에서 최신 이슈 기사를 count건 커스텀 발행. 이미 처리한 원문 URL은 건너뛴다(ArticleSource로 dedup).
 * status=PUBLISHED + publishAt 으로 자체 뉴스에 즉시 노출(외부 플랫폼 자동발행은 하지 않음).
 */
export async function publishIssuefeed(count = 2): Promise<{ created: number; titles: string[]; skipped: number }> {
  const list = await fetchList();
  const titles: string[] = [];
  let skipped = 0;
  for (const item of list) {
    if (titles.length >= count) break;
    const dup = await prisma.articleSource.findFirst({ where: { url: item.url } });
    if (dup) {
      skipped++;
      continue;
    }
    const meta = await fetchMeta(item.url);
    if (!meta) {
      skipped++;
      continue;
    }
    const rw = await rewrite(meta.title, meta.description);
    if (!rw || !rw.title || !rw.contentHtml) {
      skipped++;
      continue;
    }
    let publisher = "issuefeed";
    try {
      publisher = new URL(item.url).host;
    } catch {
      /* keep default */
    }

    const article = await prisma.article.create({
      data: {
        title: rw.title.slice(0, 190),
        language: "ko",
        articleType: "news",
        status: "PUBLISHED",
        excerpt: (rw.excerpt || meta.description).slice(0, 300),
        metaDescription: (rw.excerpt || meta.description).slice(0, 300),
        contentHtml: rw.contentHtml,
        contentMarkdown: rw.contentHtml
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim(),
        qualityScore: 85,
        publishAt: new Date(),
      },
    });

    // 원문 대표 이미지 서버 재호스팅(hotlink 회피) + 출처 표기 캡션 + 본문 상단 삽입
    try {
      const img = await insertImageFromUrl(article.id, meta.image, `디시이슈 피드 · ${publisher}`);
      if (img.figure) {
        await prisma.article.update({
          where: { id: article.id },
          data: { contentHtml: `${img.figure}\n${rw.contentHtml}` },
        });
      }
    } catch {
      /* 이미지 실패해도 기사는 유지 */
    }

    await prisma.articleSource.create({
      data: {
        articleId: article.id,
        url: item.url,
        title: meta.title,
        publisher,
        status: "VERIFIED",
        verifiedAt: new Date(),
      },
    });
    titles.push(rw.title);
  }
  return { created: titles.length, titles, skipped };
}
