import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, Loader2, Trash2, Wand2 } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  keyword: { id: number; text: string } | null;
  thumbnailUrl: string | null;
  pendingImages: number;
}

type ListFilter = "all" | "review" | "noimage" | "lowq" | "unpublished" | "ad";
const FILTERS: Array<{ key: ListFilter; label: string }> = [
  { key: "all", label: "전체" },
  { key: "review", label: "검토 대기" },
  { key: "noimage", label: "이미지 없음" },
  { key: "lowq", label: "85점 미만" },
  { key: "unpublished", label: "미발행" },
  { key: "ad", label: "광고 있음" },
];

function matchFilter(article: ArticleListItem, filter: ListFilter): boolean {
  switch (filter) {
    case "review":
      return article.status === "REVIEW";
    case "noimage":
      return article.pendingImages > 0;
    case "lowq":
      return article.qualityScore !== null && article.qualityScore < 85 && article.status !== "PUBLISHED";
    case "unpublished":
      return article.status !== "PUBLISHED" && !article.extensionDoneAt;
    case "ad":
      return !!article.adProduct;
    default:
      return true;
  }
}

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  DRAFT: { label: "초안", variant: "secondary" },
  REVIEW: { label: "검수 필요", variant: "secondary" },
  APPROVED: { label: "승인됨", variant: "default" },
  SCHEDULED: { label: "예약됨", variant: "default" },
  PUBLISHED: { label: "발행 완료", variant: "default" },
  FAILED: { label: "실패", variant: "destructive" },
};

export default function ArticlesPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = (searchParams.get("filter") as ListFilter) || "all";
  // 행별 진행 중 작업 (이미지 생성/보정은 수십 초 걸림)
  const [busy, setBusy] = useState<Record<number, "images" | "improve">>({});

  const query = useQuery({
    queryKey: ["articles"],
    queryFn: () => api.get<{ articles: ArticleListItem[] }>("/api/articles"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/articles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      toast.success("글을 삭제했습니다.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "삭제 실패"),
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

  const filtered = (query.data?.articles ?? []).filter((a) => matchFilter(a, filter));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">글 관리</h1>
        <p className="text-sm text-muted-foreground">
          생성된 글의 검수·편집·발행 상태를 관리합니다. 오늘의 키워드에서 "글 생성"으로 시작하세요.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map(({ key, label }) => {
          const count = key === "all" ? undefined : (query.data?.articles ?? []).filter((a) => matchFilter(a, key)).length;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSearchParams(key === "all" ? {} : { filter: key })}
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

      {query.isPending ? (
        <Skeleton className="h-72" />
      ) : query.isError ? (
        <p className="text-sm text-destructive">글 목록을 불러오지 못했습니다.</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            {filter === "all" ? "아직 생성된 글이 없습니다." : "조건에 맞는 글이 없습니다. ✓ 다 처리됐어요!"}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">이미지</TableHead>
                  <TableHead>제목</TableHead>
                  <TableHead className="text-center">키워드</TableHead>
                  <TableHead className="text-center">광고</TableHead>
                  <TableHead className="text-center">언어</TableHead>
                  <TableHead className="text-center">상태</TableHead>
                  <TableHead className="text-right">품질</TableHead>
                  <TableHead className="text-center">생성일</TableHead>
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
                        >
                          {article.title}
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
                        <Badge variant={status.variant}>{status.label}</Badge>
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
                          {article.qualityScore !== null && article.qualityScore < 85 && (
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
      )}
    </div>
  );
}
