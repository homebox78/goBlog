import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { marked } from "marked";
import { prisma } from "../../common/prisma.js";
import { HttpError } from "../../common/http.js";
import { getSettingValues } from "../settings/settings.service.js";

const here = path.dirname(fileURLToPath(import.meta.url));

export function mediaDir(): string {
  return process.env.MEDIA_DIR || path.resolve(here, "../../../storage/media");
}

export function mediaPublicUrl(): string {
  return (process.env.MEDIA_PUBLIC_URL || "http://localhost:8787/media").replace(/\/+$/, "");
}

/** Gemini 이미지 생성 → PNG 원본 + WebP(최대 1600px) 저장, 공개 URL 반환 */
async function generateOneImage(prompt: string, fileBase: string): Promise<{
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

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
    },
  );

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

  const webp = await sharp(raw).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
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

/** 글의 미생성 이미지 프롬프트를 전부 생성하고 본문 [IMAGE:n]에 삽입한다. */
export async function generateArticleImages(articleId: number): Promise<{ generated: number; failed: number }> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { media: { orderBy: { position: "asc" } } },
  });
  if (!article) throw new HttpError(404, "글을 찾을 수 없습니다.");

  const pending = article.media.filter((asset) => asset.prompt && !asset.webpUrl);
  if (pending.length === 0) {
    return { generated: 0, failed: 0 };
  }

  let generated = 0;
  let failed = 0;
  const inserted = new Map<number, { webpUrl: string; altText: string; caption: string | null }>();

  for (const asset of pending) {
    try {
      const fileBase = `a${articleId}-m${asset.id}-${Date.now()}`;
      const result = await generateOneImage(asset.prompt!, fileBase);
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
      if (asset.kind === "CONTENT") {
        inserted.set(asset.position ?? -1, {
          webpUrl: result.webpUrl,
          altText: asset.altText ?? "",
          caption: asset.caption,
        });
      }
    } catch (error) {
      console.error(`[images] asset ${asset.id} 생성 실패:`, (error as Error).message);
      failed += 1;
    }
  }

  // 본문 [IMAGE:n] 마커 치환 (마커 없으면 그대로 둠 — 대표 이미지는 발행 시 사용)
  if (inserted.size > 0 && article.contentMarkdown) {
    let markdown = article.contentMarkdown;
    for (const [position, image] of inserted) {
      const figure = `\n\n<figure><img src="${image.webpUrl}" alt="${image.altText}" style="max-width:100%;border-radius:10px;" />${image.caption ? `<figcaption style="font-size:13px;color:#888;margin-top:6px;">${image.caption}</figcaption>` : ""}</figure>\n\n`;
      const marker = `[IMAGE:${position}]`;
      markdown = markdown.includes(marker)
        ? markdown.replace(marker, figure.trim())
        : markdown;
    }
    // 남은 마커 제거 + 미삽입 이미지는 본문 끝에 첨부하지 않음(과잉 방지)
    markdown = markdown.replace(/\[IMAGE:\d+\]/g, "");
    const contentHtml = await marked.parse(markdown);
    await prisma.article.update({
      where: { id: articleId },
      data: { contentMarkdown: markdown, contentHtml },
    });
  }

  return { generated, failed };
}
