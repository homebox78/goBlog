import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, History, ImagePlus, Loader2, RefreshCw, Save, Send, Sparkles, Trash2, Upload, XCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useSaveShortcut, useUnsavedGuard } from "@/hooks/use-editing";

interface ArticleDetail {
  id: number;
  title: string;
  updatedAt: string; // 저장 시 되돌려 보내 '오래된 화면의 덮어쓰기'를 서버가 걸러낸다
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

  /**
   * 저장 페이로드 — 이 화면이 글을 불러온 시각(baseUpdatedAt)을 항상 함께 보낸다.
   * 이게 없으면 오래된 화면의 본문이 최신 본문을 조용히 덮어쓴다
   * (이미지 재생성 → 재생성 전에 열어둔 화면에서 배너 삽입 → 이미지가 다시 깨졌던 사고).
   */
  const savePayload = () => ({ ...form, baseUpdatedAt: query.data?.article.updatedAt });

  // 서버가 409를 주면 이 화면이 낡은 것이다 — 최신 본문을 다시 불러와 바로 재시도할 수 있게 한다.
  const handleSaveError = (error: unknown) => {
    toast.error(error instanceof Error ? error.message : "저장 실패");
    if (error instanceof ApiError && error.status === 409) {
      queryClient.invalidateQueries({ queryKey: ["article", id] });
    }
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put<{ id: number; qualityScore: number }>(`/api/articles/${id}`, {
        ...savePayload(),
        changeNote: "수동 편집",
      }),
    onSuccess: (result) => {
      toast.success(`저장 완료 (품질 ${result.qualityScore}점)`);
      queryClient.invalidateQueries({ queryKey: ["article", id] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
    },
    onError: handleSaveError,
  });

  // 검수 완료 → status APPROVED. Blogger 설정돼 있으면 서버가 자동 발행 큐잉(bloggerQueued).
  const approveMutation = useMutation({
    mutationFn: () =>
      api.put<{ id: number; status: string; autoPublished: string[] }>(`/api/articles/${id}`, {
        ...savePayload(),
        status: "APPROVED",
        changeNote: "검수 완료",
      }),
    onSuccess: (r) => {
      const names = (r.autoPublished ?? [])
        .map((p) => (p === "BLOGGER" ? "Blogger" : p === "WORDPRESS" ? "워드프레스" : p))
        .join(" · ");
      if (names) toast.success(`검수 완료 → ${names} 자동 발행을 시작했습니다.`);
      else toast.success("검수 완료로 표시했습니다. (Blogger·워드프레스 미설정 시 자동 발행 안 함)");
      queryClient.invalidateQueries({ queryKey: ["article", id] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      queryClient.invalidateQueries({ queryKey: ["publish-jobs", id] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "검수 완료 실패"),
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

  // 미저장 변경 감지 — 폼이 서버 데이터와 다르면 dirty (탭 닫기 경고 + 저장 버튼 표시)
  const article0 = query.data?.article;
  const dirty =
    !!article0 &&
    (form.title !== article0.title ||
      form.metaTitle !== (article0.metaTitle ?? "") ||
      form.metaDescription !== (article0.metaDescription ?? "") ||
      form.excerpt !== (article0.excerpt ?? "") ||
      form.contentMarkdown !== (article0.contentMarkdown ?? ""));
  useUnsavedGuard(dirty);
  useSaveShortcut(() => {
    if (dirty && !saveMutation.isPending) saveMutation.mutate();
  });

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
      await api.put(`/api/articles/${id}`, { ...savePayload(), contentMarkdown: next, changeNote: "이미지 삽입" });
      queryClient.invalidateQueries({ queryKey: ["article", id] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      toast.success("커서 위치에 이미지를 삽입했습니다.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "이미지 업로드 실패"),
  });

  // 출처 이미지 URL 크롤링 삽입 — 특정 차종·제품·뉴스에 실제 출처 이미지 + '이미지 출처' 캡션
  const [srcImgUrl, setSrcImgUrl] = useState("");
  const [srcImgSource, setSrcImgSource] = useState("");
  const urlImageMutation = useMutation({
    mutationFn: () =>
      api.post<{ figure: string }>(`/api/articles/${id}/images/from-url`, { url: srcImgUrl.trim(), source: srcImgSource.trim() }),
    onSuccess: async (r) => {
      const ta = contentRef.current;
      const md = ta?.value ?? form.contentMarkdown;
      const pos = ta ? ta.selectionStart : md.length;
      const next = `${md.slice(0, pos)}\n\n${r.figure}\n\n${md.slice(pos)}`.replace(/\n{3,}/g, "\n\n");
      setForm((prev) => ({ ...prev, contentMarkdown: next }));
      await api.put(`/api/articles/${id}`, { ...savePayload(), contentMarkdown: next, changeNote: "출처 이미지 삽입" });
      setSrcImgUrl("");
      queryClient.invalidateQueries({ queryKey: ["article", id] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      toast.success("출처 이미지를 삽입했습니다. (이미지 출처 캡션 자동 표기)");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "이미지 크롤링 실패"),
  });

  // 마음에 안 드는 이미지 1장만 같은 프롬프트로 재생성 (본문 src 자동 교체)
  const regenImageMutation = useMutation({
    mutationFn: (mediaId: number) =>
      api.post<{ id: number; webpUrl: string }>(`/api/articles/${id}/images/${mediaId}/regenerate`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["article", id] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      toast.success("이미지를 다시 생성했습니다. (본문에도 반영)");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "이미지 재생성 실패"),
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
        await api.put(`/api/articles/${id}`, { ...savePayload(), contentMarkdown: cleaned, changeNote: "이미지 삭제" });
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
      api.get<{
        keyword: string;
        hits: Array<{ id: number; source: string; name: string; keyword: string }>;
        naverSearchBase: string | null;
      }>(`/api/articles/${id}/matched-hits`),
  });
  const matchedHits = matchedHitsQuery.data?.hits ?? [];
  const naverSearchBase = matchedHitsQuery.data?.naverSearchBase ?? null;

  // 대가성 고시 수동 삽입 — 이미 있으면 서버가 중복 삽입하지 않는다
  const disclosureMutation = useMutation({
    mutationFn: (source: "COUPANG" | "BRANDCONNECT") =>
      api.post<{ ok: boolean; already: boolean }>(`/api/articles/${id}/disclosure`, { source }),
    onSuccess: (r) => {
      if (r.already) {
        toast.info("대가성 고시가 이미 본문에 있습니다.");
      } else {
        toast.success("대가성 고시를 본문 최상단에 삽입했습니다.");
        queryClient.invalidateQueries({ queryKey: ["article", id] });
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "고시 삽입 실패"),
  });

  const bannerMutation = useMutation({
    mutationFn: async () => {
      // 스마트스토어 URL이 있으면 크롬 확장으로 상품명·이미지를 먼저 추출해 입력을 보강 (서버는 네이버 차단)
      const { enrichNaverInput, enrichFailureMessage } = await import("@/lib/naver-bridge");
      const r = await enrichNaverInput(bannerInput);
      const warn = enrichFailureMessage(r.reason);
      if (warn) toast.info(warn, { duration: 8000 });
      return api.post<{ banner: string; disclosure: string }>(`/api/articles/${id}/banner`, { input: r.input });
    },
    onSuccess: async (r) => {
      // 상단·중단·하단 3곳에 자동 삽입 — 커서 지정 공수 제거 (원스톱)
      const ta = contentRef.current;
      const md = ta?.value ?? form.contentMarkdown;
      const blocks = md.split(/\n{2,}/);
      const h2Idx = blocks.map((b, i) => (/^##\s/.test(b) ? i : -1)).filter((i) => i >= 0);
      const lastIsTags = /^#\S/.test(blocks[blocks.length - 1] ?? "");
      // 상단 = 첫 H2 앞(도입부 다음), 중단 = 가운데 H2 앞, 하단 = 본문 끝(해시태그 줄 앞)
      const top = h2Idx[0] ?? Math.min(1, blocks.length);
      const mid =
        h2Idx.length >= 2 ? h2Idx[Math.floor(h2Idx.length / 2)] : Math.floor(blocks.length / 2);
      const bottom = blocks.length - (lastIsTags ? 1 : 0);
      const positions = [...new Set([top, mid, bottom])].sort((a, b) => b - a); // 뒤에서부터 삽입해야 인덱스 안 밀림
      for (const pos of positions) {
        blocks.splice(Math.max(0, Math.min(pos, blocks.length)), 0, r.banner);
      }
      let next = blocks.join("\n\n").replace(/\n{3,}/g, "\n\n");
      // 대가성 안내 문구가 본문에 없으면 최상단에 자동 추가 (쿠팡/네이버 필수 표기)
      if (r.disclosure && !next.includes("활동의 일환")) {
        next = `${r.disclosure}\n\n${next}`;
      }
      setForm((prev) => ({ ...prev, contentMarkdown: next }));
      await api.put(`/api/articles/${id}`, { ...savePayload(), contentMarkdown: next, changeNote: "배너 자동 삽입(상·중·하)" });
      setBannerInput("");
      queryClient.invalidateQueries({ queryKey: ["article", id] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      toast.success(`배너를 ${positions.length}곳(상·중·하)에 자동 삽입했습니다. 미리보기에서 클릭해 이동·삭제할 수 있어요.`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "배너 생성 실패"),
  });

  // ── 미리보기에서 배너·이미지 클릭 선택 → 삭제/위·아래 이동/드래그 재배치 ──────────
  const previewRef = useRef<HTMLDivElement>(null);
  const [selBanner, setSelBanner] = useState<{
    needle: string;
    nth: number;
    kind: "배너" | "이미지";
    top: number; // 미리보기 컨테이너 기준 선택 요소의 y — 툴바를 요소 바로 위에 띄운다
  } | null>(null);
  const dropTargetRef = useRef<{ el: HTMLElement; before: boolean } | null>(null);

  // 선택 요소 바로 위 툴바 위치 계산 (relative 래퍼 기준)
  const selTopOf = (el: HTMLElement): number => {
    const wrapper = previewRef.current?.parentElement;
    if (!wrapper) return 0;
    return el.getBoundingClientRect().top - wrapper.getBoundingClientRect().top;
  };

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
    await api.put(`/api/articles/${id}`, { ...savePayload(), contentMarkdown: next, changeNote: note });
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
      setSelBanner({ needle: info.needle, nth: info.nth, kind: info.kind, top: selTopOf(info.el) });
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
    // 드래그 시작 시 자동 선택
    setSelBanner({ needle: info.needle, nth: info.nth, kind: info.kind, top: selTopOf(info.el) });
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
      {/* 모바일: 제목 아래로 액션을 내려 접는다 (한 줄에 밀어 넣으면 제목이 '주...'로 뭉개진다) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            to="/articles"
            className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" /> 글 목록
          </Link>
          <h1 className="line-clamp-2 text-xl font-bold break-keep sm:truncate">{article.title}</h1>
          <p className="text-sm text-muted-foreground">
            키워드: {article.keyword?.text ?? "—"} · {article.language} · {article.articleType}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
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
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} title="Ctrl+S">
            {saveMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            저장{dirty ? " ●" : ""}
          </Button>
          <Button
            variant="default"
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => approveMutation.mutate()}
            disabled={approveMutation.isPending || article.status === "APPROVED" || article.status === "PUBLISHED"}
            title="검수 완료로 표시합니다. Blogger가 설정돼 있으면 자동 발행됩니다."
          >
            {approveMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            {article.status === "APPROVED" || article.status === "PUBLISHED" ? "검수 완료됨" : "검수 완료"}
          </Button>
        </div>
      </div>

      {/* grid-cols-1(=minmax(0,1fr))이 없으면 모바일에서 트랙이 auto(내용 최대폭)로 잡혀
          칼럼이 화면 밖으로 부풀고, 자식의 min-w-0 만으로는 막지 못한다. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
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
                  {/* Textarea 기본 클래스의 field-sizing-content 는 높이를 '내용'에 맡겨 글마다 편집기 크기가 들쭉날쭉해진다.
                      본문 편집기는 높이를 고정하고 안에서 스크롤한다 (field-sizing-fixed 로 되돌린 뒤 h 지정). */}
                  <Textarea
                    ref={contentRef}
                    rows={24}
                    className="field-sizing-fixed h-[55dvh] resize-y overflow-y-auto font-mono text-sm md:h-[70vh]"
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
                  <div className="relative">
                    {selBanner && (
                      <div
                        className="absolute left-2 z-10 flex flex-wrap items-center gap-1.5 rounded-md border border-red-300 bg-red-50 p-1.5 text-xs shadow-lg dark:border-red-900 dark:bg-red-950"
                        style={{
                          top: Math.max(selBanner.top, 42),
                          transform: "translateY(calc(-100% - 6px))",
                        }}
                      >
                        <span className="font-medium">🎯 {selBanner.kind}</span>
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
                        <span className="text-[10px] text-muted-foreground">드래그로 이동 가능</span>
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
                  </div>
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
              {/* 출처 이미지 URL 크롤링 삽입 — 차종·제품·뉴스처럼 실제 이미지가 필요할 때 */}
              <div className="space-y-1.5 rounded-md border border-dashed p-2">
                <p className="text-[11px] text-muted-foreground">
                  🔗 출처 이미지 삽입 — 이미지 URL과 출처를 넣으면 크롤링해 <b>“이미지 출처: …”</b> 캡션과 함께 커서 위치에 삽입
                </p>
                <Input
                  className="h-8 text-xs"
                  placeholder="이미지 URL (https://...jpg)"
                  value={srcImgUrl}
                  onChange={(e) => setSrcImgUrl(e.target.value)}
                />
                <div className="flex gap-1.5">
                  <Input
                    className="h-8 text-xs"
                    placeholder="출처 (예: 기아차 뉴스룸)"
                    value={srcImgSource}
                    onChange={(e) => setSrcImgSource(e.target.value)}
                  />
                  <Button
                    size="sm"
                    className="h-8 shrink-0 text-xs"
                    disabled={!srcImgUrl.trim() || !srcImgSource.trim() || urlImageMutation.isPending}
                    onClick={() => urlImageMutation.mutate()}
                  >
                    {urlImageMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "삽입"}
                  </Button>
                </div>
              </div>
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
                    <div className="ml-auto flex items-center gap-0.5">
                      {asset.prompt && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          title="이 이미지만 다시 생성 (같은 프롬프트, 10~20초)"
                          disabled={regenImageMutation.isPending || deleteImageMutation.isPending}
                          onClick={() => regenImageMutation.mutate(asset.id)}
                        >
                          {regenImageMutation.isPending && regenImageMutation.variables === asset.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="size-3.5 text-blue-600" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        aria-label="이미지 삭제"
                        disabled={deleteImageMutation.isPending || regenImageMutation.isPending}
                        onClick={() => deleteImageMutation.mutate({ id: asset.id, webpUrl: asset.webpUrl })}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
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
                              : naverSearchBase
                                ? `${naverSearchBase}?query=${encodeURIComponent(h.name)}&tab=product`
                                : `https://brandconnect.naver.com/`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded px-1 py-0.5 text-xs hover:bg-emerald-100 dark:hover:bg-emerald-900"
                          title={
                            h.source === "BRANDCONNECT" && !naverSearchBase
                              ? "설정 > 네이버 > 브랜드커넥트 회원 ID를 입력하면 상품명이 채워진 검색으로 열립니다"
                              : "새창에서 제휴 링크를 발급한 뒤 아래에 붙여넣으세요"
                          }
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
                쿠팡: [이미지+텍스트] HTML 또는 링크. <b>네이버: naver.me 링크 + 스마트스토어 상품 URL 두 줄</b>
                (확장이 상품명·원본이미지 자동 추출). 붙여넣고 버튼만 누르면 <b>상단·중단·하단 3곳에 자동 삽입</b>됩니다.
              </p>
              <Textarea
                rows={4}
                className="font-mono text-xs"
                placeholder={'쿠팡: <a href="https://link.coupang.com/a/..."><img ...></a>\n네이버:\nhttps://naver.me/xxxxx\nhttps://smartstore.naver.com/스토어/products/123...'}
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
                배너 자동 삽입 (상단·중단·하단)
              </Button>
              <div className="border-t pt-2">
                <p className="mb-1.5 text-[11px] text-muted-foreground">
                  대가성 고시(경제적 이해관계 문구) — 없으면 최상단에 삽입
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    disabled={disclosureMutation.isPending}
                    onClick={() => disclosureMutation.mutate("COUPANG")}
                  >
                    쿠팡 고시 삽입
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    disabled={disclosureMutation.isPending}
                    onClick={() => disclosureMutation.mutate("BRANDCONNECT")}
                  >
                    네이버 고시 삽입
                  </Button>
                </div>
              </div>
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
