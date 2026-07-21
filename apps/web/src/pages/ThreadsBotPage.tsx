import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Trash2,
  Copy,
  Send,
  Sparkles,
  ImagePlus,
  X,
  Pencil,
  ExternalLink,
  Bot,
  Link2,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Mode = "WARMUP" | "REVENUE";

interface Persona {
  id: number;
  name: string;
  description: string | null;
  systemPrompt: string;
  isActive: boolean;
  sortOrder: number;
}

interface Connection {
  appId: string;
  hasAppSecret: boolean;
  connected: boolean;
  username: string;
  userId: string;
  tokenExpiresAt: string;
  redirectUri: string;
}

interface Post {
  id: number;
  personaId: number | null;
  personaName: string | null;
  mode: Mode;
  keyword: string | null;
  text: string;
  linkUrl: string | null;
  disclosure: boolean;
  imageUrl: string | null;
  status: "DRAFT" | "POSTED" | "FAILED";
  threadsUrl: string | null;
  error: string | null;
  postedAt: string | null;
  createdAt: string;
  fullText: string;
}

const MODE_LABEL: Record<Mode, string> = { WARMUP: "밑밥글", REVENUE: "수익화글" };

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("복사했습니다");
  } catch {
    toast.error("복사 실패 — 직접 선택해 복사해주세요");
  }
}

