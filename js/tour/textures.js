// Procedural canvas textures for the village. Everything is painted here; no image files.
import * as THREE from "three";

const cache = new Map();

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Small value-noise with fbm, good enough for plaster and earth.
function makeNoise(seed) {
  const r = rng(seed);
  const P = new Float32Array(256 * 256).map(() => r());
  const at = (x, y) => P[((y & 255) << 8) | (x & 255)];
  const smooth = (t) => t * t * (3 - 2 * t);
  const n = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  return (x, y, oct = 4) => {
    let v = 0, amp = 0.5, f = 1;
    for (let i = 0; i < oct; i++) { v += n(x * f, y * f) * amp; amp *= 0.5; f *= 2; }
    return v;
  };
}

function canvas(w, h = w) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return [c, c.getContext("2d")];
}

function toTex(c, { repeat = [1, 1], srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Fill a canvas with base colour modulated by fbm, tileable enough at these sizes.
function noiseFill(ctx, w, h, seed, base, amt, scale = 8) {
  const noise = makeNoise(seed);
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = noise((x / w) * scale, (y / h) * scale, 5) - 0.5;
    const i = (y * w + x) * 4;
    img.data[i] = base[0] + v * amt;
    img.data[i + 1] = base[1] + v * amt;
    img.data[i + 2] = base[2] + v * amt * 0.9;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function memo(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

/* ---------- earth ---------- */
export const ground = () => memo("ground", () => {
  const S = 512, [c, x] = canvas(S);
  noiseFill(x, S, S, 3, [92, 70, 50], 70, 6);
  const r = rng(5);
  for (let i = 0; i < 2600; i++) { // grit and pebbles
    x.fillStyle = r() > 0.5 ? "rgba(30,20,12,0.35)" : "rgba(170,140,105,0.3)";
    const s = r() * 2.5 + 0.5;
    x.fillRect(r() * S, r() * S, s, s);
  }
  x.strokeStyle = "rgba(190,160,100,0.25)"; // stray straw
  for (let i = 0; i < 140; i++) {
    const px = r() * S, py = r() * S, a = r() * Math.PI, l = 6 + r() * 14;
    x.lineWidth = 0.8;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  return toTex(c, { repeat: [40, 40] });
});

/* ---------- mud plaster wall with geru band and white mandana ---------- */
export const mudWall = (variant = 0) => memo("wall" + variant, () => {
  const S = 512, [c, x] = canvas(S);
  const bases = [[184, 132, 82], [196, 150, 98], [226, 220, 204], [170, 118, 74]];
  noiseFill(x, S, S, 11 + variant, bases[variant], variant === 2 ? 26 : 46, 5);
  const r = rng(20 + variant);
  // hand-smoothed swirls
  for (let i = 0; i < 70; i++) {
    x.strokeStyle = r() > 0.5 ? "rgba(255,240,210,0.07)" : "rgba(60,30,10,0.08)";
    x.lineWidth = 6 + r() * 10;
    x.beginPath();
    x.arc(r() * S, r() * S * 0.8, 12 + r() * 30, r() * 6, r() * 6 + 2);
    x.stroke();
  }
  // hairline cracks
  x.strokeStyle = "rgba(40,22,10,0.45)";
  x.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    let px = r() * S, py = r() * S * 0.75;
    x.beginPath(); x.moveTo(px, py);
    for (let k = 0; k < 10; k++) { px += (r() - 0.5) * 14; py += r() * 10; x.lineTo(px, py); }
    x.stroke();
  }
  // geru (red ochre) dado band along the bottom, with white rice-paste mandana
  const bandTop = S * 0.8;
  const g = x.createLinearGradient(0, bandTop, 0, S);
  g.addColorStop(0, "#8c3220"); g.addColorStop(1, "#6e2416");
  x.fillStyle = g;
  x.fillRect(0, bandTop, S, S - bandTop);
  x.fillStyle = "rgba(245,238,225,0.92)";
  for (let i = 0; i < 16; i++) { // triangles
    const px = (i + 0.5) * (S / 16);
    x.beginPath(); x.moveTo(px - 10, bandTop + 4); x.lineTo(px, bandTop + 22); x.lineTo(px + 10, bandTop + 4); x.closePath(); x.fill();
  }
  for (let i = 0; i < 32; i++) { x.beginPath(); x.arc((i + 0.5) * (S / 32), bandTop + 34, 2.6, 0, 7); x.fill(); }
  x.strokeStyle = "rgba(245,238,225,0.9)"; x.lineWidth = 2;
  x.beginPath(); x.moveTo(0, bandTop + 2); x.lineTo(S, bandTop + 2); x.stroke();
  for (let i = 0; i < 8; i++) { // little flower motifs
    const cx = (i + 0.5) * (S / 8), cy = bandTop + 66;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      x.beginPath(); x.ellipse(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, 5, 2.4, a, 0, 7); x.fill();
    }
  }
  return toTex(c);
});

/* ---------- thatch ---------- */
export const thatch = () => memo("thatch", () => {
  const S = 512, [c, x] = canvas(S);
  x.fillStyle = "#4a3a22"; x.fillRect(0, 0, S, S);
  const r = rng(7);
  for (let i = 0; i < 5000; i++) {
    const px = r() * S, py = r() * S, l = 20 + r() * 50;
    const v = 90 + r() * 90 | 0;
    x.strokeStyle = `rgba(${v + 30},${v + 10},${v - 30},${0.5 + r() * 0.5})`;
    x.lineWidth = 0.6 + r() * 1.4;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 6, py + l); x.stroke();
  }
  for (let y = 0; y < S; y += 64) { // bundle lines
    x.fillStyle = "rgba(20,12,4,0.35)"; x.fillRect(0, y, S, 4);
  }
  return toTex(c);
});

/* ---------- khaprail clay roof tiles ---------- */
export const tiles = () => memo("tiles", () => {
  const S = 512, [c, x] = canvas(S);
  x.fillStyle = "#3a160c"; x.fillRect(0, 0, S, S);
  const r = rng(9);
  const cols = 16, rows = 12, cw = S / cols, rh = S / rows;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const px = i * cw + (j % 2) * cw * 0.5, py = j * rh;
    const g = x.createLinearGradient(px, 0, px + cw, 0);
    const k = 0.75 + r() * 0.35;
    g.addColorStop(0, `rgb(${70 * k | 0},${28 * k | 0},${16 * k | 0})`);
    g.addColorStop(0.45, `rgb(${170 * k | 0},${80 * k | 0},${46 * k | 0})`);
    g.addColorStop(1, `rgb(${70 * k | 0},${28 * k | 0},${16 * k | 0})`);
    x.fillStyle = g;
    x.beginPath(); x.roundRect(px + 1, py + 1, cw - 2, rh * 1.15, [cw / 2, cw / 2, 3, 3]); x.fill();
    if (r() < 0.25) { x.fillStyle = "rgba(40,50,20,0.35)"; x.fillRect(px + 3, py + rh * 0.6, cw - 6, rh * 0.4); } // moss
  }
  return toTex(c);
});

/* ---------- planks ---------- */
export const wood = (tint = [110, 72, 40]) => memo("wood" + tint, () => {
  const S = 256, [c, x] = canvas(S);
  noiseFill(x, S, S, 31, tint, 50, 3);
  const r = rng(13);
  for (let i = 0; i < 160; i++) {
    x.strokeStyle = `rgba(30,15,5,${0.1 + r() * 0.2})`;
    x.lineWidth = 0.6 + r();
    const px = r() * S;
    x.beginPath(); x.moveTo(px, 0); x.bezierCurveTo(px + 6, S * 0.3, px - 6, S * 0.6, px + 3, S); x.stroke();
  }
  for (let i = 0; i < 5; i++) { x.fillStyle = "rgba(15,8,3,0.6)"; x.fillRect((i * S) / 5, 0, 2, S); }
  return toTex(c);
});

export const paintedDoor = (hex) => memo("door" + hex, () => {
  const S = 256, [c, x] = canvas(S, S * 2);
  x.fillStyle = hex; x.fillRect(0, 0, S, S * 2);
  const r = rng(17);
  for (let i = 0; i < 3000; i++) { // chipped paint
    x.fillStyle = r() > 0.6 ? "rgba(90,60,30,0.5)" : "rgba(255,255,255,0.05)";
    x.fillRect(r() * S, r() * S * 2, 1 + r() * 3, 1 + r() * 2);
  }
  x.fillStyle = "rgba(0,0,0,0.5)";
  x.fillRect(S / 2 - 2, 0, 4, S * 2);
  x.strokeStyle = "rgba(0,0,0,0.35)"; x.lineWidth = 6;
  for (const y of [0.25, 0.75, 1.25, 1.75]) { x.strokeRect(14, y * S - 50, S / 2 - 28, 100); x.strokeRect(S / 2 + 14, y * S - 50, S / 2 - 28, 100); }
  x.fillStyle = "#c8a040"; // iron rings and studs
  for (let i = 0; i < 18; i++) { x.beginPath(); x.arc(30 + (i % 3) * 30, 40 + Math.floor(i / 3) * 80, 4, 0, 7); x.fill(); x.beginPath(); x.arc(S - 30 - (i % 3) * 30, 40 + Math.floor(i / 3) * 80, 4, 0, 7); x.fill(); }
  return toTex(c, { aniso: 4 });
});

/* ---------- lime-wash for temple ---------- */
export const lime = () => memo("lime", () => {
  const S = 256, [c, x] = canvas(S);
  noiseFill(x, S, S, 41, [232, 226, 214], 22, 4);
  return toTex(c);
});

/* ---------- radial glow (additive decals and sprites) ---------- */
export const glow = () => memo("glow", () => {
  const S = 128, [c, x] = canvas(S);
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.2, "rgba(255,255,255,0.55)");
  g.addColorStop(0.5, "rgba(255,255,255,0.15)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  return t;
});

/* ---------- leaf cluster card (alpha) ---------- */
export const leaves = (hue = 0) => memo("leaves" + hue, () => {
  const S = 256, [c, x] = canvas(S);
  const r = rng(23 + hue);
  for (let i = 0; i < 320; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * S * 0.44;
    const px = S / 2 + Math.cos(a) * d, py = S / 2 + Math.sin(a) * d;
    const v = 40 + r() * 60 | 0;
    x.fillStyle = hue ? `rgb(${v * 0.55 | 0},${v + 20},${v * 0.4 | 0})` : `rgb(${v * 0.5 | 0},${v + 10},${v * 0.35 | 0})`;
    x.beginPath(); x.ellipse(px, py, 4 + r() * 6, 2 + r() * 2.5, r() * 6, 0, 7); x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
});

/* ---------- woven charpai rope ---------- */
export const weave = () => memo("weave", () => {
  const S = 128, [c, x] = canvas(S);
  x.fillStyle = "#3a2a18"; x.fillRect(0, 0, S, S);
  for (let i = 0; i < S; i += 8) for (let j = 0; j < S; j += 8) {
    x.fillStyle = (i / 8 + j / 8) % 2 ? "#c8b080" : "#a89060";
    x.fillRect(i + 1, j + 1, 6, 6);
  }
  return toTex(c, { repeat: [4, 8] });
});

/* ---------- cloth stripes for stall canopies ---------- */
export const cloth = (a, b) => memo("cloth" + a + b, () => {
  const S = 256, [c, x] = canvas(S);
  for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? b : a; x.fillRect((i * S) / 8, 0, S / 8, S); }
  const r = rng(29);
  for (let i = 0; i < 2000; i++) { x.fillStyle = "rgba(0,0,0,0.06)"; x.fillRect(r() * S, r() * S, 2, 1); }
  return toTex(c);
});

/* ---------- rangoli: lotus mandala in powder ---------- */
export const rangoli = (seed = 1) => memo("rangoli" + seed, () => {
  const S = 1024, [c, x] = canvas(S);
  const r = rng(seed * 101);
  x.translate(S / 2, S / 2);
  const ring = (n, fn) => { for (let i = 0; i < n; i++) { x.save(); x.rotate((i / n) * Math.PI * 2); fn(i); x.restore(); } };
  const petal = (r0, r1, w, col) => {
    x.fillStyle = col;
    x.beginPath(); x.moveTo(r0, 0); x.quadraticCurveTo((r0 + r1) / 2, -w, r1, 0); x.quadraticCurveTo((r0 + r1) / 2, w, r0, 0); x.fill();
  };
  const R = S / 2;
  x.fillStyle = "#f4ead8"; x.beginPath(); x.arc(0, 0, R * 0.97, 0, 7); x.fill(); // rice outline
  x.fillStyle = "#1a7a7a"; x.beginPath(); x.arc(0, 0, R * 0.94, 0, 7); x.fill();
  x.fillStyle = "#f4ead8"; x.beginPath(); x.arc(0, 0, R * 0.86, 0, 7); x.fill();
  x.fillStyle = "#c8203a"; x.beginPath(); x.arc(0, 0, R * 0.84, 0, 7); x.fill();
  ring(24, () => petal(R * 0.6, R * 0.84, R * 0.06, "#f4a020"));
  ring(24, (i) => { x.rotate(Math.PI / 24); petal(R * 0.66, R * 0.8, R * 0.025, "#f4ead8"); });
  x.fillStyle = "#3a2a8a"; x.beginPath(); x.arc(0, 0, R * 0.6, 0, 7); x.fill();
  ring(12, () => petal(R * 0.28, R * 0.6, R * 0.1, "#d6247a"));
  ring(12, () => { x.rotate(Math.PI / 12); petal(R * 0.32, R * 0.56, R * 0.07, "#58a83a"); });
  ring(12, () => petal(R * 0.32, R * 0.54, R * 0.035, "#ffd8ea"));
  x.fillStyle = "#f4a020"; x.beginPath(); x.arc(0, 0, R * 0.28, 0, 7); x.fill();
  ring(8, () => petal(R * 0.06, R * 0.27, R * 0.07, "#e0402a"));
  x.fillStyle = "#f4ead8"; x.beginPath(); x.arc(0, 0, R * 0.07, 0, 7); x.fill();
  ring(48, () => { x.fillStyle = "#f4ead8"; x.beginPath(); x.arc(R * 0.9, 0, R * 0.012, 0, 7); x.fill(); });
  // powder grain and soft broken edge
  x.setTransform(1, 0, 0, 1, 0, 0);
  const img = x.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const k = 0.82 + r() * 0.3;
    img.data[i] *= k; img.data[i + 1] *= k; img.data[i + 2] *= k;
  }
  x.putImageData(img, 0, 0);
  x.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 5000; i++) {
    const a = r() * Math.PI * 2, d = R * (0.955 + r() * 0.05);
    x.fillRect(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
});

/* ---------- Lakshmi footprints (alpana) ---------- */
export const footprints = () => memo("feet", () => {
  const W = 128, H = 256, [c, x] = canvas(W, H);
  x.fillStyle = "rgba(246,240,228,0.95)";
  const foot = (fx, fy, flip) => {
    x.save(); x.translate(fx, fy); x.scale(flip, 1);
    x.beginPath(); x.ellipse(0, 18, 13, 26, 0, 0, 7); x.fill();
    x.beginPath(); x.ellipse(2, -16, 10, 11, 0, 0, 7); x.fill();
    [[-8, -34, 4], [-2, -38, 4.4], [4, -37, 3.8], [9, -33, 3.4], [12, -27, 3]].forEach(([a, b, s]) => { x.beginPath(); x.arc(a, b, s, 0, 7); x.fill(); });
    x.restore();
  };
  foot(36, 170, 1); foot(92, 90, -1);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
});

/* ---------- night sky tree-line silhouette card ---------- */
export const treeline = () => memo("treeline", () => {
  const W = 1024, H = 256, [c, x] = canvas(W, H);
  const r = rng(51);
  x.fillStyle = "#05060c";
  for (let i = 0; i < 40; i++) {
    const px = r() * W, py = H * (0.35 + r() * 0.35), rr = 30 + r() * 60;
    x.beginPath(); x.arc(px, py, rr, 0, 7); x.fill();
  }
  x.fillRect(0, H * 0.6, W, H * 0.4);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
});

// Paint one of the 2D stall painters (js/goods.js) into a texture for the haat.
export const goods = (name, w = 512, h = 400) => memo("goods" + name, () => {
  const [c, x] = canvas(w, h);
  window.Deepa.indoor = true; // deity and picture backdrops stay cloth, not tarp
  window.Deepa.goods[name](x, w, h, 0.5, 1);
  window.Deepa.indoor = false;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
});

export { rng };

/* ---------- plain plaster for wall tops and plinths ---------- */
export const plaster = (variant = 0) => memo("plaster" + variant, () => {
  const S = 256, [c, x] = canvas(S);
  noiseFill(x, S, S, 61 + variant, variant === 2 ? [226, 220, 204] : [176, 128, 80], 40, 4);
  return toTex(c);
});

/* ---------- warm doorway: lamplit room seen through an open door ---------- */
export const doorway = () => memo("doorway", () => {
  const W = 128, H = 256, [c, x] = canvas(W, H);
  const g = x.createRadialGradient(W * 0.55, H * 0.7, 4, W * 0.5, H * 0.6, H * 0.6);
  g.addColorStop(0, "#ffcf80"); g.addColorStop(0.25, "#c86a28"); g.addColorStop(0.7, "#3a1608"); g.addColorStop(1, "#140604");
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = "rgba(20,8,4,0.6)"; x.fillRect(W * 0.1, H * 0.45, W * 0.3, H * 0.4); // furniture silhouette
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
});

/* ---------- village haat materials ---------- */
// coarse jute sacking (bori / taat)
export const jute = () => memo("jute", () => {
  const S = 256, [c, x] = canvas(S);
  x.fillStyle = "#7a5f3a"; x.fillRect(0, 0, S, S);
  const r = rng(71);
  for (let i = 0; i < S; i += 4) {
    x.fillStyle = `rgba(${150 + r() * 40 | 0},${115 + r() * 30 | 0},${70 + r() * 20 | 0},0.8)`;
    x.fillRect(0, i, S, 2);
    x.fillStyle = `rgba(${130 + r() * 40 | 0},${100 + r() * 30 | 0},${60 + r() * 20 | 0},0.6)`;
    x.fillRect(i, 0, 2, S);
  }
  for (let i = 0; i < 900; i++) { x.fillStyle = r() > 0.5 ? "rgba(40,25,10,0.25)" : "rgba(220,190,140,0.2)"; x.fillRect(r() * S, r() * S, 1 + r() * 3, 1); }
  return toTex(c, { repeat: [2, 2] });
});

// plastic tarpaulin with creases, sun-faded patches and stitched hems
export const tarp = (hex) => memo("tarp" + hex, () => {
  const S = 512, [c, x] = canvas(S);
  x.fillStyle = hex; x.fillRect(0, 0, S, S);
  const r = rng(hex.length * 13 + parseInt(hex.slice(1), 16) % 97);
  for (let i = 0; i < 18; i++) { // faded patches
    const px = r() * S, py = r() * S, rr = 40 + r() * 120;
    const g = x.createRadialGradient(px, py, 0, px, py, rr);
    g.addColorStop(0, "rgba(255,255,255,0.14)"); g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(px - rr, py - rr, rr * 2, rr * 2);
  }
  for (let i = 0; i < 70; i++) { // creases: a light ridge beside a dark fold
    let px = r() * S, py = r() * S;
    const a = r() * Math.PI, l = 30 + r() * 160;
    x.lineWidth = 1 + r() * 2;
    x.strokeStyle = "rgba(255,255,255,0.18)";
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
    x.strokeStyle = "rgba(0,0,0,0.22)";
    x.beginPath(); x.moveTo(px + 2, py + 2); x.lineTo(px + 2 + Math.cos(a) * l, py + 2 + Math.sin(a) * l); x.stroke();
  }
  x.fillStyle = "rgba(255,255,255,0.35)"; // hems and eyelets
  for (const e of [6, S - 12]) { x.fillRect(0, e, S, 6); x.fillRect(e, 0, 6, S); }
  x.fillStyle = "#c8c8c0";
  for (let i = 16; i < S; i += 64) for (const e of [9, S - 9]) { x.beginPath(); x.arc(i, e, 4, 0, 7); x.fill(); x.beginPath(); x.arc(e, i, 4, 0, 7); x.fill(); }
  return toTex(c);
});

// bamboo with nodes every half metre
export const bamboo = () => memo("bamboo", () => {
  const W = 64, H = 256, [c, x] = canvas(W, H);
  const g = x.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, "#6a5a2a"); g.addColorStop(0.4, "#c8b070"); g.addColorStop(1, "#6a5a2a");
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (const y of [40, 168]) { x.fillStyle = "rgba(60,40,10,0.7)"; x.fillRect(0, y, W, 5); x.fillStyle = "rgba(240,220,160,0.4)"; x.fillRect(0, y + 5, W, 2); }
  const r = rng(77);
  for (let i = 0; i < 200; i++) { x.fillStyle = "rgba(60,40,10,0.15)"; x.fillRect(r() * W, r() * H, 1, 6 + r() * 20); }
  return toTex(c, { repeat: [1, 3] });
});

