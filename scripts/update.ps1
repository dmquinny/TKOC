<#
.SYNOPSIS
  Update the live game from this Windows machine with one command.

.DESCRIPTION
  The application bundle on W:\tkoc-modern is the same folder the Docker host
  sees, so there is nothing to copy. This script runs the local type and lint
  checks, then connects to the host over SSH and runs scripts/update.sh,
  which rebuilds the image, applies any pending migration with a backup, and
  restarts the game with automatic rollback if it does not become healthy.

  The SSH target comes from, in order: -Target, the TKOC_SSH_TARGET
  environment variable, or deploy.config.json next to package.json (copy
  deploy.config.example.json to create it).

.EXAMPLE
  npm run update
  npm run update -- -Full
  npm run update -- -SkipChecks
#>
[CmdletBinding()]
param(
  [switch]$Full,
  [switch]$SkipChecks,
  [switch]$SkipBuild,
  [switch]$NoPrune,
  [string]$Target,
  [string]$RemoteDir
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$config = $null
$configPath = Join-Path $root 'deploy.config.json'
if (Test-Path $configPath) {
  $config = Get-Content $configPath -Raw | ConvertFrom-Json
}

if (-not $Target) { $Target = $env:TKOC_SSH_TARGET }
if (-not $Target -and $config -and $config.sshTarget) { $Target = $config.sshTarget }
if (-not $RemoteDir) { $RemoteDir = $env:TKOC_REMOTE_DIR }
if (-not $RemoteDir -and $config -and $config.remoteDir) { $RemoteDir = $config.remoteDir }
if (-not $RemoteDir) { $RemoteDir = '/mnt/Apps/Apps/tkoc-modern' }

if (-not $Target) {
  Write-Host 'No SSH target configured.' -ForegroundColor Red
  Write-Host 'Copy deploy.config.example.json to deploy.config.json and set "sshTarget" (for example root@192.168.1.2),'
  Write-Host 'or pass -Target user@host, or set TKOC_SSH_TARGET.'
  exit 2
}

if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
  Write-Host 'ssh was not found. Install the Windows OpenSSH client (Settings > Apps > Optional features).' -ForegroundColor Red
  exit 2
}

if (-not $SkipChecks) {
  Write-Host '==> Running local checks (tsc + eslint + unit tests)' -ForegroundColor Cyan
  & npm run check
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'Local checks failed. Fix them before updating the server, or pass -SkipChecks.' -ForegroundColor Red
    exit 1
  }
  & npm run test:unit
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'Unit tests failed. Fix them before updating the server, or pass -SkipChecks.' -ForegroundColor Red
    exit 1
  }
}

$flags = @()
if ($Full) { $flags += '--full' }
if ($SkipBuild) { $flags += '--skip-build' }
if ($NoPrune) { $flags += '--no-prune' }
$remoteCommand = "cd '$RemoteDir' && sh scripts/update.sh $($flags -join ' ')"

Write-Host "==> Updating $Target ($RemoteDir)" -ForegroundColor Cyan
& ssh -t $Target $remoteCommand
$exit = $LASTEXITCODE
if ($exit -eq 0) {
  Write-Host '==> Update finished.' -ForegroundColor Green
} else {
  Write-Host "==> Update failed (exit $exit). Run 'npm run status:server' over SSH or 'sh scripts/rollback.sh' on the host." -ForegroundColor Red
}
exit $exit
