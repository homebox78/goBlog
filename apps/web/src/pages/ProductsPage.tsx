import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, PenLine, Search, ShoppingBag } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { GenerateDialog, type ProductPayload } from "@/components/articles/GenerateDialog";

interface CoupangProduct {
  productId: number | string;
  productName: string;
  productPrice: number;
  productImage: string;
  productUrl: string;
  categoryName?: string;
  isRocket?: boolean;
}

const won = (value: number) => new Intl.NumberFormat("ko-KR").format(value);

export default function ProductsPage() {
  const [target, setTarget] = useState<ProductPayload | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">상품 홍보</h1>
        <p className="text-sm text-muted-foreground">
          쿠팡 파트너스·네이버 쇼핑 커넥트 상품을 선택하면 제휴 링크 배너와 대가성 문구가 포함된
          홍보 글을 자동 작성합니다.
        </p>
      </div>

      <Tabs defaultValue="search">
        <TabsList>
          <TabsTrigger value="search">쿠팡 상품 검색</TabsTrigger>
          <TabsTrigger value="goldbox">골드박스 특가</TabsTrigger>
          <TabsTrigger value="brandconnect">네이버 쇼핑 커넥트</TabsTrigger>
        </TabsList>

        <TabsContent value="search">
          <CoupangSearch onSelect={setTarget} />
        </TabsContent>
        <TabsContent value="goldbox">
          <Goldbox onSelect={setTarget} />
        </TabsContent>
        <TabsContent value="brandconnect">
          <BrandConnectForm onSelect={setTarget} />
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

function toPayload(product: CoupangProduct): ProductPayload {
  return {
    source: "COUPANG",
    name: product.productName,
    price: product.productPrice,
    imageUrl: product.productImage,
    productUrl: product.productUrl,
    isRocket: product.isRocket,
    description: product.categoryName,
  };
}

function ProductGrid({
  products,
  onSelect,
}: {
  products: CoupangProduct[];
  onSelect: (product: ProductPayload) => void;
}) {
  if (products.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">상품이 없습니다.</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <Card key={String(product.productId)} className="overflow-hidden">
          <CardContent className="flex h-full flex-col gap-2 p-3">
            <div className="flex h-36 items-center justify-center rounded-md bg-white">
              <img
                src={product.productImage}
                alt={product.productName}
                className="max-h-36 object-contain"
                loading="lazy"
              />
            </div>
            <p className="line-clamp-2 text-sm font-medium">{product.productName}</p>
            <div className="mt-auto flex items-center justify-between">
              <div>
                <p className="font-bold text-orange-600">{won(product.productPrice)}원</p>
                {product.isRocket && (
                  <Badge variant="secondary" className="text-[10px]">
                    🚀 로켓배송
                  </Badge>
                )}
              </div>
              <Button size="sm" onClick={() => onSelect(toPayload(product))}>
                <PenLine className="size-3.5" /> 홍보 글
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CoupangSearch({ onSelect }: { onSelect: (product: ProductPayload) => void }) {
  const [keyword, setKeyword] = useState("");
  const mutation = useMutation({
    mutationFn: (query: string) =>
      api.get<{ products: CoupangProduct[] }>(
        `/api/products/coupang/search?keyword=${encodeURIComponent(query)}&limit=24`,
      ),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "상품 검색에 실패했습니다."),
  });

  const search = () => keyword.trim() && mutation.mutate(keyword.trim());

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="상품 검색어 (예: 무선 청소기)"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && search()}
        />
        <Button onClick={search} disabled={mutation.isPending}>
          {mutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          검색
        </Button>
      </div>
      {mutation.isPending ? (
        <Skeleton className="h-64" />
      ) : mutation.data ? (
        <ProductGrid products={mutation.data.products} onSelect={onSelect} />
      ) : (
        <p className="py-10 text-center text-sm text-muted-foreground">
          쿠팡 파트너스 API로 상품을 검색합니다. 설정 → 쿠팡 파트너스에서 키를 먼저 연결해주세요.
        </p>
      )}
    </div>
  );
}

function Goldbox({ onSelect }: { onSelect: (product: ProductPayload) => void }) {
  const query = useQuery({
    queryKey: ["coupang", "goldbox"],
    queryFn: () => api.get<{ products: CoupangProduct[] }>("/api/products/coupang/goldbox"),
    retry: false,
  });

  if (query.isPending) return <Skeleton className="h-64" />;
  if (query.isError) {
    return (
      <p className="py-10 text-center text-sm text-destructive">
        {query.error instanceof Error ? query.error.message : "골드박스를 불러오지 못했습니다."}
      </p>
    );
  }
  return <ProductGrid products={query.data.products} onSelect={onSelect} />;
}

function BrandConnectForm({ onSelect }: { onSelect: (product: ProductPayload) => void }) {
  const [form, setForm] = useState({
    name: "",
    brand: "",
    price: "",
    imageUrl: "",
    productUrl: "",
    description: "",
  });

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = () => {
    if (!form.name.trim() || !form.productUrl.trim()) {
      toast.error("상품명과 트래킹 링크는 필수입니다.");
      return;
    }
    onSelect({
      source: "BRANDCONNECT",
      name: form.name.trim(),
      brand: form.brand.trim() || undefined,
      price: form.price ? Number(form.price.replace(/[^\d]/g, "")) : undefined,
      imageUrl: form.imageUrl.trim() || undefined,
      productUrl: form.productUrl.trim(),
      description: form.description.trim() || undefined,
    });
  };

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
          <p className="flex items-center gap-1 font-semibold text-foreground">
            <ShoppingBag className="size-3.5" /> 네이버 쇼핑 커넥트 사용법
          </p>
          <p className="mt-1">
            브랜드커넥트(쇼핑 커넥트) 콘솔에서 상품을 찾아 <b>[링크 복사]</b>로 트래킹 링크를
            발급받아 아래에 붙여넣으세요. 규정 대가성 문구("이 포스팅은 네이버 쇼핑 커넥트 활동의
            일환으로...")가 본문 최상단에 자동 삽입되며, 네이버 블로그 발행 시 제목 앞 표기도
            지원됩니다.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>상품명 *</Label>
            <Input value={form.name} onChange={set("name")} placeholder="예: OO 무선 청소기 V12" />
          </div>
          <div className="space-y-1.5">
            <Label>브랜드</Label>
            <Input value={form.brand} onChange={set("brand")} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>트래킹 링크 * (쇼핑 커넥트 [발급 링크 관리]에서 복사)</Label>
            <Input value={form.productUrl} onChange={set("productUrl")} placeholder="https://..." />
          </div>
          <div className="space-y-1.5">
            <Label>가격 (원)</Label>
            <Input value={form.price} onChange={set("price")} placeholder="129000" />
          </div>
          <div className="space-y-1.5">
            <Label>상품 이미지 URL</Label>
            <Input value={form.imageUrl} onChange={set("imageUrl")} placeholder="https://..." />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>상품 특징 메모 (글에 반영)</Label>
            <Textarea rows={3} value={form.description} onChange={set("description")} />
          </div>
        </div>

        <Button onClick={submit} className="w-full">
          <PenLine className="size-4" /> 이 상품으로 홍보 글 생성
        </Button>
      </CardContent>
    </Card>
  );
}
