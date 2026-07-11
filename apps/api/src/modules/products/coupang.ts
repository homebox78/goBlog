import crypto from "node:crypto";
import { getSettingValues } from "../settings/settings.service.js";
import { HttpError } from "../../common/http.js";

const HOST = "https://api-gateway.coupang.com";
const BASE = "/v2/providers/affiliate_open_api/apis/openapi/v1";

export interface CoupangProduct {
  productId: number | string;
  productName: string;
  productPrice: number;
  productImage: string;
  productUrl: string;
  categoryName?: string;
  isRocket?: boolean;
  isFreeShipping?: boolean;
}

async function getCoupangKeys() {
  const values = await getSettingValues(["coupang.accessKey", "coupang.secretKey", "coupang.subId"]);
  const accessKey = values["coupang.accessKey"];
  const secretKey = values["coupang.secretKey"];
  if (!accessKey || !secretKey) {
    throw new HttpError(400, "쿠팡 파트너스 API 키가 설정되지 않았습니다. 설정 → 쿠팡 파트너스에서 입력해주세요.");
  }
  return { accessKey, secretKey, subId: values["coupang.subId"] ?? null };
}

/** 쿠팡 CEA HMAC-SHA256 서명 (signed-date는 UTC yyMMdd'T'HHmmss'Z') */
function buildAuthorization(method: string, uri: string, accessKey: string, secretKey: string): string {
  const [path, query = ""] = uri.split("?");
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const datetime =
    String(now.getUTCFullYear()).slice(2) +
    pad(now.getUTCMonth() + 1) +
    pad(now.getUTCDate()) +
    "T" +
    pad(now.getUTCHours()) +
    pad(now.getUTCMinutes()) +
    pad(now.getUTCSeconds()) +
    "Z";

  const message = datetime + method + path + query;
  const signature = crypto.createHmac("sha256", secretKey).update(message).digest("hex");
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
}

async function coupangRequest<T>(method: "GET" | "POST", uri: string, body?: unknown): Promise<T> {
  const { accessKey, secretKey } = await getCoupangKeys();
  const authorization = buildAuthorization(method, uri, accessKey, secretKey);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let res: Response;
  try {
    res = await fetch(HOST + uri, {
      method,
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  const data = (await res.json().catch(() => null)) as
    | { rCode?: string; rMessage?: string; data?: T }
    | null;
  if (!res.ok || !data || (data.rCode !== undefined && data.rCode !== "0")) {
    throw new HttpError(
      502,
      `쿠팡 파트너스 API 오류 (HTTP ${res.status}): ${data?.rMessage ?? "응답 없음"}`,
    );
  }
  return data.data as T;
}

/** 상품 검색 */
export async function searchCoupangProducts(keyword: string, limit = 20): Promise<CoupangProduct[]> {
  const result = await coupangRequest<{ productData?: CoupangProduct[] } | CoupangProduct[]>(
    "GET",
    `${BASE}/products/search?keyword=${encodeURIComponent(keyword)}&limit=${limit}`,
  );
  return Array.isArray(result) ? result : (result?.productData ?? []);
}

/** 골드박스 (오늘의 특가) */
export async function getCoupangGoldbox(): Promise<CoupangProduct[]> {
  const { subId } = await getCoupangKeys();
  const query = subId ? `?subId=${encodeURIComponent(subId)}` : "";
  const result = await coupangRequest<CoupangProduct[]>("GET", `${BASE}/products/goldbox${query}`);
  return result ?? [];
}

/** 일반 쿠팡 상품 URL → 제휴 트래킹 딥링크 변환 */
export async function createCoupangDeeplink(url: string): Promise<string> {
  const { subId } = await getCoupangKeys();
  const result = await coupangRequest<Array<{ originalUrl: string; shortenUrl: string; landingUrl: string }>>(
    "POST",
    `${BASE}/deeplink`,
    { coupangUrls: [url], ...(subId ? { subId } : {}) },
  );
  return result?.[0]?.shortenUrl || result?.[0]?.landingUrl || url;
}

/** 연결 테스트 — 골드박스 1건 조회 */
export async function testCoupang(): Promise<{ ok: boolean; message: string; detail?: unknown }> {
  try {
    const products = await getCoupangGoldbox();
    return {
      ok: true,
      message: `쿠팡 파트너스 연결 성공 (골드박스 ${products.length}개 조회)`,
      detail: products.slice(0, 3).map((product) => product.productName),
    };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}
