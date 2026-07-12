import { HttpError } from "../../common/http.js";
import { getSettingValues } from "../settings/settings.service.js";

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

/** 네이버 쇼핑 검색 API — 상품명으로 이미지·가격을 찾는다 (스마트스토어는 서버 크롤링이 차단되므로). */
async function naverShopLookup(
  name: string,
): Promise<{ imageUrl: string | null; price: number | null; title: string | null } | null> {
  try {
    const values = await getSettingValues(["naver.datalabClientId", "naver.datalabClientSecret"]);
    const clientId = values["naver.datalabClientId"];
    const clientSecret = values["naver.datalabClientSecret"];
    if (!clientId || !clientSecret) return null;
    const res = await fetch(
      `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(name)}&display=5`,
      { headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      items?: Array<{ title: string; image?: string; lprice?: string }>;
    };
    const first = data.items?.[0];
    if (!first) return null;
    return {
      imageUrl: first.image ?? null,
      price: first.lprice ? Number(first.lprice) : null,
      title: decodeEntities(first.title.replace(/<\/?b>/g, "")),
    };
  } catch {
    return null;
  }
}

/**
 * 네이버 커넥트 붙여넣기: naver.me(또는 스마트스토어) 링크 + 상품명(한 줄) [+ 이미지 URL 한 줄].
 * 네이버는 서버 크롤링이 차단되므로, 상품명으로 쇼핑 검색 API에서 이미지·가격을 찾고 링크는 트래킹 링크를 유지한다.
 */
async function analyzeNaverPaste(trimmed: string): Promise<AnalyzedProduct | null> {
  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 1) return null;
  const linkLine = lines.find((l) => /^https?:\/\//i.test(l) && /naver\.me|smartstore\.naver|shopping\.naver|brandconnect/i.test(l));
  if (!linkLine) return null;

  const imgLine = lines.find(
    (l) => l !== linkLine && /^https?:\/\//i.test(l) && /pstatic\.net|\.(jpe?g|png|webp|gif)(\?|$)/i.test(l),
  );
  const nameLine = lines.find((l) => l !== linkLine && l !== imgLine && !/^https?:\/\//i.test(l) && l.length >= 2);

  if (!nameLine) {
    throw new HttpError(
      422,
      "네이버는 링크만으로 상품 정보를 가져올 수 없습니다(크롤링 차단). 링크 아랫줄에 상품명을 함께 붙여넣어 주세요.\n예)\nhttps://naver.me/xxxxx\n퍼니몽키 강아지 노즈워크 장난감",
    );
  }

  // 상품명으로 네이버 쇼핑에서 이미지·가격 검색 (실패해도 이름·링크만으로 배너 생성 가능)
  const found = await naverShopLookup(nameLine);
  return {
    source: "BRANDCONNECT",
    name: nameLine,
    price: found?.price ?? null,
    imageUrl: imgLine ?? found?.imageUrl ?? null,
    description: null,
    productUrl: linkLine, // 트래킹 링크(naver.me) 그대로 유지 — 수수료 집계용
  };
}

/**
 * 상품 입력을 분석한다.
 * ① 쿠팡 파트너스 "이미지+텍스트" HTML 태그 → alt(상품명)·img(이미지)·href(링크) 파싱 (가장 정확)
 * ② 네이버 링크(+상품명 줄) → 쇼핑 검색 API로 이미지·가격 조회
 * ③ 일반 상품 URL → OG/메타 태그 추출
 */
export async function analyzeProductInput(input: string): Promise<AnalyzedProduct> {
  const trimmed = input.trim();

  // 네이버 링크가 포함된 붙여넣기 — 여러 줄(링크+상품명) 또는 링크 단독
  if (/naver\.me|smartstore\.naver|shopping\.naver|brandconnect/i.test(trimmed) && !/<a\s/i.test(trimmed)) {
    const naver = await analyzeNaverPaste(trimmed);
    if (naver) return naver;
  }

  // 쿠팡 이미지+텍스트 HTML 태그 감지 (<a ...><img ...></a>)
  if (/<a\s/i.test(trimmed) && /<img\s/i.test(trimmed)) {
    const href = trimmed.match(/<a[^>]+href=["']([^"']+)["']/i)?.[1];
    const imgSrc = trimmed.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
    const alt = trimmed.match(/<img[^>]+alt=["']([^"']*)["']/i)?.[1];
    if (href) {
      return {
        source: /coupang/i.test(href) ? "COUPANG" : "BRANDCONNECT",
        name: alt ? decodeEntities(alt) : "상품",
        price: null,
        imageUrl: imgSrc ?? null,
        description: null,
        productUrl: href,
      };
    }
  }

  return analyzeProductUrl(trimmed);
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

  // 네이버 등은 서버 요청을 에러/로그인/봇차단 페이지로 돌려준다 — 그 제목을 상품명으로 쓰면 안 된다.
  const BLOCKED =
    /에러\s*페이지|시스템\s*오류|일시적(인)?\s*오류|로그인(이)?\s*필요|본인\s*인증|접근(이)?\s*(제한|차단)|잘못된\s*접근|페이지를\s*찾을\s*수\s*없|not\s*found|access\s*denied|error\s*page/i;
  if (!name || BLOCKED.test(rawTitle) || BLOCKED.test(name)) {
    throw new HttpError(
      422,
      "이 쇼핑몰(네이버 등)은 자동 분석이 막혀 있습니다. 상품명·가격·이미지·링크를 직접 입력해주세요. (링크 필드엔 방금 넣은 주소가 그대로 유지됩니다)",
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
