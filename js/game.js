'use strict';
// 孤軍奮闘小早川 — ゲーム本体

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const hypot = Math.hypot;
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d');
const mini = $('minimap');
const mctx = mini.getContext('2d');

let DPR = 1, CW = 0, CH = 0, ZOOM = 1;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  CW = window.innerWidth; CH = window.innerHeight;
  canvas.width = CW * DPR; canvas.height = CH * DPR;
  canvas.style.width = CW + 'px'; canvas.style.height = CH + 'px';
  ZOOM = clamp(Math.sqrt(CW * CH) / 760, 0.62, 2.0);
}
window.addEventListener('resize', resize);
resize();

// ---------------- 状態 ----------------
let terrainImg = null, miniBg = null;
let G = null;
const TOTAL_GENERALS = UNITS.length;

function newGame() {
  G = {
    state: 'play', t: 0, slow: 1,
    player: {
      x: PLAYER_START.x, y: PLAYER_START.y, r: 12, hp: 300, maxHp: 300, st: 100, maxSt: 100,
      face: -0.6, fx: 1, vx: 0, vy: 0, dashing: false, inv: 1.5, atk: null,
      cdSword: 0, cdSpear: 0, combo: 0, comboT: 0, gait: 0, lastHurt: -10, stDelay: 0, gallopT: 0,
      dead: false,
    },
    units: [], enemies: [], bullets: [], parts: [], corpses: [], pickups: [], fx: [], floats: [],
    soldierKills: 0, killed: [], shake: 0, hitstop: 0,
    events: makeEvents(), nextWestAct: 14, nextEastAct: 1e9, eastAwake: false,
    ieyasuDead: false, endT: 0, drumT: 0, beat: 0, nextAmbHorn: 25,
    cam: { x: PLAYER_START.x, y: PLAYER_START.y - 100 },
  };
  spawnArmies();
  lastHornT = -10;
  $('msgs').innerHTML = '';
}

function spawnArmies() {
  UNITS.forEach((d, idx) => {
    const u = Object.assign({}, d, { idx, active: false, dead: false, soldiers: [], gen: null, alive: 0 });
    // 前方（敵陣側）
    const fdir = d.side === 'W' ? 0 : Math.PI;
    u.fdir = fdir;
    const gen = makeEnemy(u, 'gen', d.x, d.y);
    u.gen = gen;
    const total = d.n;
    for (let i = 0; i < total; i++) {
      const row = Math.floor(i / 6), col = i % 6;
      const fx = Math.cos(fdir), fy = Math.sin(fdir);
      const px = -fy, py = fx;
      const off = 30 + row * 20, side = (col - 2.5) * 19 + (row % 2) * 8;
      const hx = d.x + fx * off + px * side, hy = d.y + fy * off + py * side;
      const type = i < d.g ? 'gun' : 'ashi';
      const e = makeEnemy(u, type, hx, hy);
      u.soldiers.push(e);
    }
    u.alive = total;
    G.units.push(u);
  });
}

function armorColor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (r * 0.3 + g * 0.59 + b * 0.11 > 190) return '#3b3b40';
  return hex;
}

// 難易度（ボットの自動プレイで調整：刀と槍を使い分ける上手いボットが約 3 割で最後まで勝てる程度）
const SPEAR_STAMINA = 14; // 槍 1 突きで使う駆
const SPEAR_PIERCE = 2;   // 槍が貫く人数

const DIFF = {
  dmg: 1.24,      // 敵の攻撃力の倍率
  genHp: 1.29,    // 武将の体力の倍率
  genHeal: 46,    // 武将が落とす兵糧の回復量
  dropRate: 0.05, // 足軽が兵糧を落とす確率
  regen: 1.5,     // 自然回復（毎秒）
};

function makeEnemy(u, type, x, y) {
  const e = {
    u, type, x, y, hx: x, hy: y, alive: true, state: 'hold',
    face: u.fdir, fx: Math.cos(u.fdir) >= 0 ? 1 : -1,
    atkT: 0, cd: rand(0.5, 1.5), aimT: 0, aimA: 0, flash: 0, kvx: 0, kvy: 0, gait: rand(0, 6), trampleCd: 0,
    routT: 0, charge: 0, chargeT: 0, chargeCd: rand(2, 4), chargeA: 0, wobble: rand(0, TAU), armor: armorColor(u.bg),
  };
  if (type === 'gen') {
    e.r = 12; e.hp = e.maxHp = u.hp * DIFF.genHp; e.speed = u.brave ? 125 : 110; e.dmg = u.pow * DIFF.dmg; e.reach = 26; e.windup = 0.45;
  } else if (type === 'gun') {
    e.r = 7; e.hp = e.maxHp = 24; e.speed = 74; e.dmg = 15 * DIFF.dmg; e.reach = 0; e.windup = 0.75;
  } else {
    e.r = 7; e.hp = e.maxHp = 32; e.speed = rand(76, 90); e.dmg = 8 * DIFF.dmg; e.reach = 20; e.windup = 0.42;
  }
  G.enemies.push(e);
  return e;
}

// ---------------- イベント ----------------
function makeEvents() {
  return [
    { t: 0.2, f: () => msg(t('ev.0'), 'sys', 5) },
    { t: 2.4, f: () => msg(t('ev.1'), 'sys', 5) },
    { t: 5.0, f: () => { msg(t('ev.2'), 'warn', 5); Sfx.horn(0.45); lastHornT = G.t; Sfx.swell(0.9); G.shake = 6; activateNear('W', 1050); } },
    { t: 8.5, f: () => { msg(t('ev.3'), 'say', 6); unitHorn(G.units.find((u) => u.name === '石田三成'), true); } },
    { t: 12, f: () => msg(t('ev.4'), 'sys', 5) },
    { t: 34, f: () => { msg(t('ev.5'), 'warn', 6); Sfx.gun(0.9); setTimeout(() => Sfx.gun(0.8), 180); setTimeout(() => Sfx.gun(0.9), 420); G.shake = 10; flashScreen('rgba(255,240,200,0.5)'); } },
    { t: 37, f: () => { msg(t('ev.6'), 'say', 7); Sfx.horn(0.45, 0.3, 0.9, [0.6, 0.6, 0.6, 2.0]); lastHornT = G.t; Sfx.swell(1); G.eastAwake = true; G.nextEastAct = G.t + 2; activateNear('E', 700); } },
    { t: 42, f: () => msg(t('ev.7'), 'sys', 5) },
  ];
}

function activateUnit(u, quiet) {
  if (u.active || u.dead) return;
  u.active = true;
  if (u.gen.alive) u.gen.state = 'chase';
  for (const s of u.soldiers) if (s.alive && s.state === 'hold') s.state = 'chase';
  if (!quiet) {
    msg(t(u.side === 'W' ? 'msg.attackW' : 'msg.attackE', { name: I18N.name(u) }), u.side === 'W' ? 'w' : 'e', 4);
    unitHorn(u);
  }
}

// その部隊の方角・距離から法螺貝を鳴らす
let lastHornT = -10;
function unitHorn(u, force) {
  if (!u || !G || G.state !== 'play') return;
  if (!force && G.t - lastHornT < 3.5) return;
  lastHornT = G.t;
  const P = G.player;
  const d = hypot(u.x - P.x, u.y - P.y);
  const vol = clamp(0.4 - d / 4500, 0.06, 0.4);
  const pan = clamp((u.x - P.x) / 900, -1, 1);
  const pitch = u.side === 'W' ? 1 : 0.88; // 東西で音色を少し変える
  const calls = Math.random() < 0.5 ? [0.5, 0.5, 1.5] : [0.8, 1.8];
  Sfx.horn(vol, pan, pitch * rand(0.95, 1.05), calls);
}

// 危険度（近くで迫る敵の多さと体力の低さ）0〜1
function threatLevel() {
  const P = G.player;
  let th = 0;
  for (const e of G.enemies) {
    if (!e.alive || e.state !== 'chase') continue;
    const d = Math.abs(e.x - P.x) + Math.abs(e.y - P.y);
    if (d < 600) { const w = 1 - d / 600; th += w * w * (e.type === 'gen' ? 3 : 1); }
  }
  return clamp(th / 12 + (1 - P.hp / P.maxHp) * 0.35, 0, 1);
}
function activateNear(side, range) {
  const P = G.player;
  for (const u of G.units) if (u.side === side && !u.active && hypot(u.x - P.x, u.y - P.y) < range) activateUnit(u);
}
function activateNearest(side) {
  const P = G.player;
  let best = null, bd = 1e9;
  for (const u of G.units) {
    if (u.side !== side || u.active || u.dead) continue;
    const d = hypot(u.x - P.x, u.y - P.y);
    if (d < bd) { bd = d; best = u; }
  }
  if (best) activateUnit(best);
}

// ---------------- メッセージ ----------------
function msg(text, cls = 'sys', life = 4) {
  const box = $('msgs');
  const el = document.createElement('div');
  el.className = 'msg ' + cls;
  el.textContent = text;
  box.appendChild(el);
  while (box.children.length > (CW < 600 || CH < 500 ? 3 : 5)) box.removeChild(box.firstChild);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 600); }, life * 1000);
}
function banner(text, sub) {
  const b = $('banner');
  b.innerHTML = `<div class="b-main">${text}</div>${sub ? `<div class="b-sub">${sub}</div>` : ''}`;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}
function flashScreen(color) {
  const f = $('flash');
  f.style.background = color;
  f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
}

// ---------------- 入力 ----------------
const keys = new Set();
const input = { mx: 0, my: 0, mouseAim: false, joy: null, tDash: false, swordQ: false, spearQ: false, aimA: null };
window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) { keys.add(e.code); return; }
  keys.add(e.code);
  Sfx.init();
  if (G && G.state === 'play') {
    if (e.code === 'KeyJ' || e.code === 'KeyZ') { input.swordQ = true; input.mouseAim = false; }
    if (e.code === 'KeyK' || e.code === 'KeyX') { input.spearQ = true; input.mouseAim = false; }
    if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  } else if (G && G.state === 'pause' && (e.code === 'KeyP' || e.code === 'Escape')) togglePause();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
