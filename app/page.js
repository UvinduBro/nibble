import Desktop from '../components/Desktop';
import CharacterSelect from '../components/CharacterSelect';
import { Quotes, Download } from '../components/Sections';
import About from '../components/About';
import PetFigure from '../components/PetFigure';
import Globe, { PLACES } from '../components/landing/Globe';
import { Reveal, ThemeToggle } from '../components/landing/LandingFx';
import SiteFeedback from '../components/landing/SiteFeedback';
import release from '../public/version.json';
import './landing.css';

// Headline that rises in word by word on load.
function Rise({ text, as: Tag = 'h1', className }) {
  const words = text.split(' ');
  return (
    <Tag className={className} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} className="rise" aria-hidden style={{ '--d': `${0.08 + i * 0.07}s` }}>{w}{i < words.length - 1 ? ' ' : ''}</span>
      ))}
    </Tag>
  );
}

function Head({ kicker, title, sub, center }) {
  return (
    <header className={'lp-head' + (center ? ' center' : '')} data-reveal>
      {kicker && <span className="lp-kicker">{kicker}</span>}
      <h2>{title}</h2>
      {sub && <p>{sub}</p>}
    </header>
  );
}

const LOOKS = [
  { skin: 'mint', tint: 'nat', look: { sp: 'cat', of: 'hoodie', oc: '#ff7ab8' } },
  { skin: 'mint', tint: 'nat', look: { sp: 'penguin', of: 'suit' } },
  { skin: 'mint', tint: 'nat', look: { sp: 'fox', of: 'scarf' }, acc: ['crown'] },
  { skin: 'mint', tint: '#b9a3ff', look: { sp: 'bunny', of: 'dress', oc: '#ffd23f' } },
];

const GAMES = ['Pet Pool', 'Ludo', 'Block Blast', 'Fruit Merge', '2048 Pets', 'Flappy Pet', 'Pet Wordle', 'Snack Snake', 'Snack Catch', 'Window Hop', 'Scoop Stack', 'Bug Bash', 'Pet Pairs', 'Copy the Dance'];

const CONTROLS = [
  ['Hover', 'Its ears perk up and it watches your cursor'],
  ['Click', 'Purrs, blushes and gives you hearts'],
  ['Double-click', 'A backflip'],
  ['Drag and let go', 'Throw it. It bounces, and sometimes grabs the wall'],
  ['Right-click', 'Pet menu: special move, dance, nap, code with me, music, friends'],
  ['Hold, then let go', 'Type a short message. Friends see your pet say it'],
  ['A friend’s pet', 'Double-click to poke, hold to whisper, right-click to wave'],
  ['Tray or menu bar', 'Opens the Nibble Hub'],
  ['Ctrl + Alt + N', 'Hide or show every pet (⌘ + ⌥ + N on Mac)'],
];

const FAQ = [
  ['Is Nibble free?', 'Yes. Every pet, every game and every feature is free. There are no ads and nothing to buy with real money. Points are earned by playing.'],
  ['Will it slow my computer down?', 'No. The pets sleep when you’re away and step aside in full-screen apps and games. Nibble uses about as much as a browser tab.'],
  ['Which computers does it run on?', 'Windows 10 and 11, and macOS 12 or newer on Apple silicon and Intel. You can also open the Hub in any browser at nibblex.vercel.app/app.'],
  ['My Mac says it can’t check the app. What do I do?', 'Open System Settings, then Privacy & Security, and click Open Anyway next to Nibble. Or install with the one Terminal line on the download panel, which never shows that prompt.'],
  ['How do my friends see my pet?', 'Sign in, add them by username, and once they accept, your pet visits their desktop whenever you’re both online, wearing whatever you dressed it in.'],
  ['What can friends see about me?', 'Only your username, your pet and the messages you send. The names of the apps you use never leave your computer.'],
  ['How do I update?', 'Nibble checks for updates on its own and the Hub refreshes itself. To reinstall from scratch on Windows, download Get-Nibble.exe again from this page.'],
];

