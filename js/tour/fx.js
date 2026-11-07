// Sparks for phuljhadi, anar, chakri and sky shells: hot heads with motion-blur streaks,
// plus lingering cracker smoke lit in the colour of its burst.
import * as THREE from "three";

const headVert = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  varying vec3 vColor;
  uniform float uScale;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(abs(aSize) * uScale / max(0.5, -mv.z), 1.0, 9.0);
    vColor = aColor;
    gl_Position = projectionMatrix * mv;
  }
`;
const headFrag = /* glsl */ `
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float k = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor * k * k, 1.0);
  }
`;

const smokeVert = /* glsl */ `
  attribute float aSize;
  attribute vec4 aTint;
  attribute float aRot;
  varying vec4 vTint;
  varying float vRot;
  varying float vLit;
  uniform float uScale;
  uniform vec3 uGlowPos;
  uniform float uGlowI;
  void main() {
    // smoke near a fresh burst catches its light
    vLit = uGlowI * exp(-distance(position, uGlowPos) / 16.0);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = min(aSize * uScale / max(0.5, -mv.z), 512.0);
    vTint = aTint;
    vRot = aRot;
    gl_Position = projectionMatrix * mv;
  }
`;
const smokeFrag = /* glsl */ `
  uniform sampler2D uTex;
  uniform vec3 uGlowCol;
  varying vec4 vTint;
  varying float vRot;
  varying float vLit;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float s = sin(vRot), co = cos(vRot);
    c = mat2(co, -s, s, co) * c;
    float a = texture2D(uTex, c + 0.5).a * vTint.a * smoothstep(0.5, 0.2, length(gl_PointCoord - 0.5));
    if (a < 0.003) discard;
    gl_FragColor = vec4(vTint.rgb * 0.45 + uGlowCol * vLit * 0.9, min(1.0, a * (1.0 + vLit * 1.5)));
  }
