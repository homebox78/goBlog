// 주식 커뮤니티 — 종목 마스터 + 일별 시세(무료·지연 종가).
// 소스는 추상화: 지금은 네이버 일봉(키 불필요), 규모 커지면 공공데이터 금융위(공식)로 교체.
// 테이블은 raw SQL로 생성(Prisma 스키마 무접촉 — deploy가 마이그레이션을 안 함). PHP 사이트도 같은 테이블을 읽는다.
import { prisma } from "../../common/prisma.js";

export interface DailyBar {
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// 초기 종목 풀 — 재테크·반도체·바이오·금융 중심 시총 상위(커뮤니티는 AI 태깅·토론으로 확장).
const SEED_STOCKS: Array<{ ticker: string; name: string; market: "KOSPI" | "KOSDAQ" }> = [
  { ticker: "005930", name: "삼성전자", market: "KOSPI" },
  { ticker: "000660", name: "SK하이닉스", market: "KOSPI" },
  { ticker: "207940", name: "삼성바이오로직스", market: "KOSPI" },
  { ticker: "373220", name: "LG에너지솔루션", market: "KOSPI" },
  { ticker: "005380", name: "현대차", market: "KOSPI" },
  { ticker: "000270", name: "기아", market: "KOSPI" },
  { ticker: "068270", name: "셀트리온", market: "KOSPI" },
  { ticker: "105560", name: "KB금융", market: "KOSPI" },
  { ticker: "005490", name: "POSCO홀딩스", market: "KOSPI" },
  { ticker: "035420", name: "NAVER", market: "KOSPI" },
  { ticker: "035720", name: "카카오", market: "KOSPI" },
  { ticker: "051910", name: "LG화학", market: "KOSPI" },
  { ticker: "006400", name: "삼성SDI", market: "KOSPI" },
  { ticker: "012330", name: "현대모비스", market: "KOSPI" },
  { ticker: "055550", name: "신한지주", market: "KOSPI" },
  { ticker: "015760", name: "한국전력", market: "KOSPI" },
  { ticker: "032830", name: "삼성생명", market: "KOSPI" },
  { ticker: "003670", name: "포스코퓨처엠", market: "KOSPI" },
  { ticker: "066570", name: "LG전자", market: "KOSPI" },
  { ticker: "010130", name: "고려아연", market: "KOSPI" },
  { ticker: "034730", name: "SK", market: "KOSPI" },
  { ticker: "018260", name: "삼성에스디에스", market: "KOSPI" },
  { ticker: "011200", name: "HMM", market: "KOSPI" },
  { ticker: "096770", name: "SK이노베이션", market: "KOSPI" },
  { ticker: "009150", name: "삼성전기", market: "KOSPI" },
  { ticker: "316140", name: "우리금융지주", market: "KOSPI" },
  { ticker: "259960", name: "크래프톤", market: "KOSPI" },
  { ticker: "000810", name: "삼성화재", market: "KOSPI" },
  { ticker: "011070", name: "LG이노텍", market: "KOSPI" },
  { ticker: "010950", name: "S-Oil", market: "KOSPI" },
  { ticker: "302440", name: "SK바이오사이언스", market: "KOSPI" },
  { ticker: "326030", name: "SK바이오팜", market: "KOSPI" },
  { ticker: "128940", name: "한미약품", market: "KOSPI" },
  { ticker: "042700", name: "한미반도체", market: "KOSPI" },
  { ticker: "086520", name: "에코프로", market: "KOSDAQ" },
  { ticker: "247540", name: "에코프로비엠", market: "KOSDAQ" },
  { ticker: "091990", name: "셀트리온헬스케어", market: "KOSDAQ" },
  { ticker: "196170", name: "알테오젠", market: "KOSDAQ" },
  { ticker: "066970", name: "엘앤에프", market: "KOSDAQ" },
  { ticker: "263750", name: "펄어비스", market: "KOSDAQ" },
];

let schemaReady = false;
/** 종목·시세 테이블 생성 (멱등). 첫 크롤/조회 전에 호출. */
export async function ensureStockSchema(): Promise<void> {
  if (schemaReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS stocks (
      ticker      VARCHAR(6)  NOT NULL PRIMARY KEY,
      name        VARCHAR(80) NOT NULL,
      market      VARCHAR(10) NOT NULL,
      sector      VARCHAR(60) NULL,
      active      TINYINT     NOT NULL DEFAULT 1,
      createdAt   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_stocks_active (active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS stock_prices (
      ticker  VARCHAR(6) NOT NULL,
      date    DATE       NOT NULL,
      open    INT NULL,
      high    INT NULL,
      low     INT NULL,
      close   INT NULL,
      volume  BIGINT NULL,
      PRIMARY KEY (ticker, date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  // AI 글 ↔ 종목 태깅 (한 글이 여러 종목, 한 종목이 여러 글)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS article_stocks (
      articleId INT        NOT NULL,
      ticker    VARCHAR(6) NOT NULL,
      createdAt DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (articleId, ticker),
      INDEX idx_article_stocks_ticker (ticker)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  schemaReady = true;
}

/** 초기 종목 풀 업서트 (멱등). */
export async function seedStocks(): Promise<number> {
  await ensureStockSchema();
  let n = 0;
  for (const s of SEED_STOCKS) {
    await prisma.$executeRaw`
      INSERT INTO stocks (ticker, name, market) VALUES (${s.ticker}, ${s.name}, ${s.market})
      ON DUPLICATE KEY UPDATE name = VALUES(name), market = VALUES(market), updatedAt = CURRENT_TIMESTAMP
    `;
    n += 1;
  }
  return n;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 네이버 일봉(키 불필요) — 지연·종가. 응답은 JS 배열형 텍스트라 데이터 행을 정규식으로 추출한다.
 * 규모 커지면 이 함수만 공공데이터 금융위 getStockPriceInfo로 교체(소스 추상화).
 */
export async function fetchDailyBars(ticker: string, days = 70): Promise<DailyBar[]> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const url =
    `https://api.finance.naver.com/siseJson.naver?symbol=${ticker}` +
    `&requestType=1&startTime=${ymd(start)}&endTime=${ymd(end)}&timeframe=day`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Referer: "https://finance.naver.com/" } });
  if (!res.ok) throw new Error(`네이버 시세 HTTP ${res.status}`);
  const text = await res.text();
  const bars: DailyBar[] = [];
  const re = /\["(\d{8})",\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const d = m[1];
    bars.push({
      date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
      open: Math.round(Number(m[2])),
      high: Math.round(Number(m[3])),
      low: Math.round(Number(m[4])),
      close: Math.round(Number(m[5])),
      volume: Number(m[6]),
    });
  }
  return bars;
}

/** 활성 종목 전체의 일별 시세를 갱신한다(크론). 네이버 부담 줄이려 종목마다 간격을 둔다. */
export async function refreshStockDaily(): Promise<{ stocks: number; rows: number }> {
  await seedStocks();
  const rows = (await prisma.$queryRaw`SELECT ticker FROM stocks WHERE active = 1`) as Array<{ ticker: string }>;
  let updated = 0;
  let barCount = 0;
  for (const { ticker } of rows) {
    try {
      const bars = await fetchDailyBars(ticker);
      for (const b of bars) {
        await prisma.$executeRaw`
          INSERT INTO stock_prices (ticker, date, open, high, low, close, volume)
          VALUES (${ticker}, ${b.date}, ${b.open}, ${b.high}, ${b.low}, ${b.close}, ${b.volume})
          ON DUPLICATE KEY UPDATE open=VALUES(open), high=VALUES(high), low=VALUES(low), close=VALUES(close), volume=VALUES(volume)
        `;
      }
      barCount += bars.length;
      if (bars.length > 0) updated += 1;
    } catch (error) {
      console.error(`[stocks] ${ticker} 시세 갱신 실패:`, (error as Error).message);
    }
    await new Promise((r) => setTimeout(r, 350)); // 네이버 부담 완화
  }
  console.log(`[stocks] 일별 시세 갱신: 종목 ${updated}/${rows.length} · 행 ${barCount}`);
  return { stocks: updated, rows: barCount };
}

/**
 * 발행 글 ↔ 종목 태깅 — 제목·요약에 종목명이 있으면 article_stocks에 연결(멱등).
 * 아직 태깅 안 된 최근 발행 글만 스캔. 정밀 매칭은 2차(현재는 종목명 포함 여부).
 */
export async function tagArticlesWithStocks(): Promise<number> {
  await ensureStockSchema();
  const stocks = (await prisma.$queryRaw`SELECT ticker, name FROM stocks WHERE active = 1`) as Array<{
    ticker: string;
    name: string;
  }>;
  const arts = (await prisma.$queryRawUnsafe(
    `SELECT a.id, a.title, a.excerpt FROM articles a
     WHERE a.contentHtml IS NOT NULL AND a.publishAt IS NOT NULL
       AND a.id NOT IN (SELECT articleId FROM article_stocks)
     ORDER BY a.id DESC LIMIT 500`,
  )) as Array<{ id: number; title: string; excerpt: string | null }>;
  let tagged = 0;
  for (const a of arts) {
    const text = `${a.title} ${a.excerpt ?? ""}`;
    for (const s of stocks) {
      if (s.name.length >= 2 && text.includes(s.name)) {
        await prisma.$executeRaw`INSERT IGNORE INTO article_stocks (articleId, ticker) VALUES (${a.id}, ${s.ticker})`;
        tagged += 1;
      }
    }
  }
  console.log(`[stocks] 글-종목 태깅: ${tagged}건 (스캔 ${arts.length}글)`);
  return tagged;
}
