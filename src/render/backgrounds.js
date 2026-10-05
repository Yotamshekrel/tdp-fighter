// ---------------------------------------------------------------------------
// Arenas: four hand-built scenes with parallax layers.
//
// Everything is drawn as smooth vector art. The static layers (sky, skyline,
// ground ...) are painted once into offscreen canvases VIEW.SCALE times denser
// than the game grid; the moving parts (waves, clouds, crowd, lights, birds)
// are drawn every frame on top.
//
// draw(g, t, camX): `camX` is the world x of the left edge of the view, and
// the layers move by a fraction of it, which gives the parallax. The ground
// plane (where the fighters' feet are) is VIEW.GROUND_Y.
// ---------------------------------------------------------------------------
import { VIEW } from '../config.js';
import { drawText } from './font.js';

const { W, H, GROUND_Y: GY, SCALE: S } = VIEW;
const PAD = 40; // extra width on each side of the layers

// ---- tiny drawing kit ------------------------------------------------------------------------
function layer(draw, w = W + PAD * 2) {
  const c = document.createElement('canvas');
  c.width = Math.round(w * S);
  c.height = H * S;
  const g = c.getContext('2d');
  g.scale(S, S);
  draw(g, w);
  return { c, w };
}
/** Draw a layer; `f` is how much of the camera movement it follows (0 = fixed to the screen, 1 = with the world). */
function put(g, L, camX, f, dy = 0) {
  g.drawImage(L.c, camX * (1 - f) - PAD, dy, L.w, H);
}
function prng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const lin = (g, x0, y0, x1, y1, stops) => {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c]) => gr.addColorStop(o, c));
  return gr;
};
const rad = (g, x, y, r0, r1, stops) => {
  const gr = g.createRadialGradient(x, y, r0, x, y, r1);
  stops.forEach(([o, c]) => gr.addColorStop(o, c));
  return gr;
};
const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const lerp = (a, b, t) => a + (b - a) * t;

/** Additive soft glow. */
function bloom(g, x, y, r, color, a = 1) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = a;
  g.fillStyle = rad(g, x, y, 0, r, [[0, color], [1, 'rgba(0,0,0,0)']]);
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.restore();
}

/** A tile of fine random speckle, used as a grain texture. */
function grainTile(seed, size, dark, light, density) {
  const r = prng(seed);
  const c = document.createElement('canvas');
  c.width = c.height = size * S;
  const g = c.getContext('2d');
  g.scale(S, S);
  for (let i = 0; i < size * size * density; i++) {
    g.fillStyle = r() < 0.5 ? dark : light;
    const s = 0.25 + r() * 0.5;
    g.fillRect(r() * size, r() * size, s, s);
  }
  return c;
}
function grain(g, tile, x, y, w, h, a = 1) {
  g.save();
  g.globalAlpha = a;
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  const sz = tile.width / S;
  for (let yy = y - (y % sz); yy < y + h; yy += sz) for (let xx = x - (x % sz); xx < x + w; xx += sz) g.drawImage(tile, xx, yy, sz, sz);
  g.restore();
}

/** A row of buildings. opts: min/max height, widths, colours, lit windows, rim light. */
function skyline(g, w, base, o) {
  const r = o.rand;
  let x = o.start ?? -4;
  while (x < w + 4) {
    const bw = o.wMin + r() * (o.wMax - o.wMin);
    const bh = o.hMin + r() * (o.hMax - o.hMin);
    const top = base - bh;
    g.fillStyle = lin(g, 0, top, 0, base, [[0, o.top], [1, o.bottom]]);
    g.fillRect(x, top, bw, bh + 2);
    // roof details
    const kind = r();
    if (kind < 0.2) { g.fillRect(x + bw * 0.4, top - 7, 1, 7); if (o.beacon) o.beacon.push([x + bw * 0.4 + 0.5, top - 7]); }
    else if (kind < 0.4) g.fillRect(x + 2, top - 3, bw * 0.4, 3);
    else if (kind < 0.5) { g.fillRect(x + bw * 0.15, top - 2, bw * 0.7, 2); g.fillRect(x + bw * 0.3, top - 4, bw * 0.4, 2); }
    // sun-facing edge
    if (o.rim) {
      g.fillStyle = o.rim;
      g.fillRect(x + bw - 0.7, top, 0.7, bh);
      g.fillRect(x, top, bw, 0.5);
    }
    if (o.windows) {
      for (let wy = top + 3; wy < base - 3; wy += o.winStep ?? 4) {
        for (let wx = x + 2; wx < x + bw - 2; wx += o.winStep ?? 3.2) {
          if (r() < o.winChance) {
            g.fillStyle = o.windows[Math.floor(r() * o.windows.length)];
            g.fillRect(wx, wy, 1.4, 1.9);
          }
        }
      }
    }
    x += bw + (o.gap ?? 0.5);
  }
}

/** A palm tree silhouette. */
function palm(g, x, base, h, lean, color) {
  g.save();
  g.strokeStyle = color;
  g.lineCap = 'round';
  g.lineWidth = 3.4;
  g.beginPath();
  g.moveTo(x, base);
  g.quadraticCurveTo(x + lean * 0.2, base - h * 0.55, x + lean, base - h);
  g.stroke();
  const tx = x + lean, ty = base - h;
  g.fillStyle = color;
  const fronds = [[-1, 0.1], [-0.8, -0.35], [-0.35, -0.65], [0.2, -0.7], [0.75, -0.4], [1, 0.05], [0.6, 0.45], [-0.6, 0.45]];
  for (const [dx, dy] of fronds) {
    const len = 26 + Math.abs(dx) * 6;
    g.beginPath();
    g.moveTo(tx, ty);
    g.quadraticCurveTo(tx + dx * len * 0.6, ty + dy * len * 0.6 - 7, tx + dx * len, ty + dy * len + 8);
    g.quadraticCurveTo(tx + dx * len * 0.55, ty + dy * len * 0.45 + 1, tx, ty);
    g.fill();
  }
  g.beginPath();
  g.arc(tx, ty + 1, 2.4, 0, 6.3);
  g.fill();
  g.restore();
}

