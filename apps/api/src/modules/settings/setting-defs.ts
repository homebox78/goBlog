export interface SettingDef {
  key: string;
  group: string;
  label: string;
  secret: boolean;
  /** 기본값 (미설정 시 GET 응답에 노출) */
  defaultValue?: string;
}

/**
 * 명세서 18장 "설정 페이지" 기준의 설정 키 정의.
 * secret=true 값은 AES-256-GCM으로 암호화되어 저장되고 GET 응답에서는 값 대신 hasValue만 내려간다.
 */
// ⚠️ 여기에 키를 정의하면 반드시 읽는 코드가 있어야 한다.
// 동작이 코드에 고정돼 있는데 설정만 보이면, 사용자는 값을 바꾸고 "적용됐다"고 믿는다
// (자동발행 최소 품질 점수가 실제로 그랬다 — 90으로 바꿔도 85가 하드코딩돼 무시됐다).
export const SETTING_DEFS: SettingDef[] = [
  // Claude
  { key: "anthropic.apiKey", group: "claude", label: "Anthropic API Key", secret: true },
  { key: "anthropic.model", group: "claude", label: "Claude 모델", secret: false, defaultValue: "claude-sonnet-5" },
  { key: "anthropic.defaultLength", group: "claude", label: "기본 글 길이", secret: false, defaultValue: "2000" },
  { key: "anthropic.minQualityScore", group: "claude", label: "자동발행 최소 품질 점수", secret: false, defaultValue: "85" },
  // 하루 자동 생성 상한 — 대량 생성(스팸/애드센스 위험)을 막는다. 스케줄러가 이 수를 넘으면 그날은 더 안 만든다.
  { key: "scheduler.dailyLimit", group: "claude", label: "하루 자동 생성 상한(글)", secret: false, defaultValue: "5" },
  // 제휴 배너 전역 스위치 — off면 어떤 글에도 상품 배너를 삽입하지 않는다(정보성 블로그로 운영할 때).
  // 초기 운영 정책: 독자 확보 전까지 광고 없이 뉴스·가이드만 → 기본 off. 독자 모인 뒤 관리자 설정에서 켠다.
  { key: "affiliate.bannersEnabled", group: "claude", label: "제휴 배너 삽입 사용", secret: false, defaultValue: "false" },
  // 드립 자동 발행 — on이면 검토 끝난 글을 하루 상한만큼 카테고리 고르게 자동 발행(대량 배포 방지). off면 수동 발행.
  { key: "scheduler.autoPublishDaily", group: "claude", label: "하루 자동 발행(드립)", secret: false, defaultValue: "true" },

  // Gemini
  { key: "gemini.apiKey", group: "gemini", label: "Gemini API Key", secret: true },
  { key: "gemini.imageModel", group: "gemini", label: "Gemini 이미지 모델", secret: false, defaultValue: "gemini-2.5-flash-image" },
  { key: "gemini.featuredImageCount", group: "gemini", label: "대표 이미지 수", secret: false, defaultValue: "1" },
  { key: "gemini.contentImageCount", group: "gemini", label: "본문 이미지 수", secret: false, defaultValue: "3" },

  // 키워드 — 주제는 사용자가 입력하지 않는다. 매일 수집한 이슈·트렌드 데이터에서 자동 발굴한다.
  { key: "keywords.dailyCount", group: "keywords", label: "일일 추천 수", secret: false, defaultValue: "20" },
  { key: "keywords.collectTime", group: "keywords", label: "자동 수집 시간 (KST)", secret: false, defaultValue: "07:00" },
  { key: "keywords.revenueRatio", group: "keywords", label: "수익형 비율(%)", secret: false, defaultValue: "30" },
  { key: "keywords.issueRatio", group: "keywords", label: "이슈형 비율(%)", secret: false, defaultValue: "20" },
  { key: "keywords.evergreenRatio", group: "keywords", label: "에버그린 비율(%)", secret: false, defaultValue: "50" },

  // Google Ads
  { key: "googleAds.developerToken", group: "googleAds", label: "Developer Token", secret: true },
  { key: "googleAds.customerId", group: "googleAds", label: "Customer ID", secret: false },
  { key: "googleAds.loginCustomerId", group: "googleAds", label: "Login Customer ID", secret: false },
  { key: "googleAds.clientId", group: "googleAds", label: "OAuth Client ID", secret: false },
  { key: "googleAds.clientSecret", group: "googleAds", label: "OAuth Client Secret", secret: true },
  { key: "googleAds.refreshToken", group: "googleAds", label: "OAuth Refresh Token", secret: true },
  { key: "googleAds.apiVersion", group: "googleAds", label: "API Version", secret: false, defaultValue: "v21" },

  // 네이버
  { key: "naver.datalabClientId", group: "naver", label: "DataLab Client ID", secret: false },
  { key: "naver.datalabClientSecret", group: "naver", label: "DataLab Client Secret", secret: true },
  { key: "naver.searchAdApiKey", group: "naver", label: "검색광고 API Key", secret: true },
  { key: "naver.searchAdSecret", group: "naver", label: "검색광고 Secret", secret: true },
  { key: "naver.searchAdCustomerId", group: "naver", label: "검색광고 Customer ID", secret: false },
  // 브랜드커넥트 상품검색 URL의 회원 ID (brandconnect.naver.com/{이 값}/affiliate/products/search)
  { key: "naver.brandconnectMemberId", group: "naver", label: "브랜드커넥트 회원 ID (URL 숫자)", secret: false },

  // 쿠팡 파트너스 (Open API — 상품 검색·골드박스·딥링크)
  { key: "coupang.accessKey", group: "coupang", label: "쿠팡 파트너스 Access Key", secret: false },
  { key: "coupang.secretKey", group: "coupang", label: "쿠팡 파트너스 Secret Key", secret: true },
  { key: "coupang.subId", group: "coupang", label: "채널 ID (subId, 선택)", secret: false },

  // 게시 플랫폼
  { key: "wordpress.url", group: "platforms", label: "WordPress URL", secret: false },
  { key: "wordpress.username", group: "platforms", label: "WordPress Username", secret: false },
  { key: "wordpress.appPassword", group: "platforms", label: "WordPress Application Password", secret: true },
  { key: "blogger.blogId", group: "platforms", label: "Blogger 블로그 주소 또는 ID", secret: false },
  { key: "blogger.clientId", group: "platforms", label: "Blogger OAuth Client ID", secret: false },
  { key: "blogger.clientSecret", group: "platforms", label: "Blogger OAuth Client Secret", secret: true },
  { key: "blogger.refreshToken", group: "platforms", label: "Blogger OAuth Refresh Token", secret: true },
  // 성과 수집(Search Console) — Blogger와 같은 구글 클라이언트로 재동의해 받은 토큰(스코프에 webmasters 포함)
  { key: "google.analyticsRefreshToken", group: "platforms", label: "구글 성과수집 Refresh Token", secret: true },
  { key: "gsc.siteUrls", group: "platforms", label: "Search Console 속성 URL (줄바꿈 구분)", secret: false },
  { key: "naverBlog.writeUrl", group: "platforms", label: "네이버 블로그 작성 URL", secret: false },
  { key: "tistory.writeUrl", group: "platforms", label: "티스토리 작성 URL", secret: false },
  // Instagram Graph API — 비즈니스/크리에이터 계정 + Facebook 앱 필요. 이미지·캡션 자동 발행 가능.
  { key: "instagram.businessAccountId", group: "platforms", label: "Instagram 비즈니스 계정 ID", secret: false },
  { key: "instagram.accessToken", group: "platforms", label: "Instagram 액세스 토큰", secret: true },
  // Threads API — '앱 만들기 → 사용 사례: Threads API 액세스'로 발급한 토큰. userId는 비우면 토큰으로 자동 조회.
  { key: "threads.accessToken", group: "platforms", label: "Threads 액세스 토큰", secret: true },
  { key: "threads.userId", group: "platforms", label: "Threads 사용자 ID (비우면 자동)", secret: false },

  // 공공데이터포털(data.go.kr) — 복지로 복지서비스(지원금) API 인증키. 중앙·지자체 공용.
  { key: "datago.serviceKey", group: "keywords", label: "공공데이터포털 인증키 (복지서비스)", secret: true },

  // 텔레그램 알림 — 일일 전체 운영 보고 + 발행 실패 즉시 알림 (@BotFather에서 봇 생성)
  { key: "telegram.botToken", group: "notify", label: "텔레그램 봇 토큰", secret: true },
  { key: "telegram.chatId", group: "notify", label: "텔레그램 Chat ID", secret: false },
  { key: "telegram.dailyReportTime", group: "notify", label: "일일 보고 시각 (KST)", secret: false, defaultValue: "22:00" },
];

export const SETTING_DEF_MAP = new Map(SETTING_DEFS.map((def) => [def.key, def]));
