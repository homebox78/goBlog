import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Eye,
  Users,
  Mail,
  ExternalLink,
  LayoutGrid,
  Calculator,
  FileText,
  MapPin,
  Globe,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
interface PageStat {
  total: { views: number; uniques: number };
  pages: { type: string; views: number; uniques: number }[];
}
interface PopItem {
  key: string;
  title: string;
  views: number;
  uniques: number;
  lastViewedAt: string | null;
}
interface GeoStat {
  byCountry: { country: string; views: number; uniques: number }[];
  byRegion: { region: string; country: string; views: number; uniques: number }[];
  pendingGeo: number;
}
interface Visitor {
  ip: string;
  type: string;
  key: string | null;
  title: string | null;
  referer: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  isp: string | null;
  viewedAt: string | null;
}

type Gran = "day" | "month" | "year";
type Period = "all" | "today" | "month" | "year";
type PPeriod = "today" | "month" | "year";

const PAGE_LABEL: Record<string, string> = {
  home: "홈",
  article: "기사",
  tool: "계산기",
  tools: "계산기 목록",
  doc: "문서(개별)",
  docs: "문서 목록",
  category: "카테고리",
  press: "언론사",
  opinion: "오피니언",
  welfare: "지원금",
  jobs: "노인일자리",
  stocks: "종목",
  stock: "종목 상세",
  rank: "랭킹",
  search: "검색",
  shop: "쇼핑",
  subscribe: "구독",
  about: "소개",
  contact: "문의",
  privacy: "개인정보",
};
const pageLabel = (t: string) => PAGE_LABEL[t] ?? t;

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
  const [pp, setPp] = useState<PPeriod>("month");

  const overview = useQuery({ queryKey: ["stats-overview"], queryFn: () => api.get<Overview>("/api/stats/overview") });
  const series = useQuery({
    queryKey: ["stats-series", gran],
    queryFn: () => api.get<Series>(`/api/stats/timeseries?granularity=${gran}&n=${gran === "day" ? 30 : 12}`),
  });
  const articles = useQuery({
    queryKey: ["stats-articles", period, sort],
    queryFn: () => api.get<{ articles: ArticleStat[] }>(`/api/stats/articles?period=${period}&sort=${sort}&limit=50`),
  });
  const pages = useQuery({
    queryKey: ["stats-pages", pp],
    queryFn: () => api.get<PageStat>(`/api/stats/pages?period=${pp}`),
  });
  const tools = useQuery({
    queryKey: ["stats-tools", pp],
    queryFn: () => api.get<{ items: PopItem[] }>(`/api/stats/tools?period=${pp}&limit=50`),
  });
  const docs = useQuery({
    queryKey: ["stats-docs", pp],
    queryFn: () => api.get<{ items: PopItem[] }>(`/api/stats/docs?period=${pp}&limit=50`),
  });
  const geo = useQuery({
    queryKey: ["stats-geo", pp],
    queryFn: () => api.get<GeoStat>(`/api/stats/geo?period=${pp}`),
  });
  const visitors = useQuery({
    queryKey: ["stats-visitors"],
    queryFn: () => api.get<{ visitors: Visitor[] }>(`/api/stats/visitors?limit=120`),
  });

  const [resolving, setResolving] = useState(false);
  const resolveGeo = async () => {
    setResolving(true);
    try {
      await api.post("/api/stats/geo/resolve", { limit: 120 });
      await Promise.all([geo.refetch(), visitors.refetch()]);
    } finally {
      setResolving(false);
    }
  };

  const o = overview.data;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">통계</h1>
        <p className="text-sm text-muted-foreground">방문 조회수 · 순방문(IP) · 메뉴/계산기/문서/지역 — KST 기준</p>
      </div>

      {/* 상단 요약 타일 (항상 표시) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="오늘 조회수" icon={Eye} m={o?.today} loading={overview.isPending} />
        <MetricCard label="이번 달 조회수" icon={Eye} m={o?.month} loading={overview.isPending} />
        <MetricCard label="올해 조회수" icon={Eye} m={o?.year} loading={overview.isPending} />
        <SubscriberCard subs={o?.subscribers} loading={overview.isPending} />
      </div>

      <Tabs defaultValue="trend">
        <TabsList>
          <TabsTrigger value="trend">추이</TabsTrigger>
          <TabsTrigger value="articles">기사</TabsTrigger>
          <TabsTrigger value="pages">메뉴·도구</TabsTrigger>
          <TabsTrigger value="geo">지역·방문자</TabsTrigger>
        </TabsList>

        {/* ── 추이 ── */}
        <TabsContent value="trend" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">
                조회수 추이{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  {gran === "day" ? "최근 30일" : gran === "month" ? "최근 12개월" : "연도별"}
                </span>
              </CardTitle>
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
                    <Area dataKey="uniques" type="monotone" fill="url(#fillUniques)" stroke="var(--color-uniques)" stackId="a" />
                    <Area dataKey="views" type="monotone" fill="url(#fillViews)" stroke="var(--color-views)" stackId="b" />
                  </AreaChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 기사별 조회수 ── */}
        <TabsContent value="articles" className="mt-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 pb-2">
              <CardTitle className="text-base">기사별 조회수</CardTitle>
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
                <div className="max-h-[560px] overflow-y-auto">
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
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 메뉴·계산기·문서 ── */}
        <TabsContent value="pages" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              전체 <b className="text-foreground">{(pages.data?.total.views ?? 0).toLocaleString()}</b> 조회 · 순방문{" "}
              {(pages.data?.total.uniques ?? 0).toLocaleString()}
            </p>
            <PPtabs pp={pp} setPp={setPp} />
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {/* 메뉴별 */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <LayoutGrid className="size-4" /> 메뉴별
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pages.isPending ? (
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-7 w-full" />
                    ))}
                  </div>
                ) : (pages.data?.pages ?? []).length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">데이터 없음</p>
                ) : (
                  <div className="space-y-1.5">
                    {pages.data!.pages.map((p) => {
                      const max = pages.data!.pages[0]?.views || 1;
                      return (
                        <div key={p.type} className="flex items-center gap-2">
                          <span className="w-16 shrink-0 truncate text-[13px] font-medium">{pageLabel(p.type)}</span>
                          <div className="relative h-5 flex-1 overflow-hidden rounded bg-muted">
                            <div className="h-full rounded bg-primary/70" style={{ width: `${Math.max(3, (p.views / max) * 100)}%` }} />
                          </div>
                          <span className="w-12 shrink-0 text-right text-[13px] font-semibold tabular-nums">
                            {p.views.toLocaleString()}
                          </span>
                          <span className="hidden w-10 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground sm:inline">
                            {p.uniques.toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <PopularityCard title="인기 계산기" icon={Calculator} q={tools} baseUrl="/tool.php?id=" />
            <PopularityCard title="인기 문서" icon={FileText} q={docs} baseUrl="/docs.php?doc=" />
          </div>
        </TabsContent>

        {/* ── 지역·방문자 ── */}
        <TabsContent value="geo" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              방문 IP → 국가·시/도 (미확인 {geo.data?.pendingGeo ?? 0}건)
            </p>
            <div className="flex items-center gap-2">
              <PPtabs pp={pp} setPp={setPp} />
              <Button size="sm" variant="outline" onClick={resolveGeo} disabled={resolving}>
                {resolving ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                지금 변환
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {/* 지역 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="size-4" /> 지역별 방문
                </CardTitle>
              </CardHeader>
              <CardContent>
                {geo.isPending ? (
                  <Skeleton className="h-40 w-full" />
                ) : (
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                        <Globe className="size-3.5" /> 국가
                      </div>
                      <GeoList rows={(geo.data?.byCountry ?? []).map((r) => ({ label: r.country, views: r.views, uniques: r.uniques }))} />
                    </div>
                    <div>
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                        <MapPin className="size-3.5" /> 시·도
                      </div>
                      <GeoList
                        rows={(geo.data?.byRegion ?? []).map((r) => ({
                          label: r.region,
                          sub: r.country && !/korea|대한민국|내부/i.test(r.country) ? r.country : undefined,
                          views: r.views,
                          uniques: r.uniques,
                        }))}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 최근 방문자 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="size-4" /> 최근 방문자
                </CardTitle>
              </CardHeader>
              <CardContent>
                {visitors.isPending ? (
                  <div className="space-y-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                ) : (visitors.data?.visitors ?? []).length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">방문 기록이 없습니다.</p>
                ) : (
                  <div className="max-h-[420px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>IP</TableHead>
                          <TableHead>지역</TableHead>
                          <TableHead>페이지</TableHead>
                          <TableHead className="text-right">시각</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visitors.data!.visitors.map((v, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">{v.ip || "-"}</TableCell>
                            <TableCell className="text-xs">
                              {v.region || v.country ? (
                                <span>
                                  {[v.country && v.country !== v.region ? v.country : null, v.region, v.city]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">미확인</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="secondary" className="mr-1 text-[10px]">
                                {pageLabel(v.type)}
                              </Badge>
                              <span className="text-muted-foreground">{v.title || v.key || ""}</span>
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">
                              {v.viewedAt
                                ? new Date(v.viewedAt).toLocaleString("ko-KR", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// 기간 선택 (오늘/이달/올해) — 메뉴·도구, 지역 탭 공용
function PPtabs({ pp, setPp }: { pp: PPeriod; setPp: (v: PPeriod) => void }) {
  return (
    <Tabs value={pp} onValueChange={(v) => setPp(v as PPeriod)}>
      <TabsList>
        <TabsTrigger value="today">오늘</TabsTrigger>
        <TabsTrigger value="month">이달</TabsTrigger>
        <TabsTrigger value="year">올해</TabsTrigger>
      </TabsList>
    </Tabs>
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
    <Card className="gap-0 py-0">
      <CardContent className="p-3.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="size-3.5" /> {label}
        </div>
        <div className="mt-1 flex items-end gap-2">
          <span className="text-2xl font-bold tabular-nums">
            {loading ? <Skeleton className="h-7 w-16" /> : (m?.views ?? 0).toLocaleString()}
          </span>
          {d != null && !loading && (
            <Badge variant="outline" className={`gap-0.5 px-1 py-0 text-[10px] ${up ? "text-emerald-600" : "text-red-600"}`}>
              {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {up ? "+" : ""}
              {d.toFixed(0)}%
            </Badge>
          )}
        </div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">순방문 {(m?.uniques ?? 0).toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}

function SubscriberCard({ subs, loading }: { subs?: { active: number; total: number }; loading: boolean }) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="p-3.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Mail className="size-3.5" /> 뉴스레터 구독자
        </div>
        <div className="mt-1 flex items-end gap-2">
          <span className="text-2xl font-bold tabular-nums text-emerald-600">
            {loading ? <Skeleton className="h-7 w-12" /> : (subs?.active ?? 0).toLocaleString()}
          </span>
          <Badge variant="outline" className="gap-0.5 px-1 py-0 text-[10px]">
            <Users className="size-3" /> 전체 {(subs?.total ?? 0).toLocaleString()}
          </Badge>
        </div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">현재 구독중 인원</div>
      </CardContent>
    </Card>
  );
}

function PopularityCard({
  title,
  icon: Icon,
  q,
  baseUrl,
}: {
  title: string;
  icon: typeof Eye;
  q: { isPending: boolean; data?: { items: PopItem[] } };
  baseUrl: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {q.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-full" />
            ))}
          </div>
        ) : (q.data?.items ?? []).length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">방문 기록이 없습니다.</p>
        ) : (
          <div className="max-h-[420px] space-y-0.5 overflow-y-auto">
            {q.data!.items.map((it, i) => (
              <a
                key={it.key}
                href={`https://hom2box.com${baseUrl}${encodeURIComponent(it.key)}`}
                target="_blank"
                rel="noreferrer"
                className="-mx-1 flex items-center gap-2 rounded px-1 py-1 hover:bg-accent"
              >
                <span className="w-4 shrink-0 text-center text-xs text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{it.title}</span>
                <span className="shrink-0 text-[13px] font-semibold tabular-nums">{it.views.toLocaleString()}</span>
                <span className="hidden shrink-0 text-[11px] tabular-nums text-muted-foreground sm:inline">
                  {it.uniques.toLocaleString()}
                </span>
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GeoList({ rows }: { rows: { label: string; sub?: string; views: number; uniques: number }[] }) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">데이터 없음</p>;
  const max = rows[0]?.views || 1;
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-14 shrink-0 truncate text-[13px]">
            {r.label}
            {r.sub && <span className="ml-1 text-[10px] text-muted-foreground">{r.sub}</span>}
          </span>
          <div className="relative h-4 flex-1 overflow-hidden rounded bg-muted">
            <div className="h-full rounded bg-primary/60" style={{ width: `${Math.max(3, (r.views / max) * 100)}%` }} />
          </div>
          <span className="w-10 shrink-0 text-right text-[13px] font-semibold tabular-nums">{r.uniques.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
