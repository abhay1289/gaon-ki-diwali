// Sky lanterns that drift up on the breeze, and fireflies (jugnu) hovering in the dark around you.
import * as THREE from "three";
import { glow } from "./textures.js";

const rand = (a, b) => a + Math.random() * (b - a);

export class SkyLanterns {
  constructor(scene, max = 40) {
    this.scene = scene;
    this.max = max;
    this.items = [];
    // paper body: wider at the top, open at the bottom, glowing from the flame inside
    this.geo = new THREE.CylinderGeometry(0.26, 0.19, 0.55, 14, 1, true);
    this.cap = new THREE.CircleGeometry(0.26, 14).rotateX(-Math.PI / 2).translate(0, 0.275, 0);
    this.flameGeo = new THREE.SphereGeometry(0.05, 8, 6);
    this.glowMat = new THREE.SpriteMaterial({ map: glow(), color: 0xff9a40, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  }

  // a small glowing paper tag carrying the visitor's name and wish
  makeTag(who, wish) {
    const W = 512, H = 200, c = document.createElement("canvas");
    c.width = W; c.height = H;
    const x = c.getContext("2d");
    x.fillStyle = "rgba(40,16,6,0.72)";
    x.beginPath(); x.roundRect(8, 8, W - 16, H - 16, 24); x.fill();
    x.strokeStyle = "rgba(255,200,120,0.6)"; x.lineWidth = 3; x.stroke();
    x.textAlign = "center"; x.fillStyle = "#ffd890";
    x.font = "700 40px Kalam, Manrope, sans-serif";
    x.fillText(who || "A wish", W / 2, 62, W - 50);
    x.fillStyle = "#fff4e0"; x.font = "30px Kalam, Manrope, sans-serif";
    const words = (wish || "").split(/\s+/), lines = [""];
    for (const w of words) { const t = (lines[lines.length - 1] + " " + w).trim(); if (x.measureText(t).width > W - 60 && lines.length < 3) lines.push(w); else lines[lines.length - 1] = t; }
    lines.slice(0, 3).forEach((l, i) => x.fillText(l, W / 2, 108 + i * 36, W - 50));
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
    sp.scale.set(1.5, 0.6, 1);
    sp.position.y = -0.85;
    return sp;
  }

  release(from, label) {
    if (this.items.length >= this.max) this.remove(this.items[0]);
    const hue = [0xffb060, 0xff8a50, 0xffc878, 0xff6a6a][(Math.random() * 4) | 0];
    const paper = new THREE.MeshStandardMaterial({ color: hue, emissive: hue, emissiveIntensity: 0.85, side: THREE.DoubleSide, transparent: true, opacity: 0.92, roughness: 0.9 });
    const g = new THREE.Group();
    g.add(new THREE.Mesh(this.geo, paper), new THREE.Mesh(this.cap, paper));
    const flame = new THREE.Mesh(this.flameGeo, new THREE.MeshBasicMaterial({ color: 0xfff0c0 }));
    flame.position.y = -0.24;
    g.add(flame);
    const halo = new THREE.Sprite(this.glowMat.clone());
    halo.scale.setScalar(1.4);
    g.add(halo);
    let tag = null;
    if (label) { tag = this.makeTag(label.who, label.wish); g.add(tag); }
    g.position.copy(from);
    this.scene.add(g);
    this.items.push({ g, paper, halo, tag, t: 0, vy: 0.2, drift: new THREE.Vector3(rand(0.25, 0.6), 0, rand(-0.25, 0.25)), seed: rand(0, 9) });
  }

  remove(it) {
    this.scene.remove(it.g);
    if (it.tag) { it.tag.material.map.dispose(); it.tag.material.dispose(); }
    it.paper.dispose();
    it.halo.material.dispose();
    this.items.splice(this.items.indexOf(it), 1);
  }

  update(dt, t) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      it.vy = Math.min(1.3, it.vy + dt * 0.35);
      const p = it.g.position;
      p.y += it.vy * dt;
      p.x += (it.drift.x + Math.sin(t * 0.6 + it.seed) * 0.25) * dt;
      p.z += (it.drift.z + Math.cos(t * 0.5 + it.seed) * 0.25) * dt;
      it.g.rotation.z = Math.sin(t * 1.2 + it.seed) * 0.08;
      it.g.rotation.x = Math.cos(t * 1.1 + it.seed) * 0.08;
      const fl = 1 + 0.12 * Math.sin(t * 13 + it.seed) + 0.06 * Math.sin(t * 29 + it.seed);
      // the flame gutters out as the lantern climbs out of sight
      const fade = THREE.MathUtils.clamp(1 - (p.y - 60) / 40, 0, 1);
      it.paper.emissiveIntensity = 0.85 * fl * fade;
      it.paper.opacity = 0.92 * fade;
      it.halo.material.opacity = 0.45 * fl * fade;
      if (it.tag) it.tag.material.opacity = Math.min(1, it.t * 2) * THREE.MathUtils.clamp(1 - (it.t - 9) / 4, 0, 1); // readable while it rises past you
      if (fade <= 0) this.remove(it);
    }
  }
}

export class Fireflies {
  constructor(scene, n = 120) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.home = [];
    this.alpha = new Float32Array(n);
    for (let i = 0; i < n; i++) this.home.push({ o: new THREE.Vector3(rand(-18, 18), rand(0.3, 2.6), rand(-18, 18)), ph: rand(0, 50), sp: rand(0.2, 0.6) });
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("position", this.aPos);
    g.setAttribute("aAlpha", this.aAlpha);
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: { uMap: { value: glow() } },
      vertexShader: `attribute float aAlpha; varying float vA; void main(){ vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = 70.0 / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D uMap; varying float vA; void main(){ float g = texture2D(uMap, gl_PointCoord).a; gl_FragColor = vec4(vec3(0.75, 1.0, 0.35) * g * vA * 1.6, 1.0); }`,
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  update(dt, t, camera) {
    const c = camera.position;
    for (let i = 0; i < this.n; i++) {
      const h = this.home[i], o = h.o;
      // fireflies stay put in the world; ones left far behind reappear ahead
      while (o.x - c.x > 18) o.x -= 36;
      while (o.x - c.x < -18) o.x += 36;
      while (o.z - c.z > 18) o.z -= 36;
      while (o.z - c.z < -18) o.z += 36;
      this.pos[i * 3] = o.x + Math.sin(t * h.sp + h.ph) * 1.6;
      this.pos[i * 3 + 1] = Math.max(0.2, o.y + Math.sin(t * h.sp * 1.7 + h.ph) * 0.4);
      this.pos[i * 3 + 2] = o.z + Math.cos(t * h.sp * 0.8 + h.ph) * 1.6;
      // slow glow-and-fade, the way jugnu blink
      const b = Math.sin(t * 1.4 + h.ph * 3);
      this.alpha[i] = Math.max(0, b) * Math.max(0, b);
    }
    this.aPos.needsUpdate = this.aAlpha.needsUpdate = true;
  }
}
