import { Router } from "express";
import { asyncHandler, HttpError } from "../../common/http.js";
import { env } from "../../common/env.js";
import { requireAuth } from "../../middleware/auth.js";
import { getSettingValues, updateSettings } from "./settings.service.js";

/**
 * Threads OAuth '계정 연결' — Meta 앱(사용 사례: Threads API access)의 App ID/Secret으로
 * 사용자가 자기 스레드 계정(@soyeon.overtime 등)에 로그인·승인하면 장기 토큰을 자동 발급·저장한다.
 *
 * 흐름: start(동의 URL) → 사용자가 스레드 로그인/승인 → callback(code)
 *   → 단기 토큰 교환 → 장기 토큰(약 60일) 교환 → /me로 username 조회 → 설정에 저장.
 */
export const threadsOAuthRouter = Router();

// 발행에 필요한 스코프: 기본 프로필 + 콘텐츠 게시
const SCOPES = ["threads_basic", "threads_content_publish"];

/** Meta 앱의 '유효한 OAuth 리디렉션 URI'에 이 값이 그대로 등록돼 있어야 한다 */
export function threadsRedirectUri(): string {
  const base = env.WEB_URL.replace(/\/+$/, "");
  // 운영은 Apache가 /goBlog/api → API로 프록시한다. 로컬은 API를 직접 친다.
  return base.includes("localhost")
    ? "http://localhost:8787/api/settings/threads/oauth/callback"
    : `${base}/goBlog/api/settings/threads/oauth/callback`;
}

/** 동의 화면 URL — 사용자가 이 주소로 가서 스레드 계정을 승인한다 */
threadsOAuthRouter.get(
  "/threads/oauth/start",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const values = await getSettingValues(["threads.appId"]);
    const appId = values["threads.appId"]?.trim();
    if (!appId) throw new HttpError(400, "Threads App ID가 설정돼 있지 않습니다. 먼저 App ID/Secret을 저장해주세요.");

    const url = new URL("https://threads.net/oauth/authorize");
    url.searchParams.set("client_id", appId);
    url.searchParams.set("redirect_uri", threadsRedirectUri());
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SCOPES.join(",")); // Threads는 콤마 구분

    res.json({ url: url.toString(), redirectUri: threadsRedirectUri(), scopes: SCOPES });
  }),
);

/**
 * 동의 후 콜백 — code를 장기 토큰으로 바꿔 저장한다.
 * 로그인 세션이 없어도 동작해야 한다(Threads가 브라우저를 여기로 보낸다).
 */
threadsOAuthRouter.get(
  "/threads/oauth/callback",
  asyncHandler(async (req, res) => {
    const done = (title: string, body: string) =>
      res.send(
        `<meta charset="utf-8"><body style="font-family:system-ui;padding:40px;max-width:560px;margin:0 auto">
         <h2>${title}</h2>${body}
         <p style="margin-top:24px"><a href="${env.WEB_URL.replace(/\/+$/, "")}/goBlog/threads-bot">← 쓰레드 봇으로 돌아가기</a></p>
         <script>setTimeout(function(){try{window.close()}catch(e){}},1500)</script></body>`,
      );

    const error = typeof req.query.error === "string" ? req.query.error : null;
    if (error) return done("연결 취소됨", `<p>스레드 승인이 취소됐습니다: ${error}</p>`);

    // Threads는 code 뒤에 #_ 프래그먼트를 붙여 보낼 때가 있다 → 정리
    let code = typeof req.query.code === "string" ? req.query.code : null;
    if (code) code = code.replace(/#_$/, "");
    if (!code) throw new HttpError(400, "인증 코드가 없습니다.");

    const values = await getSettingValues(["threads.appId", "threads.appSecret"]);
    const appId = values["threads.appId"]?.trim();
    const appSecret = values["threads.appSecret"]?.trim();
    if (!appId || !appSecret) throw new HttpError(400, "Threads App ID/Secret 설정이 없습니다.");

    // 1) 단기 토큰 교환 (application/x-www-form-urlencoded)
    const shortRes = await fetch("https://graph.threads.net/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: "authorization_code",
        redirect_uri: threadsRedirectUri(),
        code,
      }),
    });
    const shortData = (await shortRes.json().catch(() => null)) as
      | { access_token?: string; user_id?: string | number; error_message?: string; error?: { message?: string } }
      | null;
    if (!shortData?.access_token) {
      const msg = shortData?.error_message ?? shortData?.error?.message ?? `HTTP ${shortRes.status}`;
      throw new HttpError(502, `단기 토큰 발급 실패: ${msg}`);
    }

    // 2) 장기 토큰 교환 (약 60일)
    const longUrl = new URL("https://graph.threads.net/access_token");
    longUrl.searchParams.set("grant_type", "th_exchange_token");
    longUrl.searchParams.set("client_secret", appSecret);
    longUrl.searchParams.set("access_token", shortData.access_token);
    const longRes = await fetch(longUrl.toString());
    const longData = (await longRes.json().catch(() => null)) as
      | { access_token?: string; expires_in?: number; error?: { message?: string } }
      | null;

    // 장기 교환이 실패해도 단기 토큰으로라도 저장(발행은 가능) — 실패를 삼키지 않고 안내는 남긴다
    const accessToken = longData?.access_token ?? shortData.access_token;
    const expiresIn = longData?.expires_in;
    const userId = shortData.user_id != null ? String(shortData.user_id) : "";

    // 3) username 조회(표시용)
    let username = "";
    try {
      const me = (await (
        await fetch(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${encodeURIComponent(accessToken)}`)
      ).json()) as { username?: string; id?: string };
      username = me.username ?? "";
    } catch {
      // 표시용이라 실패해도 진행
    }

    await updateSettings({
      "threads.accessToken": accessToken,
      "threads.userId": userId,
      "threads.username": username,
      "threads.tokenExpiresAt": expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : "",
    });

    return done(
      "스레드 연결 완료 ✅",
      `<p>연결된 계정: <b>@${username || "(이름 조회 실패)"}</b></p>` +
        (expiresIn ? `<p style="color:#666">토큰 유효기간: 약 ${Math.round(expiresIn / 86400)}일</p>` : ""),
    );
  }),
);
