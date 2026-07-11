import { HttpError } from "../../common/http.js";

export interface AnalyzedProduct {
  source: "COUPANG" | "BRANDCONNECT";
  name: string;
  price: number | null;
  imageUrl: string | null;
  description: string | null;
  productUrl: string;
}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

function extractMeta(html: string, prop: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i"),
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match) return decodeEntities(match[1]);
  }
  return null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .trim();
}

function extractPrice(html: string): number | null {
  // 1) 메타/구조화 데이터 우선
  const metaPrice =
    extractMeta(html, "product:price:amount") ||
    extractMeta(html, "og:price:amount") ||
    extractMeta(html, "twitter:data1");
  if (metaPrice) {
    const num = Number(metaPrice.replace(/[^\d]/g, ""));
    if (Number.isFinite(num) && num > 0) return num;
  }
  // 2) JSON-LD price / lowPrice
  const jsonLd = html.match(/"(?:price|lowPrice)"\s*:\s*"?(\d[\d,]*)"?/i);
  if (jsonLd) {
    const num = Number(jsonLd[1].replace(/[^\d]/g, ""));
    if (Number.isFinite(num) && num > 0) return num;
  }
  return null;
}

/** 상품 URL을 열어 OG/메타 태그로 상품 정보를 추출한다. */
export async function analyzeProductUrl(rawUrl: string): Promise<AnalyzedProduct> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new HttpError(400, "올바른 상품 URL이 아닙니다.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let res: Response;
  try {
    res = await fetch(rawUrl, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
      redirect: "follow",
      signal: controller.signal,
    });
  } catch (error) {
    throw new HttpError(502, `상품 페이지를 열지 못했습니다: ${(error as Error).message}`);
  } finally {
    clearTimeout(timer);
  }

  const html = await res.text();
  const finalUrl = res.url || rawUrl;

  const rawTitle = extractMeta(html, "og:title") || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || "";
  const name = decodeEntities(rawTitle).replace(/\s*[:|-]\s*(쿠팡|coupang|네이버|스마트스토어|naver).*$/i, "").trim();
  const imageUrl = extractMeta(html, "og:image");
  const description = extractMeta(html, "og:description");
  const price = extractPrice(html);

  const isCoupang = /coupang\.com/i.test(finalUrl) || /coupang\.com/i.test(rawUrl);

  if (!name) {
    throw new HttpError(
      422,
      "상품 정보를 자동으로 읽지 못했습니다 (로그인·봇 차단 페이지일 수 있음). 상품명·가격을 직접 입력해주세요.",
    );
  }

  return {
    source: isCoupang ? "COUPANG" : "BRANDCONNECT",
    name,
    price,
    imageUrl,
    description,
    productUrl: rawUrl, // 사용자가 준 제휴/트래킹 링크를 그대로 유지
  };
}
