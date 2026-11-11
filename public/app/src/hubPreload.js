// Bridge for the Nibble Hub window (the /hub page of the Nibble website).
// Exposes only what the Hub needs: local pet settings, and relaying social state/events to the pets.
const { contextBridge, ipcRenderer } = require('electron');

const listen = (ch) => (cb) => {
  const fn = (_e, d) => cb(d);
  ipcRenderer.on(ch, fn);
  return () => ipcRenderer.removeListener(ch, fn);
};

contextBridge.exposeInMainWorld('nibbleDesktop', {
  platform: process.platform,
  getLocal: () => ipcRenderer.invoke('hub:get-local'),
  onLocal: listen('hub:local'),
  setLocal: (patch) => ipcRenderer.send('hub:set-local', patch),
  addPet: (skin) => ipcRenderer.send('hub:add-pet', skin || null),
  removePet: (i) => ipcRenderer.send('hub:remove-pet', i),
  command: (cmd) => ipcRenderer.send('hub:command', cmd),
  sendSocial: (state) => ipcRenderer.send('hub:social', state),
  sendEvent: (msg) => ipcRenderer.send('hub:event', msg),
  onAction: listen('hub:action'),
  onTab: listen('hub:tab'),
  googleSignIn: () => ipcRenderer.invoke('hub:google'),
  update: () => ipcRenderer.send('hub:update'),
  hide: () => ipcRenderer.send('hub:hide'),
});
