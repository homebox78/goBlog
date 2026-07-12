import { getSettingValues } from "./settings.service.js";

export interface TestResult {
  ok: boolean;
  message: string;
  detail?: unknown;
  name?: string;
  skipped?: boolean;
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

const DEFAULT_CLAUDE_MODELS = [
  "claude-sonnet-5",
  "claude-opus-4-8",
  "claude-haiku-4-5-20251001",
];

/** 설정 화면 드롭다운용 Claude 모델 목록. 키가 있으면 실제 API에서 조회한다. */
export async function listAnthropicModels(): Promise<{
  models: string[];
  source: "api" | "default";
}> {
  const { "anthropic.apiKey": apiKey } = await getSettingValues(["anthropic.apiKey"]);
  if (!apiKey) return { models: DEFAULT_CLAUDE_MODELS, source: "default" };

  try {
    const res = await safeFetch("https://api.anthropic.com/v1/models?limit=100", {
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    });
    if (!res.ok) return { models: DEFAULT_CLAUDE_MODELS, source: "default" };

    const data = (await res.json()) as { data?: Array<{ id: string }> };
    const models = (data.data ?? []).map((model) => model.id).filter((id) => id.startsWith("claude"));
    return models.length > 0
      ? { models, source: "api" }
      : { models: DEFAULT_CLAUDE_MODELS, source: "default" };
  } catch {
    return { models: DEFAULT_CLAUDE_MODELS, source: "default" };
  }
}

const DEFAULT_GEMINI_IMAGE_MODELS = [
  "gemini-2.5-flash-image",
  "imagen-4.0-generate-001",
];

/** 설정 화면 드롭다운용 Gemini 이미지 모델 목록. 키가 있으면 실제 API에서 조회한다. */
export async function listGeminiImageModels(): Promise<{
  models: string[];
  source: "api" | "default";
}> {
  const { "gemini.apiKey": apiKey } = await getSettingValues(["gemini.apiKey"]);
  if (!apiKey) return { models: DEFAULT_GEMINI_IMAGE_MODELS, source: "default" };

  try {
    const res = await safeFetch(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(apiKey)}`,
    );
    if (!res.ok) return { models: DEFAULT_GEMINI_IMAGE_MODELS, source: "default" };

    const data = (await res.json()) as { models?: Array<{ name: string }> };
    const models = (data.models ?? [])
      .map((model) => model.name.replace(/^models\//, ""))
      .filter((id) => id.includes("image") || id.startsWith("imagen"));
    return models.length > 0
      ? { models, source: "api" }
      : { models: DEFAULT_GEMINI_IMAGE_MODELS, source: "default" };
  } catch {
    return { models: DEFAULT_GEMINI_IMAGE_MODELS, source: "default" };
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

/** Blogger: OAuth refresh 토큰으로 블로그 정보를 조회한다. */
export async function testBlogger(): Promise<TestResult> {
  const values = await getSettingValues([
    "blogger.blogId",
    "blogger.clientId",
    "blogger.clientSecret",
    "blogger.refreshToken",
  ]);
  const missing = Object.entries(values).filter(([, value]) => !value).map(([key]) => key.replace("blogger.", ""));
  if (missing.length > 0) {
    return { ok: false, message: `설정 누락: ${missing.join(", ")}` };
  }

  const tokenRes = await safeFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: values["blogger.clientId"]!,
      client_secret: values["blogger.clientSecret"]!,
      refresh_token: values["blogger.refreshToken"]!,
      grant_type: "refresh_token",
    }),
  });
  const tokenData = (await tokenRes.json()) as { access_token?: string; error_description?: string };
  if (!tokenData.access_token) {
    return { ok: false, message: `OAuth 토큰 발급 실패: ${tokenData.error_description ?? "확인 필요"}` };
  }

  const blogIdRaw = values["blogger.blogId"]!.trim();
  const url = /^https?:\/\//i.test(blogIdRaw)
    ? `https://www.googleapis.com/blogger/v3/blogs/byurl?url=${encodeURIComponent(blogIdRaw)}`
    : `https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(blogIdRaw)}`;
  const res = await safeFetch(url, { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
  const blog = (await res.json().catch(() => null)) as { name?: string; posts?: { totalItems?: number }; error?: { message?: string } } | null;
  if (!res.ok || !blog?.name) {
    return { ok: false, message: `블로그 조회 실패: ${blog?.error?.message ?? `HTTP ${res.status}`}` };
  }
  return { ok: true, message: `연결 성공 — "${blog.name}" (게시글 ${blog.posts?.totalItems ?? 0}개)` };
}

/** Instagram: 액세스 토큰으로 비즈니스 계정 정보를 조회한다. */
export async function testInstagram(): Promise<TestResult> {
  const values = await getSettingValues(["instagram.businessAccountId", "instagram.accessToken"]);
  if (!values["instagram.businessAccountId"] || !values["instagram.accessToken"]) {
    return { ok: false, message: "비즈니스 계정 ID·액세스 토큰 미설정" };
  }
  const res = await safeFetch(
    `https://graph.facebook.com/v21.0/${encodeURIComponent(values["instagram.businessAccountId"]!)}?fields=username,name&access_token=${encodeURIComponent(values["instagram.accessToken"]!)}`,
  );
  const data = (await res.json().catch(() => null)) as { username?: string; error?: { message?: string } } | null;
  if (!res.ok || !data?.username) {
    return { ok: false, message: `계정 조회 실패: ${data?.error?.message ?? `HTTP ${res.status}`}` };
  }
  return { ok: true, message: `연결 성공 — @${data.username}` };
}

/** URL 접근 가능 여부 확인 (블로그 존재 확인용) */
async function checkUrlReachable(url: string): Promise<TestResult> {
  try {
    const res = await safeFetch(url, { headers: { "User-Agent": "Mozilla/5.0 (goBlog)" } });
    if (res.status >= 200 && res.status < 400) {
      return { ok: true, message: `블로그 접근 가능 (HTTP ${res.status}) · 발행은 Chrome 확장에서 처리` };
    }
    return { ok: false, message: `접근 실패 (HTTP ${res.status}) — URL을 확인하세요` };
  } catch (error) {
    return { ok: false, message: `접근 불가: ${(error as Error).message}` };
  }
}

/** 네이버 블로그 — 작성 URL에서 블로그 홈 접근 확인 */
export async function testNaverBlog(): Promise<TestResult> {
  const { "naverBlog.writeUrl": url } = await getSettingValues(["naverBlog.writeUrl"]);
  if (!url) return { ok: false, message: "네이버 블로그 작성 URL이 설정되지 않았습니다." };
  const match = url.match(/blog\.naver\.com\/([^/?]+)/);
  return checkUrlReachable(match ? `https://blog.naver.com/${match[1]}` : url);
}

/** 티스토리 — 작성 URL에서 블로그 홈 접근 확인 */
export async function testTistory(): Promise<TestResult> {
  const { "tistory.writeUrl": url } = await getSettingValues(["tistory.writeUrl"]);
  if (!url) return { ok: false, message: "티스토리 작성 URL이 설정되지 않았습니다." };
  const match = url.match(/(https?:\/\/[^/]+)/);
  return checkUrlReachable(match ? match[1] : url);
}

/** 게시 플랫폼 전체 — 서비스별 결과 목록 */
export async function testAllPlatforms(): Promise<{ results: TestResult[] }> {
  const [wordpress, blogger, instagram, naver, tistory] = await Promise.all([
    testWordpress().catch((error) => ({ ok: false, message: (error as Error).message })),
    testBlogger().catch((error) => ({ ok: false, message: (error as Error).message })),
    testInstagram().catch((error) => ({ ok: false, message: (error as Error).message })),
    testNaverBlog().catch((error) => ({ ok: false, message: (error as Error).message })),
    testTistory().catch((error) => ({ ok: false, message: (error as Error).message })),
  ]);
  return {
    results: [
      { name: "WordPress", ...wordpress },
      { name: "Blogger", ...blogger },
      { name: "Instagram", ...instagram },
      { name: "네이버 블로그", ...naver },
      { name: "티스토리", ...tistory },
    ],
  };
}

/** WordPress: Application Password로 현재 사용자 정보를 조회한다. */
export async function testWordpress(): Promise<TestResult> {
  const values = await getSettingValues(["wordpress.url", "wordpress.username", "wordpress.appPassword"]);

  const missing = Object.entries(values).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length > 0) {
    return { ok: false, message: `WordPress 설정 누락: ${missing.join(", ")}` };
  }

  const rawUrl = values["wordpress.url"]!.trim();
  const baseUrl = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, "");

  if (/(^|\.)wordpress\.com$/i.test(new URL(baseUrl).hostname)) {
    return {
      ok: false,
      message: "WordPress.com 호스팅 블로그는 이 방식(Application Password)을 지원하지 않습니다.",
      detail:
        "자체설치형 워드프레스 주소를 입력하세요. 무료 WordPress.com은 애드센스 광고도 게재할 수 없습니다.",
    };
  }
  const credentials = Buffer.from(
    `${values["wordpress.username"]}:${values["wordpress.appPassword"]}`,
  ).toString("base64");

  // ?rest_route= 방식은 고유주소가 '기본(Plain)'이어도 작동한다 (/wp-json/ 예쁜 경로는 404 남)
  const res = await safeFetch(`${baseUrl}/?rest_route=${encodeURIComponent("/wp/v2/users/me?context=edit")}`, {
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
