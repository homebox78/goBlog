/**
 * 이미지 프롬프트를 글별 .md 파일로 내보낸다.
 *
 * 왜: 이미지를 직접 만들 때(미드저니·Gemini·Firefly 등) 쓰려면 프롬프트가 DB 안이 아니라
 *     **손에 잡히는 파일**로 있어야 한다. 글마다 1개 파일, 이미지 3장의 프롬프트가 한눈에.
 *
 * 실행: node scripts/export-image-prompts.mjs [--all]
 *   기본(증분): 아직 파일이 없는 글만 내보낸다 (매번 전체를 다시 쓰지 않는다)
 *   --all     : 전부 다시 쓴다 (프롬프트를 고쳤을 때)
 *
 * 출력: image-prompts/  (git에는 올리지 않는다 — 작업물이지 소스가 아니다)
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Prisma 클라이언트는 apps/api 에 설치돼 있다 (루트에서 바로 import 하면 못 찾는다)
const require = createRequire(path.join(root, "apps/api/package.json"));
const { PrismaClient } = require("@prisma/client");
const outDir = path.join(root, "image-prompts");

// 루트 .env 하나가 단일 소스 (apps/api 와 동일)
const env = await fs.readFile(path.join(root, ".env"), "utf8");
process.env.MYSQL_URL = env.match(/^MYSQL_URL=(.*)$/m)?.[1].trim() ?? "";

const prisma = new PrismaClient();
const rewriteAll = process.argv.includes("--all");

/** 파일명에 쓸 수 없는 문자를 지운다 (윈도우 기준) */
function safeName(text) {
  return text
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

const KIND_LABEL = { CONTENT: "본문 이미지", FEATURED: "대표 이미지", PRODUCT: "상품 이미지" };

const articles = await prisma.article.findMany({
  where: { media: { some: { prompt: { not: null } } } },
  select: {
    id: true,
    title: true,
    createdAt: true,
    keyword: { select: { text: true } },
    media: {
      where: { prompt: { not: null } },
      orderBy: [{ kind: "asc" }, { position: "asc" }],
      select: {
        id: true,
        kind: true,
        position: true,
        prompt: true,
        altText: true,
        caption: true,
        characterKeys: true,
        webpUrl: true,
      },
    },
  },
  orderBy: { id: "asc" },
});

await fs.mkdir(outDir, { recursive: true });

let written = 0;
let skipped = 0;

for (const article of articles) {
  const file = path.join(outDir, `${String(article.id).padStart(3, "0")}-${safeName(article.title)}.md`);

  if (!rewriteAll) {
    const exists = await fs
      .access(file)
      .then(() => true)
      .catch(() => false);
    if (exists) {
      skipped += 1;
      continue;
    }
  }

  const lines = [
    `# ${article.title}`,
    "",
    `- 글 번호: **#${article.id}**`,
    `- 키워드: ${article.keyword?.text ?? "—"}`,
    `- 생성일: ${article.createdAt.toISOString().slice(0, 10)}`,
    `- 이미지: ${article.media.length}장`,
    "",
    "---",
    "",
  ];

  for (const media of article.media) {
    const label = KIND_LABEL[media.kind] ?? media.kind;
    lines.push(`## ${label} ${media.position ?? ""}`.trim());
    lines.push("");
    if (media.characterKeys) {
      // 캐릭터 참조 이미지를 함께 넣어야 인물 일관성이 유지된다 (직접 만들 때 놓치기 쉽다)
      lines.push(`> 🧑 캐릭터: \`${media.characterKeys}\` — 참조 이미지를 함께 넣어야 인물이 일관됩니다.`);
      lines.push("");
    }
    lines.push("**프롬프트**");
    lines.push("");
    lines.push("```text");
    lines.push(media.prompt ?? "");
    lines.push("```");
    lines.push("");
    if (media.altText) lines.push(`- **alt**: ${media.altText}`);
    if (media.caption) lines.push(`- **캡션**: ${media.caption}`);
    // 생성 여부를 표시 — 아직 안 만들어진 이미지가 있으면 여기서 바로 보인다
    lines.push(`- **생성된 이미지**: ${media.webpUrl ?? "❌ 아직 없음"}`);
    lines.push("");
  }

  await fs.writeFile(file, lines.join("\n"), "utf8");
  written += 1;
}

console.log(`이미지 프롬프트 내보내기 완료 → ${path.relative(root, outDir)}/`);
console.log(`  새로 씀: ${written}개 · 건너뜀(이미 있음): ${skipped}개 · 전체 글: ${articles.length}개`);
if (!rewriteAll && skipped > 0) console.log(`  전부 다시 쓰려면: node scripts/export-image-prompts.mjs --all`);

await prisma.$disconnect();
