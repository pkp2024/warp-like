$ErrorActionPreference = "Stop"

$Repo    = "pkp2024/warp-like"
$AppName = "Termpad"

function Info  { param($msg) Write-Host "[*] $msg" -ForegroundColor Cyan }
function Ok    { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Abort { param($msg) Write-Host "[!] $msg"  -ForegroundColor Red; exit 1 }

Info "Fetching latest release from GitHub..."
$Release = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest"
$Version = $Release.tag_name
$Asset   = $Release.assets | Where-Object { $_.name -like "*.exe" } | Select-Object -First 1
if (-not $Asset) { Abort "Could not find a .exe in the latest release." }

$InstallDir = "$env:LOCALAPPDATA\Termpad"
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

$ExePath = Join-Path $InstallDir "$($Asset.name)"
Info "Downloading Termpad $Version..."
Invoke-WebRequest -Uri $Asset.browser_download_url -OutFile $ExePath -UseBasicParsing

Info "Running installer..."
Start-Process -FilePath $ExePath -ArgumentList "/S" -Wait

Ok "Termpad $Version installed!"
Write-Host "  Open it from the Start menu by searching 'Termpad'"
