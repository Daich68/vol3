/* VOL-3 / WEB-ALMANAC — portfolio reel.
 *
 * One paused GSAP timeline plus a handful of "drivers" (pure functions of
 * time) produce every frame, so the piece can be scrubbed in a browser or
 * rendered frame-by-frame by scripts/render.mjs. Sound cues are declared next
 * to the motion they belong to and exported for the audio mix.
 */
/* global gsap, SplitText, DrawSVGPlugin, CustomEase */
(() => {
  "use strict";

  const FPS = 30;
  const DURATION = 34;
  const PARAMS = new URLSearchParams(location.search);
  const RENDER = PARAMS.has("render");
  if (RENDER) document.body.classList.add("render");

  gsap.registerPlugin(SplitText, DrawSVGPlugin, CustomEase);

  // ---------------------------------------------------------------------------
  // Determinism: every random number used while rendering comes from a PRNG
  // that is reseeded per output frame (motion-blur subframes share a seed).
  const mulberry32 = (a) => () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let frameRand = mulberry32(1);
  Math.random = () => frameRand();
  const reseed = (frame) => { frameRand = mulberry32((frame + 1) * 2654435761); };
  const rng = (seed) => mulberry32(seed);

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  // End-card credit line, e.g. index.html?credit=design%20%26%20motion%20—%20Your%20Name
  if (PARAMS.get("credit")) $("#credit").textContent = PARAMS.get("credit");
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const expoOut = (k) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k));

  const tl = gsap.timeline({ paused: true, defaults: { ease: "expo.out", duration: 1 } });
  const drivers = [];
  const cues = [];
  const cue = (t, sfx, gain = 1, extra = {}) => cues.push({ t: +t.toFixed(4), sfx, gain, ...extra });

  // Musical grid: vol3.wav runs at 120 BPM; the reel's first downbeat is 2.0s.
  const BEAT = 0.5;
  const beat = (n) => 2 + n * BEAT;
  const S = { boot: 0, hero: 2, rules: 6, nav: 10, screens: 14, layers: 20, lang: 24, outro: 28 };

  // Times at which an eased tween from `a` to `b` crosses each of `values`.
  function crossings(ease, start, dur, a, b, values) {
    const fn = gsap.parseEase(ease);
    return values.map((v) => {
      let lo = 0, hi = 1;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (a + (b - a) * fn(mid) < v) lo = mid; else hi = mid;
      }
      return start + dur * hi;
    });
  }

  // Deterministic text scramble. GSAP's ScrambleText keeps state between
  // renders, so two seeks to the same time can differ — fatal for motion-blur
  // subframes. This one is a pure function of (time, frame).
  const scrambles = new Map();
  const hash3 = (a, b, c) => {
    let h = Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  function scramble(targets, at, dur, { text, chars = "01_/#", revealDelay = 0.3, stagger = 0 } = {}) {
    const els = typeof targets === "string" ? $$(targets) : [].concat(targets);
    els.forEach((el, k) => {
      if (!scrambles.has(el)) scrambles.set(el, { original: el.textContent, id: scrambles.size + 1, entries: [] });
      const rec = scrambles.get(el);
      rec.entries.push({ at: at + k * stagger, dur, text: text ?? rec.original, chars, revealDelay });
      rec.entries.sort((a, b) => a.at - b.at);
    });
  }
  function scrambleAt(rec, t, frame) {
    let idx = -1;
    rec.entries.forEach((e, i) => { if (e.at <= t) idx = i; });
    if (idx < 0) return rec.original;
    const e = rec.entries[idx];
    const p = (t - e.at) / e.dur;
    if (p >= 1) return e.text;
    const prev = idx > 0 ? rec.entries[idx - 1].text : rec.original;
    const rev = Math.floor(e.text.length * clamp((p - e.revealDelay) / (1 - e.revealDelay)));
    const len = Math.max(rev, Math.round(lerp(prev.length, e.text.length, clamp(p * 2))));
    const tick = Math.floor(frame / 2);
    let out = e.text.slice(0, rev);
    for (let i = rev; i < len; i++) {
      const ch = e.text[i] ?? prev[i] ?? "_";
      out += ch === " " ? " " : e.chars[Math.floor(hash3(rec.id, i, tick) * e.chars.length)];
    }
    return out;
  }

  function scene(sel, from, to) {
    const el = $(sel);
    tl.set(el, { display: "block" }, from);
    if (to != null) tl.set(el, { display: "none" }, to);
    return el;
  }

  const loading = [];
  const whenDecoded = (img) => (img.complete && img.naturalWidth ? img.decode().catch(() => {}) : new Promise((r) => { img.onload = () => img.decode().then(r, r); img.onerror = r; }));

  // ---------------------------------------------------------------------------
  // Global layers: liquid background, HUD, cursor, camera punches. (Film grain
  // is added by the renderer in ffmpeg, after motion blur.)

  const liquid = $("#liquid");
  const blobs = $$("#liquid .blob");
  const blobPaths = [
    { x: 250, y: 380, ax: 260, ay: 220, fx: 0.23, fy: 0.17, p: 0.0 },
    { x: 780, y: 1300, ax: 240, ay: 300, fx: 0.19, fy: 0.21, p: 1.7 },
    { x: 600, y: 700, ax: 330, ay: 420, fx: 0.31, fy: 0.13, p: 3.1 },
    { x: 350, y: 1600, ax: 280, ay: 200, fx: 0.17, fy: 0.29, p: 4.4 },
  ];
  drivers.push((t) => {
    if (liquid.style.display === "none" || !liquid.style.display) return;
    blobs.forEach((b, i) => {
      const p = blobPaths[i];
      const x = p.x + Math.sin(t * p.fx * 6.283 + p.p) * p.ax - b.offsetWidth / 2 + 200;
      const y = p.y + Math.cos(t * p.fy * 6.283 + p.p * 1.3) * p.ay - b.offsetHeight / 2 + 200;
      const s = 1 + 0.12 * Math.sin(t * 0.7 + p.p);
      b.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(3)})`;
    });
  });

  const hudTc = $("#hud-tc");
  const hudBar = $(".hud-progress i");
  const hudScene = $("#hud-scene");
  const hudTitle = $("#hud-title");
  const SCENES = [
    [S.boot, "PRELOADER"], [S.hero, "HERO / PAGE FRAME"], [S.rules, "RULES"], [S.nav, "TREE NAVIGATION"],
    [S.screens, "SCREENS"], [S.layers, "ARCHITECTURE"], [S.lang, "PERSONAL LANGUAGE"], [S.outro, "THE PATH"],
  ];
  SCENES.forEach(([t, name], i) => {
    if (i === 0) return;
    scramble(hudTitle, t, 0.6, { text: name, chars: "01_/<>#" });
  });
  drivers.push((t, frame) => {
    const f = Math.min(frame, Math.round(DURATION * FPS) - 1);
    hudTc.textContent = `${String(Math.floor(f / FPS)).padStart(2, "0")}:${String(f % FPS).padStart(2, "0")}`;
    hudBar.style.transform = `scaleX(${(t / DURATION).toFixed(4)})`;
    let idx = 0;
    SCENES.forEach(([st], i) => { if (t >= st) idx = i; });
    hudScene.textContent = `${String(idx + 1).padStart(2, "0")}/${String(SCENES.length).padStart(2, "0")}`;
  });
  // HUD ink follows the scene: dark on paper, light on the black scenes.
  const hud = $("#hud");
  [[5.95, "235, 235, 235"], [10.22, "20, 20, 20"], [27.62, "235, 235, 235"], [29.0, "20, 20, 20"]].forEach(([t, c]) => {
    tl.set(hud, { "--hud": c }, t);
  });
  tl.from($$(".hud-corner"), { scale: 0, opacity: 0, duration: 0.6, stagger: 0.05, ease: "back.out(3)" }, 0.15);
  tl.from(".hud-top .hud-line", { scaleX: 0, duration: 1.2 }, 0.3);
  tl.from([".hud-top span:not(.hud-line)", ".hud-bottom", ".hud-side"], { opacity: 0, duration: 0.5, stagger: 0.08, ease: "power2.out" }, 0.35);

  // Camera: small punches on key downbeats keep the whole frame breathing.
  const camera = $("#camera");
  const punches = [];
  const punch = (t, amp = 0.02) => punches.push([t, amp]);
  drivers.push((t) => {
    let s = 1;
    for (const [pt, a] of punches) {
      const d = t - pt;
      if (d >= 0 && d < 0.8) s += a * Math.exp(-d / 0.11) * Math.cos(d * 18);
    }
    camera.style.transform = s === 1 ? "" : `scale(${s.toFixed(4)})`;
  });

  // Cursor (the app's spiral cursor), positioned from tweened `cursorState`.
  const cursor = $("#cursor");
  const cursorState = { x: 1300, y: 2100 };
  drivers.push(() => {
    cursor.style.transform = `translate(${cursorState.x.toFixed(1)}px, ${cursorState.y.toFixed(1)}px)`;
  });

  // Pixel-assembled logo: the SVG is sampled on a grid and every filled cell
  // flies in from a random direction (preloader + outro).
  const LOGO_SRC = "../public/logo%20[Vectorized].svg";
  function particleLogo(canvas, box, { start, until, len = 0.6, spread = 900, cell = 6, seed = 1234, color = "#000" }) {
    const ctx = canvas.getContext("2d");
    const parts = [];
    loading.push((async () => {
      const img = new Image();
      img.src = LOGO_SRC;
      await img.decode();
      const off = document.createElement("canvas");
      off.width = box.w;
      off.height = box.h;
      const o = off.getContext("2d");
      o.drawImage(img, 0, 0, box.w, box.h);
      const data = o.getImageData(0, 0, box.w, box.h).data;
      const r = rng(seed);
      for (let y = 0; y < box.h; y += cell) {
        for (let x = 0; x < box.w; x += cell) {
          let on = 0, n = 0;
          for (let yy = y; yy < Math.min(y + cell, box.h); yy += 2) {
            for (let xx = x; xx < Math.min(x + cell, box.w); xx += 2) {
              on += data[(yy * box.w + xx) * 4 + 3] > 110 ? 1 : 0;
              n++;
            }
          }
          if (on / n < 0.4) continue;
          const ang = r() * Math.PI * 2;
          const dist = 180 + Math.pow(r(), 0.6) * spread;
          parts.push({
            x: box.x + x, y: box.y + y,
            sx: box.x + x + Math.cos(ang) * dist, sy: box.y + y + Math.sin(ang) * dist,
            d: (x / box.w) * 0.32 + r() * 0.28,
            big: r() < 0.08,
          });
        }
      }
    })());
    let dirty = false;
    drivers.push((t) => {
      const tau = t - start;
      if (tau <= 0 || t > until) {
        if (dirty) { ctx.clearRect(0, 0, canvas.width, canvas.height); dirty = false; }
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = color;
      for (const p of parts) {
        const k = clamp((tau - p.d) / len);
        if (k <= 0) continue;
        const e = expoOut(k);
        const sz = cell * (p.big ? lerp(3.2, 1, e) : lerp(0.3, 1, e));
        ctx.globalAlpha = Math.min(1, k * 5);
        ctx.fillRect(lerp(p.sx, p.x, e) + (cell - sz) / 2, lerp(p.sy, p.y, e) + (cell - sz) / 2, sz, sz);
      }
      ctx.globalAlpha = 1;
      dirty = true;
    });
  }

  // ===========================================================================
  // S01 · PRELOADER (0 → 2s) — circle diagram fill, counter, pixel-assembled
  // logo, then the app's own exit: logo x20 + blur while the panel wipes up.
  // ===========================================================================
  {
    const s01 = scene("#s01", 0, 2.6);
    const panel = $(".boot-panel", s01);
    const counter = $(".boot-counter", s01);
    const logo = $(".boot-logo", s01);
    const logoImg = $("img", logo);
    const canvas = $(".boot-particles", s01);
    const ringFill = $(".ring-fill", s01);
    const ring = $(".boot-ring", s01);

    tl.from(".boot-hatch", { opacity: 0.35, duration: 0.8, ease: "none" }, 0);
    tl.fromTo(".boot-hatch", { backgroundPosition: "0px 0px" }, { backgroundPosition: "90px 90px", duration: 2.6, ease: "none" }, 0);
    tl.fromTo(ring, { rotation: -110, scale: 0.9 }, { rotation: -70, scale: 1, duration: 2.2, ease: "power2.out" }, 0);
    tl.from(".ring-base", { opacity: 0, duration: 0.8, ease: "power1.out" }, 0.05);
    tl.fromTo(ringFill, { "--fill": "0deg" }, { "--fill": "360deg", duration: 1.6, ease: "power2.inOut" }, 0.15);

    // Counter 000 → 100 with a tick on every ten.
    const count = { v: 0 };
    tl.to(count, { v: 100, duration: 1.72, ease: "power2.inOut" }, 0.08);
    crossings("power2.inOut", 0.08, 1.72, 0, 100, [10, 20, 30, 40, 50, 60, 70, 80, 90]).forEach((t, i) => cue(t, "tick", 0.35 + i * 0.04));
    drivers.push((t) => {
      if (t > 2.6) return;
      counter.textContent = String(Math.round(count.v)).padStart(3, "0");
    });
    tl.from(counter, { yPercent: 40, opacity: 0, duration: 0.6 }, 0.05);
    tl.from(".boot-meta span", { opacity: 0, duration: 0.01, stagger: 0.12 }, 0.25);
    scramble(".boot-meta span", 0.25, 0.5, { chars: "01#_", stagger: 0.12 });
    tl.from(".boot-scroll", { opacity: 0, y: 30, duration: 0.8 }, 0.4);

    // Pixel-assembled logo.
    particleLogo(canvas, { x: 240, y: 717, w: 600, h: 327 }, { start: 0.04, until: 1.45 });
    tl.fromTo(logoImg, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "power1.inOut" }, 1.05);
    tl.to(canvas, { opacity: 0, duration: 0.2, ease: "none" }, 1.18);
    cue(0.04, "swarm", 0.8);

    // The app's "subtle glitch": two quick hits before the drop.
    [1.24, 1.5].forEach((t) => {
      tl.to(logo, { keyframes: { x: [0, -14, 10, -4, 0], opacity: [1, 0.6, 1, 0.8, 1] }, duration: 0.14, ease: "none" }, t);
      cue(t, "glitch", 0.5);
    });

    // Anticipation, then the exit (Preloader.tsx: scale 20, blur 20, swipe up).
    tl.to(logo, { scale: 0.93, duration: 0.2, ease: "power2.out" }, 1.52);
    tl.to([counter, ".boot-meta", ".boot-scroll", ring], { opacity: 0, y: -40, duration: 0.3, stagger: 0.03, ease: "power2.in" }, 1.6);
    tl.to(logo, { scale: 20, filter: "blur(18px)", opacity: 0, duration: 0.36, ease: "expo.in" }, 1.72);
    tl.fromTo(panel, { clipPath: "inset(0% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 100% 0%)", duration: 0.62, ease: "expo.inOut" }, 1.82);
    cue(0.3, "riser", 0.9, { dur: 1.7 });
    cue(1.72, "whoosh", 0.9);
    cue(2.0, "impact", 1.0);
    punch(2.0, 0.035);
  }

  // ===========================================================================
  // S02 · HERO (2 → 6s) — the PageFrame draws itself, WEB-ALMANAC rises out of
  // masks, the ghost logo fills bottom-up, the scroll branch lights up.
  // ===========================================================================
  {
    const s02 = scene("#s02", 1.8, 6.1);
    tl.set(liquid, { display: "block" }, 1.8);
    tl.set(liquid, { display: "none" }, 6.1);

    const frame = $(".frame", s02);
    const edges = $$(".edge", frame);
    tl.from(edges, { scale: 0, duration: 0.9, stagger: 0.07 }, 1.98);
    tl.from($(".gap", frame), { opacity: 0, duration: 0.6, ease: "power2.out" }, 2.05);
    tl.fromTo($(".inner", frame), { clipPath: "inset(50% 0% 50% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.75, ease: "expo.inOut" }, 2.05);
    tl.from($(".sidebar", frame), { xPercent: 100, duration: 0.9 }, 2.35);

    // Scroll branch fill + progress node (ScrollProgress.tsx).
    const side = $(".sidebar", s02);
    const treeFill = $(".tree.fill", side);
    const node = $(".node", side);
    const nodeArc = $(".node-arc", side);
    const nodeNum = $(".node-num", side);
    const prog = { p: 0 };
    tl.to(prog, { p: 22, duration: 1.4, ease: "power2.inOut" }, 2.6);
    tl.to(prog, { p: 46, duration: 1.2, ease: "power3.inOut" }, 4.0);
    drivers.push((t) => {
      if (t < 1.8 || t > 6.1) return;
      treeFill.style.setProperty("--p", prog.p.toFixed(2));
      node.style.top = `${(20 + prog.p * 0.9).toFixed(2)}%`;
      nodeArc.style.strokeDashoffset = (1 - prog.p / 100).toFixed(4);
      nodeNum.textContent = String(Math.round(prog.p)).padStart(2, "0");
    });
    tl.from(node, { scale: 0, duration: 0.7, ease: "back.out(2.2)" }, 2.7);

    // Title: chars rise through masks with a slight 3D hinge.
    const split = SplitText.create(".hero-title .ln", { type: "chars", mask: "chars" });
    gsap.set(".hero-title .ln", { perspective: 900 });
    tl.from(split.chars, { yPercent: 118, rotationX: -75, transformOrigin: "50% 100%", duration: 1.15, stagger: 0.04 }, 2.22);
    cue(2.22, "whoosh-soft", 0.5);
    const subWords = SplitText.create(".hero-sub", { type: "words", mask: "words" });
    tl.from(subWords.words, { yPercent: 110, duration: 0.9, stagger: 0.05 }, 3.0);
    tl.from(".hero-cta .pill", { y: 40, opacity: 0, duration: 0.8, stagger: 0.08 }, 3.25);

    // Ghost logo fills from the bottom (About.tsx logo-fill-layer).
    tl.from(".hero-ghost .g-base", { opacity: 0, duration: 1, ease: "power1.out" }, 2.4);
    tl.fromTo(".hero-ghost .g-fill", { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 2.6, ease: "power1.inOut" }, 2.9);

    // Details bar + corner marks.
    tl.from(".hero-details .mark", { scale: 0, opacity: 0, duration: 0.5, stagger: 0.05, ease: "back.out(3)" }, 2.55);
    tl.from(".hero-details .bar i", { scaleX: 0, duration: 1 }, 2.6);
    scramble(".hero-details .bar span", 2.6, 0.6, { chars: "01#_/", stagger: 0.1 });

    // A slow push-in keeps the held hero shot alive.
    tl.fromTo(frame, { scale: 1 }, { scale: 1.035, duration: 3.3, ease: "sine.inOut", immediateRender: false }, 2.4);

    // Organic branches creep in from the corners (InteractiveObject.tsx).
    tl.from(".branch-obj.tl", { x: -520, y: -260, rotation: -14, duration: 1.4 }, 2.3);
    tl.from(".branch-obj.bl", { x: -560, y: 260, rotation: 12, duration: 1.4 }, 2.42);
    tl.to(".branch-obj.tl", { rotation: 3, y: 16, duration: 3, ease: "sine.inOut" }, 3.7);
    tl.to(".branch-obj.bl", { rotation: -2, y: -12, duration: 3, ease: "sine.inOut" }, 3.8);

    // Beat hits: the title lines slip sideways and snap back (bars 1–2).
    const lines = $$(".hero-title .ln");
    [[beat(3), 34], [beat(5), -28], [beat(6), 22]].forEach(([t, dx], i) => {
      tl.to(lines[i % 2], { keyframes: { x: [dx, -dx * 0.4, 0], skewX: [-8, 4, 0] }, duration: 0.16, ease: "none" }, t);
      tl.to(lines[(i + 1) % 2], { keyframes: { x: [-dx * 0.6, dx * 0.2, 0] }, duration: 0.16, ease: "none" }, t);
      cue(t, "glitch", 0.35);
    });
    // One beat in the backslant cut of Entropia.
    tl.set(".hero-title", { fontFamily: "EntropiaBack" }, beat(4));
    tl.set(".hero-title", { fontFamily: "Entropia" }, beat(4) + 0.25);

    // Exit: dive into the stem of the "L" until the frame is solid black.
    const exit = { k: 0 };
    let focus = null;
    let stemPx = 40;
    loading.push(document.fonts.ready.then(() => {
      focus = split.chars.find((c) => c.textContent === "L");
      // Find the L's vertical stem on a scratch canvas so the dive lands in ink.
      const size = parseFloat(getComputedStyle(focus).fontSize);
      const c = document.createElement("canvas");
      c.width = c.height = Math.ceil(size * 1.3);
      const x = c.getContext("2d");
      x.font = `900 ${size}px Entropia`;
      x.fillText("L", 0, size);
      const row = x.getImageData(0, Math.round(size * 0.62), c.width, 1).data;
      let x0 = -1, x1 = -1;
      for (let i = 0; i < c.width; i++) {
        if (row[i * 4 + 3] > 128) { if (x0 < 0) x0 = i; x1 = i; } else if (x0 >= 0) break;
      }
      if (x0 >= 0) stemPx = (x0 + x1) / 2;
    }));
    tl.to(exit, { k: 1, duration: 0.5, ease: "expo.in" }, 5.52);
    tl.to(".fx-black", { opacity: 1, duration: 0.12, ease: "power1.in" }, 5.9);
    tl.set(".fx-black", { opacity: 0 }, 6.02);
    drivers.push((t) => {
      if (t < 5.4 || t > 6.1 || !focus) { if (t < 5.4) s02.style.transform = ""; return; }
      if (!s02._origin) {
        s02.style.transform = "";
        const r = focus.getBoundingClientRect();
        const st = $("#stage").getBoundingClientRect();
        const k = st.width / 1080;
        s02._origin = [(r.left - st.left) / k + stemPx, (r.top - st.top) / k + (r.height / k) * 0.55];
      }
      const [ox, oy] = s02._origin;
      const sc = 1 + exit.k * 95;
      s02.style.transformOrigin = `${ox}px ${oy}px`;
      s02.style.transform = exit.k > 0 ? `scale(${sc.toFixed(3)})` : "";
    });
    cue(5.5, "whoosh", 1.0);
    punch(beat(4), 0.012);
  }

  // ===========================================================================
  // S03 · RULES (6 → 10s) — the About page's three numbers, played like a
  // step sequencer, then crushed into a single line of light.
  // ===========================================================================
  {
    const s03 = scene("#s03", 5.98, 10.5);
    const rules = $$(".rule", s03);

    // ∞ as a lemniscate that starts drawing from its crossing point.
    const inf = $(".inf path", s03);
    const pts = [];
    for (let i = 0; i <= 240; i++) {
      const a = Math.PI / 2 + (i / 240) * Math.PI * 2;
      const d = 1 + Math.sin(a) ** 2;
      pts.push(`${((200 * Math.cos(a)) / d).toFixed(2)},${(((200 * Math.sin(a) * Math.cos(a)) / d) * 1.3).toFixed(2)}`);
    }
    inf.setAttribute("d", `M${pts.join("L")}`);

    rules.forEach((r, i) => {
      const t = 6 + i * BEAT;
      tl.from(r, { y: 380, rotationX: -72, scale: 0.84, opacity: 0, duration: 0.95, ease: "back.out(1.2)" }, t);
      scramble($(".lbl", r), t + 0.12, 0.7, { chars: "АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЭЮЯ" });
      cue(t, "thump", 0.9);
    });
    tl.fromTo(".odo-col", { yPercent: 0 }, { yPercent: (-100 * 11) / 12, duration: 1.05, ease: "power3.inOut" }, 6.02);
    tl.fromTo(inf, { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", duration: 1.1, ease: "power2.inOut" }, 6.52);
    scramble(".rule.r3 .scr", 7.02, 0.8, { text: "00", chars: "0123456789", revealDelay: 0.5 });

    // Beat sequencer: each card fires on its own downbeat, then all three.
    rules.forEach((r, i) => {
      const t = beat(12 + i);
      tl.fromTo($(".flash", r), { opacity: 1 }, { opacity: 0, duration: 0.45, ease: "power2.in", immediateRender: false }, t);
      tl.fromTo(r, { scale: 1.045 }, { scale: 1, duration: 0.45, ease: "power3.out", immediateRender: false }, t);
      cue(t, "blip", 0.8, { pitch: i });
    });
    tl.fromTo($$(".flash", s03), { opacity: 1 }, { opacity: 0, duration: 0.3, ease: "power2.in", immediateRender: false }, beat(15));
    cue(beat(15), "blip", 0.9, { pitch: 3 });
    tl.to(".rules", { y: -30, duration: 3.4, ease: "sine.inOut" }, 6.1);

    // Exit: cards → lines → one vertical beam.
    tl.to(rules, { scaleY: 0.012, duration: 0.24, stagger: 0.05, ease: "expo.in" }, 9.5);
    tl.to(rules, { scaleX: 0, duration: 0.2, stagger: 0.03, ease: "expo.in" }, 9.76);
    tl.fromTo(".rules-line", { scaleY: 0 }, { scaleY: 1, duration: 0.3, ease: "expo.inOut", immediateRender: false }, 9.72);
    cue(9.45, "suck", 0.8);
  }

  // ===========================================================================
  // S04 · TREE NAVIGATION (10 → 14s) — the trunk grows, branches pop out on
  // 8th notes, the cursor hovers "записи" (video, difference blend) and clicks.
  // ===========================================================================
  {
    const s04 = scene("#s04", 9.98, 16.3);
    tl.fromTo(s04, { clipPath: "inset(0% 50% 0% 50%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.5, ease: "expo.inOut" }, 9.98);
    cue(10.0, "impact-soft", 0.8);
    punch(10.0, 0.02);
    tl.from(".nav-trunk", { scaleY: 0, duration: 1.1, ease: "expo.inOut" }, 10.08);
    tl.from(".nav-divider i", { scaleX: 0, duration: 1.1 }, 10.2);
    tl.from(".nav-divider span", { letterSpacing: "1.8em", opacity: 0, duration: 1.1, ease: "power3.out" }, 10.2);

    const branches = $$(".nav-branch", s04);
    branches.forEach((b, i) => {
      const t = 10.25 + i * 0.25;
      const lvl1 = b.classList.contains("lvl1");
      tl.from($(".conn", b), { scaleX: 0, duration: 0.35, ease: "power3.out" }, t);
      tl.from($(".nav-card", b), { x: lvl1 ? 80 : -80, opacity: 0, duration: 0.75 }, t + 0.06);
      tl.from($(".lbl", b), { yPercent: 60, opacity: 0, duration: 0.6 }, t + 0.12);
      cue(t + 0.06, "pop", 0.55, { pitch: i });
    });

    // Cursor glides in on a curve.
    tl.set(cursor, { display: "block" }, 11.2);
    tl.fromTo(cursorState, { x: 1180 }, { x: 292, duration: 0.8, ease: "power2.inOut" }, 11.2);
    tl.fromTo(cursorState, { y: 1980 }, { y: 488, duration: 0.8, ease: "power3.out" }, 11.2);
    tl.from(cursor, { opacity: 0, duration: 0.2, ease: "none" }, 11.2);

    const notes = branches[0];
    const card = $(".nav-card", notes);
    const HOVER = 12.0;
    tl.to(card, { borderColor: "rgba(0,0,0,0.38)", boxShadow: "0 16px 40px rgba(0,0,0,0.12)", duration: 0.4, ease: "power2.out" }, HOVER - 0.05);
    tl.to($(".conn", notes), { scaleY: 2.2, backgroundColor: "rgba(0,0,0,0.4)", duration: 0.3, ease: "power2.out" }, HOVER - 0.05);
    tl.to($(".vid", card), { opacity: 0.85, duration: 0.5, ease: "power2.out" }, HOVER);
    tl.to($(".vid-frame", card), { borderColor: "rgba(255,255,255,0.6)", scale: 1, duration: 0.5 }, HOVER);
    tl.to($(".desc", card), { height: 58, duration: 0.4, ease: "power2.out" }, HOVER);
    tl.to($(".lbl", card), { color: "#000", duration: 0.3 }, HOVER);
    tl.to(".c-hover", { opacity: 1, duration: 0.3 }, HOVER);
    tl.to(".c-dot", { rotation: 360, scale: 1.5, duration: 0.6, ease: "power2.out" }, HOVER);
    tl.to(".c-ring", { scale: 1.2, duration: 0.3 }, HOVER);
    cue(HOVER, "hover", 0.6);
    tl.from(".nav-caption span", { opacity: 0, duration: 0.01, stagger: 0.15 }, HOVER + 0.1);
    scramble(".nav-caption span", HOVER + 0.1, 0.6, { stagger: 0.15 });
    tl.from(".nav-caption i", { scaleX: 0, duration: 0.8 }, HOVER + 0.15);

    // Video frames (12 fps, ping-pong so it never jumps).
    const vids = [$(".vid", card), $(".nav-expand .vid", s04)];
    drivers.push((t) => {
      if (t < 11.9 || t > 16.3) return;
      const n = Math.floor((t - 11.9) * 12);
      const f = n % 94 < 48 ? n % 94 : 94 - (n % 94);
      const pos = `${((f % 8) / 7 * 100).toFixed(3)}% ${((Math.floor(f / 8)) / 5 * 100).toFixed(3)}%`;
      vids.forEach((v) => { v.style.backgroundPosition = pos; });
    });

    // Click → the card grows into the whole screen, the video frame rotates
    // into portrait and becomes an organic frame for the next scene.
    const CLICK = 13.0;
    tl.to(".c-dot", { scale: 1.1, duration: 0.08, ease: "power2.in" }, CLICK - 0.08);
    tl.to(".c-dot", { scale: 1.5, duration: 0.3, ease: "back.out(3)" }, CLICK);
    tl.fromTo(".c-ripple", { scale: 0.3, opacity: 1 }, { scale: 1.7, opacity: 0, duration: 0.6, immediateRender: false }, CLICK);
    tl.to(card, { scale: 0.96, duration: 0.08, ease: "power2.in" }, CLICK - 0.08);
    tl.to(card, { scale: 1, duration: 0.3, ease: "back.out(3)" }, CLICK);
    tl.to(cursor, { opacity: 0, duration: 0.25, ease: "none" }, 13.35);
    tl.set(cursor, { display: "none" }, 13.6);
    cue(CLICK, "click", 1.0);

    const expand = $(".nav-expand", s04);
    const evid = $(".vid", expand);
    const ex = { k: 0 };
    tl.set(expand, { display: "block" }, 13.12);
    tl.to(ex, { k: 1, duration: 0.75, ease: "expo.inOut" }, 13.12);
    cue(13.12, "whoosh", 0.8);
    let rect = null;
    drivers.push((t) => {
      if (t < 13.1 || t > 16.3) return;
      if (!rect) rect = { x: 80, y: notes.offsetTop, w: card.offsetWidth, h: card.offsetHeight };
      const k = ex.k;
      const inset = [lerp(rect.y, 0, k), lerp(1080 - rect.x - rect.w, 0, k), lerp(1920 - rect.y - rect.h, 0, k), lerp(rect.x, 0, k)];
      expand.style.clipPath = k >= 1 ? "none" : `inset(${inset.map((v) => `${v.toFixed(1)}px`).join(" ")})`;
      const cx = lerp(rect.x + rect.w / 2, 540, k);
      const cy = lerp(rect.y + rect.h / 2, 960, k);
      const s0 = Math.max(rect.w / 2020, rect.h / 1117) * 1.04;
      evid.style.transform = `translate(${(cx - 540).toFixed(1)}px, ${(cy - 960).toFixed(1)}px) rotate(${(90 * k).toFixed(2)}deg) scale(${lerp(s0, 1, k).toFixed(4)})`;
    });
    tl.to(".nav-expand", { scale: 1.08, duration: 2.2, ease: "power1.inOut" }, 13.9);
  }

  // ===========================================================================
  // S05 · SCREENS (14 → 20s) — the real app, captured from this repo: phone
  // inside the organic frame, then the desktop, then a wall of every screen
  // that the camera dives into.
  // ===========================================================================
  {
    const s05 = scene("#s05", 13.85, 20.05);
    const dev = $(".dev-stage", s05);
    const phone = $(".phone", s05);
    const ps = $$(".p-screen .shot", s05);
    const browser = $(".browser", s05);
    const bs = $$(".b-screen .shot", s05);
    gsap.set(ps.slice(1), { yPercent: 100 });
    gsap.set(bs.slice(1), { clipPath: "inset(100% 0% 0% 0%)" });

    // Shot A — phone in the organic frame.
    tl.from(phone, { y: 1400, rotation: -12, duration: 1.0 }, 13.72);
    tl.to(phone, { keyframes: { rotationY: [0, -9, 7, 0] }, duration: 2.0, ease: "sine.inOut" }, 14.2);
    cue(13.8, "whoosh-soft", 0.6);
    tl.to(ps[0], { yPercent: -100, duration: 0.5, ease: "expo.inOut" }, 14.45);
    tl.fromTo(ps[1], { yPercent: 100 }, { yPercent: 0, duration: 0.5, ease: "expo.inOut", immediateRender: false }, 14.45);
    cue(14.45, "swipe", 0.5);
    tl.fromTo(".tap", { scale: 0.2, opacity: 1 }, { scale: 1.3, opacity: 0, duration: 0.5, ease: "power2.out", immediateRender: false }, 14.98);
    cue(15.0, "tap", 0.7);
    tl.set(ps[2], { yPercent: 0, xPercent: 100 }, 15.02);
    tl.to(ps[2], { xPercent: 0, duration: 0.55, ease: "expo.inOut" }, 15.02);
    tl.fromTo(ps[1], { xPercent: 0, filter: "brightness(1)" }, { xPercent: -30, filter: "brightness(0.75)", duration: 0.55, ease: "expo.inOut", immediateRender: false }, 15.02);
    tl.to("#co1", { opacity: 1, duration: 0.01 }, 14.1);
    tl.from("#co1 b, #co1 span", { opacity: 0, duration: 0.01, stagger: 0.1 }, 14.1);
    scramble("#co1 b, #co1 span", 14.1, 0.6, { chars: "/_:#01", stagger: 0.1 });
    tl.to("#co2", { opacity: 1, duration: 0.01 }, 15.1);
    scramble("#co2 b, #co2 span", 15.1, 0.6, { chars: "/_:#01", stagger: 0.1 });
    tl.to(["#co1", "#co2"], { opacity: 0, duration: 0.25, ease: "power1.in" }, 15.7);

    // Shot B — the organic frame dissolves into the liquid background, the
    // phone steps aside and the desktop drops in.
    tl.set(liquid, { display: "block" }, 15.7);
    tl.to("#s04", { opacity: 0, duration: 0.45, ease: "power2.inOut" }, 15.75);
    tl.to(phone, { x: 262, y: 470, scale: 0.56, rotation: 6, duration: 0.7, ease: "expo.inOut" }, 15.7);
    tl.set(browser, { display: "block" }, 15.8);
    tl.from(browser, { y: -1150, rotationX: 28, duration: 0.85 }, 15.8);
    tl.to(browser, { rotationY: -9, rotationX: 5, duration: 2.2, ease: "sine.inOut" }, 16.1);
    cue(15.8, "whoosh", 0.8);
    punch(16.0, 0.015);

    const paths = ["/search", "/search", "/author/tihiy.sad", "/author/tihiy.sad?post=p02"];
    [16.5, 17.0, 17.5].forEach((t, i) => {
      tl.fromTo(bs[i + 1], { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.38, ease: "expo.inOut", immediateRender: false }, t - 0.1);
      scramble(".b-path", t - 0.1, 0.4, { text: paths[i + 1], chars: "/_:?=#01" });
      cue(t - 0.1, "swipe", 0.45);
    });
    // Phone follows along: search results → author → dictionary.
    [[16.0, 3], [17.0, 4], [17.5, 5]].forEach(([t, idx]) => {
      tl.set(ps[idx], { yPercent: 0, xPercent: 100 }, t - 0.12);
      tl.to(ps[idx], { xPercent: 0, duration: 0.4, ease: "expo.inOut" }, t - 0.12);
    });
    const chips = $$(".route-chips span", s05);
    tl.from(chips, { y: 60, opacity: 0, duration: 0.6, stagger: 0.06 }, 16.0);
    const on = [16.0, 17.0, 17.5, 17.62];
    const off = [17.0, 17.5, null, null];
    chips.forEach((c, i) => {
      tl.to(c, { backgroundColor: "#111", color: "#fff", duration: 0.12, ease: "none" }, on[i]);
      if (off[i]) tl.to(c, { backgroundColor: "rgba(255,255,255,0.65)", color: "#111", duration: 0.2, ease: "none" }, off[i]);
    });

    // Shot C — whip up into a wall of screens, pull back, dive into the hero.
    tl.to(dev, { y: -2200, duration: 0.38, ease: "expo.in" }, 17.82);
    cue(17.85, "whoosh", 1.0);
    const wall = $(".wall", s05);
    const plane = $(".wall-plane", s05);
    tl.set(wall, { display: "block" }, 17.95);
    gsap.set(plane, { rotationX: 55, rotation: -32, scale: 1.3 });
    tl.from(plane, { y: 2300, duration: 0.8 }, 17.98);
    tl.to(plane, { scale: 0.86, duration: 1.4, ease: "power2.out" }, 17.98);
    tl.fromTo(".wall-col.c1", { y: -250 }, { y: 520, duration: 2.05, ease: "none" }, 17.98);
    tl.fromTo(".wall-col.c2", { y: 1400 }, { y: 0, duration: 2.05, ease: "power2.out" }, 17.98);
    tl.fromTo(".wall-col.c3", { y: 300 }, { y: -560, duration: 2.05, ease: "none" }, 17.98);
    tl.to(plane, { rotationX: 0, rotation: 0, scale: 1.2, duration: 0.75, ease: "expo.inOut" }, 19.27);
    const others = $$(".wall-col img", s05).filter((im) => !im.src.endsWith("d-home-hero.jpg"));
    tl.to(others, { opacity: 0, duration: 0.3, ease: "power1.in" }, 19.7);
    cue(19.25, "riser", 0.7, { dur: 0.75 });
    cue(20.0, "impact-soft", 0.9);
    punch(18.0, 0.02);
  }

  // ===========================================================================
  // S06 · ARCHITECTURE (20 → 24s) — the same hero page, but as the five real
  // layers captured from the app, exploded in 3D and labelled on the beat.
  // ===========================================================================
  {
    const s06 = scene("#s06", 20.02, 24.05);
    tl.set(liquid, { display: "none" }, 24.05);
    const tilt = $(".xp-tilt", s06);
    const plane = $(".xp-plane", s06);
    const layers = $$(".xp-layer", s06);

    // Isometric: spin in the page's own plane, then tilt back (two nested
    // elements, because GSAP always composes rotateZ outside rotateX).
    tl.to(plane, { rotation: -38, scale: 0.6, duration: 1.0, ease: "expo.inOut" }, 20.05);
    tl.to(tilt, { rotationX: 58, y: 200, duration: 1.0, ease: "expo.inOut" }, 20.05);
    layers.forEach((l, i) => {
      tl.fromTo(l, { z: 0 }, { z: i * 150, duration: 0.95, ease: "back.out(1.4)", immediateRender: false }, 20.32 + i * 0.07);
    });
    tl.to(layers, { outlineColor: "rgba(0,0,0,0.16)", backgroundColor: "rgba(255,255,255,0.16)", boxShadow: "0 50px 90px rgba(0,0,0,0.13)", duration: 0.5, ease: "none" }, 20.35);
    cue(20.1, "whoosh-soft", 0.7);

    const head = SplitText.create(".xp-title", { type: "chars", mask: "chars" });
    tl.from(head.chars, { yPercent: 115, duration: 0.8, stagger: 0.035 }, 20.3);
    tl.from(".xp-kicker", { opacity: 0, duration: 0.01 }, 20.25);
    scramble(".xp-kicker", 20.25, 0.6);

    const rows = $$(".xp-row", s06).reverse(); // 01 (bottom layer) → 05
    rows.forEach((r, i) => {
      const t = 20.75 + i * 0.25;
      tl.from(r, { opacity: 0, x: -50, duration: 0.5 }, t);
      scramble($$("span, em", r), t, 0.5);
      tl.fromTo(layers[i], { outlineColor: "rgba(184,255,79,1)" }, { outlineColor: "rgba(0,0,0,0.16)", duration: 0.7, ease: "power2.in", immediateRender: false }, t);
      cue(t, "blip", 0.45, { pitch: i });
    });

    // Slow orbit, then the stack slams shut and drops out of frame.
    tl.to(plane, { rotation: -26, duration: 1.45, ease: "sine.inOut" }, 21.9);
    tl.to(tilt, { rotationX: 54, y: 215, duration: 1.45, ease: "sine.inOut" }, 21.9);
    tl.to(layers, { z: (i) => i * 168, duration: 1.45, ease: "sine.inOut" }, 21.9);
    tl.to(layers, { z: 0, duration: 0.2, ease: "expo.in" }, 23.3);
    cue(23.5, "impact", 0.9);
    punch(23.5, 0.025);
    tl.to(tilt, { y: 1700, rotationX: 76, duration: 0.45, ease: "expo.in" }, 23.52);
    tl.to([".xp-head", ".xp-legend"], { opacity: 0, y: 60, duration: 0.3, ease: "power2.in" }, 23.35);
  }

  // ===========================================================================
  // S07 · PERSONAL LANGUAGE (24 → 28s) — the dictionary's hand-drawn GIF glyphs,
  // a post that uses one, and the SYNTAX_DECODE tooltip.
  // ===========================================================================
  {
    const s07 = scene("#s07", 23.6, 28.1);
    tl.fromTo(s07, { clipPath: "inset(0% 0% 100% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.45, ease: "expo.inOut" }, 23.6);
    cue(23.62, "whoosh-soft", 0.6);

    const sprites = $$(".spr", s07);
    sprites.forEach((el) => {
      const host = el.closest("[data-g]");
      el._n = +host.dataset.n;
      el.style.backgroundImage = `url("assets/sprites/gif-${host.dataset.g}.png")`;
      el.style.backgroundSize = `${el._n * 100}% 100%`;
    });
    drivers.push((t) => {
      if (t < 23.6 || t > 28.1) return;
      sprites.forEach((el, i) => {
        const f = Math.floor(t * 5 + i * 0.37) % el._n;
        el.style.backgroundPosition = `${el._n > 1 ? (f / (el._n - 1)) * 100 : 0}% 0%`;
      });
    });

    tl.fromTo(".lang-title", { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.95, ease: "power1.inOut" }, 23.85);
    cue(23.85, "scribble", 0.7);
    tl.from(".lang-sub i", { scaleX: 0, duration: 0.9 }, 24.4);
    tl.from(".lang-sub span", { opacity: 0, duration: 0.01, stagger: 0.12 }, 24.4);
    scramble(".lang-sub span", 24.4, 0.6, { chars: "АБВГДЕЖЗИКЛМН", stagger: 0.12 });

    const glyphs = $$(".glyph", s07);
    const r = rng(99);
    glyphs.forEach((g, i) => {
      const t = 24.25 + i * 0.0625;
      tl.from(g, { scale: 0, rotation: (r() - 0.5) * 50, opacity: 0, duration: 0.6, ease: "back.out(2)" }, t);
      if (i % 2 === 0) cue(t, "tick", 0.3 + i * 0.02);
    });
    tl.to(glyphs, { y: -28, duration: 0.18, stagger: 0.035, ease: "power2.out" }, 25.0);
    tl.to(glyphs, { y: 0, duration: 0.35, stagger: 0.035, ease: "power2.in" }, 25.18);

    // Select :gif-tree: — it becomes a word in a post.
    const sel = document.createElement("div");
    sel.className = "sel";
    glyphs[0].prepend(sel);
    tl.to(sel, { opacity: 1, duration: 0.12, ease: "none" }, 25.5);
    tl.to(glyphs.slice(1), { opacity: 0.22, duration: 0.3, ease: "power1.out" }, 25.5);
    cue(25.5, "select", 0.8);
    tl.from(".post", { y: 280, opacity: 0, duration: 0.8 }, 25.6);
    const words = SplitText.create(".post-text", { type: "words", mask: "words" });
    tl.from(words.words, { yPercent: 110, duration: 0.6, stagger: 0.018 }, 25.72);
    tl.from(".post-gif .spr", { scale: 0, rotation: -30, duration: 0.6, ease: "back.out(2.4)" }, 26.02);
    tl.from(".post-foot", { opacity: 0, duration: 0.4 }, 26.1);
    cue(26.02, "pop", 0.7, { pitch: 5 });

    // Tooltip over the inline glyph (DisplayGifWithMean → .gif-tooltip).
    // Measured lazily: the scene is display:none until 23.6s.
    const tip = $(".tip", s07);
    let gifPos = null;
    const measure = () => {
      if (gifPos) return gifPos;
      const gif = $(".post-gif", s07);
      const post = $(".post", s07);
      const text = $(".post-text", s07);
      const gx = text.offsetLeft + gif.offsetLeft + gif.offsetWidth / 2; // in .post
      const gy = text.offsetTop + gif.offsetTop;
      const left = clamp(gx - tip.offsetWidth / 2, -20, post.offsetWidth - tip.offsetWidth + 20);
      tip.style.left = `${left}px`;
      tip.style.top = `${gy - tip.offsetHeight - 30}px`;
      tip.style.setProperty("--arrow", `${gx - left}px`);
      gifPos = { x: post.offsetLeft + gx, y: post.offsetTop + gy + gif.offsetHeight / 2 };
      return gifPos;
    };
    drivers.push((t) => { if (t >= 23.6 && t < 28.1) measure(); });
    tl.set(cursor, { display: "block", opacity: 1 }, 26.0);
    tl.fromTo(cursorState, { x: 1200 }, { x: () => measure().x + 8, duration: 0.55, ease: "power2.inOut", immediateRender: false }, 26.0);
    tl.fromTo(cursorState, { y: 1950 }, { y: () => measure().y + 10, duration: 0.55, ease: "power3.out", immediateRender: false }, 26.0);
    tl.to(".c-dot", { rotation: 720, duration: 0.6, ease: "power2.out" }, 26.45);
    tl.fromTo(tip, { opacity: 0, y: 16, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, immediateRender: false }, 26.48);
    scramble(".tip-h", 26.48, 0.5);
    scramble(".tip-m", 26.55, 0.7, { chars: "абвгдежзиклмнопрстуфхцчшщыэюя", revealDelay: 0.15 });
    tl.to(".post-gif", { borderBottomColor: "#000", duration: 0.2 }, 26.45);
    cue(26.48, "hover", 0.6);
    cue(26.55, "decode", 0.7);
    tl.to(cursor, { opacity: 0, duration: 0.2 }, 27.3);
    tl.set(cursor, { display: "none" }, 27.5);

    // Exit: the tooltip's ink border floods the screen.
    const black = $(".lang-black", s07);
    const flood = { k: 0 };
    tl.set(black, { display: "block" }, 27.45);
    tl.to(flood, { k: 1, duration: 0.55, ease: "expo.inOut" }, 27.45);
    drivers.push((t) => {
      if (t < 27.4 || t > 28.1) return;
      const post = $(".post", s07);
      const x0 = post.offsetLeft + tip.offsetLeft, y0 = post.offsetTop + tip.offsetTop;
      const k = flood.k;
      const ins = [lerp(y0, 0, k), lerp(1080 - x0 - tip.offsetWidth, 0, k), lerp(1920 - y0 - tip.offsetHeight, 0, k), lerp(x0, 0, k)];
      black.style.clipPath = `inset(${ins.map((v) => `${v.toFixed(1)}px`).join(" ")})`;
    });
    cue(27.45, "whoosh", 0.8);
  }

  // ===========================================================================
  // S08 · THE PATH (28 → 34s) — "это не гонка. это путь." then the end card.
  // ===========================================================================
  {
    const s08 = scene("#s08", 27.98, null);
    const q1 = SplitText.create(".q1 .ln", { type: "chars", mask: "chars" });
    tl.from(q1.chars, { yPercent: 120, duration: 0.75, stagger: 0.035 }, 28.0);
    cue(28.0, "impact", 0.85);
    punch(28.0, 0.025);
    tl.to(".q1 .strike", { scaleX: 1, duration: 0.32, ease: "expo.inOut" }, 28.5);
    cue(28.5, "swipe", 0.7);

    tl.set(s08, { backgroundColor: "#ffffff" }, 29.0);
    tl.set(".q1", { display: "none" }, 29.0);
    tl.set(".q2", { display: "block" }, 29.0);
    const q2 = SplitText.create(".q2 .ln", { type: "chars", mask: "chars" });
    tl.from(q2.chars, { yPercent: 120, duration: 0.75, stagger: 0.04 }, 29.0);
    tl.set(".path-line", { background: "#111", boxShadow: "0 0 30px rgba(184,255,79,0.9)" }, 29.0);
    tl.to(".path-line", { scaleY: 1, duration: 0.9, ease: "expo.inOut" }, 29.02);
    cue(29.0, "impact", 1.0);
    punch(29.0, 0.03);

    tl.to(q2.chars, { yPercent: -120, duration: 0.45, stagger: 0.02, ease: "expo.in" }, 29.8);
    tl.to(".path-line", { scaleY: 0, transformOrigin: "50% 100%", duration: 0.5, ease: "expo.in" }, 29.85);
    cue(29.85, "suck", 0.6);

    // End card: the logo assembles again, the ring closes around it.
    const end = $(".end", s08);
    tl.set(end, { display: "block" }, 30.0);
    const endCanvas = $(".end-particles", s08);
    particleLogo(endCanvas, { x: 240, y: 537, w: 600, h: 327 }, { start: 30.05, until: 31.4, seed: 77 });
    tl.fromTo(".end-logo img", { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "power1.inOut" }, 30.95);
    tl.fromTo(endCanvas, { opacity: 1 }, { opacity: 0, duration: 0.2, ease: "none", immediateRender: false }, 31.1);
    cue(30.05, "swarm", 0.8);
    tl.from(".end-ring .ring-base", { opacity: 0, duration: 0.8 }, 30.1);
    tl.fromTo(".end-ring .ring-fill", { "--fill": "0deg" }, { "--fill": "360deg", duration: 1.4, ease: "power2.inOut" }, 30.15);
    tl.fromTo(".end-ring", { rotation: -120, scale: 0.92 }, { rotation: -40, scale: 1, duration: 4, ease: "power2.out" }, 30.0);

    const title = SplitText.create(".end-title", { type: "chars", mask: "chars" });
    tl.from(title.chars, { yPercent: 115, duration: 0.9, stagger: 0.035 }, 30.7);
    cue(31.0, "impact-soft", 0.7);
    tl.from(".end-meta span", { opacity: 0, duration: 0.01, stagger: 0.15 }, 31.0);
    scramble(".end-meta span", 31.0, 0.7, { stagger: 0.15 });
    tl.from(".end-credit i", { scaleX: 0, duration: 1.0 }, 31.35);
    tl.from(".end-credit span", { opacity: 0, duration: 0.01, stagger: 0.15 }, 31.35);
    scramble(".end-credit span", 31.35, 0.7, { stagger: 0.15 });
    // An impulse runs round the ring, like current through the electric tree.
    tl.fromTo(".end-impulse", { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "none", immediateRender: false }, 31.3);
    tl.fromTo(".end-impulse", { rotation: -30 }, { rotation: 690, duration: 2.7, ease: "power2.inOut", immediateRender: false }, 31.3);
    tl.to(".end-impulse", { opacity: 0, duration: 0.35, ease: "none" }, 33.65);
    cue(31.3, "whoosh-soft", 0.35);
    [32.0, 33.0].forEach((t) => {
      tl.to(".end-logo", { keyframes: { x: [0, -12, 9, -3, 0], opacity: [1, 0.55, 1, 0.8, 1] }, duration: 0.14, ease: "none" }, t);
      cue(t, "glitch", 0.4);
    });
  }

  drivers.push((t, frame) => {
    for (const [el, rec] of scrambles) {
      const text = scrambleAt(rec, t, frame);
      if (el.textContent !== text) el.textContent = text;
    }
  });

  // ===========================================================================
  // Public API for the renderer + a tiny preview player.
  // ===========================================================================
  function seek(t, frame = Math.round(t * FPS)) {
    t = clamp(t, 0, DURATION);
    reseed(frame);
    tl.seek(t, true);
    for (const d of drivers) d(t, frame);
  }

  const ready = (async () => {
    await document.fonts.ready;
    await Promise.all(["Entropia", "EntropiaBack", "EntropiaItalic", "DeltaBlock", "Babayka"].map((f) => document.fonts.load(`900 100px "${f}"`).catch(() => {})));
    await Promise.all($$("img").map(whenDecoded));
    await Promise.all(loading);
    seek(0, 0);
  })();

  // Moments with very fast motion get extra motion-blur subframes when rendering.
  const blurBoost = [
    [0.1, 0.6], [1.62, 2.55], [2.2, 2.6], [5.45, 6.05], [6.0, 6.3], [6.5, 6.8], [7.0, 7.3], [9.45, 10.5],
    [13.05, 13.95], [14.45, 14.95], [15.0, 15.6], [15.7, 16.15], [16.38, 16.8], [16.88, 17.3], [17.38, 17.8],
    [17.8, 18.4], [19.25, 20.05], [20.05, 20.95], [23.3, 24.1], [24.25, 25.0], [25.6, 26.3],
    [27.4, 28.35], [28.95, 29.35], [29.8, 30.55],
  ];

  window.__reel = { fps: FPS, duration: DURATION, width: 1080, height: 1920, ready, seek, cues, blurBoost, timeline: tl };

  if (!RENDER) {
    const stage = $("#stage");
    const fit = () => {
      const k = Math.min(innerWidth / 1080, (innerHeight - 52) / 1920);
      stage.style.transform = `scale(${k})`;
    };
    addEventListener("resize", fit);
    fit();
    const scrub = $("#scrub");
    const time = $("#time");
    const play = $("#play");
    let playing = false, t0 = 0, start = 0;
    const show = (t) => { seek(t); scrub.value = String(Math.round((t / DURATION) * 1000)); time.textContent = t.toFixed(2); };
    const loop = (now) => {
      if (!playing) return;
      const t = start + (now - t0) / 1000;
      if (t >= DURATION) { playing = false; play.textContent = "play"; show(DURATION); return; }
      show(t);
      requestAnimationFrame(loop);
    };
    play.onclick = () => {
      playing = !playing;
      play.textContent = playing ? "pause" : "play";
      if (playing) { t0 = performance.now(); start = +scrub.value / 1000 * DURATION; if (start >= DURATION - 0.05) start = 0; requestAnimationFrame(loop); }
    };
    scrub.oninput = () => { playing = false; play.textContent = "play"; show(+scrub.value / 1000 * DURATION); };
    addEventListener("keydown", (e) => { if (e.code === "Space") { e.preventDefault(); play.onclick(); } });
    ready.then(() => show(parseFloat(PARAMS.get("t") || "0")));
  }
})();
