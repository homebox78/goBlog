# One-shot deploy for goBlog -> hom2box.com
#   web  -> /var/www/html/goBlog          (https://hom2box.com/goBlog)
#   api  -> ~/goblog-api  (systemd: goblog-api, 127.0.0.1:8788, Apache proxy /goBlog/api)
# First run also enables Apache proxy modules + conf and installs the systemd unit (sudo).
# Requires: config/google_key.pem, root .env, apps/api/.env (tunnel URL; password reused for server URL).
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

tar -czf "$stage\api.tar.gz" -C "$root\apps\api" src prisma package.json tsconfig.json
tar -czf "$stage\web.tar.gz" -C "$root\apps\web\dist" .

# ---- 3) server .env (same secrets as local, server-local DB) ----
function Get-EnvValue([string]$file, [string]$name) {
    $line = (Get-Content $file) | Where-Object { $_ -match "^$name=" } | Select-Object -First 1
    if (-not $line) { throw "$name not found in $file" }
    return $line.Substring($name.Length + 1).Trim()
}

$rootEnv = Join-Path $root ".env"
$apiEnv = Join-Path $root "apps\api\.env"
$mysqlUrl = (Get-EnvValue $apiEnv "MYSQL_URL") -replace "127\.0\.0\.1:3307", "127.0.0.1:3306"

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

if [ ! -f /etc/apache2/conf-enabled/goblog.conf ]; then
  sudo a2enmod proxy proxy_http > /dev/null
  printf 'ProxyPass "/goBlog/api" "http://127.0.0.1:8788/api"\nProxyPassReverse "/goBlog/api" "http://127.0.0.1:8788/api"\n' | sudo tee /etc/apache2/conf-available/goblog.conf > /dev/null
  sudo a2enconf goblog > /dev/null
  sudo apachectl configtest
  sudo systemctl reload apache2
  echo APACHE_CONFIGURED
fi

if [ ! -f /etc/systemd/system/goblog-api.service ]; then
  printf '[Unit]\nDescription=goBlog API\nAfter=network.target mariadb.service\n\n[Service]\nUser=hbox78\nWorkingDirectory=/home/hbox78/goblog-api\nExecStart=/usr/bin/node node_modules/tsx/dist/cli.mjs src/server.ts\nRestart=always\nRestartSec=5\n\n[Install]\nWantedBy=multi-user.target\n' | sudo tee /etc/systemd/system/goblog-api.service > /dev/null
  sudo systemctl daemon-reload
  sudo systemctl enable goblog-api > /dev/null
  echo SYSTEMD_CONFIGURED
fi

sudo systemctl restart goblog-api
sleep 3
sudo systemctl is-active goblog-api
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
