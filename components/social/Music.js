'use client';
// Listen Together: the synced player (YouTube via the official IFrame
// player), the Music tab, and the little "now playing" dock that follows you around the app.
import { useEffect, useMemo, useRef, useState } from 'react';
import { niceError } from '../../lib/social/social';
import { youtubeId, youtubeList, spotifyId, QUEUE_MAX } from '../../lib/social/music';

const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const SRC_LABEL = { yt: 'YouTube', sp: 'Spotify' };

// ---------- Spotify embed (iFrame API, loaded once) ----------
let spReady = null;
function loadSpotify() {
  if (spReady) return spReady;
  spReady = new Promise((res) => {
    if (window.__nibbleSpotifyAPI) return res(window.__nibbleSpotifyAPI);
    const prev = window.onSpotifyIframeApiReady;
    window.onSpotifyIframeApiReady = (api) => { window.__nibbleSpotifyAPI = api; prev && prev(api); res(api); };
    const s = document.createElement('script');
    s.src = 'https://open.spotify.com/embed/iframe-api/v1';
    s.async = true;
    document.head.appendChild(s);
  });
  return spReady;
}
const spUri = (id) => 'spotify:' + id;
const spSyncable = (id) => /^(track|episode):/.test(id); // albums/playlists: play/pause only

// every video id in a YouTube playlist, read with a hidden player (no API key needed)
export function youtubePlaylist(list) {
  return loadYT().then((YT) => new Promise((res) => {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-9999px;top:0;width:2px;height:2px;';
    const el = document.createElement('div'); host.appendChild(el); document.body.appendChild(host);
    let done = false, p = null;
    const finish = (ids) => { if (done) return; done = true; try { p && p.destroy(); } catch {} host.remove(); res(ids || []); };
    const tryGet = (n) => {
      let ids = null;
      try { ids = p.getPlaylist(); } catch {}
      if (ids && ids.length) finish(ids);
      else if (n === 6) { try { p.cuePlaylist({ listType: 'playlist', list }); } catch {} setTimeout(() => tryGet(n + 1), 400); }
      else if (n < 24) setTimeout(() => tryGet(n + 1), 400);
      else finish([]);
    };
    p = new YT.Player(el, { width: 2, height: 2, playerVars: { listType: 'playlist', list, autoplay: 0, origin: location.origin }, events: { onReady: () => tryGet(0), onError: () => finish([]) } });
    setTimeout(() => finish([]), 15000);
  }));
}
const ytTitle = (id) => fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id))
  .then((r) => (r.ok ? r.json() : null)).then((d) => (d ? { title: d.title, artist: d.author_name } : null)).catch(() => null);
// Spotify link → { title, thumb } (direct first, then through our own /api/oembed)
function spotifyInfo(id) {
  const url = 'https://open.spotify.com/' + id.replace(':', '/');
  const parse = (d) => (d && d.title ? { title: d.title, thumb: d.thumbnail_url || '' } : null);
  return fetch('https://open.spotify.com/oembed?url=' + encodeURIComponent(url)).then((r) => (r.ok ? r.json() : null)).then(parse)
    .catch(() => null)
    .then((x) => x || fetch('/api/oembed?url=' + encodeURIComponent(url)).then((r) => (r.ok ? r.json() : null)).then(parse).catch(() => null));
}

