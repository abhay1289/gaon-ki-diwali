// Gaon ki Diwali: boot the renderer, build the village, run the tour.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { Lamps, reveal } from "./lights.js";
import { Sparks, SkyText } from "./fx.js";
import { buildVillage } from "./village.js";
import { TourCamera, KEYS } from "./tour.js";
import { SkyLanterns, Fireflies } from "./playful.js";
import { Music, TRACKS } from "./music.js";
import { paintRangoli, RANGOLI_STYLES, RANGOLI_PALETTES } from "./textures.js";
import { Guide, HI as HI_LINES } from "./guide.js";
import { guideClip } from "./voice.js";
import { makePerson } from "./people.js";
// a small element helper used by the dialogs and games
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

// what the village remembers about you, in this browser only: your name, where you were,
// which stops you have seen, the hidden diyas you lit and the crackers still in your bag
const ME0 = () => ({ name: "", surname: "", fam: { maa: "", papa: "", dadi: "", sib: "" }, region: "north", rg: { style: "padma", palette: "sindoor" }, kandil: "#ff7a20",
  lang: "both", text: "normal", calm: false, visits: 0, lastStop: 0, seen: [], hunt: [], bag: {}, tips: false, myLit: [], daysSeen: [],
  batua: 2100, shops: {}, stats: { aarti: 0, crackers: 0, lanterns: 0, names: 0, homes: 0 } });
const me = (() => { const base = ME0(); try { const saved = JSON.parse(localStorage.getItem("gaon-me") || "{}"); return { ...base, ...saved, fam: { ...base.fam, ...saved.fam }, rg: { ...base.rg, ...saved.rg }, stats: { ...base.stats, ...saved.stats } }; } catch (_) { return base; } })();
function remember() {
  try {
    if (typeof diarySnapshot === "function" && me.year) (me.diary ||= {})[me.year] = diarySnapshot();
    localStorage.setItem("gaon-me", JSON.stringify(me));
  } catch (_) { /* private mode: nothing persists */ }
}
const ji = () => (me.name ? `${me.name} ji` : "");

const Deepa = window.Deepa;
const sound = Deepa.sound;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const mobile = matchMedia("(pointer: coarse)").matches || innerWidth < 760;
const quality = { dpr: Math.min(devicePixelRatio, mobile ? 1.5 : 2), lights: mobile ? 8 : 14, reflect: mobile ? 256 : 512, shadows: !mobile };

const STOPS = [
  { id: "gali", key: 0, hi: "गाँव की गली", en: "The village lane",
    text: "Amavasya, the darkest night of Kartik. There is no moon tonight, so every light you see here was lit by hand: diyas on doorsteps and windowsills, kandils in the eaves, children with phuljhadi.",
    action: "Light an anar" },
  { id: "kuan", key: 2, hi: "कुआँ", en: "The village well",
    text: "The well gets its own ring of diyas tonight. Water is life in a village, so it is thanked like a guest: lamps on the rim, lamps on the pulley frame, a toran on the crossbar.",
    action: "Draw water" },
  { id: "gaushala", key: 5, hi: "गौशाला", en: "The cowshed",
    text: "The cows are bathed, their horns painted and tipped with brass, a jhool on their backs and marigolds at the neck. In front lies Govardhan, shaped from cow dung for tomorrow's puja, ringed with lamps.",
    action: "Ring the cow bells" },
  { id: "mehmaan", key: 9, hi: "मेहमान", en: "Neighbours come visiting",
    text: "All evening people go from house to house with sweet boxes. Here the neighbours have come in: the aunties sit on the charpai, chai and ladoos go round, and the children show off their new clothes.",
    action: "Offer the sweets" },
  { id: "rasoi", key: 13, hi: "रसोई", en: "The verandah kitchen",
    text: "Under the thatched chhappar the chulha has been burning since afternoon. Puris puff up in the kadhai, ladoos wait on a brass plate, and every visitor leaves with something sweet.",
    action: "Fry a puri", action2: "Fry them yourself" },
  { id: "aangan", key: 15, hi: "आँगन", en: "The courtyard",
    text: "The aangan was freshly plastered with cow dung this morning. The women of the house drew the rangoli in the afternoon, and Lakshmi's footprints lead from it to the door. The first diya of the evening goes to the tulsi.",
    action: "Light the tulsi diya", action2: "Design the rangoli" },
  { id: "puja", key: 19, hi: "पूजा घर", en: "Lakshmi Puja at home",
    text: "Inside, the family sits before Lakshmi and Ganesha on a red-draped chowki. The akhand diya will burn all night, coins and a new bahi-khata wait to be blessed. Begin the aarti: first for Ganesh ji, then for Lakshmi ji.",
    action: "Begin the aarti", action2: "Do the aarti yourself" },
  { id: "kumhar", key: 24, hi: "कुम्हार का आँगन", en: "The potter's yard",
    text: "For weeks the kumhar has thrown diyas on the wheel, dried them in the sun and fired them in the kiln. Tonight nearly every lamp in the village came out of this yard.",
    action: "Spin the wheel" },
  { id: "mela", key: 26, hi: "मेला", en: "The village fair",
    text: "Past the painted arch the fair is in full swing: a hand-cranked giant wheel strung with bulbs, a merry-go-round of wooden horses, the dhol-wala and a ring of dancers, gol gappe and pink buddhi ke baal.",
    action: "Ride the giant wheel", action2: "Shoot the balloons" },
  { id: "haat", key: 29, hi: "चौपाल का हाट", en: "The haat under the banyan",
    text: "Under the old banyan, the elders sit on the chabutra while a small festival haat runs around them: murtis, bangles, crackers, diyas, toys, rangoli colours, and the halwai frying jalebi in his kadhai.",
    action: "Set off a chakri" },
  { id: "taash", key: 31, hi: "ताश", en: "The Diwali card game",
    text: "A game of taash on Diwali night is an old custom, said to bring luck for the year. The men sit on a dari under the hiss of a petromax, chai going cold, while the children try to see everyone's cards.",
    action: "Deal a hand", action2: "Play a hand" },
  { id: "mandir", key: 33, hi: "गाँव का मंदिर", en: "The village temple",
    text: "Lakshmi Puja. The pujari waves the aarti lamp, the bell rings and the conch sounds. Families stand with folded hands, then carry a flame from the temple home.",
    action: "Ring the bell" },
  { id: "pokhar", key: 35, hi: "पोखर", en: "The pond",
    text: "At the ghat, diyas are set afloat on leaf boats for the ancestors and for the water itself. The pond doubles every lamp.",
    action: "Float a diya" },
  { id: "bazaar", key: 39, hi: "बाज़ार", en: "The market street",
    text: "The brick road through the bazaar is the busiest place in the village tonight. Shutters are rolled up under tubelights: kirana, bartan, saris, sweets, crackers, flowers and lights. Families shop for the puja, and a cow takes her time down the middle.",
    action: "Buy something" },
  { id: "chhat", key: KEYS.length - 1, hi: "छत से", en: "From the rooftop",
    text: "From the roof you can see the whole village, and past the fields the neighbouring villages answering with their own lamps and fireworks. Shubh Deepavali.",
    action: "Grand finale", action2: "Write your name in the sky" },
];

/* ---------- renderer, scene, camera ---------- */
const canvas = document.querySelector("[data-scene]");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", stencil: false });
renderer.setPixelRatio(quality.dpr);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.55;
renderer.outputColorSpace = THREE.SRGBColorSpace;
if (quality.shadows) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
}

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x14111c, 0.011);
const camera = new THREE.PerspectiveCamera(innerWidth < innerHeight ? 72 : 58, innerWidth / innerHeight, 0.08, 600);
camera.position.set(...KEYS[0].p);

// starlight and the faint haze of a thousand lamps
const hemi = new THREE.HemisphereLight(0x3a4278, 0x3a2614, 1.9);
scene.add(hemi);
const skyFill = new THREE.DirectionalLight(0x7080c0, 0.45);
skyFill.position.set(-30, 50, 20);
scene.add(skyFill);

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(400, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uDawn: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vDir; uniform float uTime; uniform float uDawn;
      float hash(vec3 p){ p = fract(p*0.3183099+0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      float noise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 zen = vec3(0.008,0.01,0.03), hor = vec3(0.075,0.05,0.07);
        vec3 col = mix(hor, zen, pow(clamp(h,0.0,1.0),0.4));
        col += vec3(0.22,0.1,0.04) * pow(1.0-abs(h), 14.0) * 0.6;
        // brahma muhurat: violet overhead, a warm glow rising in the east (+x)
        vec3 dz = vec3(0.07, 0.09, 0.2), dh = mix(vec3(0.28, 0.24, 0.38), vec3(0.95, 0.5, 0.28), smoothstep(-0.3, 1.0, d.x) * (1.0 - smoothstep(0.0, 0.5, h)));
        col = mix(col, mix(dh, dz, pow(clamp(h, 0.0, 1.0), 0.5)), uDawn);
        // stars, thinning toward the smoky horizon
        vec3 p = d * 260.0; vec3 c = floor(p);
        float r = hash(c);
        float s = smoothstep(0.9975, 1.0, r) * smoothstep(0.42, 0.0, length(fract(p)-0.5));
        s *= 0.6 + 0.4*sin(uTime*2.0 + r*80.0);
        // faint milky way band
        float band = exp(-pow(dot(d, normalize(vec3(0.35,0.4,0.85)))/0.22, 2.0));
        float mw = band * (0.5*noise(d*9.0) + 0.3*noise(d*23.0));
        float above = smoothstep(0.02, 0.2, h);
        col += (vec3(s)*1.4 + vec3(0.06,0.06,0.08)*mw) * above * (1.0 - uDawn * 0.92);
        gl_FragColor = vec4(col, 1.0);
      }`,
  })
);
scene.add(sky);

/* ---------- post ---------- */
const composer = new EffectComposer(renderer);
composer.setPixelRatio(quality.dpr);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.75, 0.35, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());
// film look: warm highlights, cool lifted shadows, lens fringing, vignette, grain
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uFlash: { value: new THREE.Vector3() }, uAspect: { value: innerWidth / innerHeight } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime; uniform vec3 uFlash; uniform float uAspect;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5;
      float r2 = dot(c * vec2(uAspect, 1.0), c * vec2(uAspect, 1.0));
      vec2 off = c * 0.0009 * (0.3 + r2 * 2.0);
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, col * vec3(1.06, 0.98, 0.88), smoothstep(0.25, 0.9, l));   // warm highlights
      col += vec3(0.006, 0.010, 0.026) * (1.0 - smoothstep(0.0, 0.25, l));       // cool lifted blacks
      col = mix(vec3(l), col, 1.08);                                               // a touch more saturation
      col += uFlash * 0.04 * (1.0 - r2);                                           // sky flash wash
      float vig = smoothstep(1.05, 0.25, r2 * 1.6);
      col *= mix(0.82, 1.0, vig);
      float g = hash(vUv * vec2(1920.0, 1080.0) + fract(uTime * 7.0) * 100.0) - 0.5;
      col += g * 0.014 * (1.0 - l * 0.6);
      gl_FragColor = vec4(col, 1.0);
    }`,
});
composer.addPass(grade);
bloom.setSize(Math.floor(innerWidth * quality.dpr), Math.floor(innerHeight * quality.dpr));

/* ---------- build ---------- */
const ui = {
  loader: document.querySelector("[data-loader]"),
  bar: document.querySelector("[data-loader-bar]"),
  status: document.querySelector("[data-loader-status]"),
  enter: [...document.querySelectorAll("[data-enter]")],
  panel: document.querySelector("[data-panel]"),
  num: document.querySelector("[data-stop-num]"),
  hi: document.querySelector("[data-stop-hi]"),
  en: document.querySelector("[data-stop-en]"),
  text: document.querySelector("[data-stop-text]"),
  action: document.querySelector("[data-action]"),
  action2: document.querySelector("[data-action2]"),
  rgDialog: document.querySelector("[data-rangoli-dialog]"),
  wishDialog: document.querySelector("[data-wish-dialog]"),
  nameDialog: document.querySelector("[data-name-dialog]"),
  nameInput: document.querySelector("[data-name-input]"),
  cardBtn: document.querySelector("[data-card]"),
  prev: document.querySelector("[data-prev]"),
  next: document.querySelector("[data-next]"),
  free: document.querySelector("[data-free]"),
  places: document.querySelector("[data-places]"),
  placesList: document.querySelector("[data-places-list]"),
  placesBtn: document.querySelector("[data-places-open]"),
  hint: document.querySelector("[data-hint]"),
  pad: document.querySelector("[data-pad]"),
  toast: document.querySelector("[data-toast]"),
  title: document.querySelector("[data-title]"),
  letterbox: document.querySelector("[data-letterbox]"),
  caption: document.querySelector("[data-caption]"),
  hud: document.querySelector("[data-hud]"),
  huntCount: document.querySelector("[data-hunt-count]"),
  huntTotal: document.querySelector("[data-hunt-total]"),
  lantern: document.querySelector("[data-lantern]"),
  photo: document.querySelector("[data-photo]"),
  dawn: document.querySelector("[data-dawn]"),
  bubble: document.querySelector("[data-bubble]"),
  map: document.querySelector("[data-minimap]"),
  mapCanvas: document.querySelector("[data-minimap-canvas]"),
  mapToggle: document.querySelector("[data-minimap-toggle]"),
  shutter: document.querySelector("[data-shutter]"),
};
const progress = (v, msg) => { ui.bar.style.transform = `scaleX(${v})`; if (msg) ui.status.textContent = msg; };
const frame = () => new Promise((resolve) => {
  let done = false;
  const finish = () => { if (!done) { done = true; resolve(); } };
  requestAnimationFrame(() => setTimeout(finish, 0));
  setTimeout(finish, 40);
});

const lamps = new Lamps();
const sparks = new Sparks(scene, mobile ? 7000 : 16000);
const lanterns = new SkyLanterns(scene);
const skyText = new SkyText(scene, sparks.uniforms, sparks);
const fireflies = new Fireflies(scene, mobile ? 70 : 130);
let village, tour;

async function build() {
  sound.warm("fireworks");
  sound.warm("crackers");
  progress(0.1, "Plastering the walls");
  // shop signs are hand-lettered on canvas. The files are local, so this usually resolves immediately
  // and never holds the village up for more than a moment.
  const signFonts = ["700 40px Kalam", "40px 'Tiro Devanagari Hindi'"];
  if (!signFonts.every((f) => document.fonts.check(f))) {
    await Promise.race([
      Promise.all(signFonts.map((f) => document.fonts.load(f))).catch(() => {}),
      new Promise((r) => setTimeout(r, 600)),
    ]);
  }
  await frame();
  village = buildVillage(scene, { lamps, sparks, quality });
  progress(0.6, "Filling the diyas with oil");
  await frame();
  lamps.build(scene, { lightCount: quality.lights, shadows: quality.shadows ? 1 : 0 });
  if (quality.shadows) {
    scene.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o === sky) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m || m.transparent || m.isShaderMaterial || m.isMeshBasicMaterial) return;
      let cast = o.geometry.type !== "PlaneGeometry";
      if (cast) {
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
        const r = o.geometry.boundingSphere.radius * Math.max(o.scale.x, o.scale.y, o.scale.z);
        cast = r > 0.45;
      }
      o.castShadow = cast;
      o.receiveShadow = true;
    });
  }
  progress(0.8, "Lighting the lamps");
  await frame();
  tour = new TourCamera(camera, canvas, village.colliders, reduceMotion);
  tour.onTap = onTap;
  village.train.onHorn = () => sound.horn(0.5);
  // house plinths sit 22 cm up; the temple platform and its steps, and the shop floors, carry their own height
  tour.floorAt = (x, z) => { let y = 0; for (const f of village.floors || []) if (x > f.minX && x < f.maxX && z > f.minZ && z < f.maxZ) y = Math.max(y, f.y ?? 0.22); return y; };
  ui.huntTotal.textContent = village.hunt.length;
  tour.update(0);
  progress(1, "The village is ready");
  ui.enter.forEach((b) => (b.disabled = false));
  if (!reduceMotion) startBackdrop();
  gateSound();
  // compile after the gate can be used, so shader warmup does not hold the buttons
  requestAnimationFrame(() => {
    try { renderer.compile(scene, camera); composer.render(); } catch (err) { console.error(err); }
  });
}

// The fireworks behind the welcome screen should be heard straight away. Browsers only allow sound after
// the visitor's first touch, so: switch it on now (some browsers already allow it), and if it is still
// held back, a small note asks for a tap, and the first touch anywhere wakes it.
function gateSound() {
  if (!sound.on) { sound.toggle(); sound.bed("fireworks", 0.18); sound.bed("crackers", 0.12); }
  const note = document.querySelector("[data-gate-sound]");
  const wake = () => {
    if (!document.body.classList.contains("at-gate") || !sound.on) return;
    sound.unlock().then(() => { note.hidden = true; }).catch(() => {});
  };
  ["pointerdown", "keydown", "touchstart"].forEach((ev) => addEventListener(ev, wake, { once: true, capture: true }));
  setTimeout(() => { if (sound.state() !== "running" && document.body.classList.contains("at-gate")) note.hidden = false; }, 600);
}

// Behind the welcome screen the drone flight plays on a loop, the same flight as the opening: past the
// temple, over the pond and the giant wheel, across the rooftops and down into the lane, every lamp lit.
// Pressing Enter carries on from wherever the flight is.
let hovering = false, backdropTime = 0;
function startBackdrop() {
  hovering = true;
  reveal.value.set(0, 10, 1e5, 12);
  const DUR = SHOTS[SHOTS.length - 1].t, LOOP = DUR + 2.5;
  let c0 = performance.now(), cue = 0, dipped = false;
  tour.ride = (dt, cam) => {
    let tb = (performance.now() - c0) / 1000;
    // a dip to black as the loop comes round, so the restart is a cut, not a jump
    if (tb > LOOP - 0.45 && !dipped) { dipped = true; ui.shutter.classList.remove("is-on", "is-dip"); void ui.shutter.offsetWidth; ui.shutter.classList.add("is-dip"); }
    if (tb >= LOOP) { c0 = performance.now(); tb = 0; cue = 0; dipped = false; }
    backdropTime = tb;
    flightPose(Math.min(DUR, tb), tb, cam);
    while (cue < CUES.length && tb >= CUES[cue].t) CUES[cue++].fn();
  };
}
// the flight's camera at time tt along the shots; shared by the welcome loop and the opening
let flightCurves = null;
const flightLook = new THREE.Vector3();
function flightPose(tt, wobbleT, cam) {
  if (!flightCurves) flightCurves = {
    pos: new THREE.CatmullRomCurve3(SHOTS.map((k) => new THREE.Vector3(...k.p)), false, "centripetal"),
    aim: new THREE.CatmullRomCurve3(SHOTS.map((k) => new THREE.Vector3(...k.l)), false, "centripetal"),
  };
  const n = SHOTS.length, ease = (k) => k * k * (3 - 2 * k);
  let i = 0;
  while (i < n - 2 && tt > SHOTS[i + 1].t) i++;
  const a = SHOTS[i], b = SHOTS[i + 1];
  const s2 = (tt - a.t) / (b.t - a.t);
  // slow in at the very start, settle at the very end, steady in between
  const u = (i + (i === 0 ? ease(s2) * 0.5 + s2 * 0.5 : i === n - 2 ? 1 - (1 - s2) * (1 - s2) : s2)) / (n - 1);
  flightCurves.pos.getPoint(u, cam.position);
  flightCurves.aim.getPoint(u, flightLook);
  cam.lookAt(flightLook);
  const k = ease(s2);
  cam.rotateZ(a.roll + (b.roll - a.roll) * k);
  cam.rotateX(Math.sin(wobbleT * 0.7) * 0.004); // a slight drone drift so it never feels on rails
  cam.fov = a.fov + (b.fov - a.fov) * k;
  cam.updateProjectionMatrix();
}
const UP_AXIS = new THREE.Vector3(0, 1, 0);

/* ---------- stops, actions ---------- */
let current = 0;
function stopAt(s) {
  let best = -1, bd = 0.6;
  STOPS.forEach((st, i) => { const d = Math.abs(st.key - s); if (d < bd) { bd = d; best = i; } });
  return best;
}
// the spoken guide: off, Hindi or English, from the ⋯ menu; the songs dip while it speaks
let speaking = false;
const guide = new Guide({ onSpeak: (on) => (speaking = on), recorded: (lang, key) => guideClip(lang, key) });
const guideBtn = document.querySelector("[data-guide]"), guideLabel = document.querySelector("[data-guide-label]");
function paintGuide() {
  guideBtn.setAttribute("aria-pressed", String(guide.mode !== "off"));
  guideLabel.textContent = { off: "Voice guide: off", hi: "Voice guide: हिन्दी", en: "Voice guide: English" }[guide.mode];
}
guideBtn.hidden = false; // Dadi's recordings work even where the browser has no voices
paintGuide();
guideBtn.addEventListener("click", () => {
  const m = guide.cycle();
  paintGuide();
  toast(m === "off" ? "Voice guide off" : m === "hi" ? "दादी आपको गाँव घुमाएँगी" : "The guide will speak at every stop");
  if (m !== "off" && !ui.panel.classList.contains("is-walking")) guide.say(STOPS[current]);
});
function showStop(i) {
  const st = STOPS[i];
  buddyAtStop(i);
  guide.say(day.texts[st.id] ? { ...st, text: day.texts[st.id], id: `${day.id}:${st.id}` } : st);
  me.lastStop = i;
  if (!me.seen.includes(st.id)) me.seen.push(st.id);
  remember();
  markSeen();
  ui.num.textContent = `${i + 1} / ${STOPS.length}`;
  ui.hi.textContent = st.hi;
  ui.en.textContent = st.en;
  ui.text.textContent = me.lang === "hi" ? (HI_LINES[`${day.id}:${st.id}`] || HI_LINES[st.id] || stopText(st)) : stopText(st);
  if (me.lang === "hi") { ui.en.textContent = st.hi; ui.hi.textContent = st.en; }
  ui.text.classList.remove("is-open");
  ui.action.textContent = st.action;
  ui.action.hidden = false;
  ui.action2.hidden = !st.action2;
  if (st.action2) ui.action2.textContent = st.action2;
  ui.prev.disabled = i === 0;
  ui.next.textContent = i === STOPS.length - 1 ? "Walk again" : "Next";
  ui.placesList.querySelectorAll("button").forEach((b, k) => b.setAttribute("aria-current", k === i ? "true" : "false"));
  ui.panel.classList.remove("is-walking");
  ui.panel.classList.remove("is-arrive"); void ui.panel.offsetWidth; ui.panel.classList.add("is-arrive");
}
function goStop(i) {
  if (aarti) endAarti(false);
  guide.stop();
  if (tour.ride) { tour.ride = null; village.giantWheel.speed = 0.22; tour.s = STOPS[current].key; }
  current = (i + STOPS.length) % STOPS.length;
  if (tour.mode === "free") toggleFree(false);
  tour.goTo(STOPS[current].key);
  ui.panel.classList.add("is-walking");
  ui.en.textContent = `Walking to ${STOPS[current].en.toLowerCase()}`;
  ui.hi.textContent = STOPS[current].hi;
  ui.action.hidden = true;
  ui.action2.hidden = true;
  history.replaceState(null, "", `#${STOPS[current].id}`);
}

let found = 0;
function lightHunt(h) {
  h.lit = true;
  h.t = 0.001;
  found++;
  ui.huntCount.textContent = found;
  ui.hud.classList.remove("is-pop"); void ui.hud.offsetWidth; ui.hud.classList.add("is-pop");
  sound.strike();
  setTimeout(() => sound.bell(0.4, 880 + found * 40), 200);
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * 6.28, m = 1 + Math.random() * 2;
    sparks.spawn(h.x, h.y + 0.1, h.z, Math.cos(a) * m, 1.5 + Math.random() * 2.5, Math.sin(a) * m, [1, 0.8, 0.4], 0.6 + Math.random() * 0.5, 0.4, 0.95, 0.6, 0.06, 1.5);
  }
  const hi2 = village.hunt.indexOf(h);
  if (!me.hunt.includes(hi2)) { me.hunt.push(hi2); remember(); }
  if (found === village.hunt.length) {
    toast("Every hidden diya is lit. Shubh Deepavali!");
    finale();
    for (let i = 0; i < 8; i++) setTimeout(() => releaseLantern(), i * 400);
  } else toast(`You lit a hidden diya \u00b7 ${found} of ${village.hunt.length}`);
}
let placed = 0, spotTurn = 0;
function placeDiya(x, y, z) {
  const d = village.userDiyas.find((q) => !q.used) || village.userDiyas[placed % village.userDiyas.length];
  d.used = true; d.t = 0.001;
  lamps.move(d.id, x, y + 0.01, z);
  lamps.setPower(d.id, 0);
  const si = village.userSpots[spotTurn++ % village.userSpots.length];
  lamps.spots[si].pos.set(x, y + 0.7, z);
  lamps.spots[si].on = 1;
  placed++;
  sound.strike();
  for (let i = 0; i < 16; i++) sparks.spawn(x, y + 0.08, z, (Math.random() - 0.5) * 1.5, 1 + Math.random() * 1.5, (Math.random() - 0.5) * 1.5, [1, 0.8, 0.45], 0.4, 0.35, 0.95, 0.6, 0.05, 1.4);
  if (placed === 1) toast("You set down a diya. Tap the ground to place more");
  else if (placed % 10 === 0) toast(`${placed} diyas of your own, glowing in the village`);
}
function releaseLantern(label) {
  stat("lanterns");
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  fwd.y = 0; fwd.normalize();
  lanterns.release(camera.position.clone().addScaledVector(fwd, 2.2 + Math.random()).add(new THREE.Vector3(Math.random() - 0.5, -0.3, Math.random() - 0.5)), label);
}

function toast(msg) {
  ui.toast.textContent = msg;
  ui.toast.classList.add("is-on");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => ui.toast.classList.remove("is-on"), 2600);
}

/* ---------- the five days of Diwali ---------- */
const DAYS = [
  { id: "dhanteras", n: 1, hi: "धनतेरस", en: "Dhanteras", when: "The thirteenth day of Kartik", time: "night", stop: "aangan", yaw: -0.3,
    blurb: "Everyone buys something new in metal for luck, a thali, a lota, a silver coin, and lights the Yam deepak at the door.",
    texts: {
      aangan: "Dhanteras. The family is home from the market with a new steel thali, a brass lota and a silver coin, laid out on a red cloth to be blessed. At the main door a four-wicked Yam deepak faces south, lit for the long life of everyone in the house.",
      bazaar: "On Dhanteras the bartan shop has a queue out of the door. Something new in steel, brass or silver has to come home today, even if it is only a spoon.",
    } },
  { id: "choti", n: 2, hi: "छोटी दिवाली", en: "Choti Diwali", when: "Roop Chaudas, the day before", time: "dawn", stop: "aangan", yaw: -0.45,
    blurb: "An ubtan bath before sunrise, a fresh rangoli on the floor and fourteen diyas on the wall.",
    texts: {
      aangan: "Choti Diwali, Roop Chaudas. Before sunrise everyone is rubbed with ubtan of besan and haldi and bathed. Now the women draw a fresh rangoli, and fourteen diyas wait on the courtyard wall, one for each of the fourteen worlds.",
    } },
  { id: "lakshmi", n: 3, hi: "लक्ष्मी पूजा", en: "Lakshmi Puja", when: "Amavasya, the big night", time: "night", stop: "gali",
    blurb: "The darkest night of the year, every lamp in the village lit, the aarti at home and fireworks till midnight.", texts: {} },
  { id: "govardhan", n: 4, hi: "गोवर्धन पूजा", en: "Govardhan Puja", when: "The morning after", time: "dawn", stop: "gaushala",
    blurb: "A Govardhan shaped from cow dung, women circling it with thalis, the cows worshipped and an annakoot of food.",
    texts: {
      gaushala: "Govardhan Puja. Krishna lifted the Govardhan hill to shelter the village from Indra's rain, so today the hill is shaped from cow dung in front of the cowshed. The women walk round it with their thalis, and the annakoot, a mountain of rice and dishes, is offered.",
    } },
  { id: "bhaidooj", n: 5, hi: "भाई दूज", en: "Bhai Dooj", when: "The fifth and last day", time: "dawn", stop: "aangan", yaw: -0.4,
    blurb: "Sisters do their brothers' tilak and aarti and pray for them; brothers bring a gift.",
    texts: {
      aangan: "Bhai Dooj. The brother sits on a patla while his sister puts roli and chawal on his forehead, waves the aarti and feeds him a sweet. She prays for his long life; he has brought her a gift wrapped in pink paper.",
    } },
];
let day = DAYS.find((d) => d.id === me.day) || DAYS[2];
let isMorning = false;
const stopText = (st) => {
  if (isMorning && st.id === "gali") return "The morning after. The lane is littered with red paper from last night's crackers, a few diyas are still burning low, the children are combing the ground for crackers that didn't go off, and the chaiwala has the first kettle on.";
  const t = day.texts[st.id] || st.text;
  // a line about how the visitor's own region keeps this night
  return st.id === "puja" && day.id === "lakshmi" && region().note ? `${t} ${region().note}` : t;
};
function setDay(id, { travel = true } = {}) {
  const d = DAYS.find((x) => x.id === id);
  if (!d) return;
  day = d; me.day = d.id;
  village.setMorning?.(false); isMorning = false;
  if (!me.daysSeen.includes(d.id)) me.daysSeen.push(d.id);
  if (travel) me.dayChosenOn = todayKey;
  remember();
  village.setDay(d.id);
  setDawn(d.time === "dawn", true);
  paintDays();
  if (!travel) return;
  // dip to black and arrive where the day is happening
  ui.shutter.classList.remove("is-on", "is-dip"); void ui.shutter.offsetWidth; ui.shutter.classList.add("is-dip");
  const target = STOPS.findIndex((st) => st.id === d.stop);
  setTimeout(() => {
    if (tour.mode === "free") toggleFree(false);
    current = target; tour.s = tour.target = STOPS[target].key;
    // turn a little toward where the day's scene is happening
    tour.yawOff = d.yaw || 0; tour.pitchOff = d.yaw ? -0.1 : 0;
    showStop(target);
    ui.caption.innerHTML = "";
    const b = document.createElement("span"); b.lang = "hi"; b.textContent = `${d.hi} · दिन ${d.n}`;
    const sm = document.createElement("small"); sm.textContent = `${d.en}: ${d.when}`;
    ui.caption.append(b, sm); ui.caption.classList.add("is-on");
    setTimeout(() => ui.caption.classList.remove("is-on"), 4500);
  }, 450);
}
const daysDialog = document.querySelector("[data-days]"), daysList = document.querySelector("[data-days-list]");
DAYS.forEach((d) => {
  const li = document.createElement("li"), b = document.createElement("button");
  b.type = "button"; b.dataset.day = d.id;
  b.innerHTML = `<span class="num"></span><span><b lang="hi"></b><em></em><small></small></span>`;
  b.querySelector(".num").textContent = d.n;
  b.querySelector("b").textContent = d.hi;
  b.querySelector("em").textContent = `${d.en} · ${d.when}`;
  b.querySelector("small").textContent = d.blurb;
  b.addEventListener("click", () => { daysDialog.close(); setDay(d.id); });
  li.appendChild(b); daysList.appendChild(li);
});
function paintDays() {
  daysList.querySelectorAll("button").forEach((b) => b.setAttribute("aria-current", String(b.dataset.day === day.id)));
  document.querySelectorAll("[data-day-label]").forEach((el) => (el.textContent = `${day.hi} · ${day.en}`));
}
document.querySelectorAll("[data-days-open]").forEach((b) => b.addEventListener("click", () => { ui.places.open && ui.places.close(); paintDays(); daysDialog.showModal(); }));
document.querySelector("[data-days-close]").addEventListener("click", () => daysDialog.close());
daysDialog.addEventListener("click", (e) => { if (e.target === daysDialog) daysDialog.close(); });

