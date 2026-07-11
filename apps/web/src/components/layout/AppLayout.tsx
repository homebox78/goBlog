import { Navigate, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Lightbulb,
  FileText,
  CalendarClock,
  Settings,
  LogOut,
  Loader2,
  ShoppingBag,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface MeResponse {
  user: { id: number; email: string };
}

const NAV_ITEMS = [
  { to: "/", label: "대시보드", icon: LayoutDashboard },
  { to: "/keywords", label: "오늘의 키워드", icon: Lightbulb },
  { to: "/products", label: "상품 홍보", icon: ShoppingBag },
  { to: "/articles", label: "글 관리", icon: FileText },
  { to: "/schedule", label: "스케줄", icon: CalendarClock },
  { to: "/settings", label: "설정", icon: Settings },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<MeResponse>("/api/auth/me"),
    retry: false,
  });

  if (meQuery.isPending) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (meQuery.isError) {
    // 렌더 중 navigate() 호출 금지 — 프로덕션 빌드에서 백지 원인 (선언적 Navigate 사용)
    if (meQuery.error instanceof ApiError && meQuery.error.status === 401) {
      return <Navigate to="/login" replace />;
    }
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">
          서버에 연결할 수 없습니다. API 서버가 실행 중인지 확인해주세요.
        </p>
        <Button variant="outline" onClick={() => meQuery.refetch()}>
          다시 시도
        </Button>
      </div>
    );
  }

  const handleLogout = async () => {
    await api.post("/api/auth/logout").catch(() => undefined);
    queryClient.clear();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex h-screen bg-background">
      <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
            P
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">AI Publisher</p>
            <p className="text-xs text-muted-foreground leading-tight">개인용 콘텐츠 자동화</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )
              }
            >
              <item.icon className="size-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t px-3 py-3">
          <p className="truncate px-3 pb-2 text-xs text-muted-foreground">
            {meQuery.data.user.email}
          </p>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground"
            onClick={handleLogout}
          >
            <LogOut className="size-4" />
            로그아웃
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
