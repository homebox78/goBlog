import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { TrendingUp, TrendingDown, Eye, Users, Mail, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

interface Metric {
  views: number;
  uniques: number;
  prev: number | null;
}
interface Overview {
  today: Metric;
  month: Metric;
  year: Metric;
  all: Metric;
  subscribers: { active: number; total: number };
}
interface Series {
  series: { key: string; views: number; uniques: number }[];
}
interface ArticleStat {
  articleId: number;
  title: string;
  category: string | null;
  views: number;
  uniques: number;
  lastViewedAt: string | null;
}

type Gran = "day" | "month" | "year";
type Period = "all" | "today" | "month" | "year";

const chartConfig: ChartConfig = {
  views: { label: "조회수", color: "var(--chart-1)" },
  uniques: { label: "순방문", color: "var(--chart-2)" },
};

function delta(cur: number, prev: number | null): number | null {
  if (prev == null) return null;
  if (prev === 0) return cur > 0 ? 100 : 0;
  return ((cur - prev) / prev) * 100;
}

export default function StatsPage() {
  const [gran, setGran] = useState<Gran>("day");
  const [period, setPeriod] = useState<Period>("all");
  const [sort, setSort] = useState<"views" | "uniques">("views");

  const overview = useQuery({ queryKey: ["stats-overview"], queryFn: () => api.get<Overview>("/api/stats/overview") });
  const series = useQuery({
    queryKey: ["stats-series", gran],
    queryFn: () => api.get<Series>(`/api/stats/timeseries?granularity=${gran}&n=${gran === "day" ? 30 : 12}`),
  });
  const articles = useQuery({
    queryKey: ["stats-articles", period, sort],
    queryFn: () => api.get<{ articles: ArticleStat[] }>(`/api/stats/articles?period=${period}&sort=${sort}&limit=50`),
  });

  const o = overview.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">통계</h1>
        <p className="text-sm text-muted-foreground">기사 조회수 · 순 방문(IP) · 구독자 — KST 기준</p>
      </div>

      {/* 섹션 카드 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="오늘 조회수" icon={Eye} m={o?.today} loading={overview.isPending} />
        <MetricCard label="이번 달 조회수" icon={Eye} m={o?.month} loading={overview.isPending} />
        <MetricCard label="올해 조회수" icon={Eye} m={o?.year} loading={overview.isPending} />
        <SubscriberCard subs={o?.subscribers} loading={overview.isPending} />
      </div>

      {/* 인터랙티브 영역 차트 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>조회수 추이</CardTitle>
            <CardDescription>
              {gran === "day" ? "최근 30일" : gran === "month" ? "최근 12개월" : "연도별"} 조회수·순방문
            </CardDescription>
          </div>
          <Tabs value={gran} onValueChange={(v) => setGran(v as Gran)}>
            <TabsList>
              <TabsTrigger value="day">일</TabsTrigger>
              <TabsTrigger value="month">월</TabsTrigger>
              <TabsTrigger value="year">년</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {series.isPending ? (
            <Skeleton className="h-64 w-full" />
          ) : (series.data?.series ?? []).length === 0 ? (
            <p className="py-20 text-center text-sm text-muted-foreground">아직 조회 데이터가 없습니다.</p>
          ) : (
            <ChartContainer config={chartConfig} className="h-64 w-full">
              <AreaChart data={series.data!.series} margin={{ left: 4, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="fillViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-views)" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="var(--color-views)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="fillUniques" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-uniques)" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="var(--color-uniques)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="key"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                  tickFormatter={(v: string) => (gran === "day" ? v.slice(5) : v)}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  dataKey="uniques"
                  type="monotone"
                  fill="url(#fillUniques)"
                  stroke="var(--color-uniques)"
                  stackId="a"
                />
                <Area dataKey="views" type="monotone" fill="url(#fillViews)" stroke="var(--color-views)" stackId="b" />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* 기사별 조회수 */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <CardTitle>기사별 조회수</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <TabsList>
                <TabsTrigger value="all">누적</TabsTrigger>
                <TabsTrigger value="today">오늘</TabsTrigger>
                <TabsTrigger value="month">이달</TabsTrigger>
                <TabsTrigger value="year">올해</TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs value={sort} onValueChange={(v) => setSort(v as "views" | "uniques")}>
              <TabsList>
                <TabsTrigger value="views">조회순</TabsTrigger>
                <TabsTrigger value="uniques">순방문순</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {articles.isPending ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : (articles.data?.articles ?? []).length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">조회 기록이 없습니다.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>기사</TableHead>
                  <TableHead className="text-right">조회</TableHead>
                  <TableHead className="text-right">순방문</TableHead>
                  <TableHead className="text-right">최근</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {articles.data!.articles.map((a, i) => (
                  <TableRow key={a.articleId}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      <a
                        href={`https://hom2box.com/article.php?id=${a.articleId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-medium hover:underline"
                      >
                        <span className="line-clamp-1 max-w-md">{a.title}</span>
                        <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                      </a>
                      {a.category && (
                        <Badge variant="secondary" className="ml-2 align-middle text-[10px]">
                          {a.category}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{a.views.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {a.uniques.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {a.lastViewedAt
                        ? new Date(a.lastViewedAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  label,
  icon: Icon,
  m,
  loading,
}: {
  label: string;
  icon: typeof Eye;
  m?: Metric;
  loading: boolean;
}) {
  const d = m ? delta(m.views, m.prev) : null;
  const up = (d ?? 0) >= 0;
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5">
          <Icon className="size-4" /> {label}
        </CardDescription>
        <CardTitle className="text-3xl font-bold tabular-nums">
          {loading ? <Skeleton className="h-8 w-24" /> : (m?.views ?? 0).toLocaleString()}
        </CardTitle>
        {d != null && !loading && (
          <CardAction>
            <Badge variant="outline" className={up ? "text-emerald-600" : "text-red-600"}>
              {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {up ? "+" : ""}
              {d.toFixed(0)}%
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardFooter className="text-xs text-muted-foreground">
        순방문(IP) {(m?.uniques ?? 0).toLocaleString()} · 직전 대비
      </CardFooter>
    </Card>
  );
}

function SubscriberCard({ subs, loading }: { subs?: { active: number; total: number }; loading: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5">
          <Mail className="size-4" /> 뉴스레터 구독자
        </CardDescription>
        <CardTitle className="text-3xl font-bold tabular-nums text-emerald-600">
          {loading ? <Skeleton className="h-8 w-16" /> : (subs?.active ?? 0).toLocaleString()}
        </CardTitle>
        <CardAction>
          <Badge variant="outline">
            <Users className="size-3" /> 전체 {(subs?.total ?? 0).toLocaleString()}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardFooter className="text-xs text-muted-foreground">현재 구독중 인원</CardFooter>
    </Card>
  );
}
