import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bookmark, Loader2, PenLine, RefreshCw, Trash2 } from "lucide-react";
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

const TYPE_LABEL: Record<string, { label: string; className: string }> = {
  ISSUE: { label: "이슈", className: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" },
  EVERGREEN: { label: "에버그린", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  REVENUE: { label: "수익형", className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" },
};

const numberFormat = (value: number | null) =>
  value === null ? "—" : new Intl.NumberFormat("ko-KR").format(value);

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

export default function KeywordsPage() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<"today" | "saved">("today");
  const [generateTarget, setGenerateTarget] = useState<{
    id: number;
    keyword: string;
    articleType: string;
  } | null>(null);

  const query = useQuery({
    queryKey: ["keywords", view],
    queryFn: () =>
      view === "today"
        ? api.get<TodayResponse>("/api/keywords/today")
        : api.get<TodayResponse>("/api/keywords/saved").then((r) => ({ ...r, date: "", running: false })),
  });

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
          </div>
        </div>
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
      </div>

      {discoverMutation.isPending && (
        <p className="text-sm text-muted-foreground">
          이슈 수집 → AI 키워드 발굴 → 검색량 조회 중입니다. 1~2분 정도 걸립니다.
        </p>
      )}

      {query.isPending ? (
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
                  <TableHead className="w-10 text-center">#</TableHead>
                  <TableHead>키워드</TableHead>
                  <TableHead className="text-center">유형</TableHead>
                  <TableHead className="text-center">카테고리</TableHead>
                  <TableHead className="text-right">검색량(G)</TableHead>
                  <TableHead className="text-right">검색량(N)</TableHead>
                  <TableHead className="text-right">경쟁문서</TableHead>
                  <TableHead className="text-right">CPC</TableHead>
                  <TableHead className="text-right">종합점수</TableHead>
                  <TableHead className="w-24 text-center">액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.items.map((item) => {
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
                      <TableCell className="text-center">
                        {type ? <Badge className={type.className}>{type.label}</Badge> : "—"}
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {item.category ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {numberFormat(item.metrics.googleMonthlySearches)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {numberFormat(item.metrics.naverMonthlySearches)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {numberFormat(item.totalDocs)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {item.metrics.googleCpcKrw === null
                          ? "—"
                          : `₩${numberFormat(item.metrics.googleCpcKrw)}`}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-bold">{item.scores.final ?? "—"}</span>
                        <span className="text-xs text-muted-foreground">점</span>
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
            <p className="mt-3 text-xs text-muted-foreground">
              검색량(G)·CPC는 Google Ads, 검색량(N)은 네이버 검색광고 데이터입니다. API 미연결 시
              "—"로 표시되며 임의 수치를 만들지 않습니다.
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
