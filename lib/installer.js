// Builds the Windows installer scripts served at /install.ps1 and /install.cmd.
import APP from '../public/app/package.json';
export const ELECTRON = { version: '45.2.3', sha256: '489CD061908E697394B004298BF5FFD345C935D10E8CA197BA819F019AB2DEC0' };

export const FILES = [
  ['/app/package.json', 'package.json'],
  ['/app/src/main.js', 'src/main.js'],
  ['/app/src/preload.js', 'src/preload.js'],
  ['/app/src/settings.js', 'src/settings.js'],
  ['/app/src/hub.js', 'src/hub.js'],
  ['/app/src/hubPreload.js', 'src/hubPreload.js'],
  ['/app/src/offline.html', 'src/offline.html'],
  ['/app/src/windowWatcher.js', 'src/windowWatcher.js'],
  ['/app/src/nowPlaying.js', 'src/nowPlaying.js'],
  ['/app/src/helper/WinWatch.cs', 'src/helper/WinWatch.cs'],
  ['/app/src/renderer/index.html', 'src/renderer/index.html'],
  ['/app/src/renderer/app.js', 'src/renderer/app.js'],
  ['/nibble/engine/skins.js', 'src/skins.js'],
  ['/nibble/engine/lines.js', 'src/renderer/lines.js'],
  ['/nibble/engine/wardrobe.js', 'src/renderer/wardrobe.js'],
  ['/nibble/engine/draw.js', 'src/renderer/draw.js'],
  ['/nibble/engine/pet.js', 'src/renderer/pet.js'],
  ['/nibble/engine/social-draw.js', 'src/renderer/social-draw.js'],
];

