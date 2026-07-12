import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { prisma } from "../../common/prisma.js";
import { HttpError } from "../../common/http.js";
import { getSettingValues } from "../settings/settings.service.js";
import { renderContentHtml } from "../articles/render.js";

const here = path.dirname(fileURLToPath(import.meta.url));

export function mediaDir(): string {
  return process.env.MEDIA_DIR || path.resolve(here, "../../../storage/media");
}

export function mediaPublicUrl(): string {
  return (process.env.MEDIA_PUBLIC_URL || "http://localhost:8787/media").replace(/\/+$/, "");
}

/** 등장 캐릭터 키에 해당하는 레퍼런스 이미지를 base64로 읽어온다. */
async function loadCharacterReferences(keys: string[]): Promise<Array<{ mimeType: string; data: string }>> {
  const refs: Array<{ mimeType: string; data: string }> = [];
  for (const key of keys) {
    try {
      const buf = await fs.readFile(path.join(mediaDir(), "characters", `${key}.webp`));
      refs.push({ mimeType: "image/webp", data: buf.toString("base64") });
    } catch {
      // 레퍼런스 없으면 건너뜀
    }
  }
  return refs;
}

/** Gemini 이미지 생성 → PNG 원본 + WebP(최대 1600px) 저장, 공개 URL 반환 */
async function generateOneImage(prompt: string, fileBase: string, characterKeys: string[] = []): Promise<{
  originalUrl: string;
  webpUrl: string;
  width: number;
  height: number;
  bytes: number;
}> {
  const values = await getSettingValues(["gemini.apiKey", "gemini.imageModel"]);
  const apiKey = values["gemini.apiKey"];
  const model = values["gemini.imageModel"] || "gemini-2.5-flash-image";
  if (!apiKey) throw new HttpError(400, "Gemini API Key가 설정되지 않았습니다.");

  const references = await loadCharacterReferences(characterKeys);

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const STYLE_GUIDE =
    "Style: bright, warm, clean and positive mood — never dark, gloomy, or depressing. " +
    "All people must be Korean (East Asian) — absolutely no Western or foreign-looking faces. " +
    "Absolutely NO text, letters, words, numbers, captions, logos, brand marks, trademarks, or brand names anywhere in the image " +
    "(no Apple logo, no Samsung/Nike/etc. marks, no product packaging text) — this avoids copyright/trademark problems. " +
    "Do NOT depict a specific branded product close-up (product renders come out inaccurate and misleading). " +
    "Instead show the SCENE or lifestyle around it — e.g. for ramen, a person happily eating ramen, not a ramen package. " +
    "Use only generic, unbranded, logo-free objects and devices. " +
    "If a product must appear, keep it far away as a small unbranded element in a long/wide shot, never the focus. " +
    "Wide 4:3 landscape composition, natural lighting, clean modern look.";
  const REFERENCE_GUIDE =
    references.length > 0
      ? " Reference character image(s) are provided. Use these EXACT characters in the scene — keep their face, hairstyle, clothing, proportions and art style perfectly consistent with the references."
      : "";

  const requestBody = (withAspect: boolean) => ({
    contents: [
      {
        parts: [
          { text: `${prompt}\n\n${STYLE_GUIDE}${REFERENCE_GUIDE}` },
          ...references.map((ref) => ({ inline_data: { mime_type: ref.mimeType, data: ref.data } })),
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["IMAGE"],
      ...(withAspect ? { imageConfig: { aspectRatio: "4:3" } } : {}),
    },
  });

  let res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody(true)),
  });

  // 일부 모델은 imageConfig를 지원하지 않음 — 프롬프트+서버 크롭으로 폴백
  if (res.status === 400) {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody(false)),
    });
  }

  const data = (await res.json().catch(() => null)) as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType: string; data: string } }> } }>;
    error?: { message?: string };
  } | null;

  const inline = data?.candidates?.[0]?.content?.parts?.find((part) => part.inlineData)?.inlineData;
  if (!res.ok || !inline) {
    throw new HttpError(502, `Gemini 이미지 생성 실패: ${data?.error?.message ?? `HTTP ${res.status}`}`);
  }

  await prisma.modelUsageLog
    .create({ data: { provider: "gemini", model, operation: "image-generate" } })
    .catch(() => undefined);

  const raw = Buffer.from(inline.data, "base64");
  const dir = mediaDir();
  await fs.mkdir(dir, { recursive: true });

  const pngName = `${fileBase}.png`;
  const webpName = `${fileBase}.webp`;
  await fs.writeFile(path.join(dir, pngName), raw);

  // 4:3 가로형 보장 — 비율이 다르면 중앙 크롭 (세로 짧고 가로 길게)
  const source = sharp(raw);
  const srcMeta = await source.metadata();
  const srcWidth = srcMeta.width ?? 1024;
  const srcHeight = srcMeta.height ?? 1024;
  const is43 = Math.abs(srcWidth / srcHeight - 4 / 3) < 0.02;

  const width = Math.min(1600, srcWidth);
  const pipeline = is43
    ? source.resize({ width, withoutEnlargement: true })
    : source.resize({ width, height: Math.round(width * 0.75), fit: "cover", position: "centre" });

  const webp = await pipeline.webp({ quality: 82 }).toBuffer();
  await fs.writeFile(path.join(dir, webpName), webp);
  const meta = await sharp(webp).metadata();

  return {
    originalUrl: `${mediaPublicUrl()}/${pngName}`,
    webpUrl: `${mediaPublicUrl()}/${webpName}`,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    bytes: webp.length,
  };
}