/* ---------- make it yours: region, family, your house, comfort ---------- */
// the greeting and a few customs change with where the visitor's family celebrates
const REGIONS = {
  north: { greet: "शुभ दीपावली", en: "Shubh Deepavali", note: "" },
  bengal: { greet: "শুভ দীপাবলি", en: "Shubho Dipaboli",
    note: "In Bengal, tonight is also Kali Puja: Ma Kali is worshipped at midnight, and last night fourteen lamps, the choddo prodip, were lit for the ancestors." },
  maharashtra: { greet: "शुभ दिवाळी", en: "Shubh Diwali",
    note: "In Maharashtra the faral is ready, chakli, karanji, shankarpali and anarsa, the children have built a clay killa with little soldiers, and an akash kandil hangs at every door." },
  gujarat: { greet: "શુભ દીપાવલી", en: "Shubh Deepavali",
    note: "In Gujarat the account books, the chopda, are worshipped tonight, and tomorrow is Bestu Varas, the New Year, when everyone says Saal Mubarak." },
  south: { greet: "இனிய தீபாவளி", en: "Iniya Deepavali",
    note: "In the South the big morning is Naraka Chaturdashi: an oil bath before dawn, new clothes, sweets, and crackers as the sun comes up." },
};
const region = () => REGIONS[me.region] || REGIONS.north;
const greet = () => region().greet;
const REL = { maa: ["माँ", "Maa"], papa: ["पापा", "Papa"], dadi: ["दादी", "Dadi"], didi: ["दीदी", "Didi"], behen: ["बहन", "your sister"], bhai: ["भाई", "your brother"], chachi: ["चाची", "Chachi"] };
// the puja family and the Bhai Dooj siblings take the names the visitor gives
function applyFamily() {
  const f = village.family || {};
  const sib = me.fam.sib;
  const set = (p, rel, name) => { if (p) p.title = name ? { rel, name } : null; };
  set(f.maa, "maa", me.fam.maa); set(f.papa, "papa", me.fam.papa); set(f.dadi, "dadi", me.fam.dadi);
  set(f.didi, "didi", sib); set(f.behen, "behen", sib); set(f.bhai, "bhai", me.name);
}
function familyLine(p) {
  const you = me.name || "बेटा", youEn = me.name || "dear";
  return {
    maa: [`${you}, आरती का समय हो गया!`, `It's time for the aarti, ${youEn}!`],
    papa: [`आ गए ${me.name || ""}! मिठाई लाए?`, `There you are! Did you bring the sweets?`],
    dadi: [`जीते रहो ${you}, शुभ दीपावली`, `Bless you, ${youEn}. Shubh Deepavali`],
    didi: [`${me.name || "भैया"}, फुलझड़ी जलाएँ?`, `Shall we light phuljhadis?`],
    behen: [`टीका लगवा लो, ${me.name || "भैया"}!`, `Come, let me do your tilak!`],
    bhai: [`दीदी, तुम्हारा तोहफ़ा!`, `Here's your gift, didi!`],
  }[p.title.rel] || [greet(), region().en];
}
// your own house: nameplate, rangoli at the door, your kandil, and the diyas you lit there
function applyHouse() {
  const h = village.myHouse;
  if (!h) return;
  h.setName(me.surname);
  h.setRangoli(me.surname || me.rg.set ? { style: me.rg.style, palette: me.rg.palette, petals: 12, rings: 3 } : null);
  h.setKandil(me.kandil);
  h.home.name = me.surname ? `${me.surname} निवास · your house` : "A village home";
  myHouseBtn.hidden = !me.surname;
  myHouseBtn.querySelector("span").textContent = `${me.surname} निवास`;
}
function applyComfort() {
  document.body.classList.toggle("text-large", me.text === "large");
  document.body.classList.toggle("lang-hi", me.lang === "hi");
  document.body.classList.toggle("lang-en", me.lang === "en");
}
const yoursUI = { dialog: document.querySelector("[data-yours]"), form: document.querySelector("[data-yours-form]"), swatches: document.querySelector("[data-kandil]") };
const myHouseBtn = document.createElement("button");
myHouseBtn.type = "button"; myHouseBtn.className = "places__day"; myHouseBtn.hidden = true;
myHouseBtn.innerHTML = "<span></span><em>Go to your house</em>";
myHouseBtn.addEventListener("click", () => { ui.places.close(); if (village.myHouse) stepInside(village.myHouse.home); });
document.querySelector(".places__day")?.after(myHouseBtn);
{
  const st = document.querySelector("[data-my-rg-styles]"), pl = document.querySelector("[data-my-rg-palettes]");
  for (const [k, v] of Object.entries(RANGOLI_STYLES)) st.add(new Option(v.name, k));
  for (const [k, v] of Object.entries(RANGOLI_PALETTES)) pl.add(new Option(v.name, k));
  const label = document.createElement("span"); label.textContent = "Kandil:"; yoursUI.swatches.appendChild(label);
  for (const [hex, name] of [["#ff7a20", "Saffron"], ["#d8203a", "Red"], ["#40a0ff", "Sky blue"], ["#ffc030", "Gold"], ["#8a3ad8", "Purple"], ["#30c080", "Green"]]) {
    const b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "radio"); b.setAttribute("aria-label", name); b.style.setProperty("--sw", hex); b.dataset.hex = hex;
    b.addEventListener("click", () => yoursUI.swatches.querySelectorAll("button").forEach((o) => o.setAttribute("aria-checked", String(o === b))));
    yoursUI.swatches.appendChild(b);
  }
}
function openYours() {
  const f = yoursUI.form.elements;
  f.name.value = document.querySelector("[data-me-name]")?.value || me.name; f.surname.value = me.surname;
  f.maa.value = me.fam.maa; f.papa.value = me.fam.papa; f.dadi.value = me.fam.dadi; f.sib.value = me.fam.sib;
  f.region.value = me.region; f.rgStyle.value = me.rg.style; f.rgPalette.value = me.rg.palette;
  f.lang.value = me.lang; f.text.value = me.text; f.calm.checked = me.calm;
  yoursUI.swatches.querySelectorAll("button").forEach((o) => o.setAttribute("aria-checked", String(o.dataset.hex === me.kandil)));
  yoursUI.dialog.showModal();
}
const clean = (v, n = 22) => String(v || "").replace(/[^\p{L}\p{M}\p{N} .&'-]/gu, "").trim().slice(0, n);
yoursUI.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const f = yoursUI.form.elements;
  me.name = clean(f.name.value); me.surname = clean(f.surname.value, 18);
  me.fam = { maa: clean(f.maa.value, 16), papa: clean(f.papa.value, 16), dadi: clean(f.dadi.value, 16), sib: clean(f.sib.value, 16) };
  me.region = REGIONS[f.region.value] ? f.region.value : "north";
  me.rg = { style: f.rgStyle.value, palette: f.rgPalette.value, set: true };
  me.kandil = yoursUI.swatches.querySelector("[aria-checked=true]")?.dataset.hex || me.kandil;
  me.lang = f.lang.value; me.text = f.text.value; me.calm = f.calm.checked;
  remember();
  yoursUI.dialog.close();
  const nameField = document.querySelector("[data-me-name]"); if (nameField) nameField.value = me.name;
  applyComfort();
  guide.name = me.name;
  if (village) { applyFamily(); applyHouse(); }
  if (document.querySelector("[data-loader]")) return; // still on the welcome screen
  showStop(current);
  toast(me.surname ? `${me.surname} निवास is ready in the lane · find it in Places` : `${greet()}, ${me.name || "friend"}`);
});
document.querySelectorAll("[data-yours-open]").forEach((b) => b.addEventListener("click", () => { document.querySelector("[data-menu]")?.setAttribute("hidden", ""); openYours(); }));
document.querySelectorAll("[data-yours-close]").forEach((b) => b.addEventListener("click", () => yoursUI.dialog.close()));
applyComfort();

/* ---------- invite someone by name ---------- */
// the link carries their name and yours; opening it welcomes them and writes their name in the sky
const inviteUI = { dialog: document.querySelector("[data-invite]"), form: document.querySelector("[data-invite-form]") };
let invite = null;
{
  const q = new URLSearchParams(location.search);
  const to = clean(q.get("for")), from = clean(q.get("from"));
  if (to) invite = { to, from };
  // a mithai box: ?gift= carries the names, the sweets, the box colour and a short message
  const g = q.get("gift");
  if (g) {
    try {
      const d = JSON.parse(decodeURIComponent(escape(atob(g.replace(/-/g, "+").replace(/_/g, "/")))));
      const t2 = clean(d.t), f2 = clean(d.f);
      if (t2) invite = { to: t2, from: f2, giftRaw: d }; // checked once the sweets are defined, below
    } catch (_) { /* a broken link: just open the village */ }
  }
  // the inviter's photo travels in the fragment (never sent to any server), small and compressed
  if (to && location.hash.startsWith("#p=")) {
    const b64 = location.hash.slice(3).replace(/-/g, "+").replace(/_/g, "/");
    if (/^[A-Za-z0-9+/]+=*$/.test(b64) && b64.length < 120000) invite.photo = `data:image/jpeg;base64,${b64}`;
  }
  if (q.has("for") || q.has("from") || q.has("gift")) history.replaceState(null, "", location.pathname + (location.hash.startsWith("#p=") ? "" : location.hash)); // not carried on if they share onwards
}
document.querySelector("[data-invite-open]").addEventListener("click", () => { inviteUI.form.reset(); resetInvitePhoto(); inviteUI.dialog.showModal(); });
document.querySelectorAll("[data-invite-close]").forEach((b) => b.addEventListener("click", () => inviteUI.dialog.close()));
let invitePhoto = null; // { img, small }
const pickInput = document.querySelector("[data-invite-photo]"), thumb = document.querySelector("[data-invite-thumb]"), clearPhoto = document.querySelector("[data-invite-photo-clear]");
pickInput.addEventListener("change", async () => {
  const file = pickInput.files && pickInput.files[0];
  if (!file || !file.type.startsWith("image/")) return;
  const img = new Image();
  img.src = URL.createObjectURL(file);
  try { await img.decode(); } catch (_) { toast("That photo couldn't be opened"); return; }
  // a small square copy for the link: 240 px, cropped to the middle
  const c = document.createElement("canvas"); c.width = c.height = 240;
  const s2 = Math.min(img.naturalWidth, img.naturalHeight);
  c.getContext("2d").drawImage(img, (img.naturalWidth - s2) / 2, (img.naturalHeight - s2) / 2, s2, s2, 0, 0, 240, 240);
  invitePhoto = { img, small: c.toDataURL("image/jpeg", 0.6) };
  thumb.style.backgroundImage = `url(${invitePhoto.small})`; thumb.textContent = "";
  clearPhoto.hidden = false;
});
clearPhoto.addEventListener("click", () => { invitePhoto = null; pickInput.value = ""; thumb.style.backgroundImage = ""; thumb.textContent = "+"; clearPhoto.hidden = true; });
function resetInvitePhoto() { clearPhoto.click(); }
// letters drawn as glowing sparks, like the fireworks writing in the sky
function fireText(x, text, cx, cy, size, rgb) {
  const W = Math.ceil(size * Math.max(4, text.length * 0.75)), H = Math.ceil(size * 1.6);
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const t = c.getContext("2d");
  t.font = `${size}px 'Tiro Devanagari Hindi', serif`; t.textAlign = "center"; t.textBaseline = "middle"; t.fillStyle = "#fff";
  t.fillText(text, W / 2, H / 2, W - 10);
  const d = t.getImageData(0, 0, W, H).data, step = Math.max(3, Math.round(size / 22));
  x.save(); x.globalCompositeOperation = "lighter";
  for (let yy = 0; yy < H; yy += step) for (let xx = 0; xx < W; xx += step) {
    if (d[(yy * W + xx) * 4 + 3] < 120) continue;
    const px = cx - W / 2 + xx + (Math.random() - 0.5), py = cy - H / 2 + yy + (Math.random() - 0.5), r = step * (0.9 + Math.random() * 0.5);
    const g = x.createRadialGradient(px, py, 0, px, py, r * 1.8);
    g.addColorStop(0, `rgba(255,255,255,.95)`); g.addColorStop(0.35, `rgba(${rgb},.8)`); g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g; x.fillRect(px - r * 2, py - r * 2, r * 4, r * 4);
  }
  for (let i = 0; i < 140; i++) { const a = Math.random() * 6.28, rr = size * (0.3 + Math.random() * 1.4); x.fillStyle = `rgba(${rgb},${Math.random() * 0.7})`; x.fillRect(cx + Math.cos(a) * rr * 2.2, cy + Math.sin(a) * rr, 2, 2); }
  x.restore();
}
// the invite card: their photo as the cover, the greeting and their name written in fire, a row of diyas
function inviteCard(to, from) {
  const W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d");
  const bg = x.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#1a0d14"); bg.addColorStop(1, "#08040a"); x.fillStyle = bg; x.fillRect(0, 0, W, H);
  const coverH = invitePhoto ? 760 : 520;
  if (invitePhoto) {
    const img = invitePhoto.img, s2 = Math.max(W / img.naturalWidth, coverH / img.naturalHeight);
    x.drawImage(img, (W - img.naturalWidth * s2) / 2, (coverH - img.naturalHeight * s2) / 2, img.naturalWidth * s2, img.naturalHeight * s2);
  } else {
    // no photo: the village at night from the current view
    const v = renderer.domElement, s2 = Math.max(W / v.width, coverH / v.height);
    x.drawImage(v, (W - v.width * s2) / 2, (coverH - v.height * s2) / 2, v.width * s2, v.height * s2);
  }
  const fade = x.createLinearGradient(0, coverH - 260, 0, coverH + 40); fade.addColorStop(0, "rgba(26,13,20,0)"); fade.addColorStop(1, "#1a0d14"); x.fillStyle = fade; x.fillRect(0, coverH - 260, W, 300);
  fireText(x, greet(), W / 2, coverH + 40, 110, "255,190,90");
  fireText(x, to, W / 2, coverH + 190, 120, "255,140,190");
  x.textAlign = "center"; x.fillStyle = "rgba(255,240,215,.92)"; x.font = "italic 40px 'Cormorant Garamond', serif";
  x.fillText(from ? `${from} invites you to Diwali in the village` : "You're invited to Diwali in the village", W / 2, coverH + 320);
  x.fillStyle = "rgba(255,240,215,.6)"; x.font = "28px 'Manrope', sans-serif";
  x.fillText("Open the link to walk in", W / 2, coverH + 370);
  for (let i = 0; i < 9; i++) { const dx = 140 + i * 100; x.fillStyle = "#8a4a2a"; x.beginPath(); x.ellipse(dx, H - 46, 22, 9, 0, 0, Math.PI); x.fill(); x.fillStyle = "#ffc050"; x.shadowColor = "#ff9a30"; x.shadowBlur = 16; x.beginPath(); x.ellipse(dx, H - 60, 6, 13, 0, 0, Math.PI * 2); x.fill(); x.shadowBlur = 0; }
  return c.toDataURL("image/jpeg", 0.9);
}
inviteUI.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const to = clean(inviteUI.form.elements.to.value);
  inviteUI.dialog.close();
  if (!to) return;
  const q = new URLSearchParams({ for: to });
  const from = me.name || me.surname;
  if (from) q.set("from", from);
  const frag = invitePhoto ? "#p=" + invitePhoto.small.split(",")[1].replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : "";
  const url = `${location.origin}${location.pathname}?${q}${frag}`;
  const text = `${to}, ${greet()}! Come and see Diwali in our village.`;
  stat("invites");
  const card = inviteCard(to, from);
  // phones: share the card and the link together; elsewhere: show the card to save, with the link to copy
  try {
    const file = new File([await (await fetch(card)).blob()], `diwali-invite-${to}.jpg`, { type: "image/jpeg" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: `${text}\n${url}` }); return; }
  } catch (_) { /* fall through to the card sheet */ }
  shot = { url: card, recap: true, invite: true, name: to };
  photoUI.preview.src = card;
  document.querySelector("[data-photo-frames]").hidden = true;
  document.querySelector("#photo-title").textContent = `Invite card for ${to}`;
  const row = document.querySelector("[data-photo-linkrow]");
  row.hidden = false; row.querySelector("input").value = url;
  photoUI.share.hidden = true;
  photoUI.dialog.showModal();
});
document.querySelector("[data-photo-linkcopy]").addEventListener("click", async () => {
  const input = document.querySelector("[data-photo-linkurl]");
  try { await navigator.clipboard.writeText(input.value); toast("Invite link copied. Send it with the card"); }
  catch (_) { input.select(); toast("Select the link and copy it"); }
});

