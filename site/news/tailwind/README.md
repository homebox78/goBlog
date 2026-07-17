# 공개 뉴스 사이트 정적 Tailwind 빌드

`hom2box.com`(site/news)은 원래 `cdn.tailwindcss.com`(Play CDN, 런타임 JS 컴파일)을
로드했다. 이는 개발용으로 프로덕션 비권장이며 LCP 지연·FOUC를 유발한다.
이 디렉터리는 그 CDN을 **미리 컴파일된 정적 CSS 한 파일**로 대체한다.

## 구성
- `tailwind.config.cjs` — content 글롭(PHP 소스 + 스냅샷 + safelist), 기본 테마(커스텀 없음)
- `input.css` — `@tailwind base/components/utilities`
- `safelist.html` — 런타임/JS로만 등장해 스캔에 안 잡히는 클래스(주로 `#134a9c` 변형)
- `snapshots/` — 라이브 렌더 HTML(PHP 보간 클래스 포착용, git 미추적)
- `dist/tailwind.css` — 빌드 결과(서버 배포 대상)
- `build.sh` — 스냅샷 수집 + 빌드

## 왜 스냅샷이 필요한가
PHP가 `class="text-[<?= $P ?>]"`처럼 클래스를 런타임 보간하므로, .php 소스만
스캔하면 `text-[<?= $P ?>]` 리터럴만 보여 실제 `text-[#134a9c]`가 생성되지 않는다.
라이브 페이지를 curl해 렌더된 HTML을 스캔 소스에 넣어 해결한다.
계산기 결과처럼 JS가 주입하는 클래스는 tools-data.php JS 문자열에 리터럴로 있어
.php 스캔으로 포착된다.

## 빌드 & 배포
```bash
bash build.sh                    # 스냅샷 재수집 + 빌드
# 서버 반영
scp dist/tailwind.css hbox78@hom2box.com:/tmp/
ssh hbox78@hom2box.com 'sudo cp /tmp/tailwind.css /var/www/html/assets/tailwind.css && sudo chown www-data:www-data /var/www/html/assets/tailwind.css'
# includes/layout.php의 TW_CSS_VER 갱신(캐시 무효화) 후 layout.php 배포
```

## 주의
- CDN은 Tailwind **v3**이므로 v3 CLI로 빌드한다(v4는 기본값이 달라 화면이 미세하게 바뀜).
- 마크업에 **새 Tailwind 클래스**를 추가하면 반드시 재빌드해야 반영된다.
  (특히 새 임의값 `#색상`이나 PHP/JS 동적 클래스는 safelist 확인)
