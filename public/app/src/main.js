const { app, BrowserWindow, screen, ipcMain, Tray, Menu, nativeImage, globalShortcut, shell, powerMonitor, net } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const settings = require('./settings');
const SKINS = require('./skins');
const { WindowWatcher } = require('./windowWatcher');
const { setupHub } = require('./hub');

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

app.setName('Nibble');
app.setAppUserModelId('lk.uvi.nibble');

// Tag the Start-menu / desktop shortcuts with Nibble's app id, so the taskbar groups the windows
// under "Nibble" with its own icon (and Windows notifications are labelled Nibble, not Electron).
function brandShortcuts() {
  if (process.platform !== 'win32') return;
  const ico = path.join(path.dirname(process.execPath), 'nibble.ico');
  const links = [
    path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Nibble', 'Nibble.lnk'),
    path.join(app.getPath('desktop'), 'Nibble.lnk'),
  ];
  // a Nibble pinned to the taskbar is a shortcut too: give it the app id + icon so it doesn't show Electron's
  const pins = path.join(app.getPath('appData'), 'Microsoft', 'Internet Explorer', 'Quick Launch', 'User Pinned', 'TaskBar');
  try { for (const f of fs.readdirSync(pins)) if (/\.lnk$/i.test(f)) links.push(path.join(pins, f)); } catch {}
  for (const l of links) {
    try {
      if (!fs.existsSync(l)) continue;
      const cur = shell.readShortcutLink(l);
      if (path.resolve(cur.target || '').toLowerCase() !== path.resolve(process.execPath).toLowerCase() && !/nibble\.lnk$/i.test(l)) continue;
      if (cur.appUserModelId === 'lk.uvi.nibble' && (!fs.existsSync(ico) || (cur.icon || '').toLowerCase() === ico.toLowerCase())) continue;
      shell.writeShortcutLink(l, 'update', { target: process.execPath, appUserModelId: 'lk.uvi.nibble', ...(fs.existsSync(ico) ? { icon: ico, iconIndex: 0 } : {}), description: 'Nibble - desktop pet' });
    } catch {}
  }
}

const SITE = 'https://nibblex.vercel.app';
const IS_MAC = process.platform === 'darwin';
const health = { files: 'checking', name: process.platform === 'win32' ? 'checking' : 'ok' };

// ---------- self-repair: an install that missed an app file (older setups did) fetches it ----------
async function repairFiles() {
  if (!app.isPackaged) { health.files = 'ok'; return; }
  try {
    const res = await net.fetch(SITE + '/install-files.txt', { cache: 'no-store' });
    if (!res.ok) throw new Error('list ' + res.status);
    const lines = (await res.text()).split('\n').map((l) => l.trim().split(' ')).filter((p) => p.length === 2 && p[0].startsWith('/') && !p[1].includes('..'));
    const root = path.join(__dirname, '..');
    let fixed = 0, renderer = false;
    for (const [src, dest] of lines) {
      const file = path.join(root, dest);
      if (fs.existsSync(file)) continue;
      const r = await net.fetch(SITE + src, { cache: 'no-store' });
      if (!r.ok) continue;
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
      fixed++;
      if (dest.startsWith('src/renderer/') || dest === 'src/skins.js') renderer = true;
    }
    health.files = fixed ? 'repaired ' + fixed : 'ok';
    if (renderer && win && !win.isDestroyed()) win.webContents.reload(); // the pets pick up the new files
  } catch (e) { health.files = 'offline'; }
  if (hubCtl) hubCtl.pushLocal();
}

