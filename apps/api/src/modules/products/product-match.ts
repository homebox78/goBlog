/**
 * 등록된 상품 ↔ 오늘의 키워드 매칭.
 * 쿠팡 검색 API가 없어 사용자가 상품을 직접 등록하므로, 상품명·브랜드와 키워드 문구의
 * 토큰 겹침으로 어울리는 키워드를 찾는다. (완벽한 의미매칭이 아니라 사용자 검토용 추천)
 *
 * 정교화 규칙:
 *  ① 정보성/비상거래 키워드(주식·시세·뉴스·정치·연예·방송·스포츠 등)엔 상품을 붙이지 않는다.
 *     — 물리 상품 배너를 뉴스/주식 글에 붙이면 스팸처럼 보이고 정책 위험도 크다.
 *  ② 브랜드 토큰만 겹치는 약한 매칭은 제외한다. 상품의 '아이템' 토큰(브랜드 제외)이 하나 이상
 *     겹쳐야 매칭 — "모나미 볼펜"이 "모나미 주식"에 매칭되던 오매칭 방지.
 */

// 상품과 무관한 정보성/비상거래 키워드 — 여기엔 상품(광고)을 붙이지 않는다.
// 특히 사건·사고·재난은 광고를 넣으면 부적절하고 정책 위험이 크다.
const NON_COMMERCIAL =
  /주식|증시|시세|주가|전망|매수|매도|상장|코스피|코스닥|나스닥|환율|금리|배당|\betf\b|코인|비트코인|리플|이더|뉴스|속보|논란|사건|사고|참사|화재|붕괴|침몰|실종|사망|부상|피해|판결|재판|순방|정상회담|회담|선거|대통령|의원|정치|방영|출연|드라마|예능|방송|경기|스코어|승부|우승|중계|날씨|미세먼지|지진|태풍|폭우|홍수|산불|부고|별세/i;

/** 상품(광고)을 붙이면 안 되는 키워드인가 — 사건·사고·재난·뉴스·금융 등 */
export function isNonCommercialKeyword(text: string): boolean {
  return NON_COMMERCIAL.test(text);
}

// 상품·키워드 양쪽에 흔히 나오는 일반 단어 — 매칭 근거로 쓰면 오매칭(국내산 채소↔레드미 워치6 국내 구매처)이 난다.
const STOPWORDS = new Set([
  "국내", "국내산", "국내제조", "국산", "수입", "정품", "최신", "추천", "추천템", "비교", "가격", "요금", "방법",
  "후기", "리뷰", "구매", "구매처", "판매", "판매처", "세트", "대용량", "소용량", "무료배송", "로켓배송", "로켓프레시",
  "특가", "할인", "세일", "브랜드", "종류", "전용", "인기", "순위", "총정리", "가이드", "방식", "이유", "사용",
  "관련", "최고", "신상", "신형", "정보", "안내", "방문", "대비", "본사직영", "직영",
  // 범용 수식어 — '스마트 쓰레기통'의 '스마트'가 '스마트워치'에 걸리는 식의 오매칭 방지
  "스마트", "프리미엄", "디지털", "무선", "유선", "휴대용", "미니", "울트라", "프로", "맥스", "플러스",
  "라이트", "자동", "수동", "단독", "이벤트", "본사", "공식", "정식", "오리지널", "클래식", "베이직",
  // 카테고리성 광범위 단어 — '[생활/건강]' 헤더의 '건강'이 '구강 장 건강 유산균'에 걸리던 오매칭 방지
  "생활", "건강", "식품", "용품", "여성", "남성", "아동", "유아", "주방", "욕실", "가전", "패션", "뷰티",
]);

function tokenize(text: string | null | undefined): string[] {
  return (text ?? "")
    .toLowerCase()
    .replace(/[^\w가-힣\s]/g, " ")
    .split(/\s+/)
    .filter(
      (token) =>
        token.length >= 2 &&
        !STOPWORDS.has(token) &&
        // 숫자로 시작하는 토큰은 가격·수량·용량 노이즈(100,000원·30정·65g·24개·1000만원대) → 매칭 근거 제외
        !/^\d/.test(token),
    );
}

/**
 * 두 토큰이 관련 있는가. 부분 포함은 '짧은 쪽이 4자 이상'일 때만 인정한다.
 * (짧은 음절 우연 일치 방지: '하이'↔'하이닉스', '스마트'↔'스마트워치'.
 *  정확히 같은 토큰은 길이와 무관하게 항상 매칭.)
 */
function related(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 4 && long.includes(short);
}

export interface MatchProduct {
  name: string;
  brand?: string | null;
}

/**
 * 키워드 문구가 상품과 얼마나 맞는지 점수. 아이템(비브랜드) 겹침에 가중치를 준다.
 * 정보성 키워드거나, 아이템 토큰이 하나도 안 겹치면(브랜드만 겹침) 0.
 */
export function overlapScore(product: MatchProduct, keywordText: string): number {
  if (NON_COMMERCIAL.test(keywordText)) return 0;
  const brandTokens = tokenize(product.brand);
  const nameTokens = tokenize(product.name);
  const kTokens = tokenize(keywordText);
  if (!nameTokens.length || !kTokens.length) return 0;

  let brandHits = 0;
  let itemHits = 0;
  for (const kt of kTokens) {
    if (!nameTokens.some((nt) => related(nt, kt))) continue;
    if (brandTokens.some((bt) => related(bt, kt))) brandHits += 1;
    else itemHits += 1;
  }
  if (itemHits === 0) return 0; // 브랜드만 겹친 약한 매칭 제외
  return itemHits * 2 + brandHits; // 아이템 겹침 가중
}

export interface MatchableKeyword {
  id: number;
  text: string;
}

/** 상품에 가장 잘 맞는 키워드. 아이템 겹침이 있어야 매칭(브랜드만이면 제외). 없으면 null. */
export function bestKeywordForProduct(
  product: MatchProduct,
  keywords: MatchableKeyword[],
): { keyword: MatchableKeyword; score: number } | null {
  let best: { keyword: MatchableKeyword; score: number } | null = null;
  for (const keyword of keywords) {
    const score = overlapScore(product, keyword.text);
    if (score >= 1 && (!best || score > best.score)) {
      best = { keyword, score };
    }
  }
  return best;
}
