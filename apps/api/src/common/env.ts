import path from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";
import dotenv from "dotenv";
import { z } from "zod";

// Node 18에는 전역 WebCrypto가 없어 jose v6가 실패한다. (운영 서버 Node 18.19)
if (!globalThis.crypto) {
  (globalThis as Record<string, unknown>).crypto = webcrypto;
}

const here = path.dirname(fileURLToPath(import.meta.url));
// 환경변수는 루트 .env 한 파일이 단일 소스다.
// 운영 서버는 앱만 떼어 배포하므로(~/goblog-api) 앱 폴더의 .env 도 함께 본다 — deploy.ps1 이 루트 .env 에서 만들어 올린다.
dotenv.config({ path: path.resolve(here, "../../../../.env") });
dotenv.config({ path: path.resolve(here, "../../.env") });

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(8787),
  WEB_URL: z.string().default("http://localhost:5173"),
  MYSQL_URL: z.string().default("mysql://publisher:password@localhost:3306/publisher"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  ADMIN_EMAIL: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET은 16자 이상이어야 합니다."),
  MASTER_ENCRYPTION_KEY: z.string().min(16, "MASTER_ENCRYPTION_KEY는 16자 이상이어야 합니다."),
  EXTENSION_TOKEN: z.string().optional(),
  // Shorts Factory 시크릿 보관함 — 구글 로그인(ID 토큰)으로만 접근
  SF_ALLOWED_EMAILS: z.string().optional(),   // 쉼표 구분 허용 계정
  SF_GOOGLE_CLIENT_ID: z.string().optional(), // 데스크톱 앱 OAuth 클라이언트
  SF_GOOGLE_CLIENT_SECRET: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("환경변수 검증 실패:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  console.error("루트의 .env.example을 복사해 .env를 만든 뒤 값을 채워주세요.");
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
