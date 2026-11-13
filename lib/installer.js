// Builds the Windows installer scripts served at /install.ps1 and /install.cmd.
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

$zip = Join-Path $env:TEMP ('nibble-electron-' + $Ver + '-win32-x64.zip')
$ok = $false
if (Test-Path $zip) { $ok = ((Get-FileHash $zip -Algorithm SHA256).Hash -eq $Sha) }
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
[IO.Compression.ZipFile]::ExtractToDirectory($zip, $Dir)
Rename-Item (Join-Path $Dir 'electron.exe') 'Nibble.exe'
Remove-Item (Join-Path $Dir 'resources\default_app.asar') -Force -ErrorAction SilentlyContinue
try { (New-Object Net.WebClient).DownloadFile($Base + '/nibble.ico', (Join-Path $Dir 'nibble.ico')) } catch {}

# Brand the exe: without this Windows shows "Electron" + the Electron logo in the taskbar and Task Manager.
# rcedit is Electron's own resource editor (GitHub, SHA-256 verified). If anything fails, Nibble still installs.
try {
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
} catch { Say ('Could not set the app icon/name: ' + $_ + ' (Nibble still works)') 'Yellow' }

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

# Windows caches taskbar icons: nudge Explorer to refresh so the new icon shows right away
try { & ie4uinit.exe -show } catch {}

Say 'All done! Nibble is dropping onto your screen...' 'Green'
Start-Process $exe
Say 'Nibble Hub opens from the tray (double-click). Sign in there to add friends. Ctrl+Alt+N hides/shows pets.' 'Gray'
Write-Host ''
}
`;

export function buildPs1(origin) {
  const files = FILES.map(([src, dest]) => `  @('${src}', '${dest}')`).join(',\n');
  return PS1.replaceAll('__BASE__', origin).replaceAll('__VER__', ELECTRON.version).replace('__SHA__', ELECTRON.sha256).replace('__FILES__', files).replace(/\r?\n/g, '\r\n');
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
