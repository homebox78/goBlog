// 쿠팡 파트너스 크롤 JSON → goBlog 상품 대량 적재.
// 사용법: node scripts/ingest-coupang-crawl.mjs <crawl.json> [apiBase]
//   apiBase 기본값: https://hom2box.com/goBlog/api (로컬은 http://localhost:8787/api)
// 관리자 자격증명은 루트 .env(ADMIN_EMAIL/ADMIN_PASSWORD)를 읽는다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jsonPath = process.argv[2];
const apiBase = (process.argv[3] ?? "https://hom2box.com/goBlog/api").replace(/\/$/, "");
if (!jsonPath) {
  console.error("사용법: node scripts/ingest-coupang-crawl.mjs <crawl.json> [apiBase]");
  process.exit(1);
}

const envText = fs.readFileSync(path.join(root, ".env"), "utf8");
const envVal = (key) => envText.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1]?.trim();
const email = envVal("ADMIN_EMAIL");
const password = envVal("ADMIN_PASSWORD");
if (!email || !password) {
  console.error(".env에 ADMIN_EMAIL/ADMIN_PASSWORD가 없습니다.");
  process.exit(1);
}

let raw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
if (typeof raw === "string") raw = JSON.parse(raw); // evaluate가 문자열로 이중 저장한 경우
const items = raw.items ?? raw;
console.log(`크롤 항목 ${items.length}개 로드 (${jsonPath})`);

// 썸네일 212x212 → 492x492 (배너에서 선명하게)
const upsizeImage = (url) => (url ? url.replace(/\/(\d+x\d+)ex\//, "/492x492ex/") : null);

const payloadItems = items
  .filter((it) => it.productId && it.title)
  .map((it) => ({
    externalKey: `${it.productId}:${it.vendorItemId ?? ""}`.slice(0, 64),
    name: String(it.title).slice(0, 190),
    brand: it.brand ?? null,
    price: it.salesPrice ?? null,
    originPrice: it.originPrice && it.originPrice !== it.salesPrice ? it.originPrice : null,
    imageUrl: upsizeImage(it.image),
    productUrl:
      it.shortUrl ??
      `https://www.coupang.com/vp/products/${it.productId}?itemId=${it.itemId ?? ""}&vendorItemId=${it.vendorItemId ?? ""}`,
    categoryName: it.categoryName ?? null,
    ratingCount: it.ratingCount ?? null,
    isRocket: Boolean(it.isRocket),
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
console.log("로그인 성공");

let created = 0;
let updated = 0;
let matched = 0;
for (let i = 0; i < payloadItems.length; i += 500) {
  const chunk = payloadItems.slice(i, i + 500);
  const res = await fetch(`${apiBase}/products/bulk-import`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ source: "COUPANG", items: chunk }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    console.error(`청크 ${i}-${i + chunk.length} 실패 (HTTP ${res.status}):`, body);
    process.exit(1);
  }
  created += body.created;
  updated += body.updated;
  matched += body.matched;
  console.log(
    `청크 ${i + chunk.length}/${payloadItems.length} — 생성 ${body.created}, 갱신 ${body.updated}, 매칭 ${body.matched}`,
  );
}
console.log(`완료: 생성 ${created}, 갱신 ${updated}, 키워드 매칭 ${matched}`);