/**
 * 사용자가 직접 올린 이미지를 저장(webp)하고 본문에 삽입한다.
 * Gemini로 만들 수 없는 특정 사진(초상권 등)을 직접 편집해 올릴 때 사용.
 */
export async function uploadArticleImage(
  articleId: number,
  dataUrl: string,
  opts: { kind?: string; caption?: string; altText?: string } = {},
): Promise<{ id: number; webpUrl: string; kind: string; figure: string; width: number | null; height: number | null }> {
  const match = /^data:(image\/[\w.+-]+);base64,(.+)$/s.exec(dataUrl.trim());
  if (!match) throw new HttpError(400, "이미지 파일이 올바르지 않습니다. (jpg/png/webp 등)");
  const raw = Buffer.from(match[2], "base64");
  if (raw.length === 0) throw new HttpError(400, "빈 이미지입니다.");

  const article = await prisma.article.findUnique({ where: { id: articleId } });
  if (!article) throw new HttpError(404, "글을 찾을 수 없습니다.");

  const dir = mediaDir();
  await fs.mkdir(dir, { recursive: true });
  const webpName = `upload-${articleId}-${Date.now()}.webp`;
  const webp = await sharp(raw)
    .rotate() // EXIF 방향 정규화
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  await fs.writeFile(path.join(dir, webpName), webp);
  const meta = await sharp(webp).metadata();

  const kind = opts.kind === "FEATURED" ? "FEATURED" : "CONTENT";
  const last = await prisma.mediaAsset.findFirst({ where: { articleId }, orderBy: { position: "desc" } });
  const position = (last?.position ?? 0) + 1;
  const altText = (opts.altText ?? "").trim() || article.title;
  const caption = opts.caption?.trim() || null;
  const webpUrl = `${mediaPublicUrl()}/${webpName}`;

  const asset = await prisma.mediaAsset.create({
    data: {
      articleId,
      kind,
      webpUrl,
      fileName: webpName,
      altText,
      caption,
      width: meta.width ?? null,
      height: meta.height ?? null,
      bytes: webp.length,
      position,
    },
  });

  // figure(본문 삽입용 HTML)는 프론트가 커서 위치에 넣도록 반환만 한다 (자동으로 끝에 붙이지 않음).
  const figure = contentFigure({ webpUrl, altText, caption }, position);
  return { id: asset.id, webpUrl, kind, figure, width: meta.width ?? null, height: meta.height ?? null };
}

/** 업로드 이미지(미디어) 삭제 + 파일 제거. 본문의 figure 제거는 프론트가 담당(편집 중 폼 기준). */
export async function deleteArticleImage(articleId: number, mediaId: number): Promise<{ ok: boolean }> {
  const asset = await prisma.mediaAsset.findFirst({ where: { id: mediaId, articleId } });
  if (!asset) throw new HttpError(404, "이미지를 찾을 수 없습니다.");
  if (asset.fileName) {
    await fs.unlink(path.join(mediaDir(), asset.fileName)).catch(() => undefined);
  }
  await prisma.mediaAsset.delete({ where: { id: mediaId } });
  return { ok: true };
}

