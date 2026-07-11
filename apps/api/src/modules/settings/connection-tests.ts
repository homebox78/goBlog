import { getSettingValues } from "./settings.service.js";

export interface TestResult {
  ok: boolean;
  message: string;
  detail?: unknown;
}

async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Anthropic: 모델 목록 조회로 API 키를 검증한다. */
export async function testAnthropic(): Promise<TestResult> {
  const { "anthropic.apiKey": apiKey } = await getSettingValues(["anthropic.apiKey"]);
  if (!apiKey) return { ok: false, message: "Anthropic API Key가 설정되지 않았습니다." };

  const res = await safeFetch("https://api.anthropic.com/v1/models?limit=5", {
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    return {
      ok: false,
      message: `Anthropic API 오류 (HTTP ${res.status})`,
      detail: (body as { error?: { message?: string } } | null)?.error?.message,
    };
  }

  const data = (await res.json()) as { data?: Array<{ id: string }> };
  return {
    ok: true,
    message: "Anthropic API 연결 성공",
    detail: data.data?.map((model) => model.id),
  };
}

/** Gemini: 모델 목록 조회로 API 키를 검증한다. */
export async function testGemini(): Promise<TestResult> {
  const { "gemini.apiKey": apiKey } = await getSettingValues(["gemini.apiKey"]);
  if (!apiKey) return { ok: false, message: "Gemini API Key가 설정되지 않았습니다." };

  const res = await safeFetch(
    `https://generativelanguage.googleapis.com/v1beta/models?pageSize=5&key=${encodeURIComponent(apiKey)}`,
  );

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    return {
      ok: false,
      message: `Gemini API 오류 (HTTP ${res.status})`,
      detail: (body as { error?: { message?: string } } | null)?.error?.message,
    };
  }

  const data = (await res.json()) as { models?: Array<{ name: string }> };
  return {
    ok: true,
    message: "Gemini API 연결 성공",
    detail: data.models?.map((model) => model.name),
  };
}

/** Google Ads: refresh token으로 access token을 발급받아 접근 가능한 계정을 조회한다. */
export async function testGoogleAds(): Promise<TestResult> {
  const values = await getSettingValues([
    "googleAds.developerToken",
    "googleAds.clientId",
    "googleAds.clientSecret",
    "googleAds.refreshToken",
    "googleAds.apiVersion",
    "googleAds.loginCustomerId",
  ]);

  const missing = ["googleAds.developerToken", "googleAds.clientId", "googleAds.clientSecret", "googleAds.refreshToken"]
    .filter((key) => !values[key]);
  if (missing.length > 0) {
    return { ok: false, message: `Google Ads 설정 누락: ${missing.join(", ")}` };
  }

  const tokenRes = await safeFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: values["googleAds.clientId"]!,
      client_secret: values["googleAds.clientSecret"]!,
      refresh_token: values["googleAds.refreshToken"]!,
      grant_type: "refresh_token",
    }),
  });

  const tokenData = (await tokenRes.json()) as { access_token?: string; error_description?: string };
  if (!tokenRes.ok || !tokenData.access_token) {
    return { ok: false, message: "Google OAuth 토큰 발급 실패", detail: tokenData.error_description };
  }

  const version = values["googleAds.apiVersion"] || "v21";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${tokenData.access_token}`,
    "developer-token": values["googleAds.developerToken"]!,
  };
  if (values["googleAds.loginCustomerId"]) {
    headers["login-customer-id"] = values["googleAds.loginCustomerId"]!.replace(/\D/g, "");
  }

  const res = await safeFetch(
    `https://googleads.googleapis.com/${version}/customers:listAccessibleCustomers`,
    { headers },
  );

  const data = (await res.json().catch(() => null)) as
    | { resourceNames?: string[]; error?: { message?: string } }
    | null;
  if (!res.ok) {
    return { ok: false, message: `Google Ads API 오류 (HTTP ${res.status})`, detail: data?.error?.message };
  }

  return { ok: true, message: "Google Ads API 연결 성공", detail: data?.resourceNames };
}

/** WordPress: Application Password로 현재 사용자 정보를 조회한다. */
export async function testWordpress(): Promise<TestResult> {
  const values = await getSettingValues(["wordpress.url", "wordpress.username", "wordpress.appPassword"]);

  const missing = Object.entries(values).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length > 0) {
    return { ok: false, message: `WordPress 설정 누락: ${missing.join(", ")}` };
  }

  const baseUrl = values["wordpress.url"]!.replace(/\/+$/, "");
  const credentials = Buffer.from(
    `${values["wordpress.username"]}:${values["wordpress.appPassword"]}`,
  ).toString("base64");

  const res = await safeFetch(`${baseUrl}/wp-json/wp/v2/users/me?context=edit`, {
    headers: { Authorization: `Basic ${credentials}` },
  });

  const data = (await res.json().catch(() => null)) as
    | { name?: string; message?: string }
    | null;
  if (!res.ok) {
    return { ok: false, message: `WordPress API 오류 (HTTP ${res.status})`, detail: data?.message };
  }

  return { ok: true, message: `WordPress 연결 성공 (${data?.name ?? "사용자"})` };
}
