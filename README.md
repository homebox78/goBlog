# goBlog — Personal AI Publisher

관리자 1인용 AI 콘텐츠 분석·생성·발행 시스템.
매일 수익 키워드를 발굴하고 Claude로 글을, Gemini로 이미지를 생성해 WordPress·Blogger·네이버·티스토리에 발행한다.

자세한 내용은 [PROJECT_SPEC.md](PROJECT_SPEC.md) 참고.

## 실행

```bash
pnpm install
cp .env.example .env   # 관리자 계정·암호화 키 채우기
pnpm db:tunnel         # 별도 창: 운영 서버 MariaDB SSH 터널 (localhost:3307)
pnpm db:push           # Prisma 스키마 반영 (최초 1회)
pnpm dev               # api :8787 + web :5173
```

DB는 **운영 서버(hom2box.com)의 MariaDB `goBlog`**를 SSH 터널로 사용한다.
- `.env`와 `apps/api/.env`의 `MYSQL_URL`은 `mysql://goblog:<비밀번호>@127.0.0.1:3307/goBlog`
- 터널에는 `config/google_key.pem`이 필요하다 (git 제외 — PC 간 수동 복사)
- 로컬 Docker(MySQL)를 쓰려면 `pnpm db:up` 후 `MYSQL_URL`을 `localhost:3306/publisher`로 변경

- 웹 관리 화면: http://localhost:5173
- API 헬스체크: http://localhost:8787/health
- 최초 기동 시 사용자가 없으면 `.env`의 `ADMIN_EMAIL` / `ADMIN_PASSWORD`로 관리자 계정이 자동 생성된다.

## 구조

| 경로 | 내용 |
|---|---|
| `apps/web` | React 19 + Vite + shadcn/ui 관리 화면 |
| `apps/api` | Express + Prisma(MySQL) API — 인증·설정 암호화·대시보드 |
| `packages/shared` | 공용 타입 |
| `myDev/` | 사용자 컨텍스트 라이브러리 (서브모듈) |
| `config/` | 서버 접속 정보 (git 제외) |

## 진행 상태

- [x] 1단계: 기반 시스템 (모노레포·로그인·설정 AES-256-GCM 암호화·대시보드·연결 테스트)
- [ ] 2단계: 키워드 수집 엔진 (Google Ads·네이버 데이터랩·뉴스·점수화)
- [ ] 3단계: Claude 콘텐츠 엔진 (다국어·스키마·품질 검사)
- [ ] 4단계: Gemini 이미지 엔진
- [ ] 5단계: WordPress·Blogger 발행
- [ ] 6단계: Chrome 확장 (네이버·티스토리 반자동)
- [ ] 7단계: 성과 분석 (Search Console·GA4·AdSense)
