import { env } from "./common/env.js";
import { createApp } from "./app.js";
import { checkDatabase } from "./common/prisma.js";
import { ensureAdminUser } from "./modules/auth/auth.router.js";
import { scheduleFromSettings } from "./modules/schedules/scheduler.js";
import { startPublishRunner } from "./modules/publishing/publish-runner.js";

const app = createApp();

const server = app.listen(env.PORT, async () => {
  console.log(`[api] http://localhost:${env.PORT}`);

  const dbOk = await checkDatabase();
  if (dbOk) {
    console.log("[db] MySQL 연결 확인");
    await ensureAdminUser();
    await scheduleFromSettings();
    startPublishRunner();
  } else {
    console.warn("[db] MySQL에 연결할 수 없습니다. `pnpm db:up` (Docker) 또는 MySQL 설치 후 `pnpm db:push`를 실행하세요.");
  }
});

// 글 생성(Claude 호출)은 '길게'에서 5분을 넘긴다. Node 기본 requestTimeout(5분)이면 서버가 먼저 끊는다.
server.requestTimeout = 15 * 60 * 1000;
server.headersTimeout = 16 * 60 * 1000;
