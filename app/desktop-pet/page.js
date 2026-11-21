import PetFigure from '../../components/PetFigure';
import { pageMetadata } from '../../lib/seo';
import { ONE_LINER, PLATFORMS, FEATURES, STEPS, QA, VERSION, appLd, faqLd, howToLd, crumbsLd, ldJson } from '../../lib/facts';
import '../landing.css';

export function generateMetadata() {
  return pageMetadata('desktopPet', '/desktop-pet');
}

const GLANCE = [
  ['Price', 'Free, no ads · optional Premium subscription (see /pricing)'],
  ['Windows', 'Windows 10 and 11'],
  ['Mac', 'macOS 12 or newer, Apple silicon and Intel'],
  ['Browser', 'Nibble Hub at meetnibble.com/app'],
  ['Friends', 'Pets visit each other’s desktops'],
  ['Music', 'Listen Together rooms (YouTube, Spotify)'],
  ['Games', 'Pool, Ludo and more, for points'],
  ['Privacy', 'App names never leave your computer'],
  ['Latest version', VERSION],
];
const PAGE_QA = QA.filter(([q]) => !/^Who makes|^How do I contact/.test(q));

// /desktop-pet: answer-first page for "desktop pet app", "desktop pet for Windows / Mac" searches
export default function DesktopPetPage() {
  return (
    <div className="lp" data-theme="dark">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([appLd(), howToLd(), faqLd(PAGE_QA), crumbsLd([['Desktop pet app', 'https://meetnibble.com/desktop-pet']])]) }} />
      <header className="lp-nav">
        <a href="/" className="lp-brand"><img src="/logo.svg" alt="" width={34} height={34} />nibble</a>
        <nav className="lp-links" aria-label="Site"><a href="/">Home</a><a href="/#features">Features</a><a href="/#download">Download</a><a href="/about">About</a><a href="/#contact">Contact</a></nav>
        <div className="lp-nav-end"><a href="/app" className="lp-link">Sign in</a><a href="/#download" className="lp-btn sm">Download</a></div>
      </header>

      <main className="lp-aboutpage lp-dp">
        <section className="lp-sec">
          <div className="lp-wrap">
            <nav className="lp-crumbs" aria-label="Breadcrumb"><a href="/">Nibble</a> › <span>Desktop pet app</span></nav>
            <header className="lp-head center">
              <span className="lp-kicker">Desktop pet app</span>
              <h1 className="lp-about-title">Nibble: a free desktop pet for Windows and Mac</h1>
              <p>{ONE_LINER}</p>
            </header>
            <div className="lp-cta center">
              <a href="/#download" className="lp-btn">Download Nibble free</a>
              <a href="/app" className="lp-btn ghost">Try it in your browser</a>
            </div>
            <div className="lp-dp-pets" aria-hidden>
              <PetFigure skin="mint" mood="wave" w={120} h={110} size={1} />
              <PetFigure skin="mojo" mood="dance" w={110} h={104} size={0.9} />
              <PetFigure skin="peach" mood="happy" w={110} h={104} size={0.9} />
            </div>
          </div>
        </section>

        <section className="lp-sec">
          <div className="lp-wrap lp-dp-two">
            <div>
              <h2 className="lp-dp-h">What is a desktop pet?</h2>
              <p>A desktop pet is a small animated character that lives on your computer screen, on top of your other windows. It walks around, reacts to what you do and keeps you company while you work, study or play.</p>
              <p>Nibble takes the classic idea further: your pet walks along the top of real windows, notices the app you’re using, naps when you step away, and can visit your friends’ desktops, listen to music with them and play games for points.</p>
            </div>
            <div className="lp-panel">
              <h2 className="lp-dp-h sm">Nibble at a glance</h2>
              <dl className="lp-glance">{GLANCE.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
            </div>
          </div>
        </section>

        <section className="lp-sec">
          <div className="lp-wrap">
            <header className="lp-head center"><span className="lp-kicker">Features</span><h2>What Nibble does</h2></header>
            <div className="lp-values lp-dp-feats">
              {FEATURES.map(([t, d]) => <article key={t} className="lp-value"><b>{t}</b><p>{d}</p></article>)}
            </div>
          </div>
        </section>

        <section className="lp-sec">
          <div className="lp-wrap">
            <header className="lp-head center"><span className="lp-kicker">Get started</span><h2>How to install Nibble</h2><p>Works on {PLATFORMS}.</p></header>
            <ol className="lp-dp-steps">{STEPS.map(([t, d]) => <li key={t}><b>{t}</b><span>{d}</span></li>)}</ol>
            <p className="lp-dp-note">Windows or your Mac blocked the installer? See the <a href="/install-help">step-by-step install help</a>.</p>
          </div>
        </section>

        <section className="lp-sec">
          <div className="lp-wrap lp-faq-wrap">
            <header className="lp-head"><span className="lp-kicker">FAQ</span><h2>Desktop pet questions</h2></header>
            <div className="lp-faq">
              {PAGE_QA.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
            </div>
          </div>
        </section>

        <section className="lp-final">
          <div className="lp-wrap">
            <h2>Get your desktop pet.</h2>
            <p>Free for Windows and Mac. A pet lands on your desktop about a minute after you download it.</p>
            <div className="lp-cta center"><a href="/#download" className="lp-btn">Download Nibble</a><a href="/about" className="lp-btn ghost">Who makes Nibble</a></div>
          </div>
        </section>
      </main>

      <footer className="lp-foot"><div className="lp-wrap lp-foot-base">© {new Date().getFullYear()} Nibble · Made in Colombo, Sri Lanka · <a href="/desktop-pet">Desktop pet app</a> · <a href="/about">About</a> · <a href="/pricing">Pricing</a> · <a href="/refunds">Refunds</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></div></footer>
    </div>
  );
}
