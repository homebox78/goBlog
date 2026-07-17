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
  Moon,
  ShoppingBag,
  Megaphone,
  BarChart3,
  Mail,
  Inbox,
  Sun,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { currentTheme, toggleTheme, type Theme } from "@/lib/theme";
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
  { to: "/review", label: "검수함", icon: Inbox },
  { to: "/schedule", label: "스케줄", icon: CalendarClock },
  { to: "/ads", label: "광고 관리", icon: Megaphone },
  { to: "/stats", label: "통계", icon: BarChart3 },
  { to: "/subscribers", label: "구독자", icon: Mail },
  { to: "/settings", label: "설정", icon: Settings },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();
  // 모바일 서랍 메뉴 — 데스크톱(md+)에서는 사이드바가 항상 보이므로 이 상태를 쓰지 않는다.
  const [navOpen, setNavOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => currentTheme());

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

  // 사이드바 내용은 한 번만 정의하고 데스크톱(aside)·모바일(Sheet) 양쪽에서 재사용한다.
  const sidebar = (
    <>
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          P
        </div>
        <div>
          <p className="text-sm leading-tight font-semibold">AI Publisher</p>
          <p className="text-xs leading-tight text-muted-foreground">개인용 콘텐츠 자동화</p>
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
        <p className="truncate px-3 pb-2 text-xs text-muted-foreground">{meQuery.data.user.email}</p>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground"
          onClick={() => setTheme(toggleTheme())}
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {theme === "dark" ? "라이트 모드" : "다크 모드"}
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground"
          onClick={handleLogout}
        >
          <LogOut className="size-4" />
          로그아웃
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar md:flex">{sidebar}</aside>

      {/* 모바일 서랍 — Sheet가 포커스 트랩·ESC 닫기·스크롤 잠금을 처리한다 (직접 만들면 다 빠진다) */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="flex w-60 flex-col bg-sidebar p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>메뉴</SheetTitle>
          </SheetHeader>
          {sidebar}
        </SheetContent>
      </Sheet>

      {/* min-w-0 이 없으면 넓은 표·코드블록이 있는 페이지에서 본문이 화면 밖으로 밀려 가로 스크롤이 생긴다 */}
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur md:hidden">
          <Button variant="ghost" size="icon" aria-label="메뉴 열기" onClick={() => setNavOpen(true)}>
            <Menu className="size-5" />
          </Button>
          <span className="text-sm font-semibold">AI Publisher</span>
        </header>

        <div className="px-4 py-5 md:px-8 md:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
