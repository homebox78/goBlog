# WordPress 업로드 권한 수정 — wp-content를 웹서버(www-data)가 쓸 수 있게 한다.
#   증상: 글꼴 설치 실패 / 미디어 업로드 실패 (rest_upload_sideload_error:
#         "디렉터리 wp-content/uploads/... 생성 불가")
#   원인: wp-content 소유자가 hbox78:hbox78 이고 Apache는 www-data로 돌아 쓰기 불가.
#   해결: 소유자 hbox78(직접 편집 유지) + 그룹 www-data(웹서버 쓰기) + setgid(2775)로
#         새로 생기는 파일·폴더도 그룹을 상속받게 해 재발을 막는다.
#
# deploy.ps1과 동일한 방식(원격 스크립트 전송 후 bash 실행)을 사용한다. ASCII only (PS5.1 BOM 회피).

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$target = "hbox78@hom2box.com"

# ---- key (locked temp copy) ----
$key = Join-Path $env:TEMP "goblog_key.pem"
if (Test-Path $key) {
    icacls $key /grant "$($env:USERNAME):F" | Out-Null
    Remove-Item $key -Force
}
Copy-Item (Join-Path $root "config\google_key.pem") $key -Force
icacls $key /inheritance:r | Out-Null
icacls $key /grant:r "$($env:USERNAME):R" | Out-Null

$stage = Join-Path $env:TEMP "goblog_wpfix"
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $stage | Out-Null

$remote = @'
set -e
WP=/var/www/html/wordpress

echo "--- before ---"
ls -ld $WP/wp-content || true
ls -ld $WP/wp-content/uploads 2>/dev/null || echo "uploads: (none)"

# uploads/fonts 생성 + 웹서버 그룹 쓰기 권한 + setgid 상속
sudo mkdir -p $WP/wp-content/uploads/fonts
sudo chown -R hbox78:www-data $WP/wp-content
sudo find $WP/wp-content -type d -exec chmod 2775 {} +
sudo find $WP/wp-content -type f -exec chmod 664 {} +

echo "--- after ---"
ls -ld $WP/wp-content $WP/wp-content/uploads $WP/wp-content/uploads/fonts
echo WPFIX_DONE
'@

$remoteFile = "$stage\remote.sh"
[IO.File]::WriteAllText($remoteFile, $remote.Replace("`r`n", "`n"), [Text.UTF8Encoding]::new($false))
scp -i $key $remoteFile "${target}:/tmp/goblog-wpfix.sh"
ssh -i $key $target "bash /tmp/goblog-wpfix.sh && rm -f /tmp/goblog-wpfix.sh"

Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "Done."
