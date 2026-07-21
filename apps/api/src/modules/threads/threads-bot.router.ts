import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import sharp from "sharp";
import { z } from "zod";
import { prisma } from "../../common/prisma.js";
import { asyncHandler, HttpError, parseBody } from "../../common/http.js";
import { requireAuth } from "../../middleware/auth.js";
import { callClaudeJson } from "../ai/claude.js";
import { mediaDir, mediaPublicUrl } from "../images/image-service.js";
import { publishStandaloneThreads } from "../publishing/connectors.js";

export const threadsBotRouter = Router();
threadsBotRouter.use(requireAuth);

// 공정위 대가성 안내 문구 — 반드시 링크 '위'에 위치해야 한다(영상 핵심 규칙, 계정 정지 방지).
const DISCLOSURE_TEXT = "이 포스팅은 쿠팡 파트너스 활동의 일환으로 일정액의 수수료를 지급받습니다.";

// 최초 실행 시 심어두는 기본 페르소나(영상 예시 그대로).
const DEFAULT_PERSONA = {
  name: "30대 직장인 일상봇",
  description: "요청 사항을 입력하면 구축한 페르소나를 적용하여 글을 작성해줘.",
  systemPrompt:
    "너는 출근하기 싫어하는 30대 현실 직장인 여성이야.\n" +
    "앞으로 내가 키워드를 주면 날것의 퇴근 갈망, 월요병, 직장생활 공감 글을 딱 한두 줄로 짧고 굵게 짜주는 비서 역할을 해줘.",
};

/** DRAFT/POSTED/FAILED 기록에서 발행될 최종 문구를 만든다. text + (공정위 문구) + (링크) */
function composeFullText(post: { text: string; disclosure: boolean; linkUrl: string | null }): string {
  const parts = [post.text.trim()];
  if (post.disclosure) parts.push("", DISCLOSURE_TEXT);
  if (post.linkUrl?.trim()) parts.push(post.linkUrl.trim());
  return parts.join("\n").trim();
}

/** 첨부 이미지(dataURL) → webp 저장, 공개 URL 반환. media/threads/ 하위에 둔다. */
async function saveThreadsImage(dataUrl: string): Promise<string> {
  const match = /^data:(image\/[\w.+-]+);base64,(.+)$/s.exec(dataUrl.trim());
  if (!match) throw new HttpError(400, "이미지 파일이 올바르지 않습니다. (jpg/png/webp 등)");
  const raw = Buffer.from(match[2], "base64");
  if (raw.length === 0) throw new HttpError(400, "빈 이미지입니다.");

  const dir = path.join(mediaDir(), "threads");
  await fs.mkdir(dir, { recursive: true });
  const name = `t-${Date.now()}-${Math.round(Math.random() * 1e6).toString(36)}.webp`;
  const webp = await sharp(raw).rotate().resize({ width: 1440, withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
  await fs.writeFile(path.join(dir, name), webp);
  return `${mediaPublicUrl()}/threads/${name}`;
}

/** 저장된 이미지 파일 제거(공개 URL → 파일 경로 역산). 실패는 무시. */
async function removeThreadsImage(imageUrl: string | null): Promise<void> {
  if (!imageUrl) return;
  const idx = imageUrl.indexOf("/threads/");
  if (idx === -1) return;
  const fileName = imageUrl.slice(idx + "/threads/".length).split(/[?#]/)[0];
  if (!fileName) return;
  await fs.unlink(path.join(mediaDir(), "threads", fileName)).catch(() => undefined);
}

// ── 페르소나(봇) ────────────────────────────────────────────────

/** 페르소나 목록 — 없으면 기본 봇을 하나 심는다. */
threadsBotRouter.get(
  "/personas",
  asyncHandler(async (_req, res) => {
    let personas = await prisma.threadsPersona.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    if (personas.length === 0) {
      await prisma.threadsPersona.create({ data: DEFAULT_PERSONA });
      personas = await prisma.threadsPersona.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
    }
    res.json({ personas });
  }),
);

const personaSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해주세요.").max(120),
  description: z.string().max(2000).optional(),
  systemPrompt: z.string().trim().min(1, "지침을 입력해주세요.").max(8000),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

threadsBotRouter.post(
  "/personas",
  asyncHandler(async (req, res) => {
    const body = parseBody(personaSchema, req.body);
    const persona = await prisma.threadsPersona.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        systemPrompt: body.systemPrompt,
        isActive: body.isActive ?? true,
        sortOrder: body.sortOrder ?? 0,
      },
    });
    res.json({ persona });
  }),
);

threadsBotRouter.put(
  "/personas/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = parseBody(personaSchema.partial(), req.body);
    const persona = await prisma.threadsPersona.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description || null } : {}),
        ...(body.systemPrompt !== undefined ? { systemPrompt: body.systemPrompt } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      },
    });
    res.json({ persona });
  }),
);

