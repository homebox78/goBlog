import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import LoginPage from "@/pages/LoginPage";
import AppLayout from "@/components/layout/AppLayout";
import DashboardPage from "@/pages/DashboardPage";
import KeywordDashboardPage from "@/pages/KeywordDashboardPage";
import KeywordsPage from "@/pages/KeywordsPage";
import KeywordDetailPage from "./pages/KeywordDetailPage";
import ProductsPage from "@/pages/ProductsPage";
import CharactersPage from "@/pages/CharactersPage";
import ArticlesPage from "@/pages/ArticlesPage";
import ArticleDetailPage from "@/pages/ArticleDetailPage";
import ReviewPage from "@/pages/ReviewPage";
import SchedulePage from "@/pages/SchedulePage";
import AdsPage from "@/pages/AdsPage";
import StatsPage from "@/pages/StatsPage";
import SubscribersPage from "@/pages/SubscribersPage";
import SettingsPage from "@/pages/SettingsPage";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          {/* 키워드 페이지는 통합 대시보드(모달 상세)로 대체. 상세 표는 /keywords/list로 보존 */}
          <Route path="/keywords" element={<KeywordDashboardPage />} />
          <Route path="/keywords/list" element={<KeywordsPage />} />
          <Route path="/keywords/:id" element={<KeywordDetailPage />} />
          {/* 트렌드는 키워드 표 페이지의 탭으로 통합 — 기존 링크 호환용 리다이렉트 */}
          <Route path="/trends" element={<Navigate to="/keywords/list?tab=trends" replace />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/articles" element={<ArticlesPage />} />
          <Route path="/articles/:id" element={<ArticleDetailPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/characters" element={<CharactersPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/ads" element={<AdsPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/subscribers" element={<SubscribersPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="top-center" richColors />
    </>
  );
}
