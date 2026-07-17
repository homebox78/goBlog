/** 공개 뉴스 사이트(site/news) 정적 Tailwind 빌드 — CDN(cdn.tailwindcss.com v3) 대체.
 *  content: PHP 소스(리터럴·JS주입 클래스) + 렌더HTML 스냅샷(PHP 보간 클래스) + safelist. */
module.exports = {
  content: [
    '../**/*.php',
    './snapshots/*.html',
    './safelist.html',
  ],
  theme: { extend: {} },
  plugins: [],
};
