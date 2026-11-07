/* Mela bazaar: a lane of lit stalls, a closer look at each, and a jhola to fill. */
(function () {
  const Deepa = window.Deepa;
  const { fitCanvas, loopWhenVisible } = Deepa;

  const STALLS = [
    {
      id: "murti", deva: "देव मूर्ति भंडार", name: "Murti Bhandar", awning: ["#2a4f90", "#1a3466"], bulbs: ["#ffd27a", "#ff9a5a"],
      desc: "Clay murtis of Lakshmi and Ganesha for the Lakshmi Puja altar. Many families buy a new pair every year and immerse or keep the old one.",
      items: [
        ["Ganesha murti, shadu clay", "Unbaked river clay, painted by hand. Dissolves in water.", 450],
        ["Lakshmi murti, brass finish", "Seated on a lotus, about 15 cm tall.", 650],
        ["Lakshmi–Ganesha pair for puja", "Sized for a home mandir.", 899],
        ["Silver-plated puja coin", "Lakshmi and Ganesha embossed, often bought on Dhanteras.", 350],
      ],
    },
    {
      id: "diyas", deva: "कुम्हार के दीये", name: "Kumhar ke Diye", awning: ["#c8641e", "#8a3e10"], bulbs: ["#ffcf6a", "#ffe6a8"],
      desc: "Diyas thrown on the potter's wheel the same week. Soak plain clay diyas in water for an hour before filling them, so they don't drink the oil.",
      items: [
        ["Plain terracotta diyas, 12", "The everyday lamp for windows and steps.", 120],
        ["Hand-painted diyas, 6", "Dotted and banded in festival colours.", 240],
        ["Brass akhand diya", "With a glass chimney, for a lamp that burns all night.", 780],
        ["Cotton wicks, 100", "Hand-rolled phool batti.", 40],
        ["Til oil, 500 ml", "Sesame oil for the lamps.", 180],
      ],
    },
    {
      id: "mithai", deva: "मिठाई महल", name: "Mithai Mahal", awning: ["#2f7a4a", "#1a4a2c"], bulbs: ["#ffd27a", "#ff8ab0"],
      desc: "The busiest counter in the mela. Boxes go to neighbours, colleagues and anyone who visits during the five days.",
      items: [
        ["Kaju katli, 500 g", "Cashew fudge under a sheet of silver varak.", 560],
        ["Motichoor ladoo, 500 g", "Tiny fried boondi bound in syrup.", 320],
        ["Fresh jalebi, 250 g", "Fried to order and dropped into warm syrup.", 110],
        ["Gulab jamun, 10 pieces", "Soft khoya dumplings in rose-cardamom syrup.", 280],
        ["Dry fruit gift box", "Almonds, cashews, pistachios and raisins.", 850],
      ],
    },
    {
      id: "patakhe", deva: "पटाखा दुकान", name: "Patakha Dukaan", awning: ["#2a4f90", "#1a3466"], bulbs: ["#ffe08a", "#7ac8ff"],
      desc: "Many Indian cities now allow only certified green crackers, which make less smoke. Light them outdoors, at arm's length, with a bucket of water nearby.",
      items: [
        ["Green anar, 10", "Clay fountains that spray a golden cone.", 350],
        ["Phuljhadi sparklers, 10 boxes", "The first cracker most children hold.", 250],
        ["Chakri ground spinners, 10", "Spin and whistle on the ground.", 220],
        ["Sky shots, 12", "Small aerial bursts for the finale.", 600],
      ],
    },
    {
      id: "rangoli", deva: "रंगोली के रंग", name: "Rangoli Rang", awning: ["#c8a020", "#7a6010"], bulbs: ["#ffd27a", "#d0a0ff"],
      desc: "Powder colours sold by the katori, with stencils and sieves for anyone who wants a perfect circle. Traditional rangoli uses rice flour, which feeds the ants and birds.",
      items: [
        ["Rangoli colour set, 10 shades", "Bright, fine-ground powder.", 199],
        ["White rangoli powder, 1 kg", "For outlines and dots.", 60],
        ["Flower stencil set", "Punched steel discs, three sizes.", 149],
        ["Rice flour, 1 kg", "For a traditional, eco-friendly kolam.", 70],
      ],
    },
    {
      id: "kandil", deva: "आकाश कंदील", name: "Kandil aur Toran", awning: ["#c8641e", "#8a3e10"], bulbs: ["#ffcf6a", "#ff7a5a"],
      desc: "Akash kandils hang outside windows so the light can be seen from the street. Toran garlands of marigold and mango leaves go over the door.",
      items: [
        ["Paper star kandil", "Five-pointed, with paper tails.", 349],
        ["Bamboo akash kandil", "Hexagonal frame, cloth panels.", 499],
        ["Marigold toran", "Fresh genda phool and mango leaves.", 120],
        ["Warm LED string, 10 m", "For the balcony railing.", 299],
      ],
    },
  ];

  const jhola = new Map();
  const rupees = (n) => "₹" + n.toLocaleString("en-IN");

  function stallMarkup(s) {
    const bulbs = `<i style="--bulb:${s.bulbs[0]}"></i>`;
    return `
      <button class="stall" type="button" data-stall="${s.id}" style="--awning-a:${s.awning[0]};--awning-b:${s.awning[1]}" aria-label="${s.name}: look closer">
        <span class="stall__sign"><b lang="hi">${s.deva}</b><span>${s.name}</span></span>
        <span class="stall__top"><span class="stall__awning"></span><span class="stall__bulbs">${bulbs}</span></span>
        <span class="stall__body"><canvas class="stall__canvas"></canvas><span class="stall__counter"></span></span>
        <span class="stall__cta">Look closer</span>
      </button>`;
  }

  function paintLoop(canvas, painter) {
    let size = null;
    const frame = (t) => {
      size = fitCanvas(canvas);
      const ctx = canvas.getContext("2d");
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      painter(ctx, size.w, size.h, t, size.dpr);
    };
    return loopWhenVisible(canvas, frame);
  }

  /* ---------- jhola ---------- */
  const els = {};
  function bump() {
    els.btn.classList.remove("is-bump");
    void els.btn.offsetWidth;
    els.btn.classList.add("is-bump");
  }
  function renderJhola() {
    let count = 0, total = 0;
    jhola.forEach((v) => { count += v.qty; total += v.qty * v.price; });
    els.count.textContent = count;
    els.total.textContent = rupees(total);
    els.btn.hidden = count === 0;
    els.list.innerHTML = "";
    if (!count) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "Nothing in the jhola yet.";
      els.list.appendChild(li);
      return;
    }
    jhola.forEach((v, key) => {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.innerHTML = `<span></span> <span class="qty"></span>`;
      name.firstChild.textContent = v.name;
      name.lastChild.textContent = `× ${v.qty}`;
      const price = document.createElement("span");
      price.className = "price";
      price.textContent = rupees(v.qty * v.price);
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "btn btn--quiet add-btn";
      rm.textContent = "Remove one";
      rm.addEventListener("click", () => {
        v.qty -= 1;
        if (v.qty <= 0) jhola.delete(key);
        renderJhola();
      });
      li.append(name, price, rm);
      els.list.appendChild(li);
    });
  }

  /* ---------- dialog ---------- */
  let dialogStop = 0;
  function openStall(s) {
    const d = els.dialog;
    d.querySelector("[data-dialog-deva]").textContent = s.deva;
    d.querySelector("[data-dialog-title]").textContent = s.name;
    d.querySelector("[data-dialog-desc]").textContent = s.desc;
    const ul = d.querySelector("[data-dialog-items]");
    ul.innerHTML = "";
    s.items.forEach(([name, note, price], i) => {
      const key = `${s.id}-${i}`;
      const li = document.createElement("li");
      const text = document.createElement("div");
      const h = document.createElement("h4");
      h.textContent = name;
      const p = document.createElement("p");
      p.textContent = note;
      text.append(h, p);
      const pr = document.createElement("span");
      pr.className = "price";
      pr.textContent = rupees(price);
      const add = document.createElement("button");
      add.type = "button";
      add.className = "btn btn--ghost add-btn";
      add.textContent = "Add";
      add.addEventListener("click", () => {
        const cur = jhola.get(key) || { name, price, qty: 0 };
        cur.qty += 1;
        jhola.set(key, cur);
        renderJhola();
        bump();
        Deepa.sound?.coin();
        add.classList.add("is-added");
        add.textContent = `In jhola · ${cur.qty}`;
      });
      const have = jhola.get(key);
      if (have) { add.classList.add("is-added"); add.textContent = `In jhola · ${have.qty}`; }
      li.append(text, pr, add);
      ul.appendChild(li);
    });
    d.showModal();
    const art = d.querySelector("[data-dialog-art]");
    const painter = Deepa.goods[s.id];
    cancelAnimationFrame(dialogStop);
    const tick = (now) => {
      const { w, h, dpr } = fitCanvas(art);
      const ctx = art.getContext("2d");
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      painter(ctx, w, h, now / 1000, dpr);
      if (d.open) dialogStop = requestAnimationFrame(tick);
    };
    dialogStop = requestAnimationFrame(tick);
  }

  Deepa.initBazaar = function () {
    const root = document.querySelector("[data-bazaar]");
    if (!root || !Deepa.goods) return;
    const track = root.querySelector("[data-bazaar-track]");
    track.innerHTML = STALLS.map(stallMarkup).join("");

    els.btn = document.querySelector("[data-jhola-open]");
    els.count = document.querySelector("[data-jhola-count]");
    els.dialog = document.querySelector("[data-stall-dialog]");
    els.jDialog = document.querySelector("[data-jhola-dialog]");
    els.list = document.querySelector("[data-jhola-list]");
    els.total = document.querySelector("[data-jhola-total]");

    STALLS.forEach((s) => {
      const btn = track.querySelector(`[data-stall="${s.id}"]`);
      paintLoop(btn.querySelector("canvas"), Deepa.goods[s.id]);
      btn.addEventListener("click", () => openStall(s));
    });

    els.btn.addEventListener("click", () => { renderJhola(); els.jDialog.showModal(); });
    document.querySelectorAll("dialog").forEach((d) => {
      d.querySelector("[data-dialog-close]").addEventListener("click", () => d.close());
      d.addEventListener("click", (e) => { if (e.target === d) d.close(); }); // backdrop click
    });

    // crowd murmur while the lane is on screen
    new IntersectionObserver(([e]) => Deepa.sound?.murmur(e.isIntersecting), { threshold: 0.25 }).observe(root.querySelector("[data-bazaar-viewport]"));
  };

  // Pinned horizontal walk on wide screens; native swipe on phones.
  Deepa.bazaarScroll = function () {
    if (Deepa.reduceMotion || typeof gsap === "undefined") return;
    const viewport = document.querySelector("[data-bazaar-viewport]");
    const track = document.querySelector("[data-bazaar-track]");
    const mm = gsap.matchMedia();
    mm.add("(min-width: 761px)", () => {
      const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
      const tween = gsap.to(track, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: viewport,
          start: "top top",
          end: () => "+=" + distance(),
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
          anticipatePin: 1,
        },
      });
      // each stall lifts slightly as it reaches the middle of the lane
      gsap.utils.toArray(".stall", track).forEach((stall) => {
        gsap.fromTo(stall, { y: 30, rotate: 0.6 }, {
          y: 0, rotate: 0, ease: "none",
          scrollTrigger: { trigger: stall, containerAnimation: tween, start: "left right", end: "center center", scrub: true },
        });
      });
    });
  };
})();