const PS1 = String.raw`# Nibble installer - __BASE__
# Installs to %LOCALAPPDATA%\Programs\Nibble. Runtime: Electron __VER__ from GitHub, SHA-256 verified.
& {
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch {}
$Base = '__BASE__'
$Ver = '__VER__'
$Sha = '__SHA__'
$Dir = Join-Path $env:LOCALAPPDATA 'Programs\Nibble'
$Files = @(
__FILES__
)
function Say($m, $c = 'Cyan') { Write-Host "  $m" -ForegroundColor $c }

Write-Host ''
Write-Host '    /\_/\    Nibble installer' -ForegroundColor Green
Write-Host '   ( o.o )   a desktop pet that lives on your windows' -ForegroundColor Green
Write-Host '    > ^ <' -ForegroundColor Green
Write-Host ''
if (-not [Environment]::Is64BitOperatingSystem) { throw 'Nibble needs 64-bit Windows 10 or 11.' }

Get-Process -Name Nibble -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

# 1st choice: the ready-made runtime, Nibble.exe already branded (built + checked on a Windows runner)
$Pre = 'https://github.com/UvinduBro/nibble/releases/download/win-runtime/nibble-runtime-win32-x64.zip'
$preZip = Join-Path $env:TEMP 'nibble-runtime-win32-x64.zip'
$usePre = $false
try {
  $want = ((New-Object Net.WebClient).DownloadString($Pre + '.sha256')).Trim()
  if ($want.Length -eq 64) {
    if (-not ((Test-Path $preZip) -and ((Get-FileHash $preZip -Algorithm SHA256).Hash -eq $want))) {
      Say 'Downloading Nibble (~110 MB)... grab a coffee'
      (New-Object Net.WebClient).DownloadFile($Pre, $preZip)
    }
    $usePre = ((Get-FileHash $preZip -Algorithm SHA256).Hash -eq $want)
  }
} catch { $usePre = $false }
$zip = Join-Path $env:TEMP ('nibble-electron-' + $Ver + '-win32-x64.zip')
$ok = $usePre
if (-not $usePre -and (Test-Path $zip)) { $ok = ((Get-FileHash $zip -Algorithm SHA256).Hash -eq $Sha) }
if (-not $ok) {
  Say ('Downloading runtime (Electron ' + $Ver + ', ~110 MB) from GitHub... grab a coffee')
  $url = 'https://github.com/electron/electron/releases/download/v' + $Ver + '/electron-v' + $Ver + '-win32-x64.zip'
  (New-Object Net.WebClient).DownloadFile($url, $zip)
  $h = (Get-FileHash $zip -Algorithm SHA256).Hash
  if ($h -ne $Sha) { Remove-Item $zip -Force; throw ('Runtime checksum mismatch (' + $h + '). Nothing was installed.') }
}
Say 'Runtime verified (SHA-256 OK)' 'Green'

for ($i = 0; (Test-Path $Dir) -and $i -lt 10; $i++) {
  try { Remove-Item $Dir -Recurse -Force } catch { Start-Sleep -Milliseconds 700 }
}
New-Item -ItemType Directory -Force -Path $Dir | Out-Null
Say 'Unpacking...'
Add-Type -AssemblyName System.IO.Compression.FileSystem
if ($usePre) { [IO.Compression.ZipFile]::ExtractToDirectory($preZip, $Dir) } else { [IO.Compression.ZipFile]::ExtractToDirectory($zip, $Dir) }
Remove-Item (Join-Path $Dir 'resources\default_app.asar') -Force -ErrorAction SilentlyContinue
try { (New-Object Net.WebClient).DownloadFile($Base + '/nibble.ico', (Join-Path $Dir 'nibble.ico')) } catch {}

# Brand the exe: without this Windows shows "Electron" + the Electron logo in the taskbar and Task Manager.
# The runtime brands itself: it runs brand.js (resedit, the same library Electron's own packager uses)
# to write Nibble.exe with Nibble's name, version text and icon. Nothing else is downloaded.
$el = Join-Path $Dir 'electron.exe'
$exeOut = Join-Path $Dir 'Nibble.exe'
$branded = $usePre -and (Test-Path $exeOut)
if ($branded) { Say 'Nibble.exe has its name and icon (ready-made runtime)' 'Green' }
if (-not $branded) { try {
  $bj = Join-Path $Dir 'brand.js'
  (New-Object Net.WebClient).DownloadFile($Base + '/app/brand.js', $bj)
  $q = { param($x) '"' + $x + '"' }
  $env:ELECTRON_RUN_AS_NODE = '1'
  $p = Start-Process -FilePath $el -ArgumentList @((& $q $bj), (& $q $el), (& $q $exeOut), (& $q (Join-Path $Dir 'nibble.ico')), '__APPVER__') -Wait -PassThru -WindowStyle Hidden
  Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
  if ($p.ExitCode -eq 0 -and (Test-Path $exeOut) -and ((Get-Item $exeOut).VersionInfo.FileDescription -eq 'Nibble')) {
    $branded = $true
    Remove-Item $el -Force -ErrorAction SilentlyContinue
    Remove-Item $bj -Force -ErrorAction SilentlyContinue
    Say 'Nibble.exe branded (name + icon)' 'Green'
  }
} catch { Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue } }
if (-not $branded) {
  if (Test-Path $exeOut) { Remove-Item $exeOut -Force -ErrorAction SilentlyContinue }
  Rename-Item $el 'Nibble.exe'
}

# Fallback: rcedit (Electron's resource editor from GitHub, SHA-256 verified). If anything fails, Nibble still installs.
if (-not $branded) { try {
  $rc = Join-Path $env:TEMP 'nibble-rcedit-2.0.0.exe'
  $rcSha = '3E7801DB1A5EDBEC91B49A24A094AAD776CB4515488EA5A4CA2289C400EADE2A'
  if (-not ((Test-Path $rc) -and ((Get-FileHash $rc -Algorithm SHA256).Hash -eq $rcSha))) {
    (New-Object Net.WebClient).DownloadFile('https://github.com/electron/rcedit/releases/download/v2.0.0/rcedit-x64.exe', $rc)
  }
  if ((Get-FileHash $rc -Algorithm SHA256).Hash -ne $rcSha) { Remove-Item $rc -Force; throw 'rcedit checksum mismatch' }
  $rcArgs = @((Join-Path $Dir 'Nibble.exe'),
    '--set-version-string', 'FileDescription', 'Nibble',
    '--set-version-string', 'ProductName', 'Nibble',
    '--set-version-string', 'CompanyName', 'Nibble',
    '--set-version-string', 'InternalName', 'Nibble',
    '--set-version-string', 'OriginalFilename', 'Nibble.exe',
    '--set-version-string', 'LegalCopyright', 'Nibble by Uvindu Rajapakshe')
  $icoFile = Join-Path $Dir 'nibble.ico'
  if (Test-Path $icoFile) { $rcArgs += @('--set-icon', $icoFile) }
  & $rc @rcArgs
  if ($LASTEXITCODE -ne 0) { throw ('rcedit exit ' + $LASTEXITCODE) }
  Say 'Nibble.exe branded (name + icon)' 'Green'
} catch { Say ('Could not set the app icon/name: ' + $_ + ' (Nibble still works)') 'Yellow' } }

# Windows remembers an exe's old name ("Electron") per file path; forget it so the new name shows
try {
  $mui = 'HKCU:\Software\Classes\Local Settings\Software\Microsoft\Windows\Shell\MuiCache'
  if (Test-Path $mui) { foreach ($n in (Get-Item $mui).Property) { if ($n -like '*Programs\Nibble\*') { Remove-ItemProperty $mui -Name $n -ErrorAction SilentlyContinue } } }
} catch {}

Say 'Fetching Nibble...'
$App = Join-Path $Dir 'resources\app'
$wc = New-Object Net.WebClient
foreach ($f in $Files) {
  $dest = Join-Path $App ($f[1] -replace '/', '\')
  New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
  $wc.DownloadFile($Base + $f[0], $dest)
}

$un = @'
$ErrorActionPreference = 'SilentlyContinue'
$Dir = Join-Path $env:LOCALAPPDATA 'Programs\Nibble'
Get-Process -Name Nibble | Stop-Process -Force
Start-Sleep -Milliseconds 800
$run = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
foreach ($n in (Get-Item $run).Property) { if ([string](Get-ItemProperty $run).$n -like '*Programs\Nibble*') { Remove-ItemProperty $run -Name $n } }
Remove-Item (Join-Path ([Environment]::GetFolderPath('Programs')) 'Nibble') -Recurse -Force
Remove-Item (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Nibble.lnk') -Force
Remove-Item (Join-Path $env:APPDATA 'Nibble') -Recurse -Force
Set-Location $env:TEMP
Remove-Item $Dir -Recurse -Force
Write-Host ''
Write-Host '  Nibble has been removed. Bye!  (o.o)/' -ForegroundColor Green
Start-Sleep 3
'@
Set-Content -Path (Join-Path $Dir 'uninstall.ps1') -Value $un -Encoding ASCII

$ws = New-Object -ComObject WScript.Shell
function Link($path, $target, $arguments, $icon, $desc) {
  $s = $ws.CreateShortcut($path)
  $s.TargetPath = $target
  if ($arguments) { $s.Arguments = $arguments }
  $s.WorkingDirectory = $Dir
  if ($icon) { $s.IconLocation = $icon }
  $s.Description = $desc
  $s.Save()
}
$exe = Join-Path $Dir 'Nibble.exe'
$ico = Join-Path $Dir 'nibble.ico'
if (-not (Test-Path $ico)) { $ico = $exe + ',0' }
$menu = Join-Path ([Environment]::GetFolderPath('Programs')) 'Nibble'
New-Item -ItemType Directory -Force -Path $menu | Out-Null
Link (Join-Path $menu 'Nibble.lnk') $exe $null $ico 'Nibble - desktop pet'
Link (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Nibble.lnk') $exe $null $ico 'Nibble - desktop pet'
Link (Join-Path $menu 'Uninstall Nibble.lnk') 'powershell.exe' ('-NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $Dir 'uninstall.ps1') + '"') $null 'Remove Nibble'

# a Nibble pinned to the taskbar from an older install keeps the old icon: point it at Nibble's
try {
  $pins = Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar'
  if (Test-Path $pins) { Get-ChildItem $pins -Filter *.lnk | ForEach-Object { $l = $ws.CreateShortcut($_.FullName); if ($l.TargetPath -like '*Programs\Nibble\Nibble.exe') { $l.IconLocation = $ico; $l.Save() } } }
} catch {}
# Windows caches taskbar icons: nudge Explorer to refresh so the new icon shows right away
try { & ie4uinit.exe -show } catch {}

Say 'All done! Nibble is dropping onto your screen...' 'Green'
Start-Process $exe
Say 'Nibble Hub opens from the tray (double-click). Sign in there to add friends. Ctrl+Alt+N hides/shows pets.' 'Gray'
Write-Host ''
}
`;

