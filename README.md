# Nibble app files

The latest store and phone builds, all in one place. This branch only holds this index; the files live in the
[**app-files** release](https://github.com/UvinduBro/nibble/releases/tag/app-files) (GitHub doesn't allow files over 100 MB in a branch).
Updated automatically by the build workflows on `main`, when a workflow is run by hand, or by any commit whose message contains `[publish]`.

Normal website downloads (Get-Nibble.exe, Nibble.dmg) are separate and update themselves.

## Windows: Microsoft Store

Version **2.0.23** · build 4 · 2026-11-22 18:39 UTC · from `mobile-and-stores` ([`25c708a`](https://github.com/UvinduBro/nibble/commit/25c708a7c2732322062cb745c579e4aba4b9bdda), [build log](https://github.com/UvinduBro/nibble/actions/runs/45056210562))

Ready to upload to the store: not yet: add the three MSSTORE_* repository variables from Partner Center (docs/STORE_PUBLISHING.md)

| File | Size | SHA-256 |
|---|---|---|
| [Nibble.msix](https://github.com/UvinduBro/nibble/releases/download/app-files/Nibble.msix) | 155.5 MB | `8c8660f9e75b699c…` |

Upload `Nibble.msix` in Partner Center → your app → Packages. The Store signs it.

## Mac: Mac App Store

Version **2.0.23** · build 4 · 2026-11-22 18:39 UTC · from `mobile-and-stores` ([`25c708a`](https://github.com/UvinduBro/nibble/commit/25c708a7c2732322062cb745c579e4aba4b9bdda), [build log](https://github.com/UvinduBro/nibble/actions/runs/45056210578))

Ready to upload to the store: not yet: add the MAS_* and APPLE_* secrets (Apple certificates + provisioning profile) (docs/STORE_PUBLISHING.md)

| File | Size | SHA-256 |
|---|---|---|
| [Nibble-MAS.pkg](https://github.com/UvinduBro/nibble/releases/download/app-files/Nibble-MAS.pkg) | 210.8 MB | `498fc640a699e365…` |

Upload `Nibble-MAS.pkg` with Apple's Transporter app (or set MAS_UPLOAD=1 to send it automatically).

## Android: Google Play

Version **1.0.0** · build 11 · 2026-11-22 18:43 UTC · from `mobile-and-stores` ([`25c708a`](https://github.com/UvinduBro/nibble/commit/25c708a7c2732322062cb745c579e4aba4b9bdda), [build log](https://github.com/UvinduBro/nibble/actions/runs/45056210555))

Ready to upload to the store: not yet: add the ANDROID_* upload-key secrets; the .apk still installs for testing (docs/STORE_PUBLISHING.md)

| File | Size | SHA-256 |
|---|---|---|
| [Nibble.apk](https://github.com/UvinduBro/nibble/releases/download/app-files/Nibble.apk) | 44.6 MB | `b17e1cdb9368586b…` |
| [Nibble.aab](https://github.com/UvinduBro/nibble/releases/download/app-files/Nibble.aab) | 45.2 MB | `2ffd542ec1f9334d…` |

`Nibble.apk` installs straight on a phone to try it. Upload `Nibble.aab` to Play Console.

## iPhone: App Store

Version **1.0.0** · build 11 · 2026-11-22 18:42 UTC · from `mobile-and-stores` ([`25c708a`](https://github.com/UvinduBro/nibble/commit/25c708a7c2732322062cb745c579e4aba4b9bdda), [build log](https://github.com/UvinduBro/nibble/actions/runs/45056210555))

Ready to upload to the store: not yet: add APPLE_TEAM_ID and the APPLE_API_KEY_* secrets (docs/STORE_PUBLISHING.md)

No file yet: this one appears once it can be signed.

Signed builds go straight to TestFlight (IOS_UPLOAD=1); the .ipa is kept here too.

---
How to publish each one: `docs/STORE_PUBLISHING.md` on `main`.
