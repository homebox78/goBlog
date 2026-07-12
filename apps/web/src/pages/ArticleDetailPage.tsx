import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, History, ImagePlus, Loader2, Save, Send, Sparkles, Trash2, Upload, XCircle } from "lucide-react";
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
    policyRisks?: string[];
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
  instagram: {
    slides: Array<{ position: number; title: string; summary: string }>;
    caption: string;
    hashtags: string[];
  } | null;
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

  const improveMutation = useMutation({
    mutationFn: () => api.post<{ before: number; after: number; passed: boolean }>(`/api/articles/${id}/improve`),
    onSuccess: (r) => {
      if (r.passed) toast.success(`품질 보정 완료: ${r.before} → ${r.after}점 (85점 통과!)`);
      else toast(`품질 보정: ${r.before} → ${r.after}점 (아직 85점 미만, 다시 시도 가능)`);
      queryClient.invalidateQueries({ queryKey: ["article", id] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "보정 실패"),
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

  const contentRef = useRef<HTMLTextAreaElement>(null);

  const uploadImageMutation = useMutation({
    mutationFn: (dataUrl: string) =>
      api.post<{ figure: string }>(`/api/articles/${id}/images/upload`, { dataUrl, kind: "CONTENT" }),
    onSuccess: async (r) => {
      // 본문 소스에서 커서(클릭) 위치에 삽입하고 즉시 저장 (미디어목록·미리보기 반영)
      const ta = contentRef.current;
      const md = ta?.value ?? form.contentMarkdown;
      const pos = ta ? ta.selectionStart : md.length;
      const next = `${md.slice(0, pos)}\n\n${r.figure}\n\n${md.slice(pos)}`.replace(/\n{3,}/g, "\n\n");
      setForm((prev) => ({ ...prev, contentMarkdown: next }));
      await api.put(`/api/articles/${id}`, { ...form, contentMarkdown: next, changeNote: "이미지 삽입" });
      queryClient.invalidateQueries({ queryKey: ["article", id] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      toast.success("커서 위치에 이미지를 삽입했습니다.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "이미지 업로드 실패"),
  });

  const deleteImageMutation = useMutation({
    mutationFn: (media: { id: number; webpUrl: string | null }) =>
      api.delete(`/api/articles/${id}/images/${media.id}`).then(() => media),
    onSuccess: async (media) => {
      // 본문에서 해당 이미지 figure 제거 후 저장
      if (media.webpUrl) {
        const ta = contentRef.current;
        const md = ta?.value ?? form.contentMarkdown;
        const esc = media.webpUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const cleaned = md
          .replace(new RegExp(`<figure[^>]*>(?:(?!</figure>)[\\s\\S])*?${esc}(?:(?!</figure>)[\\s\\S])*?</figure>`, "g"), "")
          .replace(/\n{3,}/g, "\n\n");
        setForm((prev) => ({ ...prev, contentMarkdown: cleaned }));
        await api.put(`/api/articles/${id}`, { ...form, contentMarkdown: cleaned, changeNote: "이미지 삭제" });
      }
      queryClient.invalidateQueries({ queryKey: ["article", id] });
      toast.success("이미지를 삭제했습니다.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "이미지 삭제 실패"),
  });

  const [bannerInput, setBannerInput] = useState("");

  // 이 글과 매칭되는 누적 대량매칭 상품 (배너 삽입 추천)
  const matchedHitsQuery = useQuery({
    queryKey: ["article-matched-hits", id],
    queryFn: () =>
      api.get<{ keyword: string; hits: Array<{ id: number; source: string; name: string; keyword: string }> }>(
        `/api/articles/${id}/matched-hits`,
      ),
  });
  const matchedHits = matchedHitsQuery.data?.hits ?? [];

  const bannerMutation = useMutation({
    mutationFn: () =>
      api.post<{ banner: string; disclosure: string }>(`/api/articles/${id}/banner`, { input: bannerInput }),
    onSuccess: async (r) => {
      // 본문 소스에서 커서(클릭) 위치에 배너 삽입 후 저장 (중복 삽입 가능)
      const ta = contentRef.current;
      const md = ta?.value ?? form.contentMarkdown;
      const pos = ta ? ta.selectionStart : md.length;
      let next = `${md.slice(0, pos)}\n\n${r.banner}\n\n${md.slice(pos)}`.replace(/\n{3,}/g, "\n\n");
      // 대가성 안내 문구가 본문에 없으면 최상단에 자동 추가 (쿠팡/네이버 필수 표기).
      // r.disclosure는 이미 가이드 준수 박스 HTML이므로 그대로 삽입한다.
      if (r.disclosure && !next.includes("활동의 일환")) {
        next = `${r.disclosure}\n\n${next}`;
      }
      setForm((prev) => ({ ...prev, contentMarkdown: next }));
      await api.put(`/api/articles/${id}`, { ...form, contentMarkdown: next, changeNote: "배너 삽입" });
      queryClient.invalidateQueries({ queryKey: ["article", id] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      toast.success("배너를 삽입했습니다. (대가성 문구 자동 확인)");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "배너 생성 실패"),
  });

  // ── 미리보기에서 배너·이미지 클릭 선택 → 삭제/위·아래 이동/드래그 재배치 ──────────
  const previewRef = useRef<HTMLDivElement>(null);
  const [selBanner, setSelBanner] = useState<{ needle: string; nth: number; kind: "배너" | "이미지" } | null>(null);
  const dropTargetRef = useRef<{ el: HTMLElement; before: boolean } | null>(null);

  const isBannerAnchor = (el: Element | null): el is HTMLAnchorElement =>
    !!el &&
    el.tagName === "A" &&
    (/sponsored/.test(el.getAttribute("rel") ?? "") ||
      /link\.coupang|coupang\.com|naver\.me|smartstore|brandconnect/i.test(el.getAttribute("href") ?? ""));

  // 선택 가능한 블록: 제휴 배너 <a> 또는 본문 이미지 <figure>. 마크다운 소스에서 찾을 needle을 만든다.
  const selectableInfo = (
    target: HTMLElement,
  ): { el: HTMLElement; needle: string; nth: number; kind: "배너" | "이미지" } | null => {
    const a = target.closest("a");
    if (isBannerAnchor(a)) {
      const needle = `href="${a.getAttribute("href") ?? ""}"`;
      const same = Array.from(previewRef.current?.querySelectorAll("a") ?? []).filter(
        (x) => isBannerAnchor(x) && `href="${x.getAttribute("href") ?? ""}"` === needle,
      );
      return { el: a, needle, nth: Math.max(0, same.indexOf(a)), kind: "배너" };
    }
    const fig = target.closest("figure");
    const img = fig?.querySelector("img");
    if (fig && img?.getAttribute("src")) {
      const needle = `src="${img.getAttribute("src")}"`;
      const same = Array.from(previewRef.current?.querySelectorAll("figure") ?? []).filter(
        (f) => f.querySelector("img")?.getAttribute("src") === img.getAttribute("src"),
      );
      return { el: fig as HTMLElement, needle, nth: Math.max(0, same.indexOf(fig)), kind: "이미지" };
    }
    return null;
  };

  const clearBannerSelection = () => {
    previewRef.current?.querySelectorAll<HTMLElement>("[data-banner-sel]").forEach((x) => {
      x.removeAttribute("data-banner-sel");
      x.style.outline = "";
      x.style.cursor = "";
    });
    setSelBanner(null);
  };

  const splitBlocks = (md: string) => md.split(/\n{2,}/);
  const bannerBlockIndex = (blocks: string[], needle: string, nth: number) => {
    const idxs = blocks.map((b, i) => (b.includes(needle) ? i : -1)).filter((i) => i >= 0);
    return idxs[nth] ?? -1;
  };

  // 미리보기 요소 → 마크다운 블록 인덱스 (href/src 속성 → 텍스트 → 위치 순으로 매칭)
  const findBlockIndexForEl = (el: HTMLElement, blocks: string[]): number => {
    const attrEl = el.matches("[href],[src]") ? el : el.querySelector("[href],[src]");
    const attr = attrEl?.getAttribute("href") ?? attrEl?.getAttribute("src");
    if (attr) {
      const i = blocks.findIndex((b) => b.includes(attr));
      if (i >= 0) return i;
    }
    const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 20);
    if (text.length >= 6) {
      const norm = (s: string) => s.replace(/[#*_>|`[\]]/g, "").replace(/\s+/g, " ");
      const i = blocks.findIndex((b) => norm(b).includes(text));
      if (i >= 0) return i;
    }
    const idx = Array.from(el.parentElement?.children ?? []).indexOf(el);
    return Math.max(0, Math.min(idx, blocks.length - 1));
  };

  const saveMarkdown = async (next: string, note: string) => {
    setForm((prev) => ({ ...prev, contentMarkdown: next }));
    await api.put(`/api/articles/${id}`, { ...form, contentMarkdown: next, changeNote: note });
    queryClient.invalidateQueries({ queryKey: ["article", id] });
    queryClient.invalidateQueries({ queryKey: ["articles"] });
  };

  const deleteSelectedBanner = async () => {
    if (!selBanner) return;
    const blocks = splitBlocks(form.contentMarkdown);
    const bi = bannerBlockIndex(blocks, selBanner.needle, selBanner.nth);
    if (bi < 0) return toast.error(`본문 소스에서 ${selBanner.kind}를 찾지 못했습니다.`);
    blocks.splice(bi, 1);
    const kind = selBanner.kind;
    clearBannerSelection();
    await saveMarkdown(blocks.join("\n\n"), `${kind} 삭제`);
    toast.success(`${kind}를 삭제했습니다.`);
  };

  const moveSelectedBanner = async (dir: -1 | 1) => {
    if (!selBanner) return;
    const blocks = splitBlocks(form.contentMarkdown);
    const bi = bannerBlockIndex(blocks, selBanner.needle, selBanner.nth);
    if (bi < 0) return toast.error(`본문 소스에서 ${selBanner.kind}를 찾지 못했습니다.`);
    const ti = bi + dir;
    if (ti < 0 || ti >= blocks.length) return;
    const [blk] = blocks.splice(bi, 1);
    blocks.splice(ti, 0, blk);
    const kind = selBanner.kind;
    clearBannerSelection();
    await saveMarkdown(blocks.join("\n\n"), `${kind} 위치 이동`);
    toast.success(dir < 0 ? `${kind}를 위로 옮겼습니다.` : `${kind}를 아래로 옮겼습니다.`);
  };

  const onPreviewClick = (e: React.MouseEvent) => {
    const info = selectableInfo(e.target as HTMLElement);
    if (info) {
      e.preventDefault(); // 링크 이동 방지
      clearBannerSelection();
      info.el.setAttribute("data-banner-sel", "1");
      info.el.style.outline = "3px dashed #e52528";
      info.el.style.cursor = "grab";
      info.el.setAttribute("draggable", "true");
      setSelBanner({ needle: info.needle, nth: info.nth, kind: info.kind });
    } else {
      clearBannerSelection();
    }
  };

  const clearDropIndicator = () => {
    if (dropTargetRef.current) {
      dropTargetRef.current.el.style.boxShadow = "";
      dropTargetRef.current = null;
    }
  };

  const onPreviewDragStart = (e: React.DragEvent) => {
    const info = selectableInfo(e.target as HTMLElement);
    if (!info) return;
    setSelBanner({ needle: info.needle, nth: info.nth, kind: info.kind }); // 드래그 시작 시 자동 선택
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", "goblog-block");
  };

  const onPreviewDragOver = (e: React.DragEvent) => {
    if (!selBanner) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    // 최상위 블록 요소(렌더 래퍼의 직계 자식) 찾기
    const wrapper = previewRef.current?.firstElementChild as HTMLElement | null;
    if (!wrapper) return;
    let el = e.target as HTMLElement | null;
    while (el && el.parentElement !== wrapper) el = el.parentElement;
    if (!el || el.hasAttribute("data-banner-sel")) return; // 자기 자신 위엔 드롭 불가
    const rect = el.getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2;
    if (dropTargetRef.current?.el !== el || dropTargetRef.current?.before !== before) {
      clearDropIndicator();
      el.style.boxShadow = before ? "0 -3px 0 0 #2f7ed8" : "0 3px 0 0 #2f7ed8";
      dropTargetRef.current = { el, before };
    }
  };

  const onPreviewDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const target = dropTargetRef.current;
    clearDropIndicator();
    if (!selBanner || !target) return;
    const blocks = splitBlocks(form.contentMarkdown);
    const bi = bannerBlockIndex(blocks, selBanner.needle, selBanner.nth);
    if (bi < 0) return toast.error(`본문 소스에서 ${selBanner.kind}를 찾지 못했습니다.`);
    let ti = findBlockIndexForEl(target.el, blocks);
    const [blk] = blocks.splice(bi, 1);
    if (bi < ti) ti -= 1;
    const insertAt = Math.max(0, Math.min(target.before ? ti : ti + 1, blocks.length));
    blocks.splice(insertAt, 0, blk);
    const kind = selBanner.kind;
    clearBannerSelection();
    await saveMarkdown(blocks.join("\n\n"), `${kind} 위치 이동(드래그)`);
    toast.success(`${kind} 위치를 옮겼습니다.`);
  };

  const onPickImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // 같은 파일 재선택 허용
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("10MB 이하 이미지만 업로드할 수 있습니다.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => uploadImageMutation.mutate(String(reader.result));
    reader.readAsDataURL(file);
  };

  const [scheduleAt, setScheduleAt] = useState("");

  const publishMutation = useMutation({
    mutationFn: (platform: string) =>
      api.post<{ jobId: number }>("/api/publish-jobs", {
        articleId: Number(id),
        platform,
        scheduledAt: scheduleAt ? new Date(scheduleAt).toISOString() : undefined,
      }),
    onSuccess: () => {
      toast.success(
        scheduleAt ? "예약 발행을 등록했습니다." : "발행 작업을 등록했습니다. 잠시 후 상태가 갱신됩니다.",
      );
      queryClient.invalidateQueries({ queryKey: ["publish-jobs", id] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "발행 요청 실패"),
  });

  const retryMutation = useMutation({
    mutationFn: (jobId: number) => api.post(`/api/publish-jobs/${jobId}/retry`),
    onSuccess: () => {
      toast.success("재시도 요청했습니다.");
      queryClient.invalidateQueries({ queryKey: ["publish-jobs", id] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "재시도 실패"),
  });

  const jobsQuery = useQuery({
    queryKey: ["publish-jobs", id],
    queryFn: () =>
      api.get<{
        jobs: Array<{
          id: number;
          platform: string;
          status: string;
          publishedUrl: string | null;
          error: string | null;
          scheduledAt: string | null;
        }>;
      }>(`/api/publish-jobs?articleId=${id}`),
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
          {article.qualityScore !== null && article.qualityScore < 85 && (
            <Button
              variant="outline"
              onClick={() => improveMutation.mutate()}
              disabled={improveMutation.isPending}
              title="품질 검사 미달 항목을 보강해 85점 이상으로 올립니다"
            >
              {improveMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              보정
            </Button>
          )}
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
                    ref={contentRef}
                    rows={24}
                    className="font-mono text-sm"
                    value={form.contentMarkdown}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, contentMarkdown: event.target.value }))
                    }
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    본문에서 이미지를 넣을 위치를 클릭한 뒤 우측 <b>직접 업로드</b>를 누르면 그 자리에 삽입됩니다.
                  </p>
                </TabsContent>
                <TabsContent value="preview">
                  {selBanner && (
                    <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs dark:border-red-900 dark:bg-red-950">
                      <span className="font-medium">🎯 {selBanner.kind} 선택됨 — 드래그해서 원하는 위치에 놓거나:</span>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => moveSelectedBanner(-1)}>
                        ▲ 위로
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => moveSelectedBanner(1)}>
                        ▼ 아래로
                      </Button>
                      <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={deleteSelectedBanner}>
                        🗑 삭제
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={clearBannerSelection}>
                        취소
                      </Button>
                    </div>
                  )}
                  <div
                    ref={previewRef}
                    onClick={onPreviewClick}
                    onDragStart={onPreviewDragStart}
                    onDragOver={onPreviewDragOver}
                    onDrop={onPreviewDrop}
                    onDragEnd={clearDropIndicator}
                    className="prose prose-sm max-w-none rounded-lg border p-4 dark:prose-invert [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mt-4 [&_h3]:font-semibold [&_table]:w-full [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:bg-muted [&_th]:p-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2"
                    dangerouslySetInnerHTML={{ __html: article.contentHtml ?? "" }}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    미리보기는 마지막 저장 시점 기준입니다. 배너·이미지를 클릭하면 삭제·이동(드래그)할 수 있습니다.
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
              {(article.qualityReport?.policyRisks?.length ?? 0) > 0 && (
                <div className="mt-3 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                  <p className="mb-1 font-semibold">정책 위험 (발행 차단):</p>
                  <ul className="list-disc pl-4">
                    {article.qualityReport?.policyRisks?.map((risk) => (
                      <li key={risk}>{risk}</li>
                    ))}
                  </ul>
                </div>
              )}
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
              <div className="flex gap-2">
                <input
                  id="image-upload-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onPickImage}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={uploadImageMutation.isPending}
                  onClick={() => document.getElementById("image-upload-input")?.click()}
                >
                  {uploadImageMutation.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Upload className="size-3.5" />
                  )}
                  직접 업로드
                </Button>
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
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {imagesMutation.isPending && (
                <p className="text-xs text-muted-foreground">이미지 생성 중... (장당 10~20초)</p>
              )}
              {article.media.map((asset) => (
                <div key={asset.id} className="rounded-md border p-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {asset.position === 1 ? "대표·본문1" : `본문 ${asset.position ?? ""}`}
                    </Badge>
                    {asset.webpUrl && <Badge className="text-[10px]">생성됨</Badge>}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-auto size-6"
                      aria-label="이미지 삭제"
                      disabled={deleteImageMutation.isPending}
                      onClick={() => deleteImageMutation.mutate({ id: asset.id, webpUrl: asset.webpUrl })}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
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

          {article.instagram && (article.instagram.slides.length > 0 || article.instagram.caption) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">📷 인스타그램 캐러셀</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <p className="text-muted-foreground">
                  이미지는 위 본문 3장을 그대로 사용합니다. 크롬 확장에서 인스타그램 탭을 열면 캡션 복사·이미지 저장이 가능합니다.
                </p>
                {article.instagram.slides.map((s) => (
                  <div key={s.position} className="rounded-md border p-2">
                    <b>
                      슬라이드 {s.position}. {s.title}
                    </b>
                    <p className="text-muted-foreground">{s.summary}</p>
                  </div>
                ))}
                <div>
                  <p className="mb-1 font-medium">캡션</p>
                  <p className="whitespace-pre-wrap rounded-md bg-muted p-2 leading-relaxed">
                    {article.instagram.caption}
                  </p>
                </div>
                {article.instagram.hashtags.length > 0 && (
                  <p className="break-all text-blue-600">{article.instagram.hashtags.join(" ")}</p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">상품 배너 삽입</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {matchedHits.length > 0 && (
                <div className="space-y-1 rounded-md border border-emerald-200 bg-emerald-50/50 p-2 dark:border-emerald-900 dark:bg-emerald-950/30">
                  <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                    ✨ 이 글과 매칭된 상품 — 클릭하면 파트너스 링크 발급 새창이 열립니다
                  </p>
                  <ul className="space-y-0.5">
                    {matchedHits.map((h) => (
                      <li key={h.id}>
                        <a
                          href={
                            h.source === "COUPANG"
                              ? `https://partners.coupang.com/#affiliate/ws/link/0/${encodeURIComponent(h.name)}`
                              : "https://brandconnect.naver.com/"
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded px-1 py-0.5 text-xs hover:bg-emerald-100 dark:hover:bg-emerald-900"
                          title="새창에서 제휴 링크를 발급한 뒤 아래에 붙여넣으세요"
                        >
                          <span
                            className="shrink-0 rounded px-1 text-[10px] font-bold"
                            style={{
                              background: h.source === "COUPANG" ? "#fdeaea" : "#e9f9ef",
                              color: h.source === "COUPANG" ? "#c41f22" : "#03a44e",
                            }}
                          >
                            {h.source === "COUPANG" ? "쿠팡" : "네이버"}
                          </span>
                          <span className="min-w-0 truncate text-blue-600 underline decoration-dotted underline-offset-2">
                            {h.name}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                쿠팡/네이버 상품 링크나 [이미지+텍스트] HTML을 붙여넣고, 본문에서 넣을 위치를 클릭한 뒤 삽입하세요. 여러 번 삽입할 수 있습니다.
              </p>
              <Textarea
                rows={4}
                className="font-mono text-xs"
                placeholder={'<a href="https://link.coupang.com/a/..." ...><img src="...coupangcdn..." alt="상품명" ...></a>'}
                value={bannerInput}
                onChange={(event) => setBannerInput(event.target.value)}
              />
              <Button
                size="sm"
                className="w-full"
                disabled={!bannerInput.trim() || bannerMutation.isPending}
                onClick={() => bannerMutation.mutate()}
              >
                {bannerMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
                커서 위치에 배너 삽입
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1 text-sm">
                <Send className="size-3.5" /> 발행
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">예약 시간 (비우면 즉시 발행)</Label>
                <Input
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(event) => setScheduleAt(event.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  disabled={publishMutation.isPending}
                  onClick={() => publishMutation.mutate("WORDPRESS")}
                >
                  WordPress
                </Button>
                <Button
                  size="sm"
                  disabled={publishMutation.isPending}
                  onClick={() => publishMutation.mutate("BLOGGER")}
                >
                  Blogger
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={publishMutation.isPending}
                  onClick={() => publishMutation.mutate("INSTAGRAM")}
                >
                  Instagram
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={publishMutation.isPending}
                  onClick={() => publishMutation.mutate("NAVER_BLOG")}
                  title="네이버·티스토리는 Chrome 확장으로 발행합니다"
                >
                  네이버/티스토리
                </Button>
              </div>
              {(jobsQuery.data?.jobs ?? []).slice(0, 6).map((job) => (
                <div key={job.id} className="rounded-md border p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span>
                      {job.platform}
                      {job.scheduledAt && (
                        <span className="ml-1 text-muted-foreground">
                          · 예약 {new Date(job.scheduledAt).toLocaleString("ko-KR")}
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-1">
                      {job.status === "FAILED" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-[10px]"
                          onClick={() => retryMutation.mutate(job.id)}
                        >
                          재시도
                        </Button>
                      )}
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
                품질 85점 미만·정책 위험 문구가 있으면 발행이 차단됩니다. 네이버·티스토리는 발행
                대기로 등록되어 Chrome 확장에서 처리합니다.
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
