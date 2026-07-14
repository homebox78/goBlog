import { useEffect, useRef, useState } from "react";
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
  // 완료 시점에 다이얼로그가 아직 열려 있는지 — 닫고 다른 일을 하는 중이면 갑자기 화면을 낚아채지 않는다
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

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
      if (openRef.current) {
        // 기다리고 있었음 — 바로 글로 이동
        toast.success(`글·이미지 생성 완료 (품질 ${result.qualityScore}점)`);
        onOpenChange(false);
        navigate(`/articles/${result.articleId}`);
      } else {
        // 닫고 다른 작업 중 — 화면을 낚아채지 말고 알림 + 열기 버튼만
        toast.success(`"${keyword}" 글 생성 완료 (품질 ${result.qualityScore}점)`, {
          duration: 15000,
          action: { label: "글 열기", onClick: () => navigate(`/articles/${result.articleId}`) },
        });
      }
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "글 생성에 실패했습니다.";
      // 연결이 끊긴 경우(서버 재시작·네트워크) 서버에선 생성이 계속 진행 중일 수 있다.
      // 그냥 "실패"라고만 하면 사용자가 다시 눌러 같은 글을 두 번 만든다.
      const disconnected = /fetch|network|failed to fetch|502|503|504/i.test(message);
      toast.error(
        disconnected
          ? "응답을 받지 못했습니다. 서버에서 계속 생성 중일 수 있으니, 다시 누르기 전에 잠시 후 글 관리 목록을 확인하세요."
          : message,
      );
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // 생성 중에도 닫을 수 있다 — 요청은 계속 진행되고 완료되면 토스트로 알린다.
        // (3~4분짜리 모달 잠금은 그동안 관리자 전체를 묶는다)
        if (!next && mutation.isPending) {
          toast.info("글 생성은 백그라운드에서 계속됩니다. 완료되면 알려드릴게요.");
        }
        onOpenChange(next);
      }}
    >
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {mutation.isPending ? "닫기 (백그라운드 계속)" : "취소"}
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