canvas.addEventListener('mousemove', (e) => { input.mx = e.clientX; input.my = e.clientY; });
canvas.addEventListener('mousedown', (e) => {
  Sfx.init();
  input.mx = e.clientX; input.my = e.clientY; input.mouseAim = true;
  if (e.button === 0) input.swordQ = true;
  if (e.button === 2) input.spearQ = true;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// タッチ操作
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
if (isTouch) document.body.classList.add('touch');
(function setupTouch() {
  const zone = $('joyzone'), base = $('joybase'), knob = $('joyknob');
  let id = null, ox = 0, oy = 0;
  zone.addEventListener('touchstart', (e) => {
    Sfx.init();
    const t = e.changedTouches[0];
    id = t.identifier; ox = t.clientX; oy = t.clientY;
    base.style.left = ox + 'px'; base.style.top = oy + 'px'; base.classList.add('on');
    knob.style.transform = 'translate(-50%,-50%)';
    input.joy = { x: 0, y: 0 };
    e.preventDefault();
  }, { passive: false });
  zone.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) if (t.identifier === id) {
      let dx = t.clientX - ox, dy = t.clientY - oy;
      const d = hypot(dx, dy), m = 55;
      if (d > m) { dx *= m / d; dy *= m / d; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      input.joy = { x: dx / m, y: dy / m };
    }
    e.preventDefault();
  }, { passive: false });
  const end = (e) => {
    for (const t of e.changedTouches) if (t.identifier === id) { id = null; input.joy = null; base.classList.remove('on'); }
  };
  zone.addEventListener('touchend', end); zone.addEventListener('touchcancel', end);
  const bind = (el, down, up) => {
    el.addEventListener('touchstart', (e) => { Sfx.init(); el.classList.add('press'); down(); e.preventDefault(); }, { passive: false });
    el.addEventListener('touchend', (e) => { el.classList.remove('press'); up && up(); e.preventDefault(); }, { passive: false });
    el.addEventListener('touchcancel', () => { el.classList.remove('press'); up && up(); });
  };
  bind($('btnSword'), () => { input.swordQ = true; input.mouseAim = false; });
  bind($('btnSpear'), () => { input.spearQ = true; input.mouseAim = false; });
  bind($('btnDash'), () => { input.tDash = true; }, () => { input.tDash = false; });
})();

function screenToWorld(sx, sy) {
  return { x: G.cam.x + (sx - CW / 2) / ZOOM, y: G.cam.y + (sy - CH / 2) / ZOOM };
}

// ---------------- プレイヤー ----------------
function updatePlayer(dt) {
  const P = G.player;
  if (P.dead) return;
  let mx = 0, my = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) my -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) my += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
  if (input.joy) { mx += input.joy.x; my += input.joy.y; }
  let ml = hypot(mx, my);
  if (ml > 1) { mx /= ml; my /= ml; ml = 1; }
  if (ml < 0.15) { mx = my = 0; ml = 0; }

  const wantDash = keys.has('Space') || keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyL') || input.tDash;
  if (wantDash && ml > 0 && (P.dashing ? P.st > 0 : P.st > 15)) {
    if (!P.dashing) { P.dashing = true; P.inv = Math.max(P.inv, 0.2); spawnDust(P.x, P.y, 8); }
    P.st = Math.max(0, P.st - 34 * dt); P.stDelay = 0.6;
  } else {
    P.dashing = false;
    if (P.stDelay > 0) P.stDelay -= dt; else P.st = Math.min(P.maxSt, P.st + 24 * dt);
  }

  const base = 150 * (P.dashing ? 2.25 : 1) * (P.atk && P.atk.type === 'spear' && !P.atk.charge ? 0.55 : 1);
  if (ml > 0) {
    const tf = terrainFactor(P.x, P.y, mx / ml, my / ml);
    const tvx = mx * base * tf, tvy = my * base * tf;
    const k = 1 - Math.exp(-dt * (P.dashing ? 9 : 12));
    P.vx += (tvx - P.vx) * k; P.vy += (tvy - P.vy) * k;
    P.face = Math.atan2(my, mx);
  } else {
    const k = 1 - Math.exp(-dt * 8);
    P.vx -= P.vx * k; P.vy -= P.vy * k;
  }
  P.x = clamp(P.x + P.vx * dt, 20, WORLD.W - 20);
  P.y = clamp(P.y + P.vy * dt, 20, WORLD.H - 20);
  const sp = hypot(P.vx, P.vy);
  P.gait += sp * dt * 0.09;
  if (Math.abs(P.vx) > 8) P.fx = P.vx > 0 ? 1 : -1;
  if (sp > 60) {
    P.gallopT -= dt;
    if (P.gallopT <= 0) { P.gallopT = P.dashing ? 0.13 : 0.24; Sfx.gallop(); if (P.dashing) spawnDust(P.x - P.vx * 0.05, P.y + 2, 2); }
  }
  // 川しぶき
  if (sp > 40 && (flagAt(P.x, P.y) & F_RIVER) && !(flagAt(P.x, P.y) & F_ROAD) && Math.random() < 0.4) {
    G.parts.push({ x: P.x + rand(-8, 8), y: P.y, vx: rand(-30, 30), vy: rand(-60, -20), life: 0.5, max: 0.5, c: '#bfe0f0', s: 2.5, g: 120 });
  }

  // 自然回復
  if (G.t - P.lastHurt > 4) P.hp = Math.min(P.maxHp, P.hp + DIFF.regen * dt);
  if (P.inv > 0) P.inv -= dt;
  P.cdSword -= dt; P.cdSpear -= dt; P.comboT -= dt;
  if (P.comboT <= 0) P.combo = 0;
  if (P.atk) { P.atk.t += dt; if (P.atk.t >= P.atk.dur) P.atk = null; }

  if (input.swordQ) { input.swordQ = false; if (P.cdSword <= 0 && !(P.atk && P.atk.type === 'spear')) doSword(); }
  if (input.spearQ) { input.spearQ = false; if (P.cdSpear <= 0 && !P.atk) doSpear(); }
  // 長押しで連撃
  if (!P.atk && P.cdSword <= 0 && keys.has('KeyJ')) doSword();
  if (!P.atk && P.cdSpear <= 0 && keys.has('KeyK')) doSpear();

  // 馬で蹴散らす
  if (P.dashing && sp > 200) {
    for (const e of G.enemies) {
      if (!e.alive || e.trampleCd > 0) continue;
      const d = hypot(e.x - P.x, e.y - P.y);
      if (d < P.r + e.r + 4) {
        e.trampleCd = 0.6;
        const kx = (e.x - P.x) / (d || 1), ky = (e.y - P.y) / (d || 1);
        damageEnemy(e, e.type === 'gen' ? 10 : 18, kx * 260, ky * 260, 'trample');
      }
    }
  }
}

function aimAngle() {
  const P = G.player;
  if (input.mouseAim) {
    const w = screenToWorld(input.mx, input.my);
    return Math.atan2(w.y - (P.y - 20), w.x - P.x);
  }
  // 自動照準：向いている方向の近くの敵
  let best = null, bs = 1e9;
  for (const e of G.enemies) {
    if (!e.alive) continue;
    const dx = e.x - P.x, dy = e.y - P.y;
    const d = hypot(dx, dy);
    if (d > 150) continue;
    const ad = Math.abs(angDiff(Math.atan2(dy, dx), P.face));
    if (ad > 1.4) continue;
    const s = d + ad * 60 - (e.type === 'gen' ? 30 : 0);
    if (s < bs) { bs = s; best = e; }
  }
  return best ? Math.atan2(best.y - P.y, best.x - P.x) : P.face;
}

function doSword() {
  const P = G.player;
  const a = aimAngle();
  P.combo = P.comboT > 0 ? P.combo + 1 : 1;
  P.comboT = 0.55;
  const spin = P.combo >= 3;
  if (spin) P.combo = 0;
  P.atk = { type: 'sword', t: 0, dur: spin ? 0.32 : 0.2, ang: a, spin, dir: P.combo % 2 ? 1 : -1 };
  P.cdSword = spin ? 0.42 : 0.22;
  if (Math.cos(a) !== 0) P.fx = Math.cos(a) >= 0 ? 1 : -1;
  Sfx.slash();
  const range = spin ? 68 : 58, arc = spin ? Math.PI : 1.25;
  const dmg = spin ? 34 : 30;
  for (const e of G.enemies) {
    if (!e.alive) continue;
    const dx = e.x - P.x, dy = e.y - P.y;
    const d = hypot(dx, dy);
    if (d > range + e.r) continue;
    if (!spin && Math.abs(angDiff(Math.atan2(dy, dx), a)) > arc) continue;
    damageEnemy(e, dmg, (dx / (d || 1)) * 140, (dy / (d || 1)) * 140, 'sword');
  }
  // 刀で弾丸を弾く
  for (const b of G.bullets) {
    const dx = b.x - P.x, dy = b.y - P.y;
    const d = hypot(dx, dy);
    if (d < range + 10 && (spin || Math.abs(angDiff(Math.atan2(dy, dx), a)) < arc)) {
      b.life = 0; Sfx.clang();
      spark(b.x, b.y, '#fff6c0', 8);
      addFloat(b.x, b.y - 10, t('fx.parry'), '#fff6c0');
    }
  }
}

function doSpear() {
  const P = G.player;
  // 槍は駆（スタミナ）を使う。突きまくるとダッシュできなくなる
  if (P.st < SPEAR_STAMINA) {
    P.cdSpear = 0.3;
    addFloat(P.x, P.y - 60, t('fx.winded'), '#ffdc78');
    return;
  }
  P.st -= SPEAR_STAMINA; P.stDelay = 0.6;
  const a = aimAngle();
  const charge = P.dashing && hypot(P.vx, P.vy) > 220;
  P.atk = { type: 'spear', t: 0, dur: 0.3, ang: a, charge };
  P.cdSpear = charge ? 0.6 : 0.75;
  if (Math.cos(a) !== 0) P.fx = Math.cos(a) >= 0 ? 1 : -1;
  Sfx.thrust();
  const len = charge ? 135 : 110, half = charge ? 20 : 16, dmg = charge ? 85 : 58;
  const ca = Math.cos(a), sa = Math.sin(a);
  // 槍が貫くのは手前から 2 人まで（群れには刀の方が効く）
  const hits = [];
  for (const e of G.enemies) {
    if (!e.alive) continue;
    const dx = e.x - P.x, dy = e.y - P.y;
    const along = dx * ca + dy * sa, perp = Math.abs(-dx * sa + dy * ca);
    if (along < 0 || along > len + e.r || perp > half + e.r) continue;
    hits.push({ e, along });
  }
  hits.sort((p, q) => p.along - q.along);
  for (const h of hits.slice(0, SPEAR_PIERCE)) damageEnemy(h.e, dmg, ca * 260, sa * 260, 'spear');
}