// cane basket weave
export const cane = () => memo("cane", () => {
  const S = 128, [c, x] = canvas(S);
  x.fillStyle = "#5a3e1e"; x.fillRect(0, 0, S, S);
  for (let j = 0; j < S; j += 8) for (let i = 0; i < S; i += 16) {
    x.fillStyle = (j / 8) % 2 ? "#b08a50" : "#9a7440";
    x.fillRect(i + ((j / 8) % 2) * 8, j + 1, 14, 6);
  }
  return toTex(c, { repeat: [3, 2] });
});

// a cardboard sign lettered in marker
export const sign = (main, sub = "") => memo("sign" + main + sub, () => {
  const W = 512, H = 300, [c, x] = canvas(W, H);
  x.fillStyle = "#b8955e"; x.fillRect(0, 0, W, H);
  const r = rng(main.length * 31 + sub.length);
  for (let i = 0; i < 1600; i++) { x.fillStyle = r() > 0.5 ? "rgba(90,60,25,0.12)" : "rgba(230,200,150,0.12)"; x.fillRect(r() * W, r() * H, 2, 2); }
  x.strokeStyle = "rgba(90,60,25,0.25)"; x.lineWidth = 2; // corrugation
  for (let i = 0; i < W; i += 14) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); }
  // torn corner and tape
  x.fillStyle = "#3a2a1a"; x.beginPath(); x.moveTo(W, 0); x.lineTo(W - 40, 0); x.lineTo(W, 30); x.fill();
  x.fillStyle = "rgba(240,235,210,0.7)"; x.fillRect(18, 10, 70, 22);
  x.textAlign = "center"; x.textBaseline = "middle";
  x.save(); x.translate(W / 2, H * 0.42); x.rotate(-0.04);
  x.fillStyle = "#a01010"; x.font = "700 92px Kalam, 'Tiro Devanagari Hindi', cursive";
  x.fillText(main, 0, 0, W - 40);
  x.restore();
  if (sub) { x.fillStyle = "#14140f"; x.font = "700 56px Kalam, cursive"; x.fillText(sub, W / 2 + 8, H * 0.78, W - 50); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
});

