import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardData {
  db: boolean;
  keywordsToday: number;
  articleCount: number;
  publishStats: Record<string, number>;
  recentArticles: Array<{
    id: number;
    title: string;
    status: string;
    language: string;
    articleType: string;
    qualityScore: number | null;
    updatedAt: string;
  }>;
  recentJobs: Array<{
    id: number;
    platform: string;
    status: string;
    publishedUrl: string | null;
    error: string | null;
    updatedAt: string;
    article: { id: number; title: string };
  }>;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "초안",
  REVIEW: "검수 필요",
  APPROVED: "승인됨",
  SCHEDULED: "예약됨",
  PUBLISHED: "발행 완료",
  FAILED: "실패",
  QUEUED: "대기",
  RUNNING: "진행 중",
  SUCCEEDED: "성공",
  CANCELED: "취소",
};

export default function DashboardPage() {
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardData>("/api/analytics/dashboard"),
  });

  if (query.isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
    );
  }

  if (query.isError) {
    return <p className="text-sm text-destructive">대시보드를 불러오지 못했습니다.</p>;
  }

  const data = query.data;
  const publishedCount = data.publishStats.SUCCEEDED ?? 0;
  const failedCount = data.publishStats.FAILED ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">대시보드</h1>
        <p className="text-sm text-muted-foreground">오늘의 작업 현황을 확인하세요.</p>
      </div>

      {!data.db && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            MySQL에 연결되지 않았습니다. <code className="font-mono">pnpm db:up</code> 실행 후
            <code className="font-mono"> pnpm db:push</code>로 스키마를 반영해주세요.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="오늘의 추천 키워드" value={data.keywordsToday} />
        <StatCard label="전체 글" value={data.articleCount} />
        <StatCard label="발행 성공" value={publishedCount} />
        <StatCard label="발행 실패" value={failedCount} accent={failedCount > 0} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">최근 작성 글</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentArticles.length === 0 ? (
              <EmptyNote text="아직 작성한 글이 없습니다. 2단계(키워드 수집) 이후 사용할 수 있습니다." />
            ) : (
              <ul className="space-y-3">
                {data.recentArticles.map((article) => (
                  <li key={article.id} className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm">{article.title}</span>
                    <Badge variant="secondary">
                      {STATUS_LABEL[article.status] ?? article.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">최근 발행 작업</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentJobs.length === 0 ? (
              <EmptyNote text="발행 이력이 없습니다." />
            ) : (
              <ul className="space-y-3">
                {data.recentJobs.map((job) => (
                  <li key={job.id} className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm">
                      [{job.platform}] {job.article.title}
                    </span>
                    <Badge variant={job.status === "FAILED" ? "destructive" : "secondary"}>
                      {STATUS_LABEL[job.status] ?? job.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 text-3xl font-bold ${accent ? "text-destructive" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{text}</p>;
}
