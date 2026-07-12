import { useEffect, useRef, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link2, Loader2, PenLine, Sparkles, Save, Trash2, Tag, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GenerateDialog, type ProductPayload } from "@/components/articles/GenerateDialog";

const won = (value: number) => new Intl.NumberFormat("ko-KR").format(value);

const PARTNER_SITE: Record<"COUPANG" | "BRANDCONNECT", { label: string; url: string }> = {
  COUPANG: { label: "쿠팡 파트너스 열기", url: "https://partners.coupang.com/" },
  BRANDCONNECT: { label: "네이버 브랜드커넥트 열기", url: "https://brandconnect.naver.com/" },
};

interface RegisteredProduct {
  id: number;
  source: "COUPANG" | "BRANDCONNECT";
  name: string;
  brand: string | null;
  price: number | null;
  imageUrl: string | null;
  productUrl: string;
  description: string | null;
  isRocket: boolean;
  status: string;
  matchedAt: string | null;
  matchedKeyword: { id: number; text: string } | null;
}

/** 최근(3일 내) 매칭된 상품인가 — 반짝이는 '매칭완료' 뱃지 표시용 */
function isRecentMatch(p: RegisteredProduct): boolean {
  return !!(p.matchedKeyword && p.matchedAt && Date.now() - new Date(p.matchedAt).getTime() < 3 * 86400000);
}

function toPayload(p: RegisteredProduct): ProductPayload {
  return {
    source: p.source,
    name: p.name,
    brand: p.brand ?? undefined,
    price: p.price ?? undefined,
    imageUrl: p.imageUrl ?? undefined,
    productUrl: p.productUrl,
    description: p.description ?? undefined,
    isRocket: p.isRocket,
  };
}

interface WriteTarget {
  product?: ProductPayload;
  keyword: string;
  keywordId?: number;
}

export default function ProductsPage() {
  const [target, setTarget] = useState<WriteTarget | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">상품 홍보</h1>
        <p className="text-sm text-muted-foreground">
          상품 링크를 등록하면 상품을 분석해 <b>오늘의 키워드와 매칭</b>합니다. 매칭된 키워드의 자동 글에는
          제휴 배너·링크·대가성 문구가 자동으로 삽입됩니다. 바로 홍보 글을 생성할 수도 있습니다.
        </p>
      </div>

      <Tabs defaultValue="coupang">
        <TabsList>
          <TabsTrigger value="coupang">쿠팡 파트너스</TabsTrigger>
          <TabsTrigger value="naver">네이버 쇼핑 커넥트</TabsTrigger>
        </TabsList>
        <TabsContent value="coupang">
          <UrlAnalyzer
            source="COUPANG"
            placeholder={
              '쿠팡 파트너스 "이미지+텍스트" HTML 태그를 붙여넣으세요 (권장 — 상품명·이미지 자동 추출)\n예) <a href="https://link.coupang.com/a/..." ...><img src="...coupangcdn..." alt="상품명" ...></a>\n\n또는 단축 URL만: https://link.coupang.com/a/...'
            }
            guide="쿠팡 파트너스 링크 만들기 화면에서 [이미지+텍스트]의 HTML 태그를 복사해 붙여넣으면 상품명·상품 이미지·링크가 자동으로 들어갑니다. 단축 URL만 넣으면 이미지·상품명은 직접 입력해야 합니다. 대가성 문구는 자동 삽입됩니다."
            onSelect={(p) => setTarget({ product: p, keyword: "" })}
          />
          <BulkMatcher source="COUPANG" />
        </TabsContent>
        <TabsContent value="naver">
          <UrlAnalyzer
            source="BRANDCONNECT"
            placeholder={
              "트래킹 링크(naver.me) + 스마트스토어 상품 URL을 두 줄로 붙여넣으세요 (goBlog 확장이 상품명·이미지 자동 추출)\n예)\nhttps://naver.me/xxxxx\nhttps://smartstore.naver.com/스토어/products/1234..."
            }
            guide="naver.me 트래킹 링크 + 스마트스토어 상품 URL 두 줄이면 goBlog 크롬 확장이 상품명·원본 이미지·가격을 자동 추출합니다(링크는 트래킹 링크 유지 — 수수료 집계). 확장이 없으면 상품명을 한 줄 더 넣어주세요(쇼핑검색 API로 조회). 규정 대가성 문구는 자동 삽입됩니다."
            onSelect={(p) => setTarget({ product: p, keyword: "" })}
          />
          <BulkMatcher source="BRANDCONNECT" />
        </TabsContent>
      </Tabs>

      <RegisteredProducts
        onWrite={(product, keyword, keywordId) => setTarget({ product, keyword, keywordId })}
      />

      <GenerateDialog
        keywordId={target?.keywordId ?? null}
        keyword={target?.keyword ?? ""}
        product={target?.product ?? null}
        open={target !== null}
        onOpenChange={(open) => !open && setTarget(null)}
      />
    </div>
  );
}

