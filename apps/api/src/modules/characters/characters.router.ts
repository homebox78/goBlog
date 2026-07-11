import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import sharp from "sharp";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler, HttpError, parseBody } from "../../common/http.js";
import { mediaDir, mediaPublicUrl } from "../images/image-service.js";

/** 일관된 이미지 생성을 위한 레퍼런스 캐릭터 6종 */
export const CHARACTER_KEYS = [
  "girl",
  "boy",
  "man_20s",
  "woman_20s",
  "man_middle",
  "woman_middle",
] as const;
export type CharacterKey = (typeof CHARACTER_KEYS)[number];

export const CHARACTER_LABELS: Record<CharacterKey, string> = {
  girl: "여자아이",
  boy: "남자아이",
  man_20s: "20대 남성",
  woman_20s: "20대 여성",
  man_middle: "중년 남성",
  woman_middle: "중년 여성",
};

export function characterDir(): string {
  return path.join(mediaDir(), "characters");
}

export function characterFilePath(key: string): string {
  return path.join(characterDir(), `${key}.webp`);
}

async function hasCharacter(key: string): Promise<boolean> {
  try {
    await fs.access(characterFilePath(key));
    return true;
  } catch {
    return false;
  }
}

export const charactersRouter = Router();
charactersRouter.use(requireAuth);

charactersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const characters = [];
    for (const key of CHARACTER_KEYS) {
      const exists = await hasCharacter(key);
      characters.push({
        key,
        label: CHARACTER_LABELS[key],
        hasImage: exists,
        url: exists ? `${mediaPublicUrl()}/characters/${key}.webp?t=${Date.now()}` : null,
      });
    }
    res.json({ characters });
  }),
);

const uploadSchema = z.object({ dataUrl: z.string().min(1) });

charactersRouter.put(
  "/:key",
  asyncHandler(async (req, res) => {
    const key = req.params.key;
    if (!(CHARACTER_KEYS as readonly string[]).includes(key)) {
      throw new HttpError(400, "알 수 없는 캐릭터 키입니다.");
    }
    const { dataUrl } = parseBody(uploadSchema, req.body);
    const base64 = dataUrl.replace(/^data:image\/[^;]+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");

    const webp = await sharp(buffer).resize({ width: 768, withoutEnlargement: true }).webp({ quality: 88 }).toBuffer();
    const dir = characterDir();
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(characterFilePath(key), webp);

    res.json({ ok: true, url: `${mediaPublicUrl()}/characters/${key}.webp?t=${Date.now()}` });
  }),
);

charactersRouter.delete(
  "/:key",
  asyncHandler(async (req, res) => {
    try {
      await fs.unlink(characterFilePath(req.params.key));
    } catch {
      // 없으면 무시
    }
    res.json({ ok: true });
  }),
);
