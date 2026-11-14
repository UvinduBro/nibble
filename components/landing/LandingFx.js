'use client';
import { useEffect, useState } from 'react';

// Scroll reveal: elements with [data-reveal] fade up once when they enter the viewport.
// Content stays visible without JS: the hidden state only applies under .lp.fx (added here).
export function Reveal() {
  useEffect(() => {
    const root = document.querySelector('.lp');
    if (!root) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) return;
    root.classList.add('fx');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    root.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}

// Light/dark switch. Dark is the default; the choice is remembered in this browser.
export function ThemeToggle() {
  const [theme, setTheme] = useState('dark');
  useEffect(() => {
    let saved = null;
    try { saved = localStorage.getItem('nibble-site-theme'); } catch (e) {}
    if (saved === 'light' || saved === 'dark') apply(saved);
  }, []);
  function apply(t) {
    setTheme(t);
    const root = document.querySelector('.lp');
    if (root) root.dataset.theme = t;
  }
  function flip() {
    const t = theme === 'dark' ? 'light' : 'dark';
    apply(t);
    try { localStorage.setItem('nibble-site-theme', t); } catch (e) {}
  }
  return (
    <button type="button" className="lp-theme" onClick={flip} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} title="Switch theme">
      <span aria-hidden>{theme === 'dark' ? '☾' : '☀'}</span>
    </button>
  );
}