interface BulkHit {
  id: number;
  name: string;
  keyword: string;
  score: number;
  usedAt: string | null;
  articleId: number | null;
}
interface BulkHistoryPage {
  items: BulkHit[];
  total: number;
  nextOffset: number | null;
}
interface BulkResult {
  scanned: number;
  matchedCount: number;
  added: number;
  matched: Array<{ name: string; keyword: string; score: number }>;
}

type BulkSort = "keyword" | "score" | "latest";
const SORT_LABELS: Record<BulkSort, string> = {
  keyword: "추천순",
  score: "매칭순",
  latest: "최신순",
};

function BulkMatcher({ source }: { source: "COUPANG" | "BRANDCONNECT" }) {
  const queryClient = useQueryClient();
  // 입력창은 저장하지 않는다 — 새로고침하면 비워지고, 매칭된 결과만 DB에 기록된다.
  const [text, setText] = useState("");
  const [lastRun, setLastRun] = useState<{ scanned: number; matched: number; added: number } | null>(null);
  const [sort, setSort] = useState<BulkSort>("keyword");
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // 기존 브라우저(localStorage) 히스토리를 DB로 1회 이관 후 삭제
  useEffect(() => {
    const oldKey = `goblog:bulkmatch:${source}:history`;
    const raw = localStorage.getItem(oldKey);
    if (!raw) return;
    try {
      const items = JSON.parse(raw) as Array<{ name: string; keyword: string; score?: number }>;
      if (Array.isArray(items) && items.length) {
        api
          .post("/api/products/bulk-match/import", {
            source,
            items: items.map((m) => ({ name: m.name, keyword: m.keyword, score: m.score ?? 0 })),
          })
          .then(() => queryClient.invalidateQueries({ queryKey: ["bulk-history", source] }))
          .finally(() => localStorage.removeItem(oldKey));
      } else {
        localStorage.removeItem(oldKey);
      }
    } catch {
      localStorage.removeItem(oldKey);
    }
  }, [source, queryClient]);

  // DB에 누적 저장된 매칭 히스토리 — 오프셋 기반 무한스크롤 + 정렬
  const history = useInfiniteQuery({
    queryKey: ["bulk-history", source, sort],
    queryFn: ({ pageParam }) =>
      api.get<BulkHistoryPage>(
        `/api/products/bulk-match/history?source=${source}&sort=${sort}&take=30&offset=${pageParam}`,
      ),
    initialPageParam: 0 as number,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
  });

  const hits = history.data?.pages.flatMap((page) => page.items) ?? [];
  const total = history.data?.pages[0]?.total ?? 0;

  const matchMutation = useMutation({
    mutationFn: () => api.post<BulkResult>("/api/products/bulk-match", { source, text }),
    onSuccess: (data) => {
      setLastRun({ scanned: data.scanned, matched: data.matchedCount, added: data.added });
      setText(""); // 입력 내용은 비운다 (매칭 결과만 남긴다)
      queryClient.invalidateQueries({ queryKey: ["bulk-history", source] });
      // 실제 결과에 맞는 메시지 (매칭 안 됨 / 신규 없음 / 추가됨)
      if (data.added > 0) {
        toast.success(`${data.scanned}줄 스캔 → 신규 ${data.added}개 추가 (매칭 ${data.matchedCount}개).`);
      } else if (data.matchedCount > 0) {
        toast.info(`${data.matchedCount}개가 매칭됐지만 모두 이미 등록된 상품입니다 (신규 0개).`);
      } else {
        toast.warning(
          `${data.scanned}줄 중 매칭된 상품이 없습니다. 현재 키워드 풀(금융·부동산·반도체 등)과 겹치는 상품이 없어요 — 해당 카테고리 키워드가 수집돼야 매칭됩니다.`,
          { duration: 7000 },
        );
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "매칭 실패"),
  });

  const clearMutation = useMutation({
    mutationFn: () => api.delete(`/api/products/bulk-match/history?source=${source}`),
    onSuccess: () => {
      setLastRun(null);
      queryClient.invalidateQueries({ queryKey: ["bulk-history", source] });
    },
  });

  // 스크롤 하단 감지 → 다음 페이지 로드 (무한스크롤)
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && history.hasNextPage && !history.isFetchingNextPage) {
        history.fetchNextPage();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [history.hasNextPage, history.isFetchingNextPage, hits.length]);

  return (
    <Card className="mt-4">
      <CardContent className="space-y-3 pt-6">
        <div>
          <h3 className="text-sm font-semibold">상품 목록 대량 매칭</h3>
          <p className="text-xs text-muted-foreground">
            {source === "COUPANG" ? "쿠팡 파트너스" : "네이버 브랜드커넥트"}에서 상품 목록을 통째로 복사해 붙여넣으면, 오늘의 키워드와
            매칭되는 상품만 골라줍니다. 매칭 결과는 DB에 누적 저장돼 새로고침·기기가 바뀌어도 유지됩니다.
          </p>
        </div>
        <Textarea
          rows={8}
          className="font-mono text-xs"
          placeholder={"상품명을 줄바꿈으로 붙여넣으세요 (가격·평점 등이 섞여 있어도 매칭 안 되는 줄은 자동 무시)\n예)\n삼성 갤럭시워치7 프로 44mm\n무선 청소기 차이슨 ...\n..."}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <Button
          className="w-full"
          disabled={!text.trim() || matchMutation.isPending}
          onClick={() => matchMutation.mutate()}
        >
          {matchMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          매칭되는 상품 찾기
        </Button>
        {(total > 0 || lastRun) && (
          <div className="rounded-md border p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-xs text-muted-foreground">
                누적 <b className="text-emerald-600">{total}개</b> 매칭
                {lastRun && (
                  <span className="ml-1">
                    (이번 {lastRun.scanned}줄 중 매칭 {lastRun.matched}개, 신규 {lastRun.added}개)
                  </span>
                )}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <div className="flex overflow-hidden rounded-md border text-xs">
                  {(Object.keys(SORT_LABELS) as BulkSort[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSort(key)}
                      className={
                        "px-2 py-1 transition-colors " +
                        (sort === key
                          ? "bg-emerald-600 font-medium text-white"
                          : "text-muted-foreground hover:bg-muted")
                      }
                    >
                      {SORT_LABELS[key]}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                  disabled={clearMutation.isPending || total === 0}
                  onClick={() => {
                    if (confirm(`${source} 대량매칭 히스토리 ${total}개를 모두 비울까요?`)) clearMutation.mutate();
                  }}
                >
                  비우기
                </button>
              </div>
            </div>
            {total === 0 ? (
              <p className="text-xs text-muted-foreground">
                매칭되는 상품이 없습니다. 오늘의 키워드와 겹치는 상품이 없을 수 있어요.
              </p>
            ) : (
              <ul className="max-h-72 space-y-1.5 overflow-y-auto text-sm">
                {hits.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2">
                    {source === "COUPANG" ? (
                      <a
                        href={`https://partners.coupang.com/#affiliate/ws/link/0/${encodeURIComponent(m.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="쿠팡 파트너스에서 이 상품 링크 생성 (새창)"
                        className="min-w-0 flex-1 truncate font-medium text-blue-600 underline decoration-dotted underline-offset-2 hover:text-blue-800"
                      >
                        {m.name}
                      </a>
                    ) : (
                      <span className="min-w-0 flex-1 truncate font-medium">{m.name}</span>
                    )}
                    <span className="flex shrink-0 items-center gap-1.5">
                      {m.articleId ? (
                        <RouterLink
                          to={`/articles/${m.articleId}`}
                          className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300"
                          title="이 매칭으로 자동 생성된 글 보기"
                        >
                          📝 글 생성됨
                        </RouterLink>
                      ) : (
                        <button
                          type="button"
                          className="rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
                          title="파트너스 링크 발급 페이지를 열고 등록칸으로 이동합니다"
                          onClick={() => {
                            window.open(
                              source === "COUPANG"
                                ? `https://partners.coupang.com/#affiliate/ws/link/0/${encodeURIComponent(m.name)}`
                                : "https://brandconnect.naver.com/",
                              "_blank",
                            );
                            const ta = document.getElementById(`analyzer-${source}`);
                            ta?.scrollIntoView({ behavior: "smooth", block: "center" });
                            (ta as HTMLTextAreaElement | null)?.focus();
                            toast.info("파트너스에서 [이미지+텍스트] HTML(또는 링크)을 복사해 등록칸에 붙여넣으세요.");
                          }}
                        >
                          등록
                        </button>
                      )}
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                        <Tag className="size-3" /> {m.keyword}
                      </span>
                    </span>
                  </li>
                ))}
                {/* 무한스크롤 센티넬 */}
                <div ref={sentinelRef} className="h-4" />
                {history.isFetchingNextPage && (
                  <li className="flex justify-center py-1 text-xs text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                  </li>
                )}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RegisteredProducts({
  onWrite,
}: {
  onWrite: (product: ProductPayload, keyword: string, keywordId?: number) => void;
}) {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get<{ products: RegisteredProduct[] }>("/api/products"),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("상품을 삭제했습니다.");
    },
  });

  const products = data?.products ?? [];

  // 새로 매칭된 상품(직전 확인 이후)이 생기면 우측 상단 알림
  useEffect(() => {
    if (!products.length) return;
    const seenKey = "goblog:lastMatchSeen";
    const lastSeen = Number(localStorage.getItem(seenKey) ?? 0);
    const matchTimes = products
      .filter((p) => p.matchedKeyword && p.matchedAt)
      .map((p) => new Date(p.matchedAt as string).getTime());
    if (matchTimes.length === 0) return;
    const newest = Math.max(...matchTimes);
    const fresh = matchTimes.filter((t) => t > lastSeen).length;
    if (fresh > 0 && lastSeen > 0) {
      toast.success(`상품 ${fresh}개가 키워드에 매칭됐습니다! 클릭해 글을 작성하세요.`, {
        position: "top-right",
      });
    }
    localStorage.setItem(seenKey, String(newest));
  }, [products]);

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="mb-3 text-base font-semibold">등록된 상품 ({products.length})</h2>
        {isPending ? (
          <p className="py-6 text-center text-sm text-muted-foreground">불러오는 중...</p>
        ) : products.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            아직 등록된 상품이 없습니다. 위에서 상품을 분석하고 <b>상품 등록</b>을 누르면 오늘의 키워드와 매칭됩니다.
          </p>
        ) : (
          <ul className="divide-y">
            {products.map((product) => (
              <li key={product.id} className="flex items-center gap-1 py-1">
                <button
                  type="button"
                  onClick={() =>
                    onWrite(toPayload(product), product.matchedKeyword?.text ?? "", product.matchedKeyword?.id)
                  }
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-md py-2 pl-2 pr-1 text-left hover:bg-accent"
                  title="이 상품으로 홍보 글 작성"
                >
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="size-12 shrink-0 rounded border object-contain" />
                  ) : (
                    <div className="size-12 shrink-0 rounded border bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{product.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">
                        {product.source === "COUPANG" ? "쿠팡" : "네이버"}
                      </Badge>
                      {product.status === "USED" && (
                        <Badge variant="outline" className="text-[10px]">발행에 사용됨</Badge>
                      )}
                      {isRecentMatch(product) && (
                        <Badge className="animate-pulse bg-emerald-500 text-[10px] text-white hover:bg-emerald-500">
                          ✨ 매칭완료
                        </Badge>
                      )}
                      {product.matchedKeyword ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                          <Tag className="size-3" /> {product.matchedKeyword.text}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">매칭된 키워드 없음</span>
                      )}
                    </div>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium text-primary">
                    <PenLine className="size-3.5" /> 글 작성
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeMutation.mutate(product.id)}
                  disabled={removeMutation.isPending}
                  aria-label="상품 삭제"
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function UrlAnalyzer({
  source,
  placeholder,
  guide,
  onSelect,
}: {
  source: "COUPANG" | "BRANDCONNECT";
  placeholder: string;
  guide: string;
  onSelect: (product: ProductPayload) => void;
}) {
  type FormState = Omit<ProductPayload, "price"> & { price?: number | string };
  const [url, setUrl] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const queryClient = useQueryClient();

  const registerMutation = useMutation({
    mutationFn: (payload: ProductPayload) =>
      api.post<{ matched: { keyword: string; score: number } | null }>("/api/products", payload),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(
        result.matched
          ? `상품을 등록했습니다. 오늘의 키워드 "${result.matched.keyword}"에 매칭됐습니다.`
          : "상품을 등록했습니다. 오늘 매칭되는 키워드가 없어 매칭 없이 보관합니다(추후 매칭 가능).",
      );
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "상품 등록 실패"),
  });

  const analyzeMutation = useMutation({
    mutationFn: async (link: string) => {
      // 스마트스토어 URL이 있으면 크롬 확장으로 상품명·이미지를 먼저 추출해 입력 보강 (서버는 네이버 차단)
      const { enrichNaverInput, enrichFailureMessage } = await import("@/lib/naver-bridge");
      const r = await enrichNaverInput(link);
      const warn = enrichFailureMessage(r.reason);
      if (warn) toast.info(warn, { duration: 8000 });
      return api.post<{ product: Omit<ProductPayload, "price"> & { price: number | null } }>(
        "/api/products/analyze",
        { input: r.input },
      );
    },
    onSuccess: (result) => {
      setForm({ ...result.product, source, price: result.product.price ?? undefined });
      toast.success("상품 정보를 불러왔습니다. 확인 후 홍보 글을 생성하세요.");
    },
    onError: (error) => {
      // 자동 분석 실패 시 수동 입력 폼을 연다
      setForm({ source, name: "", productUrl: url });
      toast.error(error instanceof Error ? error.message : "자동 분석 실패 — 직접 입력해주세요.");
    },
  });

  const set = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => (prev ? { ...prev, [key]: event.target.value } : prev));

  const buildPayload = (): ProductPayload | null => {
    if (!form?.name.trim() || !form.productUrl.trim()) {
      toast.error("상품명과 링크는 필수입니다.");
      return null;
    }
    return {
      ...form,
      name: form.name.trim(),
      price: form.price ? Number(String(form.price).replace(/[^\d]/g, "")) : undefined,
    };
  };

  const submit = () => {
    const payload = buildPayload();
    if (payload) onSelect(payload);
  };

  const register = () => {
    const payload = buildPayload();
    if (payload) registerMutation.mutate(payload);
  };

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <a
          href={PARTNER_SITE[source].url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 rounded-md border border-dashed py-2.5 text-sm font-medium hover:bg-accent"
        >
          <ExternalLink className="size-4" />
          {PARTNER_SITE[source].label} — 상품 링크 만들러 가기
        </a>
        <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">{guide}</div>

        <div className="space-y-2">
          <Textarea
            id={`analyzer-${source}`}
            rows={3}
            className="font-mono text-xs"
            placeholder={placeholder}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
          <Button
            className="w-full"
            onClick={() => url.trim() && analyzeMutation.mutate(url.trim())}
            disabled={analyzeMutation.isPending}
          >
            {analyzeMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            상품 분석
          </Button>
        </div>

        {form && (
          <div className="space-y-4 rounded-lg border p-4">
            <div className="flex items-start gap-4">
              {form.imageUrl ? (
                <img
                  src={form.imageUrl}
                  alt={form.name}
                  className="size-24 shrink-0 rounded-lg border object-contain"
                />
              ) : (
                <div className="flex size-24 shrink-0 items-center justify-center rounded-lg border bg-muted text-xs text-muted-foreground">
                  이미지 없음
                </div>
              )}
              <div className="flex-1 space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">상품명 *</Label>
                  <Input value={form.name} onChange={set("name")} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">가격 (원)</Label>
                    <Input
                      value={form.price ? won(Number(form.price)) : ""}
                      onChange={set("price")}
                      placeholder="자동 인식 실패 시 입력"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">브랜드</Label>
                    <Input value={form.brand ?? ""} onChange={set("brand")} />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">트래킹/제휴 링크 *</Label>
              <Input value={form.productUrl} onChange={set("productUrl")} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">상품 특징 메모 (글에 반영)</Label>
              <Textarea rows={2} value={form.description ?? ""} onChange={set("description")} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant="secondary">
                <Link2 className="mr-1 size-3" />
                {source === "COUPANG" ? "쿠팡 파트너스" : "네이버 쇼핑 커넥트"}
              </Badge>
              <div className="flex gap-2">
                <Button variant="outline" onClick={register} disabled={registerMutation.isPending}>
                  {registerMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  상품 등록 (키워드 매칭)
                </Button>
                <Button onClick={submit}>
                  <PenLine className="size-4" /> 지금 홍보 글 생성
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