// The live file list for the native Windows setup (Get-Nibble.exe) and the app's own self-repair,
// so a new app file can never be left out of an install again.
export function buildFileList() {
  return ['version ' + APP.version, ...FILES.map(([src, dest]) => src + ' ' + dest)].join('\n') + '\n';
}

// ---------- macOS: one line in Terminal ----------
// Uses Electron's official (Apple-signed) build, renames it Nibble.app with Nibble's icon, adds the app,
// then re-signs it for this Mac with Apple's own codesign. Downloaded with curl, so no quarantine prompt.
export const ELECTRON_MAC = {
  arm64: '4d7c429064087a47b855d9bd06c76ead4819b7f02b385de232d4a5c37ecef55f',
  x64: 'd87323533cc8750ef177e5b48058f7a8b381f677d4e103cc63360006c08829c2',
};
const SH = String.raw`#!/bin/bash
# Nibble installer for macOS - __BASE__
# Installs Nibble.app to /Applications (or ~/Applications). Runtime: Electron __VER__ from GitHub, SHA-256 verified.
set -e
VER="__VER__"; APPVER="__APPVER__"; BASE="__BASE__"
say() { printf '  \033[36m%s\033[0m\n' "$1"; }
good() { printf '  \033[32m%s\033[0m\n' "$1"; }
fail() { printf '  \033[31m%s\033[0m\n' "$1"; exit 1; }
printf '\n\033[32m    /\\_/\\    Nibble installer\n   ( o.o )   a desktop pet for your Mac\n    > ^ <\033[0m\n\n'
case "$(uname -m)" in
  arm64) ARCH=arm64; SHA="__SHA_ARM__" ;;
  x86_64) ARCH=x64; SHA="__SHA_X64__" ;;
  *) fail "Sorry, this Mac isn't supported." ;;
esac
MAJOR="$(sw_vers -productVersion | cut -d. -f1)"
[ "$MAJOR" -ge 12 ] 2>/dev/null || fail "Nibble needs macOS 12 Monterey or newer."
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mkdir -p "$HOME/Library/Caches"
ZIP="$HOME/Library/Caches/nibble-electron-$VER-darwin-$ARCH.zip"
if [ ! -f "$ZIP" ] || [ "$(shasum -a 256 "$ZIP" | cut -d' ' -f1)" != "$SHA" ]; then
  say "Downloading runtime (Electron $VER, ~110 MB) from GitHub... grab a coffee"
  curl -fL --progress-bar -o "$ZIP" "https://github.com/electron/electron/releases/download/v$VER/electron-v$VER-darwin-$ARCH.zip"
  [ "$(shasum -a 256 "$ZIP" | cut -d' ' -f1)" = "$SHA" ] || { rm -f "$ZIP"; fail "Runtime checksum mismatch. Nothing was installed."; }
fi
good "Runtime verified (SHA-256 OK)"
pkill -x Nibble 2>/dev/null || true
sleep 1
DEST="/Applications"; [ -w "$DEST" ] || DEST="$HOME/Applications"
mkdir -p "$DEST"
APP="$DEST/Nibble.app"
say "Unpacking..."
ditto -x -k "$ZIP" "$TMP/x"
rm -rf "$APP"
mv "$TMP/x/Electron.app" "$APP"
C="$APP/Contents"
mv "$C/MacOS/Electron" "$C/MacOS/Nibble"
P="$C/Info.plist"
plutil -replace CFBundleExecutable -string Nibble "$P"
plutil -replace CFBundleName -string Nibble "$P"
plutil -replace CFBundleDisplayName -string Nibble "$P"
plutil -replace CFBundleIdentifier -string lk.uvi.nibble "$P"
plutil -replace CFBundleShortVersionString -string "$APPVER" "$P"
plutil -replace CFBundleVersion -string "$APPVER" "$P"
rm -f "$C/Resources/default_app.asar"
curl -fsSL -o "$C/Resources/electron.icns" "$BASE/nibble.icns" || true
say "Fetching Nibble $APPVER..."
A="$C/Resources/app"
while read -r SRC DST; do
  [ -z "$SRC" ] && continue
  mkdir -p "$(dirname "$A/$DST")"
  curl -fsSL -o "$A/$DST" "$BASE$SRC"
done <<'LIST'
__FILES__
LIST
say "Signing Nibble for this Mac..."
xattr -cr "$APP" 2>/dev/null || true
codesign --force --deep --sign - "$APP" >/dev/null 2>&1 || say "(couldn't sign it; it should still open)"
touch "$APP"
good "All done! Nibble is dropping onto your screen..."
open "$APP"
printf '  \033[90mNibble lives in your menu bar (top right). Click it, then "Open Nibble Hub" to sign in and add friends.\033[0m\n\n'
`;

export function buildSh(origin) {
  const files = FILES.map(([src, dest]) => src + ' ' + dest).join('\n');
  return SH.replaceAll('__APPVER__', APP.version).replaceAll('__BASE__', origin).replaceAll('__VER__', ELECTRON.version)
    .replace('__SHA_ARM__', ELECTRON_MAC.arm64).replace('__SHA_X64__', ELECTRON_MAC.x64).replace('__FILES__', files);
}

export function buildPs1(origin) {
  const files = FILES.map(([src, dest]) => `  @('${src}', '${dest}')`).join(',\n');
  return PS1.replaceAll('__APPVER__', APP.version).replaceAll('__BASE__', origin).replaceAll('__VER__', ELECTRON.version).replace('__SHA__', ELECTRON.sha256).replace('__FILES__', files).replace(/\r?\n/g, '\r\n');
}

export function buildCmd(origin) {
  return [
    '@echo off',
    'title Nibble installer',
    'echo.',
    'echo   Installing Nibble - a desktop pet that lives on your windows...',
    'echo.',
    `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; iex ((New-Object Net.WebClient).DownloadString('${origin}/install.ps1'))"`,
    'echo.',
    'pause',
    '',
  ].join('\r\n');
}
