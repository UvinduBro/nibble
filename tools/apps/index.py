#!/usr/bin/env python3
"""Writes README.md on the apps branch from data/*.json (see publish.sh)."""
import json, os, sys

root = sys.argv[1]
GH = 'https://github.com/' + os.environ.get('GITHUB_REPOSITORY', 'UvinduBro/nibble')
ORDER = [('windows', 'Windows: Microsoft Store', 'Upload `Nibble.msix` in Partner Center → your app → Packages. The Store signs it.'),
         ('mac', 'Mac: Mac App Store', 'Upload `Nibble-MAS.pkg` with Apple\'s Transporter app (or set MAS_UPLOAD=1 to send it automatically).'),
         ('android', 'Android: Google Play', '`Nibble.apk` installs straight on a phone to try it. Upload `Nibble.aab` to Play Console.'),
         ('ios', 'iPhone: App Store', 'Signed builds go straight to TestFlight (IOS_UPLOAD=1); the .ipa is kept here too.')]


def size(n):
    return f'{n / 1048576:.1f} MB'


lines = ['# Nibble app files', '',
         'The latest store and phone builds, all in one place. This branch only holds this index; the files live in the',
         f'[**app-files** release]({GH}/releases/tag/app-files) (GitHub doesn\'t allow files over 100 MB in a branch).',
         'Updated automatically by the build workflows on `main`, when a workflow is run by hand, or by any commit whose message contains `[publish]`.', '',
         'Normal website downloads (Get-Nibble.exe, Nibble.dmg) are separate and update themselves.', '']
for key, title, how in ORDER:
    p = os.path.join(root, 'data', key + '.json')
    lines.append(f'## {title}')
    if not os.path.exists(p):
        lines += ['', 'Not built yet.', '']
        continue
    d = json.load(open(p, encoding='utf-8'))
    need = {'windows': 'add the three MSSTORE_* repository variables from Partner Center',
            'mac': 'add the MAS_* and APPLE_* secrets (Apple certificates + provisioning profile)',
            'android': 'add the ANDROID_* upload-key secrets; the .apk still installs for testing',
            'ios': 'add APPLE_TEAM_ID and the APPLE_API_KEY_* secrets'}[key]
    signed = 'yes' if d.get('signed') else f'not yet: {need} (docs/STORE_PUBLISHING.md)'
    lines += ['', f"Version **{d['version']}** · build {d['build']} · {d['date']} · from `{d['branch']}` "
              f"([`{d['commit'][:7]}`]({GH}/commit/{d['commit']}), [build log]({d['run']}))", '',
              f'Ready to upload to the store: {signed}', '']
    if d.get('files'):
        lines += ['| File | Size | SHA-256 |', '|---|---|---|']
        for f in d['files']:
            lines.append(f"| [{f['name']}]({f['url']}) | {size(f['size'])} | `{f['sha256'][:16]}…` |")
    else:
        lines.append('No file yet: this one appears once it can be signed.')
    lines += ['', how, '']
lines += ['---', 'How to publish each one: `docs/STORE_PUBLISHING.md` on `main`.', '']
open(os.path.join(root, 'README.md'), 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
