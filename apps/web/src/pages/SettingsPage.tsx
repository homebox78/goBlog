import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Loader2, MinusCircle, PlugZap, XCircle } from "lucide-react";
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
import CharactersPage from "./CharactersPage";

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
  name?: string;
  skipped?: boolean;
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

/** 고정 옵션 셀렉트 설정 키 */
const STATIC_SELECT_KEYS: Record<string, Array<{ value: string; label: string }>> = {
  "anthropic.defaultLength": [
    { value: "1500", label: "짧게 (~1,500자)" },
    { value: "2000", label: "보통 (~2,000자)" },
    { value: "2500", label: "길게 (~2,500자)" },
    { value: "3500", label: "심층 (~3,500자)" },
  ],
  "gemini.featuredImageCount": [
    { value: "1", label: "1장" },
    { value: "2", label: "2장" },
  ],
  "gemini.contentImageCount": [
    { value: "2", label: "2장" },
    { value: "3", label: "3장" },
    { value: "4", label: "4장" },
  ],
};

/** 게시 플랫폼 탭 안에서 플랫폼별로 묶는 서브그룹 (키 접두사 기준 + 연결테스트 결과명 매칭) */
const PLATFORM_SUBGROUPS: Array<{ label: string; prefixes: string[]; testName: string }> = [
  { label: "WordPress", prefixes: ["wordpress."], testName: "WordPress" },
  { label: "Blogger", prefixes: ["blogger."], testName: "Blogger" },
  { label: "네이버 블로그", prefixes: ["naverBlog.", "naverBrandConnect."], testName: "네이버 블로그" },
  { label: "티스토리", prefixes: ["tistory."], testName: "티스토리" },
  { label: "Instagram", prefixes: ["instagram."], testName: "Instagram" },
];

const GROUPS: Array<{ id: string; label: string; description: string; testEndpoint?: string }> = [
  {
    id: "claude",
    label: "Claude",
    description: "글 작성·키워드 해석·품질 검수에 사용됩니다. 문체는 AI가 글 성격에 맞게 자동 판단합니다.",
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
    testEndpoint: "/api/settings/test/platforms",
  },
];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult[]>>({});

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

  const handleTest = async (groupId: string, groupLabel: string, endpoint: string) => {
    setTesting(endpoint);
    try {
      const result = await api.post<TestResult | { results: TestResult[] }>(endpoint);
      const list = "results" in result ? result.results : [{ ...result, name: groupLabel }];
      setTestResults((prev) => ({ ...prev, [groupId]: list }));

      const tested = list.filter((item) => !item.skipped);
      const okCount = tested.filter((item) => item.ok).length;
      if (okCount === tested.length) {
        toast.success(`연결 테스트: ${okCount}/${tested.length} 성공`);
      } else {
        toast.error(`연결 테스트: ${okCount}/${tested.length} 성공 — 실패 항목을 확인하세요.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "테스트 요청에 실패했습니다.");
    } finally {
      setTesting(null);
    }
  };

  // 설정 필드 하나 렌더 (모델 셀렉트 / 고정 셀렉트 / 텍스트·비밀 입력)
  const renderField = (setting: SettingView) => (
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
          onChange={(value) => setEdited((prev) => ({ ...prev, [setting.key]: value }))}
        />
      ) : STATIC_SELECT_KEYS[setting.key] ? (
        <Select
          value={edited[setting.key] ?? setting.value ?? ""}
          onValueChange={(value) => setEdited((prev) => ({ ...prev, [setting.key]: value }))}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="선택" />
          </SelectTrigger>
          <SelectContent>
            {STATIC_SELECT_KEYS[setting.key].map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={setting.key}
          type={setting.isSecret ? "password" : "text"}
          autoComplete="off"
          placeholder={setting.isSecret ? (setting.hasValue ? "변경하려면 새 값 입력" : "미설정") : undefined}
          value={edited[setting.key] ?? (setting.isSecret ? "" : (setting.value ?? ""))}
          onChange={(event) => setEdited((prev) => ({ ...prev, [setting.key]: event.target.value }))}
        />
      )}
    </div>
  );

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
        {/* 탭이 8개라 모바일 한 줄에 안 들어간다 — 가로로 밀지 말고 줄바꿈으로 접는다.
            (기본 TabsList는 h-9 고정이라 !h-auto 로 풀어야 두 줄이 된다) */}
        <TabsList className="!h-auto w-full flex-wrap justify-start">
          {GROUPS.map((group) => (
            <TabsTrigger key={group.id} value={group.id}>
              {group.label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="characters">캐릭터</TabsTrigger>
        </TabsList>

        {/* 캐릭터 관리 — 상단 저장 버튼은 API 키 설정용이며 이 탭과 무관합니다 */}
        <TabsContent value="characters">
          <CharactersPage />
        </TabsContent>

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
                    onClick={() => handleTest(group.id, group.label, group.testEndpoint!)}
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
              {testResults[group.id] && (
                <CardContent className="pb-0">
                  <div className="space-y-1.5 rounded-lg border bg-muted/40 p-3">
                    {testResults[group.id].map((result) => (
                      <div key={result.name ?? result.message} className="flex items-start gap-2 text-sm">
                        {result.skipped ? (
                          <MinusCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        ) : result.ok ? (
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                        ) : (
                          <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                        )}
                        <span className={result.skipped ? "text-muted-foreground" : ""}>
                          {result.name && <b>{result.name}: </b>}
                          {result.message}
                          {typeof result.detail === "string" && (
                            <span className="text-muted-foreground"> — {result.detail}</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
              {group.id === "platforms" ? (
                <CardContent className="space-y-4">
                  {PLATFORM_SUBGROUPS.map((sub) => {
                    const subSettings = settings.filter(
                      (s) => s.group === group.id && sub.prefixes.some((p) => s.key.startsWith(p)),
                    );
                    if (subSettings.length === 0) return null;
                    const test = testResults[group.id]?.find((r) => r.name === sub.testName);
                    return (
                      <div key={sub.label} className="rounded-lg border p-3">
                        <div className="mb-3 flex items-center gap-2">
                          <h3 className="text-sm font-semibold">{sub.label}</h3>
                          {test && !test.skipped && test.ok && (
                            <Badge className="bg-emerald-600 text-[10px] hover:bg-emerald-600">✓ 연결됨</Badge>
                          )}
                          {test && !test.skipped && !test.ok && (
                            <Badge variant="destructive" className="text-[10px]">연결 실패</Badge>
                          )}
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">{subSettings.map(renderField)}</div>
                      </div>
                    );
                  })}
                </CardContent>
              ) : (
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  {settings.filter((setting) => setting.group === group.id).map(renderField)}
                </CardContent>
              )}
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