function hurtPlayer(dmg, fromX, fromY) {
  const P = G.player;
  if (P.inv > 0 || P.dead || G.state !== 'play') return false;
  P.hp -= dmg;
  P.inv = 0.4;
  P.lastHurt = G.t;
  G.shake = Math.max(G.shake, 6);
  const d = hypot(P.x - fromX, P.y - fromY) || 1;
  P.vx += (P.x - fromX) / d * 140; P.vy += (P.y - fromY) / d * 140;
  blood(P.x, P.y - 18, 10);
  addFloat(P.x, P.y - 50, '-' + Math.round(dmg), '#ff5a4a');
  Sfx.hurt();
  flashScreen('rgba(200,0,0,0.25)');
  if (P.hp <= 0) { P.hp = 0; playerDie(); }
  return true;
}

function playerDie() {
  const P = G.player;
  P.dead = true;
  G.state = 'dying';
  G.endT = 0;
  blood(P.x, P.y - 20, 40);
  Sfx.dirge();
  banner(t('ban.dead'), deathPlace());
}

// ---------------- 敵 ----------------
function damageEnemy(e, dmg, kx, ky, src) {
  if (!e.alive) return;
  dmg *= rand(0.9, 1.1);
  e.hp -= dmg;
  e.flash = 0.12;
  const kb = e.type === 'gen' ? 0.35 : 1;
  e.kvx += kx * kb; e.kvy += ky * kb;
  // 足軽は斬られると攻撃が止まる。武将はひるまない
  if (e.type !== 'gen') { e.atkT = 0; e.aimT = 0; }
  blood(e.x, e.y - 14, e.type === 'gen' ? 8 : 5);
  addFloat(e.x, e.y - 34, Math.round(dmg), src === 'spear' ? '#ffd24a' : '#ffffff');
  Sfx.hit();
  G.hitstop = Math.max(G.hitstop, src === 'spear' ? 0.045 : 0.025);
  if (!e.u.active) activateUnit(e.u, e.hp <= 0);
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  e.alive = false;
  const u = e.u;
  G.corpses.push({ x: e.x, y: e.y, t: 0, color: e.armor, flag: u.bg, gen: e.type === 'gen', fx: e.fx, rot: rand(-0.4, 0.4) });
  if (G.corpses.length > 260) G.corpses.shift();
  blood(e.x, e.y - 10, e.type === 'gen' ? 26 : 12);
  if (e.type === 'gen') {
    u.dead = true;
    G.killed.push(u.name);
    Sfx.kill();
    Sfx.swell(u.ieyasu ? 1 : 0.7);
    G.shake = 14; G.hitstop = 0.18;
    G.pickups.push({ x: e.x, y: e.y, heal: DIFF.genHeal, t: 0, big: true });
    // 残兵は潰走
    for (const s of u.soldiers) if (s.alive) { s.state = 'rout'; s.routT = rand(3, 6); }
    if (u.ieyasu) {
      G.ieyasuDead = true;
      banner(t('ban.ieyasu'), t('ban.ieyasuSub'));
      msg(t('msg.avenge'), 'say', 6);
      for (const v of G.units) if (v.side === 'E' && !v.dead) { activateUnit(v, true); v.enraged = true; }
    } else {
      banner(t('ban.kill', { name: I18N.name(u) }), t('ban.killSub', { n: TOTAL_GENERALS - G.killed.length }));
    }
    msg(t('msg.killed', { name: I18N.name(u), k: G.killed.length, t: TOTAL_GENERALS }), 'kill', 5);
    if (G.killed.length >= TOTAL_GENERALS) gameClear();
  } else {
    u.alive--;
    G.soldierKills++;
    if (Math.random() < DIFF.dropRate) G.pickups.push({ x: e.x, y: e.y, heal: 30, t: 0 });
  }
}

function enemySpeedMul(e) {
  let m = 1;
  if (e.u.enraged) m *= 1.15;
  // 時間とともに少しずつ激しく
  m *= 1 + Math.min(0.2, G.t / 900);
  return m;
}

function moveEnemy(e, dx, dy, spd, dt) {
  const tf = terrainFactor(e.x, e.y, dx, dy);
  e.x += dx * spd * tf * dt;
  e.y += dy * spd * tf * dt;
  e.gait += spd * tf * dt * 0.11;
  if (Math.abs(dx) > 0.2) e.fx = dx > 0 ? 1 : -1;
}

function updateEnemy(e, dt) {
  const P = G.player;
  e.flash -= dt; e.trampleCd -= dt;
  // ノックバック
  if (e.kvx || e.kvy) {
    e.x += e.kvx * dt; e.y += e.kvy * dt;
    const k = Math.exp(-dt * 9);
    e.kvx *= k; e.kvy *= k;
    if (Math.abs(e.kvx) + Math.abs(e.kvy) < 4) e.kvx = e.kvy = 0;
  }
  e.x = clamp(e.x, 10, WORLD.W - 10); e.y = clamp(e.y, 10, WORLD.H - 10);
  const dx = P.x - e.x, dy = P.y - e.y;
  const d = hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d;

  if (e.state === 'hold') {
    const hx = e.hx - e.x, hy = e.hy - e.y, hd = hypot(hx, hy);
    if (hd > 4) moveEnemy(e, hx / hd, hy / hd, e.speed * 0.5, dt);
    // 近づけば気付く
    if (d < 380 && !P.dead && G.state === 'play' && G.t > 5) activateUnit(e.u);
    return;
  }
  if (e.state === 'rout') {
    moveEnemy(e, -ux, -uy, e.speed * 1.15, dt);
    e.routT -= dt;
    if (e.routT <= 0) { e.alive = false; e.gone = true; }
    return;
  }
  if (P.dead) {
    // 勝ち鬨：その場で待機
    e.gait += dt * 2;
    return;
  }
  const sm = enemySpeedMul(e);
  e.cd -= dt;
  if (e.type === 'gun') {
    if (e.aimT > 0) {
      e.aimT -= dt;
      if (e.aimT > 0.3) e.aimA = Math.atan2(P.y - 14 - (e.y - 12), P.x - e.x);
      if (e.aimT <= 0) fireGun(e);
      return;
    }
    if (d < 430 && d > 50 && e.cd <= 0) { e.aimT = e.windup; e.aimA = Math.atan2(dy, dx); return; }
    if (d > 300) moveEnemy(e, ux, uy, e.speed * sm, dt);
    else if (d < 170) moveEnemy(e, -ux, -uy, e.speed * 0.8 * sm, dt);
    else { const s = Math.sin(e.wobble + G.t * 0.7); moveEnemy(e, -uy * s, ux * s, e.speed * 0.35, dt); }
    return;
  }
  if (e.type === 'gen') return updateGeneral(e, dt, d, ux, uy, sm);
  // 足軽（槍）
  if (e.atkT > 0) {
    e.atkT -= dt;
    if (e.atkT <= 0) {
      e.cd = rand(1.0, 1.7);
      if (d < e.r + P.r + e.reach + 8) hurtPlayer(e.dmg, e.x, e.y);
      e.thrust = 0.15;
    }
    return;
  }
  if (e.thrust > 0) e.thrust -= dt;
  if (d < e.r + P.r + e.reach && e.cd <= 0) { e.atkT = e.windup; e.face = Math.atan2(dy, dx); return; }
  // 包囲するように少し回り込む
  const sw = Math.sin(e.wobble) * (d > 80 ? 0.45 : 0.15);
  const mx = ux - uy * sw, my = uy + ux * sw, ml = hypot(mx, my);
  if (d > e.r + P.r + 6) moveEnemy(e, mx / ml, my / ml, e.speed * sm * (e.cd > 0 && d < 60 ? 0.4 : 1), dt);
  e.face = Math.atan2(dy, dx);
}

function updateGeneral(e, dt, d, ux, uy, sm) {
  const P = G.player, u = e.u;
  e.face = Math.atan2(uy, ux);
  e.chargeCd -= dt;
  // 突撃中
  if (e.chargeT > 0) {
    if (e.charge > 0) { e.charge -= dt; return; } // 溜め
    e.chargeT -= dt;
    const ca = Math.cos(e.chargeA), sa = Math.sin(e.chargeA);
    moveEnemy(e, ca, sa, e.speed * 2.5 * sm, dt);
    if (Math.random() < 0.5) spawnDust(e.x, e.y, 1);
    if (hypot(P.x - e.x, P.y - e.y) < e.r + P.r + 10) {
      if (hurtPlayer(e.dmg * 1.4, e.x, e.y)) e.chargeT = 0;
    }
    if (e.chargeT <= 0) e.chargeCd = rand(3.5, 6);
    return;
  }
  if (e.atkT > 0) {
    e.atkT -= dt;
    if (e.atkT <= 0) {
      e.cd = rand(1.1, 1.6);
      e.swing = 0.22;
      if (d < e.r + P.r + e.reach + 10) hurtPlayer(e.dmg, e.x, e.y);
    }
    return;
  }
  if (e.swing > 0) e.swing -= dt;
  const ratio = u.alive / Math.max(1, u.n);
  let desired = u.brave || ratio < 0.3 ? 0 : 140;
  if (u.ieyasu) desired = ratio < 0.25 ? 0 : 240;
  if (u.brave && d > 110 && d < 300 && e.chargeCd <= 0) {
    e.charge = 0.55; e.chargeT = 0.7; e.chargeA = Math.atan2(uy, ux);
    addFloat(e.x, e.y - 60, t('fx.charge'), '#ff7b5a');
    return;
  }
  if (d < e.r + P.r + e.reach && e.cd <= 0) { e.atkT = e.windup; return; }
  if (d > desired + 30) moveEnemy(e, ux, uy, e.speed * sm, dt);
  else if (d < desired - 30) moveEnemy(e, -ux, -uy, e.speed * 0.6 * sm, dt);
  else { const s = Math.sin(e.wobble + G.t * 0.5); moveEnemy(e, -uy * s, ux * s, e.speed * 0.3, dt); }
}

