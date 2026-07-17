import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search,
  Inbox,
  CheckCircle2,
  RotateCcw,
  Trash2,
  ExternalLink,
  Pencil,
  ImageOff,
  Loader2,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface Platform {
  status: string;
  url: string | null;
}
interface ListItem {
  id: number;
  title: string;
  status: string;
  qualityScore: number | null;
  createdAt: string;
  publishedAt: string | null;
  keyword: { id: number; text: string } | null;
  thumbnailUrl: string | null;
  wordpress: Platform | null;
  blogger: Platform | null;
  naver: Platform | null;
  tistory: Platform | null;
}
interface Detail {
  id: number;
  title: string;
  status: string;
  metaDescription: string | null;
  excerpt: string | null;
  contentHtml: string | null;
  qualityScore: number | null;
  keyword?: { text: string } | null;
}

function rel(dt: string): string {
  const d = (Date.now() - new Date(dt).getTime()) / 1000;
  if (d < 60) return "방금";
  if (d < 3600) return `${Math.floor(d / 60)}분 전`;
  if (d < 86400) return `${Math.floor(d / 3600)}시간 전`;
  if (d < 604800) return `${Math.floor(d / 86400)}일 전`;
  return new Date(dt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

const STATUS_LABEL: Record<string, string> = {
  REVIEW: "검토 대기",
  APPROVED: "검수 완료",
  PUBLISHED: "발행됨",
  SCHEDULED: "예약",
  DRAFT: "초안",
};

function statusBadge(s: string) {
  if (s === "REVIEW") return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">검토 대기</Badge>;
  if (s === "APPROVED") return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">검수 완료</Badge>;
  if (s === "PUBLISHED" || s === "SCHEDULED")
    return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{STATUS_LABEL[s]}</Badge>;
  return <Badge variant="secondary">{STATUS_LABEL[s] ?? s}</Badge>;
}

export default function ReviewPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("selected") ? Number(params.get("selected")) : null;
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [q, setQ] = useState("");

  const list = useQuery({
    queryKey: ["review-list"],
    queryFn: () => api.get<{ articles: ListItem[] }>(`/api/articles?limit=200&offset=0`),
  });

  const items = useMemo(() => {
    let arr = list.data?.articles ?? [];
    if (tab === "pending") arr = arr.filter((a) => a.status === "REVIEW" || a.status === "APPROVED");
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      arr = arr.filter((a) => a.title.toLowerCase().includes(t) || (a.keyword?.text ?? "").toLowerCase().includes(t));
    }
    return arr;
  }, [list.data, tab, q]);

  const pendingCount = (list.data?.articles ?? []).filter((a) => a.status === "REVIEW").length;

  const select = (id: number) => {
    const next = new URLSearchParams(params);
    next.set("selected", String(id));
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Inbox className="size-6" /> 검수함
            {pendingCount > 0 && <Badge className="bg-amber-500 text-white hover:bg-amber-500">{pendingCount}</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground">검토 대기 글을 훑어보고 바로 검수·발행·삭제하세요.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(320px,380px)_1fr]">
        {/* 목록 pane */}
        <div className="flex flex-col rounded-lg border bg-card">
          <div className="space-y-2 border-b p-3">
            <Tabs value={tab} onValueChange={(v) => setTab(v as "pending" | "all")}>
              <TabsList className="w-full">
                <TabsTrigger value="pending" className="flex-1">
                  검수 대기 {pendingCount > 0 && `(${pendingCount})`}
                </TabsTrigger>
                <TabsTrigger value="all" className="flex-1">
                  전체
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="제목·키워드 검색" className="h-9 pl-8" />
            </div>
          </div>
          <div className="max-h-[calc(100vh-15rem)] overflow-y-auto">
            {list.isPending ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                {tab === "pending" ? "검수 대기 글이 없습니다 🎉" : "글이 없습니다."}
              </p>
            ) : (
              items.map((a) => (
                <button
                  key={a.id}
                  onClick={() => select(a.id)}
                  className={cn(
                    "flex w-full gap-3 border-b p-3 text-left transition-colors hover:bg-accent",
                    selectedId === a.id && "bg-accent",
                  )}
                >
                  <div className="size-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                    {a.thumbnailUrl ? (
                      <img src={a.thumbnailUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <ImageOff className="size-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {statusBadge(a.status)}
                      {a.qualityScore != null && (
                        <span className="text-[11px] text-muted-foreground">{a.qualityScore}점</span>
                      )}
                      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{rel(a.createdAt)}</span>
                    </div>
                    <div className="mt-1 line-clamp-2 text-sm font-medium leading-snug">{a.title}</div>
                    {a.keyword && <div className="mt-0.5 truncate text-xs text-muted-foreground">#{a.keyword.text}</div>}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* 상세 pane */}
        <div className="rounded-lg border bg-card">
          {selectedId ? (
            <DetailPane
              key={selectedId}
              id={selectedId}
              onChanged={() => {
                qc.invalidateQueries({ queryKey: ["review-list"] });
              }}
            />
          ) : (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-2 text-muted-foreground">
              <Inbox className="size-10 opacity-40" />
              <p className="text-sm">왼쪽에서 글을 선택하세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailPane({ id, onChanged }: { id: number; onChanged: () => void }) {
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ["review-detail", id],
    queryFn: () => api.get<{ article: Detail }>(`/api/articles/${id}`),
  });

  const approve = useMutation({
    mutationFn: (a: Detail) =>
      api.put<{ status: string; autoPublished: string[] }>(`/api/articles/${id}`, {
        status: a.status === "APPROVED" ? "REVIEW" : "APPROVED",
        changeNote: a.status === "APPROVED" ? "검수 취소" : "검수 완료",
      }),
    onSuccess: (r) => {
      const names = (r.autoPublished ?? []).join(", ");
      if (r.status === "APPROVED") toast.success(names ? `검수 완료 → ${names} 자동 발행` : "검수 완료했습니다.");
      else toast.success("검수를 취소했습니다.");
      qc.invalidateQueries({ queryKey: ["review-detail", id] });
      onChanged();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) toast.error("다른 곳에서 먼저 수정됐습니다. 새로고침 해주세요.");
      else toast.error(e instanceof Error ? e.message : "실패");
    },
  });
  const del = useMutation({
    mutationFn: () => api.delete(`/api/articles/${id}`),
    onSuccess: () => {
      toast.success("삭제했습니다.");
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "실패"),
  });

  if (detail.isPending) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  }
  const a = detail.data?.article;
  if (!a) return <p className="p-6 text-sm text-muted-foreground">불러올 수 없습니다.</p>;

  return (
    <div className="flex h-full flex-col">
      {/* 액션 바 */}
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        {statusBadge(a.status)}
        {a.qualityScore != null && <span className="text-xs text-muted-foreground">품질 {a.qualityScore}점</span>}
        <div className="ml-auto flex flex-wrap gap-1.5">
          {a.status === "APPROVED" ? (
            <Button variant="outline" size="sm" onClick={() => approve.mutate(a)} disabled={approve.isPending}>
              {approve.isPending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
              검수 취소
            </Button>
          ) : (
            <Button size="sm" onClick={() => approve.mutate(a)} disabled={approve.isPending}>
              {approve.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              검수 완료
            </Button>
          )}
          <Link to={`/articles/${id}`}>
            <Button variant="outline" size="sm">
              <Pencil className="size-4" /> 전체 편집
            </Button>
          </Link>
          <a href={`https://hom2box.com/article.php?id=${id}`} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm">
              <ExternalLink className="size-4" /> 사이트
            </Button>
          </a>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-600"
            onClick={() => {
              if (confirm("이 글을 삭제할까요?")) del.mutate();
            }}
            disabled={del.isPending}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {/* 미리보기 */}
      <div className="max-h-[calc(100vh-16rem)] overflow-y-auto p-6">
        <h2 className="text-xl font-bold leading-snug">{a.title}</h2>
        {a.keyword?.text && <div className="mt-1 text-sm text-muted-foreground">#{a.keyword.text}</div>}
        {a.metaDescription && (
          <p className="mt-3 rounded-md border-l-2 border-primary bg-muted/50 p-3 text-sm text-muted-foreground">
            {a.metaDescription}
          </p>
        )}
        <Separator className="my-4" />
        {a.contentHtml ? (
          <div
            className="review-body text-sm leading-relaxed [&_h2]:mt-5 [&_h2]:text-base [&_h2]:font-bold [&_h3]:mt-4 [&_h3]:font-semibold [&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-lg [&_p]:my-2 [&_table]:my-3 [&_table]:w-full [&_table]:text-xs"
            dangerouslySetInnerHTML={{ __html: a.contentHtml }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">본문이 없습니다.</p>
        )}
      </div>
    </div>
  );
}
