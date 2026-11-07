/* Day 3: rangoli floor with 16-way symmetry and grainy powder strokes. */
(function () {
  const { fitCanvas, seeded } = window.Deepa;
  const SLICES = 8;

  function shades(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return [0.72, 0.88, 1, 1, 1.12].map((k) => {
      const f = (v) => Math.max(0, Math.min(255, Math.round(k > 1 ? v + (255 - v) * (k - 1) * 1.6 : v * k)));
      return `rgb(${f(r)},${f(g)},${f(b)})`;
    });
  }

  window.Deepa.initRangoli = function () {
    const root = document.querySelector("[data-rangoli]");
    if (!root) return;
    const canvas = root.querySelector("[data-rangoli-canvas]");
    const ctx = canvas.getContext("2d");
    const guide = root.querySelector("[data-rangoli-guide]");
    const sizeInput = root.querySelector("[data-rangoli-size]");
    const swatches = [...root.querySelectorAll("[data-color]")];
    let W = 0, dpr = 1, floor = null, color = swatches[0].dataset.color, palette = shades(color);
    let drawing = false, last = null, auto = null;
    let ink = null; // offscreen powder layer survives resizes

    function makeFloor() {
      floor = document.createElement("canvas");
      floor.width = floor.height = W;
      const f = floor.getContext("2d");
      // red-oxide floor, hand-polished
      f.fillStyle = "#3b1712";
      f.fillRect(0, 0, W, W);
      const rnd = seeded(11);
      for (let i = 0; i < 60; i++) {
        const x = rnd() * W, y = rnd() * W, r = (0.08 + rnd() * 0.25) * W;
        const g = f.createRadialGradient(x, y, 0, x, y, r);
        const dark = rnd() > 0.5;
        g.addColorStop(0, dark ? "rgba(20,6,4,0.18)" : "rgba(120,50,35,0.12)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        f.fillStyle = g;
        f.fillRect(x - r, y - r, r * 2, r * 2);
      }
      for (let i = 0; i < W * 6; i++) {
        f.fillStyle = rnd() > 0.5 ? "rgba(0,0,0,0.1)" : "rgba(255,200,170,0.04)";
        f.fillRect(rnd() * W, rnd() * W, dpr, dpr);
      }
      // lamp light from upper left, vignette elsewhere
      let g = f.createRadialGradient(W * 0.3, W * 0.25, 0, W * 0.5, W * 0.5, W * 0.75);
      g.addColorStop(0, "rgba(255,170,90,0.12)");
      g.addColorStop(0.6, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.55)");
      f.fillStyle = g;
      f.fillRect(0, 0, W, W);
    }

    function layout() {
      const prev = ink;
      ({ w: W, dpr } = fitCanvas(canvas));
      makeFloor();
      ink = document.createElement("canvas");
      ink.width = ink.height = W;
      if (prev) ink.getContext("2d").drawImage(prev, 0, 0, W, W);
      render();
    }

    function render() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(floor, 0, 0);
      ctx.drawImage(ink, 0, 0);
    }

    // Lay a dab of powder at local point (x, y) relative to centre, mirrored around all slices.
    function dab(x, y, size, pal) {
      const ic = ink.getContext("2d");
      const n = Math.min(90, Math.round(size * size * 0.7 / (dpr * dpr)) + 6);
      const grains = [];
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const rr = size * Math.sqrt(Math.random()) * (Math.random() < 0.12 ? 1.5 : 1);
        grains.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr, (0.8 + Math.random() * 1.4) * dpr, pal[(Math.random() * pal.length) | 0]);
      }
      const c = W / 2;
      for (let k = 0; k < SLICES; k++) {
        const ang = (k / SLICES) * Math.PI * 2;
        const cos = Math.cos(ang), sin = Math.sin(ang);
        for (const m of [1, -1]) {
          ic.setTransform(cos, sin, -sin * m, cos * m, c, c);
          for (let i = 0; i < grains.length; i += 4) {
            ic.fillStyle = grains[i + 3];
            ic.fillRect(grains[i], grains[i + 1], grains[i + 2], grains[i + 2]);
          }
        }
      }
      ic.setTransform(1, 0, 0, 1, 0, 0);
    }

    function strokeTo(p, size, pal) {
      if (!last) { dab(p.x, p.y, size, pal); last = p; return; }
      const d = Math.hypot(p.x - last.x, p.y - last.y);
      const step = Math.max(dpr, size * 0.35);
      const n = Math.ceil(d / step);
      for (let i = 1; i <= n; i++) {
        const u = i / n;
        dab(last.x + (p.x - last.x) * u, last.y + (p.y - last.y) * u, size, pal);
      }
      last = p;
    }

    const brush = () => Number(sizeInput.value) * dpr * (W / dpr / 520);
    const local = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * dpr - W / 2, y: (e.clientY - r.top) * dpr - W / 2 };
    };

    canvas.addEventListener("pointerdown", (e) => {
      cancelAuto();
      drawing = true;
      last = null;
      canvas.setPointerCapture(e.pointerId);
      guide.classList.add("is-hidden");
      strokeTo(local(e), brush(), palette);
      render();
      window.Deepa.sound?.powder(true);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!drawing) return;
      const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of events) strokeTo(local(ev), brush(), palette);
      render();
    });
    const end = () => { drawing = false; last = null; window.Deepa.sound?.powder(false); };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);

    swatches.forEach((b) => b.addEventListener("click", () => {
      swatches.forEach((s) => s.setAttribute("aria-checked", String(s === b)));
      color = b.dataset.color;
      palette = shades(color);
    }));
    // arrow keys within the radio group
    root.querySelector("[data-swatches]").addEventListener("keydown", (e) => {
      const i = swatches.findIndex((s) => s.getAttribute("aria-checked") === "true");
      const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const next = swatches[(i + d + swatches.length) % swatches.length];
      next.click();
      next.focus();
    });

    function clearInk() {
      cancelAuto();
      ink.getContext("2d").clearRect(0, 0, W, W);
      guide.classList.remove("is-hidden");
      render();
    }
    root.querySelector("[data-rangoli-clear]").addEventListener("click", () => {
      clearInk();
      window.Deepa.sound?.sweep();
    });

    root.querySelector("[data-rangoli-save]").addEventListener("click", () => {
      const a = document.createElement("a");
      a.download = "my-rangoli.png";
      a.href = canvas.toDataURL("image/png");
      a.click();
    });

    /* ---------- "Draw one for me": a traditional lotus layout, drawn as strokes ---------- */
    const Q = Math.PI / SLICES; // half slice angle; mirror covers the rest
    function design() {
      const R = W / 2;
      const P = (r, th) => ({ x: r * R * Math.cos(th), y: r * R * Math.sin(th) });
      const curve = (fn, steps = 40) => Array.from({ length: steps + 1 }, (_, i) => fn(i / steps));
      const layers = [];
      const add = (hex, size, pts) => layers.push({ pal: shades(hex), size, pts });
      // centre bindu
      add("#f3eadb", 1.6, curve((u) => P(0.02 + 0.04 * u, Q * u), 10));
      add("#e0402a", 1.2, curve((u) => P(0.075, Q * u), 12));
      // inner lotus petals (centred on angle 0)
      for (const k of [1, 0.75, 0.5, 0.25]) {
        add(k > 0.6 ? "#f4a020" : "#f7c64a", 1.1, curve((u) => P(0.1 + 0.24 * u, Q * 0.92 * k * Math.sin(Math.PI * Math.pow(u, 0.8)))));
      }
      add("#f3eadb", 0.45, curve((u) => P(0.1 + 0.24 * u, Q * 0.98 * Math.sin(Math.PI * Math.pow(u, 0.8)))));
      // second ring of petals between them
      for (const k of [1, 0.66, 0.33]) {
        add("#d6247a", 1.1, curve((u) => P(0.27 + 0.24 * u, Q - Q * 0.95 * k * Math.sin(Math.PI * u))));
      }
      add("#f3eadb", 0.45, curve((u) => P(0.27 + 0.24 * u, Q - Q * 0.99 * Math.sin(Math.PI * u))));
      // dot ring
      add("#f3eadb", 1.5, curve(() => P(0.555, 0), 2));
      add("#f3eadb", 1.0, curve(() => P(0.555, Q * 0.5), 2));
      // scalloped band
      add("#1aa3a3", 1.3, curve((u) => P(0.61 + 0.07 * Math.sin(Math.PI * u), Q * u)));
      add("#1aa3a3", 1.3, curve((u) => P(0.6 + 0.04 * Math.sin(Math.PI * u), Q * u)));
      add("#4b4fc9", 0.9, curve((u) => P(0.69 + 0.03 * Math.sin(Math.PI * u), Q * u)));
      // outer border + leaves
      add("#e0402a", 1.2, curve((u) => P(0.78, Q * u)));
      add("#58a83a", 1.2, curve((u) => P(0.79 + 0.12 * u, Q - Q * 0.45 * Math.sin(Math.PI * u))));
      add("#58a83a", 0.8, curve((u) => P(0.79 + 0.12 * u, Q - Q * 0.2 * Math.sin(Math.PI * u))));
      add("#f4a020", 1.6, curve(() => P(0.93, Q), 2));
      add("#f3eadb", 0.9, curve(() => P(0.85, 0), 2));
      return layers;
    }

    function cancelAuto() {
      if (auto) { cancelAnimationFrame(auto); auto = null; }
    }

    root.querySelector("[data-rangoli-surprise]").addEventListener("click", () => {
      clearInk();
      guide.classList.add("is-hidden");
      const layers = design();
      const base = (W / dpr / 520) * dpr * 7;
      let li = 0, pi = 0;
      window.Deepa.sound?.powder(true);
      const step = () => {
        for (let n = 0; n < 6 && li < layers.length; n++) {
          const L = layers[li];
          if (pi === 0) last = null;
          strokeTo(L.pts[pi], base * L.size, L.pal);
          pi++;
          if (pi >= L.pts.length) { li++; pi = 0; }
        }
        render();
        if (li < layers.length) auto = requestAnimationFrame(step);
        else { auto = null; last = null; window.Deepa.sound?.powder(false); window.Deepa.sound?.bell(0.6); }
      };
      auto = requestAnimationFrame(step);
    });

    layout();
    let rt;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(layout, 150); });
  };
})();
