// Nibble exe branding: copies the Electron runtime to Nibble.exe with Nibble's name, version text
// and icon baked in, so Windows (taskbar, Task Manager, notifications) shows "Nibble", not "Electron".
// Run by the installer with the runtime itself:  ELECTRON_RUN_AS_NODE=1 electron.exe brand.js <src.exe> <dst.exe> <icon.ico> <version>
import * as fs from 'fs';
import * as PE from 'pe-library';
import * as ResEdit from 'resedit';

const [src, dst, ico, ver = '2.0.0'] = process.argv.slice(2);
try {
  const exe = PE.NtExecutable.from(fs.readFileSync(src), { ignoreCert: true });
  const res = PE.NtExecutableResource.from(exe);
  if (ico && fs.existsSync(ico)) {
    const icon = ResEdit.Data.IconFile.from(fs.readFileSync(ico));
    const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
    const id = groups.length ? groups[0].id : 1, lang = groups.length ? groups[0].lang : 1033;
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, id, lang, icon.icons.map((i) => i.data));
  }
  const vis = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
  const vi = vis.length ? vis[0] : ResEdit.Resource.VersionInfo.createEmpty();
  const langs = vi.getAllLanguagesForStringValues();
  const strings = {
    FileDescription: 'Nibble', ProductName: 'Nibble', CompanyName: 'Nibble', InternalName: 'Nibble',
    OriginalFilename: 'Nibble.exe', LegalCopyright: 'Nibble by Uvindu Rajapakshe', ProductVersion: ver, FileVersion: ver,
  };
  for (const l of langs.length ? langs : [{ lang: 1033, codepage: 1200 }]) vi.setStringValues(l, strings);
  const [a, b, c] = String(ver).split('.').map((n) => parseInt(n, 10) || 0);
  vi.setFileVersion(a, b, c, 0, langs.length ? langs[0].lang : 1033);
  vi.setProductVersion(a, b, c, 0, langs.length ? langs[0].lang : 1033);
  vi.outputToResourceEntries(res.entries);
  res.outputResource(exe);
  fs.writeFileSync(dst, Buffer.from(exe.generate()));
  console.log('branded ' + dst);
  process.exit(0);
} catch (e) {
  console.error('brand failed: ' + (e && e.message));
  process.exit(1);
}
