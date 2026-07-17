# HOM2BOX 뉴스 사이트 — 시안(Hom2box디자인개편) 반영 체크리스트

기준일: 2026-07-18. 대상: `site/news`(공개 PHP 뉴스 사이트, → 서버 `/var/www/html`).
배포: `scp`(key: `config/google_key.pem`, `$env:TEMP/goblog_key.pem`) → `php -l` → `sudo cp /var/www/html` → `chown www-data`. CSS는 `site/news/tailwind/build.sh --nosnap` 재빌드 후 `TW_CSS_VER` 올려 배포.

## ✅ 완료 · 배포됨
- [x] **아이콘 크기 전역 버그 수정** — Material Symbols CSS가 tailwind.css 뒤에 로드돼 `font-size:24px`가 `text-[Npx]`를 이기던 문제. MS 기본 클래스를 tailwind.css **앞** inline `<style>`로 이동 → 아이콘 시안 크기 정상. (layout.php)
- [x] **좌·우 퀵 레일(2xl 이상)** 추가 — 좌: 뉴스/오피니언/언론사/계산기/지원금, 우: 문서도구/검색/구독/문의하기/맨위로. 기존 플로팅 버튼(문의·맨위로)을 레일에 편입, 2xl 미만은 기존 플로팅 유지. 접기 토글(:has). (layout.php render_foot)
- [x] **외부 폰트 전량 로컬 자체호스팅** — S-CoreDream 5종(300/400/500/700/800) + Material Symbols → `assets/fonts/*.woff2`. 외부(googleapis/gstatic/jsdelivr) 호출 **0건** 검증 완료. (layout.php, assets/fonts)
- [x] **기사 리스트 썸네일 확대·통일** — category·opinion·search 모두 `h-[92px] w-[138px] sm:h-[110px] sm:w-[165px]`(3:2). opinion 설명 2줄 클램프. (category.php, opinion.php, search.php)
- [x] **welfare 지역명 축약** — 충청북도→충북 등(라벨만, 필터값은 정식명 유지). (welfare.php)
- [x] **계산기 상세 시안 2단 엔진 이식** — 입력카드+실시간 결과카드+계산식+비교표+기준·FAQ·팁, 30종 vanilla JS. basis/faq/tips 서버렌더(SEO). 6종 수치검증 통과(salary 2,637,172 등). (tool.php)
- [x] **계산기 입력 3자리 콤마 자동** — type=text + fmtComma + 캐럿 보정. (tool.php)
- [x] **홈**: 히어로 헤드라인 한줄 요약, 언론사 헤드라인 12카테고리 박스 그리드(반응형), 뉴스레터 설명 한줄. (index.php)
- [x] **market 스트립**: 비트코인·원/달러 제거(원/달러 fetch는 하이닉스ADR 환산용으로 유지). 남음: 코스피·코스닥·나스닥·삼성전자·하이닉스·하이닉스ADR. (includes/market.php)
- [x] **docs 상세 설명 한줄**(line-clamp-1). (docs.php)

## ✅ 완료 · 배포됨 (추가분, 2026-07-18 배포3)
- [x] **그리드/리스트 뷰 토글**(category.php) — "전체 기사 N건" 우측 세그먼트 스위치. 리스트형(기본) ↔ 그리드형(3열 카드). CSS 뷰클래스 토글 + localStorage. **검증: 리스트↔그리드 전환·그리드 3열 세로카드 확인.**
- [x] **계산기 금액 만원→원 단위 전환**(tool.php) — 31개 금액 필드(fi_gross 포함) '만원'→'원', 기본값 ×10000, compute ×10000 제거. 결과 동치(5종 검증). **검증: 대출원금 기본 30,000,000원, 5천만원 입력 시 월 932,151원 — 단위 혼동/계산오류 해결.** (비금액 만회·만뷰·만명은 유지)
- [x] **홈 지원금 캐러셀 12개·반응형 슬라이드**(index.php) — 12개 출력, per-view lg4/sm3/mobile1, 화살표 페이지 이동·경계 정지. "지원금 찾기" 카드 설명 한줄. **검증: 12개·flex-basis calc(25%) 확인.**

## ⏳ 미착수(다음)
- [ ] **playwright 시안 1:1 최종 대조** — 각 페이지 색/패딩/간격 미세보정(사용자가 지속적으로 "시안과 다름" 지적 → 페이지별 대조 필요).
- [ ] (로드맵) 성과 수집(A) 최우선 미구현, 쿠팡 제휴링크 백필(3,421건 ≤40/min), Threads 커넥터(Meta SMS 대기).

## 배포 절차(요약)
```
# CSS 변경 시
cd site/news/tailwind && bash build.sh --nosnap   # ../**/*.php 스캔
# layout.php TW_CSS_VER 한 단계 올림(캐시 무효화)
# scp 변경파일 → /tmp → php -l → sudo cp /var/www/html(+includes) → chown www-data → tailwind.css → assets/fonts
```

## 검증 포인트(playwright)
- 외부 리소스 0건: `performance.getEntriesByType('resource')` 필터.
- 아이콘 크기: `text-[16px]`=16px 등(material-symbols).
- 계산기: 콤마 입력·실시간 결과·2단 레이아웃.
- 레일: 2xl(≥1536)에서 표시.