function fireGun(e) {
  const P = G.player;
  e.cd = rand(3.2, 4.8);
  const a = e.aimA + rand(-0.05, 0.05);
  const sx = e.x + Math.cos(a) * 14, sy = e.y - 12 + Math.sin(a) * 14;
  G.bullets.push({ x: sx, y: sy, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, life: 1.0, dmg: e.dmg });
  for (let i = 0; i < 6; i++) G.parts.push({ x: sx, y: sy, vx: Math.cos(a) * rand(10, 50) + rand(-15, 15), vy: Math.sin(a) * rand(10, 50) + rand(-25, 0), life: 1.1, max: 1.1, c: 'rgba(225,225,225,0.7)', s: rand(4, 8), g: -8, smoke: true });
  const vd = hypot(e.x - P.x, e.y - P.y);
  Sfx.gun(clamp(0.5 - vd / 1200, 0.08, 0.5));
}

// 群れの重なり解消（空間ハッシュ）
const HASH = 40;
function separate() {
  const map = new Map();
  const list = G.enemies;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!e.alive) continue;
    const k = ((e.x / HASH) | 0) * 1000 + ((e.y / HASH) | 0);
    let a = map.get(k); if (!a) { a = []; map.set(k, a); } a.push(e);
  }
  for (const [k, a] of map) {
    const cx = (k / 1000) | 0, cy = k % 1000;
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      const b = map.get((cx + ox) * 1000 + cy + oy);
      if (!b) continue;
      for (const e of a) for (const f of b) {
        if (f === e || f.x < e.x || (f.x === e.x && f.y <= e.y)) continue;
        const dx = f.x - e.x, dy = f.y - e.y;
        const rr = e.r + f.r;
        const d2 = dx * dx + dy * dy;
        if (d2 < rr * rr && d2 > 0.01) {
          const d = Math.sqrt(d2), push = (rr - d) * 0.5;
          const nx = dx / d, ny = dy / d;
          const we = e.type === 'gen' ? 0.2 : 1, wf = f.type === 'gen' ? 0.2 : 1;
          e.x -= nx * push * we; e.y -= ny * push * we;
          f.x += nx * push * wf; f.y += ny * push * wf;
        }
      }
    }
  }
  // プレイヤーとの押し合い（馬が強い）
  const P = G.player;
  if (P.dead) return;
  for (const e of list) {
    if (!e.alive) continue;
    const dx = e.x - P.x, dy = e.y - P.y;
    const rr = e.r + P.r;
    const d2 = dx * dx + dy * dy;
    if (d2 < rr * rr && d2 > 0.01) {
      const d = Math.sqrt(d2), push = rr - d;
      e.x += dx / d * push * 0.8; e.y += dy / d * push * 0.8;
      P.x -= dx / d * push * 0.2; P.y -= dy / d * push * 0.2;
    }
  }
}

// ---------------- エフェクト ----------------
function blood(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = rand(30, 160);
    G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: rand(0.3, 0.7), max: 0.7, c: Math.random() < 0.5 ? '#a0101a' : '#d0202a', s: rand(1.5, 3.5), g: 300 });
  }
}
function spark(x, y, c, n) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = rand(80, 220);
    G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.25, max: 0.25, c, s: 2, g: 0 });
  }
}
function spawnDust(x, y, n) {
  for (let i = 0; i < n; i++) G.parts.push({ x: x + rand(-10, 10), y: y + rand(-3, 3), vx: rand(-25, 25), vy: rand(-20, -5), life: rand(0.5, 0.9), max: 0.9, c: 'rgba(200,180,140,0.55)', s: rand(4, 8), g: -5, smoke: true });
}
function addFloat(x, y, text, color) { G.floats.push({ x, y, text: String(text), color, t: 0 }); }

function updateEffects(dt) {
  for (const p of G.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt; if (p.smoke) { p.s += dt * 10; p.vx *= 0.96; } }
  G.parts = G.parts.filter((p) => p.life > 0);
  if (G.parts.length > 900) G.parts.splice(0, G.parts.length - 900);
  for (const f of G.floats) f.t += dt;
  G.floats = G.floats.filter((f) => f.t < 0.8);
  for (const c of G.corpses) c.t += dt;
  G.corpses = G.corpses.filter((c) => c.t < 25);
  const P = G.player;
  for (const b of G.bullets) {
    const steps = 3;
    for (let i = 0; i < steps && b.life > 0; i++) {
      b.x += b.vx * dt / steps; b.y += b.vy * dt / steps;
      if (!P.dead && hypot(b.x - P.x, b.y - (P.y - 16)) < P.r + 8) {
        if (hurtPlayer(b.dmg, b.x - b.vx * 0.05, b.y - b.vy * 0.05)) b.life = 0;
      }
    }
    b.life -= dt;
  }
  G.bullets = G.bullets.filter((b) => b.life > 0);
  for (const pk of G.pickups) {
    pk.t += dt;
    if (!P.dead && hypot(pk.x - P.x, pk.y - P.y) < 26) {
      pk.taken = true;
      P.hp = Math.min(P.maxHp, P.hp + pk.heal);
      addFloat(P.x, P.y - 55, '+' + pk.heal, '#7dff8a');
      Sfx.clang();
    }
  }
  G.pickups = G.pickups.filter((p) => !p.taken && p.t < 40);
}

// ---------------- 進行 ----------------
function update(dt) {
  if (G.hitstop > 0) { G.hitstop -= dt; dt *= 0.08; }
  if (G.state === 'dying' || G.state === 'clearing') {
    G.endT += dt;
    dt *= 0.35;
    if (G.endT > 2.6) { if (G.state === 'dying' && canContinue()) showContinue(); else showResult(G.state === 'clearing'); }
  }
  G.t += dt;
  while (G.events.length && G.events[0].t <= G.t) G.events.shift().f();
  if (G.state === 'play') {
    if (G.t > G.nextWestAct) { activateNearest('W'); G.nextWestAct = G.t + 14; }
    if (G.eastAwake && G.t > G.nextEastAct) { activateNearest('E'); G.nextEastAct = G.t + 9; }
  }
  updatePlayer(dt);
  for (const e of G.enemies) if (e.alive) updateEnemy(e, dt);
  G.enemies = G.enemies.filter((e) => e.alive);
  separate();
  updateEffects(dt);
  G.shake = Math.max(0, G.shake - dt * 30);
  // 鬨の声：危ないほど大きく、空いていれば遠くのざわめき程度
  Sfx.crowd(G.state === 'play' ? 0.04 + threatLevel() * 0.96 : G.state === 'dying' ? 0 : 0.6);
  // 戦場のあちこちで鳴る法螺貝
  if (G.state === 'play' && G.t > G.nextAmbHorn) {
    G.nextAmbHorn = G.t + rand(18, 32);
    const act = G.units.filter((v) => v.active && !v.dead);
    if (act.length) unitHorn(act[(Math.random() * act.length) | 0]);
  }
  // 太鼓
  if (G.state === 'play') {
    G.drumT -= dt;
    if (G.drumT <= 0) {
      const pat = [0.42, 0.18, 0.18, 0.42, 0.66];
      G.drumT = pat[G.beat % pat.length];
      G.beat++;
      Sfx.drum(G.beat % 5 === 1 ? 0.22 : 0.12);
    }
  }
  // カメラ
  const P = G.player;
  const lead = 0.25;
  const tx = P.x + P.vx * lead, ty = P.y - 20 + P.vy * lead;
  const k = 1 - Math.exp(-dt * 5);
  G.cam.x += (tx - G.cam.x) * k; G.cam.y += (ty - G.cam.y) * k;
  const hw = CW / 2 / ZOOM, hh = CH / 2 / ZOOM;
  G.cam.x = clamp(G.cam.x, Math.min(hw, WORLD.W / 2), Math.max(WORLD.W - hw, WORLD.W / 2));
  G.cam.y = clamp(G.cam.y, Math.min(hh, WORLD.H / 2), Math.max(WORLD.H - hh, WORLD.H / 2));
}

function gameClear() {
  G.state = 'clearing';
  G.endT = 0;
  Sfx.fanfare();
  setTimeout(() => banner(t('ban.clear'), t('ban.clearSub')), 900);
}

function deathPlace() {
  const P = G.player;
  let best = null, bd = 1e9;
  for (const l of LANDMARKS) {
    const d = hypot(l.x - P.x, l.y - P.y) * (l.kind === 'rd' || l.kind === 'rv' ? 1.6 : 1);
    if (d < bd) { bd = d; best = l; }
  }
  const fl = flagAt(P.x, P.y);
  if ((fl & F_RIVER) && !(fl & F_ROAD)) {
    let rb = null, rd = 1e9;
    for (const r of RIVERS) for (let i = 0; i < r.pts.length - 1; i++) {
      const d = distSeg(P.x, P.y, r.pts[i][0], r.pts[i][1], r.pts[i + 1][0], r.pts[i + 1][1]);
      if (d < rd) { rd = d; rb = r; }
    }
    return t('place.river', { p: I18N.name(rb) });
  }
  const h = heightAt(P.x, P.y);
  const p = I18N.name(best);
  if (best.kind === 'mt') return t(bd < 260 && h > 15 ? 'place.mtIn' : 'place.mtFoot', { p });
  return t(bd < 220 ? 'place.at' : 'place.near', { p });
}

