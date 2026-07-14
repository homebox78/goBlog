import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface TrendPoint {
  date: string;
  label: string;
  articles: number;
  published: number;
  failed: number;
  quality: number | null; // 글이 없는 날은 null — 0으로 그리면 그래프가 바닥으로 떨어진다
  costKrw: number;
}

const PRODUCTION_CHART: ChartConfig = {
  articles: { label: "생성", color: "var(--chart-1)" },
  published: { label: "발행", color: "var(--chart-2)" },
  failed: { label: "발행 실패", color: "var(--destructive)" },
};

const QUALITY_CHART: ChartConfig = {
  quality: { label: "평균 품질", color: "var(--chart-3)" },
};

const COST_CHART: ChartConfig = {
  costKrw: { label: "AI 비용", color: "var(--chart-4)" },
};

interface SelfLearningStatus {
  published: number;
  withSignal: number;
  minSample: number;
  learned: {
    worked: string[];
    failed: string[];
    rules: string[];
    sampleSize: number;
    confidence: "참고" | "권장" | "적용";
  } | null;
}

interface PerformanceArticle {
  articleId: number;
  title: string;
  qualityScore: number | null;
  impressions: number;
  clicks: number;
  ctr: number;
  avgPosition: number | null;
}

interface DashboardData {
  db: boolean;
  minQualityScore?: number; // 자동발행 기준선 (설정값) — 화면이 85를 하드코딩하지 않게 서버가 내려준다
  keywordsToday: number;
  articleCount: number;
  todo?: {
    review: number;
    noImage: number;
    lowQuality: number;
    notPublished: number;
  };
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
  usage?: {
    monthlyCostKrw: number;
    claudeCostKrw: number;
    geminiCostKrw: number;
    geminiImages: number;
  };
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

interface BrokenImage {
  articleId: number;
  articleTitle: string;
  reason: string;
  repairable: boolean;
}

/**
 * 깨진 이미지 감시 — 예전엔 발행 직전에 엑박을 보고서야 알았다.
 * 이상이 없으면 아무것도 그리지 않는다 (평소 대시보드를 어지럽히지 않게).
 */
function MediaHealthCard() {
  const queryClient = useQueryClient();
  const health = useQuery({
    queryKey: ["media-health"],
    queryFn: () => api.get<{ broken: BrokenImage[]; count: number }>("/api/articles/media-health"),
  });

  const repair = useMutation({
    mutationFn: () =>
      api.post<{ bodiesFixed: number; imagesRegenerated: number; failed: unknown[] }>(
        "/api/articles/media-health/repair",
      ),
    onSuccess: (r) => {
      toast.success(`복구 완료 — 본문 ${r.bodiesFixed}건, 이미지 재생성 ${r.imagesRegenerated}장`);
      queryClient.invalidateQueries({ queryKey: ["media-health"] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "복구 실패"),
  });

  if (!health.data || health.data.count === 0) return null;

  const articles = [...new Set(health.data.broken.map((b) => b.articleTitle))];
  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="size-4 text-destructive" />
          깨진 이미지 {health.data.count}건
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1 text-sm text-muted-foreground">
          {articles.slice(0, 4).map((title) => (
            <p key={title} className="truncate">
              · {title}
            </p>
          ))}
          {articles.length > 4 && <p>· 외 {articles.length - 4}개 글</p>}
        </div>
        <p className="text-xs text-muted-foreground">
          본문이 가리키는 옛 주소를 되돌리고, 파일이 사라진 이미지는 저장된 프롬프트로 다시 만듭니다.
        </p>
        <Button size="sm" onClick={() => repair.mutate()} disabled={repair.isPending}>
          {repair.isPending ? "복구 중..." : "자동 복구"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardData>("/api/analytics/dashboard"),
  });

  const trends = useQuery({
    queryKey: ["dashboard-trends"],
    queryFn: () => api.get<{ days: number; series: TrendPoint[] }>("/api/analytics/trends?days=14"),
  });

  // 자가학습 — 내 글의 실제 성과에서 배운 규칙. 표본이 모자라면 learned:null (관측 중).
  const selfLearning = useQuery({
    queryKey: ["self-learning"],
    queryFn: () => api.get<SelfLearningStatus>("/api/analytics/self-learning"),
  });

  // 검색 성과 — Search Console 수집분. 아직 수집 전이면 collected:false 로 온다.
  const perf = useQuery({
    queryKey: ["dashboard-performance"],
    queryFn: () =>
      api.get<{ days: number; collected: boolean; articles: PerformanceArticle[] }>(
        "/api/analytics/performance?days=28",
      ),
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

      {data.todo && (
        <Card className="border-primary/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">📋 오늘 할 일</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <TodoCard label="검토 대기" value={data.todo.review} to="/articles?filter=review" hint="내용 확인 후 발행" />
            <TodoCard label="이미지 없는 글" value={data.todo.noImage} to="/articles?filter=noimage" hint="이미지 생성 필요" />
            <TodoCard
              label={`${data.minQualityScore ?? 85}점 미만`}
              value={data.todo.lowQuality}
              to="/articles?filter=lowq"
              hint="보정 필요"
            />
            <TodoCard label="미발행 글" value={data.todo.notPublished} to="/articles?filter=unpublished" hint="발행 대기 중" />
          </CardContent>
        </Card>
      )}

      <MediaHealthCard />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="오늘의 추천 키워드" value={data.keywordsToday} />
        <StatCard label="전체 글" value={data.articleCount} />
        <StatCard label="발행 성공" value={publishedCount} />
        <StatCard label="발행 실패" value={failedCount} accent={failedCount > 0} />
      </div>

      {trends.data && trends.data.series.some((point) => point.articles + point.published > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="min-w-0 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">최근 14일 — 글 생성과 발행</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={PRODUCTION_CHART} className="h-56 w-full">
                <AreaChart data={trends.data.series} margin={{ left: 4, right: 8, top: 4 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis width={28} tickLine={false} axisLine={false} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Area
                    dataKey="published"
                    type="monotone"
                    stackId="a"
                    stroke="var(--color-published)"
                    fill="var(--color-published)"
                    fillOpacity={0.25}
                  />
                  <Area
                    dataKey="articles"
                    type="monotone"
                    stackId="b"
                    stroke="var(--color-articles)"
                    fill="var(--color-articles)"
                    fillOpacity={0.25}
                  />
                  <Area
                    dataKey="failed"
                    type="monotone"
                    stackId="c"
                    stroke="var(--color-failed)"
                    fill="var(--color-failed)"
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="text-base">
                품질 점수 추이 (자동발행 기준 {data.minQualityScore ?? 85}점)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={QUALITY_CHART} className="h-48 w-full">
                <LineChart data={trends.data.series} margin={{ left: 4, right: 8, top: 4 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis width={32} domain={[70, 100]} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    dataKey="quality"
                    type="monotone"
                    stroke="var(--color-quality)"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="text-base">일별 AI 비용 (원)</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={COST_CHART} className="h-48 w-full">
                <BarChart data={trends.data.series} margin={{ left: 4, right: 8, top: 4 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis width={44} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="costKrw" fill="var(--color-costKrw)" radius={4} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {selfLearning.data && (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base">
              🎯 자가학습 {selfLearning.data.learned ? "" : "(관측 중)"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selfLearning.data.learned ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={selfLearning.data.learned.confidence === "적용" ? "default" : "outline"}
                  >
                    신뢰도 {selfLearning.data.learned.confidence}
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    내 글 {selfLearning.data.learned.sampleSize}건 측정 —{" "}
                    {selfLearning.data.learned.confidence === "참고"
                      ? "표본이 작아 힌트로만 씁니다 (20건부터 권장, 50건부터 자동 적용)"
                      : selfLearning.data.learned.confidence === "권장"
                        ? "글 생성에 반영하되 맥락이 우선합니다 (50건부터 자동 적용)"
                        : "글 생성에 그대로 적용됩니다"}
                  </p>
                </div>
                {selfLearning.data.learned.rules.map((rule) => (
                  <p key={rule} className="text-sm">
                    · {rule}
                  </p>
                ))}
              </div>
            ) : (
              // 표본이 없는데 규칙을 지어내면 '배운 척'하는 시스템이 된다 — 진행 상황만 정직하게 보여준다
              <div className="space-y-2">
                <p className="text-sm">
                  발행 {selfLearning.data.published}건 · 성과 신호가 붙은 글{" "}
                  <span className="font-mono font-semibold">{selfLearning.data.withSignal}</span>/
                  {selfLearning.data.minSample}건
                </p>
                <p className="text-xs text-muted-foreground">
                  Search Console 노출·클릭 또는 네이버 AI 인용이 잡히면 학습이 자동으로 시작됩니다.
                  표본이 모자란 상태에서 배우면 우연을 법칙으로 착각합니다.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {perf.data && (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base">검색 성과 (최근 {perf.data.days}일 · Search Console)</CardTitle>
          </CardHeader>
          <CardContent>
            {!perf.data.collected ? (
              // 0을 그럴듯하게 보여주지 않는다 — 아직 안 들어온 것과 성과가 없는 것은 다르다
              <p className="py-6 text-center text-sm text-muted-foreground">
                아직 수집된 성과 데이터가 없습니다. Search Console은 데이터가 2~3일 늦게 들어옵니다.
              </p>
            ) : (
              <div className="space-y-2">
                {perf.data.articles.slice(0, 10).map((row, index) => (
                  <Link
                    key={row.articleId}
                    to={`/articles/${row.articleId}`}
                    className="-mx-2 flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent"
                  >
                    <span className="w-4 shrink-0 text-xs text-muted-foreground">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{row.title}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      노출 {row.impressions.toLocaleString("ko-KR")}
                    </span>
                    <Badge variant="outline" className="shrink-0 font-mono">
                      클릭 {row.clicks.toLocaleString("ko-KR")}
                    </Badge>
                    <Badge variant="secondary" className="hidden shrink-0 font-mono sm:inline-flex">
                      {row.avgPosition ? `${row.avgPosition.toFixed(1)}위` : "—"}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {data.usage && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
            <div>
              <p className="text-xs text-muted-foreground">이번 달 AI 예상 비용</p>
              <p className="text-2xl font-bold">
                ₩{new Intl.NumberFormat("ko-KR").format(data.usage.monthlyCostKrw)}
              </p>
            </div>
            <div className="flex gap-6 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Claude (글)</p>
                <p className="font-medium">
                  ₩{new Intl.NumberFormat("ko-KR").format(data.usage.claudeCostKrw)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Gemini (이미지 {data.usage.geminiImages}장)</p>
                <p className="font-medium">
                  ₩{new Intl.NumberFormat("ko-KR").format(data.usage.geminiCostKrw)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
                  <li key={article.id}>
                    <Link
                      to={`/articles/${article.id}`}
                      className="flex items-center justify-between gap-3 rounded-md -mx-2 px-2 py-1 hover:bg-accent"
                    >
                      <span className="truncate text-sm hover:underline">{article.title}</span>
                      <Badge variant="secondary">
                        {STATUS_LABEL[article.status] ?? article.status}
                      </Badge>
                    </Link>
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
                {data.recentJobs.map((job) => {
                  const inner = (
                    <>
                      <span className="flex min-w-0 items-center gap-1 truncate text-sm">
                        [{job.platform}] {job.article.title}
                        {job.publishedUrl && <ExternalLink className="size-3 shrink-0 opacity-60" />}
                      </span>
                      <Badge variant={job.status === "FAILED" ? "destructive" : "secondary"}>
                        {STATUS_LABEL[job.status] ?? job.status}
                      </Badge>
                    </>
                  );
                  const cls =
                    "flex items-center justify-between gap-3 rounded-md -mx-2 px-2 py-1 hover:bg-accent";
                  return (
                    <li key={job.id}>
                      {job.publishedUrl ? (
                        <a href={job.publishedUrl} target="_blank" rel="noreferrer" className={cls}>
                          {inner}
                        </a>
                      ) : (
                        <Link to={`/articles/${job.article.id}`} className={cls}>
                          {inner}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TodoCard({ label, value, to, hint }: { label: string; value: number; to: string; hint: string }) {
  const done = value === 0;
  return (
    <Link
      to={to}
      className={`rounded-lg border p-3 transition-colors hover:bg-accent ${done ? "opacity-50" : "border-primary/50"}`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-2xl font-bold ${done ? "" : "text-primary"}`}>
        {done ? "✓" : value}
      </p>
      <p className="text-[11px] text-muted-foreground">{done ? "완료" : hint}</p>
    </Link>
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
