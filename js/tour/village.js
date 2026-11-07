// Builds the village: lanes, mud houses, courtyard, potter's yard, haat, banyan chaupal, temple, pond, rooftop.
import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import * as T from "./textures.js";
import { makePerson, Walker } from "./people.js";
import { reveal } from "./lights.js";

const UP = new THREE.Vector3(0, 1, 0);
const rand = (a, b) => a + Math.random() * (b - a);

export function buildVillage(scene, { lamps, sparks, quality }) {
  const colliders = []; // {minX,maxX,minZ,maxZ} or {x,z,r}
  const people = [];
  const walkers = [];
  const updaters = [];
  const marigolds = []; // [x,y,z,orange?]
  const mangoLeaves = []; // [x,y,z,rotY]
  const leafCards = []; // [x,y,z,s,hue]
  const api = {};

  /* ---------- materials ---------- */
  const M = {
    wall: [0, 1, 2, 3].map((v) => new THREE.MeshStandardMaterial({ map: T.mudWall(v), bumpMap: T.mudWall(v), bumpScale: 2.2, roughness: 0.95 })),
    top: [0, 2].map((v) => new THREE.MeshStandardMaterial({ map: T.plaster(v), bumpMap: T.plaster(v), bumpScale: 1.5, roughness: 0.95 })),
    thatch: new THREE.MeshStandardMaterial({ map: T.thatch(), bumpMap: T.thatch(), bumpScale: 4, roughness: 1, side: THREE.DoubleSide }),
    tiles: new THREE.MeshStandardMaterial({ map: T.tiles(), bumpMap: T.tiles(), bumpScale: 5, roughness: 0.8, side: THREE.DoubleSide }),
    wood: new THREE.MeshStandardMaterial({ map: T.wood(), bumpMap: T.wood(), bumpScale: 1.5, roughness: 0.85 }),
    darkWood: new THREE.MeshStandardMaterial({ map: T.wood([60, 40, 26]), roughness: 0.9 }),
    bark: new THREE.MeshStandardMaterial({ map: T.wood([70, 58, 46]), bumpMap: T.wood([70, 58, 46]), bumpScale: 4, roughness: 1 }),
    lime: new THREE.MeshStandardMaterial({ map: T.lime(), bumpMap: T.lime(), bumpScale: 1, roughness: 0.9 }),
    clay: new THREE.MeshStandardMaterial({ color: 0x8a4a2a, roughness: 0.9 }),
    unfired: new THREE.MeshStandardMaterial({ color: 0x8a8070, roughness: 1 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.6, metalness: 0.7 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc8962e, roughness: 0.35, metalness: 0.9 }),
    saffron: new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.8, side: THREE.DoubleSide, emissive: 0x401000 }),
    doorway: new THREE.MeshBasicMaterial({ map: T.doorway(), color: 0xbbbbbb }),
    window: new THREE.MeshBasicMaterial({ color: 0xffa050 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x0c0806, roughness: 1 }),
    straw: new THREE.MeshStandardMaterial({ map: T.thatch(), roughness: 1, color: 0xc8b080 }),
    dung: new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 1 }),
  };

  const ropeLine = new THREE.MeshStandardMaterial({ color: 0x8a7448, roughness: 1 });
  // shared flat-painted materials, one per colour and option set
  const pm = new Map();
  const paintM = (c, o = {}) => { const k = c + JSON.stringify(o); if (!pm.has(k)) pm.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o })); return pm.get(k); };

  /* ---------- helpers ---------- */
  function worldUVBox(w, h, d) {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      if (f === 0 || f === 1) uv.setX(i, uv.getX(i) * d / 2);
      else if (f === 4 || f === 5) uv.setX(i, uv.getX(i) * w / 2);
      else { uv.setX(i, uv.getX(i) * w / 2); uv.setY(i, uv.getY(i) * d / 2); }
    }
    return g;
  }
  function wallBlock(w, h, d, variant = 0, topVariant = 0) {
    const side = M.wall[variant], top = M.top[topVariant];
    const m = new THREE.Mesh(worldUVBox(w, h, d), [side, side, top, top, side, side]);
    m.receiveShadow = true;
    return m;
  }
  function mesh(geo, mat, x = 0, y = 0, z = 0, parent = scene) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  function addBox(w, h, d, mat, x, y, z, parent = scene) { // y = bottom
    return mesh(worldUVBox(w, h, d), mat, x, y + h / 2, z, parent);
  }
  function aabb(x, z, hx, hz) { colliders.push({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz }); }
  function circle(x, z, r) { colliders.push({ x, z, r }); }
  function toWorld(group, x, y, z) { return new THREE.Vector3(x, y, z).applyMatrix4(group.matrixWorld); }

  // gable roof, ridge along local x
  function gableRoof(w, d, rise, ov, mat) {
    const W = w / 2 + ov, Z = d / 2 + ov, ey = -ov * rise / (d / 2);
    const slope = Math.hypot(Z, rise - ey);
    const pos = [], uv = [];
    for (const s of [1, -1]) {
      const quad = [[-W, ey, s * Z], [W, ey, s * Z], [W, rise, 0], [-W, rise, 0]];
      const uvs = [[0, 0], [2 * W / 2, 0], [2 * W / 2, slope / 2], [0, slope / 2]];
      for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(...quad[i]); uv.push(...uvs[i]); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return new THREE.Mesh(g, mat);
  }
  function gableEnds(w, d, rise, mat) {
    const pos = [], uv = [];
    for (const s of [1, -1]) {
      const x = s * w / 2;
      pos.push(x, 0, d / 2, x, 0, -d / 2, x, rise, 0);
      uv.push(0, 0.5, d / 2, 0.5, d / 4, 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: M.wall[0].map, side: THREE.DoubleSide, roughness: 1 }));
  }

  function toran(group, x, y, z, width) {
    // marigold strands with mango leaves across a door top (local coords)
    const n = Math.round(width / 0.06);
    for (let i = 0; i <= n; i++) {
      const u = i / n, lx = x - width / 2 + u * width, ly = y - Math.sin(u * Math.PI) * 0.12;
      const p = toWorld(group, lx, ly, z);
      marigolds.push([p.x, p.y, p.z, i % 2]);
      if (i % 5 === 2) {
        for (let k = 1; k < 5; k++) { const q = toWorld(group, lx, ly - k * 0.055, z); marigolds.push([q.x, q.y, q.z, (k + i) % 2]); }
        const l = toWorld(group, lx, ly - 0.32, z);
        mangoLeaves.push([l.x, l.y, l.z, group.rotation.y]);
      }
    }
  }

  function kandil(x, y, z, color = 0xff7a20, hang = 0.6) {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + (i / 10) * Math.PI * 2, r = i % 2 ? 0.11 : 0.24;
      i ? shape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.02, bevelSegments: 1 });
    geo.translate(0, 0, -0.05);
    const c = new THREE.Color(color);
    const m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2.2, roughness: 0.7 });
    const g = new THREE.Group();
    g.position.set(x, y, z);
    scene.add(g);
    const star = mesh(geo, m, 0, 0, 0, g);
    mesh(new THREE.CylinderGeometry(0.004, 0.004, hang), M.dark, 0, 0.24 + hang / 2, 0, g);
    const tailM = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.8, side: THREE.DoubleSide });
    for (const s of [-1, 1]) { const t = mesh(new THREE.PlaneGeometry(0.04, 0.5), tailM, s * 0.06, -0.45, 0, g); t.rotation.z = s * 0.1; }
    lamps.spot(x, y, z, 1.6, color, { range: 6 });
    const seed = Math.random() * 10;
    updaters.push((dt, t) => { g.rotation.y = Math.sin(t * 0.7 + seed) * 0.4; g.rotation.z = Math.sin(t * 1.1 + seed) * 0.05; });
    return g;
  }

  /* ---------- LED string lights: chasing, twinkling and blinking strands ---------- */
  const bulbs = []; // [x,y,z, r,g,b, phase, mode]
  const wires = [];
  const PALETTES = {
    warm: [[1, 0.72, 0.38]],
    gold: [[1, 0.62, 0.18], [1, 0.8, 0.45]],
    multi: [[1, 0.2, 0.25], [0.25, 1, 0.35], [0.3, 0.55, 1], [1, 0.8, 0.2]],
    rgb: [[1, 0.15, 0.4], [0.2, 0.9, 1], [1, 0.85, 0.2]],
    pink: [[1, 0.35, 0.65], [1, 0.75, 0.4]],
  };
  // a strand between two world points; sag in metres; mode 0 twinkle, 1 chase, 2 blink
  function strand(a, b, spacing, pal, mode, sag = 0.12) {
    const len = a.distanceTo(b), n = Math.max(2, Math.round(len / spacing));
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const p = new THREE.Vector3().lerpVectors(a, b, u);
      p.y -= Math.sin(u * Math.PI) * sag;
      const c = pal[i % pal.length];
      bulbs.push(p.x, p.y, p.z, c[0], c[1], c[2], u * len, mode);
      if (prev) wires.push(prev.x, prev.y + 0.02, prev.z, p.x, p.y + 0.02, p.z);
      prev = p;
    }
  }
  function houseLights(g, o, w, d, h) {
    const keys = Object.keys(PALETTES);
    const pal = PALETTES[o.palette || keys[(Math.abs(Math.round(g.position.x * 7 + g.position.z * 3))) % keys.length]];
    const mode = o.lightMode ?? Math.abs(Math.round(g.position.x + g.position.z)) % 3;
    const W = (lx, ly, lz) => toWorld(g, lx, ly, lz);
    if (o.roof === "flat") {
      const top = h + 0.18 + 0.7;
      // along the parapet edge, and curtain strands hanging down the facade
      strand(W(-w / 2, top + 0.02, d / 2 + 0.03), W(w / 2, top + 0.02, d / 2 + 0.03), 0.18, pal, mode, 0.04);
      for (let lx = -w / 2 + 0.25; lx < w / 2 - 0.1; lx += 0.32) {
        if (Math.abs(lx - (o.doorAt ?? 0)) < 0.8) continue;
        const len = 1.0 + 0.5 * Math.abs(Math.sin(lx * 3.1));
        strand(W(lx, top - 0.05, d / 2 + 0.05), W(lx, top - 0.05 - len, d / 2 + 0.05), 0.16, pal, 1, 0);
      }
    } else {
      const rise = o.roof === "thatch" ? 1.7 : 1.3, ov = 0.45, ey = -ov * rise / (d / 2);
      // swags along the front eave and a line along the ridge
      const segs = 3;
      for (let k = 0; k < segs; k++) {
        const x0 = -w / 2 - ov + (k / segs) * (w + 2 * ov), x1 = -w / 2 - ov + ((k + 1) / segs) * (w + 2 * ov);
        strand(W(x0, h + ey - 0.05, d / 2 + ov), W(x1, h + ey - 0.05, d / 2 + ov), 0.2, pal, mode, 0.28);
      }
      strand(W(-w / 2 - ov, h + rise + 0.05, 0), W(w / 2 + ov, h + rise + 0.05, 0), 0.25, pal, (mode + 1) % 3, 0.02);
    }
    const c = pal[0], lp = W(0, h - 0.2, d / 2 + 1.2);
    lamps.spot(lp.x, lp.y, lp.z, 1.6, new THREE.Color(c[0], c[1], c[2]).getHex(), { flicker: 0.1, range: 7 });
  }

  /*
   * House. Front faces local +z; rot rotates the whole house around y.
   * o: { x, z, w, d, h, rot, roof: 'thatch'|'tile'|'flat', wall, door, doorAt, toran, kandil, parapetGap }
   */
  function house(o) {
    if (o.enter === undefined) { o.enter = true; o.interior ||= homeRoom; }
    const { x, z, w, d } = o;
    const h = o.h ?? 2.9, rot = o.rot ?? 0, wall = o.wall ?? 0;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    scene.add(g);
    g.updateMatrixWorld();
    const dx = o.doorAt ?? 0, dw = o.enter ? 1.3 : 1.1, dh = 1.9;
    const T0 = 0.3; // wall thickness of enterable houses
    const wallColliders = [];
    const seg = (lx, ly, lz, sw, sh, sd) => {
      const b = wallBlock(sw, sh, sd, wall, wall === 2 ? 1 : 0);
      b.position.set(lx, ly + sh / 2, lz);
      g.add(b);
      if (ly < 1) wallColliders.push([lx, lz, sw, sd]);
    };
    if (o.enter) {
      seg(0, 0, -d / 2 + T0 / 2, w, h, T0); // back
      seg(-w / 2 + T0 / 2, 0, 0, T0, h, d - 2 * T0); // sides
      seg(w / 2 - T0 / 2, 0, 0, T0, h, d - 2 * T0);
      const lw = dx - dw / 2 + w / 2, rw = w / 2 - (dx + dw / 2);
      seg(-w / 2 + lw / 2, 0, d / 2 - T0 / 2, lw, h, T0); // front, split round the door
      seg(w / 2 - rw / 2, 0, d / 2 - T0 / 2, rw, h, T0);
      seg(dx, 0.22 + dh, d / 2 - T0 / 2, dw, h - 0.22 - dh, T0);
      // plastered floor and roof beams (kadi)
      const fl = mesh(new THREE.PlaneGeometry(w - 2 * T0, d - 2 * T0), new THREE.MeshStandardMaterial({ map: T.plaster(0), color: 0x7a5a40, roughness: 0.85 }), 0, 0.225, 0, g);
      fl.rotation.x = -Math.PI / 2;
      for (let bx = -w / 2 + 0.8; bx < w / 2 - 0.4; bx += 1.1) addBox(0.12, 0.12, d - 2 * T0, M.darkWood, bx, h - 0.12, 0, g);
      const ip = toWorld(g, 0, h - 0.6, 0);
      lamps.spot(ip.x, ip.y - 0.5, ip.z, 4, 0xffa858, { range: 7 });
    } else {
      const body = wallBlock(w, h, d, wall, wall === 2 ? 1 : 0);
      body.position.y = h / 2;
      g.add(body);
    }
    // plinth step
    addBox(w + 0.3, 0.22, d + 0.3, M.top[wall === 2 ? 1 : 0], 0, 0, 0, g);

    // door: lamplit room behind half-open painted leaves (a real room when enterable)
    if (!o.enter) mesh(new THREE.PlaneGeometry(dw, dh), M.doorway, dx, 0.22 + dh / 2, d / 2 + 0.012, g);
    addBox(dw + 0.2, 0.14, 0.18, M.darkWood, dx, 0.22 + dh, d / 2 + 0.02, g); // lintel
    for (const s of [-1, 1]) {
      addBox(0.1, dh, 0.16, M.darkWood, dx + s * (dw / 2 + 0.05), 0.22, d / 2 + 0.02, g);
      const leaf = mesh(new THREE.PlaneGeometry(dw / 2, dh), new THREE.MeshStandardMaterial({ map: T.paintedDoor(o.door || "#2a5a8a"), roughness: 0.8, side: THREE.DoubleSide }), 0, 0, 0, g);
      const hinge = new THREE.Group();
      hinge.position.set(dx + s * dw / 2, 0.22 + dh / 2, d / 2 + 0.03);
      hinge.rotation.y = s * (o.enter ? -1.5 : -1.1);
      g.add(hinge);
      hinge.add(leaf);
      leaf.position.x = -s * dw / 4;
    }
    // threshold diyas and a light spilling out of the door
    const L = toWorld(g, dx - 0.85, 0.22, d / 2 + 0.08), R = toWorld(g, dx + 0.85, 0.22, d / 2 + 0.08);
    lamps.add(L.x, L.y, L.z); lamps.add(R.x, R.y, R.z);
    const sp = toWorld(g, dx, 1.2, d / 2 + 0.8);
    lamps.spot(sp.x, sp.y, sp.z, 3.2, 0xffa050);

    // small windows with lamplight and wooden bars, diya on each sill
    const wins = o.windows ?? [dx - 1.9, dx + 1.9].filter((wx) => Math.abs(wx) < w / 2 - 0.5);
    for (const wx of wins) {
      mesh(new THREE.PlaneGeometry(0.55, 0.55), M.window, wx, 1.55, d / 2 + 0.012, g);
      for (let k = -1; k <= 1; k++) addBox(0.04, 0.55, 0.04, M.darkWood, wx + k * 0.14, 1.275, d / 2 + 0.03, g);
      addBox(0.7, 0.06, 0.16, M.darkWood, wx, 1.22, d / 2 + 0.05, g);
      const s = toWorld(g, wx, 1.28, d / 2 + 0.07);
      lamps.add(s.x, s.y, s.z, { decal: false });
    }

    // roof
    if (o.roof === "flat") {
      const pv = wall === 2 ? 2 : 0;
      addBox(w + 0.1, 0.18, d + 0.1, M.top[wall === 2 ? 1 : 0], 0, h, 0, g);
      const ph = 0.7, t = 0.25, top = h + 0.18;
      const segs = [
        [0, -d / 2 + t / 2, w, t], // back
        [-w / 2 + t / 2, 0, t, d], [w / 2 - t / 2, 0, t, d], // sides
      ];
      // front parapet, optionally with a gap for the stair
      if (o.parapetGap) {
        const [g0, g1] = o.parapetGap; // local x range
        if (g0 > -w / 2) segs.push([(-w / 2 + g0) / 2, d / 2 - t / 2, g0 + w / 2, t]);
        if (g1 < w / 2) segs.push([(g1 + w / 2) / 2, d / 2 - t / 2, w / 2 - g1, t]);
      } else segs.push([0, d / 2 - t / 2, w, t]);
      for (const [px, pz, sw, sd] of segs) {
        const b = wallBlock(sw, ph, sd, pv, wall === 2 ? 1 : 0);
        b.position.set(px, top + ph / 2, pz);
        g.add(b);
        // a row of diyas along every parapet top
        const n = Math.max(2, Math.round(Math.max(sw, sd) / 0.45));
        const a = toWorld(g, px - (sw > sd ? sw / 2 - 0.2 : 0), top + ph, pz - (sd > sw ? sd / 2 - 0.2 : 0));
        const bb = toWorld(g, px + (sw > sd ? sw / 2 - 0.2 : 0), top + ph, pz + (sd > sw ? sd / 2 - 0.2 : 0));
        lamps.row([a.x, a.y, a.z], [bb.x, bb.y, bb.z], n, { spotPower: 2.4 });
      }
      g.userData.roofY = top;
    } else {
      const rise = o.roof === "thatch" ? 1.7 : 1.3;
      const r = gableRoof(w, d, rise, 0.45, o.roof === "thatch" ? M.thatch : M.tiles);
      r.position.y = h;
      g.add(r);
      const ends = gableEnds(w, d, rise);
      ends.position.y = h;
      g.add(ends);
      if (o.roof === "thatch") { // thick eave lip
        for (const s of [1, -1]) addBox(w + 0.9, 0.16, 0.25, M.thatch, 0, h - 0.4, s * (d / 2 + 0.42), g);
      }
      // diyas along the eave line on the front plinth
      const a = toWorld(g, -w / 2 + 0.2, 0.22, d / 2 + 0.12), b = toWorld(g, w / 2 - 0.2, 0.22, d / 2 + 0.12);
      lamps.row([a.x, a.y, a.z], [b.x, b.y, b.z], Math.round(w / 0.5), { spotPower: 2 });
    }

    if (o.toran !== false) toran(g, dx, 0.22 + dh + 0.02, d / 2 + 0.13, dw + 0.3);
    if (o.kandil) {
      const k = toWorld(g, dx + 1.0, h - 0.55, d / 2 + 0.55);
      kandil(k.x, k.y, k.z, o.kandil);
    }
    if (o.lights !== false) houseLights(g, o, w, d, h);
    if (o.interior) o.interior(g, { w, d, h, t: T0, dx });
    if (o.enter) {
      // where to stand outside the door, and just inside it, for "step inside"
      (api.homes ||= []).push({ group: g, out: toWorld(g, dx, 0, d / 2 + 2.2), door: toWorld(g, dx, 0.22, d / 2 - 0.1), inside: toWorld(g, dx, 0.22, d / 2 - 1.1), look: toWorld(g, dx * 0.5, 1.2, -d / 2), name: o.name || "A village home" });
    }
    if (o.mine) {
      // the visitor's own house: a brass nameplate by the door, their rangoli on the step, their kandil
      const pc = document.createElement("canvas"); pc.width = 640; pc.height = 200;
      const pt = new THREE.CanvasTexture(pc); pt.colorSpace = THREE.SRGBColorSpace;
      const plate = mesh(new THREE.PlaneGeometry(0.84, 0.26), new THREE.MeshStandardMaterial({ map: pt, emissive: 0xffffff, emissiveMap: pt, emissiveIntensity: 0.3, roughness: 0.55, metalness: 0.2 }), dx, Math.min(h - 0.2, 0.22 + 1.9 + 0.5), d / 2 + 0.03, g); // above the door, clear of the open leaves
      plate.visible = false;
      const rg = mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshStandardMaterial({ transparent: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }), dx, 0.013, d / 2 + 1.15, g);
      rg.rotation.x = -Math.PI / 2; rg.visible = false;
      const kp = toWorld(g, dx + 1.0, h - 0.55, d / 2 + 0.55);
      const kg = kandil(kp.x, kp.y, kp.z, 0xff7a20);
      const kSpot = lamps.spots.length - 1;
      api.myHouse = {
        group: g, state: g.userData.homeState, home: api.homes[api.homes.length - 1],
        // where the camera stops to read the nameplate before going in
        plate: toWorld(g, dx, plate.position.y, d / 2 + 0.03), front: toWorld(g, dx, 0, d / 2 + 3.4),
        setName(name) {
          const x = pc.getContext("2d");
          const gr = x.createLinearGradient(0, 0, 0, 200); gr.addColorStop(0, "#e8c070"); gr.addColorStop(0.5, "#b88a38"); gr.addColorStop(1, "#8a6420");
          x.fillStyle = gr; x.fillRect(0, 0, 640, 200);
          x.strokeStyle = "#5a3a10"; x.lineWidth = 10; x.strokeRect(12, 12, 616, 176);
          x.fillStyle = "#3a1e06"; x.textAlign = "center"; x.textBaseline = "middle";
          x.font = "bold 78px 'Tiro Devanagari Hindi', serif";
          x.fillText(`${name} निवास`, 320, 104, 580);
          pt.needsUpdate = true;
          plate.visible = !!name;
        },
        setRangoli(opts) {
          const old = rg.material.map;
          rg.material.map = opts ? T.rangoliTexture(opts) : null;
          rg.material.needsUpdate = true;
          rg.visible = !!opts;
          if (old) old.dispose();
        },
        setRangoliTexture(tex) { const old = rg.material.map; rg.material.map = tex; rg.material.needsUpdate = true; rg.visible = true; if (old && old !== tex) old.dispose(); },
        setKandil(hex) {
          const c = new THREE.Color(hex);
          kg.traverse((m) => { if (m.material && m.material.emissive && m.material !== M.dark) { m.material.color.copy(c); m.material.emissive.copy(c); } });
          lamps.spots[kSpot].color.copy(c);
        },
      };
    }
    // colliders in world space
    const c = Math.abs(Math.cos(rot)) > 0.5;
    if (o.enter) {
      (api.floors ||= []).push({ minX: x - (c ? w : d) / 2, maxX: x + (c ? w : d) / 2, minZ: z - (c ? d : w) / 2, maxZ: z + (c ? d : w) / 2 });
      for (const [lx, lz, sw, sd] of wallColliders) {
        const p = toWorld(g, lx, 0, lz);
        aabb(p.x, p.z, (c ? sw : sd) / 2 + 0.05, (c ? sd : sw) / 2 + 0.05);
      }
    } else aabb(x, z, (c ? w : d) / 2 + 0.2, (c ? d : w) / 2 + 0.2);
    return g;
  }

  function tree(x, z, o = {}) {
    const h = o.h ?? 7, r = o.r ?? 3.5, tr = o.trunk ?? 0.3;
    const trunk = mesh(new THREE.CylinderGeometry(tr * 0.6, tr, h * 0.55, 10), M.bark, x, h * 0.275, z);
    trunk.rotation.z = rand(-0.05, 0.05);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + rand(0, 1), len = r * 0.8;
      const b = mesh(new THREE.CylinderGeometry(tr * 0.2, tr * 0.45, len, 6), M.bark, 0, 0, 0);
      b.position.set(x + Math.cos(a) * len * 0.35, h * 0.55 + len * 0.3, z + Math.sin(a) * len * 0.35);
      b.lookAt(x + Math.cos(a) * len, h * 0.85, z + Math.sin(a) * len);
      b.rotateX(Math.PI / 2);
    }
    const clusters = o.clusters ?? 26;
    for (let i = 0; i < clusters; i++) {
      const a = rand(0, Math.PI * 2), rr = Math.sqrt(Math.random()) * r;
      const cy = h * 0.62 + rand(0, h * 0.4) * (1 - (rr / r) * 0.6);
      for (let k = 0; k < 5; k++) leafCards.push([x + Math.cos(a) * rr + rand(-0.5, 0.5), cy + rand(-0.4, 0.4), z + Math.sin(a) * rr + rand(-0.5, 0.5), rand(1.4, 2.4), o.hue ?? 0]);
    }
    circle(x, z, tr + 0.3);
  }

  /* ===================================================================== */
  /* interiors                                                             */
  /* ===================================================================== */
  // place a person by house-local coordinates; yaw is relative to the house
  function placeIn(g, opts, lx, lz, yaw, ly = 0.22) {
    const p = toWorld(g, lx, 0, lz);
    return place(opts, p.x, p.z, g.rotation.y + yaw, ly);
  }
  function framedPicture(g, lx, ly, lz, w, h, tex, yaw = 0) {
    const f = new THREE.Group();
    f.position.set(lx, ly, lz);
    f.rotation.y = yaw;
    g.add(f);
    addBox(w + 0.08, h + 0.08, 0.03, M.brass, 0, -h / 2 - 0.04, 0, f);
    mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.15 }), 0, 0, 0.02, f);
  }
  function aartiFollow(person, scale = 0.1) {
    const id = lamps.add(0, 0, 0, { bowl: false, flame: scale, decal: false });
    const hand = new THREE.Vector3();
    updaters.push(() => {
      person.arms[1].elbow.updateWorldMatrix(true, false);
      hand.set(0, -0.36, 0.05).applyMatrix4(person.arms[1].elbow.matrixWorld);
      lamps.move(id, hand.x, hand.y, hand.z);
    });
  }

  /* ---------- murtis for the home altar ---------- */
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9a53a, metalness: 0.85, roughness: 0.3 });
  const mm = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, ...o });
  function limb(parent, a, b, r, m) { // a capsule from point a to point b
    const len = a.distanceTo(b);
    const c = mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 4, 8), m, 0, 0, 0, parent);
    c.position.copy(a).add(b).multiplyScalar(0.5);
    c.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
    return c;
  }
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  function ganeshMurti(parent, x, y, z, s) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); parent.add(g);
    const skin = mm(0xe8742a), dhoti = mm(0xb3121f), pink = mm(0xf08aa0);
    mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.05, 24), gold, 0, 0.025, 0, g); // peetha
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; const p = mesh(new THREE.SphereGeometry(0.045, 8, 6), pink, Math.cos(a) * 0.18, 0.06, Math.sin(a) * 0.18, g); p.scale.set(1, 0.5, 1.6); p.rotation.y = -a; }
    mesh(new THREE.SphereGeometry(0.16, 16, 12), dhoti, 0, 0.11, 0.02, g).scale.set(1.25, 0.45, 0.9); // crossed legs
    mesh(new THREE.SphereGeometry(0.12, 16, 12), skin, 0, 0.2, 0.02, g).scale.set(1.05, 1, 0.95); // belly
    mesh(new THREE.TorusGeometry(0.12, 0.012, 6, 24), gold, 0, 0.15, 0.02, g).rotation.x = Math.PI / 2; // dhoti waistband
    mesh(new THREE.SphereGeometry(0.085, 14, 10), skin, 0, 0.3, 0, g); // chest
    const janeu = mesh(new THREE.TorusGeometry(0.1, 0.004, 4, 24), mm(0xf6f0e0), 0, 0.26, 0.01, g); janeu.rotation.set(1.2, 0, 0.6);
    mesh(new THREE.TorusGeometry(0.075, 0.01, 6, 20), gold, 0, 0.33, 0.01, g).rotation.x = 1.3; // necklace
    // four arms: ankush and pasha raised, blessing hand, modak
    limb(g, V(-0.08, 0.33, 0), V(-0.17, 0.42, 0.03), 0.025, skin); limb(g, V(0.08, 0.33, 0), V(0.17, 0.42, 0.03), 0.025, skin);
    mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.14), gold, -0.18, 0.47, 0.03, g).rotation.z = 0.4; // ankush
    mesh(new THREE.TorusGeometry(0.03, 0.006, 4, 12), gold, 0.18, 0.46, 0.03, g); // pasha
    limb(g, V(-0.09, 0.3, 0.02), V(-0.12, 0.2, 0.12), 0.025, skin); limb(g, V(0.09, 0.3, 0.02), V(0.12, 0.22, 0.12), 0.025, skin);
    mesh(new THREE.SphereGeometry(0.03, 10, 8), mm(0xf6e0a0), -0.12, 0.2, 0.15, g); // modak
    mesh(new THREE.SphereGeometry(0.028, 8, 6), skin, 0.12, 0.25, 0.14, g).scale.set(1, 1.3, 0.4); // abhaya hand
    // head, ears, trunk, tusk, eyes, tilak, mukut
    const head = new THREE.Group(); head.position.set(0, 0.43, 0.01); g.add(head);
    mesh(new THREE.SphereGeometry(0.075, 16, 12), skin, 0, 0, 0, head);
    for (const sd of [-1, 1]) {
      mesh(new THREE.SphereGeometry(0.07, 14, 10), skin, sd * 0.085, 0.005, -0.015, head).scale.set(0.95, 1.05, 0.22);
      mesh(new THREE.SphereGeometry(0.05, 12, 8), pink, sd * 0.087, 0.005, -0.0, head).scale.set(0.85, 0.95, 0.12);
      mesh(new THREE.SphereGeometry(0.008, 8, 6), mm(0x140a06, { roughness: 0.2 }), sd * 0.03, 0.02, 0.066, head);
    }
    const trunk = new THREE.CatmullRomCurve3([V(0, -0.01, 0.06), V(0.005, -0.06, 0.09), V(-0.01, -0.12, 0.1), V(-0.05, -0.15, 0.09), V(-0.07, -0.12, 0.08)]);
    mesh(new THREE.TubeGeometry(trunk, 24, 0.017, 8), skin, 0, 0, 0, head);
    mesh(new THREE.ConeGeometry(0.008, 0.04, 6), mm(0xf6f0e0), 0.03, -0.04, 0.06, head).rotation.x = 2.4; // tusk
    addBox(0.01, 0.035, 0.004, mm(0xc0101a), 0, 0.035, 0.07, head); // tilak
    mesh(new THREE.CylinderGeometry(0.035, 0.06, 0.1, 12), gold, 0, 0.1, -0.005, head); // mukut
    mesh(new THREE.ConeGeometry(0.035, 0.06, 12), gold, 0, 0.18, -0.005, head);
    mesh(new THREE.SphereGeometry(0.01, 8, 6), mm(0xc0101a, { emissive: 0x300000 }), 0, 0.1, 0.05, head);
    // mushak (his mouse) at the base
    const mu = new THREE.Group(); mu.position.set(0.15, 0.06, 0.16); mu.rotation.y = -0.6; g.add(mu);
    mesh(new THREE.SphereGeometry(0.03, 10, 8), mm(0x8a8580), 0, 0.02, 0, mu).scale.set(0.8, 0.7, 1.3);
    mesh(new THREE.SphereGeometry(0.017, 8, 6), mm(0x8a8580), 0, 0.03, 0.035, mu);
    for (const sd of [-1, 1]) mesh(new THREE.SphereGeometry(0.009, 6, 4), pink, sd * 0.012, 0.045, 0.03, mu);
    // prabhavali halo behind
    const halo = mesh(new THREE.TorusGeometry(0.24, 0.012, 6, 36, Math.PI * 1.15), gold, 0, 0.32, -0.1, g); halo.rotation.z = -0.07 * Math.PI;
    return g;
  }

  function lakshmiMurti(parent, x, y, z, s) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); parent.add(g);
    const skin = mm(0xf0c090), saree = mm(0xc0102a), pink = mm(0xf27a9a), pale = mm(0xffc0d0);
    // she sits on a full pink lotus
    for (let ring = 0; ring < 2; ring++) for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + ring * 0.26, r = 0.19 - ring * 0.05;
      const p = mesh(new THREE.SphereGeometry(0.05, 8, 6), ring ? pale : pink, Math.cos(a) * r, 0.05 + ring * 0.03, Math.sin(a) * r, g);
      p.scale.set(0.7, 0.45, 1.6); p.rotation.y = -a; p.rotation.x = ring ? -0.5 : -0.2;
    }
    // saree spread over crossed legs, with a gold border
    const skirt = mesh(new THREE.CylinderGeometry(0.07, 0.17, 0.16, 20), saree, 0, 0.15, 0.02, g);
    mesh(new THREE.TorusGeometry(0.168, 0.01, 6, 28), gold, 0, 0.075, 0.02, g).rotation.x = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.16, 16), saree, 0, 0.3, 0, g); // torso
    const pallu = addBox(0.04, 0.2, 0.012, mm(0xd8a020, { metalness: 0.3 }), 0.02, 0.21, 0.07, g); pallu.rotation.z = 0.55;
    mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 20), gold, 0, 0.36, 0.02, g).rotation.x = 1.2; // haar
    mesh(new THREE.TorusGeometry(0.065, 0.006, 6, 20), gold, 0, 0.34, 0.025, g).rotation.x = 1.35;
    // four arms: two lotuses raised, coins pouring from the right hand, the left in varada
    limb(g, V(-0.06, 0.36, 0), V(-0.15, 0.44, 0.03), 0.018, skin); limb(g, V(0.06, 0.36, 0), V(0.15, 0.44, 0.03), 0.018, skin);
    for (const sd of [-1, 1]) for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; const p = mesh(new THREE.SphereGeometry(0.018, 8, 6), k % 2 ? pink : pale, sd * 0.16 + Math.cos(a) * 0.015, 0.48, 0.03 + Math.sin(a) * 0.015, g); p.scale.set(0.6, 1.3, 0.6); }
    limb(g, V(-0.065, 0.35, 0.02), V(-0.1, 0.25, 0.12), 0.018, skin); limb(g, V(0.065, 0.35, 0.02), V(0.1, 0.25, 0.12), 0.018, skin);
    // head, hair, crown, bindi, earrings
    const head = new THREE.Group(); head.position.set(0, 0.43, 0.005); g.add(head);
    mesh(new THREE.SphereGeometry(0.048, 16, 12), skin, 0, 0, 0, head).scale.set(0.9, 1.1, 0.95);
    mesh(new THREE.SphereGeometry(0.051, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), mm(0x140c08), 0, 0.005, -0.006, head);
    mesh(new THREE.SphereGeometry(0.035, 10, 8), mm(0x140c08), 0, -0.01, -0.055, head); // bun
    mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.08, 12), gold, 0, 0.075, -0.003, head);
    mesh(new THREE.ConeGeometry(0.03, 0.05, 12), gold, 0, 0.14, -0.003, head);
    mesh(new THREE.SphereGeometry(0.006, 6, 4), mm(0xc0101a, { emissive: 0x400000 }), 0, 0.022, 0.046, head);
    for (const sd of [-1, 1]) {
      mesh(new THREE.SphereGeometry(0.006, 6, 4), mm(0x140a06), sd * 0.017, 0.008, 0.043, head);
      mesh(new THREE.TorusGeometry(0.012, 0.003, 4, 10), gold, sd * 0.046, -0.025, 0, head);
    }
    const halo = mesh(new THREE.TorusGeometry(0.22, 0.012, 6, 36, Math.PI * 1.15), gold, 0, 0.34, -0.09, g); halo.rotation.z = -0.07 * Math.PI;
    // gold coins pouring from her lower right hand
    const coins = [];
    for (let i = 0; i < 9; i++) { const c = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.003, 12), gold, 0.1, 0.24, 0.13, g); c.rotation.x = Math.random() * 3; coins.push({ c, ph: i / 9 }); }
    updaters.push((dt, t) => { for (const q of coins) { const u = (t * 0.35 + q.ph) % 1; q.c.position.set(0.1 + Math.sin(u * 9 + q.ph * 20) * 0.006, 0.235 - u * 0.17, 0.135 + u * 0.03); q.c.rotation.x += dt * 4; } });
    mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.02, 14), gold, 0.1, 0.065, 0.17, g); // the little heap where they land
    return g;
  }

  // marigold petals showered over the altar; they settle and stay on the floor
  const petalFall = [];
  const petalMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(0.02, 6), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.8 }), 400);
  { const w = new THREE.Color(1, 1, 1); for (let i = 0; i < 400; i++) petalMesh.setColorAt(i, w); }
  petalMesh.count = 0;
  petalMesh.frustumCulled = false;
  scene.add(petalMesh);
  api.showerPetals = (center, n = 220) => {
    const col = new THREE.Color();
    for (let i = 0; i < n && petalMesh.count < 400; i++) {
      const k = petalMesh.count++;
      petalFall.push({ k, p: center.clone().add(new THREE.Vector3(rand(-0.9, 0.9), rand(0.4, 1.4), rand(-0.6, 0.6))), vy: -rand(0.3, 0.6), sw: rand(0, 6), spin: new THREE.Vector3(rand(-4, 4), rand(-4, 4), rand(-4, 4)), rot: new THREE.Euler(rand(0, 6), rand(0, 6), 0), floor: center.y - 1.3 });
      petalMesh.setColorAt(k, col.setHex(Math.random() < 0.7 ? 0xff8a10 : 0xffc020));
    }
    petalMesh.instanceColor.needsUpdate = true;
  };
  {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
    updaters.push((dt, t) => {
      if (!petalFall.length) return;
      for (const f of petalFall) {
        if (f.p.y > f.floor) {
          f.p.y += f.vy * dt;
          f.p.x += Math.sin(t * 2 + f.sw) * 0.25 * dt;
          f.rot.x += f.spin.x * dt; f.rot.y += f.spin.y * dt;
          if (f.p.y <= f.floor) { f.p.y = f.floor; f.rot.set(-Math.PI / 2, f.rot.y, 0); }
        }
        m4.compose(f.p, q.setFromEuler(f.rot), one);
        petalMesh.setMatrixAt(f.k, m4);
      }
      petalMesh.instanceMatrix.needsUpdate = true;
    });
  }

  // the family's puja ghar: Ganesh ji and Lakshmi ji on a red-draped chowki, the akhand diya, everyone seated
  function pujaRoom(g, { h }) {
    const W = (lx, ly, lz) => toWorld(g, lx, ly, lz);
    const red = new THREE.MeshStandardMaterial({ color: 0xa3122a, roughness: 0.8 });
    addBox(1.3, 0.38, 0.6, M.wood, 0, 0.22, -1.42, g); // chowki
    addBox(1.36, 0.02, 0.64, red, 0, 0.6, -1.42, g);
    // carved wooden mandir backed with red cloth
    addBox(1.35, 1.25, 0.06, M.darkWood, 0, 0.62, -1.68, g);
    mesh(new THREE.PlaneGeometry(1.2, 1.1), new THREE.MeshStandardMaterial({ map: T.cloth("#8a0f1f", "#a3122a"), roughness: 0.9 }), 0, 1.2, -1.645, g);
    for (const sx of [-1, 1]) addBox(0.08, 1.25, 0.12, M.wood, sx * 0.66, 0.62, -1.6, g);
    const arch = mesh(new THREE.TorusGeometry(0.66, 0.05, 6, 24, Math.PI), M.wood, 0, 1.86, -1.6, g);
    arch.scale.y = 0.45;
    g.updateMatrixWorld();
    ganeshMurti(g, -0.3, 0.62, -1.5, 1.05);
    lakshmiMurti(g, 0.3, 0.62, -1.5, 1.08);
    // marigold garlands on both murtis and across the mandir
    for (const mx of [-0.3, 0.3]) for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const p = W(mx + Math.cos(a) * 0.1, 0.62 + 0.33 + Math.sin(a) * 0.09 - Math.abs(Math.sin(a)) * 0.06, -1.5 + 0.06 + Math.max(0, Math.sin(a)) * 0.04);
      marigolds.push([p.x, p.y, p.z, i % 2]);
    }
    for (let i = 0; i <= 26; i++) { const u = i / 26; const p = W(-0.62 + u * 1.24, 1.8 - Math.sin(u * Math.PI) * 0.28, -1.58); marigolds.push([p.x, p.y, p.z, i % 2]); }
    // kalash with coconut and mango leaves, coins and a new account book (bahi-khata)
    mesh(new THREE.SphereGeometry(0.09, 14, 10), M.brass, -0.58, 0.71, -1.25, g);
    mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 1 }), -0.58, 0.84, -1.25, g);
    for (let i = 0; i < 6; i++) { const lf = mesh(new THREE.PlaneGeometry(0.045, 0.12), new THREE.MeshStandardMaterial({ color: 0x2a6a1a, side: THREE.DoubleSide }), -0.58 + Math.cos(i) * 0.06, 0.82, -1.25 + Math.sin(i) * 0.06, g); lf.rotation.set(0.6 * Math.sin(i), i, 0.6 * Math.cos(i)); }
    for (let i = 0; i < 7; i++) mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.004, 12), new THREE.MeshStandardMaterial({ color: 0xe8c040, metalness: 0.9, roughness: 0.3 }), 0.05 + i * 0.028, 0.613 + i * 0.004, -1.17, g);
    const book = addBox(0.16, 0.03, 0.22, red, 0.52, 0.61, -1.25, g); book.rotation.y = 0.3;
    mesh(new THREE.PlaneGeometry(0.03, 0.03), new THREE.MeshStandardMaterial({ color: 0xd9a53a, emissive: 0x302000 }), 0, 0.016, 0, book).rotation.x = -Math.PI / 2;
    // diyas on the chowki, the akhand diya, a rangoli with lamps on the floor
    const a = W(-0.55, 0.62, -1.15), b = W(0.55, 0.62, -1.15);
    lamps.row(a.toArray(), b.toArray(), 7, { decal: false, spot: false });
    const ak = W(0.85, 0.22, -1.3);
    addBox(0.25, 0.3, 0.25, M.brass, 0.85, 0.22, -1.3, g);
    lamps.add(ak.x, ak.y + 0.3, ak.z, { scale: 2.2, decal: false });
    const rgM = mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshStandardMaterial({ map: T.rangoli(2), transparent: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }), 0, 0.232, -0.55, g);
    rgM.rotation.x = -Math.PI / 2;
    const rc = W(0, 0.232, -0.55);
    lamps.ring(rc.x, rc.y, rc.z, 0.62, 8, { spot: false });
    const al = W(0, 1.1, -0.9);
    lamps.spot(al.x, al.y, al.z, 6, 0xffa050, { range: 6 });
    for (let k = 0; k < 4; k++) for (let i = 0; i <= 14; i++) {
      const u = i / 14, lx = -2.4 + k * 1.2 + u * 1.2;
      const p = W(lx, h - 0.35 - Math.sin(u * Math.PI) * 0.35, -1.66);
      marigolds.push([p.x, p.y, p.z, i % 2]);
    }
    strand(W(-2.6, h - 0.2, -1.62), W(2.6, h - 0.2, -1.62), 0.16, PALETTES.warm, 0, 0.18);
    framedPicture(g, -1.6, 1.75, -1.66, 0.5, 0.36, T.goods("diyas"));
    framedPicture(g, 1.6, 1.75, -1.66, 0.5, 0.36, T.goods("kandil"));
    // incense curling up from a holder
    const inc = W(0.62, 0.8, -1.5);
    let it = 0;
    updaters.push((dt) => { it -= dt; if (it <= 0) { sparks.puff(inc.x, inc.y, inc.z, 0.12, 5, [0.62, 0.58, 0.55], 0.18, 0.02, 0.18, 0, 0.12); it = 0.35; } });
    // the family, seated for the puja; the mother waves the aarti lamp
    const family = [
      placeIn(g, { kind: "elder", pose: "sit" }, -1.0, 0.45, Math.PI),
      placeIn(g, { kind: "woman", pose: "sit" }, -0.35, 0.65, Math.PI),
      placeIn(g, { kind: "girl", pose: "sit" }, 0.35, 0.6, Math.PI),
      placeIn(g, { kind: "man", pose: "sit" }, 1.05, 0.5, Math.PI + 0.2),
    ];
    const mother = placeIn(g, { kind: "woman", pose: "aarti" }, -0.75, -0.55, Math.PI - 0.5);
    // the family the visitor can name: dadi, chachi, didi, papa and maa
    api.family = { dadi: family[0], chachi: family[1], didi: family[2], papa: family[3], maa: mother };
    aartiFollow(mother, 0.12);
    // the aarti: she steps before Ganesh ji, then Lakshmi ji, the family joins hands
    const rest = mother.group.position.clone(), restYaw = mother.group.rotation.y;
    const spots = { ganesh: W(-0.3, 0.22, -0.72), lakshmi: W(0.3, 0.22, -0.72) };
    const aarti = { target: rest.clone(), yaw: restYaw };
    updaters.push((dt) => {
      mother.group.position.lerp(aarti.target, Math.min(1, dt * 2));
      let d = aarti.yaw - mother.group.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
      mother.group.rotation.y += d * Math.min(1, dt * 3);
    });
    api.pujaAarti = (phase) => {
      if (phase === "ganesh" || phase === "lakshmi") {
        aarti.target.copy(spots[phase]); aarti.yaw = g.rotation.y + Math.PI;
        family.forEach((p) => (p.pose = "sitnamaste"));
      } else {
        aarti.target.copy(rest); aarti.yaw = restYaw;
        family.forEach((p) => (p.pose = "sit"));
      }
    };
    api.altarCenter = W(0, 2.0, -1.2);
  }

  // a lane house with neighbours visiting: charpais, sweets, chai, the children's new clothes
  function guestRoom(g, { h }) {
    const W = (lx, ly, lz) => toWorld(g, lx, ly, lz);
    const charpai = (lx, lz, yaw) => {
      const cp = new THREE.Group(); cp.position.set(lx, 0.22, lz); cp.rotation.y = yaw; g.add(cp);
      const top = mesh(new THREE.PlaneGeometry(1.9, 0.9), new THREE.MeshStandardMaterial({ map: T.weave(), roughness: 1, side: THREE.DoubleSide }), 0, 0.45, 0, cp);
      top.rotation.x = -Math.PI / 2;
      for (const [x, z] of [[-0.9, -0.42], [0.9, -0.42], [-0.9, 0.42], [0.9, 0.42]]) addBox(0.07, 0.45, 0.07, M.darkWood, x, 0, z, cp);
      for (const s of [-1, 1]) { addBox(1.95, 0.07, 0.07, M.darkWood, 0, 0.42, s * 0.44, cp); addBox(0.07, 0.07, 0.95, M.darkWood, s * 0.95, 0.42, 0, cp); }
      addBox(0.5, 0.12, 0.8, new THREE.MeshStandardMaterial({ map: T.cloth("#b3121f", "#f2b705"), roughness: 1 }), 0.65, 0.45, 0, cp);
    };
    charpai(-1.2, -1.55, 0);
    charpai(2.05, 0.1, Math.PI / 2);
    // steel almirah, low patla with sweets and chai
    addBox(0.8, 1.8, 0.5, new THREE.MeshStandardMaterial({ color: 0x5a6a72, metalness: 0.7, roughness: 0.4 }), 2.15, 0.22, -1.85, g);
    addBox(0.7, 0.14, 0.45, M.wood, -0.1, 0.22, -0.2, g);
    const plate = (lx, lz, col) => {
      mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.012, 20), new THREE.MeshStandardMaterial({ color: 0xc0c4c8, metalness: 0.9, roughness: 0.25 }), lx, 0.37, lz, g);
      for (let i = 0; i < 5; i++) mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshStandardMaterial({ color: col, roughness: 0.7 }), lx + Math.cos(i * 1.3) * (i ? 0.06 : 0), 0.395, lz + Math.sin(i * 1.3) * (i ? 0.06 : 0), g);
    };
    plate(-0.3, -0.25, 0xf0a020); plate(0.12, -0.15, 0xe8dcc0);
    for (const [ox, oz] of [[-0.05, -0.35], [0.2, -0.3]]) mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.09, 10), new THREE.MeshStandardMaterial({ color: 0xc0c4c8, metalness: 0.9, roughness: 0.25 }), ox, 0.41, oz, g);
    // lamps in the wall niche and on the inside window sills, string lights, framed photos
    const niche = W(-2.68, 1.25, 0.6);
    addBox(0.08, 0.04, 0.4, M.darkWood, -2.66, 1.21, 0.6, g);
    lamps.add(niche.x, niche.y, niche.z, { decal: false, scale: 1.1 });
    for (const lx of [-1.9, 1.9]) { const s = W(lx, 1.28, 2.1); lamps.add(s.x, s.y, s.z, { decal: false }); }
    strand(W(-2.6, h - 0.25, -2.12), W(2.6, h - 0.25, -2.12), 0.15, PALETTES.multi, 1, 0.16);
    strand(W(-2.62, h - 0.25, -2.0), W(-2.62, h - 0.25, 2.0), 0.15, PALETTES.multi, 1, 0.16);
    framedPicture(g, -0.6, 1.85, -2.18, 0.42, 0.32, T.goods("murti"));
    framedPicture(g, 0.3, 1.8, -2.18, 0.32, 0.42, T.goods("mithai"));
    const ip = W(0, 1.6, 0);
    lamps.spot(ip.x, ip.y, ip.z, 5, 0xffb060, { range: 6 });
    // guests on the charpais, the host bringing sweets, children on the floor
    placeIn(g, { kind: "woman", pose: "sit" }, -1.6, -1.45, 0, 0.67);
    placeIn(g, { kind: "woman", pose: "sit" }, -0.8, -1.45, 0, 0.67);
    placeIn(g, { kind: "elder", pose: "sit" }, 1.95, 0.4, -Math.PI / 2, 0.67);
    placeIn(g, { kind: "woman", carry: "box" }, 1.15, -0.35, -2.2); // the host, a step in from the door so the visitor can enter
    placeIn(g, { kind: "child", pose: "sit" }, -0.5, 0.45, Math.PI - 0.3);
    placeIn(g, { kind: "girl", pose: "wave" }, 1.4, 0.9, Math.PI + 0.6);
  }

  // an ordinary village home on Diwali night, sized to whatever house it sits in: a charpai with a razai,
  // a steel almirah or tin trunks, the family's little puja shelf, a utensil patti, a matka by the door,
  // a clothesline, lamps in the niches and someone at home. Only drawn when you are near enough to see in.
  let homeN = 0;
  function homeRoom(g, { w, d, h, t }) {
    const n = homeN++, v = n % 4;
    const X = w / 2 - t, Z = d / 2 - t;
    // every other home is laid out the other way round, so no two neighbours feel the same
    const fx = Math.floor(n / 2) % 2 ? -1 : 1;
    const inner = new THREE.Group(); inner.scale.x = fx; g.add(inner);
    const W = (lx, ly, lz) => toWorld(g, lx * fx, ly, lz);
    const c = Math.abs(Math.cos(g.rotation.y)) > 0.5;
    const solid = (lx, lz, sw, sd) => { const p = W(lx, 0, lz); aabb(p.x, p.z, (c ? sw : sd) / 2, (c ? sd : sw) / 2); };
    const steelM = new THREE.MeshStandardMaterial({ color: 0xc0c4c8, metalness: 0.9, roughness: 0.25 });
    const DARI = [["#7a1a2a", "#e8b030"], ["#1a3a6a", "#e86a20"], ["#2a5a3a", "#f0d8a0"], ["#6a2a6a", "#f2b705"]][v];
    // a striped cotton dari on the plastered floor
    const rug = mesh(new THREE.PlaneGeometry(Math.min(2.6, w - 1.8), 1.5), new THREE.MeshStandardMaterial({ map: T.cloth(DARI[0], DARI[1]), roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 }), 0.2, 0.232, 0.1, inner);
    rug.rotation.x = -Math.PI / 2;
    // charpai along the back wall, a folded razai and pillow on it
    const cp = new THREE.Group(); cp.position.set(-X + 1.05, 0.22, -Z + 0.55); inner.add(cp);
    const top = mesh(new THREE.PlaneGeometry(1.9, 0.9), new THREE.MeshStandardMaterial({ map: T.weave(), roughness: 1, side: THREE.DoubleSide }), 0, 0.45, 0, cp);
    top.rotation.x = -Math.PI / 2;
    for (const [px, pz] of [[-0.9, -0.42], [0.9, -0.42], [-0.9, 0.42], [0.9, 0.42]]) addBox(0.07, 0.45, 0.07, M.darkWood, px, 0, pz, cp);
    for (const s of [-1, 1]) { addBox(1.95, 0.07, 0.07, M.darkWood, 0, 0.42, s * 0.44, cp); addBox(0.07, 0.07, 0.95, M.darkWood, s * 0.95, 0.42, 0, cp); }
    addBox(0.7, 0.16, 0.8, new THREE.MeshStandardMaterial({ map: T.cloth(DARI[1], DARI[0]), roughness: 1 }), 0.5, 0.46, 0, cp);
    addBox(0.45, 0.1, 0.3, new THREE.MeshStandardMaterial({ color: 0xf0e8d8, roughness: 1 }), -0.65, 0.46, 0, cp);
    solid(-X + 1.05, -Z + 0.55, 1.95, 0.95);
    // back wall, right: a steel almirah, or tin trunks stacked on each other
    if (v % 2 === 0) {
      addBox(0.8, 1.8, 0.5, new THREE.MeshStandardMaterial({ color: [0x5a6a72, 0x6a4a3a][v / 2], metalness: 0.7, roughness: 0.4 }), X - 0.5, 0.22, -Z + 0.27, inner);
      addBox(0.02, 1.5, 0.01, M.dark, X - 0.5, 0.37, -Z + 0.525, inner);
      mesh(new THREE.PlaneGeometry(0.5, 0.35), new THREE.MeshStandardMaterial({ map: T.goods("kandil"), roughness: 0.7 }), X - 0.5, 1.55, -Z + 0.53, inner); // a calendar stuck on the door
    } else {
      for (let k = 0; k < 3; k++) addBox(0.85 - k * 0.1, 0.32, 0.5 - k * 0.04, new THREE.MeshStandardMaterial({ color: [0x2a5a8a, 0x8a2a2a, 0x2a6a4a][k], metalness: 0.5, roughness: 0.5 }), X - 0.5, 0.22 + k * 0.33, -Z + 0.27, inner);
    }
    solid(X - 0.5, -Z + 0.27, 0.85, 0.55);
    // the family's own puja shelf on the back wall: a framed Lakshmi-Ganesh picture, a diya, a marigold garland
    const shelfX = Math.min(0.3, X - 1.4);
    addBox(0.9, 0.05, 0.28, M.wood, shelfX, 1.15, -Z + 0.14, inner);
    framedPicture(inner, shelfX, 1.75, -Z + 0.03, 0.42, 0.42, T.goods("murti"));
    framedPicture(inner, -X + 0.02, 1.9, -0.6, 0.38, 0.28, T.goods(["diyas", "kandil", "mithai", "rangoli"][v]), Math.PI / 2); // a family photo-calendar on the side wall
    const sd = W(shelfX - 0.25, 1.2, -Z + 0.18); lamps.add(sd.x, sd.y, sd.z, { decal: false, spot: false });
    const sd2 = W(shelfX + 0.25, 1.2, -Z + 0.18); lamps.add(sd2.x, sd2.y, sd2.z, { decal: false, spot: false });
    for (let i = 0; i <= 12; i++) { const u = i / 12; const p = W(shelfX - 0.3 + u * 0.6, 1.98 - Math.sin(u * Math.PI) * 0.2, -Z + 0.08); marigolds.push([p.x, p.y, p.z, i % 2]); }
    mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.1, 10), M.brass, shelfX, 1.22, -Z + 0.16, inner); // lota with Gangajal
    // a wall patti on the right with steel thalis on edge and katoris
    addBox(0.26, 0.04, Math.min(1.6, d - 1.6), M.wood, X - 0.13, 1.45, 0.2, inner);
    for (let i = 0; i < 5; i++) { const th = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.015, 20), steelM, X - 0.15, 1.62, -0.4 + i * 0.28, inner); th.rotation.z = Math.PI / 2 - 0.15; }
    for (let i = 0; i < 4; i++) mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.05, 12), i % 2 ? M.brass : steelM, X - 0.13, 1.5, -0.3 + i * 0.3, inner);
    // the kitchen corner: a clay chulha with a tawa and embers (two homes in four), or a sewing machine
    if (v === 1 || v === 2) {
      const ch = mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.3, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0x7a4a2a, roughness: 1, side: THREE.DoubleSide }), X - 0.45, 0.37, Z - 1.05, inner);
      mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.02, 20), M.iron, X - 0.45, 0.53, Z - 1.05, inner);
      const em = W(X - 0.45, 0.25, Z - 1.05); lamps.add(em.x, em.y, em.z, { bowl: false, flame: 0.16, decal: false, tint: [1, 0.7, 0.5] });
      for (let i = 0; i < 3; i++) { const wd = mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.6, 6), M.bark, X - 0.85, 0.25, Z - 1.25 + i * 0.07, inner); wd.rotation.z = Math.PI / 2 - 0.1; }
      solid(X - 0.45, Z - 1.05, 0.7, 0.7);
      ch.castShadow = false;
    } else {
      addBox(0.6, 0.7, 0.4, M.darkWood, X - 0.35, 0.22, Z - 1.05, inner); // a sewing machine on its table
      addBox(0.4, 0.22, 0.16, new THREE.MeshStandardMaterial({ color: 0x111114, metalness: 0.6, roughness: 0.3 }), X - 0.35, 0.92, Z - 1.05, inner);
      solid(X - 0.35, Z - 1.05, 0.45, 0.65);
    }
    // a wall clock, and a transistor radio or a small TV on its stand
    const clock = new THREE.Group(); clock.position.set(-X + 1.05, h - 0.75, -Z + 0.02); inner.add(clock);
    mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 24), paintM(0x8a2a1a), 0, 0, 0.02, clock).rotation.x = Math.PI / 2;
    mesh(new THREE.CircleGeometry(0.135, 24), paintM(0xf4ecd8, { roughness: 0.4 }), 0, 0, 0.045, clock);
    const hourH = mesh(new THREE.PlaneGeometry(0.012, 0.08), M.dark, 0, 0.03, 0.05, clock), minH = mesh(new THREE.PlaneGeometry(0.008, 0.11), M.dark, 0, 0.045, 0.051, clock);
    hourH.geometry.translate(0, 0.0, 0); hourH.rotation.z = -1.1 - v; minH.rotation.z = 0.4 + v * 0.7;
    if (v === 3) {
      addBox(0.7, 0.55, 0.4, M.darkWood, 0.2, 0.22, -Z + 0.22, inner); // TV trolley
      addBox(0.62, 0.42, 0.34, paintM(0x1a1a1e, { roughness: 0.4 }), 0.2, 0.77, -Z + 0.22, inner);
      const scr = mesh(new THREE.PlaneGeometry(0.5, 0.33), new THREE.MeshBasicMaterial({ color: 0x8ab0d0 }), 0.2, 0.98, -Z + 0.395, inner);
      updaters.push((dt, tt) => { if (inner.visible) scr.material.color.setHSL(0.58 + Math.sin(tt * 0.9) * 0.05, 0.35, 0.45 + Math.sin(tt * 3.1) * 0.08); });
      solid(0.2, -Z + 0.22, 0.7, 0.4);
    } else {
      const ry = v % 2 ? 0.22 + 0.99 : 0.22 + 1.8; // on the trunks, or on top of the almirah
      addBox(0.34, 0.2, 0.1, paintM([0x7a1a1a, 0x1a3a5a, 0x2a2a2a][v % 3], { roughness: 0.5 }), X - 0.5, ry, -Z + 0.3, inner);
      mesh(new THREE.CircleGeometry(0.06, 16), paintM(0xc0b090, { roughness: 0.6 }), X - 0.58, ry + 0.1, -Z + 0.351, inner);
    }

    // a matka of cool water on its stand by the door
    const matka = new THREE.LatheGeometry([[0, 0], [0.1, 0.02], [0.2, 0.12], [0.22, 0.24], [0.17, 0.36], [0.09, 0.42], [0.1, 0.46], [0.08, 0.46]].map(([a, b]) => new THREE.Vector2(a, b)), 16);
    mesh(new THREE.TorusGeometry(0.14, 0.04, 6, 14), M.iron, -X + 0.35, 0.27, Z - 0.4, inner).rotation.x = Math.PI / 2;
    mesh(matka, M.clay, -X + 0.35, 0.27, Z - 0.4, inner);
    mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.01, 12), steelM, -X + 0.35, 0.74, Z - 0.4, inner);
    solid(-X + 0.35, Z - 0.4, 0.45, 0.45);
    // a clothesline across the room with the new Diwali clothes airing on it
    const lineZ = -0.3;
    mesh(new THREE.CylinderGeometry(0.006, 0.006, w - 2 * t), ropeLine, 0, h - 0.55, lineZ, inner).rotation.z = Math.PI / 2;
    const SA = [["#c2185b", "#f2b705"], ["#0d6e7a", "#e8a020"], ["#e8641a", "#6a1b9a"], ["#2e7d32", "#c8102a"]][v];
    const cloth1 = mesh(new THREE.PlaneGeometry(0.5, 1.1), new THREE.MeshStandardMaterial({ map: T.sari(SA[0], SA[1]), side: THREE.DoubleSide, roughness: 0.7 }), -X + 0.6, h - 1.1, lineZ, inner);
    const cloth2 = mesh(new THREE.PlaneGeometry(0.4, 0.7), new THREE.MeshStandardMaterial({ color: 0xf2ece0, side: THREE.DoubleSide, roughness: 0.8 }), X - 0.9, h - 0.9, lineZ, inner);
    const sway = rand(0, 6);
    updaters.push((dt, tt) => { if (inner.visible) { cloth1.rotation.x = Math.sin(tt * 0.7 + sway) * 0.05; cloth2.rotation.x = Math.sin(tt * 0.8 + sway + 1) * 0.05; } });
    // lamps in the side-wall niche, a small ring of diyas on the floor inside the door, and a string of lights
    addBox(0.4, 0.04, 0.12, M.darkWood, -X + 0.06, 1.25, 0.4, inner);
    const ni = W(-X + 0.1, 1.29, 0.4); lamps.add(ni.x, ni.y, ni.z, { decal: false, scale: 1.1 });
    const rc = W(0.2, 0.232, Z - 0.75); lamps.ring(rc.x, rc.y, rc.z, 0.32, 5, { spot: false });
    // unlit diyas waiting for the visitor: along the inside of the front wall and on the puja shelf
    const home = { lit: 0, diyas: [] };
    g.userData.homeState = home;
    const spots = [];
    // along the foot of both side walls (in view as you come in), and two on the puja shelf
    for (let i = 0; i < 3; i++) spots.push([-X + 0.18, 0.235, -0.35 + i * 0.45], [X - 0.18, 0.235, -1.0 + i * 0.4]);
    spots.push([shelfX - 0.1, 1.2, -Z + 0.2], [shelfX + 0.1, 1.2, -Z + 0.2]);
    for (const [lx, ly, lz] of spots) {
      const p = W(lx, ly, lz);
      const d = { x: p.x, y: p.y, z: p.z, id: lamps.add(p.x, p.y, p.z, { lit: false, decal: false, scale: 1.25 }), lit: false, t: 0, home };
      home.diyas.push(d); (api.homeDiyas ||= []).push(d);
    }
    home.spot = lamps.spot(W(0, 0.6, Z - 0.6).x, 0.6, W(0, 0.6, Z - 0.6).z, 4, 0xffa050, { on: 0, range: 6 });
    strand(W(-X + 0.1, h - 0.22, -Z + 0.1), W(X - 0.1, h - 0.22, -Z + 0.1), 0.15, [PALETTES.warm, PALETTES.multi, PALETTES.gold, PALETTES.pink][v], v % 3, 0.14);
    // someone at home
    const folks = [];
    if (v === 0) { folks.push(placeIn(g, { kind: "elder", pose: "sit" }, (-X + 1.2) * fx, -Z + 0.55, (0) * fx, 0.67), placeIn(g, { kind: "woman", pose: "squat" }, (0.2) * fx, Z - 1.15, (Math.PI) * fx)); }
    else if (v === 1) { folks.push(placeIn(g, { kind: "woman", pose: "stir" }, (X - 0.9) * fx, Z - 1.05, (Math.PI / 2) * fx), placeIn(g, { kind: "child", pose: "wave" }, (-X + 0.8) * fx, 0.3, (Math.PI / 2 + 0.4) * fx)); }
    else if (v === 2) { folks.push(placeIn(g, { kind: "woman", pose: "sit" }, (-X + 0.9) * fx, -Z + 0.55, (0) * fx, 0.67), placeIn(g, { kind: "girl", pose: "sit" }, (-X + 1.5) * fx, -Z + 0.55, (0) * fx, 0.67), placeIn(g, { kind: "man", pose: "namaste" }, (X - 1.2) * fx, -0.2, (-Math.PI / 2 - 0.3) * fx)); }
    else { folks.push(placeIn(g, { kind: "man", pose: "sit" }, (-X + 1.3) * fx, -Z + 0.55, (0) * fx, 0.67), placeIn(g, { kind: "woman", pose: "squat" }, (-0.4) * fx, Z - 1.1, (Math.PI - 0.5) * fx)); }
    // only draw the room when someone could see into it
    const centre = W(0, 0, 0);
    updaters.push((dt, tt, cam) => {
      if (!cam) return;
      const near = cam.position.distanceToSquared(centre) < 22 * 22;
      if (near !== inner.visible) { inner.visible = near; for (const p of folks) p.group.visible = near; }
    });
  }

  /* ===================================================================== */
  /* the hidden diyas hunt                                                 */
  /* ===================================================================== */
  api.hunt = [
    [-12.2, 0, 44.1], [4.8, 0, 56.4], [21.6, 0, 51.2], [-24, 0, 30.2], [-16, 0, 28.3], [16.9, 0, 7.4],
    [-11.6, 0, -14.2], [4.6, 0, -34.2], [33.8, 0, -24], [-23.2, 3.38, -16.4], [-1.6, 0, -20], [16.2, 0, -14.2],
  ].map(([x, y, z]) => ({ x, y, z, id: lamps.add(x, y + 0.01, z, { lit: false, scale: 1.25 }), spot: lamps.spot(x, y + 0.2, z, 3, 0xffa050, { on: 0 }), lit: false }));

  /* ===================================================================== */
  /* ground, sky-line, distant villages                                     */
  /* ===================================================================== */
  const groundMat = new THREE.MeshStandardMaterial({ map: T.ground(), roughness: 1, bumpMap: T.ground(), bumpScale: 3 });
  const ground = mesh(new THREE.PlaneGeometry(300, 300), groundMat, 0, 0, 0);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;

  // treeline ring and the glow of other villages on the horizon
  const tl = T.treeline();
  tl.repeat.set(5, 1);
  const ring = mesh(new THREE.CylinderGeometry(110, 110, 18, 48, 1, true), new THREE.MeshBasicMaterial({ map: tl, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }), 0, 7, 0);
  ring.renderOrder = -1;
  const far = [];
  for (let v = 0; v < 9; v++) {
    const a = (v / 9) * Math.PI * 2 + rand(-0.2, 0.2), R = rand(118, 150);
    for (let i = 0; i < 40; i++) {
      const aa = a + rand(-0.06, 0.06), rr = R + rand(-6, 6);
      far.push(Math.cos(aa) * rr, rand(0.3, 2.5), Math.sin(aa) * rr);
    }
  }
  const farGeo = new THREE.BufferGeometry();
  farGeo.setAttribute("position", new THREE.Float32BufferAttribute(far, 3));
  scene.add(new THREE.Points(farGeo, new THREE.PointsMaterial({ map: T.glow(), color: 0xffa860, size: 1.4, sizeAttenuation: true, fog: false, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })));

  /* ===================================================================== */
  /* the lane                                                              */
  /* ===================================================================== */
  house({ x: -8, z: 50, w: 7, d: 5, rot: Math.PI / 2, roof: "tile", wall: 0, door: "#2a5a8a", kandil: 0xff7a20 });
  house({ x: -8, z: 40, w: 6, d: 5, rot: Math.PI / 2, roof: "thatch", wall: 3, door: "#3a6a3a", enter: true, interior: guestRoom, name: "मेहमान · Neighbours visiting", palette: "multi", lightMode: 1 });
  house({ x: 8.5, z: 52, w: 7, d: 5, rot: -Math.PI / 2, roof: "flat", wall: 2, door: "#1f6a5a", kandil: 0xff3a6a });
  house({ x: 9, z: 42, w: 6, d: 5, rot: -Math.PI / 2, roof: "flat", wall: 1, door: "#6a2a6a", mine: true }); // becomes the visitor's own house
  house({ x: 9, z: 32.5, w: 5, d: 4.5, rot: -Math.PI / 2, roof: "thatch", wall: 0, door: "#2a4a8a", kandil: 0x4aa0ff });
  house({ x: -9, z: 7.5, w: 6, d: 5, rot: Math.PI / 2, roof: "flat", wall: 0, door: "#8a2a2a" });
  house({ x: -18, z: 1.5, w: 6, d: 5, rot: Math.PI / 2, roof: "thatch", wall: 1, door: "#2a5a8a" });
  house({ x: 17, z: -6, w: 6, d: 5, rot: -Math.PI / 2, roof: "flat", wall: 2, door: "#2a6a4a", kandil: 0xffc040 });
  house({ x: -12, z: -38, w: 5, d: 4, rot: 0, roof: "thatch", wall: 3 });
  house({ x: 12, z: -38, w: 5, d: 4, rot: 0, roof: "tile", wall: 0 });
  house({ x: -30, z: 32, w: 6, d: 5, rot: Math.PI / 2, roof: "thatch", wall: 0 });
  house({ x: 24, z: 34, w: 6, d: 5, rot: -Math.PI / 2, roof: "flat", wall: 2 });
  house({ x: -32, z: -2, w: 6, d: 5, rot: Math.PI / 2, roof: "flat", wall: 2 });
  house({ x: 30, z: 10, w: 6, d: 5, rot: -Math.PI / 2, roof: "thatch", wall: 3 });
  house({ x: 4, z: 64, w: 6, d: 5, rot: Math.PI, roof: "flat", wall: 0 });

  tree(4.5, 57, { h: 8, r: 4, trunk: 0.35 }); // neem at the village entrance
  tree(15, 25, { h: 7, r: 3.5 });
  tree(-27, 13, { h: 6.5, r: 3.8, hue: 1 }); // mango
  tree(-9, -27, { h: 10, r: 5, trunk: 0.5 }); // peepal by the temple
  tree(32, -40, { h: 12, r: 2.5, trunk: 0.25 });
  tree(-41, -26, { h: 9, r: 4 });
  tree(36, 24, { h: 8, r: 4 });

  // hand pump on its concrete pad
  addBox(1.4, 0.12, 1.4, M.top[1], 2.6, 0, 46, scene);
  mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.1, 10), M.iron, 2.6, 0.67, 46);
  mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 8), M.iron, 2.6, 0.95, 46.18).rotation.x = Math.PI / 2;
  const handle = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), M.iron, 2.6, 1.25, 45.6);
  handle.rotation.x = 1.1;
  circle(2.6, 46, 0.5);

  // haystacks and a bullock cart
  for (const [hx, hz, hs] of [[-14, 46, 1.6], [-15, 43, 1.2], [25, 52, 1.4]]) {
    const hay = mesh(new THREE.SphereGeometry(hs, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.straw, hx, 0, hz);
    hay.scale.y = 1.5;
    mesh(new THREE.ConeGeometry(0.15, 0.5, 8), M.straw, hx, hs * 1.5 + 0.2, hz);
    circle(hx, hz, hs);
  }
  {
    const cart = new THREE.Group();
    cart.position.set(-5.6, 0, 33.5);
    cart.rotation.y = 0.4;
    scene.add(cart);
    addBox(1.4, 0.08, 2.4, M.wood, 0, 0.85, 0, cart);
    for (const s of [-1, 1]) {
      const wheel = mesh(new THREE.TorusGeometry(0.55, 0.05, 6, 20), M.darkWood, s * 0.8, 0.6, 0.2, cart);
      wheel.rotation.y = Math.PI / 2;
      for (let k = 0; k < 6; k++) { const sp = mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1), M.darkWood, s * 0.8, 0.6, 0.2, cart); sp.rotation.x = (k / 6) * Math.PI; }
    }
    for (const s of [-1, 1]) { const shaft = mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6), M.wood, s * 0.3, 0.55, 2.2, cart); shaft.rotation.x = Math.PI / 2 - 0.25; }
    aabb(-5.6, 33.5, 1.3, 1.8);
  }

  /* ===================================================================== */
  /* stop 2: the courtyard (aangan)                                        */
  /* ===================================================================== */
  const ch = house({ x: -20, z: 22, w: 12, d: 4, h: 3, rot: Math.PI / 2, roof: "tile", wall: 1, door: "#2a5a8a", kandil: 0xff6a20, windows: [-3.5, 3.5], enter: true, interior: pujaRoom, name: "लक्ष्मी पूजन · The family puja", palette: "gold", lightMode: 0 });
  const cw = 1.35, ct = 0.35;
  const cwalls = [
    [-14.5, 27, 7, ct], [-14.5, 17, 7, ct], // north, south
    [-11, 18.65, ct, 3.3], [-11, 25.85, ct, 2.3], // east, with gate z 20.3..24.7
  ];
  for (const [x, z, w, d] of cwalls) {
    const b = wallBlock(w, cw, d, 1);
    b.position.set(x, cw / 2, z);
    scene.add(b);
    aabb(x, z, w / 2, d / 2);
    const long = w > d;
    lamps.row(
      [x - (long ? w / 2 - 0.15 : 0), cw, z - (long ? 0 : d / 2 - 0.15)],
      [x + (long ? w / 2 - 0.15 : 0), cw, z + (long ? 0 : d / 2 - 0.15)],
      Math.round(Math.max(w, d) / 0.4), { spotPower: 2.2 });
  }
  // gate posts with torans
  for (const gz of [20.3, 24.7]) addBox(0.45, 1.8, 0.45, M.wall[1], -11, 0, gz);
  {
    const gg = new THREE.Group(); gg.position.set(-11, 0, 22.5); gg.rotation.y = Math.PI / 2; scene.add(gg); gg.updateMatrixWorld();
    toran(gg, 0, 1.75, 0, 4.2);
  }
  // cow-dung plastered floor, darker and smoother than the lane
  const floor = mesh(new THREE.PlaneGeometry(7, 9.6), new THREE.MeshStandardMaterial({ map: T.plaster(0), color: 0x6a5038, roughness: 0.9 }), -14.5, 0.006, 22);
  floor.rotation.x = -Math.PI / 2;
  // rangoli with a ring of diyas
  const rg = mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshStandardMaterial({ map: T.rangoli(1), transparent: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }), -14.6, 0.012, 22.2);
  // the visitor can redesign it; "reset" brings back the family's own design
  // a rangoli the visitor drew by hand, as a ready texture
  api.setCourtyardRangoliTexture = (tex) => {
    const old = rg.material.map;
    rg.material.map = tex; rg.material.needsUpdate = true;
    if (old && old !== T.rangoli(1)) old.dispose();
  };
  api.setCourtyardRangoli = (opts) => {
    const old = rg.material.map;
    rg.material.map = opts ? T.rangoliTexture(opts) : T.rangoli(1);
    rg.material.needsUpdate = true;
    if (old && old !== T.rangoli(1)) old.dispose();
  };
  rg.rotation.x = -Math.PI / 2;
  lamps.ring(-14.6, 0.012, 22.2, 1.45, 12, { spotPower: 4 });
  // Lakshmi's footprints from the rangoli to the door
  for (let i = 0; i < 3; i++) {
    const fp = mesh(new THREE.PlaneGeometry(0.28, 0.55), new THREE.MeshBasicMaterial({ map: T.footprints(), transparent: true, color: 0xcccccc, polygonOffset: true, polygonOffsetFactor: -2 }), -16.3 - i * 0.55, 0.013, 22.1);
    fp.rotation.x = -Math.PI / 2;
    fp.rotation.z = Math.PI / 2;
  }
  // tulsi chaura with the first diya of the evening (lit by the visitor)
  addBox(0.75, 0.85, 0.75, M.wall[2], -15, 0, 18.6);
  addBox(0.9, 0.1, 0.9, M.top[1], -15, 0.85, 18.6);
  for (let i = 0; i < 6; i++) leafCards.push([-15 + rand(-0.15, 0.15), 1.15 + rand(0, 0.4), 18.6 + rand(-0.15, 0.15), rand(0.35, 0.55), 1]);
  for (const [ox, oz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) lamps.add(-15 + ox, 0.95, 18.6 + oz, { decal: false, spot: false });
  api.tulsiDiya = lamps.add(-15, 0.012, 19.25, { lit: false, scale: 1.3 });
  api.tulsiSpot = lamps.spot(-15, 0.6, 19.4, 4, 0xffa050, { on: 0 });
  aabb(-15, 18.6, 0.5, 0.5);
  // charpai with an elder on it
  {
    const cp = new THREE.Group(); cp.position.set(-14.5, 0, 25.6); scene.add(cp);
    const top = mesh(new THREE.PlaneGeometry(1.9, 0.9), new THREE.MeshStandardMaterial({ map: T.weave(), roughness: 1, side: THREE.DoubleSide }), 0, 0.45, 0, cp);
    top.rotation.x = -Math.PI / 2;
    for (const [lx, lz] of [[-0.9, -0.42], [0.9, -0.42], [-0.9, 0.42], [0.9, 0.42]]) addBox(0.07, 0.45, 0.07, M.darkWood, lx, 0, lz, cp);
    for (const s of [-1, 1]) { addBox(1.95, 0.07, 0.07, M.darkWood, 0, 0.42, s * 0.44, cp); addBox(0.07, 0.07, 0.95, M.darkWood, s * 0.95, 0.42, 0, cp); }
    aabb(-14.5, 25.6, 1, 0.5);
  }
  // brass puja thali and lota by the door
  mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.015, 24), M.brass, -17.5, 0.23, 23.4);
  mesh(new THREE.SphereGeometry(0.1, 12, 10), M.brass, -17.5, 0.33, 20.6);

  /* ===================================================================== */
  /* stop 3: the potter's yard                                             */
  /* ===================================================================== */
  house({ x: 21, z: 17, w: 5, d: 4, rot: -Math.PI / 2, roof: "thatch", wall: 3, door: "#5a3a1a", kandil: 0xffb030 });
  {
    // open shed on poles
    const shed = new THREE.Group(); shed.position.set(15, 0, 12); scene.add(shed);
    for (const [px, pz] of [[-3, -3], [3, -3], [-3, 3], [3, 3], [0, -3], [0, 3]]) mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.5, 8), M.bark, px, 1.25, pz, shed);
    const r = gableRoof(6, 6, 1.1, 0.4, M.thatch); r.position.y = 2.5; shed.add(r);
    // wheel: stone pivot, wooden wheel, clay lump
    const wheel = new THREE.Group(); wheel.position.set(-1, 0, 0.5); shed.add(wheel);
    mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.25, 10), M.unfired, 0, 0.12, 0, wheel);
    const disc = mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.12, 24), M.darkWood, 0, 0.3, 0, wheel);
    const lump = mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.2, 14), new THREE.MeshStandardMaterial({ color: 0x6a4a34, roughness: 0.6 }), 0, 0.46, 0, wheel);
    for (let k = 0; k < 6; k++) mesh(new THREE.BoxGeometry(0.06, 0.02, 0.5), M.wood, 0, 0.37, 0, disc).rotation.y = (k / 6) * Math.PI;
    const fresh = mesh(new THREE.LatheGeometry([[0, 0], [0.04, 0.003], [0.07, 0.02], [0.085, 0.045], [0.078, 0.05], [0.065, 0.032], [0, 0.03]].map(([a, b]) => new THREE.Vector2(a, b)), 20), lump.material, 0, 0.36, 0, wheel);
    fresh.scale.setScalar(0.001);
    api.wheel = { spin: 0.3, disc, lump, throw: 0 };
    updaters.push((dt) => {
      const w = api.wheel;
      disc.rotation.y += dt * w.spin * 6;
      lump.rotation.y = fresh.rotation.y = disc.rotation.y;
      w.spin += (0.3 - w.spin) * dt * 0.2;
      if (w.throw > 0) {
        w.throw = Math.min(2.2, w.throw + dt * 0.5);
        const k = w.throw;
        if (k < 1) { lump.scale.set(1 - k * 0.35, 1 + k * 0.8, 1 - k * 0.35); fresh.scale.setScalar(0.001); } // coned up
        else { const u = Math.min(1, k - 1); lump.scale.set(0.65 + u * 0.55, 1.8 - u * 1.6, 0.65 + u * 0.55); lump.visible = u < 0.9; fresh.scale.setScalar(Math.max(0.001, u * 1.6)); } // opened into a diya
        if (k >= 2.2) { w.throw = 0; setTimeout(() => { lump.scale.set(1, 1, 1); lump.visible = true; fresh.scale.setScalar(0.001); }, 6000); }
      }
    });
    // matkas in sizes, some fired, some drying
    const potGeo = new THREE.LatheGeometry([[0, 0], [0.12, 0.02], [0.2, 0.12], [0.22, 0.24], [0.17, 0.36], [0.09, 0.42], [0.1, 0.46], [0.08, 0.46]].map(([a, b]) => new THREE.Vector2(a, b)), 16);
    for (let i = 0; i < 22; i++) {
      const p = mesh(potGeo, i % 3 ? M.clay : M.unfired, rand(0.8, 2.6), 0, rand(-2.6, 2.6), shed);
      p.scale.setScalar(rand(0.6, 1.3));
    }
    aabb(15, 12, 3.1, 3.1);
    // a hurricane lantern hung from the ridge pole
    lamps.add(14.2, 2.05, 12.4, { bowl: false, flame: 0.1, decal: false });
    mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.2, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd090, transparent: true, opacity: 0.35, side: THREE.DoubleSide }), 14.2, 2.12, 12.4);
    lamps.spot(14.2, 1.6, 12.4, 5, 0xffb060, { range: 8 });
  }
  // thousands of diyas drying on mats (unlit)
  {
    const mat = mesh(new THREE.PlaneGeometry(4, 1.6), new THREE.MeshStandardMaterial({ map: T.weave(), color: 0x8a7a5a }), 11.5, 0.01, 16.8);
    mat.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 18; i++) for (let j = 0; j < 7; j++) lamps.add(9.7 + i * 0.2, 0.012, 16.15 + j * 0.2, { lit: false, decal: false, rot: 0, scale: 0.95 });
    aabb(11.5, 16.8, 2, 0.8);
  }
  // kiln: earth dome with a glowing mouth
  {
    const kiln = mesh(new THREE.SphereGeometry(1.4, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5a3a26, roughness: 1 }), 19.5, 0, 9);
    kiln.scale.y = 0.9;
    const mouth = mesh(new THREE.CircleGeometry(0.42, 16, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0xff7a2a }), 19.5, 0.02, 10.38);
    api.kilnMouth = mouth;
    for (let i = 0; i < 5; i++) lamps.add(19.3 + i * 0.1, 0.05, 10.2, { bowl: false, flame: 0.35, decal: false, tint: [1, 0.8, 0.6] });
    api.kilnSpot = lamps.spot(19.5, 0.6, 11, 9, 0xff6a20, { flicker: 2.5, range: 9 });
    circle(19.5, 9, 1.5);
  }

  /* ===================================================================== */
  /* stop 4: the banyan chaupal and the haat                               */
  /* ===================================================================== */
  {
    const BX = -2, BZ = -4;
    mesh(new THREE.CylinderGeometry(3.4, 3.5, 0.55, 40), M.top[0], BX, 0.275, BZ); // chabutra
    mesh(new THREE.CylinderGeometry(1.1, 1.4, 6, 14), M.bark, BX, 3, BZ); // trunk
    // red threads tied round the trunk
    for (let k = 0; k < 4; k++) mesh(new THREE.TorusGeometry(1.24, 0.015, 4, 30), new THREE.MeshStandardMaterial({ color: 0xc0101a, emissive: 0x300000 }), BX, 1.3 + k * 0.08, BZ).rotation.x = Math.PI / 2;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2, len = 6;
      const b = mesh(new THREE.CylinderGeometry(0.18, 0.4, len, 8), M.bark, BX + Math.cos(a) * 2.2, 6.4, BZ + Math.sin(a) * 2.2);
      b.lookAt(BX + Math.cos(a) * 7, 7.5, BZ + Math.sin(a) * 7);
      b.rotateX(Math.PI / 2);
    }
    // aerial roots
    for (let i = 0; i < 16; i++) {
      const a = rand(0, Math.PI * 2), rr = rand(3.8, 5.2), hh = rand(5, 7);
      if (Math.abs(Math.atan2(Math.sin(a - 0.85), Math.cos(a - 0.85))) < 1.1) continue; // keep the view from the haat open
      mesh(new THREE.CylinderGeometry(0.03, 0.06, hh, 5), M.bark, BX + Math.cos(a) * rr, hh / 2, BZ + Math.sin(a) * rr);
      if (rr > 4) circle(BX + Math.cos(a) * rr, BZ + Math.sin(a) * rr, 0.15);
    }
    for (let i = 0; i < 70; i++) {
      const a = rand(0, Math.PI * 2), rr = Math.sqrt(Math.random()) * 9;
      for (let k = 0; k < 5; k++) leafCards.push([BX + Math.cos(a) * rr + rand(-0.6, 0.6), rand(6.5, 10.5) - rr * 0.15, BZ + Math.sin(a) * rr + rand(-0.6, 0.6), rand(1.6, 2.6), 0]);
    }
    lamps.ring(BX, 0.55, BZ, 3.25, 28, { spotPower: 6 });
    // a rangoli on the chabutra itself, round the trunk
    const crg = mesh(new THREE.RingGeometry(1.45, 3.1, 64), new THREE.MeshStandardMaterial({ map: T.rangoliTexture({ style: "surya", palette: "gulab", petals: 20, rings: 4 }), transparent: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }), BX, 0.556, BZ);
    crg.rotation.x = -Math.PI / 2;
    // ring UVs: map the square texture across the ring's full span
    { const uv = crg.geometry.attributes.uv, pp = crg.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pp.getX(i) / 6.2 + 0.5, pp.getY(i) / 6.2 + 0.5); }
    api.setChaupalRangoli = (opts) => {
      const old = crg.material.map;
      crg.material.map = T.rangoliTexture(opts || { style: "surya", palette: "gulab", petals: 20, rings: 4 });
      crg.material.needsUpdate = true;
      old.dispose();
    };
    // little shrine stone with sindoor at the trunk
    mesh(new THREE.SphereGeometry(0.25, 10, 8), new THREE.MeshStandardMaterial({ color: 0xc8401a, roughness: 0.6 }), BX + 1.2, 0.7, BZ + 0.9);
    lamps.ring(BX + 1.2, 0.55, BZ + 0.9, 0.35, 5, { spot: false });
    circle(BX, BZ, 3.5);
    // string of bulbs from the banyan to the stalls
    const bulbs = [];
    const strands = [[-9.5, -1], [-10, -5.5], [-8.5, -10], [-3, -13], [2.5, -13.5], [9, -4], [9.5, 2.5]];
    for (const [sx, sz] of strands) {
      for (let k = 1; k < 14; k++) {
        const u = k / 14;
        bulbs.push(BX + (sx - BX) * u, 4.2 - Math.sin(u * Math.PI) * 0.9 - u * 1.4, BZ + (sz - BZ) * u);
      }
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute("position", new THREE.Float32BufferAttribute(bulbs, 3));
    scene.add(new THREE.Points(bg, new THREE.PointsMaterial({ map: T.glow(), color: 0xffd080, size: 0.35, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })));
  }

  /*
   * A village haat stall: bamboo poles lashed with rope, a sagging tarpaulin, a wooden takht
   * spread with jute, real goods on it, one bare bulb on a wire and a cardboard sign.
   */
  const bambooMat = new THREE.MeshStandardMaterial({ map: T.bamboo(), roughness: 0.7 });
  const juteMat = new THREE.MeshStandardMaterial({ map: T.jute(), bumpMap: T.jute(), bumpScale: 3, roughness: 1 });
  const caneMat = new THREE.MeshStandardMaterial({ map: T.cane(), bumpMap: T.cane(), bumpScale: 2, roughness: 0.9, side: THREE.DoubleSide });
  const clayRaw = new THREE.MeshStandardMaterial({ color: 0x9a8a78, roughness: 1 });
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x8a7448, roughness: 1 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0xc0c4c8, metalness: 0.9, roughness: 0.3 });
  const alum = new THREE.MeshStandardMaterial({ color: 0xa8acb0, metalness: 0.8, roughness: 0.45 });

  function tarpaulin(w, d, hex, sagAmt = 0.16) {
    const geo = new THREE.PlaneGeometry(w, d, 18, 12);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) / (w / 2), v = p.getY(i) / (d / 2);
      let zz = -sagAmt * (1 - u * u) * (1 - v * v);
      zz += 0.025 * Math.sin(u * 9 + v * 4) * Math.sin(v * 7); // wrinkles
      if (v < -0.82) zz -= (v + 0.82) * -1.6; // the front edge flops down
      p.setZ(i, zz);
    }
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: T.tarp(hex), roughness: 0.55, side: THREE.DoubleSide }));
  }

  function idol(parent, x, y, z, s, kind, painted) {
    const skin = painted ? paintM([0xe8833a, 0xd9a53a, 0xf0c8a0][kind % 3]) : clayRaw;
    const cloth = painted ? paintM([0xc21f3a, 0x1d4fb0, 0x2e7d32, 0x7a1aa0][(kind + 1) % 4]) : clayRaw;
    const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
    mesh(new THREE.CylinderGeometry(0.075 * s, 0.085 * s, 0.04 * s, 12), painted ? paintM(0xe86a8a) : clayRaw, 0, 0.02 * s, 0, g); // lotus base
    mesh(new THREE.SphereGeometry(0.075 * s, 10, 8), cloth, 0, 0.09 * s, 0, g).scale.set(1.15, 0.8, 0.9);
    mesh(new THREE.SphereGeometry(0.055 * s, 10, 8), skin, 0, 0.16 * s, 0, g);
    mesh(new THREE.SphereGeometry(0.045 * s, 10, 8), skin, 0, 0.23 * s, 0.005 * s, g);
    if (kind % 2 === 0) { // Ganesha: ears and trunk
      for (const sd of [-1, 1]) mesh(new THREE.SphereGeometry(0.04 * s, 8, 6), skin, sd * 0.045 * s, 0.235 * s, -0.005 * s, g).scale.set(0.6, 1, 0.3);
      const tr = mesh(new THREE.CylinderGeometry(0.01 * s, 0.016 * s, 0.07 * s, 6), skin, -0.005 * s, 0.19 * s, 0.04 * s, g); tr.rotation.x = 0.4;
    }
    mesh(new THREE.ConeGeometry(0.03 * s, 0.05 * s, 8), painted ? M.brass : clayRaw, 0, 0.28 * s, 0, g); // mukut
    if (painted) mesh(new THREE.TorusGeometry(0.11 * s, 0.006 * s, 4, 16, Math.PI), paintM(0xd9a53a, { metalness: 0.5 }), 0, 0.17 * s, -0.04 * s, g); // halo
    return g;
  }

  function tarazu(parent, x, y, z) { // the shopkeeper's hanging scale
    const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
    mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 6), M.iron, 0, 0.42, 0, g).rotation.z = Math.PI / 2;
    for (const s of [-1, 1]) {
      for (let k = 0; k < 3; k++) { const ln = mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.3, 4), ropeMat, s * 0.25 + Math.cos(k * 2.1) * 0.05, 0.27, Math.sin(k * 2.1) * 0.05, g); ln.rotation.z = Math.cos(k * 2.1) * 0.15; }
      mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.025, 14), M.brass, s * 0.25, 0.12, 0, g);
    }
    mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 4), ropeMat, 0, 0.52, 0, g);
  }

  /* laiya-gatta: the puja's khil-batashe, puffed rice heaped in baskets, sugar drops and sticks, sugar toys */
  const grainGeo = new THREE.SphereGeometry(1, 5, 4);
  const sugarM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });
  const dummy = new THREE.Object3D(), tint = new THREE.Color();
  // a heap of puffed grains: a solid dome underneath, a crust of individual grains on top
  function grainHeap(g, x, y, z, r, rise, cols, n = 260, size = 0.016) {
    const dome = mesh(new THREE.SphereGeometry(r, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: cols[0], roughness: 1 }), x, y, z, g);
    dome.scale.y = rise / r;
    const im = new THREE.InstancedMesh(grainGeo, sugarM, n);
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), rr = Math.sqrt(Math.random()) * r * 0.98, hy = rise * Math.sqrt(Math.max(0, 1 - (rr / r) ** 2));
      dummy.position.set(x + Math.cos(a) * rr, y + hy + rand(-0.004, 0.006), z + Math.sin(a) * rr);
      dummy.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      dummy.scale.set(size * rand(0.8, 1.3), size * 0.6, size * 0.6);
      dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
      im.setColorAt(i, tint.set(cols[1 + (i % (cols.length - 1))]));
    }
    g.add(im);
    return im;
  }
  // batashe: little white domes of sugar on a steel paraat; gatta: white and pink sugar sticks
  function batasheTray(g, x, y, z, r = 0.2) {
    mesh(new THREE.CylinderGeometry(r, r - 0.02, 0.04, 22), steelMat, x, y + 0.02, z, g);
    const n = Math.round(r * r * 900), im = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), sugarM, n);
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), rr = Math.sqrt(Math.random()) * (r - 0.04), layer = rr < r * 0.5 ? rand(0, 0.03) : 0;
      dummy.position.set(x + Math.cos(a) * rr, y + 0.04 + layer, z + Math.sin(a) * rr);
      dummy.rotation.set(rand(-0.3, 0.3), rand(0, 3), rand(-0.3, 0.3));
      const sz = rand(0.022, 0.03); dummy.scale.set(sz, sz * 0.55, sz);
      dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
      im.setColorAt(i, tint.set(i % 7 ? 0xfffaf0 : 0xfff0c8));
    }
    g.add(im);
  }
  function gattaTray(g, x, y, z, r = 0.2) {
    mesh(new THREE.CylinderGeometry(r, r - 0.02, 0.04, 22), steelMat, x, y + 0.02, z, g);
    const n = Math.round(r * r * 700), im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), sugarM, n);
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), rr = Math.sqrt(Math.random()) * (r - 0.05);
      dummy.position.set(x + Math.cos(a) * rr, y + 0.055 + (rr < r * 0.45 ? rand(0, 0.04) : 0), z + Math.sin(a) * rr);
      dummy.rotation.set(rand(-0.4, 0.4), rand(0, 3), rand(-0.4, 0.4));
      dummy.scale.set(rand(0.05, 0.08), 0.022, 0.024);
      dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
      im.setColorAt(i, tint.set([0xfffaf2, 0xffc2d4, 0xfff6e0, 0xffd6a0][i % 4]));
    }
    g.add(im);
  }
  // chini ke khilone: elephants, horses and little temples cast in sugar, white, pink and saffron
  const toyCols = [0xfff8ee, 0xffc4d6, 0xffd890, 0xfff8ee, 0xc8f0d8];
  function sugarToy(g, x, y, z, kind, col, s = 1, yaw = 0) {
    const t2 = new THREE.Group(); t2.position.set(x, y, z); t2.rotation.y = yaw; t2.scale.setScalar(s); g.add(t2);
    const m2 = paintM(col, { roughness: 0.45, emissive: col, emissiveIntensity: 0.08 });
    if (kind === "haathi") {
      mesh(new THREE.SphereGeometry(0.05, 12, 8), m2, 0, 0.07, 0, t2).scale.set(1.3, 1, 0.95);
      mesh(new THREE.SphereGeometry(0.032, 10, 8), m2, 0.065, 0.1, 0, t2);
      const tr = mesh(new THREE.CylinderGeometry(0.008, 0.014, 0.07, 6), m2, 0.09, 0.065, 0, t2); tr.rotation.z = 0.35;
      for (const sx of [-1, 1]) mesh(new THREE.CircleGeometry(0.025, 10), m2, 0.06, 0.105, sx * 0.03, t2).rotation.y = sx * 1.2;
      for (const [lx, lz] of [[-0.035, -0.025], [-0.035, 0.025], [0.035, -0.025], [0.035, 0.025]]) mesh(new THREE.CylinderGeometry(0.012, 0.013, 0.04, 6), m2, lx, 0.02, lz, t2);
    } else if (kind === "ghoda") {
      mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.09, 8), m2, 0, 0.075, 0, t2).rotation.z = Math.PI / 2;
      const nk = mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.06, 6), m2, 0.05, 0.11, 0, t2); nk.rotation.z = -0.6;
      mesh(new THREE.BoxGeometry(0.045, 0.02, 0.02), m2, 0.075, 0.14, 0, t2);
      for (const [lx, lz] of [[-0.035, -0.015], [-0.035, 0.015], [0.035, -0.015], [0.035, 0.015]]) mesh(new THREE.CylinderGeometry(0.006, 0.007, 0.055, 5), m2, lx, 0.027, lz, t2);
    } else if (kind === "mandir") {
      mesh(new THREE.BoxGeometry(0.07, 0.06, 0.07), m2, 0, 0.03, 0, t2);
      mesh(new THREE.ConeGeometry(0.042, 0.09, 8), m2, 0, 0.105, 0, t2);
      mesh(new THREE.SphereGeometry(0.008, 6, 4), paintM(0xffb030), 0, 0.155, 0, t2);
    } else { // a little sugar fish
      mesh(new THREE.SphereGeometry(0.035, 10, 8), m2, 0, 0.04, 0, t2).scale.set(1.6, 1, 0.5);
      mesh(new THREE.ConeGeometry(0.025, 0.04, 4), m2, -0.065, 0.04, 0, t2).rotation.z = Math.PI / 2;
    }
  }
  function sugarToys(g, x0, y, z, n, span, s = 1.6) {
    const kinds = ["haathi", "ghoda", "mandir", "haathi", "machhli", "ghoda"];
    for (let i = 0; i < n; i++) sugarToy(g, x0 + (i / Math.max(1, n - 1)) * span, y, z + (i % 2) * 0.09, kinds[i % kinds.length], toyCols[i % toyCols.length], s, rand(-0.5, 0.5) + Math.PI / 2);
  }

  const goodsBuilders = {
    laiya(g) {
      // two big cane tokris heaped with laiya and khil, paraats of batashe and gatta, a plank of sugar toys
      for (const [lx, cols] of [[-0.85, [0xf0e6d2, 0xfffaf0, 0xf6ecd8, 0xfff4e4]], [-0.25, [0xe8dcc0, 0xfff8ec, 0xd8b888, 0xfff4e0]]]) {
        const b = mesh(new THREE.SphereGeometry(0.29, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), caneMat, lx, 0.69, 0.4, g); b.scale.y = 0.72;
        mesh(new THREE.TorusGeometry(0.29, 0.02, 6, 22), caneMat, lx, 0.69, 0.4, g).rotation.x = Math.PI / 2;
        grainHeap(g, lx, 0.69, 0.4, 0.28, 0.17, cols);
      }
      batasheTray(g, 0.35, 0.47, 0.45, 0.2);
      gattaTray(g, 0.85, 0.47, 0.45, 0.19);
      // a raised plank at the back with rows of sugar toys
      addBox(1.6, 0.22, 0.24, M.wood, -0.35, 0.47, -0.25, g);
      sugarToys(g, -1.05, 0.69, -0.3, 9, 1.4);
      // paper lifafa bags and a newspaper cone, and the tarazu
      for (let i = 0; i < 5; i++) addBox(0.13, 0.16, 0.06, paintM(0xb8925a, { roughness: 1 }), 0.25 + i * 0.03, 0.47 + i * 0.002, 0.0 - i * 0.01, g).rotation.y = 0.15;
      tarazu(g, 1.05, 0.47, -0.3);
    },
    murti(g) {
      const straw = mesh(new THREE.PlaneGeometry(2.3, 0.95), M.straw, 0, 0.475, 0.12, g); straw.rotation.x = -Math.PI / 2;
      for (let row = 0; row < 3; row++) for (let i = 0; i < 6; i++) {
        idol(g, -1.0 + i * 0.4 + (row % 2) * 0.15, 0.48, 0.45 - row * 0.32, 1.35 - row * 0.15 + (i % 2) * 0.15, i + row, (i + row) % 3 !== 2);
      }
      addBox(0.5, 0.35, 0.4, juteMat, 0.9, 0.47, -0.45, g); // crate draped in jute with bigger murtis
      idol(g, 0.8, 0.82, -0.45, 2.4, 0, true); idol(g, 1.02, 0.82, -0.45, 2.2, 1, true);
    },
    diyas(g) {
      const tokri = (lx, lz, n) => {
        const b = mesh(new THREE.SphereGeometry(0.28, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), caneMat, lx, 0.75, lz, g);
        b.scale.y = 0.75;
        g.updateMatrixWorld();
        for (let i = 0; i < n; i++) {
          const a = rand(0, 6.28), rr = Math.sqrt(Math.random()) * 0.22;
          const p = toWorld(g, lx + Math.cos(a) * rr, 0.6 + (0.22 - rr) * 0.6 + rand(0, 0.03), lz + Math.sin(a) * rr);
          lamps.add(p.x, p.y, p.z, { lit: false, decal: false, scale: 0.95 });
        }
      };
      tokri(-0.75, 0.25, 26); tokri(0, 0.3, 26); tokri(-0.4, -0.25, 22);
      g.updateMatrixWorld();
      for (let s2 = 0; s2 < 5; s2++) for (let k = 0; k < 9; k++) { // stacked towers
        const p = toWorld(g, 0.55 + (s2 % 3) * 0.17, 0.48 + k * 0.022, 0.35 - Math.floor(s2 / 3) * 0.2);
        lamps.add(p.x, p.y, p.z, { lit: false, decal: false, rot: 0, bowl: true });
      }
      for (let i = 0; i < 3; i++) { const p = toWorld(g, -0.9 + i * 0.25, 0.48, 0.62); lamps.add(p.x, p.y, p.z, { decal: false }); } // a few lit to show the buyer
      const pots = new THREE.LatheGeometry([[0, 0], [0.12, 0.02], [0.2, 0.12], [0.22, 0.24], [0.17, 0.36], [0.09, 0.42], [0.1, 0.46], [0.08, 0.46]].map(([a, b]) => new THREE.Vector2(a, b)), 14);
      for (let i = 0; i < 4; i++) mesh(pots, M.clay, -1.3 + i * 0.3, 0, 0.95 + (i % 2) * 0.15, g).scale.setScalar(0.7 + (i % 2) * 0.3);
    },
    mithai(g) {
      // glass showcase on the takht
      const glass = new THREE.MeshStandardMaterial({ color: 0xd8ecff, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.1, depthWrite: false });
      addBox(1.8, 0.55, 0.7, glass, -0.15, 0.47, 0.05, g);
      for (const [ex, ez] of [[-1.05, -0.3], [0.75, -0.3], [-1.05, 0.4], [0.75, 0.4]]) addBox(0.03, 0.55, 0.03, steelMat, ex, 0.47, ez, g);
      const tray = (lx, lz) => mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.025, 20), steelMat, lx, 0.5, lz, g);
      // ladoo pyramid
      tray(-0.75, 0.05);
      [[5, 0.05], [3, 0.11], [1, 0.17]].forEach(([n, yy], row) => { for (let i = 0; i < n * n && i < 9; i++) mesh(new THREE.SphereGeometry(0.035, 10, 8), paintM(0xf0a020, { roughness: 0.85 }), -0.75 + ((i % 3) - 1) * 0.07 * (1 - row * 0.3), 0.5 + yy, 0.05 + (Math.floor(i / 3) - 1) * 0.07 * (1 - row * 0.3), g); });
      // barfi squares: kaju katli and pista
      tray(-0.15, 0.05);
      for (let i = 0; i < 16; i++) { const b = addBox(0.06, 0.018, 0.06, paintM(i % 2 ? 0xeee2c8 : 0xb8d890, { roughness: 0.5 }), -0.27 + (i % 4) * 0.075, 0.515, -0.07 + Math.floor(i / 4) * 0.075, g); b.rotation.y = 0.785; }
      // jalebi coils
      tray(0.45, 0.05);
      for (let i = 0; i < 7; i++) { const j = mesh(new THREE.TorusGeometry(0.04, 0.012, 6, 18), paintM(0xff8a10, { roughness: 0.3, emissive: 0x401800 }), 0.45 + Math.cos(i) * (i ? 0.1 : 0), 0.53 + (i ? 0 : 0.02), 0.05 + Math.sin(i) * (i ? 0.1 : 0), g); j.rotation.x = Math.PI / 2; }
      // stack of boxes and a tarazu
      for (let i = 0; i < 6; i++) addBox(0.26, 0.06, 0.2, paintM([0xc8306a, 0xd9a53a][i % 2]), 1.0, 0.47 + i * 0.062, -0.3, g);
      tarazu(g, 1.0, 0.47, 0.3);
    },
    patakhe(g) {
      const cols = [0xd8203a, 0x1d4fb0, 0x1a8a4a, 0xff8a10, 0x7a1aa0, 0xf2b705];
      for (let i = 0; i < 22; i++) {
        const w = rand(0.18, 0.32), h = rand(0.05, 0.12), d = rand(0.14, 0.22);
        const b = addBox(w, h, d, paintM(cols[i % 6]), -1.05 + (i % 7) * 0.32, 0.47 + Math.floor(i / 7) * 0.13, 0.35 - Math.floor(i / 7) * 0.05, g);
        b.rotation.y = rand(-0.15, 0.15);
        mesh(new THREE.PlaneGeometry(w * 0.6, h * 0.6), paintM(0xf6efe2), 0, 0, d / 2 + 0.001, b);
      }
      for (let i = 0; i < 8; i++) { // anar cones in a row
        const c = mesh(new THREE.CylinderGeometry(0.03, 0.08, 0.16, 10), paintM(0xa8542a), -1.0 + i * 0.13, 0.55, 0.62, g);
        mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.02, 10), paintM(0xe8d8a0), 0, 0.09, 0, c);
      }
      for (let i = 0; i < 4; i++) { // bundles of phuljhadi in paper sleeves
        const b = addBox(0.05, 0.02, 0.32, paintM(0x3a6ad8), 0.4 + i * 0.12, 0.47, 0.55, g);
        b.rotation.y = rand(-0.2, 0.2);
      }
    },
    chudi(g) {
      // bangles strung on wooden rods on two stands
      const cols = [0xd81b60, 0xc0101a, 0x2e7d32, 0xf2b705, 0x1e88e5, 0x8e24aa, 0xff7043, 0xd9a53a, 0x00897b].map((c) => new THREE.Color(c));
      const ring = new THREE.TorusGeometry(0.035, 0.006, 6, 18);
      const rodsY = [0.8, 1.05, 1.3];
      const n = rodsY.length * 2 * 14 * 5;
      const im = new THREE.InstancedMesh(ring, new THREE.MeshStandardMaterial({ roughness: 0.15, metalness: 0.35 }), n);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
      let k = 0;
      for (const sx of [-0.65, 0.45]) {
        for (const ry of rodsY) {
          addBox(0.8, 0.02, 0.02, M.wood, sx, ry + 0.035, 0.1, g);
          for (let gI = 0; gI < 14; gI++) for (let j = 0; j < 5; j++) {
            m4.compose(v.set(sx - 0.36 + gI * 0.055 + j * 0.006, ry, 0.1), q, one);
            im.setMatrixAt(k, m4);
            im.setColorAt(k, cols[(gI + Math.round(ry * 10)) % cols.length]);
            k++;
          }
        }
        for (const ex of [-0.42, 0.42]) addBox(0.03, 0.95, 0.03, M.wood, sx + ex, 0.47, 0.1, g);
      }
      g.add(im);
      addBox(0.4, 0.08, 0.3, paintM(0xb3121f), 0.95, 0.47, 0.45, g); // velvet tray of bindi packets
    },
    khilone(g) {
      const cols = [0xe53935, 0xfdd835, 0x43a047, 0x1e88e5, 0xfb8c00, 0x8e24aa];
      for (let i = 0; i < 9; i++) { // clay horses and elephants
        const h = new THREE.Group(); h.position.set(-1.0 + i * 0.22, 0.47, 0.35 - (i % 2) * 0.25); h.rotation.y = rand(-0.5, 0.5); g.add(h);
        const c = paintM(cols[i % 6]);
        const b = mesh(new THREE.CapsuleGeometry(0.035, 0.08, 4, 8), c, 0, 0.1, 0, h); b.rotation.z = Math.PI / 2;
        for (const [lx, lz] of [[-0.04, -0.02], [0.04, -0.02], [-0.04, 0.02], [0.04, 0.02]]) mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.07, 5), c, lx, 0.035, lz, h);
        const hd = mesh(new THREE.CapsuleGeometry(0.022, 0.05, 4, 6), c, 0.07, 0.15, 0, h); hd.rotation.z = i % 2 ? -0.5 : 0.8;
        mesh(new THREE.SphereGeometry(0.012, 6, 4), paintM(0xffffff), 0, 0.12, 0.033, h);
      }
      // paper pinwheels turning in the breeze
      for (let i = 0; i < 5; i++) {
        mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.6), M.bark, 0.6 + i * 0.12, 0.77, 0.55, g);
        const wheelG = new THREE.Group(); wheelG.position.set(0.6 + i * 0.12, 1.07, 0.57); g.add(wheelG);
        for (let k = 0; k < 4; k++) { const bl = mesh(new THREE.CircleGeometry(0.06, 3), paintM(cols[(i + k) % 6], { side: THREE.DoubleSide }), 0, 0, 0, wheelG); bl.rotation.z = (k * Math.PI) / 2; bl.position.set(Math.cos(k * Math.PI / 2) * 0.04, Math.sin(k * Math.PI / 2) * 0.04, 0); }
        const sp = rand(3, 6);
        updaters.push((dt) => (wheelG.rotation.z += dt * sp));
      }
      // a bunch of balloons tied to the pole
      for (let i = 0; i < 10; i++) { const b = mesh(new THREE.SphereGeometry(0.1, 10, 8), paintM(cols[i % 6], { roughness: 0.25 }), -1.25 + Math.cos(i) * 0.18, 1.9 + (i % 3) * 0.16, -0.6 + Math.sin(i) * 0.18, g); b.scale.y = 1.2; }
    },
    rangoli(g) {
      const cols = [0xf4a020, 0xe0402a, 0xd6247a, 0x1aa3a3, 0x58a83a, 0x4b4fc9, 0xf3eadb, 0xffd21a];
      for (let i = 0; i < 8; i++) { // aluminium paraats heaped with powder
        const lx = -0.95 + (i % 4) * 0.48, lz = 0.35 - Math.floor(i / 4) * 0.5;
        mesh(new THREE.CylinderGeometry(0.21, 0.18, 0.05, 20), alum, lx, 0.5, lz, g);
        const heap = mesh(new THREE.ConeGeometry(0.17, 0.16, 20), paintM(cols[i], { roughness: 1 }), lx, 0.6, lz, g);
        heap.scale.y = 0.9;
      }
      tarazu(g, 1.05, 0.47, 0.35);
      for (let i = 0; i < 3; i++) mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.005, 16), steelMat, 1.05, 0.48 + i * 0.006, -0.25, g); // stencils
    },
  };

  const SIGNS = {
    laiya: ["लइया गट्टा", "खील बताशे"],
    murti: ["मूर्तियाँ", "₹ 51 से"], diyas: ["दीये", "₹ 10 दर्जन"], mithai: ["शुद्ध देसी घी", "मिठाई"],
    patakhe: ["ग्रीन पटाखे", "थोक भाव"], chudi: ["चूड़ी बिंदी", "₹ 20 जोड़ी"], khilone: ["खिलौने", "गुब्बारे ₹5"], rangoli: ["रंगोली रंग", "₹ 10 पाव"],
  };

  function stall(x, z, rot, goodsName, tarpHex, keeperKind = "man") {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    scene.add(g);
    g.updateMatrixWorld();
    const W = 2.8, D = 1.9;
    // bamboo frame: front poles shorter so the tarp sheds rain forward
    const poles = [[-W / 2, D / 2, 2.0], [W / 2, D / 2, 2.05], [-W / 2, -D / 2, 2.5], [W / 2, -D / 2, 2.45]];
    for (const [px, pz, ph] of poles) {
      const pole = mesh(new THREE.CylinderGeometry(0.035, 0.045, ph, 8), bambooMat, px, ph / 2, pz, g);
      pole.rotation.z = rand(-0.04, 0.04);
      pole.rotation.x = rand(-0.03, 0.03);
      mesh(new THREE.TorusGeometry(0.05, 0.015, 5, 10), ropeMat, px, ph - 0.08, pz, g).rotation.x = Math.PI / 2; // lashing
    }
    for (const pz of [D / 2, -D / 2]) { const bar = mesh(new THREE.CylinderGeometry(0.03, 0.03, W + 0.2, 8), bambooMat, 0, pz > 0 ? 1.98 : 2.42, pz, g); bar.rotation.z = Math.PI / 2; }
    const tp = tarpaulin(W + 0.7, D + 0.8, tarpHex);
    tp.rotation.x = -Math.PI / 2 + 0.24; // slope down to the front
    tp.position.set(0, 2.27, 0);
    g.add(tp);
    // takht spread with jute, a sack or two behind
    addBox(W - 0.3, 0.42, 1.2, M.darkWood, 0, 0.03, 0.15, g);
    for (const [lx, lz] of [[-1.15, 0.7], [1.15, 0.7], [-1.15, -0.4], [1.15, -0.4]]) addBox(0.08, 0.05, 0.08, M.darkWood, lx, 0, lz, g);
    addBox(W - 0.2, 0.02, 1.3, juteMat, 0, 0.45, 0.15, g);
    mesh(new THREE.PlaneGeometry(W - 0.2, 0.3), juteMat, 0, 0.32, 0.81, g); // hangs over the front edge
    for (let i = 0; i < 2; i++) { const sack = mesh(new THREE.CapsuleGeometry(0.22, 0.3, 4, 10), juteMat, -1.1 + i * 0.5, 0.35, -0.75, g); sack.scale.set(1, 1, 0.8); }
    goodsBuilders[goodsName](g);
    // one bare bulb on a wire, swaying a little
    const wire = new THREE.Group(); wire.position.set(0.2, 2.2, 0.25); g.add(wire);
    mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.45), M.dark, 0, -0.22, 0, wire);
    mesh(new THREE.SphereGeometry(0.055, 12, 10), new THREE.MeshBasicMaterial({ color: 0xfff2c8 }), 0, -0.5, 0, wire);
    const glowS = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow(), color: 0xffc870, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
    glowS.position.set(0, -0.5, 0); glowS.scale.setScalar(0.9); wire.add(glowS);
    const seed = rand(0, 9);
    updaters.push((dt, t) => { wire.rotation.z = Math.sin(t * 0.9 + seed) * 0.06; wire.rotation.x = Math.sin(t * 0.7 + seed) * 0.04; });
    const sp = toWorld(g, 0.2, 1.6, 0.45);
    lamps.spot(sp.x, sp.y - 0.5, sp.z, 5.5, 0xffd090, { flicker: 0.12, range: 7 });
    // cardboard sign propped against the front of the takht
    const [m1, m2] = SIGNS[goodsName];
    const sg = mesh(new THREE.PlaneGeometry(0.62, 0.36), new THREE.MeshStandardMaterial({ map: T.sign(m1, m2), roughness: 0.95 }), -0.85, 0.28, 0.86, g);
    sg.rotation.x = -0.2;
    // a couple of diyas at the stall's edge for the festival
    const a = toWorld(g, -W / 2 + 0.2, 0.01, D / 2 + 0.2), b = toWorld(g, W / 2 - 0.2, 0.01, D / 2 + 0.2);
    lamps.row(a.toArray(), b.toArray(), 4, { spot: false });
    // the shopkeeper sits cross-legged among the goods
    const kp = makePerson({ kind: keeperKind, pose: "sit" });
    kp.group.position.copy(toWorld(g, 0.75, 0.47, -0.35));
    kp.group.rotation.y = rot;
    scene.add(kp.group);
    people.push(kp);
    const c = Math.abs(Math.cos(rot)) > 0.5;
    aabb(x, z, (c ? W : D) / 2 + 0.2, (c ? D : W) / 2 + 0.2);
    (api.shops ||= []).push({ group: g, kind: goodsName, hi: SIGNS[goodsName][0], en: STALL_EN[goodsName], keeper: kp, view: [0.1, 1.55, 3.3], aim: [0, 0.75, 0] });
    return g;
  }
  const STALL_EN = { laiya: "Laiya-gatta & khil-batashe", murti: "Murti stall", chudi: "Chudi & bindi", patakhe: "Cracker stall", diyas: "Diya stall", khilone: "Toy stall", rangoli: "Rangoli colours", mithai: "Mithai stall" };
  // a cracker stall right at the lane entrance, the first thing you pass
  stall(-3.8, 55.4, Math.PI / 2, "patakhe", "#c8102a");
  // and across the lane, the laiya-gatta stall everyone visits for the puja's khil-batashe
  stall(3.7, 48.3, -Math.PI / 2, "laiya", "#1f6a9a");
  stall(6.6, -11.4, -0.75, "laiya", "#c8a020", "woman");
  stall(-9.5, -1, Math.PI / 2, "murti", "#1f4f9a");
  stall(-10, -5.6, Math.PI / 2, "chudi", "#d8641a", "woman");
  stall(-8.5, -10.2, Math.PI / 2.6, "patakhe", "#2a6a3a");
  stall(-3, -13.2, 0.15, "diyas", "#1f4f9a");
  stall(2.5, -13.6, -0.1, "khilone", "#c8a020");
  stall(9.6, 2.5, -Math.PI / 2, "rangoli", "#d8641a", "woman");
  stall(9.2, -4.6, -Math.PI / 2, "mithai", "#1f4f9a");
  // halwai frying jalebi in a kadhai on a clay chulha
  {
    const hx = 7.5, hz = -4.6;
    mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.5, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0x6a3a22, roughness: 1, side: THREE.DoubleSide }), hx, 0.25, hz);
    const kadhai = mesh(new THREE.SphereGeometry(0.5, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.iron, hx, 0.85, hz);
    kadhai.material = M.iron.clone(); kadhai.material.side = THREE.DoubleSide;
    mesh(new THREE.CircleGeometry(0.46, 24), new THREE.MeshStandardMaterial({ color: 0xc8901a, emissive: 0x5a3000, roughness: 0.2, metalness: 0.3 }), hx, 0.66, hz).rotation.x = -Math.PI / 2;
    for (let i = 0; i < 6; i++) lamps.add(hx + rand(-0.25, 0.25), 0.05, hz + rand(-0.25, 0.25), { bowl: false, flame: 0.32, decal: false });
    lamps.spot(hx, 0.6, hz + 0.3, 7, 0xff6a20, { flicker: 2.2, range: 7 });
    const halwai = makePerson({ kind: "man", color: "#f2f0e8", pose: "stir" });
    halwai.group.position.set(hx + 0.75, 0, hz);
    halwai.group.rotation.y = -Math.PI / 2;
    scene.add(halwai.group);
    people.push(halwai);
    circle(hx, hz, 0.7);
  }

  /* ===================================================================== */
  /* stop 5: the temple                                                    */
  /* ===================================================================== */
  {
    const TX = 0, TZ = -33;
    addBox(7, 1, 7, M.lime, TX, 0, TZ);
    for (let i = 0; i < 4; i++) addBox(3, (i + 1) * 0.25, 0.5, M.lime, TX, 0, TZ + 3.75 + (3 - i) * 0.5);
    // sanctum (garbhagriha) with walls you can walk between, and the mandapa in front
    const st = 0.28, sw = 3.4, sh = 3.2, sz = TZ - 1.2, door = 1.3, dh2 = 2.3;
    addBox(sw, sh, st, M.lime, TX, 1, sz - sw / 2 + st / 2); // back
    for (const s2 of [-1, 1]) addBox(st, sh, sw, M.lime, TX + s2 * (sw / 2 - st / 2), 1, sz);
    for (const s2 of [-1, 1]) addBox((sw - door) / 2, sh, st, M.lime, TX + s2 * (door / 2 + (sw - door) / 4), 1, sz + sw / 2 - st / 2);
    addBox(door, sh - dh2, st, M.lime, TX, 1 + dh2, sz + sw / 2 - st / 2);
    addBox(sw, 0.2, sw, M.lime, TX, 1 + sh - 0.2, sz); // ceiling under the shikhara
    // carved door frame painted with sindoor and a brass bell at the door
    for (const s2 of [-1, 1]) addBox(0.12, dh2, 0.1, M.brass, TX + s2 * (door / 2 + 0.04), 1, sz + sw / 2 + 0.02);
    addBox(door + 0.3, 0.14, 0.1, M.brass, TX, 1 + dh2, sz + sw / 2 + 0.02);
    // inside: a stepped marble pedestal with Ganesh ji and Lakshmi ji, garlands, the akhand jyot
    const marble = new THREE.MeshStandardMaterial({ color: 0xf2eee6, roughness: 0.35 });
    addBox(2.2, 0.45, 0.9, marble, TX, 1, sz - 0.9);
    addBox(1.8, 0.3, 0.6, marble, TX, 1.45, sz - 1.0);
    mesh(new THREE.PlaneGeometry(2.6, 2.2), new THREE.MeshStandardMaterial({ map: T.cloth("#8a0f1f", "#d9a53a"), roughness: 0.9 }), TX, 2.6, sz - sw / 2 + st + 0.01);
    const sanctum = new THREE.Group(); scene.add(sanctum); sanctum.updateMatrixWorld();
    // an invisible box round the whole temple, so a tap anywhere on it means "go in"
    const hitM = new THREE.MeshBasicMaterial({ visible: false });
    mesh(new THREE.BoxGeometry(7.2, 10, 9.4), hitM, TX, 5, TZ + 1, sanctum);
    ganeshMurti(sanctum, TX - 0.45, 1.75, sz - 1.0, 1.9);
    lakshmiMurti(sanctum, TX + 0.45, 1.75, sz - 1.0, 1.95);
    for (const mx of [-0.45, 0.45]) for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      marigolds.push([TX + mx + Math.cos(a) * 0.19, 1.75 + 0.6 + Math.sin(a) * 0.16 - Math.abs(Math.sin(a)) * 0.1, sz - 0.88 + Math.max(0, Math.sin(a)) * 0.06, i % 2]);
    }
    for (let i = 0; i <= 30; i++) { const u = i / 30; marigolds.push([TX - 1.1 + u * 2.2, 1 + dh2 - 0.1 - Math.sin(u * Math.PI) * 0.35, sz + sw / 2 - st - 0.05, i % 2]); }
    lamps.row([TX - 0.9, 1.45, sz - 0.6], [TX + 0.9, 1.45, sz - 0.6], 9, { decal: false, spot: false });
    lamps.add(TX + 1.15, 1.0, sz - 0.2, { scale: 2.4, decal: false, spot: false }); // akhand jyot
    lamps.add(TX - 1.15, 1.0, sz - 0.2, { scale: 2.0, decal: false, spot: false });
    lamps.spot(TX, 2.4, sz + 0.2, 7, 0xffb060, { range: 5 });
    // bells hung across the doorway
    for (let i = 0; i < 5; i++) mesh(new THREE.LatheGeometry([[0, 0.12], [0.03, 0.11], [0.05, 0.05], [0.06, 0]].map(([a, b]) => new THREE.Vector2(a, b)), 12), M.brass, TX - 0.5 + i * 0.25, 1 + dh2 - 0.32, sz + sw / 2 + 0.06);
    // walls of the sanctum and the edges of the plinth keep the walk on the platform
    aabb(TX, sz - sw / 2 + st / 2, sw / 2, st / 2 + 0.02);
    for (const s2 of [-1, 1]) aabb(TX + s2 * (sw / 2 - st / 2), sz, st / 2 + 0.02, sw / 2);
    for (const s2 of [-1, 1]) aabb(TX + s2 * (door / 2 + (sw - door) / 4), sz + sw / 2 - st / 2, (sw - door) / 4, st / 2 + 0.02);
    aabb(TX, sz - 0.95, 1.1, 0.48); // pedestal
    (api.floors ||= []).push({ minX: TX - 3.5, maxX: TX + 3.5, minZ: TZ - 3.5, maxZ: TZ + 3.5, y: 1 });
    for (let i = 0; i < 4; i++) api.floors.push({ minX: TX - 1.5, maxX: TX + 1.5, minZ: TZ + 3.5 + (3 - i) * 0.5, maxZ: TZ + 4.0 + (3 - i) * 0.5, y: (i + 1) * 0.25 });
    api.homes ||= [];
    api.homes.push({ group: sanctum, temple: true, out: new THREE.Vector3(TX, 0, TZ + 8), door: new THREE.Vector3(TX, 1, TZ + 3.3), inside: new THREE.Vector3(TX, 1, sz + 1.25), look: new THREE.Vector3(TX, 2.0, sz - 1.0), name: "गाँव का मंदिर · The village temple" });
    for (const px of [-1.4, 1.4]) for (const pz of [0.9, 2.6]) mesh(new THREE.CylinderGeometry(0.14, 0.16, 2.6, 12), M.lime, TX + px, 2.3, TZ + pz);
    addBox(3.6, 0.25, 2.4, M.lime, TX, 3.6, TZ + 1.75);
    // shikhara: ribbed beehive tower
    const sg = new THREE.CylinderGeometry(1, 1, 1, 48, 30, true);
    const sp = sg.attributes.position;
    for (let i = 0; i < sp.count; i++) {
      const y = sp.getY(i) + 0.5, a = Math.atan2(sp.getZ(i), sp.getX(i));
      const prof = 1.75 * Math.pow(1 - y, 0.6) * (1 + 0.15 * Math.sin(y * Math.PI)) + 0.12;
      const rib = 1 + 0.07 * Math.pow(Math.abs(Math.cos(a * 4)), 3) + 0.03 * Math.sin(y * 60) * (1 - y);
      sp.setXYZ(i, Math.cos(a) * prof * rib, y * 5.2, Math.sin(a) * prof * rib);
    }
    sg.computeVertexNormals();
    mesh(sg, new THREE.MeshStandardMaterial({ map: T.lime(), color: 0xf0e8dc, roughness: 0.85 }), TX, 4.2, TZ - 1.2);
    const am = mesh(new THREE.TorusGeometry(0.38, 0.16, 10, 24), M.lime, TX, 9.45, TZ - 1.2); am.rotation.x = Math.PI / 2; // amalaka
    mesh(new THREE.SphereGeometry(0.18, 12, 10), M.brass, TX, 9.75, TZ - 1.2); // kalash
    mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6), M.darkWood, TX, 10.5, TZ - 1.2);
    const flag = mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.9, -0.25, 0), new THREE.Vector3(0, -0.6, 0)]), M.saffron, TX, 11.3, TZ - 1.2);
    flag.geometry.computeVertexNormals();
    updaters.push((dt, t) => { flag.rotation.y = Math.sin(t * 0.8) * 0.5; flag.scale.x = 1 + Math.sin(t * 5) * 0.08; });
    lamps.spot(TX, 2, TZ + 1.2, 6, 0xffb060);
    // deepmala on every step edge and along the plinth
    for (let i = 0; i < 4; i++) lamps.row([TX - 1.35, (i + 1) * 0.25, TZ + 3.92 + (3 - i) * 0.5], [TX + 1.35, (i + 1) * 0.25, TZ + 3.92 + (3 - i) * 0.5], 8, { spot: i === 0, spotPower: 4 });
    lamps.row([TX - 3.35, 1, TZ + 3.35], [TX - 1.7, 1, TZ + 3.35], 5, { spotPower: 2 });
    lamps.row([TX + 1.7, 1, TZ + 3.35], [TX + 3.35, 1, TZ + 3.35], 5, { spotPower: 2 });
    lamps.row([TX - 3.35, 1, TZ + 3.2], [TX - 3.35, 1, TZ - 3.35], 14, { spotPower: 3 });
    lamps.row([TX + 3.35, 1, TZ + 3.2], [TX + 3.35, 1, TZ - 3.35], 14, { spotPower: 3 });
    // brass bell hung in the mandapa
    const bellPivot = new THREE.Group(); bellPivot.position.set(TX, 3.6, TZ + 2.6); scene.add(bellPivot);
    mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5), M.iron, 0, -0.25, 0, bellPivot);
    mesh(new THREE.LatheGeometry([[0, 0.3], [0.08, 0.28], [0.12, 0.15], [0.16, 0.02], [0.18, 0]].map(([a, b]) => new THREE.Vector2(a, b)), 20), M.brass, 0, -0.8, 0, bellPivot);
    api.bell = { pivot: bellPivot, swing: 0 };
    updaters.push((dt, t) => { const b = api.bell; b.swing *= Math.pow(0.4, dt); bellPivot.rotation.x = Math.sin(t * 7) * b.swing; });
    // priest doing aarti with a flame on the thali
    const priest = makePerson({ kind: "priest", pose: "aarti", carry: null });
    priest.group.position.set(TX + 0.75, 1, TZ + 1.35); // to one side, so visitors can walk up to the door
    priest.group.rotation.y = Math.PI + 0.4;
    circle(TX + 0.75, TZ + 1.35, 0.25);
    scene.add(priest.group);
    people.push(priest);
    api.aartiLamp = lamps.add(TX, 2, TZ, { bowl: false, flame: 0.12, decal: false, spot: false });
    const hand = new THREE.Vector3();
    updaters.push(() => {
      priest.arms[1].elbow.updateWorldMatrix(true, false);
      hand.set(0, -0.36, 0.05).applyMatrix4(priest.arms[1].elbow.matrixWorld);
      lamps.move(api.aartiLamp, hand.x, hand.y, hand.z);
    });
    // plinth edges (a metre drop) except where the steps come up, and the sides of the steps
    aabb(TX - 3.55, TZ, 0.12, 3.6); aabb(TX + 3.55, TZ, 0.12, 3.6); aabb(TX, TZ - 3.55, 3.6, 0.12);
    aabb(TX - 2.55, TZ + 3.55, 1.0, 0.12); aabb(TX + 2.55, TZ + 3.55, 1.0, 0.12);
    aabb(TX - 1.62, TZ + 4.6, 0.1, 1.1); aabb(TX + 1.62, TZ + 4.6, 0.1, 1.1);
    for (const px of [-1.4, 1.4]) for (const pz of [0.9, 2.6]) circle(TX + px, TZ + pz, 0.2);
  }

  /* ===================================================================== */
  /* stop 6: the pond                                                      */
  /* ===================================================================== */
  {
    const PX = 24, PZ = -24, PR = 8;
    const bank = mesh(new THREE.RingGeometry(PR - 0.2, PR + 1.4, 48), new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 1 }), PX, 0.008, PZ);
    bank.rotation.x = -Math.PI / 2;
    const water = new Reflector(new THREE.CircleGeometry(PR, 32), { textureWidth: quality.reflect, textureHeight: quality.reflect, color: 0x7a8a9a, clipBias: 0.003 });
    water.rotation.x = -Math.PI / 2;
    water.position.set(PX, 0.02, PZ);
    scene.add(water);
    // the pond redraws the whole village. Keep the last reflection unless you are near it, and only refresh every other frame.
    const drawReflection = water.onBeforeRender;
    const pondAt = new THREE.Vector3(PX, 0, PZ);
    let reflectFrame = 0;
    water.onBeforeRender = function (renderer, scene, camera) {
      const near = camera.position.distanceToSquared(pondAt) < 42 * 42;
      if (!near) { this.userData.wasNear = false; return; }
      const arrived = !this.userData.wasNear;
      this.userData.wasNear = true;
      if (!arrived && this.userData.hasReflection && (++reflectFrame & 1)) return;
      this.userData.hasReflection = true;
      drawReflection.call(this, renderer, scene, camera);
    };
    const tint = mesh(new THREE.CircleGeometry(PR, 48), new THREE.MeshBasicMaterial({ color: 0x050810, transparent: true, opacity: 0.45, depthWrite: false }), PX, 0.025, PZ);
    tint.rotation.x = -Math.PI / 2;
    // ghat steps on the west bank
    [[14.2, 15.6, 0.45], [15.6, 16.2, 0.3], [16.2, 16.8, 0.15]].forEach(([x0, x1, hh]) => addBox(x1 - x0, hh, 6, M.lime, (x0 + x1) / 2, 0, -23));
    lamps.row([15.3, 0.45, -25.8], [15.3, 0.45, -20.2], 10, { spotPower: 3.5 });
    // lotus pads and reeds
    for (let i = 0; i < 26; i++) {
      const a = rand(0, Math.PI * 2), rr = rand(3, PR - 0.6);
      const pad = mesh(new THREE.CircleGeometry(rand(0.15, 0.3), 10, 0.3, Math.PI * 1.85), new THREE.MeshStandardMaterial({ color: 0x1a3a1a, roughness: 0.7 }), PX + Math.cos(a) * rr, 0.03, PZ + Math.sin(a) * rr);
      pad.rotation.x = -Math.PI / 2;
    }
    for (let i = 0; i < 60; i++) {
      const a = rand(-0.5, 3.5), rr = PR + rand(-0.2, 0.6);
      const reed = mesh(new THREE.CylinderGeometry(0.008, 0.012, rand(0.6, 1.3)), new THREE.MeshStandardMaterial({ color: 0x2a3a1a }), PX + Math.cos(a) * rr, 0.4, PZ + Math.sin(a) * rr);
      reed.rotation.z = rand(-0.2, 0.2);
    }
    // floating diyas on leaf boats
    api.floaters = [];
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2a4a1a, side: THREE.DoubleSide });
    for (let i = 0; i < 40; i++) {
      const active = i < 16;
      const a = rand(0, Math.PI * 2), rr = rand(1, PR - 1.2);
      const f = { a, rr, id: lamps.add(PX + Math.cos(a) * rr, 0.03, PZ + Math.sin(a) * rr, { lit: active, decal: false }), active, drift: rand(0.02, 0.06) * (Math.random() < 0.5 ? -1 : 1), seed: rand(0, 9), x: 0, z: 0 };
      f.leaf = mesh(new THREE.CircleGeometry(0.13, 8), leafMat, 0, 0.028, 0);
      f.leaf.rotation.x = -Math.PI / 2;
      f.leaf.visible = active;
      api.floaters.push(f);
    }
    lamps.spot(PX, 0.6, PZ, 5, 0xffa050, { range: 12 });
    lamps.spot(PX - 4, 0.6, PZ + 2, 3, 0xffa050);
    updaters.push((dt, t) => {
      for (const f of api.floaters) {
        if (!f.active) continue;
        if (f.launch !== undefined) { // drifting out from the ghat
          f.launch = Math.min(1, f.launch + dt * 0.12);
          f.x = 16.4 + (f.tx - 16.4) * f.launch; f.z = f.sz + (f.tz - f.sz) * f.launch;
          if (f.launch >= 1) { f.a = Math.atan2(f.z - PZ, f.x - PX); f.rr = Math.hypot(f.x - PX, f.z - PZ); delete f.launch; }
        } else {
          f.a += f.drift * dt;
          f.x = PX + Math.cos(f.a) * f.rr; f.z = PZ + Math.sin(f.a) * f.rr;
        }
        const y = 0.03 + Math.sin(t * 1.3 + f.seed) * 0.006;
        lamps.move(f.id, f.x, y, f.z);
        f.leaf.position.set(f.x, y - 0.004, f.z);
      }
    });
    // launch a diya from the ghat; `already` puts one straight out on the water (a remembered one)
    api.floatDiya = ({ already = false } = {}) => {
      const f = api.floaters.find((q) => !q.active);
      if (!f) return null;
      f.active = true;
      f.leaf.visible = true;
      if (already) { f.a = rand(0, Math.PI * 2); f.rr = rand(1.5, PR - 1.6); f.drift = rand(0.015, 0.03) * (Math.random() < 0.5 ? -1 : 1); }
      else { f.launch = 0; f.sz = -23 + rand(-1.5, 1.5); f.tx = PX + rand(-4, 3); f.tz = PZ + rand(-4, 4); }
      lamps.setPower(f.id, 1);
      return f;
    };
    circle(PX, PZ, PR + 0.2);
  }

  /* ===================================================================== */
  /* stop 7: the rooftop                                                   */
  /* ===================================================================== */
  const rh = house({ x: -22, z: -14, w: 6, d: 8, h: 3.2, rot: Math.PI / 2, roof: "flat", wall: 0, door: "#2a5a8a", doorAt: 1.6, parapetGap: [-1.6, 0.6], kandil: 0x50e0a0 });
  // outside stair along the front wall
  for (let i = 0; i < 14; i++) addBox(1.1, (i + 1) * 0.2386, 0.5, M.top[0], -17.45, 0, -7.25 - i * 0.5);
  aabb(-17.45, -10.5, 0.6, 3.6);

  /* ===================================================================== */
  /* the village well (kuan)                                               */
  /* ===================================================================== */
  {
    const WX = -12, WZ = 57;
    mesh(new THREE.CylinderGeometry(2.4, 2.5, 0.22, 36), M.top[0], WX, 0.11, WZ);
    const ringPts = [[1.0, 0], [1.3, 0], [1.3, 0.8], [1.24, 0.86], [1.06, 0.86], [1.0, 0.8], [1.0, 0]].map(([a, b]) => new THREE.Vector2(a, b));
    mesh(new THREE.LatheGeometry(ringPts, 36), M.lime, WX, 0.22, WZ);
    const water = mesh(new THREE.CircleGeometry(1.0, 30), new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 0.05, metalness: 0.6 }), WX, 0.5, WZ);
    water.rotation.x = -Math.PI / 2;
    // pillars, crossbar, pulley, rope and brass bucket
    for (const s of [-1, 1]) addBox(0.22, 2.2, 0.22, M.lime, WX + s * 1.15, 0.22, WZ);
    mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 8), M.darkWood, WX, 2.35, WZ).rotation.z = Math.PI / 2;
    const pulley = mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 18), M.iron, WX, 2.2, WZ);
    const rope = mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 5), new THREE.MeshStandardMaterial({ color: 0x8a7a50 }), WX + 0.16, 1.6, WZ);
    const bucket = mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.22, 14), M.brass, WX + 0.16, 1.1, WZ);
    api.well = { depth: 0, want: 0 };
    updaters.push((dt) => {
      const w = api.well;
      w.depth += (w.want - w.depth) * Math.min(1, dt * 1.5);
      if (w.want > 0 && w.depth > w.want - 0.05) w.want = 0; // bucket comes back up full
      const by = 1.1 - w.depth * 1.5;
      bucket.position.y = by;
      rope.scale.y = 2.2 - by;
      rope.position.y = (2.2 + by) / 2;
      pulley.rotation.z = -w.depth * 8;
    });
    lamps.ring(WX, 1.08, WZ, 1.15, 16, { spotPower: 5 });
    lamps.ring(WX, 0.22, WZ, 2.3, 18, { spot: false });
    lamps.add(WX - 1.15, 2.42, WZ, { decal: false }); lamps.add(WX + 1.15, 2.42, WZ, { decal: false });
    const wg = new THREE.Group(); wg.position.set(WX, 0, WZ); scene.add(wg); wg.updateMatrixWorld();
    toran(wg, 0, 2.25, 0.12, 2.1);
    circle(WX, WZ, 1.5);
    tree(-17, 61, { h: 8, r: 4, trunk: 0.4 });
  }

  /* ===================================================================== */
  /* the cowshed (gaushala) and the Govardhan figure                       */
  /* ===================================================================== */
  function cow(x, z, rotY, o = {}) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    scene.add(g);
    const hide = new THREE.MeshStandardMaterial({ color: o.color ?? 0xe6dccb, roughness: 0.75 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.8 });
    const s = o.scale ?? 1;
    const body = mesh(new THREE.CapsuleGeometry(0.36 * s, 0.95 * s, 6, 14), hide, 0, 1.0 * s, 0, g);
    body.rotation.x = Math.PI / 2;
    mesh(new THREE.SphereGeometry(0.24 * s, 12, 10), hide, 0, 1.38 * s, 0.42 * s, g).scale.set(1, 0.9, 1.2); // zebu hump
    const dew = mesh(new THREE.SphereGeometry(0.2 * s, 10, 8), hide, 0, 0.82 * s, 0.68 * s, g);
    dew.scale.set(0.5, 1.2, 0.8);
    for (const [lx, lz] of [[-0.2, 0.5], [0.2, 0.5], [-0.2, -0.5], [0.2, -0.5]]) {
      mesh(new THREE.CylinderGeometry(0.065 * s, 0.05 * s, 0.82 * s, 8), hide, lx * s, 0.41 * s, lz * s, g);
      mesh(new THREE.CylinderGeometry(0.06 * s, 0.065 * s, 0.07 * s, 8), dark, lx * s, 0.035 * s, lz * s, g); // hooves
    }
    const neck = new THREE.Group();
    neck.position.set(0, 1.12 * s, 0.68 * s);
    g.add(neck);
    const nk = mesh(new THREE.CylinderGeometry(0.17 * s, 0.24 * s, 0.5 * s, 10), hide, 0, 0.05 * s, 0.18 * s, neck);
    nk.rotation.x = 1.0;
    const head = mesh(new THREE.CapsuleGeometry(0.13 * s, 0.32 * s, 4, 10), hide, 0, -0.05 * s, 0.52 * s, neck);
    head.rotation.x = 1.25;
    mesh(new THREE.SphereGeometry(0.12 * s, 10, 8), new THREE.MeshStandardMaterial({ color: 0x6a5048, roughness: 0.5 }), 0, -0.2 * s, 0.7 * s, neck).scale.set(1, 0.8, 0.9); // muzzle
    for (const sd of [-1, 1]) {
      mesh(new THREE.SphereGeometry(0.025 * s, 8, 6), new THREE.MeshStandardMaterial({ color: 0x0a0806, roughness: 0.2 }), sd * 0.11 * s, 0.06 * s, 0.52 * s, neck);
      const ear = mesh(new THREE.SphereGeometry(0.09 * s, 8, 6), hide, sd * 0.2 * s, 0.08 * s, 0.38 * s, neck);
      ear.scale.set(1.4, 0.35, 0.7);
      // painted horns, as cows are decorated for Diwali and Govardhan Puja
      const horn = mesh(new THREE.ConeGeometry(0.045 * s, 0.32 * s, 8), new THREE.MeshStandardMaterial({ color: o.horn ?? 0xd8203a, roughness: 0.5 }), sd * 0.11 * s, 0.26 * s, 0.4 * s, neck);
      horn.rotation.z = -sd * 0.5;
      horn.rotation.x = -0.3;
      mesh(new THREE.ConeGeometry(0.02 * s, 0.07 * s, 6), M.brass, sd * 0.19 * s, 0.4 * s, 0.37 * s, neck).rotation.z = -sd * 0.5; // brass tip
    }
    const tail = new THREE.Group();
    tail.position.set(0, 1.15 * s, -0.82 * s);
    g.add(tail);
    mesh(new THREE.CylinderGeometry(0.02 * s, 0.025 * s, 0.75 * s, 5), hide, 0, -0.37 * s, -0.04 * s, tail);
    mesh(new THREE.SphereGeometry(0.06 * s, 6, 6), dark, 0, -0.78 * s, -0.05 * s, tail).scale.set(0.8, 1.6, 0.8);
    // jhool (embroidered back cloth) with mirror work
    const jhool = mesh(new THREE.BoxGeometry(0.82 * s, 0.03, 0.9 * s), new THREE.MeshStandardMaterial({ map: T.cloth(o.cloth ?? "#b3121f", "#f2b705"), roughness: 0.7 }), 0, 1.37 * s, -0.12 * s, g);
    jhool.geometry = new THREE.CylinderGeometry(0.4 * s, 0.4 * s, 0.95 * s, 16, 1, true, -Math.PI / 2.2, Math.PI / 1.1);
    jhool.rotation.x = Math.PI / 2;
    jhool.material.side = THREE.DoubleSide;
    jhool.position.y = 1.0 * s;
    jhool.scale.set(1.04, 1, 1.04);
    // bells and a marigold garland at the neck
    mesh(new THREE.SphereGeometry(0.05 * s, 10, 8), M.brass, 0, 0.72 * s, 0.82 * s, g);
    g.updateMatrixWorld(true);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const p = new THREE.Vector3(Math.cos(a) * 0.26 * s, 1.0 * s + Math.sin(a) * 0.1 * s, 0.82 * s + Math.sin(a) * 0.08 * s).applyMatrix4(g.matrixWorld);
      marigolds.push([p.x, p.y, p.z, i % 2]);
    }
    const seed = rand(0, 9);
    const c = { g, neck, tail, shake: 0 };
    updaters.push((dt, t) => {
      c.shake *= Math.pow(0.3, dt);
      tail.rotation.z = Math.sin(t * 1.3 + seed) * 0.25;
      tail.rotation.x = 0.1 + Math.sin(t * 0.7 + seed) * 0.05;
      neck.rotation.x = Math.sin(t * 0.4 + seed) * 0.06 + (o.grazing ? 0.45 : 0);
      neck.rotation.y = Math.sin(t * 0.25 + seed) * 0.2 + Math.sin(t * 18) * c.shake;
      body.scale.x = 1 + Math.sin(t * 1.6 + seed) * 0.012; // breathing
    });
    circle(x, z, 0.9 * s);
    return c;
  }

  {
    const shed = new THREE.Group();
    shed.position.set(19, 0, 47);
    shed.rotation.y = -Math.PI / 2; // open side faces the alley (-x)
    scene.add(shed);
    shed.updateMatrixWorld();
    for (const px of [-4, -1.3, 1.3, 4]) mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.6, 8), M.bark, px, 1.3, 2.2, shed);
    const back = wallBlock(8.2, 2.6, 0.35, 3);
    back.position.set(0, 1.3, -2.25);
    shed.add(back);
    for (const sx of [-4.05, 4.05]) { const side = wallBlock(0.3, 1.5, 4.5, 3); side.position.set(sx, 0.75, 0); shed.add(side); }
    const roof = gableRoof(8.2, 4.8, 1.2, 0.4, M.thatch);
    roof.position.y = 2.6;
    shed.add(roof);
    const floorMesh = mesh(new THREE.PlaneGeometry(8, 4.4), new THREE.MeshStandardMaterial({ map: T.thatch(), color: 0x7a6a48, roughness: 1 }), 0, 0.01, 0, shed);
    floorMesh.rotation.x = -Math.PI / 2;
    // clay manger along the back wall, heaped with fodder
    addBox(7, 0.6, 0.6, M.wall[3], 0, 0, -1.7, shed);
    for (let i = 0; i < 14; i++) mesh(new THREE.SphereGeometry(0.25, 8, 6), M.straw, -3.2 + i * 0.5, 0.62, -1.7, shed).scale.set(1, 0.4, 0.9);
    const ml = toWorld(shed, -3.3, 0.6, -1.4), mr = toWorld(shed, 3.3, 0.6, -1.4);
    lamps.row(ml.toArray(), mr.toArray(), 9, { spotPower: 4 });
    const fl = toWorld(shed, -3.9, 0, 2.5), fr = toWorld(shed, 3.9, 0, 2.5);
    lamps.row(fl.toArray(), fr.toArray(), 12, { spotPower: 3 });
    const lan = toWorld(shed, 0, 2.3, 0.6);
    lamps.add(lan.x, lan.y, lan.z, { bowl: false, flame: 0.1, decal: false });
    lamps.spot(lan.x, lan.y - 0.6, lan.z, 5, 0xffb060, { range: 9 });
    // cows facing the alley, horns painted for the festival
    const cw = (lx, lz, o) => { const p = toWorld(shed, lx, 0, lz); return cow(p.x, p.z, -Math.PI / 2, o); };
    api.cows = [
      cw(-2.6, 0.2, { horn: 0xd8203a, cloth: "#b3121f" }),
      cw(0, 0.1, { color: 0x8a5a3a, horn: 0x1d6ad8, cloth: "#1d3fa0", grazing: true }),
      cw(2.6, 0.3, { color: 0xf0ebe0, horn: 0x2a9a3a, cloth: "#7a1aa0" }),
      cw(3.6, 1.6, { color: 0xc8a888, horn: 0xf2b705, cloth: "#d8203a", scale: 0.6 }),
    ];
    aabb(19, 47, 2.4, 4.3);
    addBox(1.2, 0.5, 1.2, M.straw, 16, 0, 52); // hay bundle
    // Govardhan: a figure shaped from cow dung in front of the shed, ringed with diyas for tomorrow's puja
    const GX = 15.1, GZ = 46.6;
    const dungMat = new THREE.MeshStandardMaterial({ color: 0x3e2e1e, roughness: 1 });
    const gb = new THREE.Group(); gb.position.set(GX, 0, GZ); gb.rotation.y = 0.3; scene.add(gb);
    mesh(new THREE.SphereGeometry(0.42, 16, 10), dungMat, 0, 0, 0, gb).scale.set(0.8, 0.22, 1.2);
    mesh(new THREE.SphereGeometry(0.22, 14, 10), dungMat, 0, 0, 0.72, gb).scale.set(1, 0.3, 1);
    for (const [lx, lz, r] of [[-0.45, 0.3, 0.7], [0.45, 0.3, -0.7], [-0.22, -0.75, 0.15], [0.22, -0.75, -0.15]]) {
      const limb = mesh(new THREE.CapsuleGeometry(0.06, 0.45, 4, 8), dungMat, lx, 0.03, lz, gb);
      limb.rotation.set(Math.PI / 2, 0, r);
    }
    for (let i = 0; i < 10; i++) mesh(new THREE.SphereGeometry(0.025, 6, 6), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xd8203a : 0xf2e8d0 }), rand(-0.3, 0.3), 0.09, rand(-0.4, 0.5), gb);
    gb.updateMatrixWorld();
    const navel = toWorld(gb, 0, 0.09, 0);
    lamps.add(navel.x, navel.y, navel.z, { decal: false });
    lamps.ring(GX, 0.01, GZ, 1.25, 12, { spotPower: 3 });
  }

  /* ===================================================================== */
  /* the verandah kitchen (rasoi)                                          */
  /* ===================================================================== */
  {
    house({ x: -19.5, z: 33, w: 6, d: 4, h: 2.7, rot: Math.PI / 2, roof: "thatch", wall: 3, door: "#3a5a2a", windows: [], toran: true });
    // lean-to chhappar on bamboo poles
    for (const pz of [30.4, 33, 35.6]) mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.1, 8), M.bark, -14.6, 1.05, pz);
    const lean = mesh(new THREE.PlaneGeometry(3.4, 6), M.thatch, -15.95, 2.38, 33);
    lean.rotation.x = -Math.PI / 2;
    lean.rotateY(-0.22); // high against the house wall, low at the poles
    const vf = mesh(new THREE.PlaneGeometry(3, 6), new THREE.MeshStandardMaterial({ map: T.plaster(0), color: 0x6a5038, roughness: 0.9 }), -16, 0.008, 33);
    vf.rotation.x = -Math.PI / 2;
    // clay chulha with fire, iron kadhai, puris on a steel thali
    const CX = -16.3, CZ = 32.2;
    const chulha = new THREE.Group(); chulha.position.set(CX, 0, CZ); scene.add(chulha);
    for (const s of [-1, 1]) addBox(0.12, 0.32, 0.5, M.wall[3], s * 0.2, 0, 0, chulha);
    addBox(0.52, 0.32, 0.1, M.wall[3], 0, 0, -0.22, chulha);
    for (let i = 0; i < 4; i++) lamps.add(CX + rand(-0.1, 0.1), 0.03, CZ + rand(-0.05, 0.15), { bowl: false, flame: 0.22, decal: false });
    api.chulhaSpot = lamps.spot(CX, 0.4, CZ + 0.5, 6, 0xff6a20, { flicker: 2.4, range: 7 });
    const k = mesh(new THREE.SphereGeometry(0.28, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.iron.clone(), CX, 0.6, CZ);
    k.material.side = THREE.DoubleSide;
    mesh(new THREE.CircleGeometry(0.25, 20), new THREE.MeshStandardMaterial({ color: 0xc89020, emissive: 0x4a2a00, roughness: 0.15, metalness: 0.3 }), CX, 0.45, CZ).rotation.x = -Math.PI / 2;
    api.puris = [];
    const puriMat = new THREE.MeshStandardMaterial({ color: 0xd89a40, roughness: 0.6 });
    for (let i = 0; i < 2; i++) { const p = mesh(new THREE.SphereGeometry(0.07, 12, 6), puriMat, CX + rand(-0.08, 0.08), 0.47, CZ + rand(-0.08, 0.08)); p.scale.y = 0.35; api.puris.push(p); }
    mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.015, 24), new THREE.MeshStandardMaterial({ color: 0xb8bcc0, metalness: 0.9, roughness: 0.3 }), -15.4, 0.02, 32.8);
    for (let i = 0; i < 9; i++) { const p = mesh(new THREE.SphereGeometry(0.07, 10, 6), puriMat, -15.4 + rand(-0.12, 0.12), 0.035 + i * 0.012, 32.8 + rand(-0.12, 0.12)); p.scale.y = 0.3; }
    // chakla-belan, brass lota, a stack of plates, and a heap of uple (dung cakes)
    mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.05, 20), M.wood, -15.6, 0.025, 31.4);
    mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.36, 8), M.wood, -15.6, 0.07, 31.4).rotation.z = Math.PI / 2;
    mesh(new THREE.SphereGeometry(0.1, 12, 10), M.brass, -17.2, 0.1, 34.6);
    for (let i = 0; i < 6; i++) mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.02, 20), M.brass, -17.2, 0.01 + i * 0.022, 35.2);
    for (let i = 0; i < 14; i++) mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 10), M.dung, -14.2 + rand(-0.1, 0.1), 0.02 + i * 0.045, 36.6 + rand(-0.1, 0.1));
    // a plate of ladoos for the neighbours
    mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.015, 20), M.brass, -16.8, 0.02, 31);
    for (let i = 0; i < 7; i++) mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf0a020, roughness: 0.8 }), -16.8 + Math.cos(i) * (i ? 0.09 : 0), 0.05, 31 + Math.sin(i) * (i ? 0.09 : 0));
    lamps.row([-14.4, 0.01, 30.6], [-14.4, 0.01, 35.4], 8, { spotPower: 2.5 });
    // chulha smoke curls up through the thatch
    let smokeT = 0;
    updaters.push((dt) => {
      smokeT -= dt;
      if (smokeT <= 0) { sparks.puff(CX + rand(-0.1, 0.1), 0.8, CZ, 0.4, 7, [0.5, 0.42, 0.36], 0.14, 0.05, 0.35, 0, 0.35); smokeT = 0.45; }
    });
    aabb(-16, 33, 1.6, 3);
  }

  /* ===================================================================== */
  /* the Diwali card game (taash) under a petromax                         */
  /* ===================================================================== */
  {
    const TX = 11.8, TZ = -12;
    const dari = mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshStandardMaterial({ map: T.cloth("#1d3f7a", "#c8a050"), roughness: 1 }), TX, 0.012, TZ);
    dari.rotation.x = -Math.PI / 2;
    dari.rotation.z = 0.2;
    // petromax lantern on a wooden stool
    addBox(0.4, 0.35, 0.4, M.wood, TX + 0.2, 0, TZ - 1.75);
    mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.12, 12), new THREE.MeshStandardMaterial({ color: 0xa0a8b0, metalness: 0.9, roughness: 0.3 }), TX + 0.2, 0.41, TZ - 1.75);
    mesh(new THREE.SphereGeometry(0.09, 14, 10), new THREE.MeshBasicMaterial({ color: 0xfff4dc }), TX + 0.2, 0.56, TZ - 1.75).scale.y = 1.3;
    mesh(new THREE.ConeGeometry(0.14, 0.12, 12), new THREE.MeshStandardMaterial({ color: 0xa0a8b0, metalness: 0.9, roughness: 0.3 }), TX + 0.2, 0.74, TZ - 1.75);
    api.petromax = lamps.spot(TX + 0.2, 0.3, TZ - 1.5, 6, 0xfff0d0, { flicker: 0.15, range: 9 });
    // cards: a pile in the middle and a hand in front of each player
    const cardMat = new THREE.MeshStandardMaterial({ color: 0xf6f2ea, roughness: 0.6 });
    const backMat = new THREE.MeshStandardMaterial({ color: 0xb3121f, roughness: 0.6 });
    api.cards = [];
    for (let i = 0; i < 9; i++) {
      const c = mesh(new THREE.PlaneGeometry(0.06, 0.09), i < 5 ? cardMat : backMat, TX + rand(-0.15, 0.15), 0.016 + i * 0.001, TZ + rand(-0.15, 0.15));
      c.rotation.x = -Math.PI / 2; c.rotation.z = rand(0, 6.28);
      api.cards.push(c);
    }
    // chai in steel tumblers
    for (const [ox, oz] of [[0.7, 0.5], [-0.6, 0.6], [0.5, -0.7]]) mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.09, 10), new THREE.MeshStandardMaterial({ color: 0xc0c4c8, metalness: 0.9, roughness: 0.25 }), TX + ox, 0.06, TZ + oz);
    lamps.ring(TX, 0.01, TZ, 1.75, 10, { spot: false });
    aabb(TX, TZ, 1.6, 1.6);
  }

  /* ===================================================================== */
  /* the mela: giant wheel, merry-go-round, dhol and dancers               */
  /* ===================================================================== */
  {
    const MX = 27, MZ = 22.5;
    const steel = new THREE.MeshStandardMaterial({ color: 0x9aa2aa, metalness: 0.75, roughness: 0.45 });
    const paint = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 });
    // a chasing ring of bulbs as an instanced child of any moving group
    function bulbRing(parent, pts, cols) {
      const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 6, 4), new THREE.MeshBasicMaterial({ toneMapped: true }), pts.length);
      const m4 = new THREE.Matrix4(), col = new THREE.Color();
      pts.forEach((p, i) => { im.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)); im.setColorAt(i, col.setRGB(...cols[i % cols.length])); });
      parent.add(im);
      let acc = 0, step = 0;
      updaters.push((dt) => {
        acc += dt;
        if (acc < 0.09) return;
        acc = 0; step++;
        for (let i = 0; i < pts.length; i++) {
          const on = (i + step) % 6 < 3 ? 3.2 : 0.35;
          const c = cols[i % cols.length];
          im.setColorAt(i, col.setRGB(c[0] * on, c[1] * on, c[2] * on));
        }
        im.instanceColor.needsUpdate = true;
      });
      return im;
    }
    const RGBY = [[1, 0.2, 0.25], [1, 0.8, 0.2], [0.25, 1, 0.4], [0.3, 0.6, 1]];

    // ---- bada jhoola: hand-cranked giant wheel, axle along x so it faces the path ----
    const WX = 30.5, WZ = 24, WY = 5.4, R = 4.4;
    const wheel = new THREE.Group();
    wheel.position.set(WX, WY, WZ);
    scene.add(wheel);
    for (const sx of [-0.65, 0.65]) {
      const rim = mesh(new THREE.TorusGeometry(R, 0.06, 6, 64), steel, sx, 0, 0, wheel);
      rim.rotation.y = Math.PI / 2;
      for (let k = 0; k < 8; k++) {
        const sp = mesh(new THREE.CylinderGeometry(0.04, 0.04, R, 6), steel, sx, 0, 0, wheel);
        const a = (k / 8) * Math.PI * 2;
        sp.position.set(sx, Math.sin(a) * R / 2, Math.cos(a) * R / 2);
        sp.rotation.x = -a + Math.PI / 2;
      }
      // A-frame legs and crank
      for (const lz of [-1.6, 1.6]) {
        const leg = mesh(new THREE.CylinderGeometry(0.07, 0.09, WY + 0.6, 8), paint(0xb3121f), WX + sx * 1.6, (WY + 0.6) / 2 - 0.3, WZ + lz);
        leg.rotation.x = -lz * 0.27;
        leg.rotation.z = sx * 0.1;
      }
    }
    mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 10), steel, 0, 0, 0, wheel).rotation.z = Math.PI / 2;
    const rimPts = [];
    for (const sx of [-0.65, 0.65]) for (let k = 0; k < 64; k++) { const a = (k / 64) * Math.PI * 2; rimPts.push(new THREE.Vector3(sx, Math.sin(a) * R, Math.cos(a) * R)); }
    for (let k = 0; k < 8; k++) for (let j = 1; j < 7; j++) { const a = (k / 8) * Math.PI * 2, r = (j / 7) * R; rimPts.push(new THREE.Vector3(0.65, Math.sin(a) * r, Math.cos(a) * r)); }
    bulbRing(wheel, rimPts, RGBY);
    // cabins hang from the rim and stay level
    const cabins = [];
    const cabCols = [0xd8203a, 0x1d6ad8, 0xf2b705, 0x2a9a3a, 0x7a1aa0, 0xff7a10, 0x00897b, 0xc2185b];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.2;
      const pivot = new THREE.Group();
      pivot.position.set(0, Math.sin(a) * R, Math.cos(a) * R);
      wheel.add(pivot);
      const cab = new THREE.Group();
      pivot.add(cab);
      addBox(1.2, 0.08, 0.7, paint(cabCols[k]), 0, -1.0, 0, cab); // floor
      addBox(1.2, 0.35, 0.05, paint(cabCols[k]), 0, -0.95, -0.33, cab); // back
      addBox(1.2, 0.35, 0.05, paint(cabCols[k]), 0, -0.95, 0.33, cab);
      for (const sx of [-0.55, 0.55]) mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.0), steel, sx, -0.5, 0, cab);
      const roofC = mesh(new THREE.ConeGeometry(0.62, 0.25, 4), paint(cabCols[(k + 3) % 8]), 0, 0.02, 0, cab);
      roofC.rotation.y = Math.PI / 4;
      if (k % 2 === 0) {
        const rider = makePerson({ kind: k % 4 ? "girl" : "child", pose: k % 4 ? "wave" : "sit" });
        rider.group.position.set(0, -0.96 - (k % 4 ? 0 : 0), 0);
        if (k % 4) rider.group.scale.setScalar(0.9);
        cab.add(rider.group);
        people.push(rider);
      }
      cabins.push({ pivot, cab });
    }
    api.giantWheel = { wheel, cabins, speed: 0.22, angle: 0 };
    updaters.push((dt) => {
      const gw = api.giantWheel;
      gw.angle += gw.speed * dt;
      wheel.rotation.x = gw.angle;
      for (const c of cabins) c.pivot.rotation.x = -gw.angle; // stay upright
    });
    aabb(WX, WZ, 1.9, R + 0.4);
    lamps.spot(WX - 2, 2.5, WZ, 6, 0xffc080, { range: 12 });

    // ---- merry-go-round with wooden horses ----
    const CX = 23.4, CZ = 28.2;
    const carousel = new THREE.Group();
    carousel.position.set(CX, 0, CZ);
    scene.add(carousel);
    mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.18, 32), M.wood, 0, 0.09, 0, carousel);
    mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.8, 10), steel, 0, 1.4, 0, carousel);
    const canopy = mesh(new THREE.ConeGeometry(2.7, 1.1, 24, 1, true), new THREE.MeshStandardMaterial({ map: T.cloth("#c8203a", "#f6efe2"), side: THREE.DoubleSide, roughness: 0.9 }), 0, 3.1, 0, carousel);
    const edge = [];
    for (let k = 0; k < 40; k++) { const a = (k / 40) * Math.PI * 2; edge.push(new THREE.Vector3(Math.cos(a) * 2.68, 2.55, Math.sin(a) * 2.68)); }
    bulbRing(carousel, edge, [[1, 0.75, 0.3], [1, 0.3, 0.5]]);
    const horses = [];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const hg = new THREE.Group();
      hg.position.set(Math.cos(a) * 1.8, 0, Math.sin(a) * 1.8);
      hg.rotation.y = -a;
      carousel.add(hg);
      mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.4), M.brass, 0, 1.4, 0, hg);
      const horse = new THREE.Group();
      hg.add(horse);
      const hm = paint([0xf2efe6, 0x8a5a3a, 0x2a2a2e][k % 3]);
      const body = mesh(new THREE.CapsuleGeometry(0.16, 0.5, 4, 10), hm, 0, 0.9, 0, horse); body.rotation.x = Math.PI / 2;
      const neck = mesh(new THREE.CapsuleGeometry(0.08, 0.3, 4, 8), hm, 0, 1.15, 0.32, horse); neck.rotation.x = 0.5;
      mesh(new THREE.CapsuleGeometry(0.07, 0.18, 4, 8), hm, 0, 1.32, 0.45, horse).rotation.x = 1.3;
      for (const [lx, lz, r] of [[-0.08, 0.25, -0.6], [0.08, 0.25, -0.3], [-0.08, -0.25, 0.5], [0.08, -0.25, 0.2]]) { const leg = mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.45), hm, lx, 0.62, lz, horse); leg.rotation.x = r; }
      addBox(0.3, 0.04, 0.32, paint(0xc0101a), 0, 1.05, 0, horse); // saddle
      if (k % 2 === 0) {
        const rider = makePerson({ kind: k === 2 ? "girl" : "child", pose: "sit" });
        rider.group.position.set(0, 1.07 - 0.5, 0);
        horse.add(rider.group);
        people.push(rider);
      }
      horses.push({ horse, ph: k * 1.3 });
    }
    updaters.push((dt, t) => {
      carousel.rotation.y += dt * 0.5;
      for (const h of horses) h.horse.position.y = Math.sin(t * 2.2 + h.ph) * 0.18;
    });
    circle(CX, CZ, 2.6);

    // ---- entrance arch with a painted sign and bulbs ----
    const sign = document.createElement("canvas");
    sign.width = 512; sign.height = 128;
    const sx = sign.getContext("2d");
    sx.fillStyle = "#7a1010"; sx.fillRect(0, 0, 512, 128);
    sx.strokeStyle = "#f2c040"; sx.lineWidth = 8; sx.strokeRect(6, 6, 500, 116);
    sx.fillStyle = "#ffe08a"; sx.font = "64px 'Tiro Devanagari Hindi', serif"; sx.textAlign = "center"; sx.textBaseline = "middle";
    sx.fillText("दिवाली मेला", 256, 70);
    const st = new THREE.CanvasTexture(sign); st.colorSpace = THREE.SRGBColorSpace;
    for (const gz of [19.8, 25.2]) mesh(new THREE.CylinderGeometry(0.1, 0.12, 4.2, 8), M.bark, 20.2, 2.1, gz);
    const board = mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshStandardMaterial({ map: st, emissiveMap: st, emissive: 0xffffff, emissiveIntensity: 0.35, side: THREE.DoubleSide }), 20.2, 3.75, 22.5);
    board.rotation.y = -Math.PI / 2;
    const archPts = [];
    for (let k = 0; k <= 30; k++) { const u = k / 30, a = u * Math.PI; archPts.push(new THREE.Vector3(20.15, 4.2 + Math.sin(a) * 0.6, 19.8 + u * 5.4)); }
    for (let k = 0; k < 14; k++) { archPts.push(new THREE.Vector3(20.1, 0.3 + k * 0.28, 19.8)); archPts.push(new THREE.Vector3(20.1, 0.3 + k * 0.28, 25.2)); }
    bulbRing(scene, archPts, [[1, 0.8, 0.3], [1, 0.25, 0.3], [0.3, 0.9, 0.4]]);
    circle(20.2, 19.8, 0.25); circle(20.2, 25.2, 0.25);

    // strands of lights across the fairground
    const posts = [[21, 15], [34, 15], [35, 31], [21, 31.5]];
    for (const [px, pz] of posts) mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.5, 6), M.bark, px, 2.25, pz);
    for (let i = 0; i < 4; i++) {
      const [ax, az] = posts[i], [bx, bz] = posts[(i + 1) % 4];
      strand(new THREE.Vector3(ax, 4.4, az), new THREE.Vector3(bx, 4.4, bz), 0.4, PALETTES.multi, 1, 0.9);
      strand(new THREE.Vector3(ax, 4.4, az), new THREE.Vector3(WX, WY + R + 0.3, WZ), 0.4, PALETTES.gold, 0, 1.2);
    }

    // candy-floss seller: pink clouds on sticks bound to a pole
    const cf = makePerson({ kind: "man", color: "#6a9ac8" });
    cf.group.position.set(22.1, 0, 24.6); cf.group.rotation.y = -1.6; scene.add(cf.group); people.push(cf);
    mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.2), M.bark, 21.6, 1.1, 24.9);
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff8ac8, roughness: 1, emissive: 0x401028 }), 21.6 + Math.cos(a) * 0.2, 1.8 + (i % 3) * 0.18, 24.9 + Math.sin(a) * 0.2).scale.set(1, 1.3, 1); }
    // chaat thela with a glass box and a hurricane lantern
    const th = new THREE.Group(); th.position.set(22.6, 0, 16.6); th.rotation.y = -0.4; scene.add(th);
    addBox(1.6, 0.08, 0.9, M.wood, 0, 0.82, 0, th);
    for (const s of [-1, 1]) mesh(new THREE.TorusGeometry(0.3, 0.04, 6, 16), M.iron, s * 0.6, 0.32, 0.47, th);
    addBox(0.9, 0.45, 0.6, new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.25, roughness: 0.1 }), -0.2, 0.9, 0, th);
    for (let i = 0; i < 12; i++) mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd8a050, roughness: 0.7 }), -0.45 + (i % 6) * 0.1, 0.98 + Math.floor(i / 6) * 0.08, 0, th); // gol gappe
    const tl = new THREE.Vector3(0.5, 1.15, 0).applyMatrix4(th.matrixWorld.compose(th.position, th.quaternion, th.scale));
    lamps.add(tl.x, tl.y, tl.z, { bowl: false, flame: 0.08, decal: false });
    lamps.spot(tl.x, tl.y, tl.z, 3, 0xffc070, { range: 6 });
    const cw = makePerson({ kind: "man", color: "#ece6da" });
    cw.group.position.set(23.4, 0, 16.2); cw.group.rotation.y = -1.6; scene.add(cw.group); people.push(cw);
    aabb(22.6, 16.6, 1, 0.8);

    // ground lamps along the fair path
    lamps.row([19.5, 0.01, 19.4], [19.5, 0.01, 25.6], 10, { spotPower: 3 });
    api.melaCenter = new THREE.Vector3(MX, 0, MZ);
  }

  /* ===================================================================== */
  /* the market street (bazaar): pakka shops either side of a brick road   */
  /* ===================================================================== */
  {
    const road = mesh(new THREE.PlaneGeometry(26, 7.6), new THREE.MeshStandardMaterial({ map: T.kharanja(), bumpMap: T.kharanja(), bumpScale: 3, roughness: 0.95 }), -26.5, 0.007, -26);
    road.rotation.x = -Math.PI / 2;
    const tinMat = new THREE.MeshStandardMaterial({ map: T.tin(), metalness: 0.6, roughness: 0.5, side: THREE.DoubleSide });
    const shutter = new THREE.MeshStandardMaterial({ color: 0x6a7076, metalness: 0.7, roughness: 0.45 });
    const steel = new THREE.MeshStandardMaterial({ color: 0xd0d4d8, metalness: 0.95, roughness: 0.18 });
    const pcol = (c) => paintM(c, { roughness: 0.5 });
    const box = (g, w, h, d, c, x, y, z) => addBox(w, h, d, pcol(c), x, y, z, g);
    const PACK = [0xd8203a, 0xf2b705, 0x1d6ad8, 0x2a9a3a, 0xff7a10, 0x7a1aa0, 0xf0ebe0, 0x00897b];

    const fill = {
      kirana(g) {
        for (let lv = 0; lv < 3; lv++) {
          box(g, 3.0, 0.04, 0.45, 0x6a4a2a, 0, 0.95 + lv * 0.6, -1.3);
          for (let i = 0; i < 14; i++) box(g, 0.15, 0.2 + (i % 3) * 0.06, 0.18, PACK[(i + lv * 3) % 8], -1.35 + i * 0.205, 0.99 + lv * 0.6, -1.3);
        }
        // open sacks of rice, dal, chilli, wheat and sugar at the front
        const grain = [0xf0ebe0, 0xf2b705, 0xb3121f, 0xc8a060, 0xfaf8f0];
        for (let i = 0; i < 5; i++) {
          const sk = mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.45, 12, 1, true), juteMat, -1.2 + i * 0.6, 0.35 + 0.225, 0.95, g);
          mesh(new THREE.CircleGeometry(0.19, 12), pcol(grain[i]), -1.2 + i * 0.6, 0.35 + 0.42, 0.95, g).rotation.x = -Math.PI / 2;
          mesh(new THREE.TorusGeometry(0.2, 0.03, 6, 14), juteMat, -1.2 + i * 0.6, 0.35 + 0.45, 0.95, g).rotation.x = Math.PI / 2;
        }
        // chips and namkeen packets hanging in strips from the lintel
        for (let s2 = 0; s2 < 4; s2++) for (let k = 0; k < 6; k++) { const pk = mesh(new THREE.PlaneGeometry(0.16, 0.2), pcol(PACK[(s2 + k) % 8]), -1.4 + s2 * 0.12, 2.55 - k * 0.22, 1.5 - s2 * 0.01, g); pk.rotation.y = 0.1; }
        box(g, 2.0, 0.85, 0.5, 0x5a3a20, 0.4, 0.35, -0.2); // counter
        tarazu(g, 0.9, 1.2, -0.2);
      },
      bartan(g) {
        // steel thalis on edge, stacks of katoris, lotas, a kadhai and pressure cookers
        for (let i = 0; i < 9; i++) { const t2 = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 24), steel, -1.3 + i * 0.32, 1.3, -1.45, g); t2.rotation.x = Math.PI / 2 - 0.2; }
        for (let i = 0; i < 9; i++) { const t2 = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 24), i % 3 ? steel : M.brass, -1.3 + i * 0.32, 1.95, -1.45, g); t2.rotation.x = Math.PI / 2 - 0.2; }
        for (let s2 = 0; s2 < 5; s2++) for (let k = 0; k < 7; k++) mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.05, 16), steel, -1.1 + s2 * 0.45, 0.4 + k * 0.045, 0.6, g);
        const lota = new THREE.LatheGeometry([[0, 0], [0.07, 0.01], [0.1, 0.07], [0.09, 0.13], [0.05, 0.17], [0.06, 0.2]].map(([a, b]) => new THREE.Vector2(a, b)), 16);
        for (let i = 0; i < 6; i++) mesh(lota, i % 2 ? M.brass : steel, -1.2 + i * 0.45, 0.35, 1.05, g);
        const kd = mesh(new THREE.SphereGeometry(0.3, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.iron, 1.1, 0.68, -0.4, g); kd.material = M.iron.clone(); kd.material.side = THREE.DoubleSide;
        for (let k = 0; k < 8; k++) { const ld = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5), steel, -1.4 + k * 0.38, 2.4, 1.5, g); mesh(new THREE.SphereGeometry(0.05, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), steel, 0, -0.27, 0, ld); } // ladles on hooks
      },
      kapda(g) {
        // saris hung from rods at the front, folded cloth on shelves behind
        const SA = [["#b8122c", "#1a3a8a"], ["#e8641a", "#6a1b9a"], ["#2e7d32", "#c8102a"], ["#f2b705", "#b8122c"], ["#c2185b", "#2e7d32"], ["#0d6e7a", "#e8a020"], ["#6a1b9a", "#f2b705"]];
        mesh(new THREE.CylinderGeometry(0.015, 0.015, 3.2), steel, 0, 2.55, 1.3, g).rotation.z = Math.PI / 2;
        SA.forEach(([b, bd], i) => {
          const sw = new THREE.Group(); sw.position.set(-1.35 + i * 0.45, 2.55, 1.3); g.add(sw);
          mesh(new THREE.PlaneGeometry(0.42, 1.9, 1, 6), new THREE.MeshStandardMaterial({ map: T.sari(b, bd), side: THREE.DoubleSide, roughness: 0.6 }), 0, -0.95, 0, sw);
          const sp = rand(0, 6);
          updaters.push((dt, t) => (sw.rotation.x = Math.sin(t * 0.8 + sp) * 0.06));
        });
        for (let lv = 0; lv < 3; lv++) { box(g, 3.0, 0.04, 0.45, 0x6a4a2a, 0, 0.95 + lv * 0.6, -1.3); for (let i = 0; i < 10; i++) for (let k = 0; k < 4; k++) box(g, 0.26, 0.05, 0.3, PACK[(i + k + lv) % 8], -1.3 + i * 0.29, 0.99 + lv * 0.6 + k * 0.055, -1.3); }
        box(g, 2.4, 0.4, 1.2, 0xf0ebe0, 0, 0.35, -0.2); // white gaddi where customers sit
      },
      decoration(g) {
        // kandils, LED strings and torans on every surface
        for (let i = 0; i < 6; i++) kandil(...toWorld(g, -1.3 + i * 0.52, 2.2 - (i % 2) * 0.3, 1.2).toArray(), [0xff7a20, 0xd8203a, 0x40a0ff, 0xffc030, 0x8a3ad8, 0x30c080][i], 0.3);
        for (let k = 0; k < 5; k++) strand(toWorld(g, -1.5, 2.6 - k * 0.35, -1.4), toWorld(g, 1.5, 2.6 - k * 0.35, -1.4), 0.12, [PALETTES.multi, PALETTES.rgb, PALETTES.gold, PALETTES.pink, PALETTES.warm][k], (k % 2) + 1, 0.1);
        for (let k = 0; k < 4; k++) toran(g, -0.4 + k * 0.3 - 0.5, 1.6 - k * 0.25, -1.35, 1.6);
        box(g, 2.6, 0.75, 0.6, 0x5a3a20, 0, 0.35, 0.4);
      },
      mobile(g) {
        // phones in a glass counter, recharge posters, a photocopier, ringing film songs implied
        const glass = new THREE.MeshStandardMaterial({ color: 0xd8ecff, transparent: true, opacity: 0.2, roughness: 0.05, depthWrite: false });
        box(g, 2.4, 0.75, 0.6, 0x3a3a40, 0, 0.35, 0.5);
        addBox(2.4, 0.3, 0.6, glass, 0, 1.1, 0.5, g);
        for (let i = 0; i < 10; i++) { const ph = addBox(0.08, 0.008, 0.15, pcol(0x111114), -1.0 + i * 0.22, 1.11, 0.5, g); mesh(new THREE.PlaneGeometry(0.065, 0.13), new THREE.MeshBasicMaterial({ color: [0x60a0ff, 0xff70a0, 0x70ff90, 0xffd060][i % 4] }), 0, 0.005, 0, ph).rotation.x = -Math.PI / 2; }
        for (let i = 0; i < 4; i++) mesh(new THREE.PlaneGeometry(0.6, 0.8), new THREE.MeshBasicMaterial({ color: [0xe8203a, 0x1d6ad8, 0xf2b705, 0x2a9a3a][i] }), -1.15 + i * 0.75, 1.9, -1.58, g);
        box(g, 0.7, 0.9, 0.6, 0xd0d0d0, 1.1, 0.35, -1.0); // photocopier
      },
      mithaiShop(g) {
        const glass = new THREE.MeshStandardMaterial({ color: 0xd8ecff, transparent: true, opacity: 0.18, roughness: 0.05, depthWrite: false });
        box(g, 3.0, 0.75, 0.7, 0x8a6a4a, 0, 0.35, 0.6);
        addBox(3.0, 0.45, 0.7, glass, 0, 1.1, 0.6, g);
        const sweets = [0xf0a020, 0xeee2c8, 0xb8d890, 0xd06a2a, 0xffffff, 0x8a3a1a];
        for (let i = 0; i < 6; i++) {
          mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.02, 20), steel, -1.2 + i * 0.48, 1.12, 0.6, g);
          for (let k = 0; k < 9; k++) {
            const c = pcol(sweets[i]);
            if (i % 2) addBox(0.07, 0.025, 0.07, c, -1.2 + i * 0.48 + ((k % 3) - 1) * 0.08, 1.14, 0.6 + (Math.floor(k / 3) - 1) * 0.08, g).rotation.y = 0.785;
            else mesh(new THREE.SphereGeometry(0.035, 10, 8), c, -1.2 + i * 0.48 + ((k % 3) - 1) * 0.07, 1.16 + (k === 4 ? 0.05 : 0), 0.6 + (Math.floor(k / 3) - 1) * 0.07, g);
          }
        }
        for (let i = 0; i < 12; i++) box(g, 0.3, 0.07, 0.22, [0xc8306a, 0xd9a53a, 0x2a7a6a][i % 3], -1.2 + (i % 4) * 0.35, 0.99 + Math.floor(i / 4) * 0.075 + 0.6, -1.3);
        // jalebi frying at the shop front
        const kd = mesh(new THREE.SphereGeometry(0.35, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.iron, 1.2, 0.95, 1.35, g); kd.material = M.iron.clone(); kd.material.side = THREE.DoubleSide;
        mesh(new THREE.CircleGeometry(0.32, 20), pcol(0xc8901a), 1.2, 0.84, 1.35, g).rotation.x = -Math.PI / 2;
        for (let i = 0; i < 5; i++) { const j = mesh(new THREE.TorusGeometry(0.05, 0.014, 6, 18), paintM(0xff8a10, { emissive: 0x401800, roughness: 0.3 }), 1.2 + Math.cos(i * 1.3) * 0.15, 0.86, 1.35 + Math.sin(i * 1.3) * 0.15, g); j.rotation.x = Math.PI / 2; }
        g.updateMatrixWorld();
        for (let i = 0; i < 4; i++) { const p = toWorld(g, 1.2 + rand(-0.1, 0.1), 0.38, 1.35 + rand(-0.1, 0.1)); lamps.add(p.x, p.y, p.z, { bowl: false, flame: 0.2, decal: false }); }
        mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.45, 14, 1, true), M.wall[3], 1.2, 0.58, 1.35, g);
      },
      patakheShop(g) {
        for (let lv = 0; lv < 4; lv++) { box(g, 3.0, 0.04, 0.45, 0x6a4a2a, 0, 0.8 + lv * 0.45, -1.3); for (let i = 0; i < 9; i++) box(g, 0.3, 0.3, 0.3, PACK[(i + lv) % 8], -1.25 + i * 0.31, 0.84 + lv * 0.45, -1.3); }
        box(g, 2.6, 0.5, 1.0, 0x5a3a20, 0, 0.35, 0.6);
        for (let i = 0; i < 16; i++) box(g, 0.24, 0.08, 0.18, PACK[i % 8], -1.1 + (i % 8) * 0.3, 0.86 + Math.floor(i / 8) * 0.09, 0.4 + Math.floor(i / 8) * 0.25);
      },
      laiyaShop(g) {
        // gunny sacks rolled open at the front, heaped with laiya, khil and murmura
        const heaps = [[0xf0e6d2, 0xfffaf0, 0xf6ecd8], [0xe8dcc0, 0xfff8ec, 0xd8b888], [0xf2e2c0, 0xfff2d8, 0xf0dcb0], [0xf0e6d2, 0xfffaf0, 0xfff0d8]];
        for (let i = 0; i < 4; i++) {
          const lx = -1.15 + i * 0.62;
          mesh(new THREE.CylinderGeometry(0.27, 0.24, 0.42, 14, 1, true), juteMat, lx, 0.35 + 0.21, 1.0, g);
          mesh(new THREE.TorusGeometry(0.27, 0.05, 6, 16), juteMat, lx, 0.35 + 0.42, 1.0, g).rotation.x = Math.PI / 2;
          grainHeap(g, lx, 0.35 + 0.42, 1.0, 0.25, 0.16, heaps[i], 220);
        }
        // counter with paraats of batashe and gatta, a tiered stand of sugar toys
        box(g, 2.6, 0.6, 0.6, 0x8a5a2a, -0.1, 0.35, 0.05);
        batasheTray(g, -0.85, 0.95, 0.05, 0.22);
        gattaTray(g, -0.3, 0.95, 0.05, 0.22);
        batasheTray(g, 0.25, 0.95, 0.05, 0.18);
        for (let k = 0; k < 3; k++) { box(g, 1.0 - k * 0.2, 0.1, 0.3 - k * 0.04, 0xe8e0d0, 0.75, 0.95 + k * 0.1, 0.05 - k * 0.02); sugarToys(g, 0.35 + k * 0.1, 1.05 + k * 0.1, -0.02 - k * 0.02, 5 - k, 0.75 - k * 0.2); }
        // shelves of filled polythene packets and tins behind
        const bagM = new THREE.MeshStandardMaterial({ color: 0xfff8ee, roughness: 0.3, transparent: true, opacity: 0.9 });
        for (let lv = 0; lv < 3; lv++) { box(g, 3.0, 0.04, 0.45, 0x6a4a2a, 0, 0.95 + lv * 0.6, -1.3); for (let i = 0; i < 11; i++) { const pk = addBox(0.2, 0.26, 0.14, i % 3 ? bagM : pcol([0xd8203a, 0xf2b705, 0x1d6ad8][lv]), -1.3 + i * 0.26, 0.99 + lv * 0.6, -1.3, g); pk.rotation.y = rand(-0.15, 0.15); } }
        tarazu(g, 1.25, 1.2, -0.5);
        // a framed Lakshmi ji on the back wall, garlanded
        framedPicture(g, 0, 2.75, -1.5, 0.5, 0.36, T.goods("murti"));
      },
      paan(g) {
        // the paanwala's raised gaddi: a red cloth, wet betel leaves under a cloth, brass dabbas of katha and chuna
        box(g, 1.6, 0.75, 1.0, 0x7a2a1a, 0, 0.35, 0.35);
        addBox(1.5, 0.02, 0.9, paintM(0xa3122a, { roughness: 1 }), 0, 1.1, 0.35, g);
        const leaf = paintM(0x3a8a2a, { roughness: 0.5, side: THREE.DoubleSide });
        for (let i = 0; i < 28; i++) { const lf = mesh(new THREE.CircleGeometry(0.07, 10), leaf, -0.45 + (i % 7) * 0.035, 1.125 + Math.floor(i / 7) * 0.006, 0.45 + (i % 3) * 0.01, g); lf.rotation.x = -Math.PI / 2; lf.scale.set(1, 1.4, 1); lf.rotation.z = rand(-0.3, 0.3); }
        addBox(0.4, 0.015, 0.35, paintM(0xe8e0d0, { roughness: 1 }), -0.35, 1.13, 0.2, g); // the damp cloth
        for (let i = 0; i < 7; i++) mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.06, 14), M.brass, 0.1 + (i % 4) * 0.12, 1.15, 0.2 + Math.floor(i / 4) * 0.14, g);
        // a smouldering rope lighter hanging at the side, strips of saunf-supari sachets, a mirror and bottles
        mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.0), ropeMat, 0.95, 1.6, 0.7, g);
        const em = toWorld(g, 0.95, 1.1, 0.7); lamps.add(em.x, em.y, em.z, { bowl: false, flame: 0.05, decal: false, tint: [1, 0.5, 0.3] });
        for (let k = 0; k < 5; k++) for (let i = 0; i < 9; i++) { const pk = mesh(new THREE.PlaneGeometry(0.12, 0.13), pcol(PACK[(k + i) % 8]), -1.3 + k * 0.14, 2.6 - i * 0.15, 1.45, g); pk.rotation.y = 0.1; }
        mesh(new THREE.PlaneGeometry(0.6, 0.8), new THREE.MeshStandardMaterial({ color: 0xc8d8e0, metalness: 1, roughness: 0.05 }), 0, 1.8, -1.58, g);
        for (let i = 0; i < 10; i++) mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.24, 10), new THREE.MeshStandardMaterial({ color: [0x2a1a0a, 0xff7a10, 0x30a040][i % 3], roughness: 0.15, transparent: true, opacity: 0.85 }), -1.2 + i * 0.12, 1.07, -1.3, g);
        box(g, 3.0, 0.04, 0.45, 0x6a4a2a, 0, 0.95, -1.3);
      },
      phool(g) {
        // the flower seller: heaps of marigold, rose petals, and garlands hung in curtains
        for (let i = 0; i < 4; i++) {
          const hp = mesh(new THREE.SphereGeometry(0.35, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), pcol(i % 2 ? 0xffb020 : 0xff8010), -1.1 + i * 0.72, 0.35, 0.9, g);
          hp.scale.y = 0.6;
        }
        mesh(new THREE.SphereGeometry(0.3, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), pcol(0xc0102a), 1.0, 0.35, 0.2, g).scale.y = 0.5;
        g.updateMatrixWorld();
        for (let k = 0; k < 14; k++) for (let i = 0; i < 22; i++) {
          const p = toWorld(g, -1.4 + k * 0.21, 2.6 - i * 0.07, 1.4);
          marigolds.push([p.x, p.y, p.z, (i + k) % 2]);
        }
      },
    };

    function shop(x, z, rot, kind, hi, en, bg, keeper = "man") {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g); g.updateMatrixWorld();
      const W = 3.5, D = 3.2, H = 3.0, t = 0.22;
      const wallM = M.wall[[0, 2, 1][Math.abs(Math.round(x)) % 3]];
      for (const [lx, lz, sw, sd] of [[0, -D / 2 + t / 2, W, t], [-W / 2 + t / 2, 0, t, D], [W / 2 - t / 2, 0, t, D]]) { const b = new THREE.Mesh(worldUVBox(sw, H, sd), wallM); b.position.set(lx, H / 2, lz); g.add(b); }
      addBox(W, 0.2, D, M.top[1], 0, H, 0, g); // roof slab
      addBox(W, 0.35, D, M.top[1], 0, 0, 0, g); // raised shop floor
      addBox(W, 0.5, 0.15, wallM, 0, H + 0.2, D / 2 - 0.1, g); // parapet
      // rolled-up shutter, tubelight and the signboard
      const roll = mesh(new THREE.CylinderGeometry(0.16, 0.16, W - 0.3, 16), shutter, 0, H - 0.25, D / 2 - 0.2, g); roll.rotation.z = Math.PI / 2;
      mesh(new THREE.BoxGeometry(1.2, 0.035, 0.035), new THREE.MeshBasicMaterial({ color: 0xeaf6ff }), 0, H - 0.15, 0.2, g);
      const sgn = mesh(new THREE.PlaneGeometry(W, 0.72), new THREE.MeshStandardMaterial({ map: T.shopSign(hi, en, bg), emissiveMap: T.shopSign(hi, en, bg), emissive: 0xffffff, emissiveIntensity: 0.4, roughness: 0.7 }), 0, H + 0.62, D / 2 + 0.02, g);
      // tin chhajja over the front, strung with lights
      const ch = mesh(new THREE.PlaneGeometry(W + 0.3, 1.1), tinMat, 0, H - 0.1, D / 2 + 0.5, g); ch.rotation.x = -Math.PI / 2 + 0.18;
      strand(toWorld(g, -W / 2 - 0.1, H - 0.22, D / 2 + 1.05), toWorld(g, W / 2 + 0.1, H - 0.22, D / 2 + 1.05), 0.17, [PALETTES.multi, PALETTES.warm, PALETTES.rgb, PALETTES.gold][Math.abs(Math.round(x)) % 4], Math.abs(Math.round(x)) % 3, 0.12);
      fill[kind](g);
      const lp = toWorld(g, 0, H - 0.6, 0.4);
      lamps.spot(lp.x, lp.y, lp.z, 6, 0xf0f4ff, { flicker: 0.03, range: 8 });
      const dp = [toWorld(g, -W / 2 + 0.25, 0.35, D / 2 - 0.1), toWorld(g, W / 2 - 0.25, 0.35, D / 2 - 0.1)];
      dp.forEach((p) => lamps.add(p.x, p.y, p.z));
      toran(g, 0, H - 0.4, D / 2 + 0.02, W - 0.4);
      const kp = makePerson({ kind: keeper, pose: "sit" });
      // most sit on the shop floor behind the counter; the paanwala sits up on his gaddi among the leaves
      kp.group.position.copy(kind === "paan" ? toWorld(g, 0.45, 1.12, -0.05) : toWorld(g, 0.7, 0.35, -0.6));
      kp.group.rotation.y = rot;
      scene.add(kp.group); people.push(kp);
      const c = Math.abs(Math.cos(rot)) > 0.5;
      aabb(x, z, (c ? W : D) / 2 + 0.1, (c ? D : W) / 2 + 0.1);
      // the explore view steps up onto the shop floor, in front of the counter
      (api.shops ||= []).push({ group: g, kind, hi, en, keeper: kp, view: [-0.35, 1.95, 1.75], aim: [0.1, 1.1, -1.3] });
    }

    const N = -20.6, S = -31.4; // shop centres; fronts face the road
    shop(-16.2, N, Math.PI, "kirana", "शर्मा किराना स्टोर", "Sharma Kirana Store", "#b8122c");
    shop(-19.9, N, Math.PI, "bartan", "गुप्ता बर्तन भंडार", "Gupta Bartan Bhandar", "#1a4a8a");
    shop(-23.6, N, Math.PI, "kapda", "न्यू फैशन वस्त्रालय", "New Fashion Vastralay", "#6a1b9a", "woman");
    shop(-27.3, N, Math.PI, "decoration", "जय माता दी डेकोरेशन", "Jai Mata Di Decoration", "#c8501a");
    shop(-31.0, N, Math.PI, "mobile", "राज मोबाइल · रिचार्ज", "Raj Mobile · Recharge · Photocopy", "#0d6e7a");
    shop(-16.2, S, 0, "mithaiShop", "अग्रवाल मिष्ठान्न भंडार", "Agarwal Mishthan Bhandar", "#c8102a");
    shop(-19.9, S, 0, "patakheShop", "बजरंग फैंसी पटाखा", "Bajrang Fancy Patakha", "#2a6a3a");
    shop(-23.6, S, 0, "phool", "फूल माला भंडार", "Phool Mala Bhandar", "#d8641a", "woman");
    shop(-27.3, S, 0, "kirana", "श्याम जनरल स्टोर", "Shyam General Store", "#1a4a8a");
    shop(-31.0, S, 0, "kapda", "लक्ष्मी साड़ी सेंटर", "Lakshmi Saree Centre", "#b8122c", "woman");
    shop(-34.7, N, Math.PI, "laiyaShop", "गुप्ता खील-बताशा भंडार", "Gupta Khil-Batasha Bhandar", "#c8501a");
    shop(-34.7, S, 0, "paan", "बनारसी पान भंडार", "Banarasi Paan Bhandar", "#2a6a3a");
    // string lights criss-crossing the street
    for (let x = -15; x > -38; x -= 3.7) strand(new THREE.Vector3(x, 3.6, -22.2), new THREE.Vector3(x - 1.8, 3.6, -29.8), 0.3, PALETTES.multi, 1, 0.7);
    api.marketCenter = new THREE.Vector3(-24, 0, -26);
  }

  /* ===================================================================== */
  /* animals, the tractor and bicycles                                     */
  /* ===================================================================== */
  // dog: sleeping curled up, or trotting the lanes with a wagging tail
  function dog(x, z, rot, o = {}) {
    const g = new THREE.Group(); g.position.set(x, o.y ?? 0, z); g.rotation.y = rot; scene.add(g);
    const fur = paintM(o.color ?? 0xb08050, { roughness: 0.95 });
    const legs = [], s = 1;
    if (o.sleep) {
      const body = mesh(new THREE.TorusGeometry(0.2, 0.12, 8, 16, Math.PI * 1.7), fur, 0, 0.12, 0, g); body.rotation.x = Math.PI / 2;
      mesh(new THREE.SphereGeometry(0.09, 10, 8), fur, 0.2, 0.12, 0.12, g).scale.set(1.2, 0.8, 1);
      const breath = rand(0, 6);
      updaters.push((dt, t) => (body.scale.z = 1 + Math.sin(t * 1.2 + breath) * 0.06));
      return { g };
    }
    mesh(new THREE.CapsuleGeometry(0.12, 0.38, 4, 10), fur, 0, 0.42, 0, g).rotation.x = Math.PI / 2;
    const head = new THREE.Group(); head.position.set(0, 0.55, 0.3); g.add(head);
    mesh(new THREE.SphereGeometry(0.09, 10, 8), fur, 0, 0, 0, head);
    mesh(new THREE.CapsuleGeometry(0.04, 0.08, 4, 8), fur, 0, -0.03, 0.1, head).rotation.x = Math.PI / 2;
    mesh(new THREE.SphereGeometry(0.02, 6, 4), paintM(0x111111), 0, -0.02, 0.17, head);
    for (const sd of [-1, 1]) mesh(new THREE.ConeGeometry(0.035, 0.08, 6), fur, sd * 0.05, 0.08, -0.01, head).rotation.z = -sd * 0.3;
    for (const [lx, lz] of [[-0.08, 0.17], [0.08, 0.17], [-0.08, -0.17], [0.08, -0.17]]) {
      const pv = new THREE.Group(); pv.position.set(lx, 0.36, lz); g.add(pv);
      mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.36, 6), fur, 0, -0.18, 0, pv);
      legs.push(pv);
    }
    const tail = new THREE.Group(); tail.position.set(0, 0.48, -0.3); g.add(tail);
    mesh(new THREE.CylinderGeometry(0.02, 0.012, 0.22, 6), fur, 0, 0.1, -0.03, tail).rotation.x = -0.6;
    const d = { g, legs, tail, head, moving: false, ph: rand(0, 6) };
    updaters.push((dt, t) => {
      tail.rotation.z = Math.sin(t * (d.moving ? 14 : 5) + d.ph) * 0.5;
      const sw = d.moving ? Math.sin(t * 11 + d.ph) * 0.5 : 0;
      legs[0].rotation.x = legs[3].rotation.x = sw; legs[1].rotation.x = legs[2].rotation.x = -sw;
      head.rotation.y = Math.sin(t * 0.7 + d.ph) * 0.3;
    });
    return d;
  }
  dog(-13.0, 26.5, 2.2, { sleep: true, color: 0xc89060 }); // under the courtyard charpai
  dog(-20.6, -26.1, 0.4, { sleep: true, color: 0x6a5040 }); // in the bazaar doorway
  {
    const d = dog(0, 30, 0, { color: 0xb08050 });
    d.moving = true;
    const w = new Walker({ group: d.g, kind: "dog", pose: "walk", speed: 0 }, [[-1.8, 52], [-1.6, 30], [2.2, 16], [4.6, 2], [5.6, -16]], { loop: false, speed: 1.3, pause: 3 });
    walkers.push(w);
    updaters.push(() => (d.moving = w.wait <= 0));
  }
  // goats tethered by the cowshed, nibbling
  for (const [gx, gz, col] of [[23.6, 42.8, 0xf0ece4], [24.4, 41.7, 0x2a2420], [22.8, 41.4, 0x8a6040]]) {
    const g = new THREE.Group(); g.position.set(gx, 0, gz); g.rotation.y = rand(0, 6); scene.add(g);
    const fur = paintM(col, { roughness: 1 });
    mesh(new THREE.CapsuleGeometry(0.14, 0.3, 4, 10), fur, 0, 0.45, 0, g).rotation.x = Math.PI / 2;
    for (const [lx, lz] of [[-0.08, 0.15], [0.08, 0.15], [-0.08, -0.15], [0.08, -0.15]]) mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.36, 6), fur, lx, 0.18, lz, g);
    const head = new THREE.Group(); head.position.set(0, 0.55, 0.28); g.add(head);
    mesh(new THREE.CapsuleGeometry(0.06, 0.12, 4, 8), fur, 0, 0, 0.05, head).rotation.x = 1.1;
    for (const sd of [-1, 1]) { const h = mesh(new THREE.ConeGeometry(0.015, 0.12, 6), paintM(0x3a3028), sd * 0.04, 0.08, -0.02, head); h.rotation.x = -0.6; mesh(new THREE.SphereGeometry(0.03, 6, 4), fur, sd * 0.07, 0.02, 0, head).scale.set(1.6, 0.4, 0.8); }
    const ph = rand(0, 6);
    updaters.push((dt, t) => (head.rotation.x = 0.5 + Math.max(0, Math.sin(t * 0.6 + ph)) * 0.6));
    mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5), M.bark, gx + 0.8, 0.25, gz + 0.6);
    circle(gx, gz, 0.4);
  }
  // a cat on the courtyard wall, watching the lamps
  {
    const g = new THREE.Group(); g.position.set(-16.5, 1.35, 27); g.rotation.y = Math.PI; scene.add(g);
    const fur = paintM(0x2a2622, { roughness: 1 });
    mesh(new THREE.SphereGeometry(0.1, 10, 8), fur, 0, 0.1, 0, g).scale.set(0.9, 1.1, 1.2);
    mesh(new THREE.SphereGeometry(0.065, 10, 8), fur, 0, 0.24, 0.05, g);
    for (const sd of [-1, 1]) { mesh(new THREE.ConeGeometry(0.025, 0.05, 4), fur, sd * 0.035, 0.3, 0.05, g); mesh(new THREE.SphereGeometry(0.011, 6, 4), new THREE.MeshBasicMaterial({ color: 0xc8e060 }), sd * 0.025, 0.25, 0.108, g); }
    const tail = mesh(new THREE.TorusGeometry(0.1, 0.015, 5, 12, Math.PI), fur, 0.05, 0.02, -0.05, g); tail.rotation.y = 1.2;
    updaters.push((dt, t) => (tail.rotation.z = Math.sin(t * 0.8) * 0.3));
  }

  // the family tractor, washed and garlanded for Diwali
  {
    const g = new THREE.Group(); g.position.set(-3.9, 0, 44.6); g.rotation.y = 0.12; scene.add(g);
    const red = paintM(0xb3121f, { roughness: 0.35, metalness: 0.3 }), blk = paintM(0x141414, { roughness: 0.9 }), chrome = paintM(0xc8ccd0, { metalness: 0.9, roughness: 0.25 });
    addBox(0.7, 0.55, 1.5, red, 0, 0.75, 0.75, g); // bonnet
    addBox(0.8, 0.12, 1.0, red, 0, 0.85, -0.4, g); // chassis
    for (const sd of [-1, 1]) {
      const rw = mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.38, 22), blk, sd * 0.68, 0.62, -0.5, g); rw.rotation.z = Math.PI / 2;
      mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.39, 16), paintM(0xd8a020), sd * 0.68, 0.62, -0.5, g).rotation.z = Math.PI / 2;
      const fw = mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.2, 18), blk, sd * 0.5, 0.33, 1.2, g); fw.rotation.z = Math.PI / 2;
      const mg = mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.4, 20, 1, true, 0, Math.PI), red, sd * 0.68, 0.62, -0.5, g); mg.rotation.z = Math.PI / 2; mg.material = red.clone(); mg.material.side = THREE.DoubleSide;
      mesh(new THREE.CircleGeometry(0.08, 14), new THREE.MeshBasicMaterial({ color: 0xfff2c8 }), sd * 0.22, 0.85, 1.51, g); // headlights
    }
    addBox(0.5, 0.1, 0.4, blk, 0, 1.15, -0.55, g); // seat
    const sw = mesh(new THREE.TorusGeometry(0.17, 0.02, 6, 16), blk, 0, 1.45, 0, g); sw.rotation.x = -1.0;
    mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.8), chrome, 0.28, 1.4, 1.2, g); // exhaust
    g.updateMatrixWorld();
    for (let i = 0; i <= 24; i++) { const u = i / 24; const p = toWorld(g, -0.36 + u * 0.72, 1.0 - Math.sin(u * Math.PI) * 0.18, 1.52); marigolds.push([p.x, p.y, p.z, i % 2]); }
    for (let i = 0; i <= 30; i++) { const u = i / 30; const p = toWorld(g, -0.36, 1.03, 0.0 + u * 1.5); marigolds.push([p.x, p.y, p.z, i % 2]); const q = toWorld(g, 0.36, 1.03, u * 1.5); marigolds.push([q.x, q.y, q.z, (i + 1) % 2]); }
    for (const lz of [0.4, 1.1]) { const p = toWorld(g, 0, 1.03, lz); lamps.add(p.x, p.y, p.z, { decal: false }); }
    const sh = toWorld(g, 0, 0.95, 1.9);
    lamps.spot(sh.x, sh.y, sh.z, 2.5, 0xfff0d0, { flicker: 0.02, range: 6 });
    aabb(-3.9, 44.6, 0.9, 1.6);
  }
  // bicycles leaning on walls
  function bicycle(x, z, rot, col) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.set(0, rot, 0.18); scene.add(g);
    const fr = paintM(col, { metalness: 0.4, roughness: 0.4 }), blk = paintM(0x111111);
    for (const wz of [-0.5, 0.5]) { const w = mesh(new THREE.TorusGeometry(0.33, 0.02, 6, 24), blk, 0, 0.35, wz, g); w.rotation.y = Math.PI / 2; for (let k = 0; k < 6; k++) { const sp = mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.64), paintM(0xbbbbbb, { metalness: 0.8 }), 0, 0.35, wz, g); sp.rotation.x = (k / 6) * Math.PI; } }
    limb(g, V(0, 0.35, -0.5), V(0, 0.75, -0.1), 0.015, fr);
    limb(g, V(0, 0.75, -0.1), V(0, 0.8, 0.38), 0.015, fr);
    limb(g, V(0, 0.4, 0.05), V(0, 0.8, 0.38), 0.015, fr);
    limb(g, V(0, 0.35, 0.5), V(0, 0.85, 0.42), 0.015, fr);
    limb(g, V(0, 0.4, 0.05), V(0, 0.75, -0.1), 0.015, fr);
    limb(g, V(-0.22, 0.95, 0.42), V(0.22, 0.95, 0.42), 0.012, blk);
    addBox(0.1, 0.04, 0.22, blk, 0, 0.8, -0.13, g);
    addBox(0.22, 0.02, 0.32, paintM(0x3a3a3a), 0, 0.68, -0.55, g); // carrier
  }
  bicycle(-5.15, 38.3, 0, 0x1d4f9a);
  bicycle(6.35, 31.4, Math.PI, 0x111111);
  bicycle(-14.1, -21.95, Math.PI / 2, 0x7a1010);


  /* ===================================================================== */
  /* a rangoli being drawn at a doorstep, ring by ring                     */
  /* ===================================================================== */
  {
    const RX = -4.1, RZ = 49.4;
    const mat = new THREE.MeshStandardMaterial({ map: T.rangoli(3), transparent: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 });
    const prog = { value: 0 };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uProg = prog;
      sh.fragmentShader = "uniform float uProg;\n" + sh.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
        vec2 rc = vMapUv - 0.5;
        float rr = length(rc) * 2.0, aa = atan(rc.y, rc.x) / 6.2831 + 0.5;
        // drawn from the centre outward, each ring swept round by hand
        float ring = floor(rr * 8.0) / 8.0;
        if (ring + aa / 8.0 > uProg * 1.15) discard;`);
    };
    const rg = mesh(new THREE.PlaneGeometry(1.8, 1.8), mat, RX, 0.011, RZ);
    rg.rotation.x = -Math.PI / 2;
    let t0 = 0;
    updaters.push((dt) => { t0 += dt; const cyc = t0 % 80; prog.value = Math.min(1, cyc / 55); }); // draws over a minute, rests, then she starts a fresh one
    lamps.ring(RX, 0.011, RZ, 1.0, 8, { spotPower: 3 });
    place({ kind: "woman", pose: "squat" }, RX + 0.6, RZ + 0.95, Math.PI + 0.5);
    place({ kind: "girl", pose: "stand" }, RX - 0.7, RZ + 1.1, Math.PI - 0.6);
    // her plate of colours beside her
    mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.015, 20), M.brass, RX + 0.95, 0.01, RZ + 0.45);
    ["#f4a020", "#e0402a", "#1aa3a3", "#f3eadb", "#d6247a"].forEach((c, i) => mesh(new THREE.ConeGeometry(0.04, 0.04, 10), paintM(c, { roughness: 1 }), RX + 0.95 + Math.cos(i * 1.26) * 0.11, 0.035, RZ + 0.45 + Math.sin(i * 1.26) * 0.11));
  }

  /* ===================================================================== */
  /* the bhajan mandali beside the temple                                  */
  /* ===================================================================== */
  {
    const BX = 5.4, BZ = -28.4;
    const dari = mesh(new THREE.PlaneGeometry(3.2, 2.2), new THREE.MeshStandardMaterial({ map: T.cloth("#8a1a1a", "#d8a020"), roughness: 1 }), BX, 0.012, BZ);
    dari.rotation.x = -Math.PI / 2;
    const seats = [[-1.1, 0.5], [-0.4, 0.75], [0.4, 0.75], [1.1, 0.5], [-0.8, -0.35], [0.8, -0.35]];
    seats.forEach(([sx, sz], i) => place({ kind: i === 0 ? "elder" : i % 2 ? "man" : "woman", pose: i === 1 || i === 2 ? "sit" : "sitnamaste" }, BX + sx, BZ + sz, Math.atan2(-sx, -sz), 0.02));
    // harmonium and dholak
    addBox(0.42, 0.18, 0.26, M.darkWood, BX - 0.4, 0.01, BZ + 0.38);
    mesh(new THREE.PlaneGeometry(0.36, 0.06), paintM(0xf0ebe0), BX - 0.4, 0.2, BZ + 0.3).rotation.x = -1.2;
    const dh = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.42, 14), paintM(0x8a3a1a), BX + 0.4, 0.22, BZ + 0.45); dh.rotation.z = Math.PI / 2;
    lamps.add(BX, 0.012, BZ, { scale: 1.6 });
    lamps.spot(BX, 1.2, BZ, 4, 0xffb060, { range: 6 });
    api.bhajanCenter = new THREE.Vector3(BX, 0, BZ);
    circle(BX, BZ, 1.6);
  }

  /* ===================================================================== */
  /* the boat on the pond                                                  */
  /* ===================================================================== */
  {
    const boat = new THREE.Group(); scene.add(boat);
    const hullG = new THREE.CylinderGeometry(0.42, 0.42, 2.4, 16, 1, false, Math.PI / 2, Math.PI);
    hullG.rotateX(Math.PI / 2);
    const hp = hullG.attributes.position;
    for (let i = 0; i < hp.count; i++) { const zz = hp.getZ(i), k = 1 - Math.pow(Math.abs(zz) / 1.2, 3); hp.setX(i, hp.getX(i) * k); hp.setY(i, hp.getY(i) * (0.4 + 0.6 * k)); } // pinch bow and stern
    hullG.computeVertexNormals();
    const hull = mesh(hullG, new THREE.MeshStandardMaterial({ map: T.wood([90, 60, 36]), side: THREE.DoubleSide, roughness: 0.9 }), 0, 0.2, 0, boat);
    hull.rotation.z = Math.PI;
    addBox(0.6, 0.03, 0.12, M.darkWood, 0, 0.2, 0.3, boat);
    const man = makePerson({ kind: "man", pose: "sit", color: "#ece6da" });
    man.group.position.set(0, 0.06, -0.5); boat.add(man.group); people.push(man);
    const oar = mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.8), M.wood, 0.35, 0.5, -0.3, boat); oar.rotation.z = 0.8;
    const boatLamps = [];
    for (let i = 0; i < 8; i++) boatLamps.push({ id: lamps.add(0, 0, 0, { decal: false }), lx: (i % 2 ? 0.3 : -0.3) * (1 - Math.abs((Math.floor(i / 2) - 1.5) / 2.2)), lz: -0.9 + Math.floor(i / 2) * 0.6 });
    const v = new THREE.Vector3();
    updaters.push((dt, t) => {
      const a = t * 0.05;
      boat.position.set(24 + Math.cos(a) * 4.2, 0.02 + Math.sin(t * 1.2) * 0.02, -24 + Math.sin(a) * 4.2);
      boat.rotation.y = -a;
      boat.rotation.z = Math.sin(t * 0.9) * 0.03;
      oar.rotation.x = Math.sin(t * 1.4) * 0.4;
      boat.updateMatrixWorld();
      for (const b of boatLamps) { v.set(b.lx, 0.36, b.lz).applyMatrix4(boat.matrixWorld); lamps.move(b.id, v.x, v.y, v.z); }
    });
  }

  /* ===================================================================== */
  /* diyas the visitor sets down; a pool waiting below the ground          */
  /* ===================================================================== */
  api.userDiyas = Array.from({ length: 50 }, () => ({ id: lamps.add(0, -50, 0, { lit: false, decal: false, scale: 1.15 }), used: false, t: 0 }));
  api.userSpots = Array.from({ length: 4 }, () => lamps.spot(0, -50, 0, 2.5, 0xffa050, { on: 0 }));

  /* ===================================================================== */
  /* a night train crossing the far fields                                 */
  /* ===================================================================== */
  {
    const TZ = -96, train = new THREE.Group(); scene.add(train);
    const body = new THREE.MeshBasicMaterial({ color: 0x07070c, fog: false });
    const win = new THREE.MeshBasicMaterial({ color: 0xffd890, fog: false });
    const winCool = new THREE.MeshBasicMaterial({ color: 0xd8ecff, fog: false });
    for (let k = 0; k < 14; k++) {
      const cx = -k * 7.4;
      const coach = mesh(new THREE.BoxGeometry(7, 2.6, 2.8), body, cx, 1.9, 0, train);
      if (k === 0) continue; // the engine has no passenger windows
      for (let w = 0; w < 8; w++) if (Math.random() > 0.15) mesh(new THREE.PlaneGeometry(0.45, 0.5), Math.random() < 0.8 ? win : winCool, cx - 3 + w * 0.82, 2.1, 1.41, train);
    }
    mesh(new THREE.CircleGeometry(0.22, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), 3.51, 2.4, 0, train).rotation.y = Math.PI / 2;
    const beam = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow(), color: 0xfff2d0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    beam.position.set(4, 2.4, 0); beam.scale.setScalar(6); train.add(beam);
    // the embankment
    mesh(new THREE.BoxGeometry(400, 0.8, 5), new THREE.MeshBasicMaterial({ color: 0x050508, fog: false }), 0, 0.4, TZ);
    api.train = { group: train, x: -260, speed: 16, wait: 20, onHorn: null };
    updaters.push((dt) => {
      const tr = api.train;
      if (tr.wait > 0) { tr.wait -= dt; train.visible = false; return; }
      train.visible = true;
      tr.x += tr.speed * dt;
      train.position.set(tr.x, 0.6, TZ);
      if (!tr.horned && tr.x > -120) { tr.horned = true; tr.onHorn?.(); }
      if (tr.x > 260 + 14 * 7.4) { tr.x = -260; tr.wait = 60 + Math.random() * 60; tr.horned = false; }
    });
  }

  /* ===================================================================== */
  /* street lamps, hurricane lanterns and diyas along every lane           */
  /* ===================================================================== */
  {
    const concrete = paintM(0x8a8a86, { roughness: 0.9 });
    const ironM = paintM(0x2a2a2e, { roughness: 0.6, metalness: 0.6 });
    const LAMP = {
      sodium: { color: 0xffa548, glass: 0xffd08a, power: 9 },
      tube: { color: 0xe8f2ff, glass: 0xf4fbff, power: 7 },
      bulb: { color: 0xffc070, glass: 0xfff0c8, power: 6 },
    };
    // type, pole material; the arm reaches toward the middle of the lane
    function streetLamp(x, z, type = "sodium", pole = "concrete", o = {}) {
      const L = LAMP[type];
      const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
      g.rotation.y = x > (o.tx ?? 0) ? Math.PI : 0;
      const H = pole === "bamboo" ? 3.6 : 5.2;
      if (pole === "bamboo") mesh(new THREE.CylinderGeometry(0.045, 0.06, H, 8), bambooMat, 0, H / 2, 0, g);
      else { mesh(new THREE.CylinderGeometry(0.07, 0.12, H, 8), pole === "iron" ? ironM : concrete, 0, H / 2, 0, g); addBox(0.32, 0.25, 0.32, concrete, 0, 0, 0, g); }
      const arm = mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.2, 6), ironM, 0.6, H - 0.15, 0, g); arm.rotation.z = Math.PI / 2 - 0.12;
      let glassMesh;
      if (type === "tube") {
        addBox(0.75, 0.08, 0.16, ironM, 1.1, H - 0.1, 0, g);
        glassMesh = mesh(new THREE.BoxGeometry(0.7, 0.04, 0.05), new THREE.MeshBasicMaterial({ color: L.glass }), 1.1, H - 0.17, 0, g);
      } else if (type === "sodium") {
        const hood = mesh(new THREE.SphereGeometry(0.22, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), ironM, 1.15, H - 0.05, 0, g); hood.scale.set(1.3, 0.6, 0.9);
        glassMesh = mesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshBasicMaterial({ color: L.glass }), 1.15, H - 0.12, 0, g); glassMesh.scale.y = 0.55;
      } else {
        mesh(new THREE.ConeGeometry(0.16, 0.12, 12, 1, true), ironM, 1.1, H - 0.1, 0, g);
        glassMesh = mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: L.glass }), 1.1, H - 0.22, 0, g);
      }
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow(), color: L.color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 }));
      halo.position.copy(glassMesh.position); halo.scale.setScalar(type === "tube" ? 1.6 : 1.3); g.add(halo);
      g.updateMatrixWorld();
      const lp = toWorld(g, 1.1, H - 0.4, 0);
      const si = lamps.spot(lp.x, lp.y, lp.z, L.power, L.color, { flicker: o.flicker ? 0 : 0.03, range: 15 });
      if (o.flicker) { // an old tube that keeps catching and dropping
        let k = 1, wait = 0;
        updaters.push((dt) => {
          wait -= dt;
          if (wait <= 0) { k = Math.random() < 0.3 ? 0.15 : 1; wait = k < 1 ? 0.05 + Math.random() * 0.15 : 0.4 + Math.random() * 2.5; }
          lamps.spots[si].on = k; halo.material.opacity = 0.85 * k; glassMesh.material.color.setScalar(0.25 + 0.75 * k);
        });
      }
      if (o.moths) { // moths circling the glass
        const moths = [];
        for (let i = 0; i < 6; i++) moths.push({ m: mesh(new THREE.PlaneGeometry(0.03, 0.02), new THREE.MeshBasicMaterial({ color: 0xd8c8a0, side: THREE.DoubleSide }), 0, 0, 0, g), ph: rand(0, 6), r: rand(0.15, 0.4), sp: rand(3, 7) });
        updaters.push((dt, t) => { for (const q of moths) q.m.position.set(1.1 + Math.cos(t * q.sp + q.ph) * q.r, H - 0.2 + Math.sin(t * q.sp * 1.3 + q.ph) * 0.15, Math.sin(t * q.sp + q.ph) * q.r); });
      }
      circle(x, z, 0.25);
      return g;
    }
    [
      [3.4, 57.5, "sodium", "concrete", { moths: true }], [-3.3, 52.8, "bulb", "bamboo"], [3.4, 40.2, "tube", "concrete"],
      [3.4, 32.6, "sodium", "concrete"], [3.3, 24.2, "tube", "concrete", { flicker: true }], [-3.0, 15.6, "sodium", "concrete", { moths: true }],
      [3.2, 6.2, "bulb", "bamboo"], [12.3, 49.4, "bulb", "bamboo", { tx: 20 }], [-8.2, 56.2, "bulb", "bamboo", { tx: -12 }],
      [-10.2, 28.4, "bulb", "bamboo", { tx: -14 }], [-7.8, 27.6, "tube", "concrete", { tx: -16 }], [9.6, 11.0, "sodium", "concrete", { tx: 15 }],
      [17.8, 26.0, "sodium", "iron", { tx: 26 }], [4.6, -11.6, "sodium", "concrete", { moths: true }], [-3.4, -21.5, "tube", "concrete"],
      [12.4, -19.4, "bulb", "bamboo", { tx: 24 }], [-12.6, -29.6, "tube", "iron", { tx: -24, flicker: true }], [-35.2, -26.0, "sodium", "iron", { tx: -24 }],
      [-12.6, -12.0, "bulb", "bamboo", { tx: -20 }], [13.2, -2.4, "tube", "concrete", { tx: 20 }],
    ].forEach(([x, z, type, pole, o]) => streetLamp(x, z, type, pole, o));

    // hurricane lanterns hung at house corners and doorways
    function hurricane(x, y, z) {
      const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
      mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.25), ironM, 0, 0.25, 0, g);
      mesh(new THREE.TorusGeometry(0.06, 0.006, 4, 12), ironM, 0, 0.13, 0, g);
      mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.04, 12), paintM(0xb3121f, { metalness: 0.4 }), 0, 0.1, 0, g);
      mesh(new THREE.SphereGeometry(0.075, 12, 10), new THREE.MeshStandardMaterial({ color: 0xfff0d0, transparent: true, opacity: 0.35, roughness: 0.05 }), 0, -0.02, 0, g).scale.y = 1.25;
      mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.05, 12), paintM(0xb3121f, { metalness: 0.4 }), 0, -0.13, 0, g);
      lamps.add(x, y - 0.1, z, { bowl: false, flame: 0.07, decal: false });
      lamps.spot(x, y - 0.3, z, 2.6, 0xffb060, { range: 6 });
      const ph = rand(0, 6);
      updaters.push((dt, t) => (g.rotation.z = Math.sin(t * 1.2 + ph) * 0.05));
    }
    [[-5.35, 2.4, 42.6], [6.35, 2.4, 39.4], [-6.35, 2.3, 10.2], [6.6, 2.3, 30.4], [-15.35, 2.4, 4.2], [14.35, 2.4, -3.3], [-10.6, 1.9, 20.1], [18.0, 2.3, 15.0]].forEach(([x, y, z]) => hurricane(x, y, z));

    // diyas lined along the edges of the lane, as families do on Diwali night
    for (const [x, z0, z1] of [[-2.4, 56, 44], [2.4, 56.5, 47.6], [-2.4, 41, 35.6], [2.4, 44.6, 26], [-2.3, 28, 17], [2.3, 22, 9], [-2.2, 12, 4]]) {
      const n = Math.round(Math.abs(z1 - z0) / 0.55);
      lamps.row([x, 0.01, z0], [x, 0.01, z1], n, { spotPower: 2.2 });
    }
    // and along the temple approach and the pond path
    lamps.row([2.6, 0.01, -14], [2.6, 0.01, -26.5], 22, { spotPower: 2.5 });
    lamps.row([-2.6, 0.01, -14], [-2.6, 0.01, -26.5], 22, { spotPower: 2.5 });
    lamps.row([8, 0.01, -20.4], [14, 0.01, -20.4], 11, { spotPower: 2 });
  }

  /* ===================================================================== */
  /* farmland round the village                                            */
  /* ===================================================================== */
  {
    const crop = (base, row, sow) => {
      const c = document.createElement("canvas"); c.width = c.height = 256;
      const x = c.getContext("2d");
      x.fillStyle = base; x.fillRect(0, 0, 256, 256);
      // soft-edged furrows: hard stripes shimmer into bright bands when seen from far away
      x.filter = "blur(2.5px)";
      for (let i = 0; i < 256; i += sow) { x.fillStyle = row; x.fillRect(0, i, 256, sow * 0.55); }
      x.filter = "none";
      for (let i = 0; i < 2500; i++) { x.fillStyle = Math.random() < 0.5 ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.06)"; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      return t;
    };
    const kinds = [
      crop("#232e18", "#2e4220", 10), // young wheat
      crop("#3e3a18", "#5a5220", 12), // mustard in flower, muted by the night
      crop("#33261a", "#3c2e20", 14), // ploughed, fallow
      crop("#1e2c18", "#2a4020", 8),  // sugarcane rows
    // drawn a little above the ground and pulled forward in depth, so the two never flicker against each other
    ].map((map) => new THREE.MeshStandardMaterial({ map, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    const bund = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 1 });
    const rnd = T.rng(77);
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + rnd() * 0.1, r = 52 + rnd() * 48;
      const w = 18 + rnd() * 16, d = 14 + rnd() * 14;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.hypot(x - 40, z + 40) < 22) continue; // the fireworks field stays open
      const plot = mesh(new THREE.PlaneGeometry(w, d), kinds[(i * 7) % 4], x, 0.03, z);
      plot.rotation.set(-Math.PI / 2, 0, a + rnd() * 0.4);
      plot.material.map.repeat.set(w / 12, d / 12);
      const edge = mesh(new THREE.BoxGeometry(w + 0.6, 0.25, 0.6), bund, x, 0.12, z);
      edge.rotation.y = -(a + 0.2);
    }
    for (let i = 0; i < 9; i++) { const a = i * 0.7 + 0.3, r = 58 + (i % 3) * 14; tree(Math.cos(a) * r, Math.sin(a) * r, { h: 7 + (i % 3) * 2, r: 3 + (i % 2), clusters: 16 }); }
  }

  /* ===================================================================== */
  /* पटाखा मैदान: the cracker ground where the village lights its crackers  */
  /* ===================================================================== */
  {
    const MX = 15, MZ = 3;
    const earth = mesh(new THREE.CircleGeometry(4.6, 40), new THREE.MeshStandardMaterial({ map: T.plaster(0), color: 0x8a6a4a, roughness: 1 }), MX, 0.006, MZ);
    earth.rotation.x = -Math.PI / 2;
    // scorch marks and spent paper from crackers already lit tonight
    for (let i = 0; i < 9; i++) {
      const a = rand(0, 6.28), r = rand(0, 2.6);
      const mark = mesh(new THREE.CircleGeometry(rand(0.25, 0.6), 14), new THREE.MeshBasicMaterial({ color: 0x140c08, transparent: true, opacity: 0.5, depthWrite: false }), MX + Math.cos(a) * r, 0.009, MZ + Math.sin(a) * r);
      mark.rotation.x = -Math.PI / 2;
    }
    lamps.ring(MX, 0.01, MZ, 4.5, 20, { spotPower: 4 });
    // two buckets of water, as every family keeps by the crackers
    for (const [bx, bz] of [[MX - 3.4, MZ - 2.6], [MX + 3.2, MZ + 2.9]]) {
      mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.3, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0x2a5aa0, roughness: 0.5, side: THREE.DoubleSide }), bx, 0.15, bz);
      mesh(new THREE.CircleGeometry(0.16, 14), new THREE.MeshStandardMaterial({ color: 0x0a1420, roughness: 0.1, metalness: 0.4 }), bx, 0.27, bz).rotation.x = -Math.PI / 2;
    }
    lamps.spot(MX, 3, MZ, 5, 0xffc080, { range: 12 });
    stall(21.5, 3, -Math.PI / 2, "patakhe", "#1f4f9a");
    api.shops[api.shops.length - 1].en = "Cracker thela at the maidan";
    api.maidan = { center: new THREE.Vector3(MX, 0, MZ), view: new THREE.Vector3(9.3, 1.7, 7.4), aim: new THREE.Vector3(MX, 0.5, MZ - 0.4), shop: api.shops[api.shops.length - 1] };
  }
  /* ---------- the morning-after litter of a Diwali night, already starting ---------- */
  const debris = [];
  const litter = [[2.2, 53.6, 2.4, 70], [-2, 13, 2, 50], [3.5, -1, 2.5, 50], [-12.5, 21, 1.5, 30], [0.5, 36, 3, 50], [-20, -13.5, 2, 30], [1, 24, 2.5, 30], [5, -12, 3, 30]];
  for (const [cx, cz, r, n] of litter) for (let i = 0; i < n; i++) {
    const a = rand(0, 6.28), d = Math.sqrt(Math.random()) * r;
    debris.push([cx + Math.cos(a) * d, cz + Math.sin(a) * d, cz < -12 && cx < -15 ? 3.39 : 0.006]);
  }
  {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
    const paper = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.035, 0.06).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide }), debris.length);
    const reds = [0xb3121f, 0xd8203a, 0x7a0f1a, 0xe8c040, 0x1d6a3a, 0xc0c0c0];
    const col = new THREE.Color();
    debris.forEach(([x, z, y], i) => {
      q.setFromEuler(e.set(rand(-0.3, 0.3), rand(0, 6.28), rand(-0.3, 0.3)));
      m4.compose(p.set(x, y + 0.004, z), q, s.setScalar(rand(0.6, 1.6)));
      paper.setMatrixAt(i, m4);
      paper.setColorAt(i, col.setHex(reds[(Math.random() * reds.length) | 0]));
    });
    scene.add(paper);
    // marigold petals strewn at the doorsteps and the courtyard
    const petals = [];
    for (const [cx, cz, r, n] of [[-17.2, 22, 1.2, 80], [-14.6, 22.2, 2.2, 90], [-11, 22.5, 1.5, 50], [0, -27.2, 2, 90], [-2, -4, 4, 120], [15.6, -23, 1.5, 50]])
      for (let i = 0; i < n; i++) { const a = rand(0, 6.28), d = Math.sqrt(Math.random()) * r; petals.push([cx + Math.cos(a) * d, cz + Math.sin(a) * d]); }
    const pm = new THREE.InstancedMesh(new THREE.CircleGeometry(0.018, 6).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ roughness: 0.8 }), petals.length);
    petals.forEach(([x, z], i) => {
      const y = Math.hypot(x + 2, z + 4) < 3.5 ? 0.556 : x > 14 && x < 16.9 && z > -26 ? 0.46 : 0.008;
      m4.compose(p.set(x, y, z), q.identity(), s.set(rand(0.7, 1.3), 1, rand(0.5, 1)));
      pm.setMatrixAt(i, m4);
      pm.setColorAt(i, col.setHex(Math.random() < 0.7 ? 0xff8a10 : 0xffc020));
    });
    scene.add(pm);
  }

  /* ===================================================================== */
  /* instanced decorations                                                 */
  /* ===================================================================== */
  {
    const nB = bulbs.length / 8;
    const bulbGeo = new THREE.SphereGeometry(0.028, 6, 4);
    const aCol = new Float32Array(nB * 3), aPh = new Float32Array(nB), aMode = new Float32Array(nB);
    const bm = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uReveal: reveal },
      vertexShader: `
        attribute vec3 aCol; attribute float aPh; attribute float aMode;
        uniform float uTime; uniform vec4 uReveal; varying vec3 vC;
        void main() {
          vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          float rv = 1.0 - smoothstep(uReveal.z - uReveal.w, uReveal.z, length(ip.xz - uReveal.xy));
          float b;
          if (aMode < 0.5) b = 0.55 + 0.45 * sin(uTime * 2.6 + aPh * 17.0) * sin(uTime * 1.3 + aPh * 7.0);
          else if (aMode < 1.5) b = 0.12 + 1.1 * pow(0.5 + 0.5 * sin(aPh * 5.0 - uTime * 5.0), 6.0);
          else b = 0.15 + 0.95 * step(0.5, fract(uTime * 0.7 + floor(aPh / 0.2) * 0.5));
          vC = aCol * b * 2.8 * (0.08 + 0.92 * rv);
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `varying vec3 vC; void main() { gl_FragColor = vec4(vC, 1.0); }`,
    });
    const bm4 = new THREE.Matrix4();
    const bulbMesh = new THREE.InstancedMesh(bulbGeo, bm, nB);
    for (let i = 0; i < nB; i++) {
      const o = i * 8;
      bm4.makeTranslation(bulbs[o], bulbs[o + 1], bulbs[o + 2]);
      bulbMesh.setMatrixAt(i, bm4);
      aCol.set([bulbs[o + 3], bulbs[o + 4], bulbs[o + 5]], i * 3);
      aPh[i] = bulbs[o + 6];
      aMode[i] = bulbs[o + 7];
    }
    bulbGeo.setAttribute("aCol", new THREE.InstancedBufferAttribute(aCol, 3));
    bulbGeo.setAttribute("aPh", new THREE.InstancedBufferAttribute(aPh, 1));
    bulbGeo.setAttribute("aMode", new THREE.InstancedBufferAttribute(aMode, 1));
    bulbMesh.frustumCulled = false;
    scene.add(bulbMesh);
    updaters.push((dt, t) => (bm.uniforms.uTime.value = t));
    const wg = new THREE.BufferGeometry();
    wg.setAttribute("position", new THREE.Float32BufferAttribute(wires, 3));
    scene.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x0a0806 })));
  }
  {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const mari = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.035, 1), new THREE.MeshStandardMaterial({ roughness: 0.8 }), marigolds.length);
    const cA = new THREE.Color(0xff8a10), cB = new THREE.Color(0xffc020);
    marigolds.forEach(([x, y, z, k], i) => { m4.compose(p.set(x, y, z), q.identity(), s.setScalar(1)); mari.setMatrixAt(i, m4); mari.setColorAt(i, k ? cB : cA); });
    scene.add(mari);
    const ml = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.06, 0.16), new THREE.MeshStandardMaterial({ color: 0x2a5a1a, side: THREE.DoubleSide }), mangoLeaves.length);
    mangoLeaves.forEach(([x, y, z, r], i) => { q.setFromAxisAngle(UP, r); m4.compose(p.set(x, y, z), q, s.setScalar(1)); ml.setMatrixAt(i, m4); });
    scene.add(ml);
    const leafMats = [0, 1].map((h) => new THREE.MeshStandardMaterial({ map: T.leaves(h), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9, color: 0x9ab08a }));
    for (const hue of [0, 1]) {
      const list = leafCards.filter((l) => l[4] === hue);
      const lm = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), leafMats[hue], list.length);
      const e = new THREE.Euler();
      list.forEach(([x, y, z, sc], i) => { q.setFromEuler(e.set(rand(-1, 1), rand(0, 6.28), rand(-1, 1))); m4.compose(p.set(x, y, z), q, s.setScalar(sc)); lm.setMatrixAt(i, m4); });
      scene.add(lm);
    }
  }

  /* ===================================================================== */
  /* people                                                                */
  /* ===================================================================== */
  function place(opts, x, z, rotY = 0, y = 0) {
    const p = makePerson(opts);
    p.group.position.set(x, y, z);
    p.group.rotation.y = rotY;
    scene.add(p.group);
    people.push(p);
    return p;
  }
  function walk(opts, pts, o) {
    const p = place(opts, pts[0][0], pts[0][1]);
    walkers.push(new Walker(p, pts, o));
    return p;
  }
  // neighbours standing about in twos and threes, chatting: one talks with their hands, the others listen
  // and nod, and every few seconds someone else picks up the thread
  api.chats = [];
  const chat = (cx, cz, kinds, r = 0.62) => {
    const group = kinds.map((kind, i) => {
      const a = (i / kinds.length) * Math.PI * 2 + rand(-0.3, 0.3);
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      return place({ kind, pose: "listen" }, x, z, Math.atan2(cx - x, cz - z) + rand(-0.15, 0.15));
    });
    const g = { people: group, talker: 0, t: rand(0, 3) };
    group[0].pose = "talk";
    api.chats.push(g);
    circle(cx, cz, r + 0.25);
  };
  chat(-3.0, 48.4, ["man", "elder"]); // beside the garlanded tractor
  chat(3.9, 37.2, ["woman", "woman", "girl"]);
  chat(-3.6, 30.2, ["man", "man", "woman"]);
  chat(4.6, -1.6, ["woman", "elder"]);
  chat(-22.2, -23.6, ["man", "woman"]);
  chat(2.6, -26.8, ["elder", "man", "woman"]);
  updaters.push((dt) => {
    for (const g of api.chats) {
      g.t -= dt;
      if (g.t > 0) continue;
      g.t = 2.8 + Math.random() * 3.5;
      g.people[g.talker].pose = "listen";
      g.talker = (g.talker + 1 + ((Math.random() * (g.people.length - 1)) | 0)) % g.people.length;
      g.people[g.talker].pose = "talk";
    }
  });

  const withThaliFlame = (p) => { p.lampId = lamps.add(0, 0, 0, { bowl: false, flame: 0.06, decal: false }); };
  const sparklerKid = (p) => sparks.sparkler(() => p.tip());

  // visiting each other's houses with thalis and sweet boxes
  withThaliFlame(walk({ kind: "woman", carry: "thali" }, [[1, 57], [0.5, 34], [-3, 24], [-10, 22.6], [-13, 23.4]], { loop: false, pause: 3 }));
  walk({ kind: "man", carry: "box" }, [[1.6, 60], [2, 30], [5, 14], [6, 0], [6.5, -18], [3, -22]], { loop: false, pause: 2 });
  walk({ kind: "woman", carry: "box" }, [[-1.5, 48], [-1, 14], [-6, 12]], { loop: false, pause: 4 });
  walk({ kind: "girl", carry: "box" }, [[3, 20], [11, 18], [17, 18.5]], { loop: false, pause: 3 });
  walk({ kind: "man" }, [[-2, 2], [-6, -6], [-5, -12], [5, -10], [5, 2]], { loop: true });
  withThaliFlame(walk({ kind: "woman", carry: "thali" }, [[6, -2], [5, -18], [1.2, -24]], { loop: false, pause: 5 }));
  walk({ kind: "elder", carry: "lathi" }, [[1, 38], [-1, 22]], { loop: false, speed: 0.6, pause: 4 });
  walk({ kind: "woman", carry: "basket" }, [[-1, 30], [-4, 12], [-5, -5]], { loop: false, speed: 0.9 });

  // children with phuljhadi in the lane, a few running
  const kidSpots = [[2.5, 37], [3.3, 36.3], [1.8, 36], [-2.4, 13.2], [-1.6, 12.4]];
  kidSpots.forEach(([x, z], i) => sparklerKid(place({ kind: i % 2 ? "girl" : "child", carry: "sparkler", pose: "stand" }, x, z, rand(0, 6.28))));
  sparklerKid(walk({ kind: "child", carry: "sparkler" }, [[0, 40], [3, 38], [1, 34], [-2, 36]], { loop: true, speed: 1.6 }));
  sparklerKid(walk({ kind: "girl", carry: "sparkler" }, [[4, 4], [3, -1], [6, -2], [6, 5]], { loop: true, speed: 1.4 }));
  // kids round an anar in the lane, lit again and again
  const anarKids = [[1.0, 54.2], [3.2, 55.0], [2.9, 52.4]];
  anarKids.forEach(([x, z], i) => place({ kind: i === 1 ? "girl" : "child", pose: i === 2 ? "wave" : "stand" }, x, z, Math.atan2(2.2 - x, 53.6 - z)));
  api.anarSpots = [[3.2, 44.4], [-1.8, 12.9], [3, -1]];
  // chakri kids near the haat
  place({ kind: "child", pose: "wave" }, 4.2, -0.4, -2.2);

  // aangan
  place({ kind: "woman", pose: "squat" }, -13.4, 21.8, -Math.PI / 2);
  place({ kind: "woman", pose: "namaste" }, -15, 19.9, Math.PI);
  place({ kind: "elder", pose: "sit" }, -14.2, 25.6, Math.PI, 0.46);
  sparklerKid(place({ kind: "girl", carry: "sparkler" }, -12.6, 25, -2.4));
  // potter and his wife
  place({ kind: "man", pose: "squat", color: "#e8e2d6" }, 13.4, 12.5, Math.PI / 2);
  place({ kind: "woman", pose: "squat" }, 11.5, 15.8, 0);
  // elders on the chabutra, people at the stalls
  [[-2 + 3.1, -4 + 0.6, 1.3], [-2 + 2.5, -4 - 1.9, 2.2], [-2 - 0.8, -4 + 3.0, 0], [-2 - 3.0, -4 - 0.4, -1.5]].forEach(([x, z, r]) => place({ kind: "elder", pose: "sit" }, x, z, r, 0.55 + 0.02));
  [[-7.9, -0.6, -Math.PI / 2], [-8.4, -5.2, -Math.PI / 2], [-7, -9.6, -2], [-2.8, -11.6, Math.PI], [2.6, -12, Math.PI], [7.9, 2.2, Math.PI / 2], [7.8, -3.4, Math.PI / 2]].forEach(([x, z, r], i) => place({ kind: i % 2 ? "woman" : "man", carry: i === 3 ? "box" : null }, x, z, r));
  // worshippers at the temple
  [[-1.4, -26.4], [-0.4, -26.6], [0.8, -26.4], [1.8, -26.8], [-2.4, -27]].forEach(([x, z], i) => place({ kind: i % 2 ? "man" : "woman", pose: "namaste" }, x, z, Math.PI));
  // the pond: a woman setting diyas afloat
  place({ kind: "woman", pose: "squat" }, 16.3, -21.5, Math.PI / 2, 0.21);
  place({ kind: "girl", pose: "stand" }, 15.6, -20.8, Math.PI / 2, 0.45);
  // family on the roof
  sparklerKid(place({ kind: "child", carry: "sparkler" }, -21, -12.6, 1.6, 3.38));
  sparklerKid(place({ kind: "girl", carry: "sparkler" }, -22.6, -15, 1.9, 3.38));
  place({ kind: "woman" }, -23.5, -13, 1.4, 3.38);

  // more children: chasing round the hand pump, crowding each cracker spot, sparklers on the rooftops
  api.kids = [];
  const kid = (o, x, z, r, y) => { const k = place(o, x, z, r, y); api.kids.push(k); return k; };
  for (let i = 0; i < 3; i++) {
    const pts = [];
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 + i * 2.1; pts.push([2.6 + Math.cos(a) * 2.4, 46 + Math.sin(a) * 2.4]); }
    api.kids.push(walk({ kind: i % 2 ? "girl" : "child" }, pts, { loop: true, speed: 2.2 + i * 0.15 }));
  }
  const crowd = (cx, cz, n) => { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + rand(-0.2, 0.2), r = rand(1.6, 2.4); kid({ kind: i % 2 ? "girl" : "child", pose: i % 3 === 0 ? "wave" : "stand" }, cx + Math.cos(a) * r, cz + Math.sin(a) * r, Math.atan2(cx - (cx + Math.cos(a) * r), cz - (cz + Math.sin(a) * r))); } };
  crowd(-1.8, 12.9, 5);
  crowd(3, -1, 4);
  crowd(-12.4, 21, 3);
  crowd(2.2, 53.6, 2);
  for (const [x, z, r] of [[9.6, 52.8, -1.6], [8.6, 50.6, -1.3], [9.2, 54.4, -1.9]]) sparklerKid(kid({ kind: "child", carry: "sparkler" }, x, z, r, 3.08)); // on the flat roof
  for (const [x, z] of [[1.2, 18], [-1.4, 24], [1.6, 8]]) sparklerKid(kid({ kind: "girl", carry: "sparkler" }, x, z, rand(0, 6)));
  // children near a cracker jump and cheer when it goes off
  api.kidsCheer = (x, z, r = 7) => { for (const k of api.kids) if (Math.hypot(k.group.position.x - x, k.group.position.z - z) < r) k.cheer = 1.6 + Math.random(); };

  // families up on the flat roofs, there to watch the fireworks
  api.roofPeople = [];
  const roofCrowd = (cx, cz, wx, wz, y, n, avoid) => {
    const cols = Math.max(2, Math.round(Math.sqrt(n * wx / wz))), rows = Math.ceil(n / cols);
    for (let i = 0; i < n; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      const x = cx - wx / 2 + 0.8 + ((c + 0.5) / cols) * (wx - 1.6) + rand(-0.2, 0.2);
      const z = cz - wz / 2 + 0.8 + ((r + 0.5) / rows) * (wz - 1.6) + rand(-0.2, 0.2);
      if (avoid && avoid(x, z)) continue;
      const kind = ["elder", "woman", "child", "man", "girl", "woman", "child"][(i + Math.round(cx)) % 7];
      const sitting = kind === "elder" || (kind === "woman" && i % 2 === 0);
      const p = place({ kind, pose: sitting ? "sit" : "stand", carry: kind === "child" && i % 3 === 0 ? "sparkler" : null }, x, z, rand(0, 6.28), y);
      if (p.carry === "sparkler") sparklerKid(p);
      api.roofPeople.push(p);
    }
  };
  roofCrowd(9, 42, 5, 6, 3.08, 5);
  roofCrowd(-9, 7.5, 5, 6, 3.08, 5);
  // the family the fireworks show is watched with: on a durrie at the edge of the roof nearest the field,
  // facing the launch ground, a thali of sweets between them and a child with a phuljhadi behind
  {
    const RY = 3.08, dir = new THREE.Vector3(40 - 17, 0, -40 + 6).normalize(), side = new THREE.Vector3(-dir.z, 0, dir.x);
    const c = new THREE.Vector3(17, RY, -6).addScaledVector(dir, 1.0);
    const face = Math.atan2(dir.x, dir.z);
    const rug = mesh(new THREE.PlaneGeometry(3.4, 1.4), new THREE.MeshStandardMaterial({ map: T.cloth("#7a1a2a", "#e8b030"), roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 }), c.x, RY + 0.012, c.z);
    rug.rotation.set(-Math.PI / 2, 0, face);
    const fam = [["elder", "sit"], ["woman", "sit"], ["girl", "sit"], ["man", "sit"]].map(([kind, pose], i) => {
      const at = c.clone().addScaledVector(side, -1.2 + i * 0.8);
      return place({ kind, pose }, at.x, at.z, face + (i - 1.5) * 0.08, RY);
    });
    const kid = place({ kind: "child", pose: "stand", carry: "sparkler" }, c.x - dir.x * 0.3 + side.x * 1.9, c.z - dir.z * 0.3 + side.z * 1.9, face - 0.3, RY); // at the end of the row, out of the camera's way
    sparklerKid(kid);
    const th = c.clone().addScaledVector(dir, 0.45);
    mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.015, 24), M.brass, th.x, RY + 0.02, th.z);
    for (let i = 0; i < 6; i++) mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xf2b705 : 0xeee2c8, roughness: 0.7 }), th.x + Math.cos(i) * 0.08, RY + 0.06, th.z + Math.sin(i) * 0.08);
    api.roofPeople.push(...fam, kid);
    api.showFamily = { center: c, dir, side, people: fam };
  }
  roofCrowd(24, 34, 5, 6, 3.08, 4);
  roofCrowd(4, 64, 6, 5, 3.08, 4);
  roofCrowd(8.5, 52, 5, 7, 3.08, 3, (x, z) => z > 50 && z < 55 && x > 8 && x < 10); // the sparkler kids already up there
  roofCrowd(-32, -2, 5, 6, 3.08, 4);
  roofCrowd(-23.5, -14, 4, 6, 3.38, 3);
  for (const [x, z] of [[-19.9, -20.6], [-27.3, -20.6], [-19.9, -31.4], [-27.3, -31.4]]) roofCrowd(x, z, 3.5, 3.2, 3.2, 2);
  // the earlier rooftop family joins in
  api.roofPeople.push(...api.kids.filter((k) => k.group.position.y > 3));

  // a ring of villagers round the cracker ground, children in front
  api.maidanCrowd = [];
  {
    const MX = 15, MZ = 3;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a - 2.6), Math.cos(a - 2.6))) < 0.45) continue; // leave a gap where you stand
      const child = i % 3 !== 0, r = child ? 4.9 : 5.7;
      const x = MX + Math.cos(a) * r, z = MZ + Math.sin(a) * r;
      const p = place({ kind: child ? (i % 2 ? "girl" : "child") : ["man", "woman", "elder"][i % 3], pose: i % 5 === 0 ? "wave" : "stand", carry: child && i % 4 === 1 ? "sparkler" : null }, x, z, Math.atan2(MX - x, MZ - z));
      if (p.carry === "sparkler") sparklerKid(p);
      api.maidanCrowd.push(p);
      api.kids.push(p);
    }
  }

  // the balloon-wala walking the lanes with a bunch of balloons bobbing over his head
  {
    const bw = walk({ kind: "man", color: "#e8892a" }, [[1.2, 50], [1.5, 20], [5.2, 8], [5.5, -6], [5.8, -16]], { loop: false, speed: 0.7, pause: 5 });
    const bunch = new THREE.Group();
    bunch.position.set(0.32, 0, 0.1);
    bw.group.add(bunch);
    const cols = [0xe53935, 0xfdd835, 0x43a047, 0x1e88e5, 0xfb8c00, 0x8e24aa, 0xf06292, 0x00acc1];
    const stringM = new THREE.LineBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.5 });
    const balloons = [];
    for (let i = 0; i < 14; i++) {
      const bx = rand(-0.35, 0.35), by = rand(2.3, 2.9), bz = rand(-0.35, 0.35);
      const b = mesh(new THREE.SphereGeometry(0.13, 12, 10), new THREE.MeshStandardMaterial({ color: cols[i % cols.length], roughness: 0.25, emissive: cols[i % cols.length], emissiveIntensity: 0.12 }), bx, by, bz, bunch);
      b.scale.y = 1.2;
      const sg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1.25, 0), new THREE.Vector3(bx, by - 0.15, bz)]);
      bunch.add(new THREE.Line(sg, stringM));
      balloons.push({ b, bx, by, bz, ph: rand(0, 6) });
    }
    mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.3), M.bark, 0, 0.75, 0, bunch);
    updaters.push((dt, t) => { for (const q of balloons) { q.b.position.set(q.bx + Math.sin(t * 1.1 + q.ph) * 0.05, q.by + Math.sin(t * 1.7 + q.ph) * 0.04, q.bz + Math.cos(t * 0.9 + q.ph) * 0.05); } });
  }
  // children playing chase round the banyan
  for (let i = 0; i < 4; i++) {
    const R = 6.2, pts = [];
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2 + i * 0.5; pts.push([-2 + Math.cos(a) * R, -4 + Math.sin(a) * R]); }
    walk({ kind: i % 2 ? "girl" : "child" }, pts, { loop: true, speed: 2.4 + i * 0.1 });
  }

  // dhol-wala and a ring of dancers at the fair
  place({ kind: "man", carry: "dhol", pose: "drum", color: "#e8892a" }, 25.6, 18.4, -2.2);
  for (let i = 0; i < 6; i++) {
    const pts = [];
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 + i * (Math.PI / 3); pts.push([24 + Math.cos(a) * 1.5, 19.2 + Math.sin(a) * 1.5]); }
    walk({ kind: i % 2 ? "woman" : "man" }, pts, { loop: true, speed: 0.55, pose: "dance" });
  }
  // a few people watching the wheel
  [[26.4, 21.4, 1.5], [26.8, 25.6, 1.8], [25.8, 23.6, 1.6]].forEach(([x, z, r], i) => place({ kind: ["woman", "man", "child"][i] }, x, z, r));

  // shoppers crowd the market street; a cow ambles through as cows do
  for (let i = 0; i < 10; i++) {
    const zz = -24.2 - (i % 4) * 1.1, x0 = -15 - (i % 3) * 1.5;
    const opts = [{ kind: "woman", carry: "box" }, { kind: "man" }, { kind: "woman" }, { kind: "child" }, { kind: "man", carry: "box" }, { kind: "girl" }, { kind: "woman", carry: "basket" }, { kind: "elder", carry: "lathi" }, { kind: "man" }, { kind: "woman", carry: "box" }][i];
    walk(opts, [[x0, zz], [-33, zz + rand(-0.4, 0.4)]], { loop: false, speed: rand(0.6, 1.0), pause: 4 });
  }
  [[-16.4, -23.4, Math.PI], [-20.1, -23.3, Math.PI], [-23.4, -23.5, Math.PI], [-27.5, -23.4, Math.PI], [-16.0, -28.6, 0], [-19.7, -28.5, 0], [-23.9, -28.7, 0], [-31.2, -28.6, 0]].forEach(([x, z, r], i) => place({ kind: ["woman", "man", "girl", "woman", "man", "child", "woman", "man"][i], carry: i % 3 === 0 ? "box" : null }, x, z, r));
  {
    const c = cow(-30, -26, Math.PI / 2, { color: 0xe8e0d0, horn: 0x2a9a3a, cloth: "#c8102a" });
    walkers.push(new Walker({ group: c.g, kind: "cow", pose: "walk", speed: 0 }, [[-33, -26.2], [-15.5, -25.8]], { loop: false, speed: 0.25, pause: 8 }));
  }

  // a line of women carrying lit thalis to the temple
  for (let i = 0; i < 5; i++) {
    const p = walk({ kind: "woman", carry: "thali" }, [[1.4, 27], [4.6, 9], [5.2, -12], [1.6, -23.5], [0.9, -26.2]], { loop: false, speed: 0.75, pause: 10 });
    withThaliFlame(p);
    const w = walkers[walkers.length - 1];
    w.seg = 0; w.u = 0.02 + i * 0.09; // spaced in single file
  }

  // the well: women setting lamps on the rim
  place({ kind: "woman", pose: "squat" }, -10.4, 57.6, -1.9);
  place({ kind: "woman", carry: "basket" }, -9.8, 55.6, -1.2);
  // the cowshed: the farmer and his wife doing gau puja
  place({ kind: "man", pose: "namaste" }, 16.4, 44.1, Math.PI / 2 + 0.4);
  withThaliFlame(place({ kind: "woman", carry: "thali" }, 16.6, 49.9, Math.PI / 2 - 0.4));
  // the rasoi: frying puris and rolling them
  place({ kind: "woman", pose: "stir" }, -15.7, 32.2, -Math.PI / 2);
  place({ kind: "woman", pose: "squat" }, -15.15, 31.4, -Math.PI / 2 - 0.4);
  place({ kind: "girl", carry: "box" }, -13.6, 34.4, -2.2);
  // the card game: four players, two kids watching
  const TX = 11.8, TZ = -12;
  [[0, 1.05], [Math.PI / 2, 1.05], [Math.PI, 1.05], [-Math.PI / 2, 1.05]].forEach(([a, r], i) => {
    const x = TX + Math.sin(a) * r, z = TZ + Math.cos(a) * r;
    place({ kind: i === 2 ? "elder" : "man", pose: "sit" }, x, z, a + Math.PI, 0.02);
  });
  place({ kind: "child", pose: "stand" }, TX - 1.7, TZ + 1.2, 2.3);
  place({ kind: "girl", pose: "stand" }, TX + 1.6, TZ + 1.5, -2.4);

  // collider list for people is ignored: they walk authored lanes

  /* ===================================================================== */
  /* the five days of Diwali: what is different on each day                */
  /* ===================================================================== */
  // Each day owns a few scenes; they are built once and shown only on their day, with their own lamps.
  {
    const days = { dhanteras: { objs: [], lamps: [], spots: [] }, choti: { objs: [], lamps: [], spots: [] }, govardhan: { objs: [], lamps: [], spots: [] }, bhaidooj: { objs: [], lamps: [], spots: [] } };
    const add = (day, o) => { days[day].objs.push(o); o.visible = false; return o; };
    const grp = (day, x, z, ry = 0) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g); g.updateMatrixWorld(); return add(day, g); };
    const who = (day, opts, x, z, ry, y = 0) => { const p = place(opts, x, z, ry, y); add(day, p.group); return p; };
    const lamp = (day, x, y, z, o = {}) => days[day].lamps.push(lamps.add(x, y, z, { lit: false, ...o }));
    const glow = (day, x, y, z, pw = 4) => days[day].spots.push(lamps.spot(x, y, z, pw, 0xffa050, { on: 0 }));
    const steel = new THREE.MeshStandardMaterial({ color: 0xd8dce0, metalness: 0.95, roughness: 0.15 });
    const red = new THREE.MeshStandardMaterial({ map: T.cloth("#a3122a", "#d9a53a"), roughness: 0.9 });

    // धनतेरस · Dhanteras: the new steel and brass bought today laid out on a red cloth, and the Yam deepak
    {
      const g = grp("dhanteras", -14.2, 20.2, 0.6);
      mesh(new THREE.PlaneGeometry(1.4, 0.9), red, 0, 0.012, 0, g).rotation.x = -Math.PI / 2;
      mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.015, 28), steel, -0.35, 0.03, 0, g);
      mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.012, 24), M.brass, 0.1, 0.03, -0.15, g);
      const lota = new THREE.LatheGeometry([[0, 0], [0.07, 0.01], [0.1, 0.07], [0.09, 0.13], [0.05, 0.17], [0.06, 0.2]].map(([a, b]) => new THREE.Vector2(a, b)), 18);
      mesh(lota, steel, 0.42, 0.012, 0.12, g); mesh(lota, M.brass, 0.1, 0.012, 0.22, g).scale.setScalar(1.3);
      for (let i = 0; i < 6; i++) mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.006, 16), new THREE.MeshStandardMaterial({ color: 0xe8e8ee, metalness: 1, roughness: 0.2 }), -0.35 + i * 0.012, 0.045 + i * 0.006, 0.0, g); // silver coins
      const kd = mesh(new THREE.SphereGeometry(0.2, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.iron, -0.1, 0.2, 0.3, g); kd.material = M.iron.clone(); kd.material.side = THREE.DoubleSide;
      // the Yam deepak: a big four-wicked diya outside the gate, facing south, for long life
      const y = grp("dhanteras", -17.55, 21.0); // at the main door
      mesh(new THREE.SphereGeometry(0.16, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.clay, 0, 0.16, 0, y).scale.y = 0.6;
      for (const [ox, oz] of [[0.11, 0], [-0.11, 0], [0, 0.11], [0, -0.11]]) lamp("dhanteras", -17.55 + ox, 0.14, 21.0 + oz, { bowl: false, flame: 0.1, decal: false });
      glow("dhanteras", -17.55, 0.4, 21.0, 5);
      // the family coming home from the market with their purchases
      who("dhanteras", { kind: "man", carry: "box" }, -13.0, 20.9, -1.86);
      who("dhanteras", { kind: "woman", pose: "namaste" }, -15.3, 20.0, 1.1);
      // a queue at the bartan shop
      for (let i = 0; i < 4; i++) who("dhanteras", { kind: i % 2 ? "woman" : "man", carry: i === 2 ? "box" : null }, -20.6 + i * 0.55, -23.4 - (i % 2) * 0.35, Math.PI + (i - 1.5) * 0.25);
    }

    // छोटी दिवाली · Choti Diwali (Roop Chaudas): the ubtan bath at dawn, a new rangoli being drawn, fourteen diyas
    {
      const g = grp("choti", -13.7, 19.9);
      const rg = mesh(new THREE.CircleGeometry(0.62, 48), new THREE.MeshStandardMaterial({ map: T.rangoliTexture({ style: "padma", palette: "gulab", petals: 12, rings: 3 }), transparent: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }), 0, 0.013, 0, g);
      rg.rotation.x = -Math.PI / 2;
      const cols = [0xe0402a, 0xf2b705, 0x1aa3a3, 0xd6247a, 0xf3eadb];
      cols.forEach((c, i) => { mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.05, 14), steelMat, 0.85, 0.025, -0.45 + i * 0.18, g); mesh(new THREE.ConeGeometry(0.06, 0.06, 14), paintM(c, { roughness: 1 }), 0.85, 0.07, -0.45 + i * 0.18, g); });
      who("choti", { kind: "woman", pose: "squat" }, -13.0, 19.7, -Math.PI / 2 - 0.3);
      who("choti", { kind: "girl", pose: "sit" }, -13.2, 20.7, -Math.PI / 2 - 0.9);
      // ubtan of besan and haldi in a brass bowl, a lota of water on a patla
      const u = grp("choti", -15.8, 19.7);
      addBox(0.5, 0.08, 0.32, M.wood, 0, 0, 0, u);
      mesh(new THREE.SphereGeometry(0.09, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.brass, -0.1, 0.17, 0, u);
      mesh(new THREE.CircleGeometry(0.08, 14), paintM(0xf2b030, { roughness: 1 }), -0.1, 0.165, 0, u).rotation.x = -Math.PI / 2;
      // fourteen diyas along the courtyard wall, one for each of the fourteen worlds
      for (let i = 0; i < 14; i++) lamp("choti", -17.6 + i * 0.47, 1.36, 17.0, { decal: false });
      glow("choti", -14.5, 1.6, 17.4, 4);
    }

    // गोवर्धन पूजा · Govardhan: the women circle the Govardhan with thalis; the annakoot, a mountain of food
    {
      const GX = 15.1, GZ = 46.6, R = 1.9, ring = [];
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; ring.push([GX + Math.cos(a) * R, GZ + Math.sin(a) * R]); }
      for (let k = 0; k < 3; k++) {
        const pts = ring.slice(k * 4).concat(ring.slice(0, k * 4));
        const p = walk({ kind: k === 2 ? "girl" : "woman", carry: "thali" }, pts, { speed: 0.45 });
        add("govardhan", p.group);
      }
      const a = grp("govardhan", 17.2, 44.4, -0.6);
      addBox(1.3, 0.3, 0.8, M.wood, 0, 0, 0, a);
      mesh(new THREE.SphereGeometry(0.3, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), paintM(0xf6f0e2, { roughness: 1 }), 0, 0.3, 0, a).scale.y = 0.9; // the rice mountain
      const bhog = [0xf0a020, 0xc8501a, 0x5a8a2a, 0xe8dcc0, 0x8a3a1a, 0xf2b705, 0xd6247a, 0xa86a2a];
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2, rr = i % 2 ? 0.48 : 0.38;
        const bx = Math.cos(ang) * rr * 1.2, bz = Math.sin(ang) * rr * 0.75;
        if (Math.abs(bx) > 0.6 || Math.abs(bz) > 0.36) continue;
        mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.04, 14), M.clay, bx, 0.32, bz, a);
        mesh(new THREE.SphereGeometry(0.05, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), paintM(bhog[i % bhog.length], { roughness: 0.8 }), bx, 0.34, bz, a).scale.y = 0.6;
      }
      for (const [ox, oz] of [[-0.55, -0.3], [0.55, -0.3]]) lamp("govardhan", 17.2 + ox, 0.32, 44.4 + oz, { decal: false, scale: 1.4 });
      who("govardhan", { kind: "elder", pose: "namaste" }, 18.4, 44.0, -1.9);
    }

    // भाई दूज · Bhai Dooj: the sister does her brother's tilak and aarti; he gives her a gift
    {
      const bro = who("bhaidooj", { kind: "man", pose: "sit" }, -14.8, 19.9, 0.69, 0.18);
      const pat = grp("bhaidooj", -14.8, 19.9, 0.69);
      addBox(0.55, 0.18, 0.4, M.wood, 0, 0, 0, pat); // the patla he sits on
      const sis = who("bhaidooj", { kind: "woman", pose: "aarti", carry: "thali" }, -14.1, 19.4, -0.95);
      sis.lampId = lamps.add(0, 0, 0, { bowl: false, flame: 0.06, decal: false });
      days.bhaidooj.lamps.push(sis.lampId);
      who("bhaidooj", { kind: "girl", pose: "wave" }, -13.6, 20.3, -1.89);
      who("bhaidooj", { kind: "elder", pose: "namaste" }, -15.6, 20.6, 2.29);
      const gift = grp("bhaidooj", -14.45, 20.25, 0.69);
      addBox(0.22, 0.08, 0.16, paintM(0xc8306a), 0, 0, 0, gift);
      addBox(0.04, 0.085, 0.165, paintM(0xd9a53a, { metalness: 0.6 }), 0, 0, 0, gift);
      bro.lookUp = false;
      api.family.bhai = bro; api.family.behen = sis;
    }

    // the morning after: children combing the lane for crackers that didn't go off, a chai cart steaming
    {
      const morning = [];
      const mk = (o) => { o.visible = false; morning.push(o); return o; };
      for (const [x, z, r] of [[-1.3, 52.5, 0.6], [1.6, 47.2, -2.2], [-0.7, 41.4, 2.8], [1.1, 36.0, -0.9]]) mk(place({ kind: x > 0 ? "girl" : "child", pose: "squat" }, x, z, r).group);
      const cart = new THREE.Group(); cart.position.set(3.0, 0, 56.4); cart.rotation.y = -Math.PI / 2; scene.add(cart); mk(cart);
      addBox(1.4, 0.08, 0.8, M.wood, 0, 0.82, 0, cart);
      for (const sd of [-1, 1]) mesh(new THREE.TorusGeometry(0.28, 0.04, 6, 16), M.iron, sd * 0.55, 0.3, 0.42, cart);
      mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.28, 16), M.iron, -0.3, 1.04, 0, cart); // the kettle on its stove
      for (let i = 0; i < 6; i++) mesh(new THREE.CylinderGeometry(0.035, 0.028, 0.08, 10), M.clay, 0.15 + (i % 3) * 0.12, 0.94, -0.12 + Math.floor(i / 3) * 0.14, cart); // kulhads
      mk(place({ kind: "man", color: "#ece6da", pose: "stir" }, 3.0, 57.3, Math.PI).group);
      mk(place({ kind: "man", pose: "talk" }, 1.6, 55.6, -1.2).group);
      mk(place({ kind: "elder", pose: "listen" }, 1.7, 57.2, -2.0).group);
      let steamT = 0, on = false;
      updaters.push((dt) => {
        if (!on) return;
        steamT -= dt;
        if (steamT <= 0) { steamT = 0.25; sparks.puff(3.0 + (Math.random() - 0.5) * 0.1, 1.2, 56.1, 0.1, 3, [0.85, 0.85, 0.85], 0.22, 0.02, 0.3, 0, 0.15); }
      });
      api.setMorning = (yes) => { on = yes; morning.forEach((o) => (o.visible = yes)); };
    }

    api.days = days;
    api.setDay = (day) => {
      for (const [d, set] of Object.entries(days)) {
        const on = d === day;
        set.objs.forEach((o) => (o.visible = on));
        set.lamps.forEach((i) => lamps.setPower(i, on ? 1 : 0));
        set.spots.forEach((i) => (lamps.spots[i].on = on ? 1 : 0));
      }
    };
  }

  api.update = (dt, t, camera) => {
    for (const u of updaters) u(dt, t, camera);
    for (const w of walkers) w.update(dt);
    for (const p of people) {
      // skip animating people far from the camera
      const d2 = p.group.position.distanceToSquared(camera.position);
      p.face.visible = d2 < 18 * 18; // faces and jewellery only where they can be seen
      if (p.lookUp || d2 < 1600) p.update(dt, t); // rooftop watchers stay alive for the aerial show
      if (p.lampId !== null) { const tp = p.tip(); if (tp) lamps.move(p.lampId, tp.x, tp.y, tp.z); }
    }
  };
  api.colliders = colliders;
  api.people = people;
  return api;
}
