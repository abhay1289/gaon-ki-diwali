// Diyas (instanced clay bowls + shader flames + ground glow) and a pool of real point lights
// that are handed to the lamp clusters nearest the camera.
import * as THREE from "three";
import { glow } from "./textures.js";

// The village lights up in a wave: lamps within (x, z) radius r are lit, with a soft edge of width w.
export const reveal = { value: new THREE.Vector4(0, 0, 1e5, 8) };
export function revealAt(x, z) {
  const r = reveal.value;
  const d = Math.hypot(x - r.x, z - r.y);
  return 1 - THREE.MathUtils.smoothstep(d, r.z - r.w, r.z);
}

const flameVert = /* glsl */ `
  attribute vec3 aPos;
  attribute float aScale;
  attribute float aSeed;
  attribute float aPower;
  attribute vec3 aTint;
  uniform float uTime;
  uniform vec4 uReveal;
  varying vec2 vUv;
  varying float vPower;
  varying vec3 vTint;
  void main() {
    float rv = 1.0 - smoothstep(uReveal.z - uReveal.w, uReveal.z, length(aPos.xz - uReveal.xy));
    float pw = aPower * rv;
    float f = 1.0 + 0.12 * sin(uTime * 11.0 + aSeed * 7.0) + 0.08 * sin(uTime * 17.3 + aSeed * 3.0) + 0.05 * sin(uTime * 29.0 + aSeed);
    vec3 right = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]));
    float h = aScale * f * (0.4 + 0.6 * pw);
    float w = aScale * 0.42;
    vec2 q = position.xy; // x in [-.5,.5], y in [0,1]
    float sway = q.y * q.y * (sin(uTime * 2.3 + aSeed * 5.0) * 0.12 + sin(uTime * 6.1 + aSeed) * 0.05) * aScale;
    vec3 wp = aPos + right * (q.x * w + sway) + vec3(0.0, q.y * h, 0.0);
    vUv = vec2(q.x + 0.5, q.y);
    vPower = pw;
    vTint = aTint;
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  }
`;
const flameFrag = /* glsl */ `
  varying vec2 vUv;
  varying float vPower;
  varying vec3 vTint;
  void main() {
    if (vPower < 0.01) discard;
    float y = vUv.y;
    float x = (vUv.x - 0.5) * 2.0;
    float narrow = y < 0.28 ? 1.0 : max(0.02, 1.0 - (y - 0.28) / 0.72);
    narrow = pow(narrow, 0.8);
    float dy = y < 0.28 ? (y - 0.28) * 3.6 : (y - 0.28) * 1.38;
    float d = length(vec2(x / narrow, dy));
    float body = smoothstep(1.0, 0.15, d);
    float core = smoothstep(0.6, 0.0, length(vec2(x / max(narrow, 0.05) * 1.6, (y - 0.25) * 2.6)));
    vec3 col = mix(vec3(1.0, 0.36, 0.06), vec3(1.0, 0.72, 0.3), body);
    col = mix(col, vec3(1.0, 0.97, 0.85), core);
    col *= vTint;
    float blue = smoothstep(0.18, 0.0, y) * smoothstep(0.6, 0.0, abs(x)) * 0.6;
    col += vec3(0.15, 0.25, 1.0) * blue;
    gl_FragColor = vec4(col * body * 1.35 * vPower, 1.0);
  }
`;

const haloVert = /* glsl */ `
  attribute vec3 aPos;
  attribute float aScale;
  attribute float aPower;
  attribute vec3 aTint;
  uniform vec4 uReveal;
  varying vec2 vUv;
  varying float vPower;
  varying vec3 vTint;
  varying float vFade;
  void main() {
    float rv = 1.0 - smoothstep(uReveal.z - uReveal.w, uReveal.z, length(aPos.xz - uReveal.xy));
    vFade = smoothstep(1.0, 5.0, length((viewMatrix * vec4(aPos, 1.0)).xyz));
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    float s = aScale * 1.5;
    vec3 wp = aPos + vec3(0.0, aScale * 0.45, 0.0) + (right * position.x + up * (position.y - 0.5)) * s;
    vUv = vec2(position.x + 0.5, position.y);
    vPower = aPower * rv;
    vTint = aTint;
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  }
`;
const haloFrag = /* glsl */ `
  uniform sampler2D uGlow;
  varying vec2 vUv;
  varying float vPower;
  varying vec3 vTint;
  varying float vFade;
  void main() {
    float g = texture2D(uGlow, vUv).a;
    gl_FragColor = vec4(vec3(1.0, 0.55, 0.2) * vTint * g * g * 0.22 * vPower * vFade, 1.0);
  }
`;

function diyaGeometry() {
  // clay bowl profile, 12 cm across, with a pinched spout implied by squash
  const pts = [
    [0, 0], [0.03, 0.002], [0.05, 0.012], [0.06, 0.028], [0.063, 0.04], [0.058, 0.042], [0.05, 0.03], [0.03, 0.025], [0, 0.024],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(pts, 18);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    // pull one side into a spout
    const a = Math.atan2(z, x);
    const k = Math.pow(Math.max(0, Math.cos(a)), 6);
    p.setX(i, x * (1 + 0.45 * k));
    p.setZ(i, z * (1 - 0.15 * k));
  }
  g.computeVertexNormals();
  return g;
}

