// Spawns the PowerShell + C# helper and turns its output into window rectangles (in DIPs).
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');

class WindowWatcher extends EventEmitter {
  constructor({ intervalMs = 60 } = {}) {
    super();
    this.intervalMs = intervalMs;
    this.proc = null;
    this.stopped = false;
    this.restarts = 0;
    this.buf = '';
  }

  start() {
    if (process.platform === 'darwin') return this.startMac();
    if (process.platform !== 'win32') {
      this.emit('status', { ok: false, reason: 'not-windows' });
      return;
    }
    this.stopped = false;
    const csSrc = fs.readFileSync(path.join(__dirname, 'helper', 'WinWatch.cs'), 'utf8');
    const dir = path.join(os.tmpdir(), 'nibble-pet');
    fs.mkdirSync(dir, { recursive: true });
    const csPath = path.join(dir, 'WinWatch.cs');
    const psPath = path.join(dir, 'watch.ps1');
    fs.writeFileSync(csPath, csSrc, 'utf8');
    fs.writeFileSync(
      psPath,
      [
        "$ErrorActionPreference = 'Stop'",
        `$src = Get-Content -Raw -Encoding UTF8 -LiteralPath '${csPath.replace(/'/g, "''")}'`,
        'Add-Type -TypeDefinition $src -Language CSharp',
        `[NibbleWatch]::Run(${process.pid}, ${this.intervalMs})`,
      ].join('\r\n'),
      'utf8'
    );

    this.proc = spawn(
      'powershell.exe',
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', psPath],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
    );

    this.proc.stdout.setEncoding('utf8');
    this.proc.stdout.on('data', (chunk) => {
      this.buf += chunk;
      let i;
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i).trim();
        this.buf = this.buf.slice(i + 1);
        if (!line.startsWith('{')) continue;
        try {
          const data = JSON.parse(line);
          this.restarts = 0;
          this.emit('data', data);
        } catch (_) { /* partial / bad line */ }
      }
    });
    let errText = '';
    this.proc.stderr.setEncoding('utf8');
    this.proc.stderr.on('data', (d) => { errText += d; });
    this.proc.on('exit', (code) => {
      this.proc = null;
      if (this.stopped) return;
      this.emit('status', { ok: false, reason: 'helper-exit', code, err: errText.slice(0, 500) });
      if (this.restarts++ < 5) setTimeout(() => this.start(), 1500 * this.restarts);
    });
    this.emit('status', { ok: true });
  }

  // Mac: a small JavaScript-for-Automation loop (osascript, ships with macOS) reads the on-screen
  // windows from CoreGraphics. Window positions + owner names need no permission (no Screen Recording
  // or Accessibility prompt); titles are only there if the user already granted Screen Recording.
  startMac() {
    this.stopped = false;
    const dir = path.join(os.tmpdir(), 'nibble-pet');
    fs.mkdirSync(dir, { recursive: true });
    const jsPath = path.join(dir, 'watch-mac.js');
    fs.writeFileSync(jsPath, MAC_JXA.replace('__PID__', String(process.pid)).replace('__MS__', String(Math.max(80, this.intervalMs * 2))), 'utf8');
    this.proc = spawn('/usr/bin/osascript', ['-l', 'JavaScript', jsPath], { stdio: ['ignore', 'pipe', 'pipe'] });
    this.attach();
  }

  attach() {
    this.buf = '';
    this.proc.stdout.setEncoding('utf8');
    this.proc.stdout.on('data', (chunk) => {
      this.buf += chunk;
      let i;
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i).trim();
        this.buf = this.buf.slice(i + 1);
        if (!line.startsWith('{')) continue;
        try { const data = JSON.parse(line); this.restarts = 0; this.emit('data', data); } catch (_) {}
      }
    });
    let errText = '';
    this.proc.stderr.setEncoding('utf8');
    this.proc.stderr.on('data', (d) => { errText = (errText + d).slice(-2000); });
    this.proc.on('error', () => {});
    this.proc.on('exit', (code) => {
      this.proc = null;
      if (this.stopped) return;
      this.emit('status', { ok: false, reason: 'helper-exit', code, err: errText.slice(0, 500) });
      if (this.restarts++ < 5) setTimeout(() => { if (!this.stopped) this.start(); }, 1500 * this.restarts);
    });
    this.emit('status', { ok: true });
  }

  stop() {
    this.stopped = true;
    if (this.proc) {
      try { this.proc.kill(); } catch (_) {}
      this.proc = null;
    }
  }
}

