import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, Loader2, Search, Trash2, Wand2, X } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ArticleListItem {
  id: number;
  title: string;
  language: string;
  articleType: string;
  status: string;
  qualityScore: number | null;
  adSource: string | null;
  adProduct: string | null;
  extensionDoneAt: string | null;
  createdAt: string;
  publishedAt: string | null; // 실제 발행 시각 (성공한 발행 중 가장 이른 것)
  keyword: { id: number; text: string } | null;
  thumbnailUrl: string | null;
  pendingImages: number;
  wordpress: { status: string; url: string | null } | null;
  blogger: { status: string; url: string | null } | null;
  naver: { status: string; url: string | null } | null;
  tistory: { status: string; url: string | null } | null;
}

type ListFilter = "all" | "review" | "noimage" | "lowq" | "unpublished" | "ad";
const FILTERS: Array<{ key: ListFilter; label: string }> = [
  { key: "all", label: "전체" },
  { key: "review", label: "검토 대기" },
  { key: "noimage", label: "이미지 없음" },
  { key: "lowq", label: "품질 미달" },
  { key: "unpublished", label: "미발행" },
  { key: "ad", label: "광고 있음" },
];

function matchFilter(article: ArticleListItem, filter: ListFilter, minScore: number): boolean {
  switch (filter) {
    case "review":
      return article.status === "REVIEW";
    case "noimage":
      return article.pendingImages > 0;
    case "lowq":
      return article.qualityScore !== null && article.qualityScore < minScore && article.status !== "PUBLISHED";
    case "unpublished":
      return article.status !== "PUBLISHED" && !article.extensionDoneAt;
    case "ad":
      return !!article.adProduct;
    default:
      return true;
  }
}

/** 목록 제목은 30자에서 자른다 — 긴 제목이 표 폭을 밀어 다른 열을 좁힌다 (전체 제목은 title 속성으로 남긴다) */
function shortTitle(title: string): string {
  return title.length > 30 ? `${title.slice(0, 30)}...` : title;
}

/** 발행 일시 — 년월일 + 시:분:초 (언제 나갔는지 초까지 남긴다) */
function formatStamp(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("ko-KR"),
    time: d.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }),
  };
}

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  DRAFT: { label: "초안", variant: "secondary" },
  REVIEW: { label: "검수 필요", variant: "secondary" },
  APPROVED: { label: "승인됨", variant: "default" },
  SCHEDULED: { label: "예약됨", variant: "default" },
  PUBLISHED: { label: "발행 완료", variant: "default" },
  FAILED: { label: "실패", variant: "destructive" },
};

/** 제목·키워드·광고상품을 한 번에 검색한다 (공백으로 나눈 모든 낱말이 다 들어 있어야 매칭 — AND). */
function matchSearch(article: ArticleListItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [article.title, article.keyword?.text, article.adProduct, String(article.id)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((word) => haystack.includes(word));
}

type SortKey = "title" | "keyword" | "ad" | "language" | "status" | "publish" | "quality" | "date";

// 상태는 사전순이 아니라 작업 흐름 순으로 정렬해야 쓸모가 있다 (초안 → … → 발행 완료).
const STATUS_ORDER: Record<string, number> = {
  DRAFT: 0,
  REVIEW: 1,
  APPROVED: 2,
  SCHEDULED: 3,
  PUBLISHED: 4,
  FAILED: 5,
};

/** 발행처 개수 — 어디에도 안 올라간 글을 위로 올리거나 다 올린 글을 모아 보려고 쓴다. */
function publishCount(a: ArticleListItem): number {
  return [a.wordpress, a.blogger, a.naver, a.tistory].filter((p) => p?.status === "SUCCEEDED").length;
}

function sortValue(a: ArticleListItem, key: SortKey): string | number {
  switch (key) {
    case "title":
      return a.title;
    case "keyword":
      return a.keyword?.text ?? "";
    case "ad":
      return a.adProduct ?? "";
    case "language":
      return a.language;
    case "status":
      return STATUS_ORDER[a.status] ?? 99;
    case "publish":
      return publishCount(a);
    case "quality":
      return a.qualityScore ?? -1; // 미채점은 맨 아래
    case "date":
      return new Date(a.createdAt).getTime();
  }
}

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
        className={`inline-flex items-center gap-0.5 hover:text-foreground ${
          active ? "font-bold text-foreground" : "text-muted-foreground"
        }`}
      >
        {children}
        <span className="text-[10px]">{active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </TableHead>
  );
}

