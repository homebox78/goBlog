// 초기 종목·시세 적재 (수동 1회). 서버에서: node node_modules/tsx/dist/cli.mjs src/scripts/refresh-stocks.ts
async function main() {
  await import("../common/env.js");
  const { seedStocks, refreshStockDaily, tagArticlesWithStocks } = await import("../modules/stocks/stocks.js");
  const seeded = await seedStocks();
  console.log("[refresh-stocks] 종목 시드:", seeded);
  const r = await refreshStockDaily();
  console.log("[refresh-stocks] 시세 적재:", JSON.stringify(r));
  const tagged = await tagArticlesWithStocks();
  console.log("[refresh-stocks] 글-종목 태깅:", tagged);
  process.exit(0);
}
main().catch((e) => {
  console.error("[refresh-stocks] FAIL", (e && e.message) || e);
  process.exit(1);
});
