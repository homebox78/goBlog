// 발급된 naver.me 링크를 DB에 반영 — bulk-import 업서트(기존 행 갱신, 매칭 보존).
// 사용법: node scripts/update-bc-links.mjs <crawl.json> <links.json(id->url)> [apiBase]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [crawlPath, linksPath, apiBaseArg] = process.argv.slice(2);
const apiBase = (apiBaseArg ?? "https://hom2box.com/goBlog/api").replace(/\/$/, "");

let raw = JSON.parse(fs.readFileSync(crawlPath, "utf8"));
if (typeof raw === "string") raw = JSON.parse(raw);
let links = JSON.parse(fs.readFileSync(linksPath, "utf8"));
if (typeof links === "string") links = JSON.parse(links);

const envText = fs.readFileSync(path.join(root, ".env"), "utf8");
const envVal = (key) => envText.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1]?.trim();

const items = (raw.items ?? raw)
  .filter((it) => links[String(it.affiliateProductId)])
  .map((it) => ({
    externalKey: String(it.affiliateProductId).slice(0, 64),
    name: String(it.title).slice(0, 190),
    brand: it.storeName ?? null,
    price: it.price ?? null,
    originPrice: it.originPrice ?? null,
    imageUrl: it.image ?? null,
    productUrl: links[String(it.affiliateProductId)],
    categoryName: it.categoryName ?? null,
    ratingCount: it.ratingCount ?? null,
    isRocket: false,
  }));
console.log(`링크 반영 대상 ${items.length}개`);

const login = await fetch(`${apiBase}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: envVal("ADMIN_EMAIL"), password: envVal("ADMIN_PASSWORD") }),
});
const cookie = (login.headers.getSetCookie?.() ?? [login.headers.get("set-cookie")].filter(Boolean))
  .map((c) => c.split(";")[0])
  .join("; ");

for (let i = 0; i < items.length; i += 500) {
  const chunk = items.slice(i, i + 500);
  const res = await fetch(`${apiBase}/products/bulk-import`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ source: "BRANDCONNECT", items: chunk }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    console.error(`청크 ${i} 실패:`, body);
    process.exit(1);
  }
  console.log(`청크 ${i + chunk.length}/${items.length} — 갱신 ${body.updated}, 생성 ${body.created}`);
}
console.log("완료");