function contentFigure(
  image: { webpUrl: string; altText: string; caption: string | null },
  slot: number,
  aiGenerated = false,
): string {
  const caption = image.caption
    ? `<figcaption style="font-size:13px;color:#888;margin-top:6px;text-align:center;">${image.caption}</figcaption>`
    : "";
  // AI 생성 이미지엔 투명성 표기(작게)
  const aiNote = aiGenerated
    ? `<figcaption style="font-size:11px;color:#bbb;margin-top:4px;text-align:center;">AI 생성 이미지입니다.</figcaption>`
    : "";
  return `<figure data-img="${slot}" style="margin:24px 0;"><img src="${image.webpUrl}" alt="${image.altText}" style="width:100%;height:auto;display:block;border-radius:10px;" />${caption}${aiNote}</figure>`;
}

/**
 * 글의 이미지를 생성해 본문에 삽입한다.
 * webpUrl이 없거나 현재 서버의 공개 URL이 아닌(=이전에 다른 환경에서 만든 로컬 URL) 이미지는 재생성한다.
 */
export async function generateArticleImages(articleId: number): Promise<{ generated: number; failed: number }> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { media: { orderBy: { position: "asc" } } },
  });
  if (!article) throw new HttpError(404, "글을 찾을 수 없습니다.");

  const base = mediaPublicUrl();
  const pending = article.media.filter(
    (asset) => asset.prompt && (!asset.webpUrl || !asset.webpUrl.startsWith(base)),
  );
  if (pending.length === 0) {
    return { generated: 0, failed: 0 };
  }

  let generated = 0;
  let failed = 0;

  for (const asset of pending) {
    try {
      const fileBase = `a${articleId}-m${asset.id}-${Date.now()}`;
      const characterKeys = asset.characterKeys ? asset.characterKeys.split(",").filter(Boolean) : [];
      const result = await generateOneImage(asset.prompt!, fileBase, characterKeys);
      await prisma.mediaAsset.update({
        where: { id: asset.id },
        data: {
          fileName: `${fileBase}.webp`,
          originalUrl: result.originalUrl,
          webpUrl: result.webpUrl,
          width: result.width,
          height: result.height,
          bytes: result.bytes,
        },
      });
      generated += 1;
    } catch (error) {
      console.error(`[images] asset ${asset.id} 생성 실패:`, (error as Error).message);
      failed += 1;
    }
  }

  // 본문 재구성 — 최신 CONTENT 이미지 URL로 다시 삽입
  const fresh = await prisma.mediaAsset.findMany({
    where: { articleId, kind: "CONTENT", webpUrl: { not: null } },
    orderBy: { position: "asc" },
  });

  if (article.contentMarkdown) {
    // 이전에 삽입된 figure 블록을 모두 제거하고(로컬 URL 포함 가능) 다시 넣는다
    let markdown = article.contentMarkdown.replace(/<figure[\s\S]*?<\/figure>/g, "").replace(/\n{3,}/g, "\n\n");

    const remaining: typeof fresh = [];
    for (const asset of fresh) {
      const image = { webpUrl: asset.webpUrl!, altText: asset.altText ?? "", caption: asset.caption };
      const marker = `[IMAGE:${asset.position}]`;
      if (markdown.includes(marker)) {
        markdown = markdown.replace(marker, `\n\n${contentFigure(image, asset.position ?? 0, true)}\n\n`);
      } else {
        remaining.push(asset);
      }
    }
    markdown = markdown.replace(/\[IMAGE:\d+\]/g, "");

    // 마커가 없던 이미지는 H2(##) 앞에 순서대로 배치, 부족하면 본문 끝에
    if (remaining.length > 0) {
      const lines = markdown.split("\n");
      const h2Indexes = lines.map((line, index) => (/^##\s/.test(line) ? index : -1)).filter((index) => index > 0);
      let placed = 0;
      const insertions = new Map<number, string>();
      for (const asset of remaining) {
        const image = { webpUrl: asset.webpUrl!, altText: asset.altText ?? "", caption: asset.caption };
        const figure = contentFigure(image, asset.position ?? 0, true);
        if (placed < h2Indexes.length) {
          insertions.set(h2Indexes[placed], figure);
          placed += 1;
        } else {
          lines.push("", figure);
        }
      }
      markdown = lines
        .map((line, index) => (insertions.has(index) ? `${insertions.get(index)}\n\n${line}` : line))
        .join("\n");
    }

    const contentHtml = await renderContentHtml(markdown);
    await prisma.article.update({ where: { id: articleId }, data: { contentMarkdown: markdown, contentHtml } });
  }

  return { generated, failed };
}
