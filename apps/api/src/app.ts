import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./common/env.js";
import { checkDatabase } from "./common/prisma.js";
import { authRouter } from "./modules/auth/auth.router.js";
import { settingsRouter } from "./modules/settings/settings.router.js";
import { dashboardRouter } from "./modules/analytics/dashboard.router.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(
    cors({
      origin: env.WEB_URL,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());

  app.get("/health", async (req, res) => {
    res.json({ ok: true, db: await checkDatabase() });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/analytics", dashboardRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
