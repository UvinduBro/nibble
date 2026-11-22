// Builds Nibble for the Mac App Store: Nibble-MAS.pkg (universal: Apple silicon + Intel).
// Runs on a GitHub macOS runner (.github/workflows/mas.yml). Differences from the .dmg (build.mjs):
//  - Electron's "mas" edition (no private Apple APIs), checked against Electron's published SHA-256 list
//  - App Sandbox entitlements (tools/mac/entitlements.mas*.plist) + the Mac App Store provisioning profile
//  - store.json in the app → Nibble's own updater is off (the App Store updates it)
//  - signed with "Apple Distribution" and packed as an installer .pkg signed with "Mac Installer Distribution"
// Without the certificates it still builds an unsigned .app + .pkg, to check that everything packs.
//
// env: MAS_APP_IDENTITY, MAS_INSTALLER_IDENTITY (found by the workflow), MAS_PROFILE (path), APPLE_TEAM_ID,
//      BUILD_NUMBER (CFBundleVersion, must go up for every upload)
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const run = (cmd, args, opt = {}) => { console.log('$', cmd, args.join(' ')); return execFileSync(cmd, args, { stdio: 'inherit', ...opt }); };
const env = (k) => (process.env[k] || '').trim();
const root = process.cwd();
const inst = fs.readFileSync(path.join(root, 'lib/installer.js'), 'utf8');
const EVER = inst.match(/ELECTRON = \{ version: '([\d.]+)'/)[1];
const FILES = [...inst.matchAll(/\['(\/[^']+)', '([^']+)'\]/g)].map((m) => [m[1], m[2]]);
if (FILES.length < 10) throw new Error('file list not found in lib/installer.js');
const VER = JSON.parse(fs.readFileSync(path.join(root, 'public/app/package.json'), 'utf8')).version;
const BUILD = env('BUILD_NUMBER') || '1';
const TEAM = env('APPLE_TEAM_ID') || 'TEAMID0000';
const OUT = path.join(root, 'dist-mas');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const base = `https://github.com/electron/electron/releases/download/v${EVER}/`;
const sums = await (await fetch(base + 'SHASUMS256.txt')).text();

async function buildArch(arch) {
  const name = `electron-v${EVER}-mas-${arch}.zip`;
  const want = (sums.match(new RegExp(`^([0-9a-f]{64}) \\*?${name.replace(/[.]/g, '\\.')}$`, 'm')) || [])[1];
  if (!want) throw new Error('no checksum for ' + name);
  const zip = path.join(OUT, name);
  const res = await fetch(base + name);
  if (!res.ok) throw new Error('download failed ' + name);
  fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  const sha = crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex');
  if (sha !== want) throw new Error(`checksum mismatch for ${name}`);
  const dir = path.join(OUT, arch);
  run('ditto', ['-x', '-k', zip, dir]);
  fs.rmSync(zip);
  const app = path.join(dir, 'Nibble.app');
  fs.renameSync(path.join(dir, 'Electron.app'), app);
  const C = path.join(app, 'Contents');
  fs.renameSync(path.join(C, 'MacOS/Electron'), path.join(C, 'MacOS/Nibble'));
  const P = path.join(C, 'Info.plist');
  const set = (k, v, type = '-string') => run('plutil', ['-replace', k, type, v, P]);
  set('CFBundleExecutable', 'Nibble');
  set('CFBundleName', 'Nibble');
  set('CFBundleDisplayName', 'Nibble');
  set('CFBundleIdentifier', 'lk.uvi.nibble');
  set('CFBundleShortVersionString', VER);
  set('CFBundleVersion', BUILD);
  set('NSHumanReadableCopyright', 'Nibble by Uvindu Rajapakshe');
  set('LSApplicationCategoryType', 'public.app-category.entertainment');
  set('LSMinimumSystemVersion', '12.0');
  set('ElectronTeamID', TEAM);
  set('ITSAppUsesNonExemptEncryption', 'false', '-bool');
  fs.rmSync(path.join(C, 'Resources/default_app.asar'), { force: true });
  fs.copyFileSync(path.join(root, 'public/nibble.icns'), path.join(C, 'Resources/electron.icns'));
  for (const [src, dest] of FILES) {
    const to = path.join(C, 'Resources/app', dest);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(root, 'public', src), to);
  }
  fs.writeFileSync(path.join(C, 'Resources/app/store.json'), '{"store":"mas"}');
  return app;
}

const arm64 = await buildArch('arm64');
const x64 = await buildArch('x64');
const APP = path.join(OUT, 'Nibble.app');
const { makeUniversalApp } = await import('@electron/universal');
await makeUniversalApp({ x64AppPath: x64, arm64AppPath: arm64, outAppPath: APP, force: true });

// entitlements with the team id
const ent = (f) => {
  const p = path.join(OUT, path.basename(f));
  fs.writeFileSync(p, fs.readFileSync(path.join(root, 'tools/mac', f), 'utf8').replace(/__TEAM_ID__/g, TEAM));
  return p;
};
const parent = ent('entitlements.mas.plist');
const child = ent('entitlements.mas.child.plist');

const appId = env('MAS_APP_IDENTITY');
const pkgId = env('MAS_INSTALLER_IDENTITY');
const profile = env('MAS_PROFILE');
let signed = false;
if (appId && profile) {
  const { signAsync } = await import('@electron/osx-sign');
  await signAsync({
    app: APP, identity: appId, platform: 'mas', type: 'distribution', provisioningProfile: profile, preAutoEntitlements: false,
    optionsForFile: (file) => ({ hardenedRuntime: false, entitlements: path.resolve(file) === path.resolve(APP) ? parent : child }),
  });
  run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', APP]);
  run('codesign', ['-d', '--entitlements', ':-', APP]);
  signed = true;
}

const PKG = path.join(OUT, 'Nibble-MAS.pkg');
run('productbuild', ['--component', APP, '/Applications', ...(signed && pkgId ? ['--sign', pkgId] : []), PKG]);
if (signed && pkgId) run('pkgutil', ['--check-signature', PKG]);
fs.copyFileSync(PKG, path.join(OUT, `Nibble-MAS-${VER}-${BUILD}.pkg`));
const status = `MAS_VER=${VER}\nMAS_BUILD=${BUILD}\nMAS_SIGNED=${signed && pkgId ? 'yes' : 'no'}\n`;
if (process.env.GITHUB_ENV) fs.appendFileSync(process.env.GITHUB_ENV, status);
console.log(status);
