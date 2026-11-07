/* Boot: smooth scroll, preloader, reveals, scrubbed scenes and the interactive pieces. */
(function () {
  const Deepa = window.Deepa;
  const reduceMotion = Deepa.reduceMotion;
  const hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  /* ---------- greeting from a shared link (#from=Name) ---------- */
  function readGreeting() {
    const m = location.hash.match(/from=([^&]+)/);
    if (!m) return;
    let name = "";
    try { name = decodeURIComponent(m[1]).replace(/\s+/g, " ").trim().slice(0, 40); } catch (_) { return; }
    if (!name) return;
    const el = document.querySelector("[data-hero-from]");
    el.textContent = `${name} wishes you Shubh Deepavali`;
    el.hidden = false;
  }

  function initGreetingForm() {
    const form = document.querySelector("[data-greeting-form]");
    const out = document.querySelector("[data-greeting-result]");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = new FormData(form).get("from").toString().trim().slice(0, 40);
      if (!name) return;
      const url = `${location.origin}${location.pathname}#from=${encodeURIComponent(name)}`;
      const shareData = { title: "Shubh Deepavali", text: `${name} sent you the light of Diwali`, url };
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        try { await navigator.share(shareData); out.textContent = "Shared. Shubh Deepavali!"; return; } catch (_) { /* fall through to copy */ }
      }
      try {
        await navigator.clipboard.writeText(url);
        out.textContent = "Link copied. Paste it to your family.";
      } catch (_) {
        out.textContent = url;
      }
    });
  }

  /* ---------- sound toggle ---------- */
  function initSoundToggle() {
    const btn = document.querySelector("[data-sound-toggle]");
    const label = btn.querySelector(".sound-toggle__label");
    btn.addEventListener("click", async () => {
      const on = await Deepa.sound.toggle();
      btn.setAttribute("aria-pressed", String(on));
      label.textContent = on ? "Sound on" : "Sound off";
    });
  }

  /* ---------- day rail ---------- */
  function initRail() {
    const rail = document.querySelector(".day-rail");
    const links = [...rail.querySelectorAll("[data-rail]")];
    const hero = document.querySelector(".hero");
    new IntersectionObserver(([e]) => rail.classList.toggle("is-visible", !e.isIntersecting), { threshold: 0.2 }).observe(hero);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) links.forEach((l) => l.classList.toggle("is-active", l.dataset.rail === e.target.id));
      });
    }, { rootMargin: "-45% 0px -45% 0px" });
    document.querySelectorAll("[data-day]").forEach((s) => io.observe(s));
  }

  /* ---------- motion ---------- */
  function splitWords(el) {
    const text = el.textContent || "";
    el.setAttribute("aria-label", text.trim());
    el.textContent = "";
    text.split(/(\s+)/).forEach((part) => {
      if (!part.trim()) { el.appendChild(document.createTextNode(part)); return; }
      const mask = document.createElement("span");
      const word = document.createElement("span");
      mask.className = "split-word-mask";
      mask.setAttribute("aria-hidden", "true");
      word.className = "split-word";
      word.textContent = part;
      mask.appendChild(word);
      el.appendChild(mask);
    });
  }

  let lenis = null;
  function initSmoothScroll() {
    if (reduceMotion || !hasGsap || typeof window.Lenis === "undefined") return;
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.9 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
      const target = document.querySelector(a.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { duration: 1.6 });
    }));
  }

  function initReveals() {
    if (reduceMotion || !hasGsap) return;

    gsap.utils.toArray("[data-split-reveal]").forEach((el) => {
      if (el.closest(".hero")) return; // hero plays after the preloader
      gsap.fromTo(el.querySelectorAll(".split-word"),
        { yPercent: 110, autoAlpha: 0, filter: "blur(8px)" },
        { yPercent: 0, autoAlpha: 1, filter: "blur(0px)", duration: 1, ease: "power4.out", stagger: 0.035,
          scrollTrigger: { trigger: el, start: "top 82%", once: true } });
    });

    gsap.utils.toArray("[data-story-section]").forEach((section) => {
      const items = section.querySelectorAll("[data-reveal-item]");
      gsap.fromTo(items, { y: 36, autoAlpha: 0, filter: "blur(8px)" },
        { y: 0, autoAlpha: 1, filter: "blur(0px)", duration: 1, ease: "power4.out", stagger: 0.08,
          scrollTrigger: { trigger: section, start: "top 80%", once: true } });
    });

    gsap.utils.toArray("[data-reveal]").forEach((el) => {
      gsap.fromTo(el, { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.1, ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 85%", once: true } });
    });
  }

  function initScenes() {
    if (reduceMotion || !hasGsap) return;

    // hero copy drifts up and the Devanagari watermark sinks
    gsap.to(".hero__copy", { yPercent: -30, autoAlpha: 0.2, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1 } });
    gsap.to(".hero__deva", { yPercent: 25, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1 } });

    // Dhanteras coins turn and drift as you pass
    gsap.utils.toArray(".coin").forEach((c, i) => {
      gsap.fromTo(c, { rotateY: i * 40, rotateX: 20, y: 80 * (1 + (i % 3)) },
        { rotateY: i * 40 + 360, rotateX: -10, y: -80 * (1 + (i % 2)), ease: "none",
          scrollTrigger: { trigger: ".day--one", start: "top bottom", end: "bottom top", scrub: 1.2 } });
    });

    // Annakut counter
    const counter = document.querySelector("[data-annakut-count]");
    const obj = { v: 0 };
    gsap.to(obj, { v: 56, ease: "none", onUpdate: () => (counter.textContent = Math.round(obj.v)),
      scrollTrigger: { trigger: "[data-annakut]", start: "top 85%", end: "center 45%", scrub: 0.8 } });

    // food marquee rows slide in opposite directions
    gsap.utils.toArray("[data-marquee]").forEach((row) => {
      const dir = Number(row.dataset.marquee);
      gsap.fromTo(row, { xPercent: dir < 0 ? 0 : -30 }, { xPercent: dir < 0 ? -30 : 0, ease: "none",
        scrollTrigger: { trigger: ".marquee", start: "top bottom", end: "bottom top", scrub: 1 } });
    });
  }

  function staticFallback() {
    document.querySelector("[data-annakut-count]").textContent = "56";
  }

  function preloader() {
    const loader = document.querySelector("[data-preloader]");
    const bar = document.querySelector("[data-preloader-bar]");
    const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
    const minWait = new Promise((r) => setTimeout(r, reduceMotion ? 0 : 1100));
    const cap = new Promise((r) => setTimeout(r, 4000)); // never block on a slow font CDN
    if (hasGsap && !reduceMotion) gsap.to(bar, { scaleX: 0.85, duration: 1.1, ease: "power2.out" });
    return Promise.race([Promise.all([fonts, minWait]), cap]).then(() => new Promise((resolve) => {
      let done = false;
      const finish = () => { if (done) return; done = true; loader.remove(); resolve(); };
      if (!hasGsap || reduceMotion) { finish(); return; }
      setTimeout(finish, 1600); // rAF can stall in background tabs
      gsap.timeline({ onComplete: finish })
        .to(bar, { scaleX: 1, duration: 0.3, ease: "power2.out" })
        .to(loader, { autoAlpha: 0, duration: 0.8, ease: "power2.inOut" }, "+=0.1");
    }));
  }

  function heroIn() {
    if (reduceMotion || !hasGsap) return;
    const words = document.querySelectorAll(".hero .split-word");
    gsap.fromTo(words, { yPercent: 110, autoAlpha: 0, filter: "blur(10px)" },
      { yPercent: 0, autoAlpha: 1, filter: "blur(0px)", duration: 1.2, ease: "power4.out", stagger: 0.08 });
    gsap.fromTo("[data-hero-lede], [data-hero-from]", { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.2, ease: "power3.out", delay: 0.5, stagger: 0.1 });
  }

  /* ---------- boot ---------- */
  readGreeting();
  initSoundToggle();
  initGreetingForm();
  initRail();
  const safe = (fn) => { try { fn && fn(); } catch (err) { console.error(err); } };
  safe(Deepa.initHero);
  safe(Deepa.initDiyas);
  safe(Deepa.initRangoli);
  safe(Deepa.initFireworks);
  safe(Deepa.initBazaar);

  // hide hero words before the preloader lifts so they don't flash
  document.querySelectorAll("[data-split-reveal]").forEach(splitWords);
  if (hasGsap && !reduceMotion) gsap.set([".hero .split-word", "[data-hero-lede]", "[data-hero-from]"], { autoAlpha: 0 });
  document.querySelectorAll("[data-split-reveal]").forEach((el) => (el.dataset.split = "done"));

  initSmoothScroll();
  if (reduceMotion || !hasGsap) staticFallback();
  preloader().then(() => {
    heroIn();
    initReveals();
    initScenes();
    Deepa.bazaarScroll && safe(Deepa.bazaarScroll);
    if (hasGsap) ScrollTrigger.refresh();
  });
  window.addEventListener("load", () => hasGsap && ScrollTrigger.refresh());
})();
