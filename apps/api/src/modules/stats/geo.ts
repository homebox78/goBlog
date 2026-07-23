// 페이지뷰(page_views)·IP 지역(ip_geo) 스키마 + 방문 IP → 지역 변환.
// 테이블은 Prisma 마이그레이션 없이 raw SQL로 보장(배포가 migration을 안 돌림) — ranktube/stocks와 동일 패턴.
// 지역 변환은 외부 무료 API(ipwho.is, 키 불필요·HTTPS)로 서버가 주기적으로 수행해 ip_geo에 캐시.
import { prisma } from "../../common/prisma.js";

let schemaReady = false;

export async function ensureStatsSchema(): Promise<void> {
  if (schemaReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS page_views (
      id BIGINT NOT NULL AUTO_INCREMENT,
      type VARCHAR(24) NOT NULL,
      pkey VARCHAR(160) NULL,
      title VARCHAR(200) NULL,
      ip VARCHAR(45) NULL,
      userAgent VARCHAR(255) NULL,
      referer VARCHAR(500) NULL,
      path VARCHAR(255) NULL,
      viewedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_type (type),
      KEY idx_type_key (type, pkey),
      KEY idx_viewed (viewedAt),
      KEY idx_ip (ip)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ip_geo (
      ip VARCHAR(45) NOT NULL,
      country VARCHAR(64) NULL,
      countryCode VARCHAR(4) NULL,
      region VARCHAR(96) NULL,
      city VARCHAR(96) NULL,
      isp VARCHAR(160) NULL,
      status VARCHAR(16) NULL,
      resolvedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (ip),
      KEY idx_region (region),
      KEY idx_country (country)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  schemaReady = true;
}

// ── 한국 시/도 영문(ipwho.is region) → 한글 축약 ────────────────────────
const KR_REGION: Array<[RegExp, string]> = [
  [/seoul/i, "서울"],
  [/busan/i, "부산"],
  [/incheon/i, "인천"],
  [/daegu/i, "대구"],
  [/daejeon/i, "대전"],
  [/gwangju/i, "광주"],
  [/ulsan/i, "울산"],
  [/sejong/i, "세종"],
  [/gyeonggi/i, "경기"],
  [/gangwon/i, "강원"],
  [/(north chungcheong|chungcheongbuk|chungbuk)/i, "충북"],
  [/(south chungcheong|chungcheongnam|chungnam)/i, "충남"],
  [/(north jeolla|jeollabuk|jeonbuk)/i, "전북"],
  [/(south jeolla|jeollanam|jeonnam)/i, "전남"],
  [/(north gyeongsang|gyeongsangbuk|gyeongbuk)/i, "경북"],
  [/(south gyeongsang|gyeongsangnam|gyeongnam)/i, "경남"],
  [/jeju/i, "제주"],
];
function krRegion(country: string, region: string): string {
  if (/korea/i.test(country) || country === "대한민국") {
    for (const [re, ko] of KR_REGION) if (re.test(region)) return ko;
  }
  return region || "";
}

// 사설/예약 IP는 외부 조회 없이 '내부'로 표기
function isReservedIp(ip: string): boolean {
  if (!ip) return true;
  if (ip === "::1" || ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("192.168.")) return true;
  const m = ip.match(/^172\.(\d+)\./);
  if (m) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 31) return true;
  }
  return false;
}

type GeoRow = {
  country: string;
  countryCode: string;
  region: string;
  city: string;
  isp: string;
  status: string;
};

async function fetchGeo(ip: string): Promise<GeoRow> {
  if (isReservedIp(ip)) {
    return { country: "내부", countryCode: "LO", region: "내부", city: "", isp: "", status: "local" };
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, { signal: ctrl.signal });
    clearTimeout(t);
    const j = (await r.json()) as any;
    if (!j || j.success === false) return { country: "", countryCode: "", region: "", city: "", isp: "", status: "fail" };
    const country = String(j.country ?? "");
    const region = krRegion(country, String(j.region ?? ""));
    return {
      country,
      countryCode: String(j.country_code ?? ""),
      region,
      city: String(j.city ?? ""),
      isp: String(j.connection?.isp ?? j.connection?.org ?? ""),
      status: "success",
    };
  } catch {
    return { country: "", countryCode: "", region: "", city: "", isp: "", status: "fail" };
  }
}

/** page_views/article_views의 미해석 IP를 지역으로 변환해 ip_geo에 캐시. 저볼륨이라 소량씩 순차. */
export async function resolvePendingGeo(limit = 60): Promise<{ resolved: number }> {
  await ensureStatsSchema();
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT ip FROM (
      SELECT DISTINCT ip FROM page_views WHERE ip IS NOT NULL AND ip <> ''
      UNION
      SELECT DISTINCT ip FROM article_views WHERE ip IS NOT NULL AND ip <> ''
    ) t
    WHERE ip NOT IN (SELECT ip FROM ip_geo)
    LIMIT ${Math.min(200, Math.max(1, limit))}
  `);
  let resolved = 0;
  for (const row of rows) {
    const ip = String(row.ip);
    const g = await fetchGeo(ip);
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO ip_geo (ip, country, countryCode, region, city, isp, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE country=VALUES(country), countryCode=VALUES(countryCode),
           region=VALUES(region), city=VALUES(city), isp=VALUES(isp), status=VALUES(status), resolvedAt=NOW()`,
        ip,
        g.country || null,
        g.countryCode || null,
        g.region || null,
        g.city || null,
        g.isp || null,
        g.status,
      );
      resolved++;
    } catch {
      // 개별 실패는 무시(다음 주기에 재시도)
    }
    if (!isReservedIp(ip)) await new Promise((r) => setTimeout(r, 250)); // 외부 API 배려
  }
  return { resolved };
}
