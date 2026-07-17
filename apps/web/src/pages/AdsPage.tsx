import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Upload, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

interface AdSlot {
  position: string;
  label: string;
  size: string;
  enabled: boolean;
  type: "ADSENSE" | "IMAGE";
  adsenseCode: string;
  imageUrl: string;
  linkUrl: string;
  newTab: boolean;
  sponsored: boolean;
}

export default function AdsPage() {
  const { data, isPending } = useQuery({
    queryKey: ["ads"],
    queryFn: () => api.get<{ slots: AdSlot[] }>("/api/ads"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">광고 관리</h1>
        <p className="text-sm text-muted-foreground">
          위치별로 광고를 켜고 끌 수 있습니다. <b>애드센스</b> 코드를 붙여넣거나, <b>직접 배너 이미지</b>를 올리고 링크를
          걸 수 있습니다(쿠팡·네이버 등). 애드센스는 승인 후 코드가 발급됩니다.
        </p>
      </div>
      {isPending ? (
        <p className="py-10 text-center text-sm text-muted-foreground">불러오는 중...</p>
      ) : (
        <div className="space-y-4">
          {(data?.slots ?? []).map((slot) => (
            <SlotCard key={slot.position} slot={slot} />
          ))}
        </div>
      )}
    </div>
  );
}

interface BannerProduct {
  id: number;
  name: string;
  source: string;
  price: number | null;
  imageUrl: string | null;
}

function SlotCard({ slot }: { slot: AdSlot }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AdSlot>(slot);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [pq, setPq] = useState("");
  const [genFormat, setGenFormat] = useState<"box" | "wide" | "card">(
    slot.position.startsWith("home-top") || slot.position === "category-top" ? "wide" : "box",
  );
  const [generating, setGenerating] = useState<number | null>(null);

  useEffect(() => setForm(slot), [slot]);

  const bannerProducts = useQuery({
    queryKey: ["ad-products", pq, genOpen],
    queryFn: () => api.get<{ products: BannerProduct[] }>(`/api/ads/products${pq ? `?q=${encodeURIComponent(pq)}` : ""}`),
    enabled: genOpen,
  });

  const genBanner = async (productId: number, linkUrl: string) => {
    setGenerating(productId);
    try {
      const r = await api.post<{ url: string; linkUrl: string }>("/api/ads/generate-banner", {
        productId,
        format: genFormat,
      });
      setForm((f) => ({ ...f, type: "IMAGE", imageUrl: r.url, linkUrl: r.linkUrl }));
      setGenOpen(false);
      toast.success("배너를 생성했습니다 — 저장을 눌러 적용하세요.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "배너 생성 실패");
    } finally {
      setGenerating(null);
    }
    void linkUrl;
  };

  const save = useMutation({
    mutationFn: () =>
      api.put(`/api/ads/${form.position}`, {
        enabled: form.enabled,
        type: form.type,
        adsenseCode: form.adsenseCode,
        imageUrl: form.imageUrl,
        linkUrl: form.linkUrl,
        newTab: form.newTab,
        sponsored: form.sponsored,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ads"] });
      toast.success(`${form.label} 저장됨`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "저장 실패"),
  });

  const upload = async (file: File) => {
    if (file.size > 3 * 1024 * 1024) {
      toast.error("이미지는 3MB 이하만 가능합니다.");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const { url } = await api.post<{ url: string }>("/api/ads/upload", { dataUrl });
      setForm((f) => ({ ...f, imageUrl: url }));
      toast.success("이미지 업로드 완료 — 저장을 눌러 적용하세요.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold">{form.label}</div>
            <div className="text-xs text-muted-foreground">
              {form.size} · <code className="text-[11px]">{form.position}</code>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={form.enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))} />
            {form.enabled ? "노출" : "숨김"}
          </label>
        </div>

        <div className="flex gap-2">
          {(["IMAGE", "ADSENSE"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setForm((f) => ({ ...f, type: t }))}
              className={
                "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors " +
                (form.type === t ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")
              }
            >
              {t === "IMAGE" ? "직접 이미지 배너" : "애드센스 코드"}
            </button>
          ))}
        </div>

        {form.type === "IMAGE" ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {form.imageUrl ? (
                <img src={form.imageUrl} alt="배너" className="h-20 max-w-[280px] rounded border object-contain" />
              ) : (
                <div className="flex h-20 w-40 items-center justify-center rounded border bg-muted text-xs text-muted-foreground">
                  이미지 없음
                </div>
              )}
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
                />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                    이미지 업로드
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setGenOpen((v) => !v)}>
                    ✨ 상품으로 자동 생성
                  </Button>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">PNG·JPG·WebP · 3MB 이하</p>
              </div>
            </div>

            {genOpen && (
              <div className="rounded-lg border bg-muted/40 p-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">쿠팡·네이버 상품으로 배너 생성</span>
                  <div className="ml-auto flex gap-1">
                    {(["box", "wide", "card"] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setGenFormat(fmt)}
                        className={
                          "rounded border px-2 py-0.5 text-xs " +
                          (genFormat === fmt ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")
                        }
                      >
                        {fmt === "box" ? "박스형" : fmt === "wide" ? "가로형" : "카드형"}
                      </button>
                    ))}
                  </div>
                </div>
                <Input value={pq} onChange={(e) => setPq(e.target.value)} placeholder="상품 검색 (예: 선풍기)" className="h-8 text-sm" />
                <div className="max-h-56 space-y-1 overflow-y-auto">
                  {bannerProducts.isPending ? (
                    <p className="py-3 text-center text-xs text-muted-foreground">불러오는 중...</p>
                  ) : (bannerProducts.data?.products ?? []).length === 0 ? (
                    <p className="py-3 text-center text-xs text-muted-foreground">트래킹 링크 있는 상품이 없습니다.</p>
                  ) : (
                    (bannerProducts.data?.products ?? []).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => genBanner(p.id, "")}
                        disabled={generating !== null}
                        className="flex w-full items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-left text-xs hover:bg-accent disabled:opacity-50"
                      >
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt="" referrerPolicy="no-referrer" className="size-9 rounded border object-contain" />
                        ) : (
                          <div className="size-9 rounded border bg-muted" />
                        )}
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px]">
                          {p.source === "COUPANG" ? "쿠팡" : "네이버"}
                        </span>
                        {generating === p.id && <Loader2 className="size-4 animate-spin" />}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">이미지 URL (직접 입력도 가능)</Label>
              <Input value={form.imageUrl} onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">클릭 링크 (쿠팡·네이버 제휴 링크 등)</Label>
              <Input
                value={form.linkUrl}
                onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))}
                placeholder="https://link.coupang.com/..."
              />
            </div>
            <div className="flex gap-5 text-sm">
              <label className="flex items-center gap-2">
                <Switch checked={form.newTab} onCheckedChange={(v) => setForm((f) => ({ ...f, newTab: v }))} /> 새 탭
              </label>
              <label className="flex items-center gap-2">
                <Switch checked={form.sponsored} onCheckedChange={(v) => setForm((f) => ({ ...f, sponsored: v }))} />{" "}
                제휴(rel=sponsored)
              </label>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <Label className="text-xs">애드센스(또는 광고) 코드</Label>
            <Textarea
              rows={4}
              className="font-mono text-xs"
              value={form.adsenseCode}
              onChange={(e) => setForm((f) => ({ ...f, adsenseCode: e.target.value }))}
              placeholder='<script async src="https://pagead2.googlesyndication.com/..."></script><ins class="adsbygoogle" ...></ins>'
            />
            <p className="text-[11px] text-muted-foreground">
              애드센스 승인 후 발급되는 광고 단위 코드를 붙여넣으세요.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <a
            href={form.position.startsWith("home") ? "https://hom2box.com/" : "https://hom2box.com/"}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="size-3" /> 사이트에서 확인
          </a>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />}저장
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
