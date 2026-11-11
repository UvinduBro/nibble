# nibble-web

Showcase and download site for Nibble, the desktop pet. It's built with Next.js 16 and hosted on Vercel.

- `npm install` then `npm run dev`
- `public/nibble/engine/*`: the same pet engine the Windows app uses (pet brain, drawing, lines, skins). The site's live pets run this code.
- `public/app/*`: the desktop-only files the installer downloads.
- `/install.ps1` and `/install.cmd`: generated per request (`lib/installer.js`). They fetch the Electron runtime from GitHub, check its SHA-256, assemble the app into `%LOCALAPPDATA%\Programs\Nibble`, and add shortcuts plus an uninstaller.
- `/nibble.ico` and `/favicon.svg`: Nibble rendered from `lib/nibbleSvg.js`.

To ship a new version of the pet, edit the files in `public/` and redeploy. Everyone who reinstalls gets the update.
