import { Router } from "express";
import { asyncHandler, HttpError } from "../../common/http.js";
import { env } from "../../common/env.js";
import { requireAuth } from "../../middleware/auth.js";
import { getSettingValues, updateSettings } from "./settings.service.js";

/**
 * 구글 OAuth 재동의 — Blogger 발행에 쓰던 클라이언트를 그대로 재사용해
 * Search Console(성과 데이터) 권한까지 담은 refresh token을 새로 받는다.
 *
 * 왜 필요한가: 기존 토큰에는 Blogger 스코프만 들어 있어 Search Console API가 403을 낸다.
 * 스코프는 토큰 발급 시점에 고정되므로 재동의 없이는 늘릴 수 없다.
 *
 * ⚠️ 새 토큰은 기존 스코프(blogger)를 반드시 포함시킨다 — 빼면 발행이 죽는다.
 */
export const googleOAuthRouter = Router();

const SCOPES = [
  "https://www.googleapis.com/auth/blogger", // 기존 — 빠지면 발행 중단
  "https://www.googleapis.com/auth/webmasters.readonly", // Search Console 성과 데이터
];

/** 구글 콘솔의 '승인된 리디렉션 URI'에 이 값이 그대로 등록돼 있어야 한다 */
export function redirectUri(): string {
  const base = env.WEB_URL.replace(/\/+$/, "");
  // 운영은 Apache가 /goBlog/api → API로 프록시한다. 로컬은 API를 직접 친다.
  return base.includes("localhost")
    ? "http://localhost:8787/api/settings/google/oauth/callback"
    : `${base}/goBlog/api/settings/google/oauth/callback`;
}

/** 동의 화면 URL — 사용자가 이 주소로 가서 권한을 승인한다 */
googleOAuthRouter.get(
  "/google/oauth/start",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const values = await getSettingValues(["blogger.clientId"]);
    const clientId = values["blogger.clientId"];
    if (!clientId) throw new HttpError(400, "Blogger OAuth Client ID가 설정돼 있지 않습니다.");

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri());
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SCOPES.join(" "));
    // refresh token은 첫 동의에서만 내려온다 → 매번 확실히 받도록 강제
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");

    res.json({ url: url.toString(), redirectUri: redirectUri(), scopes: SCOPES });
  }),
);

/**
 * 동의 후 콜백 — code를 refresh token으로 바꿔 저장한다.
 * 로그인 세션이 없어도 동작해야 한다(구글이 브라우저를 여기로 보낸다).
 */
googleOAuthRouter.get(
  "/google/oauth/callback",
  asyncHandler(async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const error = typeof req.query.error === "string" ? req.query.error : null;
    if (error) throw new HttpError(400, `구글 동의가 취소됐습니다: ${error}`);
    if (!code) throw new HttpError(400, "인증 코드가 없습니다.");

    const values = await getSettingValues(["blogger.clientId", "blogger.clientSecret"]);
    const clientId = values["blogger.clientId"];
    const clientSecret = values["blogger.clientSecret"];
    if (!clientId || !clientSecret) throw new HttpError(400, "Blogger OAuth 클라이언트 설정이 없습니다.");

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri(),
        grant_type: "authorization_code",
      }),
    });
    const data = (await tokenRes.json()) as {
      refresh_token?: string;
      scope?: string;
      error_description?: string;
      error?: string;
    };

    if (!data.refresh_token) {
      // 조용히 넘어가면 "연결됐다"고 착각한다 — 실패는 실패로 보여준다
      throw new HttpError(
        502,
        `refresh token을 받지 못했습니다: ${data.error_description ?? data.error ?? "알 수 없는 오류"}`,
      );
    }

    // 새 토큰은 blogger + webmasters 를 모두 포함하므로 발행용 토큰도 이걸로 교체한다.
    await updateSettings({
      "blogger.refreshToken": data.refresh_token,
      "google.analyticsRefreshToken": data.refresh_token,
    });

    const scopes = (data.scope ?? "").split(" ").filter(Boolean);
    res.send(
      `<meta charset="utf-8"><body style="font-family:system-ui;padding:40px">
       <h2>구글 연결 완료 ✅</h2>
       <p>부여된 권한: ${scopes.map((s) => s.split("/").pop()).join(", ") || "(응답에 없음)"}</p>
       <p>이 창을 닫고 설정 화면으로 돌아가세요.</p></body>`,
    );
  }),
);