/* ---------- send a mithai box ---------- */
const SWEETS = [
  ["काजू कतली", "Kaju katli", "#e8e2d0", "diamond"], ["मोतीचूर लड्डू", "Motichoor ladoo", "#f2a020", ""], ["जलेबी", "Jalebi", "#ff9a10", ""],
  ["गुलाब जामुन", "Gulab jamun", "#7a2a12", ""], ["सोन पापड़ी", "Soan papdi", "#f2dca0", "diamond"], ["बर्फी", "Barfi", "#f6efe2", "diamond"],
  ["रसगुल्ला", "Rasgulla", "#fbf8f0", ""], ["पेड़ा", "Peda", "#c8964a", ""],
];
const GIFT_COLOURS = ["#c2185b", "#d9a53a", "#2e7d32", "#1a4a8a"];
const giftUI = { dialog: document.querySelector("[data-gift]"), form: document.querySelector("[data-gift-form]"), sweets: document.querySelector("[data-gift-sweets]"), colours: document.querySelector("[data-gift-colours]") };
SWEETS.forEach(([hi, en], i) => {
  const b = el("button"); b.type = "button"; b.dataset.i = i; b.setAttribute("aria-pressed", "false");
  const bh = el("b", null, hi); bh.lang = "hi"; b.append(bh, en);
  b.onclick = () => {
    const on = b.getAttribute("aria-pressed") !== "true";
    if (on && giftUI.sweets.querySelectorAll("[aria-pressed=true]").length >= 6) { toast("The box holds six kinds"); return; }
    b.setAttribute("aria-pressed", String(on));
  };
  giftUI.sweets.append(b);
});
GIFT_COLOURS.forEach((c, i) => {
  const b = el("button"); b.type = "button"; b.style.setProperty("--sw", c); b.dataset.i = i; b.setAttribute("aria-label", ["Pink", "Gold", "Green", "Blue"][i] + " box"); b.setAttribute("aria-pressed", String(i === 0));
  b.onclick = () => giftUI.colours.querySelectorAll("button").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
  giftUI.colours.append(b);
});
if (invite?.giftRaw) {
  const d = invite.giftRaw;
  invite.gift = { sweets: (Array.isArray(d.s) ? d.s : []).filter((i) => Number.isInteger(i) && SWEETS[i]).slice(0, 6), msg: String(d.m || "").replace(/[\u0000-\u001f<>]/g, "").slice(0, 90), colour: GIFT_COLOURS[d.c] ? d.c : 0 };
  if (!invite.gift.sweets.length) invite.gift.sweets = [0, 1, 2];
  delete invite.giftRaw;
}
function openGift() {
  giftUI.form.reset();
  giftUI.sweets.querySelectorAll("button").forEach((b, i) => b.setAttribute("aria-pressed", String(i < 3)));
  giftUI.dialog.showModal();
}
document.querySelectorAll("[data-gift-close]").forEach((b) => b.addEventListener("click", () => giftUI.dialog.close()));
giftUI.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const to = clean(giftUI.form.elements.to.value);
  if (!to) return;
  const sw = [...giftUI.sweets.querySelectorAll("[aria-pressed=true]")].map((b) => +b.dataset.i);
  if (!sw.length) { toast("Put at least one sweet in the box"); return; }
  giftUI.dialog.close();
  const data = { t: to, f: me.name || me.surname || "", s: sw, m: giftUI.form.elements.msg.value.slice(0, 90), c: +(giftUI.colours.querySelector("[aria-pressed=true]")?.dataset.i || 0) };
  const enc = btoa(unescape(encodeURIComponent(JSON.stringify(data)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const url = `${location.origin}${location.pathname}?gift=${enc}`;
  stat("gifts");
  const text = `${to}, ${greet()}! I've sent you a box of sweets. Open it in our village:`;
  if (navigator.share) { try { await navigator.share({ title: "A mithai box for you", text, url }); } catch (_) { /* cancelled */ } return; }
  try { await navigator.clipboard.writeText(url); toast(`Mithai box for ${to} packed. The link is copied`); } catch (_) { showLink(url); }
});
// opening it: a ribboned box to tap open, the sweets inside, and the message
function openMithaiBox(g, from) {
  const body = openGame(`${from ? from + " की तरफ़ से" : "आपके लिए"} · a box of sweets`, "Tap the box to open it");
  const box = el("div", "box"); box.style.setProperty("--bx", GIFT_COLOURS[g.colour]);
  const base = el("div", "box__base"), lid = el("div", "box__lid"), inside = el("div", "box__sweets");
  for (let k = 0; k < 9; k++) { const [, , col, shape] = SWEETS[g.sweets[k % g.sweets.length]]; const i2 = el("i", shape); i2.style.setProperty("--sc", col); inside.append(i2); }
  box.append(base, inside, lid);
  const hint = el("p", "box__hint", "खोलिए · Tap to open");
  body.append(box, hint);
  box.onclick = () => {
    if (box.classList.contains("is-open")) return;
    box.classList.add("is-open"); sound.coin(); setTimeout(() => sound.bell(0.4, 988), 300);
    gameUI.title.textContent = from ? `From ${from}, with love` : "With love";
    hint.remove();
    const list = el("p", "gift__list");
    g.sweets.forEach((i) => list.append(el("span", null, `${SWEETS[i][0]} · ${SWEETS[i][1]}`)));
    body.append(list);
    if (g.msg) body.append(el("p", "gift__msg", `“${g.msg}”`));
    const f = new THREE.Vector3(); camera.getWorldDirection(f);
    village.showerPetals(camera.position.clone().addScaledVector(f, 2.2).add(new THREE.Vector3(0, 1.4, 0)), 80);
    buddySay(["वाह! मिठाई! मुझे भी एक दोगे?", "Sweets! Will you give me one?"], 1500);
  };
}

/* ---------- my Diwali diary, year after year ---------- */
const thisYear = String(new Date().getFullYear());
function diarySnapshot() {
  return { last: todayKey, places: me.seen.length, hidden: me.hunt.length, homes: me.stats.homes || 0, aarti: me.stats.aarti || 0, sweets: me.stats.sweets || 0,
    crackers: me.stats.crackers || 0, lanterns: me.stats.lanterns || 0, taash: me.stats.taash || 0, puris: me.stats.puris || 0, rangoli: me.stats.rangoli || 0, floated: (me.remembered || []).slice(), days: (me.daysSeen || []).slice(), invites: me.stats.invites || 0, gifts: me.stats.gifts || 0 };
}
function openDiary() {
  const body = openGame("मेरी डायरी", me.name ? `${me.name}'s Diwali diary` : "Your Diwali diary");
  const years = Object.keys(me.diary || {}).sort().reverse();
  if (!years.length) { body.append(el("p", "game__msg", "Your diary starts tonight. Come back next Diwali and this year will be here.")); return; }
  for (const y of years) {
    const d = me.diary[y], card = el("div", "diary__year");
    card.append(el("h3", null, `Diwali ${y}`));
    const ul = el("ul");
    const li = (t) => ul.append(el("li", null, t));
    li(`${d.places} of ${STOPS.length} places in the village visited`);
    if (d.hidden) li(`${d.hidden} hidden diyas found`);
    if (d.homes) li(`${d.homes} ${d.homes === 1 ? "home" : "homes"} lit up, every diya`);
    if (d.aarti) li("did the Lakshmi aarti yourself");
    if (d.sweets) li(`${d.sweets} sweets shared with neighbours`);
    if (d.crackers) li(`${d.crackers} crackers lit`);
    if (d.lanterns) li(`${d.lanterns} sky ${d.lanterns === 1 ? "lantern" : "lanterns"} with your wishes`);
    if (d.floated?.length) li(`diyas floated for ${d.floated.join(", ")}`);
    if (d.taash) li("won a hand of taash");
    if (d.puris) li("fried golden puris");
    if (d.rangoli) li("drew a rangoli by hand");
    if (d.invites) li(`${d.invites} ${d.invites === 1 ? "person" : "people"} invited`);
    if (d.gifts) li(`${d.gifts} mithai ${d.gifts === 1 ? "box" : "boxes"} sent`);
    if (d.days?.length) li(`days celebrated: ${d.days.length} of 5`);
    card.append(ul);
    body.append(card);
  }
}

/* ---------- the morning after ---------- */
function morningAfter() {
  if (showing || tour.ride) return;
  ui.shutter.classList.remove("is-on", "is-dip"); void ui.shutter.offsetWidth; ui.shutter.classList.add("is-dip");
  setTimeout(() => {
    if (tour.mode === "free") toggleFree(false);
    current = 0; tour.s = tour.target = STOPS[0].key;
    setDawn(true, true);
    village.setMorning(true); isMorning = true;
    showStop(0);
    ui.caption.innerHTML = "";
    const b = el("span", null, "अगली सुबह"); b.lang = "hi";
    ui.caption.append(b, el("small", null, "The morning after: children hunt for crackers that didn't go off, and the first chai is on the stove"));
    ui.caption.classList.add("is-on");
    setTimeout(() => ui.caption.classList.remove("is-on"), 6000);
    buddySay(["सुबह हो गई! चलो, बिना फूटे पटाखे ढूँढें!", "It's morning! Let's find the crackers that didn't go off!"], 2500);
  }, 450);
}

/* ---------- the real calendar ---------- */
// dates by the common North Indian panchang; a day either side varies by city
const FEST = {
  "2026-11-06": "dhanteras", "2026-11-07": "choti", "2026-11-08": "lakshmi", "2026-11-09": "govardhan", "2026-11-10": "bhaidooj", "2026-11-11": "bhaidooj",
  "2027-10-27": "dhanteras", "2027-10-28": "choti", "2027-10-29": "lakshmi", "2027-10-30": "govardhan", "2027-10-31": "bhaidooj",
};
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayKey = ymd(new Date());
const todayFest = FEST[todayKey] || null;
{
  const line = document.querySelector("[data-countdown]");
  const next = Object.entries(FEST).find(([k, v]) => v === "lakshmi" && k >= todayKey);
  if (todayFest) {
    const d = DAYS.find((x) => x.id === todayFest);
    line.innerHTML = ""; const b = document.createElement("b"); b.textContent = `आज ${d.hi} है`; line.append(b, ` · Today is ${d.en}, and the village is celebrating it.`);
    line.hidden = false;
  } else if (next) {
    const days = Math.round((new Date(next[0] + "T00:00") - new Date(todayKey + "T00:00")) / 864e5);
    if (days <= 40) {
      line.innerHTML = ""; const b = document.createElement("b"); b.textContent = `${days} ${days === 1 ? "day" : "days"} to Diwali`;
      line.append(b, ` · Lakshmi Puja falls on ${new Date(next[0] + "T00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long" })}.`);
      line.hidden = false;
    }
  }
}

/* ---------- my Diwali: a card of everything this visitor did ---------- */
function stat(k, n = 1) { me.stats[k] = (me.stats[k] || 0) + n; remember(); }
let snapMode = "photo";
document.querySelector("[data-recap-open]").addEventListener("click", () => { document.querySelector("[data-menu]")?.setAttribute("hidden", ""); snapMode = "recap"; snapNext = true; });
function renderRecap() {
  const W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d");
  const bg = x.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#1c0f14"); bg.addColorStop(1, "#0c0608"); x.fillStyle = bg; x.fillRect(0, 0, W, H);
  // the view at the top, cropped to fill
  const img = shot.img, ih = 600, s = Math.max(W / img.width, ih / img.height);
  x.save(); x.beginPath(); x.rect(0, 0, W, ih); x.clip();
  x.drawImage(img, (W - img.width * s) / 2, (ih - img.height * s) / 2, img.width * s, img.height * s); x.restore();
  const fade = x.createLinearGradient(0, ih - 160, 0, ih); fade.addColorStop(0, "rgba(28,15,20,0)"); fade.addColorStop(1, "#1c0f14"); x.fillStyle = fade; x.fillRect(0, ih - 160, W, 160);
  x.textAlign = "center";
  x.fillStyle = "#ffd27a"; x.font = "64px 'Tiro Devanagari Hindi', serif";
  x.fillText(me.name ? `${me.name} की दिवाली` : "मेरी दिवाली", W / 2, ih + 40);
  x.fillStyle = "rgba(255,240,215,.85)"; x.font = "italic 34px 'Cormorant Garamond', serif";
  x.fillText(me.surname ? `with the ${me.surname} family, in the village` : "in the village, Gaon ki Diwali", W / 2, ih + 92);
  // what this visitor actually did; things not done yet are left off rather than shown as zero
  const rows = [
    [`${me.seen.length} of ${STOPS.length}`, "places in the village visited"],
    [`${me.hunt.length} of ${village.hunt.length}`, "hidden diyas found and lit"],
    me.stats.homes && [`${me.stats.homes}`, me.stats.homes === 1 ? "home lit up, every diya" : "homes lit up, every diya"],
    me.stats.aarti && ["✓", "did the Lakshmi aarti yourself"],
    me.stats.crackers && [`${me.stats.crackers}`, "crackers lit"],
    me.stats.lanterns && [`${me.stats.lanterns}`, me.stats.lanterns === 1 ? "sky lantern with your wish" : "sky lanterns with your wishes"],
    me.stats.names && ["✓", "your name written in fireworks"],
    me.remembered?.length && [`${me.remembered.length}`, me.remembered.length === 1 ? `diya floated for ${me.remembered[0]}` : "diyas floated for those you remember"],
    me.stats.sweets && [`${me.stats.sweets}`, me.stats.sweets === 1 ? "sweet shared with a neighbour" : "sweets shared with neighbours"],
    me.stats.taash && ["✓", "won at taash"],
    me.stats.puris && ["✓", "fried golden puris"],
    me.stats.rangoli && ["✓", "drew a rangoli by hand"],
    me.stats.blessings && [`${me.stats.blessings}`, me.stats.blessings === 1 ? "blessing from Dadi" : "blessings from Dadi"],
    me.stats.writing && ["✓", "wrote in the air with a phuljhadi"],
    me.surname && ["✓", `${me.surname} निवास, your house, decorated`],
    [`${Math.max(1, me.daysSeen.length)} of 5`, "days of Diwali celebrated"],
  ].filter(Boolean);
  let y = ih + 170 + (9 - rows.length) * 22;
  for (const [n, label] of rows) {
    x.textAlign = "right"; x.fillStyle = "#f4a62a"; x.font = "600 44px 'Manrope', sans-serif"; x.fillText(n, 360, y);
    x.textAlign = "left"; x.fillStyle = "rgba(255,240,215,.9)"; x.font = "34px 'Manrope', sans-serif"; x.fillText(label, 392, y);
    y += 62;
  }
  x.textAlign = "center"; x.fillStyle = "#ffd27a"; x.font = "56px 'Tiro Devanagari Hindi', serif"; x.shadowColor = "rgba(255,150,40,.8)"; x.shadowBlur = 20;
  x.fillText(greet(), W / 2, H - 70);
  x.shadowBlur = 0;
  // a row of little diyas along the bottom
  for (let i = 0; i < 9; i++) { const dx = 140 + i * 100; x.fillStyle = "#8a4a2a"; x.beginPath(); x.ellipse(dx, H - 26, 22, 9, 0, 0, Math.PI); x.fill(); x.fillStyle = "#ffc050"; x.beginPath(); x.ellipse(dx, H - 40, 6, 13, 0, 0, Math.PI * 2); x.fill(); }
  shot.url = c.toDataURL("image/jpeg", 0.92);
  photoUI.preview.src = shot.url;
}

/* ---------- Chhotu: a village boy who walks the village with you ---------- */
// He trots a step ahead of you, chatters about each place, cheers when you light a diya,
// tugs you on if you linger, and knows your name. Off and on from the menu.
const BUDDY_STOP = {
  gali: ["चलो {n}, पहले गली देखते हैं! हर घर पर दीये हैं!", "Come on, {e}! Every single house has diyas!"],
  kuan: ["कुएँ में ज़्यादा मत झाँकना, डर लगता है!", "Don't lean over the well too far, it's scary!"],
  gaushala: ["ये गौरी है, मेरी सबसे प्यारी गाय!", "That's Gauri, my favourite cow!"],
  mehmaan: ["मिठाई मिलेगी! मुझे लड्डू चाहिए!", "There'll be sweets! I want a ladoo!"],
  rasoi: ["अम्मा की पूरियाँ सबसे अच्छी हैं, तुम भी तलो!", "Amma's puris are the best. You fry some too!"],
  aangan: ["तुलसी पर पहला दीया तुम जलाओ!", "You light the first diya, at the tulsi!"],
  puja: ["श्श्श... आरती शुरू होने वाली है!", "Shh... the aarti's about to start!"],
  kumhar: ["ये सारे दीये काका ने खुद बनाए हैं!", "Kaka made every one of these diyas himself!"],
  mela: ["झूला! झूला! चलो ना बैठते हैं!", "The big wheel! Come on, let's ride it!"],
  haat: ["मोल-भाव करना, वरना महँगा पड़ेगा!", "Bargain, or you'll pay too much!"],
  taash: ["बड़े लोग ताश खेल रहे हैं, तुम भी एक बाज़ी खेलो!", "The grown-ups are playing cards. Play a hand!"],
  mandir: ["घंटी बजाओ, ज़ोर से!", "Ring the bell, really loud!"],
  pokhar: ["देखो, पानी में दीये तैर रहे हैं!", "Look, the diyas are floating on the water!"],
  bazaar: ["मुझे एक गुब्बारा दिला दो ना!", "Will you get me a balloon? Please?"],
  chhat: ["छत से सब दिखता है! अब आतिशबाज़ी!", "You can see everything from up here! Fireworks now!"],
};
const BUDDY_CHAT = [
  ["पता है, कल मैंने बीस फुलझड़ियाँ जलाईं!", "Guess what, I lit twenty phuljhadis yesterday!"],
  ["दादी कहती हैं आज रात लक्ष्मी जी आएँगी!", "Dadi says Lakshmi ji comes tonight!"],
  ["तुम्हारी फ़ेवरेट मिठाई कौन सी है? मेरी जलेबी!", "What's your favourite sweet? Mine's jalebi!"],
  ["मेरे पास एक सुतली बम है, पर अम्मा से मत कहना!", "I've got a sutli bomb, but don't tell Amma!"],
  ["तुम शहर से आए हो ना? वहाँ भी इतने दीये होते हैं?", "You're from the city, right? Are there this many diyas there?"],
];
const buddy = { p: null, pos: new THREE.Vector3(), vel: new THREE.Vector3(), met: false, idle: 0, lastStop: -1, hidden: true };
const bTarget = new THREE.Vector3(), bFwd = new THREE.Vector3(), bRight = new THREE.Vector3();
const youHi = () => me.name || "दोस्त", youEn = () => me.name || "friend";
function buddySay([hi, en], delay = 0) {
  if (!buddy.p || buddy.hidden || me.buddy === false) return;
  setTimeout(() => { if (!buddy.hidden) sayAs(buddy.p, [hi.replace("{n}", youHi()), en.replace("{e}", youEn())]); }, delay);
}
function buddyReact(kind) {
  if (Math.random() > 0.55) return;
  const L = {
    diya: [["वाह! एक और जलाओ!", "Wow! Light another!"], ["कितना सुंदर लग रहा है!", "That looks so pretty!"]],
    aarti: [["तुमने तो पंडित जी जैसी आरती की!", "You did the aarti just like pandit ji!"]],
    buy: [["अरे, मेरे लिए भी कुछ लिया?", "Hey, did you get anything for me?"]],
    cracker: [["भागो! भागो! फटने वाला है!", "Run! Run! It's going to go off!"]],
  }[kind];
  if (L) buddySay(L[(Math.random() * L.length) | 0], 600);
}
function updateBuddy(dt) {
  if (me.buddy === false || !village) { if (buddy.p) buddy.p.group.visible = false; buddy.hidden = true; return; }
  if (!buddy.p) {
    buddy.p = makePerson({ kind: "child", color: "#e8641a", lower: "#1f3a6a" });
    buddy.p.greeted = true; buddy.p.isBuddy = true;
    scene.add(buddy.p.group);
    village.people.push(buddy.p);
  }
  const p = buddy.p;
  // away during the opening flight, the fireworks show and the aerial shots
  const away = hovering || showing || document.body.classList.contains("is-intro") || document.body.classList.contains("at-gate");
  if (away) { p.group.visible = false; buddy.hidden = true; return; }
  // a step ahead of you and to the right, kept out of walls
  camera.getWorldDirection(bFwd); bFwd.y = 0; bFwd.normalize();
  bRight.set(-bFwd.z, 0, bFwd.x);
  bTarget.copy(camera.position).addScaledVector(bFwd, 2.7).addScaledVector(bRight, 1.05);
  bTarget.y = 1.6; tour.resolve(bTarget);
  const floor = tour.floorAt ? tour.floorAt(bTarget.x, bTarget.z) : 0;
  if (buddy.hidden || buddy.pos.distanceTo(bTarget) > 18) { buddy.pos.copy(bTarget); p.group.visible = true; buddy.hidden = false; }
  // trot after the target, a child's speed, easing in and out
  const dx = bTarget.x - buddy.pos.x, dz = bTarget.z - buddy.pos.z, dist = Math.hypot(dx, dz);
  const want = dist > 0.35 ? Math.min(2.6, dist * 1.6) : 0;
  const sp = Math.hypot(buddy.vel.x, buddy.vel.z);
  const ns = sp + (want - sp) * Math.min(1, dt * 4);
  if (dist > 0.01) buddy.vel.set((dx / dist) * ns, 0, (dz / dist) * ns); else buddy.vel.set(0, 0, 0);
  buddy.pos.addScaledVector(buddy.vel, dt);
  p.group.position.set(buddy.pos.x, floor, buddy.pos.z);
  let face;
  if (ns > 0.3) { if (p.pose !== "wave") p.pose = "walk"; p.speed = ns / 1.4; face = Math.atan2(buddy.vel.x, buddy.vel.z); }
  else { if (p.pose === "walk") p.pose = "stand"; toCam.subVectors(camera.position, p.group.position); face = Math.atan2(toCam.x, toCam.z); }
  let d = face - p.group.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
  p.group.rotation.y += d * Math.min(1, dt * 6);
  // first hello, then a line at each stop, and a tug if you linger
  if (!buddy.met) { buddy.met = true; buddySay(["नमस्ते {n}! मैं छोटू। चलो, तुम्हें अपना गाँव दिखाता हूँ!", "Hi {e}! I'm Chhotu. Come on, I'll show you my village!"], 2500); }
  buddy.idle = tour.moving || tour.mode === "free" || document.querySelector("dialog[open]") ? 0 : buddy.idle + dt;
  if (buddy.idle > 32 && current < STOPS.length - 1) {
    buddy.idle = 0;
    p.pose = "wave"; setTimeout(() => { if (p.pose === "wave") p.pose = "stand"; }, 2600);
    buddySay([`चलो ना, अब ${STOPS[current + 1].hi} चलें?`, `Come on, shall we go to ${STOPS[current + 1].en.toLowerCase()} now?`]);
  }
}
function buddyAtStop(i) {
  if (i === buddy.lastStop) return;
  buddy.lastStop = i;
  const line = BUDDY_STOP[STOPS[i].id];
  if (line && buddy.met) buddySay(line, speaking || guide.mode !== "off" ? 9000 : 2200); // after Dadi has spoken
}
const buddyBtn = document.querySelector("[data-buddy]");
function paintBuddy() { buddyBtn.setAttribute("aria-pressed", String(me.buddy !== false)); buddyBtn.querySelector("span:last-child").textContent = me.buddy !== false ? "Chhotu: with you" : "Chhotu: at home"; }
paintBuddy();
buddyBtn.addEventListener("click", () => {
  me.buddy = me.buddy === false; remember(); paintBuddy();
  toast(me.buddy ? "छोटू दौड़ता हुआ आ गया! · Chhotu comes running" : "Chhotu has gone home for dinner");
});

/* ---------- mini-games: taash, puris, sweets to share, a rangoli by hand ---------- */
const gameUI = { root: document.querySelector("[data-game]"), kicker: document.querySelector("[data-game-kicker]"), title: document.querySelector("[data-game-title]"), body: document.querySelector("[data-game-body]") };
let gameEnd = null;
function openGame(hi, en, wide = false) {
  gameUI.kicker.textContent = hi; gameUI.title.textContent = en;
  gameUI.body.innerHTML = "";
  gameUI.root.classList.toggle("is-wide", wide);
  gameUI.root.hidden = false;
  ui.panel.classList.add("is-away");
  return gameUI.body;
}
function closeGame() { gameEnd?.(); gameEnd = null; gameUI.root.hidden = true; ui.panel.classList.remove("is-away"); }
document.querySelector("[data-game-close]").addEventListener("click", closeGame);
addEventListener("keydown", (e) => { if (e.code === "Escape" && !gameUI.root.hidden) closeGame(); });
function nearestPerson(maxD = 9, filter = () => true) {
  let best = null, bd = maxD * maxD;
  for (const p of village.people) { if (p.isBuddy || !filter(p)) continue; const d2 = p.group.position.distanceToSquared(camera.position); if (d2 < bd) { best = p; bd = d2; } }
  return best;
}

// ताश: higher or lower, five rounds; winning means Lakshmi ji stays all year, they say
function playTaash() {
  const body = openGame("ताश की बाज़ी", "Higher or lower?");
  const suits = [["♠", 0], ["♥", 1], ["♦", 1], ["♣", 0]], names = { 11: "J", 12: "Q", 13: "K", 14: "A" };
  const deck = [];
  for (const [s2, red] of suits) for (let v = 2; v <= 14; v++) deck.push({ v, s: s2, red });
  deck.sort(() => Math.random() - 0.5);
  let cur = deck.pop(), round = 0, score = 0;
  const row = el("div", "game__row"), a = el("div", "card"), b = el("div", "card back"), msg = el("p", "game__msg"), sc = el("p", "game__score");
  const paint = (n, c) => { n.className = "card" + (c.red ? " red" : ""); n.innerHTML = ""; n.append(el("small", null, names[c.v] || c.v), el("span", null, c.s)); };
  paint(a, cur); row.append(a, b);
  const btns = el("div", "game__row"), hiB = el("button", "btn btn--solid", "ऊँचा · Higher"), loB = el("button", "btn btn--ghost", "नीचा · Lower");
  btns.append(hiB, loB);
  msg.innerHTML = "<b>अगला पत्ता बड़ा होगा या छोटा?</b>Will the next card be higher or lower?";
  sc.textContent = "Round 1 of 5";
  body.append(row, msg, btns, sc);
  const guess = (higher) => {
    const nx = deck.pop(); paint(b, nx); sound.sweep();
    const right = nx.v === cur.v || (higher ? nx.v > cur.v : nx.v < cur.v);
    if (right) score++;
    msg.innerHTML = right ? "<b>सही!</b>Right!" : "<b>अरे नहीं!</b>Oh no!";
    round++;
    hiB.disabled = loB.disabled = true;
    setTimeout(() => {
      if (round >= 5) {
        const win = score >= 3;
        msg.innerHTML = win ? `<b>जीत गए! 5 में से ${score}</b>You won ${score} of 5. They say Lakshmi ji stays all year with the winner!` : `<b>5 में से ${score}... अगली बाज़ी!</b>${score} of 5. The uncles win this time.`;
        if (win) { sound.coin(); stat("taash"); }
        const p = nearestPerson(12); if (p) sayAs(p, win ? ["वाह! आज तो किस्मत चमक गई!", "Wah! Luck is shining on you tonight!"] : ["हा हा, अगली बार!", "Ha ha, next time!"]);
        btns.innerHTML = ""; const again = el("button", "btn btn--solid", "फिर से · Again"); again.onclick = playTaash; btns.append(again);
        return;
      }
      cur = nx; paint(a, cur); b.className = "card back"; b.innerHTML = "";
      hiB.disabled = loB.disabled = false;
      sc.textContent = `Round ${round + 1} of 5 · ${score} right`;
    }, 1300);
  };
  hiB.onclick = () => guess(true); loB.onclick = () => guess(false);
}

// पूरी: take each one out of the oil when it's golden, not raw, not burnt
function playPuris() {
  const body = openGame("पूरियाँ तलो", "Fry the puris");
  const meter = el("div", "meter"), zone = el("div", "meter__zone"), needle = el("div", "meter__needle");
  meter.append(zone, needle);
  const labels = el("div", "meter__labels"); labels.append(el("span", null, "कच्ची · raw"), el("span", null, "सुनहरी · golden"), el("span", null, "जली · burnt"));
  const msg = el("p", "game__msg"), sc = el("p", "game__score"), row = el("div", "game__row"), take = el("button", "btn btn--solid", "निकालो! · Take it out");
  row.append(take);
  msg.innerHTML = "<b>पूरी तेल में!</b>Wait till it's golden, then take it out.";
  body.append(meter, labels, msg, row, sc);
  let n = 0, good = 0, x = 0, speed = 0.32, raf = 0, last = performance.now(), live = true;
  const zoneAt = () => { const w = 0.16 - n * 0.015, c = 0.48 + (Math.random() - 0.5) * 0.12; return [c - w / 2, c + w / 2]; };
  let z = zoneAt();
  const place = () => { zone.style.left = `${z[0] * 100}%`; zone.style.width = `${(z[1] - z[0]) * 100}%`; };
  place();
  const drop = () => { village.puris.forEach((p) => (p.scale.y = 0.35)); village.fry = 1.4; sound.fountain(1.2); };
  drop();
  const tick = (t) => {
    if (!live) return;
    x += (t - last) / 1000 * speed; last = t;
    if (x >= 1) { finishOne(); return; }
    needle.style.left = `${x * 100}%`;
    raf = requestAnimationFrame(tick);
  };
  const finishOne = () => {
    cancelAnimationFrame(raf);
    const ok = x >= z[0] && x <= z[1];
    if (ok) good++;
    msg.innerHTML = ok ? "<b>एकदम सुनहरी, फूली हुई!</b>Perfectly golden and puffed!" : x < z[0] ? "<b>अभी कच्ची थी!</b>Still raw!" : "<b>अरे, जल गई!</b>Oops, burnt!";
    n++;
    sc.textContent = `${n} of 5 · ${good} perfect`;
    take.disabled = true;
    setTimeout(() => {
      if (n >= 5) {
        msg.innerHTML = good >= 4 ? `<b>5 में से ${good}! अम्मा खुश हो गईं</b>Amma is delighted. ${good} perfect puris.` : `<b>${good} सुनहरी पूरियाँ</b>${good} golden puris. Amma says practice makes perfect.`;
        if (good >= 3) stat("puris");
        buddySay(good >= 4 ? ["वाह! एक मुझे भी दो!", "Wow! Give me one too!"] : ["जली वाली मैं खा लूँगा!", "I'll eat the burnt ones!"], 400);
        row.innerHTML = ""; const again = el("button", "btn btn--solid", "फिर से · Again"); again.onclick = playPuris; row.append(again);
        return;
      }
      x = 0; speed += 0.07; z = zoneAt(); place(); drop(); take.disabled = false; last = performance.now();
      msg.innerHTML = "<b>अगली पूरी तेल में!</b>Next puri in the oil.";
      raf = requestAnimationFrame(tick);
    }, 1200);
  };
  take.onclick = finishOne;
  raf = requestAnimationFrame(tick);
  gameEnd = () => { live = false; cancelAnimationFrame(raf); };
}

// मिठाई: carry a box of eight and give one to each person you meet
const shareUI = { bar: document.querySelector("[data-share-bar]"), left: document.querySelector("[data-share-left]") };
let sharing = null;
const THANKS = {
  woman: [["अरे वाह, काजू कतली! धन्यवाद!", "Oh, kaju katli! Thank you!"], ["मुँह मीठा करा दिया!", "You've sweetened my day!"]],
  man: [["शुक्रिया भाई, शुभ दीपावली!", "Thanks, Happy Diwali!"], ["वाह, लड्डू! बहुत बढ़िया!", "A ladoo! Lovely!"]],
  elder: [["जीते रहो, खुश रहो!", "Bless you, be happy!"]],
  child: [["थैंक यू! एक और मिलेगी?", "Thank you! Can I have another?"]], girl: [["थैंक यू दीदी/भैया!", "Thank you!"]],
  priest: [["प्रभु कृपा करें।", "God bless you."]],
};
function startSharing() {
  sharing = { left: 8, given: new Set() };
  shareUI.left.textContent = "8 left"; shareUI.bar.hidden = false;
  toast("Tap people to give them a sweet");
  buddySay(["मुझे भी एक देना!", "Save one for me!"], 800);
}
function giveSweet(p) {
  if (!sharing || sharing.given.has(p)) return false;
  sharing.given.add(p); sharing.left--; stat("sweets");
  const pool = p.isBuddy ? [["यम्म! तुम सबसे अच्छे हो!", "Yum! You're the best!"]] : THANKS[p.kind] || THANKS.man;
  sayAs(p, pool[(Math.random() * pool.length) | 0]); p.cheer = 1.2; sound.coin();
  shareUI.left.textContent = `${sharing.left} left`;
  if (sharing.left <= 0) endSharing(true);
  return true;
}
function endSharing(done) {
  if (!sharing) return;
  const n = sharing.given.size; sharing = null; shareUI.bar.hidden = true;
  if (done || n) setTimeout(() => {
    ui.caption.innerHTML = "";
    const b = el("span", null, "बाँटने से मिठास बढ़ती है"); b.lang = "hi";
    ui.caption.append(b, el("small", null, `You shared ${n} sweets. Sharing only makes the sweetness grow.`)); ui.caption.classList.add("is-on");
    setTimeout(() => ui.caption.classList.remove("is-on"), 5000);
  }, 1500);
}
document.querySelector("[data-share-done]").addEventListener("click", () => endSharing(false));

// गुब्बारे फोड़ो: ten pellets from the mela's air gun at a board of balloons; the hand never stays quite still
const PRIZES = [[8, "टेडी बियर", "a teddy bear"], [6, "चाबी का छल्ला", "a key ring"], [4, "प्लास्टिक की सीटी", "a plastic whistle"], [0, "एक टॉफ़ी", "a toffee, better luck next time"]];
function playBalloons() {
  const body = openGame("गुब्बारे फोड़ो", "Balloon shooting", true);
  const paid = me.batua >= 20;
  if (paid) { me.batua -= 20; remember(); }
  const cv = el("canvas", "balloons"), msg = el("p", "game__msg"), sc = el("p", "game__score");
  msg.innerHTML = paid ? "<b>₹20 में दस गोली</b>Ten pellets for ₹20. Aim, wait for your hand to steady, tap to fire." : "<b>आज मुफ़्त!</b>The stall bhaiya lets you have a go for free. Aim and tap to fire.";
  body.append(cv, msg, sc);
  const W = Math.min(660, body.clientWidth || 640), narrow = W < 440, H = Math.round(W * (narrow ? 0.95 : 0.56)), dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
  const g = cv.getContext("2d"); g.scale(dpr, dpr);
  const COLS = ["#e8213a", "#f6b21b", "#2a9d4a", "#2463d6", "#e95fb0", "#f07a1a", "#8a3ad8"];
  const balloons = [];
  const cols = narrow ? 5 : 8, rows = narrow ? 5 : 4, gx = W / (cols + 1), gy = (H - 40) / (rows + 0.6);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) balloons.push({ x: gx * (c + 1) + (r % 2 ? gx * 0.25 : -gx * 0.25), y: 30 + gy * (r + 0.6), c: COLS[(r * 3 + c) % COLS.length], ph: Math.random() * 6, up: true, pop: 0 });
  let shots = 10, hits = 0, aim = { x: W / 2, y: H / 2 }, t = 0, raf = 0, over = false, last = performance.now();
  const bits = [];
  const sk = Math.max(0.45, W / 660); // the hand shakes in proportion to the board
  const sway = () => ({ x: (Math.sin(t * 1.7) * 9 + Math.sin(t * 4.3) * 4) * sk, y: (Math.cos(t * 1.3) * 7 + Math.sin(t * 3.1) * 3) * sk });
  const R = Math.min(gx, gy) * 0.34;
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    g.clearRect(0, 0, W, H);
    // the stall's board: a sheet of cloth with a lamp above
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#3a1a10"); bg.addColorStop(1, "#1a0c08");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(255,200,120,.08)"; for (let x = 0; x < W; x += 18) g.fillRect(x, 0, 1, H);
    for (const b of balloons) {
      if (!b.up) continue;
      const bx = b.x + Math.sin(t * 1.4 + b.ph) * 2.5, by = b.y + Math.sin(t * 2 + b.ph) * 1.5;
      g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 1; g.beginPath(); g.moveTo(bx, by + R * 1.15); g.lineTo(bx + 2, by + R * 1.9); g.stroke();
      const rg = g.createRadialGradient(bx - R * 0.35, by - R * 0.45, R * 0.1, bx, by, R * 1.2);
      rg.addColorStop(0, "#fff8"); rg.addColorStop(0.25, b.c); rg.addColorStop(1, "#0006");
      g.fillStyle = rg; g.beginPath(); g.ellipse(bx, by, R * 0.88, R * 1.12, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = b.c; g.beginPath(); g.moveTo(bx - 3, by + R * 1.12); g.lineTo(bx + 3, by + R * 1.12); g.lineTo(bx, by + R * 1.12 + 5); g.fill();
    }
    for (let k = bits.length - 1; k >= 0; k--) {
      const p = bits[k]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.l -= dt;
      if (p.l <= 0) { bits.splice(k, 1); continue; }
      g.fillStyle = p.c; g.globalAlpha = Math.min(1, p.l * 2); g.fillRect(p.x, p.y, 4, 3); g.globalAlpha = 1;
    }
    // the sight, swaying with your breathing
    const s = sway(), ax = aim.x + s.x, ay = aim.y + s.y;
    g.strokeStyle = "#fff"; g.lineWidth = 1.5; g.beginPath(); g.arc(ax, ay, 13, 0, Math.PI * 2); g.moveTo(ax - 20, ay); g.lineTo(ax - 6, ay); g.moveTo(ax + 6, ay); g.lineTo(ax + 20, ay); g.moveTo(ax, ay - 20); g.lineTo(ax, ay - 6); g.moveTo(ax, ay + 6); g.lineTo(ax, ay + 20); g.stroke();
    g.fillStyle = "#ff3b2f"; g.beginPath(); g.arc(ax, ay, 2, 0, Math.PI * 2); g.fill();
    raf = requestAnimationFrame(frame);
  };
  const where = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) }; };
  cv.addEventListener("pointermove", (e) => { aim = where(e); });
  cv.addEventListener("pointerdown", (e) => {
    if (over || shots <= 0) return;
    aim = where(e);
    const s = sway(), fx = aim.x + s.x, fy = aim.y + s.y;
    shots--;
    sound.pop(0.35);
    const hit = balloons.find((b) => b.up && (fx - b.x) ** 2 / (R * 0.95) ** 2 + (fy - b.y) ** 2 / (R * 1.2) ** 2 < 1);
    if (hit) {
      hit.up = false; hits++;
      sound.pop(0.9);
      for (let k = 0; k < 14; k++) bits.push({ x: hit.x, y: hit.y, vx: (Math.random() - 0.5) * 260, vy: (Math.random() - 0.8) * 220, c: hit.c, l: 0.7 });
    }
    sc.textContent = `${hits} फूटे · ${hits} popped · ${shots} pellets left`;
    if (shots === 0) finish();
  });
  sc.textContent = "10 pellets";
  const finish = () => {
    over = true;
    const [, phi, pen] = PRIZES.find(([n]) => hits >= n);
    msg.innerHTML = `<b>दस में से ${hits}! इनाम: ${phi}</b>${hits} of 10. You win ${pen}.`;
    if (hits >= 6) { sound.coin(); stat("balloons"); jhola.items.push(pen); }
    const p = nearestPerson(14); if (p) sayAs(p, hits >= 8 ? ["वाह उस्ताद! निशाना पक्का है!", "Wah, ustad! What an aim!"] : hits >= 4 ? ["अच्छा खेले!", "Well played!"] : ["बंदूक टेढ़ी है, आपकी गलती नहीं!", "The gun shoots crooked, not your fault!"]);
    const again = el("button", "btn btn--solid", me.batua >= 20 ? "फिर से, ₹20 · Again" : "फिर से · Again"); again.type = "button";
    again.onclick = () => { cancelAnimationFrame(raf); playBalloons(); };
    const row = el("div", "game__row"); row.append(again); body.append(row);
  };
  raf = requestAnimationFrame(frame);
  gameEnd = () => cancelAnimationFrame(raf);
}

