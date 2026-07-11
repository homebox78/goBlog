# Opens an SSH tunnel: localhost:3307 -> hom2box.com MySQL(3306)
# Requires: config/google_key.pem (not in git). Keep this window open while developing.
# Note: key is copied to %TEMP% with locked ACL because keys on G:\ have loose
#       permissions and OpenSSH rejects them (UNPROTECTED PRIVATE KEY FILE).

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$sourceKey = Join-Path $root "config\google_key.pem"
$tempKey = Join-Path $env:TEMP "goblog_key.pem"

if (-not (Test-Path $sourceKey)) {
    Write-Error "config/google_key.pem not found. Copy server secrets into config/ first."
}

Copy-Item $sourceKey $tempKey -Force
icacls $tempKey /inheritance:r | Out-Null
icacls $tempKey /grant:r "$($env:USERNAME):R" | Out-Null

Write-Host "Tunnel: localhost:3307 -> hom2box.com:3306 (Ctrl+C to stop)"
ssh -i $tempKey -N -o ServerAliveInterval=60 -o ExitOnForwardFailure=yes -L 3307:127.0.0.1:3306 hbox78@hom2box.com
