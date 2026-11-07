// One camera owner: a guided route through the lanes (with drag-to-look), or free walking with collision.
import * as THREE from "three";

const UP = new THREE.Vector3(0, 1, 0);

// Route keys: eye position and gaze target. Stops reference key indices.
export const KEYS = [
  { p: [0, 1.6, 61], l: [0, 1.9, 40] },              // 0  gali
  { p: [-3, 1.6, 59.6], l: [-12, 1.0, 57] },
  { p: [-6.8, 1.6, 58.6], l: [-12, 0.9, 56.8] },     // 2  kuan
  { p: [-1, 1.6, 54], l: [8, 1.4, 47] },
  { p: [5.2, 1.6, 47.1], l: [16, 1.2, 47] },
  { p: [12.4, 1.6, 47], l: [18.6, 0.9, 46.4] },      // 5  gaushala
  { p: [5.5, 1.6, 46.4], l: [-2, 1.5, 40] },
  { p: [-2.4, 1.6, 40.6], l: [-8, 1.3, 40] },
  { p: [-4.6, 1.75, 40.2], l: [-9, 1.2, 40.2] },     // through the door
  { p: [-6.3, 1.75, 40.6], l: [-9.6, 0.9, 40.5] },   // 9  mehmaan (inside)
  { p: [-4.2, 1.6, 40.1], l: [0, 1.5, 36] },
  { p: [-1.2, 1.6, 36.4], l: [-6, 1.5, 30] },
  { p: [-4.4, 1.6, 29.4], l: [-12, 1.4, 31] },
  { p: [-10.6, 1.6, 30.8], l: [-16.6, 0.7, 33] },    // 13 rasoi
  { p: [-7, 1.6, 24.4], l: [-14, 1.0, 22.5] },
  { p: [-11.7, 1.6, 23.7], l: [-15.6, 0.5, 21.6] },  // 15 aangan
  { p: [-13.4, 1.6, 24.4], l: [-18, 1.4, 23.5] },    // round the rangoli, never across it
  { p: [-16.6, 1.65, 23.9], l: [-19, 1.4, 22.4] },
  { p: [-17.9, 1.8, 22.1], l: [-21, 1.2, 22.1] },    // through the door
  { p: [-19, 1.75, 22.9], l: [-21.6, 1.0, 22] },     // 19 puja ghar (inside)
  { p: [-17.4, 1.7, 22.5], l: [-14, 1.5, 25] },
  { p: [-15.4, 1.6, 24.5], l: [-11, 1.5, 23.5] },
  { p: [-11.2, 1.6, 23], l: [-6, 1.5, 21] },
  { p: [-8, 1.6, 21.6], l: [2, 1.4, 17] },
  { p: [7.4, 1.6, 17.6], l: [15, 0.7, 12.4] },       // 24 kumhar
  { p: [12.5, 1.6, 20.6], l: [28, 4, 24] },
  { p: [17.5, 1.65, 22.4], l: [28, 4.2, 24] },       // 26 mela
  { p: [9, 1.6, 19], l: [2, 1.6, 4] },
  { p: [6.2, 1.65, 8], l: [0, 2, -4] },
  { p: [6.4, 1.65, 6], l: [-4, 1.7, -6] },           // 29 haat
  { p: [5.6, 1.6, -7.2], l: [12, 0.8, -12] },
  { p: [8.2, 1.6, -9.4], l: [11.8, 0.3, -12.2] },    // 31 taash
  { p: [6, 1.6, -14.5], l: [0, 3, -30] },
  { p: [2.2, 1.6, -20.6], l: [0, 3.4, -33] },        // 33 mandir
  { p: [9, 1.6, -21.5], l: [24, 0.5, -24] },
  { p: [14.7, 2.05, -23], l: [24, 0.2, -24.6] },     // 35 pokhar
  { p: [8, 1.6, -18.2], l: [-8, 1.6, -15] },
  { p: [-6, 1.6, -17.6], l: [-12, 1.6, -23] },
  { p: [-10.5, 1.6, -22.6], l: [-20, 2, -26] },
  { p: [-13.4, 1.65, -26], l: [-34, 2.2, -26] },     // 39 bazaar
  { p: [-12.4, 1.6, -21], l: [-15, 1.7, -12] },
  { p: [-14, 1.6, -15], l: [-15, 1.7, -6] },
  { p: [-15, 1.6, -8], l: [-17.4, 2, -6] },
  { p: [-17.4, 1.75, -6.4], l: [-17.4, 4.2, -14] },
  { p: [-17.4, 4.4, -12.4], l: [-19.5, 4.9, -13.6] },
  { p: [-18.9, 4.98, -13.5], l: [0, 5.5, 7] },       // 45 chhat
];

