'use client';
import { useEffect, useRef, useState } from 'react';
import PetFigure, { useNibble } from './PetFigure';
import { createStage } from '../lib/stage';
import { CHARACTERS, byKey } from '../lib/characters';

const FILTERS = [['all', 'All 17'], ['anime', 'Anime crew'], ['classic', 'Classic']];
const STATS = [['speed', 'Speed'], ['chaos', 'Chaos'], ['chat', 'Chattiness'], ['cute', 'Cuteness']];

export default function CharacterSelect() {
  const ready = useNibble();
  const [filter, setFilter] = useState('all');
  const [sel, setSel] = useState('mojo');
  const canvasEl = useRef(null);
  const stage = useRef(null);
  const c = byKey[sel];
  const sk = ready && typeof window !== 'undefined' ? window.SKINS[sel] : null;

  useEffect(() => {
    if (!ready) return;
    const s = createStage({ canvas: canvasEl.current, getWins: () => [] });
    s.env.greeted = true;
    s.env.settings.size = 1.35;
    stage.current = s;
    const ro = new ResizeObserver(() => s.resize());
    ro.observe(canvasEl.current.parentElement);
    return () => { s.destroy(); ro.disconnect(); };
  }, [ready]);

  useEffect(() => {
    const s = stage.current;
    if (!s) return;
    s.env.pets = [];
    s.env.settings.pets = [];
    const p = s.addPet(sel, byKey[sel].name);
    p.x = s.env.world.w / 2;
    p.greeted = true;
    const t = setTimeout(() => { p.say(`I'm ${byKey[sel].name}! ${byKey[sel].group === 'anime' ? 'Watch this…' : 'Pet me!'}`, 2.6); }, 650);
    const t2 = setTimeout(() => p.command({ type: 'special' }, s.env), 1700);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [sel, ready]);

  const list = CHARACTERS.filter((x) => filter === 'all' || x.group === filter);
  const special = () => { const p = stage.current?.env.pets[0]; if (p) p.command({ type: 'special' }, stage.current.env); };
  const pet = () => { const p = stage.current?.env.pets[0]; if (p) p.petted(stage.current.env); };
  const tryIt = () => {
    window.dispatchEvent(new CustomEvent('nibble:add', { detail: sel }));
    document.getElementById('desk')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="cs" style={sk ? { '--c1': sk.body, '--c2': sk.glow, '--c3': sk.line } : undefined}>
      <div className="cs-roster">
        <div className="cs-filters" role="tablist">
          {FILTERS.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        <div className="cs-grid">
          {list.map((x) => (
            <button key={x.key} className={'cs-tile' + (sel === x.key ? ' on' : '') + (x.group === 'anime' ? ' anime' : '')} onClick={() => setSel(x.key)} style={ready ? { '--t1': window.SKINS[x.key].body, '--t2': window.SKINS[x.key].glow } : undefined}>
              <PetFigure skin={x.key} mood={sel === x.key ? 'wave' : 'idle'} size={0.82} w={86} h={74} />
              <span>{x.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="cs-card">
        <div className="cs-stage"><canvas ref={canvasEl} /><div className="cs-floor" /></div>
        <div className="cs-info">
          <div className="cs-title">
            <h3>{c.name}</h3>
            <span className={'tag ' + c.group}>{c.group === 'anime' ? 'Anime crew' : 'Classic'} · {c.role}</span>
          </div>
          <p className="cs-bio">{c.bio}</p>
          <div className="cs-special">
            <span className="kicker">Special move</span>
            <b>{c.special}</b>
            <span>{c.fx}</span>
          </div>
          <div className="cs-stats">
            {STATS.map(([k, l]) => (
              <div key={k}><span>{l}</span><i><em style={{ width: `${c.stats[k] * 20}%` }} /></i></div>
            ))}
          </div>
          <div className="cs-actions">
            <button className="btn" onClick={special}>✨ {c.special}</button>
            <button className="btn ghost" onClick={pet}>♥ Pet</button>
            <button className="btn ghost" onClick={tryIt}>Drop on the desktop ↑</button>
          </div>
        </div>
      </div>
    </div>
  );
}
