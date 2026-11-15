'use client';
// Google Analytics 4, only after the visitor agrees (consent saved in this browser).
// Set NEXT_PUBLIC_GA_ID (e.g. G-XXXXXXXXXX) in Vercel. Never runs in the desktop Hub, admin or sign-in bridge.
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID || '';
const KEY = 'nibble-consent';
const SKIP = /^\/(hub|admin|link)(\/|$)/;

let loaded = false;
function loadGa() {
  if (loaded || !GA_ID || typeof window === 'undefined') return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, { anonymize_ip: true });
  const s = document.createElement('script');
  s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
}

// send an event (no-op until analytics is loaded)
export function track(name, params = {}) {
  try { if (loaded && window.gtag) window.gtag('event', name, params); } catch {}
}

export default function Analytics() {
  const path = usePathname() || '/';
  const [ask, setAsk] = useState(false);
  const skip = SKIP.test(path) || !GA_ID;

  useEffect(() => {
    if (skip) return;
    let c = null; try { c = localStorage.getItem(KEY); } catch {}
    if (c === 'yes') loadGa(); else if (!c) setAsk(true);
  }, [skip]);

  // page views on client-side navigation
  useEffect(() => { if (loaded && window.gtag) window.gtag('event', 'page_view', { page_path: path }); }, [path]);

  // downloads + outbound clicks, tracked from anywhere on the page
  useEffect(() => {
    if (skip) return;
    const on = (e) => {
      const a = e.target.closest && e.target.closest('a');
      if (!a) return;
      const h = a.getAttribute('href') || '';
      if (/Get-Nibble\.exe|install\.cmd/.test(h)) track('download', { platform: 'windows' });
      else if (/Nibble\.dmg|install\.sh/.test(h)) track('download', { platform: 'mac' });
      else if (h === '/app') track('open_web_app');
    };
    document.addEventListener('click', on, true);
    return () => document.removeEventListener('click', on, true);
  }, [skip]);

  if (skip || !ask) return null;
  const choose = (v) => { try { localStorage.setItem(KEY, v); } catch {} setAsk(false); if (v === 'yes') loadGa(); };
  return (
    <div className="consent" role="dialog" aria-label="Cookies">
      <p>🍪 Can we count visits with Google Analytics? It helps us see what people like. No ads, ever. <a href="/privacy">Privacy</a></p>
      <div><button type="button" className="consent-no" onClick={() => choose('no')}>No thanks</button><button type="button" className="consent-yes" onClick={() => choose('yes')}>OK</button></div>
    </div>
  );
}
