import Desktop from '../components/Desktop';
import CharacterSelect from '../components/CharacterSelect';
import { Quotes, Download } from '../components/Sections';
import About from '../components/About';
import PetFigure from '../components/PetFigure';
import release from '../public/version.json';
import './landing.css';

// The page is a desktop: every section is an app window, and a pet sits on its title bar,
// because that's what Nibble does on your real one.
function Win({ title, pet, dark, className = '', id, children }) {
  return (
    <section id={id} className={'lw' + (dark ? ' dark' : '') + (className ? ' ' + className : '')}>
      {pet && <div className="lw-perch" style={{ left: pet.x || '70%' }} aria-hidden><PetFigure skin={pet.skin} mood={pet.mood} look={pet.look} tint={pet.tint} acc={pet.acc} w={pet.w || 110} h={pet.h || 96} size={pet.size || 0.9} /></div>}
      <div className="lw-bar"><span className="lw-dots" aria-hidden><i /><i /><i /></span><span className="lw-title">{title}</span></div>
      <div className="lw-body">{children}</div>
    </section>
  );
}

const LOOKS = [
  { skin: 'mint', tint: 'nat', look: { sp: 'cat', of: 'hoodie', oc: '#ff7ab8' }, name: 'Cat in a hoodie' },
  { skin: 'mint', tint: 'nat', look: { sp: 'penguin', of: 'suit' }, name: 'Penguin in a suit' },
  { skin: 'mint', tint: 'nat', look: { sp: 'fox', of: 'scarf' }, acc: ['crown'], name: 'Fox with a crown' },
  { skin: 'mint', tint: '#b9a3ff', look: { sp: 'bunny', of: 'dress', oc: '#ffd23f' }, name: 'Bunny, any colour' },
  { skin: 'mint', tint: 'nat', look: { sp: 'dragon', of: 'cape' }, name: 'Dragon with a cape' },
];

const GAMES = ['Block Blast', 'Fruit Merge', '2048 Pets', 'Flappy Pet', 'Pet Wordle', 'Snack Snake', 'Snack Catch', 'Window Hop', 'Scoop Stack', 'Bug Bash', 'Pet Pairs', 'Copy the Dance'];

const CONTROLS = [
  ['Hover', 'Its ears perk up and it watches your cursor'],
  ['Click', 'Purrs, blushes and gives you hearts'],
  ['Double-click', 'A backflip'],
  ['Drag and let go', 'Throw it. It bounces, and sometimes grabs the wall'],
  ['Right-click', 'Pet menu: special move, dance, nap, code with me, music, talk to friends'],
  ['Hold, then let go', 'Type a short message. Friends see your pet thinking, then saying it'],
  ['A friend’s pet', 'Double-click to poke, hold to whisper, right-click to wave or high five'],
  ['Tray or menu bar icon', 'Opens the Nibble Hub: friends, music, games, customize, settings'],
  ['Ctrl + Alt + N  (⌘ + ⌥ + N)', 'Hide or show every pet'],
];

