import '../../app/landing.css';
import { SELLER } from '../../lib/facts';

// Shared frame for /privacy, /terms, /pricing and /refunds: the site's nav look, plain readable text.
export default function LegalPage({ title, updated, children, wide }) {
  return (
    <div className="lp" data-theme="dark">
      <header className="lp-nav">
        <a href="/" className="lp-brand"><img src="/logo.svg" alt="" width={34} height={34} />nibble</a>
        <nav className="lp-links" aria-label="Site"><a href="/">Home</a><a href="/#download">Download</a><a href="/about">About</a><a href="/pricing">Pricing</a><a href="/#contact">Contact</a></nav>
        <div className="lp-nav-end"><a href="/app" className="lp-link">Sign in</a><a href="/#download" className="lp-btn sm">Download</a></div>
      </header>
      <main className={'lp-legal' + (wide ? ' wide' : '')}>
        <h1>{title}</h1>
        {updated && <p className="lp-updated">Last updated {updated}</p>}
        {children}
      </main>
      <footer className="lp-foot"><div className="lp-wrap lp-foot-base">© {new Date().getFullYear()} Nibble · Made in Colombo, Sri Lanka · Operated by {SELLER.name} · <a href="/about">About</a> · <a href="/pricing">Pricing</a> · <a href="/refunds">Refunds</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/#contact">Contact</a></div></footer>
    </div>
  );
}
