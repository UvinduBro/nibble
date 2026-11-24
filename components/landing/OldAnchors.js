'use client';
import { useEffect } from 'react';

// The home page used to be one long page. Old links (emails, the desktop app, other sites) still point
// at its sections (meetnibble.com/#download): send them to the page that section moved to.
const MOVED = { download: '/download', try: '/features#try', features: '/features', pillars: '/features', crew: '/pets', start: '/download', reach: '/features', faq: '/faq', feedback: '/contact#feedback', contact: '/contact', about: '/about', pricing: '/pricing', blog: '/blog' };

export default function OldAnchors() {
  useEffect(() => {
    const to = MOVED[(location.hash || '').slice(1)];
    if (to) location.replace(to);
  }, []);
  return null;
}
