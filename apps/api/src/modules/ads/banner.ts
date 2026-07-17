import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../../common/prisma.js";
import { HttpError } from "../../common/http.js";
import { mediaDir, mediaPublicUrl } from "../images/image-service.js";

/**
 * 상품(쿠팡·네이버) → 배너 이미지 자동 생성.
 * Gemini는 브랜드 상품을 정확히 못 그리므로(기존 교훈), 실제 상품 사진을 그대로 쓰고
 * 가격·CTA·소스 배지를 sharp로 합성한다. 한글은 SVG에 임베드한 웹폰트로 렌더한다.
 */

// S-CoreDream(에스코어드림) — 사이트 폰트와 통일. 최초 1회 받아 base64 캐시.
let fontB64: string | null = null;
async function coreFont(): Promise<string> {
  if (fontB64) return fontB64;
  const url = "https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_six@1.2/S-CoreDream-6Bold.woff";
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  fontB64 = Buffer.from(await res.arrayBuffer()).toString("base64");
  return fontB64;
}

async function fetchImage(url: string): Promise<Buffer | null> {
  try {
    // 쿠팡·네이버 CDN은 referer 차단이 있으므로 referer 없이 요청
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "image/*" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 글자 폭 근사로 줄바꿈 (한글 ~1, 영숫 ~0.5) */
function wrap(text: string, maxUnits: number, maxLines: number): string[] {
  const width = (ch: string) => (/[\x00-\xff]/.test(ch) ? 0.55 : 1);
  const lines: string[] = [];
  let cur = "";
  let u = 0;
  for (const ch of text) {
    const w = width(ch);
    if (u + w > maxUnits) {
      lines.push(cur);
      cur = ch;
      u = w;
      if (lines.length >= maxLines - 1) break;
    } else {
      cur += ch;
      u += w;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines && text.length > lines.join("").length) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/.$/, "…");
  }
  return lines;
}

const FORMATS: Record<string, { w: number; h: number }> = {
  wide: { w: 970, h: 250 },
  box: { w: 336, h: 280 },
  card: { w: 400, h: 500 },
};

export async function generateProductBanner(
  productId: number,
  format: "wide" | "box" | "card" = "box",
): Promise<{ url: string; linkUrl: string }> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new HttpError(404, "상품을 찾을 수 없습니다.");
  if (!product.productUrl) throw new HttpError(400, "상품 링크가 없습니다.");

  const { w, h } = FORMATS[format] ?? FORMATS.box;
  const isCoupang = product.source === "COUPANG";
  const accent = isCoupang ? "#e52528" : "#03c75a";
  const brand = isCoupang ? "쿠팡" : "네이버";
  const cta = isCoupang ? "쿠팡에서 최저가 확인" : "네이버에서 상품 보기";
  const font = await coreFont();

  // 상품 이미지 (실사) — 없거나 실패하면 단색 박스
  const imgBuf = product.imageUrl ? await fetchImage(product.imageUrl) : null;

  const isWide = format === "wide";
  // 레이아웃 좌표
  const pad = 18;
  const imgSize = isWide ? h - pad * 2 : Math.min(w - pad * 2, 150);
  const imgX = pad;
  const imgY = isWide ? pad : pad;
  const textX = isWide ? imgSize + pad * 2 : pad;
  const textY = isWide ? pad + 10 : imgY + imgSize + 14;
  const textW = isWide ? w - textX - pad : w - pad * 2;

  const nameLines = wrap(product.name, isWide ? 32 : 24, 2);
  const priceStr = product.price ? `${product.price.toLocaleString("ko-KR")}원` : "";

  const nameTspans = nameLines
    .map((ln, i) => `<tspan x="${textX}" dy="${i === 0 ? 0 : 26}">${esc(ln)}</tspan>`)
    .join("");

  const svg = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
    <defs><style>
      @font-face { font-family:'SC'; src:url(data:font/woff;base64,${font}) format('woff'); font-weight:700; }
      text { font-family:'SC','Noto Sans KR',sans-serif; }
    </style></defs>
    <rect width="${w}" height="${h}" rx="14" fill="#ffffff" stroke="${accent}" stroke-width="2"/>
    <rect x="${imgX}" y="${imgY}" width="${imgSize}" height="${imgSize}" rx="10" fill="#f4f4f5"/>
    <rect x="${w - 52}" y="10" width="42" height="19" rx="4" fill="#f1f1f1"/>
    <text x="${w - 31}" y="23.5" font-size="11" fill="#9aa0a6" text-anchor="middle" font-weight="700">AD</text>
    <text x="${textX}" y="${textY}" font-size="12" fill="${accent}" font-weight="700">${esc(brand)} 추천</text>
    <text x="${textX}" y="${textY + 28}" font-size="18" fill="#1a1a1a" font-weight="700">${nameTspans}</text>
    ${priceStr ? `<text x="${textX}" y="${textY + 28 + nameLines.length * 26 + 6}" font-size="24" fill="${accent}" font-weight="700">${esc(priceStr)}</text>` : ""}
    <g>
      <rect x="${textX}" y="${h - (isWide ? 62 : 56)}" width="${Math.min(textW, 240)}" height="42" rx="9" fill="${accent}"/>
      <text x="${textX + Math.min(textW, 240) / 2}" y="${h - (isWide ? 62 : 56) + 27}" font-size="15" fill="#ffffff" font-weight="700" text-anchor="middle">${esc(cta)} →</text>
    </g>
  </svg>`;

  const composites: sharp.OverlayOptions[] = [];
  if (imgBuf) {
    try {
      const resized = await sharp(imgBuf)
        .resize(imgSize - 8, imgSize - 8, { fit: "contain", background: "#f4f4f5" })
        .png()
        .toBuffer();
      composites.push({ input: resized, top: imgY + 4, left: imgX + 4 });
    } catch {
      // 이미지 처리 실패 시 배경 박스만
    }
  }

  const out = await sharp(Buffer.from(svg)).composite(composites).webp({ quality: 88 }).toBuffer();
  const fileName = `banner-${product.id}-${format}-${Date.now()}.webp`;
  await fs.writeFile(path.join(mediaDir(), fileName), out);
  const url = `${mediaPublicUrl().replace(/\/$/, "")}/${fileName}`;
  return { url, linkUrl: product.productUrl };
}