// ===========================================================================================
// 1. GORDON BEACH, Tel Aviv, at sunset
// ===========================================================================================
const BEACH = {
  id: 'beach',
  name: 'Gordon Beach',
  build() {
    const r = prng(7);
    const HZ = 156; // horizon
    const SUN = [292, 150];
    const SHORE = 203;
    this.hz = HZ;
    this.sky = layer((g, w) => {
      g.fillStyle = lin(g, 0, 0, 0, HZ + 6, [[0, '#120d42'], [0.2, '#34187a'], [0.42, '#8f2c7e'], [0.6, '#e04870'], [0.74, '#ff8450'], [0.88, '#ffbd68'], [1, '#ffe4a2']]);
      g.fillRect(0, 0, w, HZ + 6);
      for (let i = 0; i < 40; i++) {
        g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.5})`;
        const y = r() * 60;
        g.fillRect(r() * w, y, 0.5, 0.5);
      }
      bloom(g, SUN[0] + PAD, SUN[1], 230, '#ff8a4a', 0.55);
      bloom(g, SUN[0] + PAD, SUN[1], 110, '#ffd48a', 0.7);
      // the sun
      g.fillStyle = rad(g, SUN[0] + PAD, SUN[1], 0, 30, [[0, '#fffbea'], [0.7, '#ffe49a'], [1, '#ffbc5a']]);
      g.beginPath();
      g.arc(SUN[0] + PAD, SUN[1], 29, 0, 6.3);
      g.fill();
    });
    // clouds: long, lit from below by the sun
    this.clouds = layer((g, w) => {
      const cloud = (cx, cy, sc, tone) => {
        for (const [dx, dy, rx, ry] of [[0, 0, 40, 6], [-26, 1, 24, 4.5], [30, 1.5, 28, 4], [-8, -2.5, 22, 4], [12, -2, 18, 3.6]]) {
          g.beginPath();
          g.ellipse(cx + dx * sc, cy + dy * sc, rx * sc, ry * sc, 0, 0, 6.3);
          g.fillStyle = lin(g, 0, cy - 8 * sc, 0, cy + 8 * sc, [[0, tone[0]], [0.55, tone[1]], [1, tone[2]]]);
          g.fill();
        }
      };
      const tones = [['#b04a8e', '#e0586e', '#ffb06a'], ['#8c3a8c', '#d0486e', '#ff9a5e'], ['#c85a8a', '#f07a6a', '#ffcf86']];
      for (let i = 0; i < 9; i++) cloud(i * (w / 8) + r() * 20, 20 + r() * 62, 0.7 + r() * 0.9, tones[i % 3]);
    }, (W + PAD * 2) * 2);
    // far skyline, hazed by the evening light
    this.far = layer((g, w) => {
      skyline(g, w, HZ + 1, { rand: r, wMin: 8, wMax: 20, hMin: 10, hMax: 34, top: '#8b3a7c', bottom: '#b14a7a', windows: ['#ffd9a0'], winChance: 0.16, rim: 'rgba(255,170,100,0.5)', start: -6 });
      // the three Azrieli towers
      const ax = 78 + PAD, base = HZ + 1;
      g.fillStyle = lin(g, 0, base - 82, 0, base, [[0, '#6d2d6e'], [1, '#8f3d70']]);
      g.fillRect(ax, base - 82, 17, 82);
      g.beginPath();
      g.ellipse(ax + 8.5, base - 82, 8.5, 3, 0, 0, 6.3);
      g.fill();
      g.beginPath();
      g.moveTo(ax + 24, base);
      g.lineTo(ax + 40, base);
      g.lineTo(ax + 32, base - 78);
      g.closePath();
      g.fill();
      g.fillRect(ax + 47, base - 74, 16, 74);
      g.fillStyle = 'rgba(255,170,100,0.45)';
      g.fillRect(ax + 16.2, base - 82, 0.8, 82);
      g.fillRect(ax + 62.2, base - 74, 0.8, 74);
      for (let i = 0; i < 40; i++) {
        g.fillStyle = 'rgba(255,225,170,0.75)';
        g.fillRect(ax + 1 + r() * 14, base - 80 + r() * 76, 1, 1.4);
        g.fillRect(ax + 48 + r() * 14, base - 72 + r() * 70, 1, 1.4);
      }
    });
    this.near = layer((g, w) => {
      skyline(g, w, HZ + 3, { rand: r, wMin: 10, wMax: 24, hMin: 6, hMax: 24, top: '#5a2468', bottom: '#7a2f6e', windows: ['#ffd08a', '#ffe9b8'], winChance: 0.22, rim: 'rgba(255,150,90,0.55)', start: 150 });
      // haze at the foot of the skyline
      g.fillStyle = lin(g, 0, HZ - 20, 0, HZ + 4, [[0, 'rgba(255,190,120,0)'], [1, 'rgba(255,200,130,0.55)']]);
      g.fillRect(0, HZ - 20, w, 24);
    });
    this.sea = layer((g, w) => {
      g.fillStyle = lin(g, 0, HZ, 0, SHORE, [[0, '#ffae78'], [0.12, '#d96a86'], [0.35, '#7f3a92'], [0.7, '#363c92'], [1, '#222f78']]);
      g.fillRect(0, HZ, w, SHORE - HZ + 2);
      // distant ship and sailboat
      g.fillStyle = '#4a2468';
      g.fillRect(150 + PAD, HZ - 4, 22, 3.4);
      g.fillRect(160 + PAD, HZ - 8, 8, 4);
      g.beginPath();
      g.moveTo(380 + PAD, HZ - 1);
      g.lineTo(380 + PAD, HZ - 12);
      g.lineTo(390 + PAD, HZ - 1);
      g.fill();
    });
    this.sand = layer((g, w) => {
      g.fillStyle = lin(g, 0, SHORE, 0, H, [[0, '#f6d29c'], [0.18, '#efc088'], [0.55, '#d79a64'], [1, '#a8704a']]);
      g.fillRect(0, SHORE, w, H - SHORE);
      this.grainTile ||= grainTile(11, 48, 'rgba(120,70,40,0.5)', 'rgba(255,240,210,0.55)', 0.9);
      grain(g, this.grainTile, 0, SHORE, w, H - SHORE, 0.55);
      // wet sand band with the sky mirrored in it
      g.fillStyle = lin(g, 0, SHORE - 1, 0, SHORE + 15, [[0, 'rgba(255,170,120,0.75)'], [0.4, 'rgba(160,90,110,0.55)'], [1, 'rgba(160,100,70,0)']]);
      g.fillRect(0, SHORE - 1, w, 16);
      // warm light from the sun on the sand, darker toward the viewer
      g.fillStyle = rad(g, SUN[0] + PAD, SHORE + 8, 0, 220, [[0, 'rgba(255,200,130,0.35)'], [1, 'rgba(255,200,130,0)']]);
      g.fillRect(0, SHORE, w, H - SHORE);
      g.fillStyle = lin(g, 0, H - 40, 0, H, [[0, 'rgba(40,20,50,0)'], [1, 'rgba(40,20,50,0.45)']]);
      g.fillRect(0, H - 40, w, 40);
    });
    // beach furniture in front of the sea, behind the fighters
    this.props = layer((g, w) => {
      const dark = '#2a1236';
      palm(g, 36 + PAD, SHORE + 12, 118, 22, dark);
      palm(g, w - 44, SHORE + 14, 100, -18, dark);
      // lifeguard tower
      const hx = w - 150;
      g.fillStyle = '#3a1a40';
      g.fillRect(hx + 2, SHORE - 40, 2.4, 52);
      g.fillRect(hx + 30, SHORE - 40, 2.4, 52);
      g.fillRect(hx - 1, SHORE - 40, 38, 2.4);
      g.fillStyle = lin(g, 0, SHORE - 68, 0, SHORE - 40, [[0, '#fff2e4'], [1, '#f2c8b4']]);
      g.fillRect(hx - 2, SHORE - 66, 40, 26);
      g.fillStyle = '#d8404a';
      g.beginPath();
      g.moveTo(hx - 5, SHORE - 66);
      g.lineTo(hx + 17, SHORE - 76);
      g.lineTo(hx + 39, SHORE - 66);
      g.fill();
      g.fillStyle = '#3c4a96';
      g.fillRect(hx + 3, SHORE - 60, 11, 9);
      g.fillRect(hx + 20, SHORE - 60, 11, 9);
      g.fillStyle = 'rgba(255,200,140,0.5)';
      g.fillRect(hx + 3, SHORE - 60, 11, 2.5);
      g.fillRect(hx + 20, SHORE - 60, 11, 2.5);
      // umbrellas
      for (const [ux, col] of [[w * 0.46, '#e8584a'], [w * 0.58, '#f2c040'], [w * 0.2, '#4aa0e0']]) {
        g.fillStyle = '#4a2a3a';
        g.fillRect(ux, SHORE - 14, 0.8, 18);
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(ux - 11, SHORE - 14);
        g.quadraticCurveTo(ux, SHORE - 25, ux + 11, SHORE - 14);
        g.closePath();
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.beginPath();
        g.moveTo(ux - 3, SHORE - 19);
        g.quadraticCurveTo(ux, SHORE - 24, ux + 3, SHORE - 19);
        g.lineTo(ux, SHORE - 14);
        g.fill();
      }
    });
    this.motes = Array.from({ length: 26 }, () => ({ x: r() * W, y: r() * H, s: 0.3 + r() * 0.8, v: 0.1 + r() * 0.3, p: r() * 6.3 }));
  },
  draw(g, t, camX) {
    g.imageSmoothingEnabled = true;
    put(g, this.sky, camX, 0.04);
    // drifting clouds
    const cw = this.clouds.w;
    const off = (t * 0.06) % cw;
    g.save();
    g.globalAlpha = 0.95;
    g.drawImage(this.clouds.c, camX * 0.94 - PAD - off, 0, cw, H);
    g.drawImage(this.clouds.c, camX * 0.94 - PAD - off + cw, 0, cw, H);
    g.restore();
    put(g, this.far, camX, 0.12);
    put(g, this.near, camX, 0.2);
    put(g, this.sea, camX, 0.25);
    // sparkle on the water + rolling wave lines
    g.save();
    g.globalCompositeOperation = 'lighter';
    const sunX = 292 + camX * 0.96; // the sun is in the sky layer
    g.fillStyle = lin(g, 0, this.hz, 0, 203, [[0, 'rgba(255,224,160,0.8)'], [1, 'rgba(255,150,100,0)']]);
    g.beginPath();
    g.moveTo(sunX - 16, this.hz);
    g.lineTo(sunX + 16, this.hz);
    g.lineTo(sunX + 64, 203);
    g.lineTo(sunX - 64, 203);
    g.fill();
    for (let i = 0; i < 46; i++) {
      const k = i / 46;
      const y = this.hz + 3 + k * 44;
      const spread = 6 + k * 62;
      const x = sunX + Math.sin(i * 7.3) * spread + Math.sin(t * 0.03 + i) * 2;
      const a = Math.max(0, Math.sin(t * 0.07 + i * 2.1)) * (1 - k * 0.5);
      g.fillStyle = `rgba(255,236,190,${a * 0.9})`;
      g.fillRect(x, y, 3 + k * 7, 0.7 + k * 0.4);
    }
    for (let i = 0; i < 14; i++) {
      const k = i / 14;
      const y = this.hz + 6 + k * 40;
      const x = (((i * 97) % (W + 100)) + t * (0.15 + k * 0.4)) % (W + 100) - 50;
      g.fillStyle = `rgba(255,200,230,${0.1 + k * 0.12})`;
      g.fillRect(x, y, 14 + k * 20, 0.6);
    }
    g.restore();
    // foam: layered sine waves
    const SH = 203;
    for (let layerI = 0; layerI < 3; layerI++) {
      const ph = t * (0.035 + layerI * 0.01) + layerI * 2;
      const amp = 2.2 - layerI * 0.5;
      const yb = SH + Math.sin(ph) * amp + layerI * 1.1 - 2;
      g.beginPath();
      g.moveTo(-10, SH - 8);
      for (let x = -10; x <= W + 10; x += 6) g.lineTo(x, yb + Math.sin(x * 0.07 + ph * 1.7) * 1.1);
      g.lineTo(W + 10, SH - 8);
      g.closePath();
      g.fillStyle = layerI === 0 ? 'rgba(255,248,240,0.9)' : `rgba(255,240,232,${0.36 - layerI * 0.1})`;
      g.fill();
    }
    put(g, this.sand, camX, 0.3);
    put(g, this.props, camX, 0.32);
    // seagulls
    for (let i = 0; i < 3; i++) {
      const x = ((t * (0.35 + i * 0.15) + i * 170) % (W + 80)) - 40;
      const y = 44 + i * 22 + Math.sin(t * 0.035 + i * 2) * 7;
      const f = Math.sin(t * 0.2 + i * 3) * 2.4;
      g.strokeStyle = '#2d1238';
      g.lineWidth = 0.8;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x - 5, y - f * 0.4);
      g.quadraticCurveTo(x - 2.5, y - 2 - f, x, y);
      g.quadraticCurveTo(x + 2.5, y - 2 - f, x + 5, y - f * 0.4);
      g.stroke();
    }
    // golden dust in the air
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const m of this.motes) {
      const y = (m.y - t * m.v * 0.4 + H * 8) % H;
      const x = (m.x + Math.sin(t * 0.01 + m.p) * 10 + camX * 0.1 + W * 4) % W;
      g.fillStyle = `rgba(255,214,150,${0.2 + 0.3 * Math.sin(t * 0.03 + m.p) ** 2})`;
      g.beginPath();
      g.arc(x, y, m.s, 0, 6.3);
      g.fill();
    }
    g.restore();
  },
};

// ===========================================================================================
// 2. ROOFTOP, Tel Aviv at night
// ===========================================================================================
const ROOFTOP = {
  id: 'rooftop',
  name: 'Rooftop Night',
  build() {
    const r = prng(21);
    const HZ = 186;
    this.beaconsFar = [];
    this.beaconsNear = [];
    this.stars = Array.from({ length: 90 }, () => ({ x: r() * (W + PAD * 2), y: r() * 120, p: r() * 6.3, s: 0.3 + r() * 0.7 }));
    this.sky = layer((g, w) => {
      g.fillStyle = lin(g, 0, 0, 0, HZ, [[0, '#03041a'], [0.35, '#0b1040'], [0.65, '#241e6a'], [0.88, '#5a2c7c'], [1, '#a04478']]);
      g.fillRect(0, 0, w, HZ);
      // the moon
      bloom(g, 380 + PAD, 44, 90, '#8ab0ff', 0.5);
      g.fillStyle = rad(g, 380 + PAD, 44, 0, 15, [[0, '#ffffff'], [1, '#d8e4ff']]);
      g.beginPath();
      g.arc(380 + PAD, 44, 14, 0, 6.3);
      g.fill();
      g.fillStyle = 'rgba(150,170,220,0.35)';
      for (const [dx, dy, rr] of [[-4, -3, 3], [3, 4, 2.4], [4, -5, 1.6]]) {
        g.beginPath();
        g.arc(380 + PAD + dx, 44 + dy, rr, 0, 6.3);
        g.fill();
      }
      // thin clouds catching the city glow
      for (let i = 0; i < 6; i++) {
        const y = 70 + r() * 90;
        g.fillStyle = lin(g, 0, y - 4, 0, y + 4, [[0, 'rgba(150,100,200,0)'], [0.5, `rgba(170,110,190,${0.08 + r() * 0.1})`], [1, 'rgba(150,100,200,0)']]);
        g.fillRect(r() * 200, y - 4, 160 + r() * 260, 8);
      }
    });
    this.far = layer((g, w) => {
      skyline(g, w, HZ + 2, { rand: r, wMin: 10, wMax: 26, hMin: 24, hMax: 92, top: '#1a1a52', bottom: '#2c2468', windows: ['#ffdf8a', '#9fe8ff', '#ffffff'], winChance: 0.3, rim: 'rgba(150,170,255,0.3)', beacon: this.beaconsFar, start: -4 });
      g.fillStyle = lin(g, 0, HZ - 40, 0, HZ + 2, [[0, 'rgba(180,90,160,0)'], [1, 'rgba(200,100,150,0.45)']]);
      g.fillRect(0, HZ - 40, w, 42);
    });
    this.near = layer((g, w) => {
      skyline(g, w, HZ + 12, { rand: r, wMin: 16, wMax: 34, hMin: 26, hMax: 70, top: '#11113a', bottom: '#1a1a4a', windows: ['#ffd070', '#8fe0ff', '#ff9ad0'], winChance: 0.26, rim: 'rgba(130,150,255,0.25)', beacon: this.beaconsNear, start: 20, gap: 1.5, winStep: 4.6 });
    });
    // roof: parapet, vents, heaters, water tower and a big neon sign
    this.roof = layer((g, w) => {
      const wall = 205;
      g.fillStyle = lin(g, 0, wall - 4, 0, GY + 8, [[0, '#3a3c66'], [0.5, '#2a2c52'], [1, '#1c1e40']]);
      g.fillRect(0, wall, w, GY - wall + 8);
      g.fillStyle = '#6a6e9e';
      g.fillRect(0, wall - 3, w, 3);
      g.fillStyle = 'rgba(190,200,255,0.5)';
      g.fillRect(0, wall - 3, w, 0.7);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (let x = 0; x < w; x += 18) g.fillRect(x, wall, 0.6, GY - wall + 8);
      // solar water heaters ("dudei shemesh")
      const dud = (x) => {
        g.fillStyle = '#222a48';
        g.fillRect(x, wall - 30, 1.6, 30);
        g.fillRect(x + 22, wall - 30, 1.6, 30);
        g.save();
        g.translate(x - 2, wall - 33);
        g.rotate(-0.4);
        g.fillStyle = lin(g, 0, 0, 0, 12, [[0, '#4e66b8'], [1, '#26346e']]);
        g.fillRect(0, 0, 28, 11);
        g.strokeStyle = 'rgba(160,190,255,0.5)';
        g.lineWidth = 0.4;
        for (let i = 1; i < 7; i++) {
          g.beginPath();
          g.moveTo(i * 4, 0);
          g.lineTo(i * 4, 11);
          g.stroke();
        }
        g.restore();
        g.fillStyle = lin(g, 0, wall - 46, 0, wall - 36, [[0, '#e8ecff'], [1, '#aab0d8']]);
        g.fillRect(x + 4, wall - 46, 22, 9);
        g.beginPath();
        g.arc(x + 4, wall - 41.5, 4.5, 0, 6.3);
        g.fill();
      };
      dud(26);
      dud(w * 0.46);
      dud(w - 118);
      // water tower
      const tx = w - 74;
      g.fillStyle = '#1d2040';
      for (const dx of [0, 6, 22, 28]) g.fillRect(tx + dx, wall - 40, 1.6, 40);
      g.fillStyle = lin(g, tx, 0, tx + 34, 0, [[0, '#6a4e5e'], [0.6, '#4a3446'], [1, '#2e2034']]);
      g.fillRect(tx - 2, wall - 72, 34, 32);
      g.fillStyle = '#3a2838';
      g.beginPath();
      g.moveTo(tx - 4, wall - 72);
      g.lineTo(tx + 15, wall - 82);
      g.lineTo(tx + 34, wall - 72);
      g.fill();
      // AC unit
      g.fillStyle = lin(g, 0, wall - 14, 0, wall, [[0, '#8a92b8'], [1, '#50567a']]);
      g.fillRect(w * 0.7, wall - 14, 24, 14);
      g.fillStyle = '#2a2e4a';
      g.beginPath();
      g.arc(w * 0.7 + 12, wall - 7, 5, 0, 6.3);
      g.fill();
    });
    // floor
    this.floor = layer((g, w) => {
      g.fillStyle = lin(g, 0, GY - 22, 0, H, [[0, '#2f3258'], [0.35, '#262848'], [1, '#14152e']]);
      g.fillRect(0, GY - 22, w, H - GY + 22);
      this.tile ||= grainTile(5, 40, 'rgba(0,0,0,0.45)', 'rgba(150,160,230,0.3)', 0.8);
      grain(g, this.tile, 0, GY - 22, w, H - GY + 22, 0.55);
      // slab seams in perspective
      g.strokeStyle = 'rgba(120,130,200,0.2)';
      g.lineWidth = 0.5;
      for (let i = -12; i <= 12; i++) {
        g.beginPath();
        g.moveTo(w / 2 + i * 22, GY - 22);
        g.lineTo(w / 2 + i * 60, H);
        g.stroke();
      }
      for (let k = 0; k < 6; k++) {
        const y = GY - 22 + (k / 6) ** 1.7 * (H - GY + 22);
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y);
        g.stroke();
      }
      // glossy edge where the wall meets the floor
      g.fillStyle = 'rgba(180,190,255,0.25)';
      g.fillRect(0, GY - 22, w, 0.8);
      g.fillStyle = lin(g, 0, H - 36, 0, H, [[0, 'rgba(0,0,10,0)'], [1, 'rgba(0,0,10,0.5)']]);
      g.fillRect(0, H - 36, w, 36);
    });
  },
  draw(g, t, camX) {
    g.imageSmoothingEnabled = true;
    put(g, this.sky, camX, 0.03);
    for (const s of this.stars) {
      const a = 0.35 + 0.65 * Math.max(0, Math.sin(t * 0.04 + s.p));
      g.fillStyle = `rgba(220,230,255,${a})`;
      g.beginPath();
      g.arc(s.x - PAD + camX * 0.97, s.y, s.s, 0, 6.3);
      g.fill();
    }
    // a plane crossing the sky
    const px = ((t * 0.28) % (W + 100)) - 50;
    g.fillStyle = Math.floor(t / 22) % 2 ? '#ff4040' : '#ffffff';
    g.fillRect(px, 30, 1.2, 1.2);
    // searchlights from the far towers
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 2; i++) {
      const bx = 90 + i * 270 + camX * 0.88, by = 186;
      const ang = -Math.PI / 2 + Math.sin(t * 0.012 + i * 2) * 0.55;
      g.fillStyle = lin(g, bx, by, bx + Math.cos(ang) * 190, by + Math.sin(ang) * 190, [[0, 'rgba(160,190,255,0.22)'], [1, 'rgba(160,190,255,0)']]);
      g.beginPath();
      g.moveTo(bx, by);
      g.lineTo(bx + Math.cos(ang - 0.05) * 200, by + Math.sin(ang - 0.05) * 200);
      g.lineTo(bx + Math.cos(ang + 0.05) * 200, by + Math.sin(ang + 0.05) * 200);
      g.fill();
    }
    g.restore();
    put(g, this.far, camX, 0.1);
    put(g, this.near, camX, 0.2);
    // blinking beacons on the roofs
    for (const [list, f] of [[this.beaconsFar, 0.1], [this.beaconsNear, 0.2]]) {
      for (const [x, y] of list) {
        if (Math.floor(t / 32 + x * 0.37) % 2) bloom(g, x - PAD + camX * (1 - f), y, 5, '#ff3030', 0.9);
      }
    }
    // neon sign on the next roof, flickering
    const flick = 0.82 + 0.18 * Math.sin(t * 0.3) * Math.sin(t * 0.11) + (t % 211 < 4 ? -0.5 : 0);
    const sx = 168 + camX * 0.78, sy = 108;
    g.save();
    g.globalAlpha = Math.max(0.25, flick);
    bloom(g, sx + 40, sy + 8, 80, '#ff2a8a', 0.45);
    drawText(g, 'TDP', sx + 40, sy - 8, { scale: 3.4, align: 'center', color: ['#ffd0f0', '#ff4aa8'], outline: 'rgba(60,0,40,0.9)', glow: '#ff2a8a', italic: true });
    drawText(g, 'FIGHT CLUB', sx + 40, sy + 22, { scale: 1.4, align: 'center', color: ['#d0f4ff', '#3ac8ff'], glow: '#2ab8ff' });
    g.restore();
    put(g, this.roof, camX, 0.3);
    put(g, this.floor, camX, 0.3);
    // neon light pooling on the floor
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = rad(g, 120 + camX * 0.3 * 0, GY + 14, 0, 150, [[0, 'rgba(255,40,140,0.22)'], [1, 'rgba(255,40,140,0)']]);
    g.fillRect(0, GY - 20, W, H);
    g.fillStyle = rad(g, 380, GY + 14, 0, 160, [[0, 'rgba(40,160,255,0.2)'], [1, 'rgba(40,160,255,0)']]);
    g.fillRect(0, GY - 20, W, H);
    g.restore();
    // festoon lights strung across the roof
    for (let i = 0; i < 2; i++) {
      const y0 = 20 + i * 8;
      g.strokeStyle = 'rgba(20,20,40,0.8)';
      g.lineWidth = 0.6;
      g.beginPath();
      for (let x = -10; x <= W + 10; x += 8) {
        const y = y0 + Math.sin((x / W) * Math.PI * (2 + i)) * 4 + 10;
        if (x === -10) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
      for (let x = 6 + i * 11; x < W; x += 22) {
        const y = y0 + Math.sin((x / W) * Math.PI * (2 + i)) * 4 + 10;
        const on = 0.7 + 0.3 * Math.sin(t * 0.08 + x);
        bloom(g, x, y + 2, 7, '#ffcf70', 0.55 * on);
        g.fillStyle = '#fff1c0';
        g.beginPath();
        g.arc(x, y + 1.5, 1.2, 0, 6.3);
        g.fill();
      }
    }
  },
};

// ===========================================================================================
// 3. BLOOMFIELD STADIUM, floodlit match night
// ===========================================================================================
const STADIUM = {
  id: 'stadium',
  name: 'Bloomfield Stadium',
  build() {
    const r = prng(99);
    const KERB = 196; // top of the advertising boards
    this.sky = layer((g, w) => {
      g.fillStyle = lin(g, 0, 0, 0, 120, [[0, '#04061a'], [0.6, '#10164a'], [1, '#26307a']]);
      g.fillRect(0, 0, w, 130);
      for (let i = 0; i < 50; i++) {
        g.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.5})`;
        g.fillRect(r() * w, r() * 50, 0.5, 0.5);
      }
    });
    // the bowl: upper tier, roof truss, lower tier
    this.stands = layer((g, w) => {
      // roof edge + truss
      g.fillStyle = lin(g, 0, 70, 0, 100, [[0, '#0a0c24'], [1, '#1c2050']]);
      g.fillRect(0, 70, w, 30);
      g.strokeStyle = 'rgba(160,170,240,0.25)';
      g.lineWidth = 0.6;
      for (let x = -10; x < w + 10; x += 14) {
        g.beginPath();
        g.moveTo(x, 70);
        g.lineTo(x + 7, 98);
        g.lineTo(x + 14, 70);
        g.stroke();
      }
      g.fillStyle = 'rgba(190,200,255,0.55)';
      g.fillRect(0, 98, w, 1);
      // tiers
      g.fillStyle = lin(g, 0, 99, 0, KERB, [[0, '#262a5c'], [1, '#161838']]);
      g.fillRect(0, 99, w, KERB - 99);
      for (let k = 0; k < 8; k++) {
        const y = 106 + k * 11;
        g.fillStyle = 'rgba(0,0,10,0.35)';
        g.fillRect(0, y + 8, w, 3);
        g.fillStyle = 'rgba(180,190,255,0.12)';
        g.fillRect(0, y + 8, w, 0.6);
      }
      // aisles
      g.fillStyle = 'rgba(0,0,12,0.35)';
      for (let x = 30; x < w; x += 96) g.fillRect(x, 99, 5, KERB - 99);
    });
    // crowd rows (each bobs on its own)
    this.rows = [];
    const palette = ['#d71920', '#ffffff', '#d71920', '#f0c080', '#8a5a3a', '#3a3a52', '#ffd23f', '#2a6ad8', '#ffffff'];
    for (let row = 0; row < 8; row++) {
      this.rows.push({
        y: 108 + row * 11,
        ph: r() * 6.3,
        L: layer((g, w) => {
          for (let x = (row % 2) * 3; x < w; x += 6.4) {
            const c = palette[Math.floor(r() * palette.length)];
            const hy = 1 + r() * 1.2;
            g.fillStyle = '#e8b890';
            g.beginPath();
            g.arc(x + 2, hy + 0.8, 1.6, 0, 6.3);
            g.fill();
            g.fillStyle = c;
            g.beginPath();
            g.roundRect ? g.roundRect(x - 0.6, hy + 2.2, 5.2, 8, 1.8) : g.rect(x - 0.6, hy + 2.2, 5.2, 8);
            g.fill();
            if (r() < 0.12) {
              g.fillStyle = c;
              g.fillRect(x + 4.6, hy - 3, 0.7, 6);
              g.fillRect(x + 5.3, hy - 3, 4, 2.4);
            }
          }
        }),
      });
    }
    // advertising boards + pitch
    this.pitch = layer((g, w) => {
      g.fillStyle = '#05060f';
      g.fillRect(0, KERB, w, 13);
      g.fillStyle = lin(g, 0, KERB + 13, 0, H, [[0, '#2a7c3a'], [0.4, '#2f9444'], [1, '#1e6a30']]);
      g.fillRect(0, KERB + 13, w, H - KERB - 13);
      for (let x = -40, k = 0; x < w; x += 34, k++) {
        if (k % 2) {
          g.fillStyle = 'rgba(255,255,255,0.07)';
          g.beginPath();
          g.moveTo(x + 14, KERB + 13);
          g.lineTo(x + 48, KERB + 13);
          g.lineTo(x + 78, H);
          g.lineTo(x - 30, H);
          g.fill();
        }
      }
      this.blade ||= grainTile(8, 40, 'rgba(0,40,10,0.5)', 'rgba(180,255,170,0.3)', 0.9);
      grain(g, this.blade, 0, KERB + 13, w, H - KERB - 13, 0.5);
      // pitch markings
      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(0, KERB + 18);
      g.lineTo(w, KERB + 18);
      g.stroke();
      g.beginPath();
      g.ellipse(w / 2, KERB + 60, 70, 24, 0, 0, 6.3);
      g.stroke();
      g.beginPath();
      g.moveTo(w / 2, KERB + 18);
      g.lineTo(w / 2, H);
      g.stroke();
      g.fillStyle = lin(g, 0, H - 40, 0, H, [[0, 'rgba(0,10,0,0)'], [1, 'rgba(0,10,0,0.5)']]);
      g.fillRect(0, H - 40, w, 40);
    });
    this.flares = Array.from({ length: 22 }, () => ({ x: r() * W, y: 104 + r() * 84, p: r() * 400, s: 120 + r() * 300 }));
  },
  draw(g, t, camX) {
    g.imageSmoothingEnabled = true;
    put(g, this.sky, camX, 0.03);
    put(g, this.stands, camX, 0.1);
    // crowd
    const hype = 1 + Math.sin(t * 0.012) * 0.5;
    for (const row of this.rows) {
      const bob = Math.max(0, Math.sin(t * 0.09 + row.ph)) * 1.6 * hype;
      g.drawImage(row.L.c, camX * 0.9 - PAD, row.y - bob, row.L.w, H);
    }
    // darken the rear of the stands, flashbulbs
    g.fillStyle = 'rgba(4,6,24,0.28)';
    g.fillRect(0, 100, W, 96);
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const f of this.flares) {
      const k = (t + f.p) % f.s;
      if (k < 5) {
        const a = 1 - k / 5;
        bloom(g, f.x, f.y, 9, '#ffffff', a);
      }
    }
    // floodlights and their beams
    for (const x of [58, W - 58]) {
      const lx = x + camX * 0.9;
      g.fillStyle = lin(g, lx, 20, lx + (x < W / 2 ? 60 : -60), H, [[0, 'rgba(255,250,220,0.22)'], [1, 'rgba(255,250,220,0)']]);
      g.beginPath();
      g.moveTo(lx - 7, 22);
      g.lineTo(lx + 7, 22);
      g.lineTo(lx + (x < W / 2 ? 190 : -70), H);
      g.lineTo(lx + (x < W / 2 ? 30 : -230), H);
      g.fill();
      bloom(g, lx, 22, 70, '#fff6d0', 0.75);
    }
    g.restore();
    for (const x of [58, W - 58]) {
      const lx = x + camX * 0.9;
      g.fillStyle = '#10122e';
      g.fillRect(lx - 1.5, 26, 3, 74);
      g.fillStyle = '#1c2050';
      g.fillRect(lx - 14, 14, 28, 13);
      for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) {
        g.fillStyle = '#fffbe6';
        g.fillRect(lx - 12 + i * 5, 16 + j * 5.4, 3.6, 3.6);
      }
    }
    put(g, this.pitch, camX, 0.3);
    // LED boards: rolling messages
    const boardY = 196;
    g.save();
    g.beginPath();
    g.rect(0, boardY, W, 13);
    g.clip();
    const msgs = ['TDP FIGHTER', '18 FRIENDS - ONE CHAMPION', 'GO GO GO', 'BLOOMFIELD', 'FIGHT NIGHT'];
    const cols = [['#ffffff', '#ff5a5a'], ['#ffffff', '#ffd23f'], ['#ffffff', '#5ad0ff']];
    for (let i = 0; i < 6; i++) {
      const x = ((i * 190 - t * 0.7) % (6 * 190) + 6 * 190) % (6 * 190) - 150;
      drawText(g, msgs[i % msgs.length], x + camX * 0.3, boardY + 2.5, { scale: 0.95, color: cols[i % 3], glow: i % 2 ? '#ff5a5a' : '#ffd23f', italic: true, weight: 800 });
    }
    g.restore();
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(0, boardY, W, 0.8);
  },
};

