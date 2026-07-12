import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
        </TabsContent>
        <TabsContent value="naver">
          <UrlAnalyzer
            source="BRANDCONNECT"
            placeholder={
              "네이버 상품 페이지 URL (스마트스토어/쇼핑) 또는 트래킹 링크를 붙여넣으세요\n예) https://smartstore.naver.com/... 또는 https://naver.me/..."
            }
            guide="상품 페이지 URL(스마트스토어 등)을 넣으면 상품명·가격·이미지를 자동 분석합니다. 트래킹 링크(naver.me)는 상품 정보가 안 나올 수 있으니, 분석 후 링크 필드에 트래킹 링크로 바꿔 넣으세요. 규정 대가성 문구가 자동 삽입됩니다."
            onSelect={(p) => setTarget({ product: p, keyword: "" })}
          />
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
    mutationFn: (link: string) =>
      api.post<{ product: Omit<ProductPayload, "price"> & { price: number | null } }>(
        "/api/products/analyze",
        { input: link },
      ),
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
