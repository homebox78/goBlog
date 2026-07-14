import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, ExternalLink, PenLine } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GenerateDialog } from "@/components/articles/GenerateDialog";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

/**
 * 키워드 상세 — 흩어져 있던 데이터를 한 화면에 모은다.
 * 예전엔 키워드가 표의 '한 줄'이 전부라, 이걸로 글을 쓸지 판단하려면 여러 화면을 헤맸다.
 */

interface KeywordDetail {
  keyword: {
    id: number;
    text: string;
    status: string;
    category: string | null;
    type: string | null;
    searchIntent: string | null;
    reason: string | null;
  };
  metrics: {
    naverMonthlySearches: number | null;
    googleMonthlySearches: number | null;
    googleCpcKrw: number | null;
    totalDocs: number | null;
    competitionScore: number | null;
  } | null;
  trend: { summary: string; daysSeen: number; momentum: number } | null;
  trends: Array<{
    at: string;
    rank: number | null;
    searchVolume: number | null;
    finalScore: number | null;
  }>;
  citations: Array<{
    rank: number;
    title: string;
    url: string;
    blogName: string | null;
    citedLabel: string | null;
  }>;
  insight: {
    whyCited?: string[];
    gaps?: string[];
    coveredAngles?: string[];
  } | null;
  related: Array<{ keyword: string; monthlySearches: number; competition: string | null }>;
  demographics: {
    category: string;
    term: string;
    summary: string;
    ages: Array<{ group: string; ratio: number }>;
    genders: Array<{ group: "f" | "m"; ratio: number }>;
  } | null;
  articles: Array<{ id: number; title: string; status: string; qualityScore: number | null }>;
}

const SCORE_CHART: ChartConfig = {
  finalScore: { label: "종합점수", color: "var(--chart-1)" },
};

const numberFormat = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : new Intl.NumberFormat("ko-KR").format(value);

