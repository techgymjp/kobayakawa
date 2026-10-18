'use strict';
// 地形生成：標高グリッド・河川/街道フラグ・描画用オフスクリーン画像

const CELL = 8;
const GW = Math.floor(WORLD.W / CELL) + 1;
const GH = Math.floor(WORLD.H / CELL) + 1;
const HG = new Float32Array(GW * GH); // 標高
const FG = new Uint8Array(GW * GH); // 1=川 2=道 4=村
const F_RIVER = 1, F_ROAD = 2, F_VILLAGE = 4;
const TS = 0.5; // 地形画像の縮尺（px / 単位）

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 値ノイズ
const NOISE_N = 256;
const noiseTab = (() => {
  const r = mulberry32(1600);
  const t = new Float32Array(NOISE_N * NOISE_N);
  for (let i = 0; i < t.length; i++) t[i] = r() * 2 - 1;
  return t;
})();
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const m = NOISE_N - 1;
  const a = noiseTab[(yi & m) * NOISE_N + (xi & m)];
  const b = noiseTab[(yi & m) * NOISE_N + ((xi + 1) & m)];
  const c = noiseTab[((yi + 1) & m) * NOISE_N + (xi & m)];
  const d = noiseTab[((yi + 1) & m) * NOISE_N + ((xi + 1) & m)];
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
function fbm(x, y) {
  return vnoise(x, y) * 0.55 + vnoise(x * 2.1, y * 2.1) * 0.28 + vnoise(x * 4.3, y * 4.3) * 0.17;
}

function rawHeight(x, y) {
  let h = 0;
  for (const k of HILLS) {
    const dx = x - k.x, dy = y - k.y;
    let u, v;
    if (k.rot) {
      const c = Math.cos(k.rot), s = Math.sin(k.rot);
      u = (dx * c + dy * s) / k.rx; v = (-dx * s + dy * c) / k.ry;
    } else { u = dx / k.rx; v = dy / k.ry; }
    const d = u * u + v * v;
    if (d < 12) h += k.h * Math.exp(-d * 1.15);
  }
  h += fbm(x / 260, y / 260) * (3 + h * 0.18);
  return Math.max(0, h);
}

function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + dx * t - px, qy = ay + dy * t - py;
  return Math.sqrt(qx * qx + qy * qy);
}

function rasterPolyline(pts, w, bit) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const x0 = Math.max(0, Math.floor((Math.min(ax, bx) - w) / CELL));
    const x1 = Math.min(GW - 1, Math.ceil((Math.max(ax, bx) + w) / CELL));
    const y0 = Math.max(0, Math.floor((Math.min(ay, by) - w) / CELL));
    const y1 = Math.min(GH - 1, Math.ceil((Math.max(ay, by) + w) / CELL));
    for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
      if (distSeg(gx * CELL, gy * CELL, ax, ay, bx, by) < w * 0.5 + 2) FG[gy * GW + gx] |= bit;
    }
  }
}

function buildGrids() {
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) HG[gy * GW + gx] = rawHeight(gx * CELL, gy * CELL);
  // 川筋はわずかに谷に
  for (const r of RIVERS) rasterPolyline(r.pts, r.w, F_RIVER);
  for (let i = 0; i < HG.length; i++) if (FG[i] & F_RIVER) HG[i] = Math.max(0, HG[i] - 2);
  for (const r of ROADS) rasterPolyline(r.pts, r.w, F_ROAD);
  for (const v of VILLAGES) {
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
      const dx = gx * CELL - v.x, dy = gy * CELL - v.y;
      if (dx * dx + dy * dy < v.r * v.r) FG[gy * GW + gx] |= F_VILLAGE;
    }
  }
}

