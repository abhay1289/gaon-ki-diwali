/* Night sky: tap-to-launch rockets, several burst styles, ground anars and a finale. */
(function () {
  const { fitCanvas, loopWhenVisible, rand, reduceMotion } = window.Deepa;

  const COLORS = [
    [255, 196, 90],  // gold
    [255, 90, 110],  // rose
    [120, 230, 140], // emerald
    [110, 200, 255], // sky
    [200, 130, 255], // violet
    [255, 245, 230], // white
    [255, 130, 40],  // saffron
  ];
  const TYPES = ["peony", "peony", "willow", "ring", "crackle", "palm"];

  window.Deepa.initFireworks = function () {
    const root = document.querySelector("[data-sky]");
    if (!root) return;
    const canvas = root.querySelector("[data-sky-canvas]");
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, dpr = 1;
    const rockets = [], sparks = [], fountains = [];
    let stars = [], flash = 0, lastUser = -10, nextAuto = 1.5, now = 0;
    const MAX = 3200;

    function layout() {
      ({ w: W, h: H, dpr } = fitCanvas(canvas, 1.5));
      ctx.fillStyle = "#04030a";
      ctx.fillRect(0, 0, W, H);
      stars = Array.from({ length: 140 }, () => ({ x: Math.random() * W, y: Math.random() * H * 0.7, r: Math.random() * 1.2 * dpr + 0.3, p: Math.random() * 6 }));
    }

    function launch(tx, ty, type, color) {
      const sx = tx + rand(-0.08, 0.08) * W;
      rockets.push({
        x: sx, y: H * 1.02, sx, tx, ty,
        t: 0, dur: rand(0.9, 1.3),
        type: type || TYPES[(Math.random() * TYPES.length) | 0],
        c: color || COLORS[(Math.random() * COLORS.length) | 0],
        c2: COLORS[(Math.random() * COLORS.length) | 0],
      });
      window.Deepa.sound?.launch();
    }

    function spark(x, y, vx, vy, c, o = {}) {
      if (sparks.length > MAX) return;
      sparks.push({ x, y, px: x, py: y, vx, vy, c, life: 0, max: o.max || rand(1.1, 1.8), drag: o.drag ?? 0.985, g: o.g ?? 1, crackle: o.crackle || false, size: o.size || 1.6 });
    }

    function burst(r) {
      const { x, y, c, c2, type } = r;
      const S = Math.min(W, H) * (type === "willow" ? 0.34 : 0.3);
      flash = Math.min(1, flash + 0.55);
      window.Deepa.sound?.burst(type === "willow" ? 1.2 : 1);
      if (type === "ring") {
        const n = 70, tilt = rand(0.3, 0.9), rot = rand(0, Math.PI);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const vx = Math.cos(a), vy = Math.sin(a) * tilt;
          spark(x, y, (vx * Math.cos(rot) - vy * Math.sin(rot)) * S * 1.4, (vx * Math.sin(rot) + vy * Math.cos(rot)) * S * 1.4, c, { max: 1.5, drag: 0.975, g: 0.6 });
        }
        for (let i = 0; i < 30; i++) { const a = rand(0, 6.28), m = rand(0, 0.35); spark(x, y, Math.cos(a) * S * m, Math.sin(a) * S * m, c2, { max: 1 }); }
        return;
      }
      if (type === "palm") {
        const arms = 7;
        for (let i = 0; i < arms; i++) {
          const a = (i / arms) * Math.PI * 2 + rand(-0.1, 0.1) - Math.PI / 2;
          for (let k = 0; k < 14; k++) {
            const m = 0.6 + k * 0.035;
            spark(x, y, Math.cos(a) * S * m * 1.5, Math.sin(a) * S * m * 1.5 - S * 0.2, [255, 190, 90], { max: rand(1.8, 2.4), drag: 0.97, g: 1.3, size: 2 });
          }
        }
        return;
      }
      const n = type === "willow" ? 120 : type === "crackle" ? 90 : 140;
      for (let i = 0; i < n; i++) {
        // even-ish sphere: random direction, speed biased to the shell
        const a = rand(0, Math.PI * 2);
        const m = Math.pow(Math.random(), 0.25) * rand(0.9, 1.05);
        const col = type === "willow" ? [255, 180, 80] : i % 5 === 0 ? c2 : c;
        spark(x, y, Math.cos(a) * S * m * 1.5, Math.sin(a) * S * m * 1.5, col, {
          max: type === "willow" ? rand(2.6, 3.4) : rand(1.2, 1.9),
          drag: type === "willow" ? 0.955 : 0.982,
          g: type === "willow" ? 0.55 : 1,
          crackle: type === "crackle",
          size: type === "willow" ? 1.4 : 1.7,
        });
      }
    }

    function anar(x) {
      fountains.push({ x: x ?? rand(0.15, 0.85) * W, t: 0, dur: 4.5 });
      window.Deepa.sound?.fountain(4.5);
    }

    root.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) * dpr, y = (e.clientY - r.top) * dpr;
      lastUser = now;
      launch(x, Math.min(y, H * 0.7));
    });
    root.querySelector("[data-sky-anar]").addEventListener("click", () => { lastUser = now; anar(); });
    root.querySelector("[data-sky-finale]").addEventListener("click", () => {
      lastUser = now;
      for (let i = 0; i < 14; i++) setTimeout(() => launch(rand(0.1, 0.9) * W, rand(0.12, 0.45) * H), i * 180 + rand(0, 120));
      anar(W * 0.25); anar(W * 0.75);
    });

    const frame = (t, dt) => {
      now = t;
      if (!dt) return;
      ctx.lineCap = "round";
      // fade previous frame to leave trails
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(4,3,10,0.22)";
      ctx.fillRect(0, 0, W, H);

      // stars, dimmed by flashes
      for (const s of stars) {
        ctx.fillStyle = `rgba(255,240,220,${(0.25 + 0.25 * Math.sin(t * 1.3 + s.p)) * (1 - flash * 0.6)})`;
        ctx.fillRect(s.x, s.y, s.r, s.r);
      }

      ctx.globalCompositeOperation = "lighter";
      if (flash > 0.01) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, `rgba(255,200,140,${flash * 0.05})`);
        g.addColorStop(1, `rgba(255,150,80,${flash * 0.12})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        flash *= Math.pow(0.04, dt);
      }

      // auto show when the visitor is just watching
      if (!reduceMotion && t - lastUser > 5) {
        nextAuto -= dt;
        if (nextAuto <= 0) { launch(rand(0.15, 0.85) * W, rand(0.15, 0.45) * H); nextAuto = rand(1.1, 2.6); }
      }

      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.t += dt;
        const u = Math.min(1, r.t / r.dur);
        const e = 1 - Math.pow(1 - u, 2.2);
        const px = r.x, py = r.y;
        r.x = r.sx + (r.tx - r.sx) * e + Math.sin(r.t * 30) * dpr * 0.6;
        r.y = H * 1.02 + (r.ty - H * 1.02) * e;
        ctx.strokeStyle = "rgba(255,200,120,0.9)";
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(r.x, r.y); ctx.stroke();
        if (Math.random() < 0.6) spark(r.x, r.y, rand(-20, 20) * dpr, rand(10, 60) * dpr, [255, 170, 80], { max: 0.5, size: 1 });
        if (u >= 1) { burst(r); rockets.splice(i, 1); }
      }

      for (let i = fountains.length - 1; i >= 0; i--) {
        const f = fountains[i];
        f.t += dt;
        const k = Math.sin(Math.min(1, f.t / f.dur) * Math.PI);
        const base = H - Math.min(H * 0.09, 70 * dpr);
        for (let j = 0; j < 14 * k + 2; j++) {
          const a = -Math.PI / 2 + rand(-0.32, 0.32);
          const v = rand(0.5, 1) * H * 0.85 * (0.5 + 0.5 * k);
          spark(f.x, base, Math.cos(a) * v, Math.sin(a) * v, Math.random() < 0.8 ? [255, 190, 100] : [255, 245, 220], { max: rand(0.6, 1.1), drag: 0.97, g: 1.6, size: 1.3 });
        }
        // hot core of the cone
        const g = ctx.createRadialGradient(f.x, base, 0, f.x, base, 60 * dpr);
        g.addColorStop(0, `rgba(255,210,140,${0.7 * k})`);
        g.addColorStop(1, "rgba(255,140,40,0)");
        ctx.fillStyle = g;
        ctx.fillRect(f.x - 60 * dpr, base - 60 * dpr, 120 * dpr, 120 * dpr);
        if (f.t >= f.dur) fountains.splice(i, 1);
      }

      const grav = H * 0.32;
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.life += dt;
        const k = 1 - p.life / p.max;
        if (k <= 0) {
          if (p.crackle && !p.done) {
            p.done = true;
            for (let j = 0; j < 3; j++) spark(p.x, p.y, rand(-30, 30) * dpr, rand(-30, 30) * dpr, [255, 250, 235], { max: 0.25, size: 1.2 });
            window.Deepa.sound?.crackle();
          }
          sparks.splice(i, 1);
          continue;
        }
        p.px = p.x; p.py = p.y;
        const d = Math.pow(p.drag, dt * 60);
        p.vx *= d; p.vy *= d;
        p.vy += grav * p.g * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        const tw = p.crackle ? (Math.random() < 0.5 ? 1 : 0.3) : 1;
        const a = Math.min(1, k * 1.6) * tw;
        const [r, g, b] = p.c;
        // whiten when fresh, deepen as it cools
        const hot = Math.max(0, (k - 0.75) * 4);
        ctx.strokeStyle = `rgba(${r + (255 - r) * hot | 0},${g + (255 - g) * hot | 0},${b + (255 - b) * hot | 0},${a})`;
        ctx.lineWidth = p.size * dpr * (0.6 + 0.4 * k);
        ctx.beginPath(); ctx.moveTo(p.px, p.py); ctx.lineTo(p.x, p.y); ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
      root.style.setProperty("--flash", flash.toFixed(3));
    };

    layout();
    window.addEventListener("resize", layout);
    ctx.lineCap = "round";
    loopWhenVisible(canvas, frame);
  };
})();
