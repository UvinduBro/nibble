`public/app/brand.js` is `tools/brand.src.mjs` bundled with esbuild (resedit + pe-library, MIT):

    npm i resedit@2 pe-library esbuild
    npx esbuild tools/brand.src.mjs --bundle --platform=node --format=cjs --target=node18 --minify --outfile=public/app/brand.js

The installer runs it with the Electron runtime itself (`ELECTRON_RUN_AS_NODE=1 electron.exe brand.js electron.exe Nibble.exe nibble.ico <version>`)
to write Nibble.exe with Nibble's name, version text and icon.
