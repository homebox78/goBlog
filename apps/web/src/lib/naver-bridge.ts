/**
 * 네이버 상품 정보 추출 다리 — goBlog 크롬 확장(v0.1.10+) 경유.
 *
 * 네이버는 서버(데이터센터 IP) 요청을 429로 차단하므로, 확장이 설치된 브라우저에서
 * 스마트스토어 페이지를 대신 가져와(og 태그) 상품명·이미지·가격을 읽는다.
 * 확장이 없으면 조용히 실패 → 서버 폴백(상품명 줄 안내)으로 진행된다.
 */

export function hasGoblogExtension(): boolean {
  return document.documentElement.hasAttribute("data-goblog-ext");
}

export function fetchNaverHtmlViaExtension(url: string, timeoutMs = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).slice(2);
    const onMsg = (event: MessageEvent) => {
      const d = event.data;
      if (!d || d.type !== "GOBLOG_NAVER_FETCH_RESULT" || d.id !== id) return;
      clearTimeout(timer);
      window.removeEventListener("message", onMsg);
      if (d.ok && d.html) resolve(d.html as string);
      else reject(new Error(d.error || `HTTP ${d.status}`));
    };
    const timer = setTimeout(() => {
      window.removeEventListener("message", onMsg);
      reject(new Error("확장 응답 시간 초과"));
    }, timeoutMs);
    window.addEventListener("message", onMsg);
    window.postMessage({ type: "GOBLOG_NAVER_FETCH", id, url }, "*");
  });
}

export interface NaverProductInfo {
  name: string | null;
  imageUrl: string | null;
  price: number | null;
}

export function parseNaverProductHtml(html: string): NaverProductInfo {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const meta = (p: string) =>
    doc.querySelector(`meta[property="${p}"], meta[name="${p}"]`)?.getAttribute("content") ?? null;
  const rawTitle = meta("og:title") || doc.querySelector("title")?.textContent || "";
  // 차단/에러 페이지면 실패 처리
  if (/에러\s*페이지|시스템\s*오류|접근이\s*제한|잘못된\s*접근/.test(rawTitle)) {
    return { name: null, imageUrl: null, price: null };
  }
  const name = rawTitle.replace(/\s*[:|-]\s*(네이버|스마트스토어|쇼핑|naver).*$/i, "").trim() || null;
  const imageUrl = meta("og:image");
  let price: number | null = null;
  const m = html.match(/"(?:discountedSalePrice|salePrice|lowPrice|price)"\s*:\s*"?([\d,]+)"?/);
  if (m) {
    const n = Number(m[1].replace(/[^\d]/g, ""));
    if (Number.isFinite(n) && n > 0) price = n;
  }
  return { name, imageUrl, price };
}

const STORE_URL = /^https?:\/\/(m\.)?(smartstore|shopping|brand)\.naver\.com\//i;

/**
 * 배너/분석 입력을 보강한다: 스마트스토어 URL이 있고 상품명 줄이 없으면
 * 확장으로 페이지를 가져와 상품명·이미지 줄을 자동으로 붙인다.
 * (서버의 analyzeNaverPaste가 그 줄들을 그대로 사용 — 링크는 naver.me 유지)
 */
export async function enrichNaverInput(raw: string): Promise<{ input: string; extracted: NaverProductInfo | null }> {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const store = lines.find((l) => STORE_URL.test(l));
  const hasName = lines.some((l) => !/^https?:\/\//i.test(l) && l.length >= 2);
  if (!store || hasName || !hasGoblogExtension()) return { input: raw, extracted: null };
  try {
    const info = parseNaverProductHtml(await fetchNaverHtmlViaExtension(store));
    if (!info.name) return { input: raw, extracted: null };
    const extra = [info.name, ...(info.imageUrl ? [info.imageUrl] : [])];
    return { input: [...lines, ...extra].join("\n"), extracted: info };
  } catch {
    return { input: raw, extracted: null };
  }
}
