/** API와 웹, 확장 프로그램이 공유하는 타입 정의 */

export type PlatformKind = "WORDPRESS" | "BLOGGER" | "NAVER_BLOG" | "TISTORY";

export type ArticleLanguage = "ko" | "en" | "zh-CN" | "hi" | "es";

export type ArticleType =
  | "guide"
  | "news"
  | "comparison"
  | "product-review"
  | "how-to-apply"
  | "pricing"
  | "troubleshooting"
  | "faq"
  | "checklist"
  | "how-to";

export type SchemaType =
  | "Article"
  | "NewsArticle"
  | "BlogPosting"
  | "FAQPage"
  | "Product"
  | "Review"
  | "HowTo"
  | "BreadcrumbList";

export type ArticleStatus =
  | "DRAFT"
  | "REVIEW"
  | "APPROVED"
  | "SCHEDULED"
  | "PUBLISHED"
  | "FAILED";

export type PublishJobStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED";

export interface AuthUser {
  id: number;
  email: string;
}

export interface SettingView {
  key: string;
  group: string;
  label: string;
  isSecret: boolean;
  value: string | null;
  hasValue: boolean;
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
  detail?: unknown;
}

export interface DashboardSummary {
  db: boolean;
  keywordsToday: number;
  articleCount: number;
  publishStats: Partial<Record<PublishJobStatus, number>>;
  recentArticles: Array<{
    id: number;
    title: string;
    status: ArticleStatus;
    language: string;
    articleType: string;
    qualityScore: number | null;
    updatedAt: string;
  }>;
  recentJobs: Array<{
    id: number;
    platform: PlatformKind;
    status: PublishJobStatus;
    publishedUrl: string | null;
    error: string | null;
    updatedAt: string;
    article: { id: number; title: string };
  }>;
}
