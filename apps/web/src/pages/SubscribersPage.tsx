import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Search, Trash2, MailX, MailCheck, ArrowUpDown } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface Subscriber {
  id: number;
  email: string;
  status: "ACTIVE" | "UNSUBSCRIBED";
  source: string | null;
  createdAt: string;
}
interface SubsResponse {
  subscribers: Subscriber[];
  counts: { total: number; active: number; unsubscribed: number };
  page: number;
  totalPages: number;
  filtered: number;
}

const API = import.meta.env.BASE_URL.replace(/\/$/, ""); // 운영은 /goBlog 서브경로

export default function SubscribersPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [status, setStatus] = useState<"" | "ACTIVE" | "UNSUBSCRIBED">("");
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const { data, isPending } = useQuery({
    queryKey: ["subscribers", q, status, sort, order, page],
    queryFn: () =>
      api.get<SubsResponse>(
        `/api/subscribers?q=${encodeURIComponent(q)}&status=${status}&sort=${sort}&order=${order}&page=${page}`,
      ),
  });

  const patch = useMutation({
    mutationFn: (v: { id: number; status: string }) => api.patch(`/api/subscribers/${v.id}`, { status: v.status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscribers"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "실패"),
  });
  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/api/subscribers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscribers"] });
      toast.success("삭제됨");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "실패"),
  });

  const toggleSort = (field: string) => {
    if (sort === field) setOrder((o) => (o === "asc" ? "desc" : "asc"));
    else {
      setSort(field);
      setOrder("desc");
    }
    setPage(1);
  };

  const c = data?.counts;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">구독자 관리</h1>
        <p className="text-sm text-muted-foreground">뉴스레터 구독자 목록 · 상태 관리 · CSV 내보내기</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="전체" value={c?.total} loading={isPending} />
        <SummaryCard label="구독중" value={c?.active} loading={isPending} accent="text-emerald-600" />
        <SummaryCard label="해지" value={c?.unsubscribed} loading={isPending} accent="text-muted-foreground" />
      </div>

      {/* 툴바 */}
      <div className="flex flex-wrap items-center gap-2">
        <Tabs
          value={status || "all"}
          onValueChange={(v) => {
            setStatus(v === "all" ? "" : (v as "ACTIVE" | "UNSUBSCRIBED"));
            setPage(1);
          }}
        >
          <TabsList>
            <TabsTrigger value="all">전체</TabsTrigger>
            <TabsTrigger value="ACTIVE">구독중</TabsTrigger>
            <TabsTrigger value="UNSUBSCRIBED">해지</TabsTrigger>
          </TabsList>
        </Tabs>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setQ(qInput.trim());
            setPage(1);
          }}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="이메일 검색"
              className="h-9 w-56 pl-8"
            />
          </div>
        </form>
        <a href={`${API}/api/subscribers/export`} className="ml-auto">
          <Button variant="outline" size="sm">
            <Download className="size-4" /> CSV 내보내기
          </Button>
        </a>
      </div>

      <Card>
        <CardContent className="px-0">
          {isPending ? (
            <div className="space-y-2 px-6 py-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (data?.subscribers ?? []).length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">구독자가 없습니다.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortBtn onClick={() => toggleSort("email")} active={sort === "email"} order={order}>
                      이메일
                    </SortBtn>
                  </TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>유입</TableHead>
                  <TableHead>
                    <SortBtn onClick={() => toggleSort("createdAt")} active={sort === "createdAt"} order={order}>
                      구독일
                    </SortBtn>
                  </TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data!.subscribers.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.email}</TableCell>
                    <TableCell>
                      {s.status === "ACTIVE" ? (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">구독중</Badge>
                      ) : (
                        <Badge variant="secondary">해지</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.source ?? "-"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(s.createdAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {s.status === "ACTIVE" ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="해지 처리"
                            onClick={() => patch.mutate({ id: s.id, status: "UNSUBSCRIBED" })}
                          >
                            <MailX className="size-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="재활성"
                            onClick={() => patch.mutate({ id: s.id, status: "ACTIVE" })}
                          >
                            <MailCheck className="size-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          title="삭제"
                          onClick={() => {
                            if (confirm(`${s.email} 구독자를 삭제할까요?`)) del.mutate(s.id);
                          }}
                        >
                          <Trash2 className="size-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            이전
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            다음
          </Button>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
  loading,
}: {
  label: string;
  value?: number;
  accent?: string;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className={"text-2xl font-bold tabular-nums " + (accent ?? "")}>
          {loading ? <Skeleton className="h-7 w-16" /> : (value ?? 0).toLocaleString()}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

function SortBtn({
  children,
  onClick,
  active,
  order,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  order: "asc" | "desc";
}) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 hover:text-foreground">
      {children}
      <ArrowUpDown className={"size-3 " + (active ? "text-foreground" : "text-muted-foreground/50")} />
    </button>
  );
}
