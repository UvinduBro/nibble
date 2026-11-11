// Nibble's brain + body: physics, state machine, window-hopping, reactions.
(function () {
  const G = 2400; // gravity px/s²
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const chance = (p) => Math.random() < p;
  const sign = (v) => (v < 0 ? -1 : 1);

  const CHAT = {
    silent: { rand: 0, event: 0, gap: 1e9 },
    quiet: { rand: 0.025, event: 0.25, gap: 90 },
    normal: { rand: 0.07, event: 0.5, gap: 35 },
    chatty: { rand: 0.16, event: 0.85, gap: 14 },
  };

  const AIR = new Set(['jump', 'fall', 'thrown', 'flip']);
  const BUSY = new Set(['drag', 'climb', 'cling', 'crouch', 'land', 'dizzy', 'happy', 'special']);

  function weighted(list) {
    const total = list.reduce((s, [, w]) => s + Math.max(0, w), 0);
    let r = Math.random() * total;
    for (const [v, w] of list) { r -= Math.max(0, w); if (r <= 0) return v; }
    return list[0][0];
  }

  class Pet {
    constructor(cfg, env, index) {
      this.id = cfg.id;
      this.name = cfg.name || 'Nibble';
      this.skinKey = cfg.skin || 'mint';
      this.index = index;
      const w = env.world;
      this.x = rand(w.left + 120, w.right - 120);
      this.y = -80 - index * 60; // drop in from above the screen
      this.vx = rand(-60, 60);
      this.vy = 0;
      this.dir = chance(0.5) ? 1 : -1;
      this.state = 'fall';
      this.st = 0;
      this.dur = 0;
      this.support = null;
      this.seg = null;
      this.t = rand(0, 10);
      this.walk = 0;
      this.blink = 1;
      this.blinkT = rand(1, 4);
      this.look = { x: 0, y: 0 };
      this.lookGoal = { x: 0, y: 0 };
      this.sx = 1; this.sy = 1;
      this.rot = 0; this.baseRot = 0; this.spin = 0;
      this.bubble = null;
      this.bounces = 0;
      this.hoverT = 0;
      this.particleT = 0;
      this.lastSpoke = -999;
      this.greeted = false;
      this.chaseX = null;
      this.chaseDrop = false;
      this.jumpGoal = null;
      this.wall = null;
      this.climbGoal = 0;
      this.dragHist = [];
      this.fx = [];
      this.emote = null;
      this.emoteT = 0;
      this.alpha = 1;
      this.liftV = 0;
      this.shake = 0;
      this.jet = false;
      this.sp = null;
    }

    get u() { return this._u || 1; }

    kit() {
      const sk = window.SKINS && window.SKINS[this.skinKey];
      return (sk && sk.kit) || null;
    }

    addFx(f) {
      f.t = 0;
      this.fx.push(f);
      if (this.fx.length > 48) this.fx.shift();
    }

    setEmote(e, t) { this.emote = e; this.emoteT = t; }

    lineCat() {
      const c = 'char_' + this.skinKey;
      return window.NibbleLines.L[c] && chance(0.55) ? c : 'random';
    }

    // ---------- helpers ----------
    enter(state, dur = 0) {
      this.state = state;
      this.st = 0;
      this.dur = dur;
    }

    grounded() { return !!this.support && !AIR.has(this.state) && this.state !== 'drag' && this.state !== 'climb' && this.state !== 'cling'; }

    hit(px, py) {
      const u = this.u;
      const sk = window.SKINS && window.SKINS[this.skinKey];
      const tall = !!(sk && sk.chibi); // humanoid chibis stand taller than the round pets
      let cx = this.x, cy = this.y - (tall ? 30 : 22) * u;
      if (this.state === 'climb' || this.state === 'cling') cx = this.x + (this.wall === 'left' ? 22 : -22) * u, cy = this.y;
      const dx = px - cx, dy = py - cy;
      const r = (tall ? 31 : 27) * u;
      return dx * dx + dy * dy < r * r;
    }

    say(text, dur) {
      if (!text) return;
      this.bubble = { text, t: 0, dur: dur || clamp(1.6 + text.length * 0.06, 2.2, 5.5) };
    }

    speak(env, cat, { kind = 'event', force = false, vars = {} } = {}) {
      const c = CHAT[env.settings.chatty] || CHAT.normal;
      if (!force) {
        if (env.settings.chatty === 'silent') return false;
        if (this.bubble) return false;
        const p = kind === 'rand' ? c.rand : kind === 'app' ? Math.min(1, c.event + 0.1) : c.event;
        if (!chance(p)) return false;
        const gap = kind === 'rand' ? c.gap : kind === 'app' ? Math.max(20, c.gap) : 3;
        if (env.time - env.lastSpeech < gap) return false;
      }
      const text = window.NibbleLines.pick(cat, { name: this.name, ...vars });
      if (!text) return false;
      this.say(text);
      env.lastSpeech = env.time;
      this.lastSpoke = env.time;
      return true;
    }

    currentSeg(env) {
      if (!this.support) return null;
      if (this.support.type === 'floor') return env.floorSeg;
      return this.seg;
    }

    // keep the pet glued to whatever it stands on (and ride along with moving windows)
    checkSupport(env) {
      if (!this.support) return false;
      if (this.support.type === 'floor') {
        this.y = env.world.floor;
        this.seg = env.floorSeg;
        return true;
      }
      if (!env.settings.walkOnWindows) return false;
      const w = env.winsById.get(this.support.winId);
      if (!w) return false;
      if (w.x !== this.support.refX || w.y !== this.support.refY) {
        this.x += w.x - this.support.refX;
        this.y += w.y - this.support.refY;
        this.support.refX = w.x;
        this.support.refY = w.y;
      }
      const seg = env.platforms.find((p) => p.winId === this.support.winId && this.x >= p.x1 - 8 && this.x <= p.x2 + 8 && Math.abs(p.y - this.y) < 4);
      if (!seg) return false;
      this.y = seg.y;
      this.seg = seg;
      return true;
    }

    standOn(seg, env) {
      if (!seg || seg.winId == null) {
        this.support = { type: 'floor' };
        this.y = env.world.floor;
        this.seg = env.floorSeg;
      } else {
        const w = env.winsById.get(seg.winId);
        this.support = { type: 'win', winId: seg.winId, refX: w ? w.x : 0, refY: w ? w.y : 0 };
        this.y = seg.y;
        this.seg = seg;
      }
    }

    loseSupport(env, reason) {
      this.support = null;
      this.seg = null;
      if (this.state !== 'drag') {
        this.enter('fall');
        this.vy = Math.min(this.vy, 0);
        if (reason === 'gone') {
          this.vy = -260;
          env.emit('bang', this.x, this.y - 62 * this.u);
          this.setEmote('sweat', 1.6);
          this.speak(env, 'lostWindow', { kind: 'event' });
        }
      }
    }

    // ---------- decision making ----------
    think(env) {
      const s = env.settings;
      const u = this.u;
      const seg = this.currentSeg(env);
      if (!seg) return this.enter('idle', 1);

      // follow-the-cursor mode overrides wandering
      if (s.followCursor && env.cursor && env.time - env.cursor.movedAt < 20) {
        if (this.thinkChase(env, seg)) return;
      }

      // say hi to a nearby friend
      const friend = env.pets.find((o) => o !== this && o.grounded() && o.support?.type === this.support?.type &&
        (o.support?.winId === this.support?.winId) && Math.abs(o.x - this.x) < 110 * u && !BUSY.has(o.state) && o.state !== 'sleep');
      if (friend && chance(0.18)) {
        this.dir = sign(friend.x - this.x);
        friend.dir = -this.dir;
        this.enter('wave', 1.6);
        friend.enter('wave', 1.6);
        this.speak(env, 'friend', { vars: { friend: friend.name } });
        return;
      }
      // personal space
      const crowd = env.pets.find((o) => o !== this && o.grounded() && Math.abs(o.x - this.x) < 26 * u && Math.abs(o.y - this.y) < 5);
      if (crowd) {
        this.dir = this.x < crowd.x ? -1 : 1;
        if (this.x === crowd.x) this.dir = this.index % 2 ? 1 : -1;
        return this.enter('walk', rand(0.8, 1.6));
      }

      const hour = new Date().getHours();
      const userIdle = env.idle || 0;
      const mood = env.fgMood;
      const cursorNear = env.cursor && Math.hypot(env.cursor.x - this.x, env.cursor.y - (this.y - 25 * u)) < 220;
      const segW = seg.x2 - seg.x1;
      const jumpTarget = s.walkOnWindows ? this.findJump(env, seg) : null;

      const next = weighted([
        ['idle', 3],
        ['look', 1.4],
        ['walk', 5],
        ['run', segW > 300 ? 1 : 0.2],
        ['sit', 2],
        ['jump', jumpTarget ? (this.support.type === 'floor' ? 3.2 : 2.4) : 0],
        ['dance', 0.35 + (mood === 'dance' ? 4 : 0)],
        ['work', 0.25 + (mood === 'work' ? 3.5 : 0)],
        ['yawn', 0.3 + (userIdle > 120 ? 2 : 0) + (hour < 5 ? 1 : 0)],
        ['sleep', 0.2 + (userIdle > 150 ? 6 : 0) + (hour < 5 ? 1.5 : 0)],
        ['wave', cursorNear ? 1.5 : 0],
        ['special', this.kit() && this.kit().special ? 0.9 : 0],
      ]);

      switch (next) {
        case 'idle': this.enter('idle', rand(1.2, 3.5)); break;
        case 'look': this.enter('look', rand(1.5, 3)); break;
        case 'walk':
          if (chance(0.45)) this.dir *= -1;
          this.enter('walk', rand(1.8, 6));
          break;
        case 'run':
          if (chance(0.5)) this.dir *= -1;
          this.enter('run', rand(0.8, 2.2));
          break;
        case 'sit': this.enter('sit', rand(4, 10)); break;
        case 'jump':
          this.jumpGoal = jumpTarget;
          this.dir = sign(jumpTarget.x - this.x);
          this.enter('crouch', 0.17);
          break;
        case 'dance': this.enter('dance', rand(3, 6)); this.speak(env, 'dance', { kind: 'rand' }); break;
        case 'work': this.enter('work', rand(8, 20)); break;
        case 'yawn': this.enter('yawn', 1.4); this.speak(env, 'sleepy', { kind: 'rand' }); break;
        case 'sleep': this.enter('sleep', rand(15, 50)); break;
        case 'wave':
          this.dir = sign(env.cursor.x - this.x);
          this.enter('wave', 1.6);
          break;
        case 'special':
          if (!this.special(env)) this.enter('idle', 1);
          return;
      }
      if (next !== 'jump') this.speak(env, this.lineCat(), { kind: 'rand' });
    }

    thinkChase(env, seg) {
      const c = env.cursor;
      const u = this.u;
      // the platform right under the cursor
      let target = env.floorSeg;
      let best = Infinity;
      for (const p of env.platforms) {
        if (c.x >= p.x1 && c.x <= p.x2 && p.y >= c.y - 10) {
          const d = p.y - c.y;
          if (d < best) { best = d; target = p; }
        }
      }
      const same = target === seg || (target.winId != null && target.winId === seg.winId && target.y === seg.y);
      if (same) {
        if (Math.abs(c.x - this.x) > 36 * u) {
          this.chaseX = clamp(c.x, seg.x1 + 10, seg.x2 - 10);
          this.dir = sign(this.chaseX - this.x);
          this.enter(Math.abs(c.x - this.x) > 260 ? 'run' : 'walk', 6);
        } else {
          this.dir = sign(c.x - this.x);
          this.enter(chance(0.4) ? 'wave' : 'idle', 1.2);
        }
        return true;
      }
      const tx = clamp(c.x, target.x1 + 16 * u, target.x2 - 16 * u);
      const dy = target.y - this.y;
      if (Math.abs(tx - this.x) < 540 && dy > -380) {
        this.jumpGoal = { x: tx, y: target.y };
        this.dir = sign(tx - this.x);
        this.enter('crouch', 0.15);
        return true;
      }
      if (dy > 0) {
        // walk off the nearest edge toward it
        this.chaseDrop = true;
        this.chaseX = c.x < this.x ? seg.x1 - 50 : seg.x2 + 50;
        this.dir = sign(this.chaseX - this.x);
        this.enter('run', 6);
        return true;
      }
      return false;
    }

    findJump(env, seg) {
      const u = this.u;
      const cands = [];
      const all = env.platforms.concat(this.support.type === 'floor' ? [] : [env.floorSeg]);
      for (const p of all) {
        if (p === seg) continue;
        if (p.winId != null && seg.winId === p.winId && p.y === seg.y) continue;
        if (p.x2 - p.x1 < 46 * u) continue;
        const lo = p.x1 + 18 * u, hi = p.x2 - 18 * u;
        const tx = clamp(this.x + rand(-140, 140), lo, hi);
        const dx = tx - this.x;
        const dy = p.y - this.y;
        if (Math.abs(dx) > 520 || dy < -380) continue;
        if (Math.abs(dy) < 6 && Math.abs(dx) < 120) continue;
        if (p.y < env.world.top + 70 * u) continue;
        const score = (dy < 0 ? 1.6 : p.winId == null ? 0.25 : 0.8) + (1 - Math.abs(dx) / 600) + Math.random();
        cands.push({ x: tx, y: p.y, score });
      }
      if (!cands.length) return null;
      cands.sort((a, b) => b.score - a.score);
      return cands[0];
    }

    launch(tx, ty, extra = 0) {
      const apex = Math.min(this.y, ty) - (rand(45, 95) + extra) * Math.max(0.8, this.u);
      const vy0 = -Math.sqrt(2 * G * Math.max(10, this.y - apex));
      const tUp = -vy0 / G;
      const tDown = Math.sqrt(2 * Math.max(1, ty - apex) / G);
      this.vx = (tx - this.x) / (tUp + tDown);
      this.vy = vy0;
      this.dir = sign(this.vx);
      this.support = null;
      this.seg = null;
      this.enter('jump');
      this.sy = 1.18; this.sx = 0.86;
    }

    // ---------- reaching an edge ----------
    atEdge(env, seg) {
      const u = this.u;
      const isFloor = seg === env.floorSeg;
      if (this.chaseDrop && !isFloor) {
        this.chaseDrop = false;
        this.dropOff(env);
        return;
      }
      if (isFloor) {
        // screen walls: turn or climb
        if (chance(0.3) && this.state !== 'chase') {
          this.startClimb(env, this.dir > 0 ? 'right' : 'left');
          return;
        }
        this.dir *= -1;
        return;
      }
      const r = Math.random();
      if (r < 0.5) { this.dir *= -1; this.enter('idle', rand(0.4, 1.2)); }
      else if (r < 0.8) this.dropOff(env);
      else {
        const t = this.findJump(env, seg);
        if (t) { this.jumpGoal = t; this.dir = sign(t.x - this.x); this.enter('crouch', 0.17); }
        else this.dropOff(env);
      }
    }

    dropOff(env) {
      this.support = null;
      this.seg = null;
      this.vx = this.dir * rand(90, 170);
      this.vy = -rand(180, 320);
      this.enter('jump');
    }

    startClimb(env, side, atY) {
      const w = env.world;
      this.wall = side;
      this.support = null;
      this.seg = null;
      this.x = side === 'left' ? w.left : w.right;
      this.baseRot = side === 'left' ? Math.PI / 2 : -Math.PI / 2;
      this.dir = side === 'left' ? -1 : 1;
      this.y = atY != null ? clamp(atY, w.top + 80, w.floor - 24 * this.u) : w.floor - 24 * this.u;
      this.climbGoal = Math.min(this.y - 40, rand(w.top + 90, w.floor - 180));
      this.enter('climb');
      this.speak(env, 'climb', { kind: 'event' });
    }

    jumpOffWall(env) {
      const away = this.wall === 'left' ? 1 : -1;
      this.x += away * 24 * this.u;
      this.vx = away * rand(160, 380);
      this.vy = -rand(150, 420);
      this.dir = away;
      this.wall = null;
      this.enter('fall');
    }

    // ---------- user interaction ----------
    startDrag(px, py) {
      this.support = null;
      this.seg = null;
      this.wall = null;
      this.baseRot = 0;
      this.jet = false;
      this.sp = null;
      this.alpha = 1;
      this.liftV = 0;
      this.shake = 0;
      this.enter('drag');
      this.dragHist = [{ x: px, y: py, t: performance.now() }];
      this.dragTalked = false;
    }

    dragTo(px, py, env) {
      const now = performance.now();
      this.dragHist.push({ x: px, y: py, t: now });
      while (this.dragHist.length > 2 && now - this.dragHist[0].t > 90) this.dragHist.shift();
      this.dragTarget = { x: px, y: py + 36 * this.u };
      if (!this.dragTalked && this.st > 0.5) {
        this.dragTalked = true;
        this.speak(env, 'dragged');
      }
    }

    release(env) {
      const h = this.dragHist;
      let vx = 0, vy = 0;
      if (h.length >= 2) {
        const a = h[0], b = h[h.length - 1];
        const dt = Math.max(16, b.t - a.t) / 1000;
        vx = (b.x - a.x) / dt;
        vy = (b.y - a.y) / dt;
      }
      this.vx = clamp(vx, -2600, 2600);
      this.vy = clamp(vy, -2600, 2600);
      this.spin = clamp(this.vx * 0.006, -14, 14);
      this.bounces = 0;
      this.enter('thrown');
      if (Math.hypot(this.vx, this.vy) > 900) this.speak(env, 'thrown');
    }

    petted(env) {
      if (this.state === 'sleep') {
        this.enter('yawn', 1.2);
        this.speak(env, 'woken', { force: env.settings.chatty !== 'silent' });
        return;
      }
      if (!this.grounded() || this.state === 'special') return;
      this.enter('happy', 1.3);
      this.setEmote('blush', 1.6);
      env.sound('squeak');
      for (let i = 0; i < 3; i++) env.emit('heart', this.x + rand(-14, 14) * this.u, this.y - 52 * this.u, { delay: i * 0.12 });
      this.speak(env, 'petted');
    }

    backflip(env) {
      if (!this.grounded()) return;
      this.support = null;
      this.seg = null;
      this.vy = -820;
      this.vx = this.dir * 40;
      this.spinDir = -this.dir;
      this.enter('flip');
      env.sound('boing');
    }

    command(cmd, env) {
      switch (cmd.type) {
        case 'say': this.speak(env, chance(0.5) ? 'random' : env.fgCat && window.NibbleLines.L[env.fgCat] ? env.fgCat : 'random', { force: true }); break;
        case 'dance': if (this.grounded()) this.enter('dance', 6); break;
        case 'flip': this.backflip(env); this.speak(env, 'flip', { force: true }); break;
        case 'sleep': if (this.grounded()) this.enter('sleep', 60); break;
        case 'wake': if (this.state === 'sleep') this.petted(env); break;
        case 'work': if (this.grounded()) this.enter('work', 30); break;
        case 'special': if (!this.special(env) && this.grounded()) { this.backflip(env); this.speak(env, 'flip', { force: true }); } break;
        case 'summon': {
          const c = env.cursor || { x: env.world.w / 2 };
          this.support = null;
          this.seg = null;
          this.wall = null;
          this.baseRot = 0;
          this.x = clamp(c.x + (this.index - (env.pets.length - 1) / 2) * 50 * this.u, env.world.left + 30, env.world.right - 30);
          this.y = -60 - this.index * 40;
          this.vx = 0; this.vy = 0;
          this.enter('fall');
          break;
        }
      }
    }

    // ---------- special moves (anime crew) ----------
    special(env) {
      const kit = this.kit();
      if (!kit || !kit.special || !this.grounded() || this.state === 'special') return false;
      const u = this.u;
      const seg = this.currentSeg(env);
      this.sp = { type: kit.special, done: false, ghostT: 0, sparkT: 0 };
      this.speak(env, 'sp_' + kit.special, { force: env.settings.chatty !== 'silent' });
      switch (kit.special) {
        case 'shadowstep': {
          const opts = env.platforms.filter((p) => p !== seg && p.x2 - p.x1 > 60 * u);
          const dest = opts.length && chance(0.8) ? opts[Math.floor(Math.random() * opts.length)] : env.floorSeg;
          this.sp.dest = dest;
          this.sp.tx = clamp(dest.x1 + 20 * u + Math.random() * Math.max(1, dest.x2 - dest.x1 - 40 * u), dest.x1 + 16 * u, dest.x2 - 16 * u);
          this.addFx({ type: 'smoke', x: this.x, y: this.y, max: 0.7, seed: Math.random() * 6 });
          this.addFx({ type: 'sfx', x: this.x, y: this.y - 66 * u, text: 'シュン', max: 0.9, color: '#c9d1ff', size: 17 });
          this.enter('special', 0.95);
          return true;
        }
        case 'transform':
          this.addFx({ type: 'ring', x: this.x, y: this.y, max: 0.6, color: '#ff7ab8' });
          this.enter('special', 1.9);
          return true;
        case 'iai':
          this.enter('special', 1.25);
          return true;
        case 'rage':
          this.addFx({ type: 'sfx', x: this.x + 30 * u, y: this.y - 64 * u, text: 'ムカッ', max: 1.1, color: '#ff4d4d', size: 18, rot: 0.12 });
          this.setEmote('anger', 2.2);
          this.enter('special', 2.1);
          return true;
        case 'float':
          this.enter('special', 3);
          return true;
        case 'beat':
          this.addFx({ type: 'sfx', x: this.x, y: this.y - 74 * u, text: 'ドゥン', max: 0.9, color: '#2bb3a3', size: 19 });
          this.enter('special', 3.2);
          return true;
        case 'surf': {
          // pick another window top (or the floor) and ride a wavy cloud arc over to it
          const opts = env.platforms.filter((p) => p !== seg && p.x2 - p.x1 > 60 * u && p.y > env.world.top + 70 * u);
          const dest = opts.length && chance(0.85) ? opts[Math.floor(Math.random() * opts.length)] : env.floorSeg;
          const tx = clamp(dest.x1 + 20 * u + Math.random() * Math.max(1, dest.x2 - dest.x1 - 40 * u), dest.x1 + 16 * u, dest.x2 - 16 * u);
          Object.assign(this.sp, { dest, winId: dest.winId, x0: this.x, y0: this.y, tx, ty: dest.y, puffT: 0 });
          if (Math.abs(tx - this.x) > 4) this.dir = tx > this.x ? 1 : -1;
          this.addFx({ type: 'smoke', x: this.x, y: this.y + 8 * u, max: 0.55, seed: Math.random() * 6, color: 'rgba(255,255,255,0.95)' });
          this.enter('special', 2.2);
          return true;
        }
        case 'boost': {
          let best = null;
          for (const p of env.platforms) {
            if (p === seg || (seg && p.winId != null && p.winId === seg.winId && p.y === seg.y)) continue;
            if (p.x2 - p.x1 < 50 * u || p.y < env.world.top + 70 * u) continue;
            const tx = clamp(this.x + rand(-220, 220), p.x1 + 18 * u, p.x2 - 18 * u);
            const dy = p.y - this.y;
            if (Math.abs(tx - this.x) < 720 && dy < -40 && dy > -680 && (!best || p.y < best.y)) best = { x: tx, y: p.y };
          }
          if (!best) best = { x: clamp(this.x + this.dir * 140, env.world.left + 30, env.world.right - 30), y: this.y };
          this.jet = true;
          this.launch(best.x, best.y, 140);
          this.addFx({ type: 'smoke', x: this.x, y: this.y + 6 * u, max: 0.6, seed: 1, color: 'rgba(255,190,120,0.9)' });
          this.addFx({ type: 'sfx', x: this.x, y: this.y - 30 * u, text: 'ゴォッ', max: 0.9, color: '#ffb020', size: 19 });
          this.sp = null;
          return true;
        }
      }
      this.sp = null;
      return false;
    }

    updateSpecial(dt, env) {
      const sp = this.sp;
      const u = this.u;
      const k = this.st;
      if (!sp) { this.enter('idle', 0.5); return; }
      switch (sp.type) {
        case 'shadowstep':
          if (k < 0.35) this.alpha = 1 - k / 0.35;
          else if (!sp.done) {
            sp.done = true;
            this.alpha = 0;
            this.x = sp.tx;
            this.standOn(sp.dest, env);
            this.dir = chance(0.5) ? 1 : -1;
            this.addFx({ type: 'smoke', x: this.x, y: this.y, max: 0.7, seed: Math.random() * 6 });
          } else this.alpha = Math.max(0, Math.min(1, (k - 0.4) / 0.3));
          break;
        case 'transform':
          this.rot = k < 1.25 ? (k / 1.25) * Math.PI * 4 * this.dir : 0;
          this.liftV = Math.sin(Math.min(1, k / 1.9) * Math.PI) * 24;
          sp.sparkT -= dt;
          if (sp.sparkT <= 0) {
            sp.sparkT = 0.07;
            const a = Math.random() * Math.PI * 2;
            this.addFx({ type: 'spark', x: this.x + Math.cos(a) * 22 * u, y: this.y - 24 * u - this.liftV * u + Math.sin(a) * 22 * u, vx: Math.cos(a) * 30 * u, vy: Math.sin(a) * 30 * u, max: 0.6, color: chance(0.5) ? '#fff27a' : '#ff7ab8' });
          }
          if (k > 1.25 && !sp.done) {
            sp.done = true;
            this.addFx({ type: 'ring', x: this.x, y: this.y - this.liftV * u, max: 0.7, color: '#fff27a' });
            this.addFx({ type: 'sfx', x: this.x, y: this.y - 76 * u, text: 'キラッ', max: 1, color: '#fff27a', size: 19 });
          }
          break;
        case 'iai': {
          const seg = this.currentSeg(env);
          if (k > 0.35 && k < 0.58) {
            const sp2 = 950 * Math.sqrt(u);
            let nx = this.x + this.dir * sp2 * dt;
            if (seg) nx = clamp(nx, seg.x1 + 6 * u, seg.x2 - 6 * u);
            this.x = nx;
            sp.ghostT -= dt;
            if (sp.ghostT <= 0) {
              sp.ghostT = 0.025;
              const g = this.pose();
              g.fx = null;
              this.addFx({ type: 'ghost', pose: g, max: 0.28 });
            }
          } else if (k >= 0.58 && !sp.done) {
            sp.done = true;
            this.addFx({ type: 'slash', x: this.x - this.dir * 30 * u, y: this.y, dir: this.dir, max: 0.45 });
            this.addFx({ type: 'sfx', x: this.x - this.dir * 20 * u, y: this.y - 70 * u, text: 'ズバッ', max: 1, color: '#ffffff', size: 20 });
          }
          break;
        }
        case 'rage':
          this.shake = Math.sin(k * 70) * 1.8 * u * (k < 1.6 ? 1 : 0);
          sp.sparkT -= dt;
          if (sp.sparkT <= 0) { sp.sparkT = 0.12; this.addFx({ type: 'spark', x: this.x + rand(-26, 26) * u, y: this.y - rand(10, 50) * u, vx: 0, vy: -30 * u, max: 0.5, color: '#ff9a1a' }); }
          break;
        case 'surf': {
          // 0–0.35 cloud forms and lifts him · 0.35–1.8 surf the arc · 1.8–2.2 hop off, cloud poofs
          const T0 = 0.35, T1 = 1.8;
          if (k < T0) this.liftV = (k / T0) * 14;
          else if (k < T1) {
            if (!sp.started) {
              sp.started = true;
              this.addFx({ type: 'sfx', x: this.x, y: this.y - 72 * u, text: 'ビューン', max: 1, color: '#7bd88f', size: 18 });
            }
            const e = (k - T0) / (T1 - T0);
            const ez = e < 0.5 ? 2 * e * e : 1 - Math.pow(-2 * e + 2, 2) / 2;
            let ty = sp.ty;
            const w = sp.winId != null ? env.winsById.get(sp.winId) : null;
            if (sp.winId != null && w && sp.wy0 == null) sp.wy0 = w.y;
            if (w && sp.wy0 != null) ty = sp.ty + (w.y - sp.wy0); // follow a window being dragged
            const arc = 80 * u + Math.max(0, sp.y0 - ty) * 0.35;
            this.x = sp.x0 + (sp.tx - sp.x0) * ez;
            this.y = sp.y0 + (ty - sp.y0) * ez - Math.sin(Math.PI * ez) * arc - Math.sin(ez * Math.PI * 4) * 9 * u * Math.sin(Math.PI * ez);
            this.liftV = 14;
            this.rot = Math.cos(ez * Math.PI * 4) * 0.16 * this.dir;
            sp.puffT -= dt;
            if (sp.puffT <= 0) {
              sp.puffT = 0.045;
              this.addFx({ type: 'puff', x: this.x - this.dir * 24 * u, y: this.y - 12 * u + rand(-4, 4) * u, max: 0.7, s: rand(0.7, 1.2) });
            }
          } else {
            if (!sp.done) {
              sp.done = true;
              let dest = sp.dest;
              if (sp.winId != null) {
                const w = env.winsById.get(sp.winId);
                dest = w ? env.platforms.find((p) => p.winId === sp.winId && this.x >= p.x1 - 20 && this.x <= p.x2 + 20) : null;
              } else dest = env.floorSeg;
              if (!dest) dest = env.floorSeg;
              this.x = clamp(this.x, dest.x1 + 10 * u, dest.x2 - 10 * u);
              this.standOn(dest, env);
              this.rot = 0;
              this.addFx({ type: 'smoke', x: this.x, y: this.y + 8 * u, max: 0.6, seed: Math.random() * 6, color: 'rgba(255,255,255,0.95)' });
            }
            this.liftV = Math.max(0, 14 * (1 - (k - T1) / 0.25));
          }
          break;
        }
        case 'beat': {
          // bass pulses out in coral/teal rings, notes fly, and nearby pets get pulled into a dance
          sp.sparkT -= dt;
          if (sp.sparkT <= 0) {
            sp.sparkT = 0.5;
            sp.n = (sp.n || 0) + 1;
            this.addFx({ type: 'ring', x: this.x, y: this.y - 8 * u, max: 0.9, color: sp.n % 2 ? '#ff6f61' : '#2bb3a3' });
          }
          sp.ghostT -= dt;
          if (sp.ghostT <= 0) { sp.ghostT = 0.32; env.emit('note', this.x + rand(-26, 26) * u, this.y - 66 * u); }
          if (!sp.done && k > 0.35) {
            sp.done = true;
            for (const o of env.pets) {
              if (o === this || !o.grounded() || BUSY.has(o.state) || o.state === 'sleep') continue;
              if (Math.abs(o.x - this.x) < 300 && Math.abs(o.y - this.y) < 220) { o.dir = sign(this.x - o.x); o.enter('dance', 3.4); }
            }
          }
          break;
        }
        case 'float':
          this.liftV = Math.sin(Math.min(1, k / 3) * Math.PI) * 42;
          this.alpha = 0.78 + Math.sin(k * 6) * 0.12;
          sp.sparkT -= dt;
          if (sp.sparkT <= 0) { sp.sparkT = 0.2; this.addFx({ type: 'spark', x: this.x + rand(-30, 30) * u, y: this.y - this.liftV * u - rand(0, 40) * u, vx: 0, vy: -20 * u, max: 0.8, color: '#7ae2ff' }); }
          break;
      }
      if (this.st >= this.dur) {
        this.alpha = 1; this.liftV = 0; this.rot = 0; this.shake = 0;
        this.sp = null;
        this.enter('idle', 0.9);
      }
    }

    // ---------- per-frame update ----------
    update(dt, env) {
      const u = (this._u = 1.1 * (env.settings.size || 1));
      this.t += dt;
      this.st += dt;
      if (this.bubble) {
        this.bubble.t += dt;
        if (this.bubble.t > this.bubble.dur) this.bubble = null;
      }
      for (let i = this.fx.length - 1; i >= 0; i--) {
        this.fx[i].t += dt;
        if (this.fx[i].t > this.fx[i].max) this.fx.splice(i, 1);
      }
      if (this.emoteT > 0) { this.emoteT -= dt; if (this.emoteT <= 0) this.emote = null; }
      if (this.state !== 'special' && this.alpha !== 1 && this.state !== 'drag') this.alpha = 1;

      // blinking
      this.blinkT -= dt;
      if (this.blinkT <= 0) { this.blinkT = rand(2, 5.5); this.blinkAnim = 0.16; }
      if (this.blinkAnim > 0) { this.blinkAnim -= dt; this.blink = Math.abs(Math.cos((this.blinkAnim / 0.16) * Math.PI)); }
      else this.blink = 1;

      // hover → perk up / wake
      const c = env.cursor;
      const hovered = c && this.hit(c.x, c.y);
      this.hoverT = hovered ? this.hoverT + dt : 0;
      if (this.state === 'sleep' && this.hoverT > 1.4) { this.petted(env); }

      // ground support (handles windows moving / closing)
      const surfing = this.state === 'special' && this.sp && this.sp.type === 'surf' && !this.sp.done;
      if (this.support && !AIR.has(this.state) && this.state !== 'drag' && !surfing) {
        if (!this.checkSupport(env)) this.loseSupport(env, this.support?.type === 'win' ? 'gone' : null);
      }

      // look target
      let lx = 0, ly = 0;
      if (c) {
        const dx = c.x - this.x, dy = c.y - (this.y - 25 * u);
        const d = Math.hypot(dx, dy);
        if (d < 320) { lx = clamp(dx / 120, -1, 1); ly = clamp(dy / 120, -1, 1); }
      }

      const s = this.state;
      const seg = this.currentSeg(env);
      const speedW = 46 * Math.sqrt(u);
      const speedR = 175 * Math.sqrt(u);

      switch (s) {
        case 'idle':
        case 'look':
        case 'sit':
        case 'wave':
        case 'happy':
        case 'dance':
        case 'work':
        case 'yawn':
        case 'dizzy':
        case 'land':
        case 'sleep': {
          if (s === 'look') { lx = Math.sin(this.st * 2.2) * 0.9; ly = -0.2; }
          if (s === 'work') { lx = 0.7 * this.dir; ly = 0.5; if (chance(dt * 0.6)) env.emit('code', this.x + this.dir * 16 * u, this.y - 40 * u); }
          if (s === 'sleep') {
            lx = 0; ly = 0;
            this.particleT -= dt;
            if (this.particleT <= 0) { this.particleT = 1.3; env.emit('z', this.x + this.dir * 14 * u, this.y - 46 * u); }
          }
          if (s === 'dance') {
            this.particleT -= dt;
            if (this.particleT <= 0) { this.particleT = 0.6; env.emit('note', this.x + rand(-20, 20) * u, this.y - 56 * u); }
            if (Math.floor(this.st * 1.5) % 2 === 0) this.dir = 1; else this.dir = -1;
          }
          if (s === 'dizzy') {
            this.particleT -= dt;
            if (this.particleT <= 0) { this.particleT = 0.35; env.emit('star', this.x, this.y - 58 * u); }
          }
          if (this.dur && this.st >= this.dur) {
            if (s === 'sleep') { this.enter('yawn', 1.3); }
            else if (s === 'yawn' && chance(0.3) && (env.idle || 0) > 120) this.enter('sleep', rand(20, 60));
            else this.think(env);
          } else if (!this.dur) this.think(env);
          break;
        }
        case 'walk':
        case 'run': {
          const sp = s === 'run' ? speedR : speedW;
          this.x += this.dir * sp * dt;
          this.walk += dt * sp * 0.16 / Math.sqrt(u);
          if (this.chaseX != null) {
            if ((this.dir > 0 && this.x >= this.chaseX) || (this.dir < 0 && this.x <= this.chaseX)) {
              this.chaseX = null;
              this.chaseDrop = false;
              this.enter('idle', 0.4);
              break;
            }
          }
          if (seg) {
            const margin = seg === env.floorSeg ? 20 * u : 3 * u;
            if (this.dir > 0 && this.x > seg.x2 - margin) { this.x = seg.x2 - margin; this.atEdge(env, seg); }
            else if (this.dir < 0 && this.x < seg.x1 + margin) { this.x = seg.x1 + margin; this.atEdge(env, seg); }
          }
          if (this.state === s && this.st >= this.dur) { this.chaseX = null; this.think(env); }
          break;
        }
        case 'special': {
          this.updateSpecial(dt, env);
          if (this.sp && this.sp.type === 'iai') { lx = this.dir; ly = 0; }
          break;
        }
        case 'crouch': {
          this.sy += (0.78 - this.sy) * Math.min(1, dt * 30);
          this.sx += (1.14 - this.sx) * Math.min(1, dt * 30);
          if (this.st >= this.dur) {
            if (this.jumpGoal) { this.launch(this.jumpGoal.x, this.jumpGoal.y); this.jumpGoal = null; env.sound('hop'); }
            else this.enter('idle', 0.5);
          }
          break;
        }
        case 'jump':
        case 'fall':
        case 'thrown':
        case 'flip': {
          this.air(dt, env);
          break;
        }
        case 'climb': {
          const sp = 78 * Math.sqrt(u) * (0.55 + 0.45 * Math.max(0, Math.sin(this.st * 5)));
          this.y -= sp * dt;
          this.walk += dt * 7;
          lx = 0; ly = 0;
          if (this.y <= this.climbGoal) this.enter('cling', rand(1, 3));
          break;
        }
        case 'cling': {
          lx = Math.sin(this.st * 1.7) * 0.8; ly = 0;
          if (this.st >= this.dur) {
            if (chance(0.35) && this.y > env.world.top + 160) { this.climbGoal = this.y - rand(60, 200); this.enter('climb'); }
            else this.jumpOffWall(env);
          }
          break;
        }
        case 'drag': {
          const tg = this.dragTarget || { x: this.x, y: this.y };
          const pvx = tg.x - this.x;
          this.x += (tg.x - this.x) * Math.min(1, dt * 22);
          this.y += (tg.y - this.y) * Math.min(1, dt * 22);
          this.rot += (clamp(-pvx * 0.012, -0.9, 0.9) - this.rot) * Math.min(1, dt * 8);
          this.walk += dt * 18;
          lx = 0; ly = -0.4;
          break;
        }
      }

      // squash & stretch springs back
      if (this.state !== 'crouch') {
        let ty = 1, tx = 1;
        if (this.state === 'sit' || this.state === 'sleep' || this.state === 'work') { ty = 0.93; tx = 1.04; }
        const breathe = (this.state === 'sleep' ? 0.035 : 0.018) * Math.sin(this.t * (this.state === 'sleep' ? 1.6 : 2.6));
        this.sy += (ty + breathe - this.sy) * Math.min(1, dt * 12);
        this.sx += (tx - breathe * 0.6 - this.sx) * Math.min(1, dt * 12);
      }
      if (this.state !== 'climb' && this.state !== 'cling') this.baseRot += (0 - this.baseRot) * Math.min(1, dt * 10);
      if (this.state !== 'drag' && this.state !== 'thrown' && this.state !== 'flip' && this.state !== 'special') this.rot += (0 - this.rot) * Math.min(1, dt * 12);
      if (this.state === 'special' && this.sp && this.sp.type === 'iai' && this.st < 0.35) { this.sy = 0.86; this.sx = 1.1; }

      this.lookGoal.x = lx; this.lookGoal.y = ly;
      this.look.x += (this.lookGoal.x - this.look.x) * Math.min(1, dt * 8);
      this.look.y += (this.lookGoal.y - this.look.y) * Math.min(1, dt * 8);
    }

    air(dt, env) {
      const w = env.world;
      const u = this.u;
      const prevY = this.y;
      this.vy += G * dt;
      if (this.state === 'thrown') this.vx *= 1 - 0.25 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.state === 'thrown') this.rot += this.spin * dt;
      if (this.state === 'flip') this.rot = this.spinDir * Math.PI * 2 * clamp(this.st / 0.68, 0, 1);
      if (this.state === 'jump' || this.state === 'fall') this.walk += dt * 6;

      // walls
      const r = 20 * u;
      if (this.x < w.left + r) {
        this.x = w.left + r;
        if (this.state === 'thrown' && Math.abs(this.vx) > 1400 && chance(0.4)) { this.vy = 0; this.startClimb(env, 'left', this.y - 20 * u); return; }
        this.vx = Math.abs(this.vx) * 0.45;
        if (this.state === 'thrown') env.sound('boing');
      } else if (this.x > w.right - r) {
        this.x = w.right - r;
        if (this.state === 'thrown' && Math.abs(this.vx) > 1400 && chance(0.4)) { this.vy = 0; this.startClimb(env, 'right', this.y - 20 * u); return; }
        this.vx = -Math.abs(this.vx) * 0.45;
        if (this.state === 'thrown') env.sound('boing');
      }
      // ceiling (only once on-screen; pets dropping in start above it)
      if (prevY > w.top + 50 * u && this.y - 50 * u < w.top && this.vy < 0) {
        this.y = w.top + 50 * u;
        this.vy = Math.abs(this.vy) * 0.3;
      }

      if (this.vy <= 0) return;

      // landing: one-way platforms (window tops) + floor
      let land = null;
      if (env.settings.walkOnWindows) {
        for (const p of env.platforms) {
          if (prevY <= p.y + 1 && this.y >= p.y && this.x >= p.x1 && this.x <= p.x2) {
            if (!land || p.y < land.y) land = p;
          }
        }
      }
      if (!land && this.y >= w.floor) land = env.floorSeg;
      if (land) this.land(land, env);
    }

    land(seg, env) {
      const impact = this.vy;
      const u = this.u;
      if (this.state === 'thrown' && impact > 1100 && this.bounces < 2) {
        this.y = seg.y;
        this.vy = -impact * 0.36;
        this.vx *= 0.7;
        this.bounces++;
        this.sy = 0.7; this.sx = 1.3;
        env.sound('boing');
        return;
      }
      this.standOn(seg, env);
      if (this.jet) {
        this.jet = false;
        this.addFx({ type: 'smoke', x: this.x, y: this.y + 4 * u, max: 0.5, seed: 2, color: 'rgba(255,200,140,0.85)' });
        this.addFx({ type: 'sfx', x: this.x, y: this.y - 64 * u, text: 'ドン', max: 0.8, color: '#a3ff12', size: 18 });
      }
      this.vy = 0;
      this.vx = 0;
      this.rot = 0;
      const k = Math.min(0.38, impact / 4200);
      this.sy = 1 - k;
      this.sx = 1 + k * 0.9;
      env.emit('dust', this.x, this.y, { n: impact > 900 ? 6 : 3 });
      if (impact > 700) env.sound('pop');
      const wasThrown = this.state === 'thrown';
      if (wasThrown && impact > 1300) {
        this.enter('dizzy', 1.8);
        this.setEmote('anger', 3);
        this.speak(env, 'landHard');
      } else {
        this.enter('land', 0.16 + impact / 7000);
      }
      if (!this.greeted) {
        this.greeted = true;
        env.onFirstLanding(this);
      }
    }

    // ---------- pose for the renderer ----------
    pose() {
      const s = this.state;
      const u = this.u;
      const p = {
        x: this.x, y: this.y, dir: this.dir, rot: this.rot, baseRot: this.baseRot,
        sx: this.sx, sy: this.sy, walk: this.walk, t: this.t, blink: this.blink,
        look: { x: this.look.x * this.dir, y: this.look.y },
        eyes: 'open', mouth: 'w', arms: 'down', ears: 0, stride: 0, bob: 0, tailWag: 3,
        alpha: this.alpha, lift: this.liftV, emote: this.emote, fx: this.fx,
        air: AIR.has(s), sleep: s === 'sleep',
      };
      if (this.shake) p.x += this.shake;
      if (this.hoverT > 0.05 && s !== 'sleep') { p.ears = 1; p.tailWag = 9; }
      switch (s) {
        case 'walk': p.stride = 1; p.bob = Math.abs(Math.sin(this.walk)) * 1.6; break;
        case 'run': p.stride = 1.4; p.bob = Math.abs(Math.sin(this.walk)) * 3; p.ears = -0.3; p.tailWag = 12; p.mouth = 'smile'; p.speed = true; break;
        case 'sit': p.sit = true; break;
        case 'sleep': p.sit = true; p.eyes = 'closed'; p.ears = -1; p.mouth = 'flat'; p.tailWag = 0.8; p.blink = 1; break;
        case 'yawn': p.sit = true; p.eyes = 'closed'; p.mouth = 'yawn'; p.arms = 'up'; break;
        case 'wave': p.arms = 'wave'; p.mouth = 'smile'; p.eyes = this.st % 1.2 < 0.6 ? 'happy' : 'open'; p.ears = 1; break;
        case 'happy': p.eyes = 'happy'; p.mouth = 'open'; p.ears = 1; p.tailWag = 14; p.bob = Math.abs(Math.sin(this.st * 9)) * 7; p.arms = 'up'; break;
        case 'dance':
          p.eyes = 'happy'; p.mouth = 'smile'; p.arms = 'dance'; p.headphones = true;
          p.bob = Math.abs(Math.sin(this.t * 8)) * 6; p.stride = 0.8; p.walk = this.t * 8; p.rot = Math.sin(this.t * 4) * 0.12; break;
        case 'work': p.sit = true; p.laptop = true; p.glasses = true; p.arms = 'type'; p.mouth = 'flat'; p.headphones = this.index % 2 === 1; break;
        case 'dizzy': p.eyes = 'dizzy'; p.mouth = 'o'; p.ears = -0.6; p.rot = Math.sin(this.t * 6) * 0.15; break;
        case 'land': break;
        case 'crouch': p.eyes = 'open'; p.ears = 0.5; break;
        case 'jump': p.stride = 0.8; p.mouth = this.vy < 0 ? 'smile' : 'o'; p.ears = this.vy < 0 ? -0.4 : 0.8; p.arms = this.vy < 0 ? 'up' : 'down';
          if (this.jet) { p.jet = this.vy < 250; p.arms = 'up'; p.eyes = 'wide'; p.mouth = 'open'; p.speed = this.vy < 0; }
          break;
        case 'fall': p.eyes = 'wide'; p.mouth = 'o'; p.ears = 1; p.arms = 'up'; p.stride = 1.4; p.walk = this.t * 25; break;
        case 'thrown': p.eyes = Math.abs(this.spin) > 6 ? 'x' : 'happy'; p.mouth = 'open'; p.arms = 'up'; p.stride = 1.2; p.walk = this.t * 22; break;
        case 'flip': p.eyes = 'happy'; p.mouth = 'open'; p.arms = 'up'; break;
        case 'drag': p.eyes = Math.sin(this.t * 3) > 0 ? 'wide' : 'happy'; p.mouth = 'o'; p.arms = 'up'; p.stride = 1.5; p.ears = 1; p.emote = 'sweat'; break;
        case 'special': {
          const t2 = this.sp ? this.sp.type : '';
          const k = this.st;
          if (t2 === 'shadowstep') { p.arms = 'up'; p.eyes = 'open'; }
          else if (t2 === 'transform') { p.wand = true; p.arms = 'wave'; p.eyes = k > 1.25 ? 'star' : 'happy'; p.mouth = 'open'; p.ears = 1; }
          else if (t2 === 'iai') {
            if (k < 0.35) { p.eyes = 'open'; p.mouth = 'flat'; p.ears = -0.3; }
            else if (k < 0.58) { p.speed = true; p.stride = 1.4; p.walk = this.t * 30; p.mouth = 'flat'; }
            else { p.eyes = 'closed'; p.mouth = 'flat'; }
          } else if (t2 === 'rage') { p.aura = '#ff7a1a'; p.mouth = 'open'; p.arms = 'up'; p.ears = 1; p.emote = 'anger'; }
          else if (t2 === 'float') { p.eyes = 'happy'; p.arms = 'up'; p.tailWag = 2; p.mouth = 'smile'; }
          else if (t2 === 'beat') { p.vinyl = true; p.arms = 'vinyl'; p.music = true; p.eyes = 'happy'; p.mouth = 'open'; p.excited = true; p.bob = Math.abs(Math.sin(k * 9.4)) * 4; }
          else if (t2 === 'surf') {
            p.cloud = k < 0.25 ? k / 0.25 : k < 1.8 ? 1 : Math.max(0, 1 - (k - 1.8) / 0.2);
            if (p.cloud <= 0) p.cloud = 0;
            const riding = k >= 0.35 && k < 1.8;
            p.arms = riding ? 'wave' : 'up'; p.eyes = riding ? 'happy' : 'open'; p.mouth = 'smile'; p.ears = riding ? -0.3 : 1;
            p.speed = riding; p.tailWag = 10;
          }
          break;
        }
        case 'climb': p.arms = 'climb'; p.stride = 1; p.look = { x: 0, y: -0.3 }; break;
        case 'cling': p.arms = 'climb'; p.look = { x: this.look.x, y: 0 }; break;
      }
      return p;
    }
  }

  window.NibblePet = Pet;
})();
