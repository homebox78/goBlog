# One-shot deploy for goBlog -> hom2box.com
#   web  -> /var/www/html/goBlog          (https://hom2box.com/goBlog)
#   api  -> ~/goblog-api  (systemd: goblog-api, 127.0.0.1:8788, Apache proxy /goBlog/api)
# First run also enables Apache proxy modules + conf and installs the systemd unit (sudo).
# Requires: config/google_key.pem, root .env (single source - MYSQL_URL tunnel port 3307 is rewritten to 3306 for the server).
# ASCII only (PS5.1 BOM pitfall).

param([switch]$SkipBuild)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$target = "hbox78@hom2box.com"

# ---- key (locked temp copy) ----
$key = Join-Path $env:TEMP "goblog_key.pem"
if (Test-Path $key) {
    # previously locked read-only; restore ACL before overwrite
    icacls $key /grant "$($env:USERNAME):F" | Out-Null
    Remove-Item $key -Force
}
Copy-Item (Join-Path $root "config\google_key.pem") $key -Force
icacls $key /inheritance:r | Out-Null
icacls $key /grant:r "$($env:USERNAME):R" | Out-Null

# ---- 1) build web ----
if (-not $SkipBuild) {
    Push-Location $root
    $ErrorActionPreference = "Continue"
    cmd /c "pnpm --filter web build"
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw "web build failed" }
    $ErrorActionPreference = "Stop"
    Pop-Location
}

# ---- 2) package ----
$stage = Join-Path $env:TEMP "goblog_deploy"
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $stage | Out-Null

# Always use Windows bsdtar — bash-invoked runs can pick up MSYS tar which mangles -C backslash paths
$tar = Join-Path $env:SystemRoot "System32\tar.exe"
& $tar -czf "$stage\api.tar.gz" -C "$root\apps\api" src prisma package.json tsconfig.json
if ($LASTEXITCODE -ne 0) { throw "api tar failed" }
& $tar -czf "$stage\web.tar.gz" -C "$root\apps\web\dist" .
if ($LASTEXITCODE -ne 0) { throw "web tar failed" }

# ---- 3) server .env (same secrets as local, server-local DB) ----
function Get-EnvValue([string]$file, [string]$name) {
    $line = (Get-Content $file) | Where-Object { $_ -match "^$name=" } | Select-Object -First 1
    if (-not $line) { throw "$name not found in $file" }
    return $line.Substring($name.Length + 1).Trim()
}

# 환경변수는 루트 .env 한 파일이 단일 소스. 로컬은 SSH 터널(3307), 서버는 로컬 DB(3306).
$rootEnv = Join-Path $root ".env"
$mysqlUrl = (Get-EnvValue $rootEnv "MYSQL_URL") -replace "127\.0\.0\.1:3307", "127.0.0.1:3306"

$serverEnv = @(
    "NODE_ENV=production",
    "PORT=8788",
    "WEB_URL=https://hom2box.com",
    "MYSQL_URL=$mysqlUrl",
    "ADMIN_EMAIL=$(Get-EnvValue $rootEnv 'ADMIN_EMAIL')",
    "ADMIN_PASSWORD=$(Get-EnvValue $rootEnv 'ADMIN_PASSWORD')",
    "SESSION_SECRET=$(Get-EnvValue $rootEnv 'SESSION_SECRET')",
    "MASTER_ENCRYPTION_KEY=$(Get-EnvValue $rootEnv 'MASTER_ENCRYPTION_KEY')",
    "EXTENSION_TOKEN=$(Get-EnvValue $rootEnv 'EXTENSION_TOKEN')",
    "MEDIA_DIR=/var/www/html/goBlog/media",
    "MEDIA_PUBLIC_URL=https://hom2box.com/goBlog/media"
) -join "`n"
[IO.File]::WriteAllText("$stage\server.env", $serverEnv + "`n", [Text.UTF8Encoding]::new($false))

# ---- 4) htaccess (SPA fallback) ----
$ht = @(
    "Options -Indexes",
    "<IfModule mod_rewrite.c>",
    "RewriteEngine On",
    "RewriteBase /goBlog/",
    "RewriteCond %{REQUEST_FILENAME} !-f",
    "RewriteCond %{REQUEST_FILENAME} !-d",
    "RewriteRule . index.html [L]",
    "</IfModule>"
) -join "`n"
[IO.File]::WriteAllText("$stage\htaccess", $ht + "`n", [Text.UTF8Encoding]::new($false))

# ---- 5) upload ----
scp -i $key "$stage\api.tar.gz" "$stage\web.tar.gz" "$stage\server.env" "$stage\htaccess" "${target}:/tmp/"

