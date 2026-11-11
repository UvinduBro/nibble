'use client';
import { useEffect, useState } from 'react';
import { createSocial } from '../../lib/social/social';
import { firebaseConfig, socialConfigured, useFake } from '../../lib/social/config';

let instance = null;

// One social client per page. Returns null when the backend isn't configured yet.
export async function getSocial() {
  if (instance) return instance;
  if (useFake()) {
    const { createFakeAdapter } = await import('../../lib/social/fakeAdapter');
    instance = createSocial(createFakeAdapter());
  } else if (socialConfigured()) {
    const { createFirebaseAdapter } = await import('../../lib/social/firebaseAdapter');
    instance = createSocial(createFirebaseAdapter(firebaseConfig));
  }
  if (instance && typeof window !== 'undefined') window.__nibbleSocial = instance;
  return instance;
}

export function useSocial() {
  const [social, setSocial] = useState(null);
  const [state, setState] = useState({ ready: false });
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let off = null, dead = false;
    getSocial().then((s) => {
      if (dead) return;
      if (!s) { setMissing(true); return; }
      setSocial(s);
      off = s.subscribe((st) => setState({ ...st }));
    });
    return () => { dead = true; off && off(); };
  }, []);
  return { social, state, missing };
}