// One JSON line per change: { wins: [{ id, x, y, w, h }] (front to back), fg: { id, proc, title, cls, x, y, w, h },
// dock: { x, y, w, h } | null }. Coordinates are global points, like Electron's screen API.
const MAC_JXA = String.raw`ObjC.import('CoreGraphics');
ObjC.import('AppKit');
var OWN = __PID__, MS = __MS__;
var out = $.NSFileHandle.fileHandleWithStandardOutput;
var ws = $.NSWorkspace.sharedWorkspace;
function emit(s) { out.writeData($(s + '\n').dataUsingEncoding($.NSUTF8StringEncoding)); }
function alive() { var a = $.NSRunningApplication.runningApplicationWithProcessIdentifier(OWN); return !!a && !a.isNil(); }
// The Dock's icon bar, estimated from its settings (its window is not reported with a useful size)
function dockEstimate() {
  try {
    var d = $.NSUserDefaults.alloc.initWithSuiteName('com.apple.dock');
    var tile = d.doubleForKey('tilesize') || 48;
    var pa = ObjC.deepUnwrap(d.arrayForKey('persistent-apps')) || [];
    var po = ObjC.deepUnwrap(d.arrayForKey('persistent-others')) || [];
    var ids = {};
    pa.forEach(function (t) { var b = t && t['tile-data'] && t['tile-data']['bundle-identifier']; if (b) ids[b] = 1; });
    var extra = 0, ra = ws.runningApplications;
    for (var i = 0; i < ra.count; i++) {
      var a = ra.objectAtIndex(i);
      if (a.activationPolicy !== 0) continue;
      var bid = ObjC.unwrap(a.bundleIdentifier) || '';
      if (bid !== 'com.apple.finder' && !ids[bid]) extra++;
    }
    var sr = d.objectForKey('show-recents'), rec = !sr || sr.isNil() ? true : d.boolForKey('show-recents');
    var recN = rec ? Math.min(3, (ObjC.deepUnwrap(d.arrayForKey('recent-apps')) || []).length) : 0;
    return { tile: tile, icons: 1 + pa.length + extra + recN + po.length + 1, seps: 1 + (recN ? 1 : 0) };
  } catch (e) { return null; }
}
var last = '', beat = 0, dockAt = 0, dock = null, n = 0;
while (true) {
  if (++n % 20 === 0 && !alive()) break;
  var list = ObjC.deepUnwrap(ObjC.castRefToObject($.CGWindowListCopyWindowInfo(1 | 16, 0))) || [];
  var fa = ws.frontmostApplication, fpid = fa ? fa.processIdentifier : -1;
  var fname = fa ? (ObjC.unwrap(fa.localizedName) || '') : '';
  var wins = [], fg = null;
  for (var i = 0; i < list.length; i++) {
    var o = list[i], b = o.kCGWindowBounds;
    if (!b || o.kCGWindowLayer !== 0 || (o.kCGWindowAlpha || 0) < 0.1) continue;
    if (b.Width < 120 || b.Height < 60) continue;
    var r = { id: o.kCGWindowNumber, x: Math.round(b.X), y: Math.round(b.Y), w: Math.round(b.Width), h: Math.round(b.Height) };
    if (!fg && o.kCGWindowOwnerPID === fpid) {
      fg = { id: r.id, proc: fpid === OWN ? 'nibble' : fname.toLowerCase(), title: o.kCGWindowName || '', cls: '', x: r.x, y: r.y, w: r.w, h: r.h };
    }
    if (o.kCGWindowOwnerPID !== OWN) wins.push(r);
  }
  // Finder in front with none of its windows = you're looking at the desktop
  if (!fg && fa) fg = { id: 0, proc: fpid === OWN ? 'nibble' : fname.toLowerCase(), title: '', cls: fname === 'Finder' ? 'Progman' : '', x: 0, y: 0, w: 0, h: 0 };
  if (Date.now() - dockAt > 4000) { dock = dockEstimate(); dockAt = Date.now(); }
  var json = JSON.stringify({ wins: wins, fg: fg, dockInfo: dock });
  beat += MS;
  if (json !== last || beat >= 5000) { emit(json); last = json; beat = 0; }
  delay(MS / 1000);
}
`;

module.exports = { WindowWatcher };