// ---------- Windows: make sure Nibble.exe carries Nibble's name + icon (not Electron's) ----------
// Older installers only renamed electron.exe. If so, brand a copy with our own runtime (brand.js),
// swap it in (a running exe can be renamed, not deleted) and restart once.
function exeDescription(file) {
  return new Promise((resolve) => {
    const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `(Get-Item -LiteralPath '${file.replace(/'/g, "''")}').VersionInfo.FileDescription`], { windowsHide: true });
    let out = '';
    ps.stdout.on('data', (d) => { out += d; });
    ps.on('error', () => resolve(''));
    ps.on('close', () => resolve(out.trim()));
  });
}
async function selfBrand() {
  if (process.platform !== 'win32' || !app.isPackaged) return;
  const exe = process.execPath, dir = path.dirname(exe);
  try { fs.unlinkSync(path.join(dir, 'Nibble-old.exe')); } catch {}
  if (path.basename(exe).toLowerCase() !== 'nibble.exe') { health.name = 'ok'; return; }
  const desc = await exeDescription(exe);
  if (!desc || desc === 'Nibble') { health.name = 'ok'; if (hubCtl) hubCtl.pushLocal(); return; }
  health.name = 'fixing';
  if (hubCtl) hubCtl.pushLocal();
  try {
    const get = async (url, file) => { const r = await net.fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error(url); fs.writeFileSync(file, Buffer.from(await r.arrayBuffer())); };
    const bj = path.join(dir, 'brand.js'), ico = path.join(dir, 'nibble.ico'), out = path.join(dir, 'Nibble-branded.exe');
    await get(SITE + '/app/brand.js', bj);
    if (!fs.existsSync(ico)) await get(SITE + '/nibble.ico', ico);
    const code = await new Promise((resolve) => {
      const p = spawn(exe, [bj, exe, out, ico, app.getVersion()], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, windowsHide: true });
      p.on('error', () => resolve(-1));
      p.on('close', resolve);
    });
    try { fs.unlinkSync(bj); } catch {}
    if (code !== 0 || (await exeDescription(out)) !== 'Nibble') throw new Error('brand ' + code);
    fs.renameSync(exe, path.join(dir, 'Nibble-old.exe'));
    fs.renameSync(out, exe);
    // Windows remembers the old name per path; forget it, and refresh the icon cache
    spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      "$m='HKCU:\\Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\Shell\\MuiCache'; if (Test-Path $m) { foreach ($n in (Get-Item $m).Property) { if ($n -like '*Programs\\Nibble\\*') { Remove-ItemProperty $m -Name $n -ErrorAction SilentlyContinue } } }; ie4uinit.exe -show"],
      { windowsHide: true, detached: true, stdio: 'ignore' }).unref();
    health.name = 'ok';
    app.relaunch();
    app.exit(0);
  } catch (e) {
    health.name = 'failed';
    try { fs.unlinkSync(path.join(dir, 'Nibble-branded.exe')); } catch {}
    if (hubCtl) hubCtl.pushLocal();
  }
}
let latest = null; // newer version published on the site, if any

const NAMES = ['Byte', 'Pixel', 'Kilo', 'Mochi', 'Glitch', 'Cache', 'Sprite', 'Vector', 'Kernel', 'Bit', 'Nugget', 'Pico'];
const SIZES = [['Tiny', 0.65], ['Small', 0.82], ['Normal', 1], ['Big', 1.3], ['Chonky', 1.65]];
const CHATTY = [['Silent', 'silent'], ['Quiet', 'quiet'], ['Normal', 'normal'], ['Chatty', 'chatty']];
const BREAKS = [['Off', 0], ['Every 30 min', 30], ['Every 45 min', 45], ['Every 50 min', 50], ['Every 60 min', 60], ['Every 90 min', 90]];

let win = null;
let tray = null;
let watcher = null;
let display = null;
let lastWins = null;
let cursorTimer = null;
let hubCtl = null; // Nibble Hub window (settings + social)
let social = { me: null, friends: [], requests: 0 };

const assetPath = (f) => path.join(__dirname, '..', 'assets', f);
const BLANK_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function pickDisplay() {
  const s = settings.get();
  const all = screen.getAllDisplays();
  return all.find((d) => d.id === s.displayId) || screen.getPrimaryDisplay();
}

function worldInfo() {
  const b = display.bounds;
  const wa = display.workArea;
  return {
    w: b.width,
    h: b.height,
    left: wa.x - b.x,
    right: wa.x + wa.width - b.x,
    top: wa.y - b.y,
    floor: wa.y + wa.height - b.y,
    scale: display.scaleFactor,
  };
}