// ===========================================================================================
// 4. CARMEL MARKET (the shuk), sunny day
// ===========================================================================================
const SHUK = {
  id: 'shuk',
  name: 'Carmel Market',
  build() {
    const r = prng(5);
    const HZ = 150;
    this.sky = layer((g, w) => {
      g.fillStyle = lin(g, 0, 0, 0, HZ + 20, [[0, '#2f8fe0'], [0.55, '#7cc4f2'], [1, '#d4eefc']]);
      g.fillRect(0, 0, w, HZ + 20);
      bloom(g, 70 + PAD, 10, 200, '#ffffff', 0.55);
    });
    this.clouds = Array.from({ length: 6 }, (_, i) => ({ x: i * 120 + r() * 50, y: 14 + r() * 40, s: 0.7 + r() * 0.9, v: 0.02 + r() * 0.03 }));
    // old stone buildings along the street
    this.far = layer((g, w) => {
      let x = -10;
      const stones = [['#f0dcb8', '#d6bd92'], ['#ecd2a8', '#cfb184'], ['#f4e4c4', '#dac49c'], ['#e6caa0', '#c8a878']];
      while (x < w) {
        const bw = 44 + r() * 34, bh = 70 + r() * 54, top = HZ + 18 - bh;
        const [a, b] = stones[Math.floor(r() * stones.length)];
        g.fillStyle = lin(g, x, 0, x + bw, 0, [[0, a], [1, b]]);
        g.fillRect(x, top, bw, bh + 40);
        g.fillStyle = 'rgba(255,255,255,0.4)';
        g.fillRect(x, top, 1.4, bh + 40);
        g.fillStyle = 'rgba(80,50,30,0.25)';
        g.fillRect(x + bw - 1.4, top, 1.4, bh + 40);
        g.fillStyle = '#b89a6c';
        g.fillRect(x - 1, top - 2.5, bw + 2, 3);
        // arched windows with shutters
        for (let wy = top + 10; wy < HZ + 6; wy += 22) {
          for (let wx = x + 7; wx < x + bw - 9; wx += 15) {
            g.fillStyle = '#4a3a2e';
            g.fillRect(wx, wy + 4, 7, 9);
            g.beginPath();
            g.arc(wx + 3.5, wy + 4, 3.5, Math.PI, 0);
            g.fill();
            g.fillStyle = r() < 0.5 ? '#3c8a5a' : '#4a7ab0';
            g.fillRect(wx - 3.2, wy + 2, 2.6, 11);
            g.fillRect(wx + 7.6, wy + 2, 2.6, 11);
            if (r() < 0.3) {
              g.fillStyle = r() < 0.5 ? '#ffffff' : '#e0605a';
              g.fillRect(wx - 6, wy - 3, 20, 0.6);
              g.fillRect(wx - 4, wy - 2, 4, 5);
              g.fillRect(wx + 3, wy - 2, 4, 6);
            }
          }
        }
        // balcony plants
        if (r() < 0.5) {
          g.fillStyle = '#2f7a42';
          for (let k = 0; k < 5; k++) {
            g.beginPath();
            g.arc(x + 6 + k * 4, top + 32, 3, 0, 6.3);
            g.fill();
          }
        }
        x += bw;
      }
      // warm haze at the bottom
      g.fillStyle = lin(g, 0, HZ - 20, 0, HZ + 30, [[0, 'rgba(255,240,210,0)'], [1, 'rgba(255,236,200,0.5)']]);
      g.fillRect(0, HZ - 20, w, 50);
    });
    // the market stalls
    this.stalls = layer((g, w) => {
      const awnings = [['#d83a3a', '#ffffff'], ['#2a9a52', '#ffffff'], ['#2a6ad8', '#ffffff'], ['#ff9b2a', '#fff4d0']];
      const fruit = ['#ff7a1a', '#e82a2a', '#7a2a9a', '#ffe066', '#4ab83a', '#ff5a8a'];
      for (let i = 0; i < 7; i++) {
        const x = i * 88 - 6;
        const [a, b] = awnings[i % awnings.length];
        // counter + back wall
        g.fillStyle = lin(g, 0, 150, 0, 204, [[0, '#8a5a30'], [1, '#5a3a1e']]);
        g.fillRect(x, 150, 82, 56);
        g.fillStyle = 'rgba(0,0,0,0.38)';
        g.fillRect(x + 4, 156, 74, 34);
        // awning
        const aw = 82;
        for (let s = 0; s < aw; s += 7) {
          g.fillStyle = (s / 7) % 2 ? a : b;
          g.beginPath();
          g.moveTo(x + s, 128);
          g.lineTo(x + s + 7, 128);
          g.lineTo(x + s + 8.5, 148);
          g.lineTo(x + s - 1.5, 148);
          g.closePath();
          g.fill();
          g.beginPath();
          g.arc(x + s + 3.5, 148, 4.5, 0, Math.PI);
          g.fill();
        }
        g.fillStyle = lin(g, 0, 126, 0, 140, [[0, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]);
        g.fillRect(x, 126, aw, 14);
        // crates of produce
        for (let c = 0; c < 3; c++) {
          const cx = x + 6 + c * 26;
          g.fillStyle = lin(g, 0, 186, 0, 202, [[0, '#c08a50'], [1, '#8a5c30']]);
          g.fillRect(cx, 188, 22, 14);
          g.fillStyle = 'rgba(0,0,0,0.3)';
          g.fillRect(cx, 195, 22, 0.8);
          const col = fruit[(i * 3 + c) % fruit.length];
          for (let k = 0; k < 14; k++) {
            const fx = cx + 2 + (k % 7) * 3, fy = 186 + Math.floor(k / 7) * 3 - (k % 2);
            g.fillStyle = col;
            g.beginPath();
            g.arc(fx, fy, 1.9, 0, 6.3);
            g.fill();
            g.fillStyle = 'rgba(255,255,255,0.5)';
            g.fillRect(fx - 0.9, fy - 1, 0.8, 0.8);
          }
        }
        // price sign
        g.fillStyle = '#fff6e0';
        g.fillRect(x + 62, 168, 16, 10);
        g.fillStyle = '#3a2a1a';
        g.fillRect(x + 64, 171, 12, 0.8);
        g.fillRect(x + 64, 174, 8, 0.8);
      }
    });
    this.ground = layer((g, w) => {
      g.fillStyle = lin(g, 0, 205, 0, H, [[0, '#cdb9a0'], [0.25, '#c2ac90'], [1, '#8f7a64']]);
      g.fillRect(0, 205, w, H - 205);
      // cobble courses
      for (let row = 0, y = 205; y < H; row++) {
        const rh = 5 + row * 1.7;
        g.fillStyle = 'rgba(70,50,36,0.35)';
        g.fillRect(0, y, w, 0.6);
        const cw = 11 + row * 3.4;
        for (let x = -(row % 2) * cw * 0.5; x < w; x += cw) {
          g.fillRect(x, y, 0.5, rh);
          if (r() < 0.2) {
            g.fillStyle = 'rgba(255,240,210,0.12)';
            g.fillRect(x + 1, y + 1, cw - 2, rh - 2);
            g.fillStyle = 'rgba(70,50,36,0.35)';
          }
        }
        y += rh;
      }
      this.cob ||= grainTile(3, 44, 'rgba(60,40,30,0.4)', 'rgba(255,240,220,0.3)', 0.7);
      grain(g, this.cob, 0, 205, w, H - 205, 0.5);
      g.fillStyle = 'rgba(70,50,36,0.5)';
      g.fillRect(0, 205, w, 1.4);
      // awning shadows falling across the street
      for (let x = -40; x < w; x += 88) {
        g.fillStyle = 'rgba(40,30,50,0.14)';
        g.beginPath();
        g.moveTo(x + 10, 206);
        g.lineTo(x + 76, 206);
        g.lineTo(x + 130, H);
        g.lineTo(x + 40, H);
        g.fill();
      }
      g.fillStyle = lin(g, 0, H - 38, 0, H, [[0, 'rgba(30,20,40,0)'], [1, 'rgba(30,20,40,0.4)']]);
      g.fillRect(0, H - 38, w, 38);
    });
    this.birds = Array.from({ length: 5 }, (_, i) => ({ x: r() * W, y: 30 + r() * 60, v: 0.3 + r() * 0.4, p: r() * 6.3, i }));
    this.motes = Array.from({ length: 36 }, () => ({ x: r() * W, y: r() * H, s: 0.3 + r() * 0.7, v: 0.05 + r() * 0.2, p: r() * 6.3 }));
  },
  draw(g, t, camX) {
    g.imageSmoothingEnabled = true;
    put(g, this.sky, camX, 0.03);
    // clouds
    for (const c of this.clouds) {
      const x = ((c.x + t * c.v) % (W + 160)) - 80 + camX * 0.97;
      g.fillStyle = lin(g, 0, c.y - 8 * c.s, 0, c.y + 8 * c.s, [[0, 'rgba(255,255,255,0.97)'], [1, 'rgba(210,230,250,0.9)']]);
      for (const [dx, dy, rx, ry] of [[0, 0, 26, 7], [-16, 2, 16, 5], [18, 2, 18, 5], [-4, -4, 14, 6], [10, -3, 11, 5]]) {
        g.beginPath();
        g.ellipse(x + dx * c.s, c.y + dy * c.s, rx * c.s, ry * c.s, 0, 0, 6.3);
        g.fill();
      }
    }
    put(g, this.far, camX, 0.1);
    put(g, this.stalls, camX, 0.25);
    // string lights with a warm glow
    for (let row = 0; row < 2; row++) {
      const base = 112 + row * 7;
      g.strokeStyle = 'rgba(50,36,26,0.7)';
      g.lineWidth = 0.5;
      g.beginPath();
      for (let x = -10; x <= W + 10; x += 6) {
        const y = base + Math.sin((x + row * 30) * 0.045) * 5;
        if (x === -10) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
      for (let x = 4 + row * 12; x < W; x += 24) {
        const y = base + Math.sin((x + row * 30) * 0.045) * 5;
        const on = Math.floor(t / 50 + x * 0.3) % 9 !== 0;
        if (on) bloom(g, x, y + 2, 6, '#ffe39a', 0.6);
        g.fillStyle = on ? '#fff4c8' : '#8a7a50';
        g.beginPath();
        g.arc(x, y + 1.6, 1.2, 0, 6.3);
        g.fill();
      }
    }
    put(g, this.ground, camX, 0.3);
    // god rays through the street
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const x0 = 20 + i * 120 + Math.sin(t * 0.004 + i) * 10;
      g.fillStyle = lin(g, x0, 0, x0 + 60, H, [[0, 'rgba(255,240,200,0.16)'], [1, 'rgba(255,240,200,0)']]);
      g.beginPath();
      g.moveTo(x0, 0);
      g.lineTo(x0 + 26, 0);
      g.lineTo(x0 + 120, H);
      g.lineTo(x0 + 50, H);
      g.fill();
    }
    for (const m of this.motes) {
      const y = (m.y - t * m.v + H * 8) % H;
      const x = (m.x + Math.sin(t * 0.012 + m.p) * 8 + W * 4) % W;
      g.fillStyle = `rgba(255,244,210,${0.25 + 0.35 * Math.sin(t * 0.03 + m.p) ** 2})`;
      g.beginPath();
      g.arc(x, y, m.s, 0, 6.3);
      g.fill();
    }
    g.restore();
    // pigeons
    for (const b of this.birds) {
      const x = ((b.x + t * b.v) % (W + 60)) - 30;
      const y = b.y + Math.sin(t * 0.03 + b.p) * 6;
      const f = Math.sin(t * 0.25 + b.p) * 2.2;
      g.strokeStyle = '#4a4a5a';
      g.lineWidth = 0.9;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x - 4, y - f * 0.4);
      g.quadraticCurveTo(x - 2, y - 2 - f, x, y);
      g.quadraticCurveTo(x + 2, y - 2 - f, x + 4, y - f * 0.4);
      g.stroke();
    }
  },
};

export const ARENAS = [BEACH, ROOFTOP, STADIUM, SHUK];

/** Build static layers on first use. */
export function getArena(id) {
  const a = ARENAS.find((x) => x.id === id) || ARENAS[0];
  if (!a.built) {
    a.build();
    a.built = true;
  }
  return a;
}

/** Draw an arena. camX = world x of the left edge of the view (for parallax). */
export function drawArena(g, arena, t, camX = 0, dim = 0) {
  arena.draw(g, t, camX);
  if (dim > 0) {
    g.fillStyle = `rgba(0, 0, 0, ${dim})`;
    g.fillRect(camX - PAD, 0, W + PAD * 2, H);
  }
}
export { lerp };
