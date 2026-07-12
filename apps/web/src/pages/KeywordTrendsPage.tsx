import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PenLine, Search } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GenerateDialog } from "@/components/articles/GenerateDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TrendItem {
  id: number;
  keywordId: number | null;
  keywordText: string;
  category: string | null;
  sourceType: string | null;
  date: string;
  year: number;
  month: number;
  day: number;
  collectedAt: string;
  trigger: string;
  searchVolume: number | null;
  naverSearches: number | null;
  competitionScore: number | null;
  totalDocs: number | null;
  revenueScore: number | null;
  valueScore: number | null;
  opportunityScore: number | null;
  finalScore: number | null;
  rank: number | null;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 4 }, (_, i) => CURRENT_YEAR - i);
const nf = (v: number | null) => (v == null ? "—" : new Intl.NumberFormat("ko-KR").format(v));

const TYPE_LABEL: Record<string, { label: string; className: string }> = {
  ISSUE: { label: "이슈", className: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" },
  EVERGREEN: { label: "에버그린", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  REVENUE: { label: "수익형", className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" },
};

function ScoreCell({ value, strong }: { value: number | null; strong?: boolean }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  const color = value >= 70 ? "text-emerald-600" : value >= 45 ? "text-foreground" : "text-muted-foreground";
  return <span className={`font-mono text-sm ${color} ${strong ? "font-bold" : ""}`}>{value}</span>;
}

/** 키워드 시계열 트렌드 뷰 — 키워드 페이지의 '트렌드' 탭에서 렌더된다. */
export default function TrendsView() {
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [month, setMonth] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [generateTarget, setGenerateTarget] = useState<{ id: number | null; keyword: string } | null>(null);

  const query = useQuery({
    queryKey: ["keyword-trends", year, month, keyword],
    queryFn: () => {
      const params = new URLSearchParams({ year });
      if (month !== "all") params.set("month", month);
      if (keyword.trim()) params.set("keyword", keyword.trim());
      return api.get<{ total: number; items: TrendItem[] }>(`/api/keywords/trends?${params.toString()}`);
    },
  });

  const items = query.data?.items ?? [];

  // 기간 내 고유 키워드 수 + 검색량 상위 (빅데이터 요약)
  const summary = useMemo(() => {
    const byKeyword = new Map<string, { count: number; maxVolume: number; maxScore: number }>();
    for (const it of items) {
      const cur = byKeyword.get(it.keywordText) ?? { count: 0, maxVolume: 0, maxScore: 0 };
      cur.count += 1;
      cur.maxVolume = Math.max(cur.maxVolume, it.searchVolume ?? 0);
      cur.maxScore = Math.max(cur.maxScore, it.finalScore ?? 0);
      byKeyword.set(it.keywordText, cur);
    }
    const top = [...byKeyword.entries()]
      .sort((a, b) => b[1].maxScore - a[1].maxScore)
      .slice(0, 10);
    return { uniqueCount: byKeyword.size, top };
  }, [items]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        매 수집마다 쌓인 키워드 시계열입니다. 년·월로 조회해 어느 시기에 어떤 키워드가 떴는지 분석하세요.
      </p>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">연도</label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}년
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">월</label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m}월
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-48 flex-1 space-y-1">
            <label className="text-xs text-muted-foreground">키워드 검색</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="키워드 일부 입력"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {query.isPending ? (
        <Skeleton className="h-72" />
      ) : query.isError ? (
        <p className="text-sm text-destructive">트렌드를 불러오지 못했습니다.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatCard label="누적 스냅샷" value={nf(query.data.total)} />
            <StatCard label="고유 키워드" value={nf(summary.uniqueCount)} />
            <StatCard label="표시 범위" value={`${year}년 ${month === "all" ? "전체" : `${month}월`}`} />
          </div>

          {summary.top.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h2 className="mb-3 text-base font-semibold">이 기간 상위 키워드 (종합점수 기준)</h2>
                <div className="flex flex-wrap gap-2">
                  {summary.top.map(([text, s]) => (
                    <Badge key={text} variant="secondary" className="gap-1">
                      {text}
                      <span className="text-[10px] text-muted-foreground">
                        {s.maxScore}점 · {s.count}회
                      </span>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-4">
              {items.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  이 기간에 수집된 데이터가 없습니다. 키워드 수집이 실행되면 여기에 시계열로 쌓입니다.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10 text-center">#</TableHead>
                        <TableHead>키워드</TableHead>
                        <TableHead className="text-center">유형</TableHead>
                        <TableHead className="text-right">검색량(N)</TableHead>
                        <TableHead className="text-right">경쟁문서</TableHead>
                        <TableHead className="text-right">경쟁효율</TableHead>
                        <TableHead className="text-right">수익</TableHead>
                        <TableHead className="text-right">가치</TableHead>
                        <TableHead className="text-right">기회</TableHead>
                        <TableHead className="text-right">종합</TableHead>
                        <TableHead className="text-center">수집일시</TableHead>
                        <TableHead className="w-14 text-center">액션</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((it) => {
                        const type = it.sourceType ? TYPE_LABEL[it.sourceType] : null;
                        return (
                          <TableRow key={it.id}>
                            <TableCell className="text-center text-sm text-muted-foreground">{it.rank ?? "—"}</TableCell>
                            <TableCell className="font-medium">{it.keywordText}</TableCell>
                            <TableCell className="text-center">
                              {type ? (
                                <Badge variant="secondary" className={`text-[10px] ${type.className}`}>{type.label}</Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">{nf(it.naverSearches ?? it.searchVolume)}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{nf(it.totalDocs)}</TableCell>
                            <TableCell className="text-right"><ScoreCell value={it.competitionScore} strong /></TableCell>
                            <TableCell className="text-right"><ScoreCell value={it.revenueScore} /></TableCell>
                            <TableCell className="text-right"><ScoreCell value={it.valueScore} /></TableCell>
                            <TableCell className="text-right"><ScoreCell value={it.opportunityScore} /></TableCell>
                            <TableCell className="text-right"><span className="font-bold">{it.finalScore ?? "—"}</span></TableCell>
                            <TableCell className="whitespace-nowrap text-center text-xs text-muted-foreground">
                              {new Date(it.collectedAt).toLocaleString("ko-KR", {
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                title="이 키워드로 글 생성"
                                onClick={() => setGenerateTarget({ id: it.keywordId, keyword: it.keywordText })}
                              >
                                <PenLine className="size-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <GenerateDialog
        keywordId={generateTarget?.id ?? null}
        keyword={generateTarget?.keyword ?? ""}
        open={generateTarget !== null}
        onOpenChange={(open) => !open && setGenerateTarget(null)}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