// उँगली से रंगोली: draw with eight-fold symmetry in powder colours, then lay it in the courtyard
function playRangoli() {
  const body = openGame("उँगली से रंगोली", "Draw a rangoli by hand", true);
  const S = Math.min(520, innerWidth - 60, innerHeight - 260);
  const pad = el("canvas", "draw__pad"); pad.width = pad.height = 640; pad.style.width = pad.style.height = `${S}px`;
  const x = pad.getContext("2d");
  const earth = () => { x.fillStyle = "#3a2618"; x.fillRect(0, 0, 640, 640); for (let i = 0; i < 1600; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.2})`; x.fillRect(Math.random() * 640, Math.random() * 640, 2, 2); } };
  earth();
  const COLS = ["#f3eadb", "#e0402a", "#f4a020", "#ffd21a", "#d6247a", "#1aa3a3", "#58a83a", "#4b4fc9"];
  let col = COLS[0];
  const cols = el("div", "draw__cols");
  for (const c of COLS) { const b = el("button"); b.type = "button"; b.style.setProperty("--sw", c); b.setAttribute("aria-label", `Colour ${c}`); b.setAttribute("aria-pressed", String(c === col)); b.onclick = () => { col = c; cols.querySelectorAll("button").forEach((o) => o.setAttribute("aria-pressed", String(o === b))); }; cols.append(b); }
  const row = el("div", "game__row"), clear = el("button", "btn btn--ghost", "Clear"), done = el("button", "btn btn--solid", "रंगोली बिछाओ · Lay it in the courtyard");
  row.append(clear, done);
  body.append(pad, el("div", "game__row"), cols, row);
  const dot = (px, py) => {
    // powder: a few grains around the point, mirrored eight ways round the centre
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2, dx = px - 320, dy = py - 320;
      for (const m of [1, -1]) {
        const rx = dx * Math.cos(a) - dy * m * Math.sin(a), ry = dx * Math.sin(a) + dy * m * Math.cos(a);
        for (let g = 0; g < 4; g++) { x.fillStyle = col; x.globalAlpha = 0.55 + Math.random() * 0.45; x.beginPath(); x.arc(320 + rx + (Math.random() - 0.5) * 6, 320 + ry + (Math.random() - 0.5) * 6, 2.2 + Math.random() * 2.4, 0, 6.283); x.fill(); }
      }
    }
    x.globalAlpha = 1;
  };
  let down = false, lastP = null;
  const at = (e) => { const r = pad.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 640, (e.clientY - r.top) / r.height * 640]; };
  pad.addEventListener("pointerdown", (e) => { down = true; lastP = at(e); dot(...lastP); try { pad.setPointerCapture(e.pointerId); } catch (_) { /* fine without capture */ } });
  pad.addEventListener("pointermove", (e) => {
    if (!down || !lastP) return;
    const p = at(e), d = Math.hypot(p[0] - lastP[0], p[1] - lastP[1]), n = Math.ceil(d / 4);
    for (let i = 1; i <= n; i++) dot(lastP[0] + (p[0] - lastP[0]) * i / n, lastP[1] + (p[1] - lastP[1]) * i / n);
    lastP = p;
  });
  pad.addEventListener("pointerup", () => (down = false));
  clear.onclick = earth;
  done.onclick = () => {
    const url = pad.toDataURL("image/jpeg", 0.8);
    applyHandRangoli(url);
    me.handRangoli = pad.toDataURL("image/jpeg", 0.55); remember();
    stat("rangoli");
    closeGame();
    goToStopThen("aangan", () => toast("Your rangoli is laid in the courtyard" + (me.surname ? " and at your door" : "")));
  };
}
function applyHandRangoli(url) {
  const img = new Image();
  img.onload = () => {
    const tex = new THREE.Texture(img); tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true;
    village.setCourtyardRangoliTexture(tex);
    if (me.surname && village.myHouse) { const t2 = tex.clone(); t2.needsUpdate = true; village.myHouse.setRangoliTexture(t2); }
  };
  img.src = url;
}

/* ---------- a diya on the water, for someone you remember ---------- */
const floatUI = { dialog: document.querySelector("[data-float]"), form: document.querySelector("[data-float-form]") };
const waterNames = []; // {f, sprite}
function nameOnWater(f, name) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 128;
  const x = c.getContext("2d");
  x.textAlign = "center"; x.textBaseline = "middle";
  x.shadowColor = "rgba(255,150,40,.9)"; x.shadowBlur = 18;
  x.fillStyle = "#ffe2a8"; x.font = "56px 'Tiro Devanagari Hindi', serif";
  x.fillText(name, 256, 64, 490);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
  sp.scale.set(1.3, 0.325, 1);
  scene.add(sp);
  waterNames.push({ f, sp });
}
function launchDiya(name) {
  const f = village.floatDiya();
  sound.strike();
  if (!f) { toast("The pond is full of lamps tonight"); return; }
  stat("floated");
  if (name) {
    nameOnWater(f, name);
    (me.remembered ||= []).push(name); me.remembered = me.remembered.slice(-12); remember();
    toast(`${name} की याद में · a diya for ${name} drifts out across the water`);
    setTimeout(() => sound.bell(0.35, 659), 600);
  } else toast("Your diya drifts out across the water");
}
floatUI.form.addEventListener("submit", (e) => { e.preventDefault(); const n = clean(floatUI.form.elements.who.value); floatUI.dialog.close(); launchDiya(n); });
document.querySelector("[data-float-plain]").addEventListener("click", () => { floatUI.dialog.close(); launchDiya(""); });
document.querySelector("[data-float-close]").addEventListener("click", () => floatUI.dialog.close());
function updateWaterNames() {
  for (const { f, sp } of waterNames) {
    sp.position.set(f.x, 0.42 + Math.sin(clockNow * 1.3 + f.seed) * 0.006, f.z);
    const d = sp.position.distanceTo(camera.position);
    sp.material.opacity = Math.max(0, Math.min(1, (24 - d) / 8)) * (f.launch === undefined ? 1 : f.launch);
  }
}

/* ---------- villagers notice you ---------- */
// people near you turn their heads as you pass; now and then one folds their hands and greets you by name
const GREETS = [
  ["राम राम, {n}!", "Ram Ram, {e}!"], ["शुभ दीपावली, {n}!", "Happy Diwali, {e}!"],
  ["आइए {n}, मिठाई खाकर जाइए!", "Come, {e}, have a sweet before you go!"], ["अरे {n}, कैसे हैं आप?", "Oh, {e}, how are you?"],
];
const KID_GREETS = [["हैप्पी दिवाली!", "Happy Diwali!"], ["{k}, पटाखे देखोगे?", "Want to see the crackers?"], ["मेरी फुलझड़ी देखो!", "Look at my phuljhadi!"]];
let noticeT = 6;
const toCam = new THREE.Vector3();
function updateNotice(dt) {
  noticeT -= dt;
  const busy = tour.ride || showing || aarti || writing || document.querySelector("dialog[open]");
  let pick = null;
  for (const p of village.people) {
    if (p.pose === "walk" || p.lookUp) { p.headYaw = null; continue; }
    toCam.subVectors(camera.position, p.group.position);
    const d2 = toCam.x * toCam.x + toCam.z * toCam.z;
    if (d2 > 4.2 * 4.2) { p.headYaw = null; continue; }
    let yaw = Math.atan2(toCam.x, toCam.z) - p.group.rotation.y;
    yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    p.headYaw = Math.abs(yaw) < 1.7 ? THREE.MathUtils.clamp(yaw, -1.0, 1.0) : null;
    if (!busy && !p.greeted && Math.abs(yaw) < 1.4 && d2 < 3 * 3 && p.pose !== "aarti" && p.pose !== "stir") pick = p;
  }
  if (pick && noticeT <= 0 && !bubbleFor) {
    noticeT = 8 + Math.random() * 6;
    pick.greeted = true;
    const kid = pick.kind === "child" || pick.kind === "girl";
    const [hi, en] = (kid ? KID_GREETS : GREETS)[(Math.random() * (kid ? KID_GREETS : GREETS).length) | 0];
    const n = me.name ? `${me.name} जी` : "भैया", e = me.name ? `${me.name} ji` : "friend", k = me.name || "भैया";
    sayAs(pick, [hi.replace("{n}", n).replace("{k}", k), en.replace("{e}", e)]);
    if (!kid && pick.pose !== "sit") {
      // turn to face you, fold hands, then go back to what they were doing
      const was = pick.pose, yaw0 = pick.group.rotation.y;
      toCam.subVectors(camera.position, pick.group.position);
      pick.group.rotation.y = Math.atan2(toCam.x, toCam.z);
      pick.pose = "namaste";
      setTimeout(() => { if (pick.pose === "namaste") pick.pose = was; pick.group.rotation.y = yaw0; }, 2400);
    }
  }
}

/* ---------- write in the air with a phuljhadi ---------- */
// hold and drag: the sparkler leaves a trail of light hanging in the air, like a long-exposure photo,
// so you can write your name or draw a diya; it glows for a while and then fades away
const TRAIL_MAX = 4000;
const trail = { pos: new Float32Array(TRAIL_MAX * 3), col: new Float32Array(TRAIL_MAX * 3), born: new Float32Array(TRAIL_MAX).fill(-99), i: 0 };
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute("position", new THREE.BufferAttribute(trail.pos, 3));
trailGeo.setAttribute("color", new THREE.BufferAttribute(trail.col, 3));
const trailDot = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.25, "rgba(255,210,140,.8)"); g.addColorStop(1, "rgba(255,140,40,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const trailPts = new THREE.Points(trailGeo, new THREE.PointsMaterial({ size: 0.07, map: trailDot, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
trailPts.frustumCulled = false;
let writing = null, clockNow = 0;
const writeUI = document.querySelector("[data-write-bar]");
function startWriting() {
  if (writing || aarti || showing || tour.ride) return;
  if (!trailPts.parent) scene.add(trailPts);
  writing = { down: false, last: null, px: 0, py: 0, fizz: 0 };
  tour.lockLook = true;
  ui.panel.classList.add("is-away");
  writeUI.hidden = false;
  stat("writing");
  toast(me.name ? `Write "${me.name}" in the air: hold and drag` : "Hold and drag to write in the air");
}
function stopWriting() {
  if (!writing) return;
  writing = null;
  tour.lockLook = false;
  ui.panel.classList.remove("is-away");
  writeUI.hidden = true;
}
document.querySelector("[data-write-done]").addEventListener("click", stopWriting);
document.querySelector("[data-write-photo]").addEventListener("click", () => { snapName = me.name; snapNext = true; });
document.querySelector("[data-write-clear]").addEventListener("click", () => { trail.born.fill(-99); trail.col.fill(0); trailGeo.attributes.color.needsUpdate = true; });
canvas.addEventListener("pointerdown", (e) => { if (writing && e.button === 0) { writing.down = true; writing.last = null; writing.px = e.clientX; writing.py = e.clientY; } });
addEventListener("pointermove", (e) => { if (writing) { writing.px = e.clientX; writing.py = e.clientY; } });
addEventListener("pointerup", () => { if (writing) writing.down = false; });
addEventListener("keydown", (e) => { if (e.code === "Escape" && writing) stopWriting(); });
const tipP = new THREE.Vector3(), stepP = new THREE.Vector3();
function updateWriting(dt) {
  clockNow += dt;
  if (writing) {
    // the sparkler tip sits where the pointer is, at arm's length
    ndc.set((writing.px / innerWidth) * 2 - 1, -(writing.py / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    tipP.copy(ray.ray.origin).addScaledVector(ray.ray.direction, 1.8);
    if (Math.random() < 0.8) sparks.spawn(tipP.x, tipP.y, tipP.z, (Math.random() - 0.5) * 1.6, Math.random() * 1.2, (Math.random() - 0.5) * 1.6, [1, 0.85, 0.5], 0.25 + Math.random() * 0.25, 0.3, 0.93, 0.5, 0.03, 1.5);
    if (writing.down) {
      const from = writing.last || tipP;
      const n = Math.max(1, Math.ceil(from.distanceTo(tipP) / 0.012));
      for (let k = 1; k <= n; k++) {
        stepP.lerpVectors(from, tipP, k / n);
        const i = trail.i++ % TRAIL_MAX;
        trail.pos.set([stepP.x, stepP.y, stepP.z], i * 3);
        trail.born[i] = clockNow;
      }
      writing.last = tipP.clone();
      writing.fizz -= dt;
      if (writing.fizz <= 0) {
        if (sound.has("sparkler")) { sound.play("sparkler", { dur: 2.6, gain: 0.3, fade: 0.2 }); writing.fizz = 2.4; }
        else { sound.fountain?.(0.25); writing.fizz = 0.3; }
      }
    }
  }
  // glow, then fade: bright for six seconds, gone by ten
  let live = false;
  for (let i = 0; i < TRAIL_MAX; i++) {
    const age = clockNow - trail.born[i];
    if (age > 10 || age < 0) { if (trail.col[i * 3]) trail.col[i * 3] = trail.col[i * 3 + 1] = trail.col[i * 3 + 2] = 0; continue; }
    live = true;
    const k = (age < 6 ? 1 : 1 - (age - 6) / 4) * (0.85 + Math.random() * 0.15);
    trail.col[i * 3] = 1.0 * k; trail.col[i * 3 + 1] = 0.78 * k; trail.col[i * 3 + 2] = 0.42 * k;
  }
  if (live || writing) { trailGeo.attributes.position.needsUpdate = true; trailGeo.attributes.color.needsUpdate = true; }
}

/* ---------- do the aarti yourself ---------- */
// circle the thali before Ganesh ji and Lakshmi ji with the mouse or a finger: three full rounds,
// a bell on every quarter, then flowers and the conch
let aarti = null;
const thali = new THREE.Group();
{
  const brass = new THREE.MeshStandardMaterial({ color: 0xd8a640, metalness: 0.9, roughness: 0.3, emissive: 0x3a2000 });
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.012, 28), brass); thali.add(plate);
  const diya = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8a4a2a, roughness: 0.8 })); diya.position.y = 0.04; thali.add(diya);
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xffa020 : 0xd02040, roughness: 0.8 })); m.position.set(Math.cos(i) * 0.085, 0.015, Math.sin(i) * 0.085); thali.add(m); }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,220,140,1)"); g.addColorStop(0.3, "rgba(255,160,60,.6)"); g.addColorStop(1, "rgba(255,120,30,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.position.y = 0.1; glow.scale.setScalar(0.32); thali.add(glow);
  thali.userData.glow = glow;
  thali.scale.setScalar(1.7); // held up close, so it reads as the thali in your hands
  thali.visible = false;
}
function startAarti() {
  if (aarti || pujaRunning || !village.altarCenter) return;
  if (!thali.parent) scene.add(thali);
  const focus = village.altarCenter.clone(); focus.y -= 1.0; // between the two murtis
  aarti = { focus, angle: null, turned: 0, quarters: 0, px: innerWidth / 2, py: innerHeight * 0.6, t: 0 };
  tour.lockLook = true;
  thali.visible = true;
  ui.panel.classList.add("is-away");
  ui.hint.classList.remove("is-on");
  village.pujaAarti("lakshmi"); // the family folds their hands while you do it
  pujaRunning = true;
  aartiCaption(0);
  toast("Hold the thali and circle it round the murtis, three times");
}
function aartiCaption(n) {
  ui.caption.innerHTML = "";
  const b = document.createElement("span"); b.lang = "hi"; b.textContent = n < 3 ? `ॐ जय लक्ष्मी माता · ${n} / 3` : "आरती पूरी हुई";
  const sm = document.createElement("small"); sm.textContent = n < 3 ? "Circle the thali round the murtis" : "The aarti is complete. Shubh Deepavali";
  ui.caption.append(b, sm); ui.caption.classList.add("is-on");
}
function endAarti(done) {
  if (!aarti) return;
  aarti = null;
  tour.lockLook = false;
  thali.visible = false;
  ui.panel.classList.remove("is-away");
  if (done) {
    stat("aarti"); buddyReact("aarti");
    aartiCaption(3);
    sound.conch();
    village.showerPetals(village.altarCenter, 260);
    setTimeout(() => { village.pujaAarti("done"); ui.caption.classList.remove("is-on"); pujaRunning = false; }, 5000);
  } else { village.pujaAarti("done"); ui.caption.classList.remove("is-on"); pujaRunning = false; }
}
addEventListener("pointermove", (e) => { if (aarti) { aarti.px = e.clientX; aarti.py = e.clientY; } });
addEventListener("keydown", (e) => { if (e.code === "Escape" && aarti) endAarti(false); });
function updateAarti(dt) {
  if (!aarti) return;
  aarti.t += dt;
  // the thali floats where the pointer is, at arm's length before the murtis
  ndc.set((aarti.px / innerWidth) * 2 - 1, -(aarti.py / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const reach = Math.min(1.6, camera.position.distanceTo(aarti.focus) * 0.5);
  thali.position.copy(ray.ray.origin).addScaledVector(ray.ray.direction, reach);
  thali.rotation.y += dt * 0.6;
  thali.userData.glow.scale.setScalar(0.3 + Math.sin(aarti.t * 23) * 0.03 + Math.sin(aarti.t * 7) * 0.02);
  if (Math.random() < 0.7) sparks.spawn(thali.position.x, thali.position.y + 0.1, thali.position.z, (Math.random() - 0.5) * 0.08, 0.35 + Math.random() * 0.3, (Math.random() - 0.5) * 0.08, [1, 0.72, 0.35], 0.25, 0.22, 0.97, 0.4, 0.035, 1.2);
  // count the rounds by the pointer's angle around the murtis on screen
  proj.copy(aarti.focus).project(camera);
  const cx = (proj.x * 0.5 + 0.5) * innerWidth, cy = (-proj.y * 0.5 + 0.5) * innerHeight;
  const dx = aarti.px - cx, dy = aarti.py - cy;
  if (Math.hypot(dx, dy) < 40) return; // too close to the centre to tell a direction
  const a = Math.atan2(dy, dx);
  if (aarti.angle !== null) {
    let d = a - aarti.angle; d = Math.atan2(Math.sin(d), Math.cos(d));
    aarti.turned += d;
    const q = Math.floor(Math.abs(aarti.turned) / (Math.PI / 2));
    if (q > aarti.quarters) { aarti.quarters = q; sound.bell(0.3, q % 4 === 0 ? 784 : 1046.5); }
    const rounds = Math.min(3, Math.floor(Math.abs(aarti.turned) / (Math.PI * 2)));
    if (rounds !== aarti.rounds) { aarti.rounds = rounds; aartiCaption(rounds); if (rounds >= 3) endAarti(true); }
  }
  if (aarti) aarti.angle = a;
}

let tulsiLit = 0, tulsiAnim = 0, pujaRunning = false;
const actions = {
  gali() { anar(2.2, 53.6); setTimeout(() => kidsCheer(2.2, 53.6, camera.position.distanceTo(tmp.set(2.2, 0, 53.6))), 700); toast("The kids step back as the anar roars"); },
  aangan() {
    if (tulsiLit) { toast("The tulsi diya is already burning"); return; }
    tulsiLit = 1; tulsiAnim = 0.001;
    sound.strike(); setTimeout(() => sound.bell(0.6), 400);
    toast("The first diya of Diwali is lit");
  },
  kuan() {
    village.well.want = 1;
    setTimeout(() => sound.sweep(), 900);
    toast("The bucket goes down and comes up full");
  },
  gaushala() {
    village.cows.forEach((c, i) => { c.shake = 0.35; setTimeout(() => sound.bell(0.35, 1318 + i * 180), i * 140); });
    setTimeout(() => soundAt("cow", 19, 47, { gain: 0.6, dur: 3.7 }), 700); // Gauri answers
    toast("Ghungroo bells ring down the line");
  },
  mehmaan() {
    sound.coin();
    setTimeout(() => sound.bell(0.25, 1046.5), 250);
    toast("\u201cArre, one more ladoo!\u201d");
  },
  puja() {
    if (pujaRunning) return;
    pujaRunning = true;
    const say = (hi, en) => { ui.caption.innerHTML = ""; const b = document.createElement("span"); b.lang = "hi"; b.textContent = hi; const sm = document.createElement("small"); sm.textContent = en; ui.caption.append(b, sm); ui.caption.classList.add("is-on"); };
    village.pujaAarti("ganesh");
    say("श्री गणेश जी की आरती", "First, Ganesh ji's aarti");
    if (!M_.card.hidden && music.playing) music.play(TRACKS.findIndex((t) => t.aarti));
    else sound.aarti(19);
    setTimeout(() => { village.pujaAarti("lakshmi"); say("माँ लक्ष्मी जी की आरती", "Then Lakshmi ji's aarti"); }, 9500);
    setTimeout(() => {
      village.pujaAarti("done");
      village.showerPetals(village.altarCenter, 220);
      sound.conch();
      say("शुभ दीपावली", "Flowers for the gods; the family touches the aarti flame");
    }, 19000);
    setTimeout(() => { ui.caption.classList.remove("is-on"); pujaRunning = false; }, 24500);
    toast("The family begins the aarti");
  },
  rasoi() {
    village.puris.forEach((p) => (p.scale.y = 0.35));
    village.fry = 1.4;
    sound.fountain(1.4);
    toast("The puri puffs up in the hot oil");
  },
  taash() {
    village.cards.forEach((c) => { c.position.x += (Math.random() - 0.5) * 0.5; c.position.z += (Math.random() - 0.5) * 0.5; c.rotation.z = Math.random() * 6.28; });
    sound.sweep();
    toast("Teen patti, and the elder wins again");
  },
  kumhar() { village.wheel.spin = 3.2; village.wheel.throw = 0.001; toast("The lump rises under his hands, then opens into a diya"); },
  bazaar() {
    const buys = ["A box of kaju katli, packed with a ribbon", "Two marigold malas for the door", "A new steel thali for the puja", "A sari for Bhai Dooj", "A string of LED lights", "Five kilos of sugar for the halwa"];
    sound.coin();
    toast(buys[(Math.random() * buys.length) | 0]);
  },
  mela() {
    if (tour.ride) return;
    const gw = village.giantWheel;
    // board the empty cabin nearest the bottom
    let best = gw.cabins[1], by = Infinity;
    const wp = new THREE.Vector3();
    gw.cabins.forEach((c, i) => { if (i % 2 === 0) return; c.cab.getWorldPosition(wp); if (wp.y < by) { by = wp.y; best = c; } });
    const start = gw.angle;
    let from = camera.position.clone(), fromQ = camera.quaternion.clone();
    const look = new THREE.Vector3(0, 1.5, 10), seat = new THREE.Vector3(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), UPV = new THREE.Vector3(0, 1, 0);
    const homeP = tour.posCurve.getPoint(STOPS[current].key / tour.n), homeL = tour.lookCurve.getPoint(STOPS[current].key / tour.n);
    let t0 = 0, phase = "up";
    const ease = (k) => k * k * (3 - 2 * k);
    gw.speed = 0.6;
    ui.panel.classList.add("is-walking");
    toast("Hold on! Up and over the village");
    tour.ride = (dt, cam) => {
      t0 += dt;
      if (phase === "up") {
        best.cab.getWorldPosition(seat);
        seat.y -= 0.25; // seated eye height under the cabin roof
        const k = ease(Math.min(1, t0 / 1.6));
        cam.position.lerpVectors(from, seat, k);
        m.lookAt(cam.position, look, UPV);
        q.setFromRotationMatrix(m);
        cam.quaternion.slerpQuaternions(fromQ, q, Math.min(1, t0 / 1.2));
        if (gw.angle - start > Math.PI * 2 && t0 > 3) {
          gw.speed = 0.22;
          phase = "down"; t0 = 0;
          from = cam.position.clone(); fromQ = cam.quaternion.clone();
        }
      } else {
        // step off and walk back to the fair's viewpoint
        const k = ease(Math.min(1, t0 / 2.2));
        cam.position.lerpVectors(from, homeP, k);
        m.lookAt(homeP, homeL, UPV);
        q.setFromRotationMatrix(m);
        cam.quaternion.slerpQuaternions(fromQ, q, k);
        if (k >= 1) {
          tour.ride = null;
          tour.s = tour.target = STOPS[current].key;
          tour.vel = 0;
          showStop(current);
        }
      }
    };
  },
  haat() { sparks.chakri(3, 0.01, -0.6, 5); sound.fountain(4); setTimeout(() => kidsCheer(3, -0.6, camera.position.distanceTo(tmp.set(3, 0, -0.6))), 500); toast("A chakri whirls in the dust"); },
  mandir() {
    village.bell.swing = 0.6;
    if (sound.has("ghanta")) { sound.play("ghanta", { offset: 0, dur: 6.8, gain: 0.65, fade: 0.02 }); setTimeout(() => sound.play("ghanta", { offset: 0, dur: 6.8, gain: 0.5, fade: 0.02 }), 1100); setTimeout(() => sound.play("ghanta", { offset: 0, dur: 6.8, gain: 0.42, fade: 0.02 }), 2200); }
    else { sound.bell(1, 523.25); setTimeout(() => sound.bell(0.9, 523.25), 450); setTimeout(() => sound.bell(0.8, 523.25), 900); }
    setTimeout(() => sound.conch(), 1300);
    toast("Ghanti and shankh for the aarti");
  },
  pokhar() { floatUI.form.reset(); floatUI.dialog.showModal(); },
  chhat() { finale(); toast("The whole sky lights up"); },
};
// where a sound sits left-right from the listener
function panOf(x, z) {
  const r = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const d = tmp.set(x - camera.position.x, 0, z - camera.position.z).normalize();
  return r.x * d.x + r.z * d.z;
}
// children shrieking and cheering, from the real recording when we have it
function kidsCheer(x, z, d) {
  village.kidsCheer(x, z);
  if (d < 22) sound.play("kids", { dur: 2.2 + Math.random() * 1.5, gain: THREE.MathUtils.clamp(9 / d, 0.12, 0.7), pan: panOf(x, z) });
}
// a sutli bomb: white flash, a crack, a cloud of smoke and a jolt if you're close
function bomb(x, z) {
  if (Math.random() < 0.35) setTimeout(() => soundAt("dog", x + 12, z - 8, { gain: 0.38, dur: 2.55 }), 1400 + Math.random() * 1200); // a dog answers the bang
  const d = camera.position.distanceTo(tmp.set(x, 0.3, z));
  const l = flashes[flashI++ % flashes.length];
  l.position.set(x, 0.6, z);
  l.color.setRGB(1, 0.93, 0.8);
  l.intensity = 350;
  for (let i = 0; i < 60; i++) {
    const a = Math.random() * 6.28, zz = Math.random(), m = 3 + Math.random() * 5;
    sparks.spawn(x, 0.15, z, Math.cos(a) * m * (1 - zz), zz * m, Math.sin(a) * m * (1 - zz), [1, 0.9, 0.7], 0.15 + Math.random() * 0.2, 0.5, 0.9, 0.5, 0.05, 2.5);
  }
  for (let i = 0; i < 6; i++) sparks.puff(x + (Math.random() - 0.5), 0.4 + Math.random() * 0.6, z + (Math.random() - 0.5), 1.4, 10, [0.6, 0.55, 0.5], 0.3, (Math.random() - 0.5) * 0.4, 0.3, (Math.random() - 0.5) * 0.4, 0.5);
  // a stretch of real crackers layered on the synthetic crack
  const real = sound.has("crackers");
  sound.play("crackers", { dur: 1.4, gain: THREE.MathUtils.clamp(8 / d, 0.1, 1), pan: panOf(x, z), fade: 0.01, delay: d / 343, muffle: THREE.MathUtils.clamp(d / 90, 0, 0.7) });
  if (!real) sound.bang(THREE.MathUtils.clamp(10 / d, 0.15, 1));
  if (d < 14 && !me.calm) tour.jolt(0.05 * (1 - d / 14));
  setTimeout(() => kidsCheer(x, z, d), 250);
}
function ladi(x, z, ang = Math.random() * Math.PI, len = 4) {
  const n = 34, dx = Math.cos(ang) * len / n, dz = Math.sin(ang) * len / n;
  const d = camera.position.distanceTo(tmp.set(x, 0, z));
  for (let i = 0; i < n; i++) setTimeout(() => {
    const px = x + dx * i, pz = z + dz * i;
    for (let k = 0; k < 6; k++) sparks.spawn(px, 0.06, pz, (Math.random() - 0.5) * 3, 0.5 + Math.random() * 2, (Math.random() - 0.5) * 3, k % 2 ? [1, 0.85, 0.6] : [1, 1, 0.95], 0.12, 0.6, 0.85, 0.4, 0.03, 2.4);
    if (i % 4 === 0) sparks.puff(px, 0.3, pz, 0.7, 7, [0.6, 0.55, 0.5], 0.12, 0, 0.25, 0, 0.4);
  }, i * 90 + Math.random() * 60);
  sound.play("crackers", { dur: n * 0.09 + 0.6, gain: THREE.MathUtils.clamp(9 / d, 0.08, 0.85), pan: panOf(x, z), delay: d / 343, muffle: THREE.MathUtils.clamp(d / 90, 0, 0.7) });
  if (!sound.has("crackers")) for (let i = 0; i < n; i += 3) setTimeout(() => sound.crackle(), i * 90);
  setTimeout(() => kidsCheer(x, z, d), n * 90);
}
function anar(x, z) { sparks.anar(x, 0.01, z, 5); sound.fountain(5); }

const tmp = new THREE.Vector3();
// a child nearby shouts at your rocket, now and then
const KID_SHOUTS = [["देखो देखो, रॉकेट!", "Look, look, a rocket!"], ["वाह! एक और!", "Wow! One more!"], ["कितना ऊँचा गया!", "It went so high!"], ["मेरी बारी, मेरी बारी!", "My turn, my turn!"]];
function kidShout() {
  if (Math.random() > 0.45 || bubbleFor) return;
  let best = null, bd2 = 14 * 14;
  for (const p of village.people) {
    if (p.kind !== "child" && p.kind !== "girl") continue;
    const d2 = p.group.position.distanceToSquared(camera.position);
    if (d2 > bd2) continue;
    proj.copy(p.group.position).project(camera);
    if (proj.z > 1 || Math.abs(proj.x) > 0.9 || Math.abs(proj.y) > 0.9) continue;
    best = p; bd2 = d2;
  }
  if (best) setTimeout(() => { best.cheer = 1.4; sayAs(best, KID_SHOUTS[(Math.random() * KID_SHOUTS.length) | 0]); }, 700);
}
function rocketToward(dir, dist = 60) {
  const from = camera.position.clone().add(tmp.set(dir.x, 0, dir.z).normalize().multiplyScalar(dist * 0.55));
  from.y = 0;
  const to = camera.position.clone().add(dir.clone().multiplyScalar(dist));
  to.y = THREE.MathUtils.clamp(to.y, 18, 42);
  sparks.rocket(from, to);
  sound.launch();
}
function finale() {
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  fwd.y = 0; fwd.normalize();
  const side = new THREE.Vector3(-fwd.z, 0, fwd.x);
  for (let i = 0; i < 22; i++) setTimeout(() => {
    const d = 40 + Math.random() * 30, s = (Math.random() - 0.5) * 50;
    const c = camera.position.clone().addScaledVector(fwd, d).addScaledVector(side, s);
    c.y = 0;
    sparks.rocket(c, c.clone().add(new THREE.Vector3(Math.random() * 6 - 3, 16 + Math.random() * 14, Math.random() * 6 - 3)));
    sound.launch();
  }, i * 200 + Math.random() * 150);
}
const flashes = [0, 1].map(() => { const l = new THREE.PointLight(0xffffff, 0, 90, 1.4); scene.add(l); return l; });
let flashI = 0;
const flashTint = new THREE.Vector3();
sparks.onBurst = (pos, type, col) => {
  const d = pos.distanceTo(camera.position);
  const lag = d / 343; // light arrives at once; the boom follows at the speed of sound
  if (sound.has("shells")) sound.play("shells", { dur: 2.2, gain: THREE.MathUtils.clamp(34 / d, 0.08, 0.7), pan: panOf(pos.x, pos.z), fade: 0.02, delay: lag, muffle: THREE.MathUtils.clamp((d - 25) / 120, 0, 0.85) });
  else setTimeout(() => sound.pop(THREE.MathUtils.clamp(40 / d, 0.15, 1)), lag * 1000);
  if (type === "crackle" && sound.has("crackers")) sound.play("crackers", { dur: 1.6, gain: THREE.MathUtils.clamp(20 / d, 0.05, 0.4), pan: panOf(pos.x, pos.z), delay: lag + 0.9, muffle: THREE.MathUtils.clamp(d / 140, 0, 0.8) });
  const l = flashes[flashI++ % flashes.length];
  l.position.copy(pos);
  l.color.setRGB(col[0] * 0.6 + 0.4, col[1] * 0.6 + 0.4, col[2] * 0.6 + 0.4);
  l.intensity = 900 * THREE.MathUtils.clamp(30 / d, 0.3, 1.5);
  flashTint.set(col[0], col[1], col[2]).multiplyScalar(THREE.MathUtils.clamp(40 / d, 0.2, 1.2));
};

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const proj = new THREE.Vector3();
// is a diya on screen within reach of the tap? (hidden diyas outdoors, unlit diyas inside homes)
function diyaNearTap(list, e, reach = 16) {
  for (const h of list) {
    if (h.lit) continue;
    proj.set(h.x, h.y + 0.05, h.z);
    if (proj.distanceTo(camera.position) > reach) continue;
    proj.project(camera);
    if (proj.z > 1) continue;
    const sx = (proj.x * 0.5 + 0.5) * innerWidth, sy = (-proj.y * 0.5 + 0.5) * innerHeight;
    if (Math.hypot(sx - e.clientX, sy - e.clientY) < 48) return h;
  }
  return null;
}
function lightHomeDiya(d) {
  d.lit = true; d.t = 0.001;
  buddyReact("diya");
  const home = d.home;
  if (village.myHouse && home === village.myHouse.state) { me.myLit = home.diyas.map((x, i) => (x.lit ? i : -1)).filter((i) => i >= 0); remember(); }
  home.lit++;
  sound.strike();
  setTimeout(() => sound.bell(0.25, 988 + home.lit * 60), 160);
  for (let i = 0; i < 18; i++) sparks.spawn(d.x, d.y + 0.08, d.z, (Math.random() - 0.5) * 1.2, 0.8 + Math.random() * 1.2, (Math.random() - 0.5) * 1.2, [1, 0.8, 0.45], 0.4, 0.3, 0.95, 0.6, 0.05, 1.4);
  if (home.lit === home.diyas.length) {
    lamps.spots[home.spot].on = 1;
    homesLit++; stat("homes");
    toast(homesLit === 1 ? "Every diya in this home is lit. Lakshmi ji is welcome here" : `Every diya lit · ${homesLit} homes glowing because of you`);
    setTimeout(() => { sound.conch(); village.showerPetals?.(new THREE.Vector3(d.x, d.y + 1.6, d.z), 60); }, 500);
  } else toast(`${home.lit} of ${home.diyas.length} diyas lit in this home`);
}
let homesLit = 0, glintT = 0;
let introEnded = 0;
function onTap(e) {
  if (aarti || writing) return;
  if (performance.now() - introEnded < 1500) return; // a tap meant to skip the intro shouldn't also walk you into a house
  // an unlit diya inside a home?
  const hd = village.homeDiyas && diyaNearTap(village.homeDiyas, e, 7);
  if (hd) { lightHomeDiya(hd); return; }
  // a hidden diya near the tap?
  for (const h of village.hunt) {
    if (h.lit) continue;
    proj.set(h.x, h.y + 0.05, h.z);
    const dist = proj.distanceTo(camera.position);
    if (dist > 16) continue;
    proj.project(camera);
    if (proj.z > 1) continue;
    const sx = (proj.x * 0.5 + 0.5) * innerWidth, sy = (-proj.y * 0.5 + 0.5) * innerHeight;
    if (Math.hypot(sx - e.clientX, sy - e.clientY) < 48) { lightHunt(h); return; }
  }
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const shop = shopAt(ray);
  if (shop) { openShop(shop); return; }
  const who = personAt(ray);
  if (who && sharing && giveSweet(who)) return;
  if (who) { talkTo(who); return; }
  const home = homeAt(ray);
  if (home) { stepInside(home); return; }
  const dir = ray.ray.direction;
  if (dir.y > 0.06) { rocketToward(dir.clone()); kidShout(); return; }
  // tapping the ground sets down a diya there
  if (dir.y < -0.02) {
    const floor = tour.floorAt ? tour.floorAt(camera.position.x, camera.position.z) : 0;
    const k = (floor - camera.position.y) / dir.y;
    if (k > 0.5 && k < 14) placeDiya(camera.position.x + dir.x * k, floor, camera.position.z + dir.z * k);
  }
}

/* ---------- stepping inside a house or the temple ---------- */
// tap a house (or the temple) you can see: the camera walks to the door, through it, and leaves you
// walking freely inside; walk back out through the door, or use "Back to the guided walk"
function homeAt(rayObj) {
  if (!village.homes || tour.ride || showing) return null;
  if ((tour.floorAt?.(camera.position.x, camera.position.z) ?? 0) > 0) return null; // already inside somewhere
  const near = village.homes.filter((h) => h.out.distanceToSquared(camera.position) < 30 * 30);
  const hits = rayObj.intersectObjects(near.map((h) => h.group), true);
  if (!hits.length || hits[0].distance > 28) return null;
  let o = hits[0].object;
  while (o && !near.some((h) => h.group === o)) o = o.parent;
  return near.find((h) => h.group === o) || null;
}
function stepInside(home) {
  if (tour.mode === "free") tour.exitFree(tour.s);
  // your own house: first stand before it and look up at your nameplate, then go in
  const mine = village.myHouse && home === village.myHouse.home && me.surname;
  if (mine && !home.plateShown) return showNameplate(home);
  const eye = 1.6, out = home.out.clone().setY(eye), m = new THREE.Matrix4(), q = new THREE.Quaternion(), ahead = new THREE.Vector3();
  ui.panel.classList.add("is-away");
  // from across the lane there is no clean line to the door, so dip to black and arrive on the doorstep
  const far = camera.position.distanceTo(out) > 4;
  const hold = camera.position.clone(), holdQ = camera.quaternion.clone();
  tour.ride = (dt, cam) => { cam.position.copy(hold); cam.quaternion.copy(holdQ); };
  if (far) { ui.shutter.classList.remove("is-on", "is-dip"); void ui.shutter.offsetWidth; ui.shutter.classList.add("is-dip"); }
  setTimeout(() => {
    if (far) { camera.position.copy(out); camera.quaternion.setFromRotationMatrix(m.lookAt(out, home.door.clone().setY(home.door.y + eye), camera.up)); }
    const pts = [camera.position.clone(), home.door.clone().setY(home.door.y + eye), home.inside.clone().setY(home.inside.y + eye)];
    const path = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    const c0 = performance.now(), dur = 1400 + path.getLength() * 260;
    sound.whoosh?.();
    tour.ride = (dt, cam) => {
      const k = Math.min(1, (performance.now() - c0) / dur), e = k * k * (3 - 2 * k);
      cam.position.copy(path.getPointAt(e));
      // look along the way in, then settle on the room
      path.getPointAt(Math.min(1, e + 0.1), ahead);
      ahead.y = cam.position.y - 0.05;
      if (e > 0.6) ahead.lerp(home.look, (e - 0.6) / 0.4);
      q.setFromRotationMatrix(m.lookAt(cam.position, ahead, cam.up));
      cam.quaternion.slerp(q, Math.min(1, dt * 5));
      if (k >= 1) {
        tour.ride = null;
        ui.panel.classList.remove("is-away");
        toggleFree(true);
        toast(home.temple ? `${home.name} · walk up to the murtis` : `${home.name} · look around and tap the twinkling diyas to light this home`);
      }
    };
  }, far ? 450 : 0);
}

function showNameplate(home) {
  const H = village.myHouse, eye = 1.6;
  const at = H.front.clone().setY(eye), m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromRotationMatrix(m.lookAt(at, H.plate, camera.up));
  ui.panel.classList.add("is-away");
  ui.shutter.classList.remove("is-on", "is-dip"); void ui.shutter.offsetWidth; ui.shutter.classList.add("is-dip");
  const c0 = performance.now();
  const hold = camera.position.clone(), holdQ = camera.quaternion.clone();
  tour.ride = (dt, cam) => {
    const t1 = (performance.now() - c0) / 1000;
    if (t1 < 0.45) { cam.position.copy(hold); cam.quaternion.copy(holdQ); return; }
    // a slow push toward the door while reading the plate
    const k = Math.min(1, (t1 - 0.45) / 2.6), e = k * k * (3 - 2 * k);
    cam.position.copy(at).lerp(H.front.clone().lerp(H.home.door, 0.25).setY(eye), e);
    cam.quaternion.copy(q);
    if (t1 > 3.4) { home.plateShown = true; tour.ride = null; stepInside(home); setTimeout(() => (home.plateShown = false), 4000); }
  };
  setTimeout(() => {
    ui.caption.innerHTML = "";
    const b = document.createElement("span"); b.lang = "hi"; b.textContent = `${me.surname} निवास`;
    const sm = document.createElement("small"); sm.textContent = me.name ? `Welcome home, ${me.name}` : "Welcome home";
    ui.caption.append(b, sm); ui.caption.classList.add("is-on");
    setTimeout(() => ui.caption.classList.remove("is-on"), 3400);
  }, 500);
}

/* ---------- free walk ---------- */
function toggleFree(on = tour.mode !== "free") {
  if (on) {
    tour.enterFree();
    ui.free.setAttribute("aria-pressed", "true");
    ui.free.textContent = "Back to the guided walk";
    ui.panel.classList.add("is-free");
    ui.pad.hidden = !mobile;
    ui.hint.textContent = mobile ? "Drag to look · use the arrows to walk" : "WASD or arrow keys to walk · drag to look · Shift to hurry";
    ui.hint.classList.add("is-on");
    clearTimeout(toggleFree.t);
    toggleFree.t = setTimeout(() => ui.hint.classList.remove("is-on"), 5000);
  } else {
    tour.exitFree(STOPS[current].key);
    ui.free.setAttribute("aria-pressed", "false");
    ui.free.textContent = "Walk freely";
    ui.panel.classList.remove("is-free");
    ui.pad.hidden = true;
    showStop(current);
  }
}

/* ---------- wiring ---------- */
function markSeen() {
  ui.placesList.querySelectorAll("button").forEach((b, k) => {
    let tick = b.querySelector(".seen");
    if (me.seen.includes(STOPS[k].id) && !tick) { tick = document.createElement("span"); tick.className = "seen"; tick.textContent = "✓ seen"; b.appendChild(tick); }
  });
}
STOPS.forEach((st, i) => {
  const li = document.createElement("li");
  const b = document.createElement("button");
  b.type = "button";
  b.innerHTML = `<span class="num">${i + 1}</span><span><b lang="hi"></b><em></em></span>`;
  b.querySelector("b").textContent = st.hi;
  b.querySelector("em").textContent = st.en;
  b.addEventListener("click", () => { ui.places.close(); goStop(i); });
  li.appendChild(b);
  ui.placesList.appendChild(li);
});
ui.prev.addEventListener("click", () => goStop(current - 1));
ui.next.addEventListener("click", () => goStop(current === STOPS.length - 1 ? 0 : current + 1));
ui.action.addEventListener("click", () => actions[STOPS[current].id]());
const actions2 = {
  taash: () => playTaash(),
  rasoi: () => playPuris(),
  mela: () => playBalloons(),
  aangan: () => openRangoli(),
  puja: () => startAarti(),
  chhat: () => { ui.nameInput.value = me.name; ui.nameDialog.showModal(); ui.nameInput.focus(); },
};
ui.action2.addEventListener("click", () => actions2[STOPS[current].id]?.());
// the description shows three lines; tap it for the rest
ui.text.addEventListener("click", () => ui.text.classList.toggle("is-open"));

/* ---------- rangoli designer ---------- */
const rg = { style: "padma", palette: "sindoor", petals: 16, rings: 4 };
let rgTarget = "aangan";
document.querySelectorAll("[data-rg-targets] .rg__opt").forEach((b, _, all) => b.addEventListener("click", () => {
  rgTarget = b.dataset.target;
  all.forEach((o) => o.setAttribute("aria-checked", String(o === b)));
}));
const rgCanvas = document.querySelector("[data-rg-canvas]");
function rgPreview() { paintRangoli(rgCanvas, { ...rg, grain: false }); }
function rgRadio(container, entries, key, render) {
  container.innerHTML = "";
  for (const [id, v] of Object.entries(entries)) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "rg__opt"; b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(rg[key] === id));
    render(b, v);
    b.addEventListener("click", () => {
      rg[key] = id;
      container.querySelectorAll(".rg__opt").forEach((o) => o.setAttribute("aria-checked", String(o === b)));
      rgPreview();
    });
    container.appendChild(b);
  }
}
rgRadio(document.querySelector("[data-rg-styles]"), RANGOLI_STYLES, "style", (b, v) => { const t = document.createElement("b"); t.textContent = v.name; const n = document.createElement("small"); n.textContent = v.note; b.append(t, n); });
rgRadio(document.querySelector("[data-rg-palettes]"), RANGOLI_PALETTES, "palette", (b, v) => {
  const sw = document.createElement("span"); sw.className = "rg__swatch";
  v.cols.slice(0, 3).forEach((c) => { const i = document.createElement("i"); i.style.background = c; sw.appendChild(i); });
  b.append(sw, document.createTextNode(v.name));
});
for (const k of ["petals", "rings"]) {
  const input = document.querySelector(`[data-rg-${k}]`), out = document.querySelector(`[data-rg-${k}-out]`);
  input.addEventListener("input", () => { rg[k] = Number(input.value); out.textContent = input.value; rgPreview(); });
}
document.querySelector("[data-rg-apply]").addEventListener("click", () => {
  (rgTarget === "chaupal" ? village.setChaupalRangoli : village.setCourtyardRangoli)({ ...rg });
  ui.rgDialog.close();
  sound.sweep(); setTimeout(() => sound.bell(0.4), 300);
  toast(rgTarget === "chaupal" ? "Fresh rangoli round the banyan" : "Fresh rangoli on the courtyard floor");
});
document.querySelector("[data-rg-reset]").addEventListener("click", () => {
  (rgTarget === "chaupal" ? village.setChaupalRangoli : village.setCourtyardRangoli)(null);
  ui.rgDialog.close();
  toast("The original rangoli is back");
});
function openRangoli() { rgPreview(); ui.rgDialog.showModal(); }

/* ---------- sky lantern wishes (kept only in this browser) ---------- */
const VILLAGE_WISHES = [
  { who: "Dadi Maa", wish: "May every home in the village have full granaries, healthy cattle and laughter in the courtyard.", at: 0 },
  { who: "Ramu kaka, the potter", wish: "May my diyas light a thousand doorways, and next year's clay be kind.", at: 0 },
  { who: "Pinky and Golu", wish: "More phuljhadi, fewer exams!", at: 0 },
];
function loadWishes() { try { return JSON.parse(localStorage.getItem("gaon-wishes") || "[]"); } catch (_) { return []; } }
function saveWishes(list) { try { localStorage.setItem("gaon-wishes", JSON.stringify(list.slice(0, 20))); } catch (_) { /* private mode: wishes just won't persist */ } }
function ago(ts) {
  if (!ts) return "from the village";
  const m = Math.round((Date.now() - ts) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
}
function renderWishes() {
  const ul = document.querySelector("[data-wish-list]");
  ul.innerHTML = "";
  for (const w of [...loadWishes(), ...VILLAGE_WISHES]) {
    const li = document.createElement("li"), b = document.createElement("b"), who = document.createElement("span"), when = document.createElement("small"), p = document.createElement("p");
    who.textContent = w.who || "A visitor"; when.textContent = ago(w.at); p.textContent = w.wish || "";
    b.append(who, when); li.append(b, p); ul.appendChild(li);
  }
}
document.querySelector("[data-name-form]").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = ui.nameInput.value;
  ui.nameDialog.close();
  ui.nameInput.value = "";
  nameInSky(name);
});
document.querySelectorAll("[data-name-close]").forEach((b) => b.addEventListener("click", () => ui.nameDialog.close()));
const wishForm = document.querySelector("[data-wish-form]");
wishForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(wishForm);
  const who = String(fd.get("who") || "").trim().slice(0, 40), wish = String(fd.get("wish") || "").trim().slice(0, 140);
  if (who || wish) saveWishes([{ who, wish, at: Date.now() }, ...loadWishes()]);
  ui.wishDialog.close();
  wishForm.reset();
  releaseLantern(who || wish ? { who, wish } : null);
  sound.strike();
  toast(wish ? "Your wish rises over the village" : "Your lantern rises over the village");
});
document.querySelectorAll("[data-wish-close]").forEach((b) => b.addEventListener("click", () => ui.wishDialog.close()));
[ui.rgDialog, ui.wishDialog].forEach((d) => d.addEventListener("click", (e) => { if (e.target === d) d.close(); }));
ui.free.addEventListener("click", () => toggleFree());
// photo mode: the next rendered frame is framed as a Diwali picture to save or share
let snapNext = false, snapName = "", sharedSpot = null;
ui.photo.addEventListener("click", () => { snapName = me.name; snapNext = true; });
const photoUI = {
  dialog: document.querySelector("[data-photo-dialog]"),
  preview: document.querySelector("[data-photo-preview]"),
  frames: document.querySelectorAll("[data-frame]"),
  save: document.querySelector("[data-photo-save]"),
  share: document.querySelector("[data-photo-share]"),
};
let shot = null, frameIdx = 0;
function savePhoto() {
  const src = renderer.domElement;
  const k = Math.min(1, 1600 / src.width);
  const c = document.createElement("canvas");
  c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
  c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
  shot = { img: c, name: snapName, recap: snapMode === "recap" };
  snapMode = "photo";
  ui.shutter.classList.remove("is-on"); void ui.shutter.offsetWidth; ui.shutter.classList.add("is-on");
  sound.sweep();
  document.querySelector("[data-photo-frames]").hidden = shot.recap;
  document.querySelector("[data-photo-linkrow]").hidden = true;
  document.querySelector("#photo-title").textContent = shot.recap ? "Your Diwali card" : "Choose a frame";
  if (shot.recap) renderRecap(); else renderFrame();
  photoUI.share.hidden = !(navigator.canShare && navigator.canShare({ files: [new File([""], "x.jpg", { type: "image/jpeg" })] }));
  photoUI.dialog.showModal();
}
// three hand-drawn frames: a marigold garland with a toran, rangoli corners, or a plain gold rule
function renderFrame() {
  const { img, name } = shot, W = img.width, H = img.height, u = Math.min(W, H) / 100;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d");
  x.drawImage(img, 0, 0);
  const vg = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(10,4,2,.55)");
  x.fillStyle = vg; x.fillRect(0, 0, W, H);
  if (frameIdx === 0) {
    // a marigold garland right round the picture, a mango-leaf toran across the top
    const bead = (bx, by, i) => { x.fillStyle = i % 2 ? "#ffb020" : "#ff7a10"; x.beginPath(); x.arc(bx, by, u * 1.6, 0, 6.283); x.fill(); x.fillStyle = "rgba(120,40,0,.35)"; x.beginPath(); x.arc(bx + u * 0.4, by + u * 0.4, u * 0.6, 0, 6.283); x.fill(); };
    const step = u * 2.6;
    let i = 0;
    for (let bx = u * 2; bx < W - u; bx += step) { bead(bx, u * 2, i++); bead(bx, H - u * 2, i++); }
    for (let by = u * 2; by < H - u; by += step) { bead(u * 2, by, i++); bead(W - u * 2, by, i++); }
    for (let lx = u * 6; lx < W - u * 4; lx += u * 5) {
      x.fillStyle = "#2f6a1e"; x.beginPath(); x.moveTo(lx - u * 1.2, u * 3); x.quadraticCurveTo(lx, u * 11, lx + u * 1.2, u * 3); x.fill();
      x.fillStyle = "#ffb020"; x.beginPath(); x.arc(lx + u * 2.5, u * 4.2, u * 1, 0, 6.283); x.fill();
    }
  } else if (frameIdx === 1) {
    x.strokeStyle = "#e8b04a"; x.lineWidth = u * 0.5; x.strokeRect(u * 2, u * 2, W - u * 4, H - u * 4); x.strokeRect(u * 3.2, u * 3.2, W - u * 6.4, H - u * 6.4);
    const cols = ["#d6247a", "#1aa3a3", "#ffd21a", "#e0402a", "#f3eadb"];
    for (const [cx, cy] of [[u * 3, u * 3], [W - u * 3, u * 3], [u * 3, H - u * 3], [W - u * 3, H - u * 3]]) {
      for (let r = 5; r >= 1; r--) {
        x.fillStyle = cols[r % cols.length];
        for (let p = 0; p < 12; p++) { const a = (p / 12) * 6.283; x.beginPath(); x.ellipse(cx + Math.cos(a) * r * u * 1.8, cy + Math.sin(a) * r * u * 1.8, u * 1.6, u * 0.8, a, 0, 6.283); x.fill(); }
      }
      x.fillStyle = "#ffd890"; x.beginPath(); x.arc(cx, cy, u * 1.5, 0, 6.283); x.fill();
    }
  } else {
    x.strokeStyle = "rgba(240,190,90,.9)"; x.lineWidth = u * 0.35; x.strokeRect(u * 2.5, u * 2.5, W - u * 5, H - u * 5);
  }
  // the greeting along the bottom
  const band = x.createLinearGradient(0, H - u * 22, 0, H);
  band.addColorStop(0, "rgba(10,4,2,0)"); band.addColorStop(1, "rgba(10,4,2,.75)");
  x.fillStyle = band; x.fillRect(0, H - u * 22, W, u * 22);
  x.textAlign = "center"; x.fillStyle = "#ffd27a"; x.shadowColor = "rgba(255,150,40,.8)"; x.shadowBlur = u * 2;
  x.font = `${u * 7}px 'Tiro Devanagari Hindi', serif`;
  x.fillText(greet(), W / 2, H - u * (name ? 11 : 8));
  x.shadowBlur = 0; x.fillStyle = "rgba(255,240,215,.92)";
  x.font = `italic ${u * 3}px 'Cormorant Garamond', serif`;
  x.fillText(name ? `from ${name}` : "from Gaon ki Diwali", W / 2, H - u * (name ? 5.5 : 3.6));
  shot.url = c.toDataURL("image/jpeg", 0.9);
  photoUI.preview.src = shot.url;
}
photoUI.frames.forEach((b) => b.addEventListener("click", () => {
  if (shot.recap) return;
  frameIdx = +b.dataset.frame;
  photoUI.frames.forEach((o) => o.setAttribute("aria-checked", String(o === b)));
  renderFrame();
}));
const photoName = () => (shot.invite ? `diwali-invite-${shot.name}.jpg` : shot.recap ? "my-diwali.jpg" : `shubh-deepavali-${STOPS[current].id}.jpg`);
photoUI.save.addEventListener("click", () => {
  const a = document.createElement("a"); a.href = shot.url; a.download = photoName(); a.click();
  toast("Picture saved");
});
photoUI.share.addEventListener("click", async () => {
  try {
    const blob = await (await fetch(shot.url)).blob();
    await navigator.share({ files: [new File([blob], photoName(), { type: "image/jpeg" })], text: "शुभ दीपावली · Shubh Deepavali" });
  } catch (_) { /* the visitor closed the share sheet */ }
});
document.querySelector("[data-photo-close]").addEventListener("click", () => photoUI.dialog.close());
photoUI.dialog.addEventListener("click", (e) => { if (e.target === photoUI.dialog) photoUI.dialog.close(); });
// after a name has formed in the sky, offer to keep it as a card
function showCardButton(name) {
  ui.cardBtn.innerHTML = '<span lang="hi">कार्ड सहेजें</span> · Save this greeting card';
  ui.cardBtn.hidden = false;
  ui.cardBtn.onclick = () => { ui.cardBtn.hidden = true; snapName = name; frameIdx = 0; photoUI.frames.forEach((o) => o.setAttribute("aria-checked", String(o.dataset.frame === "0"))); snapNext = true; };
  clearTimeout(showCardButton.t);
  showCardButton.t = setTimeout(() => (ui.cardBtn.hidden = true), 9000);
}
// a link that opens the village where you are standing: the stop, or your exact spot when walking freely
document.querySelector("[data-share-view]").addEventListener("click", async () => {
  let hash = `#${STOPS[current].id}`;
  if (tour.mode === "free") hash += `@${camera.position.x.toFixed(1)},${camera.position.z.toFixed(1)},${tour.free.yaw.toFixed(2)}`;
  const url = location.origin + location.pathname + hash;
  const text = `Come see Diwali in the village with me: ${STOPS[current].en}`;
  if (navigator.share) { try { await navigator.share({ title: "Gaon ki Diwali", text, url }); } catch (_) { /* cancelled */ } return; }
  try { await navigator.clipboard.writeText(url); toast("Link copied. Send it to someone"); }
  catch (_) { showLink(url); } // no share sheet and no clipboard: show the link to copy by hand
});
function showLink(url) {
  const card = document.querySelector("[data-link-card]"), input = card.querySelector("input");
  input.value = url;
  card.hidden = false;
  input.focus(); input.select();
}
document.querySelector("[data-link-copy]").addEventListener("click", () => {
  const input = document.querySelector("[data-link-card] input");
  input.select();
  const ok = document.execCommand && document.execCommand("copy");
  toast(ok ? "Link copied. Send it to someone" : "Select the link and copy it");
});
document.querySelector("[data-link-close]").addEventListener("click", () => (document.querySelector("[data-link-card]").hidden = true));
ui.lantern.addEventListener("click", () => { renderWishes(); const who = ui.wishDialog.querySelector("[name=who]"); if (!who.value) who.value = me.name; ui.wishDialog.showModal(); });
let welcome = "";
// pick up where this visitor left off: their hidden diyas stay lit, their crackers stay in the bag
function restoreProgress() {
  for (const i of me.hunt) {
    const h = village.hunt[i];
    if (!h || h.lit) continue;
    h.lit = true; h.t = 1; found++;
    lamps.setPower(h.id, 1); lamps.spots[h.spot].on = 1;
  }
  ui.huntCount.textContent = found;
  // the diyas you lit in your own house are still burning
  const mine = village.myHouse?.state;
  if (mine) for (const i of me.myLit || []) {
    const d = mine.diyas[i];
    if (!d || d.lit) continue;
    d.lit = true; d.t = 1; mine.lit++; lamps.setPower(d.id, 1);
  }
  if (mine && mine.lit === mine.diyas.length) lamps.spots[mine.spot].on = 1;
  if (me.handRangoli) applyHandRangoli(me.handRangoli);
  for (const name of me.remembered || []) { const f = village.floatDiya({ already: true }); if (f) nameOnWater(f, name); }
  for (const [k, n] of Object.entries(me.bag || {})) if (n > 0 && BAG_LABEL[k]) bag[k] = n;
  renderBag();
}
const tipsUI = { root: document.querySelector("[data-tips]"), title: document.querySelector("[data-tips-title]") };
function showTips() {
  tipsUI.title.textContent = me.name ? `${me.name}, here's how to explore` : "How to explore";
  tipsUI.root.hidden = false;
  tipsUI.root.querySelector("[data-tips-close]").focus({ preventScroll: true });
}
document.querySelector("[data-tips-close]").addEventListener("click", () => { tipsUI.root.hidden = true; me.tips = true; remember(); });
document.querySelector("[data-tips-open]").addEventListener("click", () => showTips());
// the explore hub: each thing to do, one tap away from the top bar
const hubGuide = document.querySelector("[data-hub-guide]");
const HUB = {
  yours: () => openYours(),
  days: () => { paintDays(); daysDialog.showModal(); },
  aarti: () => { goToStopThen("puja", () => startAarti()); },
  name: () => { goToStopThen("chhat", () => { ui.nameInput.value = me.name; ui.nameDialog.showModal(); }); },
  invite: () => { inviteUI.form.reset(); resetInvitePhoto(); inviteUI.dialog.showModal(); },
  card: () => { snapMode = "recap"; snapNext = true; },
  bless: () => dadiBlessing(),
  gift: () => openGift(),
  diary: () => openDiary(),
  morning: () => morningAfter(),
  taash: () => goToStopThen("taash", () => playTaash()),
  puri: () => goToStopThen("rasoi", () => playPuris()),
  balloons: () => goToStopThen("mela", () => playBalloons()),
  share: () => startSharing(),
  draw: () => playRangoli(),
  write: () => startWriting(),
  guide: () => { guideBtn.click(); hubGuide.textContent = guideLabel.textContent; },
  photo: () => { snapName = me.name; snapNext = true; },
  burn: () => goMaidan(),
  show: () => fireworksShow(),
};
document.querySelectorAll("[data-hub-go]").forEach((b) => b.addEventListener("click", () => { ui.places.close(); HUB[b.dataset.hubGo]?.(); }));
// walk to a stop, and once there do the thing (the aarti, the name in the sky)
function goToStopThen(id, then) {
  const i = STOPS.findIndex((s2) => s2.id === id);
  if (i === current && !ui.panel.classList.contains("is-walking")) { then(); return; }
  goStop(i);
  const wait = setInterval(() => { if (!tour.moving && !tour.ride) { clearInterval(wait); setTimeout(then, 700); } }, 250);
}
// every shop and stall in the village, so nothing has to be found by wandering
const shopsList = document.querySelector("[data-shops-list]");
function areaOf(p) {
  if (p.x < -13 && p.z < -18) return "market street";
  if (p.z > 30) return "the lane";
  if (Math.abs(p.x) < 11 && p.z > -16 && p.z < 6) return "the haat";
  if (village.maidan && p.distanceTo(village.maidan.center) < 10) return "the cracker ground";
  return "the fair";
}
function fillShops() {
  if (shopsList.childElementCount || !village?.shops) return;
  const wp = new THREE.Vector3();
  for (const sh of village.shops) {
    sh.group.getWorldPosition(wp);
    const li = document.createElement("li"), b = document.createElement("button");
    b.type = "button";
    b.innerHTML = `<span class="num">₹</span><span><b lang="hi"></b><em></em></span>`;
    b.querySelector("b").textContent = sh.hi;
    b.querySelector("em").textContent = `${sh.en} · ${areaOf(wp)}`;
    b.addEventListener("click", () => { ui.places.close(); if (tour.mode === "free") toggleFree(false); if (visit) leaveShop(); setTimeout(() => openShop(sh), visit ? 1200 : 0); });
    li.appendChild(b);
    shopsList.appendChild(li);
  }
}
ui.placesBtn.addEventListener("click", () => { fillShops(); hubGuide.textContent = guideLabel.textContent; ui.places.showModal(); });
ui.places.addEventListener("click", (e) => { if (e.target === ui.places) ui.places.close(); });
ui.places.querySelector("[data-close]").addEventListener("click", () => ui.places.close());
async function setSound(want) {
  if (want !== sound.on) await sound.toggle();
  if (sound.on) { sound.bed("fireworks", 0.18); sound.bed("crackers", 0.12); }
}
window.addEventListener("keydown", (e) => {
  if (document.querySelector("dialog[open]") || tour?.mode === "free") return;
  if (e.code === "ArrowRight" || e.code === "PageDown") goStop(current + 1);
  if (e.code === "ArrowLeft" || e.code === "PageUp") goStop(current - 1);
  if (e.code === "ArrowDown") { tour.scrub(0.35); scrolling = true; }
  if (e.code === "ArrowUp") { tour.scrub(-0.35); scrolling = true; }
});
// touch pad for free walk
ui.pad.querySelectorAll("[data-move]").forEach((b) => {
  const [mv, tn] = b.dataset.move.split(",").map(Number);
  const on = (e) => { e.preventDefault(); tour.touchMove = mv; tour.touchTurn = tn; };
  const off = () => { tour.touchMove = 0; tour.touchTurn = 0; };
  b.addEventListener("pointerdown", on);
  b.addEventListener("pointerup", off);
  b.addEventListener("pointercancel", off);
  b.addEventListener("pointerleave", off);
});

