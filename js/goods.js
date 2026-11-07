/* Painters for each bazaar stall's back wall, shelves and goods. Each takes (ctx, W, H, t, dpr). */
(function () {
  const { drawDiya, drawFlame, seeded } = window.Deepa;
  const TAU = Math.PI * 2;

  /* ---------- shared scenery ---------- */
  function wall(ctx, W, H, tint = "60,20,30") {
    if (!window.Deepa.indoor) return tarpBack(ctx, W, H, tint);
    let g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgb(${tint})`);
    g.addColorStop(1, "#0c0605");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // cloth folds
    for (let x = 0; x < W; x += W / 9) {
      g = ctx.createLinearGradient(x, 0, x + W / 9, 0);
      g.addColorStop(0, "rgba(0,0,0,0.22)");
      g.addColorStop(0.5, "rgba(255,255,255,0.03)");
      g.addColorStop(1, "rgba(0,0,0,0.22)");
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, W / 9, H);
    }
    // warm light from the bulbs above
    g = ctx.createRadialGradient(W / 2, -H * 0.1, 0, W / 2, -H * 0.1, H * 1.1);
    g.addColorStop(0, "rgba(255,180,90,0.32)");
    g.addColorStop(1, "rgba(255,140,60,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // Open-air stall: a plastic tarpaulin hung behind the goods, creased and sun-faded, lit by one bulb.
  function tarpBack(ctx, W, H, tint) {
    ctx.fillStyle = "#06050a";
    ctx.fillRect(0, 0, W, H);
    const [r, g0, b] = tint.split(",").map(Number);
    const top = H * 0.02, bottom = H * 0.9;
    const tp = new Path2D();
    tp.moveTo(0, top);
    tp.lineTo(W, top);
    tp.lineTo(W, bottom);
    for (let i = 8; i >= 0; i--) tp.lineTo((i / 8) * W, bottom + Math.sin(i * 2.3) * H * 0.02);
    tp.closePath();
    let gr = ctx.createLinearGradient(0, top, 0, bottom);
    gr.addColorStop(0, `rgb(${r},${g0},${b})`);
    gr.addColorStop(1, `rgb(${r * 0.45 | 0},${g0 * 0.45 | 0},${b * 0.45 | 0})`);
    ctx.fillStyle = gr;
    ctx.fill(tp);
    ctx.save();
    ctx.clip(tp);
    // vertical folds where it hangs from the bamboo, creases and faded patches
    for (let i = 0; i < 7; i++) {
      const x = (i + 0.5) * (W / 7);
      gr = ctx.createLinearGradient(x - W / 14, 0, x + W / 14, 0);
      gr.addColorStop(0, "rgba(0,0,0,0.28)"); gr.addColorStop(0.5, "rgba(255,255,255,0.07)"); gr.addColorStop(1, "rgba(0,0,0,0.28)");
      ctx.fillStyle = gr;
      ctx.fillRect(x - W / 14, 0, W / 7, H);
    }
    const rnd = seeded(r * 7 + g0 * 3 + b);
    ctx.lineWidth = Math.max(1, W / 400);
    for (let i = 0; i < 26; i++) {
      const x = rnd() * W, y = rnd() * H, a = rnd() * Math.PI, l = W * (0.05 + rnd() * 0.18);
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath(); ctx.moveTo(x + 2, y + 2); ctx.lineTo(x + 2 + Math.cos(a) * l, y + 2 + Math.sin(a) * l); ctx.stroke();
    }
    ctx.restore();
    // the bulb's pool of light
    gr = ctx.createRadialGradient(W / 2, H * 0.05, 0, W / 2, H * 0.05, H * 1.05);
    gr.addColorStop(0, "rgba(255,200,120,0.35)");
    gr.addColorStop(0.5, "rgba(255,160,70,0.12)");
    gr.addColorStop(1, "rgba(255,140,60,0)");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);
  }

  function shelf(ctx, W, y, dpr) {
    if (!window.Deepa.indoor) {
      // a rough plank on bricks, covered with a strip of jute
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(0, y + 10 * dpr, W, 12 * dpr);
      ctx.fillStyle = "#5a3a1e";
      ctx.fillRect(0, y, W, 10 * dpr);
      for (let x = 0; x < W; x += 3 * dpr) {
        ctx.fillStyle = (x / (3 * dpr)) % 2 ? "rgba(170,135,85,0.85)" : "rgba(140,108,66,0.85)";
        ctx.fillRect(x, y - 2 * dpr, 2 * dpr, 7 * dpr);
      }
      ctx.fillStyle = "rgba(130,100,60,0.9)";
      for (let x = 0; x < W; x += 5 * dpr) ctx.fillRect(x, y + 5 * dpr, 2 * dpr, 5 * dpr + ((x / dpr) % 3) * dpr); // frayed edge
      return;
    }
    const h = 9 * dpr;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, y + h, W, 10 * dpr);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "#b07a45");
    g.addColorStop(0.3, "#7a4b26");
    g.addColorStop(1, "#4a2c15");
    ctx.fillStyle = g;
    ctx.fillRect(0, y, W, h);
  }

  // A shape filled with a lit-from-above-left gradient.
  function lit(ctx, path, base, light, dark, cx, cy, r) {
    const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.45, r * 0.05, cx, cy, r * 1.2);
    g.addColorStop(0, light);
    g.addColorStop(0.45, base);
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.fill(path);
  }

  function ellipsePath(x, y, rx, ry, rot = 0) {
    const p = new Path2D();
    p.ellipse(x, y, rx, ry, rot, 0, TAU);
    return p;
  }

  function tag(ctx, x, y, text, dpr) {
    ctx.save();
    ctx.font = `700 ${12 * dpr}px Kalam, Manrope, sans-serif`;
    const w = ctx.measureText(text).width + 14 * dpr;
    ctx.translate(x, y);
    ctx.rotate(-0.07);
    ctx.fillStyle = "#b8955e"; // a scrap of cardboard
    ctx.beginPath();
    ctx.moveTo(-w / 2, -10 * dpr); ctx.lineTo(w / 2 - 3 * dpr, -11 * dpr); ctx.lineTo(w / 2, 9 * dpr); ctx.lineTo(-w / 2 + 2 * dpr, 10 * dpr);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(90,60,25,0.3)"; ctx.lineWidth = dpr;
    for (let i = -w / 2 + 4 * dpr; i < w / 2; i += 5 * dpr) { ctx.beginPath(); ctx.moveTo(i, -9 * dpr); ctx.lineTo(i, 9 * dpr); ctx.stroke(); }
    ctx.fillStyle = "#14140f";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 0, dpr);
    ctx.restore();
  }


  /* ---------- murtis ---------- */
  function lotusBase(ctx, x, y, w, c1 = "#e86a8a", c2 = "#f6b0c0") {
    for (let i = -3; i <= 3; i++) {
      const p = new Path2D();
      const px = x + i * w * 0.14;
      p.moveTo(px - w * 0.1, y);
      p.quadraticCurveTo(px - w * 0.09, y - w * 0.12, px, y - w * 0.17);
      p.quadraticCurveTo(px + w * 0.09, y - w * 0.12, px + w * 0.1, y);
      p.closePath();
      lit(ctx, p, c1, c2, "#7a2038", px, y - w * 0.08, w * 0.12);
    }
    const band = new Path2D();
    band.rect(x - w * 0.5, y - w * 0.02, w, w * 0.07);
    lit(ctx, band, "#c8902a", "#ffe08a", "#6a4208", x, y, w * 0.5);
  }

  function halo(ctx, x, y, r, dpr) {
    ctx.strokeStyle = "#d9a53a";
    ctx.lineWidth = r * 0.06;
    ctx.beginPath();
    ctx.arc(x, y, r, Math.PI * 1.02, Math.PI * 1.98);
    ctx.stroke();
    ctx.fillStyle = "#f0c860";
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * (1.05 + i * 0.09);
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r * 1.08, y + Math.sin(a) * r * 1.08, r * 0.045, 0, TAU);
      ctx.fill();
    }
  }

  function ganesha(ctx, x, base, h, o = {}) {
    const skin = o.skin || ["#e8833a", "#ffc08a", "#8a3a10"];
    const cloth = o.cloth || ["#c21f3a", "#ff6a7a", "#5a0618"];
    halo(ctx, x, base - h * 0.55, h * 0.5);
    lotusBase(ctx, x, base, h * 0.8);
    // crossed legs
    let p = ellipsePath(x, base - h * 0.13, h * 0.34, h * 0.1);
    lit(ctx, p, cloth[0], cloth[1], cloth[2], x, base - h * 0.13, h * 0.34);
    // belly
    p = ellipsePath(x, base - h * 0.32, h * 0.25, h * 0.22);
    lit(ctx, p, skin[0], skin[1], skin[2], x, base - h * 0.32, h * 0.25);
    // dhoti over lower belly
    p = new Path2D();
    p.ellipse(x, base - h * 0.27, h * 0.26, h * 0.16, 0, 0.1, Math.PI - 0.1);
    lit(ctx, p, cloth[0], cloth[1], cloth[2], x, base - h * 0.2, h * 0.26);
    // arms + modak
    p = ellipsePath(x - h * 0.24, base - h * 0.36, h * 0.06, h * 0.13, 0.5);
    lit(ctx, p, skin[0], skin[1], skin[2], x - h * 0.24, base - h * 0.36, h * 0.1);
    p = ellipsePath(x + h * 0.24, base - h * 0.36, h * 0.06, h * 0.13, -0.5);
    lit(ctx, p, skin[0], skin[1], skin[2], x + h * 0.24, base - h * 0.36, h * 0.1);
    p = ellipsePath(x + h * 0.28, base - h * 0.26, h * 0.045, h * 0.045);
    lit(ctx, p, "#f2d27a", "#fff2c0", "#9a6a18", x + h * 0.28, base - h * 0.26, h * 0.05);
    // ears (behind head)
    for (const s of [-1, 1]) {
      p = ellipsePath(x + s * h * 0.17, base - h * 0.68, h * 0.13, h * 0.15, s * 0.2);
      lit(ctx, p, skin[0], skin[1], skin[2], x + s * h * 0.17, base - h * 0.68, h * 0.14);
      ctx.fillStyle = "rgba(160,40,20,0.35)";
      ctx.fill(ellipsePath(x + s * h * 0.18, base - h * 0.68, h * 0.08, h * 0.1, s * 0.2));
    }
    // head
    p = ellipsePath(x, base - h * 0.7, h * 0.14, h * 0.15);
    lit(ctx, p, skin[0], skin[1], skin[2], x, base - h * 0.7, h * 0.15);
    // trunk curling to his left
    ctx.lineCap = "round";
    const trunk = () => {
      ctx.beginPath();
      ctx.moveTo(x, base - h * 0.64);
      ctx.bezierCurveTo(x - h * 0.02, base - h * 0.48, x - h * 0.1, base - h * 0.44, x - h * 0.08, base - h * 0.5);
    };
    ctx.strokeStyle = skin[2]; ctx.lineWidth = h * 0.08; trunk(); ctx.stroke();
    ctx.strokeStyle = skin[0]; ctx.lineWidth = h * 0.06; trunk(); ctx.stroke();
    // tusk, eyes, tilak
    ctx.fillStyle = "#f6efe0";
    ctx.beginPath(); ctx.ellipse(x + h * 0.06, base - h * 0.6, h * 0.012, h * 0.035, -0.4, 0, TAU); ctx.fill();
    ctx.fillStyle = "#1a0a05";
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + s * h * 0.055, base - h * 0.72, h * 0.016, h * 0.011, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = "#d4101a";
    ctx.fillRect(x - h * 0.008, base - h * 0.8, h * 0.016, h * 0.045);
    // mukut
    p = new Path2D();
    p.moveTo(x - h * 0.12, base - h * 0.8);
    p.lineTo(x - h * 0.08, base - h * 0.95);
    p.quadraticCurveTo(x, base - h * 1.06, x + h * 0.08, base - h * 0.95);
    p.lineTo(x + h * 0.12, base - h * 0.8);
    p.closePath();
    lit(ctx, p, "#d9a53a", "#fff0a8", "#6a4208", x, base - h * 0.9, h * 0.12);
    ctx.fillStyle = "#c0102a";
    ctx.beginPath(); ctx.arc(x, base - h * 0.88, h * 0.022, 0, TAU); ctx.fill();
    // marigold mala
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI * (0.15 + i * 0.0875);
      ctx.fillStyle = i % 2 ? "#ffb020" : "#ff7a10";
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * h * 0.18, base - h * 0.52 + Math.sin(a) * h * 0.12, h * 0.025, 0, TAU);
      ctx.fill();
    }
  }

  function lakshmi(ctx, x, base, h, o = {}) {
    const sari = o.sari || ["#b8122c", "#ff5a6a", "#4a0410"];
    const skin = ["#e9b07a", "#ffe0bc", "#8a5a30"];
    halo(ctx, x, base - h * 0.58, h * 0.48);
    lotusBase(ctx, x, base, h * 0.8);
    // sari: seated, flowing over lotus
    let p = new Path2D();
    p.moveTo(x - h * 0.36, base - h * 0.04);
    p.quadraticCurveTo(x - h * 0.3, base - h * 0.3, x - h * 0.14, base - h * 0.5);
    p.lineTo(x + h * 0.14, base - h * 0.5);
    p.quadraticCurveTo(x + h * 0.3, base - h * 0.3, x + h * 0.36, base - h * 0.04);
    p.closePath();
    lit(ctx, p, sari[0], sari[1], sari[2], x, base - h * 0.25, h * 0.36);
    ctx.strokeStyle = "#f0c050";
    ctx.lineWidth = h * 0.02;
    ctx.beginPath(); ctx.moveTo(x - h * 0.34, base - h * 0.06); ctx.quadraticCurveTo(x, base - h * 0.0, x + h * 0.34, base - h * 0.06); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - h * 0.13, base - h * 0.5); ctx.quadraticCurveTo(x + h * 0.05, base - h * 0.3, x + h * 0.3, base - h * 0.12); ctx.stroke();
    // arms holding lotuses
    for (const s of [-1, 1]) {
      p = ellipsePath(x + s * h * 0.2, base - h * 0.55, h * 0.045, h * 0.13, s * -0.4);
      lit(ctx, p, skin[0], skin[1], skin[2], x + s * h * 0.2, base - h * 0.55, h * 0.1);
      for (let k = -1; k <= 1; k++) {
        ctx.fillStyle = k ? "#f07890" : "#ffb0c4";
        ctx.beginPath(); ctx.ellipse(x + s * h * 0.26 + k * h * 0.025, base - h * 0.7, h * 0.022, h * 0.045, k * 0.5, 0, TAU); ctx.fill();
      }
    }
    // neck + head
    p = ellipsePath(x, base - h * 0.55, h * 0.05, h * 0.06);
    lit(ctx, p, skin[0], skin[1], skin[2], x, base - h * 0.55, h * 0.06);
    p = ellipsePath(x, base - h * 0.66, h * 0.085, h * 0.1);
    lit(ctx, p, skin[0], skin[1], skin[2], x, base - h * 0.66, h * 0.1);
    ctx.fillStyle = "#1a0a05";
    ctx.beginPath(); ctx.ellipse(x, base - h * 0.71, h * 0.088, h * 0.05, 0, Math.PI, TAU); ctx.fill();
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + s * h * 0.03, base - h * 0.665, h * 0.012, h * 0.007, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = "#d4101a";
    ctx.beginPath(); ctx.arc(x, base - h * 0.7, h * 0.008, 0, TAU); ctx.fill();
    // gold necklace
    ctx.strokeStyle = "#f2c860"; ctx.lineWidth = h * 0.014;
    ctx.beginPath(); ctx.arc(x, base - h * 0.54, h * 0.07, 0.2, Math.PI - 0.2); ctx.stroke();
    // crown
    p = new Path2D();
    p.moveTo(x - h * 0.08, base - h * 0.74);
    p.lineTo(x - h * 0.06, base - h * 0.86);
    p.quadraticCurveTo(x, base - h * 0.95, x + h * 0.06, base - h * 0.86);
    p.lineTo(x + h * 0.08, base - h * 0.74);
    p.closePath();
    lit(ctx, p, "#d9a53a", "#fff0a8", "#6a4208", x, base - h * 0.82, h * 0.09);
  }

  function murti(ctx, W, H, t, dpr) {
    wall(ctx, W, H, "34,64,120");
    const s1 = H * 0.42, s2 = H * 0.76;
    shelf(ctx, W, s1, dpr);
    shelf(ctx, W, s2, dpr);
    const small = H * 0.27;
    [0.14, 0.32, 0.5, 0.68, 0.86].forEach((u, i) => {
      if (i % 2) lakshmi(ctx, W * u, s1, small * 0.95, { sari: i === 3 ? ["#1a6a3a", "#5ac07a", "#04301a"] : undefined });
      else ganesha(ctx, W * u, s1, small, { skin: i === 2 ? ["#d9a53a", "#fff0a8", "#6a4208"] : undefined, cloth: i === 4 ? ["#1d4fb0", "#6a9aff", "#081a50"] : undefined });
    });
    const big = H * 0.33;
    ganesha(ctx, W * 0.22, s2, big);
    lakshmi(ctx, W * 0.5, s2, big);
    ganesha(ctx, W * 0.78, s2, big, { skin: ["#d9a53a", "#fff0a8", "#6a4208"], cloth: ["#7a1aa0", "#c070ff", "#2a0640"] });
    // puja on the counter
    drawDiya(ctx, W * 0.1, H * 0.93, H * 0.1, { lit: 1, t, seed: 2, glow: 0.6 });
    tag(ctx, W * 0.36, s2 + 22 * dpr, "₹450", dpr);
    tag(ctx, W * 0.64, s2 + 22 * dpr, "₹650", dpr);
    // incense smoke
    ctx.strokeStyle = "rgba(220,210,200,0.12)";
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    for (let i = 0; i < 40; i++) {
      const y = H * 0.95 - i * H * 0.012;
      const x = W * 0.93 + Math.sin(t * 0.8 + i * 0.25) * i * 0.35 * dpr;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = "#3a1a0a";
    ctx.fillRect(W * 0.93 - dpr, H * 0.95, 2 * dpr, H * 0.05);
    ctx.fillStyle = "#ff6a20";
    ctx.beginPath(); ctx.arc(W * 0.93, H * 0.95, 1.6 * dpr, 0, TAU); ctx.fill();
  }

  /* ---------- diyas ---------- */
  const CLAYS = {
    terra: ["#3a1407", "#a04a22", "#d27a3e"],
    painted: ["#203a6a", "#3a6ac0", "#7aa8f0"],
    pink: ["#6a1438", "#c03a70", "#f080a8"],
    green: ["#0f3a24", "#2a8050", "#6ac08a"],
    gold: ["#5a3a08", "#c8902a", "#ffe08a"],
  };

  function tokri(ctx, cx, cy, r, rnd) {
    // cane basket: a woven bowl with a rim, heaped with diyas
    ctx.save();
    ctx.fillStyle = "#6a4a22";
    ctx.fill(new Path2D(`M${cx - r} ${cy} Q${cx - r * 0.9} ${cy + r * 0.7} ${cx} ${cy + r * 0.75} Q${cx + r * 0.9} ${cy + r * 0.7} ${cx + r} ${cy} Z`));
    ctx.clip(new Path2D(`M${cx - r} ${cy} Q${cx - r * 0.9} ${cy + r * 0.7} ${cx} ${cy + r * 0.75} Q${cx + r * 0.9} ${cy + r * 0.7} ${cx + r} ${cy} Z`));
    for (let y = cy; y < cy + r; y += r * 0.09) for (let x = cx - r; x < cx + r; x += r * 0.16) {
      ctx.fillStyle = ((x + y) / (r * 0.09)) % 2 > 1 ? "#b08a50" : "#8a6838";
      ctx.fillRect(x + ((y - cy) / (r * 0.09)) % 2 * r * 0.08, y, r * 0.14, r * 0.07);
    }
    ctx.restore();
    // heap of diyas
    const n = 14;
    for (let i = 0; i < n; i++) {
      const u = rnd(), a = rnd() * Math.PI;
      const dx = (u - 0.5) * r * 1.5, dy = -Math.sin(a) * r * 0.18 - (1 - Math.abs(u - 0.5) * 2) * r * 0.35;
      drawDiya(ctx, cx + dx, cy + dy, r * 0.42, { lit: 0, paint: "plain", seed: i + cx });
    }
    ctx.strokeStyle = "#c8a060"; ctx.lineWidth = r * 0.06;
    ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.25, 0, 0, Math.PI * 2); ctx.stroke();
  }

  function diyas(ctx, W, H, t, dpr) {
    wall(ctx, W, H, "170,80,26");
    const rnd = seeded(31);
    shelf(ctx, W, H * 0.62, dpr);
    tokri(ctx, W * 0.24, H * 0.47, W * 0.17, rnd);
    tokri(ctx, W * 0.62, H * 0.45, W * 0.19, rnd);
    // stacked towers of fresh diyas on the jute
    for (let s2 = 0; s2 < 3; s2++) for (let i = 0; i < 9; i++) drawDiya(ctx, W * (0.82 + s2 * 0.06), H * 0.6 - i * H * 0.022, H * 0.07, { lit: 0, paint: "plain", seed: 50 + s2 * 9 + i });
    // on the ground: matkas, a gunny sack, and three diyas lit to tempt buyers
    for (let i = 0; i < 3; i++) drawDiya(ctx, W * (0.16 + i * 0.16), H * 0.92, H * 0.11, { lit: 1, t, seed: 40 + i, paint: i === 1 ? "gold" : "dots" });
    ctx.fillStyle = "#7a5f3a";
    ctx.beginPath(); ctx.ellipse(W * 0.82, H * 0.9, W * 0.12, H * 0.08, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(60,40,15,0.6)"; ctx.lineWidth = dpr;
    for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(W * 0.82 + i * W * 0.025, H * 0.83); ctx.lineTo(W * 0.82 + i * W * 0.025, H * 0.97); ctx.stroke(); }
    tag(ctx, W * 0.5, H * 0.72, "₹10 दर्जन", dpr);
  }

  /* ---------- mithai ---------- */
  function tray(ctx, x, y, r) {
    let g = ctx.createLinearGradient(x - r, 0, x + r, 0);
    g.addColorStop(0, "#5a5f66"); g.addColorStop(0.35, "#e8ecef"); g.addColorStop(0.6, "#9aa1a8"); g.addColorStop(1, "#4a4f55");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.3, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(20,20,25,0.35)";
    ctx.beginPath(); ctx.ellipse(x, y - r * 0.02, r * 0.88, r * 0.25, 0, 0, TAU); ctx.fill();
  }
  function ladoos(ctx, x, y, r, rnd) {
    const rows = [5, 4, 3, 2, 1];
    rows.forEach((n, row) => {
      for (let i = 0; i < n; i++) {
        const bx = x + (i - (n - 1) / 2) * r * 1.85, by = y - row * r * 1.45 - r * 0.6;
        const p = ellipsePath(bx, by, r, r);
        lit(ctx, p, "#f39a1e", "#ffd060", "#9a4a06", bx, by, r);
        for (let k = 0; k < 14; k++) { // boondi texture
          ctx.fillStyle = rnd() > 0.5 ? "rgba(255,220,120,0.6)" : "rgba(150,60,0,0.35)";
          ctx.beginPath(); ctx.arc(bx + (rnd() - 0.5) * r * 1.5, by + (rnd() - 0.5) * r * 1.5, r * 0.12, 0, TAU); ctx.fill();
        }
      }
    });
  }
  function katli(ctx, x, y, s, t) {
    for (let row = 0; row < 3; row++) for (let i = 0; i < 4 - row; i++) {
      const cx = x + (i - (3 - row) / 2) * s * 1.05 + row * s * 0.1, cy = y - row * s * 0.32 - s * 0.25;
      const p = new Path2D();
      p.moveTo(cx, cy - s * 0.25); p.lineTo(cx + s * 0.5, cy); p.lineTo(cx, cy + s * 0.25); p.lineTo(cx - s * 0.5, cy); p.closePath();
      lit(ctx, p, "#e8d3ae", "#fff6e2", "#a08a66", cx, cy, s * 0.5);
      // silver varak shimmer
      ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.2 * Math.sin(t * 2 + i + row)})`;
      ctx.beginPath(); ctx.ellipse(cx - s * 0.1, cy - s * 0.04, s * 0.18, s * 0.06, 0.4, 0, TAU); ctx.fill();
    }
  }
  function jalebis(ctx, x, y, s) {
    ctx.lineCap = "round";
    [[0, 0], [-1, 0.1], [1, 0.08], [-0.5, -0.5], [0.5, -0.45], [0, -0.95]].forEach(([dx, dy], k) => {
      const cx = x + dx * s * 0.9, cy = y + dy * s * 0.55 - s * 0.35;
      for (const [w, c] of [[s * 0.16, "#9a3a04"], [s * 0.11, "#ff8a10"], [s * 0.04, "rgba(255,230,140,0.8)"]]) {
        ctx.strokeStyle = c; ctx.lineWidth = w;
        ctx.beginPath();
        for (let a = 0; a < TAU * 2.4; a += 0.2) {
          const r = s * 0.06 + a * s * 0.042;
          const px = cx + Math.cos(a + k) * r, py = cy + Math.sin(a + k) * r * 0.55;
          a ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.stroke();
      }
    });
  }
  function jamuns(ctx, x, y, r) {
    // brass bowl with syrup
    let g = ctx.createLinearGradient(x - r * 2, 0, x + r * 2, 0);
    g.addColorStop(0, "#5a3a08"); g.addColorStop(0.35, "#f0c860"); g.addColorStop(1, "#5a3a08");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, y - r * 0.6, r * 2.1, r * 0.6, 0, 0, Math.PI); ctx.lineTo(x - r * 2.1, y - r * 0.6); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - r * 2.1, y - r * 0.6); ctx.quadraticCurveTo(x, y + r * 0.9, x + r * 2.1, y - r * 0.6); ctx.fill();
    ctx.fillStyle = "#6a2a06";
    ctx.beginPath(); ctx.ellipse(x, y - r * 0.6, r * 1.9, r * 0.45, 0, 0, TAU); ctx.fill();
    [[-1, 0], [0, -0.15], [1, 0], [-0.5, 0.2], [0.5, 0.2]].forEach(([dx, dy]) => {
      const bx = x + dx * r * 1.05, by = y - r * 0.75 + dy * r;
      lit(ctx, ellipsePath(bx, by, r * 0.55, r * 0.5), "#5a1c06", "#c06a2a", "#200602", bx, by, r * 0.55);
      ctx.fillStyle = "rgba(255,220,180,0.55)";
      ctx.beginPath(); ctx.ellipse(bx - r * 0.18, by - r * 0.2, r * 0.12, r * 0.06, -0.5, 0, TAU); ctx.fill();
    });
  }
  function sweetBox(ctx, x, y, w, h, c, dpr) {
    const p = new Path2D(); p.rect(x, y, w, h);
    lit(ctx, p, c[0], c[1], c[2], x + w / 2, y + h / 2, w * 0.7);
    ctx.fillStyle = "#f0c860";
    ctx.fillRect(x + w * 0.46, y, w * 0.08, h);
    ctx.fillRect(x, y + h * 0.42, w, h * 0.12);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(x, y + h - 2 * dpr, w, 2 * dpr);
  }

  function mithai(ctx, W, H, t, dpr) {
    wall(ctx, W, H, "42,96,62");
    const s1 = H * 0.36;
    shelf(ctx, W, s1, dpr);
    const boxes = [["#c8306a", "#ff7aa8", "#5a0a2a"], ["#d9a53a", "#ffe08a", "#6a4208"], ["#2a7a6a", "#6ad0b8", "#08302a"], ["#7a2aa0", "#c080f0", "#2a0640"]];
    let bx = W * 0.05;
    for (let i = 0; bx < W * 0.92; i++) {
      const w = W * (0.13 + (i % 3) * 0.02), h = H * (0.08 + (i % 2) * 0.03);
      sweetBox(ctx, bx, s1 - h, w, h, boxes[i % 4], dpr);
      if (i % 2 === 0) sweetBox(ctx, bx + w * 0.08, s1 - h - H * 0.07, w * 0.84, H * 0.07, boxes[(i + 1) % 4], dpr);
      bx += w + W * 0.02;
    }
    const rnd = seeded(5);
    const ty1 = H * 0.66, ty2 = H * 0.95;
    tray(ctx, W * 0.25, ty1, W * 0.2); ladoos(ctx, W * 0.25, ty1, W * 0.03, rnd);
    tray(ctx, W * 0.72, ty1, W * 0.2); katli(ctx, W * 0.72, ty1, W * 0.085, t);
    tray(ctx, W * 0.24, ty2, W * 0.21); jalebis(ctx, W * 0.24, ty2, W * 0.1);
    jamuns(ctx, W * 0.72, ty2 - H * 0.02, W * 0.06);
    tag(ctx, W * 0.25, ty1 + H * 0.06, "₹640 / kg", dpr);
    tag(ctx, W * 0.72, ty1 + H * 0.06, "₹1120 / kg", dpr);
    // glass case reflection
    const g = ctx.createLinearGradient(0, H * 0.45, W, H);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.45, "rgba(255,255,255,0.06)");
    g.addColorStop(0.5, "rgba(255,255,255,0.0)");
    g.addColorStop(0.62, "rgba(255,255,255,0.04)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, H * 0.45, W, H * 0.55);
    ctx.fillStyle = "rgba(220,240,255,0.25)";
    ctx.fillRect(0, H * 0.45, W, 1.5 * dpr);
  }

  /* ---------- patakhe ---------- */
  function crackerBox(ctx, x, y, w, h, bg, accent, label, dpr) {
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    // starburst
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = accent;
    const cx = x + w * 0.72, cy = y + h * 0.4;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a - 0.12) * w, cy + Math.sin(a - 0.12) * w);
      ctx.lineTo(cx + Math.cos(a + 0.12) * w, cy + Math.sin(a + 0.12) * w);
      ctx.fill();
    }
    ctx.fillStyle = "#fff6d8";
    ctx.beginPath(); ctx.arc(cx, cy, Math.min(w, h) * 0.16, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(x, y + h * 0.68, w, h * 0.32);
    ctx.fillStyle = "#fff";
    ctx.font = `800 ${Math.max(7 * dpr, h * 0.2)}px Manrope, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + w * 0.07, y + h * 0.84, w * 0.86);
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, "rgba(255,255,255,0.18)"); g.addColorStop(0.4, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(0,0,0,0.3)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }
  function anarCone(ctx, x, y, h) {
    const p = new Path2D();
    p.moveTo(x - h * 0.3, y); p.lineTo(x - h * 0.09, y - h); p.lineTo(x + h * 0.09, y - h); p.lineTo(x + h * 0.3, y); p.closePath();
    lit(ctx, p, "#a8542a", "#e08a50", "#4a1a06", x, y - h * 0.5, h * 0.4);
    ctx.fillStyle = "#e8d8a0";
    ctx.fillRect(x - h * 0.09, y - h * 1.04, h * 0.18, h * 0.06);
    ctx.fillStyle = "#d8203a";
    ctx.fillRect(x - h * 0.24, y - h * 0.32, h * 0.48, h * 0.1);
  }
  function chakri(ctx, x, y, r, c) {
    for (let k = 3; k >= 1; k--) {
      ctx.strokeStyle = k % 2 ? c : "#f6e8c0";
      ctx.lineWidth = r * 0.28;
      ctx.beginPath(); ctx.arc(x, y, r * k * 0.3, 0, TAU); ctx.stroke();
    }
    ctx.fillStyle = "#3a1a0a";
    ctx.beginPath(); ctx.arc(x, y, r * 0.1, 0, TAU); ctx.fill();
  }

  function patakhe(ctx, W, H, t, dpr) {
    wall(ctx, W, H, "34,64,120");
    const s1 = H * 0.32, s2 = H * 0.62;
    shelf(ctx, W, s1, dpr); shelf(ctx, W, s2, dpr);
    const looks = [["#d8203a", "#ffb020"], ["#1d4fb0", "#ffd84a"], ["#1a8a4a", "#ff6a20"], ["#ff8a10", "#7a1aa0"], ["#7a1aa0", "#50e0ff"], ["#0a6a8a", "#ff4a8a"]];
    const labels = ["ANAR", "CHAKRI", "PHULJHADI", "SKY SHOT", "PENCIL", "SHOWER", "TWINKLE", "SUTLI"];
    [s1, s2].forEach((sy, r) => {
      let x = W * 0.04, i = r * 3;
      while (x < W * 0.92) {
        const w = W * (0.17 + ((i * 7) % 3) * 0.025), h = H * (0.15 + ((i * 5) % 3) * 0.025);
        const [bg, ac] = looks[i % looks.length];
        crackerBox(ctx, x, sy - h, w, h, bg, ac, labels[i % labels.length], dpr);
        x += w + W * 0.02;
        i++;
      }
    });
    // counter: anars, chakris, sparkler bundle, rocket bottle
    [0.1, 0.2, 0.3].forEach((u, i) => anarCone(ctx, W * u, H * 0.97, H * (0.15 - i * 0.015)));
    chakri(ctx, W * 0.45, H * 0.86, H * 0.065, "#1a8a4a");
    chakri(ctx, W * 0.55, H * 0.9, H * 0.055, "#d8203a");
    ctx.strokeStyle = "#8a8a90"; ctx.lineWidth = 1.5 * dpr;
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(W * 0.68 + i * 2 * dpr, H * 0.97); ctx.lineTo(W * 0.66 + i * 3.4 * dpr, H * 0.74); ctx.stroke(); }
    ctx.fillStyle = "#3a3a40";
    for (let i = 0; i < 9; i++) ctx.fillRect(W * 0.66 + i * 3.4 * dpr - dpr, H * 0.74, 2.4 * dpr, H * 0.08);
    // a lit sparkler on display, held in a stand
    const sx = W * 0.86, sy = H * 0.66;
    ctx.strokeStyle = "#6a6a70"; ctx.lineWidth = 2 * dpr;
    ctx.beginPath(); ctx.moveTo(W * 0.86, H * 0.97); ctx.lineTo(sx, sy); ctx.stroke();
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const rnd = Math.random;
    for (let i = 0; i < 26; i++) {
      const a = rnd() * TAU, l = (0.4 + rnd()) * H * 0.07;
      ctx.strokeStyle = `rgba(255,${200 + rnd() * 55 | 0},${120 + rnd() * 100 | 0},${0.5 + rnd() * 0.5})`;
      ctx.lineWidth = dpr;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l); ctx.stroke();
    }
    drawFlame(ctx, sx, sy + H * 0.01, H * 0.02, t, 1, 1, 2.2);
    ctx.restore();
    // green-cracker sign
    ctx.fillStyle = "#1a5a2a";
    ctx.fillRect(W * 0.62, H * 0.04, W * 0.34, H * 0.07);
    ctx.fillStyle = "#e8ffe8";
    ctx.font = `700 ${H * 0.032}px Manrope, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.fillText("GREEN CRACKERS", W * 0.645, H * 0.077, W * 0.3);
  }

  /* ---------- rangoli colours ---------- */
  function powderBowl(ctx, x, y, r, col, rnd) {
    // steel katori
    let g = ctx.createLinearGradient(x - r, 0, x + r, 0);
    g.addColorStop(0, "#4a4f55"); g.addColorStop(0.3, "#f2f4f6"); g.addColorStop(0.65, "#8a9198"); g.addColorStop(1, "#3a3f45");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x - r, y - r * 0.35); ctx.quadraticCurveTo(x - r * 0.9, y + r * 0.2, x, y + r * 0.22); ctx.quadraticCurveTo(x + r * 0.9, y + r * 0.2, x + r, y - r * 0.35); ctx.closePath(); ctx.fill();
    // heaped cone of powder
    const p = new Path2D();
    p.moveTo(x - r * 0.95, y - r * 0.35);
    p.quadraticCurveTo(x - r * 0.4, y - r * 0.6, x - r * 0.06, y - r * 1.05);
    p.quadraticCurveTo(x, y - r * 1.12, x + r * 0.06, y - r * 1.05);
    p.quadraticCurveTo(x + r * 0.4, y - r * 0.6, x + r * 0.95, y - r * 0.35);
    p.ellipse(x, y - r * 0.35, r * 0.95, r * 0.22, 0, 0, Math.PI);
    lit(ctx, p, col, "rgba(255,255,255,0.85)", "rgba(0,0,0,0.6)", x, y - r * 0.6, r);
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.55;
    ctx.fill(p);
    ctx.globalAlpha = 1;
    ctx.save(); ctx.clip(p);
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = rnd() > 0.5 ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)";
      ctx.fillRect(x + (rnd() - 0.5) * r * 2, y - rnd() * r * 1.1, r * 0.03, r * 0.03);
    }
    ctx.restore();
  }
  function stencil(ctx, x, y, r) {
    ctx.fillStyle = "#c8ccd2";
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(20,10,10,0.9)";
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.2, r * 0.08, a, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(x + Math.cos(a + 0.4) * r * 0.85, y + Math.sin(a + 0.4) * r * 0.85, r * 0.05, 0, TAU); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(x, y, r * 0.15, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#7a7f86"; ctx.lineWidth = r * 0.06;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  }

  function rangoli(ctx, W, H, t, dpr) {
    wall(ctx, W, H, "150,120,30");
    // stencils hanging on the wall
    [0.15, 0.38, 0.62, 0.85].forEach((u, i) => {
      ctx.strokeStyle = "#2a1a10"; ctx.lineWidth = dpr;
      ctx.beginPath(); ctx.moveTo(W * u, 0); ctx.lineTo(W * u, H * 0.08); ctx.stroke();
      stencil(ctx, W * u, H * 0.08 + H * 0.08, H * (0.07 + (i % 2) * 0.015));
    });
    const s1 = H * 0.55;
    shelf(ctx, W, s1, dpr);
    const rnd = seeded(9);
    const cols = ["#f4a020", "#e0402a", "#d6247a", "#1aa3a3", "#58a83a", "#4b4fc9", "#f3eadb", "#ffd21a", "#7a2ad0"];
    for (let i = 0; i < 6; i++) powderBowl(ctx, W * (0.1 + i * 0.16), s1 - H * 0.02, H * 0.08, cols[i], rnd);
    for (let i = 0; i < 5; i++) powderBowl(ctx, W * (0.14 + i * 0.18), H * 0.95, H * 0.1, cols[(i + 4) % cols.length], rnd);
    tag(ctx, W * 0.5, s1 + H * 0.06, "₹20 per katori", dpr);
  }

  /* ---------- kandils + torans ---------- */
  function starKandil(ctx, x, y, r, col, t, seed) {
    const sway = Math.sin(t * 0.9 + seed) * 0.06;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(sway);
    ctx.strokeStyle = "#1a0e08"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -y); ctx.lineTo(0, -r); ctx.stroke();
    // glow
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.6);
    g.addColorStop(0, `rgba(${col},0.45)`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(-r * 2.6, -r * 2.6, r * 5.2, r * 5.2);
    ctx.globalCompositeOperation = "source-over";
    // star body
    const p = new Path2D();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * TAU;
      const rr = i % 2 ? r * 0.48 : r;
      i ? p.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : p.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    p.closePath();
    const bg = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    bg.addColorStop(0, "#fff6d8"); bg.addColorStop(0.4, `rgb(${col})`); bg.addColorStop(1, `rgba(${col},0.75)`);
    ctx.fillStyle = bg;
    ctx.fill(p);
    ctx.strokeStyle = "rgba(255,240,200,0.7)"; ctx.lineWidth = r * 0.04;
    ctx.stroke(p);
    // paper tails
    for (const s of [-1, 1]) {
      ctx.strokeStyle = `rgb(${col})`; ctx.lineWidth = r * 0.07;
      ctx.beginPath(); ctx.moveTo(s * r * 0.25, r * 0.6);
      ctx.quadraticCurveTo(s * r * 0.35 + Math.sin(t * 2 + seed) * r * 0.1, r * 1.4, s * r * 0.15, r * 2.1);
      ctx.stroke();
    }
    ctx.restore();
  }
  function boxKandil(ctx, x, y, r, col, t, seed) {
    const sway = Math.sin(t * 0.8 + seed) * 0.05;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(sway);
    ctx.strokeStyle = "#1a0e08"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -y); ctx.lineTo(0, -r); ctx.stroke();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.4);
    g.addColorStop(0, `rgba(${col},0.4)`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.fillRect(-r * 2.4, -r * 2.4, r * 4.8, r * 4.8);
    ctx.globalCompositeOperation = "source-over";
    const p = new Path2D();
    p.moveTo(0, -r); p.lineTo(r * 0.7, -r * 0.35); p.lineTo(r * 0.7, r * 0.45); p.lineTo(0, r * 0.95); p.lineTo(-r * 0.7, r * 0.45); p.lineTo(-r * 0.7, -r * 0.35); p.closePath();
    const bg = ctx.createLinearGradient(-r * 0.7, 0, r * 0.7, 0);
    bg.addColorStop(0, `rgba(${col},0.8)`); bg.addColorStop(0.45, "#fff2cc"); bg.addColorStop(1, `rgba(${col},0.7)`);
    ctx.fillStyle = bg; ctx.fill(p);
    ctx.strokeStyle = "rgba(60,20,0,0.6)"; ctx.lineWidth = r * 0.04;
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, r * 0.95); ctx.moveTo(-r * 0.7, -r * 0.35); ctx.lineTo(r * 0.7, -r * 0.35); ctx.moveTo(-r * 0.7, r * 0.45); ctx.lineTo(r * 0.7, r * 0.45); ctx.stroke();
    ctx.strokeStyle = "#f0c050"; ctx.lineWidth = r * 0.05;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.12, r * 0.95); ctx.lineTo(i * r * 0.16, r * 1.6); ctx.stroke(); }
    ctx.restore();
  }
  function toran(ctx, W, y, dpr, t) {
    const n = 26;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const x = u * W, yy = y + Math.sin(u * Math.PI) * 12 * dpr;
      for (let k = 0; k < 4; k++) {
        if ((i + k) % 3 === 0 && k > 0) continue;
        const r = 4.2 * dpr;
        lit(ctx, ellipsePath(x, yy + k * r * 1.7, r, r), k % 2 ? "#ffb020" : "#ff7a10", "#ffe08a", "#8a3a04", x, yy + k * r * 1.7, r);
      }
      if (i % 3 === 1) { // mango leaf
        ctx.fillStyle = "#2a6a1a";
        ctx.beginPath(); ctx.ellipse(x, yy + 9 * dpr, 3 * dpr, 9 * dpr, 0, 0, TAU); ctx.fill();
      }
    }
  }

  function kandil(ctx, W, H, t, dpr) {
    wall(ctx, W, H, "170,80,26");
    toran(ctx, W, H * 0.02, dpr, t);
    const set = [
      [0.2, 0.28, "255,120,40", "star"], [0.5, 0.22, "220,40,90", "box"], [0.8, 0.3, "255,190,40", "star"],
      [0.35, 0.58, "60,170,255", "box"], [0.66, 0.6, "140,60,220", "star"], [0.12, 0.66, "255,80,60", "box"], [0.9, 0.68, "40,200,120", "box"],
    ];
    set.forEach(([u, v, c, k], i) => (k === "star" ? starKandil : boxKandil)(ctx, W * u, H * v, H * (k === "star" ? 0.1 : 0.085), c, t, i * 1.3));
    // LED reels on the counter
    for (let i = 0; i < 3; i++) {
      const x = W * (0.25 + i * 0.25), y = H * 0.93;
      ctx.fillStyle = "#2a2a30";
      ctx.beginPath(); ctx.ellipse(x, y, H * 0.06, H * 0.025, 0, 0, TAU); ctx.fill();
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * TAU + t * 0.3;
        ctx.fillStyle = ["#ffcf6a", "#ff6a8a", "#6ac0ff"][(k + i) % 3];
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * H * 0.045, y + Math.sin(a) * H * 0.018, 1.8 * dpr, 0, TAU); ctx.fill();
      }
    }
  }

  window.Deepa.goods = { murti, diyas, mithai, patakhe, rangoli, kandil };
})();