threadsBotRouter.delete(
  "/personas/:id",
  asyncHandler(async (req, res) => {
    await prisma.threadsPersona.delete({ where: { id: Number(req.params.id) } }).catch(() => undefined);
    res.json({ ok: true });
  }),
);

// ── 글 생성 (Claude) ────────────────────────────────────────────

const generateSchema = z.object({
  personaId: z.number().int(),
  keyword: z.string().trim().min(1, "키워드/주제를 입력해주세요.").max(300),
  mode: z.enum(["WARMUP", "REVENUE"]),
  count: z.number().int().min(1).max(6).optional(),
});

threadsBotRouter.post(
  "/generate",
  asyncHandler(async (req, res) => {
    const body = parseBody(generateSchema, req.body);
    const persona = await prisma.threadsPersona.findUnique({ where: { id: body.personaId } });
    if (!persona) throw new HttpError(404, "페르소나를 찾을 수 없습니다.");
    const count = body.count ?? 3;

    const system =
      `${persona.systemPrompt}\n\n` +
      "[출력 규칙]\n" +
      "- 위 페르소나의 말투·성격·시점을 100% 유지한다.\n" +
      "- 스레드(Threads)에 올릴 짧은 글을 쓴다. 각 글은 한국어로 딱 1~3줄, 최대 250자.\n" +
      "- 광고 티가 전혀 나지 않는, 진짜 사람이 쓴 듯한 날것의 문장으로.\n" +
      "- 해시태그·이모지는 자연스러울 때만 최소한으로(남발 금지). 링크·가격·안내 문구는 절대 쓰지 마라(시스템이 따로 붙인다).\n" +
      `- 서로 각도가 다른 후보 ${count}개를 만든다.\n` +
      '- 아래 JSON만 출력한다(설명·코드펜스 금지): {"candidates":["글1","글2"]}';

    const user =
      body.mode === "REVENUE"
        ? "모드: 수익화 후기글.\n" +
          `제품/키워드: "${body.keyword}"\n` +
          "- 첫 줄은 스크롤을 멈추게 하는 강렬한 후킹.\n" +
          "- 이어서 자연스러운 실사용 후기 톤으로, 딱 2~3줄 이내.\n" +
          "- 절대 광고처럼 보이면 안 된다. 친구가 툭 추천하듯이."
        : "모드: 일상 공감 밑밥글.\n" +
          `키워드/상황: "${body.keyword}"\n` +
          "- 링크·상품·홍보 절대 없음. 순수한 일상 공감/푸념.\n" +
          "- 딱 1~2줄, 폭풍 공감을 부르는 날것의 문장.";

    const result = await callClaudeJson<{ candidates?: string[] }>({
      system,
      user,
      operation: "threads-bot-generate",
      maxTokens: 1500,
    });
    const candidates = (result.candidates ?? [])
      .map((c) => (typeof c === "string" ? c.trim() : ""))
      .filter(Boolean)
      .slice(0, count);
    if (candidates.length === 0) throw new HttpError(502, "생성 결과가 비어 있습니다. 다시 시도해주세요.");

    res.json({ candidates });
  }),
);

// ── 초안·발행 ───────────────────────────────────────────────────

function serializePost(post: {
  id: number;
  personaId: number | null;
  mode: string;
  keyword: string | null;
  text: string;
  linkUrl: string | null;
  disclosure: boolean;
  imageUrl: string | null;
  status: string;
  threadsUrl: string | null;
  error: string | null;
  postedAt: Date | null;
  createdAt: Date;
  persona?: { name: string } | null;
}) {
  return {
    ...post,
    personaName: post.persona?.name ?? null,
    fullText: composeFullText(post),
  };
}