// The opening: a timed drone sequence over the village while the lamps catch from the temple outward.
const SHOTS = [
  // t (s), camera, look-at, lens fov, roll (rad)
  { t: 0, p: [-78, 58, -92], l: [0, 0, -14], fov: 46, roll: 0 },
  { t: 4.5, p: [-38, 30, -62], l: [0, 5, -33], fov: 48, roll: 0.03 },
  { t: 8.5, p: [-9, 13.5, -45], l: [1, 8.5, -33], fov: 54, roll: 0.07 },     // behind the shikhara, flag in frame
  { t: 11.5, p: [12, 8, -36], l: [24, 0, -23], fov: 56, roll: -0.05 },       // skimming the pond
  { t: 14.5, p: [31, 11, -11], l: [30, 6, 22], fov: 52, roll: -0.08 },       // banking north
  { t: 17.5, p: [21, 8.5, 15], l: [30.5, 5.4, 24], fov: 54, roll: 0.04 },    // past the giant wheel
  { t: 20.5, p: [9, 13, 36], l: [0, 2, 52], fov: 50, roll: 0.05 },           // over the rooftops
  { t: 23.5, p: [-2, 8, 80], l: [0, 2.5, 56], fov: 54, roll: -0.03 },        // round the entrance
  { t: 25.2, p: [-0.6, 3.4, 68], l: [0, 2.2, 50], fov: 56, roll: -0.01 },     // down the middle of the lane, clear of the corner house
  { t: 26.5, p: [0, 1.6, 61], l: [0, 1.9, 40], fov: 58, roll: 0 },           // into the lane
];
// cues fired once as the shot passes them
const CUES = [
  { t: 0.2, fn: () => sound.whoosh(9) },
  { t: 3.0, fn: () => sound.bell(0.8, 523.25) },
  { t: 4.0, fn: () => sound.conch() },
  { t: 5.5, fn: () => volley([[-6, 0, -46], [6, 0, -48], [0, 0, -52]], 24, 30) },
  { t: 8.8, fn: () => { for (let i = 0; i < 12; i++) setTimeout(() => lanterns.release(new THREE.Vector3(-4 + Math.random() * 10, 2 + Math.random() * 4, -40 + Math.random() * 8)), i * 120); } },
  { t: 10.5, fn: () => sound.whoosh(7) },
  { t: 11.0, fn: () => volley([[20, 0, -34], [28, 0, -30], [24, 0, -40]], 20, 28) },
  { t: 16.0, fn: () => volley([[36, 0, 30], [30, 0, 36], [40, 0, 22], [34, 0, 40]], 24, 34) },
  { t: 17.0, fn: () => sound.whoosh(8) },
  { t: 21.5, fn: () => volley([[-8, 0, 40], [8, 0, 44]], 22, 28, "willow") },
  { t: 13.5, fn: () => volley([[48, 0, -40], [40, 0, -48], [52, 0, -30], [34, 0, -52]], 26, 38, "chrysanthemum") },
  { t: 19.0, fn: () => volley([[40, 0, 46], [26, 0, 50], [46, 0, 30]], 24, 34, "ring") },
  { t: 24.2, fn: () => volley([[-14, 0, 36], [0, 0, 32], [14, 0, 36], [-22, 0, 26], [22, 0, 26]], 24, 32) },
];
// and shells keep rising all round the village for the whole flight
for (let k = 0; k < 52; k++) CUES.push({ t: 1.5 + k * 0.48, fn: () => {
  const a = Math.random() * Math.PI * 2, r = 38 + Math.random() * 40;
  const from = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
  sparks.rocket(from, from.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 24 + Math.random() * 24, (Math.random() - 0.5) * 4)));
} });
CUES.sort((a, b) => a.t - b.t);
let wantMusic = false;
// the background song: the chorus of Ram Aayenge, looping softly under the village. It dips under the
// guide, the aarti and the bhajans, and steps aside when a song is playing in the YouTube player.
const bgSong = new Audio("assets/audio/ram-aayenge-chorus.m4a");
bgSong.loop = true; bgSong.preload = "none"; bgSong.volume = 0;
let bgWant = false, bgVol = 0;
const bgBtn = document.querySelector("[data-bgsong]");
function paintBg() { bgBtn.setAttribute("aria-pressed", String(me.bgSong !== false)); bgBtn.querySelector("span:last-child").textContent = me.bgSong !== false ? "Background song: on" : "Background song: off"; }
paintBg();
function startBgSong() { if (me.bgSong === false) return; bgWant = true; bgSong.play().catch(() => {}); }
bgBtn.addEventListener("click", () => {
  me.bgSong = me.bgSong === false; remember(); paintBg();
  if (me.bgSong) startBgSong(); else bgWant = false;
  toast(me.bgSong ? "राम आएंगे · the song plays softly in the background" : "Background song off");
});
function updateBgSong(dt, duck) {
  const target = bgWant && !music.playing ? (duck ? 0.14 : 0.5) : 0;
  bgVol += (target - bgVol) * Math.min(1, dt * 1.6);
  bgSong.volume = Math.max(0, Math.min(1, bgVol));
  if (!bgWant && bgVol < 0.01 && !bgSong.paused) bgSong.pause();
}
function volley(points, hMin, hMax, type) {
  points.forEach(([x, , z], i) => setTimeout(() => {
    const from = new THREE.Vector3(x, 0, z);
    sparks.rocket(from, from.clone().add(new THREE.Vector3(Math.random() * 4 - 2, hMin + Math.random() * (hMax - hMin), Math.random() * 4 - 2)), type);
    sound.launch();
  }, i * 260));
}
function intro(thenStop = 0) {
  const n = SHOTS.length, DUR = SHOTS[n - 1].t;
  // coming from the welcome loop: carry on from where the flight is, with every lamp already lit
  const startAt = hovering ? Math.min(backdropTime, DUR) : 0;
  const r0 = hovering ? 1e5 : 0;
  hovering = false;
  let t0 = startAt, cue = CUES.findIndex((c) => c.t > startAt);
  if (cue < 0) cue = CUES.length;
  // the light spreads from the temple
  reveal.value.set(0, -33, r0, 12);
  ui.title.hidden = false;
  ui.title.classList.add("is-on");
  ui.letterbox.classList.add("is-on");
  ui.panel.hidden = true;
  document.body.classList.add("is-intro");
  const done = () => {
    tour.ride = null;
    reveal.value.set(0, 10, 1e5, 12);
    current = thenStop;
    tour.s = tour.target = STOPS[thenStop].key;
    camera.fov = innerWidth < innerHeight ? 72 : 58;
    camera.updateProjectionMatrix();
    ui.title.classList.remove("is-on");
    ui.letterbox.classList.remove("is-on");
    document.body.classList.remove("is-intro");
    introEnded = performance.now();
    setTimeout(() => (ui.title.hidden = true), 1200);
    canvas.removeEventListener("pointerdown", skip);
    showStop(current);
    ui.panel.hidden = false;
    if (wantMusic) startBgSong(); // the song rises as the drone lands
    // as the camera settles in the lane, the fireworks above come together into the words
    if (thenStop === 0) {
      volley([[-10, 0, 20], [10, 0, 18], [0, 0, 14]], 22, 28, "willow");
      setTimeout(() => {
        // with a guest's name to follow, lift the greeting so their name clears the rooftops beneath it
        let at = null;
        if (invite) { const f = new THREE.Vector3(); camera.getWorldDirection(f); f.y = 0; f.normalize(); at = camera.position.clone().addScaledVector(f, 78); at.y = 31; }
        textShell(greet(), { hold: invite ? 11 : 7.2, at });
      }, 1200);
      if (invite) setTimeout(() => textShell(invite.to, { under: true, color: [1, 0.55, 0.78], hold: 9 }), 3400);
    }
    // the walking hint waits until the words in the sky have had their moment
    setTimeout(() => { if (tour.mode !== "free") ui.hint.classList.add("is-on"); }, thenStop === 0 ? 9500 : 1500);
    setTimeout(() => ui.hint.classList.remove("is-on"), thenStop === 0 ? 15500 : 7500);
    setTimeout(() => toast(welcome), 1800);
    if (lastYear) setTimeout(() => toast(`पिछली दिवाली (${lastYear.y}) आपने ${lastYear.places} जगहें देखीं${lastYear.homes ? `, ${lastYear.homes} घर रोशन किए` : ""} · Welcome back for Diwali ${thisYear}`), 5200);
    if (invite?.gift) setTimeout(() => openMithaiBox(invite.gift, invite.from), thenStop === 0 ? 12500 : 3000);
    if (!me.tips) setTimeout(() => showTips(), 10500); // after the words in the sky have had their moment
    else setTimeout(() => toast("✦ Explore, top right, has everything you can do"), 9000);
    if (sharedSpot) setTimeout(() => {
      // someone sent this exact spot: stand there, facing the way they faced
      toggleFree(true);
      tour.free.pos.set(sharedSpot[0], 1.6, sharedSpot[1]);
      tour.free.yaw = sharedSpot[2]; tour.free.pitch = 0;
      tour.resolve(tour.free.pos);
      toast("Someone shared this spot with you");
    }, 600);
  };
  const skip = () => { if (tour.ride) done(); };
  canvas.addEventListener("pointerdown", skip);
  const clock0 = performance.now() - startAt * 1000;
  tour.ride = (dt, cam) => {
    t0 = (performance.now() - clock0) / 1000; // real time, so a slow frame rate never turns it into slow motion
    flightPose(Math.min(DUR, t0), t0, cam);
    reveal.value.z = Math.max(r0, Math.max(0, (t0 - 2.5) / 15) ** 1.25 * 170);
    while (cue < CUES.length && t0 >= CUES[cue].t) CUES[cue++].fn();
    if (t0 >= DUR) done();
  };
}

