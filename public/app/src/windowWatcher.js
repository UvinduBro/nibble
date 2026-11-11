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

  stop() {
    this.stopped = true;
    if (this.proc) {
      try { this.proc.kill(); } catch (_) {}
      this.proc = null;
    }
  }
}

module.exports = { WindowWatcher };
