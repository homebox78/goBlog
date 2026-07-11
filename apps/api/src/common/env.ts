import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const here = path.dirname(fileURLToPath(import.meta.url));
// 루트 .env 를 우선 사용하고, apps/api/.env 가 있으면 함께 로드한다.
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
