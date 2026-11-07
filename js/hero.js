/* Hero: out-of-focus string lights, a large diya and rising embers. */
(function () {
  const { fitCanvas, loopWhenVisible, drawDiya, rand, reduceMotion } = window.Deepa;

  window.Deepa.initHero = function () {
    const canvas = document.querySelector("[data-hero-canvas]");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, dpr = 1, bulbs = [], embers = [];
    const tones = ["255,190,90", "255,150,60", "255,120,90", "255,220,150", "240,110,140"];

    function layout() {
      ({ w: W, h: H, dpr } = fitCanvas(canvas));
      bulbs = [];
      // three swags of fairy lights at different depths (size = blur)
      const swags = [
        { y: 0.08, sag: 0.1, n: 22, r: [10, 22], a: 0.35 },
        { y: 0.16, sag: 0.08, n: 16, r: [22, 44], a: 0.18 },
        { y: 0.02, sag: 0.14, n: 26, r: [4, 9], a: 0.7 },
      ];
      swags.forEach((s, si) => {
        for (let i = 0; i < s.n; i++) {
          const u = i / (s.n - 1);
          const x = (u * 1.1 - 0.05) * W;
          const y = (s.y + s.sag * Math.sin(u * Math.PI)) * H + Math.sin(u * Math.PI * 4) * 6 * dpr;
          bulbs.push({
            x, y,
            r: rand(s.r[0], s.r[1]) * dpr,
            a: s.a * rand(0.6, 1),
            c: tones[(i + si) % tones.length],
            ph: rand(0, 6.28), sp: rand(0.6, 1.6),
          });
        }
      });
    }

    function spawnEmber(x, y) {
      embers.push({ x: x + rand(-6, 6) * dpr, y, vx: rand(-8, 8) * dpr, vy: rand(-40, -22) * dpr, life: 0, max: rand(2.5, 5), r: rand(0.6, 1.6) * dpr });
    }

    const frame = (t, dt) => {
      ctx.clearRect(0, 0, W, H);

      ctx.globalCompositeOperation = "lighter";
      for (const b of bulbs) {
        const tw = reduceMotion ? 1 : 0.75 + 0.25 * Math.sin(t * b.sp + b.ph);
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        g.addColorStop(0, `rgba(${b.c},${b.a * tw})`);
        g.addColorStop(0.55, `rgba(${b.c},${b.a * tw * 0.45})`);
        g.addColorStop(1, `rgba(${b.c},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
      }
      ctx.globalCompositeOperation = "source-over";

      const s = Math.min(W * 0.26, 250 * dpr);
      const cx = W * 0.5 - s * 0.08, cy = H * 0.8;
      const side = s * 0.42;
      drawDiya(ctx, cx - s * 1.25, cy + s * 0.12, side, { lit: 1, t, seed: 3, glow: 0.8 });
      drawDiya(ctx, cx + s * 1.15, cy + s * 0.14, side * 0.9, { lit: 1, t, seed: 7, glow: 0.8 });
      const wick = drawDiya(ctx, cx, cy, s, { lit: 1, t, seed: 1, paint: "dots" });

      if (!reduceMotion && dt > 0) {
        if (Math.random() < dt * 5) spawnEmber(wick.x, wick.y - s * 0.3);
        ctx.globalCompositeOperation = "lighter";
        for (let i = embers.length - 1; i >= 0; i--) {
          const e = embers[i];
          e.life += dt;
          e.vx += Math.sin(t * 2 + i) * 6 * dpr * dt;
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          const k = 1 - e.life / e.max;
          if (k <= 0) { embers.splice(i, 1); continue; }
          ctx.fillStyle = `rgba(255,${170 + 60 * k | 0},90,${k * 0.9})`;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r * (0.5 + k), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";
      }
    };

    layout();
    window.addEventListener("resize", layout);
    loopWhenVisible(canvas, frame)();
  };
})();
