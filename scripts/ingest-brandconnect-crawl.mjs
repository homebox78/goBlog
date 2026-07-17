// 네이버 브랜드커넥트 크롤 JSON → goBlog 상품 대량 적재.
// 사용법: node scripts/ingest-brandconnect-crawl.mjs <crawl.json> [apiBase]
// externalKey = affiliateProductId (링크 발급 API 호출에 그대로 쓰인다).
// productUrl = 발급된 naver.me 트래킹 링크가 있으면 그것, 없으면 스마트스토어 원본 URL
//   (원본 URL 상품은 스케줄러가 광고에 쓰지 않는다 — 링크 발급 후 갱신).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jsonPath = process.argv[2];
const apiBase = (process.argv[3] ?? "https://hom2box.com/goBlog/api").replace(/\/$/, "");
if (!jsonPath) {
  console.error("사용법: node scripts/ingest-brandconnect-crawl.mjs <crawl.json> [apiBase]");
  process.exit(1);
}

const envText = fs.readFileSync(path.join(root, ".env"), "utf8");
const envVal = (key) => envText.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1]?.trim();
const email = envVal("ADMIN_EMAIL");
const password = envVal("ADMIN_PASSWORD");

let raw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
if (typeof raw === "string") raw = JSON.parse(raw);
const items = raw.items ?? raw;
console.log(`크롤 항목 ${items.length}개 로드`);

const payloadItems = items
  .filter((it) => it.affiliateProductId && it.title)
  .map((it) => ({
    externalKey: String(it.affiliateProductId).slice(0, 64),
    name: String(it.title).slice(0, 190),
    brand: it.storeName ?? null,
    price: it.price ?? null,
    originPrice: it.originPrice ?? null,
    imageUrl: it.image ?? null,
    productUrl: it.shortenUrl ?? it.productUrl,
    categoryName: it.categoryName ?? null,
    ratingCount: it.ratingCount ?? null,
    isRocket: false,
  }));

const login = await fetch(`${apiBase}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
if (!login.ok) {
  console.error(`로그인 실패 (HTTP ${login.status}):`, await login.text());
  process.exit(1);
}
const cookie = (login.headers.getSetCookie?.() ?? [login.headers.get("set-cookie")].filter(Boolean))
  .map((c) => c.split(";")[0])
  .join("; ");

let created = 0;
let updated = 0;
let matched = 0;
for (let i = 0; i < payloadItems.length; i += 500) {
  const chunk = payloadItems.slice(i, i + 500);
  const res = await fetch(`${apiBase}/products/bulk-import`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ source: "BRANDCONNECT", items: chunk }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    console.error(`청크 ${i} 실패 (HTTP ${res.status}):`, body);
    process.exit(1);
  }
  created += body.created;
  updated += body.updated;
  matched += body.matched;
  console.log(`청크 ${i + chunk.length}/${payloadItems.length} — 생성 ${body.created}, 갱신 ${body.updated}, 매칭 ${body.matched}`);
}
console.log(`완료: 생성 ${created}, 갱신 ${updated}, 키워드 매칭 ${matched}`);
