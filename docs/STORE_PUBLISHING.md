# Publishing Nibble to the app stores

Four store apps come out of this repository. The normal downloads on meetnibble.com are not affected: they keep updating themselves as before.

| Store | File | Built by | App id |
|---|---|---|---|
| Microsoft Store | `Nibble.msix` | GitHub Actions → "Microsoft Store (.msix)" | Identity from Partner Center |
| Mac App Store | `Nibble-MAS.pkg` | GitHub Actions → "Mac App Store (.pkg)" | `lk.uvi.nibble` |
| Google Play | `Nibble.aab` (and `Nibble.apk` to try on a phone) | GitHub Actions → "Phone app (Android + iPhone)" | `com.meetnibble.app` |
| Apple App Store (iPhone) | `Nibble.ipa` (sent straight to TestFlight) | same workflow | `com.meetnibble.app` |

**Where the files are:** the [`apps` branch](https://github.com/UvinduBro/nibble/tree/apps) shows the latest of each (version, build, signed or not) with download links. The files themselves are in the [`app-files` release](https://github.com/UvinduBro/nibble/releases/tag/app-files); a git branch can't hold files over 100 MB. Builds on `main`, and any workflow you run by hand, update both. Every run also keeps its files under **Actions → the run → Artifacts**.

## What's different in the store versions

- **Desktop store builds** carry a small `store.json`, which switches off Nibble's own updater, self-repair and Windows name fixes. The store updates the app instead. "Update Nibble" opens the store's updates page, and "Start with Windows" opens Windows' Startup apps list, where Nibble is listed. Everything else is the same app.
- **Phone apps** are a native app (tab bar, badges, notifications, Google and Apple sign-in) around the live web app at `meetnibble.com/m`. Website updates reach the phones straight away, without a store update.
- **Store rules already handled:**
  - Premium can't be bought in the phone apps; Premium bought on the website still works there.
  - Delete-your-account is in Settings, and a public page explains it at `meetnibble.com/delete-account`.
  - The Tea Room is hidden in the iPhone app unless you switch it on (Admin → Tea Room → "Show in the iPhone app").
  - Sign in with Apple is offered on iPhone.

## Before any store: one-time steps

1. **Publish the website changes.** The phone app loads `meetnibble.com/m`, which goes live when the `mobile-and-stores` branch is merged into `main`.
2. **Publish the Firestore rules** (Firebase console → Firestore → Rules → Publish). The new rules add the Tea Room iPhone switch.
3. **Firebase → Authentication → Sign-in method → Apple → Enable** (for Sign in with Apple on iPhone). For iPhone-only use, no Services ID is needed.
4. **Firebase → Authentication → Settings → Authorized domains** must include `nibblex.vercel.app` (Google sign-in on phones uses it) and `meetnibble.com`.
5. **Make a demo account** for the store reviewers, e.g. `@nibble_review`, with a friend or two so they can see messages. Every store asks for one.
6. **Take screenshots** on a real phone and PC: Home with the pet, Friends, Messages, Games, Customize. The stores show you the sizes they accept.

Links used in every listing:
- Privacy policy: `https://meetnibble.com/privacy`
- Terms: `https://meetnibble.com/terms`
- Support: `https://meetnibble.com/#contact` (email `hello@meetnibble.com`)
- Delete account: `https://meetnibble.com/delete-account`

---

## 1. Microsoft Store (Windows)

**Account:** Partner Center developer account. Registration is free for individuals and companies.

1. Go to **developer.microsoft.com/store/register** → Get started → Individual. Verify your ID.
2. In Partner Center → **Apps and games** → **New product** → **MSIX or PWA app** → reserve the name **Nibble** (try "Nibble Desktop Pet" if it's taken).
3. Open the app → **Product management → Product identity**. Copy these three values into GitHub → repository **Settings → Secrets and variables → Actions → Variables**:
   - `MSSTORE_IDENTITY_NAME` = Package/Identity/Name
   - `MSSTORE_PUBLISHER` = Package/Identity/Publisher (starts with `CN=`)
   - `MSSTORE_PUBLISHER_NAME` = Package/Properties/PublisherDisplayName
4. GitHub → **Actions → Microsoft Store (.msix) → Run workflow** (on `main`). Download `Nibble.msix`. The workflow already checks that the package installs and starts on Windows.
5. In Partner Center, start a **submission**:
   - **Pricing:** Free, all markets.
   - **Properties:** category Entertainment; privacy policy URL; support contact.
   - **Age ratings:** fill in the questionnaire. Nibble has chat between users, so answer yes to "users can interact".
   - **Packages:** upload `Nibble.msix`.
   - **Store listing:** description, at least 1 screenshot (more is better), app icon is taken from the package.
   - **Submission options → restricted capability `runFullTrust`:** explain: *"Nibble is a desktop app built with Electron. runFullTrust is needed to run as a normal Windows program: it shows the pet in a transparent always-on-top window and reads open window positions so the pet can walk on them."*
6. Submit. Certification usually takes a few days.

**Updates:** bump `public/app/package.json` version (as for a normal release), let the workflow build, upload the new `Nibble.msix` in a new submission.

---

## 2. Mac App Store

**Account:** Apple Developer Program, $99 a year (the same membership covers the iPhone app).

### One-time Apple set-up
1. **developer.apple.com → Certificates, IDs & Profiles → Identifiers:** make sure `lk.uvi.nibble` exists as an App ID (macOS).
2. **Certificates → +:** create an **Apple Distribution** certificate and a **Mac Installer Distribution** certificate (on a Mac: Keychain Access → Certificate Assistant → Request a Certificate From a Certificate Authority, upload the request, download both certificates, double-click to add).
3. In Keychain Access → My Certificates, select **both** certificates (with their keys) → right-click → **Export 2 items…** → `mas.p12` with a password.
4. **Profiles → +:** Mac App Store Connect (distribution) profile for `lk.uvi.nibble`, using the Apple Distribution certificate. Download it.
5. **App Store Connect → Apps → + New App** → macOS, name Nibble, bundle id `lk.uvi.nibble`, SKU `nibble-mac`.

### GitHub secrets (Settings → Secrets and variables → Actions → Secrets)
Run these on the Mac and paste the output into the secret:
- `MAS_CERT_P12_BASE64` ← `base64 -i mas.p12 | pbcopy`
- `MAS_CERT_PASSWORD` ← the .p12 password
- `MAS_PROVISION_PROFILE_BASE64` ← `base64 -i Nibble_Mac_App_Store.provisionprofile | pbcopy`
- `APPLE_TEAM_ID` ← the 10-character Team ID (developer.apple.com → Membership)
- `APPLE_API_KEY_P8_BASE64`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID` ← you may already have these for the .dmg. Otherwise: App Store Connect → Users and Access → Integrations → **App Store Connect API** → new key with **Admin** access, download the `.p8` once, `base64 -i AuthKey_XXXX.p8 | pbcopy`.

Optional variable `MAS_UPLOAD` = `1` sends every signed build to App Store Connect automatically.

### Build and submit
1. GitHub → **Actions → Mac App Store (.pkg) → Run workflow**. With the secrets in place the log says `MAS_SIGNED=yes`.
2. If `MAS_UPLOAD` isn't set, download `Nibble-MAS.pkg` and upload it with Apple's **Transporter** app.
3. In App Store Connect → your Mac app:
   - Pick the build, fill the listing, screenshots, App Privacy, age rating.
   - **Review notes**, for example: *"Nibble is a menu-bar app. After launch, a pet appears on the desktop and walks along window tops. Click the cat icon in the menu bar → Open Nibble Hub for accounts and friends. Demo account: … / …"*
   - Submit for review.

**Good to know:**
- The store version runs inside Apple's sandbox. Test it with TestFlight for Mac before you release: walking on windows and the Dock, the Hub, Google sign-in and Open at login. That can only be checked on a real Mac with the signed build.
- Each upload needs a higher build number. The workflow uses the GitHub run number, so that happens by itself.

---

## 3. Google Play (Android)

**Account:** Google Play Console, $25 one time. New **personal** accounts must run a closed test with at least 12 testers, opted in for 14 days in a row, before they can publish to everyone. Start that early. (Organization accounts don't have this rule.)

### Upload key (one time, keep it safe forever)
On any computer with Java:
```
keytool -genkeypair -v -keystore nibble-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias nibble
```
Then add GitHub secrets:
- `ANDROID_KEYSTORE_BASE64` ← `base64 -w0 nibble-upload.jks` (Mac: `base64 -i nibble-upload.jks`)
- `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD` ← the passwords you chose
- `ANDROID_KEY_ALIAS` ← `nibble`

Back up `nibble-upload.jks` and the passwords somewhere safe (password manager). Use **Play App Signing** (the default), so Google keeps the real signing key.

### Build and submit
1. GitHub → **Actions → Phone app (Android + iPhone) → Run workflow**. The Android artifact contains `Nibble.aab` and `README.txt`, which says "signed for Google Play: yes".
2. Play Console → **Create app** → Nibble, App, Free.
3. Set up the app (the dashboard lists every item):
   - **App access:** give the demo account.
   - **Ads:** no.
   - **Content rating:** questionnaire; users can chat.
   - **Target audience:** 13+.
   - **Data safety:** collected data is email, username, messages and other in-app content, app interactions, country (from sign-up), and crash/diagnostics if you add them later. Data is encrypted in transit, and people can ask for deletion with the delete URL above.
   - **Privacy policy URL.**
4. **Testing → Closed testing:** create a track, upload `Nibble.aab`, add at least 12 testers (Gmail addresses or a Google Group) and share the opt-in link. Keep them in for 14 days.
5. Then **Apply for production**, upload to Production, submit.

**Updates:** bump `version:` in `mobile/pubspec.yaml` (e.g. `1.0.1+…`), run the workflow, upload the new `.aab`. Only native changes need this; website changes reach the app by themselves.

---

## 4. Apple App Store (iPhone)

Same Apple Developer membership as the Mac app.

1. **developer.apple.com → Identifiers → +:** App ID `com.meetnibble.app`, and tick **Sign in with Apple**.
2. **App Store Connect → + New App** → iOS, name Nibble, bundle id `com.meetnibble.app`, SKU `nibble-ios`.
3. GitHub secrets: `APPLE_TEAM_ID` and the three `APPLE_API_KEY_*` (same as above; the key must have **Admin** access so the build can create its own signing certificate and profile). Add the variable `IOS_UPLOAD` = `1`.
4. GitHub → **Actions → Phone app (Android + iPhone) → Run workflow**. The iPhone job builds a signed `.ipa` and uploads it to App Store Connect. After Apple processes it (10–30 min) it appears in **TestFlight**. Install TestFlight on your iPhone and test.
5. In App Store Connect → your iPhone app:
   - **Screenshots** (iPhone 6.9" set at minimum), description, keywords, support and privacy URLs.
   - **App Privacy:** same answers as Google's Data safety. "Data used to track you": none.
   - **Age rating:** questionnaire; users can chat → usually 12+ or 13+.
   - **Review notes**, for example: *"Nibble is a social desktop-pet app: your pet lives on the Home tab; you add friends by username, message them, play mini games for points and dress your pet. Premium is a web subscription bought on our website; the app sells nothing and has no links to buy. Demo account: … / …"*
   - Pick the build → **Submit for review**.

**Review risks to know about:**
- **4.2 Minimum functionality:** apps that mostly show web pages can be rejected. Nibble has a native tab bar, notifications, native sign-in and offline handling, which usually passes. If Apple pushes back, reply with what the app does natively; more native screens can be added.
- **1.2 User-generated content:** the app has reporting (Tea Room, Feedback), blocking by removing friends, and admin moderation. Mention this in the review notes. Keep the Tea Room hidden on iPhone until the app is approved.
- **3.1.1 Payments:** handled. No buying in the app.

---

## Not tested yet (needs your accounts)

- Signed builds for all four stores. The pipelines are ready; they switch on once the secrets above are added.
- The Mac App Store sandbox on a real Mac (TestFlight for Mac).
- Sign in with Apple and Google sign-in on real phones. Email sign-in works the same as on the website.
- Notifications on iPhone arrive while the app is open or just closed. Real push notifications when the app has been closed for a while need Firebase Cloud Messaging and a small server part; that can be a next step.
