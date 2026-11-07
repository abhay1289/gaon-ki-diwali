/* All sound is synthesised with Web Audio: no files to load. Off until the visitor turns it on. */
(function () {
  const Deepa = (window.Deepa = window.Deepa || {});
  let ac = null, master = null, bus = null, noiseBuf = null, on = false;
  let droneTimer = 0, bellTimer = 0, murmur = null, powderSrc = null;
  const tanpura = {};

  function ensure() {
    if (ac) return;
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain();
    master.gain.value = 0;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(comp).connect(ac.destination);

    // small room reverb from a decaying noise impulse
    const len = ac.sampleRate * 2.4;
    const ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    const verb = ac.createConvolver();
    verb.buffer = ir;
    const wet = ac.createGain();
    wet.gain.value = 0.28;
    bus = ac.createGain();
    bus.connect(master);
    bus.connect(verb).connect(wet).connect(master);

    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  }

  // Karplus-Strong pluck with a slight buzz, rendered once per pitch.
  function pluckBuffer(freq) {
    if (tanpura[freq]) return tanpura[freq];
    const sr = ac.sampleRate, len = sr * 5;
    const buf = ac.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const N = Math.round(sr / freq);
    const ring = new Float32Array(N).map(() => Math.random() * 2 - 1);
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const a = ring[idx], b = ring[(idx + 1) % N];
      let v = 0.4985 * (a + b);
      v = v + 0.06 * Math.tanh(v * 6) * (1 - i / len); // jawari buzz
      ring[idx] = v;
      d[i] = a * 0.5;
      idx = (idx + 1) % N;
    }
    return (tanpura[freq] = buf);
  }

  function noise(dur, { type = "lowpass", f = 1000, q = 0.7, gain = 0.3, attack = 0.005, at = 0, fEnd = null, dest = bus } = {}) {
    const t = ac.currentTime + at;
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const filt = ac.createBiquadFilter();
    filt.type = type;
    filt.frequency.setValueAtTime(f, t);
    if (fEnd) filt.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
    filt.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt).connect(g).connect(dest);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  function bell(level = 0.5, base = 0) {
    if (!on) return;
    const f0 = base || [523.25, 587.33, 698.46][(Math.random() * 3) | 0];
    const t = ac.currentTime;
    [[1, 1, 4], [2.0, 0.5, 2.5], [2.76, 0.35, 2], [5.4, 0.2, 1.2], [8.93, 0.1, 0.6]].forEach(([r, a, d]) => {
      const o = ac.createOscillator();
      o.type = "sine";
      o.frequency.value = f0 * r;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09 * a * level, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(bus);
      o.start(t);
      o.stop(t + d + 0.1);
    });
  }

  function startDrone() {
    // tanpura cycle: Pa, Sa, Sa, low Sa
    const sa = 138.59;
    const notes = [sa * 0.75, sa, sa, sa / 2];
    const cycle = () => {
      if (!on) return;
      notes.forEach((f, i) => {
        const src = ac.createBufferSource();
        src.buffer = pluckBuffer(f);
        const g = ac.createGain();
        g.gain.value = i === 3 ? 0.16 : 0.11;
        const lp = ac.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 2400;
        src.connect(lp).connect(g).connect(bus);
        src.start(ac.currentTime + i * 1.05);
      });
    };
    cycle();
    droneTimer = setInterval(cycle, 4200);
    const ring = () => { bell(0.35); bellTimer = setTimeout(ring, 9000 + Math.random() * 9000); };
    bellTimer = setTimeout(ring, 3000);
  }

  function stopDrone() {
    clearInterval(droneTimer);
    clearTimeout(bellTimer);
  }

  const api = {
    get on() { return on; },
    // browsers keep audio suspended until the visitor first touches the page; these let the page check
    // whether sound is really running, and wake it on that first touch
    state() { return ac ? ac.state : "none"; },
    unlock() { ensure(); return ac.resume(); },
    async toggle() {
      ensure();
      on = !on;
      if (on) {
        api._decodeAll();
        await ac.resume();
        master.gain.cancelScheduledValues(ac.currentTime);
        master.gain.setTargetAtTime(0.85, ac.currentTime, 0.4);
        // (the tanpura drone is switched off by request)
        api.night(true);
        if (api._wantMurmur) api.murmur(true);
      } else {
        master.gain.setTargetAtTime(0, ac.currentTime, 0.15);
        stopDrone();
        api.night(false);
        api.dhol(false);
        api.stopBeds();
        api.murmur(false, true);
        setTimeout(() => { if (!on) ac.suspend(); }, 600);
      }
      return on;
    },
    bell,
    strike() {
      if (!on) return;
      noise(0.12, { type: "bandpass", f: 3200, q: 1.2, gain: 0.25 });
      noise(0.6, { type: "lowpass", f: 900, gain: 0.08, attack: 0.05, at: 0.06 });
      bell(0.25, 1046.5);
    },
    launch() {
      if (!on) return;
      noise(1.0, { type: "bandpass", f: 900, fEnd: 3200, q: 3, gain: 0.05, attack: 0.08 });
    },
    burst(size = 1) {
      if (!on) return;
      const at = 0.05 + Math.random() * 0.2; // distance delay
      noise(1.6 * size, { type: "lowpass", f: 1400, fEnd: 120, gain: 0.55 * size, at });
      const o = ac.createOscillator();
      const g = ac.createGain();
      const t = ac.currentTime + at;
      o.frequency.setValueAtTime(90, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.4);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(bus);
      o.start(t);
      o.stop(t + 0.6);
    },
    crackle() {
      if (!on || Math.random() > 0.35) return;
      for (let i = 0; i < 4; i++) noise(0.03, { type: "highpass", f: 2500, gain: 0.12, at: Math.random() * 0.3 });
    },
    fountain(dur) {
      if (!on) return;
      noise(dur, { type: "bandpass", f: 2200, q: 0.6, gain: 0.12, attack: 0.4 });
    },
    sweep() {
      if (!on) return;
      noise(0.5, { type: "bandpass", f: 1800, fEnd: 600, q: 0.8, gain: 0.12, attack: 0.1 });
    },
    powder(start) {
      if (!on && start) return;
      if (start && !powderSrc) {
        const src = ac.createBufferSource();
        src.buffer = noiseBuf;
        src.loop = true;
        const f = ac.createBiquadFilter();
        f.type = "bandpass"; f.frequency.value = 4200; f.Q.value = 0.8;
        const g = ac.createGain();
        g.gain.value = 0;
        g.gain.setTargetAtTime(0.05, ac.currentTime, 0.05);
        src.connect(f).connect(g).connect(bus);
        src.start();
        powderSrc = { src, g };
      } else if (!start && powderSrc) {
        const p = powderSrc;
        powderSrc = null;
        p.g.gain.setTargetAtTime(0, ac.currentTime, 0.05);
        setTimeout(() => p.src.stop(), 300);
      }
    },
    coin() {
      if (!on) return;
      [2093, 2637, 3136].forEach((f, i) => {
        const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + i * 0.06;
        o.type = "triangle"; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.06, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        o.connect(g).connect(bus); o.start(t); o.stop(t + 0.4);
      });
    },
    // village night: crickets in the fields
    night(want) {
      if (!ac) return;
      if (want && !api._crickets) {
        const o = ac.createOscillator(), am = ac.createOscillator(), chirp = ac.createOscillator();
        const g = ac.createGain(), amg = ac.createGain(), cg = ac.createGain(), out = ac.createGain();
        o.frequency.value = 4400;
        am.type = "square"; am.frequency.value = 28; amg.gain.value = 0.5;
        chirp.type = "square"; chirp.frequency.value = 1.6; cg.gain.value = 0.5;
        g.gain.value = 0.5;
        am.connect(amg).connect(g.gain);
        out.gain.value = 0;
        chirp.connect(cg).connect(out.gain);
        const lvl = ac.createGain(); lvl.gain.value = 0.012;
        o.connect(g).connect(out).connect(lvl).connect(bus);
        o.start(); am.start(); chirp.start();
        api._crickets = { o, am, chirp, lvl };
      } else if (!want && api._crickets) {
        const c = api._crickets; api._crickets = null;
        c.lvl.gain.setTargetAtTime(0, ac.currentTime, 0.2);
        setTimeout(() => { c.o.stop(); c.am.stop(); c.chirp.stop(); }, 800);
      }
    },
    // shankh: a conch blown for aarti
    conch() {
      if (!on) return;
      const t = ac.currentTime, o = ac.createOscillator(), vib = ac.createOscillator(), vg = ac.createGain(), g = ac.createGain();
      o.type = "sawtooth"; o.frequency.setValueAtTime(220, t); o.frequency.linearRampToValueAtTime(233, t + 0.5);
      vib.frequency.value = 5; vg.gain.value = 2.5; vib.connect(vg).connect(o.frequency);
      const f1 = ac.createBiquadFilter(); f1.type = "bandpass"; f1.frequency.value = 700; f1.Q.value = 4;
      const f2 = ac.createBiquadFilter(); f2.type = "bandpass"; f2.frequency.value = 1150; f2.Q.value = 5;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.5); g.gain.setValueAtTime(0.35, t + 2.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
      o.connect(f1).connect(g); o.connect(f2).connect(g); g.connect(bus);
      o.start(t); vib.start(t); o.stop(t + 3.1); vib.stop(t + 3.1);
    },
    // sutli bomb: a hard crack with a low thump and a rattle of echoes
    bang(level = 1) {
      if (!on) return;
      noise(0.06, { type: "highpass", f: 900, gain: 0.9 * level });
      noise(1.2, { type: "lowpass", f: 900, fEnd: 60, gain: 0.8 * level, attack: 0.002 });
      const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.5);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9 * level, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g).connect(bus); o.start(t); o.stop(t + 0.7);
      for (let i = 1; i < 4; i++) noise(0.4, { type: "lowpass", f: 500, gain: 0.12 * level / i, at: 0.18 * i });
    },
    // dhol: "dha-dhin-dhin-dha" on the bass and treble heads, while the fair is near
    dhol(want, level = 1) {
      if (!ac) return;
      if (want && !api._dhol && on) {
        let step = 0;
        const hit = (bass, gain) => {
          const t = ac.currentTime + 0.01;
          if (bass) {
            const o = ac.createOscillator(), g = ac.createGain();
            o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.18);
            g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
            o.connect(g).connect(bus); o.start(t); o.stop(t + 0.4);
          } else noise(0.09, { type: "bandpass", f: 2400, q: 1.2, gain: gain * 0.7 });
        };
        // 16-step bhangra pattern at ~138 bpm
        const pat = [[1, 1], [0, 0], [0, 0.6], [0, 0], [0, 0.7], [0, 0], [1, 0.8], [0, 0.5], [1, 1], [0, 0], [0, 0.6], [0, 0.4], [0, 0.7], [0, 0.5], [1, 0.8], [0, 0.6]];
        api._dhol = setInterval(() => {
          const [bass, g] = pat[step % 16];
          if (g) hit(bass, g * 0.35 * api._dholLevel);
          step++;
        }, 108);
      } else if (!want && api._dhol) { clearInterval(api._dhol); api._dhol = null; }
      api._dholLevel = level;
    },
    _dholLevel: 1,
    // aarti: harmonium melody over manjira and a steadily rung ghanti, for `dur` seconds
    aarti(dur = 18) {
      if (!on) return;
      const t0 = ac.currentTime + 0.1;
      const sa = 277.18; // C#4
      const R = { S: 1, R: 9 / 8, G: 5 / 4, P: 3 / 2, D: 5 / 3, s: 2, d: 5 / 6 };
      // an original phrase in the pentatonic Bhupali scale, in eighth notes
      const phrase = "G G G R G P G R S R G G R S d S G P D P G R G - P D s D P G R S".split(" ");
      const beat = 0.34;
      const harm = (f, at, len) => {
        const g = ac.createGain(), lp = ac.createBiquadFilter();
        lp.type = "lowpass"; lp.frequency.value = 1900;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(0.06, at + 0.05);
        g.gain.setValueAtTime(0.06, at + len - 0.06);
        g.gain.exponentialRampToValueAtTime(0.0001, at + len);
        lp.connect(g).connect(bus);
        [[1, "sawtooth"], [1.004, "sawtooth"], [0.5, "square"]].forEach(([m, type]) => {
          const o = ac.createOscillator(); o.type = type; o.frequency.value = f * m;
          o.connect(lp); o.start(at); o.stop(at + len + 0.05);
        });
      };
      let i = 0;
      for (let at = t0; at < t0 + dur - beat; at += beat, i++) {
        const n = phrase[i % phrase.length];
        void n; void harm; void R; // the harmonium is switched off by request
        // manjira: a bright ting on the beat, a choked chik off it
        noise(i % 2 ? 0.04 : 0.18, { type: "highpass", f: i % 2 ? 6000 : 4200, gain: i % 2 ? 0.04 : 0.09, at: at - ac.currentTime });
        // the ghanti, rung every half beat-pair
        if (i % 2 === 0) setTimeout(() => bell(0.22, 1318.5), (at - ac.currentTime) * 1000);
      }
      // (the Sa-Pa drone underneath is switched off by request)
      [].forEach((f) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = "sawtooth"; o.frequency.value = f;
        const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 600;
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.025, t0 + 1); g.gain.setValueAtTime(0.025, t0 + dur - 1); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(lp).connect(g).connect(bus); o.start(t0); o.stop(t0 + dur + 0.1);
      });
    },
    // a diesel horn far across the fields: two reedy tones a third apart
    horn(level = 0.5) {
      return; // the horn is switched off by request
      // eslint-disable-next-line no-unreachable
      if (!on) return;
      const t = ac.currentTime + 0.05;
      [[311, 0], [392, 0], [311, 1.1], [392, 1.1]].forEach(([f, d]) => {
        const o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
        o.type = "sawtooth"; o.frequency.value = f;
        lp.type = "lowpass"; lp.frequency.value = 1100;
        const len = d ? 1.6 : 0.7;
        g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.05 * level, t + d + 0.08);
        g.gain.setValueAtTime(0.05 * level, t + d + len - 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + d + len);
        o.connect(lp).connect(g).connect(bus); o.start(t + d); o.stop(t + d + len + 0.05);
      });
      noise(6, { type: "lowpass", f: 300, gain: 0.04 * level, attack: 2, at: 0.5 }); // the rumble of the wheels
    },
    // a spotted owlet in the neem: a soft "hoo-hoo"
    owl() {
      return; // switched off by request
      [0, 0.45].forEach((d, i) => {
        const t = ac.currentTime + d, o = ac.createOscillator(), g = ac.createGain();
        o.frequency.setValueAtTime(i ? 380 : 420, t); o.frequency.exponentialRampToValueAtTime(i ? 350 : 390, t + 0.35);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
        o.connect(g).connect(bus); o.start(t); o.stop(t + 0.45);
      });
    },
    // first birds before sunrise: quick rising chirps
    chirp() {
      if (!on) return;
      const n = 2 + ((Math.random() * 4) | 0), base = 2600 + Math.random() * 1400;
      for (let i = 0; i < n; i++) {
        const t = ac.currentTime + i * 0.11, o = ac.createOscillator(), g = ac.createGain();
        o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * 1.5, t + 0.07);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
        o.connect(g).connect(bus); o.start(t); o.stop(t + 0.1);
      }
    },
    // a little "ji?" when someone turns to talk to you
    blip() {
      if (!on) return;
      bell(0.12, 1567.98);
    },
    // the tanpura drone steps aside while songs play
    setDrone() {
      // the tanpura drone is switched off by request; kept as a no-op so callers needn't change
      stopDrone();
    },
    // wind past the drone: a long, slowly swelling band of air
    whoosh(dur = 8) {
      if (!on) return;
      noise(dur, { type: "bandpass", f: 300, fEnd: 900, q: 0.6, gain: 0.07, attack: dur * 0.45 });
      noise(dur * 0.8, { type: "lowpass", f: 180, gain: 0.06, attack: dur * 0.3 });
    },
    /* ---------- real recordings (assets/audio), used when present ---------- */
    _samples: {},
    _loops: {},
    // remember the file; download only when warm() or the first play asks for it
    sample(name, url) {
      api._samples[name] = { url, buf: null, raw: null };
    },
    warm(name) {
      const s2 = api._samples[name];
      if (!s2 || s2.raw) return;
      s2.raw = fetch(s2.url).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
      if (ac) api._buf(name);
    },
    // decode recordings that are already on the way, so has() is true when it matters
    _decodeAll() { for (const n of Object.keys(api._samples)) if (api._samples[n].raw) api._buf(n); },
    async _buf(name) {
      const s2 = api._samples[name];
      if (!s2 || !ac) return null;
      if (s2.buf) return s2.buf;
      if (!s2.raw) api.warm(name);
      if (!s2.decoding) s2.decoding = s2.raw.then((raw) => (raw ? ac.decodeAudioData(raw.slice(0)) : null)).catch(() => null);
      s2.buf = await s2.decoding;
      return s2.buf;
    },
    has(name) { return !!api._samples[name]?.buf; },
    // play a stretch of a recording, panned and at a level
    // delay: seconds before it is heard (sound lags light over distance); muffle 0..1 rolls off the highs
    async play(name, { offset = null, dur = 2.5, gain = 0.5, pan = 0, fade = 0.15, delay = 0, muffle = 0 } = {}) {
      if (!on) return false;
      const buf = await api._buf(name);
      if (!buf) return false;
      const t = ac.currentTime + delay, src = ac.createBufferSource(), g = ac.createGain(), p = ac.createStereoPanner();
      const lp = ac.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 18000 * Math.pow(600 / 18000, Math.max(0, Math.min(1, muffle)));
      src.buffer = buf;
      const start = offset ?? Math.random() * Math.max(0, buf.duration - dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + fade);
      g.gain.setValueAtTime(gain, t + dur - fade);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      p.pan.value = Math.max(-1, Math.min(1, pan));
      src.connect(lp).connect(g).connect(p).connect(bus);
      src.start(t, start, dur + 0.05);
      return true;
    },
    // a recording looping quietly underneath everything
    async bed(name, gain) {
      if (!on || api._loops[name]) return;
      const buf = await api._buf(name);
      if (!buf || api._loops[name] || !on) return;
      const src = ac.createBufferSource(), g = ac.createGain();
      src.buffer = buf; src.loop = true;
      g.gain.value = 0;
      g.gain.setTargetAtTime(gain, ac.currentTime, 2);
      src.connect(g).connect(bus);
      src.start(0, Math.random() * buf.duration);
      api._loops[name] = { src, g, gain };
    },
    bedLevel(name, k) {
      const l = api._loops[name];
      if (l) l.g.gain.setTargetAtTime(l.gain * k, ac.currentTime, 1);
    },
    stopBeds() {
      for (const [k, l] of Object.entries(api._loops)) { l.g.gain.setTargetAtTime(0, ac.currentTime, 0.3); setTimeout(() => l.src.stop(), 1500); delete api._loops[k]; }
    },
    // a distant or near pop scaled by distance
    pop(level = 1) {
      if (!on) return;
      noise(0.5 + level * 0.8, { type: "lowpass", f: 600 + level * 1400, fEnd: 100, gain: 0.08 + 0.45 * level, at: 0.02 + (1 - level) * 0.3 });
    },
    // crowd murmur while the bazaar is on screen
    _wantMurmur: false,
    murmur(want, keepWish) {
      if (!keepWish) api._wantMurmur = want;
      if (!on || !ac) return;
      if (want && !murmur) {
        const src = ac.createBufferSource();
        src.buffer = noiseBuf; src.loop = true;
        const f = ac.createBiquadFilter();
        f.type = "bandpass"; f.frequency.value = 520; f.Q.value = 1.4;
        const g = ac.createGain();
        g.gain.value = 0;
        const lfo = ac.createOscillator(), lg = ac.createGain();
        lfo.frequency.value = 0.35; lg.gain.value = 0.025;
        lfo.connect(lg).connect(g.gain);
        g.gain.setTargetAtTime(0.06, ac.currentTime, 0.8);
        src.connect(f).connect(g).connect(bus);
        src.start(); lfo.start();
        murmur = { src, g, lfo };
        const call = () => { if (!murmur) return; bell(0.12, 880 + Math.random() * 400); murmur.t = setTimeout(call, 5000 + Math.random() * 7000); };
        murmur.t = setTimeout(call, 2500);
      } else if (!want && murmur) {
        const m = murmur;
        murmur = null;
        clearTimeout(m.t);
        m.g.gain.setTargetAtTime(0, ac.currentTime, 0.4);
        setTimeout(() => { m.src.stop(); m.lfo.stop(); }, 2000);
      }
    },
  };

  Deepa.sound = api;
})();
