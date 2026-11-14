'use client';
// Points leaderboard: who has earned the most ⭐ (games, daily bonuses, friends). Spending in the shop
// doesn't lower your rank, it ranks points earned all-time.
import { useEffect, useState } from 'react';
import PetFigure from '../PetFigure';
import { PT } from '../../lib/shop';
import { niceError } from '../../lib/social/social';

const MEDAL = ['🥇', '🥈', '🥉'];

export default function Leaderboard({ social, state, go, toast }) {
  const [scope, setScope] = useState('friends');
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  // Saver mode (admin switch): only the friends board, which costs far fewer reads
  const saver = !!(state.config && state.config.saver);
  useEffect(() => { if (saver && scope === 'all') setScope('friends'); }, [saver, scope]);
  const myTotal = state.wallet && state.wallet.ready ? state.wallet.total : null;
  const load = (force) => {
    setErr('');
    social.wallet.leaderboard(scope, force).then(setRows).catch((e) => { setRows([]); setErr(niceError(e)); });
  };
  useEffect(() => { setRows(null); load(); }, [scope, state.friends.length]); // eslint-disable-line react-hooks/exhaustive-deps
  // refresh every 5 minutes, but only while you can actually see it (the Hub stays open hidden all day)
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden && !window.__nibbleHidden) load(true); }, 5 * 60_000);
    return () => clearInterval(t);
  }, [scope]); // eslint-disable-line react-hooks/exhaustive-deps
  const meIdx = rows ? rows.findIndex((r) => r.me) : -1;
  const top = rows ? rows.slice(0, 3) : [];
  const rest = rows ? rows.slice(3) : [];

  return (
    <div className="sa-page lb">
      <div className="sa-head">
        <div>
          <h2>Leaderboard</h2>
          <p className="sa-sub">Ranked by {PT} points earned all-time: games, daily bonuses and time with friends. Spending points in the shop never lowers your rank.</p>
        </div>
        <div className="lb-tabs" role="tablist">
          <button role="tab" aria-selected={scope === 'friends'} className={scope === 'friends' ? 'on' : ''} onClick={() => setScope('friends')}>👯 Friends</button>
          {!saver && <button role="tab" aria-selected={scope === 'all'} className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>🌍 Everyone</button>}
        </div>
      </div>

      {rows === null ? <p className="sa-empty">Counting stars…</p> : rows.length === 0 ? (
        <div className="sa-card"><p className="sa-empty">{err || (scope === 'friends' ? 'Add friends to compete with them here.' : 'Nobody on the board yet. Play a game to be the first!')}</p></div>
      ) : (
        <>
          <div className="lb-podium">
            {[1, 0, 2].map((i) => top[i] && (
              <div key={top[i].uid} className={'lb-pod p' + (i + 1) + (top[i].me ? ' me' : '')}>
                <div className="lb-pod-pet"><PetFigure skin={top[i].skin} mood={i === 0 ? 'dance' : 'happy'} w={i === 0 ? 120 : 96} h={i === 0 ? 110 : 90} size={i === 0 ? 1 : 0.82} acc={top[i].acc} tint={top[i].tint} makeup={top[i].makeup} look={top[i].style} /></div>
                <span className="lb-medal">{MEDAL[i]}</span>
                <b>@{top[i].username}{top[i].me ? ' (you)' : ''}</b>
                <span className="lb-pts">{PT} {top[i].total.toLocaleString()}</span>
                <div className="lb-step">{i + 1}</div>
              </div>
            ))}
          </div>
          {rest.length > 0 && (
            <ol className="lb-list" start={4}>
              {rest.map((r, j) => (
                <li key={r.uid} className={r.me ? 'me' : ''}>
                  <span className="lb-rank">{j + 4}</span>
                  <span className="lb-ava"><PetFigure skin={r.skin} mood="idle" w={44} h={44} size={0.46} acc={r.acc} tint={r.tint} makeup={r.makeup} look={r.style} /></span>
                  <span className="lb-name"><b>@{r.username}{r.me ? ' (you)' : ''}</b>{r.petName && <small>{r.petName}</small>}</span>
                  <span className="lb-pts">{PT} {r.total.toLocaleString()}</span>
                </li>
              ))}
            </ol>
          )}
          <div className="sa-card lb-you">
            <span>{meIdx >= 0 ? <>You’re <b>#{meIdx + 1}</b>{scope === 'friends' ? ' among your friends' : ' on Nibble'} with <b>{PT} {rows[meIdx].total.toLocaleString()}</b> earned.</> : <>You’ve earned <b>{PT} {(myTotal || 0).toLocaleString()}</b>. {scope === 'all' ? 'Keep playing to make the top 50!' : ''}</>}</span>
            <button className="btn small" onClick={() => go('games')}>🎮 Earn more</button>
          </div>
        </>
      )}
    </div>
  );
}
