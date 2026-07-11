import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, History, ImagePlus, Loader2, Save, Send, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

interface ArticleDetail {
  id: number;
  title: string;
  language: string;
  articleType: string;
  status: string;
  metaTitle: string | null;
  metaDescription: string | null;
  excerpt: string | null;
  contentMarkdown: string | null;
  contentHtml: string | null;
  qualityScore: number | null;
  qualityReport: {
    score: number;
    items: Array<{ label: string; ok: boolean; score: number; maxScore: number; note?: string }>;
    claimsToVerify: string[];
  } | null;
  keyword: { id: number; text: string } | null;
  schemas: Array<{ id: number; schemaType: string; isEnabled: boolean; jsonLd: unknown }>;
  media: Array<{
    id: number;
    kind: string;
    prompt: string | null;
    altText: string | null;
    position: number | null;
    webpUrl: string | null;
  }>;
  versions: Array<{ id: number; version: number; title: string; changeNote: string | null; createdAt: string }>;
}

export default function ArticleDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["article", id],
    queryFn: () => api.get<{ article: ArticleDetail }>(`/api/articles/${id}`),
  });

  const [form, setForm] = useState({
    title: "",
    metaTitle: "",
    metaDescription: "",
    excerpt: "",
    contentMarkdown: "",
  });

  useEffect(() => {
    const article = query.data?.article;
    if (article) {
      setForm({
        title: article.title,
        metaTitle: article.metaTitle ?? "",
        metaDescription: article.metaDescription ?? "",
        excerpt: article.excerpt ?? "",
        contentMarkdown: article.contentMarkdown ?? "",
      });
    }
  }, [query.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put<{ id: number; qualityScore: number }>(`/api/articles/${id}`, {
        ...form,
        changeNote: "수동 편집",
      }),
    onSuccess: (result) => {
      toast.success(`저장 완료 (품질 ${result.qualityScore}점)`);
      queryClient.invalidateQueries({ queryKey: ["article", id] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "저장 실패"),
  });

  const restoreMutation = useMutation({
    mutationFn: (version: number) =>
      api.post(`/api/articles/${id}/versions/${version}/restore`),
    onSuccess: () => {
      toast.success("버전을 복원했습니다.");
      queryClient.invalidateQueries({ queryKey: ["article", id] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "복원 실패"),
  });

  const imagesMutation = useMutation({
    mutationFn: () => api.post<{ generated: number; failed: number }>(`/api/articles/${id}/images`),
    onSuccess: (result) => {
      toast.success(`이미지 ${result.generated}장 생성${result.failed ? ` (실패 ${result.failed})` : ""}`);
      queryClient.invalidateQueries({ queryKey: ["article", id] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "이미지 생성 실패"),
  });

  const publishMutation = useMutation({
    mutationFn: (platform: string) =>
      api.post<{ jobId: number }>("/api/publish-jobs", { articleId: Number(id), platform }),
    onSuccess: () => {
      toast.success("발행 작업을 등록했습니다. 잠시 후 상태가 갱신됩니다.");
      queryClient.invalidateQueries({ queryKey: ["publish-jobs", id] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "발행 요청 실패"),
  });

  const jobsQuery = useQuery({
    queryKey: ["publish-jobs", id],
    queryFn: () =>
      api.get<{ jobs: Array<{ id: number; platform: string; status: string; publishedUrl: string | null; error: string | null }> }>(
        `/api/publish-jobs?articleId=${id}`,
      ),
    refetchInterval: 15000,
  });

  const schemaToggleMutation = useMutation({
    mutationFn: ({ schemaId, isEnabled }: { schemaId: number; isEnabled: boolean }) =>
      api.put(`/api/articles/${id}/schemas/${schemaId}`, { isEnabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["article", id] }),
  });

  if (query.isPending) {
    return <Skeleton className="h-96" />;
  }
  if (query.isError) {
    return <p className="text-sm text-destructive">글을 불러오지 못했습니다.</p>;
  }

  const article = query.data.article;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            to="/articles"
            className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" /> 글 목록
          </Link>
          <h1 className="truncate text-xl font-bold">{article.title}</h1>
          <p className="text-sm text-muted-foreground">
            키워드: {article.keyword?.text ?? "—"} · {article.language} · {article.articleType}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p className="text-2xl font-bold">
              {article.qualityScore ?? "—"}
              <span className="text-sm font-normal text-muted-foreground">점</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {article.qualityScore !== null && article.qualityScore >= 85
                ? "자동발행 기준 통과"
                : "85점 미만 — 자동발행 차단"}
            </p>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            저장
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-1.5">
                <Label>제목</Label>
                <Input
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>메타 제목</Label>
                  <Input
                    value={form.metaTitle}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, metaTitle: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>요약 (excerpt)</Label>
                  <Input
                    value={form.excerpt}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, excerpt: event.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>메타 설명 ({form.metaDescription.length}자)</Label>
                <Textarea
                  rows={2}
                  value={form.metaDescription}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, metaDescription: event.target.value }))
                  }
                />
              </div>

              <Tabs defaultValue="edit">
                <TabsList>
                  <TabsTrigger value="edit">본문 편집 (마크다운)</TabsTrigger>
                  <TabsTrigger value="preview">미리보기</TabsTrigger>
                </TabsList>
                <TabsContent value="edit">
                  <Textarea
                    rows={24}
                    className="font-mono text-sm"
                    value={form.contentMarkdown}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, contentMarkdown: event.target.value }))
                    }
                  />
                </TabsContent>
                <TabsContent value="preview">
                  <div
                    className="prose prose-sm max-w-none rounded-lg border p-4 dark:prose-invert [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mt-4 [&_h3]:font-semibold [&_table]:w-full [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:bg-muted [&_th]:p-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2"
                    dangerouslySetInnerHTML={{ __html: article.contentHtml ?? "" }}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    미리보기는 마지막 저장 시점 기준입니다.
                  </p>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">품질 검사</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {article.qualityReport?.items.map((item) => (
                <div key={item.label} className="flex items-start gap-2 text-xs">
                  {item.ok ? (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                  )}
                  <span>
                    {item.label}
                    {item.note && <span className="text-muted-foreground"> — {item.note}</span>}
                  </span>
                </div>
              ))}
              {(article.qualityReport?.claimsToVerify.length ?? 0) > 0 && (
                <div className="mt-3 rounded-md bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  <p className="mb-1 font-semibold">발행 전 확인 필요:</p>
                  <ul className="list-disc pl-4">
                    {article.qualityReport?.claimsToVerify.map((claim) => (
                      <li key={claim}>{claim}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">스키마 (JSON-LD)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {article.schemas.map((schema) => (
                <div key={schema.id} className="flex items-center justify-between text-sm">
                  <Badge variant="outline">{schema.schemaType}</Badge>
                  <Switch
                    checked={schema.isEnabled}
                    onCheckedChange={(value) =>
                      schemaToggleMutation.mutate({ schemaId: schema.id, isEnabled: value })
                    }
                  />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                상품(Product) 스키마는 실사용 검토 후 활성화하세요.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm">이미지 ({article.media.length})</CardTitle>
              <Button
                size="sm"
                variant="outline"
                disabled={imagesMutation.isPending}
                onClick={() => imagesMutation.mutate()}
              >
                {imagesMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="size-3.5" />
                )}
                Gemini 생성
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {imagesMutation.isPending && (
                <p className="text-xs text-muted-foreground">이미지 생성 중... (장당 10~20초)</p>
              )}
              {article.media.map((asset) => (
                <div key={asset.id} className="rounded-md border p-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {asset.kind === "FEATURED" ? "대표" : `본문 ${asset.position ?? ""}`}
                    </Badge>
                    {asset.webpUrl && <Badge className="text-[10px]">생성됨</Badge>}
                  </div>
                  {asset.webpUrl ? (
                    <img
                      src={asset.webpUrl}
                      alt={asset.altText ?? ""}
                      className="mt-2 max-h-28 rounded-md object-cover"
                    />
                  ) : (
                    <p className="mt-1 line-clamp-2 text-muted-foreground">{asset.prompt}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1 text-sm">
                <Send className="size-3.5" /> 발행
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={publishMutation.isPending}
                  onClick={() => publishMutation.mutate("BLOGGER")}
                >
                  Blogger 발행
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  disabled={publishMutation.isPending}
                  onClick={() => publishMutation.mutate("INSTAGRAM")}
                >
                  Instagram
                </Button>
              </div>
              {(jobsQuery.data?.jobs ?? []).slice(0, 5).map((job) => (
                <div key={job.id} className="rounded-md border p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span>{job.platform}</span>
                    <Badge
                      variant={
                        job.status === "FAILED"
                          ? "destructive"
                          : job.status === "SUCCEEDED"
                            ? "default"
                            : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {job.status}
                    </Badge>
                  </div>
                  {job.publishedUrl && (
                    <a
                      href={job.publishedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block truncate text-blue-600 hover:underline"
                    >
                      {job.publishedUrl}
                    </a>
                  )}
                  {job.error && <p className="mt-1 text-destructive">{job.error}</p>}
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                85점 미만은 자동발행이 차단됩니다. 네이버·티스토리는 Chrome 확장(6단계)에서
                지원됩니다.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1 text-sm">
                <History className="size-3.5" /> 버전
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {article.versions.map((version) => (
                <div key={version.id} className="flex items-center justify-between text-xs">
                  <span>
                    v{version.version}{" "}
                    <span className="text-muted-foreground">{version.changeNote}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    disabled={restoreMutation.isPending}
                    onClick={() => restoreMutation.mutate(version.version)}
                  >
                    복원
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