const meName = document.querySelector("[data-me-name]"), meBack = document.querySelector("[data-me-back]");
meName.value = invite ? invite.to : me.name; // whoever opened the invite is the one it was meant for
if (invite) {
  if (invite.photo) {
    const cover = document.createElement("div");
    cover.className = "loader__cover"; cover.setAttribute("role", "img"); cover.setAttribute("aria-label", `A photo from ${invite.from || "the person who invited you"}`);
    cover.style.backgroundImage = `url(${invite.photo})`;
    meBack.before(cover);
  }
  meBack.hidden = false;
  meBack.textContent = invite.gift
    ? `${invite.from ? `${invite.from} ने आपके लिए मिठाई का डिब्बा भेजा है` : "आपके लिए मिठाई का डिब्बा आया है"} · ${invite.from ? `${invite.from} sent you a box of sweets` : "A box of sweets is waiting for you"}, ${invite.to}. Come in and open it!`
    : `${invite.from ? `${invite.from} ने आपको दिवाली पर बुलाया है` : "आपको दिवाली का न्योता है"} · ${invite.from ? `${invite.from} has invited you` : "You're invited"}, ${invite.to}. Shubh Deepavali!`;
}
if (!invite && me.visits > 0 && !location.hash) {
  const at = STOPS[me.lastStop] || STOPS[0];
  meBack.hidden = false;
  meBack.textContent = `${me.name ? `Welcome back, ${me.name}.` : "Welcome back."} You'll carry on from ${at.en.toLowerCase()} · ${me.seen.length} of ${STOPS.length} places seen${me.hunt.length ? `, ${me.hunt.length} hidden diyas lit` : ""}. `;
  if (me.lastStop > 0) {
    const over = document.createElement("button");
    over.type = "button"; over.className = "loader__over"; over.textContent = "Start from the lane instead";
    over.addEventListener("click", () => { me.lastStop = 0; remember(); over.remove(); meBack.textContent = `${me.name ? `Welcome back, ${me.name}.` : "Welcome back."} The walk starts again from the lane.`; });
    meBack.appendChild(over);
  }
}
meName.addEventListener("keydown", (e) => { if (e.key === "Enter" && !ui.enter[0].disabled) ui.enter[0].click(); });
let lastYear = null; // last Diwali's diary page, for the welcome-back note after the intro
ui.enter.forEach((b) => b.addEventListener("click", async () => {
  me.name = meName.value.replace(/[^\p{L}\p{M}\p{N} .&'-]/gu, "").trim().slice(0, 22);
  const returning = me.visits > 0;
  me.visits++;
  // a new Diwali: last year goes into the diary, this year's walk starts afresh
  lastYear = null;
  if (me.year && me.year !== thisYear) {
    lastYear = me.diary?.[me.year] && { y: me.year, ...me.diary[me.year] };
    Object.assign(me, { seen: [], hunt: [], daysSeen: [], myLit: [], bag: {}, stats: ME0().stats });
  }
  me.year = thisYear;
  if (!invite && !location.hash && returning && me.lastStop > 0) history.replaceState(null, "", `#${STOPS[me.lastStop].id}`);
  remember();
  guide.name = me.name;
  restoreProgress();
  applyFamily(); applyHouse();
  // during the festival, open on the day it really is (unless they picked another day today)
  if (todayFest && me.dayChosenOn !== todayKey) day = DAYS.find((d) => d.id === todayFest);
  if (day.id !== "lakshmi") setDay(day.id, { travel: false });
  const hr = new Date().getHours();
  const tod = hr >= 4 && hr < 12 ? "सुप्रभात" : hr < 17 ? "नमस्ते" : "शुभ संध्या";
  if (invite) welcome = `${invite.from ? `${invite.from} ने आपको बुलाया है` : "आपको न्योता है"} · ${greet()}, ${invite.to}`;
  else welcome = returning ? (me.name ? `${tod} ${me.name} जी, फिर से स्वागत है · Welcome back` : `${tod}, फिर से स्वागत है · Welcome back`) : (me.name ? `${tod} ${me.name} जी, स्वागत है · Welcome to the village` : `${tod}, स्वागत है · Welcome to the village`);
  if (hr >= 0 && hr < 4) setTimeout(() => toast(`${me.name ? me.name + ", " : ""}it's late where you are, and the village is still up too`), 14000);
  if (b.dataset.enter === "sound" && guide.mode === "off" && (() => { try { return localStorage.getItem("guide") === null; } catch (_) { return false; } })()) {
    guide.mode = me.lang === "en" ? "en" : "hi";
    try { localStorage.setItem("guide", guide.mode); } catch (_) { /* fine */ }
    paintGuide();
  }
  if (b.dataset.enter !== "sound") { setSound(false); document.querySelector("[data-gate-sound]").hidden = true; } // quietly means quiet
  if (b.dataset.enter === "sound") { bgSong.play().then(() => { if (!bgWant) bgSong.pause(); }).catch(() => {}); await setSound(true); wantMusic = true; }
  ui.loader.classList.add("is-done");
  document.body.classList.remove("at-gate");
  setTimeout(() => ui.loader.remove(), 1200);
  const [hashStop, spot] = location.hash.slice(1).split("@");
  const fromHash = STOPS.findIndex((s) => s.id === hashStop);
  sharedSpot = spot ? spot.split(",").map(Number) : null;
  if (sharedSpot && (sharedSpot.length !== 3 || sharedSpot.some((n) => !Number.isFinite(n)))) sharedSpot = null;
  current = Math.max(0, fromHash);
  tour.s = tour.target = STOPS[current].key;
  ui.hud.hidden = false;
  ui.lantern.hidden = false;
  rail.hidden = false;
  drawMapBase();
  ui.mapToggle.hidden = false;
  // the map stays closed until opened from the menu
  if (!reduceMotion && !me.calm) { intro(fromHash > 0 ? fromHash : 0); return; }
  if (hovering) { hovering = false; tour.ride = null; reveal.value.set(0, 10, 1e5, 12); }
  if (wantMusic) startBgSong();
  showStop(current);
  ui.panel.hidden = false;
  ui.hint.classList.add("is-on");
  setTimeout(() => ui.hint.classList.remove("is-on"), 6000);
  // without the flight (calm mode): the same welcome, the guest's name in the sky, and any gift waiting
  introEnded = performance.now();
  setTimeout(() => toast(welcome), 1200);
  if (invite && current === 0) {
    setTimeout(() => { const f = new THREE.Vector3(); camera.getWorldDirection(f); f.y = 0; f.normalize(); const at = camera.position.clone().addScaledVector(f, 78); at.y = 31; textShell(greet(), { hold: 11, at }); }, 1500);
    setTimeout(() => textShell(invite.to, { under: true, color: [1, 0.55, 0.78], hold: 9 }), 3700);
  }
  if (invite?.gift) setTimeout(() => openMithaiBox(invite.gift, invite.from), invite && current === 0 ? 9000 : 2500);
}));

/* ---------- Diwali songs ---------- */
const M_ = {
  card: document.querySelector("[data-music]"),
  open: document.querySelector("[data-music-open]"),
  title: document.querySelector("[data-music-title]"),
  play: document.querySelector("[data-music-play]"),
  listBtn: document.querySelector("[data-music-list]"),
  panel: document.querySelector("[data-music-panel]"),
  tracks: document.querySelector("[data-music-tracks]"),
  note: document.querySelector("[data-music-note]"),
};
const music = new Music("yt-player", {
  onState: (m, err) => {
    M_.title.textContent = m.title();
    M_.play.textContent = m.playing ? "⏸" : "▶";
    M_.tracks.querySelectorAll("button").forEach((b, i) => b.setAttribute("aria-current", String(!m.custom && i === m.index)));
    if (err) M_.note.textContent = err;
    sound.setDrone(!m.playing); // the tanpura steps aside for songs
  },
});
TRACKS.forEach((t, i) => {
  const li = document.createElement("li"), b = document.createElement("button");
  b.type = "button";
  const tt = document.createElement("b"); tt.textContent = t.title;
  const by = document.createElement("small"); by.textContent = t.by;
  b.append(tt, by);
  b.addEventListener("click", () => music.play(i));
  li.appendChild(b); M_.tracks.appendChild(li);
});
if (Number.isInteger(me.track)) music.index = me.track;
if (Number.isFinite(me.vol)) { music.volume = me.vol; const v = document.querySelector("[data-music-vol]"); if (v) v.value = me.vol; }
{ const play = music.play.bind(music); music.play = (i) => play(i).then(() => { if (!music.custom) { me.track = music.index; remember(); } }); }
function openMusic(autoplay = true) {
  M_.card.hidden = false;
  document.body.classList.add("music-open");
  M_.open.setAttribute("aria-pressed", "true");
  if (autoplay) music.play(music.index);
}
M_.open.addEventListener("click", () => {
  if (M_.card.hidden) openMusic(true);
  else { M_.card.hidden = true; document.body.classList.remove("music-open"); music.player?.pauseVideo(); M_.open.setAttribute("aria-pressed", "false"); }
});
document.querySelector("[data-music-close]").addEventListener("click", () => { music.player?.stopVideo(); M_.card.hidden = true; document.body.classList.remove("music-open"); M_.open.setAttribute("aria-pressed", "false"); sound.setDrone(true); });
M_.play.addEventListener("click", () => music.toggle());
document.querySelector("[data-music-next]").addEventListener("click", () => music.next());
document.querySelector("[data-music-prev]").addEventListener("click", () => music.prev());
document.querySelector("[data-music-vol]").addEventListener("input", (e) => { music.setVolume(Number(e.target.value)); me.vol = Number(e.target.value); remember(); });
M_.listBtn.addEventListener("click", () => { M_.panel.hidden = !M_.panel.hidden; M_.listBtn.setAttribute("aria-expanded", String(!M_.panel.hidden)); });
document.querySelector("[data-music-paste]").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = e.target.elements.link;
  const ok = await music.playLink(input.value);
  M_.note.textContent = ok ? "Playing your link." : "That doesn't look like a YouTube link. Try one like youtube.com/watch?v=…";
  if (ok) input.value = "";
});

/* ---------- the ⋯ menu ---------- */
const moreBtn = document.querySelector("[data-more]"), menu = document.querySelector("[data-menu]");
const closeMenu = () => { menu.hidden = true; moreBtn.setAttribute("aria-expanded", "false"); };
moreBtn.addEventListener("click", (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; moreBtn.setAttribute("aria-expanded", String(!menu.hidden)); });
menu.addEventListener("click", (e) => { if (e.target.closest("button")) closeMenu(); });
addEventListener("pointerdown", (e) => { if (!menu.hidden && !e.target.closest(".more")) closeMenu(); });
addEventListener("keydown", (e) => { if (e.code === "Escape") closeMenu(); });
document.querySelector("[data-menu-lantern]").addEventListener("click", () => ui.lantern.click());
const mapItem = document.querySelector("[data-menu-map]");
mapItem.addEventListener("click", () => {
  ui.map.hidden = !ui.map.hidden;
  mapItem.setAttribute("aria-pressed", String(!ui.map.hidden));
  if (!ui.map.hidden) drawMap();
});

/* ---------- clean view: just the village, nothing on top ---------- */
const cleanBtn = document.querySelector("[data-clean]");
function setClean(on) {
  document.body.classList.toggle("is-clean", on);
  cleanBtn.setAttribute("aria-pressed", String(on));
  cleanBtn.querySelector("span:last-child").textContent = on ? "Show panels" : "Clean view";
  document.body.classList.toggle("clean-hint", on);
}
cleanBtn.addEventListener("click", () => setClean(!document.body.classList.contains("is-clean")));
addEventListener("keydown", (e) => {
  if (e.code !== "KeyH" || (e.target.closest && e.target.closest("input, textarea")) || document.querySelector("dialog[open]")) return;
  setClean(!document.body.classList.contains("is-clean"));
});

/* ---------- shopping: tap a stall or shop, buy into your jhola ---------- */
// [Hindi name, English name, note, price, cracker kind, how many you get]
const CRACKERS = [
  ["अनार", "Anar, box of 5", "A golden fountain of sparks", 200, "anar", 5],
  ["चकरी", "Chakri, box of 5", "Spins and whistles on the ground", 150, "chakri", 5],
  ["फुलझड़ी", "Phuljhadi, 10 sticks", "Sparklers to hold in your hand", 80, "phuljhadi", 10],
  ["रॉकेट", "Rocket, pack of 5", "Whistles up and bursts", 250, "rocket", 5],
  ["सुतली बम", "Sutli bomb, 5", "The loud one. Step back!", 120, "bomb", 5],
  ["लड़ी", "Ladi, 100 shots", "A long string that rattles off", 180, "ladi", 1],
  ["स्काई शॉट", "Sky shot, 12 in one", "A volley into the sky", 600, "skyshot", 1],
];
const SHOP_ITEMS = {
  patakhe: CRACKERS, patakheShop: CRACKERS,
  laiya: [["लइया, 1 किलो", "Laiya, 1 kg", "Puffed rice, offered to Lakshmi ji", 60], ["खील, 500 ग्राम", "Khil, 500 g", "Popped paddy for the puja thali", 40], ["बताशे, 500 ग्राम", "Batashe, 500 g", "Sugar drops that melt on the tongue", 50], ["गट्टा, 250 ग्राम", "Gatta, 250 g", "Crunchy sugar sticks, white and pink", 40], ["चीनी के खिलौने", "Sugar toys, 5", "A haathi, a ghoda, a little mandir in sugar", 80], ["पूजा का पैकेट", "Puja packet", "Khil, batashe and laiya, ready for the thali", 120]],
  laiyaShop: [["खील-बताशे का पैकेट", "Khil-batashe packet", "Enough for the puja and the prasad after", 90], ["लइया, 2 किलो", "Laiya, 2 kg", "For the whole mohalla", 110], ["गट्टा, 500 ग्राम", "Gatta, 500 g", "White and pink", 75], ["चीनी के खिलौने, 10", "Sugar toys, 10", "The children's favourite", 150], ["मुरमुरे, 1 किलो", "Murmura, 1 kg", "For bhel tomorrow", 70], ["इलायची दाना", "Elaichi dana, 250 g", "Sugar-coated cardamom seeds", 60]],
  paan: [["मीठा पान", "Meetha paan", "Gulkand, coconut and saunf", 30], ["बनारसी पान", "Banarasi paan", "Katha, chuna and elaichi", 20], ["सौंफ-सुपारी", "Saunf-supari", "After the Diwali feast", 10], ["इलायची, 10 ग्राम", "Elaichi, 10 g", "Green cardamom", 40], ["ठंडी बोतल", "Cold drink", "From the ice box", 20]],
  murti: [["गणेश जी की मूर्ति", "Ganesh ji murti, clay", "Painted by the kumhar's family", 451], ["लक्ष्मी जी की मूर्ति", "Lakshmi ji murti", "Seated on a lotus", 551], ["लक्ष्मी-गणेश जोड़ी", "Lakshmi-Ganesh pair", "For tonight's puja", 899], ["चाँदी का सिक्का", "Silver coin", "Lakshmi and Ganesh embossed", 1100]],
  chudi: [["काँच की चूड़ियाँ", "Glass bangles, a dozen", "Red and green for the festival", 120], ["बिंदी का पत्ता", "Bindi packet", "Velvet, in every colour", 20], ["मेहंदी कोन", "Mehendi cone", "For the hands before the puja", 30]],
  diyas: [["मिट्टी के दीये", "Clay diyas, 12", "Thrown on the wheel this week", 120], ["रंगीन दीये", "Painted diyas, 6", "Dotted and banded", 240], ["रुई की बत्ती", "Cotton wicks, 100", "Hand-rolled", 40], ["तिल का तेल", "Til oil, 500 ml", "For the lamps", 180]],
  khilone: [["मिट्टी का घोड़ा", "Clay horse", "Painted by hand", 60], ["गुब्बारा", "Balloon", "Any colour you like", 10], ["फिरकी", "Paper pinwheel", "Spins in the breeze", 20], ["मिट्टी की सीटी", "Clay whistle", "Shaped like a bird", 15]],
  rangoli: [["रंगोली रंग, एक कटोरी", "Colour, one katori", "Bright, fine-ground powder", 20], ["फूल का साँचा", "Flower stencil", "Punched steel disc", 149], ["सफ़ेद रंगोली, 1 किलो", "White rangoli powder, 1 kg", "For outlines and dots", 60]],
  mithai: [["काजू कतली", "Kaju katli, 500 g", "Under a sheet of silver varak", 560], ["मोतीचूर लड्डू", "Motichoor ladoo, 500 g", "Soft and fresh", 320], ["गरम जलेबी", "Jalebi, 250 g", "Hot from the kadhai", 110], ["गुलाब जामुन", "Gulab jamun, 10", "In rose-cardamom syrup", 280]],
  mithaiShop: [["काजू कतली", "Kaju katli, 500 g", "Under a sheet of silver varak", 560], ["सोन पापड़ी", "Soan papdi box", "The Diwali gift", 180], ["बेसन लड्डू", "Besan ladoo, 500 g", "Pure desi ghee", 300], ["मेवे का डिब्बा", "Dry fruit box", "Almonds, cashews, pistachios", 850]],
  kirana: [["चीनी, 5 किलो", "Sugar, 5 kg", "For the halwa and kheer", 230], ["देसी घी, 1 किलो", "Desi ghee, 1 kg", "For the puris", 620], ["पूजा सामग्री", "Puja samagri", "Roli, chawal, kalawa, camphor", 150], ["खील-बताशे", "Kheel-batashe", "Offered to Lakshmi ji tonight", 60]],
  bartan: [["स्टील की थाली", "Steel thali", "A new one for Dhanteras", 350], ["पीतल की पूजा थाली", "Brass puja thali", "With a little diya", 480], ["लोहे की कड़ाही", "Iron kadhai", "For the puris", 700]],
  kapda: [["सूती साड़ी", "Cotton sari", "With a zari border", 1200], ["कुर्ता पायजामा", "Kurta pyjama", "For the puja", 650], ["बच्ची का लहँगा", "Girl's lehenga", "Her Diwali dress", 450]],
  decoration: [["एलईडी लड़ी, 10 मीटर", "LED string, 10 m", "Warm white", 299], ["काग़ज़ की कंदील", "Paper kandil", "A star for the window", 349], ["गेंदे का तोरण", "Marigold toran", "Fresh for the door", 199]],
  mobile: [["मोबाइल रिचार्ज", "Mobile recharge", "So the family abroad can call", 299], ["ईयरफ़ोन", "Earphones", "For the bhajans", 350], ["फ़ोटोकॉपी", "Photocopy", "One page", 2]],
  phool: [["गेंदे की माला", "Marigold mala", "For the door and the murti", 60], ["गुलाब की पंखुड़ियाँ", "Rose petals, a bag", "For the puja thali", 50], ["कमल का फूल", "Lotus", "Lakshmi ji's flower", 30]],
};
const SHOP_NOTES = {
  patakhe: "Green crackers only, as many towns now ask. Light them outdoors and keep a bucket of water near.",
  patakheShop: "The licensed cracker shop. Everything you buy goes into Your crackers, ready to light.",
  laiya: "Khil-batashe and laiya go on the Lakshmi Puja thali, then everyone shares them as prasad. No Diwali in the village goes without them.",
  laiyaShop: "Sacks of laiya, khil and murmura, paraats of batashe and gatta, and sugar toys for the children.",
  paan: "Every gathering ends at the paan shop. Tonight the paanwala stays open past midnight.",
};
const GREET = [["आइए भैया, क्या चाहिए?", "Come, brother, what would you like?"], ["आइए दीदी, सब ताज़ा है!", "Come, didi, it's all fresh!"], ["दिवाली का माल, सबसे सस्ता!", "Diwali stock, cheapest in town!"], ["देख लीजिए, देखने के पैसे नहीं!", "Have a look, looking is free!"]];
const ACCEPT = [["चलो, आपके लिए यही सही", "Fine, for you, done"], ["दिवाली है, ले जाइए", "It's Diwali, take it"], ["ठीक है, बोहनी का टाइम है", "All right, it's my first sale of the hour"]];
const COUNTER = [["₹%, इससे कम नहीं", "₹%, not a paisa less"], ["अच्छा, ₹% दे दीजिए", "All right, give me ₹%"], ["आप भी क्या याद करेंगे, ₹%", "Something to remember me by: ₹%"]];
const HURT = [["इतने में तो कच्चा माल नहीं आता!", "That won't even buy the raw stuff!"], ["भैया, मज़ाक मत कीजिए", "Brother, don't joke"], ["अरे, घाटे में नहीं बेचेंगे!", "I won't sell at a loss!"]];
const FIRM = ["बस, आख़िरी दाम ₹%। लेना है तो लीजिए", "That's my last price, ₹%. Take it or leave it"];
const CALLBACK = [["अरे सुनिए, सुनिए! चलिए ₹% दे दीजिए", "Hey, wait, wait! All right, give me ₹%"], ["आइए आइए, ₹% में ले जाइए, बस आपके लिए", "Come back, take it for ₹%, just for you"]];
const LET_GO = ["ठीक है, घूम आइए। ऐसा माल कहीं नहीं मिलेगा", "Fine, look around. You won't find this anywhere else"];
// a little extra, the way shopkeepers do for a good customer
const FREEBIE = {
  laiya: ["एक मुट्ठी बताशे, बच्चों के लिए", "A fistful of batashe, for the children"], laiyaShop: ["एक मुट्ठी बताशे, बच्चों के लिए", "A fistful of batashe, for the children"],
  paan: ["एक सौंफ की पुड़िया", "A twist of saunf"], mithai: ["एक गरम जलेबी चख लीजिए", "Taste a hot jalebi"], mithaiShop: ["एक काजू कतली चखिए", "Try a piece of kaju katli"],
  phool: ["एक गुलाब, आपके लिए", "One rose, for you"], diyas: ["दो दीये और, मुफ़्त", "Two extra diyas, free"], kirana: ["धनिया-मिर्ची, मुफ़्त", "Coriander and chillies, free"],
  patakhe: ["दो फुलझड़ी, बच्चों के लिए", "Two sparklers for the children", "phuljhadi", 2], patakheShop: ["दो फुलझड़ी, बच्चों के लिए", "Two sparklers for the children", "phuljhadi", 2],
  khilone: ["एक गुब्बारा, मुफ़्त", "A balloon, free"],
};
const NOTES = [500, 200, 100, 50, 20, 10];
const jhola = { total: 0, items: [] };
const bag = {}; // cracker kind -> count
me.batua ??= 2100; // Dadi's shagun, spent at the shops
me.shops ||= {};   // what each shopkeeper remembers of you
const shopUI = {
  dialog: document.querySelector("[data-shop-dialog]"),
  hi: document.querySelector("[data-shop-hi]"),
  title: document.querySelector("[data-shop-title]"),
  note: document.querySelector("[data-shop-note]"),
  items: document.querySelector("[data-shop-items]"),
  sum: document.querySelector("[data-jhola-sum]"),
  batua: document.querySelector("[data-batua]"),
  counter: document.querySelector("[data-counter]"),
  parchi: document.querySelector("[data-parchi]"),
};
const rupees = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
const pick2 = (a) => a[(Math.random() * a.length) | 0];
const fill = ([hi, en], n) => [hi.replace("%", n), en.replace("%", n)];
// prices the way they are spoken: ₹437 becomes ₹440, ₹63 becomes ₹65
const roundPrice = (n) => n >= 200 ? Math.round(n / 10) * 10 : n >= 40 ? Math.round(n / 5) * 5 : Math.max(1, Math.round(n));
// a line spoken by a particular villager, in their speech bubble
function sayAs(p, [hi, en]) {
  ui.bubble.querySelector("[data-bubble-hi]").textContent = hi;
  ui.bubble.querySelector("[data-bubble-en]").textContent = en;
  ui.bubble.hidden = false;
  ui.bubble.classList.remove("is-on"); void ui.bubble.offsetWidth; ui.bubble.classList.add("is-on");
  bubbleFor = p; bubbleT = 3.6;
  sound.blip();
}
const keeperSays = (line) => { if (visit?.shop.keeper) sayAs(visit.shop.keeper, line); else toast(`${line[0]} · ${line[1]}`); };
let visit = null; // the shop you are standing at
const askOf = (i) => {
  const base = SHOP_ITEMS[visit.shop.kind][i][3];
  return visit.deal[i] ?? visit.ask[i] ?? roundPrice(base * (1 - visit.discount));
};
function renderShopItems() {
  const list = SHOP_ITEMS[visit.shop.kind] || [];
  shopUI.items.innerHTML = "";
  list.forEach(([hi, en, note, price0], i) => {
    const price = askOf(i);
    const li = el("li"), text = el("div");
    const h = el("h4", null, hi), e = el("span", "shop__en", en), p = el("p", null, note);
    h.lang = "hi";
    text.append(h, e, p);
    const pr = el("span", "price");
    if (price < price0) pr.append(el("s", null, rupees(price0)), document.createTextNode(" " + rupees(price)));
    else pr.textContent = rupees(price);
    if (visit.deal[i] != null) pr.classList.add("is-deal");
    const row = el("div", "shop__btns");
    const buy = el("button", "btn " + (visit.deal[i] != null ? "btn--solid" : "btn--ghost"), "ख़रीदें · Buy");
    buy.type = "button";
    buy.addEventListener("click", () => openPay(i));
    row.append(buy);
    // small things have a fixed price; no one haggles over a ₹10 paan
    if (price0 >= 40 && visit.deal[i] == null && !visit.firm[i]) {
      const hg = el("button", "btn btn--ghost", "मोल-भाव · Haggle");
      hg.type = "button";
      hg.addEventListener("click", () => openHaggle(i));
      row.append(hg);
    }
    li.append(text, pr, row);
    shopUI.items.appendChild(li);
  });
  shopUI.sum.textContent = rupees(jhola.total);
  shopUI.batua.textContent = rupees(me.batua);
  shopUI.parchi.hidden = !visit.bought.length;
}
function counterPanel() {
  shopUI.counter.innerHTML = "";
  shopUI.counter.hidden = false;
  shopUI.counter.classList.remove("is-on"); void shopUI.counter.offsetWidth; shopUI.counter.classList.add("is-on");
  shopUI.counter.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  return shopUI.counter;
}
function closeCounter() { shopUI.counter.hidden = true; shopUI.counter.innerHTML = ""; renderShopItems(); }

// मोल-भाव: you offer, the shopkeeper counters, and if you walk away he may call you back
function openHaggle(i) {
  const [hi, en, , price0] = SHOP_ITEMS[visit.shop.kind][i];
  const regular = (me.shops[visit.shop.kind]?.n || 0) >= 2;
  visit.floor[i] ??= roundPrice(price0 * (0.7 + Math.random() * 0.14 - (regular ? 0.04 : 0)));
  visit.ask[i] ??= askOf(i);
  visit.patience[i] ??= 3;
  const paint = () => {
    const ask = visit.ask[i], c = counterPanel();
    const head = el("p", "counter__head");
    head.append(el("b", null, hi), el("span", null, `${en} · दुकानदार कहता है ${rupees(ask)}`));
    c.append(head);
    if (visit.patience[i] <= 0) {
      c.append(el("p", "counter__note", `Last price ${rupees(ask)}. Buy it, or walk away.`));
    } else {
      c.append(el("p", "counter__note", "आप कितना देंगे? · What will you offer?"));
      const offers = el("div", "counter__chips");
      const seen = new Set();
      for (const f of [0.6, 0.75, 0.88]) {
        const o = roundPrice(ask * f);
        if (o >= ask || seen.has(o)) continue;
        seen.add(o);
        const b = el("button", "chip", rupees(o)); b.type = "button";
        b.addEventListener("click", () => offer(o));
        offers.append(b);
      }
      c.append(offers);
    }
    const acts = el("div", "counter__acts");
    const buy = el("button", "btn btn--solid", `${rupees(ask)} में लो · Buy`); buy.type = "button";
    buy.addEventListener("click", () => { visit.deal[i] = ask; openPay(i); });
    const walk = el("button", "btn btn--ghost", "चलते हैं · Walk away"); walk.type = "button";
    walk.addEventListener("click", walkAway);
    acts.append(buy, walk);
    c.append(acts);
  };
  const offer = (o) => {
    const ask = visit.ask[i], floor = visit.floor[i];
    visit.patience[i]--;
    if (o >= floor) {
      visit.deal[i] = o; keeperSays(pick2(ACCEPT)); sound.coin();
      toast(`सौदा पक्का! ${rupees(o)} · Deal at ${rupees(o)}`);
      closeCounter();
      return;
    }
    if (o < ask * 0.66 && Math.random() < 0.55) keeperSays(pick2(HURT));
    else {
      // meet somewhere in the middle, never below his floor
      const next = Math.max(floor, roundPrice(o + (ask - o) * (0.45 + Math.random() * 0.2)));
      visit.ask[i] = Math.min(ask, next);
      if (visit.patience[i] <= 0) { visit.ask[i] = Math.max(floor, visit.ask[i]); keeperSays(fill(FIRM, visit.ask[i])); }
      else keeperSays(fill(pick2(COUNTER), visit.ask[i]));
    }
    paint(); renderShopItems();
  };
  const walkAway = () => {
    const ask = visit.ask[i], floor = visit.floor[i];
    closeCounter();
    if (ask > floor && Math.random() < 0.75) {
      setTimeout(() => {
        if (!visit) return;
        visit.ask[i] = floor; visit.patience[i] = 0;
        keeperSays(fill(pick2(CALLBACK), floor));
        const c = counterPanel();
        c.append(el("p", "counter__head", ""));
        c.firstChild.append(el("b", null, "वो बुला रहा है!"), el("span", null, `He's calling you back: ${en} for ${rupees(floor)}`));
        const acts = el("div", "counter__acts");
        const yes = el("button", "btn btn--solid", `ठीक है, ${rupees(floor)} · Deal`); yes.type = "button";
        yes.addEventListener("click", () => { visit.deal[i] = floor; sound.coin(); closeCounter(); openPay(i); });
        const no = el("button", "btn btn--ghost", "नहीं चाहिए · No thanks"); no.type = "button";
        no.addEventListener("click", closeCounter);
        acts.append(yes, no); c.append(acts);
        renderShopItems();
      }, 1100);
    } else {
      visit.firm[i] = true;
      keeperSays(LET_GO);
      renderShopItems();
    }
  };
  paint();
}

