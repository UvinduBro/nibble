const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEFAULTS = {
  pets: [{ name: 'Nibble', skin: 'mint' }],
  size: 1,
  chatty: 'normal', // silent | quiet | normal | chatty
  walkOnWindows: true,
  followCursor: false,
  reactToApps: true,
  hideFullscreen: true,
  breakMinutes: 50, // 0 = off
  displayId: null,
  startWithWindows: false,
  sounds: false,
  paused: false,
  showFriends: true, // friends' pets visit this desktop (Nibble Social)
  hubIntroShown: false,
};

let file;
let data;

function load() {
  file = path.join(app.getPath('userData'), 'settings.json');
  try {
    data = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (_) {
    data = JSON.parse(JSON.stringify(DEFAULTS));
  }
  if (!Array.isArray(data.pets) || !data.pets.length) data.pets = [...DEFAULTS.pets];
  return data;
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); } catch (_) {}
  }, 300);
}

function get() { return data; }
function set(patch) { Object.assign(data, patch); save(); return data; }
function filePath() { return file; }

module.exports = { load, get, set, save, filePath, DEFAULTS };
