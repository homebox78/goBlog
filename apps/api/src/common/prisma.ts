import { PrismaClient } from "@prisma/client";

/**
 * 로컬 미디어 URL (http://localhost:8787/media/..., http://127.0.0.1:.../media/...)
 *
 * ⚠️ DB는 운영 DB 하나를 모두가 공유한다. MEDIA_PUBLIC_URL이 없는 인스턴스(개발 서버 등)가 이미지를 만들면
 * **운영 DB에 그 PC에서만 열리는 죽은 링크가 박힌다**. 파일은 그 PC 디스크에만 남고, 그 PC가 꺼지면
 * 이미지는 영영 사라진다. 실제로 글 46·48·49가 이렇게 이미지를 잃었다.
 *
 * 코드 한 군데(mediaPublicUrl)만 막으면 새 저장 경로가 생길 때마다 다시 뚫린다.
 * 그래서 **DB 입구에서** 막는다 — 어떤 경로로 들어오든 로컬 미디어 URL은 저장되지 않는다.
 */
const LOCAL_MEDIA_URL = /https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/media\//i;

/** 저장하려는 데이터 안에 로컬 미디어 URL이 섞여 있는지 찾는다 (중첩 객체·배열까지). */
function findLocalMediaUrl(value: unknown, depth = 0): string | null {
  if (depth > 6 || value == null) return null;
  if (typeof value === "string") return LOCAL_MEDIA_URL.test(value) ? value : null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = findLocalMediaUrl(item, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      const hit = findLocalMediaUrl(item, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

function assertNoLocalMediaUrl(data: unknown, model: string): void {
  const hit = findLocalMediaUrl(data);
  if (!hit) return;
  const sample = hit.length > 120 ? `${hit.slice(0, 120)}...` : hit;
  throw new Error(
    `[미디어 URL 가드] ${model}에 로컬 미디어 URL을 저장하려 했습니다: ${sample}\n` +
      "이 주소는 이 프로세스가 도는 PC에서만 열립니다. DB는 공유되므로 저장하면 이미지가 유실됩니다.\n" +
      "MEDIA_PUBLIC_URL을 공개 주소(예: https://hom2box.com/goBlog/media)로 설정하고 다시 시도하세요.",
  );
}

export const prisma = new PrismaClient().$extends({
  query: {
    $allModels: {
      async create({ args, query, model }) {
        assertNoLocalMediaUrl(args.data, model);
        return query(args);
      },
      async createMany({ args, query, model }) {
        assertNoLocalMediaUrl(args.data, model);
        return query(args);
      },
      async update({ args, query, model }) {
        assertNoLocalMediaUrl(args.data, model);
        return query(args);
      },
      async updateMany({ args, query, model }) {
        assertNoLocalMediaUrl(args.data, model);
        return query(args);
      },
      async upsert({ args, query, model }) {
        assertNoLocalMediaUrl(args.create, model);
        assertNoLocalMediaUrl(args.update, model);
        return query(args);
      },
    },
  },
});

/** DB 연결 가능 여부를 확인한다. 서버는 DB가 없어도 기동된다. */
export async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