// ---------------- 描画 ----------------
function draw() {
  const P = G.player;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#2e3a22';
  ctx.fillRect(0, 0, CW, CH);
  const sx = G.shake ? rand(-G.shake, G.shake) : 0, sy = G.shake ? rand(-G.shake, G.shake) : 0;
  const ox = CW / 2 - G.cam.x * ZOOM + sx, oy = CH / 2 - G.cam.y * ZOOM + sy;
  ctx.setTransform(DPR * ZOOM, 0, 0, DPR * ZOOM, DPR * ox, DPR * oy);
  const vx0 = G.cam.x - CW / 2 / ZOOM - 40, vy0 = G.cam.y - CH / 2 / ZOOM - 40;
  const vx1 = G.cam.x + CW / 2 / ZOOM + 40, vy1 = G.cam.y + CH / 2 / ZOOM + 80;
  // 地形
  {
    const x0 = clamp(vx0, 0, WORLD.W), y0 = clamp(vy0, 0, WORLD.H), x1 = clamp(vx1, 0, WORLD.W), y1 = clamp(vy1, 0, WORLD.H);
    if (x1 > x0 && y1 > y0) ctx.drawImage(terrainImg, x0 * TS, y0 * TS, (x1 - x0) * TS, (y1 - y0) * TS, x0, y0, x1 - x0, y1 - y0);
  }
  const inView = (x, y, m = 0) => x > vx0 - m && x < vx1 + m && y > vy0 - m && y < vy1 + m;

  // 陣幕
  for (const u of G.units) if (inView(u.x, u.y, 80)) drawCamp(u);
  // 屍
  for (const c of G.corpses) if (inView(c.x, c.y)) drawCorpse(c);
  // 兵糧
  for (const pk of G.pickups) if (inView(pk.x, pk.y)) drawPickup(pk);
  // 鉄砲の狙い
  for (const e of G.enemies) {
    if (e.alive && e.type === 'gun' && e.aimT > 0 && inView(e.x, e.y, 400)) {
      const a = e.aimA, al = 1 - e.aimT / e.windup;
      ctx.strokeStyle = `rgba(255,60,40,${0.15 + al * 0.5})`;
      ctx.lineWidth = 1 + al * 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(e.x, e.y - 12); ctx.lineTo(e.x + Math.cos(a) * 430, e.y - 12 + Math.sin(a) * 430); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (e.alive && e.type === 'gen' && e.chargeT > 0 && e.charge > 0) {
      const a = e.chargeA;
      ctx.fillStyle = 'rgba(255,40,20,0.18)';
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(a);
      ctx.fillRect(0, -16, e.speed * 2.5 * 0.7, 32);
      ctx.restore();
    }
  }
  // キャラクター（奥から）
  const list = [];
  for (const e of G.enemies) if (e.alive && inView(e.x, e.y, 30)) list.push(e);
  list.push(P);
  list.sort((a, b) => a.y - b.y);
  for (const e of list) {
    if (e === P) drawPlayer(); else if (e.type === 'gen') drawGeneral(e); else drawSoldier(e);
  }
  // 弾
  for (const b of G.bullets) {
    ctx.strokeStyle = 'rgba(255,230,160,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.025, b.y - b.vy * 0.025); ctx.stroke();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(b.x, b.y, 2.2, 0, TAU); ctx.fill();
  }
  // 粒子
  for (const p of G.parts) {
    if (!inView(p.x, p.y)) continue;
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.c;
    if (p.smoke) { ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, TAU); ctx.fill(); }
    else ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
  }
  ctx.globalAlpha = 1;

  // ---- 画面座標 ----
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (G.hideLabels) return; // ストア用の絵を撮るときは名前などの文字を出さない
  const toS = (x, y) => [ox + x * ZOOM, oy + y * ZOOM];
  // 地名
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const l of LANDMARKS) {
    if (!inView(l.x, l.y, 100)) continue;
    const [x, y] = toS(l.x, l.y - (l.kind === 'mt' ? 0 : 50));
    ctx.font = `${l.kind === 'mt' ? 700 : 500} ${l.kind === 'mt' ? 22 : 16}px "Shippori Mincho", serif`;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,250,235,0.55)';
    ctx.fillStyle = l.kind === 'rv' ? 'rgba(20,60,110,0.75)' : l.kind === 'rd' ? 'rgba(90,60,20,0.75)' : 'rgba(30,25,20,0.72)';
    const ln = mapLabel(l);
    ctx.strokeText(ln, x, y); ctx.fillText(ln, x, y);
  }
  // 浮き文字
  for (const f of G.floats) {
    if (!inView(f.x, f.y)) continue;
    const [x, y] = toS(f.x, f.y - f.t * 40);
    ctx.globalAlpha = 1 - f.t / 0.8;
    ctx.font = `700 ${f.text.length > 2 ? 15 : 14}px "Shippori Mincho", serif`;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText(f.text, x, y); ctx.fillStyle = f.color; ctx.fillText(f.text, x, y);
  }
  ctx.globalAlpha = 1;
  // 武将名
  for (const u of G.units) {
    const e = u.gen;
    if (!e.alive || !inView(e.x, e.y, 20)) continue;
    const [x, y] = toS(e.x, e.y - 74);
    const fs = u.boss ? 15 : 13;
    ctx.font = `700 ${fs}px "Shippori Mincho", serif`;
    const un = I18N.name(u);
    const w = ctx.measureText(un).width + 14;
    ctx.fillStyle = u.side === 'W' ? 'rgba(70,30,80,0.82)' : 'rgba(20,40,90,0.82)';
    roundRect(x - w / 2, y - 11, w, 22, 4); ctx.fill();
    ctx.strokeStyle = u.boss ? '#e8c060' : 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillText(un, x, y + 1);
    // 体力
    const bw = Math.max(46, w - 10);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - bw / 2, y + 13, bw, 4);
    ctx.fillStyle = '#e8c060'; ctx.fillRect(x - bw / 2, y + 13, bw * clamp(e.hp / e.maxHp, 0, 1), 4);
    if (u.side === 'W') { ctx.fillStyle = '#c9a0e0'; ctx.font = '500 10px sans-serif'; ctx.fillText(t('side.W'), x - w / 2 - 8, y + 1); }
    else { ctx.fillStyle = '#9cc0ff'; ctx.font = '500 10px sans-serif'; ctx.fillText(t('side.E'), x - w / 2 - 8, y + 1); }
  }
  // 画面外の最寄り武将を示す矢印
  if (G.state === 'play') drawPointer(toS);
  drawMinimap();
}

// 地図に出す地名（英語の「the 〜」は外して先頭を大文字に）
function mapLabel(l) {
  const n = I18N.name(l).replace(/^the /, '');
  return n.charAt(0).toUpperCase() + n.slice(1);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function drawPointer(toS) {
  const P = G.player;
  let best = null, bd = 1e9;
  for (const u of G.units) {
    if (!u.gen.alive) continue;
    const d = hypot(u.gen.x - P.x, u.gen.y - P.y);
    if (d < bd) { bd = d; best = u; }
  }
  if (!best) return;
  const [x, y] = toS(best.gen.x, best.gen.y - 30);
  const m = 46;
  if (x > m && x < CW - m && y > m && y < CH - m) return;
  const [px, py] = toS(P.x, P.y - 20);
  const a = Math.atan2(y - py, x - px);
  // 画面端との交点
  const hw = CW / 2 - m, hh = CH / 2 - m;
  const t = Math.min(Math.abs(hw / (Math.cos(a) || 1e-6)), Math.abs(hh / (Math.sin(a) || 1e-6)));
  const ax = CW / 2 + Math.cos(a) * t, ay = CH / 2 + Math.sin(a) * t;
  ctx.save(); ctx.translate(ax, ay); ctx.rotate(a);
  ctx.fillStyle = best.side === 'W' ? 'rgba(190,120,230,0.9)' : 'rgba(110,160,255,0.9)';
  ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-8, -10); ctx.lineTo(-3, 0); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.font = '700 12px "Shippori Mincho", serif';
  ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 3;
  const lx = ax - Math.cos(a) * 34, ly = ay - Math.sin(a) * 22;
  const label = `${I18N.name(best)} ${Math.round(bd / 10) * 10}m`;
  ctx.strokeText(label, lx, ly); ctx.fillText(label, lx, ly);
}

function drawCamp(u) {
  // 陣幕（家紋色の帯）
  const w = 70, h = 46;
  const x = u.x - w / 2 - (u.side === 'W' ? 18 : -18), y = u.y - h / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(x + 3, y + 3, w, h);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#efe9da';
  ctx.beginPath();
  if (u.side === 'W') { ctx.moveTo(x + w, y); ctx.lineTo(x, y); ctx.lineTo(x, y + h); ctx.lineTo(x + w, y + h); }
  else { ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); }
  ctx.stroke();
  ctx.lineWidth = 1.4; ctx.strokeStyle = armorColor(u.bg) === '#3b3b40' ? '#222' : u.bg;
  ctx.stroke();
  // 幟
  const flags = u.dead ? 1 : 3;
  for (let i = 0; i < flags; i++) {
    const fx = x + (u.side === 'W' ? 4 : w - 4), fy = y + 6 + i * 17;
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(fx, fy + 10); ctx.lineTo(fx, fy - 24); ctx.stroke();
    ctx.fillStyle = u.dead ? 'rgba(120,110,100,0.6)' : u.bg;
    const wave = Math.sin(G.t * 3 + i + u.idx) * 1.5;
    ctx.fillRect(fx + (u.side === 'W' ? -9 : 1), fy - 23, 8, 20 + wave);
    if (!u.dead) {
      ctx.fillStyle = u.fg; ctx.font = '700 7px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(u.k, fx + (u.side === 'W' ? -5 : 5), fy - 15);
    }
  }
}

