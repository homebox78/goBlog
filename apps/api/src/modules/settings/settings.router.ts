import { Router } from "express";
import { z } from "zod";
import { asyncHandler, parseBody } from "../../common/http.js";
import { requireAuth } from "../../middleware/auth.js";
import { listSettings, updateSettings } from "./settings.service.js";
import {
  listAnthropicModels,
  listGeminiImageModels,
  testAllPlatforms,
  testAnthropic,
  testGemini,
  testGoogleAds,
} from "./connection-tests.js";

const updateSchema = z.object({
  values: z.record(z.string(), z.string().nullable()),
});

export const settingsRouter = Router();

settingsRouter.use(requireAuth);

settingsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ settings: await listSettings() });
  }),
);

settingsRouter.put(
  "/",
  asyncHandler(async (req, res) => {
    const { values } = parseBody(updateSchema, req.body);
    await updateSettings(values);

    // 수집 시간·보고 시각이 바뀌면 스케줄을 다시 잡는다
    if ("keywords.collectTime" in values || "telegram.dailyReportTime" in values) {
      const { scheduleFromSettings } = await import("../schedules/scheduler.js");
      await scheduleFromSettings();
    }

    res.json({ settings: await listSettings() });
  }),
);

settingsRouter.get(
  "/models/anthropic",
  asyncHandler(async (req, res) => res.json(await listAnthropicModels())),
);

settingsRouter.get(
  "/models/gemini",
  asyncHandler(async (req, res) => res.json(await listGeminiImageModels())),
);

settingsRouter.post(
  "/test/anthropic",
  asyncHandler(async (req, res) => res.json(await testAnthropic())),
);

settingsRouter.post(
  "/test/gemini",
  asyncHandler(async (req, res) => res.json(await testGemini())),
);

settingsRouter.post(
  "/test/google-ads",
  asyncHandler(async (req, res) => res.json(await testGoogleAds())),
);

settingsRouter.post(
  "/test/platforms",
  asyncHandler(async (req, res) => res.json(await testAllPlatforms())),
);

settingsRouter.post(
  "/test/coupang",
  asyncHandler(async (req, res) => {
    const { testCoupang } = await import("../products/coupang.js");
    res.json(await testCoupang());
  }),
);

settingsRouter.post(
  "/test/telegram",
  asyncHandler(async (req, res) => {
    const { testTelegram } = await import("../notify/telegram.js");
    res.json(await testTelegram());
  }),
);

/** 일일 운영 보고 즉시 발송 (테스트·수동 트리거) */
settingsRouter.post(
  "/test/telegram-report",
  asyncHandler(async (req, res) => {
    const { sendDailyReport } = await import("../notify/telegram.js");
    const ok = await sendDailyReport();
    res.json({ ok, message: ok ? "운영 보고를 전송했습니다." : "전송 실패 — 봇 토큰·Chat ID를 확인해주세요." });
  }),
);
