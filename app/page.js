import Desktop from '../components/Desktop';
import CharacterSelect from '../components/CharacterSelect';
import { Features, Quotes, Download } from '../components/Sections';
import SocialSection from '../components/SocialSection';
import About from '../components/About';

const CONTROLS = [
  ['Hover', 'Ears perk up and it watches your cursor'],
  ['Click', 'Purrs, blushes and gives you hearts'],
  ['Double-click', 'Backflip'],
  ['Drag + release', 'Throw it. It bounces, sometimes grabs the wall'],
  ['Right-click', 'Pet menu: special move, dance, nap, code with me, character, talk to friends'],
  ['Hold + release', 'Type a short message. Friends see your pet thinking, then saying it'],
  ['Friend\'s pet', 'Double-click to poke · hold to whisper · right-click to wave, heart or high five'],
  ['Tray icon', 'Double-click opens the Nibble Hub: account, friends, messages, pets, settings'],
  ['Ctrl + Alt + N', 'Hide / show every pet'],
];

const UNDER_HOOD = [
  ['Click-through overlay', 'A transparent, always-on-top layer that only catches the mouse when your cursor is over a pet. Your windows stay fully usable.'],
  ['Window radar', 'A tiny C# helper compiled on the fly by PowerShell streams window positions in z-order, so Nibble knows which title-bar edges are actually visible.'],
  ['Real physics', 'Gravity, one-way platforms, ballistic jumps, squash & stretch and wall bounces, all running at 60 fps on canvas.'],
  ['Private by design', 'App names and window titles are only read on your PC to pick a reaction. Social is opt-in: friends only ever get your username, your pet and the short messages you send.'],
  ['Firebase backend', 'Accounts via Firebase Authentication. Friends, presence and messages in Firestore, locked down by security rules so only friends can see you.'],
];

const STATS = [['17', 'pets to adopt'], ['8', 'special moves'], ['60', 'fps physics'], ['0', 'bytes of telemetry']];

export default function Home() {
  return (
    <main>
      <nav className="nav">
        <a href="#" className="logo"><img src="/favicon.svg" alt="" width={30} height={30} />nibble</a>
        <div className="nav-links">
          <a href="#desk">Try it</a>
          <a href="#crew">Characters</a>
          <a href="#social">Social</a>
          <a href="#features">Features</a>
          <a href="#about">About</a>
          <a href="/app">Sign in</a>
          <a href="#download" className="btn small">Download</a>
        </div>
      </nav>

      <header className="hero">
        <a href="#social" className="badge">New in v2.0 · Nibble Social: your friends’ pets visit your desktop →</a>
        <h1>A tiny geek that <em>lives on your windows.</em></h1>
        <p className="lead">Nibble and friends walk along your title bars, hop between windows, ride along when you drag them, pull off anime special moves and code with you in VS Code. Here's a whole Windows PC to try it on ↓</p>
        <div className="hero-cta">
          <a href="#download" className="btn">⬇ Get Nibble for Windows</a>
          <a href="#crew" className="btn ghost">Choose your pet</a>
        </div>
      </header>

      <section id="desk" className="wide"><Desktop /></section>

      <div className="statbar reveal">
        {STATS.map(([n, l]) => (<div key={l}><b>{n}</b><span>{l}</span></div>))}
      </div>

      <section id="social">
        <div className="sec-head reveal">
          <span className="kicker">New in 2.0 · Nibble Social</span>
          <h2>Your friends’ pets, on your desktop.</h2>
          <p>Make an account, add friends by username, and every online friend’s pet comes to hang out on your screen. Hold your pet to say something. They see it thinking, then talking.</p>
        </div>
        <SocialSection />
      </section>

      <section id="crew">
        <div className="sec-head reveal">
          <span className="kicker">01 · Choose your pet</span>
          <h2>Seventeen pets. Eight of them know special moves.</h2>
          <p>Pick a character to see its moves and stats, then drop it straight onto the desktop above. Every one is an original design, and every skin is just a palette and costume in <code>skins.js</code>.</p>
        </div>
        <CharacterSelect />
      </section>

      <section id="features">
        <div className="sec-head reveal">
          <span className="kicker">02 · What it does</span>
          <h2>It actually notices what you're doing.</h2>
        </div>
        <Features />
      </section>

      <section id="talks">
        <div className="sec-head reveal">
          <span className="kicker">03 · It talks</span>
          <h2>Every pet has its own voice.</h2>
          <p>Each character has its own lines, plus reactions to whatever app is in front of you. You can tune chattiness from silent to chatty.</p>
        </div>
        <Quotes />
      </section>

      <section id="controls" className="split">
        <div className="reveal">
          <div className="sec-head left">
            <span className="kicker">04 · Controls</span>
            <h2>Cheat sheet.</h2>
          </div>
          <dl className="controls">
            {CONTROLS.map(([k, v]) => (<div key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></div>))}
          </dl>
        </div>
        <div className="reveal">
          <div className="sec-head left">
            <span className="kicker">05 · Under the hood</span>
            <h2>Built like a real app.</h2>
          </div>
          <div className="hood">
            {UNDER_HOOD.map(([t, d]) => (<div key={t}><h3>{t}</h3><p>{d}</p></div>))}
          </div>
        </div>
      </section>

      <section id="download">
        <div className="sec-head reveal">
          <span className="kicker">06 · Download</span>
          <h2>Adopt the whole crew.</h2>
          <p>Free and made for fun. Installs per-user, no admin rights needed.</p>
        </div>
        <Download />
      </section>

      <section id="about">
        <div className="sec-head reveal">
          <span className="kicker">07 · The story</span>
          <h2>A tiny friend for your desktop, and for your friends’ too.</h2>
        </div>
        <About />
      </section>

      <footer className="foot">
        <span><img src="/favicon.svg" alt="" width={22} height={22} /> nibble · developed by Uvindu Rajapakshe</span>
        <span className="mono">4 bits of pure joy · {'</>'}</span>
      </footer>
    </main>
  );
}
