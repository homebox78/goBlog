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
export const SETTING_DEFS: SettingDef[] = [
  // Claude
  { key: "anthropic.apiKey", group: "claude", label: "Anthropic API Key", secret: true },
  { key: "anthropic.model", group: "claude", label: "Claude 모델", secret: false, defaultValue: "claude-sonnet-5" },
  { key: "anthropic.defaultLength", group: "claude", label: "기본 글 길이", secret: false, defaultValue: "2000" },
  { key: "anthropic.defaultTone", group: "claude", label: "기본 문체", secret: false, defaultValue: "친절한 설명체" },
  { key: "anthropic.minQualityScore", group: "claude", label: "자동발행 최소 품질 점수", secret: false, defaultValue: "85" },

  // Gemini
  { key: "gemini.apiKey", group: "gemini", label: "Gemini API Key", secret: true },
  { key: "gemini.imageModel", group: "gemini", label: "Gemini 이미지 모델", secret: false, defaultValue: "gemini-2.5-flash-image" },
  { key: "gemini.featuredImageCount", group: "gemini", label: "대표 이미지 수", secret: false, defaultValue: "1" },
  { key: "gemini.contentImageCount", group: "gemini", label: "본문 이미지 수", secret: false, defaultValue: "3" },
  { key: "gemini.convertWebp", group: "gemini", label: "WebP 자동 변환", secret: false, defaultValue: "true" },
  { key: "gemini.thumbnailTextOverlay", group: "gemini", label: "썸네일 문자 합성", secret: false, defaultValue: "true" },

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

  // 게시 플랫폼
  { key: "wordpress.url", group: "platforms", label: "WordPress URL", secret: false },
  { key: "wordpress.username", group: "platforms", label: "WordPress Username", secret: false },
  { key: "wordpress.appPassword", group: "platforms", label: "WordPress Application Password", secret: true },
  { key: "blogger.blogId", group: "platforms", label: "Blogger Blog ID", secret: false },
  { key: "naverBlog.writeUrl", group: "platforms", label: "네이버 블로그 작성 URL", secret: false },
  { key: "tistory.writeUrl", group: "platforms", label: "티스토리 작성 URL", secret: false },
];

export const SETTING_DEF_MAP = new Map(SETTING_DEFS.map((def) => [def.key, def]));
