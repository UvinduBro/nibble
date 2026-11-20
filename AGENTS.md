<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Nibble: project guide for coding agents

Read this first. It explains what Nibble is, how the pieces fit, where things live, what has been
built (and why), and the rules to follow. Keep it up to date: when you finish a piece of work, add
it to the **Changelog** at the bottom and update any section it touches.

Owner: Uvindu Rajapakshe ("Uvi"). Co-creator and tester: Wageesha Ruvangi ("Wagee").
Made in Colombo, Sri Lanka. Live at **https://meetnibble.com** (Vercel project `nibble`).

---

## 1. What Nibble is

A free **desktop pet app** for Windows and Mac with a social layer:

- An animated pet walks along the tops of your windows, naps when you're idle, reacts to the app
  you're using, and lands on the taskbar / Dock.
- **Nibble Social**: accounts, usernames, friends. Friends' pets visit your desktop, deliver
  messages, pokes, hugs; private 30-minute disappearing messages; deadlines + shared reminders.
- **Listen Together** music rooms (YouTube / Spotify, synced by server clock).
- Single-player **mini games** that earn **points** (⭐) to spend on looks (animals, outfits, colours, skills).
- **Nibble Premium** (optional Stripe subscription, default $5/year, off until the owner switches it on).
- A public website with download, docs, reviews, contact, and a full **admin dashboard**.

## 2. Repository map

One Next.js 16 app (React 19) on Vercel. Firebase (Auth + Firestore, **Spark free plan**) is the only
database. No custom backend server besides Next.js route handlers.

| Path | What it is |
|---|---|
| `app/page.js` | Home / landing page (server component; fetches approved reviews) |
| `app/app/` | Web app: Nibble Social in the browser (`SocialApp mode="web"`) |
| `app/hub/` | Same app loaded inside the desktop Hub window (`mode="desktop"`) |
| `app/admin/` | Admin dashboard (`components/social/AdminApp.js`) |
| `app/link/` | Desktop Google sign-in hand-off (posts ID token to the app on 127.0.0.1) |
| `app/about`, `desktop-pet`, `install-help`, `privacy`, `terms` | Public pages |
| `app/api/*` | Route handlers (see §6) |
| `app/og`, `app/mail-btn` | Generated images: share cards, email button picture (`next/og`) |
| `app/llms.txt`, `app/llms-full.txt` | Facts for AI assistants (AEO) |
| `app/robots.js`, `sitemap.js`, `manifest.js`, `layout.js` | SEO plumbing; metadata comes from `lib/seo.js` |
| `app/Get-Nibble.exe`, `Nibble.dmg`, `install.*`, `install-files.txt` | Installers / downloads |
| `components/social/` | The app UI: `SocialApp.js` (all app pages), `AdminApp.js` (all admin pages), `Auth.js`, `Music.js`, `Arcade.js`, `Wardrobe.js`, `Leaderboard.js`, `LiveDesk.js`, `Feedback.js`, `Groups.js`, `TeaRoom.js`, `useSocial.js`, `social.css` |
| `components/landing/`, `About.js`, `Sections.js`, `Desktop.js`, `PetFigure.js` | Website UI |
| `lib/social/` | Client logic: `social.js` (core), `firebaseAdapter.js`, `fakeAdapter.js` (local test mode), `music.js`, `wallet.js`, `games.js`, `lan.js`, `groups.js`, `tea.js`, `config.js` |
| `lib/` (server/shared) | `billing.js` (Stripe), `premium.js` (plan shape), `gcp.js` (service account + Firestore REST), `adminAuth.js`, `mail.js` (Resend/SMTP), `marketing.js`, `emailTemplates.js`, `reviews.js`, `seo.js`, `facts.js` (one source of truth for SEO/AEO), `installer.js`, `usage.js`, `reports.js`, `signup.js`, `shop.js`, `characters.js`, `stage.js`, `tea.js` (Tea Room constants/filters/masks), `teaCore.js` (Tea Room actions, shared by server + test mode), `teaServer.js` |
| `public/nibble/engine/` | The pet engine (plain JS, no build): `pet.js`, `draw.js`, `lines.js`, `skins.js`, `wardrobe.js`, `social-draw.js`. Used by the website **and** copied into the desktop app |
| `public/app/` | **Desktop app source** (Electron): `src/main.js`, `hub.js`, `preload.js`, `hubPreload.js`, `windowWatcher.js` (+ `helper/WinWatch.cs`), `nowPlaying.js`, `settings.js`, `renderer/` |
| `public/email/` | Email art cut from the flyer (logo, icons, peeking Nibble, flyer.jpg) |
| `public/version.json` | **Release notes + version** shown on the site and checked by the desktop app |
| `tools/` | `windows-setup/Setup.cs` (Get-Nibble.exe), `windows-runtime/build.ps1`, `mac/build.mjs`, `brand.src.mjs` |
| `.github/workflows/` | `mac-dmg.yml`, `win-runtime.yml`, `win-setup.yml` (run on push to `main` when their paths change) |
| `firestore.rules` | **Security rules. Not deployed automatically**: the owner pastes them into the Firebase console → Firestore → Rules → Publish |

