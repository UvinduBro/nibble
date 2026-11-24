import LegalPage from '../../components/landing/LegalPage';
import release from '../../public/version.json';
import { pageMetadata } from '../../lib/seo';
import { crumbsLd, faqLd, ldJson, SITE } from '../../lib/facts';

const HELP_QA = [
  ['Windows says “Windows protected your PC”. How do I install Nibble?', 'Click More info, check it says Get-Nibble.exe, then click Run anyway. Or install with PowerShell: irm https://meetnibble.com/install.ps1 | iex'],
  ['Microsoft Defender removed Nibble. What do I do?', 'Open Windows Security, go to Virus & threat protection, then Protection history, choose the Nibble entry and click Allow on device, then run the installer again.'],
  ['My Mac says Apple cannot check Nibble. How do I open it?', 'Open System Settings, then Privacy & Security, scroll to Security and click Open Anyway next to Nibble, then confirm with your password.'],
  ['My Mac says Nibble is damaged. What do I do?', 'Move Nibble to Applications, open Terminal and run: xattr -cr /Applications/Nibble.app, then open Nibble again.'],
];

export function generateMetadata() {
  return pageMetadata('installHelp', '/install-help');
}

// Why the warnings happen + exactly what to click. We never ask people to switch protection off for
// good: each fix allows Nibble once and leaves the rest of the computer protected.
export default function InstallHelp() {
  return (
    <LegalPage title="Installing Nibble: if Windows or your Mac blocks it" updated={`for version ${release.version}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([faqLd(HELP_QA), crumbsLd([['Install help', SITE + '/install-help']])]) }} />
      <p>Nibble is new and made by a small team, so Windows and macOS don’t recognise it yet. The first time you install it, your computer may warn you or stop it. That’s normal for new apps. The steps below allow <b>only Nibble</b> and keep the rest of your computer protected. You only need to do this once.</p>
      <p>Nibble is free, has no ads, and every file is checked (SHA-256) before it’s installed. Only download it from <b>meetnibble.com</b>.</p>

      <h2 id="windows">Windows 10 and 11</h2>

      <h3>1. Your browser says the file “isn’t commonly downloaded”</h3>
      <ul>
        <li><b>Edge:</b> in the downloads list, hover over <i>Get-Nibble.exe</i>, click <b>⋯</b> → <b>Keep</b>. If it asks again, click <b>Show more</b> → <b>Keep anyway</b>.</li>
        <li><b>Chrome:</b> in the downloads list click <b>Keep</b> (or <b>⋮</b> → <b>Download dangerous file</b>, then <b>Keep</b>).</li>
        <li><b>Firefox:</b> click the download arrow, then <b>Allow download</b>.</li>
      </ul>

      <h3>2. “Windows protected your PC” (blue SmartScreen window)</h3>
      <ol>
        <li>Click <b>More info</b> (small text under the message).</li>
        <li>Check it says <i>App: Get-Nibble.exe</i>, then click <b>Run anyway</b>.</li>
      </ol>
      <p>You won’t see this again for the same file.</p>

      <h3>3. Microsoft Defender removed or blocked it</h3>
      <ol>
        <li>Open <b>Start</b> → type <b>Windows Security</b> → open it.</li>
        <li>Go to <b>Virus &amp; threat protection</b> → <b>Protection history</b>.</li>
        <li>Find the entry for <i>Get-Nibble.exe</i> or <i>Nibble.exe</i>, click it, then <b>Actions</b> → <b>Allow on device</b> (or <b>Restore</b>).</li>
        <li>Run <i>Get-Nibble.exe</i> again.</li>
      </ol>

      <h3>4. “Smart App Control blocked an app” (Windows 11)</h3>
      <p>Smart App Control blocks every app that isn’t code-signed, and it has no “allow this one app” button. Use the <b>PowerShell install</b> below instead: it installs the same app without running the downloaded setup file.</p>
      <p>Only if that also fails: <b>Windows Security</b> → <b>App &amp; browser control</b> → <b>Smart App Control settings</b> → <b>Off</b>. Note that Windows can’t turn Smart App Control back on afterwards without resetting the PC, so we suggest the PowerShell install first.</p>

      <h3>5. Install with PowerShell (works when the .exe is blocked)</h3>
      <ol>
        <li>Right-click <b>Start</b> → <b>Terminal</b> (or <b>Windows PowerShell</b>). No admin rights needed.</li>
        <li>Paste this line and press Enter:<br /><code>irm https://meetnibble.com/install.ps1 | iex</code></li>
      </ol>
      <p>It downloads the same files, checks them, and installs Nibble to your user folder with Start menu and Desktop shortcuts.</p>

      <h3>6. Antivirus apps (Avast, AVG, Norton, McAfee, Kaspersky, Bitdefender…)</h3>
      <p>Some antivirus apps quarantine new apps they haven’t seen before. Open your antivirus, find <b>Quarantine</b> (or <b>Virus chest</b>), restore <i>Get-Nibble.exe</i> / <i>Nibble.exe</i>, and add an exception for the folder <code>%LOCALAPPDATA%\Programs\Nibble</code>. Then run the installer again.</p>

      <h3>Still shows “Electron” or the wrong icon?</h3>
      <p>Open the Nibble Hub → <b>Settings</b> → <b>Reinstall / update</b>. Nibble fixes its own name and icon on the next start.</p>

      <h2 id="mac">Mac (macOS 12 or newer)</h2>

      <h3>1. “Nibble can’t be opened because Apple cannot check it” / “Apple could not verify Nibble”</h3>
      <ol>
        <li>Click <b>Done</b> (or <b>OK</b>). Don’t move Nibble to the Bin.</li>
        <li>Open <b>System Settings</b> (Apple menu ) → <b>Privacy &amp; Security</b>.</li>
        <li>Scroll down to <b>Security</b>. You’ll see <i>“Nibble” was blocked to protect your Mac</i>. Click <b>Open Anyway</b>.</li>
        <li>Enter your Mac password (or use Touch ID), then click <b>Open Anyway</b> once more.</li>
      </ol>
      <p>The <b>Open Anyway</b> button only shows for about an hour after you try to open Nibble. If you don’t see it, open Nibble from Applications again, then go back to Privacy &amp; Security.</p>
      <p>On macOS 13 or older: in <b>Finder</b> → <b>Applications</b>, <b>right-click</b> (or Control-click) Nibble → <b>Open</b> → <b>Open</b>.</p>

      <h3>2. “Nibble is damaged and can’t be opened”</h3>
      <p>Nibble isn’t damaged: macOS says this when a downloaded app hasn’t been checked by Apple yet. Fix it once in Terminal:</p>
      <ol>
        <li>Make sure Nibble is in your <b>Applications</b> folder (drag it there from the .dmg first).</li>
        <li>Open <b>Terminal</b> (press <i>⌘ Space</i>, type <i>Terminal</i>, press Return).</li>
        <li>Paste this and press Return:<br /><code>xattr -cr /Applications/Nibble.app</code></li>
        <li>Open Nibble again.</li>
      </ol>

      <h3>3. Install with Terminal (no security prompts at all)</h3>
      <p>Paste this into <b>Terminal</b> and press Return. It downloads Apple’s own signed runtime, checks it, and puts Nibble in Applications:</p>
      <p><code>curl -fsSL https://meetnibble.com/install.sh | bash</code></p>

      <h3>4. Pets don’t show up, or Nibble opened but nothing happened</h3>
      <ul>
        <li>Nibble lives in the <b>menu bar</b> (top right of the screen), not the Dock. Click its icon → <b>Open Nibble Hub</b>.</li>
        <li>Pets hidden? Press <b>⌘ + ⌥ + N</b>.</li>
        <li>Want reminders and messages as notifications? <b>System Settings</b> → <b>Notifications</b> → <b>Nibble</b> → <b>Allow notifications</b>.</li>
        <li>To start Nibble when you log in: Nibble Hub → <b>Settings</b> → <b>Open Nibble when I log in</b>.</li>
      </ul>
      <p>Nibble doesn’t need Screen Recording, Accessibility or Full Disk Access. If anything asks for those in Nibble’s name, say no and tell us.</p>

      <h2>What we never ask you to do</h2>
      <ul>
        <li>Turn off your antivirus or Windows Security completely.</li>
        <li>Turn off Gatekeeper for every app (for example with <code>sudo spctl --master-disable</code>).</li>
        <li>Download Nibble from anywhere except meetnibble.com or our GitHub releases.</li>
      </ul>

      <h2>Still stuck?</h2>
      <p>Send us a message from the <a href="/contact">contact form</a> or <a href="/contact#feedback">report a bug</a> with a screenshot of the message you see. You can also follow the <a href="/Nibble-Reinstall-Guide.pdf">reinstall guide (PDF)</a>.</p>
    </LegalPage>
  );
}
