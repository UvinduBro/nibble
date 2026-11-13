// Nibble Hub (main process): the app's settings/social window + the bridge between the
// Hub page (which talks to Firebase) and the pets overlay.
const { app, BrowserWindow, ipcMain, shell, Menu, Notification } = require('electron');
const http = require('http');
const crypto = require('crypto');
const path = require('path');

// settings the Hub may change, with simple validators
// wardrobe look for a local pet: { sp, of, oc, sk } (letters only / a #rrggbb colour)
const cleanStyle = (st) => {
  if (!st || typeof st !== 'object') return null;
  const w = (v) => String(v || '').replace(/[^a-z]/g, '').slice(0, 12);
  return { sp: w(st.sp), of: w(st.of), oc: /^#[0-9a-fA-F]{6}$/.test(st.oc || '') ? st.oc : '', sk: w(st.sk) };
};
const LOCAL_KEYS = {
  size: (v) => [0.65, 0.82, 1, 1.3, 1.65].includes(v),
  chatty: (v) => ['silent', 'quiet', 'normal', 'chatty'].includes(v),
  breakMinutes: (v) => [0, 30, 45, 50, 60, 90].includes(v),
  walkOnWindows: (v) => typeof v === 'boolean',
  followCursor: (v) => typeof v === 'boolean',
  reactToApps: (v) => typeof v === 'boolean',
  hideFullscreen: (v) => typeof v === 'boolean',
  sounds: (v) => typeof v === 'boolean',
  showFriends: (v) => typeof v === 'boolean',
  startWithWindows: (v) => typeof v === 'boolean',
  paused: (v) => typeof v === 'boolean',
  drama: (v) => typeof v === 'boolean',
  pets: (v) => Array.isArray(v) && v.length >= 1 && v.length <= 8,
};

const DONE_HTML = `<!doctype html><meta charset="utf-8"><title>Nibble</title>
<body style="font:16px system-ui;background:#0b0d17;color:#e9ecf8;display:grid;place-items:center;height:100vh;margin:0;text-align:center">
<div><div style="font-size:54px">(◕‿◕)/</div><h2>You're signed in to Nibble!</h2><p style="color:#9aa3c2">You can close this tab and head back to the app.</p></div>`;

function setupHub(ctx) {
  const { SITE, settings, SKINS, appVersion, overlay, applySettings, addPet, removePet, setStartup, setPaused, runUpdate, getLatest, iconPath, getHealth } = ctx;
  let hub = null;
  let quitting = false;
  let lastSocial = { me: null, friends: [], prefs: {}, requests: 0 };
  let retryTimer = null;
  let pendingGoogle = null;

  const toOverlay = (ch, d) => { const w = overlay(); if (w && !w.isDestroyed()) w.webContents.send(ch, d); };
  const fromHub = (e) => hub && !hub.isDestroyed() && e.sender === hub.webContents;
  const fromOverlay = (e) => { const w = overlay(); return w && !w.isDestroyed() && e.sender === w.webContents; };
  const siteOrigin = new URL(SITE).origin;

  function localInfo() {
    return { version: appVersion, latest: getLatest(), settings: settings.get(), skins: Object.keys(SKINS), platform: process.platform, health: getHealth ? getHealth() : null };
  }
  function pushLocal() { if (hub && !hub.isDestroyed()) hub.webContents.send('hub:local', localInfo()); }

  function create() {
    hub = new BrowserWindow({
      width: 1080, height: 720, minWidth: 760, minHeight: 540,
      show: false, title: 'Nibble Hub', backgroundColor: '#0b0d17', autoHideMenuBar: true,
      icon: iconPath,
      webPreferences: {
        preload: path.join(__dirname, 'hubPreload.js'),
        contextIsolation: true, nodeIntegration: false, sandbox: true,
        backgroundThrottling: false, // keeps friends' presence + messages flowing while hidden
        autoplayPolicy: 'no-user-gesture-required', // Listen Together keeps playing when you join from a pet / invite
      },
    });
    hub.setMenuBarVisibility(false);
    hub.on('close', (e) => { if (!quitting) { e.preventDefault(); hub.hide(); } });
    // Mac: Nibble lives in the menu bar; it gets a Dock icon only while the Hub is open
    if (process.platform === 'darwin' && app.dock) {
      hub.on('show', () => { Promise.resolve(app.dock.show()).catch(() => {}); });
      hub.on('hide', () => { app.dock.hide(); });
    }
    // background throttling is off (so messages keep flowing), which also means the page can't tell
    // it's hidden — tell it, so it can stop drawing its little animated pets while nobody's looking
    const vis = () => { if (hub && !hub.isDestroyed()) hub.webContents.send('hub:visible', hub.isVisible() && !hub.isMinimized()); };
    for (const ev of ['show', 'hide', 'minimize', 'restore']) hub.on(ev, vis);
    hub.webContents.on('did-finish-load', vis);
    // stay on the Nibble site; anything else opens in the normal browser
    hub.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
    hub.webContents.on('will-navigate', (e, url) => {
      if (url.startsWith('file:') || new URL(url).origin === siteOrigin) return;
      e.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    });
    hub.webContents.on('did-fail-load', (_e, code, _desc, url, isMain) => {
      if (!isMain || code === -3) return; // -3 = aborted (navigation replaced)
      hub.loadFile(path.join(__dirname, 'offline.html'));
      clearTimeout(retryTimer);
      retryTimer = setTimeout(load, 60_000);
    });
    load();
  }
  function load() {
    clearTimeout(retryTimer);
    if (hub && !hub.isDestroyed()) hub.loadURL(SITE + '/hub');
  }

  function open(tab) {
    if (!hub || hub.isDestroyed()) create();
    if (tab) hub.webContents.send('hub:tab', tab);
    if (hub.isMinimized()) hub.restore();
    hub.show();
    hub.focus();
  }

  // ---------- Google sign-in via the system browser + a one-shot loopback server ----------
  function googleSignIn() {
    if (pendingGoogle) pendingGoogle(null);
    return new Promise((resolve) => {
      const state = crypto.randomBytes(16).toString('hex');
      let done = false;
      const srv = http.createServer((req, res) => {
        if (req.method !== 'POST' || req.url !== '/cb') { res.writeHead(404); res.end(); return; }
        let body = '';
        req.on('data', (c) => { body += c; if (body.length > 32_000) req.destroy(); });
        req.on('end', () => {
          const q = new URLSearchParams(body);
          if (q.get('state') !== state || !q.get('g')) { res.writeHead(400); res.end('Sign-in link expired. Try again from the Nibble app.'); return; }
          res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
          res.end(DONE_HTML);
          finish(q.get('g'));
        });
      });
      const timer = setTimeout(() => finish(null), 5 * 60_000);
      function finish(token) {
        if (done) return;
        done = true;
        pendingGoogle = null;
        clearTimeout(timer);
        setTimeout(() => srv.close(), 1000);
        resolve(token);
        if (token && hub && !hub.isDestroyed()) { hub.show(); hub.focus(); }
      }
      pendingGoogle = finish;
      srv.on('error', () => finish(null));
      srv.listen(0, '127.0.0.1', () => shell.openExternal(`${SITE}/link?port=${srv.address().port}&state=${state}`));
    });
  }

  // ---------- IPC: Hub page ----------
  ipcMain.handle('hub:get-local', (e) => (fromHub(e) ? localInfo() : null));
  ipcMain.handle('hub:google', (e) => (fromHub(e) ? googleSignIn() : null));
  ipcMain.on('hub:set-local', (e, patch) => {
    if (!fromHub(e) || !patch || typeof patch !== 'object') return;
    const ok = {};
    for (const [k, v] of Object.entries(patch)) if (LOCAL_KEYS[k] && LOCAL_KEYS[k](v)) ok[k] = v;
    if (ok.pets) ok.pets = ok.pets.map((p, i) => ({ id: String(p.id || Date.now().toString(36) + i), name: String(p.name || 'Nibble').slice(0, 20), skin: SKINS[p.skin] ? p.skin : 'mint', acc: Array.isArray(p.acc) ? p.acc.filter((a) => typeof a === 'string').slice(0, 6) : [], tint: typeof p.tint === 'string' ? p.tint.slice(0, 7) : '', makeup: typeof p.makeup === 'string' ? p.makeup.slice(0, 12) : '', style: cleanStyle(p.style) }));
    if ('startWithWindows' in ok) { setStartup(ok.startWithWindows); delete ok.startWithWindows; }
    if ('paused' in ok) { setPaused(ok.paused); delete ok.paused; }
    if (Object.keys(ok).length) applySettings(ok);
  });
  ipcMain.on('hub:add-pet', (e, skin) => { if (fromHub(e) && settings.get().pets.length < 8) addPet(SKINS[skin] ? skin : undefined); });
  ipcMain.on('hub:remove-pet', (e, i) => { if (fromHub(e) && Number.isInteger(i)) removePet(i); });
  ipcMain.on('hub:command', (e, cmd) => {
    if (!fromHub(e) || !cmd) return;
    // bring a friend's pet over / send it home
    if ((cmd.type === 'bring' || cmd.type === 'sendhome') && typeof cmd.uid === 'string') return toOverlay('command', { type: cmd.type, uid: cmd.uid });
    if (cmd.type === 'drama') return toOverlay('command', { type: 'drama', kind: ['chat', 'play', 'annoy', 'argue', 'snuggle'].includes(cmd.kind) ? cmd.kind : 'chat' });
    if (!['dance', 'special', 'flip', 'summon', 'say', 'sleep', 'wake'].includes(cmd.type)) return;
    toOverlay('command', { type: cmd.type, pet: Number.isInteger(cmd.pet) ? cmd.pet : undefined });
  });
  ipcMain.on('hub:social', (e, st) => {
    if (!fromHub(e) || !st || typeof st !== 'object') return;
    lastSocial = st;
    toOverlay('social', st);
    ctx.onSocialChange && ctx.onSocialChange(st);
  });
  ipcMain.on('hub:event', (e, m) => {
    if (!fromHub(e) || !m || typeof m !== 'object') return;
    toOverlay('social-event', m);
    // pets hidden? surface direct messages as a Windows notification instead
    const s = settings.get();
    // pets hidden + a deadline reminder: still make sure you hear about it
    if (s.paused && m.kind === 'reminder' && Notification.isSupported()) {
      const n = new Notification({ title: 'Nibble reminder ⏰', body: String(m.text || '').slice(0, 180), silent: false });
      n.on('click', () => open('deadlines'));
      n.show();
      return;
    }
    if (s.paused && m.direct && !(lastSocial.prefs || {}).dnd && Notification.isSupported()) {
      const body = m.kind === 'whisper' ? m.text : `sent you a ${m.kind}`;
      const n = new Notification({ title: '@' + m.fromName, body, silent: false });
      n.on('click', () => open('messages'));
      n.show();
    }
  });
  ipcMain.on('hub:update', (e) => { if (fromHub(e)) runUpdate(); });
  ipcMain.on('hub:hide', (e) => { if (fromHub(e)) hub.hide(); });
  ipcMain.on('hub:notify', (e, d) => {
    if (!fromHub(e) || !d || !Notification.isSupported()) return;
    const n = new Notification({ title: String(d.title || 'Nibble').slice(0, 80), body: String(d.body || '').slice(0, 180), silent: false });
    // a notification can open a Hub tab and run one safe action (join a music room)
    const tab = ['music', 'games', 'friends', 'messages', 'home', 'style', 'deadlines'].includes(d.tab) ? d.tab : null;
    const host = d.action && d.action.type === 'music' && d.action.cmd === 'join' ? String(d.action.host || '').slice(0, 64) : '';
    n.on('click', () => { open(tab); if (host && hub && !hub.isDestroyed()) hub.webContents.send('hub:action', { type: 'music', cmd: 'join', host }); });
    n.show();
  });

  // ---------- IPC: overlay ----------
  ipcMain.on('social-action', (e, a) => {
    if (!fromOverlay(e) || !a || typeof a !== 'object' || !hub || hub.isDestroyed()) return;
    const clean = { type: a.type };
    if (a.type === 'say') clean.text = String(a.text || '').slice(0, 80);
    else if (a.type === 'typing') { clean.on = !!a.on; clean.to = String(a.to || ''); }
    else if (a.type === 'send') Object.assign(clean, { to: String(a.to || ''), kind: String(a.kind || ''), text: String(a.text || '').slice(0, 80) });
    else return;
    hub.webContents.send('hub:action', clean);
  });
  ipcMain.on('open-hub', (e, tab) => { if (fromOverlay(e)) open(typeof tab === 'string' ? tab : null); });
  ipcMain.on('friend-menu', (e, uid) => {
    if (!fromOverlay(e)) return;
    const f = (lastSocial.friends || []).find((x) => x.uid === uid);
    if (!f) return;
    const send = (kind) => () => hub && hub.webContents.send('hub:action', { type: 'send', to: uid, kind, text: '' });
    Menu.buildFromTemplate([
      { label: `@${f.username}${f.petName ? ' · ' + f.petName : ''}`, enabled: false },
      ...(f.status ? [{ label: `“${f.status}”`, enabled: false }] : []),
      { type: 'separator' },
      { label: '👋  Wave', click: send('wave') },
      { label: '🤗  Cuddle', click: send('hug') },
      { label: '😘  Blow a kiss', click: send('kiss') },
      { label: '👉  Poke', click: send('poke') },
      { label: '❤️  Send a heart', click: send('heart') },
      { label: '🙌  High five', click: send('highfive') },
      { label: '🤭  Tickle', click: send('tickle') },
      { label: '🎉  Cheer them on', click: send('cheer') },
      { label: '🍪  Share a snack', click: send('snack') },
      { label: '🎶  Dance together', click: send('dance') },
      { label: '😜  Tease them', click: send('annoy') },
      { label: '🍦  Share ice cream', click: send('icecream') },
      { label: '💬  Whisper… (hold their pet)', click: () => toOverlay('command', { type: 'whisper', uid }) },
      { type: 'separator' },
      { label: '🏠  Keep their pet here (30 min)', click: () => toOverlay('command', { type: 'bring', uid }) },
      { label: '🚀  Send my pet to visit them', click: send('visit') },
      { label: '👋  Send their pet home', click: () => toOverlay('command', { type: 'sendhome', uid }) },
      { type: 'separator' },
      { label: 'Open Nibble Hub', click: () => open('friends') },
    ]).popup({ window: overlay() });
  });

  // ---------- re-sync when the overlay reloads ----------
  // what's playing in Spotify / browsers / … on this PC (only while the user shares it)
  let np = null;
  ipcMain.on('hub:np-watch', (e, on) => {
    if (!fromHub(e)) return;
    if (on) {
      if (!np) {
        const { NowPlaying } = require('./nowPlaying');
        np = new NowPlaying();
        np.on('np', (d) => { if (hub && !hub.isDestroyed()) hub.webContents.send('hub:np', d); });
      }
      np.start();
    } else if (np) np.stop();
  });

  return {
    create,
    // pet menu → Listen Together controls (handled by the Hub page)
    action: (a) => { if (hub && !hub.isDestroyed()) hub.webContents.send('hub:action', a); },
    stopNowPlaying: () => { if (np) np.stop(); },
    open,
    pushLocal,
    lastSocial: () => lastSocial,
    resend: () => toOverlay('social', lastSocial),
    reload: load,
    quit: () => { quitting = true; },
  };
}

module.exports = { setupHub };
