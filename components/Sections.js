'use client';
import { useEffect, useState } from 'react';
import PetFigure, { useNibble } from './PetFigure';
import release from '../public/version.json';

const FEATURES = [
  { mood: 'walk', skin: 'ocean', t: 'Walks on every window', d: 'Window tops become platforms. It only uses the visible parts, skips anything covered by another window, and hops between them.' },
  { mood: 'wave', skin: 'hikari', t: 'Anime crew + special moves', d: 'Eight original anime-style characters, each with a signature move: shadow step, sparkle transform, iai dash, rocket boost, rage mode, spirit float, cloud surf, drop the beat.', tag: 'New' },
  { mood: 'thrown', skin: 'lava', t: 'Drag, throw, bounce', d: 'Real physics, wall bounces, the occasional wall-grab, and a dizzy, angry landing if you overdo it.' },
  { mood: 'work', skin: 'volt', t: 'Codes along with you', d: 'Open VS Code, Figma, Photoshop or Blender and it pulls out a tiny laptop and gets to work.' },
  { mood: 'dance', skin: 'lavender', t: 'Vibes to your music', d: 'Spotify in focus means headphones on and a dance break.' },
  { mood: 'happy', skin: 'kuro', t: 'Anime emotes', d: 'Sweat drops when you grab it, anger marks after a hard landing, blush when petted, speed lines when it runs.', tag: 'New' },
  { mood: 'sleep', skin: 'yuki', t: 'Naps when you\'re away', d: 'Uses system idle time: dozes off when you leave and says hi when you\'re back.' },
  { mood: 'idle', skin: 'tetsu', t: 'Break reminders', d: 'Every 30–90 minutes (your choice) it waves you down to stretch, drink water and rest your eyes.' },
];

export function Features() {
  return (
    <div className="features">
      {FEATURES.map((f) => (
        <article key={f.t} className="feat reveal">
          {f.tag && <span className="new">{f.tag}</span>}
          <PetFigure skin={f.skin} mood={f.mood} size={1} w={150} h={120} />
          <h3>{f.t}</h3>
          <p>{f.d}</p>
        </article>
      ))}
    </div>
  );
}

const TABS = [
  { k: 'char_mojo', label: 'Mojo', mood: 'dance', skin: 'mojo' },
  { k: 'char_kaze', label: 'Kaze', mood: 'idle', skin: 'kaze' },
  { k: 'char_hikari', label: 'Hikari', mood: 'wave', skin: 'hikari' },
  { k: 'char_tetsu', label: 'Tetsu', mood: 'idle', skin: 'tetsu' },
  { k: 'char_volt', label: 'Volt', mood: 'work', skin: 'volt' },
  { k: 'char_kuro', label: 'Kuro', mood: 'happy', skin: 'kuro' },
  { k: 'char_yuki', label: 'Yuki', mood: 'sleep', skin: 'yuki' },
  { k: 'char_kumo', label: 'Kumo', mood: 'wave', skin: 'kumo' },
  { k: 'code', label: 'In VS Code', mood: 'work', skin: 'peach' },
  { k: 'design', label: 'In Figma', mood: 'work', skin: 'lavender' },
  { k: 'ads', label: 'In Ads Manager', mood: 'wave', skin: 'goldie' },
  { k: 'lateNight', label: 'After midnight', mood: 'sleep', skin: 'midnight' },
];

export function Quotes() {
  const ready = useNibble();
  const [tab, setTab] = useState(TABS[0]);
  const [lines, setLines] = useState([]);
  useEffect(() => {
    if (!ready) return;
    const all = (window.NibbleLines.L[tab.k] || []).map((s) => s.split('{name}').join('Nibble'));
    setLines(all.slice().sort(() => Math.random() - 0.5).slice(0, 3));
  }, [ready, tab]);
  return (
    <div className="quotes reveal">
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.k} role="tab" aria-selected={t.k === tab.k} className={t.k === tab.k ? 'on' : ''} onClick={() => setTab(t)}>{t.label}</button>
        ))}
      </div>
      <div className="quote-stage">
        <PetFigure skin={tab.skin} mood={tab.mood} size={1.5} w={200} h={170} />
        <div className="bubbles">
          {lines.map((l, i) => <div key={tab.k + l} className="bubble" style={{ animationDelay: `${i * 0.12}s` }}>{l}</div>)}
        </div>
      </div>
    </div>
  );
}

export function Download() {
  const [origin, setOrigin] = useState('https://nibble-pearl.vercel.app');
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);
  const cmd = `irm ${origin}/install.ps1 | iex`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(cmd); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch (_) {}
  };
  return (
    <div className="dl reveal">
      <div className="dl-main">
        <div className="dl-pets">
          <PetFigure skin="mojo" mood="wave" size={1.2} w={130} h={130} />
          <PetFigure skin="mint" mood="wave" size={1.5} w={160} h={170} />
          <PetFigure skin="hikari" mood="happy" size={1.2} w={130} h={130} />
        </div>
        <div className="dl-cta">
          <a className="btn big" href="/Get-Nibble.exe" download="Get-Nibble.exe">⬇ Download Nibble {release.version} (.exe)</a>
          <p className="dl-meta">Windows 10 / 11 · 64-bit · installer + ~110 MB runtime · free</p>
          <div className="cmd">
            <span className="cmd-label">or paste into PowerShell · or grab the <a href="/install.cmd" download="Install Nibble.cmd"><u>.cmd script</u></a></span>
            <code>{cmd}</code>
            <button onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button>
          </div>
          <p className="dl-upd">Already have Nibble? Run the installer again. From v1.1 on, the tray menu has <b>Update Nibble</b>. Your pets and settings stay.</p>
          <a className="btn ghost dl-guide" href="/Nibble-Reinstall-Guide.pdf" target="_blank" rel="noopener">📄 How to reinstall the latest version</a>
        </div>
      </div>
      <div className="dl-bottom">
        <div className="changelog">
          <div className="kicker">What's new in {release.version}</div>
          <ul>{release.notes.map((n) => <li key={n}>{n}</li>)}</ul>
        </div>
        <ol className="steps">
          <li><b>Run Get-Nibble.exe.</b> A small Nibble setup window opens. First time only, Windows SmartScreen may say "unknown publisher" — click <i>More info → Run anyway</i> (it's safe; it just isn't code-signed yet).</li>
          <li><b>It fetches the runtime</b> (Electron, ~110 MB) from GitHub and checks its SHA-256 before installing — you'll see the progress bar fill.</li>
          <li><b>Nibble drops onto your screen</b>, installed to <code>%LOCALAPPDATA%\Programs\Nibble</code> with Start menu and Desktop shortcuts, and listed in <i>Add or remove programs</i>.</li>
          <li><b>Say hi to friends:</b> double-click the tray icon to open the Nibble Hub, sign in with Google or email and add friends by username.</li>
          <li><b>Uninstall</b> any time from <i>Settings → Apps</i>, or Start → <i>Uninstall Nibble</i>.</li>
        </ol>
      </div>
    </div>
  );
}
