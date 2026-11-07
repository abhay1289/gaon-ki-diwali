// Villagers built from simple shapes and animated: walkers, sitters, worshippers, children with phuljhadi.
import * as THREE from "three";

const SKIN = ["#8d5a3b", "#a0694a", "#6e4630", "#b07a55", "#7a4a30"];
const SAREE = ["#b8122c", "#c2185b", "#2e7d32", "#f2b705", "#e8641a", "#6a1b9a", "#0d6e7a", "#d81b60"];
const KURTA = ["#ece6da", "#e3d7bf", "#e8892a", "#6a9ac8", "#7a1f2b", "#f1e3b3", "#4a6a3a"];
const KIDS = ["#e53935", "#fdd835", "#43a047", "#1e88e5", "#fb8c00", "#8e24aa", "#00acc1"];
const pick = (a) => a[(Math.random() * a.length) | 0];

const mats = new Map();
function mat(hex, o = {}) {
  const k = hex + JSON.stringify(o);
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: hex, roughness: 0.85, ...o }));
  return mats.get(k);
}
const G = {
  cyl: new THREE.CylinderGeometry(1, 1, 1, 16),
  cone: new THREE.CylinderGeometry(0.6, 1, 1, 22, 1, true),
  sph: new THREE.SphereGeometry(1, 20, 14),
  half: new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  box: new THREE.BoxGeometry(1, 1, 1),
  disc: new THREE.CylinderGeometry(1, 1, 1, 20),
  torus: new THREE.TorusGeometry(1, 0.25, 6, 18),
};
// add a torus lying flat (rings, bangles, saree border)
function flat(parent, mesh) {
  mesh.rotation.x = Math.PI / 2;
  parent.add(mesh);
  return mesh;
}
function part(geo, m, sx, sy, sz, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geo, m);
  mesh.scale.set(sx, sy, sz);
  mesh.position.set(x, y, z);
  return mesh;
}

/*
 * opts: { kind: 'man'|'woman'|'child'|'girl'|'priest'|'elder', carry: 'thali'|'box'|'sparkler'|'lathi'|null,
 *         pose: 'walk'|'stand'|'namaste'|'sit'|'squat'|'aarti'|'stir'|'wave', colors... }
 */