/* ---------- market street ---------- */
// kharanja: a village road of bricks laid on edge
export const kharanja = () => memo("kharanja", () => {
  const S = 512, [c, x] = canvas(S);
  x.fillStyle = "#3a2a20"; x.fillRect(0, 0, S, S);
  const r = rng(91);
  const bw = 64, bh = 22;
  for (let row = 0; row < S / bh + 1; row++) for (let col = -1; col < S / bw + 1; col++) {
    const px = col * bw + (row % 2) * bw / 2, py = row * bh;
    const k = 0.7 + r() * 0.35;
    x.fillStyle = `rgb(${135 * k | 0},${70 * k | 0},${48 * k | 0})`;
    x.fillRect(px + 2, py + 2, bw - 4, bh - 4);
    if (r() < 0.3) { x.fillStyle = "rgba(0,0,0,0.25)"; x.fillRect(px + 4 + r() * 30, py + 4, 8 + r() * 14, bh - 8); } // wear
  }
  for (let i = 0; i < 1500; i++) { x.fillStyle = "rgba(170,140,100,0.15)"; x.fillRect(r() * S, r() * S, 2, 2); } // dust
  return toTex(c, { repeat: [10, 2] });
});

export const tin = () => memo("tin", () => {
  const S = 256, [c, x] = canvas(S);
  for (let i = 0; i < S; i += 16) {
    const g = x.createLinearGradient(i, 0, i + 16, 0);
    g.addColorStop(0, "#5a5e62"); g.addColorStop(0.5, "#b8bcc0"); g.addColorStop(1, "#5a5e62");
    x.fillStyle = g; x.fillRect(i, 0, 16, S);
  }
  const r = rng(93);
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(120,60,20,${0.1 + r() * 0.25})`; x.beginPath(); x.ellipse(r() * S, r() * S, 6 + r() * 20, 4 + r() * 12, 0, 0, 7); x.fill(); } // rust
  return toTex(c, { repeat: [3, 1] });
});

// a hand-painted tin signboard
export const shopSign = (hi, en, bg = "#c8102a", fg = "#fff3c0") => memo("shop" + hi + en + bg, () => {
  const W = 1024, H = 220, [c, x] = canvas(W, H);
  x.fillStyle = bg; x.fillRect(0, 0, W, H);
  x.strokeStyle = fg; x.lineWidth = 8; x.strokeRect(14, 14, W - 28, H - 28);
  const r = rng(hi.length * 17);
  for (let i = 0; i < 300; i++) { x.fillStyle = "rgba(0,0,0,0.12)"; x.fillRect(r() * W, r() * H, 3 + r() * 6, 2); } // weathering
  x.textAlign = "center"; x.textBaseline = "middle";
  x.fillStyle = "rgba(0,0,0,0.35)";
  x.font = "120px 'Tiro Devanagari Hindi', serif";
  x.fillText(hi, W / 2 + 4, H * 0.44 + 4, W - 80);
  x.fillStyle = fg;
  x.fillText(hi, W / 2, H * 0.44, W - 80);
  x.font = "700 36px Manrope, sans-serif";
  x.fillText(en, W / 2, H * 0.84, W - 80);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
});

// sari fabric: body colour, a woven motif and a zari border
export const sari = (body, border) => memo("sari" + body + border, () => {
  const W = 128, H = 256, [c, x] = canvas(W, H);
  x.fillStyle = body; x.fillRect(0, 0, W, H);
  x.fillStyle = "rgba(255,230,150,0.55)";
  for (let y = 10; y < H - 40; y += 22) for (let i = 8 + ((y / 22) % 2) * 11; i < W; i += 22) { x.beginPath(); x.arc(i, y, 3, 0, 7); x.fill(); }
  x.fillStyle = border; x.fillRect(0, H - 40, W, 40);
  x.fillStyle = "#e8c050"; x.fillRect(0, H - 44, W, 4); x.fillRect(0, H - 8, W, 3);
  for (let i = 0; i < W; i += 16) { x.beginPath(); x.moveTo(i, H - 36); x.lineTo(i + 8, H - 16); x.lineTo(i + 16, H - 36); x.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
});

/* ---------- rangoli designer: four traditional layouts in powder ---------- */
export const RANGOLI_PALETTES = {
  sindoor: { name: "Sindoor & Keshar", cols: ["#d8321f", "#f4a020", "#1aa37a", "#f3eadb", "#7a1010"] },
  morpankh: { name: "Morpankh Rang", cols: ["#1a8ad8", "#f4a020", "#7a3ad8", "#1aa37a", "#f3eadb"] },
  gulab: { name: "Gulab & Haldi", cols: ["#e0245e", "#ffd21a", "#ff7a10", "#f3eadb", "#8a1040"] },
  chandan: { name: "Chandan & Kumkum", cols: ["#8a1a1a", "#f6e6b8", "#c8701a", "#5a2a0a", "#f3eadb"] },
};
export const RANGOLI_STYLES = {
  padma: { name: "Padma (Sacred Lotus)", note: "Auspicious curved petals" },
  surya: { name: "Surya Chakra (Star)", note: "Radiant geometric points" },
  morpankh: { name: "Morpankh (Peacock)", note: "Sweeping folk curves" },
  ashtadal: { name: "Ashtadal Mandala", note: "Balanced octagram" },
};

export function paintRangoli(c, { style = "padma", palette = "sindoor", petals = 16, rings = 4, grain = true } = {}) {
  const S = c.width, x = c.getContext("2d"), R = S / 2;
  const P = RANGOLI_PALETTES[palette].cols;
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.clearRect(0, 0, S, S);
  x.translate(R, R);
  const around = (n, fn, off = 0) => { for (let i = 0; i < n; i++) { x.save(); x.rotate((i / n) * Math.PI * 2 + off); fn(i); x.restore(); } };
  const petal = (r0, r1, w, col, outline) => {
    x.beginPath(); x.moveTo(r0, 0); x.quadraticCurveTo((r0 + r1) / 2, -w, r1, 0); x.quadraticCurveTo((r0 + r1) / 2, w, r0, 0);
    x.fillStyle = col; x.fill();
    if (outline) { x.strokeStyle = outline; x.lineWidth = R * 0.008; x.stroke(); }
  };
  const disc = (r, col) => { x.fillStyle = col; x.beginPath(); x.arc(0, 0, r, 0, 7); x.fill(); };
  const dots = (n, r, rr, col, off = 0) => around(n, () => { x.fillStyle = col; x.beginPath(); x.arc(r, 0, rr, 0, 7); x.fill(); }, off);
  const white = "#f6efe2";
  const band = (R * 0.78) / rings;

  if (style === "padma") {
    // rings of lotus petals, each layer offset half a petal from the last
    for (let k = rings - 1; k >= 0; k--) {
      const r0 = R * 0.14 + k * band * 0.82, r1 = r0 + band * 1.25;
      const n = petals + k * Math.max(2, Math.round(petals / 4));
      const col = P[k % 3];
      around(n, () => petal(r0, r1, (Math.PI * r1) / n * 0.95, col, white), k % 2 ? Math.PI / n : 0);
      around(n, () => petal(r0 + band * 0.3, r1 - band * 0.25, (Math.PI * r1) / n * 0.3, P[(k + 1) % 3]), k % 2 ? Math.PI / n : 0);
      dots(n, r1 - band * 0.18, R * 0.012, white, k % 2 ? Math.PI / n : 0);
    }
    disc(R * 0.16, P[1]); disc(R * 0.1, white); disc(R * 0.06, P[0]);
    dots(petals * 2, R * 0.93, R * 0.03, P[1]);
    dots(petals * 2, R * 0.93, R * 0.012, white);
  } else if (style === "surya") {
    // a sun of long and short rays, rimmed with zigzags and dots
    for (let k = rings - 1; k >= 0; k--) {
      const r1 = R * 0.22 + (k + 1) * band * 0.9;
      const n = petals;
      around(n * 2, (i) => {
        const long = i % 2 === 0, w = (Math.PI * r1) / (n * 2) * 0.9;
        x.beginPath(); x.moveTo(R * 0.14, -w * 0.35); x.lineTo(long ? r1 : r1 * 0.78, 0); x.lineTo(R * 0.14, w * 0.35); x.closePath();
        x.fillStyle = long ? P[k % 4] : P[(k + 2) % 4]; x.fill();
        x.strokeStyle = white; x.lineWidth = R * 0.006; x.stroke();
      }, k * 0.1);
      x.strokeStyle = white; x.lineWidth = R * 0.012;
      x.beginPath();
      for (let i = 0; i <= n * 4; i++) { const a = (i / (n * 4)) * Math.PI * 2, rr = r1 * 0.55 + (i % 2 ? band * 0.15 : 0); x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      x.stroke();
    }
    disc(R * 0.17, P[1]); around(petals, () => petal(R * 0.03, R * 0.16, R * 0.03, P[0])); disc(R * 0.04, white);
    dots(petals * 2, R * 0.95, R * 0.022, P[1]);
  } else if (style === "morpankh") {
    // peacock feathers sweeping round, each with its eye
    for (let k = rings - 1; k >= 0; k--) {
      const r0 = R * 0.16 + k * band * 0.7, len = band * 1.6;
      const n = Math.max(6, Math.round(petals * (0.6 + k * 0.2)));
      around(n, () => {
        x.save(); x.translate(r0 + len * 0.55, 0); x.rotate(0.35);
        x.fillStyle = P[(k + 3) % 5];
        x.beginPath(); x.ellipse(0, 0, len * 0.55, len * 0.24, 0, 0, 7); x.fill();
        x.fillStyle = P[0]; x.beginPath(); x.ellipse(len * 0.15, 0, len * 0.3, len * 0.15, 0, 0, 7); x.fill();
        x.fillStyle = P[1]; x.beginPath(); x.ellipse(len * 0.2, 0, len * 0.16, len * 0.09, 0, 0, 7); x.fill();
        x.fillStyle = P[2]; x.beginPath(); x.ellipse(len * 0.22, 0, len * 0.07, len * 0.05, 0, 0, 7); x.fill();
        x.strokeStyle = white; x.lineWidth = R * 0.006;
        for (let f = -3; f <= 3; f++) { x.beginPath(); x.moveTo(-len * 0.5, 0); x.quadraticCurveTo(-len * 0.1, f * len * 0.06, len * 0.5, f * len * 0.04); x.stroke(); }
        x.restore();
      }, k * 0.3);
    }
    x.strokeStyle = P[1]; x.lineWidth = R * 0.02;
    around(petals, () => { x.beginPath(); x.moveTo(R * 0.05, 0); x.bezierCurveTo(R * 0.12, R * 0.08, R * 0.16, -R * 0.04, R * 0.2, R * 0.03); x.stroke(); });
    disc(R * 0.07, P[0]); disc(R * 0.035, white);
    dots(petals * 2, R * 0.95, R * 0.022, P[2]);
  } else {
    // ashtadal: eight petals inside an octagram, on a dotted grid of rings
    const n = 8;
    for (let k = rings - 1; k >= 0; k--) {
      const r = R * 0.3 + k * band * 0.75;
      x.save(); x.rotate((k % 2) * Math.PI / 8);
      for (const rot of [0, Math.PI / 4]) {
        x.save(); x.rotate(rot);
        x.fillStyle = P[(k + (rot ? 1 : 0)) % 4]; x.globalAlpha = 0.95;
        x.fillRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
        x.strokeStyle = white; x.lineWidth = R * 0.01; x.strokeRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
        x.restore();
      }
      x.restore();
      x.globalAlpha = 1;
      around(Math.max(8, petals), () => petal(r * 0.55, r * 1.0, r * 0.08, P[(k + 2) % 4], white), (k % 2) * Math.PI / Math.max(8, petals));
    }
    around(n, () => petal(R * 0.05, R * 0.26, R * 0.07, P[0], white));
    around(n, () => petal(R * 0.07, R * 0.2, R * 0.03, P[1]), Math.PI / 8);
    disc(R * 0.06, white); disc(R * 0.03, P[0]);
    dots(petals * 2, R * 0.95, R * 0.022, P[1]);
  }
  // powder grain and a softly broken edge
  if (grain) {
    x.setTransform(1, 0, 0, 1, 0, 0);
    const img = x.getImageData(0, 0, S, S), r = rng(Math.round(petals * 13 + rings * 7));
    for (let i = 0; i < img.data.length; i += 4) { if (!img.data[i + 3]) continue; const k = 0.84 + r() * 0.28; img.data[i] *= k; img.data[i + 1] *= k; img.data[i + 2] *= k; }
    x.putImageData(img, 0, 0);
    x.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 4000; i++) { const a = r() * Math.PI * 2, d = R * (0.96 + r() * 0.05); x.fillRect(R + Math.cos(a) * d, R + Math.sin(a) * d, 2, 2); }
    x.globalCompositeOperation = "source-over";
  }
}

export function rangoliTexture(opts) {
  const [c] = canvas(1024);
  paintRangoli(c, opts);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
