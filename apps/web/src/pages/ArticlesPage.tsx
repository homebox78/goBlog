import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
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
  createdAt: string;
  keyword: { id: number; text: string } | null;
  thumbnailUrl: string | null;
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">글 관리</h1>
        <p className="text-sm text-muted-foreground">
          생성된 글의 검수·편집·발행 상태를 관리합니다. 오늘의 키워드에서 "글 생성"으로 시작하세요.
        </p>
      </div>

      {query.isPending ? (
        <Skeleton className="h-72" />
      ) : query.isError ? (
        <p className="text-sm text-destructive">글 목록을 불러오지 못했습니다.</p>
      ) : query.data.articles.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            아직 생성된 글이 없습니다.
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
                  <TableHead className="text-center">언어</TableHead>
                  <TableHead className="text-center">상태</TableHead>
                  <TableHead className="text-right">품질</TableHead>
                  <TableHead className="text-center">생성일</TableHead>
                  <TableHead className="text-center">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.articles.map((article) => {
                  const status = STATUS_BADGE[article.status] ?? {
                    label: article.status,
                    variant: "secondary" as const,
                  };
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
                      <TableCell className="text-center text-sm">{article.language}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {article.qualityScore ?? "—"}
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {new Date(article.createdAt).toLocaleDateString("ko-KR")}
                      </TableCell>
                      <TableCell className="text-center">
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
