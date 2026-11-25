import PetFigure from '../components/PetFigure';
import StoreBadges from '../components/landing/StoreBadges';
import OldAnchors from '../components/landing/OldAnchors';
import { SitePage, Rise, Reviews, PricingSection, FinalSection, LOOKS, GAMES, jsonLd } from '../components/landing/HomeParts';
import { approvedReviews } from '../lib/reviews';
import { getPlan } from '../lib/billing';
import { buyable } from '../lib/premium';
import release from '../public/version.json';
import './landing.css';

// Home: hero ringed by pets, then one row per feature, each with a small scene that shows it working.

// pets around the hero: [skin, mood, left %, top px, size, bubble, phone spot]
// phone spots: [left %, top px] or [left %, 'b' + px from the bottom]; null = desktop only
const RING = [
  ['mint', 'idle', 6, 70, 1, 'hi there!', [50, 6]],
  ['mojo', 'jump', 88, 60, 0.95, '', [12, 30]],
  ['hikari', 'flip', 15, 330, 0.85, '', [88, 24]],
  ['yuki', 'sit', 86, 380, 0.9, 'pet me 🐾', [11, 212]],
  ['kumo', 'walk', 3, 520, 0.8, '', [89, 318]],
  ['peach', 'sit', 92, 500, 0.8, '', [20, 'b8']],
  ['volt', 'jump', 26, 610, 0.75, '', [50, 'b14']],
  ['goldie', 'idle', 70, 615, 0.75, '', [80, 'b8']],
];
const phoneSpot = (m) => {
  if (!m) return {};
  const [x, y] = m;
  return typeof y === 'string' ? { '--mx': `${x}%`, '--mb': `${y.slice(1)}px`, '--mt': 'auto' } : { '--mx': `${x}%`, '--mt': `${y}px`, '--mb': 'auto' };
};

function Tick({ children }) { return <li><span aria-hidden>✓</span>{children}</li>; }

function Row({ id, flip, tint, title, text, points, link, children }) {
  return (
    <section className={'hx-row' + (flip ? ' flip' : '')} id={id} style={{ '--t': `var(--c-${tint})` }}>
      <div className="lp-wrap hx-row-in">
        <div className="hx-copy" data-reveal>
          <h2>{title}</h2>
          <p>{text}</p>
          <ul>{points.map((p) => <Tick key={p}>{p}</Tick>)}</ul>
          {link && <a href={link[0]} className="hx-link">{link[1]}</a>}
        </div>
        <div className="hx-scene" aria-hidden data-reveal>{children}</div>
      </div>
    </section>
  );
}

function Screen({ label, children, className = '' }) {
  return (
    <div className={'hx-screen ' + className}>
      <div className="hx-screen-bar"><i /><i /><i /><span>{label}</span></div>
      <div className="hx-screen-body">{children}</div>
      <div className="hx-taskbar" />
    </div>
  );
}