const STEPS = [
  ['Download', 'Get-Nibble.exe on Windows or Nibble.dmg on Mac. A pet lands on your desktop about a minute later.'],
  ['Make it yours', 'Pick an animal or a character, choose an outfit and colours, and give it a name. Your look follows you to every computer.'],
  ['Bring your friends', 'Add friends by username. Their pets visit your screen, and you can message, play and listen to music together.'],
];

const NAV = [['#try', 'Demo'], ['#features', 'Features'], ['#crew', 'Pets'], ['#download', 'Download'], ['#faq', 'FAQ'], ['#feedback', 'Feedback']];

function HubMock() {
  return (
    <div className="hub" aria-hidden>
      <div className="hub-top"><span className="hub-dots"><i /><i /><i /></span><span>Nibble Hub</span><span className="hub-live">● 3 friends online</span></div>
      <div className="hub-body">
        <nav className="hub-side">
          <b><img src="/favicon.svg" alt="" width={18} height={18} /> nibble</b>
          {[['🏠', 'Home', 1], ['👥', 'Friends'], ['💬', 'Messages'], ['🎧', 'Music'], ['🎨', 'Customize'], ['🎮', 'Games'], ['🏆', 'Leaderboard'], ['⚙️', 'Settings']].map(([ic, t, on]) => (
            <span key={t} className={on ? 'on' : ''}><em>{ic}</em>{t}</span>
          ))}
          <div className="hub-me">
            <PetFigure skin="mint" mood="happy" tint="nat" look={{ sp: 'cat', of: 'hoodie', oc: '#7ee8c6' }} w={54} h={50} size={0.5} />
            <span><b>@uvindu</b><small>Look synced ✓</small></span>
          </div>
        </nav>
        <div className="hub-main">
          <div className="hub-greet"><b>Good evening, Uvi</b><span className="chip is-live">Live today</span></div>
          <div className="hub-stats">
            <div><small>Points</small><b>2,480</b><i>+120 today</i></div>
            <div><small>Daily streak</small><b>6 days</b><i>Bonus ×1.6</i></div>
            <div><small>Friends online</small><b>3</b><i>@wagee is visiting</i></div>
          </div>
          <div className="hub-row">
            <div className="hub-card">
              <small>Listening together</small>
              <div className="hub-np"><span className="hub-art">♪</span><span><b>Weekend playlist</b><em>@wagee’s room, 3 listening</em></span></div>
              <i className="hub-prog"><i /></i>
              <div className="hub-chips"><span className="chip is-on">🔀 Shuffle</span><span className="chip is-on">🔁 Repeat all</span><span className="chip">⏮ ⏸ ⏭</span></div>
            </div>
            <div className="hub-card">
              <small>Leaderboard</small>
              <ol className="hub-lb">
                <li><span>🥇</span><b>@uvindu</b><em>2,480</em></li>
                <li><span>🥈</span><b>@wagee</b><em>2,315</em></li>
                <li><span>🥉</span><b>@nimal</b><em>1,940</em></li>
              </ol>
              <span className="chip is-new">New</span>
            </div>
          </div>
          <div className="hub-card hub-games">
            <small>Games</small>
            <div className="hub-chips">{['Block Blast', 'Fruit Merge', 'Pet Wordle', 'Snack Snake', 'Pet Pool', 'Ludo'].map((g) => <span key={g} className="chip">{g}</span>)}<span className="chip is-up">New: Pet Pool</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="lp" data-theme="dark">
      <Reveal />
      <header className="lp-nav">
        <a href="#" className="lp-brand"><img src="/favicon.svg" alt="" width={28} height={28} />nibble</a>
        <nav className="lp-links" aria-label="Sections">{NAV.map(([h, t]) => <a key={h} href={h}>{t}</a>)}</nav>
        <div className="lp-nav-end">
          <ThemeToggle />
          <a href="/app" className="lp-link">Sign in</a>
          <a href="#download" className="lp-btn sm">Download</a>
        </div>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-hero-glow" aria-hidden />
          <div className="lp-wrap">
            <a href="#features" className="lp-pill"><span className="chip is-new">New</span>Version {release.version}: shuffle, repeat and a points leaderboard</a>
            <Rise text="A desktop pet that walks, plays & visits your friends." />
            <p className="lp-sub rise-sub">Nibble lives on top of your windows. It naps when you’re away, dances to your music, codes along with you and drops onto your friends’ screens to say hi.</p>
            <div className="lp-cta rise-sub">
              <a href="#download" className="lp-btn">Download for Windows or Mac</a>
              <a href="/app" className="lp-btn ghost">Open in your browser</a>
            </div>
            <p className="lp-note rise-sub">Free for everyone. No ads. Windows 10/11 and macOS 12+.</p>
          </div>
          <div className="lp-wrap lp-mock" data-reveal>
            <div className="lp-perch p1" aria-hidden><PetFigure skin="mint" mood="wave" w={110} h={100} size={0.95} /></div>
            <div className="lp-perch p2" aria-hidden><PetFigure skin="mojo" mood="dance" w={100} h={96} size={0.85} /></div>
            <HubMock />
          </div>
        </section>

        <section className="lp-sec" id="try">
          <div className="lp-wrap">
            <Head kicker="Try it here" title="Not just a screensaver. It lives on your windows." sub="This is a real Nibble running in your browser. Drag the windows around, throw the pets, open the Start menu, or maximise a window underneath one." />
            <div className="lp-demo" data-reveal><Desktop /></div>
          </div>
        </section>

        <section className="lp-sec" id="pillars">
          <div className="lp-wrap">
            <Head title="Three things, done together." sub="A pet that keeps you company, friends who drop by, and something to play when you need a break." center />
            <div className="lp-pillars">
              {[
                ['(•ᴗ•)', 'Live', 'It walks along your title bars, rides windows you drag, naps when you leave and reminds you to stretch, drink water and meet your deadlines.'],
                ['<3', 'Connect', 'Friends’ pets visit your desktop with a name tag. Talk through your pets, whisper, high five, and find Nibble users on the same Wi-Fi.'],
                ['▶', 'Play', 'Fourteen quick games including Pool and Ludo, music rooms that stay in sync, and points that unlock outfits, animals and moves.'],
              ].map(([g, t, d], i) => (
                <article key={t} className="lp-pillar" data-reveal style={{ '--d': `${i * 0.08}s` }}>
                  <span className="lp-glyph" aria-hidden>{g}</span>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-sec" id="features">
          <div className="lp-wrap">
            <Head kicker="Everything inside" title="Built for your desktop, made for your friends." sub="One small app with a lot packed in. Here’s what you get on day one." />
            <div className="lp-feats">
              <article className="lp-feat" data-reveal>
                <div className="lp-feat-top"><span className="lp-num">01</span><span className="chip is-live">Live</span></div>
                <h3>Dress it any way you like</h3>
                <p>12 animals, 8 anime characters, outfits in any colour, hats, makeup, emotes and special moves. Friends see your look too.</p>
                <div className="lp-looks" aria-hidden>{LOOKS.map((l, i) => <PetFigure key={i} skin={l.skin} mood="idle" tint={l.tint} look={l.look} acc={l.acc} w={70} h={64} size={0.62} />)}</div>
              </article>
              <article className="lp-feat" data-reveal style={{ '--d': '.06s' }}>
                <div className="lp-feat-top"><span className="lp-num">02</span><span className="chip is-live">Live</span></div>
                <h3>Friends’ pets visit you</h3>
                <p>Hold your pet to talk and friends see it thinking, then saying it. Pokes, hugs, ice cream and private whispers that vanish after 30 minutes.</p>
                <div className="lp-chat" aria-hidden>
                  <div><span className="lp-say">ship it!! 🚀</span><PetFigure skin="mojo" mood="dance" w={76} h={72} size={0.62} /><b>@uvindu</b></div>
                  <div><span className="lp-think"><i /><i /><i /></span><PetFigure skin="kumo" mood="work" w={76} h={68} size={0.62} /><b>@wagee</b></div>
                </div>
              </article>
              <article className="lp-feat" data-reveal style={{ '--d': '.12s' }}>
                <div className="lp-feat-top"><span className="lp-num">03</span><span className="chip is-new">Updated</span></div>
                <h3>Listen together, in sync</h3>
                <p>Paste a YouTube video, a playlist or a Spotify link. Everyone in the room hears the same second, and every pet puts on headphones. Shuffle and repeat keep it going.</p>
                <div className="lp-player" aria-hidden><span className="hub-art">♪</span><span><b>Weekend playlist</b><i className="hub-prog"><i /></i></span><span className="lp-ctrl">🔀 ⏮ ⏸ ⏭ 🔁</span></div>
              </article>
              <article className="lp-feat" data-reveal>
                <div className="lp-feat-top"><span className="lp-num">04</span><span className="chip is-live">Live</span></div>
                <h3>Games and points</h3>
                <p>Fourteen quick games, now with Pet Pool and Ludo against the computer. Every game has a how-to-play guide, and a daily bonus grows with your streak.</p>
                <ul className="lp-tags" aria-label="Games">{GAMES.map((g) => <li key={g}>{g}</li>)}</ul>
              </article>
              <article className="lp-feat" data-reveal style={{ '--d': '.06s' }}>
                <div className="lp-feat-top"><span className="lp-num">05</span><span className="chip is-new">New</span></div>
                <h3>A leaderboard for bragging rights</h3>
                <p>Rank against your friends or everyone on Nibble. It counts every point you’ve ever earned, so spending points in the shop never costs you your place.</p>
                <ol className="hub-lb wide" aria-hidden>
                  <li><span>🥇</span><b>@uvindu</b><em>2,480</em></li>
                  <li><span>🥈</span><b>@wagee</b><em>2,315</em></li>
                  <li className="me"><span>#7</span><b>You</b><em>Play to climb</em></li>
                </ol>
              </article>
              <article className="lp-feat" data-reveal style={{ '--d': '.12s' }}>
                <div className="lp-feat-top"><span className="lp-num">06</span><span className="chip is-live">Live</span></div>
                <h3>One Hub for everything</h3>
                <p>Friends, messages, music, games, deadlines, customize and settings in one window from your tray or menu bar. The same Hub runs in your browser.</p>
                <ul className="lp-ticks">
                  <li>Updates itself, no reinstalling for fixes</li>
                  <li>Windows and Mac, plus the web</li>
                  <li>App names never leave your computer</li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section className="lp-sec" id="crew">
          <div className="lp-wrap">
            <Head kicker="Meet the crew" title="Pick a pet, then drop it on the demo." sub="Every character has its own walk, special move and voice. Choose one here and it lands on the desktop above." />
            <div className="lp-panel" data-reveal><CharacterSelect /></div>
            <div className="lp-split">
              <div className="lp-panel" data-reveal>
                <h3 className="lp-panel-h">Every pet has its own voice</h3>
                <p className="lp-panel-p">Lines for each character, plus reactions to whatever app you have open. Set chattiness anywhere from silent to chatty.</p>
                <Quotes />
              </div>
              <div className="lp-panel" data-reveal style={{ '--d': '.08s' }}>
                <h3 className="lp-panel-h">How to play with it</h3>
                <dl className="lp-keys">{CONTROLS.map(([k, v]) => (<div key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></div>))}</dl>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-sec" id="start">
          <div className="lp-wrap">
            <Head title="Up and running in three steps." center />
            <ol className="lp-steps">
              {STEPS.map(([t, d], i) => (
                <li key={t} data-reveal style={{ '--d': `${i * 0.1}s` }}>
                  <span className="lp-step-n">{i + 1}</span>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="lp-sec" id="reach">
          <div className="lp-wrap lp-reach">
            <div data-reveal>
              <Head kicker="Made in Sri Lanka" title="From Colombo to every desktop." sub="Nibble is built in Sri Lanka, and your pet can visit a friend anywhere. As long as you’re both online, it drops onto their screen in seconds." />
              <ul className="lp-places">{PLACES.map((p) => <li key={p.name}>{p.name}</li>)}<li>and wherever your friends are</li></ul>
            </div>
            <div className="lp-globe-wrap" data-reveal><Globe /></div>
          </div>
        </section>

        <section className="lp-sec" id="download">
          <div className="lp-wrap">
            <Head kicker={`Version ${release.version}`} title="Adopt the whole crew. It’s free." center />
            <div className="lp-panel lp-dl" data-reveal><Download /></div>
          </div>
        </section>

        <section className="lp-sec" id="faq">
          <div className="lp-wrap lp-faq-wrap">
            <Head title="Frequently asked questions" sub="Can’t find your answer? Send us a message in the feedback form below." />
            <div className="lp-faq">
              {FAQ.map(([q, a]) => (
                <details key={q} data-reveal>
                  <summary>{q}<span aria-hidden>+</span></summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-sec" id="feedback">
          <div className="lp-wrap lp-fb-wrap">
            <div data-reveal>
              <Head kicker="Feedback" title="Tell us what you think." sub="Love something, hate something, want something new, or found a bug? Send it here. Nibble is built by two people in Sri Lanka, and we read every message." />
              <ul className="lp-ticks">
                <li>No account needed</li>
                <li>Screenshots welcome (paste or attach)</li>
                <li>Already using Nibble? Hub → Feedback adds your version for you</li>
              </ul>
            </div>
            <div className="lp-panel" data-reveal style={{ '--d': '.08s' }}><SiteFeedback version={release.version} /></div>
          </div>
        </section>

        <section className="lp-sec" id="about">
          <div className="lp-wrap">
            <Head kicker="About" title="A tiny friend for your desktop, and your friends’ too." />
            <div className="lp-about" data-reveal><About /></div>
          </div>
        </section>

        <section className="lp-final">
          <div className="lp-wrap" data-reveal>
            <div className="lp-final-pets" aria-hidden>
              <PetFigure skin="ocean" mood="happy" w={90} h={84} size={0.8} />
              <PetFigure skin="mint" mood="dance" w={100} h={94} size={0.9} />
              <PetFigure skin="peach" mood="wave" w={90} h={84} size={0.8} />
            </div>
            <h2>Your new desktop buddy is one download away.</h2>
            <p>Come walk, play and hang out with us.</p>
            <div className="lp-cta center">
              <a href="#download" className="lp-btn">Download Nibble</a>
              <a href="/app" className="lp-btn ghost">Open in your browser</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <div className="lp-wrap lp-foot-grid">
          <div>
            <a href="#" className="lp-brand"><img src="/favicon.svg" alt="" width={26} height={26} />nibble</a>
            <p>A desktop pet that walks on your windows, visits your friends and plays music with you. Developed by Uvindu Rajapakshe in Sri Lanka.</p>
          </div>
          <nav aria-label="Product"><b>Product</b><a href="#download">Download</a><a href="/app">Web app</a><a href="#features">Features</a><a href="#crew">Pets</a></nav>
          <nav aria-label="Help"><b>Help</b><a href="#faq">FAQ</a><a href="#feedback">Report a bug</a><a href="#feedback">Suggest a feature</a><a href="/Nibble-Reinstall-Guide.pdf">Reinstall guide</a><a href="/version.json">Release notes</a></nav>
          <nav aria-label="Nibble"><b>Nibble</b><a href="#about">About</a><a href="/app">Sign in</a></nav>
        </div>
        <div className="lp-wrap lp-foot-base">© {new Date().getFullYear()} Nibble. Version {release.version}.</div>
      </footer>
    </div>
  );
}
