import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../../common/prisma.js";
import { renderContentHtml } from "../articles/render.js";
import { mediaDir, mediaPublicUrl, regenerateArticleImage } from "./image-service.js";

/**
 * 이미지 무결성 점검.
 *
 * 이미지가 깨져도 아무도 몰랐다 — 사용자가 발행 직전에 엑박을 보고 나서야 발견했다.
 * 그래서 "DB의 이미지 주소가 실제로 살아 있는지"를 언제든 확인하고 스스로 고칠 수 있게 한다.
 *
 * 두 종류의 고장을 본다:
 *  ① MediaAsset.webpUrl 이 가리키는 파일이 서버에 없음 (다른 PC에서 생성돼 파일이 유실된 경우)
 *  ② 본문(contentMarkdown/Html)이 옛 이미지 주소를 가리킴
 *     — 이미지를 재생성한 뒤 '재생성 전에 열어둔 화면'에서 저장하면 본문이 통째로 되돌아간다.
 */

export interface BrokenImage {
  articleId: number;
  articleTitle: string;
  mediaId: number | null;
  position: number | null;
  url: string;
  reason: string;
  repairable: boolean;
}

/** 파일명에 mediaId가 박혀 있다: a{articleId}-m{mediaId}-{ts}.webp */
const MEDIA_URL = /https?:\/\/[^\s"')]+\/media\/a(\d+)-m(\d+)-\d+\.(?:webp|png)/gi;

function publicBase(): string | null {
  try {
    return mediaPublicUrl();
  } catch {
    return null; // 설정이 없는 환경 — 그 자체는 이미지 생성 시점에 이미 막힌다
  }
}

async function fileExists(url: string): Promise<boolean> {
  const name = url.split("/").pop();
  if (!name) return false;
  return fs
    .access(path.join(mediaDir(), name))
    .then(() => true)
    .catch(() => false);
}

export async function scanBrokenImages(): Promise<BrokenImage[]> {
  const base = publicBase();
  const broken: BrokenImage[] = [];

  // ① MediaAsset — 주소가 공개 주소가 아니거나, 파일이 서버에 없는 경우
  const assets = await prisma.mediaAsset.findMany({
    where: { webpUrl: { not: null } },
    select: {
      id: true,
      position: true,
      webpUrl: true,
      prompt: true,
      article: { select: { id: true, title: true } },
    },
    orderBy: [{ articleId: "asc" }, { position: "asc" }],
  });

  for (const asset of assets) {
    if (!asset.article) continue; // 글이 지워진 고아 미디어 — 화면에 띄울 대상이 아니다
    const url = asset.webpUrl!;
    let reason: string | null = null;
    if (base && !url.startsWith(base)) reason = "공개 주소가 아닙니다 (다른 환경에서 생성됨)";
    else if (!(await fileExists(url))) reason = "서버에 이미지 파일이 없습니다";
    if (!reason) continue;
    broken.push({
      articleId: asset.article.id,
      articleTitle: asset.article.title,
      mediaId: asset.id,
      position: asset.position,
      url,
      reason,
      repairable: !!asset.prompt, // 프롬프트가 있으면 같은 의도로 다시 만들 수 있다
    });
  }

  // ② 본문이 가리키는 이미지 주소가 MediaAsset의 현재 주소와 다른 경우 (오래된 화면이 덮어쓴 흔적)
  const articles = await prisma.article.findMany({
    select: { id: true, title: true, contentMarkdown: true, contentHtml: true },
  });
  const current = new Map(assets.map((a) => [a.id, a.webpUrl!]));

  for (const article of articles) {
    const text = `${article.contentMarkdown ?? ""}\n${article.contentHtml ?? ""}`;
    const seen = new Set<string>();
    for (const match of text.matchAll(MEDIA_URL)) {
      const url = match[0];
      const mediaId = Number(match[2]);
      if (seen.has(url)) continue;
      seen.add(url);
      const now = current.get(mediaId);
      if (!now || now === url) continue; // 최신 주소이거나, 위 ①에서 이미 잡힌 건
      broken.push({
        articleId: article.id,
        articleTitle: article.title,
        mediaId,
        position: null,
        url,
        reason: "본문이 옛 이미지 주소를 가리킵니다",
        repairable: true,
      });
    }
  }

  return broken;
}

export interface RepairResult {
  bodiesFixed: number;
  imagesRegenerated: number;
  failed: Array<{ articleId: number; mediaId: number | null; error: string }>;
}

export async function repairBrokenImages(): Promise<RepairResult> {
  const result: RepairResult = { bodiesFixed: 0, imagesRegenerated: 0, failed: [] };

  // ① 본문의 옛 주소를 MediaAsset의 현재 주소로 되돌린다 (파일명에 박힌 mediaId로 짝을 찾는다)
  const assets = await prisma.mediaAsset.findMany({
    where: { webpUrl: { not: null } },
    select: { id: true, webpUrl: true },
  });
  const current = new Map(assets.map((a) => [a.id, a.webpUrl!]));

  for (const article of await prisma.article.findMany({
    select: { id: true, contentMarkdown: true, contentHtml: true },
  })) {
    const swap = (text: string) =>
      text.replace(MEDIA_URL, (orig, _articleId, mediaId) => current.get(Number(mediaId)) ?? orig);
    const md = article.contentMarkdown ?? "";
    const nextMd = swap(md);
    if (nextMd === md) continue;
    await prisma.article.update({
      where: { id: article.id },
      data: { contentMarkdown: nextMd, contentHtml: await renderContentHtml(nextMd) },
    });
    result.bodiesFixed += 1;
  }

  // ② 파일이 사라진 이미지는 저장된 프롬프트로 다시 만든다 (같은 의도의 그림이 나온다)
  for (const item of await scanBrokenImages()) {
    if (!item.mediaId || !item.repairable || item.reason === "본문이 옛 이미지 주소를 가리킵니다") continue;
    try {
      await regenerateArticleImage(item.articleId, item.mediaId);
      result.imagesRegenerated += 1;
    } catch (error) {
      result.failed.push({
        articleId: item.articleId,
        mediaId: item.mediaId,
        error: (error as Error).message,
      });
    }
  }

  return result;
}
