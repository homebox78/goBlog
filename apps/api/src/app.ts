import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./common/env.js";
import { checkDatabase } from "./common/prisma.js";
import { authRouter } from "./modules/auth/auth.router.js";
import { settingsRouter } from "./modules/settings/settings.router.js";
import { googleOAuthRouter } from "./modules/settings/google-oauth.router.js";
import { threadsOAuthRouter } from "./modules/settings/threads-oauth.router.js";
import { dashboardRouter } from "./modules/analytics/dashboard.router.js";
import { keywordsRouter } from "./modules/keywords/keywords.router.js";
import { articlesRouter } from "./modules/articles/articles.router.js";
import { productsRouter } from "./modules/products/products.router.js";
import { welfareRouter } from "./modules/welfare/welfare.router.js";
import { adsRouter } from "./modules/ads/ads.router.js";
import { publishRouter } from "./modules/publishing/publish.router.js";
import { mediaDir } from "./modules/images/image-service.js";
import { extensionRouter } from "./modules/extension/extension.router.js";
import { sfRouter } from "./modules/sf/sf.router.js";
import { communityRouter } from "./modules/community/community.router.js";
import { charactersRouter } from "./modules/characters/characters.router.js";
import { threadsBotRouter } from "./modules/threads/threads-bot.router.js";
import { subscribersRouter, statsRouter } from "./modules/stats/stats.router.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", true);
  app.use(
    cors({
      // Chrome 확장(chrome-extension://)은 토큰 인증이라 origin 제한 불필요
      origin: (origin, callback) => {
        if (!origin || origin === env.WEB_URL || origin.startsWith("chrome-extension://")) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "12mb" })); // 캐릭터 레퍼런스 base64 업로드 대응
  app.use(cookieParser());

  const healthHandler = async (req: express.Request, res: express.Response) => {
    // stamp = 배포 시각 (deploy.ps1이 기록) — 실행 중인 프로세스가 최신 배포인지 확인용
    let stamp: string | null = null;
    try {
      const { readFileSync } = await import("node:fs");
      stamp = readFileSync(".deploy-stamp", "utf8").trim();
    } catch {
      // 로컬 개발 등 스탬프 없음
    }
    res.json({ ok: true, db: await checkDatabase(), stamp });
  };
  app.get("/health", healthHandler);
  // 운영 프록시(/goBlog/api → /api)에서도 접근 가능한 별칭
  app.get("/api/health", healthHandler);

  app.use("/api/auth", authRouter);
  // OAuth 콜백은 세션 없이도 열려야 한다(구글·스레드가 브라우저를 여기로 보냄) → settingsRouter(requireAuth)보다 먼저 건다
  app.use("/api/settings", googleOAuthRouter);
  app.use("/api/settings", threadsOAuthRouter);
  // 주식 커뮤니티 — 공개(로그인·조회) + 인증(쓰기는 세션 쿠키). requireAuth 없음.
  app.use("/api/community", communityRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/analytics", dashboardRouter);
  app.use("/api/keywords", keywordsRouter);
  app.use("/api/articles", articlesRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/welfare", welfareRouter);
  app.use("/api/ads", adsRouter);
  app.use("/api/publish-jobs", publishRouter);
  app.use("/api/characters", charactersRouter);
  app.use("/api/threads-bot", threadsBotRouter);
  app.use("/api/extension", extensionRouter);
  app.use("/api/sf", sfRouter);  // Shorts Factory 데이터 미러(시계열)
  app.use("/api/subscribers", subscribersRouter);
  app.use("/api/stats", statsRouter);
  app.use("/media", express.static(mediaDir(), { maxAge: "7d" }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