export default function KeywordDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [generateOpen, setGenerateOpen] = useState(false);

  const query = useQuery({
    queryKey: ["keyword-detail", id],
    queryFn: () => api.get<KeywordDetail>(`/api/keywords/${id}/detail`),
  });

  if (query.isPending) return <Skeleton className="h-96" />;
  if (query.isError) return <p className="text-sm text-destructive">키워드를 불러오지 못했습니다.</p>;

  const data = query.data;
  const series = data.trends.map((row) => ({
    label: new Date(row.at).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" }),
    finalScore: row.finalScore,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            to="/keywords"
            className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" /> 키워드 목록
          </Link>
          <h1 className="text-2xl font-bold break-keep">{data.keyword.text}</h1>
          <p className="mt-1 text-sm break-keep text-muted-foreground">
            {data.keyword.reason ?? "추천 이유 없음"}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {data.keyword.category && <Badge variant="outline">{data.keyword.category}</Badge>}
            {data.keyword.searchIntent && <Badge variant="outline">{data.keyword.searchIntent}</Badge>}
            {data.trend && <Badge variant="secondary">{data.trend.summary}</Badge>}
          </div>
        </div>
        <Button onClick={() => setGenerateOpen(true)}>
          <PenLine className="size-4" /> 이 키워드로 글 쓰기
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="네이버 검색량" value={numberFormat(data.metrics?.naverMonthlySearches)} hint="월간" />
        <Stat label="경쟁 문서 수" value={numberFormat(data.metrics?.totalDocs)} hint="적을수록 유리" />
        <Stat
          label="경쟁 효율"
          value={data.metrics?.competitionScore != null ? `${data.metrics.competitionScore}점` : "—"}
          hint="검색량 ÷ 경쟁문서"
        />
        <Stat
          label="CPC"
          value={data.metrics?.googleCpcKrw != null ? `₩${numberFormat(data.metrics.googleCpcKrw)}` : "—"}
          hint="수익성 신호"
        />
      </div>

      {series.length > 1 && (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base">종합점수 추이</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={SCORE_CHART} className="h-48 w-full">
              <AreaChart data={series} margin={{ left: 4, right: 8, top: 4 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis width={32} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  dataKey="finalScore"
                  type="monotone"
                  stroke="var(--color-finalScore)"
                  fill="var(--color-finalScore)"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* 수요층 — 누가 이걸 검색하는가. 쇼핑성 키워드가 아니면 카드 자체를 숨긴다(빈 값을 지어내지 않는다). */}
      {data.demographics && (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              누가 검색하나
              <Badge variant="secondary">{data.demographics.summary}</Badge>
              <span className="text-xs font-normal text-muted-foreground">
                네이버 쇼핑인사이트 실측 · {data.demographics.category}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              {data.demographics.ages
                .sort((a, b) => Number(a.group) - Number(b.group))
                .map((age) => (
                  <div key={age.group} className="flex items-center gap-2">
                    <span className="w-10 shrink-0 text-xs text-muted-foreground">{age.group}대</span>
                    <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-[var(--chart-1)]"
                        style={{ width: `${age.ratio}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right font-mono text-xs">{age.ratio}</span>
                  </div>
                ))}
            </div>
            {data.demographics.genders.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t pt-3">
                {data.demographics.genders.map((gender) => (
                  <Badge key={gender.group} variant="outline" className="font-mono">
                    {gender.group === "f" ? "여성" : "남성"} {gender.ratio}
                  </Badge>
                ))}
              </div>
            )}
            {/* 조회어를 숨기지 않는다 — 긴 키워드는 상품명으로 줄여서 묻기 때문에, 엉뚱하게 줄었으면 여기서 바로 보인다 */}
            <p className="text-[11px] text-muted-foreground">
              1위 그룹을 100으로 둔 상대값입니다. 글의 말투·예시·상품 추천이 이 층에 맞춰집니다.
              {data.demographics.term !== data.keyword.text && (
                <> · 조회어: “{data.demographics.term}”</>
              )}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 연관 키워드 — 네이버가 실측한 검색량. 예전엔 받아놓고 버리던 데이터다. */}
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base">연관 키워드 (네이버 실측 검색량)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.related.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">연관 키워드가 없습니다.</p>
            ) : (
              <ol className="space-y-1">
                {data.related.map((row, index) => (
                  <li key={row.keyword} className="flex items-center gap-2 py-1 text-sm">
                    <span className="w-5 shrink-0 text-xs text-muted-foreground">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{row.keyword}</span>
                    <span className="shrink-0 font-mono text-xs">{numberFormat(row.monthlySearches)}</span>
                    <Badge variant="outline" className="w-12 shrink-0 justify-center text-[10px]">
                      {row.competition ?? "—"}
                    </Badge>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        {/* 인용 상위 글 — 경쟁 글이 무엇을 썼는가 */}
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base">AI가 인용한 상위 글</CardTitle>
          </CardHeader>
          <CardContent>
            {data.citations.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                아직 수집된 인용 글이 없습니다.
              </p>
            ) : (
              <ol className="space-y-1.5">
                {data.citations.map((row) => (
                  <li key={row.url}>
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noreferrer"
                      className="-mx-2 flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent"
                    >
                      <span className="w-5 shrink-0 text-xs text-muted-foreground">{row.rank}</span>
                      <span className="min-w-0 flex-1 truncate text-sm">{row.title}</span>
                      <span className="shrink-0 font-mono text-xs text-emerald-600">
                        {row.citedLabel ?? ""}
                      </span>
                      <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                    </a>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {data.insight && (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base">학습된 인사이트</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {data.insight.gaps && data.insight.gaps.length > 0 && (
              <div>
                <p className="mb-1 font-medium text-emerald-600">🎯 비어 있는 각도 (우리가 칠 자리)</p>
                {data.insight.gaps.map((gap) => (
                  <p key={gap} className="text-muted-foreground">
                    · {gap}
                  </p>
                ))}
              </div>
            )}
            {data.insight.coveredAngles && data.insight.coveredAngles.length > 0 && (
              <div>
                <p className="mb-1 font-medium text-muted-foreground">이미 포화된 각도 (반복하면 인용 안 됨)</p>
                {data.insight.coveredAngles.map((angle) => (
                  <p key={angle} className="text-muted-foreground">
                    · {angle}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {data.articles.length > 0 && (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base">이 키워드로 쓴 글</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.articles.map((article) => (
              <Link
                key={article.id}
                to={`/articles/${article.id}`}
                className="-mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
              >
                <span className="min-w-0 flex-1 truncate text-sm">{article.title}</span>
                <Badge variant="outline" className="shrink-0 font-mono">
                  {article.qualityScore ?? "—"}점
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <GenerateDialog
        keywordId={data.keyword.id}
        keyword={data.keyword.text}
        open={generateOpen}
        onOpenChange={(next) => {
          setGenerateOpen(next);
          if (!next) navigate(`/keywords/${id}`);
        }}
      />
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
