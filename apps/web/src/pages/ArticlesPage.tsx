import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
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

interface ArticleListItem {
  id: number;
  title: string;
  language: string;
  articleType: string;
  status: string;
  qualityScore: number | null;
  createdAt: string;
  keyword: { id: number; text: string } | null;
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
  const query = useQuery({
    queryKey: ["articles"],
    queryFn: () => api.get<{ articles: ArticleListItem[] }>("/api/articles"),
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
                  <TableHead>제목</TableHead>
                  <TableHead className="text-center">키워드</TableHead>
                  <TableHead className="text-center">언어</TableHead>
                  <TableHead className="text-center">상태</TableHead>
                  <TableHead className="text-right">품질</TableHead>
                  <TableHead className="text-center">생성일</TableHead>
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
