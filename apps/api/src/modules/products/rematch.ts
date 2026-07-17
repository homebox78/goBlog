import { prisma } from "../../common/prisma.js";
import { bestKeywordForProduct } from "./product-match.js";

/**
 * ACTIVE 상품 전체 ↔ 활성 키워드 재매칭.
 * 크롤 상품은 DB에 상시 보관되고, 매일 새 키워드가 수집되면 이 함수가 다시 돌아
 * "새 키워드에 어울리는 상품"이 자동으로 매칭·노출된다 (USED/DISABLED는 발행 이력 보존 위해 제외).
 * 매칭이 이미 같으면 건드리지 않아 matchedAt(알림 뱃지 기준)이 매번 갱신되는 것을 막는다.
 */
export async function rematchActiveProducts(): Promise<{ scanned: number; matched: number; changed: number }> {
  const keywords = await prisma.keyword.findMany({
    where: { status: { in: ["RECOMMENDED", "SAVED"] } },
    orderBy: { updatedAt: "desc" },
    take: 500,
    select: { id: true, text: true },
  });
  const actives = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, brand: true, matchedKeywordId: true },
  });
  let changed = 0;
  let matched = 0;
  for (const p of actives) {
    const match = bestKeywordForProduct({ name: p.name, brand: p.brand }, keywords);
    const newId = match?.keyword.id ?? null;
    if (newId) matched += 1;
    if (newId !== p.matchedKeywordId) {
      await prisma.product.update({
        where: { id: p.id },
        data: { matchedKeywordId: newId, matchedAt: newId ? new Date() : null },
      });
      changed += 1;
    }
  }
  return { scanned: actives.length, matched, changed };
}
