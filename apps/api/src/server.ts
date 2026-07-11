import { env } from "./common/env.js";
import { createApp } from "./app.js";
import { checkDatabase } from "./common/prisma.js";
import { ensureAdminUser } from "./modules/auth/auth.router.js";

const app = createApp();

app.listen(env.PORT, async () => {
  console.log(`[api] http://localhost:${env.PORT}`);

  const dbOk = await checkDatabase();
  if (dbOk) {
    console.log("[db] MySQL 연결 확인");
    await ensureAdminUser();
  } else {
    console.warn("[db] MySQL에 연결할 수 없습니다. `pnpm db:up` (Docker) 또는 MySQL 설치 후 `pnpm db:push`를 실행하세요.");
  }
});
