import { Router } from "express";
import { asyncHandler, HttpError } from "../../common/http.js";
import { env } from "../../common/env.js";
import { getSettingValues } from "../settings/settings.service.js";
import { prisma } from "../../common/prisma.js";
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
    if (!code) return res.redirect(`${next}?login=fail`);
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
    if (!data.id_token) return res.redirect(`${next}?login=fail`);
    const p = decodeIdToken(data.id_token);
    if (!p.sub || !p.email) return res.redirect(`${next}?login=fail`);
    await loginUser(res, {
      provider: "GOOGLE",
      providerId: p.sub,
      email: p.email ?? null,
      name: (p.name || (p.email ?? "").split("@")[0] || "투자자").slice(0, 40),
      avatar: p.picture ?? null,
    });
    res.redirect(`${next}?login=ok`);
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
    const ticker = String(req.params.ticker).replace(/[^0-9]/g, "");
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
    const ticker = String(req.params.ticker).replace(/[^0-9]/g, "");
    const body = String(req.body?.body ?? "");
    const stanceRaw = String(req.body?.stance ?? "");
    const stance = ["BUY", "HOLD", "SELL"].includes(stanceRaw) ? stanceRaw : null;
    const m = moderate(body);
    if (!m.ok) throw new HttpError(400, m.reason ?? "게시할 수 없습니다.");
    // 종목 존재 확인
    const st = (await prisma.$queryRaw`SELECT ticker FROM stocks WHERE ticker=${ticker} LIMIT 1`) as unknown[];
    if (st.length === 0) throw new HttpError(404, "존재하지 않는 종목입니다.");
    await prisma.$executeRaw`
      INSERT INTO community_posts (ticker, userId, body, stance) VALUES (${ticker}, ${u.id}, ${body.trim()}, ${stance})`;
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