threadsBotRouter.get(
  "/posts",
  asyncHandler(async (_req, res) => {
    const posts = await prisma.threadsPost.findMany({
      orderBy: { id: "desc" },
      take: 100,
      include: { persona: { select: { name: true } } },
    });
    res.json({ posts: posts.map(serializePost) });
  }),
);

const postSchema = z.object({
  personaId: z.number().int().nullable().optional(),
  mode: z.enum(["WARMUP", "REVENUE"]).optional(),
  keyword: z.string().max(190).optional(),
  text: z.string().trim().min(1, "본문을 입력해주세요.").max(2000),
  linkUrl: z.string().trim().max(2000).optional(),
  disclosure: z.boolean().optional(),
  imageDataUrl: z.string().optional(), // 첨부 이미지(교체·추가)
});

threadsBotRouter.post(
  "/posts",
  asyncHandler(async (req, res) => {
    const body = parseBody(postSchema, req.body);
    const imageUrl = body.imageDataUrl ? await saveThreadsImage(body.imageDataUrl) : null;
    const post = await prisma.threadsPost.create({
      data: {
        personaId: body.personaId ?? null,
        mode: body.mode ?? "WARMUP",
        keyword: body.keyword?.trim() || null,
        text: body.text,
        linkUrl: body.linkUrl?.trim() || null,
        disclosure: body.disclosure ?? false,
        imageUrl,
      },
      include: { persona: { select: { name: true } } },
    });
    res.json({ post: serializePost(post) });
  }),
);

const updatePostSchema = postSchema.partial().extend({
  removeImage: z.boolean().optional(),
});

threadsBotRouter.put(
  "/posts/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = parseBody(updatePostSchema, req.body);
    const existing = await prisma.threadsPost.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "초안을 찾을 수 없습니다.");

    let imageUrl = existing.imageUrl;
    if (body.removeImage) {
      await removeThreadsImage(existing.imageUrl);
      imageUrl = null;
    }
    if (body.imageDataUrl) {
      await removeThreadsImage(existing.imageUrl);
      imageUrl = await saveThreadsImage(body.imageDataUrl);
    }

    const post = await prisma.threadsPost.update({
      where: { id },
      data: {
        ...(body.personaId !== undefined ? { personaId: body.personaId } : {}),
        ...(body.mode !== undefined ? { mode: body.mode } : {}),
        ...(body.keyword !== undefined ? { keyword: body.keyword?.trim() || null } : {}),
        ...(body.text !== undefined ? { text: body.text } : {}),
        ...(body.linkUrl !== undefined ? { linkUrl: body.linkUrl?.trim() || null } : {}),
        ...(body.disclosure !== undefined ? { disclosure: body.disclosure } : {}),
        imageUrl,
      },
      include: { persona: { select: { name: true } } },
    });
    res.json({ post: serializePost(post) });
  }),
);

threadsBotRouter.delete(
  "/posts/:id",
  asyncHandler(async (req, res) => {
    const post = await prisma.threadsPost.findUnique({ where: { id: Number(req.params.id) } });
    if (post) {
      await removeThreadsImage(post.imageUrl);
      await prisma.threadsPost.delete({ where: { id: post.id } }).catch(() => undefined);
    }
    res.json({ ok: true });
  }),
);

/** 초안을 Threads에 즉시 발행 */
threadsBotRouter.post(
  "/posts/:id/publish",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const post = await prisma.threadsPost.findUnique({ where: { id } });
    if (!post) throw new HttpError(404, "초안을 찾을 수 없습니다.");

    const fullText = composeFullText(post);
    try {
      const result = await publishStandaloneThreads({ text: fullText, imageUrl: post.imageUrl });
      const updated = await prisma.threadsPost.update({
        where: { id },
        data: { status: "POSTED", threadsUrl: result.url, error: null, postedAt: new Date() },
        include: { persona: { select: { name: true } } },
      });
      res.json({ post: serializePost(updated) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "발행 실패";
      await prisma.threadsPost.update({ where: { id }, data: { status: "FAILED", error: message } }).catch(() => undefined);
      throw new HttpError(502, message);
    }
  }),
);
