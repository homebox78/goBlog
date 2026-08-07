import { Router } from "express";
import crypto from "node:crypto";
import { asyncHandler, HttpError } from "../../common/http.js";
import { env } from "../../common/env.js";
import { getSettingValues } from "../settings/settings.service.js";
import { prisma } from "../../common/prisma.js";

// 코멘트 수정·삭제용 6자리 숫자 비밀번호 해시 (평문 저장 금지)
const hashPw = (pw: string): string => crypto.createHash("sha256").update("goblog-cpw:" + pw).digest("hex");
const isPw6 = (pw: unknown): pw is string => typeof pw === "string" && /^\d{6}$/.test(pw);
import {
  ensureCommunitySchema,
  currentUser,
  loginUser,
  logoutUser,
  moderate,
  decodeIdToken,
} from "./community.js";

export const communityRouter = Router();

function callbackUri(): string {
  const base = env.WEB_URL.replace(/\/+$/, "");
  return base.includes("localhost")
    ? "http://localhost:8787/api/community/auth/google/callback"
    : `${base}/goBlog/api/community/auth/google/callback`;
}
// 로그인 후 돌아갈 곳 — hom2box.com 내부 경로만 허용(오픈 리다이렉트 방지)
function safeNext(next: unknown): string {
  const s = typeof next === "string" ? next : "";
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  return "/stocks.php";
}

// 구글 로그인 시작
communityRouter.get(
  "/auth/google",
  asyncHandler(async (req, res) => {
    const clientId = (await getSettingValues(["blogger.clientId"]))["blogger.clientId"];
    if (!clientId) throw new HttpError(400, "구글 OAuth 클라이언트가 설정돼 있지 않습니다.");
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", callbackUri());
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", safeNext(req.query.next));
    res.redirect(url.toString());
  }),
);

// 구글 콜백 → 로그인 처리 후 돌아가기
communityRouter.get(
  "/auth/google/callback",
  asyncHandler(async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const next = safeNext(req.query.state);
    if (!code) return res.redirect(`${next}${next.includes("?") ? "&" : "?"}login=fail`);
    const cfg = await getSettingValues(["blogger.clientId", "blogger.clientSecret"]);
    if (!cfg["blogger.clientId"] || !cfg["blogger.clientSecret"]) throw new HttpError(400, "구글 OAuth 설정이 없습니다.");
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: cfg["blogger.clientId"]!,
        client_secret: cfg["blogger.clientSecret"]!,
        redirect_uri: callbackUri(),
        grant_type: "authorization_code",
      }),
    });
    const data = (await tokenRes.json()) as { id_token?: string; error?: string };
    if (!data.id_token) return res.redirect(`${next}${next.includes("?") ? "&" : "?"}login=fail`);
    const p = decodeIdToken(data.id_token);
    if (!p.sub || !p.email) return res.redirect(`${next}${next.includes("?") ? "&" : "?"}login=fail`);
    await loginUser(res, {
      provider: "GOOGLE",
      providerId: p.sub,
      email: p.email ?? null,
      name: (p.name || (p.email ?? "").split("@")[0] || "투자자").slice(0, 40),
      avatar: p.picture ?? null,
    });
    res.redirect(`${next}${next.includes("?") ? "&" : "?"}login=ok`);
  }),
);

communityRouter.post(
  "/auth/logout",
  asyncHandler(async (req, res) => {
    await logoutUser(req, res);
    res.json({ ok: true });
  }),
);

communityRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const u = await currentUser(req);
    res.json({ user: u ? { id: u.id, name: u.name, avatar: u.avatar } : null });
  }),
);

// 표시 이름(닉네임) 변경 — 구글 이름 고정이 아니라 작성자가 직접 설정
communityRouter.post(
  "/me/name",
  asyncHandler(async (req, res) => {
    const u = await currentUser(req);
    if (!u) throw new HttpError(401, "로그인이 필요합니다.");
    if (u.banned) throw new HttpError(403, "이용이 제한된 계정입니다.");
    const name = String(req.body?.name ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 20);
    if (name.length < 2) throw new HttpError(400, "이름은 2자 이상 입력해주세요.");
    const m = moderate(name);
    if (!m.ok) throw new HttpError(400, m.reason ?? "사용할 수 없는 이름입니다.");
    await prisma.$executeRaw`UPDATE community_users SET name=${name} WHERE id=${u.id}`;
    res.json({ ok: true, name });
  }),
);

interface PostRow {
  id: number;
  ticker: string;
  userId: number;
  body: string;
  stance: string | null;
  likes: number;
  comments: number;
  createdAt: Date;
  authorName: string;
  authorAvatar: string | null;
}

