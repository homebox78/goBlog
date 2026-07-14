import { Cron } from "croner";
import { prisma } from "../../common/prisma.js";
import { minQualityScore } from "../articles/quality-gate.js";
import { publishToBlogger, publishToInstagram, publishToWordpress } from "./connectors.js";

const MAX_RETRY = 3;
let processing = false;

/** 예약된 발행 작업을 1분마다 처리한다 (Redis 없이 in-process). */
export function startPublishRunner(): void {
  // 서버 재시작 시 처리 중(RUNNING)에 멈춘 작업을 다시 대기로 되돌린다
  prisma.publishJob
    .updateMany({ where: { status: "RUNNING" }, data: { status: "QUEUED" } })
    .then((result) => {
      if (result.count > 0) console.log(`[publish] 재시작 복구: RUNNING ${result.count}건 → QUEUED`);
    })
    .catch(() => undefined);

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
        // 네이버·티스토리는 Chrome 확장이 처리하므로 서버 러너는 건너뛴다
        platform: { in: ["WORDPRESS", "BLOGGER", "INSTAGRAM"] },
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
        // 자동발행 품질 게이트 — 기준은 설정값 (하드코딩 85가 설정을 무시하던 버그)
        const minScore = await minQualityScore();
        if ((job.article.qualityScore ?? 0) < minScore) {
          throw new Error(
            `품질 점수 ${job.article.qualityScore ?? 0}점 — ${minScore}점 미만은 자동발행이 차단됩니다.`,
          );
        }

        // 본문에 접근 불가한 로컬 이미지 주소가 남아 있으면 발행 차단 (엑박 방지)
        if (/(localhost|127\.0\.0\.1)(:\d+)?\/media\//.test(job.article.contentHtml ?? "")) {
          throw new Error("본문에 로컬 이미지 주소가 있습니다. 글 상세에서 'Gemini 생성'을 다시 눌러 이미지를 재생성한 뒤 발행해주세요.");
        }

        // 애드센스·검색 정책 위험 문구가 있으면 발행 차단
        const policyRisks = (job.article.qualityReport as { policyRisks?: string[] } | null)?.policyRisks;
        if (policyRisks && policyRisks.length > 0) {
          throw new Error(`정책 위험 문구 감지: ${policyRisks.join(", ")} — 본문을 수정한 뒤 발행해주세요.`);
        }

        let url: string;
        if (job.platform === "WORDPRESS") {
          url = (await publishToWordpress(job.article)).url;
        } else if (job.platform === "BLOGGER") {
          url = (await publishToBlogger(job.article)).url;
        } else if (job.platform === "INSTAGRAM") {
          url = (await publishToInstagram(job.article)).url;
        } else {
          throw new Error(`${job.platform} 자동 발행은 Chrome 확장(6단계)에서 지원합니다.`);
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
