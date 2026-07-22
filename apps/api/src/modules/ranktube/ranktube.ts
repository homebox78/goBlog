// 랭크튜브형 유튜브 랭킹 — 카테고리·유튜버·키워드 랭킹.
// 테이블은 raw SQL(마이그레이션 무접촉). PHP가 같은 테이블을 읽어 랭킹 페이지를 렌더한다.
// ⚠️ 프로토타입: 실 유튜브 통계는 Data API 키(youtube.apiKey 설정)가 있어야 수집. 지금은 seedRank()가 샘플 데이터를 채운다.
import { prisma } from "../../common/prisma.js";

let schemaReady = false;
export async function ensureRankSchema(): Promise<void> {
  if (schemaReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rt_categories (
      id   INT NOT NULL PRIMARY KEY,
      name VARCHAR(30) NOT NULL,
      slug VARCHAR(30) NOT NULL,
      sort INT NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rt_channels (
      channelId   VARCHAR(40) NOT NULL PRIMARY KEY,
      title       VARCHAR(120) NOT NULL,
      categoryId  INT NULL,
      subscribers BIGINT NOT NULL DEFAULT 0,
      subs24h     INT NOT NULL DEFAULT 0,
      totalViews  BIGINT NOT NULL DEFAULT 0,
      videoCount  INT NOT NULL DEFAULT 0,
      color       VARCHAR(8) NULL,
      updatedAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_rtch_cat (categoryId), INDEX idx_rtch_sub (subscribers), INDEX idx_rtch_s24 (subs24h)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rt_videos (
      videoId     VARCHAR(20) NOT NULL PRIMARY KEY,
      title       VARCHAR(200) NOT NULL,
      channelId   VARCHAR(40) NOT NULL,
      categoryId  INT NULL,
      viewCount   BIGINT NOT NULL DEFAULT 0,
      view24h     BIGINT NOT NULL DEFAULT 0,
      view7d      BIGINT NOT NULL DEFAULT 0,
      likeCount   INT NOT NULL DEFAULT 0,
      durationSec INT NOT NULL DEFAULT 0,
      publishedAt DATETIME NULL,
      updatedAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_rtv_cat (categoryId), INDEX idx_rtv_vc (viewCount), INDEX idx_rtv_v24 (view24h), INDEX idx_rtv_ch (channelId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rt_keywords (
      id       INT AUTO_INCREMENT PRIMARY KEY,
      keyword  VARCHAR(60) NOT NULL,
      videos   INT NOT NULL DEFAULT 0,
      views24h BIGINT NOT NULL DEFAULT 0,
      growth   INT NOT NULL DEFAULT 0,
      UNIQUE KEY uq_rtk (keyword)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  schemaReady = true;
}

const CATS: Array<[number, string, string, string]> = [
  // id, 이름, slug, 대표색
  [10, "음악", "music", "#e0392b"],
  [20, "게임", "game", "#7c3aed"],
  [24, "먹방·쿡방", "food", "#f59e0b"],
  [26, "뷰티·패션", "beauty", "#ec4899"],
  [22, "브이로그·일상", "vlog", "#0ea5e9"],
  [27, "키즈", "kids", "#22c55e"],
  [25, "뉴스·시사", "news", "#334155"],
  [17, "스포츠", "sports", "#2563eb"],
  [23, "코미디·예능", "comedy", "#f97316"],
  [28, "IT·테크", "tech", "#0d9488"],
  [19, "여행", "travel", "#0891b2"],
  [1, "영화·애니", "film", "#9333ea"],
];

// 카테고리별 채널·영상 샘플(프로토타입). 실제 유튜브 데이터는 Data API 수집으로 교체.
const CH: Array<{ id: string; title: string; cat: number; sub: number; s24: number; tv: number; vc: number }> = [
  { id: "c_music1", title: "K-사운드 뮤직", cat: 10, sub: 24800000, s24: 32100, tv: 18500000000, vc: 420 },
  { id: "c_music2", title: "멜론차트 라이브", cat: 10, sub: 9120000, s24: 12400, tv: 3900000000, vc: 880 },
  { id: "c_game1", title: "겜방연구소", cat: 20, sub: 3120000, s24: 8800, tv: 1420000000, vc: 2100 },
  { id: "c_game2", title: "픽셀아레나", cat: 20, sub: 1880000, s24: 15200, tv: 940000000, vc: 1620 },
  { id: "c_food1", title: "먹깨비 TV", cat: 24, sub: 5640000, s24: 21800, tv: 2870000000, vc: 640 },
  { id: "c_food2", title: "집밥레시피", cat: 24, sub: 2210000, s24: 4200, tv: 780000000, vc: 1180 },
  { id: "c_beauty1", title: "글로우 뷰티", cat: 26, sub: 3980000, s24: 6100, tv: 1120000000, vc: 720 },
  { id: "c_vlog1", title: "오늘의 하루", cat: 22, sub: 1450000, s24: 9800, tv: 410000000, vc: 540 },
  { id: "c_vlog2", title: "퇴근길 브이로그", cat: 22, sub: 690000, s24: 3300, tv: 190000000, vc: 380 },
  { id: "c_kids1", title: "핑콩 키즈", cat: 27, sub: 8900000, s24: 5400, tv: 9200000000, vc: 1320 },
  { id: "c_news1", title: "이슈 브리핑", cat: 25, sub: 2760000, s24: 11200, tv: 1680000000, vc: 3400 },
  { id: "c_news2", title: "경제 한입", cat: 25, sub: 1210000, s24: 7600, tv: 520000000, vc: 1900 },
  { id: "c_sports1", title: "스포츠 하이라이트", cat: 17, sub: 4320000, s24: 18900, tv: 2410000000, vc: 5200 },
  { id: "c_comedy1", title: "빵터짐 코미디", cat: 23, sub: 3560000, s24: 13400, tv: 1580000000, vc: 890 },
  { id: "c_tech1", title: "테크리뷰랩", cat: 28, sub: 1980000, s24: 5200, tv: 680000000, vc: 760 },
  { id: "c_tech2", title: "코딩한스푼", cat: 28, sub: 540000, s24: 2100, tv: 120000000, vc: 430 },
  { id: "c_travel1", title: "세계여행기", cat: 19, sub: 1670000, s24: 4800, tv: 590000000, vc: 620 },
  { id: "c_film1", title: "영화read", cat: 1, sub: 2890000, s24: 9100, tv: 1340000000, vc: 1040 },
];

// 각 영상: [videoId, 제목, 채널, 조회수, 24h증가, 7d증가, 좋아요, 길이초, 며칠전]
const VIDS: Array<[string, string, string, number, number, number, number, number, number]> = [
  ["v_m1", "신곡 라이브 무대 최초 공개", "c_music1", 12400000, 1820000, 8900000, 340000, 214, 2],
  ["v_m2", "역대급 컴백 무대 풀버전", "c_music1", 8700000, 640000, 4200000, 210000, 258, 5],
  ["v_m3", "감성 발라드 커버 모음", "c_music2", 3200000, 410000, 1900000, 88000, 190, 1],
  ["v_g1", "3천만원 게이밍 셋업 실화냐", "c_game1", 5600000, 980000, 3400000, 190000, 720, 3],
  ["v_g2", "신작 오픈 첫날 밤샘 플레이", "c_game2", 2100000, 720000, 1800000, 96000, 1140, 1],
  ["v_g3", "이 조합 사기캐 등극", "c_game1", 1400000, 210000, 900000, 54000, 640, 4],
  ["v_f1", "혼자 5인분 먹방 도전", "c_food1", 9800000, 1240000, 6100000, 280000, 900, 2],
  ["v_f2", "10분 완성 자취 요리", "c_food2", 2400000, 320000, 1600000, 71000, 540, 3],
  ["v_f3", "편의점 신상 다 먹어봤다", "c_food1", 4100000, 560000, 2900000, 118000, 780, 1],
  ["v_b1", "1만원으로 데일리 메이크업", "c_beauty1", 3100000, 380000, 2100000, 92000, 660, 2],
  ["v_b2", "여름 세일 하울 언박싱", "c_beauty1", 1800000, 240000, 1300000, 47000, 720, 4],
  ["v_vl1", "직장인 하루 브이로그", "c_vlog1", 1200000, 210000, 820000, 38000, 900, 1],
  ["v_vl2", "주말 홈카페 감성 정리", "c_vlog2", 640000, 96000, 410000, 21000, 540, 2],
  ["v_k1", "핑콩이랑 색깔놀이", "c_kids1", 22000000, 340000, 2100000, 41000, 480, 6],
  ["v_k2", "동요 메들리 30분", "c_kids1", 14000000, 180000, 1200000, 22000, 1800, 9],
  ["v_n1", "오늘의 3분 뉴스 브리핑", "c_news1", 2800000, 720000, 2200000, 61000, 200, 0],
  ["v_n2", "금리 인상 쉽게 설명", "c_news2", 1300000, 410000, 1100000, 44000, 380, 1],
  ["v_s1", "역전 결승골 그 순간", "c_sports1", 6400000, 1520000, 5100000, 210000, 120, 1],
  ["v_s2", "이번 라운드 베스트 세이브", "c_sports1", 2900000, 480000, 2300000, 88000, 180, 2],
  ["v_co1", "몰래카메라 대참사", "c_comedy1", 5100000, 890000, 3600000, 176000, 640, 2],
  ["v_co2", "성대모사 레전드 모음", "c_comedy1", 2200000, 260000, 1500000, 74000, 720, 5],
  ["v_t1", "신형 폰 3일 써본 솔직 후기", "c_tech1", 1900000, 340000, 1400000, 58000, 780, 1],
  ["v_t2", "개발자 취업 로드맵", "c_tech2", 520000, 120000, 420000, 24000, 900, 3],
  ["v_tr1", "혼자 떠난 유럽 2주", "c_travel1", 1600000, 210000, 1200000, 52000, 1200, 2],
  ["v_fi1", "이 영화 결말 소름주의", "c_film1", 3400000, 610000, 2700000, 96000, 900, 1],
];

const KEYWORDS: Array<[string, number, number, number]> = [
  // keyword, videos, views24h, growth%
  ["신곡 라이브", 128, 4200000, 62],
  ["먹방 도전", 342, 3100000, 41],
  ["게이밍 셋업", 96, 1900000, 88],
  ["3분 뉴스", 210, 2600000, 35],
  ["결승골", 74, 5100000, 120],
  ["데일리 메이크업", 158, 1400000, 22],
  ["자취 요리", 260, 1600000, 28],
  ["신형 폰 후기", 88, 1200000, 54],
  ["브이로그", 512, 2200000, 12],
  ["동요 메들리", 64, 1800000, 8],
  ["성대모사", 47, 900000, 31],
  ["유럽 여행", 132, 1100000, 19],
];

/** 샘플 데이터 적재(프로토타입). 실 데이터는 collectYouTube()로 교체. */
export async function seedRank(): Promise<{ cats: number; channels: number; videos: number; keywords: number }> {
  await ensureRankSchema();
  for (const [id, name, slug, color] of CATS) {
    await prisma.$executeRaw`INSERT INTO rt_categories (id,name,slug,sort) VALUES (${id},${name},${slug},${id})
      ON DUPLICATE KEY UPDATE name=VALUES(name), slug=VALUES(slug)`;
  }
  const colorOf = (cat: number) => CATS.find((c) => c[0] === cat)?.[3] ?? "#888888";
  for (const c of CH) {
    await prisma.$executeRaw`INSERT INTO rt_channels (channelId,title,categoryId,subscribers,subs24h,totalViews,videoCount,color)
      VALUES (${c.id},${c.title},${c.cat},${c.sub},${c.s24},${c.tv},${c.vc},${colorOf(c.cat)})
      ON DUPLICATE KEY UPDATE title=VALUES(title),categoryId=VALUES(categoryId),subscribers=VALUES(subscribers),
        subs24h=VALUES(subs24h),totalViews=VALUES(totalViews),videoCount=VALUES(videoCount),color=VALUES(color),updatedAt=NOW()`;
  }
  const catOfCh = (id: string) => CH.find((c) => c.id === id)?.cat ?? null;
  for (const [vid, title, ch, vc, v24, v7, likes, dur, daysAgo] of VIDS) {
    const cat = catOfCh(ch);
    const pub = new Date(Date.now() - Number(daysAgo) * 86400000);
    await prisma.$executeRaw`INSERT INTO rt_videos (videoId,title,channelId,categoryId,viewCount,view24h,view7d,likeCount,durationSec,publishedAt)
      VALUES (${vid},${title},${ch},${cat},${vc},${v24},${v7},${likes},${dur},${pub})
      ON DUPLICATE KEY UPDATE title=VALUES(title),channelId=VALUES(channelId),categoryId=VALUES(categoryId),
        viewCount=VALUES(viewCount),view24h=VALUES(view24h),view7d=VALUES(view7d),likeCount=VALUES(likeCount),
        durationSec=VALUES(durationSec),publishedAt=VALUES(publishedAt),updatedAt=NOW()`;
  }
  await prisma.$executeRawUnsafe(`DELETE FROM rt_keywords`);
  for (const [kw, v, views, g] of KEYWORDS) {
    await prisma.$executeRaw`INSERT INTO rt_keywords (keyword,videos,views24h,growth) VALUES (${kw},${v},${views},${g})
      ON DUPLICATE KEY UPDATE videos=VALUES(videos),views24h=VALUES(views24h),growth=VALUES(growth)`;
  }
  return { cats: CATS.length, channels: CH.length, videos: VIDS.length, keywords: KEYWORDS.length };
}

/**
 * (2차) 실 유튜브 통계 수집 — youtube.apiKey(Data API 키) 설정 필요.
 * 채널 시드 → channels.list(통계) → 각 채널 최신 영상 videos.list(조회수). 지금은 키 없으면 skip.
 */
export async function collectYouTube(): Promise<{ ok: boolean; reason?: string }> {
  const { getSettingValues } = await import("../settings/settings.service.js");
  const key = (await getSettingValues(["youtube.apiKey"]))["youtube.apiKey"];
  if (!key) return { ok: false, reason: "youtube.apiKey(Data API 키) 미설정 — 샘플 데이터 사용 중" };
  // TODO: channels.list / videos.list 로 실 통계 적재 (키 등록 후 구현)
  return { ok: false, reason: "수집기 미구현(키는 있음) — 다음 단계" };
}