function send(ch, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(ch, payload);
}

function placeWindow() {
  display = pickDisplay();
  const b = display.bounds;
  win.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height - 1 });
  send('world', worldInfo());
}

function createWindow() {
  display = pickDisplay();
  const b = display.bounds;
  win = new BrowserWindow({
    // 1px short of full height so Windows never treats the overlay as a fullscreen app
    x: b.x, y: b.y, width: b.width, height: b.height - 1,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    alwaysOnTop: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  if (IS_MAC) win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.webContents.on('did-finish-load', () => {
    send('init', { settings: settings.get(), world: worldInfo(), skins: SKINS, platform: process.platform });
    if (lastWins) send('windows', lastWins);
    if (hubCtl) hubCtl.resend();
    if (!settings.get().paused) win.showInactive();
  });

  // Keep the overlay above the taskbar & other always-on-top windows.
  setInterval(() => {
    if (win && !win.isDestroyed() && win.isVisible()) {
      win.setAlwaysOnTop(true, 'screen-saver');
      win.moveTop();
    }
  }, 4000);

  // Global cursor, so pets can look at / chase the mouse even over other apps.
  cursorTimer = setInterval(() => {
    if (!win || win.isDestroyed() || !win.isVisible()) return;
    const p = screen.getCursorScreenPoint();
    send('cursor', { x: p.x - display.bounds.x, y: p.y - display.bounds.y });
  }, 33);

  // System-wide idle seconds (keyboard + mouse) – pets nap when you're away.
  setInterval(() => send('idle', powerMonitor.getSystemIdleTime()), 1000);
}

// ---------- window watcher ----------
function toDip(r) {
  if (process.platform === 'win32' && screen.screenToDipRect) {
    const d = screen.screenToDipRect(null, { x: r.x, y: r.y, width: r.w, height: r.h });
    return { x: d.x, y: d.y, w: d.width, h: d.height };
  }
  const s = display.scaleFactor || 1;
  return { x: r.x / s, y: r.y / s, w: r.w / s, h: r.h / s };
}

function handleWindows(data) {
  if (!display) return;
  const b = display.bounds;
  const wins = [];
  for (const raw of data.wins || []) {
    const d = toDip(raw);
    const x = d.x - b.x, y = d.y - b.y;
    if (x + d.w < 0 || x > b.width || y + d.h < 0 || y > b.height) continue;
    wins.push({ id: String(raw.id), x, y, w: d.w, h: d.h, max: raw.max });
  }
  let fg = null;
  if (data.fg) {
    const d = toDip(data.fg);
    const x = d.x - b.x, y = d.y - b.y;
    const desktop = /^(Progman|WorkerW|Shell_TrayWnd|Shell_SecondaryTrayWnd)$/.test(data.fg.cls);
    const fullscreen = !desktop && data.fg.proc !== 'nibble' &&
      x <= 1 && y <= 1 && x + d.w >= b.width - 1 && y + d.h >= b.height - 1;
    fg = { id: String(data.fg.id), proc: (data.fg.proc || '').toLowerCase(), title: data.fg.title || '', fullscreen, desktop };
  }
  lastWins = { wins, fg };
  send('windows', lastWins);
}

function startWatcher() {
  watcher = new WindowWatcher({ intervalMs: 60 });
  watcher.on('data', handleWindows);
  watcher.on('status', (s) => send('watcher-status', s));
  watcher.start();
}

// ---------- your first pet wears your account look ----------
// The Hub sends your saved look (animal, outfit, hats, colours, skill) with every social update.
// Pet #1 on this PC is you, so put it on as soon as the look changes, wherever it was changed.
let lastMeLook = '';
function wearMyLook(me) {
  if (!me || !me.username) return;
  const w = (v) => String(v || '').replace(/[^a-z]/g, '').slice(0, 12);
  const st = me.style && typeof me.style === 'object'
    ? { sp: w(me.style.sp), of: w(me.style.of), oc: /^#[0-9a-fA-F]{6}$/.test(me.style.oc || '') ? me.style.oc : '', sk: w(me.style.sk) }
    : { sp: '', of: '', oc: '', sk: '' };
  const look = {
    skin: SKINS[me.skin] ? me.skin : 'mint',
    acc: Array.isArray(me.acc) ? me.acc.filter((a) => typeof a === 'string').slice(0, 6) : [],
    tint: typeof me.tint === 'string' ? me.tint.slice(0, 7) : '',
    makeup: typeof me.makeup === 'string' ? me.makeup.slice(0, 12) : '',
    style: st,
  };
  const key = JSON.stringify(look);
  if (key === lastMeLook) return; // only when your look actually changes
  lastMeLook = key;
  const s = settings.get();
  if (!s.pets || !s.pets.length) return;
  const p0 = s.pets[0];
  const have = JSON.stringify({ skin: p0.skin || 'mint', acc: p0.acc || [], tint: p0.tint || '', makeup: p0.makeup || '', style: p0.style || { sp: '', of: '', oc: '', sk: '' } });
  if (have === key) return;
  applySettings({ pets: s.pets.map((p, i) => (i === 0 ? { ...p, ...look } : p)) });
}

// ---------- settings & menus ----------
function applySettings(patch) {
  const s = settings.set(patch);
  send('settings', s);
  rebuildTray();
  if (hubCtl) hubCtl.pushLocal();
  return s;
}

function addPet(skin) {
  const s = settings.get();
  const used = new Set(s.pets.map((p) => p.name));
  const name = NAMES.find((n) => !used.has(n)) || 'Nib-' + (s.pets.length + 1);
  const skins = Object.keys(SKINS);
  skin = skin || skins[Math.floor(Math.random() * skins.length)];
  const own = SKINS[skin] && SKINS[skin].petName;
  applySettings({ pets: [...s.pets, { id: newId(), name: own && !used.has(own) ? own : name, skin }] });
}

function removePet(index) {
  const s = settings.get();
  if (s.pets.length <= 1) return;
  const pets = s.pets.slice();
  pets.splice(index, 1);
  applySettings({ pets });
}

function setPaused(paused) {
  applySettings({ paused });
  if (!win) return;
  if (paused) win.hide();
  else win.showInactive();
}

function loginExe() {
  return process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
}

function setStartup(on) {
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: on, path: loginExe() });
  applySettings({ startWithWindows: on });
}

function radio(label, items, current, onPick) {
  return {
    label,
    submenu: items.map(([l, v]) => ({ label: l, type: 'radio', checked: current === v, click: () => onPick(v) })),
  };
}

function skinMenu(onPick, current, type = 'radio') {
  const item = ([key, sk]) => ({ label: sk.label, type, checked: type === 'radio' && current === key, click: () => onPick(key) });
  const all = Object.entries(SKINS);
  return [
    { label: 'Classic', enabled: false },
    ...all.filter(([, sk]) => !sk.kit).map(item),
    { type: 'separator' },
    { label: 'Anime crew', enabled: false },
    ...all.filter(([, sk]) => sk.kit).map(item),
  ];
}

// ---------- updates (re-runs the installer from the website; settings are kept) ----------
async function runUpdate() {
  if (IS_MAC) {
    // the same one-line installer as the website, run in the background (it restarts Nibble)
    spawn('/bin/bash', ['-c', `curl -fsSL ${SITE}/install.sh | bash >/tmp/nibble-update.log 2>&1`], { detached: true, stdio: 'ignore' }).unref();
    return;
  }
  if (process.platform !== 'win32') return shell.openExternal(SITE + '/#download');
  // Always the latest installer from the site (an old copy in the install folder could be years out of date)
  try {
    const dest = path.join(app.getPath('temp'), 'Get-Nibble.exe');
    const res = await net.fetch(SITE + '/Get-Nibble.exe', { cache: 'no-store' });
    if (!res.ok) throw new Error('download ' + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
    spawn(dest, [], { detached: true, stdio: 'ignore' }).unref();
  } catch (_) {
    const local = path.join(path.dirname(process.execPath), 'Nibble Setup.exe');
    if (fs.existsSync(local)) spawn(local, [], { detached: true, stdio: 'ignore' }).unref();
    else shell.openExternal(SITE + '/#download');
  }
}

const newer = (a, b) => {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  return false;
};

async function checkForUpdate() {
  try {
    const res = await net.fetch(SITE + '/version.json', { cache: 'no-store' });
    const info = await res.json();
    if (info && info.version && newer(info.version, app.getVersion())) {
      latest = info.version;
      rebuildTray();
      if (hubCtl) hubCtl.pushLocal();
      if (tray && tray.displayBalloon) tray.displayBalloon({ title: `Nibble ${latest} is here`, content: 'New pets & tricks. Tray menu → Update Nibble.', iconType: 'info' });
    }
  } catch (_) { /* offline – try again later */ }
}

function trayTemplate() {
  const s = settings.get();
  const displays = screen.getAllDisplays();
  const online = (social.friends || []).filter((f) => f.online).length;
  return [
    { label: `Nibble · ${s.pets.length} pet${s.pets.length > 1 ? 's' : ''}`, enabled: false },
    { type: 'separator' },
    { label: 'Open Nibble Hub', click: () => hubCtl && hubCtl.open() },
    {
      label: social.me ? `Friends · ${online} online${social.requests ? ` · ${social.requests} new request${social.requests > 1 ? 's' : ''}` : ''}` : 'Sign in to add friends…',
      click: () => hubCtl && hubCtl.open(social.me ? 'friends' : null),
    },
    ...(social.me ? [{ label: 'Talk to friends…', click: () => send('command', { type: 'compose', pet: 0 }) }] : []),
    // music invites: one click joins (the Hub plays the sound)
    ...((social.music && Array.isArray(social.music.invites) ? social.music.invites : []).slice(0, 3).map((i) => ({
      label: `🎧 Join @${String(i.name || 'friend').slice(0, 20)}'s music room`,
      click: () => { if (hubCtl) { hubCtl.open('music'); hubCtl.action({ type: 'music', cmd: 'join', host: String(i.host || '').slice(0, 64) }); } },
    }))),
    ...(social.me ? [
      { label: '🎮 Mini games & points', click: () => hubCtl && hubCtl.open('games') },
      { label: '✿ Customize your pet', click: () => hubCtl && hubCtl.open('style') },
    ] : []),
    { type: 'separator' },
    { label: s.paused ? 'Show pets' : 'Hide pets', accelerator: 'CommandOrControl+Alt+N', click: () => setPaused(!s.paused) },
    { label: 'Call pets to cursor', click: () => send('command', { type: 'summon' }) },
    { label: 'Everybody dance', click: () => send('command', { type: 'dance' }) },
    { type: 'separator' },
    {
      label: 'Add a pet',
      submenu: [{ label: 'Surprise me', click: () => addPet() }, { type: 'separator' }, ...skinMenu((k) => addPet(k), null, 'normal')],
    },
    { label: 'Special moves!', click: () => send('command', { type: 'special' }) },
    {
      label: 'Character (all pets)',
      submenu: skinMenu((k) => applySettings({ pets: s.pets.map((p) => ({ ...p, skin: k })) }), s.pets.every((p) => p.skin === s.pets[0].skin) ? s.pets[0].skin : null),
    },
    radio('Size', SIZES, s.size, (v) => applySettings({ size: v })),
    radio('Chattiness', CHATTY, s.chatty, (v) => applySettings({ chatty: v })),
    radio('Break reminders', BREAKS, s.breakMinutes, (v) => applySettings({ breakMinutes: v })),
    { type: 'separator' },
    { label: 'Walk on windows', type: 'checkbox', checked: s.walkOnWindows, click: (m) => applySettings({ walkOnWindows: m.checked }) },
    { label: 'Follow my cursor', type: 'checkbox', checked: s.followCursor, click: (m) => applySettings({ followCursor: m.checked }) },
    { label: 'React to apps I use', type: 'checkbox', checked: s.reactToApps, click: (m) => applySettings({ reactToApps: m.checked }) },
    { label: 'Hide during fullscreen', type: 'checkbox', checked: s.hideFullscreen, click: (m) => applySettings({ hideFullscreen: m.checked }) },
    { label: 'Little sounds', type: 'checkbox', checked: s.sounds, click: (m) => applySettings({ sounds: m.checked }) },
    ...(displays.length > 1
      ? [{
          label: 'Live on display',
          submenu: displays.map((d, i) => ({
            label: `Display ${i + 1} (${d.size.width}×${d.size.height})${d.id === screen.getPrimaryDisplay().id ? ' · primary' : ''}`,
            type: 'radio',
            checked: d.id === display.id,
            click: () => { applySettings({ displayId: d.id }); placeWindow(); },
          })),
        }]
      : []),
    { type: 'separator' },
    { label: 'Start with Windows', type: 'checkbox', checked: s.startWithWindows, click: (m) => setStartup(m.checked) },
    { label: 'Open settings file', click: () => shell.openPath(settings.filePath()) },
    { type: 'separator' },
    { label: latest ? `⬆ Update to v${latest}` : `Update Nibble (v${app.getVersion()})`, click: runUpdate },
    { label: 'Nibble website', click: () => shell.openExternal(SITE) },
    { label: 'Quit Nibble', click: () => app.quit() },
  ];
}

function rebuildTray() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate(trayTemplate()));
  tray.setToolTip(settings.get().paused ? 'Nibble (hidden)' : 'Nibble – your desktop pet');
}

