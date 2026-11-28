'use client';
// GIFs in every chat: a picker (search + trending, through /api/gif/search) and a viewer.
// A sent GIF is just { p, id, w, h }; the picture comes from /api/gif/m/<p>/<id>.
import { useEffect, useRef, useState } from 'react';

export function GifView({ g, max = 220 }) {
  const [open, setOpen] = useState(false);
  if (!g || !g.id) return null;
  const w = Math.min(max, g.w || 200);
  const h = Math.round(w * ((g.h || 200) / (g.w || 200)));
  return (
    <>
      <img className="gif-view" src={`/api/gif/m/${g.p}/${encodeURIComponent(g.id)}`} alt="GIF" width={w} height={h} loading="lazy" onClick={() => setOpen(true)} />
      {open && <div className="rp-big" onClick={() => setOpen(false)}><img src={`/api/gif/m/${g.p}/${encodeURIComponent(g.id)}`} alt="GIF" /></div>}
    </>
  );
}

export function GifButton({ social, onPick, disabled, className = '' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={'gif-btn ' + className} disabled={disabled} onClick={() => setOpen(true)} title="Send a GIF" aria-label="Send a GIF">GIF</button>
      {open && <GifPicker social={social} onClose={() => setOpen(false)} onPick={(g) => { setOpen(false); onPick(g); }} />}
    </>
  );
}

const PROVIDER = { k: 'KLIPY', g: 'GIPHY' };

export function GifPicker({ social, onPick, onClose }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState(null);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [prov, setProv] = useState('');
  const [err, setErr] = useState('');
  const seq = useRef(0);
  const run = (query, pg) => {
    const n = ++seq.current;
    setErr('');
    if (pg === 1) setItems(null);
    social.gifs.search(query, pg).then((r) => {
      if (n !== seq.current) return;
      setProv(r.provider || '');
      setItems((l) => (pg === 1 ? r.items : [...(l || []), ...r.items]));
      setMore(!!r.more); setPage(pg);
    }, (e) => { if (n === seq.current) { setItems([]); setErr((e && e.message) || 'GIFs aren’t available right now.'); } });
  };
  useEffect(() => { const t = setTimeout(() => run(q, 1), q ? 350 : 0); return () => clearTimeout(t); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const k = (e) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, [onClose]);
  return (
    <div className="gif-wrap" onClick={onClose}>
      <div className="gif-sheet" role="dialog" aria-label="Pick a GIF" onClick={(e) => e.stopPropagation()}>
        <div className="gif-top">
          <input autoFocus value={q} placeholder="Search GIFs" maxLength={60} onChange={(e) => setQ(e.target.value)} />
          <button type="button" className="pt-x" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <div className="gif-grid">
          {items === null && <p className="sa-empty">Loading…</p>}
          {err && <p className="sa-empty">{err}</p>}
          {items && !items.length && !err && <p className="sa-empty">No GIFs for that. Try another word.</p>}
          {items && items.map((g) => (
            <button type="button" key={g.p + g.id} onClick={() => onPick({ p: g.p, id: g.id, w: g.w, h: g.h })} style={{ aspectRatio: `${g.w} / ${g.h}` }}>
              <img src={g.preview} alt="" loading="lazy" />
            </button>
          ))}
        </div>
        {more && <button type="button" className="btn small ghost gif-more" onClick={() => run(q, page + 1)}>More</button>}
        {prov && <small className="gif-by">Powered by {PROVIDER[prov] || prov}</small>}
      </div>
    </div>
  );
}
