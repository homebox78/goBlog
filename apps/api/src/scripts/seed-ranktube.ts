// 랭크튜브형 랭킹 샘플 데이터 적재 (프로토타입).
// 서버에서: node node_modules/tsx/dist/cli.mjs src/scripts/seed-ranktube.ts
async function main() {
  await import("../common/env.js");
  const { seedRank } = await import("../modules/ranktube/ranktube.js");
  const r = await seedRank();
  console.log("[seed-ranktube] 적재:", JSON.stringify(r));
  process.exit(0);
}
main().catch((e) => {
  console.error("[seed-ranktube] FAIL", (e && e.message) || e);
  process.exit(1);
});
