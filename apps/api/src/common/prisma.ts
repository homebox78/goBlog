import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

/** DB 연결 가능 여부를 확인한다. 서버는 DB가 없어도 기동된다. */
export async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
