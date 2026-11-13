// Builds Nibble.dmg (universal: Apple silicon + Intel) on a Mac (GitHub Actions macos runner).
//  1. Electron's official Mac builds (SHA-256 checked) → Nibble.app (name, id, icon, app files)
//  2. one universal app (@electron/universal)
//  3. signed with your Developer ID + hardened runtime when MAC_IDENTITY is set, else ad-hoc
//  4. Nibble.dmg (drag to Applications), notarized by Apple + stapled when the API key is set
// Run from the repo root:  node tools/mac/build.mjs
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const run = (cmd, args, opt = {}) => { console.log('$', cmd, args.join(' ')); return execFileSync(cmd, args, { stdio: 'inherit', ...opt }); };
const root = process.cwd();
const inst = fs.readFileSync(path.join(root, 'lib/installer.js'), 'utf8');
const EVER = inst.match(/ELECTRON = \{ version: '([\d.]+)'/)[1];
const SHAS = { arm64: inst.match(/arm64: '([0-9a-f]{64})'/)[1], x64: inst.match(/x64: '([0-9a-f]{64})'/)[1] };
const FILES = [...inst.matchAll(/\['(\/[^']+)', '([^']+)'\]/g)].map((m) => [m[1], m[2]]);
const VER = JSON.parse(fs.readFileSync(path.join(root, 'public/app/package.json'), 'utf8')).version;
const OUT = path.join(root, 'dist-mac');
const env = (k) => (process.env[k] || '').trim();
if (FILES.length < 10) throw new Error('file list not found in lib/installer.js');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

async function buildArch(arch) {
  const zip = path.join(env('ZIP_DIR') || OUT, `electron-${arch}.zip`);
  const url = `https://github.com/electron/electron/releases/download/v${EVER}/electron-v${EVER}-darwin-${arch}.zip`;
  if (!fs.existsSync(zip)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('download failed ' + url);
    fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  }
  const sha = crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex');
  if (sha !== SHAS[arch]) throw new Error(`checksum mismatch for ${arch}: ${sha}`);
  const dir = path.join(OUT, arch);
  run('ditto', ['-x', '-k', zip, dir]);
  const app = path.join(dir, 'Nibble.app');
  fs.renameSync(path.join(dir, 'Electron.app'), app);
  const C = path.join(app, 'Contents');
  fs.renameSync(path.join(C, 'MacOS/Electron'), path.join(C, 'MacOS/Nibble'));
  const P = path.join(C, 'Info.plist');
  const set = (k, v) => run('plutil', ['-replace', k, '-string', v, P]);
  set('CFBundleExecutable', 'Nibble');
  set('CFBundleName', 'Nibble');
  set('CFBundleDisplayName', 'Nibble');
  set('CFBundleIdentifier', 'lk.uvi.nibble');
  set('CFBundleShortVersionString', VER);
  set('CFBundleVersion', VER);
  set('NSHumanReadableCopyright', 'Nibble by Uvindu Rajapakshe');
  set('LSApplicationCategoryType', 'public.app-category.entertainment');
  fs.rmSync(path.join(C, 'Resources/default_app.asar'), { force: true });
  fs.copyFileSync(path.join(root, 'public/nibble.icns'), path.join(C, 'Resources/electron.icns'));
  for (const [src, dest] of FILES) {
    const to = path.join(C, 'Resources/app', dest);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(root, 'public', src), to);
  }
  return app;
}

const arm64 = await buildArch('arm64');
const x64 = await buildArch('x64');
if (env('STOP_AFTER_APPS')) { console.log('apps built:', arm64, x64); process.exit(0); }

// one app for every Mac
const APP = path.join(OUT, 'Nibble.app');
const { makeUniversalApp } = await import('@electron/universal');
await makeUniversalApp({ x64AppPath: x64, arm64AppPath: arm64, outAppPath: APP, force: true });

// sign
const identity = env('MAC_IDENTITY');
const ent = path.join(root, 'tools/mac/entitlements.plist');
if (identity) {
  const { signAsync } = await import('@electron/osx-sign');
  await signAsync({
    app: APP, identity, platform: 'darwin', preAutoEntitlements: false,
    optionsForFile: () => ({ hardenedRuntime: true, entitlements: ent }),
  });
  run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', APP]);
} else {
  run('codesign', ['--force', '--deep', '--sign', '-', APP]);
}

// disk image: Nibble + a shortcut to Applications
const stage = path.join(OUT, 'dmg');
fs.mkdirSync(stage, { recursive: true });
run('ditto', [APP, path.join(stage, 'Nibble.app')]);
fs.symlinkSync('/Applications', path.join(stage, 'Applications'));
const DMG = path.join(OUT, 'Nibble.dmg');
run('hdiutil', ['create', '-volname', 'Nibble', '-srcfolder', stage, '-ov', '-format', 'UDZO', '-fs', 'HFS+', DMG]);
if (identity) run('codesign', ['--force', '--sign', identity, '--timestamp', DMG]);

// notarize (Apple checks it and issues a ticket) + staple the ticket to the dmg
let notarized = false;
if (identity && env('APPLE_API_KEY_P8_BASE64') && env('APPLE_API_KEY_ID') && env('APPLE_API_ISSUER_ID')) {
  const key = path.join(OUT, 'AuthKey.p8');
  fs.writeFileSync(key, Buffer.from(env('APPLE_API_KEY_P8_BASE64'), 'base64'));
  run('xcrun', ['notarytool', 'submit', DMG, '--key', key, '--key-id', env('APPLE_API_KEY_ID'), '--issuer', env('APPLE_API_ISSUER_ID'), '--wait', '--timeout', '30m']);
  run('xcrun', ['stapler', 'staple', DMG]);
  run('spctl', ['--assess', '--type', 'open', '--context', 'context:primary-signature', '--verbose=2', DMG]);
  fs.rmSync(key, { force: true });
  notarized = true;
}
fs.copyFileSync(DMG, path.join(OUT, `Nibble-${VER}.dmg`));
const status = `MAC_VER=${VER}\nMAC_SIGNED=${identity ? 'yes' : 'no'}\nMAC_NOTARIZED=${notarized ? 'yes' : 'no'}\n`;
if (process.env.GITHUB_ENV) fs.appendFileSync(process.env.GITHUB_ENV, status);
console.log(status);
