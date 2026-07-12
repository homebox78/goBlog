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

interface BridgeResult {
  html: string | null;
  title: string | null;
  image: string | null;
  ping?: boolean;
}

export function fetchNaverViaExtension(url: string, timeoutMs = 13000): Promise<BridgeResult> {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).slice(2);
    const onMsg = (event: MessageEvent) => {
      const d = event.data;
      if (!d || d.type !== "GOBLOG_NAVER_FETCH_RESULT" || d.id !== id) return;
      clearTimeout(timer);
      window.removeEventListener("message", onMsg);
      if (d.ping) resolve({ html: null, title: null, image: null, ping: true });
      else if (d.ok) resolve({ html: d.html ?? null, title: d.title ?? null, image: d.image ?? null });
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

/** 확장 다리가 실제로 응답하는지 핑으로 확인 (마커 속성보다 신뢰적) */
export async function pingExtension(timeoutMs = 1500): Promise<boolean> {
  try {
    await fetchNaverViaExtension("__ping__", timeoutMs);
    return true;
  } catch {
    return false;
  }
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
  // og:title은 "상품명 : 스토어명" 형식 — 마지막 ':' 뒤 스토어명 제거
  const name = rawTitle.replace(/\s*:\s*[^:]+$/, "").replace(/\s*[|-]\s*(네이버|스마트스토어|naver).*$/i, "").trim() || null;
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
export type EnrichReason = "no-store-url" | "has-name" | "no-extension" | "blocked" | "failed" | null;

export async function enrichNaverInput(
  raw: string,
): Promise<{ input: string; extracted: NaverProductInfo | null; reason: EnrichReason }> {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const store = lines.find((l) => STORE_URL.test(l));
  const hasName = lines.some((l) => !/^https?:\/\//i.test(l) && l.length >= 2);
  if (!store) return { input: raw, extracted: null, reason: "no-store-url" };
  if (hasName) return { input: raw, extracted: null, reason: "has-name" };
  if (!(await pingExtension())) return { input: raw, extracted: null, reason: "no-extension" };
  try {
    const r = await fetchNaverViaExtension(store);
    // 백그라운드 탭이 읽은 og:title/og:image를 우선 사용, 없으면 html 파싱 폴백
    const parsed = r.html ? parseNaverProductHtml(r.html) : { name: null, imageUrl: null, price: null };
    const name = cleanNaverTitle(r.title) ?? parsed.name;
    const imageUrl = r.image ?? parsed.imageUrl;
    if (!name) return { input: raw, extracted: null, reason: "blocked" };
    const info: NaverProductInfo = { name, imageUrl, price: parsed.price };
    const extra = [name, ...(imageUrl ? [imageUrl] : [])];
    return { input: [...lines, ...extra].join("\n"), extracted: info, reason: null };
  } catch {
    return { input: raw, extracted: null, reason: "failed" };
  }
}

/** og:title "상품명 : 스토어명" → 상품명만 */
function cleanNaverTitle(raw: string | null): string | null {
  if (!raw) return null;
  if (/에러\s*페이지|시스템\s*오류|접근이\s*제한|잘못된\s*접근/.test(raw)) return null;
  return (
    raw
      .replace(/\s*:\s*[^:]+$/, "")
      .replace(/\s*[|-]\s*(네이버|스마트스토어|naver).*$/i, "")
      .trim() || null
  );
}

/** 스마트스토어 추출 실패 사유 → 사용자 안내 문구 (실패해도 서버 폴백은 계속 진행) */
export function enrichFailureMessage(reason: EnrichReason): string | null {
  switch (reason) {
    case "no-extension":
      return "goBlog 크롬 확장이 감지되지 않습니다. chrome://extensions에서 확장을 새로고침(v0.1.11+)한 뒤, 이 페이지도 새로고침해주세요.";
    case "blocked":
      return "확장이 페이지를 열었지만 네이버가 차단했습니다. 상품명을 한 줄 추가해주세요.";
    case "failed":
      return "확장이 스마트스토어 페이지를 가져오지 못했습니다. 확장 새로고침 후 재시도하거나 상품명을 한 줄 추가해주세요.";
    default:
      return null;
  }
}