function drawCorpse(c) {
  const a = c.t > 18 ? 1 - (c.t - 18) / 7 : 1;
  ctx.globalAlpha = a * 0.85;
  ctx.fillStyle = 'rgba(110,0,0,0.55)';
  ctx.beginPath(); ctx.ellipse(c.x, c.y, c.gen ? 16 : 10, c.gen ? 7 : 4.5, 0, 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(c.x, c.y - 2); ctx.rotate(c.rot);
  if (c.gen) { ctx.fillStyle = '#4a2e1a'; ctx.fillRect(-16, -5, 26, 9); }
  ctx.fillStyle = c.color; ctx.fillRect(-8, -3, 12, 5);
  ctx.fillStyle = '#e0b890'; ctx.beginPath(); ctx.arc(7, -1, 2.6, 0, TAU); ctx.fill();
  ctx.fillStyle = c.flag; ctx.fillRect(-14, 1, 7, 4);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawPickup(pk) {
  const bob = Math.sin(pk.t * 4) * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(pk.x, pk.y + 2, 7, 2.5, 0, 0, TAU); ctx.fill();
  const s = pk.big ? 1.4 : 1;
  ctx.save(); ctx.translate(pk.x, pk.y - 6 + bob); ctx.scale(s, s);
  ctx.fillStyle = '#fbfaf3';
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.quadraticCurveTo(7, -1, 6, 4); ctx.lineTo(-6, 4); ctx.quadraticCurveTo(-7, -1, 0, -7); ctx.fill();
  ctx.fillStyle = '#1d2a1d'; ctx.fillRect(-3.5, 0, 7, 4.2);
  ctx.restore();
  if (pk.t < 40 && Math.sin(pk.t * 6) > 0.6) { ctx.fillStyle = 'rgba(255,255,200,0.5)'; ctx.beginPath(); ctx.arc(pk.x, pk.y - 6 + bob, 10 * s, 0, TAU); ctx.fill(); }
}

function drawHorse(x, y, fx, gait, coat, cloth, moving, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(fx * scale, scale);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(0, 1, 20, 5, 0, 0, TAU); ctx.fill();
  const sw = moving ? Math.sin(gait) : 0, sw2 = moving ? Math.sin(gait + Math.PI) : 0;
  ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  const leg = (lx, s) => { ctx.beginPath(); ctx.moveTo(lx, -11); ctx.lineTo(lx + s * 6, -4); ctx.lineTo(lx + s * 7, 0); ctx.stroke(); };
  leg(-11, sw); leg(-7, sw2); leg(9, sw2); leg(13, sw);
  const bob = moving ? Math.abs(Math.sin(gait)) * -1.5 : 0;
  ctx.translate(0, bob);
  // 尾
  ctx.strokeStyle = '#1a100a'; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.moveTo(-15, -17); ctx.quadraticCurveTo(-24, -14 + sw * 2, -22, -4); ctx.stroke();
  // 胴
  ctx.fillStyle = coat;
  ctx.beginPath(); ctx.ellipse(1, -15, 16, 7.5, 0, 0, TAU); ctx.fill();
  // 首と頭
  ctx.beginPath(); ctx.moveTo(10, -20); ctx.lineTo(18, -32); ctx.lineTo(23, -30); ctx.lineTo(17, -14); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.ellipse(23, -31, 7, 3.6, 0.45, 0, TAU); ctx.fill();
  ctx.fillStyle = '#140c06';
  ctx.beginPath(); ctx.moveTo(10, -21); ctx.lineTo(18, -34); ctx.lineTo(16, -26); ctx.closePath(); ctx.fill(); // たてがみ
  ctx.fillRect(20, -35, 2, 3);
  // 鞍・馬鎧
  ctx.fillStyle = cloth;
  ctx.beginPath(); ctx.ellipse(-1, -16, 9, 6.5, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#e8c060'; ctx.lineWidth = 0.9; ctx.stroke();
  ctx.strokeStyle = cloth; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-14, -17); ctx.lineTo(-17, -10); ctx.moveTo(14, -18); ctx.lineTo(20, -28); ctx.stroke();
  ctx.restore();
  return bob * scale;
}

function drawPlayer() {
  const P = G.player;
  if (P.dead) {
    ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(0.15 * P.fx);
    ctx.fillStyle = 'rgba(110,0,0,0.6)'; ctx.beginPath(); ctx.ellipse(0, 0, 26, 9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5a3a22'; ctx.fillRect(-18, -8, 34, 12);
    ctx.fillStyle = '#c0161b'; ctx.fillRect(-6, -14, 14, 7);
    ctx.restore();
    return;
  }
  const sp = hypot(P.vx, P.vy);
  if (P.inv > 0 && P.lastHurt > G.t - 0.4 && Math.floor(G.t * 30) % 2) ctx.globalAlpha = 0.5;
  // 疾駆の残像
  if (P.dashing) {
    ctx.globalAlpha = 0.18;
    drawHorse(P.x - P.vx * 0.06, P.y - P.vy * 0.06, P.fx, P.gait - 0.6, '#5a2f18', '#b01015', true);
    ctx.globalAlpha = 1;
  }
  const bob = drawHorse(P.x, P.y, P.fx, P.gait, '#5a2f18', '#b01015', sp > 10);
  const x = P.x, y = P.y + bob;
  const f = P.fx;
  // 指物（背旗）
  ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x - f * 4, y - 34); ctx.lineTo(x - f * 7, y - 66); ctx.stroke();
  const wv = Math.sin(G.t * 8) * (sp > 50 ? 2 : 0.6);
  ctx.fillStyle = '#c4141a';
  ctx.beginPath(); ctx.moveTo(x - f * 7, y - 66); ctx.lineTo(x - f * (7 + 12 + wv), y - 65); ctx.lineTo(x - f * (7 + 12 - wv), y - 47); ctx.lineTo(x - f * 7, y - 48); ctx.closePath(); ctx.fill();
  // 違い鎌の紋
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.1;
  const mx = x - f * 13, my = y - 57;
  ctx.beginPath(); ctx.arc(mx - 1.5, my, 4, -1.2, 0.6); ctx.stroke();
  ctx.beginPath(); ctx.arc(mx + 1.5, my, 4, 2.5, 4.3); ctx.stroke();
  // 胴体（赤備え）
  ctx.fillStyle = '#c0161b';
  ctx.fillRect(x - 5, y - 37, 10, 13);
  ctx.fillStyle = '#8e0d12';
  ctx.fillRect(x - 6.5, y - 26, 13, 6); // 草摺
  ctx.strokeStyle = '#e8c060'; ctx.lineWidth = 0.8;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - 5, y - 34 + i * 4); ctx.lineTo(x + 5, y - 34 + i * 4); ctx.stroke(); }
  // 脚
  ctx.fillStyle = '#7a0a0f'; ctx.fillRect(x + f * 1 - 2, y - 22, 4, 7);
  // 袖
  ctx.fillStyle = '#d01e22';
  ctx.fillRect(x - f * 7 - (f > 0 ? 0 : 4), y - 37, 4, 7);
  // 頭・兜
  ctx.fillStyle = '#e2b88a'; ctx.beginPath(); ctx.arc(x + f * 1, y - 41, 3.6, 0, TAU); ctx.fill();
  ctx.fillStyle = '#20100c'; ctx.fillRect(x + f * 1 - 2.5 + f * 1.5, y - 41, 3, 2); // 面頬
  ctx.fillStyle = '#b5121a';
  ctx.beginPath(); ctx.arc(x + f * 0.5, y - 43, 5.2, Math.PI, 0); ctx.fill();
  ctx.fillRect(x - 6, y - 43, 12, 2.2); // 錣
  ctx.strokeStyle = '#f0c040'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(x + f * 0.5, y - 52, 6, 0.25 * Math.PI, 0.75 * Math.PI); ctx.stroke(); // 前立
  ctx.beginPath(); ctx.moveTo(x + f * 0.5, y - 47); ctx.lineTo(x + f * 0.5, y - 48.5); ctx.stroke();

  // 武器
  const hx = x + f * 4, hy = y - 31;
  const atk = P.atk;
  if (atk && atk.type === 'spear') {
    const p = atk.t / atk.dur;
    const ext = p < 0.35 ? p / 0.35 : 1 - (p - 0.35) / 0.65;
    const L = 46 + ext * (atk.charge ? 80 : 62);
    drawSpear(hx, hy, atk.ang, L, -12);
    if (p < 0.5) {
      ctx.strokeStyle = `rgba(255,240,200,${0.6 - p})`; ctx.lineWidth = atk.charge ? 10 : 6;
      ctx.beginPath(); ctx.moveTo(hx + Math.cos(atk.ang) * 20, hy + Math.sin(atk.ang) * 20);
      ctx.lineTo(hx + Math.cos(atk.ang) * L, hy + Math.sin(atk.ang) * L); ctx.stroke();
    }
  } else {
    // 槍を担ぐ
    drawSpear(x - f * 8, y - 26, f > 0 ? -0.55 : Math.PI + 0.55, 60, -18);
  }
  if (atk && atk.type === 'sword') {
    const p = atk.t / atk.dur;
    const R = atk.spin ? 64 : 54;
    const sweep = atk.spin ? TAU : 2.4;
    const start = atk.spin ? atk.ang : atk.ang - (sweep / 2) * atk.dir;
    const cur = start + sweep * atk.dir * Math.min(1, p * 1.6);
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const aa = cur - i * 0.18 * atk.dir;
      ctx.strokeStyle = `rgba(255,255,255,${(0.7 - i * 0.11) * (1 - p)})`;
      ctx.lineWidth = 5 - i * 0.6;
      ctx.beginPath(); ctx.arc(x, y - 22, R, aa - 0.12, aa + 0.12); ctx.stroke();
    }
    ctx.strokeStyle = '#e6edf2'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(x + Math.cos(cur) * R * 0.8, y - 22 + Math.sin(cur) * R * 0.8); ctx.stroke();
  } else {
    // 腰の刀
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - f * 6, y - 23); ctx.lineTo(x + f * 10, y - 27); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // スタミナ切れ表示
  if (P.dashing && P.st < 20) { ctx.fillStyle = 'rgba(255,220,120,0.8)'; ctx.font = '700 8px serif'; ctx.textAlign = 'center'; ctx.fillText(t('fx.winded'), x, y - 72); }
}

function drawSpear(x, y, a, L, back) {
  const ca = Math.cos(a), sa = Math.sin(a);
  ctx.strokeStyle = '#3a2412'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + ca * back, y + sa * back); ctx.lineTo(x + ca * L, y + sa * L); ctx.stroke();
  ctx.strokeStyle = '#e8eef0'; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(x + ca * L, y + sa * L); ctx.lineTo(x + ca * (L + 11), y + sa * (L + 11)); ctx.stroke();
  ctx.fillStyle = '#c0161b';
  ctx.beginPath(); ctx.arc(x + ca * (L - 2), y + sa * (L - 2), 2, 0, TAU); ctx.fill();
}