## 3. How it works

### Desktop app (Electron 45, `public/app/`)
- `main.js`: transparent click-through always-on-top overlay window (pets), tray / menu-bar icon,
  settings (`settings.json` in userData), auto-update check (`/version.json` every 6 h), self-repair
  of missing files (`/install-files.txt`), Windows exe self-branding.
- **Windows**: `windowWatcher.js` compiles `WinWatch.cs` via PowerShell at runtime (no native modules)
  → window rectangles → pets walk on window tops. `nowPlaying.js` reads Windows media controls.
  App identity (name "Nibble", AUMID `lk.uvi.nibble`) is registered in HKCU (AppUserModelId,
  MuiCache, App Paths) once per version so Start/Search/notifications don't say "Electron".
- **Mac**: menu-bar app (Dock icon only while the Hub is open). `windowWatcher.js` `startMac()`
  runs a JXA (osascript) loop over CoreGraphics window list (no permission prompts). Pets walk on
  window tops and hop onto an estimated Dock platform. The overlay excludes the menu bar strip and
  uses `skipTransformProcessType` (otherwise the Hub loses its title-bar buttons in full screen).
- **Hub** (`hub.js`): a BrowserWindow that loads `SITE + '/hub'` (the web app) with a
  `window.nibbleDesktop` bridge (`hubPreload.js`). All IPC is sender-checked and sanitised.
- `SITE` in `main.js` is still **`https://nibblex.vercel.app`** (Google sign-in on `/link` needs the
  domain in Firebase authorized domains; switch to meetnibble.com only after confirming that).
- **Updating the desktop app**: edit `public/app/**`, bump `public/app/package.json` version and
  `public/version.json` (version, date, notes). Hub fixes ship instantly (it reloads on new
  deploys via `/api/build`); overlay/main changes need users to update (tray → Update Nibble).

### Sync / data flow
`Firestore ⇄ lib/social/social.js (in the web app / Hub page) ⇄ IPC (hub.js) ⇄ overlay pets (renderer/app.js)`
- Presence heartbeats in `presence/{uid}` (Saver mode slows them); friends watched live.
- Messages/emotes via `inbox/{uid}/items`; music rooms in `rooms/{hostUid}` (position from
  `pos` + `startedAt` on the server clock); points in `wallets/{uid}` (rules enforce caps).
- `fakeAdapter.js` + `NEXT_PUBLIC_NIBBLE_FAKE=1` = local in-browser backend for testing (no rules).

### Firestore collections (see `firestore.rules` for exact shapes)
`users`, `usernames`, `users/{uid}/friends`, `users/{uid}/private/{about,deadlines}`, `requests`,
`presence`, `inbox/{uid}/items`, `rooms`, `wallets`, `gifts`, `matches` (friend games, switched off),
`lan/{net}/members`, `signup`, `reports`, `reminders`, `admins` (console-only), `banned`,
`broadcast`/`broadcasts`, `config/app`, `config/premium` (public), `premium/{uid}` (server/admin
only), `billingCustomers/*` (server only, never readable from a browser; `billing/health` is a write test),
`reviews/{uid}`, `seo/site` (public), `groups/{gid}` (+ `msgs`), `teaRooms/{feed}/posts/{pid}` (+ `comments`;
server-written), server-only `teaAuthors`, `teaLimits`, `teaReacts`, `teaReports`, `teaHidden`, `teaFlags`.