function petMenu(index) {
  const s = settings.get();
  const pet = s.pets[index];
  if (!pet) return;
  const cmd = (type, extra = {}) => () => send('command', { type, pet: index, ...extra });
  const m = Menu.buildFromTemplate([
    { label: pet.name, enabled: false },
    { type: 'separator' },
    { label: 'Say something', click: cmd('say') },
    ...(social.me ? [{ label: 'Talk to friends…  (or hold me)', click: cmd('compose') }] : []),
    { label: 'Dance', click: cmd('dance') },
    { label: 'Backflip', click: cmd('flip') },
    { label: SKINS[pet.skin] && SKINS[pet.skin].kit ? 'Special move' : 'Special move (backflip)', click: cmd('special') },
    { label: 'Take a nap', click: cmd('sleep') },
    { label: 'Wake up', click: cmd('wake') },
    { label: 'Code with me', click: cmd('work') },
    { label: '🍦 Give ice cream', click: cmd('treat') },
    ...(social && social.music && social.music.on ? [{
      label: social.music.title ? `🎧 ${social.music.title.slice(0, 40)}` : '🎧 Listening together',
      submenu: [
        ...(social.music.title ? [{ label: social.music.playing ? '⏸ Pause for everyone' : '▶ Play for everyone', click: () => hubCtl && hubCtl.action({ type: 'music', cmd: 'toggle' }) },
          { label: '⏭ Skip song', click: () => hubCtl && hubCtl.action({ type: 'music', cmd: 'next' }) }] : []),
        { label: 'Open Music in the Hub', click: () => hubCtl && hubCtl.open('music') },
      ],
    }] : []),
    ...(s.pets.length > 1 ? [{
      label: 'With another pet',
      submenu: [
        { label: '😘 Kiss', click: cmd('act', { kind: 'kiss' }) },
        { label: '🤗 Cuddle', click: cmd('act', { kind: 'hug' }) },
        { label: '😜 Tease', click: cmd('act', { kind: 'annoy' }) },
        { label: '🍦 Share ice cream', click: cmd('act', { kind: 'icecream' }) },
        { label: '🙌 High five', click: cmd('act', { kind: 'highfive' }) },
        { label: '🎶 Dance together', click: cmd('act', { kind: 'dance' }) },
      ],
    }] : []),
    {
      label: 'Character',
      submenu: skinMenu((k) => {
        const pets = s.pets.slice();
        pets[index] = { ...pets[index], skin: k };
        applySettings({ pets });
      }, pet.skin),
    },
    { type: 'separator' },
    { label: 'Add another pet', click: () => addPet() },
    { label: 'Send home (remove)', enabled: s.pets.length > 1, click: () => removePet(index) },
  ]);
  m.popup({ window: win });
}

