import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./common/env.js";
import { checkDatabase } from "./common/prisma.js";
import { authRouter } from "./modules/auth/auth.router.js";
import { settingsRouter } from "./modules/settings/settings.router.js";
import { dashboardRouter } from "./modules/analytics/dashboard.router.js";
import { keywordsRouter } from "./modules/keywords/keywords.router.js";
import { articlesRouter } from "./modules/articles/articles.router.js";
import { productsRouter } from "./modules/products/products.router.js";
import { publishRouter } from "./modules/publishing/publish.router.js";
import { mediaDir } from "./modules/images/image-service.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", true);
  app.use(
    cors({
      origin: env.WEB_URL,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());

  const healthHandler = async (req: express.Request, res: express.Response) => {
    res.json({ ok: true, db: await checkDatabase() });
  };
  app.get("/health", healthHandler);
  // 운영 프록시(/goBlog/api → /api)에서도 접근 가능한 별칭
  app.get("/api/health", healthHandler);

  app.use("/api/auth", authRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/analytics", dashboardRouter);
  app.use("/api/keywords", keywordsRouter);
  app.use("/api/articles", articlesRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/publish-jobs", publishRouter);
  app.use("/media", express.static(mediaDir(), { maxAge: "7d" }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
