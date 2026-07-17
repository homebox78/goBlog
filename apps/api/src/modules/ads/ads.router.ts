import { Router } from "express";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { asyncHandler, HttpError, parseBody } from "../../common/http.js";
import { requireAuth } from "../../middleware/auth.js";
import { prisma } from "../../common/prisma.js";
import { mediaDir, mediaPublicUrl } from "../images/image-service.js";

export const adsRouter = Router();
adsRouter.use(requireAuth);

/** 고정 슬롯 위치 정의 — 뉴스 사이트 PHP의 render_ad() 위치와 일치해야 한다. */
export const AD_POSITIONS: Array<{ position: string; label: string; size: string }> = [
  { position: "home-top", label: "홈 상단 배너", size: "가로형 970×90 권장" },
  { position: "home-infeed", label: "홈 섹션 사이(인피드)", size: "반응형" },
  { position: "home-sidebar", label: "홈 사이드바", size: "300×250 권장" },
  { position: "article-top", label: "기사 상단(본문 위)", size: "반응형" },
  { position: "article-bottom", label: "기사 하단(본문 아래)", size: "반응형" },
  { position: "category-top", label: "카테고리 상단", size: "가로형 권장" },
  { position: "tool-bottom", label: "계산기 결과 아래", size: "반응형" },
];

/** 슬롯 목록 — 정의된 위치 전부(미설정은 기본값). */
adsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.adSlot.findMany();
    const byPos = new Map(rows.map((r) => [r.position, r]));
    const slots = AD_POSITIONS.map((def) => {
      const row = byPos.get(def.position);
      return {
        ...def,
        enabled: row?.enabled ?? false,
        type: row?.type ?? "IMAGE",
        adsenseCode: row?.adsenseCode ?? "",
        imageUrl: row?.imageUrl ?? "",
        linkUrl: row?.linkUrl ?? "",
        newTab: row?.newTab ?? true,
        sponsored: row?.sponsored ?? true,
      };
    });
    res.json({ slots });
  }),
);

const updateSchema = z.object({
  enabled: z.boolean(),
  type: z.enum(["ADSENSE", "IMAGE"]),
  adsenseCode: z.string().nullish(),
  imageUrl: z.string().nullish(),
  linkUrl: z.string().nullish(),
  newTab: z.boolean().optional(),
  sponsored: z.boolean().optional(),
});

/** 슬롯 저장(업서트) */
adsRouter.put(
  "/:position",
  asyncHandler(async (req, res) => {
    const position = String(req.params.position);
    if (!AD_POSITIONS.some((p) => p.position === position)) throw new HttpError(400, "알 수 없는 광고 위치입니다.");
    const body = parseBody(updateSchema, req.body);
    const data = {
      enabled: body.enabled,
      type: body.type,
      adsenseCode: body.adsenseCode ?? null,
      imageUrl: body.imageUrl ?? null,
      linkUrl: body.linkUrl ?? null,
      newTab: body.newTab ?? true,
      sponsored: body.sponsored ?? true,
    };
    await prisma.adSlot.upsert({ where: { position }, update: data, create: { position, ...data } });
    res.json({ ok: true });
  }),
);

const uploadSchema = z.object({
  dataUrl: z.string().regex(/^data:image\/(png|jpe?g|webp|gif);base64,/, "이미지 data URL이 필요합니다."),
});

/** 배너 이미지 업로드 — base64 data URL을 미디어 디렉터리에 저장하고 공개 URL 반환. */
adsRouter.post(
  "/upload",
  asyncHandler(async (req, res) => {
    const { dataUrl } = parseBody(uploadSchema, req.body);
    const match = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/s.exec(dataUrl);
    if (!match) throw new HttpError(400, "이미지 형식이 올바르지 않습니다.");
    const ext = match[1] === "jpeg" ? "jpg" : match[1];
    const buf = Buffer.from(match[2], "base64");
    if (buf.length > 3 * 1024 * 1024) throw new HttpError(400, "이미지는 3MB 이하만 업로드할 수 있습니다.");
    const fileName = `ad-${Date.now()}.${ext}`;
    await fs.writeFile(path.join(mediaDir(), fileName), buf);
    res.json({ url: `${mediaPublicUrl().replace(/\/$/, "")}/${fileName}` });
  }),
);
