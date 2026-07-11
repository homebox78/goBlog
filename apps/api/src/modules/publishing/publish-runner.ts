import { Cron } from "croner";
import { prisma } from "../../common/prisma.js";
import { publishToBlogger, publishToInstagram } from "./connectors.js";

const MAX_RETRY = 3;
let processing = false;

/** 예약된 발행 작업을 1분마다 처리한다 (Redis 없이 in-process). */
export function startPublishRunner(): void {
  new Cron("* * * * *", { protect: true }, () => processQueue());
  console.log("[publish] 발행 러너 시작 (1분 주기)");
}

export async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    const jobs = await prisma.publishJob.findMany({
      where: {
        status: "QUEUED",
        OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
      },
      orderBy: { id: "asc" },
      take: 3,
      include: { article: true },
    });

    for (const job of jobs) {
      await prisma.publishJob.update({
        where: { id: job.id },
        data: { status: "RUNNING", startedAt: new Date() },
      });
      await log(job.id, "INFO", `${job.platform} 발행 시작`);

      try {
        // 자동발행 품질 게이트
        if ((job.article.qualityScore ?? 0) < 85) {
          throw new Error(`품질 점수 ${job.article.qualityScore ?? 0}점 — 85점 미만은 자동발행이 차단됩니다.`);
        }

        let url: string;
        if (job.platform === "BLOGGER") {
          url = (await publishToBlogger(job.article)).url;
        } else if (job.platform === "INSTAGRAM") {
          url = (await publishToInstagram(job.article)).url;
        } else {
          throw new Error(`${job.platform} 자동 발행은 아직 지원하지 않습니다 (네이버·티스토리는 Chrome 확장 단계).`);
        }

        await prisma.publishJob.update({
          where: { id: job.id },
          data: { status: "SUCCEEDED", finishedAt: new Date(), publishedUrl: url, error: null },
        });
        await prisma.article.update({ where: { id: job.articleId }, data: { status: "PUBLISHED" } });
        await log(job.id, "INFO", `발행 성공: ${url}`);
      } catch (error) {
        const message = (error as Error).message;
        const retry = job.retryCount + 1;
        const canRetry = retry < MAX_RETRY && !/설정되지 않았|차단|지원하지 않/.test(message);
        await prisma.publishJob.update({
          where: { id: job.id },
          data: {
            status: canRetry ? "QUEUED" : "FAILED",
            retryCount: retry,
            error: message,
            finishedAt: canRetry ? null : new Date(),
            // 재시도는 5분 뒤
            scheduledAt: canRetry ? new Date(Date.now() + 5 * 60 * 1000) : job.scheduledAt,
          },
        });
        await log(job.id, "ERROR", `${message}${canRetry ? ` (재시도 ${retry}/${MAX_RETRY})` : ""}`);
      }
    }
  } catch (error) {
    console.error("[publish] 큐 처리 오류:", (error as Error).message);
  } finally {
    processing = false;
  }
}

async function log(publishJobId: number, level: string, message: string): Promise<void> {
  await prisma.publishLog.create({ data: { publishJobId, level, message } }).catch(() => undefined);
}