export function makePerson(opts = {}) {
  const kind = opts.kind || "man";
  const child = kind === "child" || kind === "girl";
  const female = kind === "woman" || kind === "girl";
  const H = opts.height || (child ? rand(1.0, 1.25) : female ? rand(1.5, 1.62) : rand(1.6, 1.74));
  const s = H / 1.7;
  const skin = mat(opts.skin || pick(SKIN), { roughness: 0.62 });
  const cloth = mat(opts.color || (child ? pick(KIDS) : female ? pick(SAREE) : kind === "priest" ? "#f0e8d8" : pick(KURTA)));
  const lower = mat(opts.lower || (female ? null : kind === "priest" ? "#e8892a" : child ? "#2a3a6a" : "#ede7dc") || "#ede7dc");
  const gold = mat("#d9a53a", { metalness: 0.6, roughness: 0.4 });
  const hairM = mat("#141010");

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const legLen = 0.82 * s, torsoLen = 0.56 * s, hipY = legLen;

  // legs
  const legs = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.09 * s, hipY, 0);
    pivot.add(part(G.cyl, lower, 0.065 * s, legLen, 0.065 * s, 0, -legLen / 2, 0));
    pivot.add(part(G.box, mat("#2a1a10"), 0.09 * s, 0.05 * s, 0.22 * s, 0, -legLen + 0.02, 0.05 * s)); // chappal + foot
    body.add(pivot);
    return pivot;
  });

  let skirt = null;
  if (female && !child) {
    // saree skirt and border
    skirt = part(G.cone, cloth, 0.3 * s, legLen + 0.04, 0.3 * s, 0, legLen / 2 - 0.01, 0);
    skirt.material = cloth.clone();
    skirt.material.side = THREE.DoubleSide;
    body.add(skirt);
    skirt.userData.border = flat(body, part(G.torus, gold, 0.29 * s, 0.29 * s, 0.1 * s, 0, 0.05, 0));
    legs.forEach((l) => (l.visible = false));
  } else if (!child || kind === "child") {
    // kurta hem
    body.add(part(G.cone, cloth, 0.21 * s, 0.32 * s, 0.21 * s, 0, hipY - 0.06 * s, 0));
  } else {
    body.add(part(G.cone, cloth, 0.26 * s, 0.4 * s, 0.26 * s, 0, hipY - 0.12 * s, 0)); // lehenga
  }

  // torso, neck, head
  const torso = new THREE.Group();
  torso.position.y = hipY;
  body.add(torso);
  torso.add(part(G.cyl, cloth, 0.17 * s, torsoLen, 0.13 * s, 0, torsoLen / 2, 0));
  torso.add(part(G.sph, cloth, 0.2 * s, 0.08 * s, 0.14 * s, 0, torsoLen, 0)); // shoulders
  torso.add(part(G.cyl, skin, 0.045 * s, 0.1 * s, 0.045 * s, 0, torsoLen + 0.06 * s, 0));
  const head = new THREE.Group();
  head.position.y = torsoLen + 0.19 * s;
  torso.add(head);
  if (child) head.scale.setScalar(1.12); // children's heads are bigger for their bodies
  head.add(part(G.sph, skin, 0.1 * s, 0.12 * s, 0.105 * s));
  head.add(part(G.sph, skin, 0.022 * s, 0.03 * s, 0.02 * s, 0, -0.01 * s, 0.1 * s)); // nose
  // a face: ears, eyes that blink, brows, lips. Only drawn up close (see village update)
  const face = new THREE.Group(); head.add(face);
  for (const sd of [-1, 1]) face.add(part(G.sph, skin, 0.016 * s, 0.03 * s, 0.012 * s, sd * 0.099 * s, -0.005 * s, 0));
  const eyes = new THREE.Group(); face.add(eyes);
  const white = mat("#efe6d8", { roughness: 0.4 }), iris = mat("#1c120c", { roughness: 0.25 });
  for (const sd of [-1, 1]) {
    eyes.add(part(G.sph, white, 0.02 * s, 0.011 * s, 0.006 * s, sd * 0.037 * s, 0.014 * s, 0.093 * s));
    eyes.add(part(G.sph, iris, 0.011 * s, 0.01 * s, 0.005 * s, sd * 0.036 * s, 0.014 * s, 0.098 * s));
    const brow = part(G.box, hairM, 0.032 * s, 0.006 * s, 0.008 * s, sd * 0.037 * s, 0.036 * s, 0.096 * s);
    brow.rotation.z = -sd * 0.12;
    face.add(brow);
  }
  face.add(part(G.sph, mat(female ? "#8a2a3a" : "#6a3a30", { roughness: 0.5 }), 0.026 * s, 0.007 * s, 0.008 * s, 0, -0.05 * s, 0.094 * s)); // lips
  const elderHair = kind === "elder" ? mat("#d8d4cc") : hairM;
  if (female) {
    head.add(part(G.half, hairM, 0.107 * s, 0.11 * s, 0.11 * s, 0, 0.01 * s, -0.008 * s));
    if (Math.random() < 0.5 || child) {
      // a long choti down the back, tied off with a red paranda
      for (let i = 0; i < (child ? 4 : 7); i++) head.add(part(G.sph, hairM, (0.03 - i * 0.002) * s, 0.032 * s, 0.026 * s, 0, (-0.06 - i * 0.045) * s, (-0.1 - i * 0.006) * s));
      head.add(part(G.cone, mat("#c0101a", { emissive: "#300" }), 0.018 * s, 0.07 * s, 0.018 * s, 0, (-0.06 - (child ? 4 : 7) * 0.045) * s, -0.1 * s - (child ? 4 : 7) * 0.006 * s));
    } else head.add(part(G.sph, hairM, 0.05 * s, 0.05 * s, 0.05 * s, 0, -0.02 * s, -0.11 * s)); // bun
    // jhumka earrings, a nath for some, a necklace
    for (const sd of [-1, 1]) face.add(part(G.sph, gold, 0.011 * s, 0.016 * s, 0.011 * s, sd * 0.1 * s, -0.04 * s, 0.005 * s));
    if (!child && Math.random() < 0.3) flat(face, part(G.torus, gold, 0.014 * s, 0.014 * s, 0.2 * s, 0.018 * s, -0.028 * s, 0.103 * s)).rotation.y = 1.2;
    if (!child) { const nk = part(G.torus, gold, 0.075 * s, 0.075 * s, 0.12 * s, 0, torsoLen + 0.015 * s, 0.015 * s); nk.rotation.x = Math.PI / 2 - 0.35; torso.add(nk); }
    head.add(part(G.sph, mat("#c0101a", { emissive: "#400" }), 0.009 * s, 0.009 * s, 0.006 * s, 0, 0.04 * s, 0.1 * s)); // bindi
    if (!child && Math.random() < 0.55) {
      // pallu drawn over the head (ghoonghat)
      const veil = part(G.half, cloth, 0.13 * s, 0.14 * s, 0.13 * s, 0, 0.005 * s, -0.02 * s);
      veil.rotation.x = -0.25;
      head.add(veil);
    }
    if (!child) { // pallu across the chest
      const pallu = part(G.box, cloth, 0.08 * s, torsoLen * 1.05, 0.03 * s, 0.04 * s, torsoLen / 2, 0.13 * s);
      pallu.rotation.z = 0.5;
      torso.add(pallu);
    }
  } else if (kind === "elder" || (kind === "man" && Math.random() < 0.35)) {
    const pagdi = mat(pick(["#e8892a", "#f2f0e8", "#c0302a", "#f2b705"]));
    head.add(part(G.sph, pagdi, 0.12 * s, 0.075 * s, 0.12 * s, 0, 0.06 * s, 0));
    flat(head, part(G.torus, pagdi, 0.1 * s, 0.1 * s, 0.25 * s, 0, 0.04 * s, 0));
    head.add(part(G.sph, elderHair, 0.06 * s, 0.026 * s, 0.03 * s, 0, -0.035 * s, 0.088 * s)); // moustache
  } else {
    head.add(part(G.half, elderHair, 0.104 * s, 0.07 * s, 0.108 * s, 0, 0.03 * s, -0.005 * s));
    if (kind === "priest") head.add(part(G.box, mat("#e8892a", { emissive: "#401000" }), 0.012 * s, 0.03 * s, 0.006 * s, 0, 0.055 * s, 0.1 * s)); // tilak
    if (kind === "elder" || (!child && Math.random() < 0.55)) head.add(part(G.sph, kind === "elder" ? elderHair : hairM, 0.055 * s, 0.022 * s, 0.028 * s, 0, -0.033 * s, 0.09 * s)); // moustache
  }
  // round spectacles on some of the old folk
  if (kind === "elder" && Math.random() < 0.5) for (const sd of [-1, 1]) { const g2 = part(G.torus, mat("#3a2a1a", { metalness: 0.5 }), 0.022 * s, 0.022 * s, 0.1 * s, sd * 0.037 * s, 0.014 * s, 0.104 * s); face.add(g2); }
  // a sleeveless bandi over the kurta on some men; a placket of buttons on the rest
  if (!female && !child && kind !== "priest") {
    if (Math.random() < 0.35) torso.add(part(G.cyl, mat(pick(["#3a2a4a", "#5a3a1a", "#1f3a3a", "#7a5a2a"])), 0.178 * s, torsoLen * 0.88, 0.138 * s, 0, torsoLen * 0.47, 0));
    else torso.add(part(G.box, mat("#f6f0e4"), 0.018 * s, torsoLen * 0.45, 0.01 * s, 0, torsoLen * 0.72, 0.132 * s));
  }

  // arms
  const armLen = 0.62 * s;
  const arms = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.2 * s, torsoLen - 0.02 * s, 0);
    torso.add(pivot);
    const elbow = new THREE.Group();
    pivot.add(part(G.cyl, female ? skin : cloth, 0.045 * s, armLen * 0.5, 0.045 * s, 0, -armLen * 0.25, 0));
    elbow.position.y = -armLen * 0.5;
    pivot.add(elbow);
    elbow.add(part(G.cyl, skin, 0.038 * s, armLen * 0.5, 0.038 * s, 0, -armLen * 0.25, 0));
    elbow.add(part(G.sph, skin, 0.045 * s, 0.05 * s, 0.035 * s, 0, -armLen * 0.52, 0));
    if (female) flat(elbow, part(G.torus, mat(pick(["#c0101a", "#2e7d32", "#d9a53a"]), { metalness: 0.4 }), 0.045 * s, 0.045 * s, 0.4 * s, 0, -armLen * 0.4, 0)); // bangles
    return { pivot, elbow };
  });

  // what they carry
  let item = null, hand = new THREE.Object3D();
  arms[1].elbow.add(hand);
  hand.position.y = -armLen * 0.55;
  const carry = opts.carry;
  if (carry === "thali") {
    item = new THREE.Group();
    item.add(part(G.disc, gold, 0.17 * s, 0.012, 0.17 * s));
    item.add(part(G.sph, mat("#ff7a10"), 0.03, 0.03, 0.03, 0.06, 0.02, 0.03)); // flowers
    item.add(part(G.sph, mat("#c0101a"), 0.02, 0.012, 0.02, -0.05, 0.012, 0.05)); // kumkum
    item.add(part(G.sph, mat("#f2b705"), 0.025, 0.025, 0.025, -0.04, 0.02, -0.06)); // ladoo
    item.position.set(0, torsoLen - 0.3 * s, 0.34 * s);
    torso.add(item);
  } else if (carry === "box") {
    item = part(G.box, mat(pick(["#c8306a", "#d9a53a", "#2a7a6a", "#7a2aa0"])), 0.26 * s, 0.09 * s, 0.18 * s, 0, torsoLen - 0.32 * s, 0.32 * s);
    torso.add(item);
    item.add(part(G.box, gold, 1.02, 1.05, 0.14));
  } else if (carry === "sparkler") {
    item = part(G.cyl, mat("#5a5a60", { metalness: 0.6 }), 0.004, 0.4, 0.004, 0, -0.2, 0);
    item.rotation.x = 0;
    hand.add(item);
  } else if (carry === "lathi") {
    item = part(G.cyl, mat("#5a3a1a"), 0.015, 1.5 * s, 0.015, 0, 0.1, 0.05);
    hand.add(item);
  } else if (carry === "dhol") {
    item = new THREE.Group();
    const shell = part(G.cyl, mat("#8a3a1a"), 0.19 * s, 0.55 * s, 0.19 * s);
    shell.rotation.z = Math.PI / 2;
    item.add(shell);
    for (const sd of [-1, 1]) { const head = part(G.disc, mat("#e8dcc0"), 0.2 * s, 0.01, 0.2 * s, sd * 0.28 * s, 0, 0); head.rotation.z = Math.PI / 2; item.add(head); }
    const strap = part(G.torus, mat("#c0101a"), 0.2 * s, 0.2 * s, 0.3 * s, 0, 0, 0);
    item.add(strap);
    item.position.set(0, torsoLen * 0.25, 0.26 * s);
    torso.add(item);
  } else if (carry === "basket") {
    item = part(G.half, mat("#9a7a40"), 0.2 * s, 0.1 * s, 0.2 * s, 0, 0.12 * s, 0);
    item.rotation.x = Math.PI;
    head.add(item);
  }

  const tipWorld = new THREE.Vector3();
  const person = {
    group: root, kind, height: H, carry, item, head, torso, body, arms, legs,
    pose: opts.pose || "stand",
    phase: Math.random() * 10,
    speed: 0,
    lampId: null,
    // world position of the sparkler tip or thali centre (for flames/sparks)
    tip() {
      if (!item) return null;
      if (carry === "sparkler") { item.updateWorldMatrix(true, false); return tipWorld.set(0, -0.5, 0).applyMatrix4(item.matrixWorld); }
      item.updateWorldMatrix(true, false);
      return tipWorld.set(0, 0.03, 0).applyMatrix4(item.matrixWorld);
    },
    cheer: 0,
    eyes, face, skirt, blinkAt: Math.random() * 4,
    update(dt, t) {
      // blink every few seconds
      if (this.face.visible) {
        this.blinkAt -= dt;
        this.eyes.scale.y = this.blinkAt < 0.12 && this.blinkAt > 0 ? 0.15 : 1;
        if (this.blinkAt <= 0) this.blinkAt = 2.5 + Math.random() * 4;
      }
      if (this.cheer > 0) this.cheer -= dt;
      const p = this.cheer > 0 ? "cheer" : this.pose;
      this.phase += dt * (p === "walk" ? (child ? 9 : 7) * Math.max(0.6, this.speed) : 1);
      const ph = this.phase;
      let la = 0, ra = 0, le = 0, re = 0, l0 = 0, l1 = 0, bob = 0, lean = 0;
      this.arms[0].pivot.rotation.z = 0; this.arms[1].pivot.rotation.z = 0;
      if (p === "walk") {
        const sw = Math.sin(ph);
        l0 = sw * 0.5; l1 = -sw * 0.5;
        la = -sw * 0.45; ra = sw * 0.45; le = -0.2; re = -0.2;
        bob = Math.abs(Math.cos(ph)) * 0.03 * s;
      } else if (p === "namaste") {
        la = ra = -0.6; le = re = -1.6;
        this.arms[0].pivot.rotation.z = -0.35; this.arms[1].pivot.rotation.z = 0.35;
      } else if (p === "sitnamaste") {
        l0 = l1 = -1.5;
        bob = -legLen + 0.12;
        la = ra = -0.6; le = re = -1.6;
        this.arms[0].pivot.rotation.z = -0.35; this.arms[1].pivot.rotation.z = 0.35;
      } else if (p === "sit") {
        l0 = l1 = -1.5;
        bob = -legLen + 0.12;
        le = re = -0.9; la = ra = -0.3;
      } else if (p === "squat") {
        l0 = l1 = -1.2; bob = -legLen * 0.55; lean = 0.6;
        ra = -1.0 + Math.sin(t * 2) * 0.2; re = -0.3; la = -0.3; le = -0.6;
      } else if (p === "aarti") {
        la = -0.5; le = -1.2;
        ra = -1.0 + Math.sin(t * 2.4) * 0.35; re = -0.8 + Math.cos(t * 2.4) * 0.35;
      } else if (p === "stir") {
        ra = -0.9 + Math.sin(t * 3) * 0.2; re = -0.6; la = -0.6; le = -0.9; lean = 0.15;
      } else if (p === "cheer") {
        // both arms up, bouncing on the spot
        const b = t * 9 + ph;
        la = -2.8 + Math.sin(b) * 0.25; ra = -2.8 - Math.sin(b) * 0.25; le = re = -0.3;
        bob = Math.abs(Math.sin(b)) * 0.12 * s;
        l0 = l1 = -Math.abs(Math.sin(b)) * 0.3;
      } else if (p === "dance") {
        // bhangra-style: arms up, shoulders bouncing, knees lifting on the beat
        const beat = t * 4.6 + ph;
        la = -2.7 + Math.sin(beat) * 0.25; ra = -2.7 + Math.sin(beat + Math.PI) * 0.25;
        le = -0.3 + Math.sin(beat * 2) * 0.2; re = -0.3 - Math.sin(beat * 2) * 0.2;
        l0 = Math.max(0, Math.sin(beat)) * -0.7; l1 = Math.max(0, -Math.sin(beat)) * -0.7;
        bob = Math.abs(Math.sin(beat)) * 0.07 * s;
      } else if (p === "drum") {
        const beat = t * 4.6;
        la = -0.9 + Math.max(0, Math.sin(beat)) * 0.5; ra = -0.9 + Math.max(0, Math.sin(beat * 2 + 1)) * 0.5;
        le = re = -0.9;
        bob = Math.abs(Math.sin(beat)) * 0.02 * s;
      } else if (p === "wave") {
        ra = -2.6; re = -0.4 + Math.sin(t * 6) * 0.3;
      } else if (p === "talk") {
        // talking with the hands: one forearm lifts and turns over as the words come, the other hangs easy
        const w = t * 2.6 + ph;
        ra = -0.55 + Math.sin(w) * 0.22; re = -1.15 + Math.sin(w * 1.7) * 0.3;
        la = -0.15 + Math.max(0, Math.sin(w * 0.5)) * -0.35; le = -0.5;
        this.arms[1].pivot.rotation.z = 0.12;
        lean = 0.03 + Math.sin(w * 0.5) * 0.02;
      } else {
        la = ra = Math.sin(t * 0.8 + ph) * 0.03;
      }
      if (carry === "thali" || carry === "box") { la = ra = -0.75; le = re = -1.0; this.arms[0].pivot.rotation.z = -0.15; this.arms[1].pivot.rotation.z = 0.15; }
      if (carry === "sparkler") { ra = p === "walk" ? -1.0 : -1.3 + Math.sin(t * 3 + ph) * 0.5; re = -0.5 + Math.cos(t * 4 + ph) * 0.3; }
      this.legs[0].rotation.x = l0; this.legs[1].rotation.x = l1;
      this.arms[0].pivot.rotation.x = la; this.arms[1].pivot.rotation.x = ra;
      this.arms[0].elbow.rotation.x = le; this.arms[1].elbow.rotation.x = re;
      this.body.position.y = bob + (p === "walk" ? 0 : Math.sin(t * 1.7 + ph) * 0.003 * s); // breathing
      if (this.skirt) {
        // the saree settles into a lap when she sits, and bunches when she squats
        const sk = this.skirt;
        sk.userData.border.visible = p !== "sit" && p !== "sitnamaste" && p !== "squat";
        if (p === "sit" || p === "sitnamaste") { sk.scale.set(0.36 * s, 0.2 * s, 0.42 * s); sk.position.set(0, hipY - 0.07 * s, 0.1 * s); }
        else if (p === "squat") { sk.scale.set(0.32 * s, 0.5 * s, 0.34 * s); sk.position.set(0, hipY - 0.28 * s, 0.04 * s); }
        else { sk.scale.set(0.3 * s, legLen + 0.04, 0.3 * s); sk.position.set(0, legLen / 2 - 0.01, 0); }
      }
      this.torso.rotation.x = lean;
      // the head drifts idly, or turns toward whoever is passing (headYaw is set by the scene)
      const idle = Math.sin(t * 0.4 + ph) * 0.15 + (p === "talk" || p === "listen" ? Math.sin(t * 1.9 + ph) * 0.06 : 0);
      this.head.rotation.y += ((this.headYaw ?? idle) - this.head.rotation.y) * Math.min(1, dt * 4 + 0.02);
      if (p === "listen") this.head.rotation.z = Math.sin(t * 2.2 + ph) * 0.05; // nodding along
      else this.head.rotation.z *= 0.9;
      // watching the sky: head tipped back toward the fireworks
      this.head.rotation.x += ((this.lookUp ? -0.55 : 0) - this.head.rotation.x) * Math.min(1, dt * 3 + 0.02);
    },
  };
  person.update(0, 0);
  return person;
}