function heightAt(x, y) {
  x = x < 0 ? 0 : x > WORLD.W ? WORLD.W : x;
  y = y < 0 ? 0 : y > WORLD.H ? WORLD.H : y;
  const fx = x / CELL, fy = y / CELL;
  const gx = Math.min(GW - 2, Math.floor(fx)), gy = Math.min(GH - 2, Math.floor(fy));
  const tx = fx - gx, ty = fy - gy;
  const i = gy * GW + gx;
  const a = HG[i], b = HG[i + 1], c = HG[i + GW], d = HG[i + GW + 1];
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
function flagAt(x, y) {
  const gx = Math.round(clampW(x) / CELL), gy = Math.round(clampH(y) / CELL);
  return FG[gy * GW + gx];
}
function clampW(x) { return x < 0 ? 0 : x > WORLD.W ? WORLD.W : x; }
function clampH(y) { return y < 0 ? 0 : y > WORLD.H ? WORLD.H : y; }

// 移動方向の地形による速度倍率
function terrainFactor(x, y, dx, dy) {
  const h0 = heightAt(x, y), h1 = heightAt(x + dx * 10, y + dy * 10);
  const slope = (h1 - h0) / 10;
  let f = slope > 0 ? 1 / (1 + slope * 1.7) : 1 + Math.min(0.15, -slope * 0.4);
  const fl = flagAt(x, y);
  if ((fl & F_RIVER) && !(fl & F_ROAD)) f *= 0.55;
  else if (fl & F_ROAD) f *= 1.08;
  return f;
}

function lerpC(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

function buildTerrainImage() {
  const w = Math.round(WORLD.W * TS), h = Math.round(WORLD.H * TS);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h);
  const data = img.data;

  // セルごとの陰影
  const SH = new Float32Array(GW * GH);
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    const i = gy * GW + gx;
    const hx = HG[Math.min(GW - 1, gx + 1) + gy * GW] - HG[Math.max(0, gx - 1) + gy * GW];
    const hy = HG[gx + Math.min(GH - 1, gy + 1) * GW] - HG[gx + Math.max(0, gy - 1) * GW];
    // 北西からの光
    const nx = -hx / (2 * CELL) * 2.2, ny = -hy / (2 * CELL) * 2.2;
    const len = Math.sqrt(nx * nx + ny * ny + 1);
    const l = (nx * -0.6 + ny * -0.6 + 1 * 0.55) / len;
    SH[i] = 0.55 + l * 0.75;
  }

  const C_PADDY1 = [196, 176, 104], C_PADDY2 = [182, 162, 96], C_PADDY3 = [170, 170, 98];
  const C_GRASS = [134, 160, 88], C_GRASS2 = [104, 138, 70], C_FOREST = [64, 104, 56], C_FOREST2 = [50, 84, 46], C_ROCK = [96, 104, 80];
  const C_VILL = [168, 150, 112];

  for (let py = 0; py < h; py++) {
    const wy = py / TS;
    const fy = wy / CELL;
    const gy = Math.min(GH - 2, Math.floor(fy)), ty = fy - gy;
    for (let px = 0; px < w; px++) {
      const wx = px / TS;
      const fx = wx / CELL;
      const gx = Math.min(GW - 2, Math.floor(fx)), tx = fx - gx;
      const i = gy * GW + gx;
      const a = HG[i], b = HG[i + 1], c = HG[i + GW], d = HG[i + GW + 1];
      const hh = a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
      const sa = SH[i], sb = SH[i + 1], sc = SH[i + GW], sd = SH[i + GW + 1];
      let sh = sa + (sb - sa) * tx + (sc - sa) * ty + (sa - sb - sc + sd) * tx * ty;
      const fl = FG[Math.round(fy) * GW + Math.round(fx)];
      let col;
      const n = vnoise(wx / 23, wy / 23) * 0.5 + vnoise(wx / 7, wy / 7) * 0.5;
      if (hh < 7 && !(fl & F_VILLAGE)) {
        // 田（秋の稲田・刈田）
        const cx = Math.floor((wx + 13) / 40), cy = Math.floor((wy + 7) / 28);
        const hsh = ((cx * 73856093) ^ (cy * 19349663)) >>> 0;
        const k = hsh % 7;
        col = k < 3 ? C_PADDY1 : k < 5 ? C_PADDY2 : C_PADDY3;
        const lx = (wx + 13) % 40, ly = (wy + 7) % 28;
        if (lx < 2.2 || ly < 2.2) col = [132, 140, 80]; // 畦
        col = lerpC(col, C_GRASS, Math.max(0, (hh - 4) / 3));
      } else if (fl & F_VILLAGE) {
        col = C_VILL;
      } else if (hh < 25) {
        col = lerpC(C_GRASS, C_GRASS2, (hh - 7) / 18);
      } else if (hh < 90) {
        col = lerpC(C_GRASS2, C_FOREST, Math.min(1, (hh - 25) / 25));
        col = lerpC(col, C_FOREST2, (hh - 25) / 65);
      } else {
        col = lerpC(C_FOREST2, C_ROCK, Math.min(1, (hh - 90) / 200));
      }
      sh *= 0.93 + n * 0.1;
      // 等高線
      const step = 12;
      const hR = hh + (b - a) * (1 / TS / CELL), hD = hh + (c - a) * (1 / TS / CELL);
      if (hh > 6 && (Math.floor(hh / step) !== Math.floor(hR / step) || Math.floor(hh / step) !== Math.floor(hD / step))) sh *= Math.floor(hh / step) % 5 === 0 ? 0.72 : 0.86;
      const o = (py * w + px) * 4;
      data[o] = Math.min(255, col[0] * sh);
      data[o + 1] = Math.min(255, col[1] * sh);
      data[o + 2] = Math.min(255, col[2] * sh);
      data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  ctx.save();
  ctx.scale(TS, TS);

  const rnd = mulberry32(1015);
  // 森（斜面の木立）
  for (let i = 0; i < 26000; i++) {
    const x = rnd() * WORLD.W, y = rnd() * WORLD.H;
    const hh = heightAt(x, y);
    const fl = flagAt(x, y);
    if (fl) continue;
    const dens = hh < 18 ? 0.04 : hh < 30 ? 0.35 : 0.85;
    if (rnd() > dens) continue;
    const r = 6 + rnd() * 9;
    const g = 60 + rnd() * 30;
    ctx.fillStyle = `rgba(20,40,18,0.35)`;
    ctx.beginPath(); ctx.arc(x + 3, y + 3, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgb(${g * 0.6 | 0},${g + 20 | 0},${g * 0.55 | 0})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(160,200,120,0.18)`;
    ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.5, 0, Math.PI * 2); ctx.fill();
  }

  const stroke = (pts, width, color, dash) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const L = pts[pts.length - 1];
    ctx.lineTo(L[0], L[1]);
    ctx.lineWidth = width; ctx.strokeStyle = color;
    ctx.setLineDash(dash || []);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.setLineDash([]);
  };
  for (const r of RIVERS) {
    stroke(r.pts, r.w + 8, 'rgba(90,80,50,0.55)');
    stroke(r.pts, r.w, '#4f86ad');
    stroke(r.pts, r.w * 0.45, '#7fb2d4');
  }
  for (const r of ROADS) {
    stroke(r.pts, r.w + 4, 'rgba(90,70,40,0.6)');
    stroke(r.pts, r.w, '#cdb88c');
    stroke(r.pts, 1.5, 'rgba(120,95,60,0.5)', [10, 14]);
  }
  // 村の家並み
  for (const v of VILLAGES) {
    for (let i = 0; i < v.n; i++) {
      for (let tries = 0; tries < 20; tries++) {
        const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * v.r;
        const x = v.x + Math.cos(a) * d, y = v.y + Math.sin(a) * d;
        if (flagAt(x, y) & (F_ROAD | F_RIVER)) continue;
        const ww = 22 + rnd() * 12, hh = 14 + rnd() * 6;
        ctx.save(); ctx.translate(x, y); ctx.rotate((rnd() - 0.5) * 0.3);
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-ww / 2 + 3, -hh / 2 + 3, ww, hh);
        ctx.fillStyle = '#7b6648'; ctx.fillRect(-ww / 2, -hh / 2, ww, hh);
        ctx.fillStyle = '#9c845c'; ctx.fillRect(-ww / 2, -hh / 2, ww, hh / 2);
        ctx.strokeStyle = '#4e3f2a'; ctx.lineWidth = 1.2; ctx.strokeRect(-ww / 2, -hh / 2, ww, hh);
        ctx.beginPath(); ctx.moveTo(-ww / 2, 0); ctx.lineTo(ww / 2, 0); ctx.stroke();
        ctx.restore();
        break;
      }
    }
  }
  ctx.restore();
  return cv;
}
