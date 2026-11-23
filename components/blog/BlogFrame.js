import '../../app/landing.css';
import '../../app/blog/blog.css';
import { SELLER } from '../../lib/facts';

// Site header + footer around the blog pages (same look as the home and legal pages).
export default function BlogFrame({ children }) {
  return (
    <div className="lp bl" data-theme="dark">
      <header className="lp-nav">
        <a href="/" className="lp-brand"><img src="/logo.svg" alt="" width={34} height={34} />nibble</a>
        <nav className="lp-links" aria-label="Site"><a href="/">Home</a><a href="/#features">Features</a><a href="/blog" aria-current="page">Blog</a><a href="/pricing">Pricing</a><a href="/#download">Download</a></nav>
        <div className="lp-nav-end"><a href="/app" className="lp-link">Sign in</a><a href="/#download" className="lp-btn sm">Download</a></div>
      </header>
      {children}
      <footer className="lp-foot"><div className="lp-wrap lp-foot-base">© {new Date().getFullYear()} Nibble · Made in Colombo, Sri Lanka · Operated by {SELLER.name} · <a href="/blog">Blog</a> · <a href="/about">About</a> · <a href="/pricing">Pricing</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/#contact">Contact</a> · <a href="/blog/feed.xml">RSS</a></div></footer>
    </div>
  );
}