export default function ArticlesPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = (searchParams.get("filter") as ListFilter) || "all";
  const search = searchParams.get("q") ?? "";
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "date", dir: "desc" });
  // 행별 진행 중 작업 (이미지 생성/보정은 수십 초 걸림)
  const [busy, setBusy] = useState<Record<number, "images" | "improve">>({});

  // 필터·검색어를 한 곳에서 갱신한다 — 따로 setSearchParams를 부르면 서로를 지운다.
  const updateParams = (patch: { filter?: ListFilter; q?: string }) => {
    const next: Record<string, string> = {};
    const nextFilter = patch.filter ?? filter;
    const nextQ = patch.q ?? search;
    if (nextFilter !== "all") next.filter = nextFilter;
    if (nextQ.trim()) next.q = nextQ;
    setSearchParams(next, { replace: true });
  };

  const toggleSort = (k: SortKey) =>
    setSort((prev) =>
      prev.key === k
        ? { key: k, dir: prev.dir === "asc" ? "desc" : "asc" }
        : // 숫자·날짜는 큰 값부터, 글자는 가나다순이 자연스럽다
          { key: k, dir: ["title", "keyword", "ad", "language"].includes(k) ? "asc" : "desc" },
    );

  // 더 보기 — 서버 한도(기본 100)에 걸려 옛 글이 조용히 숨는 것을 막는다
  const [limit, setLimit] = useState(100);
  const query = useQuery({
    queryKey: ["articles", limit],
    queryFn: () =>
      api.get<{ total: number; minQualityScore: number; articles: ArticleListItem[] }>(
        `/api/articles?limit=${limit}`,
      ),
    placeholderData: (prev) => prev, // limit 증가 시 화면이 비지 않게 이전 데이터 유지
  });

  // 품질 기준선 — 설정값(서버). 85 하드코딩이면 설정을 90으로 올려도 목록이 거짓말한다.
  const minScore = query.data?.minQualityScore ?? 85;

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/articles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      toast.success("글을 삭제했습니다.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "삭제 실패"),
  });

  // 목록에서 바로 검수 완료(승인) 토글 — REVIEW↔APPROVED. 승인 시 Blogger·워드프레스 자동발행.
  const approveMutation = useMutation({
    mutationFn: (a: ArticleListItem) =>
      api.put<{ status: string; autoPublished: string[] }>(`/api/articles/${a.id}`, {
        status: a.status === "APPROVED" ? "REVIEW" : "APPROVED",
        changeNote: a.status === "APPROVED" ? "검수 취소" : "검수 완료",
      }),
    onSuccess: (r) => {
      const names = (r.autoPublished ?? [])
        .map((p) => (p === "BLOGGER" ? "Blogger" : p === "WORDPRESS" ? "워드프레스" : p))
        .join(" · ");
      if (r.status === "APPROVED") toast.success(names ? `검수 완료 → ${names} 자동 발행` : "검수 완료했습니다.");
      else toast.success("검수 대기로 되돌렸습니다.");
      queryClient.invalidateQueries({ queryKey: ["articles"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "상태 변경 실패"),
  });

  // WordPress·Blogger 발행 (미발행/실패 시 클릭)
  const [publishing, setPublishing] = useState<string | null>(null); // `${id}:${platform}`
  const publishMutation = useMutation({
    mutationFn: ({ id, platform }: { id: number; platform: "WORDPRESS" | "BLOGGER" }) =>
      api.post(`/api/publish-jobs`, { articleId: id, platform }),
    onSuccess: (_r, v) => {
      toast.success(`${v.platform === "WORDPRESS" ? "워드프레스" : "Blogger"} 발행을 시작했습니다.`);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["articles"] }), 1500);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "발행 실패"),
    onSettled: () => setPublishing(null),
  });

  const runRowAction = async (id: number, kind: "images" | "improve") => {
    setBusy((prev) => ({ ...prev, [id]: kind }));
    try {
      if (kind === "images") {
        const r = await api.post<{ generated: number; failed: number }>(`/api/articles/${id}/images`, {});
        toast.success(`이미지 ${r.generated}장 생성${r.failed ? ` (실패 ${r.failed})` : ""}`);
      } else {
        const r = await api.post<{ before: number; after: number }>(`/api/articles/${id}/improve`, {});
        toast.success(`보정 완료: ${r.before} → ${r.after}점`);
      }
      queryClient.invalidateQueries({ queryKey: ["articles"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "실행 실패");
    } finally {
      setBusy((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const all = query.data?.articles ?? [];
  const filtered = all
    .filter((a) => matchFilter(a, filter, minScore) && matchSearch(a, search))
    .sort((a, b) => {
      const va = sortValue(a, sort.key);
      const vb = sortValue(b, sort.key);
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "ko"); // 한글 가나다순
      return sort.dir === "asc" ? cmp : -cmp;
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">글 관리</h1>
        <p className="text-sm text-muted-foreground">
          생성된 글의 검수·편집·발행 상태를 관리합니다. 오늘의 키워드에서 "글 생성"으로 시작하세요.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(({ key, label }) => {
            // 개수는 검색어까지 반영해야 "필터를 눌렀는데 0건"인 상황이 안 생긴다.
            const count = key === "all" ? undefined : all.filter((a) => matchFilter(a, key, minScore) && matchSearch(a, search)).length;
            return (
              <button
                key={key}
                type="button"
                onClick={() => updateParams({ filter: key })}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  filter === key ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {label}
                {count !== undefined && count > 0 && <span className="ml-1 font-semibold">{count}</span>}
              </button>
            );
          })}
        </div>

        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => updateParams({ q: e.target.value })}
            placeholder="제목·키워드·광고상품 검색"
            className="pl-8"
          />
          {search && (
            <button
              type="button"
              aria-label="검색어 지우기"
              onClick={() => updateParams({ q: "" })}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {search.trim() && !query.isPending && (
        <p className="-mt-3 text-xs text-muted-foreground">
          "{search.trim()}" 검색 결과 <span className="font-semibold text-foreground">{filtered.length}건</span>
        </p>
      )}

      {query.isPending ? (
        <Skeleton className="h-72" />
      ) : query.isError ? (
        <p className="text-sm text-destructive">글 목록을 불러오지 못했습니다.</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            {search.trim()
              ? `"${search.trim()}"와(과) 일치하는 글이 없습니다.`
              : filter === "all"
                ? "아직 생성된 글이 없습니다."
                : "조건에 맞는 글이 없습니다. ✓ 다 처리됐어요!"}
          </CardContent>
        </Card>
      ) : (
        <>
        {/* 모바일: 표 대신 카드 목록 (가로 스크롤 없이 한 화면에서 읽고 조작한다) */}
        <div className="space-y-3 md:hidden">
          {filtered.map((article) => {
            const status = STATUS_BADGE[article.status] ?? {
              label: article.status,
              variant: "secondary" as const,
            };
            const rowBusy = busy[article.id];
            return (
              <Card key={article.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex gap-3">
                    <Link to={`/articles/${article.id}`} className="shrink-0">
                      {article.thumbnailUrl ? (
                        <img
                          src={article.thumbnailUrl}
                          alt=""
                          className="h-14 w-20 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-20 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
                          이미지 없음
                        </div>
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/articles/${article.id}`}
                        className="line-clamp-2 text-sm font-medium break-keep hover:underline"
                        title={article.title}
                      >
                        {shortTitle(article.title)}
                      </Link>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {article.keyword?.text ?? "키워드 없음"} ·{" "}
                        {article.publishedAt
                          ? `발행 ${formatStamp(article.publishedAt).date} ${formatStamp(article.publishedAt).time}`
                          : `생성 ${new Date(article.createdAt).toLocaleDateString("ko-KR")}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {article.status === "PUBLISHED" ? (
                      <Badge variant={status.variant}>{status.label}</Badge>
                    ) : (
                      <button
                        type="button"
                        disabled={approveMutation.isPending}
                        onClick={() => approveMutation.mutate(article)}
                      >
                        <Badge
                          variant={article.status === "APPROVED" ? "default" : "secondary"}
                          className={
                            article.status === "APPROVED"
                              ? "cursor-pointer bg-emerald-600"
                              : "cursor-pointer"
                          }
                        >
                          {approveMutation.isPending && approveMutation.variables?.id === article.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : article.status === "APPROVED" ? (
                            "✓ 승인됨"
                          ) : (
                            "검수 완료 →"
                          )}
                        </Badge>
                      </button>
                    )}
                    <Badge variant="outline" className="font-mono">
                      {article.qualityScore ?? "—"}점
                    </Badge>
                    {article.adProduct && (
                      // Badge는 inline-flex라 truncate가 안 먹는다 — 안쪽 span에 걸고 배지는 폭만 제한한다
                      <Badge variant="outline" className="max-w-full min-w-0">
                        <span className="truncate">
                          {article.adSource === "COUPANG" ? "쿠팡" : "네이버"} · {article.adProduct}
                        </span>
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                    <div className="flex flex-wrap items-center gap-1">
                      <PublishChip
                        label="WordPress"
                        short="W"
                        state={article.wordpress}
                        busy={publishing === `${article.id}:WORDPRESS`}
                        onPublish={() => {
                          setPublishing(`${article.id}:WORDPRESS`);
                          publishMutation.mutate({ id: article.id, platform: "WORDPRESS" });
                        }}
                      />
                      <PublishChip
                        label="Blogger"
                        short="B"
                        state={article.blogger}
                        busy={publishing === `${article.id}:BLOGGER`}
                        onPublish={() => {
                          setPublishing(`${article.id}:BLOGGER`);
                          publishMutation.mutate({ id: article.id, platform: "BLOGGER" });
                        }}
                      />
                      <ExtLinkChip label="네이버" short="N" state={article.naver} />
                      <ExtLinkChip label="티스토리" short="T" state={article.tistory} />
                    </div>

                    <div className="flex items-center gap-0.5">
                      {article.pendingImages > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`이미지 ${article.pendingImages}장 생성`}
                          disabled={!!rowBusy}
                          onClick={() => runRowAction(article.id, "images")}
                        >
                          {rowBusy === "images" ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <ImagePlus className="size-4 text-blue-600" />
                          )}
                        </Button>
                      )}
                      {article.qualityScore !== null && article.qualityScore < minScore && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`품질 보정 (현재 ${article.qualityScore}점)`}
                          disabled={!!rowBusy}
                          onClick={() => runRowAction(article.id, "improve")}
                        >
                          {rowBusy === "improve" ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Wand2 className="size-4 text-amber-600" />
                          )}
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="글 삭제">
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>글을 삭제할까요?</AlertDialogTitle>
                            <AlertDialogDescription>
                              "{article.title}" 글과 관련 이미지·발행 기록이 모두 삭제됩니다. 되돌릴 수 없습니다.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>취소</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(article.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              삭제
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="hidden md:block">
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">이미지</TableHead>
                  <SortHead k="title" sort={sort} onSort={toggleSort}>제목</SortHead>
                  <SortHead k="keyword" sort={sort} onSort={toggleSort} className="text-center">키워드</SortHead>
                  <SortHead k="ad" sort={sort} onSort={toggleSort} className="text-center">광고</SortHead>
                  <SortHead k="language" sort={sort} onSort={toggleSort} className="text-center">언어</SortHead>
                  <SortHead k="status" sort={sort} onSort={toggleSort} className="text-center">상태</SortHead>
                  <SortHead k="publish" sort={sort} onSort={toggleSort} className="text-center">발행처</SortHead>
                  <SortHead k="quality" sort={sort} onSort={toggleSort} className="text-right">품질</SortHead>
                  <SortHead k="date" sort={sort} onSort={toggleSort} className="text-center">생성일</SortHead>
                  <TableHead className="text-center">발행일시</TableHead>
                  <TableHead className="text-center">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((article) => {
                  const status = STATUS_BADGE[article.status] ?? {
                    label: article.status,
                    variant: "secondary" as const,
                  };
                  const rowBusy = busy[article.id];
                  return (
                    <TableRow key={article.id}>
                      <TableCell>
                        <Link to={`/articles/${article.id}`} className="block">
                          {article.thumbnailUrl ? (
                            <img
                              src={article.thumbnailUrl}
                              alt=""
                              className="h-10 w-14 rounded object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-14 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
                              없음
                            </div>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/articles/${article.id}`}
                          className="font-medium hover:underline"
                          title={article.title}
                        >
                          {shortTitle(article.title)}
                        </Link>
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {article.keyword?.text ?? "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {article.adProduct ? (
                          <span
                            className="inline-flex max-w-40 items-center gap-1 truncate rounded px-1.5 py-0.5 text-xs font-medium"
                            style={{
                              background: article.adSource === "COUPANG" ? "#fdeaea" : "#e9f9ef",
                              color: article.adSource === "COUPANG" ? "#c41f22" : "#03a44e",
                            }}
                            title={`${article.adSource === "COUPANG" ? "쿠팡" : "네이버"} · ${article.adProduct}`}
                          >
                            {article.adSource === "COUPANG" ? "쿠팡" : "네이버"} · {article.adProduct}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">없음</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm">{article.language}</TableCell>
                      <TableCell className="text-center">
                        {article.status === "PUBLISHED" ? (
                          <Badge variant={status.variant}>{status.label}</Badge>
                        ) : (
                          <button
                            type="button"
                            disabled={approveMutation.isPending}
                            onClick={() => approveMutation.mutate(article)}
                            title={
                              article.status === "APPROVED"
                                ? "클릭하면 검수 대기로 되돌립니다"
                                : "클릭하면 검수 완료(승인) — Blogger·워드프레스 자동 발행"
                            }
                            className="transition-transform hover:scale-105 disabled:opacity-50"
                          >
                            <Badge
                              variant={article.status === "APPROVED" ? "default" : "secondary"}
                              className={
                                article.status === "APPROVED"
                                  ? "cursor-pointer bg-emerald-600 hover:bg-emerald-700"
                                  : "cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-950"
                              }
                            >
                              {approveMutation.isPending && approveMutation.variables?.id === article.id ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : article.status === "APPROVED" ? (
                                "✓ 승인됨"
                              ) : (
                                "검수 완료 →"
                              )}
                            </Badge>
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <PublishChip
                            label="WordPress"
                        short="W"
                            state={article.wordpress}
                            busy={publishing === `${article.id}:WORDPRESS`}
                            onPublish={() => {
                              setPublishing(`${article.id}:WORDPRESS`);
                              publishMutation.mutate({ id: article.id, platform: "WORDPRESS" });
                            }}
                          />
                          <PublishChip
                            label="Blogger"
                        short="B"
                            state={article.blogger}
                            busy={publishing === `${article.id}:BLOGGER`}
                            onPublish={() => {
                              setPublishing(`${article.id}:BLOGGER`);
                              publishMutation.mutate({ id: article.id, platform: "BLOGGER" });
                            }}
                          />
                          {/* 네이버·티스토리는 확장 발행 — 발행됨이면 링크만 표시 */}
                          <ExtLinkChip label="네이버" short="N" state={article.naver} />
                          <ExtLinkChip label="티스토리" short="T" state={article.tistory} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {article.qualityScore ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-center text-sm text-muted-foreground">
                        {new Date(article.createdAt).toLocaleDateString("ko-KR")}
                        <span className="block text-xs">
                          {new Date(article.createdAt).toLocaleTimeString("ko-KR", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-center text-sm text-muted-foreground">
                        {article.publishedAt ? (
                          <>
                            {formatStamp(article.publishedAt).date}
                            <span className="block font-mono text-xs">
                              {formatStamp(article.publishedAt).time}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs">미발행</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          {article.pendingImages > 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title={`이미지 ${article.pendingImages}장 생성`}
                              disabled={!!rowBusy}
                              onClick={() => runRowAction(article.id, "images")}
                            >
                              {rowBusy === "images" ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <ImagePlus className="size-4 text-blue-600" />
                              )}
                            </Button>
                          )}
                          {article.qualityScore !== null && article.qualityScore < minScore && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title={`품질 보정 (현재 ${article.qualityScore}점)`}
                              disabled={!!rowBusy}
                              onClick={() => runRowAction(article.id, "improve")}
                            >
                              {rowBusy === "improve" ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Wand2 className="size-4 text-amber-600" />
                              )}
                            </Button>
                          )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="글 삭제">
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>글을 삭제할까요?</AlertDialogTitle>
                              <AlertDialogDescription>
                                "{article.title}" 글과 관련 이미지·발행 기록이 모두 삭제됩니다. 되돌릴 수 없습니다.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>취소</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(article.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {deleteMutation.isPending ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  "삭제"
                                )}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {(query.data?.total ?? 0) > (query.data?.articles.length ?? 0) && (
          <div className="flex items-center justify-center gap-3 py-2">
            <span className="text-xs text-muted-foreground">
              전체 {query.data!.total}건 중 {query.data!.articles.length}건 표시
            </span>
            <Button variant="outline" size="sm" onClick={() => setLimit((prev) => prev + 100)}>
              더 보기
            </Button>
          </div>
        )}
        </>
      )}
    </div>
  );
}

/** WordPress·Blogger 발행 상태 칩 — 발행됨(링크)/발행중/실패(재시도)/미발행(발행 버튼) */
function PublishChip({
  label,
  short,
  state,
  busy,
  onPublish,
}: {
  label: string;
  short: string; // 화면 표시는 약자(W·B·N·T) — 발행처 열이 4개라 이름을 다 쓰면 표가 밀린다
  state: { status: string; url: string | null } | null;
  busy: boolean;
  onPublish: () => void;
}) {
  if (busy || state?.status === "QUEUED" || state?.status === "RUNNING") {
    return (
      <span
        title={`${label} 발행 중`}
        className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground"
      >
        <Loader2 className="size-3 animate-spin" /> {short}
      </span>
    );
  }
  if (state?.status === "SUCCEEDED") {
    const chip = (
      <span className="inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        ✓{short}
      </span>
    );
    return state.url ? (
      <a href={state.url} target="_blank" rel="noreferrer" title={`${label} 발행글 보기`}>
        {chip}
      </a>
    ) : (
      chip
    );
  }
  // 미발행 또는 실패 → 발행 버튼
  const failed = state?.status === "FAILED";
  return (
    <button
      type="button"
      onClick={onPublish}
      title={failed ? `${label} 발행 실패 — 다시 시도` : `${label}에 발행`}
      className={`rounded border px-1.5 py-0.5 text-[11px] transition-colors hover:bg-muted ${
        failed ? "border-destructive/50 text-destructive" : "text-muted-foreground"
      }`}
    >
      {failed ? `↻${short}` : `+${short}`}
    </button>
  );
}

/** 확장 발행 플랫폼(네이버·티스토리) — 발행됨이면 게시글 링크, 아니면 미표시(발행 버튼 없음) */
function ExtLinkChip({
  label,
  short,
  state,
}: {
  label: string;
  short: string;
  state: { status: string; url: string | null } | null;
}) {
  if (state?.status !== "SUCCEEDED") return null; // 미발행이면 아무것도 안 보임 (확장에서만 발행)
  const chip = (
    <span className="inline-flex items-center gap-0.5 rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
      ✓{short}
    </span>
  );
  return state.url ? (
    <a href={state.url} target="_blank" rel="noreferrer" title={`${label} 발행글 보기`}>
      {chip}
    </a>
  ) : (
    <span title={`${label} 발행됨 (URL 미기록)`}>{chip}</span>
  );
}
