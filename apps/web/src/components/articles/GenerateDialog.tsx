import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, PenLine } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ARTICLE_TYPES = [
  { value: "guide", label: "정보성 가이드" },
  { value: "news", label: "뉴스·이슈 해설" },
  { value: "comparison", label: "비교 콘텐츠" },
  { value: "product-review", label: "상품 리뷰" },
  { value: "how-to-apply", label: "신청·가입 방법" },
  { value: "pricing", label: "비용·가격 안내" },
  { value: "troubleshooting", label: "문제 해결" },
  { value: "faq", label: "FAQ" },
  { value: "checklist", label: "체크리스트" },
  { value: "how-to", label: "사용 방법" },
];

const LANGUAGES = [
  { value: "ko", label: "한국어" },
  { value: "en", label: "영어" },
  { value: "zh-CN", label: "중국어(간체)" },
  { value: "hi", label: "힌디어" },
  { value: "es", label: "스페인어" },
];

const LENGTHS = [
  { value: "1500", label: "짧게 (~1,500자)" },
  { value: "2000", label: "보통 (~2,000자)" },
  { value: "3000", label: "길게 (~3,000자)" },
];

export interface ProductPayload {
  source: "COUPANG" | "BRANDCONNECT";
  name: string;
  brand?: string;
  price?: number;
  imageUrl?: string;
  productUrl: string;
  description?: string;
  isRocket?: boolean;
}

export function GenerateDialog({
  keywordId,
  keyword,
  product,
  defaultArticleType,
  open,
  onOpenChange,
}: {
  keywordId?: number | null;
  keyword: string;
  product?: ProductPayload | null;
  defaultArticleType?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [articleType, setArticleType] = useState(product ? "product-review" : "guide");

  // 모달이 열릴 때마다 대상 키워드/상품에 맞는 글 유형을 기본 선택한다
  useEffect(() => {
    if (open) {
      setArticleType(product ? "product-review" : (defaultArticleType ?? "guide"));
    }
  }, [open, product, defaultArticleType]);
  const [language, setLanguage] = useState("ko");
  const [length, setLength] = useState("2000");
  const [withFaq, setWithFaq] = useState(true);
  const [withProduct, setWithProduct] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const schemaTypes = ["BlogPosting"];
      if (withFaq) schemaTypes.push("FAQPage");
      if (withProduct) schemaTypes.push("Product");
      const result = await api.post<{ articleId: number; qualityScore: number }>(
        "/api/articles/generate",
        {
          keywordId: keywordId ?? undefined,
          articleType,
          language,
          schemaTypes,
          length: Number(length),
          product: product ?? undefined,
        },
      );
      // 이미지도 자동 생성 (실패해도 글은 유지)
      await api.post(`/api/articles/${result.articleId}/images`).catch(() => undefined);
      return result;
    },
    onSuccess: (result) => {
      toast.success(`글·이미지 생성 완료 (품질 ${result.qualityScore}점)`);
      onOpenChange(false);
      navigate(`/articles/${result.articleId}`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "글 생성에 실패했습니다.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="size-4" /> 글 생성
          </DialogTitle>
          <DialogDescription>
            {product ? (
              <>
                상품 <b className="text-foreground">{product.name}</b>의 홍보 글을 작성합니다.
                제휴 링크 배너와 대가성 문구가 자동 삽입됩니다.
              </>
            ) : (
              <>
                키워드 <b className="text-foreground">{keyword}</b>로 Claude가 글을 작성합니다.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>글 유형</Label>
              <Select value={articleType} onValueChange={setArticleType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ARTICLE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>언어</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>글 길이</Label>
            <Select value={length} onValueChange={setLength}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LENGTHS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>스키마 (구조화 데이터)</Label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={withFaq} onCheckedChange={(value) => setWithFaq(value === true)} />
              FAQ (자주 묻는 질문)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={withProduct}
                onCheckedChange={(value) => setWithProduct(value === true)}
              />
              상품 리뷰 (실사용 확인 전까지 비활성 저장)
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            취소
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || (!keywordId && !product)}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {mutation.isPending ? "글·이미지 생성 중 (3~4분)..." : "글 생성"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