function drawSoldier(e) {
  const u = e.u;
  const moving = e.state !== 'hold' || hypot(e.hx - e.x, e.hy - e.y) > 4;
  const x = e.x, y = e.y;
  const f = e.fx;
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, y + 1, 7, 2.6, 0, 0, TAU); ctx.fill();
  const sw = moving ? Math.sin(e.gait) * 3 : 0;
  ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - 1.5, y - 8); ctx.lineTo(x - 2 + sw, y); ctx.moveTo(x + 1.5, y - 8); ctx.lineTo(x + 2 - sw, y); ctx.stroke();
  const white = e.flash > 0;
  const rout = e.state === 'rout';
  // 指物
  if (!rout) {
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - f * 2, y - 15); ctx.lineTo(x - f * 3, y - 32); ctx.stroke();
    ctx.fillStyle = u.bg;
    ctx.fillRect(x - f * 3 - (f > 0 ? 6 : 0), y - 32, 6, 10);
  }
  ctx.fillStyle = white ? '#fff' : e.armor;
  ctx.fillRect(x - 4, y - 16, 8, 9);
  ctx.fillStyle = white ? '#fff' : '#e0b890';
  ctx.beginPath(); ctx.arc(x, y - 18.5, 2.8, 0, TAU); ctx.fill();
  // 陣笠
  ctx.fillStyle = '#26221e';
  ctx.beginPath(); ctx.moveTo(x - 6, y - 19); ctx.lineTo(x, y - 24); ctx.lineTo(x + 6, y - 19); ctx.closePath(); ctx.fill();
  if (e.type === 'gun') {
    const a = e.aimT > 0 ? e.aimA : (f > 0 ? 0.3 : Math.PI - 0.3);
    ctx.strokeStyle = '#1a1410'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(x + Math.cos(a) * 15, y - 12 + Math.sin(a) * 15); ctx.stroke();
    if (e.aimT > 0) { ctx.fillStyle = '#ff9040'; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 3, y - 12 + Math.sin(a) * 3, 1.6, 0, TAU); ctx.fill(); }
  } else {
    let a, L = 24, back = -8;
    if (e.atkT > 0) { a = e.face; back = -14; L = 16; }
    else if (e.thrust > 0) { a = e.face; L = 34; back = 0; }
    else if (e.state === 'chase') a = e.face - f * 0.5;
    else a = -Math.PI / 2 + f * 0.25;
    if (rout) a = Math.PI / 2 * 0.3 + (f > 0 ? Math.PI : 0);
    ctx.strokeStyle = '#4a3420'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * back, y - 12 + Math.sin(a) * back); ctx.lineTo(x + Math.cos(a) * L, y - 12 + Math.sin(a) * L); ctx.stroke();
    ctx.strokeStyle = '#dfe6ea'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * L, y - 12 + Math.sin(a) * L); ctx.lineTo(x + Math.cos(a) * (L + 6), y - 12 + Math.sin(a) * (L + 6)); ctx.stroke();
    if (e.atkT > 0) {
      ctx.strokeStyle = `rgba(255,50,30,${0.4 + 0.5 * (1 - e.atkT / e.windup)})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, 12, e.face - 0.6, e.face + 0.6); ctx.stroke();
    }
  }
}

function drawGeneral(e) {
  const u = e.u;
  const moving = e.state === 'chase' || hypot(e.hx - e.x, e.hy - e.y) > 4;
  const white = e.flash > 0;
  // 突撃の溜め
  if (e.chargeT > 0 && e.charge > 0) { ctx.fillStyle = 'rgba(255,60,30,0.35)'; ctx.beginPath(); ctx.arc(e.x, e.y - 15, 26 + Math.sin(G.t * 30) * 3, 0, TAU); ctx.fill(); }
  const coat = u.ieyasu ? '#e8e2d0' : '#3a2416';
  const bob = drawHorse(e.x, e.y, e.fx, e.gait, white ? '#fff' : coat, u.bg, moving, u.boss ? 1.05 : 0.95);
  const x = e.x, y = e.y + bob, f = e.fx;
  // 大旗（指物）
  ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x - f * 4, y - 34); ctx.lineTo(x - f * 6, y - 70); ctx.stroke();
  ctx.fillStyle = u.bg;
  const fw = 13, fh = 20;
  const fx0 = x - f * 6 - (f > 0 ? fw : 0);
  ctx.fillRect(fx0, y - 70, fw, fh);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.6; ctx.strokeRect(fx0, y - 70, fw, fh);
  ctx.fillStyle = u.fg; ctx.font = '700 11px "Shippori Mincho", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(u.k, fx0 + fw / 2, y - 60);
  // 体
  ctx.fillStyle = white ? '#fff' : e.armor;
  ctx.fillRect(x - 5, y - 37, 10, 13);
  ctx.fillStyle = white ? '#fff' : '#2a2420'; ctx.fillRect(x - 6.5, y - 26, 13, 6);
  ctx.fillStyle = '#e8c060'; ctx.fillRect(x - 5, y - 31, 10, 1);
  ctx.fillStyle = '#e2b88a'; ctx.beginPath(); ctx.arc(x + f, y - 41, 3.6, 0, TAU); ctx.fill();
  if (u.name === '大谷吉継') { ctx.fillStyle = '#f2f2ee'; ctx.beginPath(); ctx.arc(x + f * 0.5, y - 42, 5, 0, TAU); ctx.fill(); ctx.fillStyle = '#222'; ctx.fillRect(x + f * 1.5 - 1, y - 42, 2.5, 1.2); }
  else {
    ctx.fillStyle = '#1d1a18';
    ctx.beginPath(); ctx.arc(x + f * 0.5, y - 43, 5.2, Math.PI, 0); ctx.fill();
    ctx.fillRect(x - 6, y - 43, 12, 2.2);
    ctx.strokeStyle = '#e8c060'; ctx.lineWidth = 1.4;
    if (u.name === '本多忠勝') { // 鹿角
      ctx.strokeStyle = '#1a1208'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x - 3, y - 47); ctx.lineTo(x - 8, y - 56); ctx.lineTo(x - 11, y - 54); ctx.moveTo(x + 3, y - 47); ctx.lineTo(x + 8, y - 56); ctx.lineTo(x + 11, y - 54); ctx.moveTo(x - 6, y - 52); ctx.lineTo(x - 9, y - 50); ctx.moveTo(x + 6, y - 52); ctx.lineTo(x + 9, y - 50); ctx.stroke();
    } else if (u.name === '井伊直政') { // 天衝
      ctx.strokeStyle = '#e8c060'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x - 1, y - 47); ctx.lineTo(x - 7, y - 58); ctx.moveTo(x + 1, y - 47); ctx.lineTo(x + 7, y - 58); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(x - 4, y - 47); ctx.lineTo(x, y - 52); ctx.lineTo(x + 4, y - 47); ctx.stroke();
    }
  }
  // 武器（大太刀/槍）
  let a;
  if (e.atkT > 0) a = e.face - f * 1.6 * (1 - e.atkT / e.windup);
  else if (e.swing > 0) a = e.face + f * 0.9;
  else a = f > 0 ? -0.9 : Math.PI + 0.9;
  if (u.name === '本多忠勝' || u.brave) drawSpear(x + f * 3, y - 31, a, 44, -12);
  else {
    ctx.strokeStyle = '#dfe6ea'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + f * 3, y - 31); ctx.lineTo(x + f * 3 + Math.cos(a) * 30, y - 31 + Math.sin(a) * 30); ctx.stroke();
  }
  if (e.atkT > 0) {
    ctx.strokeStyle = `rgba(255,50,30,${0.4 + 0.5 * (1 - e.atkT / e.windup)})`; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, e.y, 30, e.face - 0.9, e.face + 0.9); ctx.stroke();
  }
  if (e.swing > 0) {
    ctx.strokeStyle = `rgba(255,255,255,${e.swing * 3})`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(x, y - 20, 40, e.face - 0.9, e.face + 0.9); ctx.stroke();
  }
}

function buildMiniBg() {
  const c = document.createElement('canvas');
  c.width = mini.width; c.height = mini.height;
  const m = c.getContext('2d');
  m.drawImage(terrainImg, 0, 0, c.width, c.height);
  m.fillStyle = 'rgba(20,15,5,0.15)'; m.fillRect(0, 0, c.width, c.height);
  return c;
}

function drawMinimap() {
  const w = mini.width, h = mini.height, s = w / WORLD.W;
  mctx.drawImage(miniBg, 0, 0);
  for (const e of G.enemies) {
    if (!e.alive || e.type === 'gen' || e.state === 'hold') continue;
    mctx.fillStyle = e.u.side === 'W' ? 'rgba(200,140,240,0.8)' : 'rgba(120,170,255,0.8)';
    mctx.fillRect(e.x * s - 1, e.y * s - 1, 2, 2);
  }
  for (const u of G.units) {
    const e = u.gen;
    if (!e.alive) {
      mctx.strokeStyle = 'rgba(0,0,0,0.55)'; mctx.lineWidth = 1.5;
      const x = u.x * s, y = u.y * s;
      mctx.beginPath(); mctx.moveTo(x - 3, y - 3); mctx.lineTo(x + 3, y + 3); mctx.moveTo(x + 3, y - 3); mctx.lineTo(x - 3, y + 3); mctx.stroke();
      continue;
    }
    mctx.fillStyle = u.side === 'W' ? '#a050d0' : '#2a70e0';
    const r = u.boss ? 4.5 : 3.2;
    mctx.fillRect(e.x * s - r, e.y * s - r, r * 2, r * 2);
    mctx.strokeStyle = u.active ? '#fff' : 'rgba(0,0,0,0.5)'; mctx.lineWidth = 1;
    mctx.strokeRect(e.x * s - r, e.y * s - r, r * 2, r * 2);
  }
  const P = G.player;
  mctx.fillStyle = '#ff2020'; mctx.strokeStyle = '#fff'; mctx.lineWidth = 1.5;
  mctx.beginPath(); mctx.arc(P.x * s, P.y * s, 4.5, 0, TAU); mctx.fill(); mctx.stroke();
  mctx.strokeStyle = 'rgba(255,255,255,0.6)'; mctx.lineWidth = 1;
  mctx.strokeRect((G.cam.x - CW / 2 / ZOOM) * s, (G.cam.y - CH / 2 / ZOOM) * s, CW / ZOOM * s, CH / ZOOM * s);
}

// ---------------- HUD ----------------
function updateHUD() {
  const P = G.player;
  $('hpbar').style.width = (P.hp / P.maxHp * 100) + '%';
  $('stbar').style.width = (P.st / P.maxSt * 100) + '%';
  $('stbar').classList.toggle('low', P.st < 15);
  $('hpnum').textContent = Math.ceil(P.hp);
  $('kGen').textContent = `${G.killed.length} / ${TOTAL_GENERALS}`;
  $('kSol').textContent = G.soldierKills;
  $('time').textContent = fmtTime(G.t);
  $('cdSword').style.opacity = P.cdSword > 0 ? 0.45 : 1;
  $('cdSpear').style.opacity = P.cdSpear > 0 || P.st < SPEAR_STAMINA ? 0.45 : 1;
}
function fmtTime(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m}:${String(s).padStart(2, '0')}`; }

// ---------------- 画面遷移 ----------------
function show(id, on) { $(id).classList.toggle('hidden', !on); }

