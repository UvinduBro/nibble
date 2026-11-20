import { Story, Team } from '../../components/About';
import { pageMetadata } from '../../lib/seo';
import { orgLd, crumbsLd, ldJson, SITE, ONE_LINER } from '../../lib/facts';
import '../landing.css';

export function generateMetadata() {
  return pageMetadata('about', '/about');
}

// /about: the story of Nibble and the two people who make it (moved off the home page)
export default function AboutPage() {
  return (
    <div className="lp" data-theme="dark">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([
        { '@context': 'https://schema.org', '@type': 'AboutPage', name: 'About Nibble', url: SITE + '/about', description: ONE_LINER, about: { '@id': SITE + '/#org' } },
        orgLd(),
        crumbsLd([['About', SITE + '/about']]),
      ]) }} />
      <header className="lp-nav">
        <a href="/" className="lp-brand"><img src="/logo.svg" alt="" width={34} height={34} />nibble</a>
        <nav className="lp-links" aria-label="Site"><a href="/">Home</a><a href="/#features">Features</a><a href="/#download">Download</a><a href="/about" aria-current="page">About</a><a href="/#contact">Contact</a></nav>
        <div className="lp-nav-end"><a href="/app" className="lp-link">Sign in</a><a href="/#download" className="lp-btn sm">Download</a></div>
      </header>

      <main className="lp-aboutpage">
        <section className="lp-sec">
          <div className="lp-wrap">
            <header className="lp-head center">
              <span className="lp-kicker">About</span>
              <h1 className="lp-about-title">A tiny friend for your desktop, and your friends’ too.</h1>
            </header>
            <div className="lp-about"><Story /></div>
          </div>
        </section>

        <section className="lp-sec">
          <div className="lp-wrap">
            <header className="lp-head center">
              <span className="lp-kicker">The team</span>
              <h2>Made by two people in Colombo.</h2>
              <p>Nibble is a small, independent project. We design it, build it, test it and answer every message ourselves.</p>
            </header>
            <Team />
          </div>
        </section>

        <section className="lp-sec">
          <div className="lp-wrap">
            <div className="lp-values">
              {[
                ['🆓', 'Free, no ads', 'Every pet, game and social feature is free. No ads, ever. Premium is optional and only adds extras.'],
                ['🔒', 'Private by default', 'The apps you use never leave your computer. Friends only see your username, your pet and what you send them.'],
                ['🇱🇰', 'Made in Sri Lanka', 'Designed and built in Colombo, for desktops everywhere: Windows 10 and 11, and macOS.'],
              ].map(([i, t, d]) => (
                <article key={t} className="lp-value"><span>{i}</span><b>{t}</b><p>{d}</p></article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-final">
          <div className="lp-wrap">
            <h2>Say hi to Nibble.</h2>
            <p>Free for Windows and Mac. A pet lands on your desktop about a minute after you download it.</p>
            <div className="lp-cta center">
              <a href="/#download" className="lp-btn">Download Nibble</a>
              <a href="/#contact" className="lp-btn ghost">Contact us</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-foot"><div className="lp-wrap lp-foot-base">© {new Date().getFullYear()} Nibble · Made in Colombo, Sri Lanka · Operated by Entryly Solutions LLC · <a href="/about">About</a> · <a href="/pricing">Pricing</a> · <a href="/refunds">Refunds</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/#contact">Contact</a></div></footer>
    </div>
  );
}
