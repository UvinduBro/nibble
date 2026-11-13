// "Now playing": reads the song from the Windows media controls (the same info as the volume
// flyout: Spotify, YouTube in a browser, Apple Music, Media Player…) via a tiny PowerShell loop.
// Only runs while the user has "Share what I'm playing" switched on. Emits 'np' with
// { title, artist, app, playing } or null.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');

const PS = String.raw`$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation` + '`' + String.raw`1' })[0]
  function Await($op, [Type]$t) { $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op)); $null = $task.Wait(5000); $task.Result }
  $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
  $mgrT = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]
  $propT = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]
  $mgr = Await ($mgrT::RequestAsync()) $mgrT
} catch { [Console]::Out.WriteLine('{"err":"unsupported"}'); exit 3 }
$last = ''
while ($true) {
  $out = '{}'
  try {
    $best = $null
    foreach ($s in $mgr.GetSessions()) {
      $app = [string]$s.SourceAppUserModelId
      if ($app -match 'nibble|electron|lk\.uvi') { continue }
      if ([string]$s.GetPlaybackInfo().PlaybackStatus -eq 'Playing') { $best = $s; break }
      if (-not $best) { $best = $s }
    }
    if ($best) {
      $p = Await ($best.TryGetMediaPropertiesAsync()) $propT
      $o = [ordered]@{ title = [string]$p.Title; artist = [string]$p.Artist; app = [string]$best.SourceAppUserModelId; playing = ([string]$best.GetPlaybackInfo().PlaybackStatus -eq 'Playing') }
      $out = ConvertTo-Json $o -Compress
    }
  } catch { $out = '{}' }
  if ($out -ne $last) { [Console]::Out.WriteLine($out); [Console]::Out.Flush(); $last = $out }
  Start-Sleep -Seconds 3
}
`;

// friendly names for the apps Windows reports
function appName(id) {
  const s = String(id || '');
  if (/spotify/i.test(s)) return 'Spotify';
  if (/applemusic|itunes/i.test(s)) return 'Apple Music';
  if (/msedge/i.test(s)) return 'Edge';
  if (/chrome/i.test(s)) return 'Chrome';
  if (/firefox|308046B0AF4A39CB/i.test(s)) return 'Firefox';
  if (/brave/i.test(s)) return 'Brave';
  if (/opera/i.test(s)) return 'Opera';
  if (/zunemusic|zune|mediaplayer/i.test(s)) return 'Media Player';
  if (/vlc/i.test(s)) return 'VLC';
  if (/youtube/i.test(s)) return 'YouTube';
  if (/deezer/i.test(s)) return 'Deezer';
  if (/tidal/i.test(s)) return 'TIDAL';
  if (/amazon/i.test(s)) return 'Amazon Music';
  return '';
}

class NowPlaying extends EventEmitter {
  constructor() { super(); this.proc = null; this.want = false; this.buf = ''; this.fails = 0; this.timer = null; }

  start() {
    this.want = true;
    if (this.proc || process.platform !== 'win32') return;
    const dir = path.join(os.tmpdir(), 'nibble-pet');
    try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'nowplaying.ps1'), PS, 'utf8'); } catch { return; }
    const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(dir, 'nowplaying.ps1')], { windowsHide: true });
    this.proc = p;
    this.buf = '';
    p.stdout.setEncoding('utf8');
    p.stdout.on('data', (d) => {
      this.buf += d;
      let i;
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i).trim();
        this.buf = this.buf.slice(i + 1);
        if (!line) continue;
        try {
          const o = JSON.parse(line);
          if (o.err) { this.emit('status', o.err); continue; }
          this.fails = 0;
          this.emit('np', o.title ? { title: o.title, artist: o.artist || '', app: appName(o.app), playing: !!o.playing } : null);
        } catch {}
      }
    });
    p.on('error', () => {});
    p.on('exit', (code) => {
      this.proc = null;
      this.emit('np', null);
      if (!this.want || code === 3) return; // turned off, or this Windows has no media controls API
      this.fails++;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => { if (this.want) this.start(); }, Math.min(60_000, 3000 * this.fails));
    });
  }

  stop() {
    this.want = false;
    clearTimeout(this.timer);
    if (this.proc) { try { this.proc.kill(); } catch {} this.proc = null; }
    this.emit('np', null);
  }
}

module.exports = { NowPlaying, appName };