export class Lamps {
  constructor() {
    this.items = []; // {x,y,z,scale,power,tint,seed,rot,bowl}
    this.spots = []; // light clusters
  }

  // A diya at ground or ledge height. Returns its index.
  add(x, y, z, o = {}) {
    this.items.push({
      x, y, z,
      scale: o.scale ?? 1,
      power: o.lit === false ? 0 : 1,
      tint: o.tint || [1, 1, 1],
      seed: Math.random() * 100,
      rot: o.rot ?? Math.random() * Math.PI * 2,
      bowl: o.bowl !== false,
      flame: o.flame ?? 0.07,
      glowDecal: o.decal !== false,
    });
    return this.items.length - 1;
  }

  row(a, b, n, o = {}) {
    const ids = [];
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0.5 : i / (n - 1);
      ids.push(this.add(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, o));
    }
    if (o.spot !== false) {
      const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
      const k = Math.max(1, Math.round(len / 5));
      for (let i = 0; i < k; i++) {
        const u = (i + 0.5) / k;
        this.spot(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u + 0.3, a[2] + (b[2] - a[2]) * u, o.spotPower ?? Math.min(6, 1.2 + n / k * 0.5), o.spotColor);
      }
    }
    return ids;
  }

  ring(cx, y, cz, r, n, o = {}) {
    const ids = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      ids.push(this.add(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r, o));
    }
    if (o.spot !== false) this.spot(cx, y + 0.5, cz, o.spotPower ?? Math.min(8, 1.5 + n * 0.2), o.spotColor);
    return ids;
  }

  // A light cluster: gets a real PointLight when near the camera.
  spot(x, y, z, power = 3, color = 0xff9a48, o = {}) {
    this.spots.push({ pos: new THREE.Vector3(x, y + 0.5, z), power: power * 0.9, color: new THREE.Color(color), flicker: o.flicker ?? 1, range: o.range ?? 10, seed: Math.random() * 50, on: o.on ?? 1 });
    return this.spots.length - 1;
  }

  build(scene, { lightCount = 14, shadows = 0 } = {}) {
    const n = this.items.length;
    const bowls = this.items.filter((d) => d.bowl);
    // clay bowls
    const bowlMat = new THREE.MeshStandardMaterial({ color: 0x8a3e1e, roughness: 0.85, emissive: 0xff6a20, emissiveIntensity: 0.12 });
    this.bowlMesh = new THREE.InstancedMesh(diyaGeometry(), bowlMat, bowls.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    this.bowlIndex = new Map();
    bowls.forEach((d, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), d.rot);
      m.compose(p.set(d.x, d.y, d.z), q, s.setScalar(d.scale));
      this.bowlMesh.setMatrixAt(i, m);
      this.bowlIndex.set(this.items.indexOf(d), i);
    });
    this.bowlMesh.receiveShadow = true;
    scene.add(this.bowlMesh);

    // flames + halos share instance attributes
    const quad = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.attributes.position = quad.attributes.position;
    geo.instanceCount = n;
    const pos = new Float32Array(n * 3), sc = new Float32Array(n), seed = new Float32Array(n), pw = new Float32Array(n), tint = new Float32Array(n * 3);
    this.items.forEach((d, i) => {
      const off = d.bowl ? 0.045 * d.scale : 0;
      // flame sits on the spout side of the bowl
      pos.set([d.x + Math.cos(d.rot) * 0.06 * d.scale, d.y + off, d.z - Math.sin(d.rot) * 0.06 * d.scale], i * 3);
      sc[i] = d.flame * d.scale;
      seed[i] = d.seed;
      pw[i] = d.power;
      tint.set(d.tint, i * 3);
    });
    this.aPos = new THREE.InstancedBufferAttribute(pos, 3);
    this.aPower = new THREE.InstancedBufferAttribute(pw, 1);
    geo.setAttribute("aPos", this.aPos);
    geo.setAttribute("aScale", new THREE.InstancedBufferAttribute(sc, 1));
    geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 1));
    geo.setAttribute("aPower", this.aPower);
    geo.setAttribute("aTint", new THREE.InstancedBufferAttribute(tint, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

    this.uniforms = { uTime: { value: 0 }, uGlow: { value: glow() }, uReveal: reveal };
    const flameMat = new THREE.ShaderMaterial({ vertexShader: flameVert, fragmentShader: flameFrag, uniforms: this.uniforms, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const haloMat = new THREE.ShaderMaterial({ vertexShader: haloVert, fragmentShader: haloFrag, uniforms: this.uniforms, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    this.flames = new THREE.Mesh(geo, flameMat);
    this.flames.frustumCulled = false;
    this.flames.renderOrder = 10;
    this.halos = new THREE.Mesh(geo, haloMat);
    this.halos.frustumCulled = false;
    this.halos.renderOrder = 9;
    scene.add(this.flames, this.halos);

    // warm pools on whatever the lamp stands on
    const decals = this.items.filter((d) => d.glowDecal);
    const dMat = new THREE.MeshBasicMaterial({ map: glow(), color: 0xff8a3a, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    this.decalMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), dMat, decals.length);
    this.decalIndex = new Map();
    decals.forEach((d, i) => {
      m.compose(p.set(d.x, d.y + 0.004, d.z), q.identity(), s.set(1.3 * d.scale, 1, 1.3 * d.scale));
      this.decalMesh.setMatrixAt(i, m);
      this.decalIndex.set(this.items.indexOf(d), i);
    });
    this.decalMesh.renderOrder = 2;
    scene.add(this.decalMesh);

    // pool of real lights
    this.pool = Array.from({ length: lightCount }, (_, i) => {
      const l = new THREE.PointLight(0xff9a48, 0, 10, 2);
      if (i < shadows) {
        l.castShadow = true;
        l.shadow.mapSize.set(256, 256);
        l.shadow.camera.near = 0.2;
        l.shadow.camera.far = 8;
        l.shadow.bias = -0.004;
        l.shadow.radius = 1;
      }
      l.userData = { spot: -1, level: 0 };
      scene.add(l);
      return l;
    });
    this._acc = 1;
  }

  setPower(i, v) {
    this.items[i].power = v;
    this.aPower.setX(i, v);
    this.aPower.needsUpdate = true;
    const di = this.decalIndex.get(i);
    if (di !== undefined) {
      const m = new THREE.Matrix4(), d = this.items[i];
      m.compose(new THREE.Vector3(d.x, d.y + 0.004, d.z), new THREE.Quaternion(), new THREE.Vector3(1.3 * d.scale * v + 0.001, 1, 1.3 * d.scale * v + 0.001));
      this.decalMesh.setMatrixAt(di, m);
      this.decalMesh.instanceMatrix.needsUpdate = true;
    }
  }

  move(i, x, y, z) {
    const d = this.items[i];
    d.x = x; d.y = y; d.z = z;
    this.aPos.setXYZ(i, x + Math.cos(d.rot) * 0.06 * d.scale, y + 0.045 * d.scale, z - Math.sin(d.rot) * 0.06 * d.scale);
    this.aPos.needsUpdate = true;
    const bi = this.bowlIndex.get(i);
    if (bi !== undefined) {
      const m = new THREE.Matrix4();
      m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), d.rot), new THREE.Vector3().setScalar(d.scale));
      this.bowlMesh.setMatrixAt(bi, m);
      this.bowlMesh.instanceMatrix.needsUpdate = true;
    }
  }

  update(t, dt, camera) {
    this.uniforms.uTime.value = t;
    this.decalMesh.material.opacity = 0.32 * THREE.MathUtils.clamp(reveal.value.z / 120, 0, 1);
    this._acc += dt;
    if (this._acc > 0.3) {
      this._acc = 0;
      // choose the clusters that matter most to this view
      const cam = camera.position;
      const ranked = this.spots
        .map((s, i) => ({ i, score: s.on ? s.pos.distanceTo(cam) / Math.sqrt(s.power) : 1e9 }))
        .sort((a, b) => a.score - b.score)
        .slice(0, this.pool.length)
        .map((r) => r.i);
      // shadow-casting lights always take the two most important clusters
      const shadowLights = this.pool.filter((l) => l.castShadow);
      shadowLights.forEach((l, k) => {
        const si = ranked[k];
        if (si === undefined || l.userData.spot === si) return;
        this.pool.forEach((o) => { if (o !== l && o.userData.spot === si) o.userData.spot = -1; });
        l.userData.spot = si;
        l.userData.level = 0;
        const s = this.spots[si];
        l.position.copy(s.pos); l.color.copy(s.color); l.distance = s.range;
      });
      const want = new Set(ranked);
      const free = [];
      this.pool.forEach((l) => { if (!want.has(l.userData.spot)) free.push(l); else want.delete(l.userData.spot); });
      for (const si of want) {
        const l = free.pop();
        if (!l) break;
        l.userData.spot = si;
        l.userData.level = 0;
        const s = this.spots[si];
        l.position.copy(s.pos);
        l.color.copy(s.color);
        l.distance = s.range;
      }
      free.forEach((l) => (l.userData.spot = -1));
    }
    for (const l of this.pool) {
      const si = l.userData.spot;
      const s = this.spots[si];
      const target = s ? s.power * s.on * revealAt(s.pos.x, s.pos.z) * (1 + s.flicker * (0.08 * Math.sin(t * 9 + s.seed) + 0.05 * Math.sin(t * 23 + s.seed * 2))) : 0;
      l.userData.level += (target - l.userData.level) * Math.min(1, dt * 4);
      l.intensity = l.userData.level;
      if (s) l.position.copy(s.pos);
    }
  }
}
