import { useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
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

type KeywordView = "today" | "saved" | "trends" | "citations";

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
    enabled: view !== "trends" && view !== "citations",
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">키워드</h1>
          <p className="text-sm break-keep text-muted-foreground">
            하루 4회(06·12·18·00시) 이슈·트렌드에서 수익 키워드를 자동 발굴합니다.
            {view === "today" && query.data?.date ? ` (${query.data.date})` : ""}
          </p>
          {/* 모바일에서 4개 버튼이 한 줄에 안 들어간다 — 가로로 밀지 말고 줄바꿈 */}
          <div className="mt-2 flex flex-wrap gap-1">
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
            <Button
              variant={view === "citations" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("citations")}
            >
              🏆 AI 인용
            </Button>
          </div>
        </div>
        {view !== "trends" && view !== "citations" && (
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
      {view === "citations" && <CitationsView />}

      {view !== "trends" && view !== "citations" && discoverMutation.isPending && (
        <p className="text-sm text-muted-foreground">
          이슈 수집 → AI 키워드 발굴 → 검색량 조회 중입니다. 1~2분 정도 걸립니다.
        </p>
      )}

      {view === "trends" || view === "citations" ? null : query.isPending ? (
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
        <>
        {/* 모바일: 지표 12칸짜리 표는 가로 스크롤이 답이 아니다 — 핵심 지표만 담은 카드 목록으로 */}
        <div className="space-y-3 md:hidden">
          {sortedItems.map((item) => {
            const type = TYPE_LABEL[item.type ?? ""] ?? null;
            return (
              <Card key={item.id} className={item.status === "EXCLUDED" ? "opacity-40" : ""}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-xs text-muted-foreground">{item.rank}</span>
                    <div className="min-w-0 flex-1">
                      <Link to={`/keywords/${item.id}`} className="text-sm font-medium break-keep hover:underline">
                        {item.keyword}
                        {item.status === "SAVED" && (
                          <Bookmark className="ml-1 inline size-3.5 fill-current text-amber-500" />
                        )}
                      </Link>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {item.reason ?? "추천 이유 없음"}
                      </p>
                    </div>
                    <span className="shrink-0 text-lg font-bold">{item.scores.final ?? "—"}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {view === "today" && <TrendBadge info={trendInfo.get(item.keyword)} rank={item.rank} />}
                    {type && <Badge className={type.className}>{type.label}</Badge>}
                    <Badge variant="outline" className="font-mono">
                      검색 {numberFormat(item.metrics.naverMonthlySearches)}
                    </Badge>
                    <Badge variant="outline" className="font-mono">
                      경쟁문서 {numberFormat(item.totalDocs)}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-end gap-1 border-t pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setGenerateTarget({
                          id: item.id,
                          keyword: item.keyword,
                          articleType: suggestArticleType(item),
                        })
                      }
                    >
                      <PenLine className="size-4" /> 글 생성
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="저장"
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
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="제외 (다시 추천 안 함)"
                      onClick={() =>
                        statusMutation.mutate({
                          id: item.id,
                          status: item.status === "EXCLUDED" ? "RECOMMENDED" : "EXCLUDED",
                        })
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="hidden md:block">
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
                            <Link
                              to={`/keywords/${item.id}`}
                              className="font-medium hover:underline"
                            >
                              {item.keyword}
                              {item.status === "SAVED" && (
                                <Bookmark className="ml-1 inline size-3.5 fill-current text-amber-500" />
                              )}
                            </Link>
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
        </>
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

interface CitationItem {
  id: number;
  keyword: string;
  date: string;
  rank: number;
  title: string;
  url: string;
  blogId: string;
  blogName: string | null;
  citedCount: number | null;
  citedLabel: string | null;
  postedAt: string | null;
}

interface Insight {
  keyword: string;
  postsStudied: number;
  whyCited?: string[];
  tone?: string;
  structure?: string;
  infoStyle?: string[];
  coveredAngles?: string[];
  gaps?: string[];
  writingRules?: string[];
}

interface CitationsResponse {
  total: number;
  collectedDates: string[];
  items: CitationItem[];
  topBlogs: { blogId: string; blogName: string | null; citedCount: number; posts: number }[];
}

/** 인용수를 "403만"처럼 한국식으로 — 원문 배지와 같은 눈금으로 읽히게 */
function citedText(count: number | null, label: string | null) {
  if (label) return label.replace(/\s*인용$/, "");
  if (count === null) return "—";
  if (count >= 100_000_000) return `${(count / 100_000_000).toFixed(1)}억`;
  if (count >= 10_000) return `${Math.round(count / 10_000)}만`;
  return numberFormat(count);
}

/**
 * AI 인용 탭 — 내 키워드로 네이버 블로그 탭을 긁어 모은 상위 글과 그 블로거의 누적 인용수.
 * ⚠️ 인용수는 '글'이 아니라 '블로거(채널)' 누적치다. 같은 블로거의 다른 글은 같은 수치가 찍힌다.
 */
function CitationsView() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["keyword-citations"],
    queryFn: () => api.get<CitationsResponse>("/api/keywords/citations"),
  });

  const collect = useMutation({
    mutationFn: () => api.post<{ keywords: number; posts: number }>("/api/keywords/citations/collect", {}),
    onSuccess: (r) => {
      toast.success(`키워드 ${r.keywords}개에서 인용 게시물 ${r.posts}건을 수집했습니다.`);
      queryClient.invalidateQueries({ queryKey: ["keyword-citations"] });
    },
    onError: () => toast.error("인용 수집에 실패했습니다."),
  });

  // 인용 학습 — 인용된 글을 실제로 읽고 말투·구조·빈 각도를 뽑아 글 생성 프롬프트에 주입한다
  const insights = useQuery({
    queryKey: ["citation-insights"],
    queryFn: () => api.get<{ items: Insight[] }>("/api/keywords/citations/insights"),
  });

  const study = useMutation({
    mutationFn: () => api.post<{ studied: number }>("/api/keywords/citations/study", {}),
    onSuccess: (r) => {
      toast.success(`${r.studied}개 키워드의 인용 글을 학습했습니다. 이후 글 생성에 반영됩니다.`);
      queryClient.invalidateQueries({ queryKey: ["citation-insights"] });
    },
    onError: () => toast.error("인용 학습에 실패했습니다."),
  });

  const insightByKeyword = useMemo(() => {
    const map = new Map<string, Insight>();
    for (const i of insights.data?.items ?? []) map.set(i.keyword, i);
    return map;
  }, [insights.data]);

  // 키워드별로 묶어 보여준다 — "이 키워드에선 누가 AI에 인용되고 있나"가 한눈에 들어오게
  const byKeyword = useMemo(() => {
    const map = new Map<string, CitationItem[]>();
    for (const item of query.data?.items ?? []) {
      const list = map.get(item.keyword) ?? [];
      list.push(item);
      map.set(item.keyword, list);
    }
    // 키워드 안에서는 노출 순위대로
    for (const list of map.values()) list.sort((a, b) => a.rank - b.rank);
    // 강자(최고 인용수)가 높은 키워드부터 = 경쟁이 센 순
    return [...map.entries()].sort(
      (a, b) =>
        Math.max(...b[1].map((i) => i.citedCount ?? 0)) - Math.max(...a[1].map((i) => i.citedCount ?? 0)),
    );
  }, [query.data]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div className="text-sm">
            <p className="font-medium">네이버 AI 브리핑 인용 벤치마크</p>
            <p className="text-muted-foreground">
              내 키워드로 블로그 탭 상위 글을 매일 07:30에 수집합니다. 인용수는 <b>글이 아니라 블로거(채널) 누적치</b>입니다.
              {query.data?.total ? ` · 현재 ${query.data.total}건` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => collect.mutate()} disabled={collect.isPending}>
              {collect.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              지금 수집
            </Button>
            <Button onClick={() => study.mutate()} disabled={study.isPending}>
              {study.isPending ? <Loader2 className="size-4 animate-spin" /> : "🧠"}
              인용 글 학습
            </Button>
          </div>
        </CardContent>
      </Card>

      {query.isPending ? (
        <Skeleton className="h-96" />
      ) : query.isError ? (
        <p className="text-sm text-destructive">인용 데이터를 불러오지 못했습니다.</p>
      ) : (query.data?.items.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            아직 수집된 인용 데이터가 없습니다. "지금 수집"을 눌러 시작해보세요.
          </CardContent>
        </Card>
      ) : (
        <>
          {(query.data?.topBlogs.length ?? 0) > 0 && (
            <Card>
              <CardContent className="py-4">
                <p className="mb-3 text-sm font-medium">🏆 자주 인용되는 블로거 (내 키워드 기준)</p>
                {/* 순위가 핵심인데 태그처럼 흩뿌리면 누가 위인지 안 보인다 — 인용수 내림차순 랭킹 목록으로 */}
                <ol className="space-y-1">
                  {query.data!.topBlogs.map((b, index) => (
                    <li key={b.blogId}>
                      <a
                        href={`https://blog.naver.com/${b.blogId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="-mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
                      >
                        <span
                          className={`w-6 shrink-0 text-center font-mono text-xs ${
                            index < 3 ? "font-bold text-amber-600" : "text-muted-foreground"
                          }`}
                        >
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {b.blogName ?? b.blogId}
                        </span>
                        <span className="shrink-0 font-mono text-xs text-emerald-600">
                          {citedText(b.citedCount, null)}
                        </span>
                        <span className="w-14 shrink-0 text-right text-xs text-muted-foreground">
                          {b.posts}건
                        </span>
                      </a>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {byKeyword.map(([keyword, items]) => {
            const top = Math.max(...items.map((i) => i.citedCount ?? 0));
            return (
              <Card key={keyword}>
                <CardContent className="py-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-sm font-bold">{keyword}</span>
                    {top === 0 ? (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        인용 강자 없음 — 노려볼 만함
                      </Badge>
                    ) : (
                      <Badge variant="outline">최고 {citedText(top, null)} 인용</Badge>
                    )}
                  </div>
                  {insightByKeyword.get(keyword) && (
                    <InsightBox insight={insightByKeyword.get(keyword)!} />
                  )}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 text-center">#</TableHead>
                        <TableHead>제목</TableHead>
                        <TableHead className="w-36">블로거</TableHead>
                        <TableHead className="w-24 text-right">인용수</TableHead>
                        <TableHead className="w-20 text-center">작성</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-center text-muted-foreground">{item.rank}</TableCell>
                          <TableCell>
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline"
                            >
                              {item.title}
                            </a>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.blogName ?? item.blogId}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-emerald-600">
                            {citedText(item.citedCount, item.citedLabel)}
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">
                            {item.postedAt ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}

/** 인용 학습 결과 — 이 키워드에서 왜 인용되는지, 우리가 뭘 공략할지. 글 생성 프롬프트에 그대로 들어간다. */
function InsightBox({ insight }: { insight: Insight }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50/50 p-3 text-xs dark:border-emerald-900 dark:bg-emerald-950/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between font-medium"
      >
        <span>🧠 인용 학습 완료 — 글 {insight.postsStudied}개 분석 (글 쓸 때 자동 반영됨)</span>
        <span className="text-muted-foreground">{open ? "접기 ▲" : "펼치기 ▼"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {insight.whyCited?.length ? (
            <div>
              <p className="mb-1 font-semibold">왜 인용되는가</p>
              <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                {insight.whyCited.map((x, i) => <li key={i}>{x}</li>)}
              </ul>
            </div>
          ) : null}
          {insight.tone && (
            <div>
              <p className="mb-1 font-semibold">말투</p>
              <p className="text-muted-foreground">{insight.tone}</p>
            </div>
          )}
          {insight.structure && (
            <div>
              <p className="mb-1 font-semibold">글 구조</p>
              <p className="text-muted-foreground">{insight.structure}</p>
            </div>
          )}
          {insight.coveredAngles?.length ? (
            <div>
              <p className="mb-1 font-semibold text-rose-600">이미 다뤄진 각도 (반복 금지)</p>
              <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                {insight.coveredAngles.map((x, i) => <li key={i}>{x}</li>)}
              </ul>
            </div>
          ) : null}
          {insight.gaps?.length ? (
            <div>
              <p className="mb-1 font-semibold text-emerald-700">공략할 빈 각도</p>
              <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                {insight.gaps.map((x, i) => <li key={i}>{x}</li>)}
              </ul>
            </div>
          ) : null}
          {insight.writingRules?.length ? (
            <div>
              <p className="mb-1 font-semibold">글 생성에 적용되는 지시문</p>
              <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                {insight.writingRules.map((x, i) => <li key={i}>{x}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