// 종목 토론 목록 + 투자의견 집계 (공개)
communityRouter.get(
  "/stocks/:ticker/posts",
  asyncHandler(async (req, res) => {
    await ensureCommunitySchema();
    // 국내(숫자)·해외(알파벳 심볼) 모두 허용
    const ticker = String(req.params.ticker).replace(/[^0-9A-Za-z.]/g, "").slice(0, 12);
    const posts = (await prisma.$queryRaw`
      SELECT p.id, p.ticker, p.userId, p.body, p.stance, p.likes, p.comments, p.createdAt,
             u.name authorName, u.avatar authorAvatar
      FROM community_posts p JOIN community_users u ON u.id = p.userId
      WHERE p.ticker = ${ticker} AND p.hidden = 0
      ORDER BY p.createdAt DESC LIMIT 50`) as PostRow[];
    const sent = (await prisma.$queryRaw`
      SELECT stance, COUNT(*) c FROM community_posts
      WHERE ticker = ${ticker} AND hidden = 0 AND stance IS NOT NULL GROUP BY stance`) as Array<{
      stance: string;
      c: bigint | number;
    }>;
    const sentiment = { BUY: 0, HOLD: 0, SELL: 0 };
    for (const s of sent) if (s.stance && s.stance in sentiment) sentiment[s.stance as "BUY"] = Number(s.c);
    res.json({ posts, sentiment });
  }),
);

// 글 작성 (로그인 + 모더레이션)
communityRouter.post(
  "/stocks/:ticker/posts",
  asyncHandler(async (req, res) => {
    const u = await currentUser(req);
    if (!u) throw new HttpError(401, "로그인이 필요합니다.");
    if (u.banned) throw new HttpError(403, "이용이 제한된 계정입니다.");
    // 국내(숫자)·해외(알파벳 심볼) 모두 허용 — 랭킹으로 동적 발굴된 종목·미국 종목에도 코멘트 가능
    const ticker = String(req.params.ticker).replace(/[^0-9A-Za-z.]/g, "").slice(0, 12);
    const body = String(req.body?.body ?? "");
    const stanceRaw = String(req.body?.stance ?? "");
    const stance = ["BUY", "HOLD", "SELL"].includes(stanceRaw) ? stanceRaw : null;
    const m = moderate(body);
    if (!m.ok) throw new HttpError(400, m.reason ?? "게시할 수 없습니다.");
    // 종목 코드 형식만 검증(등록 여부는 요구하지 않는다 — 국내 등록·동적·해외 종목 전부 허용)
    if (ticker.length < 1) throw new HttpError(400, "종목 코드가 올바르지 않습니다.");
    // 6자리 숫자 비밀번호(수정·삭제용) — 있으면 해시 저장. 없으면 소유자만 수정·삭제.
    const pw = isPw6(req.body?.pw) ? hashPw(req.body.pw) : null;
    await prisma.$executeRaw`
      INSERT INTO community_posts (ticker, userId, body, stance, pw) VALUES (${ticker}, ${u.id}, ${body.trim()}, ${stance}, ${pw})`;
    res.json({ ok: true });
  }),
);

// 코멘트 수정 — 본인 글 + (설정돼 있으면) 6자리 비밀번호 일치
communityRouter.post(
  "/posts/:id/edit",
  asyncHandler(async (req, res) => {
    const u = await currentUser(req);
    if (!u) throw new HttpError(401, "로그인이 필요합니다.");
    const id = Number(req.params.id) || 0;
    const rows = (await prisma.$queryRaw`SELECT userId, pw FROM community_posts WHERE id=${id} AND hidden=0 LIMIT 1`) as Array<{
      userId: number;
      pw: string | null;
    }>;
    const post = rows[0];
    if (!post) throw new HttpError(404, "글을 찾을 수 없습니다.");
    if (post.userId !== u.id) throw new HttpError(403, "본인 글만 수정할 수 있습니다.");
    if (post.pw && post.pw !== hashPw(String(req.body?.pw ?? ""))) throw new HttpError(403, "비밀번호가 일치하지 않습니다.");
    const body = String(req.body?.body ?? "");
    const m = moderate(body);
    if (!m.ok) throw new HttpError(400, m.reason ?? "수정할 수 없습니다.");
    const stanceRaw = String(req.body?.stance ?? "");
    const stance = ["BUY", "HOLD", "SELL"].includes(stanceRaw) ? stanceRaw : null;
    await prisma.$executeRaw`UPDATE community_posts SET body=${body.trim()}, stance=${stance} WHERE id=${id}`;
    res.json({ ok: true });
  }),
);

