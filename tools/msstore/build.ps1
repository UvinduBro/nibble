# Builds Nibble.msix for the Microsoft Store (runs on a GitHub Windows runner, see .github/workflows/msstore.yml).
# Uses the branded runtime from tools/windows-runtime/build.ps1 (run it first), adds the app files and
# store.json (switches off Nibble's own updater), then packs with the Windows SDK (makepri + makeappx).
# The package is unsigned on purpose: the Microsoft Store signs it when you submit it.
$ErrorActionPreference = 'Stop'
$id = if ($env:MSSTORE_IDENTITY_NAME) { $env:MSSTORE_IDENTITY_NAME } else { 'Nibble.DesktopPet' }
$pub = if ($env:MSSTORE_PUBLISHER) { $env:MSSTORE_PUBLISHER } else { 'CN=Nibble' }
$pubName = if ($env:MSSTORE_PUBLISHER_NAME) { $env:MSSTORE_PUBLISHER_NAME } else { 'Uvindu Rajapakshe' }
$app = (Get-Content public/app/package.json -Raw | ConvertFrom-Json).version
$ver = "$app.0"  # the Store wants 4 numbers and the last one 0
Write-Host "Nibble $ver as $id ($pub)"

$out = Join-Path $PWD 'dist-win'
$rt = Join-Path $out 'runtime'
if (-not (Test-Path (Join-Path $rt 'Nibble.exe'))) { throw 'run tools/windows-runtime/build.ps1 first' }
$layout = Join-Path $out 'msix'
if (Test-Path $layout) { Remove-Item $layout -Recurse -Force }
Copy-Item $rt $layout -Recurse

# app files (the same list the installers use)
$inst = Get-Content lib/installer.js -Raw
$files = [regex]::Matches($inst, "\['(/[^']+)', '([^']+)'\]")
if ($files.Count -lt 10) { throw 'file list not found in lib/installer.js' }
$appDir = Join-Path $layout 'resources\app'
foreach ($m in $files) {
  $src = Join-Path 'public' ($m.Groups[1].Value.TrimStart('/'))
  $dst = Join-Path $appDir $m.Groups[2].Value
  New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
  Copy-Item $src $dst
}
Set-Content (Join-Path $appDir 'store.json') '{"store":"msstore"}' -NoNewline -Encoding ascii

# icons + manifest
Copy-Item tools/msstore/assets (Join-Path $layout 'assets') -Recurse
$xml = (Get-Content tools/msstore/AppxManifest.xml -Raw).
  Replace('__IDENTITY_NAME__', [Security.SecurityElement]::Escape($id)).
  Replace('__PUBLISHER__', [Security.SecurityElement]::Escape($pub)).
  Replace('__PUBLISHER_NAME__', [Security.SecurityElement]::Escape($pubName)).
  Replace('__VERSION__', $ver)
Set-Content (Join-Path $layout 'AppxManifest.xml') $xml -Encoding utf8

# Windows SDK tools
$kit = Get-ChildItem 'C:\Program Files (x86)\Windows Kits\10\bin' -Directory | Where-Object { $_.Name -match '^10\.' } | Sort-Object Name -Descending | Select-Object -First 1
$bin = Join-Path $kit.FullName 'x64'
$makepri = Join-Path $bin 'makepri.exe'; $makeappx = Join-Path $bin 'makeappx.exe'
Write-Host "Windows SDK: $bin"

# resources.pri: lets Windows pick the right icon size (scale-200, targetsize-24…)
Push-Location $layout
& $makepri createconfig /cf priconfig.xml /dq en-US /pv 10.0.0 /o | Out-Host
& $makepri new /pr . /cf priconfig.xml /of resources.pri /o | Out-Host
if ($LASTEXITCODE -ne 0) { throw 'makepri failed' }
Remove-Item priconfig.xml
Pop-Location

$msix = Join-Path $out 'Nibble.msix'
& $makeappx pack /d $layout /p $msix /o | Out-Host
if ($LASTEXITCODE -ne 0) { throw 'makeappx failed' }
Copy-Item $msix (Join-Path $out "Nibble-$app.msix")

# check: the package opens and has what the Store needs
& $makeappx unpack /p $msix /d (Join-Path $out 'msix-check') /o | Out-Null
if (-not (Test-Path (Join-Path $out 'msix-check\resources\app\store.json'))) { throw 'store.json missing from the package' }
Write-Host "msix: $((Get-Item $msix).Length) bytes"
Set-Content (Join-Path $out 'msix-info.txt') "Nibble $ver`nIdentity: $id`nPublisher: $pub`nPublisher name: $pubName" -NoNewline
