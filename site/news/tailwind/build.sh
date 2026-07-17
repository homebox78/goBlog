#!/bin/bash
# 공개 뉴스 사이트(site/news) 정적 Tailwind CSS 빌드.
# CDN(cdn.tailwindcss.com)을 대체하는 dist/tailwind.css를 생성한다.
#
# 스캔 소스 3종:
#   1) ../**/*.php        — PHP 소스의 리터럴 클래스 + tools-data.php JS 주입 클래스
#   2) snapshots/*.html   — 라이브 렌더 HTML(PHP 보간 클래스 text-[#134a9c] 등)
#   3) safelist.html      — 런타임/JS로만 나타나 스캔에 안 잡히는 클래스 보험
#
# 사용:  bash build.sh          (스냅샷 재수집 + 빌드)
#        bash build.sh --nosnap (기존 스냅샷으로 빌드만)
#
# 빌드 후 dist/tailwind.css를 서버 /var/www/html/assets/tailwind.css로 배포하고
# includes/layout.php의 TW_CSS_VER를 갱신(캐시 무효화)한다.
set -e
cd "$(dirname "$0")"

if [ "$1" != "--nosnap" ]; then
  echo "▶ 라이브 페이지 스냅샷 수집..."
  mkdir -p snapshots
  snap(){ curl -s "https://hom2box.com/$1" -o "snapshots/$2.html"; }
  snap "" home
  for id in 71 60 55 45 30; do snap "article.php?id=$id" "article_$id"; done
  snap "tools.php" tools
  for t in salary loan instagram dsr acquisition youtube severance jeonsewolse; do snap "tool.php?id=$t" "tool_$t"; done
  for c in "경제·금융" "IT·게임" "생활·건강" "여행·문화" "종합"; do
    enc=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$c")
    snap "category.php?cat=$enc" "cat_$(echo $c | tr -d '·')"
  done
  for p in press opinion welfare subscribe about privacy contact; do snap "$p.php" "$p"; done
  snap "search.php?q=경제" search
  snap "nonexistent-404" notfound
  echo "  스냅샷 $(ls snapshots/*.html | wc -l)개"
fi

echo "▶ Tailwind v3 정적 빌드..."
npx -y tailwindcss@3 -c tailwind.config.cjs -i input.css -o dist/tailwind.css --minify
echo "✔ dist/tailwind.css ($(( $(wc -c < dist/tailwind.css) / 1024 ))KB)"