export default async function Home() {
  const [reviews, plan] = await Promise.all([approvedReviews(), getPlan({ revalidate: 300 })]);
  // Premium prices go in the structured data only while Premium is really on sale
  const premium = plan.enabled ? buyable(plan) : [];
  return (
    <SitePage ld={jsonLd(reviews, premium)}>
      <OldAnchors />

      {/* ---------- hero ---------- */}
      <section className="hx-hero">
        <div className="hx-glow" aria-hidden />
        <div className="hx-ring" aria-hidden>
          {RING.map(([skin, mood, x, y, s, say, m], i) => (
            <span key={skin} className={'hx-ring-pet' + (m ? '' : ' hide-sm') + (i === 3 || i === 4 ? ' side' : '')} style={{ '--x': `${x}%`, '--y': `${y}px`, ...phoneSpot(m), '--i': i }}>
              {say && <em>{say}</em>}
              <PetFigure skin={skin} mood={mood} w={Math.round(150 * s)} h={Math.round(140 * s)} size={s * 1.4} />
            </span>
          ))}
        </div>
        <div className="lp-wrap hx-hero-in">
          <a href="/download" className="lp-pill"><span className="chip is-new">New</span>Now on the Microsoft Store<span className="pv"> · v{release.version}</span></a>
          <Rise text="Free desktop pet for Windows and Mac" />
          <p className="hx-lead rise-sub">A cute pet lives on your screen and keeps you company. Add your friends and your pets can talk, hug and listen to music together.</p>
          <div className="rise-sub"><StoreBadges center /></div>
          <ul className="hx-facts rise-sub">
            <li>Free forever</li><li>No ads</li><li>Windows 10 & 11, macOS</li>
          </ul>
        </div>
      </section>

      {/* ---------- 1. lives on your desktop ---------- */}
      <Row id="desktop" tint="mint" title="It lives on your desktop."
        text="Your pet walks along the top of your windows while you work. Drag a window and it rides along."
        points={['Naps when you step away, wakes up when you’re back', 'Click it for hearts, double-click for a backflip', 'Pick it up and throw it. It bounces.']}
        link={['/features', 'See everything it does']}>
        <Screen label="Your desktop" className="hx-desk">
          <div className="hx-win a"><b /><b /><b className="s" />
            <div className="hx-on-bar" style={{ left: '30%' }}><PetFigure skin="mint" mood="walk" w={110} h={100} size={1.15} /></div>
          </div>
          <div className="hx-win b"><b /><b className="s" /></div>
          <div className="hx-nap"><span>z z</span><PetFigure skin="hikari" mood="sleep" w={100} h={86} size={1} /></div>
          <span className="hx-cursor">↖</span>
        </Screen>
      </Row>

      {/* ---------- 2. friends ---------- */}
      <Row id="friends" flip tint="pink" title="Talk to friends through your pets."
        text="Type a message and your pet says it out loud on your friend’s screen. Their pet walks onto yours to reply."
        points={['Your friend’s pet visits your desktop with their name on it', 'Send a wave, hug, poke or a whisper with one click', 'Make groups for your besties, your team or your class']}
        link={['/blog/desktop-pet-with-friends', 'How talking with friends works']}>
        <div className="hx-chat">
          <Screen label="Your screen">
            <div className="hx-log"><em className="me">movie tonight? 🍿</em><em className="them">yes!! 🎉</em></div>
            <div className="hx-pair"><PetFigure skin="mint" mood="idle" w={90} h={84} size={1.05} /><span className="hx-visit"><PetFigure skin="peach" mood="jump" w={90} h={84} size={1.05} /><small>Alex</small></span></div>
          </Screen>
          <div className="hx-wire"><i /><i /><i /></div>
          <Screen label="Alex’s screen">
            <div className="hx-log"><em className="me">movie tonight? 🍿</em></div>
            <div className="hx-pair"><span className="hx-visit"><PetFigure skin="mint" mood="idle" w={90} h={84} size={1.05} /><small>You</small></span></div>
          </Screen>
        </div>
        <div className="hx-actions"><span>👋 Wave</span><span>🤗 Hug</span><span>👉 Poke</span><span>🤫 Whisper</span><span>✋ High five</span></div>
      </Row>

      {/* ---------- 3. music ---------- */}
      <Row id="music" tint="lav" title="Listen to music together."
        text="Open a music room, paste a YouTube or Spotify song, and everyone hears the same second at the same time."
        points={['Free rooms for up to 10 friends', 'Anyone in the room can add songs to the queue', 'Your pets dance while it plays']}
        link={['/blog/listen-to-music-together-online', 'How music rooms work']}>
        <div className="hx-player">
          <div className="hx-cover">♫</div>
          <div className="hx-track"><b>Friday night mix</b><span>Playing for 4 friends · in sync</span>
            <div className="hx-progress"><i /></div>
          </div>
          <div className="hx-dancers">
            {['lavender', 'mojo', 'peach', 'kumo'].map((s) => <PetFigure key={s} skin={s} mood="jump" w={96} h={92} size={1} />)}
          </div>
          <div className="hx-notes"><i>♪</i><i>♫</i><i>♪</i></div>
        </div>
      </Row>

      {/* ---------- 4. games ---------- */}
      <Row id="games" flip tint="sky" title="14 little games for your breaks."
        text="Quick games that open in a small window. Win points and spend them on outfits, animals and moves for your pet."
        points={['Pool, Ludo, Block Blast, Fruit Merge and more', 'Climb the weekly leaderboard with friends', 'Games take a minute or two, then back to work']}
        link={['/blog/free-mini-games-on-your-desktop', 'See all the games']}>
        <div className="hx-games">
          {GAMES.slice(0, 9).map((g, i) => <span key={g} style={{ '--i': i }}>{['🎱', '🎲', '🧱', '🍉', '🔢', '🐦', '🔤', '🐍', '🍪'][i]}<b>{g}</b></span>)}
          <div className="hx-points">+20 ⭐</div>
        </div>
      </Row>

      {/* ---------- 5. reminders ---------- */}
      <Row id="reminders" tint="butter" title="Gentle reminders, from your pet."
        text="Your pet taps you when it’s time for a break, a glass of water or a deadline. No pop-up alarms."
        points={['Stretch, water and eye-rest reminders', 'Add your own deadlines and to-dos', 'Turn any of them off in one click']}
        link={['/features', 'More about reminders']}>
        <div className="hx-remind">
          <div className="hx-pet-say l"><em>time to stretch! 🙆</em><PetFigure skin="goldie" mood="jump" w={140} h={130} size={1.45} /></div>
          <ul>
            <li><span>💧</span>Drink water<small>every hour</small></li>
            <li><span>🙆</span>Stretch break<small>3:00 PM</small></li>
            <li><span>📅</span>Report due<small>Friday</small></li>
          </ul>
        </div>
      </Row>

      {/* ---------- 6. make it yours ---------- */}
      <Row id="looks" flip tint="peach" title="Make it yours."
        text="Choose from 12 animals, the original Nibble or an anime crew of 8. Then dress it up in any colour."
        points={['Cats, foxes, penguins, bunnies and more', 'Hoodies, suits, dresses, scarves and crowns', 'Every pet has its own walk and special move']}
        link={['/pets', 'Meet all the pets']}>
        <div className="hx-looks">
          {LOOKS.map((l, i) => (
            <span key={i}><PetFigure skin={l.skin} tint={l.tint} look={l.look} acc={l.acc} mood="idle" w={92} h={100} size={1.15} /></span>
          ))}
          <div className="hx-swatches"><i style={{ background: '#ff7ab8' }} /><i style={{ background: '#7ee8c6' }} /><i style={{ background: '#ffd23f' }} /><i style={{ background: '#b9a3ff' }} /><i style={{ background: '#8fd3ff' }} /></div>
        </div>
      </Row>

      {/* ---------- makers → /about ---------- */}
      <section className="lp-sec">
        <div className="lp-wrap">
          <a href="/about" className="hc-makers" data-reveal>
            <div className="hc-makers-pets" aria-hidden>
              <span><PetFigure skin="mojo" mood="idle" w={120} h={112} size={1.3} /><em>Uvi</em></span>
              <span><PetFigure skin="peach" mood="sit" w={120} h={112} size={1.3} /><em>Wagee</em></span>
            </div>
            <div>
              <span className="lp-kicker">Meet the makers</span>
              <h2>Made by two friends in Colombo, Sri Lanka.</h2>
              <p>We read every message and ship new pets and fixes all the time.</p>
              <span className="lp-btn sm">Read our story</span>
            </div>
          </a>
        </div>
      </section>

      {reviews.length > 0 && <Reviews list={reviews} />}
      <PricingSection plan={plan} />
      <FinalSection />
    </SitePage>
  );
}
