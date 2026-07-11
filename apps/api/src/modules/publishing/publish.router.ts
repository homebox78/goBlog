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
  platform: z.enum(["BLOGGER", "INSTAGRAM", "WORDPRESS", "NAVER_BLOG", "TISTORY"]),
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
