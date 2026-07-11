import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link2, Loader2, PenLine, Sparkles } from "lucide-react";
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

export default function ProductsPage() {
  const [target, setTarget] = useState<ProductPayload | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">상품 홍보</h1>
        <p className="text-sm text-muted-foreground">
          쿠팡 파트너스·네이버 쇼핑 커넥트 상품 링크를 붙여넣으면 상품 정보를 자동으로 분석해
          제휴 링크·배너·대가성 문구가 포함된 홍보 글을 작성합니다.
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
            placeholder="쿠팡 파트너스 상품 링크 (예: https://link.coupang.com/... 또는 상품 URL)"
            guide="쿠팡 파트너스에서 만든 상품 링크를 붙여넣으세요. 상품명·가격·이미지를 자동으로 가져오고, 대가성 문구가 자동 삽입됩니다."
            onSelect={setTarget}
          />
        </TabsContent>
        <TabsContent value="naver">
          <UrlAnalyzer
            source="BRANDCONNECT"
            placeholder="네이버 쇼핑 커넥트 트래킹 링크 (예: https://naver.me/...)"
            guide="쇼핑 커넥트 [발급 링크 관리]에서 복사한 트래킹 링크를 붙여넣으세요. 상품 정보를 자동 분석하고, 규정 대가성 문구가 자동 삽입됩니다."
            onSelect={setTarget}
          />
        </TabsContent>
      </Tabs>

      <GenerateDialog
        keyword=""
        product={target}
        open={target !== null}
        onOpenChange={(open) => !open && setTarget(null)}
      />
    </div>
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

  const analyzeMutation = useMutation({
    mutationFn: (link: string) =>
      api.post<{ product: Omit<ProductPayload, "price"> & { price: number | null } }>(
        "/api/products/analyze",
        { url: link },
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

  const submit = () => {
    if (!form?.name.trim() || !form.productUrl.trim()) {
      toast.error("상품명과 링크는 필수입니다.");
      return;
    }
    onSelect({
      ...form,
      name: form.name.trim(),
      price: form.price ? Number(String(form.price).replace(/[^\d]/g, "")) : undefined,
    });
  };

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">{guide}</div>

        <div className="flex gap-2">
          <Input
            placeholder={placeholder}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && url.trim() && analyzeMutation.mutate(url.trim())}
          />
          <Button onClick={() => url.trim() && analyzeMutation.mutate(url.trim())} disabled={analyzeMutation.isPending}>
            {analyzeMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            분석
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

            <div className="flex items-center justify-between">
              <Badge variant="secondary">
                <Link2 className="mr-1 size-3" />
                {source === "COUPANG" ? "쿠팡 파트너스" : "네이버 쇼핑 커넥트"}
              </Badge>
              <Button onClick={submit}>
                <PenLine className="size-4" /> 이 상품으로 홍보 글 생성
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
