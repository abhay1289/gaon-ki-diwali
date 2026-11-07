/* Day 2: a ledge of clay diyas the visitor lights one by one. */
(function () {
  const { fitCanvas, loopWhenVisible, drawDiya, seeded } = window.Deepa;

  window.Deepa.initDiyas = function () {
    const root = document.querySelector("[data-diyas]");
    if (!root) return;
    const canvas = root.querySelector("[data-diya-canvas]");
    const ctx = canvas.getContext("2d");
    const countEl = root.querySelector("[data-diya-count]");
    const hintEl = root.querySelector("[data-diya-hint]");
    const allBtn = root.querySelector("[data-diya-all]");
    const section = root.closest(".day");
    const N = 9;
    const lamps = Array.from({ length: N }, (_, i) => ({ lit: 0, target: 0, seed: i * 1.37 + 0.4, x: 0, y: 0, s: 0 }));
    const paints = ["dots", "gold", "dots", "plain", "gold", "dots", "plain", "gold", "dots"];
    let W = 0, H = 0, dpr = 1, petals = [];

    function layout() {
      ({ w: W, h: H, dpr } = fitCanvas(canvas));
      const twoRows = W / dpr < 640;
      if (twoRows) {
        const s = Math.min(W / 5.2, 110 * dpr);
        lamps.forEach((l, i) => {
          const row = i < 5 ? 0 : 1, col = row ? i - 5 : i, cols = row ? 4 : 5;
          l.s = s * (row ? 1 : 0.9);
          l.x = W / 2 + (col - (cols - 1) / 2) * (W / 5.1) - l.s * 0.06;
          l.y = H * (row ? 0.78 : 0.46);
        });
      } else {
        const s = Math.min(W / (N * 1.5), 120 * dpr);
        lamps.forEach((l, i) => {
          const u = i / (N - 1) - 0.5;
          l.s = s * (1 - Math.abs(u) * 0.25);
          l.x = W / 2 + u * W * 0.86 - l.s * 0.06;
          l.y = H * 0.66 - Math.cos(u * Math.PI) * H * 0.06;
        });
      }
      const rnd = seeded(42);
      petals = Array.from({ length: 70 }, () => ({
        x: rnd() * W, y: H * (0.74 + rnd() * 0.22), r: (3 + rnd() * 5) * dpr, rot: rnd() * 6.28,
        c: rnd() > 0.35 ? [244, 150 + rnd() * 40 | 0, 30] : [220, 60, 40],
      }));
    }

    function drawLedge() {
      // stone ledge with soft top edge
      const top = H * 0.62;
      let g = ctx.createLinearGradient(0, top, 0, H);
      g.addColorStop(0, "#2a211d");
      g.addColorStop(0.08, "#1c1613");
      g.addColorStop(1, "#0b0807");
      ctx.fillStyle = g;
      ctx.fillRect(0, top, W, H - top);
      g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, "rgba(7,6,13,1)");
      g.addColorStop(0.12, "rgba(7,6,13,0)");
      g.addColorStop(0.88, "rgba(7,6,13,0)");
      g.addColorStop(1, "rgba(7,6,13,1)");
      ctx.fillStyle = g;
      ctx.fillRect(0, top - 2, W, H - top + 2);
      // marigold petals
      for (const p of petals) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = `rgb(${p.c[0]},${p.c[1]},${p.c[2]})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(-p.r * 0.1, -p.r * 0.5, p.r * 0.12, p.r);
        ctx.restore();
      }
    }

    function updateCount() {
      const n = lamps.filter((l) => l.target).length;
      countEl.textContent = n;
      section.style.setProperty("--warmth", (n / N).toFixed(2));
      document.documentElement.style.setProperty("--warmth", (n / N).toFixed(2));
      if (n === N) {
        hintEl.textContent = "Every lamp is burning";
        allBtn.hidden = true;
        window.Deepa.sound?.bell(0.9);
      } else if (n > 0) {
        hintEl.textContent = `${N - n} still waiting for a flame`;
      }
    }

    function light(l, delay = 0) {
      if (l.target) return;
      l.target = 1;
      setTimeout(() => window.Deepa.sound?.strike(), delay);
      l.delay = delay / 1000;
      updateCount();
    }

    canvas.addEventListener("click", (e) => {
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) * dpr, y = (e.clientY - r.top) * dpr;
      let best = null, bd = Infinity;
      for (const l of lamps) {
        const d = Math.hypot(x - l.x, y - (l.y + l.s * 0.05));
        if (d < l.s * 0.9 && d < bd) { bd = d; best = l; }
      }
      if (best) light(best);
    });

    allBtn.addEventListener("click", () => {
      lamps.filter((l) => !l.target).forEach((l, i) => light(l, i * 260));
    });

    const frame = (t, dt) => {
      ctx.clearRect(0, 0, W, H);
      drawLedge();
      for (const l of lamps) {
        if (l.target && l.lit < 1) {
          if (l.delay > 0) l.delay -= dt; else l.lit = Math.min(1, l.lit + (dt || 1) * 1.6);
        }
      }
      // back row first so overlap reads right
      [...lamps].sort((a, b) => a.y - b.y).forEach((l, i) => {
        drawDiya(ctx, l.x, l.y, l.s, { lit: l.lit, t, seed: l.seed, paint: paints[lamps.indexOf(l)] });
      });
    };

    layout();
    window.addEventListener("resize", layout);
    loopWhenVisible(canvas, frame)();
  };
})();
