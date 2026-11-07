/* Shared canvas painters: flame, clay diya, helpers. Exposed on window.Deepa. */
(function () {
  const Deepa = (window.Deepa = window.Deepa || {});

  Deepa.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Size a canvas to its CSS box at device resolution (capped at 2x).
  Deepa.fitCanvas = function (canvas, maxDpr = 2) {
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return { w, h, dpr, cssW: r.width, cssH: r.height };
  };

  // Run a frame loop only while the element is on screen.
  Deepa.loopWhenVisible = function (el, frame) {
    let raf = 0, visible = false, last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      frame(now / 1000, dt);
      if (visible) raf = requestAnimationFrame(tick);
    };
    new IntersectionObserver((entries) => {
      const on = entries[0].isIntersecting;
      if (on && !visible) { visible = true; last = performance.now(); raf = requestAnimationFrame(tick); }
      if (!on) { visible = false; cancelAnimationFrame(raf); }
    }, { rootMargin: "120px" }).observe(el);
    return () => frame(performance.now() / 1000, 0);
  };

  Deepa.rand = (a, b) => a + Math.random() * (b - a);

  // Seeded PRNG so painted goods stay identical between redraws.
  Deepa.seeded = function (seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  };

  function flicker(t, seed) {
    return 1
      + 0.07 * Math.sin(t * 11.3 + seed)
      + 0.05 * Math.sin(t * 6.7 + seed * 1.7)
      + 0.035 * Math.sin(t * 23.1 + seed * 2.3)
      + 0.02 * Math.sin(t * 41.7 + seed * 0.7);
  }

  /*
   * Flame anchored at the wick tip (x, y), height h. `power` 0..1 scales it while igniting.
   */
  Deepa.drawFlame = function (ctx, x, y, h, t, seed = 0, power = 1, glow = 1) {
    if (power <= 0.01) return;
    const f = Deepa.reduceMotion ? 1 : flicker(t, seed);
    const H = h * f * (0.35 + 0.65 * power);
    const sway = Deepa.reduceMotion ? 0 : (Math.sin(t * 2.1 + seed) * 0.07 + Math.sin(t * 5.3 + seed * 3) * 0.035) * H;
    const w = h * 0.3 * (0.6 + 0.4 * power);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    // halo
    const gr = h * 3.4 * glow;
    const halo = ctx.createRadialGradient(x, y - H * 0.4, 0, x, y - H * 0.4, gr);
    const a = 0.32 * power * glow * (0.9 + 0.1 * f);
    halo.addColorStop(0, `rgba(255,170,70,${a})`);
    halo.addColorStop(0.25, `rgba(255,120,40,${a * 0.45})`);
    halo.addColorStop(1, "rgba(255,90,20,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(x - gr, y - H * 0.4 - gr, gr * 2, gr * 2);

    // outer flame
    const tipX = x + sway, tipY = y - H;
    const teardrop = (scale, lift) => {
      const ww = w * scale, hh = H * scale;
      const by = y + h * 0.05 - lift;
      ctx.beginPath();
      ctx.moveTo(x, by);
      ctx.bezierCurveTo(x - ww * 1.05, by - hh * 0.05, x - ww * 0.75 + sway * 0.25, by - hh * 0.55, x + sway * scale, by - hh);
      ctx.bezierCurveTo(x + ww * 0.75 + sway * 0.25, by - hh * 0.55, x + ww * 1.05, by - hh * 0.05, x, by);
      ctx.closePath();
    };

    let g = ctx.createLinearGradient(x, y, tipX, tipY);
    g.addColorStop(0, "rgba(255,110,30,0.55)");
    g.addColorStop(0.35, "rgba(255,150,40,0.85)");
    g.addColorStop(0.75, "rgba(255,120,30,0.55)");
    g.addColorStop(1, "rgba(220,60,10,0)");
    teardrop(1, 0);
    ctx.fillStyle = g;
    ctx.fill();

    // bright body
    g = ctx.createRadialGradient(x, y - H * 0.28, 0, x, y - H * 0.28, H * 0.6);
    g.addColorStop(0, "rgba(255,252,230,0.95)");
    g.addColorStop(0.45, "rgba(255,215,120,0.75)");
    g.addColorStop(1, "rgba(255,150,40,0)");
    teardrop(0.72, h * 0.02);
    ctx.fillStyle = g;
    ctx.fill();

    // blue root
    g = ctx.createRadialGradient(x, y - h * 0.02, 0, x, y - h * 0.02, w * 0.9);
    g.addColorStop(0, "rgba(90,130,255,0.55)");
    g.addColorStop(1, "rgba(60,80,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y - h * 0.02, w * 0.6, h * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  /*
   * Clay diya. (cx, cy) is the centre of the rim; s is the bowl width.
   * opts: { lit 0..1, t, seed, paint: 'dots'|'plain'|'gold', clay: [dark, mid, light] }
   * Returns the wick tip so callers can hit-test or place the flame.
   */
  Deepa.drawDiya = function (ctx, cx, cy, s, opts = {}) {
    const lit = opts.lit || 0;
    const t = opts.t || 0;
    const seed = opts.seed || 0;
    const clay = opts.clay || ["#3a1407", "#a04a22", "#d27a3e"];
    const rim = s * 0.13;
    const depth = s * 0.34;
    const spoutX = cx + s * 0.62, spoutY = cy - s * 0.035;
    const wick = { x: cx + s * 0.5, y: cy - s * 0.07 };

    // ground glow + contact shadow
    if (lit > 0) {
      const gg = ctx.createRadialGradient(cx + s * 0.1, cy + depth, 0, cx + s * 0.1, cy + depth, s * 1.6);
      gg.addColorStop(0, `rgba(255,140,50,${0.28 * lit})`);
      gg.addColorStop(1, "rgba(255,120,40,0)");
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.ellipse(cx + s * 0.1, cy + depth, s * 1.6, s * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.04, cy + depth - s * 0.01, s * 0.46, s * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();

    // body path (bowl + spout)
    const body = new Path2D();
    body.moveTo(cx - s * 0.5, cy);
    body.bezierCurveTo(cx - s * 0.5, cy + depth * 0.75, cx - s * 0.22, cy + depth, cx, cy + depth);
    body.bezierCurveTo(cx + s * 0.22, cy + depth, cx + s * 0.44, cy + depth * 0.62, cx + s * 0.5, cy + depth * 0.18);
    body.quadraticCurveTo(cx + s * 0.56, cy + s * 0.02, spoutX, spoutY);
    body.quadraticCurveTo(cx + s * 0.5, cy - rim * 0.95, cx + s * 0.38, cy - rim * 0.7);
    body.ellipse(cx, cy, s * 0.5, rim, 0, -0.62, Math.PI, true);
    body.closePath();

    let g = ctx.createLinearGradient(cx - s * 0.5, 0, cx + s * 0.62, 0);
    g.addColorStop(0, clay[0]);
    g.addColorStop(0.32, clay[2]);
    g.addColorStop(0.55, clay[1]);
    g.addColorStop(1, clay[0]);
    ctx.fillStyle = g;
    ctx.fill(body);

    ctx.save();
    ctx.clip(body);
    // vertical shading: lip catches light, base falls off
    g = ctx.createLinearGradient(0, cy - rim, 0, cy + depth);
    g.addColorStop(0, "rgba(255,220,180,0.12)");
    g.addColorStop(0.35, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - s, cy - rim, s * 2, depth + rim);

    // clay grain (seeded so it doesn't crawl)
    const rnd = Deepa.seeded(seed * 9973 + 7);
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = rnd() > 0.5 ? "rgba(0,0,0,0.12)" : "rgba(255,200,150,0.07)";
      const px = cx - s * 0.5 + rnd() * s * 1.1, py = cy + rnd() * depth;
      ctx.fillRect(px, py, s * 0.012, s * 0.012);
    }

    // painted band
    if (opts.paint !== "plain") {
      const n = 11;
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n;
        const ang = Math.PI * (1 - u);
        const px = cx + Math.cos(ang) * s * 0.44;
        const py = cy + depth * 0.36 + Math.sin(ang) * depth * 0.22;
        const shade = 0.55 + 0.45 * Math.sin(ang);
        ctx.fillStyle = opts.paint === "gold"
          ? `rgba(255,${200 * shade | 0},90,${0.9 * shade})`
          : (i % 2 ? `rgba(250,240,220,${0.85 * shade})` : `rgba(255,200,40,${0.85 * shade})`);
        ctx.beginPath();
        ctx.arc(px, py, s * (i % 2 ? 0.022 : 0.032), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = opts.paint === "gold" ? "rgba(255,210,110,0.7)" : "rgba(200,30,30,0.75)";
      ctx.lineWidth = s * 0.018;
      ctx.beginPath();
      ctx.ellipse(cx, cy + depth * 0.18, s * 0.49, rim * 1.1, 0, 0.15, Math.PI - 0.15);
      ctx.stroke();
    }

    // warm light from own flame
    if (lit > 0) {
      g = ctx.createRadialGradient(wick.x, wick.y - s * 0.1, 0, wick.x, wick.y, s * 0.9);
      g.addColorStop(0, `rgba(255,170,80,${0.45 * lit})`);
      g.addColorStop(1, "rgba(255,120,40,0)");
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = g;
      ctx.fillRect(cx - s, cy - rim, s * 2, depth + rim * 2);
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.restore();

    // rim + oil
    ctx.fillStyle = clay[0];
    ctx.beginPath();
    ctx.ellipse(cx, cy, s * 0.5, rim, 0, 0, Math.PI * 2);
    ctx.fill();
    g = ctx.createLinearGradient(0, cy - rim, 0, cy + rim);
    g.addColorStop(0, "#1b0c04");
    g.addColorStop(1, lit > 0 ? `rgb(${120 + 90 * lit | 0},${60 + 50 * lit | 0},20)` : "#4a2a0c");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy + rim * 0.12, s * 0.44, rim * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    // oil sheen
    ctx.fillStyle = `rgba(255,${210 + 40 * lit | 0},150,${0.18 + 0.35 * lit})`;
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.1, cy + rim * 0.05, s * 0.16, rim * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    // lip highlight
    ctx.strokeStyle = `rgba(255,190,130,${0.25 + 0.35 * lit})`;
    ctx.lineWidth = s * 0.012;
    ctx.beginPath();
    ctx.ellipse(cx, cy, s * 0.5, rim, 0, Math.PI * 0.05, Math.PI * 0.95);
    ctx.stroke();

    // cotton wick
    ctx.strokeStyle = "#efe2c4";
    ctx.lineWidth = s * 0.035;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.3, cy + rim * 0.2);
    ctx.quadraticCurveTo(cx + s * 0.44, cy - s * 0.0, wick.x, wick.y);
    ctx.stroke();
    ctx.fillStyle = lit > 0.2 ? "#2a1206" : "#5a3a1e";
    ctx.beginPath();
    ctx.arc(wick.x, wick.y, s * 0.02, 0, Math.PI * 2);
    ctx.fill();

    if (lit > 0) Deepa.drawFlame(ctx, wick.x, wick.y, s * 0.42, t, seed, lit, opts.glow ?? 1);
    return wick;
  };
})();
