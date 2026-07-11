import { prisma } from "../../common/prisma.js";
import { decryptSecret, encryptSecret } from "../../common/crypto.js";
import { SETTING_DEF_MAP, SETTING_DEFS } from "./setting-defs.js";
import { HttpError } from "../../common/http.js";

export interface SettingView {
  key: string;
  group: string;
  label: string;
  isSecret: boolean;
  /** 비밀값이면 null, 아니면 실제 값 (미설정 시 기본값) */
  value: string | null;
  hasValue: boolean;
}

export async function listSettings(): Promise<SettingView[]> {
  const rows = await prisma.setting.findMany();
  const rowMap = new Map(rows.map((row) => [row.key, row]));

  return SETTING_DEFS.map((def) => {
    const row = rowMap.get(def.key);
    if (def.secret) {
      return {
        key: def.key,
        group: def.group,
        label: def.label,
        isSecret: true,
        value: null,
        hasValue: Boolean(row?.value),
      };
    }
    return {
      key: def.key,
      group: def.group,
      label: def.label,
      isSecret: false,
      value: row?.value ?? def.defaultValue ?? "",
      hasValue: Boolean(row?.value),
    };
  });
}

/** values: key → 새 값. null이면 삭제. 비밀값은 암호화 후 저장. */
export async function updateSettings(values: Record<string, string | null>): Promise<void> {
  const operations = [];

  for (const [key, rawValue] of Object.entries(values)) {
    const def = SETTING_DEF_MAP.get(key);
    if (!def) {
      throw new HttpError(400, `알 수 없는 설정 키입니다: ${key}`);
    }

    if (rawValue === null || rawValue === "") {
      operations.push(prisma.setting.deleteMany({ where: { key } }));
      continue;
    }

    const stored = def.secret ? encryptSecret(rawValue) : rawValue;
    operations.push(
      prisma.setting.upsert({
        where: { key },
        update: { value: stored, isSecret: def.secret },
        create: { key, value: stored, isSecret: def.secret },
      }),
    );
  }

  await prisma.$transaction(operations);
}

/** 서버 내부에서 사용할 복호화된 설정값을 가져온다. */
export async function getSettingValue(key: string): Promise<string | null> {
  const def = SETTING_DEF_MAP.get(key);
  if (!def) throw new Error(`알 수 없는 설정 키: ${key}`);

  const row = await prisma.setting.findUnique({ where: { key } });
  if (!row?.value) return def.defaultValue ?? null;
  return def.secret ? decryptSecret(row.value) : row.value;
}

export async function getSettingValues(keys: string[]): Promise<Record<string, string | null>> {
  const result: Record<string, string | null> = {};
  for (const key of keys) {
    result[key] = await getSettingValue(key);
  }
  return result;
}
