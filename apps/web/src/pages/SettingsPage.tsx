import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, PlugZap } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SettingView {
  key: string;
  group: string;
  label: string;
  isSecret: boolean;
  value: string | null;
  hasValue: boolean;
}

interface TestResult {
  ok: boolean;
  message: string;
  detail?: unknown;
}

interface ModelList {
  models: string[];
  source: "api" | "default";
}

/** 드롭다운 선택형 설정 키 → 모델 목록 엔드포인트 */
const MODEL_SELECT_KEYS: Record<string, string> = {
  "anthropic.model": "/api/settings/models/anthropic",
  "gemini.imageModel": "/api/settings/models/gemini",
};

const GROUPS: Array<{ id: string; label: string; description: string; testEndpoint?: string }> = [
  {
    id: "claude",
    label: "Claude",
    description: "글 작성·키워드 해석·품질 검수에 사용됩니다.",
    testEndpoint: "/api/settings/test/anthropic",
  },
  {
    id: "gemini",
    label: "Gemini",
    description: "대표 이미지와 본문 이미지 생성에 사용됩니다.",
    testEndpoint: "/api/settings/test/gemini",
  },
  {
    id: "keywords",
    label: "키워드",
    description:
      "주제는 매일 수집한 이슈·트렌드 데이터에서 AI가 자동 발굴합니다. 추천 개수·시간·유형 비율만 설정합니다.",
  },
  {
    id: "googleAds",
    label: "Google Ads",
    description: "키워드 검색량·CPC·광고 경쟁도 조회에 사용됩니다.",
    testEndpoint: "/api/settings/test/google-ads",
  },
  {
    id: "naver",
    label: "네이버",
    description: "데이터랩 트렌드와 검색광고 지표 조회에 사용됩니다.",
  },
  {
    id: "coupang",
    label: "쿠팡 파트너스",
    description: "상품 검색·골드박스·딥링크(제휴 링크) 발급에 사용됩니다.",
    testEndpoint: "/api/settings/test/coupang",
  },
  {
    id: "platforms",
    label: "게시 플랫폼",
    description: "WordPress·Blogger 발행 및 네이버·티스토리 작성 URL을 설정합니다.",
    testEndpoint: "/api/settings/test/wordpress",
  },
];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<{ settings: SettingView[] }>("/api/settings"),
  });

  const anthropicModels = useQuery({
    queryKey: ["models", "anthropic"],
    queryFn: () => api.get<ModelList>("/api/settings/models/anthropic"),
    staleTime: 5 * 60 * 1000,
  });

  const geminiModels = useQuery({
    queryKey: ["models", "gemini"],
    queryFn: () => api.get<ModelList>("/api/settings/models/gemini"),
    staleTime: 5 * 60 * 1000,
  });

  const modelOptions: Record<string, string[]> = {
    "anthropic.model": anthropicModels.data?.models ?? [],
    "gemini.imageModel": geminiModels.data?.models ?? [],
  };

  const saveMutation = useMutation({
    mutationFn: (values: Record<string, string | null>) =>
      api.put<{ settings: SettingView[] }>("/api/settings", { values }),
    onSuccess: () => {
      setEdited({});
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("설정을 저장했습니다.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "저장에 실패했습니다.");
    },
  });

  if (query.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (query.isError) {
    return <p className="text-sm text-destructive">설정을 불러오지 못했습니다.</p>;
  }

  const settings = query.data.settings;
  const dirtyCount = Object.keys(edited).length;

  const handleSave = () => {
    if (dirtyCount === 0) {
      toast.info("변경된 항목이 없습니다.");
      return;
    }
    saveMutation.mutate(edited);
  };

  const handleTest = async (endpoint: string) => {
    setTesting(endpoint);
    try {
      const result = await api.post<TestResult>(endpoint);
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.message, {
          description: typeof result.detail === "string" ? result.detail : undefined,
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "테스트 요청에 실패했습니다.");
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">설정</h1>
          <p className="text-sm text-muted-foreground">
            API 키는 서버에 AES-256-GCM으로 암호화되어 저장됩니다.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending && <Loader2 className="size-4 animate-spin" />}
          저장{dirtyCount > 0 ? ` (${dirtyCount})` : ""}
        </Button>
      </div>

      <Tabs defaultValue="claude">
        <TabsList>
          {GROUPS.map((group) => (
            <TabsTrigger key={group.id} value={group.id}>
              {group.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {GROUPS.map((group) => (
          <TabsContent key={group.id} value={group.id}>
            <Card>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{group.label}</CardTitle>
                  <CardDescription>{group.description}</CardDescription>
                </div>
                {group.testEndpoint && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={testing !== null}
                    onClick={() => handleTest(group.testEndpoint!)}
                  >
                    {testing === group.testEndpoint ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <PlugZap className="size-4" />
                    )}
                    연결 테스트
                  </Button>
                )}
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                {settings
                  .filter((setting) => setting.group === group.id)
                  .map((setting) => (
                    <div key={setting.key} className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={setting.key} className="text-xs">
                          {setting.label}
                        </Label>
                        {setting.isSecret && setting.hasValue && (
                          <Badge variant="secondary" className="text-[10px]">
                            저장됨
                          </Badge>
                        )}
                      </div>
                      {MODEL_SELECT_KEYS[setting.key] ? (
                        <ModelSelect
                          value={edited[setting.key] ?? setting.value ?? ""}
                          options={modelOptions[setting.key] ?? []}
                          onChange={(value) =>
                            setEdited((prev) => ({ ...prev, [setting.key]: value }))
                          }
                        />
                      ) : (
                        <Input
                          id={setting.key}
                          type={setting.isSecret ? "password" : "text"}
                          autoComplete="off"
                          placeholder={
                            setting.isSecret
                              ? setting.hasValue
                                ? "변경하려면 새 값 입력"
                                : "미설정"
                              : undefined
                          }
                          value={edited[setting.key] ?? (setting.isSecret ? "" : (setting.value ?? ""))}
                          onChange={(event) =>
                            setEdited((prev) => ({ ...prev, [setting.key]: event.target.value }))
                          }
                        />
                      )}
                    </div>
                  ))}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function ModelSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  // 현재 저장된 값이 목록에 없어도 선택 상태가 유지되도록 포함시킨다.
  const items = value && !options.includes(value) ? [value, ...options] : options;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="모델 선택" />
      </SelectTrigger>
      <SelectContent>
        {items.map((model) => (
          <SelectItem key={model} value={model}>
            {model}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
