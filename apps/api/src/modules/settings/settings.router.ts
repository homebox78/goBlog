import { Router } from "express";
import { z } from "zod";
import { asyncHandler, parseBody } from "../../common/http.js";
import { requireAuth } from "../../middleware/auth.js";
import { listSettings, updateSettings } from "./settings.service.js";
import {
  listAnthropicModels,
  listGeminiImageModels,
  testAnthropic,
  testGemini,
  testGoogleAds,
  testWordpress,
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
  "/test/wordpress",
  asyncHandler(async (req, res) => res.json(await testWordpress())),
);
