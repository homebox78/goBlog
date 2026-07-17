import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Download, Search, Trash2, MailX, MailCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscribers"] });
    },
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

      <div className="grid grid-cols-3 gap-3">
        <StatBox label="전체" value={c?.total} />
        <StatBox label="구독중" value={c?.active} accent="text-emerald-600" />
        <StatBox label="해지" value={c?.unsubscribed} accent="text-muted-foreground" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
          <Button type="submit" variant="secondary" size="sm">
            검색
          </Button>
        </form>
        <div className="flex gap-1">
          {(["", "ACTIVE", "UNSUBSCRIBED"] as const).map((s) => (
            <button
              key={s || "all"}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              className={
                "rounded-md border px-3 py-1.5 text-sm " +
                (status === s ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")
              }
            >
              {s === "" ? "전체" : s === "ACTIVE" ? "구독중" : "해지"}
            </button>
          ))}
        </div>
        <a href={`${API}/api/subscribers/export`} className="ml-auto">
          <Button variant="outline" size="sm">
            <Download className="size-4" /> CSV 내보내기
          </Button>
        </a>
      </div>

      <Card>
        <CardContent className="p-0">
          {isPending ? (
            <p className="py-16 text-center text-sm text-muted-foreground">불러오는 중...</p>
          ) : (data?.subscribers ?? []).length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">구독자가 없습니다.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <Th onClick={() => toggleSort("email")} active={sort === "email"} order={order}>
                    이메일
                  </Th>
                  <th className="px-4 py-2.5 font-medium">상태</th>
                  <th className="px-4 py-2.5 font-medium">유입</th>
                  <Th onClick={() => toggleSort("createdAt")} active={sort === "createdAt"} order={order}>
                    구독일
                  </Th>
                  <th className="px-4 py-2.5 text-right font-medium">관리</th>
                </tr>
              </thead>
              <tbody>
                {data!.subscribers.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-2.5 font-medium">{s.email}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold " +
                          (s.status === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-muted text-muted-foreground")
                        }
                      >
                        {s.status === "ACTIVE" ? "구독중" : "해지"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{s.source ?? "-"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {new Date(s.createdAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        {s.status === "ACTIVE" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="해지 처리"
                            onClick={() => patch.mutate({ id: s.id, status: "UNSUBSCRIBED" })}
                          >
                            <MailX className="size-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="재활성"
                            onClick={() => patch.mutate({ id: s.id, status: "ACTIVE" })}
                          >
                            <MailCheck className="size-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          title="삭제"
                          onClick={() => {
                            if (confirm(`${s.email} 구독자를 삭제할까요?`)) del.mutate(s.id);
                          }}
                        >
                          <Trash2 className="size-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

function StatBox({ label, value, accent }: { label: string; value?: number; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={"mt-1 text-2xl font-bold " + (accent ?? "")}>{(value ?? 0).toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}

function Th({
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
    <th className="px-4 py-2.5 font-medium">
      <button onClick={onClick} className="inline-flex items-center gap-1 hover:text-foreground">
        {children}
        {active && <span>{order === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  );
}
