# 쓰레드 봇 — 스레드 계정 연결(OAuth) 설정 가이드

관리자 **쓰레드 봇** 페이지 상단 "스레드 계정 연결" 카드로, 스레드 계정(@soyeon.overtime 등)에
로그인·승인만 하면 발행 토큰이 자동 등록된다. 그러려면 Meta 개발자 앱(Threads API)이 하나 필요하다.

- 리디렉션 URI(콜백): `https://hom2box.com/goBlog/api/settings/threads/oauth/callback`
- 필요한 권한(스코프): `threads_basic`, `threads_content_publish`
- 코드는 이미 배포됨(2026-07-21). 아래는 **Meta 콘솔 쪽 1회 설정**만 정리한 것.
  (Meta UI는 자주 바뀐다 — 화면이 다르면 왼쪽 메뉴 **사용 사례(Use cases)** / **설정(Settings)** 을 기준으로 찾는다.)

## 1. 앱 생성
- developers.facebook.com → **내 앱(My Apps) → 앱 만들기(Create App)**
- "무엇을 하려고 하나요?"에서 **"Threads API 액세스"(Access the Threads API)** 선택
- 없으면 앱 유형 **기타(Other)** 로 만든 뒤 대시보드에서 **Threads** 제품 추가

## 2. 권한 — 왼쪽 메뉴 "사용 사례(Use cases)"
- **사용 사례(Use cases)** → Threads 항목 **사용자 지정(Customize)**
- `threads_basic`(필수·제거 불가), `threads_content_publish` 옆 **추가(Add)**

## 3. App ID·Secret + 리디렉션 URI — 왼쪽 메뉴 "설정(Settings)"  ← UI 변경 핵심
- **설정(Settings)** 화면에서:
  - **Threads 앱 ID(Threads app ID)**, **Threads 앱 시크릿(Threads app secret)** → 이 값을 사용
    (일반 "앱 ID"가 아님)
  - **Client OAuth Settings → 유효한 OAuth 리디렉션 URI(Valid OAuth Redirect URIs)** 에 위 콜백 주소를 그대로 등록

## 4. 테스터 계정 추가(@soyeon.overtime) — 개발 모드면 필수
- **설정(Settings)** 의 **"Add or Remove Threads Test Users"** → **앱 역할(App roles) > 역할(Roles)**
- **사람 추가(Add People)** → **Threads Testers** 역할로 @soyeon.overtime 초대
- 스레드 앱/웹에서 그 계정 로그인 → 초대 **수락**
- (앱 소유자 계정 = 그 계정이면 초대 없이 바로 승인됨)

## 5. 연결 (여기서부터는 클릭만)
1. 관리자 → **쓰레드 봇** → 상단 "스레드 계정 연결" 카드에 **Threads App ID / App Secret** 붙여넣기
2. **계정 연결** 클릭 → 팝업에서 스레드 로그인·승인
3. **"스레드 연결됨 — @soyeon.overtime"** 표시되면 완료. 이후 초안의 **Threads 발행** 버튼이 이 계정으로 올림.

## 참고
- 토큰이 없어도 각 글의 **복사** 버튼으로 스레드 앱에 직접 붙여넣기는 항상 가능.
- 발급되는 토큰은 **장기 토큰(약 60일)** — 만료 전에 "다시 연결" 누르면 갱신.
- 요점: **권한은 '사용 사례', App ID/Secret·리디렉션 URI는 '설정(Settings)'**.

출처(2026-07 확인):
- https://developers.facebook.com/docs/development/create-an-app/threads-use-case/
- https://developers.facebook.com/docs/threads/get-started