function startGame() {
  Sfx.init();
  newGame();
  show('title', false); show('result', false); show('pause', false); show('continue', false); show('hud', true);
  document.body.classList.add('playing');
}

function togglePause() {
  if (G.state === 'play') { G.state = 'pause'; show('pause', true); Sfx.crowd(0); Ads.showBanner(); }
  else if (G.state === 'pause') { G.state = 'play'; show('pause', false); Ads.hideBanner(); }
}

function titleFor(clear, n) {
  const k = clear ? 'clear' : n >= 30 ? '30' : n >= 20 ? '20' : n >= 10 ? '10' : n >= 3 ? '3' : '0';
  return { t: t('rank.' + k), j: t('jisei.' + k) };
}

let lastShare = '';
function showResult(clear) {
  if (G.state === 'over') return;
  G.state = 'over';
  show('hud', false);
  document.body.classList.remove('playing');
  const n = G.killed.length;
  const tt = titleFor(clear, n);
  const dp = deathPlace();
  const place = clear ? t('res.placeClear') : t('res.placeDead', { p: dp });
  $('rHead').textContent = t(clear ? 'res.clear' : 'res.dead');
  $('rHead').classList.toggle('clear', clear);
  $('rPlace').textContent = place;
  $('rTitle').textContent = t('res.rank', { r: tt.t });
  $('rJisei').textContent = tt.j;
  $('rGen').textContent = `${n} / ${TOTAL_GENERALS}`;
  $('rSol').textContent = `${G.soldierKills}`;
  $('rTime').textContent = fmtTime(G.t);
  $('rIeyasu').textContent = t(G.ieyasuDead ? 'res.ieyasuDead' : 'res.ieyasuAlive');
  const list = $('rList');
  list.innerHTML = '';
  for (const u of G.units) {
    const el = document.createElement('span');
    const dead = G.killed.includes(u.name);
    el.className = 'chip ' + (u.side === 'W' ? 'w' : 'e') + (dead ? ' dead' : '');
    el.textContent = I18N.name(u);
    list.appendChild(el);
  }
  lastShare = [
    t('share.head'),
    clear ? t('share.clear', { t: TOTAL_GENERALS }) : t('share.dead', { p: dp }),
    t('share.stats', { n, t: TOTAL_GENERALS, s: G.soldierKills, time: fmtTime(G.t) }),
    ...(G.ieyasuDead ? [t('share.ieyasu')] : []),
    t('share.rank', { r: tt.t }),
    t('share.tags'),
  ].join('\n');
  show('result', true);
}

const SHARE_URL = 'https://techgym.jp/column/claude-code-game-kobayakawa/';
function shareUrl() { return SHARE_URL; }

// Android アプリ（Capacitor）で動いているか
const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const plugin = (name) => (NATIVE && window.Capacitor.Plugins ? window.Capacitor.Plugins[name] : null);
if (NATIVE) document.body.classList.add('native');

$('shareX').addEventListener('click', () => {
  window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(lastShare) + '&url=' + encodeURIComponent(shareUrl()), '_blank', 'noopener');
});
$('shareLine').addEventListener('click', () => {
  window.open('https://social-plugins.line.me/lineit/share?url=' + encodeURIComponent(shareUrl()) + '&text=' + encodeURIComponent(lastShare), '_blank', 'noopener');
});
$('shareFb').addEventListener('click', () => {
  window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(shareUrl()), '_blank', 'noopener');
});
$('shareNative').addEventListener('click', async () => {
  const text = lastShare + '\n' + shareUrl();
  // アプリでは Android の共有メニューを出す
  if (plugin('Share')) {
    try { await plugin('Share').share({ title: t('share.title'), text: lastShare, url: shareUrl(), dialogTitle: t('share.dialog') }); } catch (_) { /* キャンセル */ }
    return;
  }
  if (navigator.share) {
    try { await navigator.share({ title: t('share.title'), text: lastShare, url: shareUrl() }); } catch (_) { /* キャンセル */ }
    return;
  }
  try { await navigator.clipboard.writeText(text); $('shareNative').textContent = t('share.copied'); }
  catch (_) { window.prompt(t('share.prompt'), text); }
  setTimeout(updateShareLabel, 2000);
});
function updateShareLabel() { $('shareNative').textContent = t(!navigator.share && !plugin('Share') ? 'share.copy' : 'share.native'); }
function updateMuteLabel() { $('btnMute').textContent = t(Sfx.muted ? 'sound.off' : 'sound.on'); }
// 言語を切り替えたら、HTML に書いていない文言も書き換える
function applyLang() { I18N.apply(); updateShareLabel(); updateMuteLabel(); }
I18N.onChange(() => { updateShareLabel(); updateMuteLabel(); });
document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => I18N.setLang(b.dataset.lang)));
applyLang();
$('btnStart').addEventListener('click', startGame);
// 「再び出陣」の前に毎回、全画面広告を出す（Android アプリのみ）
let retryBusy = false;
$('btnRetry').addEventListener('click', async () => {
  if (retryBusy) return;
  Sfx.init();
  if (Ads.available) {
    retryBusy = true;
    await Ads.showInterstitial();
    retryBusy = false;
  }
  startGame();
});
$('btnTitle').addEventListener('click', () => { show('result', false); show('title', true); titleScene(); });
$('btnResume').addEventListener('click', togglePause);
$('btnMute').addEventListener('click', () => { Sfx.init(); Sfx.toggle(); updateMuteLabel(); });
$('btnPause').addEventListener('click', () => { if (G && (G.state === 'play' || G.state === 'pause')) togglePause(); });

// ---------------- リワード広告で復活（Android アプリのみ・1 合戦 1 回） ----------------
let contBusy = false;
function canContinue() { return !G.continued && Ads.available; }
function showContinue() {
  G.state = 'continue'; G.contT = 10; contBusy = false;
  $('contWatch').disabled = false;
  $('contWatch').textContent = t('cont.watch');
  $('contNote').textContent = '';
  $('contTime').textContent = '10';
  show('hud', false);
  show('continue', true);
}
function giveUp() {
  if (G.state !== 'continue') return;
  show('continue', false);
  G.state = 'dying';
  showResult(false);
}
$('contGiveUp').addEventListener('click', giveUp);
$('contWatch').addEventListener('click', async () => {
  if (G.state !== 'continue' || contBusy) return;
  contBusy = true;
  $('contWatch').disabled = true;
  $('contWatch').textContent = t('cont.loading');
  const result = await Ads.showRewarded();
  if (G.state !== 'continue') return;
  if (result === 'unavailable') {
    $('contNote').textContent = t('cont.fail');
    setTimeout(giveUp, 2200);
    return;
  }
  if (result !== 'rewarded') { giveUp(); return; }
  show('continue', false);
  revive();
});
function revive() {
  const P = G.player;
  G.continued = true;
  P.dead = false; P.hp = P.maxHp; P.st = P.maxSt; P.inv = 3;
  P.vx = P.vy = 0;
  // 周りの敵を押し返して立て直す間を作る
  for (const e of G.enemies) {
    const dx = e.x - P.x, dy = e.y - P.y, d = hypot(dx, dy) || 1;
    if (d < 200) { e.kvx += dx / d * 500; e.kvy += dy / d * 500; e.atkT = 0; e.aimT = 0; }
  }
  G.bullets = [];
  G.state = 'play';
  show('hud', true);
  banner(t('ban.revive'), t('ban.reviveSub'));
  Sfx.horn(0.45); Sfx.swell(1);
}

// アプリが裏に回ったら一時停止して音を止める
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (G && G.state === 'play') togglePause(); Sfx.suspend(); }
  else if (!Ads.showing) Sfx.resume();
});
// Android の戻るボタン：プレイ中はポーズ切替、タイトル・結果画面ではアプリを閉じる
if (plugin('App')) {
  plugin('App').addListener('backButton', () => {
    if (!G || G.state === 'title' || G.state === 'over') plugin('App').exitApp();
    else if (G.state === 'continue') giveUp();
    else if (G.state === 'play' || G.state === 'pause') togglePause();
  });
}
// どのビルドが入っているか分かるよう、アプリ版はタイトル画面にバージョンを出す
if (window.APP_VERSION && window.APP_VERSION !== 'dev') $('buildInfo').textContent = window.APP_VERSION;
// EU など同意が必要な地域では、タイトル画面から広告の同意内容を変更できるようにする
Ads.initDone.then(() => { if (Ads.privacyOptionsRequired) $('adPrivacy').classList.remove('hidden'); });
$('adPrivacyLink').addEventListener('click', (e) => { e.preventDefault(); Ads.showPrivacyOptions(); });

// タイトル背景：戦場をゆっくり見渡す
function titleScene() {
  newGame();
  G.state = 'title';
  G.events = [];
  G.player.dead = false;
  show('hud', false);
}

// ---------------- ループ ----------------
let lastT = 0;
function frame(ts) {
  const dt = Math.min(0.05, (ts - lastT) / 1000 || 0.016);
  lastT = ts;
  if (G) {
    if (G.state === 'title') {
      G.t += dt;
      const a = G.t * 0.05;
      G.cam.x = 2400 + Math.cos(a) * 1500; G.cam.y = 1800 + Math.sin(a * 1.3) * 900;
      G.player.x = -500; G.player.y = -500;
      for (const e of G.enemies) e.gait += dt * 0.5;
      draw();
    } else if (G.state === 'play' || G.state === 'dying' || G.state === 'clearing') {
      update(dt);
      draw();
      updateHUD();
    } else {
      Sfx.crowd(0);
      if (G.state === 'continue' && !Ads.showing && !contBusy) {
        G.contT -= dt;
        $('contTime').textContent = Math.max(0, Math.ceil(G.contT));
        if (G.contT <= 0) giveUp();
      }
      draw();
    }
  }
  requestAnimationFrame(frame);
}

async function boot() {
  const lt = $('loadtext');
  lt.textContent = t('load.terrain');
  await new Promise((r) => setTimeout(r, 30));
  buildGrids();
  lt.textContent = t('load.paint');
  await new Promise((r) => setTimeout(r, 30));
  terrainImg = buildTerrainImage();
  miniBg = buildMiniBg();
  try { await document.fonts.ready; } catch (_) { /* フォント無しでも続行 */ }
  titleScene();
  show('loading', false);
  show('title', true);
  requestAnimationFrame(frame);
}
boot();
