/** API 클라이언트: 쿠키 기반 인증 + 401 시 refresh 후 1회 재시도 */

// dev는 "/"(vite 프록시), 운영 빌드는 "/goBlog" 서브경로 기준으로 호출한다.
const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function apiUrl(path: string): string {
  return API_BASE + path;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  refreshPromise ??= (async () => {
    try {
      const res = await fetch(apiUrl("/api/auth/refresh"), {
        method: "POST",
        credentials: "include",
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function request<T>(path: string, init?: RequestInit, retried = false): Promise<T> {
  const res = await fetch(apiUrl(path), {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });

  if (res.status === 401 && !retried && !path.startsWith("/api/auth/")) {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(path, init, true);
  }

  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? `요청 실패 (HTTP ${res.status})`);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
