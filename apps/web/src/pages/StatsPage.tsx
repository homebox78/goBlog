import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";

interface Overview {
  today: Metric;
  month: Metric;
  year: Metric;
  all: Metric;
  subscribers: { active: number; total: number };
}
interface Metric {
  views: number;
  uniques: number;
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
  const max = Math.max(1, ...(series.data?.series ?? []).map((s) => s.views));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">통계</h1>
        <p className="text-sm text-muted-foreground">기사 조회수 · 순 방문(IP) · 구독자 (KST 기준)</p>
      </div>

      {/* 개요 카드 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <OverviewCard label="오늘" m={o?.today} />
        <OverviewCard label="이번 달" m={o?.month} />
        <OverviewCard label="올해" m={o?.year} />
        <OverviewCard label="전체 누적" m={o?.all} />
      </div>
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div className="text-sm text-muted-foreground">뉴스레터 구독자</div>
          <div className="text-lg font-bold">
            <span className="text-emerald-600">{(o?.subscribers.active ?? 0).toLocaleString()}</span>
            <span className="text-muted-foreground"> / {(o?.subscribers.total ?? 0).toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>

      {/* 시계열 차트 */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">조회수 추이</h2>
            <div className="flex gap-1">
              {(["day", "month", "year"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGran(g)}
                  className={
                    "rounded-md border px-3 py-1 text-sm " +
                    (gran === g ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")
                  }
                >
                  {g === "day" ? "일" : g === "month" ? "월" : "년"}
                </button>
              ))}
            </div>
          </div>
          {series.isPending ? (
            <p className="py-16 text-center text-sm text-muted-foreground">불러오는 중...</p>
          ) : (series.data?.series ?? []).length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">데이터가 없습니다.</p>
          ) : (
            <div className="flex h-52 items-end gap-1 overflow-x-auto">
              {series.data!.series.map((s) => (
                <div key={s.key} className="group flex min-w-[18px] flex-1 flex-col items-center gap-1">
                  <div className="relative flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t bg-primary/80 transition-all group-hover:bg-primary"
                      style={{ height: `${(s.views / max) * 100}%` }}
                    />
                    <div className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] text-background group-hover:block">
                      {s.views.toLocaleString()}회 · IP {s.uniques}
                    </div>
                  </div>
                  <div className="w-full truncate text-center text-[9px] text-muted-foreground">
                    {gran === "day" ? s.key.slice(5) : s.key}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 기사별 조회수 */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">기사별 조회수</h2>
            <div className="flex gap-2">
              <div className="flex gap-1">
                {(["all", "today", "month", "year"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={
                      "rounded-md border px-2.5 py-1 text-xs " +
                      (period === p ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")
                    }
                  >
                    {p === "all" ? "누적" : p === "today" ? "오늘" : p === "month" ? "이달" : "올해"}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {(["views", "uniques"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSort(s)}
                    className={
                      "rounded-md border px-2.5 py-1 text-xs " +
                      (sort === s ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")
                    }
                  >
                    {s === "views" ? "조회순" : "순방문순"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {articles.isPending ? (
            <p className="py-12 text-center text-sm text-muted-foreground">불러오는 중...</p>
          ) : (articles.data?.articles ?? []).length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">조회 기록이 없습니다.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-2 py-2 font-medium">#</th>
                  <th className="px-2 py-2 font-medium">기사</th>
                  <th className="px-2 py-2 text-right font-medium">조회</th>
                  <th className="px-2 py-2 text-right font-medium">순방문(IP)</th>
                  <th className="px-2 py-2 text-right font-medium">최근</th>
                </tr>
              </thead>
              <tbody>
                {articles.data!.articles.map((a, i) => (
                  <tr key={a.articleId} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-2 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-2 py-2">
                      <a
                        href={`https://hom2box.com/article.php?id=${a.articleId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium hover:underline"
                      >
                        {a.title}
                      </a>
                      {a.category && <span className="ml-1 text-xs text-muted-foreground">· {a.category}</span>}
                    </td>
                    <td className="px-2 py-2 text-right font-semibold">{a.views.toLocaleString()}</td>
                    <td className="px-2 py-2 text-right text-muted-foreground">{a.uniques.toLocaleString()}</td>
                    <td className="px-2 py-2 text-right text-xs text-muted-foreground">
                      {a.lastViewedAt
                        ? new Date(a.lastViewedAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OverviewCard({ label, m }: { label: string; m?: Metric }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold">{(m?.views ?? 0).toLocaleString()}</div>
        <div className="text-xs text-muted-foreground">순방문 {(m?.uniques ?? 0).toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}