// ---------- IPC ----------
let ignoring = true;
ipcMain.on('set-ignore', (_e, ignore) => {
  if (!win || ignore === ignoring) return;
  ignoring = ignore;
  win.setIgnoreMouseEvents(ignore, { forward: true });
});
ipcMain.on('pet-menu', (_e, index) => petMenu(index));
// the overlay is normally unfocusable (so it never steals your typing); hold-to-talk needs the keyboard briefly
ipcMain.on('overlay-focus', (e, on) => {
  if (!win || e.sender !== win.webContents) return;
  win.setFocusable(!!on);
  if (on) win.focus();
  else win.blur();
});
ipcMain.on('tray-icon', (_e, dataUrl) => {
  if (!tray || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png')) return;
  if (!nativeImage.createFromPath(assetPath('tray.png')).isEmpty()) return; // prefer bundled art
  const sz = IS_MAC ? 18 : 32; // Mac menu bar icons are ~18 pt
  tray.setImage(nativeImage.createFromDataURL(dataUrl).resize({ width: sz, height: sz, quality: 'best' }));
});

// ---------- lifecycle ----------
app.whenReady().then(() => {
  if (IS_MAC && app.dock) app.dock.hide(); // a desktop pet lives in the menu bar, not the Dock
  brandShortcuts();
  setTimeout(() => { repairFiles().then(selfBrand).catch(() => {}); }, 4000);
  settings.load();
  // give pets stable ids
  const s = settings.get();
  if (s.pets.some((p) => !p.id)) settings.set({ pets: s.pets.map((p) => ({ id: p.id || newId(), ...p })) });

  createWindow();

  hubCtl = setupHub({
    SITE, settings, SKINS, appVersion: app.getVersion(), overlay: () => win,
    applySettings, addPet, removePet, setStartup, setPaused, runUpdate, getLatest: () => latest, getHealth: () => ({ ...health }),
    iconPath: path.join(__dirname, '..', '..', '..', 'nibble.ico'),
    onSocialChange: (st) => {
      const sig = (x) => JSON.stringify([x.me && x.me.username, (x.friends || []).map((f) => f.online), x.requests, x.music && x.music.invites]);
      const before = sig(social);
      social = st;
      if (before !== sig(st)) rebuildTray();
      wearMyLook(st && st.me);
    },
  });
  hubCtl.create();
  if (!settings.get().hubIntroShown) {
    settings.set({ hubIntroShown: true });
    setTimeout(() => hubCtl.open(), 2500); // first launch of 2.0: say hi with the Hub
  }

  // Bundled icon if present; otherwise the renderer draws Nibble and sends it over (see 'tray-icon').
  let icon = nativeImage.createFromPath(assetPath('tray.png'));
  if (icon.isEmpty()) icon = nativeImage.createFromDataURL(BLANK_PNG);
  tray = new Tray(icon);
  tray.on('click', () => tray.popUpContextMenu());
  tray.on('double-click', () => hubCtl && hubCtl.open());
  rebuildTray();

  globalShortcut.register('CommandOrControl+Alt+N', () => setPaused(!settings.get().paused));

  screen.on('display-metrics-changed', placeWindow);
  screen.on('display-added', () => { placeWindow(); rebuildTray(); });
  screen.on('display-removed', () => { placeWindow(); rebuildTray(); });

  startWatcher();
  setTimeout(checkForUpdate, 8000);
  setInterval(checkForUpdate, 6 * 60 * 60 * 1000);
});

app.on('second-instance', () => {
  setPaused(false);
  send('command', { type: 'summon' });
  if (hubCtl) hubCtl.open();
});

app.on('before-quit', () => { if (hubCtl) { hubCtl.quit(); hubCtl.stopNowPlaying(); } });

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (watcher) watcher.stop();
  clearInterval(cursorTimer);
});

app.on('window-all-closed', (e) => e.preventDefault());
