import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Loader2, RefreshCw, Search, Star, Trash2, TrendingUp, Quote, Sparkles, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

interface KeywordItem {
  id: number;
  rank: number;
  keyword: string;
  category: string | null;
  type: string | null;
  status: string;
  scores: { revenue: number | null; value: number | null; opportunity: number | null; final: number | null };
  competitionScore: number | null;
  totalDocs: number | null;
  metrics: { naverMonthlySearches: number | null; googleMonthlySearches: number | null };
}
interface CitationItem {
  keyword: string;
  citedCount: number | null;
}
type Group = "추천" | "저장" | "트렌드" | "인용";
const GROUP_STYLE: Record<Group, string> = {
  추천: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  저장: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  트렌드: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  인용: "bg-cyan-100 text-cyan-700 hover:bg-cyan-100",
};

interface Kw {
  key: string;
  id: number | null;
  status: string | null;
  category: string | null;
  groups: Set<Group>;
  naver: number | null;
  google: number | null;
  final: number | null;
  cited: number | null;
}

type SortKey = "naver" | "final" | "cited";

export default function KeywordDashboardPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [filter, setFilter] = useState<"전체" | Group>("전체");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("naver");
  const [openId, setOpenId] = useState<number | null>(null);
  const [openKw, setOpenKw] = useState<Kw | null>(null);

  const today = useQuery({ queryKey: ["kd-today"], queryFn: () => api.get<{ items: KeywordItem[]; date?: string }>("/api/keywords/today") });
  const saved = useQuery({ queryKey: ["kd-saved"], queryFn: () => api.get<{ items: KeywordItem[] }>("/api/keywords/saved") });
  const trends = useQuery({
    queryKey: ["kd-trends", now.getFullYear(), now.getMonth() + 1],
    queryFn: () =>
      api.get<{ items: Array<{ keywordText: string; date: string; rank: number | null }> }>(
        `/api/keywords/trends?year=${now.getFullYear()}&month=${now.getMonth() + 1}`,
      ),
  });
  const cites = useQuery({ queryKey: ["kd-cites"], queryFn: () => api.get<{ items: CitationItem[] }>("/api/keywords/citations") });

  const loading = today.isPending || saved.isPending || trends.isPending || cites.isPending;

  const rows = useMemo<Kw[]>(() => {
    const map = new Map<string, Kw>();
    const ensure = (label: string): Kw => {
      const key = label.trim();
      let k = map.get(key);
      if (!k) {
        k = { key, id: null, status: null, category: null, groups: new Set(), naver: null, google: null, final: null, cited: null };
        map.set(key, k);
      }
      return k;
    };
    const addKw = (it: KeywordItem, g: Group) => {
      if (!it.keyword) return;
      const k = ensure(it.keyword);
      k.groups.add(g);
      k.id = it.id;
      k.status = it.status;
      k.category = it.category ?? k.category;
      k.naver = it.metrics?.naverMonthlySearches ?? k.naver;
      k.google = it.metrics?.googleMonthlySearches ?? k.google;
      k.final = it.scores?.final ?? k.final;
    };
    (today.data?.items ?? []).forEach((it) => addKw(it, "추천"));
    (saved.data?.items ?? []).filter((it) => it.status === "SAVED").forEach((it) => addKw(it, "저장"));
    const seen = new Map<string, number>();
    (trends.data?.items ?? []).forEach((t) => seen.set(t.keywordText, (seen.get(t.keywordText) ?? 0) + 1));
    seen.forEach((days, kw) => {
      if (days >= 2) ensure(kw).groups.add("트렌드");
    });
    (cites.data?.items ?? []).forEach((c) => {
      if (!c.keyword) return;
      const k = ensure(c.keyword);
      k.groups.add("인용");
      k.cited = (k.cited ?? 0) + (c.citedCount ?? 0);
    });
    return [...map.values()].filter((k) => k.groups.size > 0);
  }, [today.data, saved.data, trends.data, cites.data]);

  const counts = useMemo(() => {
    const c: Record<Group, number> = { 추천: 0, 저장: 0, 트렌드: 0, 인용: 0 };
    rows.forEach((k) => k.groups.forEach((g) => c[g]++));
    return c;
  }, [rows]);

  const view = useMemo(() => {
    let arr = rows;
    if (filter !== "전체") arr = arr.filter((k) => k.groups.has(filter));
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      arr = arr.filter((k) => k.key.toLowerCase().includes(t) || (k.category ?? "").toLowerCase().includes(t));
    }
    return [...arr].sort((a, b) => (b[sort] ?? -1) - (a[sort] ?? -1));
  }, [rows, filter, q, sort]);

  const status = useMutation({
    mutationFn: (v: { id: number; status: string }) => api.patch(`/api/keywords/${v.id}/status`, { status: v.status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kd-today"] });
      qc.invalidateQueries({ queryKey: ["kd-saved"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "실패"),
  });
  const discover = useMutation({
    mutationFn: () => api.post("/api/keywords/discover", {}),
    onSuccess: () => {
      toast.success("키워드를 새로 발굴했습니다.");
      qc.invalidateQueries({ queryKey: ["kd-today"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "실패"),
  });

  const open = (k: Kw) => {
    setOpenKw(k);
    setOpenId(k.id);
  };
  // 행에 마우스만 올려도 상세를 미리 받아둔다 → 클릭 시 모달이 즉시 채워짐
  const prefetch = (k: Kw) => {
    if (k.id == null) return;
    qc.prefetchQuery({
      queryKey: ["kd-detail", k.id],
      queryFn: () => api.get(`/api/keywords/${k.id}/detail`),
      staleTime: 60_000,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">키워드 대시보드</h1>
          <p className="text-sm text-muted-foreground">
            오늘의 추천·저장·트렌드·AI 인용을 한 화면에서 — 클릭하면 지표·추이·인용을 모달로 봅니다.
            {today.data?.date ? ` (${today.data.date})` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/keywords/list">
            <Button variant="ghost" size="sm">표로 보기</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => discover.mutate()} disabled={discover.isPending}>
            {discover.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            키워드 발굴
          </Button>
        </div>
      </div>

      {/* 개요 카드 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(["추천", "저장", "트렌드", "인용"] as Group[]).map((g) => (
          <Card key={g} className="cursor-pointer transition-colors hover:border-primary" onClick={() => setFilter(g)}>
            <CardHeader>
              <CardDescription>{g === "추천" ? "오늘의 추천" : g === "인용" ? "AI 인용" : g}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{counts[g].toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* 툴바 */}
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as "전체" | Group)}>
          <TabsList>
            <TabsTrigger value="전체">전체</TabsTrigger>
            <TabsTrigger value="추천">추천</TabsTrigger>
            <TabsTrigger value="저장">저장</TabsTrigger>
            <TabsTrigger value="트렌드">트렌드</TabsTrigger>
            <TabsTrigger value="인용">인용</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="키워드 검색" className="h-9 w-52 pl-8" />
        </div>
        <Tabs value={sort} onValueChange={(v) => setSort(v as SortKey)} className="ml-auto">
          <TabsList>
            <TabsTrigger value="naver">검색량순</TabsTrigger>
            <TabsTrigger value="final">점수순</TabsTrigger>
            <TabsTrigger value="cited">인용순</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card>
        <CardContent className="px-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : view.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">키워드가 없습니다. ‘키워드 발굴’을 눌러보세요.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>키워드</TableHead>
                  <TableHead>출처</TableHead>
                  <TableHead className="text-right">네이버 검색량</TableHead>
                  <TableHead className="text-right">점수</TableHead>
                  <TableHead className="text-right">인용</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {view.map((k) => (
                  <TableRow key={k.key} className="cursor-pointer" onClick={() => open(k)} onMouseEnter={() => prefetch(k)}>
                    <TableCell>
                      <div className="font-medium">{k.key}</div>
                      {k.category && <div className="text-xs text-muted-foreground">{k.category}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {[...k.groups].map((g) => (
                          <Badge key={g} className={GROUP_STYLE[g]}>
                            {g}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{k.naver?.toLocaleString() ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{k.final != null ? k.final : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {k.cited?.toLocaleString() ?? "—"}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {k.id != null && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title={k.status === "SAVED" ? "저장 해제" : "저장"}
                          onClick={() => status.mutate({ id: k.id!, status: k.status === "SAVED" ? "RECOMMENDED" : "SAVED" })}
                        >
                          <Star className={"size-4 " + (k.status === "SAVED" ? "fill-current text-amber-500" : "text-muted-foreground")} />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <DetailModal
        kw={openKw}
        id={openId}
        onClose={() => {
          setOpenKw(null);
          setOpenId(null);
        }}
        onStatus={(id, s) => status.mutate({ id, status: s })}
      />
    </div>
  );
}

// ── 상세 모달 (지표 + 추이차트 + 인용 + 액션) ────────────────────
interface KeywordDetail {
  keyword: { id: number; text: string; status: string; category: string | null; reason: string | null };
  metrics: {
    naverMonthlySearches: number | null;
    googleMonthlySearches: number | null;
    googleCpcKrw: number | null;
    totalDocs: number | null;
    competitionScore: number | null;
  } | null;
  trend: { summary: string; daysSeen: number; momentum: number } | null;
  trends: Array<{ at: string; rank: number | null; searchVolume: number | null; finalScore: number | null }>;
  citations: Array<{ rank: number; title: string; url: string; blogName: string | null; citedLabel: string | null }>;
}

const chartConfig: ChartConfig = { rank: { label: "순위", color: "var(--chart-1)" } };

function DetailModal({
  kw,
  id,
  onClose,
  onStatus,
}: {
  kw: Kw | null;
  id: number | null;
  onClose: () => void;
  onStatus: (id: number, status: string) => void;
}) {
  const detail = useQuery({
    queryKey: ["kd-detail", id],
    queryFn: () => api.get<KeywordDetail>(`/api/keywords/${id}/detail`),
    enabled: id != null,
    staleTime: 60_000,
  });

  const d = detail.data;
  const series = (d?.trends ?? [])
    .filter((t) => t.rank != null)
    .map((t) => ({ at: t.at.slice(5, 10), rank: t.rank as number }))
    .reverse();

  const status = d?.keyword.status ?? kw?.status ?? null;

  return (
    <Dialog open={kw != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="pr-8 text-lg">{kw?.key}</DialogTitle>
          <div className="flex flex-wrap items-center gap-1.5">
            {kw && [...kw.groups].map((g) => <Badge key={g} className={GROUP_STYLE[g]}>{g}</Badge>)}
            {(d?.keyword.category ?? kw?.category) && (
              <span className="text-xs text-muted-foreground">{d?.keyword.category ?? kw?.category}</span>
            )}
          </div>
        </DialogHeader>

        {id == null ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            이 키워드는 인용/트렌드 기록에서 왔습니다. 추천·저장 목록의 키워드만 상세 지표가 제공됩니다.
          </p>
        ) : (
          <div className="space-y-5">
            {/* 지표 — 목록에서 가진 값으로 즉시 표시, 상세 로드되면 보강 */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Metric label="네이버 검색량" value={d?.metrics?.naverMonthlySearches ?? kw?.naver} />
              <Metric label="구글 검색량" value={d?.metrics?.googleMonthlySearches ?? kw?.google} />
              <Metric label="점수" value={kw?.final ?? null} />
              <Metric label="AI 인용" value={kw?.cited ?? null} suffix="회" />
              <Metric label="문서 수" value={d?.metrics?.totalDocs} loading={detail.isPending} />
              <Metric label="경쟁도" value={d?.metrics?.competitionScore} loading={detail.isPending} />
            </div>

            {/* 추이 차트 — 상세 대기 부분만 로딩 */}
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <TrendingUp className="size-4" /> 순위 추이
                {d?.trend?.summary ? <span className="text-xs font-normal text-muted-foreground">· {d.trend.summary}</span> : null}
              </div>
              {detail.isPending ? (
                <Skeleton className="h-40 w-full" />
              ) : series.length >= 2 ? (
                <ChartContainer config={chartConfig} className="h-40 w-full">
                  <LineChart data={series} margin={{ left: 4, right: 8, top: 6 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="at" tickLine={false} axisLine={false} tickMargin={8} minTickGap={20} />
                    <YAxis reversed tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line dataKey="rank" type="monotone" stroke="var(--color-rank)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ChartContainer>
              ) : (
                <p className="rounded-md border bg-muted/40 py-6 text-center text-xs text-muted-foreground">
                  추이 데이터가 아직 충분하지 않습니다.
                </p>
              )}
            </div>

            {/* AI 인용 — 상세 대기 부분만 로딩 */}
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <Quote className="size-4" /> AI·검색 인용 {d?.citations?.length ? `(${d.citations.length})` : ""}
              </div>
              {detail.isPending ? (
                <Skeleton className="h-24 w-full" />
              ) : d?.citations && d.citations.length > 0 ? (
                <div className="max-h-52 space-y-1.5 overflow-y-auto">
                  {d.citations.slice(0, 20).map((c, i) => (
                    <a
                      key={i}
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 font-medium">{c.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {c.blogName ?? "블로그"} {c.citedLabel ? `· ${c.citedLabel}` : ""}
                        </span>
                      </span>
                      <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="rounded-md border bg-muted/40 py-6 text-center text-xs text-muted-foreground">
                  인용 기록이 없습니다.
                </p>
              )}
            </div>

            {/* 액션 — 즉시 */}
            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button
                variant={status === "SAVED" ? "secondary" : "default"}
                size="sm"
                onClick={() => onStatus(id, status === "SAVED" ? "RECOMMENDED" : "SAVED")}
              >
                <Star className={"size-4 " + (status === "SAVED" ? "fill-current text-amber-500" : "")} />
                {status === "SAVED" ? "저장 해제" : "저장"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-600"
                onClick={() => {
                  if (confirm(`'${kw?.key}' 키워드를 제외할까요?`)) {
                    onStatus(id, "EXCLUDED");
                    onClose();
                  }
                }}
              >
                <Trash2 className="size-4" /> 제외
              </Button>
              <Link to={`/keywords/${id}`} className="ml-auto">
                <Button variant="outline" size="sm">
                  <Sparkles className="size-4" /> 전체 상세·글쓰기
                </Button>
              </Link>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Metric({
  label,
  value,
  suffix,
  loading,
}: {
  label: string;
  value: number | null | undefined;
  suffix?: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-muted/40 px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      {loading ? (
        <Skeleton className="mt-1 h-4 w-12" />
      ) : (
        <div className="font-semibold tabular-nums">{value == null ? "—" : value.toLocaleString() + (suffix ?? "")}</div>
      )}
    </div>
  );
}
