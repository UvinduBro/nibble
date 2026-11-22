# Nibble for Android and iPhone

A Flutter app around the live Nibble web app at `https://meetnibble.com/m` (see `lib/main.dart` and the website's
`lib/mobileBridge.js`). Tab bar, badges, notifications, Google sign-in (phone browser → `nibble://auth`),
Sign in with Apple (iPhone), offline screen and Android back are native; the pages come from the website, so
website updates reach the app straight away.

- Build: GitHub Actions → "Phone app (Android + iPhone)" (`.github/workflows/mobile.yml`): `.apk`, `.aab`, iOS.
- Locally: `flutter pub get`, then `flutter run` (add `--dart-define=NIBBLE_SITE=https://…` to test another site).
- Native project settings (ids, permissions, entitlements) are set by `tools/mobile/patch_native.py`; re-run it
  after `flutter create` or plugin upgrades.
- App ids: `com.meetnibble.app` (Android + iOS). Version: `version:` in `pubspec.yaml`.
- Publishing: `docs/STORE_PUBLISHING.md`.
