import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../common/prisma.js";
import { asyncHandler, HttpError, parseBody } from "../../common/http.js";
import { requireAuth } from "../../middleware/auth.js";
import { processQueue } from "./publish-runner.js";

export const publishRouter = Router();

publishRouter.use(requireAuth);

const createSchema = z.object({
  articleId: z.number().int(),
  platform: z.enum(["BLOGGER", "INSTAGRAM", "THREADS", "WORDPRESS", "NAVER_BLOG", "TISTORY"]),
  scheduledAt: z.string().datetime().optional(),
});

/** 발행 작업 생성 (예약 시간 없으면 즉시 처리) */
publishRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = parseBody(createSchema, req.body);

    const article = await prisma.article.findUnique({ where: { id: body.articleId } });
    if (!article) throw new HttpError(404, "글을 찾을 수 없습니다.");

    const job = await prisma.publishJob.create({
      data: {
        articleId: body.articleId,
        platform: body.platform,
        status: "QUEUED",
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      },
    });

    if (!body.scheduledAt) {
      // 즉시 발행 — 러너를 바로 한 번 돌린다 (비동기)
      void processQueue();
    }

    res.json({ jobId: job.id, status: job.status });
  }),
);

/** 발행 작업 목록 (글 기준) */
publishRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const articleId = req.query.articleId ? Number(req.query.articleId) : undefined;
    const jobs = await prisma.publishJob.findMany({
      where: articleId ? { articleId } : undefined,
      orderBy: { id: "desc" },
      take: 50,
      include: {
        article: { select: { id: true, title: true } },
        logs: { orderBy: { id: "desc" }, take: 3 },
      },
    });
    res.json({ jobs });
  }),
);

/** 실패 작업 재시도 */
publishRouter.post(
  "/:id/retry",
  asyncHandler(async (req, res) => {
    const job = await prisma.publishJob.update({
      where: { id: Number(req.params.id) },
      data: { status: "QUEUED", retryCount: 0, error: null, scheduledAt: null },
    });
    void processQueue();
    res.json({ jobId: job.id, status: job.status });
  }),
);

/**
 * 발행 URL 생존 검증 — 플랫폼에서 삭제된 글의 '발행 성공' 기록을 정리한다.
 * 죽은 URL이 남아 있으면 내부 링크가 깨진 주소로 연결된다.
 */
publishRouter.post(
  "/verify-urls",
  asyncHandler(async (_req, res) => {
    const { verifyPublishedUrls } = await import("./verify-urls.js");
    res.json(await verifyPublishedUrls());
  }),
);

/** 발행 드리프트 스캔 — 광고 링크가 발행글에 살아 있는지 실측 (시각 비교가 아니라 실제 페이지 확인) */
publishRouter.get(
  "/drift",
  asyncHandler(async (_req, res) => {
    const { scanPublishDrift } = await import("./publish-drift.js");
    res.json(await scanPublishDrift());
  }),
);

/** 드리프트 자동 복구 — WP·Blogger는 기존 글을 덮어쓴다(URL 유지). 티스토리·네이버는 확장 필요 목록 반환 */
publishRouter.post(
  "/drift/repair",
  asyncHandler(async (_req, res) => {
    const { repairPublishDrift } = await import("./publish-drift.js");
    res.json(await repairPublishDrift());
  }),
);

/** 한 글을 한 플랫폼에 재발행 (기존 글 덮어쓰기 — 새 글로 올리지 않는다) */
publishRouter.post(
  "/republish",
  asyncHandler(async (req, res) => {
    const articleId = Number(req.body?.articleId);
    const platform = String(req.body?.platform ?? "");
    if (!articleId || (platform !== "WORDPRESS" && platform !== "BLOGGER")) {
      throw new HttpError(400, "articleId와 platform(WORDPRESS|BLOGGER)이 필요합니다. 티스토리·네이버는 확장으로 재발행하세요.");
    }
    const { republish } = await import("./republish.js");
    res.json(await republish(articleId, platform));
  }),
);
