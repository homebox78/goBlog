import { useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Lightbulb,
  FileText,
  CalendarClock,
  Settings,
  LogOut,
  Loader2,
  Menu,
  X,
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
  { to: "/keywords", label: "키워드", icon: Lightbulb },
  { to: "/products", label: "상품 홍보", icon: ShoppingBag },
  { to: "/articles", label: "글 관리", icon: FileText },
  { to: "/schedule", label: "스케줄", icon: CalendarClock },
  { to: "/settings", label: "설정", icon: Settings },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();
  // 모바일 서랍 메뉴 — 데스크톱(md+)에서는 사이드바가 항상 보이므로 이 상태를 쓰지 않는다.
  const [navOpen, setNavOpen] = useState(false);

  // 메뉴를 눌러 화면이 바뀌면 서랍은 닫는다 (열린 채로 남으면 본문을 가린다).
  useEffect(() => setNavOpen(false), [location.pathname]);

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
      {/* 모바일 서랍이 열렸을 때 본문을 덮는 반투명 막 — 탭하면 닫힌다 */}
      {navOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          // 모바일: 화면 밖에 대기하다 열리면 슬라이드인 / 데스크톱(md+): 항상 보이는 고정 사이드바
          "fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col border-r bg-sidebar transition-transform md:static md:translate-x-0",
          navOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <button
          type="button"
          className="absolute top-4 right-3 rounded-md p-1.5 text-muted-foreground hover:bg-accent md:hidden"
          onClick={() => setNavOpen(false)}
          aria-label="메뉴 닫기"
        >
          <X className="size-4" />
        </button>
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

      {/* min-w-0 이 없으면 넓은 표·코드블록이 있는 페이지에서 본문이 화면 밖으로 밀려 가로 스크롤이 생긴다 */}
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur md:hidden">
          <button
            type="button"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
            onClick={() => setNavOpen(true)}
            aria-label="메뉴 열기"
          >
            <Menu className="size-5" />
          </button>
          <span className="text-sm font-semibold">AI Publisher</span>
        </header>

        <div className="px-4 py-5 md:px-8 md:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
