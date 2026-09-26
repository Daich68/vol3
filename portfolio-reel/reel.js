/* VOL-3 / WEB-ALMANAC — portfolio reel.
 *
 * One paused GSAP timeline plus a handful of "drivers" (pure functions of
 * time) produce every frame, so the piece can be scrubbed in a browser or
 * rendered frame-by-frame by scripts/render.mjs. Sound cues are declared next
 * to the motion they belong to and exported for the audio mix.
 *
 * The landing page is rebuilt at the exact size the site renders on a phone
 * (this stage is 432×768 CSS px at 2.5x). The scrollbar, the notes and the
 * dictionary are the real app, filmed by scripts/record.mjs into
 * .cache/takes/<take>/ and played back here frame by frame.
 */
/* global gsap, SplitText, DrawSVGPlugin, CustomEase */
(() => {
  "use strict";

  const FPS = 30;
  const DURATION = 42;
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

  // Piecewise-linear interpolation, like framer-motion's useTransform.
  const interp = (x, xs, ys) => {
    if (x <= xs[0]) return ys[0];
    for (let i = 1; i < xs.length; i++) {
      if (x <= xs[i]) return lerp(ys[i - 1], ys[i], (x - xs[i - 1]) / (xs[i] - xs[i - 1]));
    }
    return ys[ys.length - 1];
  };

  // Deterministic text scramble (a pure function of time and frame, so the
  // motion-blur subframes of one frame agree).
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
  // Footage: the real app, filmed frame by frame (60 fps JPEG sequences).
  // `points` map reel time → take time ([[reel, take], …]) through a monotone
  // cubic, so speed changes ramp smoothly instead of jumping.

  const TAKES = {};
  function timeMap(points) {
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const n = xs.length;
    const d = [];
    for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
    const m = [d[0]];
    for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
    m.push(d[n - 2]);
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
    }
    return (x) => {
      if (x <= xs[0]) return ys[0] + (x - xs[0]) * m[0];
      if (x >= xs[n - 1]) return ys[n - 1] + (x - xs[n - 1]) * m[n - 1];
      let i = 0;
      while (x > xs[i + 1]) i++;
      const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i]
        + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
    };
  }

  const footages = [];
  // `touch`: an element that shows the finger from the take's track, drawn in
  // the footage's own CSS pixels scaled by `k` (screen px per CSS px).
  function footage(img, take, from, to, points, { touch = null, k = 1, taps = true } = {}) {
    const f = { img, take, from, to, map: timeMap(points), frame: -1, touch, k, taps };
    footages.push(f);
    return f;
  }
  const frameOf = (meta, tt) => clamp(Math.round(tt * meta.fps), 0, meta.frames - 1);
  function applyFootage(f, t) {
    const meta = TAKES[f.take];
    const tt = f.map(t);
    const fr = frameOf(meta, tt);
    let wait = null;
    if (fr !== f.frame) {
      f.frame = fr;
      f.img.src = `.cache/takes/${f.take}/f${String(fr).padStart(5, "0")}.jpg`;
      wait = f.img.decode().catch(() => {});
    }
    if (f.touch) {
      const a = meta.track[fr];
      const tap = f.tapTimes.find((tp) => tt >= tp.t && tt < tp.t + 0.55);
      const pt = a.touch || tap;
      if (pt) {
        f.touch.style.display = "block";
        f.touch.style.transform = `translate(${(pt.x * f.k).toFixed(1)}px, ${(pt.y * f.k).toFixed(1)}px) scale(${(f.k * 0.42).toFixed(3)})`;
        const [dot, ring] = f.touch.children;
        dot.style.opacity = a.touch ? "1" : "0";
        dot.style.transform = a.touch && a.touch.kind === "press" ? "scale(0.8)" : "scale(1)";
        if (tap) {
          const p = (tt - tap.t) / 0.55;
          ring.style.opacity = String(0.55 * (1 - p));
          ring.style.transform = `scale(${lerp(0.7, 2.1, 1 - Math.pow(1 - p, 3))})`;
        } else {
          ring.style.opacity = "0";
        }
      } else {
        f.touch.style.display = "none";
      }
    }
    return wait;
  }
  // The reel time at which a footage shows take time `te` (null if it doesn't).
  function reelTimeOf(f, te) {
    let a = f.from, b = f.to;
    if (te < f.map(a) || te > f.map(b)) return null;
    for (let i = 0; i < 40; i++) {
      const m = (a + b) / 2;
      if (f.map(m) < te) a = m; else b = m;
    }
    return (a + b) / 2;
  }

  // ---------------------------------------------------------------------------
  // Global layers: liquid background, camera (zoom + punches).

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

  // Camera: a zoom (`cam`, tweened) times small punches on key downbeats.
  const camera = $("#camera");
  const cam = { s: 1, ox: 540, oy: 960 };
  const punches = [];
  const punch = (t, amp = 0.02) => punches.push([t, amp]);
  drivers.push((t) => {
    let s = cam.s;
    for (const [pt, a] of punches) {
      const d = t - pt;
      if (d >= 0 && d < 0.8) s *= 1 + a * Math.exp(-d / 0.11) * Math.cos(d * 18);
    }
    camera.style.transformOrigin = `${cam.ox.toFixed(1)}px ${cam.oy.toFixed(1)}px`;
    camera.style.transform = Math.abs(s - 1) < 1e-5 ? "" : `scale(${s.toFixed(4)})`;
  });

  // Pixel-assembled logo: the SVG is sampled on a grid and every filled cell
  // flies in from a random direction (preloader + end card).
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

  // Sprite GIFs (the dictionary glyphs) and the tree video, as sprite sheets.
  function spriteSetup(els) {
    els.forEach((el) => {
      const host = el.closest("[data-g]");
      el._n = +host.dataset.n;
      el.style.backgroundImage = `url("assets/sprites/gif-${host.dataset.g}.png")`;
      el.style.backgroundSize = `${el._n * 100}% 100%`;
    });
  }
  const treeVideoFrame = (t, t0) => {
    const n = Math.floor((t - t0) * 12);
    const f = n % 94 < 48 ? n % 94 : 94 - (n % 94); // 12 fps, ping-pong
    return `${((f % 8) / 7 * 100).toFixed(3)}% ${((Math.floor(f / 8)) / 5 * 100).toFixed(3)}%`;
  };

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
    tl.from(".boot-ring .ring-base", { opacity: 0, duration: 0.8, ease: "power1.out" }, 0.05);
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
    tl.to([counter, ".boot-meta", ring], { opacity: 0, y: -40, duration: 0.3, stagger: 0.03, ease: "power2.in" }, 1.6);
    tl.to(logo, { scale: 20, filter: "blur(18px)", opacity: 0, duration: 0.36, ease: "expo.in" }, 1.72);
    tl.fromTo(panel, { clipPath: "inset(0% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 100% 0%)", duration: 0.62, ease: "expo.inOut" }, 1.82);
    cue(0.3, "riser", 0.9, { dur: 1.7 });
    cue(1.72, "whoosh", 0.9);
    cue(2.0, "impact", 1.0);
    punch(2.0, 0.035);
  }

  // ===========================================================================
  // The phone's page frame and its scrollbar (PageFrame + ScrollProgress on
  // a phone), shared by the landing-page scenes S02–S04.
  // ===========================================================================
  const mfBack = $("#mf-back");
  const mfFront = $("#mf-front");
  const node = $(".node", mfFront);
  const nodeArc = $(".node-arc", mfFront);
  const nodeNum = $(".node-num", mfFront);
  const scrollP = { p: 0 }; // the page's scroll progress, 0…1
  {
    tl.set([mfBack, mfFront], { display: "block" }, 1.8);
    tl.set([mfBack, mfFront], { display: "none" }, 14.6);
    // The frame draws itself as the preloader lifts.
    tl.from($$(".mf-edge", mfBack), { scale: 0, duration: 0.9, stagger: 0.07 }, 1.98);
    tl.from(".mf-glass", { opacity: 0, duration: 0.6, ease: "power2.out" }, 2.05);
    tl.fromTo(".mf-inner", { clipPath: "inset(50% 0% 50% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.75, ease: "expo.inOut" }, 2.05);
    tl.from(".mf-square", { scale: 0, opacity: 0, duration: 0.5, ease: "back.out(3)" }, 2.55);
    tl.from(".mscroll .tree", { opacity: 0, duration: 1.2, ease: "power1.out" }, 2.4);
    tl.from(node, { scale: 0, duration: 0.7, ease: "back.out(2.2)" }, 2.7);
    tl.from(".tg", { scale: 0, opacity: 0, duration: 0.6, ease: "back.out(2.2)" }, 2.85);

    // ScrollProgress.tsx: three stops (20 / 50 / 80 %), a winding x path, a
    // tilt, a small scale bump, the ring and the two-digit percentage.
    drivers.push((t) => {
      if (t < 1.8 || t > 14.6) return;
      const p = scrollP.p;
      const top = interp(p, [0, 0.25, 0.4, 0.6, 0.75, 1], [20, 20, 50, 50, 80, 80]);
      const x = interp(p, [0, 0.2, 0.4, 0.5, 0.7, 1], [-10, 5, 25, 10, -15, 0]);
      const rot = interp(p, [0, 0.2, 0.4, 0.6, 0.8, 1], [0, 5, -8, 10, -5, 0]);
      const sc = interp(p, [0.15, 0.35, 0.45, 0.65, 0.85], [1, 1.08, 0.95, 1.1, 1]);
      node.style.top = `${top.toFixed(3)}%`;
      node.style.translate = `${(x * 0.8).toFixed(2)}px 0`;
      node.style.rotate = `${rot.toFixed(2)}deg`;
      node.style.scale = sc.toFixed(4);
      nodeArc.style.strokeDashoffset = (1 - p).toFixed(4);
      nodeNum.textContent = String(Math.round(p * 100)).padStart(2, "0");
    });
  }

  // ===========================================================================
  // S02 · HERO (2 → 5.5s) — the phone's hero, at its real size: the frame
  // draws itself, WEB-ALMANAC rises out of masks, the ghost logo fills, the
  // scroll node lands on the branch. Exit: the camera dives into the node.
  // ===========================================================================
  const NODE_AT_20 = { x: 1009, y: 441 }; // the node's centre at 20 % (stage px)
  {
    scene("#s02", 1.8, 5.62);

    const split = SplitText.create(".hero-title .ln", { type: "chars", mask: "chars" });
    gsap.set(".hero-title", { perspective: 900 });
    tl.from(split.chars, { yPercent: 118, rotationX: -75, transformOrigin: "50% 100%", duration: 1.15, stagger: 0.04 }, 2.22);
    cue(2.22, "whoosh-soft", 0.5);
    const subWords = SplitText.create(".hero-sub", { type: "words", mask: "words" });
    tl.from(subWords.words, { yPercent: 110, duration: 0.9, stagger: 0.05 }, 3.0);

    // Ghost logo fills from the bottom (About.tsx logo-fill-layer).
    tl.from(".hero-ghost .g-base", { opacity: 0, duration: 1, ease: "power1.out" }, 2.4);
    tl.fromTo(".hero-ghost .g-fill", { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 2.4, ease: "power1.inOut" }, 2.9);

    // A slow push-in keeps the held shot alive.
    tl.fromTo(cam, { s: 1 }, { s: 1.03, duration: 2.6, ease: "sine.inOut", immediateRender: false }, 2.4);

    // Beat hits: the two halves of the title slip and snap back.
    const lines = $$(".hero-title .ln");
    [[beat(3), 30], [beat(5), -24]].forEach(([t, dx], i) => {
      tl.to(lines[i % 2], { keyframes: { x: [dx, -dx * 0.4, 0], skewX: [-8, 4, 0] }, duration: 0.16, ease: "none" }, t);
      tl.to(lines[(i + 1) % 2], { keyframes: { x: [-dx * 0.6, dx * 0.2, 0] }, duration: 0.16, ease: "none" }, t);
      cue(t, "glitch", 0.35);
    });
    // One beat in the backslant cut of Entropia.
    tl.set(".hero-title", { fontFamily: "EntropiaBack" }, beat(4));
    tl.set(".hero-title", { fontFamily: "Entropia" }, beat(4) + 0.25);
    punch(beat(4), 0.012);

    // Exit: dive into the scroll node; the next shot starts inside the
    // real node (S02b) at 5.5.
    tl.set(cam, { ox: NODE_AT_20.x, oy: NODE_AT_20.y }, 5.0);
    tl.fromTo(cam, { s: 1.03 }, { s: 14, duration: 0.5, ease: "expo.in", immediateRender: false }, 5.0);
    tl.set(cam, { s: 1, ox: 540, oy: 960 }, 5.5);
    cue(5.02, "whoosh", 0.9);
  }

  // ===========================================================================
  // S02b · THE SCROLLBAR (5.5 → 8.2s) — the real site: the scrollbar is a
  // branch; each wheel notch turns the page, the node rides the branch and
  // the branch fills with light (desktop take, sidebar up close).
  // ===========================================================================
  {
    const s02b = scene("#s02b", 5.5, 8.35);
    const img = $("img", s02b);
    const shot = { cx: 1294, cy: 250, h: 300 };
    const f = footage(img, "d-home", 5.5, 8.35, [[5.5, 1.25], [6.0, 1.62], [6.8, 2.62], [7.0, 4.03], [7.6, 4.8], [8.35, 5.9]]);
    f.onApply = () => {
      const s = 1920 / (shot.h * 2); // the take is filmed at 2x
      const k = 2 * s;
      img.style.transform = `translate(${(540 - shot.cx * k).toFixed(2)}px, ${(960 - shot.cy * k).toFixed(2)}px) scale(${s.toFixed(5)})`;
    };
    // out of the node, back to the whole branch; then a slow drift
    tl.to(shot, { cx: 1210, cy: 450, h: 860, duration: 0.7, ease: "expo.out" }, 5.5);
    tl.to(shot, { cx: 1195, cy: 456, h: 800, duration: 1.7, ease: "sine.inOut" }, 6.2);
    punch(6.02, 0.03);
    punch(7.02, 0.03);
    cue(6.0, "thump", 0.8);
    cue(6.05, "whoosh-soft", 0.4);
    cue(7.0, "thump", 0.8);
    cue(7.05, "whoosh-soft", 0.4);
    // Exit: the whole shot scrolls away upwards, uncovering the phone.
    tl.to(s02b, { yPercent: -100, duration: 0.42, ease: "expo.in" }, 7.9);
    cue(7.95, "swipe", 0.6);
  }

  // ===========================================================================
  // S03 · RULES (8 → 12s) — the three numbers from the landing page, at
  // their real size, played like a step sequencer; then the page turns.
  // ===========================================================================
  {
    const s03 = scene("#s03", 7.9, 12.3);
    tl.set(scrollP, { p: 0.5 }, 7.9);
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
      const t = 8.15 + i * BEAT;
      tl.from(r, { y: 300, rotationX: -60, scale: 0.9, opacity: 0, duration: 0.95, ease: "back.out(1.2)" }, t);
      scramble($(".lbl", r), t + 0.12, 0.7, { chars: "АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЭЮЯ" });
      cue(t, "thump", 0.9);
    });
    tl.fromTo(".odo-col", { yPercent: 0 }, { yPercent: (-100 * 11) / 12, duration: 1.05, ease: "power3.inOut" }, 8.2);
    tl.fromTo(inf, { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", duration: 1.1, ease: "power2.inOut" }, 8.65);
    scramble(".rule.r3 .scr", 9.15, 0.8, { text: "00", chars: "0123456789", revealDelay: 0.5 });

    // Step sequencer: each card inverts on its own beat, then all three.
    rules.forEach((r, i) => {
      const t = 10 + i * BEAT;
      tl.fromTo($(".flash", r), { opacity: 1 }, { opacity: 0, duration: 0.45, ease: "power2.in", immediateRender: false }, t);
      tl.fromTo(r, { scale: 1.045 }, { scale: 1, duration: 0.45, ease: "power3.out", immediateRender: false }, t);
      cue(t, "blip", 0.8, { pitch: i });
      punch(t, 0.012);
    });
    tl.fromTo($$(".flash", s03), { opacity: 1 }, { opacity: 0, duration: 0.3, ease: "power2.in", immediateRender: false }, 11.5);
    cue(11.5, "blip", 0.9, { pitch: 3 });

    // Exit: the page turns — the cards fold into lines and fly up into the
    // navigation divider while the node rides the branch from 50 to 80 %.
    tl.to(rules, { scaleY: 0.012, duration: 0.24, stagger: 0.05, ease: "expo.in" }, 11.72);
    tl.to(rules, { y: (i) => -[398, 808, 1225][i], scaleX: 0.72, opacity: 0, duration: 0.34, stagger: 0.04, ease: "expo.in" }, 11.9);
    tl.to(scrollP, { p: 1, duration: 0.8, ease: "power2.inOut" }, 11.75);
    cue(11.7, "suck", 0.8);
  }

  // ===========================================================================
  // S04 · NAVIGATION (12 → 14.5s) — the tree navigation as a phone shows it:
  // the cards drop in on 8th notes, a finger taps "записи" and the card
  // opens into the branch video that frames the next scene.
  // ===========================================================================
  {
    scene("#s04", 11.95, 14.6);
    tl.from(".nav-divider i", { scaleX: 0, duration: 0.8 }, 12.0);
    tl.from(".nav-divider span", { letterSpacing: "1.6em", opacity: 0, duration: 0.9, ease: "power3.out" }, 12.0);
    cue(12.0, "impact-soft", 0.7);
    punch(12.0, 0.02);

    const cards = $$("#s04 .nav-card");
    cards.forEach((c, i) => {
      const t = 12.1 + i * 0.25;
      tl.from(c, { y: 120, opacity: 0, rotationX: -35, transformPerspective: 1200, duration: 0.7 }, t);
      tl.from($(".lbl", c), { yPercent: 60, opacity: 0, duration: 0.5 }, t + 0.08);
      cue(t, "pop", 0.55, { pitch: i });
    });
    // the branch videos (visible on phones at 0.6)
    const vids = [...$$("#s04 .nav-card .vid"), $(".nav-expand .vid")];
    drivers.push((t) => {
      if (t < 12 || t > 17.5) return;
      const pos = treeVideoFrame(t, 12);
      vids.forEach((v) => { v.style.backgroundPosition = pos; });
    });

    // A finger taps "записи".
    const card = $('#s04 .nav-card[data-id="notes"]');
    const touch = $("#s04 .touch");
    const TAP = 13.6;
    const tp = { x: 512, y: 461 }; // centre of the card, in page px
    tl.set(touch, { display: "block", x: tp.x, y: tp.y }, TAP - 0.3);
    tl.fromTo($(".t-dot", touch), { scale: 1.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25, ease: "power2.out", immediateRender: false }, TAP - 0.3);
    tl.to($(".t-dot", touch), { scale: 0.8, duration: 0.08, ease: "power2.in" }, TAP - 0.04);
    tl.fromTo($(".t-ring", touch), { scale: 0.7, opacity: 0.55 }, { scale: 2.1, opacity: 0, duration: 0.55, ease: "power3.out", immediateRender: false }, TAP);
    tl.to($(".t-dot", touch), { opacity: 0, duration: 0.25 }, TAP + 0.2);
    tl.to(card, { scale: 0.97, duration: 0.08, ease: "power2.in" }, TAP - 0.06);
    tl.to(card, { scale: 1, duration: 0.3, ease: "back.out(3)" }, TAP + 0.02);
    tl.to($(".vid", card), { opacity: 0.9, duration: 0.3 }, TAP);
    cue(TAP, "click", 1.0);

    // The card grows into the whole screen; the video frame rotates into
    // portrait and becomes an organic frame for the phone.
    const s04b = scene("#s04b", TAP + 0.12, 19.9);
    const expand = $(".nav-expand", s04b);
    const evid = $(".vid", expand);
    const ex = { k: 0 };
    tl.to(ex, { k: 1, duration: 0.75, ease: "expo.inOut" }, TAP + 0.12);
    cue(TAP + 0.12, "whoosh", 0.8);
    const rect = { x: 128, y: 389, w: 824, h: 200 }; // the card, in stage px
    drivers.push((t) => {
      if (t < TAP || t > 19.9) return;
      const k = ex.k;
      const inset = [lerp(rect.y, 0, k), lerp(1080 - rect.x - rect.w, 0, k), lerp(1920 - rect.y - rect.h, 0, k), lerp(rect.x, 0, k)];
      expand.style.clipPath = k >= 1 ? "none" : `inset(${inset.map((v) => `${v.toFixed(1)}px`).join(" ")} round ${lerp(30, 0, k).toFixed(1)}px)`;
      const cx = lerp(rect.x + rect.w / 2, 540, k);
      const cy = lerp(rect.y + rect.h / 2, 960, k);
      const s0 = Math.max(rect.w / 2020, rect.h / 1117) * 1.04;
      evid.style.transform = `translate(${(cx - 540).toFixed(1)}px, ${(cy - 960).toFixed(1)}px) rotate(${(90 * k).toFixed(2)}deg) scale(${lerp(s0, 1, k).toFixed(4)})`;
    });
    tl.to(expand, { scale: 1.08, duration: 3, ease: "power1.inOut" }, TAP + 0.9);
  }

  // ===========================================================================
  // S05 · A NOTE (14.5 → 19.6s) — the phone inside the organic frame plays
  // the real notes page: the list, a note, reading mode to the very end.
  // Then a wall of every desktop screen, and a dive into the landing page.
  // ===========================================================================
  {
    const s05 = scene("#s05", 14.3, 22.1);
    const dev = $(".dev-stage", s05);
    const phone = $("#phone-notes");
    const screen = $(".p-screen", phone);
    tl.from(phone, { y: 1400, rotation: -12, duration: 1.0 }, 14.3);
    tl.to(phone, { keyframes: { rotationY: [0, -8, 6, 0] }, duration: 3.6, ease: "sine.inOut" }, 14.9);
    cue(14.35, "whoosh-soft", 0.6);
    footage($(".foot", screen), "m-notes", 14.3, 19.75, [
      [14.3, 0.2], [14.9, 0.6], [15.5, 1.8], [16.0, 2.62], [16.7, 3.7], [17.0, 4.17], [19.2, 7.37], [19.75, 7.9],
    ], { touch: $(".touch", screen), k: 588 / 432 });

    // Whip up into a wall of screens, pull back, dive into the landing page.
    tl.to(dev, { y: -2200, duration: 0.38, ease: "expo.in" }, 19.42);
    cue(19.45, "whoosh", 1.0);
    const wall = $(".wall", s05);
    const plane = $(".wall-plane", s05);
    tl.set(wall, { display: "block" }, 19.55);
    tl.set(liquid, { display: "block" }, 19.55);
    gsap.set(plane, { rotationX: 55, rotation: -32, scale: 1.3 });
    tl.from(plane, { y: 2300, duration: 0.8 }, 19.58);
    tl.to(plane, { scale: 0.86, duration: 1.4, ease: "power2.out" }, 19.58);
    tl.fromTo(".wall-col.c1", { y: -250 }, { y: 520, duration: 2.05, ease: "none" }, 19.58);
    tl.fromTo(".wall-col.c2", { y: 1400 }, { y: 0, duration: 2.05, ease: "power2.out" }, 19.58);
    tl.fromTo(".wall-col.c3", { y: 300 }, { y: -560, duration: 2.05, ease: "none" }, 19.58);
    tl.to(plane, { rotationX: 0, rotation: 0, scale: 1.2, duration: 0.75, ease: "expo.inOut" }, 20.87);
    const others = $$(".wall-col img", s05).filter((im) => !im.src.endsWith("d-home-hero.jpg"));
    tl.to(others, { opacity: 0, duration: 0.3, ease: "power1.in" }, 21.3);
    cue(20.85, "riser", 0.7, { dur: 0.75 });
    cue(21.6, "impact-soft", 0.9);
    punch(19.6, 0.02);
  }

  // ===========================================================================
  // S06 · ARCHITECTURE (21.6 → 24.9s) — the same landing page as its five
  // real layers, exploded in 3D; each lights up on an 8th note.
  // ===========================================================================
  {
    const s06 = scene("#s06", 21.62, 24.95);
    tl.set(liquid, { display: "none" }, 24.95);
    const tilt = $(".xp-tilt", s06);
    const plane = $(".xp-plane", s06);
    const layers = $$(".xp-layer", s06);

    tl.to(plane, { rotation: -38, scale: 0.72, duration: 1.0, ease: "expo.inOut" }, 21.65);
    tl.to(tilt, { rotationX: 58, y: 60, duration: 1.0, ease: "expo.inOut" }, 21.65);
    layers.forEach((l, i) => {
      tl.fromTo(l, { z: 0 }, { z: i * 170, duration: 0.95, ease: "back.out(1.4)", immediateRender: false }, 21.92 + i * 0.07);
    });
    tl.to(layers, { outlineColor: "rgba(0,0,0,0.16)", backgroundColor: "rgba(255,255,255,0.16)", boxShadow: "0 50px 90px rgba(0,0,0,0.13)", duration: 0.5, ease: "none" }, 21.95);
    cue(21.7, "whoosh-soft", 0.7);
    layers.forEach((l, i) => {
      const t = 22.5 + i * 0.25;
      tl.fromTo(l, { outlineColor: "rgba(0,0,0,1)", backgroundColor: "rgba(0,0,0,0.1)" }, { outlineColor: "rgba(0,0,0,0.16)", backgroundColor: "rgba(255,255,255,0.16)", duration: 0.6, ease: "power2.in", immediateRender: false }, t);
      cue(t, "blip", 0.45, { pitch: i });
    });

    // Slow orbit, then the stack slams shut and drops out of frame.
    tl.to(plane, { rotation: -26, duration: 1.3, ease: "sine.inOut" }, 23.4);
    tl.to(tilt, { rotationX: 54, y: 75, duration: 1.3, ease: "sine.inOut" }, 23.4);
    tl.to(layers, { z: (i) => i * 190, duration: 1.3, ease: "sine.inOut" }, 23.4);
    tl.to(layers, { z: 0, duration: 0.2, ease: "expo.in" }, 24.35);
    cue(24.55, "impact", 0.9);
    punch(24.55, 0.025);
    tl.to(tilt, { y: 1700, rotationX: 76, duration: 0.45, ease: "expo.in" }, 24.57);
  }

  // ===========================================================================
  // S07 · THE DICTIONARY (24.9 → 36.6s) — the twelve glyphs, then the real
  // flow on the phone: give glyphs your own meanings, pin them, write a post
  // with one, see your meaning pop up, publish — and a reader taps the glyph
  // and gets SYNTAX_DECODE with that meaning.
  // ===========================================================================
  {
    const s07 = scene("#s07", 24.7, 36.9);
    tl.fromTo(s07, { clipPath: "inset(0% 0% 100% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.45, ease: "expo.inOut" }, 24.7);
    cue(24.72, "whoosh-soft", 0.6);

    const sprites = $$(".glyph .spr", s07);
    spriteSetup(sprites);
    drivers.push((t) => {
      if (t < 24.7 || t > 27.6) return;
      sprites.forEach((el, i) => {
        const f = Math.floor(t * 5 + i * 0.37) % el._n;
        el.style.backgroundPosition = `${el._n > 1 ? (f / (el._n - 1)) * 100 : 0}% 0%`;
      });
    });

    tl.fromTo(".lang-title", { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.95, ease: "power1.inOut" }, 24.95);
    cue(24.95, "scribble", 0.7);

    const glyphs = $$(".glyph", s07);
    const r = rng(99);
    glyphs.forEach((g, i) => {
      const t = 25.25 + i * 0.0625;
      tl.from(g, { scale: 0, rotation: (r() - 0.5) * 50, opacity: 0, duration: 0.6, ease: "back.out(2)" }, t);
      if (i % 2 === 0) cue(t, "tick", 0.3 + i * 0.02);
    });
    tl.to(glyphs, { y: -28, duration: 0.18, stagger: 0.035, ease: "power2.out" }, 26.0);
    tl.to(glyphs, { y: 0, duration: 0.35, stagger: 0.035, ease: "power2.in" }, 26.18);

    // :gif-ear: is picked.
    const sel = document.createElement("div");
    sel.className = "sel";
    glyphs[0].prepend(sel);
    tl.to(sel, { opacity: 1, duration: 0.1, ease: "none" }, 26.5);
    drivers.push((t) => glyphs[0].classList.toggle("on", t >= 26.5));
    tl.to(glyphs.slice(1), { opacity: 0.22, duration: 0.3, ease: "power1.out" }, 26.5);
    cue(26.5, "select", 0.8);
    punch(26.5, 0.015);

    // The phone rises; the grid clears the way.
    const phone = $("#phone-dict");
    const screen = $(".p-screen", phone);
    tl.to([".lang-title", ".glyphs"], { y: -700, opacity: 0, duration: 0.6, ease: "expo.in" }, 26.85);
    tl.from(phone, { y: 1760, rotation: 8, duration: 0.9 }, 27.0);
    cue(27.0, "whoosh-soft", 0.6);

    const K = 708 / 432; // phone screen px per filmed CSS px
    const SCREEN = { x: 170 + 16, y: 297 + 16 };
    const at = (x, y) => ({ fx: SCREEN.x + x * K, fy: SCREEN.y + y * K });
    footage($(".foot", screen), "m-dict", 27.0, 36.9, [
      [27.0, 0.6], [27.3, 1.0], [27.6, 1.35], [28.1, 2.97], [28.8, 4.6], [29.0, 5.48], [29.7, 7.35], [30.6, 11.0],
      [30.9, 12.02], [31.3, 14.13], [31.7, 15.75], [32.4, 17.5], [32.6, 18.2], [33.8, 19.6], [34.1, 20.47],
      [34.5, 22.33], [34.9, 23.43], [35.2, 24.18], [36.9, 26.0],
    ], { touch: $(".touch", screen), k: K });

    // Zooms into the phone: onto the fields while they're typed, onto the
    // meaning that pops up over the glyph, onto the reader's SYNTAX_DECODE.
    const pz = { s: 1, fx: 540, fy: 960, cx: 540, cy: 960 };
    drivers.push((t) => {
      if (t < 27 || t > 36.9) return;
      // origin at the phone's top-left: P' = O + t + s (P - O); keep F → C
      const ox = 170, oy = 297;
      const tx = pz.cx - ox - pz.s * (pz.fx - ox);
      const ty = pz.cy - oy - pz.s * (pz.fy - oy);
      phone.style.transformOrigin = "0 0";
      phone.style.translate = `${tx.toFixed(1)}px ${ty.toFixed(1)}px`;
      phone.style.scale = pz.s.toFixed(4);
    });
    const zoom = (t0, dur, s, x, y, cy = 960, ease = "power3.inOut") => tl.to(pz, { s, ...at(x, y), cx: 540, cy, duration: dur, ease }, t0);
    zoom(27.9, 0.5, 1.5, 216, 400);            // the first meaning
    zoom(28.8, 0.35, 1.5, 216, 560);           // the second
    zoom(30.7, 0.45, 1, 216, 384);             // pin
    zoom(31.55, 0.45, 1.45, 216, 380);         // the post
    zoom(32.45, 0.4, 1.7, 180, 300, 900);      // the meaning over the glyph
    zoom(33.85, 0.45, 1, 216, 384);            // publish
    zoom(35.0, 0.55, 1.8, 216, 290, 860);      // the reader decodes it
    punch(28.1, 0.012);
    punch(32.6, 0.02);
    punch(35.2, 0.02);
    cue(32.62, "decode", 0.6);
    cue(35.24, "decode", 0.7);

    // Exit: the SYNTAX_DECODE card opens up into the white of the end card.
    const white = $(".lang-white", s07);
    const flood = { k: 0 };
    tl.set(white, { display: "block" }, 36.25);
    tl.to(flood, { k: 1, duration: 0.6, ease: "expo.inOut" }, 36.25);
    const tipCSS = { x: 75, y: 300, w: 282, h: 86 }; // the tooltip in the filmed page
    drivers.push((t) => {
      if (t < 36.2 || t > 36.9) return;
      const x0 = pz.cx + (SCREEN.x + tipCSS.x * K - pz.fx) * pz.s;
      const y0 = pz.cy + (SCREEN.y + tipCSS.y * K - pz.fy) * pz.s;
      const w = tipCSS.w * K * pz.s, h = tipCSS.h * K * pz.s;
      const k = flood.k;
      const ins = [lerp(y0, 0, k), lerp(1080 - x0 - w, 0, k), lerp(1920 - y0 - h, 0, k), lerp(x0, 0, k)];
      white.style.clipPath = `inset(${ins.map((v) => `${Math.max(0, v).toFixed(1)}px`).join(" ")})`;
    });
    cue(36.25, "whoosh", 0.7);
  }

  // ===========================================================================
  // S08 · END CARD (36.6 → 42s) — the logo assembles again inside the ring,
  // the two QR codes rise: the Telegram channel and the site.
  // ===========================================================================
  {
    scene("#s08", 36.6, null);
    const endCanvas = $(".end-particles");
    particleLogo(endCanvas, { x: 290, y: 423, w: 500, h: 273 }, { start: 36.65, until: 38.0, seed: 77, cell: 5 });
    tl.fromTo(".end-logo img", { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "power1.inOut" }, 37.55);
    tl.fromTo(endCanvas, { opacity: 1 }, { opacity: 0, duration: 0.2, ease: "none", immediateRender: false }, 37.7);
    cue(36.65, "swarm", 0.8);
    tl.from(".end-ring .ring-base", { opacity: 0, duration: 0.8 }, 36.7);
    tl.fromTo(".end-ring .ring-fill", { "--fill": "0deg" }, { "--fill": "360deg", duration: 1.4, ease: "power2.inOut" }, 36.75);
    tl.fromTo(".end-ring", { rotation: -120, scale: 0.92 }, { rotation: -40, scale: 1, duration: 4, ease: "power2.out" }, 36.6);

    tl.from(".qr", { y: 120, opacity: 0, duration: 1.0, stagger: 0.2, ease: "expo.out" }, 37.7);
    cue(37.7, "impact-soft", 0.7);
    punch(37.7, 0.015);

    // An impulse runs round the ring, like current through the electric tree.
    tl.fromTo(".end-impulse", { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "none", immediateRender: false }, 38.0);
    tl.fromTo(".end-impulse", { rotation: -30 }, { rotation: 690, duration: 3.2, ease: "power2.inOut", immediateRender: false }, 38.0);
    tl.to(".end-impulse", { opacity: 0, duration: 0.35, ease: "none" }, 40.9);
    cue(38.0, "whoosh-soft", 0.35);
    [39.0, 40.5].forEach((t) => {
      tl.to(".end-logo", { keyframes: { x: [0, -12, 9, -3, 0], opacity: [1, 0.55, 1, 0.8, 1] }, duration: 0.14, ease: "none" }, t);
      cue(t, "glitch", 0.35);
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
  async function seek(t, frame = Math.round(t * FPS)) {
    t = clamp(t, 0, DURATION);
    reseed(frame);
    tl.seek(t, true);
    for (const d of drivers) d(t, frame);
    const waits = [];
    for (const f of footages) {
      if (t < f.from || t >= f.to) continue;
      const w = applyFootage(f, t);
      if (f.onApply) f.onApply(t);
      if (w) waits.push(w);
    }
    await Promise.all(waits);
  }

  const ready = (async () => {
    await document.fonts.ready;
    await Promise.all(["Entropia", "EntropiaBack", "EntropiaItalic", "DeltaBlock", "Babayka"].map((f) => document.fonts.load(`900 100px "${f}"`).catch(() => {})));
    for (const name of new Set(footages.map((f) => f.take))) {
      const r = await fetch(`.cache/takes/${name}/track.json`);
      if (!r.ok) throw new Error(`take ${name} is not recorded — run scripts/record.mjs ${name}`);
      TAKES[name] = await r.json();
    }
    for (const box of $$(".qr-code")) {
      box.innerHTML = await (await fetch(box.dataset.src)).text();
    }
    // Taps and keystrokes in the footage become sound cues.
    let lastKey = -1;
    for (const f of footages) {
      const meta = TAKES[f.take];
      f.tapTimes = meta.events.filter((e) => e.type === "tap").map((e) => ({ t: e.frame / meta.fps, x: e.x, y: e.y }));
      for (const e of meta.events) {
        const tr = reelTimeOf(f, e.frame / meta.fps);
        if (tr == null || tr < f.from || tr >= f.to) continue;
        if (e.type === "tap" || e.type === "click") cue(tr, "click", 0.75);
        if (e.type === "key" && tr - lastKey >= 0.075) {
          lastKey = tr;
          const seed = cues.length % 17;
          cue(tr, "key", 0.6, { seed, pan: ((seed * 7) % 9 - 4) / 20 });
        }
      }
    }
    cues.sort((a, b) => a.t - b.t);
    await Promise.all($$("img").filter((im) => !im.classList.contains("foot") && im.getAttribute("src")).map(whenDecoded));
    await Promise.all(loading);
    await seek(0, 0);
  })();

  // Moments with very fast motion get extra motion-blur subframes when rendering.
  const blurBoost = [
    [0.1, 0.6], [1.62, 2.55], [2.2, 2.6], [5.0, 6.2], [6.0, 6.35], [7.0, 7.35], [7.85, 8.45], [8.1, 8.6],
    [11.65, 12.4], [13.7, 14.45], [14.3, 14.9], [19.4, 20.0], [20.85, 21.65], [21.65, 22.5], [24.3, 25.2],
    [25.25, 26.05], [26.85, 27.5], [27.9, 28.4], [28.8, 29.2], [30.6, 31.8], [32.45, 32.9], [33.85, 34.9],
    [35.0, 35.6], [36.2, 36.9], [36.65, 37.3], [37.7, 38.2],
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
    let playing = false, t0 = 0, start = 0, busy = false;
    const show = async (t) => {
      busy = true;
      await seek(t);
      busy = false;
      scrub.value = String(Math.round((t / DURATION) * 1000));
      time.textContent = t.toFixed(2);
    };
    const loop = async (now) => {
      if (!playing) return;
      const t = start + (now - t0) / 1000;
      if (t >= DURATION) { playing = false; play.textContent = "play"; await show(DURATION); return; }
      if (!busy) await show(t);
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