### Groups and Tea Room
- **Groups** (`lib/social/groups.js`, `components/social/Groups.js`): up to 20 people, max 10 groups each. Only
  friends can be invited (rules check, one invite per write). Group chat in `groups/{gid}/msgs` (members
  only, `exp` = 24 h; expired ones are deleted by whoever opens the chat). Each message also bumps
  `chatAt`/`chatBy` on the group doc, which every member already watches → unread badge + desktop
  notification without extra listeners. Group actions: pack walk (`bring` every friend member's pet, then a
  dance), wave at all, Listen Together with the group, group points (one-off wallet reads).
- **Tea Room** (`lib/tea.js`, `lib/teaCore.js`, `lib/social/tea.js`, `components/social/TeaRoom.js`):
  feeds = `all` (Everyone) + one per group. **All writes go through `/api/tea`** (service account) so a
  masked post never stores its author; the author is in `teaAuthors` (server only). Mask = HMAC(secret,
  uid:thread) → animal + colour, stable within a thread (secret: `TEA_SALT` → `NET_SALT` → derived from
  the service key). Posts last 48 h (expired ones swept when someone posts), reactions (🍵😱🤫🧢✅),
  comments, daily prompt, report → hidden at 3 reports (text moved to `teaHidden`). Daily limits per
  person in `LIMITS`. Masked posts can't @mention, link, or share emails/phones. Admin switches in
  `config/app.tea` (`on`, `everyone`, `anon` (groups), `anonAll` (Everyone, off by default)) + `teaWords`.
  Admin → Inbox → Tea Room shows flags with the real author, latest Everyone posts, hide / restore /
  delete / suspend. Reading is one page of 20 per open (no live listener); the "new tea" dot is one
  1-doc read every 30 min. Test mode runs `teaCore` in the browser against the fake DB.

## 4. Website, admin and business features

- **Admin dashboard** (`/admin`): left sidebar groups — Insights (Overview, Users, Games & points,
  Firebase usage), Inbox (Reviews, Reports), Communicate (Announcements, Email, Marketing),
  Money (Premium), Grow (SEO), System (Settings). Each page has a description + Tips box.
  Admin = a doc at `admins/{uid}` created by hand in the Firebase console.
- **Email** (Resend, domain `meetnibble.com` verified, DNS on Spaceship): sender
  `no-reply@meetnibble.com`; contact-form mails to `hello@meetnibble.com` (Spacemail inbox).
  SMTP (Spacemail) is a fallback. Admin → Email = one-off emails / reply to reports.
- **Marketing** (Resend broadcasts): two lists (segments) — *Subscribers* (opt-in from website
  footer or app Settings → Nibble news) and *Imported contacts* (admin import from a JSON/CSV link
  or file, consent checkbox required). Templates in `lib/emailTemplates.js` in the flyer look;
  Gmail dark-mode safe (gradient backgrounds, blend-mode text, button is an image from `/mail-btn`).