function rand(a, b) { return a + Math.random() * (b - a); }

// Walks a person along a loop of [x, z] points.
export class Walker {
  constructor(person, points, { speed = 1.1, loop = true, pause = 0, pose = "walk" } = {}) {
    this.poseName = pose;
    this.p = person;
    this.pts = points.map(([x, z]) => new THREE.Vector3(x, 0, z));
    this.speed = person.kind === "child" || person.kind === "girl" ? speed * 1.15 : speed;
    this.seg = 0;
    this.u = Math.random();
    this.loop = loop;
    this.dir = 1;
    this.pauseAt = pause;
    this.wait = 0;
    person.pose = pose;
    person.speed = this.speed;
  }
  update(dt) {
    if (this.wait > 0) { this.wait -= dt; this.p.pose = "stand"; return; }
    this.p.pose = this.poseName;
    const n = this.pts.length;
    const a = this.pts[this.seg], b = this.pts[(this.seg + 1) % n];
    const len = a.distanceTo(b) || 1;
    this.u += (this.speed * dt) / len;
    if (this.u >= 1) {
      this.u = 0;
      this.seg = (this.seg + 1) % (this.loop ? n : n - 1);
      if (!this.loop && this.seg === 0) this.pts.reverse();
      if (this.pauseAt && Math.random() < 0.35) this.wait = this.pauseAt * rand(0.5, 1.5);
    }
    const g = this.p.group;
    g.position.lerpVectors(a, b, this.u);
    const yaw = Math.atan2(b.x - a.x, b.z - a.z);
    let d = yaw - g.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    g.rotation.y += d * Math.min(1, dt * 6);
  }
}
