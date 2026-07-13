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

/**
 * 우아한 종료 — 처리 중인 요청을 끝까지 마치고 나서 죽는다.
 *
 * 예전엔 SIGTERM에 즉시 죽어서(systemd status=143), **배포할 때마다 진행 중이던 글 생성이 통째로 날아갔다**.
 * 3~4분짜리 요청이라 사용자는 "응답 없음"만 보고, 글은 만들어지지도 않았다.
 * 이제 새 연결만 막고 진행 중인 요청은 끝낸다 (systemd TimeoutStopSec=300과 맞춰둠).
 */
let shuttingDown = false;
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[api] ${signal} — 진행 중인 요청을 마치고 종료합니다 (최대 5분)`);
    server.close(() => {
      console.log("[api] 종료 완료");
      process.exit(0);
    });
    // 끝나지 않는 요청이 있어도 영원히 매달리지는 않는다
    setTimeout(() => {
      console.warn("[api] 대기 시간 초과 — 강제 종료");
      process.exit(0);
    }, 5 * 60 * 1000).unref();
  });
}
