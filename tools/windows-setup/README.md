Source of Get-Nibble.exe (served gzip+base64 from app/Get-Nibble.exe/route.js).

Build: mcs -target:winexe -platform:anycpu -win32icon:nibble.ico -r:System.Windows.Forms.dll -r:System.Drawing.dll -out:NibbleSetup.exe Setup.cs
Then gzip+base64 it into the route and update its SHA256.
