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
    description: "매일 자동 수집할 관심 주제와 비율을 설정합니다.",
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