// ---------- YouTube IFrame API (loaded once) ----------
let ytReady = null;
function loadYT() {
  if (ytReady) return ytReady;
  ytReady = new Promise((res) => {
    if (window.YT && window.YT.Player) return res(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev && prev(); res(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    document.head.appendChild(s);
  });
  return ytReady;
}

// ---------- the synced player ----------
// Watches the room and keeps this device's audio within ~1s of where everyone else is.
export function useRoomPlayer(social, state, toast) {
  const music = social && social.music;
  const room = state.music && state.music.room;
  const audio = useRef(null);
  const yt = useRef(null);         // YT.Player
  const ytHost = useRef(null);     // <div> the player lives in (rendered by the dock)
  const ytVid = useRef('');
  const ytState = useRef(-1);
  const endedFor = useRef('');
  const ourCmd = useRef(0);       // when we last told the YouTube player to play/pause/seek
  const kick = useRef(0), lastSeek = useRef(0), playingSince = useRef(0);
  const roomRef = useRef(room);
  roomRef.current = room;
  const [blocked, setBlocked] = useState(false);   // the browser wants a click before playing sound
  const [now, setNow] = useState(0);
  const [vol, setVol] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [ytBox, setYtBox] = useState(null);
  const [spBox, setSpBox] = useState(null);
  const sp = useRef(null);          // Spotify EmbedController
  const spHost = useRef(null);
  const spCur = useRef('');         // uri loaded in the controller
  const spSt = useRef({ paused: true, pos: 0, dur: 0, at: 0, ready: false });
  const spKick = useRef(0);
  const lvol = useRef(0.8), lmute = useRef(false);

  useEffect(() => {
    try { const v = parseFloat(localStorage.getItem('nibble-music-vol')); if (v >= 0 && v <= 1) setVol(v); setMuted(localStorage.getItem('nibble-music-mute') === '1'); } catch {}
  }, []);
  useEffect(() => {
    lvol.current = vol; lmute.current = muted;
    try { localStorage.setItem('nibble-music-vol', String(vol)); localStorage.setItem('nibble-music-mute', muted ? '1' : '0'); } catch {}
    if (yt.current && yt.current.setVolume) { try { yt.current.setVolume(Math.round(vol * 100)); muted ? yt.current.mute() : yt.current.unMute(); } catch {} }
  }, [vol, muted]);

  const finish = (k) => {
    if (!k || endedFor.current === k) return;
    endedFor.current = k;
    music.next(k).catch(() => {});
  };

  // build the YouTube player the first time a YouTube song comes up
  async function ensureYT(vid) {
    if (!ytBox) return null;
    const YT = await loadYT();
    if (yt.current) return yt.current;
    if (ytHost.current) return null; // being created
    const el = document.createElement('div');
    ytBox.innerHTML = ''; ytBox.appendChild(el);
    ytHost.current = el;
    return new Promise((res) => {
      const p = new YT.Player(el, {
        width: '100%', height: '100%', videoId: vid,
        playerVars: { playsinline: 1, controls: 0, disablekb: 1, rel: 0, modestbranding: 1, fs: 0, iv_load_policy: 3, origin: location.origin },
        events: {
          onReady: () => { yt.current = p; ytVid.current = vid; try { p.setVolume(Math.round(lvol.current * 100)); lmute.current ? p.mute() : p.unMute(); } catch {} res(p); },
          onStateChange: (e) => {
            const prev = ytState.current;
            ytState.current = e.data;
            const r = roomRef.current;
            if (!r || !r.track || r.track.src !== 'yt') return;
            if (e.data === 1 && prev !== 1) playingSince.current = performance.now();
            // paused by you (keyboard media key, Windows media controls), not by us: pause the room too,
            // instead of fighting it and starting the song again
            if (e.data === 2 && prev === 1 && r.playing && performance.now() - ourCmd.current > 1500 && performance.now() - playingSince.current > 1500) {
              let cur = 0, dur = 0; try { cur = p.getCurrentTime(); dur = p.getDuration(); } catch {}
              if (!dur || cur < dur - 2) music.pause().catch(() => {});
            }
            if (e.data === 1) { // playing: report the real title + length
              setBlocked(false);
              try {
                const d = p.getVideoData() || {};
                music.fillInfo(r.track.k, { title: d.title, artist: d.author, dur: p.getDuration() });
              } catch {}
            }
            if (e.data === 0) finish(r.track.k);
          },
          onError: (e) => {
            const r = roomRef.current;
            if (!r || !r.track) return;
            const why = e.data === 101 || e.data === 150 ? 'The owner of that video doesn’t allow it to play outside YouTube.' : 'That YouTube video can’t be played.';
            toast && toast({ err: true, text: why + ' Skipping…' });
            finish(r.track.k);
          },
        },
      });
    });
  }

  async function ensureSP(id) {
    if (!spBox) return null;
    const API = await loadSpotify();
    if (sp.current) return sp.current;
    if (spHost.current) return null; // being created
    const el = document.createElement('div');
    spBox.innerHTML = ''; spBox.appendChild(el);
    spHost.current = el;
    return new Promise((res) => {
      API.createController(el, { uri: spUri(id), width: '100%', height: 152 }, (c) => {
        spCur.current = id;
        c.addListener('playback_update', (e) => {
          const d = (e && e.data) || {};
          spSt.current = { paused: !!d.isPaused, pos: (d.position || 0) / 1000, dur: (d.duration || 0) / 1000, at: performance.now(), ready: true, buffering: !!d.isBuffering };
          if (!d.isPaused) setBlocked(false);
          const r = roomRef.current;
          if (!r || !r.track || r.track.src !== 'sp') return;
          // full tracks only: a 30-second preview (not logged in to Spotify) shouldn't skip for everyone
          if (spSyncable(r.track.id) && d.duration > 35000 && d.position >= d.duration - 900) finish(r.track.k);
          if (d.duration > 35000 && !r.track.dur) music.fillInfo(r.track.k, { dur: d.duration / 1000 });
        });
        sp.current = c;
        res(c);
      });
    });
  }

  // the sync loop
  useEffect(() => {
    if (!music) return;
    let alive = true;
    const step = async () => {
      if (!alive) return;
      const r = roomRef.current;
      const t = r && r.track;
      setNow(t ? music.position(r) : 0);
      const pauseSp = () => { if (sp.current && !spSt.current.paused) { try { sp.current.pause(); } catch {} spSt.current.paused = true; } };
      const pauseYt = () => { if (yt.current && (ytState.current === 1 || ytState.current === 3)) { ourCmd.current = performance.now(); try { yt.current.pauseVideo(); } catch {} } };
      if (!t) { pauseYt(); pauseSp(); return; }
      if (t.src !== 'sp') pauseSp();
      if (endedFor.current && endedFor.current !== t.k) endedFor.current = '';
      const want = music.position(r);
      if (t.src === 'sp') {
        pauseYt();
        const c = sp.current || await ensureSP(t.id);
        if (!c || !alive) return;
        try {
          if (spCur.current !== t.id) { spCur.current = t.id; spSt.current = { paused: true, pos: 0, dur: 0, at: performance.now(), ready: false }; c.loadUri(spUri(t.id)); if (r.playing) setTimeout(() => { try { c.play(); } catch {} }, 700); return; }
          const st = spSt.current;
          const est = st.pos + (st.paused ? 0 : (performance.now() - st.at) / 1000);
          if (r.playing) {
            if (st.paused && !st.buffering && performance.now() - spKick.current > 2500) {
              spKick.current = performance.now();
              if (spSyncable(t.id) && want > 1) c.seek(want);
              c.resume ? c.resume() : c.play();
              setTimeout(() => { if (spSt.current.paused && roomRef.current && roomRef.current.playing && roomRef.current.track && roomRef.current.track.src === 'sp') setBlocked(true); }, 2500);
            } else if (spSyncable(t.id) && st.ready && Math.abs(est - want) > 2.5 && (!st.dur || want < st.dur)) c.seek(want);
          } else if (!st.paused) c.pause();
        } catch {}
        return;
      }
      if (t.src !== 'yt') { finish(t.k); return; } // an old Nibble Beat in a room: skip it
      const p = yt.current || await ensureYT(t.id);
      if (!p || !alive) return;
      try {
        const nowMs = performance.now();
        if (ytVid.current !== t.id) {
          ytVid.current = t.id; ourCmd.current = lastSeek.current = kick.current = nowMs;
          r.playing ? p.loadVideoById(t.id, want) : p.cueVideoById(t.id, want);
          return;
        }
        const st = ytState.current;
        const cur = p.getCurrentTime ? p.getCurrentTime() : 0;
        if (r.playing) {
          // the song ends when YouTube says so (ENDED); only a player that's stuck long past the end moves on
          if (t.dur && want > t.dur + 20 && st !== 1 && st !== 3) { finish(t.k); return; }
          if ((st === 2 || st === 5 || st === -1) && nowMs - kick.current > 3000) {
            kick.current = ourCmd.current = nowMs;
            if (Math.abs(cur - want) > 3 && (!t.dur || want < t.dur - 2)) p.seekTo(want, true);
            p.playVideo();
            setTimeout(() => { const rr = roomRef.current; if (ytState.current !== 1 && ytState.current !== 3 && rr && rr.playing && rr.track && rr.track.src === 'yt') setBlocked(true); }, 3000);
          } else if (st === 1 && Math.abs(cur - want) > 4 && nowMs - lastSeek.current > 8000 && (!t.dur || want < t.dur - 3)) {
            // small drift is fine; a big one (someone seeked, or an ad) gets one gentle correction
            lastSeek.current = ourCmd.current = nowMs;
            p.seekTo(want, true);
          }
        } else {
          pauseYt();
          if (st === 2 && Math.abs(cur - want) > 2 && nowMs - lastSeek.current > 3000) { lastSeek.current = ourCmd.current = nowMs; p.seekTo(want, true); }
        }
      } catch {}
    };
    const id = setInterval(step, 500);
    step();
    return () => { alive = false; clearInterval(id); };
  }, [music, ytBox, spBox]);

  useEffect(() => () => {
    try { sp.current && sp.current.destroy && sp.current.destroy(); } catch {}
    sp.current = null; spHost.current = null; spCur.current = '';
  }, [spBox]);

  // the box the YouTube player lives in changed (dock re-rendered): start a fresh player there
  useEffect(() => () => {
    try { yt.current && yt.current.destroy(); } catch {}
    yt.current = null; ytHost.current = null; ytVid.current = ''; ytState.current = -1;
  }, [ytBox]);

  // leaving the room / signing out: stop the sound
  useEffect(() => {
    if (room) return;
    if (yt.current) { ourCmd.current = performance.now(); try { yt.current.stopVideo(); } catch {} }
    if (sp.current) { try { sp.current.pause(); } catch {} }
    ytVid.current = '';
  }, [!!room]);

  // keyboard media keys + Windows media controls drive the room (not just this device)
  useEffect(() => {
    if (!music || typeof navigator === 'undefined' || !navigator.mediaSession) return;
    const ms = navigator.mediaSession;
    const on = (a, f) => { try { ms.setActionHandler(a, f); } catch {} };
    on('pause', () => music.pause().catch(() => {}));
    on('play', () => music.resume().catch(() => {}));
    on('stop', () => music.pause().catch(() => {}));
    on('nexttrack', () => { const r = roomRef.current; if (r && r.track) music.next(r.track.k).catch(() => {}); });
    return () => { for (const a of ['pause', 'play', 'stop', 'nexttrack']) on(a, null); };
  }, [music]);

  // a click anywhere counts as permission to play sound
  const unlock = () => {
    const r = roomRef.current;
    if (!r || !r.track) return;
    if (r.track.src === 'yt' && yt.current && r.playing) { ourCmd.current = performance.now(); try { yt.current.playVideo(); setBlocked(false); } catch {} }
    if (r.track.src === 'sp' && sp.current) { try { sp.current.resume ? sp.current.resume() : sp.current.play(); } catch {} }
  };

  return { now, blocked, unlock, vol, setVol, muted, setMuted, setYtBox, setSpBox };
}

// ---------- dock: always-visible mini player (also hosts the YouTube video) ----------
export function MusicDock({ social, state, player, go, tab }) {
  const room = state.music && state.music.room;
  const t = room && room.track;
  const music = social.music;
  const video = !!(t && t.src === 'yt');
  const spot = !!(t && t.src === 'sp');
  // one stable element hosts the YouTube player, shown at YouTube's minimum 200px height while it plays
  return (
    <div className={'mu-float' + (room ? '' : ' none')}>
      <div className={'mu-ytbox' + (video ? '' : ' hidden')} ref={player.setYtBox} />
      <div className={'mu-spbox' + (spot ? '' : ' hidden')} ref={player.setSpBox} />
      {room && (
        <div className="mu-dock">
          {!video && <div className={'mu-disc' + (room.playing ? ' spin' : '')}>🎧</div>}
          <button className="mu-dock-info" onClick={() => go('music')} title="Open Music">
            <b>{t ? t.title : 'Nothing playing'}</b>
            <small>{t ? `${t.artist || SRC_LABEL[t.src]} · ${fmt(player.now)}${t.dur ? ' / ' + fmt(t.dur) : ''}` : `${room.present.length} listening · pick a song`}</small>
          </button>
          {player.blocked && <button className="btn small" onClick={player.unlock}>🔊 Tap to hear</button>}
          {t && <button className="mu-icon" title={room.playing ? 'Pause for everyone' : 'Play for everyone'} onClick={() => (room.playing ? music.pause() : music.resume()).catch(() => {})}>{room.playing ? '⏸' : '▶'}</button>}
          {t && <button className="mu-icon" title="Skip" onClick={() => music.next(t.k)}>⏭</button>}
          <button className="mu-icon" title={player.muted ? 'Unmute (just for me)' : 'Mute (just for me)'} onClick={() => player.setMuted(!player.muted)}>{player.muted ? '🔇' : '🔈'}</button>
        </div>
      )}
    </div>
  );
}

// ---------- Music tab ----------
export function Music({ social, state, desktop, toast, player }) {
  const music = social.music;
  const m = state.music || {};
  const room = m.room;
  const me = state.user.uid;
  const isHost = room && room.host === me;
  const [pick, setPick] = useState([]);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [srcTab, setSrcTab] = useState('yt');
  const err = (e) => toast({ err: true, text: niceError(e) });
  const run = (p, ok) => { setBusy(true); return Promise.resolve(p).then((x) => { ok && toast({ text: ok }); return x; }, err).finally(() => setBusy(false)); };

  // look up a pasted YouTube link's title (oEmbed; harmless if it fails)
  const vid = youtubeId(link);
  useEffect(() => {
    setPreview(null);
    if (!vid) return;
    let dead = false;
    fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + vid))
      .then((r) => (r.ok ? r.json() : null)).then((d) => { if (!dead && d) setPreview({ title: d.title, artist: d.author_name }); }).catch(() => {});
    return () => { dead = true; };
  }, [vid]);
  const ytTrack = () => ({ src: 'yt', id: vid, title: (preview && preview.title) || 'YouTube video', artist: (preview && preview.artist) || '' });
  const list = youtubeList(link);
  const [listInfo, setListInfo] = useState(null);
  useEffect(() => {
    setListInfo(null);
    if (!list) return;
    let dead = false;
    fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/playlist?list=' + list))
      .then((r) => (r.ok ? r.json() : null)).then((d) => { if (!dead && d) setListInfo({ title: d.title, artist: d.author_name, thumb: d.thumbnail_url }); }).catch(() => {});
    return () => { dead = true; };
  }, [list]);
  const addPlaylist = () => run((async () => {
    const ids = (await youtubePlaylist(list)).slice(0, QUEUE_MAX);
    if (!ids.length) throw Object.assign(new Error('empty'), { friendly: 'Couldn’t read that playlist. Is it public (or unlisted)?' });
    const tracks = [];
    for (let i = 0; i < ids.length; i += 6) {
      const infos = await Promise.all(ids.slice(i, i + 6).map(ytTitle));
      infos.forEach((info, j) => tracks.push({ src: 'yt', id: ids[i + j], title: (info && info.title) || 'YouTube video', artist: (info && info.artist) || '' }));
    }
    const n = await music.addMany(tracks);
    setLink('');
    return n;
  })()).then((n) => n && toast({ text: `Added ${n} song${n > 1 ? 's' : ''} from the playlist 🎶` }));
  // Spotify links
  const [spLink, setSpLink] = useState('');
  const sid = spotifyId(spLink);
  const [spInfo, setSpInfo] = useState(null);
  useEffect(() => {
    setSpInfo(null);
    if (!sid) return;
    let dead = false;
    spotifyInfo(sid).then((d) => { if (!dead && d) setSpInfo(d); });
    return () => { dead = true; };
  }, [sid]);
  const spKind = sid ? sid.split(':')[0] : '';
  const spTrack = () => ({ src: 'sp', id: sid, title: (spInfo && spInfo.title) || 'Spotify ' + spKind, artist: spKind === 'track' || spKind === 'episode' ? '' : 'Spotify ' + spKind });

  const online = state.friends.filter((f) => f.online);
  const listening = state.friends.filter((f) => f.np);
  const t = room && room.track;
  const pct = t && t.dur ? Math.min(100, (player.now / t.dur) * 100) : 0;
  const seek = (e) => {
    if (!t || !t.dur) return;
    const r = e.currentTarget.getBoundingClientRect();
    music.seek(((e.clientX - r.left) / r.width) * t.dur).catch(err);
  };
  const ytQuery = (n) => encodeURIComponent(`${n.title} ${n.artist || ''}`.trim());

  return (
    <>
      <h2>Listen together <small className="sa-ttl">🎧 synced for everyone in the room</small></h2>
      <p className="sa-sub">Play the same song at the same moment with friends — any YouTube video or playlist, or Spotify links. Your pets put their headphones on and dance along.</p>

      {m.ended && <div className="sa-card mu-note"><span>🎵 {m.ended}</span><button className="sa-link" onClick={() => music.clearEnded()}>OK</button></div>}

      {(m.invites || []).filter((i) => !room || i.host !== room.id).map((i) => (
        <div key={i.host} className="sa-card mu-invite">
          <span className="mu-invite-ico">🎧</span>
          <div><b>@{i.fromName} invited you to listen together</b><small>Join and you’ll hear exactly what they’re hearing.</small></div>
          <button className="btn small" disabled={busy} onClick={() => run(music.join(i.host).then(() => player.unlock()))}>Join</button>
          <button className="sa-link" onClick={() => music.dismissInvite(i.host)}>Not now</button>
        </div>
      ))}

      {!room && (
        <div className="sa-card">
          <h3>Start a listening room</h3>
          <p className="sa-sub" style={{ marginTop: 0 }}>Pick who to invite — they’ll get a 🎧 invite (their pet brings it over). You can invite more later.</p>
          {state.friends.length === 0 ? <p className="sa-empty">Add a friend first, or start a room just for you.</p> : (
            <div className="mu-pick">
              {[...online, ...state.friends.filter((f) => !f.online)].map((f) => (
                <label key={f.uid} className={'mu-pickf' + (pick.includes(f.uid) ? ' on' : '')}>
                  <input type="checkbox" checked={pick.includes(f.uid)} onChange={(e) => setPick(e.target.checked ? [...pick, f.uid] : pick.filter((x) => x !== f.uid))} />
                  <span className={'sa-dot' + (f.online ? ' on' : '')} />@{f.username}
                </label>
              ))}
            </div>
          )}
          <button className="btn" disabled={busy} onClick={() => run(music.start(pick).then(() => { setPick([]); player.unlock(); }), pick.length ? `Invites sent to ${pick.length} friend${pick.length > 1 ? 's' : ''} 🎧` : 'Room ready 🎧')}>
            🎧 Start room{pick.length ? ` & invite ${pick.length}` : ''}
          </button>
        </div>
      )}

      {room && (
        <>
          <div className="sa-card mu-now">
            <div className={'mu-art' + (room.playing ? ' spin' : '')}>{t ? (t.src === 'yt' ? '▶' : t.src === 'sp' ? '🟢' : '♪') : '🎧'}</div>
            <div className="mu-now-main">
              <small className="mu-room">{isHost ? 'Your room' : `@${room.hostName}’s room`} · {room.present.length} listening</small>
              <b className="mu-title">{t ? t.title : 'Nothing playing yet'}</b>
              <small>{t ? `${t.artist || SRC_LABEL[t.src] || ''}${t.by && t.by !== 'radio' ? ' · added by @' + t.by : ''}` : 'Paste a YouTube or Spotify link below.'}</small>
              {t && (
                <div className="mu-bar-row">
                  <span>{fmt(player.now)}</span>
                  <div className="mu-bar" onClick={seek} title="Jump to (for everyone)"><i style={{ width: pct + '%' }} /></div>
                  <span>{t.dur ? fmt(t.dur) : '–:––'}</span>
                </div>
              )}
              <div className="mu-ctrls">
                {t && <button className="mu-big" title={room.playing ? 'Pause for everyone' : 'Play for everyone'} onClick={() => (room.playing ? music.pause() : music.resume()).catch(err)}>{room.playing ? '⏸' : '▶'}</button>}
                {t && <button className="mu-icon" title="Skip" onClick={() => music.next(t.k).catch(err)}>⏭</button>}
                {player.blocked && <button className="btn small" onClick={player.unlock}>🔊 Tap to hear</button>}
                <span className="mu-vol">
                  <button className="mu-icon" onClick={() => player.setMuted(!player.muted)} title="Just for me">{player.muted ? '🔇' : '🔈'}</button>
                  <input type="range" min="0" max="1" step="0.05" value={player.vol} onChange={(e) => { player.setVol(parseFloat(e.target.value)); player.setMuted(false); }} />
                </span>
              </div>
            </div>
          </div>

          <div className="mu-grid">
            <div className="sa-card">
              <h3>Add music</h3>
              <div className="mu-tabs">
                <button className={srcTab === 'yt' ? 'on' : ''} onClick={() => setSrcTab('yt')}>▶ YouTube</button>
                <button className={srcTab === 'sp' ? 'on' : ''} onClick={() => setSrcTab('sp')}>🟢 Spotify</button>
              </div>
              {srcTab === 'sp' ? (
                <div className="mu-yt">
                  <input placeholder="Paste a Spotify song, album or playlist link…" value={spLink} onChange={(e) => setSpLink(e.target.value)} />
                  {spLink && !sid && <small className="mu-warn">That doesn’t look like a Spotify link (open.spotify.com/track/…).</small>}
                  {sid && <div className="mu-yt-prev">{spInfo && spInfo.thumb ? <img alt="" src={spInfo.thumb} /> : <span className="mu-sp-ico">🟢</span>}<span><b>{spInfo ? spInfo.title : 'Spotify ' + spKind}</b><small>Spotify {spKind}</small></span></div>}
                  <div className="mu-row">
                    <button className="btn small" disabled={!sid || busy} onClick={() => run(music.play(spTrack()).then(() => setSpLink('')))}>▶ Play now</button>
                    <button className="btn small ghost" disabled={!sid || busy} onClick={() => run(music.add(spTrack()).then(() => setSpLink('')), 'Added to the queue')}>＋ Queue</button>
                  </div>
                  <small className="mu-fine">Plays in Spotify’s own player (in the mini player). Everyone hears full songs when they’re logged in to Spotify in their browser; otherwise Spotify plays a 30-second preview. Albums and playlists play from the start for everyone.</small>
                </div>
              ) : (
                <div className="mu-yt">
                  <input placeholder="Paste a YouTube video or playlist link…" value={link} onChange={(e) => setLink(e.target.value)} />
                  {link && !vid && !list && <small className="mu-warn">That doesn’t look like a YouTube link.</small>}
                  {list && (
                    <div className="mu-yt-prev">{listInfo && listInfo.thumb ? <img alt="" src={listInfo.thumb} /> : <span className="mu-sp-ico">📃</span>}<span><b>{listInfo ? listInfo.title : 'YouTube playlist'}</b><small>Playlist{listInfo && listInfo.artist ? ' · ' + listInfo.artist : ''} · up to {QUEUE_MAX} songs</small></span></div>
                  )}
                  {list && <div className="mu-row"><button className="btn small" disabled={busy} onClick={addPlaylist}>{busy ? 'Reading playlist…' : '📃 Add whole playlist'}</button>{vid && <small className="mu-fine">or just this video ↓</small>}</div>}
                  {vid && <div className="mu-yt-prev"><img alt="" src={`https://i.ytimg.com/vi/${vid}/mqdefault.jpg`} /><span><b>{preview ? preview.title : 'YouTube video'}</b><small>{preview ? preview.artist : ''}</small></span></div>}
                  <div className="mu-row">
                    <button className="btn small" disabled={!vid || busy} onClick={() => run(music.play(ytTrack()).then(() => setLink('')))}>▶ Play now</button>
                    <button className="btn small ghost" disabled={!vid || busy} onClick={() => run(music.add(ytTrack()).then(() => setLink('')), 'Added to the queue')}>＋ Queue</button>
                  </div>
                  <small className="mu-fine">Plays through YouTube’s own player (shown in the mini player). Some videos can’t be played outside YouTube — those get skipped.</small>
                </div>
              )}
            </div>

            <div className="sa-card">
              <h3>Up next <small>{room.queue.length}/{QUEUE_MAX}</small></h3>
              {room.queue.length === 0 ? <p className="sa-empty">{'Queue’s empty. When this song ends the room goes quiet until someone adds more.'}</p> : (
                <ul className="mu-list">
                  {room.queue.map((q, i) => (
                    <li key={q.k}>
                      <span className="mu-li-ico">{i + 1}</span>
                      <span className="mu-li-txt"><b>{q.title}</b><small>{SRC_LABEL[q.src] || ''}{q.by ? ' · @' + q.by : ''}</small></span>
                      <button className="mu-icon" title="Play now" onClick={() => music.playFromQueue(q.k).catch(err)}>▶</button>
                      <button className="mu-icon" title="Remove" onClick={() => music.remove(q.k).catch(err)}>✕</button>
                    </li>
                  ))}
                </ul>
              )}
              <h3 style={{ marginTop: 18 }}>In the room</h3>
              <div className="mu-people">
                {[room.host, ...room.invited].map((u) => {
                  const here = room.present.includes(u);
                  return <span key={u} className={'mu-person' + (here ? ' here' : '')}>{here ? '🎧' : '…'} @{u === me ? (state.profile.username + ' (you)') : room.names[u] || 'friend'}{u === room.host ? ' ★' : ''}</span>;
                })}
              </div>
              {isHost && state.friends.some((f) => !room.invited.includes(f.uid)) && (
                <div className="mu-inv">
                  <small>Invite:</small>
                  {state.friends.filter((f) => !room.invited.includes(f.uid)).map((f) => (
                    <button key={f.uid} className="sa-chip" onClick={() => run(music.invite(f.uid), `Invite sent to @${f.username}`)}>＋ @{f.username}</button>
                  ))}
                </div>
              )}
              {!isHost && <small className="mu-fine">Only @{room.hostName} can invite more people.</small>}
              <div className="mu-row" style={{ marginTop: 14 }}>
                <button className="btn small ghost" onClick={() => run(music.leave(), isHost ? 'Room ended' : 'You left the room')}>{isHost ? 'End room for everyone' : 'Leave room'}</button>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="sa-card">
        <h3>Friends listening now</h3>
        {listening.length === 0 ? <p className="sa-empty">Nobody’s sharing a song right now. When friends play music in Spotify, YouTube or a Nibble room, it shows up here.</p> : (
          <ul className="mu-list">
            {listening.map((f) => {
              const inv = (m.invites || []).find((i) => i.host === f.np.room);
              const theirRoom = f.np.room && room && room.id === f.np.room;
              return (
                <li key={f.uid}>
                  <span className="mu-li-ico">🎧</span>
                  <span className="mu-li-txt"><b>{f.np.title}</b><small>@{f.username}{f.np.artist ? ' · ' + f.np.artist : ''}{f.np.app ? ' · ' + f.np.app : ''}</small></span>
                  {theirRoom ? <small className="mu-fine">same room ✓</small> : inv ? (
                    <button className="btn small" onClick={() => run(music.join(inv.host).then(() => player.unlock()))}>Join</button>
                  ) : (
                    <>
                      <a className="sa-chip" href={`https://www.youtube.com/results?search_query=${ytQuery(f.np)}`} target="_blank" rel="noreferrer" title="Find it on YouTube">▶ YouTube</a>
                      <a className="sa-chip" href={`https://open.spotify.com/search/${ytQuery(f.np)}`} target="_blank" rel="noreferrer" title="Find it on Spotify">Spotify</a>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="sa-card">
        <h3>Share what I’m playing</h3>
        {desktop && desktop.platform === 'darwin' ? (
          <p className="sa-empty">On a Mac, songs you play in a Nibble room show up for friends automatically. Sharing what other Mac apps play isn’t available yet.</p>
        ) : desktop && desktop.onNowPlaying ? (
          <>
            <Toggle on={m.share} onChange={(v) => music.setShare(v)} label="Show friends what I play on this PC" hint="Song + artist from Spotify, YouTube, Apple Music… (whatever shows in the Windows media controls). Friends get a Listen-along button." />
            {m.share && <p className="mu-fine">{m.deviceNp ? `Now showing: 🎧 ${m.deviceNp.title}${m.deviceNp.artist ? ' — ' + m.deviceNp.artist : ''}${m.deviceNp.playing === false ? ' (paused, hidden)' : ''}` : 'Nothing playing on this PC right now.'}</p>}
          </>
        ) : desktop ? (
          <p className="sa-empty">Update to Nibble 2.0.12 to share what you play in Spotify, YouTube and other apps.</p>
        ) : (
          <p className="sa-empty">Available in the Nibble desktop app — it reads the song from your Windows media controls. Songs you play in a Nibble room show up for friends automatically.</p>
        )}
      </div>
    </>
  );
}

function Toggle({ on, onChange, label, hint }) {
  return (
    <label className="sa-toggle">
      <span><b>{label}</b>{hint && <small>{hint}</small>}</span>
      <input type="checkbox" checked={!!on} onChange={(e) => onChange(e.target.checked)} />
      <i />
    </label>
  );
}