- **Premium** (`lib/billing.js`, `lib/premium.js`, `app/api/billing/*`, `app/api/stripe/webhook`,
  `app/api/admin/premium`): Stripe Checkout + customer portal, no SDK. **Stripe keys live only in
  Vercel env** (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`); the admin page never shows or stores
  them. Set-up steps for the payment person: `docs/STRIPE_SETUP.md`. The webhook endpoint is created
  by hand in the Stripe dashboard (6 events, see `WEBHOOK_EVENTS`). Webhook verifies the signature
  (5-min tolerance) and re-fetches the subscription before writing `premium/{uid}`.
  Plan (`config/premium`): on/off, name, promo-codes toggle, default package, features, and up to 6
  **packages** (id, name, amount, currency, year/month/week, trial days, label, active, Stripe
  priceId). Packages are saved through the server (it creates the Stripe price; a new amount = new
  price, old one archived). Admin → Premium also: Stripe health checklist, promotion codes
  (coupon + code), subscribers with cancel at period end / end now / resume / sync, gifts.
  Trials only for accounts that never had Premium. Perks: badge, double daily bonus, music rooms
  for 20 (rules enforce bonus + room size).
- **Reviews** (`lib/reviews.js`): one per account from the app (Feedback page + Home prompt),
  pending until an admin approves; public section on the home page; AggregateRating JSON-LD only
  with ≥ 3 real approved reviews. **Never invent reviews or testimonials.**
- **SEO / AEO**: `lib/seo.js` (titles/descriptions/share images editable in Admin → SEO, stored in
  `seo/site`), `lib/facts.js` (shared facts → JSON-LD Organization/WebSite/SoftwareApplication/
  HowTo/FAQ, llms.txt). `/desktop-pet` targets "desktop pet app" searches. `*.vercel.app` hosts
  send `X-Robots-Tag: noindex`. IndexNow key file in `public/<key>.txt` (`lib/indexnow-key.js`).
- Install help page for SmartScreen/Defender/Gatekeeper blocks; About page with the founders.

## 5. Environment variables (Vercel, production)

Names only; never commit or print values.
`RESEND_API_KEY` (send-only), `RESEND_MARKETING_KEY` (contacts + broadcasts), `RESEND_SEGMENT_ID`,
`RESEND_IMPORT_SEGMENT_ID`, `MAIL_FROM`, `CONTACT_TO`, `SMTP_USER`, `SMTP_PASS`, `NET_SALT`
(secret salt for `/api/netid`), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`GCP_USAGE_KEY` (service-account JSON; also used for server Firestore writes unless
`FIREBASE_ADMIN_KEY` is set), `TEA_SALT` (optional; secret for Tea Room masks, falls back to `NET_SALT`), `NEXT_PUBLIC_GSC_VERIFY` (optional). (`BILLING_KEY` is no longer
used and can be deleted.) Firebase web config in `lib/social/config.js` is public.

## 6. API routes (all in `app/api/`)

`build` (deployed commit), `tea` (Tea Room actions), `feedback` (website reports/contact → Firestore REST + email), `netid`,
`oembed`, `mac-release`, `subscribe` (newsletter opt-in), `billing/{checkout,portal,status}`,
`stripe/webhook`, `admin/{usage,email,marketing,premium,seo,indexnow,tea}`. Admin routes check the
caller's Firebase ID token with `lib/adminAuth.js` (reads `admins/{uid}` with that token).

## 7. Rules and conventions

- **Work on the session's dev branch, then fast-forward `main` only when the owner asks to
  publish.** Pushing `main` deploys the website (Vercel) and may trigger the Mac/Windows CI builds.
- **After changing `firestore.rules`, tell the owner to publish them** (and offer the full file in
  copy-paste form). Features that need new rules fail until then.
- Firestore is on the free Spark plan (50k reads / 20k writes a day). Avoid new live listeners,
  polling, or per-item reads in loops; prefer one-off reads and caching.
- Security: never trust the browser for money, admin rights, or identity (server checks the
  Firebase token; price/account come from the server). Keep secrets server-side and encrypted.
  Admin-only Firestore data must stay unreadable to clients.
- User-facing copy: plain, friendly English; short sentences; no jargon. Comments explain *why*.
- Don't invent data (reviews, users, stats). Ask before outward actions (emails, DNS, payments).
- Version number: bump `public/app/package.json` + `public/version.json` only for real desktop
  releases (the owner asked to keep 2.0.22 for the pre-launch fixes).
- Test before publishing: `npx next build`; for UI, run `NEXT_PUBLIC_NIBBLE_FAKE=1 npx next dev`
  and click through with Playwright (phone + desktop sizes). Real Firebase/Stripe can't be reached
  from the cloud sandbox, so say clearly what was not tested live.
- Commit messages: summary line + bullet list of what changed and why.

## 8. Owner to-do / open items (as of 2026-11-19)

- Publish the latest `firestore.rules` (Premium, Reviews, SEO, Groups, Tea Room sections).
- Give the service account (shown in Admin → Premium) the **Cloud Datastore User** role (Premium **and the
  Tea Room** need it: every Tea Room post is written by the server).
- Stripe: follow `docs/STRIPE_SETUP.md` (keys in Vercel env, webhook, portal, test with 4242…, then live); consider Stripe Tax.
- Google Search Console + Bing Webmaster Tools: verify, submit `sitemap.xml`, request indexing.
- Add `meetnibble.com` to Firebase authorized domains, then switch desktop `SITE` to it.
- Firebase App Check (stops direct-to-Firestore spam on `reports`).
- Real social links for the founders on the About page.
- Separate passwords + 2FA for the shared team accounts (they were shared by email).

## 9. Changelog

Newest first. Add an entry for every piece of work.

- **2026-11-19** Groups + Tea Room. Groups: create (name + icon), invite friends, accept / decline /
  leave, owner rename / remove / delete, 24 h group chat with unread badges and desktop notifications,
  pack walk, wave at all, listen together, group points. Tea Room: Everyone feed + a feed per group,
  posts as yourself or masked (server-written, author hidden), reactions, comments, daily question,
  reports with auto-hide at 3, 48 h expiry, daily limits, blocked words. Admin → Tea Room (switches,
  blocked words, flags with real author, hide / restore / delete / suspend). New rules sections
  (groups, msgs, teaRooms, config/app `tea` + `teaWords`). Adapters gained `list()` / `watchQuery()`;
  `lib/gcp.js` gained `fsQuery()` / `fsIncrement()`. Hub notifications may open `groups` / `tea`
  (ships with the next desktop build).

- **2026-11-20** Desktop 2.0.23 released (version bump + notes for Groups / Tea Room; Hub
  notifications can open the `groups` and `tea` tabs). Published to `main`.

- **2026-11-19** Fix: accepting a friend request failed ("Not allowed") because the friends rule
  compared the second write (adding you to the requester's list) with the wrong user's name; it
  now always checks the username of the friend being added (`fid`).

- **2026-11-19** Premium: Stripe keys moved to Vercel env only (removed the admin key box and the
  encrypted key storage); multiple packages with trials and labels, package picker in the app;
  admin Stripe health checklist, promotion codes, cancel / resume / end-now subscriptions;
  `docs/STRIPE_SETUP.md` for the payment set-up. Rules: `config/premium` allows packages fields.

- **2026-11-19** Pre-launch fixes (version stays 2.0.22): admin page waits for account/admin check
  (no false "finish set-up" / "not an admin"), clear non-team message; "Waking up…" never hangs
  (12 s / error → reason + retry); sign-up username hint fixed; in-app browser Google sign-in
  hint; phone menu is one swipeable row, no sideways scroll. AGENTS.md + CLAUDE.md added.
- **2026-11-18** Reviews: rate in app, admin approval, home-page section, rating schema.
  SEO/AEO: `lib/facts.js`, llms.txt, AI crawler robots, JSON-LD, `/desktop-pet`, vercel.app
  noindex, IndexNow. About page moved to `/about` (founders off the home page).
- **2026-11-17** Nibble Premium with Stripe (admin switch, price, features, encrypted keys,
  webhook, gifts, perks). Emails stay dark in Gmail iOS dark mode. Marketing: contact import,
  four flyer-style templates, lists, scheduling. Admin sidebar redesign with tips. Admin → SEO
  (per-page meta, OG generator, Search Console). Install help page. Resend set-up (domain, keys),
  admin Email + Marketing, newsletter opt-in. Security headers, rules hardening (no name
  spoofing, size caps), NET_SALT, shared admin auth. Desktop 2.0.22: Windows app identity (not
  "Electron"), Mac Hub buttons in full screen, Mac window walking + Dock.
- **Before 2026-11-17** (summarised from git history): 2.0.2–2.0.21 desktop releases — private
  messaging, native installer, customization, admin panel v1/v2, About me + pet thoughts,
  deadlines/reminders, pet interactions, sounds, Listen Together, animals/outfits/games/points/
  shop/gifts, people on your network, Mac app + dmg CI, branded Windows runtime, leaderboard,
  music shuffle/repeat. Website: redesign, bug reports/feedback, sign-up questions, Firebase usage
  tab + Saver mode, launch on meetnibble.com (SEO, contact form, privacy/terms, analytics).
