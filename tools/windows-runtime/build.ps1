# Runs on a GitHub Windows runner (see .github/workflows/win-runtime.yml).
$ErrorActionPreference = 'Stop'
$inst = Get-Content lib/installer.js -Raw
$ver = [regex]::Match($inst, "ELECTRON = \{ version: '([\d.]+)'").Groups[1].Value
$sha = [regex]::Match($inst, "ELECTRON = \{[^}]*sha256: '([0-9A-Fa-f]{64})'").Groups[1].Value
$app = (Get-Content public/app/package.json -Raw | ConvertFrom-Json).version
Write-Host "Electron $ver, Nibble $app"
$out = Join-Path $PWD 'dist-win'; $rt = Join-Path $out 'runtime'
New-Item -ItemType Directory -Force -Path $rt | Out-Null
$zip = Join-Path $out 'electron.zip'
Invoke-WebRequest "https://github.com/electron/electron/releases/download/v$ver/electron-v$ver-win32-x64.zip" -OutFile $zip
if ((Get-FileHash $zip -Algorithm SHA256).Hash -ne $sha.ToUpper()) { throw 'Electron checksum mismatch' }
Expand-Archive $zip -DestinationPath $rt
Remove-Item (Join-Path $rt 'resources\default_app.asar') -Force -ErrorAction SilentlyContinue
Copy-Item public/nibble.ico (Join-Path $rt 'nibble.ico')

# brand: the same brand.js the app and installers use (resedit)
$el = Join-Path $rt 'electron.exe'; $exe = Join-Path $rt 'Nibble.exe'
node public/app/brand.js $el $exe (Join-Path $rt 'nibble.ico') $app
if ($LASTEXITCODE -ne 0) { throw 'brand.js failed' }
Remove-Item $el -Force

# check 1: name
$vi = (Get-Item $exe).VersionInfo
Write-Host "FileDescription=$($vi.FileDescription) ProductName=$($vi.ProductName) OriginalFilename=$($vi.OriginalFilename)"
if ($vi.FileDescription -ne 'Nibble' -or $vi.ProductName -ne 'Nibble') { throw 'exe name not branded' }

# check 2: icon (saved as a picture next to the release so it can be eyeballed)
Add-Type -AssemblyName System.Drawing
$icon = [System.Drawing.Icon]::ExtractAssociatedIcon($exe)
$bmp = $icon.ToBitmap(); $bmp.Save((Join-Path $out 'icon-check.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$px = $bmp.GetPixel([int]($bmp.Width / 2), [int]($bmp.Height / 2)); Write-Host "icon centre pixel: $px"

# check 3: the branded exe really starts an Electron app
$test = Join-Path $rt 'resources\app'
New-Item -ItemType Directory -Force -Path $test | Out-Null
Set-Content (Join-Path $test 'package.json') '{"name":"nibble-smoke","main":"main.js"}'
Set-Content (Join-Path $test 'main.js') "const { app } = require('electron'); app.whenReady().then(() => { require('fs').writeFileSync(process.env.NIBBLE_SMOKE, 'ok ' + process.versions.electron); app.quit(); });"
$env:NIBBLE_SMOKE = Join-Path $out 'smoke.txt'
$p = Start-Process -FilePath $exe -PassThru
if (-not $p.WaitForExit(60000)) { $p.Kill(); throw 'Nibble.exe did not finish starting' }
if (-not (Test-Path $env:NIBBLE_SMOKE)) { throw 'Nibble.exe did not start the app' }
Write-Host "smoke: $(Get-Content $env:NIBBLE_SMOKE)"
Remove-Item $test -Recurse -Force

# package
$final = Join-Path $out 'nibble-runtime-win32-x64.zip'
Compress-Archive -Path (Join-Path $rt '*') -DestinationPath $final -CompressionLevel Optimal
(Get-FileHash $final -Algorithm SHA256).Hash | Set-Content (Join-Path $out 'nibble-runtime-win32-x64.zip.sha256') -NoNewline
Set-Content (Join-Path $out 'electron-version.txt') $ver -NoNewline
Write-Host "zip: $((Get-Item $final).Length) bytes, sha256 $(Get-Content (Join-Path $out 'nibble-runtime-win32-x64.zip.sha256'))"
