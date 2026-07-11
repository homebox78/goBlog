# Personal AI Publisher 프로젝트 명세서 (요약)

> React + shadcn/ui + Node.js + MySQL 기반 개인용 AI 제휴 마케팅 콘텐츠 시스템.
> 상세 원본 명세는 관리자가 보관한 「Personal AI Publisher 프로젝트 명세서.md」를 따른다.

## 1. 개요 (2026-07-11 전면기획 수정 — 제휴 홍보 특화)
관리자 1인이 사용하는 **쿠팡 파트너스 + 네이버 쇼핑 커넥트(브랜드커넥트) 특화 홍보 포스팅 시스템**.

핵심 흐름: **① 제품 선택 → ② AI 홍보 글 자동 작성 → ③ 제휴 링크·상품 배너 자동 삽입 → ④ 발행**
- **쿠팡 파트너스**: 공식 Open API 완전 연동 — 상품 검색·골드박스 특가 탐색, 딥링크(트래킹 링크) 자동 발급,
  상품 배너(이미지·가격·CTA 버튼) 본문 삽입, 대가성 문구 자동 표기
- **네이버 쇼핑 커넥트**: 공개 API 없음 — 콘솔에서 발급한 트래킹 링크를 입력하면 동일 파이프라인으로 처리.
  규정 대가성 문구 원문 그대로 본문 최상단 삽입(네이버 블로그 발행 시 제목 앞 표기 포함), 6단계 확장에서 반자동 연동
- 보조 기능: 매일 이슈·트렌드 기반 수익 키워드 자동 발굴(글감), Gemini 이미지, 다국어, 다중 플랫폼 발행, 성과 분석

### 법적 의무 (자동 강제)
- 쿠팡: "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다." — 본문 최상단
- 쇼핑 커넥트: "이 포스팅은 네이버 쇼핑 커넥트 활동의 일환으로, 판매 발생 시 수수료를 제공받습니다."
  — 원문 그대로(임의 변경 금지), 블로그는 제목 앞 + 본문 최상단. #내돈내산 병행 금지, 활동 제한 채널 게시 금지
- 제휴 링크는 `rel="sponsored nofollow"`, 허위 사용 후기·평점 생성 금지

## 2. 사용자 정책
- 관리자 계정 1개. 회원가입·결제·구독 없음.
- 로그인: 이메일 + 비밀번호(Argon2 해시), 로그인 실패 10회 시 15분 잠금.
- 세션: JWT Access(15분) + Refresh Token 회전(30일, httpOnly 쿠키).
- 금지: 무제한 대량 콘텐츠 생성, 광고 클릭 유도, 허위 상품 후기, 검증되지 않은 통계·출처 생성.

## 3. 기술 스택
| 영역 | 스택 |
|---|---|
| 프론트엔드 | React 19 + TypeScript + Vite + shadcn/ui + Tailwind v4 + React Router + TanStack Query + RHF + Zod |
| 백엔드 | Node.js + TypeScript + Express + Prisma + MySQL 8 + Redis + BullMQ |
| AI | Anthropic Claude(글·키워드·검수, 기본 `claude-sonnet-5`, 설정에서 변경) / Gemini(이미지) |
| 키워드 데이터 | Google Ads Keyword Planner · Google Trends · Google News RSS · 네이버 데이터랩·검색·검색광고 |
| 발행 | WordPress REST API · Blogger API · Instagram Graph API (서버 자동) / 네이버·티스토리 (Chrome 확장 반자동) |
| 분석 | Search Console · GA4 · AdSense Management API |
| 확장 | Chrome MV3 + Side Panel(웹뷰 iframe) + Content Script 어댑터 |

## 4. 모노레포 구조
```
goblog/
├─ apps/
│  ├─ web/        # React 관리 화면 (로그인·대시보드·키워드·글·스케줄·설정)
│  ├─ api/        # Express API + Prisma (인증·설정 암호화·키워드·콘텐츠·발행·분석)
│  └─ extension/  # Chrome 확장 (6단계에서 추가)
├─ packages/shared/  # 공용 타입
├─ myDev/            # 사용자 컨텍스트 라이브러리 (서브모듈, 증적)
├─ config/           # 서버 접속 정보 (git 제외)
└─ docker-compose.yml  # MySQL 8.4 + Redis 7
```

## 5. 핵심 규칙
- **키워드 주제는 사용자가 입력하지 않는다.** 시스템이 매일 Google 뉴스·Trends·네이버 데이터랩 등에서
  그날의 이슈를 수집하고, 검색량·CPC·경쟁도 데이터를 조합해 수익 키워드를 자동 발굴·추천한다.
  사용자는 추천 개수·수집 시간·유형 비율(이슈/에버그린/수익형)만 설정한다.
- **설정 비밀값**(API 키·토큰·앱 비밀번호)은 AES-256-GCM 암호화 후 `settings` 테이블 저장. GET 응답에는 값 대신 `hasValue`만.
- **키워드 점수**: 수익 가능성(40%) + 콘텐츠 가치(35%) + 상위노출 기회(25%). 데이터 없으면 임의 수치 생성 금지.
- **품질 게이트**: 품질 점수 85점 미만 자동발행 차단. 출처 URL 실존 검증. 금융·의료·법률은 관리자 검토 필수.
- **이미지**: 대표 1 + 본문 3(기본). WebP 변환·ALT·캡션 자동. 한글 문구 썸네일은 Sharp 서버 합성.
- **스키마**: Article·NewsArticle·BlogPosting·FAQPage·Product·Review·HowTo·BreadcrumbList. 허위 평점·미검토 리뷰 구조화 금지.
- **네이버·티스토리**: 로그인 쿠키를 서버로 보내지 않음. 확장 프로그램이 폼 입력, 발행은 사용자 확인.
- 서버가 원시 JavaScript를 확장에 내려보내 실행하는 것 금지(MV3 원격 코드 정책) — JSON 데이터만 전달.

## 6. 개발 단계
1. **기반**: 모노레포 + 로그인 + 설정 암호화 + 대시보드 ✅ (2026-07-11)
2. **키워드**: 뉴스·트렌드 수집 + Google Ads 검색량·CPC + 점수화 + 오늘의 키워드 화면
3. **콘텐츠**: Claude 글 생성(5개 언어) + 스키마 + 품질 검사 + 버전 히스토리
4. **이미지**: Gemini 생성 + Sharp 최적화 + 본문 자동 삽입
5. **게시**: WordPress·Blogger 발행 + Instagram(Graph API — Gemini 이미지+캡션 카드뉴스, 일 25회 제한) + 예약 + 재시도
6. **확장**: Side Panel 웹뷰 + 네이버·티스토리 어댑터 + 네이버 브랜드커넥트(공개 API 없음 — 브라우저 세션 반자동: 캠페인 조회·지원 보조)
7. **분석**: Search Console·GA4·AdSense + 콘텐츠 개선 추천

## 7. 빠른 시작
```bash
pnpm install
cp .env.example .env      # 값 채우기 (관리자 계정·암호화 키)
pnpm db:up                # Docker로 MySQL+Redis 기동
pnpm db:push              # Prisma 스키마 반영
pnpm dev                  # api(8787) + web(5173) 동시 실행
```
