import { useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bookmark, Loader2, PenLine, RefreshCw, Trash2 } from "lucide-react";
import TrendsView from "./KeywordTrendsPage";
import { GenerateDialog } from "@/components/articles/GenerateDialog";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface KeywordItem {
  id: number;
  rank: number;
  keyword: string;
  category: string | null;
  type: string | null;
  searchIntent: string | null;
  status: string;
  reason: string | null;
  totalDocs: number | null;
  competitionScore: number | null;
  scores: {
    revenue: number | null;
    value: number | null;
    opportunity: number | null;
    final: number | null;
  };
  metrics: {
    googleMonthlySearches: number | null;
    googleCpcKrw: number | null;
    googleCompetition: string | null;
    naverMonthlySearches: number | null;
  };
}

interface TodayResponse {
  date: string;
  running: boolean;
  items: KeywordItem[];
}

type SortKey = "rank" | "keyword" | "naver" | "docs" | "comp" | "revenue" | "value" | "opportunity" | "final";

const TYPE_LABEL: Record<string, { label: string; className: string }> = {
  ISSUE: { label: "이슈", className: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" },
  EVERGREEN: { label: "에버그린", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  REVENUE: { label: "수익형", className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" },
};

const numberFormat = (value: number | null) =>
  value === null ? "—" : new Intl.NumberFormat("ko-KR").format(value);

/** 점수를 색으로 구분해 직관적으로 (높을수록 초록, 낮을수록 회색) */
function ScoreCell({ value, strong }: { value: number | null; strong?: boolean }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  const color =
    value >= 70
      ? "text-emerald-600"
      : value >= 45
        ? "text-foreground"
        : "text-muted-foreground";
  return <span className={`font-mono text-sm ${color} ${strong ? "font-bold" : ""}`}>{value}</span>;
}

/** 정렬 가능한 테이블 헤더 — 클릭 시 정렬 토글, 현재 정렬 컬럼에 ▲▼ 표시 */
function SortHead({
  k,
  sort,
  onSort,
  className,
  children,
}: {
  k: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (k: SortKey) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const active = sort.key === k;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-0.5 hover:text-foreground ${active ? "font-bold text-foreground" : "text-muted-foreground"}`}
      >
        {children}
        <span className="text-[10px]">{active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </TableHead>
  );
}

/** 순위 변동(전일 대비 ▲▼·NEW)과 연속 등장일 — 시계열 트렌드를 오늘 표에서 바로 보여준다 */
function TrendBadge({
  info,
  rank,
}: {
  info?: { prevRank: number | null; daysSeen: number; seenBefore: boolean };
  rank: number;
}) {
  if (!info) return <span className="text-xs text-muted-foreground">—</span>;
  let move: ReactNode = null;
  if (info.prevRank != null) {
    const d = info.prevRank - rank;
    move =
      d > 0 ? (
        <span className="font-bold text-emerald-600">▲{d}</span>
      ) : d < 0 ? (
        <span className="font-bold text-rose-500">▼{-d}</span>
      ) : (
        <span className="text-muted-foreground">–</span>
      );
  } else if (!info.seenBefore) {
    move = <span className="rounded bg-rose-100 px-1 py-0.5 text-[10px] font-bold text-rose-600 dark:bg-rose-950 dark:text-rose-300">NEW</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs">
      {move}
      {info.daysSeen >= 2 && <span className="text-[10px] text-muted-foreground">{info.daysSeen}일째</span>}
    </span>
  );
}

/** 키워드 문구·유형·검색의도로 어울리는 글 유형을 추천한다 */
function suggestArticleType(item: KeywordItem): string {
  const keyword = item.keyword;
  if (/후기|리뷰/.test(keyword)) return "product-review";
  if (/추천|비교|vs/i.test(keyword)) return "comparison";
  if (/신청|가입|접수/.test(keyword)) return "how-to-apply";
  if (/비용|가격|요금|수수료|예상가/.test(keyword)) return "pricing";
  if (/방법|사용법|하는 법/.test(keyword)) return "how-to";
  if (/해결|오류|대처|안 될 때/.test(keyword)) return "troubleshooting";
  if (item.type === "ISSUE") return "news";
  switch (item.searchIntent) {
    case "비교검토":
    case "구매전환":
      return "comparison";
    case "신청전환":
      return "how-to-apply";
    case "문제해결":
      return "troubleshooting";
    default:
      return "guide";
  }
}

type KeywordView = "today" | "saved" | "trends";

export default function KeywordsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = (searchParams.get("tab") as KeywordView) || "today";
  const setView = (v: KeywordView) => setSearchParams(v === "today" ? {} : { tab: v });
  const [generateTarget, setGenerateTarget] = useState<{
    id: number;
    keyword: string;
    articleType: string;
  } | null>(null);

  const query = useQuery({
    enabled: view !== "trends",
    queryKey: ["keywords", view],
    queryFn: () =>
      view === "today"
        ? api.get<TodayResponse>("/api/keywords/today")
        : api.get<TodayResponse>("/api/keywords/saved").then((r) => ({ ...r, date: "", running: false })),
  });

  // 헤더 클릭 정렬 — 기본은 종합점수 내림차순(= rank 순)
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "rank", dir: "asc" });
  const toggleSort = (key: SortKey) =>
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  const sortedItems = useMemo(() => {
    const items = [...(query.data?.items ?? [])];
    const val = (it: KeywordItem): number | string => {
      switch (sort.key) {
        case "rank": return it.rank;
        case "keyword": return it.keyword;
        case "naver": return it.metrics.naverMonthlySearches ?? -1;
        case "docs": return it.totalDocs ?? -1;
        case "comp": return it.competitionScore ?? -1;
        case "revenue": return it.scores.revenue ?? -1;
        case "value": return it.scores.value ?? -1;
        case "opportunity": return it.scores.opportunity ?? -1;
        case "final": return it.scores.final ?? -1;
      }
    };
    items.sort((a, b) => {
      const va = val(a), vb = val(b);
      const cmp = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return items;
  }, [query.data, sort]);

  // 이번 달 트렌드 스냅샷 → 오늘 표에 순위 변동(▲▼/NEW)·연속 등장을 표시 (직관성)
  const now = new Date();
  const trendsMini = useQuery({
    enabled: view === "today",
    queryKey: ["keyword-trends-mini", now.getFullYear(), now.getMonth() + 1],
    queryFn: () =>
      api.get<{ items: Array<{ keywordText: string; date: string; rank: number | null }> }>(
        `/api/keywords/trends?year=${now.getFullYear()}&month=${now.getMonth() + 1}`,
      ),
  });
  const trendInfo = useMemo(() => {
    const items = trendsMini.data?.items ?? [];
    const days = [...new Set(items.map((i) => i.date))].sort().reverse(); // 최신일 먼저
    const todayKey = days[0];
    const prevKey = days[1];
    const map = new Map<string, { prevRank: number | null; daysSeen: number; seenBefore: boolean }>();
    for (const it of items) {
      const cur = map.get(it.keywordText) ?? { prevRank: null, daysSeen: 0, seenBefore: false };
      cur.daysSeen += 1;
      if (it.date === prevKey) cur.prevRank = it.rank;
      if (it.date !== todayKey) cur.seenBefore = true;
      map.set(it.keywordText, cur);
    }
    return map;
  }, [trendsMini.data]);

  const discoverMutation = useMutation({
    mutationFn: () =>
      api.post<{ recommendedCount: number; candidateCount: number; issuesCollected: Record<string, number> }>(
        "/api/keywords/discover",
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["keywords"] });
      const sources = Object.entries(result.issuesCollected)
        .map(([source, count]) => `${source} ${count}`)
        .join(" · ");
      toast.success(`키워드 ${result.recommendedCount}개 추천 완료`, {
        description: `이슈 수집: ${sources}`,
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "수집에 실패했습니다.");
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch<{ id: number; status: string }>(`/api/keywords/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["keywords"] }),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "상태 변경에 실패했습니다."),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">키워드</h1>
          <p className="text-sm text-muted-foreground">
            하루 4회(06·12·18·00시) 이슈·트렌드에서 수익 키워드를 자동 발굴합니다.
            {view === "today" && query.data?.date ? ` (${query.data.date})` : ""}
          </p>
          <div className="mt-2 flex gap-1">
            <Button
              variant={view === "today" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("today")}
            >
              오늘의 추천
            </Button>
            <Button
              variant={view === "saved" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("saved")}
            >
              저장된 키워드
            </Button>
            <Button
              variant={view === "trends" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("trends")}
            >
              📈 트렌드 (시계열)
            </Button>
          </div>
        </div>
        {view !== "trends" && (
          <Button
            onClick={() => discoverMutation.mutate()}
            disabled={discoverMutation.isPending || query.data?.running}
          >
            {discoverMutation.isPending || query.data?.running ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            지금 수집
          </Button>
        )}
      </div>

      {view === "trends" && <TrendsView />}

      {view !== "trends" && discoverMutation.isPending && (
        <p className="text-sm text-muted-foreground">
          이슈 수집 → AI 키워드 발굴 → 검색량 조회 중입니다. 1~2분 정도 걸립니다.
        </p>
      )}

      {view === "trends" ? null : query.isPending ? (
        <Skeleton className="h-96" />
      ) : query.isError ? (
        <p className="text-sm text-destructive">키워드를 불러오지 못했습니다.</p>
      ) : query.data.items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            오늘 수집된 키워드가 없습니다. "지금 수집"을 눌러 시작해보세요.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHead k="rank" sort={sort} onSort={toggleSort} className="w-10 text-center">#</SortHead>
                  <SortHead k="keyword" sort={sort} onSort={toggleSort}>키워드</SortHead>
                  {view === "today" && <TableHead className="w-20 text-center">트렌드</TableHead>}
                  <TableHead className="text-center">유형</TableHead>
                  <SortHead k="naver" sort={sort} onSort={toggleSort} className="text-right">검색량(N)</SortHead>
                  <SortHead k="docs" sort={sort} onSort={toggleSort} className="text-right">경쟁문서</SortHead>
                  <SortHead k="comp" sort={sort} onSort={toggleSort} className="text-right">경쟁효율</SortHead>
                  <SortHead k="revenue" sort={sort} onSort={toggleSort} className="text-right">수익</SortHead>
                  <SortHead k="value" sort={sort} onSort={toggleSort} className="text-right">가치</SortHead>
                  <SortHead k="opportunity" sort={sort} onSort={toggleSort} className="text-right">기회</SortHead>
                  <SortHead k="final" sort={sort} onSort={toggleSort} className="text-right">종합</SortHead>
                  <TableHead className="w-20 text-center">액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedItems.map((item) => {
                  const type = TYPE_LABEL[item.type ?? ""] ?? null;
                  return (
                    <TableRow
                      key={item.id}
                      className={item.status === "EXCLUDED" ? "opacity-40" : ""}
                    >
                      <TableCell className="text-center text-muted-foreground">
                        {item.rank}
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-default font-medium">
                              {item.keyword}
                              {item.status === "SAVED" && (
                                <Bookmark className="ml-1 inline size-3.5 fill-current text-amber-500" />
                              )}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-80">
                            <p>{item.reason ?? "추천 이유 없음"}</p>
                            <p className="mt-1 text-xs opacity-70">
                              수익 {item.scores.revenue ?? "—"} · 가치 {item.scores.value ?? "—"} ·
                              기회 {item.scores.opportunity ?? "—"} · 의도 {item.searchIntent ?? "—"}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      {view === "today" && (
                        <TableCell className="text-center">
                          <TrendBadge info={trendInfo.get(item.keyword)} rank={item.rank} />
                        </TableCell>
                      )}
                      <TableCell className="text-center">
                        {type ? <Badge className={type.className}>{type.label}</Badge> : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {numberFormat(item.metrics.naverMonthlySearches)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {numberFormat(item.totalDocs)}
                      </TableCell>
                      <TableCell className="text-right">
                        <ScoreCell value={item.competitionScore} strong />
                      </TableCell>
                      <TableCell className="text-right">
                        <ScoreCell value={item.scores.revenue} />
                      </TableCell>
                      <TableCell className="text-right">
                        <ScoreCell value={item.scores.value} />
                      </TableCell>
                      <TableCell className="text-right">
                        <ScoreCell value={item.scores.opportunity} />
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-bold">{item.scores.final ?? "—"}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={() =>
                                  setGenerateTarget({
                                    id: item.id,
                                    keyword: item.keyword,
                                    articleType: suggestArticleType(item),
                                  })
                                }
                              >
                                <PenLine className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>글 생성</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={() =>
                                  statusMutation.mutate({
                                    id: item.id,
                                    status: item.status === "SAVED" ? "RECOMMENDED" : "SAVED",
                                  })
                                }
                              >
                                <Bookmark
                                  className={`size-4 ${item.status === "SAVED" ? "fill-current text-amber-500" : ""}`}
                                />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>저장</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={() =>
                                  statusMutation.mutate({
                                    id: item.id,
                                    status: item.status === "EXCLUDED" ? "RECOMMENDED" : "EXCLUDED",
                                  })
                                }
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>제외 (다시 추천 안 함)</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              <b>순위 기준(종합점수)</b> = 상위노출 기회 45% + 수익 30% + 가치 25%. 신생 블로그가
              실제로 상위 노출될 수 있는 키워드를 우선합니다.
              <br />
              <b>경쟁효율</b> = 검색량 대비 경쟁문서 수 (높을수록 경쟁 적고 유리) — 순위를 좌우하는
              핵심 지표입니다. <b>수익</b>=CPC·구매의도, <b>가치</b>=시의성·문제해결,{" "}
              <b>기회</b>=경쟁효율·정보공백 종합. 검색량(N)·경쟁문서는 네이버 실측이며 API 미연결
              항목은 "—"입니다.
            </p>
          </CardContent>
        </Card>
      )}

      <GenerateDialog
        keywordId={generateTarget?.id ?? null}
        keyword={generateTarget?.keyword ?? ""}
        defaultArticleType={generateTarget?.articleType}
        open={generateTarget !== null}
        onOpenChange={(open) => !open && setGenerateTarget(null)}
      />
    </div>
  );
}
