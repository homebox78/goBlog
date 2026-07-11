# Personal AI Publisher 프로젝트 명세서 (요약)

> React + shadcn/ui + Node.js + MySQL 기반 개인용 AI 콘텐츠 분석·생성·발행 시스템.
> 상세 원본 명세는 관리자가 보관한 「Personal AI Publisher 프로젝트 명세서.md」를 따른다.

## 1. 개요
관리자 1인이 사용하는 개인용 콘텐츠 자동화 시스템.
매일 관심 분야의 실시간 이슈를 분석해 수익 가능성·정보 가치가 높은 키워드를 추천하고,
선택한 키워드로 **Claude Sonnet**이 SEO 콘텐츠를 생성하며 **Gemini**가 대표·본문 이미지를 생성한다.
결과물은 WordPress · Google Blogger · 네이버 블로그 · 티스토리에 맞는 형식으로 변환해 발행하고,
성과(AdSense·Search Console·GA4)를 다시 수집해 개선한다.

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
| 발행 | WordPress REST API · Blogger API (서버 자동) / 네이버·티스토리 (Chrome 확장 반자동) |
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
5. **게시**: WordPress·Blogger 발행 + 예약 + 재시도
6. **확장**: Side Panel 웹뷰 + 네이버·티스토리 어댑터
7. **분석**: Search Console·GA4·AdSense + 콘텐츠 개선 추천

## 7. 빠른 시작
```bash
pnpm install
cp .env.example .env      # 값 채우기 (관리자 계정·암호화 키)
pnpm db:up                # Docker로 MySQL+Redis 기동
pnpm db:push              # Prisma 스키마 반영
pnpm dev                  # api(8787) + web(5173) 동시 실행
```