// pay: notes from the batua, counted change back, or the UPI box on the counter
function openPay(i) {
  const [hi, en, , , cracker, count] = SHOP_ITEMS[visit.shop.kind][i];
  const price = askOf(i);
  let given = [];
  const paint = () => {
    const c = counterPanel(), sum = given.reduce((a, b) => a + b, 0);
    const head = el("p", "counter__head");
    head.append(el("b", null, `${rupees(price)} देने हैं`), el("span", null, `${en} · in your batua ${rupees(me.batua - sum)}`));
    c.append(head);
    const tray = el("div", "counter__tray");
    if (!given.length) tray.append(el("span", "counter__empty", "Tap notes to put them on the counter"));
    given.forEach((n, k) => {
      const b = el("button", `note note--${n}`, rupees(n)); b.type = "button"; b.title = "Take it back";
      b.addEventListener("click", () => { given.splice(k, 1); paint(); });
      tray.append(b);
    });
    c.append(tray);
    const notes = el("div", "counter__notes");
    for (const n of NOTES) {
      const b = el("button", `note note--${n}`, rupees(n)); b.type = "button";
      b.disabled = sum + n > me.batua || sum >= price;
      b.addEventListener("click", () => { given.push(n); sound.blip(); paint(); });
      notes.append(b);
    }
    c.append(notes);
    const acts = el("div", "counter__acts");
    const hand = el("button", "btn btn--solid", sum >= price ? `${rupees(sum)} दे दो · Hand it over` : `${rupees(price - sum)} और · ${rupees(price - sum)} more`);
    hand.type = "button"; hand.disabled = sum < price;
    hand.addEventListener("click", () => payCash(sum));
    const upi = el("button", "btn btn--ghost", "UPI से · Scan to pay"); upi.type = "button";
    upi.addEventListener("click", payUpi);
    const back = el("button", "btn btn--ghost", "रहने दो · Not now"); back.type = "button";
    back.addEventListener("click", closeCounter);
    acts.append(hand, upi, back);
    c.append(acts);
    if (me.batua < price) c.append(el("p", "counter__note", "बटुए में कम है · Not enough in the batua. Pay by UPI."));
  };
  const payCash = (sum) => {
    me.batua -= sum;
    let change = sum - price;
    const c = counterPanel();
    const head = el("p", "counter__head");
    head.append(el("b", null, change ? `${rupees(change)} वापस` : "पूरे पैसे"), el("span", null, change ? "He counts your change back" : "Exact money, he smiles"));
    const tray = el("div", "counter__tray");
    c.append(head, tray);
    // no change for a few rupees? a toffee instead, every Indian has had one
    let toffee = 0;
    if (change % 5 && Math.random() < 0.7) { toffee = change % 5; change -= toffee; }
    const pieces = [];
    for (const d of [200, 100, 50, 20, 10, 5, 2, 1]) while (change >= d) { pieces.push(d); change -= d; }
    keeperSays(pieces.length || toffee ? [`ये लीजिए, ${rupees(sum - price)} वापस` + (toffee ? ", छुट्टे नहीं हैं, एक टॉफ़ी ले लो" : ""), `Here, ${rupees(sum - price)} back` + (toffee ? ". No change, have a toffee" : "")] : ["बिल्कुल सही, धन्यवाद!", "Exactly right, thank you!"]);
    pieces.forEach((d, k) => setTimeout(() => { tray.append(el("span", `note note--${d} is-in`, rupees(d))); sound.coin(); }, 350 + k * 380));
    if (toffee) setTimeout(() => tray.append(el("span", "note note--toffee is-in", "टॉफ़ी")), 350 + pieces.length * 380);
    me.batua += sum - price - toffee;
    setTimeout(() => done("cash"), 700 + (pieces.length + (toffee ? 1 : 0)) * 380);
  };
  const payUpi = () => {
    const c = counterPanel();
    const head = el("p", "counter__head");
    head.append(el("b", null, "स्कैन करके भुगतान"), el("span", null, `${rupees(price)} · Papa's phone, the QR on the counter`));
    const qr = document.createElement("canvas"); qr.className = "counter__qr"; qr.width = qr.height = 116;
    const g = qr.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 116, 116); g.fillStyle = "#111";
    for (let y = 0; y < 25; y++) for (let x = 0; x < 25; x++) if (Math.random() < 0.48) g.fillRect(8 + x * 4, 8 + y * 4, 4, 4);
    for (const [x, y] of [[8, 8], [80, 8], [8, 80]]) { g.fillStyle = "#111"; g.fillRect(x, y, 28, 28); g.fillStyle = "#fff"; g.fillRect(x + 4, y + 4, 20, 20); g.fillStyle = "#111"; g.fillRect(x + 8, y + 8, 12, 12); }
    c.append(head, qr);
    const acts = el("div", "counter__acts");
    const go = el("button", "btn btn--solid", "स्कैन करो · Scan"); go.type = "button";
    go.addEventListener("click", () => {
      go.disabled = true; go.textContent = "…";
      setTimeout(() => {
        // the little speaker box on every counter: "₹60 received"
        sound.coin();
        const line = [`UPI से ${price} रुपये प्राप्त हुए`, `${rupees(price)} received by UPI`];
        keeperSays(line);
        if (sound.on && "speechSynthesis" in window) {
          const u = new SpeechSynthesisUtterance(line[0]); u.lang = "hi-IN"; u.rate = 1.05; u.pitch = 0.9;
          const v = speechSynthesis.getVoices().find((x) => x.lang?.startsWith("hi")); if (v) u.voice = v;
          speechSynthesis.cancel(); speechSynthesis.speak(u);
        }
        done("upi");
      }, 1200);
    });
    const back = el("button", "btn btn--ghost", "नक़द दूँगा · Pay cash"); back.type = "button";
    back.addEventListener("click", paint);
    acts.append(go, back); c.append(acts);
  };
  const done = (how) => {
    jhola.total += price; jhola.items.push(en);
    visit.bought.push([hi, en, price]);
    const mem = (me.shops[visit.shop.kind] ||= { n: 0, spent: 0 });
    mem.spent += price; mem.last = [hi, en];
    if (cracker) { bag[cracker] = (bag[cracker] || 0) + count; renderBag(); }
    remember();
    toast(`${hi} · ${en} in your ${cracker ? "crackers" : "jhola"}`);
    delete visit.deal[i]; delete visit.ask[i];
    // a good customer gets a little extra, once
    const fb = FREEBIE[visit.shop.kind];
    if (fb && !visit.freebie && (price >= 100 || visit.bought.length >= 2) && Math.random() < 0.6) {
      visit.freebie = true;
      setTimeout(() => {
        if (!visit) return;
        keeperSays([`और ये ${fb[0]}, मुफ़्त!`, `And ${fb[1].toLowerCase()}, on the house!`]);
        visit.bought.push([fb[0], fb[1], 0]);
        if (fb[2]) { bag[fb[2]] = (bag[fb[2]] || 0) + fb[3]; renderBag(); }
        renderShopItems();
      }, how === "cash" ? 1800 : 2200);
    }
    setTimeout(() => { if (visit) closeCounter(); }, how === "cash" ? 1400 : 900);
  };
  if (me.batua < 10) payUpi(); else paint();
}

// the handwritten parchi, the way the bill comes at a village shop
shopUI.parchi.addEventListener("click", () => {
  if (!visit?.bought.length) return;
  const c = counterPanel(), p = el("div", "parchi");
  const d = new Date(), months = ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"];
  p.append(el("p", "parchi__top", "॥ शुभ लाभ ॥"), el("p", "parchi__shop", visit.shop.hi || visit.shop.en), el("p", "parchi__date", `${me.name ? me.name + " जी · " : ""}${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`));
  const ul = el("ul");
  for (const [hi, , price] of visit.bought) { const li = el("li"); li.append(el("span", null, hi), el("b", null, price ? Math.round(price) : "मुफ़्त")); ul.append(li); }
  const total = visit.bought.reduce((a, b) => a + b[2], 0);
  const tl = el("li", "parchi__total"); tl.append(el("span", null, "कुल"), el("b", null, rupees(total)));
  ul.append(tl);
  p.append(ul, el("p", "parchi__foot", "धन्यवाद, फिर आइए! 🪔"));
  const acts = el("div", "counter__acts");
  const ok = el("button", "btn btn--ghost", "रख लो · Keep it"); ok.type = "button";
  ok.addEventListener("click", closeCounter);
  acts.append(ok);
  c.append(p, acts);
});
// step up to the counter: the camera walks in close, the shopkeeper greets you, the counter opens beside you
function openShop(shop) {
  if (tour.ride && tour.ride !== maidanRide) return;
  const g = shop.group;
  g.updateWorldMatrix(true, false);
  const eye = new THREE.Vector3(...shop.view).applyMatrix4(g.matrixWorld);
  const aim = new THREE.Vector3(...shop.aim).applyMatrix4(g.matrixWorld);
  // on a tall screen the counter sheet rises from the bottom: look lower so the goods and the shopkeeper sit above it
  if (innerWidth < innerHeight * 1.05) { eye.addScaledVector(tmp.subVectors(eye, aim).setY(0).normalize(), 1.3); eye.y += 0.35; aim.y -= 0.95; }
  const from = camera.position.clone(), fromQ = camera.quaternion.clone();
  const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromRotationMatrix(m.lookAt(eye, aim, new THREE.Vector3(0, 1, 0)));
  const c0 = performance.now();
  const mem = me.shops[shop.kind];
  visit = { shop, discount: (mem?.n || 0) >= 2 ? 0.05 : 0, from, fromQ, back: null, t: 0, ask: {}, floor: {}, deal: {}, patience: {}, firm: {}, bought: [], freebie: false };
  const far = from.distanceTo(eye) > 14;
  visit.far = far;
  let start = c0;
  if (far) {
    ui.shutter.classList.remove("is-on", "is-dip"); void ui.shutter.offsetWidth; ui.shutter.classList.add("is-dip");
    start = c0 + 450;
    // arrive a couple of steps back from the counter, already facing it
    setTimeout(() => { from.copy(eye).addScaledVector(tmp.subVectors(eye, aim).setY(0).normalize(), 2.2); fromQ.copy(q); }, 450);
  }
  tour.ride = (dt, cam) => {
    if (performance.now() < start) return;
    const k = Math.min(1, (performance.now() - start) / 1300), e = k * k * (3 - 2 * k);
    cam.position.lerpVectors(from, eye, e);
    cam.position.y += Math.sin(performance.now() / 900) * 0.008 * e; // standing, breathing
    cam.quaternion.slerpQuaternions(fromQ, q, e);
  };
  shopUI.hi.textContent = shop.hi || "";
  shopUI.title.textContent = shop.en || "The shop";
  shopUI.note.textContent = SHOP_NOTES[shop.kind] || "";
  shopUI.note.hidden = !SHOP_NOTES[shop.kind];
  shopUI.counter.hidden = true; shopUI.counter.innerHTML = "";
  renderShopItems();
  ui.panel.classList.add("is-away");
  // the shopkeeper remembers you: what you took last time, and a better price for a regular
  const hello = mem?.last ? (visit.discount ? [`अरे, पुराने ग्राहक! आपके लिए सब पाँच टका कम`, `Ah, a regular! Five percent off everything for you`] : [`फिर आ गए${me.name ? " " + me.name + " जी" : ""}! पिछली बार ${mem.last[0]} ले गए थे`, `Back again${me.name ? ", " + ji() : ""}! Last time you took the ${mem.last[1].split(",")[0].toLowerCase()}`])
    : me.name && Math.random() < 0.6 ? [`आइए ${me.name} जी, क्या चाहिए?`, `Come in, ${ji()}, what would you like?`] : pick2(GREET);
  if (mem) mem.n++; else me.shops[shop.kind] = { n: 1, spent: 0 };
  remember();
  setTimeout(() => { if (shop.keeper) sayAs(shop.keeper, hello); }, 900);
  setTimeout(() => shopUI.dialog.show(), 600);
}
function leaveShop() {
  if (!visit) return;
  shopUI.dialog.close();
  const v = visit; visit = null;
  if (!v.bought.length && v.shop.keeper && Math.random() < 0.5) sayAs(v.shop.keeper, pick2([["अरे, कुछ तो ले जाइए!", "Hey, take something at least!"], ["फिर आइएगा!", "Do come again!"]]));
  const from = camera.position.clone(), fromQ = camera.quaternion.clone(), c0 = performance.now();
  if (v.far && !atMaidan) {
    // came from across the village: dip to black and hand the camera back to the walk where it was
    ui.shutter.classList.remove("is-on", "is-dip"); void ui.shutter.offsetWidth; ui.shutter.classList.add("is-dip");
    tour.ride = () => { if (performance.now() - c0 > 450) { tour.ride = null; ui.panel.classList.remove("is-away"); } };
    return;
  }
  tour.ride = (dt, cam) => {
    const k = Math.min(1, (performance.now() - c0) / 1100), e = k * k * (3 - 2 * k);
    cam.position.lerpVectors(from, v.from, e);
    cam.quaternion.slerpQuaternions(fromQ, v.fromQ, e);
    if (k >= 1) { tour.ride = atMaidan ? maidanRide : null; ui.panel.classList.remove("is-away"); }
  };
}
document.querySelector("[data-shop-close]").addEventListener("click", leaveShop);
addEventListener("keydown", (e) => { if (e.code === "Escape" && visit) leaveShop(); });
function shopAt(rayObj) {
  if (!village.shops) return null;
  const near = village.shops.filter((sh) => sh.group.position.distanceToSquared(camera.position) < 400);
  const hit = rayObj.intersectObjects(near.map((sh) => sh.group), true)[0];
  if (!hit) return null;
  let o = hit.object;
  while (o && !near.some((sh) => sh.group === o)) o = o.parent;
  return near.find((sh) => sh.group === o) || null;
}

/* ---------- your crackers ---------- */
const BAG_LABEL = { anar: ["Anar", "Set it down and light it", "अनार"], chakri: ["Chakri", "Spins on the ground ahead", "चकरी"], phuljhadi: ["Phuljhadi", "Hold a sparkler", "फुलझड़ी"], rocket: ["Rocket", "Up into the sky", "रॉकेट"], bomb: ["Sutli bomb", "Step back!", "सुतली बम"], ladi: ["Ladi", "A string of 100", "लड़ी"], skyshot: ["Sky shot", "Twelve into the sky", "स्काई शॉट"] };
const bagUI = { root: document.querySelector("[data-bag]"), btn: document.querySelector("[data-bag-open]"), tray: document.querySelector("[data-bag-tray]"), count: document.querySelector("[data-bag-count]") };
function renderBag() {
  me.bag = { ...bag }; remember();
  const total = Object.values(bag).reduce((a, b) => a + b, 0);
  bagUI.root.hidden = total === 0;
  bagUI.count.textContent = total;
  bagUI.tray.innerHTML = "";
  for (const [kind, n] of Object.entries(bag)) {
    if (!n) continue;
    const b = document.createElement("button"); b.type = "button";
    const left = document.createElement("span"), name = document.createElement("b"), hint = document.createElement("small"), cnt = document.createElement("em");
    name.textContent = BAG_LABEL[kind][0]; hint.textContent = BAG_LABEL[kind][1]; cnt.textContent = `Light · ${n} left`;
    left.append(name, hint); b.append(left, cnt);
    b.addEventListener("click", () => { bag[kind]--; renderBag(); lightCracker(kind); if (!bag[kind]) bagUI.tray.hidden = true; });
    bagUI.tray.appendChild(b);
  }
  if (!total) bagUI.tray.hidden = true;
  if (atMaidan) renderMaidan();
}
bagUI.btn.addEventListener("click", () => { bagUI.tray.hidden = !bagUI.tray.hidden; bagUI.btn.setAttribute("aria-expanded", String(!bagUI.tray.hidden)); });
// where to set a cracker down: a few steps ahead on the ground
function groundAhead(dist = 4) {
  const f = new THREE.Vector3(); camera.getWorldDirection(f); f.y = 0; f.normalize();
  const p = camera.position.clone().addScaledVector(f, dist);
  p.y = tour.floorAt ? tour.floorAt(p.x, p.z) : 0;
  return p;
}
function lightCracker(kind) {
  stat("crackers"); buddyReact("cracker");
  sound.strike();
  const p = atMaidan
    ? village.maidan.center.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.4, 0, (Math.random() - 0.5) * 2.4))
    : groundAhead(kind === "bomb" ? 6 : 4);
  if (atMaidan) setTimeout(() => { for (const p2 of village.maidanCrowd) if (Math.random() < 0.8) p2.cheer = 1.4 + Math.random() * 1.2; }, kind === "bomb" ? 1800 : 900);
  const d = camera.position.distanceTo(p);
  if (kind === "anar") { setTimeout(() => { sparks.anar(p.x, p.y + 0.01, p.z, 6); sound.fountain(6); }, 700); setTimeout(() => kidsCheer(p.x, p.z, d), 1500); }
  else if (kind === "chakri") { setTimeout(() => { sparks.chakri(p.x, p.y + 0.01, p.z, 5); sound.fountain(5); }, 600); setTimeout(() => kidsCheer(p.x, p.z, d), 1300); }
  else if (kind === "bomb") setTimeout(() => bomb(p.x, p.z), 1600);
  else if (kind === "ladi") setTimeout(() => ladi(p.x, p.z), 900);
  else if (kind === "phuljhadi") {
    if (sound.has("sparkler")) sound.play("sparkler", { offset: 0, dur: 12, gain: 0.32, fade: 0.3 });
    // a sparkler held just in front of you, first-person
    const hand = new THREE.Vector3();
    sparks.sparkler(() => {
      const f = new THREE.Vector3(); camera.getWorldDirection(f);
      const r = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      return hand.copy(camera.position).addScaledVector(f, 0.75).addScaledVector(r, 0.22).add(new THREE.Vector3(0, -0.28 + Math.sin(t * 6) * 0.04, 0));
    }, 14);
    toast("Draw circles in the air");
  } else if (kind === "rocket" && atMaidan) {
    setTimeout(() => { sparks.rocket(p, p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 26 + Math.random() * 10, (Math.random() - 0.5) * 6))); sound.launch(); }, 500);
  } else if (kind === "skyshot" && atMaidan) {
    for (let i = 0; i < 12; i++) setTimeout(() => { sparks.rocket(p, p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 16, 22 + Math.random() * 16, (Math.random() - 0.5) * 16))); sound.launch(); }, 500 + i * 320);
  } else if (kind === "rocket") {
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir); dir.y = Math.max(dir.y, 0.35); dir.normalize();
    setTimeout(() => rocketToward(dir, 55), 500);
  } else if (kind === "skyshot") {
    for (let i = 0; i < 12; i++) setTimeout(() => {
      const dir = new THREE.Vector3(); camera.getWorldDirection(dir); dir.y = 0.5 + Math.random() * 0.3; dir.x += (Math.random() - 0.5) * 0.4; dir.normalize();
      rocketToward(dir, 50);
    }, 500 + i * 320);
  }
}

/* ---------- पटाखा मैदान: the cracker ground ---------- */
let atMaidan = false, maidanRide = null, maidanBack = null;
const maidanUI = { root: document.querySelector("[data-maidan]"), list: document.querySelector("[data-maidan-list]") };
function renderMaidan() {
  maidanUI.list.innerHTML = "";
  const owned = Object.entries(bag).filter(([, n]) => n > 0);
  if (!owned.length) {
    const p = document.createElement("p"); p.className = "maidan__empty";
    p.textContent = "No crackers yet. Buy some from the thela at the edge of the ground.";
    maidanUI.list.appendChild(p);
    return;
  }
  for (const [kind, n] of owned) {
    const b = document.createElement("button"); b.type = "button";
    const hi = document.createElement("b"), en = document.createElement("span"), cnt = document.createElement("em");
    hi.lang = "hi"; hi.textContent = BAG_LABEL[kind][2]; en.textContent = BAG_LABEL[kind][0]; cnt.textContent = `Light · ${n} left`;
    b.append(hi, en, cnt);
    b.addEventListener("click", () => { bag[kind]--; renderBag(); lightCracker(kind); });
    maidanUI.list.appendChild(b);
  }
}
function goMaidan() {
  if (!tour || showing || document.body.classList.contains("is-intro")) return;
  // standing at a counter (or still stepping back from one): walk off from where you were before it
  let back = null;
  if (visit) { back = { pos: visit.from, q: visit.fromQ }; shopUI.dialog.close(); visit = null; ui.panel.classList.remove("is-away"); }
  if (tour.mode === "free") toggleFree(false);
  const M = village.maidan;
  if (!atMaidan) maidanBack = back || { pos: camera.position.clone(), q: camera.quaternion.clone() };
  const from = camera.position.clone(), fromQ = camera.quaternion.clone(), c0 = performance.now();
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(M.view, M.aim, new THREE.Vector3(0, 1, 0)));
  const look = new THREE.Quaternion();
  atMaidan = true;
  document.body.classList.add("at-maidan");
  maidanRide = (dt, cam) => {
    const k = Math.min(1, (performance.now() - c0) / 1800), e = k * k * (3 - 2 * k);
    cam.position.lerpVectors(from, M.view, e);
    // drag still lets you look around the ring
    look.setFromEuler(new THREE.Euler(tour.pitchOff * 0.6, tour.yawOff, 0, "YXZ"));
    cam.quaternion.slerpQuaternions(fromQ, q.clone().multiply(look), e);
  };
  tour.yawOff = tour.pitchOff = 0;
  tour.ride = maidanRide;
  renderMaidan();
  maidanUI.root.hidden = false;
  toast("पटाखा मैदान · everyone gathers round");
  if (!Object.values(bag).some((n) => n > 0)) setTimeout(() => openShop(M.shop), 1900);
}
function leaveMaidan() {
  if (!atMaidan) return;
  atMaidan = false;
  maidanUI.root.hidden = true;
  document.body.classList.remove("at-maidan");
  const from = camera.position.clone(), fromQ = camera.quaternion.clone(), c0 = performance.now(), back = maidanBack;
  tour.ride = (dt, cam) => {
    const k = Math.min(1, (performance.now() - c0) / 1500), e = k * k * (3 - 2 * k);
    cam.position.lerpVectors(from, back.pos, e);
    cam.quaternion.slerpQuaternions(fromQ, back.q, e);
    if (k >= 1) { tour.ride = null; tour.yawOff = tour.pitchOff = 0; }
  };
}
document.querySelector("[data-burn]").addEventListener("click", () => goMaidan());
document.querySelector("[data-maidan-leave]").addEventListener("click", () => leaveMaidan());
document.querySelector("[data-maidan-buy]").addEventListener("click", () => openShop(village.maidan.shop));

/* ---------- the fireworks show ---------- */
// Watched from the rooftop: the village below, a field of shells set off in the open ground to the east.
// the launch field sits south-east of the rooftop so the banyan stays out of frame and the temple
// shikhara stands in silhouette beneath the shells
const SHOW = new THREE.Vector3(40, 0, -40);
const SHOW_FWD = new THREE.Vector3(40 + 19, 0, -40 + 14).normalize(); // from the roof toward the field
const SHOW_LAT = new THREE.Vector3(-SHOW_FWD.z, 0, SHOW_FWD.x);      // across the field, left to right
const C = { gold: [1, 0.62, 0.22], red: [1, 0.22, 0.3], green: [0.35, 1, 0.45], blue: [0.35, 0.65, 1], violet: [0.78, 0.4, 1], white: [1, 0.97, 0.9], pink: [1, 0.45, 0.7], saffron: [1, 0.45, 0.1] };
function shell(lat, h, type, col, col2, depth = 0, dur) {
  const from = SHOW.clone().addScaledVector(SHOW_LAT, lat).addScaledVector(SHOW_FWD, depth);
  sparks.rocket(from, from.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, h, (Math.random() - 0.5) * 2)), type, col, col2, dur);
  sound.launch();
}
const SHOW_CUES = [];
const at = (t, fn) => SHOW_CUES.push({ t, fn });
// 1 · opening: lone gold willows climb one by one
[0, 2.2, 4.4].forEach((t, i) => at(3 + t, () => shell([-14, 14, 0][i], 30 + i * 4, "willow", C.gold)));
at(9.6, () => shell(0, 40, "willow", C.gold, C.white));
// 2 · colour: mirrored pairs, left and right
[[C.red, "peony"], [C.green, "peony"], [C.blue, "chrysanthemum"], [C.violet, "peony"], [C.pink, "chrysanthemum"]].forEach(([col, type], i) => {
  at(13 + i * 1.8, () => { shell(-18 + i * 2, 26 + i * 2, type, col, C.white); shell(18 - i * 2, 26 + i * 2, type, col, C.white); });
});
// 3 · rings and crackle
[0, 1.2, 2.4, 3.6].forEach((t, i) => at(23 + t, () => shell([-10, 10, -4, 4][i], 30 + i * 3, "ring", [C.saffron, C.blue, C.green, C.gold][i])));
at(28, () => { shell(-6, 32, "crackle", C.white); shell(6, 34, "crackle", C.white); });
// 4 · a fan of five chrysanthemums together
at(32, () => [-20, -10, 0, 10, 20].forEach((lat, i) => shell(lat, 24 + Math.abs(lat) * 0.3, "chrysanthemum", [C.red, C.gold, C.white, C.gold, C.red][i])));
at(35, () => [-16, -8, 0, 8, 16].forEach((lat, i) => shell(lat, 34, "palm", C.gold)));
// 5 · on the ground: a line of anars and chakris across the field
const fieldAt = (lat, depth) => SHOW.clone().addScaledVector(SHOW_LAT, lat).addScaledVector(SHOW_FWD, depth);
at(39, () => { for (let i = 0; i < 9; i++) setTimeout(() => { const p = fieldAt(-20 + i * 5, -10); sparks.anar(p.x, 0.01, p.z, 7); }, i * 180); sound.fountain(7); });
at(42, () => { for (let i = 0; i < 6; i++) { const p = fieldAt(-15 + i * 6, -12); sparks.chakri(p.x, 0.01, p.z, 5); } });
// 6 · the pace quickens
for (let k = 0; k < 24; k++) at(46 + k * 0.42, () => shell((Math.random() - 0.5) * 44, 24 + Math.random() * 18, null, null, null, (Math.random() - 0.5) * 16));
// a second layer further back keeps the sky busy the whole way through
for (let k = 0; k < 52; k++) at(14 + k * 0.82, () => shell((Math.random() - 0.5) * 70, 22 + Math.random() * 22, null, null, null, 18 + Math.random() * 22));
// 7 · grand finale: the whole sky, wide and in depth, then a gold willow curtain over it all
for (let k = 0; k < 72; k++) at(56 + k * 0.11, () => shell((Math.random() - 0.5) * 80, 22 + Math.random() * 26, ["peony", "chrysanthemum", "crackle", "ring", "palm"][k % 5], [C.red, C.green, C.blue, C.gold, C.violet, C.white, C.pink, C.saffron][k % 8], C.white, (Math.random() - 0.5) * 30));
at(56.5, () => { for (let i = 0; i < 11; i++) setTimeout(() => { const p = fieldAt(-30 + i * 6, -8); sparks.anar(p.x, 0.01, p.z, 8); }, i * 120); sound.fountain(8); });
at(62.5, () => { for (let i = 0; i < 15; i++) shell(-35 + i * 5, 40 + (i % 2) * 5, "willow", C.gold, C.gold, (i % 3) * 6, 1.6); });
at(64.5, () => { for (let i = -2; i <= 2; i++) shell(i * 12, 32 + Math.abs(i) * 2, "crackle", C.white); });
// 8 · the last shell climbs to the middle and its stars write शुभ दीपावली across the sky
at(66.2, () => { textShell(); });
const SHOW_END = 82;

// sample the words into star positions on a plane facing the camera
function textTargets(text, center, widthM, fixedScale) {
  const W = 1400, H = 300, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "middle";
  x.font = "200px 'Tiro Devanagari Hindi', serif";
  const tw = Math.min(W - 40, x.measureText(text).width);
  x.fillText(text, W / 2, H / 2 + 10, W - 40);
  x.strokeStyle = "#fff"; x.lineWidth = 9; x.lineJoin = "round";
  x.strokeText(text, W / 2, H / 2 + 10, W - 40); // thicken the strokes so the letters read from afar
  const img = x.getImageData(0, 0, W, H).data;
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  right.y = 0; right.normalize();
  const scale = fixedScale ?? widthM / tw, pts = [];
  textTargets.lastScale = scale;
  const lineWidth = tw * scale;
  const step = 4;
  for (let y = 0; y < H; y += step) for (let xx = 0; xx < W; xx += step) {
    if (img[(y * W + xx) * 4 + 3] > 140) {
      pts.push(center.clone().addScaledVector(right, (xx - W / 2) * scale).add(new THREE.Vector3(0, (H / 2 - y) * scale, 0)));
    }
  }
  // keep the stars per metre of lettering steady: narrow screens get smaller words, so fewer stars,
  // otherwise they crowd together and the glow smears the letters into a blur
  const cap = Math.round(THREE.MathUtils.clamp(lineWidth * 80, 1800, 5000));
  if (pts.length > cap) { const k = pts.length / cap; return Array.from({ length: cap }, (_, i) => pts[Math.floor(i * k)]); }
  return pts;
}
// a rocket bursts into words that hang in the sky. With a line already up, `under` adds a second
// line beneath it at the same letter size (a name under "शुभ दीपावली")
function textShell(text = greet(), { under = false, color = [1, 0.74, 0.3], hold = 7.2, at = null } = {}) {
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
  // from the lane, low enough to sit inside the frame under the top bar; from the drone, at eye level
  const center = under && textShell.last ? textShell.last.clone() : at ? at.clone() : camera.position.clone().addScaledVector(fwd, 78);
  if (under && textShell.last) center.y -= 14 * (textTargets.lastScale || 0.06) / 0.06 + 1;
  else { if (!at) center.y = Math.max(19, camera.position.y - 2); textShell.last = center.clone(); }
  const from = center.clone(); from.y = 0;
  sparks.rocket(from, center, "text", C.gold, C.white, 1.6);
  sound.launch();
  setTimeout(() => {
    // fit the words to the frame: full width on a wide screen, narrower on a tall phone
    const seen = 2 * 78 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    const pts = under ? textTargets(text, center, 0, Math.min(textTargets.lastScale, seen * 0.85 / Math.max(1, text.length * 110))) : textTargets(text, center, Math.min(62, seen * 0.8));
    skyText.write(pts, center, color, { append: under, hold });
    for (let k = 0; k < 6; k++) setTimeout(() => sound.play("crackers", { dur: 1.2, gain: 0.25, pan: (Math.random() - 0.5) * 0.6, muffle: 0.4 }), 1400 + k * 500);
  }, 1650);
}
// a greeting card from the rooftop: "शुभ दीपावली", then your name beneath it, held long enough to save
function nameInSky(name) {
  const clean = name.replace(/[^\p{L}\p{M}\p{N} .&'-]/gu, "").trim().slice(0, 22);
  if (!clean) return;
  stat("names");
  // turn toward the open fields past the village, where nothing stands in front of the sky,
  // and put the words high enough that the name under them still clears the rooftops
  const dir = tmp.set(SHOW.x - camera.position.x, 0, SHOW.z - camera.position.z).normalize().clone();
  const at = camera.position.clone().addScaledVector(dir, 78); at.y = camera.position.y + 24;
  const look = at.clone(); look.y -= 9;
  const q0 = camera.quaternion.clone(), q1 = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(camera.position, look, camera.up));
  const pos = camera.position.clone(), c0 = performance.now(), D = 17500;
  const own = !tour.ride;
  if (own) tour.ride = (dt, cam) => {
    const t = performance.now() - c0;
    const k = t < 1400 ? t / 1400 : t > D - 1200 ? Math.max(0, (D - t) / 1200) : 1;
    cam.position.copy(pos);
    cam.quaternion.slerpQuaternions(q0, q1, k * k * (3 - 2 * k));
    if (t >= D) { tour.ride = null; ui.panel.classList.remove("is-away"); }
  };
  if (own) ui.panel.classList.add("is-away"); // the whole sky is the card for a while
  textShell(greet(), { hold: 13, at });
  setTimeout(() => textShell(clean, { under: true, color: [1, 0.55, 0.78], hold: 10 }), 2200);
  setTimeout(() => { const c = textShell.last; if (c) volley([[c.x - 22, 0, c.z], [c.x + 22, 0, c.z]], 22, 30, "willow"); }, 5200);
  setTimeout(() => showCardButton(clean), 5600);
}

let showing = false;
// The show is watched from the rooftops, among the people sitting up there. Four shots, cut with a dip to
// black: over the shoulders of the family on their durrie, across the village's crowded roofs, low along
// the family's faces lit by the bursts, and wide behind them for the finale and the words in the sky.
function showShots() {
  const F = village.showFamily, c = F.center, d = F.dir, sd = F.side;
  const P = (v, back, lat, up) => new THREE.Vector3().copy(v).addScaledVector(d, -back).addScaledVector(sd, lat).setY(v.y + up);
  const sky = (h) => new THREE.Vector3(SHOW.x, h, SHOW.z);
  return [
    // over their shoulders: the heads of the family along the bottom of the frame, the sky above
    { t: 0, until: 17, from: P(c, 2.3, 0.3, 1.2), to: P(c, 1.8, 0.1, 1.15), lookA: sky(11), lookB: sky(14), fov: [68, 64] },
    // across the village: every roof has its people out on it
    { t: 17, until: 34, from: new THREE.Vector3(-8, 10.5, 30), to: new THREE.Vector3(-4, 9.2, 23), lookA: new THREE.Vector3(30, 15, -30), lookB: new THREE.Vector3(32, 17, -32), fov: [52, 52] },
    // turned round to face them: faces tipped up, lit by each burst
    { t: 34, until: 51, from: P(c, -1.7, 0.6, 0.95), to: P(c, -1.7, -0.6, 0.95), lookA: P(c, 0.5, 0.2, 0.7), lookB: P(c, 0.5, -0.2, 0.7), fov: [50, 48] },
    // the finale, wide behind the family, for the words in the sky
    { t: 51, until: SHOW_END, from: P(c, 3.2, -0.3, 1.7), to: P(c, 2.7, -0.1, 1.6), lookA: sky(12), lookB: sky(15), fov: [74, 70] },
  ];
}
function fireworksShow() {
  if (!tour || tour.ride) return;
  showing = true;
  const back = STOPS[current].key;
  const shots = showShots();
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), look = new THREE.Vector3(), pos = new THREE.Vector3(), UPV = new THREE.Vector3(0, 1, 0);
  const clock0 = performance.now();
  let cue = 0, shotNow = -1;
  SHOW_CUES.sort((a, b) => a.t - b.t);
  // everyone up on the roofs turns to face the field, sits down to watch and looks up; the children stay on their feet
  const crowd = village.roofPeople.map((p) => ({ p, yaw: p.group.rotation.y, pose: p.pose }));
  for (const { p } of crowd) {
    const wp = p.group.getWorldPosition(new THREE.Vector3());
    p.group.rotation.y = Math.atan2(SHOW.x - wp.x, SHOW.z - wp.z) + (Math.random() - 0.5) * 0.35;
    if (p.kind !== "child" && p.kind !== "girl") p.pose = "sit";
    p.lookUp = true;
  }
  ui.letterbox.classList.add("is-on");
  document.body.classList.add("is-intro");
  ui.panel.hidden = true;
  ui.caption.innerHTML = "<span lang=\"hi\">छत पर आतिशबाज़ी</span><small>The whole village is up on the roofs to watch</small>";
  ui.caption.classList.add("is-on");
  setTimeout(() => ui.caption.classList.remove("is-on"), 4500);
  const dip = () => { if (me.calm) return; ui.shutter.classList.remove("is-on", "is-dip"); void ui.shutter.offsetWidth; ui.shutter.classList.add("is-dip"); };
  dip();
  const finish = () => {
    if (!showing) return;
    showing = false;
    tour.ride = null;
    tour.s = tour.target = back; tour.vel = 0;
    camera.fov = innerWidth < innerHeight ? 72 : 58; camera.updateProjectionMatrix();
    for (const { p, yaw, pose } of crowd) { p.group.rotation.y = yaw; p.pose = pose; p.lookUp = false; }
    ui.letterbox.classList.remove("is-on");
    document.body.classList.remove("is-intro");
    ui.caption.classList.remove("is-on");
    ui.panel.hidden = false;
    canvas.removeEventListener("pointerdown", skip);
    showStop(current);
    // after the show, offer the morning after
    setTimeout(() => {
      ui.cardBtn.innerHTML = '<span lang="hi">अगली सुबह</span> · See the morning after';
      ui.cardBtn.hidden = false;
      ui.cardBtn.onclick = () => { ui.cardBtn.hidden = true; morningAfter(); };
      clearTimeout(showCardButton.t); showCardButton.t = setTimeout(() => (ui.cardBtn.hidden = true), 10000);
    }, 2500);
  };
  const skip = () => finish();
  setTimeout(() => canvas.addEventListener("pointerdown", skip), 400);
  const hold = camera.position.clone(), holdQ = camera.quaternion.clone();
  tour.ride = (dt, cam) => {
    const t0 = (performance.now() - clock0) / 1000;
    // the opening dip: stay put until the screen is dark, then cut to the roof
    if (t0 < 0.45) { cam.position.copy(hold); cam.quaternion.copy(holdQ); return; }
    let i = shots.length - 1;
    while (i > 0 && t0 < shots[i].t) i--;
    const sh = shots[i];
    if (i !== shotNow) shotNow = i;
    // dip just before the next cut
    const next = shots[i + 1];
    if (next && t0 > next.t - 0.45 && !sh.dipped) { sh.dipped = true; dip(); }
    const k = THREE.MathUtils.clamp((t0 - sh.t) / (sh.until - sh.t), 0, 1), e = k * k * (3 - 2 * k) * 0.85 + k * 0.15;
    pos.lerpVectors(sh.from, sh.to, e);
    look.lerpVectors(sh.lookA, sh.lookB, e);
    pos.y += Math.sin(t0 * 0.6) * 0.04; // a held camera, breathing slightly
    m.lookAt(pos, look, UPV);
    q.setFromRotationMatrix(m);
    cam.position.copy(pos);
    cam.quaternion.copy(q);
    cam.fov = sh.fov[0] + (sh.fov[1] - sh.fov[0]) * e;
    cam.updateProjectionMatrix();
    while (cue < SHOW_CUES.length && t0 >= SHOW_CUES[cue].t) SHOW_CUES[cue++].fn();
    // the children jump and cheer at the big moments; the seated folk raise their hands
    if ((t0 > 32 && t0 < 33.5) || (t0 > 57 && t0 < 75)) for (const { p } of crowd) if (Math.random() < dt * 1.5 && p.cheer <= 0 && p.pose !== "sit") p.cheer = 1.2 + Math.random();
    if (t0 >= SHOW_END) finish();
  };
}
document.querySelector("[data-show]").addEventListener("click", () => fireworksShow());