export default function Home() {
  return (
    <div className="lp">
      <header className="lp-menubar">
        <a href="#" className="lp-brand"><img src="/favicon.svg" alt="" width={26} height={26} />nibble</a>
        <nav className="lp-menu" aria-label="Sections">
          <a href="#try">Try it</a>
          <a href="#desktop">Features</a>
          <a href="#friends">Friends</a>
          <a href="#music">Music</a>
          <a href="#games">Games</a>
          <a href="#about">About</a>
        </nav>
        <div className="lp-menu-end">
          <a href="/app" className="lp-link">Sign in</a>
          <a href="#download" className="lp-btn small">Download</a>
        </div>
      </header>

      <main className="lp-desk">
        <div className="lp-hero">
          <div className="lp-hero-copy">
            <h1>Your desktop needs a pet.</h1>
            <p>Nibble lives on your windows. It walks along title bars, naps when you’re away, dances to your music and visits your friends’ screens. Dress it up, play games for points, and listen to music together.</p>
            <div className="lp-cta">
              <a href="#download" className="lp-btn">Download for Windows or Mac</a>
              <a href="/app" className="lp-btn ghost">Open Nibble in your browser</a>
            </div>
            <p className="lp-facts">Free. Windows 10/11 and macOS 12+. Version {release.version}.</p>
          </div>
          <Win id="try" title="nibble-demo.exe: drag the windows, throw the pets" dark className="lp-demo" pet={{ skin: 'mint', mood: 'wave', x: '78%', w: 120, h: 104, size: 1 }}>
            <Desktop />
          </Win>
        </div>

        <div className="lp-grid">
          <Win id="desktop" title="On your desktop" className="w7" pet={{ skin: 'ocean', mood: 'walk', x: '12%' }}>
            <h2>It walks on your windows.</h2>
            <p className="lead">The tops of your windows become its floor. It hops between them, rides along when you drag one, and only uses the parts you can actually see.</p>
            <ul className="lp-list two">
              <li><b>Real physics.</b> Throw it, watch it bounce, squash and stretch.</li>
              <li><b>Notices your apps.</b> Opens a tiny laptop in VS Code or Figma, dances to Spotify.</li>
              <li><b>Naps when you’re away</b> and says hi when you’re back.</li>
              <li><b>Break reminders</b> every 30 to 90 minutes: stretch, water, rest your eyes.</li>
              <li><b>Deadline reminders.</b> Your pet drops in a day and three hours before.</li>
              <li><b>Gets out of the way</b> in full-screen apps and games.</li>
            </ul>
          </Win>

          <Win id="customize" title="Customize" className="w5" pet={{ skin: 'mint', mood: 'happy', tint: 'nat', look: { sp: 'cat', of: 'hoodie', oc: '#4cc9f0' }, x: '64%' }}>
            <h2>Dress it any way you like.</h2>
            <p className="lead">12 animals, 8 anime characters, outfits in any colour, hats, makeup, emotes and special moves. Your look follows you to every computer, and friends see it too.</p>
            <div className="lp-looks">
              {LOOKS.map((l) => (
                <figure key={l.name}>
                  <PetFigure skin={l.skin} mood="idle" tint={l.tint} look={l.look} acc={l.acc} w={84} h={78} size={0.78} />
                  <figcaption>{l.name}</figcaption>
                </figure>
              ))}
            </div>
          </Win>

          <Win id="friends" title="Friends" className="w5" pet={{ skin: 'hikari', mood: 'wave', x: '18%' }}>
            <h2>Your friends’ pets visit you.</h2>
            <p className="lead">Add friends by username. When they’re online, their pet drops onto your desktop with a name tag.</p>
            <div className="lp-chat" aria-hidden>
              <div className="lp-pal"><span className="lp-say">ship it!! 🚀</span><PetFigure skin="mojo" mood="dance" w={110} h={104} size={0.9} /><b>@uvindu</b></div>
              <div className="lp-pal"><span className="lp-think"><i /><i /><i /></span><PetFigure skin="kumo" mood="work" w={110} h={98} size={0.9} /><b>@wagee</b></div>
            </div>
            <ul className="lp-list">
              <li><b>Hold your pet to talk.</b> Friends see it thinking, then saying it.</li>
              <li><b>Whispers and messages</b> just between you two. They disappear after 30 minutes.</li>
              <li><b>Pokes, hugs, high fives and ice cream</b>, acted out by your pets.</li>
              <li><b>People on your network.</b> Find Nibble users on the same Wi-Fi and say hi.</li>
            </ul>
          </Win>

          <Win id="music" title="Listen together" className="w7" pet={{ skin: 'lavender', mood: 'dance', x: '82%' }}>
            <h2>Same song, same second, with friends.</h2>
            <p className="lead">Start a room, invite friends, paste a YouTube video, a whole playlist or a Spotify link. Everyone hears it in sync, and every pet in the room puts on headphones and dances.</p>
            <div className="lp-player" aria-hidden>
              <span className="lp-art">▶</span>
              <span className="lp-track"><b>Weekend playlist</b><small>@wagee’s room, 3 listening</small><i className="lp-bar"><i /></i></span>
              <span className="lp-ctrl">🔀 ⏮ ⏸ ⏭ 🔁</span>
            </div>
            <ul className="lp-list two">
              <li><b>Shuffle and repeat</b> so the music keeps going.</li>
              <li><b>Anyone in the room</b> can play, pause, skip and add songs.</li>
              <li><b>Invites pop up</b> on your desktop. Click to join.</li>
              <li><b>Media keys work</b> for the whole room.</li>
            </ul>
          </Win>

          <Win id="games" title="Games and points" className="w7" pet={{ skin: 'goldie', mood: 'happy', x: '10%' }}>
            <h2>Play, earn points, climb the leaderboard.</h2>
            <p className="lead">Twelve quick games to play alone, plus live tic-tac-toe and connect four against friends. Every game earns points to unlock outfits, animals and moves.</p>
            <ul className="lp-games">{GAMES.map((g) => <li key={g}>{g}</li>)}</ul>
            <div className="lp-board" aria-hidden>
              <div><span>🥇</span><b>@uvindu</b><em>⭐ 2,480</em></div>
              <div><span>🥈</span><b>@wagee</b><em>⭐ 2,315</em></div>
              <div><span>🥉</span><b>@you?</b><em>⭐ 0</em></div>
            </div>
            <p className="small">A daily bonus that grows with your streak, gifts for friends, and a leaderboard ranked by points earned, so shopping never costs you your place.</p>
          </Win>

          <Win id="hub" title="Nibble Hub" className="w5" pet={{ skin: 'tetsu', mood: 'work', x: '60%' }}>
            <h2>One window for everything.</h2>
            <p className="lead">Open it from the tray or the menu bar: friends, messages, music, games, the leaderboard, deadlines, customize and settings. The same Hub runs in your browser at nibblex.vercel.app/app.</p>
            <ul className="lp-list">
              <li><b>Updates itself.</b> Website fixes arrive without reinstalling.</li>
              <li><b>Windows and Mac.</b> A setup app on Windows, a .dmg on Mac.</li>
              <li><b>Private by design.</b> App names stay on your PC. Friends only see your username, your pet and what you send.</li>
            </ul>
          </Win>

          <Win id="crew" title="Choose your pet" dark className="w12" pet={{ skin: 'kaze', mood: 'idle', x: '88%' }}>
            <h2>Pick a character, then drop it on the demo.</h2>
            <CharacterSelect />
          </Win>

          <Win id="talks" title="Voice lines" dark className="w7" pet={{ skin: 'peach', mood: 'happy', x: '14%' }}>
            <h2>Every pet has its own voice.</h2>
            <p className="lead">Lines for each character, plus reactions to whatever app you have open. Turn chattiness anywhere from silent to chatty.</p>
            <Quotes />
          </Win>

          <Win id="controls" title="Cheat sheet" className="w5">
            <h2>How to play with it.</h2>
            <dl className="lp-keys">
              {CONTROLS.map(([k, v]) => (<div key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></div>))}
            </dl>
          </Win>

          <Win id="download" title="Get Nibble" dark className="w12" pet={{ skin: 'mint', mood: 'dance', x: '50%', w: 120, h: 108, size: 1 }}>
            <h2>Adopt the whole crew. It’s free.</h2>
            <Download />
          </Win>

          <Win id="about" title="About" className="w12">
            <h2>A tiny friend for your desktop, and for your friends’ too.</h2>
            <About />
          </Win>
        </div>
      </main>

      <footer className="lp-dock">
        <span><img src="/favicon.svg" alt="" width={22} height={22} /> nibble, developed by Uvindu Rajapakshe</span>
        <nav aria-label="Links"><a href="/app">Web app</a><a href="#download">Download</a><a href="#about">About</a></nav>
      </footer>
    </div>
  );
}
