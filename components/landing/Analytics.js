'use client';
// Google Tag Manager (GTM-MD7276HC: Google Analytics is set up inside the container), only after the
// visitor agrees (consent saved in this browser). A plain GA4 id (NEXT_PUBLIC_GA_ID) still works too.
// Never runs in the desktop Hub, the phone app, admin or the sign-in bridge.
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || 'GTM-MD7276HC';
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || '';
const KEY = 'nibble-consent';
const SKIP = /^\/(hub|admin|link|m)(\/|$)/;

let loaded = false;
function loadTags() {
  if (loaded || (!GTM_ID && !GA_ID) || typeof window === 'undefined') return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  // the visitor said yes: Consent Mode v2 (analytics only, never ads)
  window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  if (GTM_ID) {
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    const s = document.createElement('script');
    s.async = true; s.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
    document.head.appendChild(s);
  }
  if (GA_ID) {
    window.gtag('config', GA_ID, { anonymize_ip: true });
    const s = document.createElement('script');
    s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(s);
  }
}

// send an event (no-op until the visitor has agreed). GTM picks it up as a custom event of the same name.
export function track(name, params = {}) {
  try {
    if (!loaded) return;
    window.dataLayer.push({ event: name, ...params });
    if (GA_ID && window.gtag) window.gtag('event', name, params);
  } catch {}
}

export default function Analytics() {
  const path = usePathname() || '/';
  const [ask, setAsk] = useState(false);
  const skip = SKIP.test(path) || (!GTM_ID && !GA_ID);

  useEffect(() => {
    if (skip) return;
    let c = null; try { c = localStorage.getItem(KEY); } catch {}
    if (c === 'yes') loadTags(); else if (!c) setAsk(true);
  }, [skip]);

  // page views on client-side navigation
  // (the first one is sent by the tag itself when it loads)
  const first = useState({ v: true })[0];
  useEffect(() => {
    if (first.v) { first.v = false; return; }
    if (!loaded) return;
    window.dataLayer.push({ event: 'page_view', page_path: path, page_location: location.href, page_title: document.title });
    if (GA_ID && window.gtag) window.gtag('event', 'page_view', { page_path: path });
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const choose = (v) => { try { localStorage.setItem(KEY, v); } catch {} setAsk(false); if (v === 'yes') loadTags(); };
  return (
    <div className="consent" role="dialog" aria-label="Cookies">
      <p>🍪 Can we count visits with Google Analytics? It helps us see what people like. No ads, ever. <a href="/privacy">Privacy</a></p>
      <div><button type="button" className="consent-no" onClick={() => choose('no')}>No thanks</button><button type="button" className="consent-yes" onClick={() => choose('yes')}>OK</button></div>
    </div>
  );
}