export default function ThreadsBotPage() {
  const personasQuery = useQuery({
    queryKey: ["threads-personas"],
    queryFn: () => api.get<{ personas: Persona[] }>("/api/threads-bot/personas"),
  });
  const personas = personasQuery.data?.personas ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Bot className="size-6" /> 쓰레드 봇
        </h1>
        <p className="text-sm text-muted-foreground">
          페르소나(봇)를 만들어 두고, 키워드만 던지면 그 말투로 짧은 스레드 글을 뽑습니다. 사진은 직접
          첨부할 수 있고, 복사하거나 Threads로 바로 발행합니다.
        </p>
      </div>

      <ThreadsConnectCard />

      <Tabs defaultValue="generate" className="w-full">
        <TabsList>
          <TabsTrigger value="generate">
            <Sparkles className="size-4" /> 글 생성
          </TabsTrigger>
          <TabsTrigger value="posts">초안·발행</TabsTrigger>
          <TabsTrigger value="personas">봇 관리</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="pt-4">
          <GeneratorTab personas={personas} loading={personasQuery.isPending} />
        </TabsContent>
        <TabsContent value="posts" className="pt-4">
          <PostsTab />
        </TabsContent>
        <TabsContent value="personas" className="pt-4">
          <PersonasTab personas={personas} loading={personasQuery.isPending} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── 쓰레드 계정 연결 ────────────────────────────────────────────

function ThreadsConnectCard() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["threads-connection"],
    queryFn: () => api.get<Connection>("/api/threads-bot/connection"),
  });
  const conn = query.data;

  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [open, setOpen] = useState(false); // 설정 폼 펼침
  const [connecting, setConnecting] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["threads-connection"] });

  // 연결 완료(OAuth 팝업 종료) 감지 — 주기적으로 상태를 다시 확인
  const pollUntilConnected = () => {
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      const c = await api.get<Connection>("/api/threads-bot/connection").catch(() => null);
      if (c?.connected || tries > 48) {
        clearInterval(timer);
        setConnecting(false);
        invalidate();
        if (c?.connected) toast.success(`@${c.username} 연결됨`);
      }
    }, 2500);
  };

  const disconnect = useMutation({
    mutationFn: () => api.post("/api/threads-bot/connection/disconnect"),
    onSuccess: () => {
      toast.success("연결을 해제했습니다");
      invalidate();
    },
  });

  const handleConnect = async () => {
    try {
      setConnecting(true);
      // App ID/Secret 저장(입력이 있으면)
      if (appId.trim() || appSecret.trim()) {
        await api.post("/api/threads-bot/connection/app", {
          appId: appId.trim() || undefined,
          appSecret: appSecret.trim() || undefined,
        });
        invalidate();
      }
      const { url } = await api.get<{ url: string }>("/api/threads-bot/oauth/start");
      window.open(url, "threads-oauth", "width=600,height=760");
      pollUntilConnected();
    } catch (e) {
      setConnecting(false);
      toast.error(e instanceof Error ? e.message : "연결 시작 실패");
    }
  };

  if (query.isPending) return <Skeleton className="h-24" />;

  // 연결됨
  if (conn?.connected) {
    const days = conn.tokenExpiresAt
      ? Math.max(0, Math.round((new Date(conn.tokenExpiresAt).getTime() - Date.now()) / 86400000))
      : null;
    return (
      <Card className="border-emerald-500/40">
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <CheckCircle2 className="size-5 text-emerald-600" />
          <div className="mr-auto">
            <p className="font-semibold">
              스레드 연결됨{conn.username ? ` — @${conn.username}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              발행 버튼이 이 계정으로 글을 올립니다.
              {days !== null ? ` 토큰 만료까지 약 ${days}일 (만료 전 다시 연결).` : ""}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleConnect} disabled={connecting}>
            {connecting ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            다시 연결
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={disconnect.isPending}
            onClick={() => disconnect.mutate()}
          >
            연결 해제
          </Button>
        </CardContent>
      </Card>
    );
  }

  // 미연결
  return (
    <Card className="border-primary/30">
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-center gap-2">
          <Link2 className="size-5 text-primary" />
          <p className="font-semibold">스레드 계정 연결</p>
          {conn?.appId && (
            <Badge variant="outline" className="ml-auto">
              App ID 저장됨
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Meta 앱(Threads API)의 App ID·Secret을 넣고 “계정 연결”을 누르면, 스레드 로그인·승인만으로 발행 토큰이
          자동 등록됩니다.
        </p>

        {!open && !conn?.appId ? (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            App ID / Secret 입력
          </Button>
        ) : (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Threads App ID</Label>
              <Input
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder={conn?.appId || "예: 1234567890123456"}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Threads App Secret</Label>
              <Input
                type="password"
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                placeholder={conn?.hasAppSecret ? "저장됨 (바꿀 때만 입력)" : "앱 시크릿"}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">리디렉션 URI (Meta 앱에 그대로 등록)</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded bg-background px-2 py-1.5 text-xs">
                  {conn?.redirectUri}
                </code>
                <Button variant="outline" size="sm" onClick={() => conn && copyText(conn.redirectUri)}>
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            disabled={connecting || (!conn?.appId && !appId.trim())}
            onClick={handleConnect}
          >
            {connecting ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
            계정 연결
          </Button>
          <span className="text-xs text-muted-foreground">
            토큰이 없어도 각 글의 <b>복사</b> 버튼으로 스레드 앱에 붙여넣을 수 있습니다.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ── 글 생성 ─────────────────────────────────────────────────────

function GeneratorTab({ personas, loading }: { personas: Persona[]; loading: boolean }) {
  const queryClient = useQueryClient();
  const [personaId, setPersonaId] = useState<string>("");
  const [mode, setMode] = useState<Mode>("WARMUP");
  const [keyword, setKeyword] = useState("");
  const [candidates, setCandidates] = useState<string[]>([]);

  const activePersonaId = personaId || (personas[0]?.id ? String(personas[0].id) : "");

  const generate = useMutation({
    mutationFn: () =>
      api.post<{ candidates: string[] }>("/api/threads-bot/generate", {
        personaId: Number(activePersonaId),
        keyword: keyword.trim(),
        mode,
        count: 3,
      }),
    onSuccess: (data) => setCandidates(data.candidates),
    onError: (e) => toast.error(e instanceof Error ? e.message : "생성 실패"),
  });

  const saveDraft = useMutation({
    mutationFn: (text: string) =>
      api.post<{ post: Post }>("/api/threads-bot/posts", {
        personaId: Number(activePersonaId),
        mode,
        keyword: keyword.trim() || undefined,
        text,
        disclosure: mode === "REVENUE",
      }),
    onSuccess: () => {
      toast.success("초안에 저장했습니다 (초안·발행 탭)");
      queryClient.invalidateQueries({ queryKey: ["threads-posts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "저장 실패"),
  });

  if (loading) return <Skeleton className="h-64" />;
  if (personas.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        먼저 <b>봇 관리</b> 탭에서 페르소나를 하나 만들어주세요.
      </p>
    );

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-1.5">
            <Label>봇(페르소나)</Label>
            <Select value={activePersonaId} onValueChange={setPersonaId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="봇 선택" />
              </SelectTrigger>
              <SelectContent>
                {personas.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>모드</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["WARMUP", "REVENUE"] as Mode[]).map((m) => (
                <Button
                  key={m}
                  type="button"
                  variant={mode === m ? "default" : "outline"}
                  onClick={() => setMode(m)}
                >
                  {MODE_LABEL[m]}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {mode === "WARMUP"
                ? "링크 없는 순수 일상 공감글 (계정 초기 밑밥용)"
                : "후킹 + 자연스러운 후기. 저장 시 공정위 문구가 켜집니다."}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>키워드 / 상황</Label>
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={mode === "WARMUP" ? "예: 월요일 아침" : "예: 모니터 조명"}
              onKeyDown={(e) => {
                if (e.key === "Enter" && keyword.trim()) generate.mutate();
              }}
            />
          </div>

          <Button
            className="w-full"
            disabled={!keyword.trim() || generate.isPending}
            onClick={() => generate.mutate()}
          >
            {generate.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            글 생성
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {candidates.length === 0 ? (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            키워드를 넣고 “글 생성”을 누르면 후보가 여기 나옵니다.
          </div>
        ) : (
          candidates.map((text, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 pt-6">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{text.length}자</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => copyText(text)}>
                      <Copy className="size-4" /> 복사
                    </Button>
                    <Button
                      size="sm"
                      disabled={saveDraft.isPending}
                      onClick={() => saveDraft.mutate(text)}
                    >
                      초안으로 저장
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// ── 초안·발행 ───────────────────────────────────────────────────

function PostsTab() {
  const query = useQuery({
    queryKey: ["threads-posts"],
    queryFn: () => api.get<{ posts: Post[] }>("/api/threads-bot/posts"),
  });

  if (query.isPending) return <Skeleton className="h-64" />;
  if (query.isError) return <p className="text-sm text-destructive">초안을 불러오지 못했습니다.</p>;
  const posts = query.data.posts;
  if (posts.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        아직 초안이 없습니다. <b>글 생성</b> 탭에서 만들어 저장해보세요.
      </p>
    );

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

function PostCard({ post }: { post: Post }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(post.text);
  const [linkUrl, setLinkUrl] = useState(post.linkUrl ?? "");
  const [disclosure, setDisclosure] = useState(post.disclosure);
  const [uploading, setUploading] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["threads-posts"] });

  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.put<{ post: Post }>(`/api/threads-bot/posts/${post.id}`, body),
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(e instanceof Error ? e.message : "저장 실패"),
  });

  const del = useMutation({
    mutationFn: () => api.delete(`/api/threads-bot/posts/${post.id}`),
    onSuccess: () => {
      toast.success("삭제했습니다");
      invalidate();
    },
  });

  const publish = useMutation({
    mutationFn: () => api.post<{ post: Post }>(`/api/threads-bot/posts/${post.id}/publish`),
    onSuccess: () => {
      toast.success("Threads에 발행했습니다");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "발행 실패"),
  });

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      await update.mutateAsync({ imageDataUrl: dataUrl });
      toast.success("이미지 첨부 완료");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setUploading(false);
    }
  };

  const dirty = text !== post.text || linkUrl !== (post.linkUrl ?? "") || disclosure !== post.disclosure;

  // 최종 발행 문구 미리보기 (서버 composeFullText와 동일한 규칙)
  const preview = [text.trim(), disclosure ? `\n이 포스팅은 쿠팡 파트너스 활동의 일환으로 일정액의 수수료를 지급받습니다.` : "", linkUrl.trim()]
    .filter(Boolean)
    .join("\n")
    .trim();

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={post.mode === "REVENUE" ? "default" : "secondary"}>{MODE_LABEL[post.mode]}</Badge>
          {post.personaName && <Badge variant="outline">{post.personaName}</Badge>}
          {post.keyword && <span className="text-xs text-muted-foreground">#{post.keyword}</span>}
          <div className="ml-auto">
            {post.status === "POSTED" ? (
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">발행됨</Badge>
            ) : post.status === "FAILED" ? (
              <Badge variant="destructive">실패</Badge>
            ) : (
              <Badge variant="outline">초안</Badge>
            )}
          </div>
        </div>

        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className="resize-y" />

        {post.mode === "REVENUE" && (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <div className="space-y-1.5">
              <Label className="text-xs">제휴 링크 (쿠팡 파트너스 등)</Label>
              <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://link.coupang.com/..." />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={disclosure} onCheckedChange={setDisclosure} />
              공정위 대가성 문구를 링크 위에 자동 삽입 (필수)
            </label>
          </div>
        )}

        {/* 이미지 첨부 */}
        <div className="flex items-center gap-3">
          {post.imageUrl ? (
            <div className="relative">
              <img src={post.imageUrl} alt="" className="h-20 w-20 rounded-lg border object-cover" />
              <button
                type="button"
                className="absolute -right-2 -top-2 rounded-full bg-background p-0.5 shadow"
                onClick={() => update.mutate({ removeImage: true })}
                aria-label="이미지 제거"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
          <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
            {post.imageUrl ? "사진 교체" : "사진 첨부"}
          </Button>
        </div>

        {/* 최종 문구 미리보기 */}
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="mb-1 text-xs text-muted-foreground">발행 문구 미리보기 · {preview.length}자</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{preview}</p>
        </div>

        {post.status === "FAILED" && post.error && (
          <p className="text-xs text-destructive">발행 오류: {post.error}</p>
        )}
        {post.status === "POSTED" && post.threadsUrl && (
          <a
            href={post.threadsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="size-3" /> 발행된 글 보기
          </a>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {dirty && (
            <Button
              variant="secondary"
              size="sm"
              disabled={update.isPending}
              onClick={() => update.mutate({ text, linkUrl, disclosure })}
            >
              변경 저장
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => copyText(preview)}>
            <Copy className="size-4" /> 복사
          </Button>
          <Button size="sm" disabled={publish.isPending} onClick={() => publish.mutate()}>
            {publish.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Threads 발행
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-muted-foreground"
            disabled={del.isPending}
            onClick={() => del.mutate()}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── 봇 관리 ─────────────────────────────────────────────────────

function PersonasTab({ personas, loading }: { personas: Persona[]; loading: boolean }) {
  const [creating, setCreating] = useState(false);

  if (loading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> 새 봇
        </Button>
      </div>

      {creating && <PersonaEditor onClose={() => setCreating(false)} />}

      <div className="grid gap-4">
        {personas.map((p) => (
          <PersonaCard key={p.id} persona={p} />
        ))}
      </div>
    </div>
  );
}

function PersonaCard({ persona }: { persona: Persona }) {
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();

  const del = useMutation({
    mutationFn: () => api.delete(`/api/threads-bot/personas/${persona.id}`),
    onSuccess: () => {
      toast.success("삭제했습니다");
      queryClient.invalidateQueries({ queryKey: ["threads-personas"] });
    },
  });

  if (editing) return <PersonaEditor persona={persona} onClose={() => setEditing(false)} />;

  return (
    <Card>
      <CardContent className="space-y-2 pt-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold">{persona.name}</p>
            {persona.description && <p className="text-xs text-muted-foreground">{persona.description}</p>}
          </div>
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="icon" onClick={() => setEditing(true)}>
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
              disabled={del.isPending}
              onClick={() => {
                if (confirm(`"${persona.name}" 봇을 삭제할까요?`)) del.mutate();
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
        <p className="whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm leading-relaxed text-muted-foreground">
          {persona.systemPrompt}
        </p>
      </CardContent>
    </Card>
  );
}

function PersonaEditor({ persona, onClose }: { persona?: Persona; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(persona?.name ?? "");
  const [description, setDescription] = useState(persona?.description ?? "");
  const [systemPrompt, setSystemPrompt] = useState(persona?.systemPrompt ?? "");

  const save = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), description: description.trim(), systemPrompt: systemPrompt.trim() };
      return persona
        ? api.put(`/api/threads-bot/personas/${persona.id}`, body)
        : api.post("/api/threads-bot/personas", body);
    },
    onSuccess: () => {
      toast.success(persona ? "수정했습니다" : "봇을 만들었습니다");
      queryClient.invalidateQueries({ queryKey: ["threads-personas"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "저장 실패"),
  });

  return (
    <Card className={cn(persona && "border-primary/40")}>
      <CardContent className="space-y-3 pt-6">
        <div className="space-y-1.5">
          <Label>이름</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 30대 직장인 일상봇" />
        </div>
        <div className="space-y-1.5">
          <Label>설명 (선택)</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="요청 사항을 입력하면 구축한 페르소나를 적용하여 글을 작성해줘."
          />
        </div>
        <div className="space-y-1.5">
          <Label>지침 (페르소나 규칙)</Label>
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={5}
            placeholder={"너는 출근하기 싫어하는 30대 현실 직장인 여성이야.\n앞으로 내가 키워드를 주면 날것의 퇴근 갈망·월요병·직장생활 공감 글을 딱 한두 줄로 짧고 굵게 짜줘."}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button
            size="sm"
            disabled={!name.trim() || !systemPrompt.trim() || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            저장
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