`;

function smokeTexture() {
  const S = 128, c = document.createElement("canvas");
  c.width = c.height = S;
  const x = c.getContext("2d");
  for (let i = 0; i < 26; i++) {
    const px = S / 2 + (Math.random() - 0.5) * S * 0.45, py = S / 2 + (Math.random() - 0.5) * S * 0.45, r = S * (0.12 + Math.random() * 0.22);
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, "rgba(255,255,255,0.22)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, S, S);
  }
  return new THREE.CanvasTexture(c);
}

const PALETTE = [
  [1, 0.62, 0.22], [1, 0.25, 0.32], [0.35, 1, 0.45], [0.35, 0.7, 1], [0.75, 0.4, 1], [1, 0.95, 0.85], [1, 0.42, 0.1],
];
const rand = (a, b) => a + Math.random() * (b - a);

export class Sparks {
  constructor(scene, max = 9000) {
    this.max = max;
    this.n = 0;
    const F = (k) => new Float32Array(max * k);
    this.p = F(3); this.v = F(3); this.c = F(3);
    this.life = F(1); this.maxLife = F(1); this.size = F(1); this.drag = F(1); this.grav = F(1); this.trail = F(1); this.heat = F(1);

    // hot heads
    this.hp = F(3); this.hc = F(3);
    const hg = new THREE.BufferGeometry();
    this.aHP = new THREE.BufferAttribute(this.hp, 3).setUsage(THREE.DynamicDrawUsage);
    this.aHC = new THREE.BufferAttribute(this.hc, 3).setUsage(THREE.DynamicDrawUsage);
    this.aHS = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    hg.setAttribute("position", this.aHP);
    hg.setAttribute("aColor", this.aHC);
    hg.setAttribute("aSize", this.aHS);
    this.uniforms = { uScale: { value: 300 } };
    this.heads = new THREE.Points(hg, new THREE.ShaderMaterial({ vertexShader: headVert, fragmentShader: headFrag, uniforms: this.uniforms, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.heads.frustumCulled = false;
    this.heads.renderOrder = 12;

    // motion streaks: one segment per spark, bright at the head, fading to the tail
    this.lp = F(6); this.lc = F(6);
    const lg = new THREE.BufferGeometry();
    this.aLP = new THREE.BufferAttribute(this.lp, 3).setUsage(THREE.DynamicDrawUsage);
    this.aLC = new THREE.BufferAttribute(this.lc, 3).setUsage(THREE.DynamicDrawUsage);
    lg.setAttribute("position", this.aLP);
    lg.setAttribute("color", this.aLC);
    this.lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 12;
    scene.add(this.lines, this.heads);

    // smoke puffs
    this.smax = 700;
    this.sn = 0;
    this.sp = new Float32Array(this.smax * 3);
    this.sv = new Float32Array(this.smax * 3);
    this.sSize = new Float32Array(this.smax);
    this.sGrow = new Float32Array(this.smax);
    this.sTint = new Float32Array(this.smax * 4);
    this.sBase = new Float32Array(this.smax * 4);
    this.sLife = new Float32Array(this.smax);
    this.sMax = new Float32Array(this.smax);
    this.sRot = new Float32Array(this.smax);
    this.sSpin = new Float32Array(this.smax);
    const sg = new THREE.BufferGeometry();
    this.aSP = new THREE.BufferAttribute(this.sp, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSS = new THREE.BufferAttribute(this.sSize, 1).setUsage(THREE.DynamicDrawUsage);
    this.aST = new THREE.BufferAttribute(this.sTint, 4).setUsage(THREE.DynamicDrawUsage);
    this.aSR = new THREE.BufferAttribute(this.sRot, 1).setUsage(THREE.DynamicDrawUsage);
    sg.setAttribute("position", this.aSP);
    sg.setAttribute("aSize", this.aSS);
    sg.setAttribute("aTint", this.aST);
    sg.setAttribute("aRot", this.aSR);
    this.smoke = new THREE.Points(sg, new THREE.ShaderMaterial({ vertexShader: smokeVert, fragmentShader: smokeFrag, uniforms: (this.smokeU = { uScale: this.uniforms.uScale, uTex: { value: smokeTexture() }, uGlowPos: { value: new THREE.Vector3(0, -999, 0) }, uGlowCol: { value: new THREE.Vector3(1, 0.7, 0.4) }, uGlowI: { value: 0 } }), depthWrite: false, transparent: true }));
    this.smoke.frustumCulled = false;
    this.smoke.renderOrder = 8;
    scene.add(this.smoke);

    this.rockets = [];
    this.emitters = [];
    this.onBurst = null;
  }

  spawn(x, y, z, vx, vy, vz, col, life, size = 1, drag = 0.98, grav = 1, trail = 0.04, heat = 1) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.c[i * 3] = col[0]; this.c[i * 3 + 1] = col[1]; this.c[i * 3 + 2] = col[2];
    this.life[i] = 0; this.maxLife[i] = life; this.size[i] = size; this.drag[i] = drag; this.grav[i] = grav; this.trail[i] = trail; this.heat[i] = heat;
  }

  kill(i) {
    const j = --this.n;
    if (i === j) return;
    for (const a of [this.p, this.v, this.c]) { a[i * 3] = a[j * 3]; a[i * 3 + 1] = a[j * 3 + 1]; a[i * 3 + 2] = a[j * 3 + 2]; }
    for (const a of [this.life, this.maxLife, this.size, this.drag, this.grav, this.trail, this.heat]) a[i] = a[j];
  }

  puff(x, y, z, size, life, rgb, alpha, vx = 0, vy = 0.15, vz = 0, grow = 0.4) {
    if (this.sn >= this.smax) return;
    const i = this.sn++;
    this.sp[i * 3] = x; this.sp[i * 3 + 1] = y; this.sp[i * 3 + 2] = z;
    this.sv[i * 3] = vx; this.sv[i * 3 + 1] = vy; this.sv[i * 3 + 2] = vz;
    this.sSize[i] = size;
    this.sGrow[i] = grow;
    this.sBase[i * 4] = rgb[0]; this.sBase[i * 4 + 1] = rgb[1]; this.sBase[i * 4 + 2] = rgb[2]; this.sBase[i * 4 + 3] = alpha;
    this.sLife[i] = 0;
    this.sMax[i] = life;
    this.sRot[i] = rand(0, 6.28);
    this.sSpin[i] = rand(-0.15, 0.15);
  }

  killPuff(i) {
    const j = --this.sn;
    if (i === j) return;
    this.sp.copyWithin(i * 3, j * 3, j * 3 + 3);
    this.sv.copyWithin(i * 3, j * 3, j * 3 + 3);
    this.sBase.copyWithin(i * 4, j * 4, j * 4 + 4);
    this.sSize[i] = this.sSize[j]; this.sGrow[i] = this.sGrow[j]; this.sLife[i] = this.sLife[j]; this.sMax[i] = this.sMax[j]; this.sRot[i] = this.sRot[j]; this.sSpin[i] = this.sSpin[j];
  }

  /* ---------- emitters ---------- */
  sparkler(getPos, dur = Infinity) {
    const e = { kind: "sparkler", getPos, t: 0, dur, smoke: Math.random() };
    this.emitters.push(e);
    return e;
  }
  anar(x, y, z, dur = 5) {
    const e = { kind: "anar", pos: new THREE.Vector3(x, y, z), t: 0, dur, smoke: 0 };
    this.emitters.push(e);
    return e;
  }
  chakri(x, y, z, dur = 4) {
    const e = { kind: "chakri", pos: new THREE.Vector3(x, y, z), t: 0, dur, a: 0, smoke: 0 };
    this.emitters.push(e);
    return e;
  }

  rocket(from, to, type, col, col2, dur) {
    const types = ["peony", "peony", "willow", "ring", "crackle", "chrysanthemum", "palm"];
    this.rockets.push({ from: from.clone(), to: to.clone(), pos: from.clone(), t: 0, dur: dur || rand(1.3, 1.9), type: type || types[(Math.random() * types.length) | 0], col: col || PALETTE[(Math.random() * PALETTE.length) | 0], col2: col2 || col || PALETTE[(Math.random() * PALETTE.length) | 0] });
  }

  burst(r) {
    const { pos, col, col2, type } = r;
    if (type === "text") {
      for (let i = 0; i < 40; i++) { const a = rand(0, 6.28), zz = rand(-1, 1), rr = Math.sqrt(1 - zz * zz); this.spawn(pos.x, pos.y, pos.z, rr * Math.cos(a) * 6, zz * 6, rr * Math.sin(a) * 6, [1, 0.9, 0.7], 0.25, 1.2, 0.9, 0, 0.04, 1.6); }
      this.glowPos = pos.clone(); this.glowCol = col; this.glowI = 1;
      this.onBurst?.(pos, type, col);
      return;
    }
    const big = type === "willow" || type === "palm";
    const S = type === "willow" ? 10 : 14;
    const n = type === "ring" ? 120 : type === "palm" ? 77 : 240;
    // a short white flash at the break
    for (let i = 0; i < 14; i++) {
      const a = rand(0, 6.28), zz = rand(-1, 1), rr = Math.sqrt(1 - zz * zz);
      this.spawn(pos.x, pos.y, pos.z, rr * Math.cos(a) * 4, zz * 4, rr * Math.sin(a) * 4, [1, 0.95, 0.85], 0.1, 1.3, 0.9, 0, 0.03, 2.5);
    }
    // the pistil: a tighter inner sphere in a second colour, as real shells have
    if (type === "peony" || type === "chrysanthemum") {
      const pc = col2 === col ? [1, 0.95, 0.85] : col2;
      for (let i = 0; i < 70; i++) {
        const k = i + 0.5, phi = Math.acos(1 - (2 * k) / 70), th = Math.PI * (1 + Math.sqrt(5)) * k;
        const m = S * 0.42 * rand(0.9, 1.05);
        this.spawn(pos.x, pos.y, pos.z, Math.cos(th) * Math.sin(phi) * m, Math.cos(phi) * m, Math.sin(th) * Math.sin(phi) * m, pc, rand(1.1, 1.6), 0.6, 0.97, 0.5, 0.06, 1);
      }
    }
    this.glowPos = pos.clone(); this.glowCol = col; this.glowI = 1;
    const axis = new THREE.Vector3(rand(-1, 1), rand(-0.3, 1), rand(-1, 1)).normalize();
    const u = new THREE.Vector3().crossVectors(axis, new THREE.Vector3(0, 1, 0.3)).normalize();
    const w = new THREE.Vector3().crossVectors(axis, u);
    for (let i = 0; i < n; i++) {
      let dx, dy, dz;
      if (type === "ring") {
        const a = (i / n) * Math.PI * 2;
        dx = u.x * Math.cos(a) + w.x * Math.sin(a); dy = u.y * Math.cos(a) + w.y * Math.sin(a); dz = u.z * Math.cos(a) + w.z * Math.sin(a);
      } else if (type === "palm") {
        const a = ((i % 7) / 7) * Math.PI * 2;
        dx = Math.cos(a) * 0.8; dy = 0.55 + rand(-0.05, 0.05); dz = Math.sin(a) * 0.8;
      } else {
        // fibonacci sphere: an even shell, like stars packed in a real shell
        const k = i + 0.5, phi = Math.acos(1 - (2 * k) / n), th = Math.PI * (1 + Math.sqrt(5)) * k;
        dx = Math.cos(th) * Math.sin(phi); dy = Math.cos(phi); dz = Math.sin(th) * Math.sin(phi);
      }
      const m = S * (type === "ring" ? 1 : type === "palm" ? rand(0.6, 1.1) : rand(0.88, 1.04));
      const c = big ? [1, 0.6, 0.22] : col;
      this.spawn(pos.x, pos.y, pos.z, dx * m, dy * m, dz * m, c,
        type === "willow" ? rand(3, 4.2) : type === "palm" ? rand(2.2, 2.8) : rand(1.4, 2.2),
        type === "willow" ? 0.5 : 0.7,
        type === "willow" ? 0.955 : type === "chrysanthemum" ? 0.968 : 0.975,
        type === "willow" ? 0.32 : type === "palm" ? 0.5 : 0.55,
        big || type === "chrysanthemum" ? 0.16 : 0.07,
        type === "crackle" ? -1 : big || type === "chrysanthemum" ? 1.01 : 1); // 1.01 marks a glittering star
    }
    // the smoke a shell leaves behind, tinted by its own light
    const tint = [0.32 + col[0] * 0.08, 0.3 + col[1] * 0.08, 0.3 + col[2] * 0.08];
    for (let i = 0; i < 7; i++) this.puff(pos.x + rand(-5, 5), pos.y + rand(-4, 3), pos.z + rand(-5, 5), rand(9, 16), rand(10, 16), tint, 0.06, rand(-0.3, 0.3), rand(-0.15, 0.1), rand(-0.3, 0.3), 0.9);
    this.onBurst?.(pos, type, col);
  }

  update(dt) {
    for (let k = this.emitters.length - 1; k >= 0; k--) {
      const e = this.emitters[k];
      e.t += dt;
      if (e.t > e.dur) { this.emitters.splice(k, 1); continue; }
      e.smoke -= dt;
      if (e.kind === "sparkler") {
        const p = e.getPos();
        if (!p) continue;
        for (let i = 0; i < 9; i++) {
          const zz = rand(-1, 1), a = rand(0, 6.28), rr = Math.sqrt(1 - zz * zz), m = rand(1, 3.2);
          this.spawn(p.x, p.y, p.z, rr * Math.cos(a) * m, zz * m, rr * Math.sin(a) * m, Math.random() < 0.7 ? [1, 0.78, 0.5] : [1, 1, 0.95], rand(0.08, 0.22), 0.3, 0.9, 0.3, 0.035, 2);
        }
        if (e.smoke <= 0) { this.puff(p.x, p.y + 0.1, p.z, 0.5, 4, [0.55, 0.45, 0.38], 0.12, 0, 0.25, 0, 0.35); e.smoke = 0.35; }
      } else if (e.kind === "anar") {
        const ramp = Math.sin(Math.min(1, e.t / e.dur) * Math.PI);
        for (let i = 0; i < 10 * ramp + 2; i++) {
          const a = rand(0, 6.28), spread = rand(0, 0.32), m = rand(4, 7.5) * (0.5 + 0.5 * ramp);
          this.spawn(e.pos.x, e.pos.y + 0.18, e.pos.z, Math.cos(a) * spread * m, m, Math.sin(a) * spread * m, Math.random() < 0.75 ? [1, 0.62, 0.25] : [1, 0.92, 0.75], rand(0.5, 1.1), 0.4, 0.97, 1.5, 0.05, 1.5);
        }
        if (e.smoke <= 0) { this.puff(e.pos.x + rand(-0.2, 0.2), e.pos.y + 0.5, e.pos.z + rand(-0.2, 0.2), 1.6, 9, [0.62, 0.48, 0.38], 0.2 * ramp, rand(-0.1, 0.1), 0.35, rand(-0.1, 0.1), 0.45); e.smoke = 0.2; }
      } else if (e.kind === "chakri") {
        e.a += dt * 30;
        for (let i = 0; i < 7; i++) {
          const a = e.a + i * 0.9, m = rand(2, 3.5);
          this.spawn(e.pos.x + Math.cos(a) * 0.08, e.pos.y + 0.04, e.pos.z + Math.sin(a) * 0.08, -Math.sin(a) * m, rand(0.3, 1), Math.cos(a) * m, i % 2 ? [1, 0.45, 0.25] : [0.5, 1, 0.5], rand(0.2, 0.45), 0.35, 0.94, 0.8, 0.045, 1.5);
        }
        if (e.smoke <= 0) { this.puff(e.pos.x, 0.3, e.pos.z, 1, 7, [0.55, 0.45, 0.4], 0.16, 0, 0.25, 0, 0.4); e.smoke = 0.3; }
      }
    }

    for (let k = this.rockets.length - 1; k >= 0; k--) {
      const r = this.rockets[k];
      r.t += dt;
      const u = Math.min(1, r.t / r.dur), e = 1 - Math.pow(1 - u, 2.2);
      r.pos.lerpVectors(r.from, r.to, e);
      r.pos.x += Math.sin(r.t * 13) * 0.05;
      for (let i = 0; i < 2; i++) this.spawn(r.pos.x, r.pos.y - rand(0, 0.3), r.pos.z, rand(-0.5, 0.5), rand(-2.5, -0.8), rand(-0.5, 0.5), [1, 0.62, 0.3], rand(0.25, 0.6), 0.45, 0.95, 0.4, 0.06, 1);
      if (Math.random() < dt * 8) this.puff(r.pos.x, r.pos.y, r.pos.z, 1.2, 6, [0.45, 0.38, 0.34], 0.1, 0, 0.1, 0, 0.5);
      if (u >= 1) { this.burst(r); this.rockets.splice(k, 1); }
    }

    // integrate
    for (let i = this.n - 1; i >= 0; i--) {
      this.life[i] += dt;
      if (this.life[i] >= this.maxLife[i]) {
        if (this.heat[i] < 0 && Math.random() < 0.5) { // crackle: a white pop where the star dies
          const x = this.p[i * 3], y = this.p[i * 3 + 1], z = this.p[i * 3 + 2];
          this.kill(i);
          for (let j = 0; j < 4; j++) this.spawn(x, y, z, rand(-1.5, 1.5), rand(-1.5, 1.5), rand(-1.5, 1.5), [1, 1, 0.95], 0.1, 1.8, 0.9, 0.1, 0.02, 3);
          continue;
        }
        this.kill(i);
        continue;
      }
      const j = i * 3;
      const d = Math.pow(this.drag[i], dt * 60);
      this.v[j] *= d; this.v[j + 1] = this.v[j + 1] * d - 9.8 * this.grav[i] * dt; this.v[j + 2] *= d;
      this.p[j] += this.v[j] * dt; this.p[j + 1] += this.v[j + 1] * dt; this.p[j + 2] += this.v[j + 2] * dt;
      if (this.p[j + 1] < 0.01) { this.p[j + 1] = 0.01; this.v[j + 1] *= -0.25; this.v[j] *= 0.5; this.v[j + 2] *= 0.5; }
    }
    // gold willows and chrysanthemums shed glitter as they fall
    const glitterN = this.n;
    for (let i = 0; i < glitterN && this.n < this.max - 50; i++) {
      if (Math.abs(this.heat[i] - 1.01) < 0.001 && Math.random() < dt * 9) { // Float32 stores 1.01 inexactly
        const j = i * 3;
        this.spawn(this.p[j], this.p[j + 1], this.p[j + 2], rand(-0.3, 0.3), rand(-0.6, 0), rand(-0.3, 0.3), [1, 0.85, 0.55], rand(0.25, 0.5), 0.35, 0.9, 0.15, 0.01, 1.3);
      }
    }
    if (this.glowI > 0) { this.glowI *= Math.pow(0.08, dt); this.smokeU.uGlowI.value = this.glowI; this.smokeU.uGlowPos.value.copy(this.glowPos); this.smokeU.uGlowCol.value.set(...this.glowCol); }
    // write heads and streaks
    for (let i = 0; i < this.n; i++) {
      const j = i * 3;
      const k = 1 - this.life[i] / this.maxLife[i];
      const crackle = this.heat[i] < 0;
      // stars flicker as they burn out; crackle stars strobe throughout
      const tw = crackle ? (Math.random() < 0.45 ? 1.4 : 0.15) : k < 0.28 ? (Math.random() < 0.55 ? 1 : 0.25) : 1;
      // stars burn white-hot, then settle into their colour and dim
      const hot = Math.max(0, (k - 0.82) * 5.5);
      const I = Math.min(1, k * 2.2) * tw * 1.35 * Math.min(1.6, Math.abs(this.heat[i]));
      const r = (this.c[j] + (1 - this.c[j]) * hot) * I, g = (this.c[j + 1] + (1 - this.c[j + 1]) * hot) * I, b = (this.c[j + 2] + (1 - this.c[j + 2]) * hot) * I;
      this.hp[j] = this.p[j]; this.hp[j + 1] = this.p[j + 1]; this.hp[j + 2] = this.p[j + 2];
      this.hc[j] = r; this.hc[j + 1] = g; this.hc[j + 2] = b;
      const L = i * 6, tr = this.trail[i];
      let tx = this.v[j] * tr, ty = this.v[j + 1] * tr, tz = this.v[j + 2] * tr;
      const len = Math.hypot(tx, ty, tz);
      if (len > 2.5) { const f = 2.5 / len; tx *= f; ty *= f; tz *= f; }
      this.lp[L] = this.p[j]; this.lp[L + 1] = this.p[j + 1]; this.lp[L + 2] = this.p[j + 2];
      this.lp[L + 3] = this.p[j] - tx; this.lp[L + 4] = this.p[j + 1] - ty; this.lp[L + 5] = this.p[j + 2] - tz;
      this.lc[L] = r * 0.9; this.lc[L + 1] = g * 0.9; this.lc[L + 2] = b * 0.9;
      this.lc[L + 3] = 0; this.lc[L + 4] = 0; this.lc[L + 5] = 0;
    }
    this.heads.geometry.setDrawRange(0, this.n);
    this.lines.geometry.setDrawRange(0, this.n * 2);
    this.aHP.needsUpdate = this.aHC.needsUpdate = this.aHS.needsUpdate = this.aLP.needsUpdate = this.aLC.needsUpdate = true;

    // smoke drifts on the night breeze, swells and thins
    for (let i = this.sn - 1; i >= 0; i--) {
      this.sLife[i] += dt;
      const t = this.sLife[i] / this.sMax[i];
      if (t >= 1) { this.killPuff(i); continue; }
      const j = i * 3;
      this.sp[j] += (this.sv[j] + 0.18) * dt; this.sp[j + 1] += this.sv[j + 1] * dt; this.sp[j + 2] += this.sv[j + 2] * dt;
      this.sSize[i] += this.sGrow[i] * dt;
      this.sRot[i] += this.sSpin[i] * dt;
    }
    for (let i = 0; i < this.sn; i++) {
      const t = this.sLife[i] / this.sMax[i];
      const a = this.sBase[i * 4 + 3] * Math.min(1, t * 6) * (1 - t) * (1 - t);
      this.sTint[i * 4] = this.sBase[i * 4]; this.sTint[i * 4 + 1] = this.sBase[i * 4 + 1]; this.sTint[i * 4 + 2] = this.sBase[i * 4 + 2]; this.sTint[i * 4 + 3] = a;
    }
    this.smoke.geometry.setDrawRange(0, this.sn);
    this.aSP.needsUpdate = this.aSS.needsUpdate = this.aST.needsUpdate = this.aSR.needsUpdate = true;
  }
}

// Fireworks that write in the sky: stars burst from one point, fly to the shapes of letters,
// hang there twinkling, then droop and burn out.
export class SkyText {
  constructor(scene, uniforms, sparks) {
    this.max = 14000; // room for a long greeting and a name beneath it
    this.sparks = sparks;
    this.stars = [];
    this.pos = new Float32Array(this.max * 3);
    this.col = new Float32Array(this.max * 3);
    this.size = new Float32Array(this.max).fill(1.15);
    const g = new THREE.BufferGeometry();
    this.aP = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aC = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("position", this.aP);
    g.setAttribute("aColor", this.aC);
    g.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1));
    g.setDrawRange(0, 0);
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: headVert, fragmentShader: headFrag, uniforms, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 13;
    scene.add(this.points);
  }

  // targets: Vector3[] where each star settles; origin: the burst point
  // append: add a second line while the first still hangs; hold: seconds the letters stay lit
  write(targets, origin, color = [1, 0.72, 0.32], { append = false, hold = 7.2 } = {}) {
    if (!append || !this.stars.length) { this.stars = []; this.t = 0; }
    const room = this.max - this.stars.length, base = this.t;
    // if there are more points than room, thin them out evenly across the whole word, never just the top rows
    const step = targets.length > room ? targets.length / room : 1;
    const pickd = step === 1 ? targets : Array.from({ length: room }, (_, i) => targets[Math.floor(i * step)]);
    for (const tg of pickd) this.stars.push({
      tg, o: origin.clone().add(new THREE.Vector3(rand(-0.4, 0.4), rand(-0.4, 0.4), rand(-0.4, 0.4))),
      p: origin.clone(), delay: base + rand(0, 0.25), t: 0, vy: 0, ph: rand(0, 6.28), col: color, hold,
    });
    this.end = Math.max(append ? this.end || 0 : 0, base + hold + 3);
  }

  update(dt) {
    if (!this.stars.length) return;
    this.t += dt;
    const T = this.t;
    let n = 0;
    for (const s of this.stars) {
      const tt = T - s.delay;
      if (tt < 0) continue;
      let bright;
      if (tt < 1.3) { // fly out and settle into the letter
        const k = 1 - Math.pow(1 - tt / 1.3, 3);
        s.p.lerpVectors(s.o, s.tg, k);
        bright = 1.5 + (1 - k) * 0.8;
      } else if (tt < s.hold) { // hang, glowing steadily with a faint twinkle
        s.p.copy(s.tg);
        bright = 1.25 + Math.sin(tt * 6 + s.ph) * 0.12 + (Math.random() < 0.015 ? 0.5 : 0);
        if (Math.random() < dt * 0.08 && this.sparks.n < this.sparks.max - 20) this.sparks.spawn(s.p.x, s.p.y, s.p.z, rand(-0.3, 0.3), rand(-0.8, -0.2), rand(-0.3, 0.3), [1, 0.85, 0.55], rand(0.3, 0.6), 0.35, 0.9, 0.2, 0.02, 1.3);
      } else { // droop and burn out
        s.vy -= 3.5 * dt;
        s.p.y += s.vy * dt;
        s.p.x += Math.sin(tt * 2 + s.ph) * 0.15 * dt;
        bright = Math.max(0, 1.25 * (1 - (tt - s.hold) / 2.2)) * (Math.random() < 0.6 ? 1 : 0.3);
      }
      if (bright <= 0) continue;
      const white = tt < 0.5 ? 1 - tt / 0.5 : 0;
      this.pos[n * 3] = s.p.x; this.pos[n * 3 + 1] = s.p.y; this.pos[n * 3 + 2] = s.p.z;
      this.col[n * 3] = (s.col[0] + (1 - s.col[0]) * white) * bright;
      this.col[n * 3 + 1] = (s.col[1] + (1 - s.col[1]) * white) * bright;
      this.col[n * 3 + 2] = (s.col[2] + (1 - s.col[2]) * white) * bright;
      n++;
    }
    this.points.geometry.setDrawRange(0, n);
    this.aP.needsUpdate = this.aC.needsUpdate = true;
    if (T > this.end) { this.stars = []; this.points.geometry.setDrawRange(0, 0); }
  }
}