/* Extra stalls for the village haat: chudi (bangles) and khilone (clay toys, balloons). */
(function () {
  const TAU = Math.PI * 2;
  const g = window.Deepa.goods;
  function back(ctx, W, H, tint) {
    const gr = ctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, `rgb(${tint})`); gr.addColorStop(1, "#0c0605");
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    const l = ctx.createRadialGradient(W / 2, -H * 0.1, 0, W / 2, -H * 0.1, H * 1.1);
    l.addColorStop(0, "rgba(255,180,90,0.32)"); l.addColorStop(1, "rgba(255,140,60,0)");
    ctx.fillStyle = l; ctx.fillRect(0, 0, W, H);
  }
  g.chudi = function (ctx, W, H, t, dpr) {
    back(ctx, W, H, "60,20,50");
    const cols = ["#d81b60", "#c0101a", "#2e7d32", "#f2b705", "#1e88e5", "#8e24aa", "#ff7043", "#d9a53a", "#00897b"];
    for (let r = 0; r < 3; r++) {
      const y0 = H * (0.12 + r * 0.3);
      ctx.fillStyle = "#6a4020"; ctx.fillRect(W * 0.04, y0 - 3 * dpr, W * 0.92, 5 * dpr); // rod
      for (let i = 0; i < 22; i++) {
        const x = W * (0.07 + i * 0.041), c = cols[(i + r * 4) % cols.length];
        for (let k = 0; k < 6; k++) {
          ctx.strokeStyle = c; ctx.lineWidth = 2.4 * dpr;
          ctx.beginPath(); ctx.ellipse(x, y0 + 12 * dpr + k * 4 * dpr, W * 0.017, H * 0.05, 0, 0, TAU); ctx.stroke();
          ctx.strokeStyle = "rgba(255,240,200,0.55)"; ctx.lineWidth = 0.8 * dpr;
          ctx.beginPath(); ctx.ellipse(x, y0 + 12 * dpr + k * 4 * dpr, W * 0.017, H * 0.05, 0, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke();
        }
      }
    }
  };
  g.khilone = function (ctx, W, H, t, dpr) {
    back(ctx, W, H, "30,30,60");
    const cols = ["#e53935", "#fdd835", "#43a047", "#1e88e5", "#fb8c00", "#8e24aa", "#f06292"];
    // balloons bunch on a stick
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU, x = W * 0.22 + Math.cos(a) * W * 0.11 * (0.4 + (i % 3) * 0.3), y = H * 0.25 + Math.sin(a) * H * 0.14 * (0.4 + (i % 2) * 0.5);
      ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = dpr;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(W * 0.22, H * 0.62); ctx.stroke();
      const gr = ctx.createRadialGradient(x - 6, y - 8, 2, x, y, W * 0.05);
      gr.addColorStop(0, "#fff"); gr.addColorStop(0.25, cols[i % cols.length]); gr.addColorStop(1, "#200");
      ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(x, y, W * 0.045, H * 0.07, 0, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = "#7a5a30"; ctx.fillRect(W * 0.215, H * 0.6, 4 * dpr, H * 0.4);
    // clay toys: horses, elephants, pots on a plank
    ctx.fillStyle = "#6a4020"; ctx.fillRect(W * 0.42, H * 0.55, W * 0.55, 8 * dpr);
    for (let i = 0; i < 6; i++) {
      const x = W * (0.47 + i * 0.09), y = H * 0.55, c = cols[(i * 2) % cols.length];
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.ellipse(x, y - H * 0.06, W * 0.035, H * 0.035, 0, 0, TAU); ctx.fill(); // body
      ctx.fillRect(x - W * 0.03, y - H * 0.04, 3 * dpr, H * 0.04); ctx.fillRect(x + W * 0.025, y - H * 0.04, 3 * dpr, H * 0.04);
      ctx.beginPath(); ctx.ellipse(x + W * 0.035, y - H * 0.11, W * 0.014, H * 0.03, -0.5, 0, TAU); ctx.fill(); // head
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y - H * 0.065, 2 * dpr, 0, TAU); ctx.fill();
    }
    // paper pinwheels and whistles
    for (let i = 0; i < 5; i++) {
      const x = W * (0.48 + i * 0.11), y = H * 0.82;
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = cols[(i + k) % cols.length];
        ctx.beginPath(); ctx.moveTo(x, y);
        const a = k * Math.PI / 2 + t;
        ctx.lineTo(x + Math.cos(a) * W * 0.035, y + Math.sin(a) * W * 0.035);
        ctx.lineTo(x + Math.cos(a + 0.9) * W * 0.035, y + Math.sin(a + 0.9) * W * 0.035);
        ctx.fill();
      }
    }
  };
})();