// 코멘트 삭제(숨김) — 본인 글 + (설정돼 있으면) 6자리 비밀번호 일치
communityRouter.post(
  "/posts/:id/delete",
  asyncHandler(async (req, res) => {
    const u = await currentUser(req);
    if (!u) throw new HttpError(401, "로그인이 필요합니다.");
    const id = Number(req.params.id) || 0;
    const rows = (await prisma.$queryRaw`SELECT userId, pw FROM community_posts WHERE id=${id} AND hidden=0 LIMIT 1`) as Array<{
      userId: number;
      pw: string | null;
    }>;
    const post = rows[0];
    if (!post) throw new HttpError(404, "글을 찾을 수 없습니다.");
    if (post.userId !== u.id) throw new HttpError(403, "본인 글만 삭제할 수 있습니다.");
    if (post.pw && post.pw !== hashPw(String(req.body?.pw ?? ""))) throw new HttpError(403, "비밀번호가 일치하지 않습니다.");
    await prisma.$executeRaw`UPDATE community_posts SET hidden=1 WHERE id=${id}`;
    res.json({ ok: true });
  }),
);

// 댓글 목록
communityRouter.get(
  "/posts/:id/comments",
  asyncHandler(async (req, res) => {
    await ensureCommunitySchema();
    const id = Number(req.params.id) || 0;
    const rows = (await prisma.$queryRaw`
      SELECT c.id, c.body, c.createdAt, u.name authorName, u.avatar authorAvatar
      FROM community_comments c JOIN community_users u ON u.id = c.userId
      WHERE c.postId = ${id} AND c.hidden = 0 ORDER BY c.createdAt ASC LIMIT 100`) as unknown[];
    res.json({ comments: rows });
  }),
);

// 댓글 작성
communityRouter.post(
  "/posts/:id/comments",
  asyncHandler(async (req, res) => {
    const u = await currentUser(req);
    if (!u) throw new HttpError(401, "로그인이 필요합니다.");
    if (u.banned) throw new HttpError(403, "이용이 제한된 계정입니다.");
    const id = Number(req.params.id) || 0;
    const body = String(req.body?.body ?? "");
    const m = moderate(body);
    if (!m.ok) throw new HttpError(400, m.reason ?? "게시할 수 없습니다.");
    const post = (await prisma.$queryRaw`SELECT id FROM community_posts WHERE id=${id} AND hidden=0 LIMIT 1`) as unknown[];
    if (post.length === 0) throw new HttpError(404, "글을 찾을 수 없습니다.");
    await prisma.$executeRaw`INSERT INTO community_comments (postId, userId, body) VALUES (${id}, ${u.id}, ${body.trim()})`;
    await prisma.$executeRaw`UPDATE community_posts SET comments = comments + 1 WHERE id = ${id}`;
    res.json({ ok: true });
  }),
);

// 좋아요 토글
communityRouter.post(
  "/posts/:id/like",
  asyncHandler(async (req, res) => {
    const u = await currentUser(req);
    if (!u) throw new HttpError(401, "로그인이 필요합니다.");
    const id = Number(req.params.id) || 0;
    const existing = (await prisma.$queryRaw`SELECT 1 FROM community_post_likes WHERE postId=${id} AND userId=${u.id} LIMIT 1`) as unknown[];
    if (existing.length > 0) {
      await prisma.$executeRaw`DELETE FROM community_post_likes WHERE postId=${id} AND userId=${u.id}`;
      await prisma.$executeRaw`UPDATE community_posts SET likes = GREATEST(0, likes - 1) WHERE id=${id}`;
      res.json({ liked: false });
    } else {
      await prisma.$executeRaw`INSERT IGNORE INTO community_post_likes (postId, userId) VALUES (${id}, ${u.id})`;
      await prisma.$executeRaw`UPDATE community_posts SET likes = likes + 1 WHERE id=${id}`;
      res.json({ liked: true });
    }
  }),
);

// 신고 → 즉시 숨김(경량 모더레이션). 3회 이상 신고 누적 시 사실상 차단.
communityRouter.post(
  "/posts/:id/report",
  asyncHandler(async (req, res) => {
    const u = await currentUser(req);
    if (!u) throw new HttpError(401, "로그인이 필요합니다.");
    const id = Number(req.params.id) || 0;
    // 간단화: 신고 시 관리자 검토 전까지 숨김 처리(리딩·불법 글 빠른 차단 우선)
    await prisma.$executeRaw`UPDATE community_posts SET hidden = 1 WHERE id = ${id}`;
    res.json({ ok: true });
  }),
);