export class TourCamera {
  constructor(camera, dom, colliders, reduceMotion) {
    this.camera = camera;
    this.dom = dom;
    this.colliders = colliders;
    this.reduce = reduceMotion;
    this.posCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k.p)), false, "centripetal");
    this.lookCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k.l)), false, "centripetal");
    this.n = KEYS.length - 1;
    this.s = 0;
    this.target = 0;
    this.vel = 0;
    this.mode = "guided";
    this.yawOff = 0;
    this.pitchOff = 0;
    this.free = { pos: new THREE.Vector3(), yaw: 0, pitch: 0 };
    this.keys = new Set();
    this.touchMove = 0;
    this.touchTurn = 0;
    this.bob = 0;
    this._p = new THREE.Vector3();
    this._l = new THREE.Vector3();
    this.drag = null;
    this.onTap = null;
    this.bindInput();
  }

  bindInput() {
    const el = this.dom;
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, ox: e.clientX, oy: e.clientY, touch: e.pointerType === "touch", axis: null };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", (e) => {
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      d.x = e.clientX; d.y = e.clientY;
      d.moved += Math.abs(dx) + Math.abs(dy);
      if (this.lockLook) return; // something else (the aarti thali) owns the pointer
      const k = 0.0042;
      // on touch, decide once per gesture: mostly vertical walks, otherwise look
      if (d.touch && !d.axis && Math.hypot(e.clientX - d.ox, e.clientY - d.oy) > 10) {
        d.axis = Math.abs(e.clientY - d.oy) > Math.abs(e.clientX - d.ox) * 1.3 && this.mode === "guided" && !this.ride ? "walk" : "look";
      }
      if (d.axis === "walk") { this.scrub(-dy * 0.012); return; }
      if (this.mode === "free") {
        this.free.yaw -= dx * k;
        this.free.pitch = THREE.MathUtils.clamp(this.free.pitch - dy * k, -1.1, 1.1);
      } else {
        this.yawOff -= dx * k;
        this.pitchOff = THREE.MathUtils.clamp(this.pitchOff - dy * k, -0.7, 0.9);
      }
    });
    const end = (e) => {
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      if (d.moved < 8 && this.onTap) this.onTap(e);
      this.drag = null;
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", () => (this.drag = null));
    el.addEventListener("lostpointercapture", () => (this.drag = null));
    window.addEventListener("keydown", (e) => {
      if (e.target.closest && e.target.closest("input, textarea, select")) return;
      this.keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());
  }

  // walk along the route by a number of keys (fractional); used by scroll and swipe
  scrub(delta) {
    if (this.mode !== "guided" || this.ride) return;
    if (!this.direct) this.target = this.s; // take over from any flight in progress, right where it is
    this.direct = true;
    this.vel = 0;
    this.target = THREE.MathUtils.clamp(this.target + delta, 0, this.n);
    if (this.reduce) { this.s = this.target; this.vel = 0; }
    this.lastScrub = performance.now();
  }

  goTo(key) {
    this.direct = false;
    this.target = THREE.MathUtils.clamp(key, 0, this.n);
    if (this.reduce) { this.s = this.target; this.vel = 0; }
  }

  get moving() { return Math.abs(this.target - this.s) > 0.002; }

  enterFree() {
    this.mode = "free";
    const c = this.camera;
    this.free.pos.copy(c.position);
    this.free.pos.y = 1.6;
    const dir = new THREE.Vector3();
    c.getWorldDirection(dir);
    this.free.yaw = Math.atan2(-dir.x, -dir.z);
    this.free.pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
    this.resolve(this.free.pos);
  }

  exitFree(key) {
    this.mode = "guided";
    this.s = this.target = key;
    this.vel = 0;
    this.yawOff = this.pitchOff = 0;
  }

  resolve(p) {
    const R = 0.35;
    for (const c of this.colliders) {
      if (c.r !== undefined) {
        const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + R;
        if (d < m && d > 1e-4) { p.x = c.x + (dx / d) * m; p.z = c.z + (dz / d) * m; }
      } else if (p.x > c.minX - R && p.x < c.maxX + R && p.z > c.minZ - R && p.z < c.maxZ + R) {
        const pushes = [c.minX - R - p.x, c.maxX + R - p.x, c.minZ - R - p.z, c.maxZ + R - p.z];
        const abs = pushes.map(Math.abs);
        const i = abs.indexOf(Math.min(...abs));
        if (i < 2) p.x += pushes[i]; else p.z += pushes[i];
      }
    }
    const r = Math.hypot(p.x, p.z);
    if (r > 70) { p.x *= 70 / r; p.z *= 70 / r; }
  }

  // a sudden jolt (a sutli bomb nearby); decays on its own
  jolt(amount) { this.shake = Math.min(0.06, (this.shake || 0) + amount); }

  update(dt) {
    if (this.ride) this.ride(dt, this.camera);
    else this.move(dt);
    if (this.shake > 0.0005) {
      const s = this.shake;
      this.camera.rotateX((Math.random() - 0.5) * s);
      this.camera.rotateY((Math.random() - 0.5) * s);
      this.camera.position.y += (Math.random() - 0.5) * s * 0.6;
      this.shake *= Math.pow(0.02, dt);
    }
  }

  move(dt) {
    const cam = this.camera;
    if (this.mode === "free") {
      const f = this.free;
      let fwd = 0, side = 0, turn = this.touchTurn;
      if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) fwd += 1;
      if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) fwd -= 1;
      if (this.keys.has("KeyA")) side -= 1;
      if (this.keys.has("KeyD")) side += 1;
      if (this.keys.has("ArrowLeft")) turn += 1;
      if (this.keys.has("ArrowRight")) turn -= 1;
      fwd += this.touchMove;
      f.yaw += turn * dt * 1.6;
      const speed = (this.keys.has("ShiftLeft") ? 3.2 : 1.7) * dt;
      const sx = -Math.sin(f.yaw), sz = -Math.cos(f.yaw);
      f.pos.x += (sx * fwd - sz * side) * speed;
      f.pos.z += (sz * fwd + sx * side) * speed;
      this.resolve(f.pos);
      if (fwd || side) this.bob += dt * 9;
      cam.position.set(f.pos.x, 1.6 + (this.floorAt ? this.floorAt(f.pos.x, f.pos.z) : 0) + Math.sin(this.bob) * 0.025, f.pos.z);
      cam.rotation.set(0, 0, 0);
      cam.rotateOnWorldAxis(UP, f.yaw);
      cam.rotateX(f.pitch);
      return;
    }

    // scrolling: follow the scroll closely and stop the moment it stops
    if (this.direct) {
      this.s += (this.target - this.s) * Math.min(1, dt * 14);
      if (Math.abs(this.target - this.s) < 0.0005) this.s = this.target;
      this.vel = (this.target - this.s) * 14;
    } else {
    // guided: accelerate toward the target key, ease into the stop
    const d = this.target - this.s;
    const dist = Math.abs(d);
    const vmax = Math.max(0.55, dist / 4.5); // a neighbouring stop is a stroll; a far one is a brisk walk
    const want = Math.sign(d) * Math.min(vmax, Math.sqrt(2 * 1.1 * dist));
    this.vel += (want - this.vel) * Math.min(1, dt * 3);
    if (dist < 0.002) { this.s = this.target; this.vel = 0; }
    else this.s += this.vel * dt;
    if (Math.sign(this.target - this.s) !== Math.sign(d) && d !== 0) { this.s = this.target; this.vel = 0; }
    }

    const u = this.s / this.n;
    this.posCurve.getPoint(u, this._p);
    this.lookCurve.getPoint(u, this._l);
    if (Math.abs(this.vel) > 0.05) {
      this.bob += dt * 8;
      const k = Math.pow(0.15, dt);
      this.yawOff *= k; this.pitchOff *= k;
    }
    const bob = this.reduce ? 0 : Math.sin(this.bob) * 0.02 * Math.min(1, Math.abs(this.vel) * 2);
    cam.position.set(this._p.x, this._p.y + bob, this._p.z);
    cam.lookAt(this._l);
    this.time = (this.time || 0) + dt;
    const h = this.reduce ? 0 : 1, tt = this.time;
    cam.rotateOnWorldAxis(UP, this.yawOff + h * (Math.sin(tt * 0.31) * 0.006 + Math.sin(tt * 0.83) * 0.003));
    cam.rotateX(this.pitchOff + h * (Math.sin(tt * 0.27 + 1) * 0.004 + Math.sin(tt * 0.71) * 0.002));
    cam.rotateZ(h * Math.sin(tt * 0.19) * 0.003);
  }
}