# ---- 6) server-side install/restart (first run: apache conf + systemd unit) ----
$remote = @'
set -e
mkdir -p ~/goblog-api
tar xzf /tmp/api.tar.gz -C ~/goblog-api
mv /tmp/server.env ~/goblog-api/.env
chmod 600 ~/goblog-api/.env
cd ~/goblog-api && /opt/node22/bin/npm install --no-audit --no-fund 2>&1 | tail -2
# sharp 네이티브 바인딩이 optional deps에서 누락되는 경우 보정
/opt/node22/bin/node -e "require('sharp')" 2>/dev/null || /opt/node22/bin/npm install --no-save @img/sharp-linux-x64 2>&1 | tail -1

mkdir -p /var/www/html/goBlog /var/www/html/goBlog/media
rm -rf /var/www/html/goBlog/assets
tar xzf /tmp/web.tar.gz -C /var/www/html/goBlog
mv /tmp/htaccess /var/www/html/goBlog/.htaccess

# 글 생성(Claude)은 '길게'에서 5분을 넘긴다. Apache 기본 300초면 프록시가 먼저 끊으므로 timeout을 명시한다.
# 이미 설정 파일이 있어도 매번 다시 쓴다 — 예전 배포가 만든 timeout 없는 버전을 교정하기 위해서다.
sudo a2enmod proxy proxy_http > /dev/null
printf 'ProxyTimeout 900\nProxyPass "/goBlog/api" "http://127.0.0.1:8788/api" timeout=900\nProxyPassReverse "/goBlog/api" "http://127.0.0.1:8788/api"\n' | sudo tee /etc/apache2/conf-available/goblog.conf > /dev/null
sudo a2enconf goblog > /dev/null
# configtest는 성공해도 "Syntax OK"를 stderr로 뱉는다. 그대로 두면 PowerShell이 NativeCommandError로 보고
# ssh를 끊어 이후 API 배포 단계가 통째로 건너뛰어진다. 출력을 삼키고 실패만 명시적으로 잡는다.
if ! sudo apachectl configtest > /dev/null 2>&1; then
  echo APACHE_CONFIG_ERROR
  exit 1
fi
sudo systemctl reload apache2
echo APACHE_CONFIGURED

if [ ! -f /etc/systemd/system/goblog-api.service ]; then
  printf '[Unit]\nDescription=goBlog API\nAfter=network.target mariadb.service\n\n[Service]\nUser=hbox78\nWorkingDirectory=/home/hbox78/goblog-api\nExecStart=/usr/bin/node node_modules/tsx/dist/cli.mjs src/server.ts\nRestart=always\nRestartSec=5\n\n[Install]\nWantedBy=multi-user.target\n' | sudo tee /etc/systemd/system/goblog-api.service > /dev/null
  sudo systemctl daemon-reload
  sudo systemctl enable goblog-api > /dev/null
  echo SYSTEMD_CONFIGURED
fi

# 배포 스탬프 — 실행 중인 프로세스가 이번 배포 코드인지 /api/health로 검증할 수 있게 한다
date +%Y%m%d%H%M%S > ~/goblog-api/.deploy-stamp

# 고아 프로세스가 8788을 잡고 있으면 restart가 헛돌아 옛 코드가 계속 서빙된다 → 포트 기준으로 확실히 정리

# 진행 중인 요청(글 생성은 3~4분)을 마칠 시간을 준다. 기본 90초면 SIGKILL로 잘려 생성이 통째로 날아간다.
# 유닛 파일 자체는 손대지 않는다(ExecStart의 node 경로가 손으로 바뀌어 있음) - drop-in으로 덧붙인다.
sudo mkdir -p /etc/systemd/system/goblog-api.service.d
printf '[Service]\nTimeoutStopSec=300\nKillSignal=SIGTERM\n' | sudo tee /etc/systemd/system/goblog-api.service.d/graceful.conf > /dev/null
sudo systemctl daemon-reload

sudo systemctl stop goblog-api
sudo fuser -k 8788/tcp 2>/dev/null || true
sleep 1
sudo systemctl start goblog-api
sleep 3
sudo systemctl is-active goblog-api
echo -n "listeners on 8788: "; ss -tlnp 2>/dev/null | grep -c 8788 || true
curl -s http://127.0.0.1:8788/api/health || true
rm -f /tmp/api.tar.gz /tmp/web.tar.gz
echo DEPLOY_DONE
'@
$remoteFile = "$stage\remote.sh"
[IO.File]::WriteAllText($remoteFile, $remote.Replace("`r`n", "`n"), [Text.UTF8Encoding]::new($false))
scp -i $key $remoteFile "${target}:/tmp/goblog-remote.sh"
ssh -i $key $target "bash /tmp/goblog-remote.sh && rm -f /tmp/goblog-remote.sh"

# ---- 7) verify (DB endpoint, not just health) ----
Write-Host "`n--- live verify ---"
try { (Invoke-WebRequest -Uri "https://hom2box.com/goBlog/api/health" -UseBasicParsing).Content } catch { Write-Warning "api health failed: $($_.Exception.Message)" }
try { (Invoke-WebRequest -Uri "https://hom2box.com/goBlog/" -UseBasicParsing).StatusCode } catch { Write-Warning "web failed: $($_.Exception.Message)" }

Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "Done: https://hom2box.com/goBlog"
