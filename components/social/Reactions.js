'use client';
// Facebook-style reactions: hover (or long-press on touch) the button to pick Like, Love, Haha,
// Wow, Sad or Angry; tap it to Like / take your reaction back. Icons are the 3D set (components/Emo.js).
import { useEffect, useRef, useState } from 'react';
import Emo from '../Emo';
import { REACTIONS, reactionLabel } from '../../lib/reactions';

function usePicker() {
  const [open, setOpen] = useState(false);
  const t = useRef(null);
  const long = useRef(false);
  const later = (v, ms) => { clearTimeout(t.current); t.current = setTimeout(() => setOpen(v), ms); };
  useEffect(() => () => clearTimeout(t.current), []);
  return {
    open, setOpen, long,
    hover: { onMouseEnter: () => later(true, 350), onMouseLeave: () => later(false, 350) },
    press: {
      onPointerDown: (e) => { if (e.pointerType !== 'mouse') { long.current = false; clearTimeout(t.current); t.current = setTimeout(() => { long.current = true; setOpen(true); }, 420); } },
      onPointerUp: () => { if (!long.current) clearTimeout(t.current); },
      onContextMenu: (e) => e.preventDefault(),
    },
  };
}

function Bar({ onPick, close }) {
  useEffect(() => {
    const off = (e) => { if (!e.target.closest || !e.target.closest('.rx-bar, .rx-btn, .rx-add')) close(); };
    document.addEventListener('pointerdown', off);
    return () => document.removeEventListener('pointerdown', off);
  }, [close]);
  return (
    <span className="rx-bar" role="menu">
      {REACTIONS.map(([k, l], i) => (
        <button key={k} type="button" role="menuitem" title={l} style={{ animationDelay: i * 30 + 'ms' }} onClick={() => { close(); onPick(k); }}>
          <Emo k={k} size={36} /><i>{l}</i>
        </button>
      ))}
    </span>
  );
}

// top 3 reaction icons + total
export function ReactSummary({ counts, onClick }) {
  const list = Object.entries(counts || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const total = list.reduce((t, [, n]) => t + n, 0);
  if (!total) return null;
  return (
    <button type="button" className="rx-sum" onClick={onClick} title={list.map(([k, n]) => `${reactionLabel(k)} ${n}`).join(' · ')}>
      <span>{list.slice(0, 3).map(([k]) => <Emo key={k} k={k} size={18} />)}</span><b>{total}</b>
    </button>
  );
}

// the big "Like" button (Tea Room posts)
export function ReactButton({ mine, onPick }) {
  const p = usePicker();
  return (
    <span className="rx-wrap" {...p.hover}>
      <button type="button" className={'rx-btn' + (mine ? ' on rx-' + mine : '')} {...p.press}
        onClick={() => { if (p.long.current) { p.long.current = false; return; } p.setOpen(false); onPick(mine ? '' : 'like'); }}>
        <Emo k={mine || 'like'} size={20} /><span>{mine ? reactionLabel(mine) : 'Like'}</span>
      </button>
      {p.open && <Bar onPick={onPick} close={() => p.setOpen(false)} />}
    </span>
  );
}

// the small smiley next to a chat bubble + the reactions under it
export function ChatReact({ mine, counts, onPick, align = 'left' }) {
  const p = usePicker();
  return (
    <span className={'rx-chat ' + align}>
      <ReactSummary counts={counts} />
      <span className="rx-wrap" {...p.hover}>
        <button type="button" className={'rx-add' + (mine ? ' on' : '')} title={mine ? reactionLabel(mine) : 'React'} onClick={() => p.setOpen(!p.open)}>
          {mine ? <Emo k={mine} size={16} /> : <span className="rx-plus">☺</span>}
        </button>
        {p.open && <Bar onPick={(k) => onPick(k === mine ? '' : k)} close={() => p.setOpen(false)} />}
      </span>
    </span>
  );
}