/* ---------- scroll to walk ---------- */
let scrolling = false, shownStop = -1;
addEventListener("wheel", (e) => {
  if (!tour || tour.mode !== "guided" || tour.ride || document.querySelector("dialog[open]")) return;
  if (e.target.closest && e.target.closest(".music, .minimap, .panel, .places, .sheet")) return; // let those scroll themselves
  e.preventDefault();
  const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY;
  tour.scrub(THREE.MathUtils.clamp(px, -100, 100) * 0.004);
  scrolling = true;
}, { passive: false });
// while you scroll, the panel follows your position; when you stop, you stay exactly where you are
let scrollFollow = false;
function updateScroll() {
  if (!tour || tour.mode !== "guided" || tour.ride) return;
  if (!scrolling && !scrollFollow) return;
  const near = stopAt(tour.s);
  if (near >= 0 && near !== shownStop) {
    current = near; shownStop = near; showStop(near);
    history.replaceState(null, "", `#${STOPS[near].id}`);
  } else if (near < 0 && shownStop !== -2) {
    shownStop = -2;
    const forward = tour.target >= tour.s - 0.001;
    const nextStop = (forward ? STOPS.find((st) => st.key > tour.s) : [...STOPS].reverse().find((st) => st.key < tour.s)) || STOPS[STOPS.length - 1];
    current = Math.max(0, STOPS.indexOf(nextStop) - (forward ? 1 : 0));
    ui.panel.classList.add("is-walking");
    ui.action.hidden = ui.action2.hidden = true;
    ui.hi.textContent = nextStop.hi;
    ui.en.textContent = `On the way to ${nextStop.en.toLowerCase()}`;
    ui.num.textContent = "Scroll to keep walking";
  }
  if (scrolling && performance.now() - (tour.lastScrub || 0) > 250) { scrolling = false; scrollFollow = true; }
  if (scrollFollow && !scrolling && Math.abs(tour.target - tour.s) < 0.002) scrollFollow = false;
  updateRail();
}

/* ---------- progress rail ---------- */
const rail = document.querySelector("[data-rail]");
const railFill = rail.querySelector("[data-rail-fill]");
STOPS.forEach((st, i) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "rail__dot";
  b.style.top = `${(st.key / (KEYS.length - 1)) * 100}%`;
  b.setAttribute("aria-label", `${i + 1}. ${st.en}`);
  b.dataset.label = st.en;
  b.addEventListener("click", () => goStop(i));
  rail.appendChild(b);
});
function updateRail() {
  if (!tour) return;
  const k = tour.s / (KEYS.length - 1);
  railFill.style.transform = `scaleY(${k})`;
  rail.querySelectorAll(".rail__dot").forEach((d, i) => { d.classList.toggle("is-past", STOPS[i].key <= tour.s + 0.01); d.classList.toggle("is-current", i === current); });
}

/* ---------- night into dawn ---------- */
let dawn = 0, dawnWant = 0, chirpT = 0;
const NIGHT = { fog: new THREE.Color(0x14111c), sky: new THREE.Color(0x3a4278), exp: 1.55, hemi: 1.9 };
const DAWN = { fog: new THREE.Color(0x3a3448), sky: new THREE.Color(0x8090c0), exp: 1.15, hemi: 2.2 };
function setDawn(on, quiet) {
  dawnWant = on ? 1 : 0;
  ui.dawn.setAttribute("aria-pressed", String(!!dawnWant));
  ui.dawn.querySelector("span:last-child").textContent = dawnWant ? "Night" : "Dawn";
  if (!quiet) toast(dawnWant ? "Brahma muhurat: the diyas still burn as the sky pales" : "Back to Diwali night");
}
ui.dawn.addEventListener("click", () => {
  setDawn(!dawnWant);
  if (!dawnWant && isMorning) { village.setMorning(false); isMorning = false; showStop(current); } // back to Diwali night
});
function updateDawn(dt) {
  dawn += (dawnWant - dawn) * Math.min(1, dt * 0.25);
  if (sound.on) { sound.bedLevel("fireworks", 1 - dawn * 0.85); sound.bedLevel("crackers", 1 - dawn * 0.9); }
  sky.material.uniforms.uDawn.value = dawn;
  scene.fog.color.copy(NIGHT.fog).lerp(DAWN.fog, dawn);
  hemi.color.copy(NIGHT.sky).lerp(DAWN.sky, dawn);
  // a little more starlight on the ground when seen from up high
  const lift = 1 + THREE.MathUtils.clamp((camera.position.y - 3) / 20, 0, 1) * 0.9;
  hemi.intensity = (NIGHT.hemi + (DAWN.hemi - NIGHT.hemi) * dawn) * lift;
  renderer.toneMappingExposure = NIGHT.exp + (DAWN.exp - NIGHT.exp) * dawn;
  if (dawn > 0.5) { chirpT -= dt; if (chirpT <= 0) { sound.chirp(); chirpT = 1.5 + Math.random() * 4; } }
}

/* ---------- talk to villagers ---------- */
const LINES = {
  child: [["मेरी फुलझड़ी देखो!", "Look at my phuljhadi!"], ["पटाखे चलाओगे?", "Want to light crackers?"], ["मुझे लड्डू मिला!", "I got a ladoo!"]],
  girl: [["शुभ दीपावली दीदी!", "Happy Diwali, didi!"], ["मेरी नई ड्रेस कैसी है?", "How's my new dress?"], ["रंगोली मैंने बनाई!", "I made the rangoli!"]],
  woman: [["शुभ दीपावली!", "Happy Diwali!"], ["मिठाई लीजिए न", "Do have some sweets"], ["आइए, अंदर आइए", "Come in, come inside"], ["दीये ध्यान से जलाना", "Careful with the diyas"]],
  man: [["राम राम भैया!", "Ram Ram, brother!"], ["दिवाली की बधाई!", "Diwali greetings!"], ["लक्ष्मी जी कृपा करें", "May Lakshmi ji bless you"], ["चाय पीकर जाना", "Have some chai before you go"]],
  elder: [["जुग जुग जियो", "Live long, child"], ["खुश रहो बेटा", "Stay happy, beta"], ["हमारे ज़माने में…", "Back in our day…"]],
  priest: [["जय माता दी", "Jai Mata Di"], ["प्रसाद लेते जाना", "Take some prasad"]],
};
let bubbleFor = null, bubbleT = 0;
const headPos = new THREE.Vector3();
const BLESSINGS = [
  ["इस साल तुम्हारे घर खूब खुशियाँ आएँ, लक्ष्मी जी का वास हो।", "may this year fill your home with joy, and may Lakshmi ji stay there."],
  ["जो चाहो, वो मिले। बस मेहनत करते रहना।", "may you get all you wish for. Just keep working hard."],
  ["तुम्हारे घर का हर दीया हमेशा जलता रहे।", "may every diya in your home keep burning."],
  ["अपनों के साथ रहो, यही असली दिवाली है।", "stay close to your own people; that is the real Diwali."],
  ["मिठाई खाओ, मिठास बाँटो।", "eat sweets, and share the sweetness."],
  ["जीते रहो, सदा खुश रहो।", "live long, and always be happy."],
];
let blessN = 0;
function blessing() {
  const [hi, en] = BLESSINGS[blessN++ % BLESSINGS.length];
  stat("blessings");
  return [`${me.name || "बेटा"}, ${hi}`, `${me.name || "Child"}, ${en}`];
}
// Dadi's blessing on its own, from the explore hub: words in the caption and a shower of petals before you
function dadiBlessing() {
  const [hi, en] = blessing();
  ui.caption.innerHTML = "";
  const b = document.createElement("span"); b.lang = "hi"; b.textContent = `दादी का आशीर्वाद · ${hi}`;
  const sm = document.createElement("small"); sm.textContent = en;
  ui.caption.append(b, sm); ui.caption.classList.add("is-on");
  clearTimeout(dadiBlessing.t); dadiBlessing.t = setTimeout(() => ui.caption.classList.remove("is-on"), 7000);
  const f = new THREE.Vector3(); camera.getWorldDirection(f);
  village.showerPetals(camera.position.clone().addScaledVector(f, 2.2).add(new THREE.Vector3(0, 1.4, 0)), 90);
  sound.bell(0.4, 880);
}
let buddyChatN = 0;
function talkTo(p) {
  if (p.isBuddy) { sayAs(p, BUDDY_CHAT[buddyChatN++ % BUDDY_CHAT.length].map((t, i) => t.replace("{n}", youHi()))); p.cheer = 1; return; }
  const pool = LINES[p.kind] || LINES.man;
  let [hi, en] = pool[(Math.random() * pool.length) | 0];
  if (p.title) { [hi, en] = familyLine(p); hi = `${p.title.name}: ${hi}`; en = `${p.title.name} (${REL[p.title.rel][1]}): ${en}`; }
  // the old folk give you their blessing, by name
  if ((p.kind === "elder" && !p.title) || p.title?.rel === "dadi") { [hi, en] = blessing(); if (p.title) hi = `${p.title.name}: ${hi}`; }
  ui.bubble.querySelector("[data-bubble-hi]").textContent = hi;
  ui.bubble.querySelector("[data-bubble-en]").textContent = en;
  ui.bubble.hidden = false;
  ui.bubble.classList.remove("is-on"); void ui.bubble.offsetWidth; ui.bubble.classList.add("is-on");
  bubbleFor = p; bubbleT = 3.2;
  sound.blip();
}
function updateBubble(dt) {
  if (!bubbleFor) return;
  bubbleT -= dt;
  bubbleFor.group.getWorldPosition(headPos);
  headPos.y += bubbleFor.height + 0.35 + (bubbleFor.pose === "sit" || bubbleFor.pose === "sitnamaste" ? -0.6 : 0);
  headPos.project(camera);
  if (bubbleT <= 0 || headPos.z > 1) { ui.bubble.hidden = true; bubbleFor = null; return; }
  let bx = (headPos.x * 0.5 + 0.5) * innerWidth;
  // at a counter, keep the shopkeeper's words clear of the open shop panel
  const half = ui.bubble.offsetWidth / 2;
  if (visit && shopUI.dialog.open && innerWidth > 760) bx = Math.min(bx, shopUI.dialog.getBoundingClientRect().left - half - 14);
  bx = Math.min(Math.max(bx, half + 8), innerWidth - half - 8); // never off the edge of the screen
  const by = Math.max((-headPos.y * 0.5 + 0.5) * innerHeight, ui.bubble.offsetHeight + 72); // never up under the top bar
  ui.bubble.style.transform = `translate(${bx}px, ${by}px) translate(-50%, -100%)`;
}
function personAt(rayObj) {
  const groups = village.people.filter((p) => p.group.position.distanceToSquared(camera.position) < 225).map((p) => p.group);
  const hit = rayObj.intersectObjects(groups, true)[0];
  if (!hit) return null;
  let o = hit.object;
  while (o && !groups.includes(o)) o = o.parent;
  return village.people.find((p) => p.group === o) || null;
}

/* ---------- minimap ---------- */
const MAP = { x0: -40, x1: 40, z0: -45, z1: 68 };
let mapBase = null, mapAcc = 1;
function mapXY(x, z, W, H) { return [((x - MAP.x0) / (MAP.x1 - MAP.x0)) * W, ((z - MAP.z0) / (MAP.z1 - MAP.z0)) * H]; }
function drawMapBase() {
  const c = ui.mapCanvas, dpr = Math.min(devicePixelRatio, 2);
  const W = 200, H = 270;
  c.width = W * dpr; c.height = H * dpr;
  mapBase = document.createElement("canvas");
  mapBase.width = c.width; mapBase.height = c.height;
  const x = mapBase.getContext("2d");
  x.scale(dpr, dpr);
  x.fillStyle = "#1a130e"; x.fillRect(0, 0, W, H);
  // the market road and the pond
  const [rx0, rz0] = mapXY(-35.5, -29.8, W, H), [rx1, rz1] = mapXY(-13.5, -22.2, W, H);
  x.fillStyle = "#5a3020"; x.fillRect(rx0, rz0, rx1 - rx0, rz1 - rz0);
  const [px, pz] = mapXY(24, -24, W, H);
  x.fillStyle = "#16324a"; x.beginPath(); x.ellipse(px, pz, (8 / 80) * W, (8 / 113) * H, 0, 0, 7); x.fill();
  // everything solid in the village
  for (const c2 of village.colliders) {
    if (c2.r !== undefined) {
      if (c2.r < 1) continue;
      const [cx, cz] = mapXY(c2.x, c2.z, W, H);
      x.fillStyle = "rgba(140,110,80,0.6)"; x.beginPath(); x.arc(cx, cz, (c2.r / 80) * W, 0, 7); x.fill();
    } else {
      const [ax, az] = mapXY(c2.minX, c2.minZ, W, H), [bx, bz] = mapXY(c2.maxX, c2.maxZ, W, H);
      x.fillStyle = "rgba(196,140,80,0.75)"; x.fillRect(ax, az, Math.max(1, bx - ax), Math.max(1, bz - az));
    }
  }
}
function drawMap() {
  if (!mapBase || ui.map.hidden) return;
  const c = ui.mapCanvas, x = c.getContext("2d"), dpr = c.width / 200, W = 200, H = 270;
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.drawImage(mapBase, 0, 0);
  x.scale(dpr, dpr);
  x.font = "700 9px Manrope, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
  STOPS.forEach((st, i) => {
    const k = KEYS[st.key].p, [sx, sz] = mapXY(k[0], k[2], W, H);
    x.fillStyle = i === current ? "#ffcf7a" : "rgba(244,166,42,0.85)";
    x.beginPath(); x.arc(sx, sz, i === current ? 8 : 6.5, 0, 7); x.fill();
    x.fillStyle = "#1a0d03"; x.fillText(String(i + 1), sx, sz + 0.5);
  });
  // you are here, facing the way you look
  const [cx, cz] = mapXY(camera.position.x, camera.position.z, W, H);
  const d = new THREE.Vector3(); camera.getWorldDirection(d);
  const a = Math.atan2(d.z, d.x);
  x.save(); x.translate(cx, cz); x.rotate(a);
  x.fillStyle = "rgba(255,240,200,0.18)"; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, 26, -0.5, 0.5); x.closePath(); x.fill();
  x.fillStyle = "#fff6e0"; x.beginPath(); x.moveTo(8, 0); x.lineTo(-5, -5); x.lineTo(-2, 0); x.lineTo(-5, 5); x.closePath(); x.fill();
  x.restore();
}
ui.mapCanvas.addEventListener("click", (e) => {
  const r = ui.mapCanvas.getBoundingClientRect();
  const mx = ((e.clientX - r.left) / r.width) * 200, mz = ((e.clientY - r.top) / r.height) * 270;
  let best = -1, bd = 14;
  STOPS.forEach((st, i) => { const k = KEYS[st.key].p, [sx, sz] = mapXY(k[0], k[2], 200, 270); const d = Math.hypot(sx - mx, sz - mz); if (d < bd) { bd = d; best = i; } });
  if (best >= 0) goStop(best);
});
ui.mapToggle.addEventListener("click", () => {
  ui.map.hidden = !ui.map.hidden;
  ui.mapToggle.setAttribute("aria-pressed", String(!ui.map.hidden));
});

/* ---------- loop ---------- */
const clock = new THREE.Clock();
let nextLadi = 6, nextFarBomb = 3, railTick = 0, owlT = 12, bhajanT = 0, nextStar = 6, nextLantern = 4, hazeT = 0, t = 0, nextAmbient = 2, nextKids = 6, fps = 60, lowFrames = 0;
let shadowFrame = 0;
function loop() {
  requestAnimationFrame(loop);
  if (document.hidden || !tour) {
    if (document.hidden) clock.getDelta();
    return;
  }
  const raw = clock.getDelta();
  const dt = Math.min(raw, 0.05);
  t += dt;
  // the walk follows real time, so a slow device walks just as far, only in fewer frames
  tour.update(Math.min(raw, 0.25));
  village.update(dt, t, camera);
  lamps.update(t, dt, camera);
  sparks.update(dt, t);
  skyText.update(dt);
  updateAarti(dt);
  updateWriting(dt);
  updateWaterNames();
  updateNotice(dt);
  updateBuddy(dt);
  updateAmbient(dt);
  lanterns.update(dt, t);
  fireflies.update(dt, t, camera);
  for (const d of village.userDiyas) if (d.t > 0 && d.t < 1) { d.t = Math.min(1, d.t + dt * 1.8); lamps.setPower(d.id, d.t); }
  for (const d of village.homeDiyas || []) if (d.t > 0 && d.t < 1) { d.t = Math.min(1, d.t + dt * 1.6); lamps.setPower(d.id, d.t); }
  // unlit diyas nearby twinkle now and then, so they are easy to find
  glintT -= dt;
  if (glintT <= 0 && village.homeDiyas) {
    glintT = 1.3;
    for (const d of village.homeDiyas) {
      if (d.lit || Math.abs(d.x - camera.position.x) > 7 || Math.abs(d.z - camera.position.z) > 7) continue;
      for (let k = 0; k < 3; k++) sparks.spawn(d.x + (Math.random() - 0.5) * 0.08, d.y + 0.06, d.z + (Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.15, 0.35 + Math.random() * 0.3, (Math.random() - 0.5) * 0.15, [1, 0.82, 0.45], 0.7, 0.18, 0.98, 0.3, 0.025, 1.1);
    }
  }
  // the bhajan mandali sings when you are near the temple
  const bd = camera.position.distanceTo(village.bhajanCenter);
  bhajanT -= dt;
  music.duck((bd < 16 && !pujaRunning) || speaking);
  updateBgSong(dt, bd < 16 || pujaRunning || speaking || !!aarti);
  if (bd < 16 && bhajanT <= 0 && !pujaRunning) { sound.aarti(16); bhajanT = 20; }
  for (const h of village.hunt) {
    if (h.lit) {
      if (h.t > 0 && h.t < 1) { h.t = Math.min(1, h.t + dt * 1.5); lamps.setPower(h.id, h.t); lamps.spots[h.spot].on = h.t; }
    } else if (!reduceMotion && Math.random() < dt * 2.5 && camera.position.distanceToSquared(tmp.set(h.x, h.y, h.z)) < 400) {
      // a faint glint marks a diya waiting to be lit
      sparks.spawn(h.x + (Math.random() - 0.5) * 0.2, h.y + 0.1, h.z + (Math.random() - 0.5) * 0.2, 0, 0.5 + Math.random() * 0.5, 0, [1, 0.85, 0.5], 0.6, 0.6, 0.98, 0, 0.02, 1);
    }
  }
  // a shooting star now and then, far across the sky
  nextStar -= dt;
  if (nextStar <= 0 && !reduceMotion) {
    const a = Math.random() * Math.PI * 2, p = camera.position;
    const sx = p.x + Math.cos(a) * 150, sz = p.z + Math.sin(a) * 150, dir = a + Math.PI / 2 + (Math.random() - 0.5);
    sparks.spawn(sx, 70 + Math.random() * 40, sz, Math.cos(dir) * 70, -12 - Math.random() * 10, Math.sin(dir) * 70, [0.85, 0.9, 1], 0.7 + Math.random() * 0.4, 1.2, 1, 0, 0.09, 1.3);
    nextStar = 14 + Math.random() * 18;
  }
  // the crowd's murmur near the haat and the bazaar
  if (village.marketCenter) {
    const crowdNear = Math.min(camera.position.distanceTo(village.marketCenter), camera.position.distanceTo(tmp.set(-2, 0, -6)));
    sound.murmur(crowdNear < 24);
  }
  // the dhol carries across the fairground
  const md = camera.position.distanceTo(village.melaCenter);
  sound.dhol(md < 30, THREE.MathUtils.clamp(1.4 - md / 25, 0.15, 1));
  nextLantern -= dt;
  if (nextLantern <= 0 && !reduceMotion) {
    const a = Math.random() * Math.PI * 2, r = 20 + Math.random() * 30;
    lanterns.release(new THREE.Vector3(Math.cos(a) * r, 2, Math.sin(a) * r));
    nextLantern = 12 + Math.random() * 14;
  }
  sky.material.uniforms.uTime.value = t;
  for (const l of flashes) l.intensity *= Math.pow(0.002, dt);
  flashTint.multiplyScalar(Math.pow(0.01, dt));
  grade.uniforms.uTime.value = t;
  grade.uniforms.uFlash.value.copy(flashTint);
  if (me.calm) grade.uniforms.uFlash.value.set(0, 0, 0);
  // low smoke from a night of crackers hangs in the lanes
  hazeT -= dt;
  if (hazeT <= 0 && !reduceMotion) {
    hazeT = 0.6;
    const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 22;
    if (camera.position.distanceTo(tmp.set(24, 0, -24)) < 40) sparks.puff(24 + (Math.random() - 0.5) * 14, 0.25 + Math.random() * 0.3, -24 + (Math.random() - 0.5) * 14, 3 + Math.random() * 3, 22, [0.5, 0.55, 0.62], 0.12, 0.08, 0.005, 0.02, 0.1);
    sparks.puff(camera.position.x + Math.cos(a) * r, 0.5 + Math.random() * 2.8, camera.position.z + Math.sin(a) * r, 5 + Math.random() * 5, 18 + Math.random() * 10, [0.42, 0.32, 0.26], 0.05, 0.05, 0.02, 0.05, 0.12);
  }
  sky.position.copy(camera.position);
  // ground mist hangs low: from up high you see through it to the lamplit village
  scene.fog.density = 0.011 / (1 + Math.max(0, camera.position.y - 2.5) / 5);

  // arriving at a stop updates the panel
  if (tour.mode === "guided" && !tour.direct && !tour.moving && ui.panel.classList.contains("is-walking")) showStop(current);

  // tulsi diya flares up when lit
  if (tulsiAnim > 0 && tulsiAnim < 1) {
    tulsiAnim = Math.min(1, tulsiAnim + dt * 1.2);
    lamps.setPower(village.tulsiDiya, tulsiAnim);
    lamps.spots[village.tulsiSpot].on = tulsiAnim;
  }
  // puris puff up and the chulha flares when frying
  if (village.fry > 0) {
    village.fry -= dt;
    village.puris.forEach((p) => (p.scale.y = Math.min(1, p.scale.y + dt * 0.9)));
    lamps.spots[village.chulhaSpot].power = 9;
  } else if (village.chulhaSpot !== undefined) lamps.spots[village.chulhaSpot].power = 5.4;
  // kiln breathes
  village.kilnMouth.material.color.setHSL(0.06, 1, 0.45 + 0.08 * Math.sin(t * 3) + 0.04 * Math.sin(t * 11));

  if (!reduceMotion) {
    // neighbouring villages' fireworks, more often from the rooftop
    nextAmbient -= dt;
    if (nextAmbient <= 0 && dawn < 0.6 && !showing) {
      const a = Math.random() * Math.PI * 2, r = 35 + Math.random() * 55;
      const salvo = Math.random() < 0.45 ? 2 + ((Math.random() * 4) | 0) : 1;
      for (let i = 0; i < salvo; i++) setTimeout(() => {
        const from = new THREE.Vector3(Math.cos(a) * r + (Math.random() - 0.5) * 12, 0, Math.sin(a) * r + (Math.random() - 0.5) * 12);
        sparks.rocket(from, from.clone().add(new THREE.Vector3(0, 24 + Math.random() * 26, 0)));
      }, i * 280);
      nextAmbient = 0.35 + Math.random() * 1.0;
    }
    // children light an anar or chakri now and then
    nextKids -= dt;
    if (nextKids <= 0) {
      const spots = [[2.2, 53.6], [-1.8, 12.9], [3, -1], [-12.4, 21]];
      const [x, z] = spots[(Math.random() * spots.length) | 0];
      const r = Math.random();
      if (r < 0.25) bomb(x + 0.8, z + 0.6);
      else {
        if (r < 0.65) sparks.anar(x, 0.01, z, 4); else sparks.chakri(x, 0.01, z, 3.5);
        const dd = camera.position.distanceTo(tmp.set(x, 0, z));
        if (dd < 25) sound.fountain(3.5);
        setTimeout(() => kidsCheer(x, z, dd), 600);
      }
      nextKids = 2 + Math.random() * 3;
    }
    nextLadi -= dt;
    if (nextLadi <= 0) {
      const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 14;
      ladi(camera.position.x + Math.cos(a) * r, camera.position.z + Math.sin(a) * r);
      nextLadi = 6 + Math.random() * 6;
    }
    nextFarBomb -= dt;
    if (nextFarBomb <= 0) { // bombs going off somewhere in the village, heard but not seen
      sound.play("crackers", { dur: 0.9, gain: 0.08 + Math.random() * 0.12, pan: Math.random() * 2 - 1, muffle: 0.55 + Math.random() * 0.35, fade: 0.01 });
      nextFarBomb = 1.2 + Math.random() * 2.5;
    }
  }

  if (tour.lastScrub && performance.now() - tour.lastScrub < 100) scrolling = true;
  updateScroll();
  if (!scrolling && (++railTick % 6 === 0)) updateRail();
  updateDawn(dt);
  updateBubble(dt);
  owlT -= dt;
  if (owlT <= 0) { if (dawn < 0.4) sound.owl(); owlT = 25 + Math.random() * 25; }
  mapAcc += dt;
  if (mapAcc > 0.12) { mapAcc = 0; drawMap(); }
  if (quality.shadows) renderer.shadowMap.needsUpdate = (shadowFrame++ & 1) === 0;
  composer.render();
  if (snapNext) { snapNext = false; savePhoto(); }

  // drop resolution if the device struggles
  fps = fps * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
  if (fps < 30) lowFrames++; else lowFrames = 0;
  if (lowFrames > 90 && renderer.getPixelRatio() > 1) {
    const r = Math.max(1, renderer.getPixelRatio() - 0.5);
    renderer.setPixelRatio(r); composer.setPixelRatio(r);
    renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
    lowFrames = 0;
  }
}

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.fov = innerWidth < innerHeight ? 72 : 58;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  sparks.uniforms.uScale.value = innerHeight * 0.3;
  grade.uniforms.uAspect.value = innerWidth / innerHeight;
});
sparks.uniforms.uScale.value = innerHeight * 0.3;
document.addEventListener("visibilitychange", () => { if (!document.hidden) clock.getDelta(); });

// real recordings from Wikimedia Commons (see assets/audio/CREDITS.md); synthesis covers for any that are missing
sound.sample("crackers", "assets/audio/firecrackers-near.ogg");
sound.sample("fireworks", "assets/audio/fireworks-distant.ogg");
sound.sample("shells", "assets/audio/fireworks-piece.ogg");
sound.sample("kids", "assets/audio/children-playing.oga");
// real recordings for the temple, the animals and the sparklers (Wikimedia Commons; see CREDITS.md)
sound.sample("ghanta", "assets/audio/ghanta.m4a");
sound.sample("conch", "assets/audio/conch.m4a");
sound.sample("dog", "assets/audio/dog-bark.m4a");
sound.sample("cow", "assets/audio/cow-moo.m4a");
sound.sample("sparkler", "assets/audio/sparklers.m4a");
// the shankh is a real conch now; the synthesised one stays as a fallback while the file loads
{ const synth = sound.conch.bind(sound); sound.conch = (...a) => (sound.has("conch") ? sound.play("conch", { offset: 0, dur: 6.4, gain: 0.5, fade: 0.06 }) : synth(...a)); }
// a sound from a place in the village: panned to it, delayed and dulled by distance
function soundAt(name, x, z, { gain = 0.5, dur, offset = 0 } = {}) {
  if (!sound.has(name)) return false;
  const d = Math.hypot(x - camera.position.x, z - camera.position.z);
  return sound.play(name, { offset, dur, gain: gain * Math.max(0.12, 1 - d / 60), pan: panOf(x, z) * 0.8, delay: d / 343, muffle: Math.min(0.85, d / 55), fade: 0.05 });
}
// now and then: the temple ghanta near the temple, cows by the cowshed, a dog somewhere in the lanes
const amb = { ghanta: 8, cow: 6, dog: 25 };
function updateAmbient(dt) {
  if (!sound.on || showing || hovering) return;
  for (const k in amb) amb[k] -= dt;
  const cam = camera.position;
  if (amb.ghanta <= 0) { amb.ghanta = 16 + Math.random() * 16; if (Math.hypot(cam.x, cam.z + 33) < 30) soundAt("ghanta", 0, -31.5, { gain: 0.45, dur: 6.8 }); }
  if (amb.cow <= 0) { amb.cow = 14 + Math.random() * 18; if (Math.hypot(cam.x - 19, cam.z - 47) < 26) soundAt("cow", 19 + (Math.random() - 0.5) * 4, 47 + (Math.random() - 0.5) * 6, { gain: 0.5, dur: 3.7 }); }
  if (amb.dog <= 0) {
    amb.dog = 35 + Math.random() * 40;
    const a = Math.random() * Math.PI * 2, r = 14 + Math.random() * 26;
    soundAt("dog", cam.x + Math.cos(a) * r, cam.z + Math.sin(a) * r, { gain: 0.42, dur: 2.55 });
  }
}
build().then(() => {
  loop();
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1600));
  idle(() => { for (const name of ["shells", "kids", "ghanta", "conch", "dog", "cow", "sparkler"]) sound.warm(name); });
}).catch((err) => {
  console.error(err);
  ui.status.textContent = "Sorry, this browser couldn't build the village (WebGL is needed).";
});
