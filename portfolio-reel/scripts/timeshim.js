// Virtual time for recording the real app frame by frame.
//
// Injected before any page script (Playwright addInitScript). The page's clock
// stops: Date, performance.now, timers and requestAnimationFrame only move when
// the recorder calls window.__vt.advance(ms). CSS animations/transitions, Web
// Animations (framer-motion), <video> and animated GIFs are pinned to the same
// clock, so every captured frame is exactly "t milliseconds into the take".
(() => {
  const cfg = window.__VT_CONFIG__ || {};
  const EPOCH = cfg.epoch ?? Date.parse("2026-09-25T12:00:00Z");
  const GIF_FPS = cfg.gifFps || {};
  let now = 0;

  // --- clock ---------------------------------------------------------------
  const RealDate = Date;
  function VDate(...args) {
    if (!new.target) return new RealDate(EPOCH + now).toString();
    return args.length ? new RealDate(...args) : new RealDate(EPOCH + now);
  }
  VDate.prototype = RealDate.prototype;
  VDate.now = () => EPOCH + now;
  VDate.parse = RealDate.parse;
  VDate.UTC = RealDate.UTC;
  window.Date = VDate;
  const perfNow = () => now;
  try {
    Object.defineProperty(performance, "now", { value: perfNow, configurable: true });
  } catch {
    performance.now = perfNow;
  }

  // --- timers --------------------------------------------------------------
  const realSetTimeout = window.setTimeout.bind(window);
  let nextId = 1;
  const timers = new Map();
  window.setTimeout = (fn, ms = 0, ...args) => {
    const id = nextId++;
    timers.set(id, { at: now + Math.max(0, +ms || 0), fn, args, every: 0 });
    return id;
  };
  window.setInterval = (fn, ms = 0, ...args) => {
    const id = nextId++;
    const every = Math.max(1, +ms || 0);
    timers.set(id, { at: now + every, fn, args, every });
    return id;
  };
  window.clearTimeout = window.clearInterval = (id) => { timers.delete(id); };

  // A real rendering opportunity, so the browser can dispatch scroll events
  // (and anything else tied to frames) between virtual frames.
  const realRAF = window.requestAnimationFrame.bind(window);
  const realFrame = () => new Promise((res) => realRAF(() => res()));

  let rafs = new Map();
  window.requestAnimationFrame = (cb) => { const id = nextId++; rafs.set(id, cb); return id; };
  window.cancelAnimationFrame = (id) => { rafs.delete(id); };

  const call = (fn, args) => {
    try { typeof fn === "function" ? fn(...args) : (0, eval)(String(fn)); } catch (e) { console.error(e); }
  };

  function runTimersUntil(t) {
    for (let guard = 0; guard < 10000; guard++) {
      let pick = null;
      for (const [id, tm] of timers) if (tm.at <= t && (!pick || tm.at < pick[1].at)) pick = [id, tm];
      if (!pick) break;
      const [id, tm] = pick;
      now = Math.max(now, tm.at);
      if (tm.every) tm.at += tm.every; else timers.delete(id);
      call(tm.fn, tm.args);
    }
    now = t;
  }

  // --- CSS / Web Animations ------------------------------------------------
  const born = new WeakMap();
  function syncAnimations() {
    for (const a of document.getAnimations()) {
      let t0 = born.get(a);
      if (t0 === undefined) {
        t0 = now;
        born.set(a, t0);
        try { a.pause(); } catch {}
      }
      try { a.currentTime = (now - t0) * (a.playbackRate || 1); } catch {}
    }
  }

  // --- <video>: paused and seeked to the virtual clock ----------------------
  const videoBorn = new WeakMap();
  function syncVideos() {
    const waits = [];
    for (const v of document.querySelectorAll("video")) {
      if (!videoBorn.has(v)) {
        videoBorn.set(v, now);
        v.muted = true;
        v.autoplay = false;
        try { v.pause(); } catch {}
      }
      if (!(v.duration > 0)) continue;
      // Only seek videos that can actually be seen.
      const r = v.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth || !r.width) continue;
      if (+getComputedStyle(v).opacity === 0) continue;
      const t = ((now - videoBorn.get(v)) / 1000) % v.duration;
      if (Math.abs(v.currentTime - t) < 1e-3) continue;
      waits.push(new Promise((res) => {
        const done = () => { v.removeEventListener("seeked", done); res(); };
        v.addEventListener("seeked", done);
        realSetTimeout(done, 400);
        v.currentTime = t;
      }));
    }
    return Promise.all(waits);
  }

  // --- animated GIFs: served as horizontal sprite strips, cropped per frame --
  function syncGifs() {
    for (const img of document.querySelectorAll("img")) {
      const src = img.currentSrc || img.src || "";
      const m = src.match(/\/([a-z0-9-]+)\.[0-9a-f]+\.gif(?:$|\?)/i) || src.match(/\/([a-z0-9-]+)\.gif(?:$|\?)/i);
      if (!m || !img.naturalWidth) continue;
      const n = Math.max(1, Math.round(img.naturalWidth / img.naturalHeight));
      if (n === 1) continue;
      if (!img.__vtBorn) img.__vtBorn = now;
      const fps = GIF_FPS[m[1]] || 4;
      const f = Math.floor(((now - img.__vtBorn) / 1000) * fps) % n;
      const left = (f / n) * 100;
      const right = ((n - 1 - f) / n) * 100;
      img.style.objectViewBox = `inset(0% ${right.toFixed(4)}% 0% ${left.toFixed(4)}%)`;
    }
  }

  window.__vt = {
    get now() { return now; },
    // Advance the clock by `ms` and run one animation frame at the new time.
    async advance(ms) {
      runTimersUntil(now + ms);
      const cbs = [...rafs.values()];
      rafs = new Map();
      for (const cb of cbs) call(cb, [now]);
      syncAnimations();
      syncGifs();
      await syncVideos();
    },
    // Wait for a real rendering opportunity (scroll events etc. get dispatched).
    realFrame,
    // Settle without moving the clock (after DOM changes from input events).
    async settle() {
      syncAnimations();
      syncGifs();
      await syncVideos();
    },
  };
})();
