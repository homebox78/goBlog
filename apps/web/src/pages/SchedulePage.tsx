import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, Clock, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PublishJob {
  id: number;
  platform: string;
  status: string;
  scheduledAt: string | null;
  finishedAt: string | null; // 실제로 발행이 끝난 시각 (초까지 기록)
  publishedUrl: string | null;
  error: string | null;
  createdAt: string;
  article: { id: number; title: string };
}

/** 발행일시 — 년월일 시:분:초 (언제 나갔는지 초까지 남긴다) */
function formatStamp(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("ko-KR")} ${d.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })}`;
}

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  QUEUED: { label: "대기", variant: "secondary" },
  RUNNING: { label: "진행 중", variant: "secondary" },
  SUCCEEDED: { label: "성공", variant: "default" },
  FAILED: { label: "실패", variant: "destructive" },
  CANCELED: { label: "취소", variant: "secondary" },
};

const EXTENSION_PLATFORMS = ["NAVER_BLOG", "TISTORY"];

export default function SchedulePage() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["publish-jobs", "all"],
    queryFn: () => api.get<{ jobs: PublishJob[] }>("/api/publish-jobs"),
    refetchInterval: 15000,
  });

  const retryMutation = useMutation({
    mutationFn: (jobId: number) => api.post(`/api/publish-jobs/${jobId}/retry`),
    onSuccess: () => {
      toast.success("재시도 요청했습니다.");
      queryClient.invalidateQueries({ queryKey: ["publish-jobs", "all"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "재시도 실패"),
  });

  const jobs = query.data?.jobs ?? [];
  const scheduled = jobs.filter((job) => job.status === "QUEUED" && job.scheduledAt);
  const extensionPending = jobs.filter(
    (job) => job.status === "QUEUED" && EXTENSION_PLATFORMS.includes(job.platform),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">스케줄</h1>
        <p className="text-sm text-muted-foreground">
          키워드 자동 수집·예약 발행·발행 이력을 관리합니다.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Clock className="size-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">키워드 자동 수집</p>
              <p className="text-xs text-muted-foreground">
                매일 오전 7시(KST) — 설정에서 시간 변경
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">예약된 발행</p>
            <p className="text-2xl font-bold">{scheduled.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">확장 발행 대기 (네이버·티스토리)</p>
            <p className="text-2xl font-bold">{extensionPending.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="size-4" /> 발행 작업
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            <RefreshCw className="size-4" /> 새로고침
          </Button>
        </CardHeader>
        <CardContent>
          {query.isPending ? (
            <Skeleton className="h-64" />
          ) : jobs.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              발행 작업이 없습니다. 글 상세에서 발행하거나 예약하세요.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>글</TableHead>
                  <TableHead className="text-center">플랫폼</TableHead>
                  <TableHead className="text-center">예약</TableHead>
                  <TableHead className="text-center">발행일시</TableHead>
                  <TableHead className="text-center">상태</TableHead>
                  <TableHead>결과</TableHead>
                  <TableHead className="w-16 text-center">액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => {
                  const status = STATUS[job.status] ?? { label: job.status, variant: "secondary" as const };
                  return (
                    <TableRow key={job.id}>
                      <TableCell>
                        <Link to={`/articles/${job.article.id}`} className="text-sm hover:underline">
                          {job.article.title}
                        </Link>
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {job.platform}
                        {EXTENSION_PLATFORMS.includes(job.platform) && (
                          <span className="block text-[10px] text-muted-foreground">확장 발행</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {job.scheduledAt ? new Date(job.scheduledAt).toLocaleString("ko-KR") : "즉시"}
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs whitespace-nowrap text-muted-foreground">
                        {job.status === "SUCCEEDED" && job.finishedAt ? formatStamp(job.finishedAt) : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="max-w-56">
                        {job.publishedUrl ? (
                          <a
                            href={job.publishedUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate text-xs text-blue-600 hover:underline"
                          >
                            {job.publishedUrl}
                          </a>
                        ) : job.error ? (
                          <span className="line-clamp-2 text-xs text-destructive">{job.error}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {job.status === "FAILED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => retryMutation.mutate(job.id)}
                          >
                            재시도
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
