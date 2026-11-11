const { contextBridge, ipcRenderer } = require('electron');

const on = (ch) => (cb) => ipcRenderer.on(ch, (_e, data) => cb(data));

contextBridge.exposeInMainWorld('nibble', {
  onInit: on('init'),
  onWorld: on('world'),
  onWindows: on('windows'),
  onCursor: on('cursor'),
  onSettings: on('settings'),
  onCommand: on('command'),
  onWatcherStatus: on('watcher-status'),
  onIdle: on('idle'),
  setIgnore: (v) => ipcRenderer.send('set-ignore', v),
  petMenu: (i) => ipcRenderer.send('pet-menu', i),
  trayIcon: (url) => ipcRenderer.send('tray-icon', url),
  // Nibble Social
  onSocial: on('social'),
  onSocialEvent: on('social-event'),
  socialAction: (a) => ipcRenderer.send('social-action', a),
  friendMenu: (uid) => ipcRenderer.send('friend-menu', uid),
  setFocus: (on) => ipcRenderer.send('overlay-focus', !!on),
  openHub: (tab) => ipcRenderer.send('open-hub', tab || null),
});
