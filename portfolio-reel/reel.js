/* VOL-3 / WEB-ALMANAC — portfolio reel.
 *
 * The picture is the real app: record.mjs films it frame by frame (see
 * takes.mjs) into .cache/takes/<take>/. This file is the edit — which part of
 * which take is on screen when and at what speed, where the "camera" looks
 * inside it, the transitions, and the cursor / finger drawn from each take's
 * track. Everything is a pure function of time, so scripts/render.mjs can
 * render it frame by frame.
 */
/* global gsap */
(() => {
  "use strict";

  const FPS = 30;
  const PARAMS = new URLSearchParams(location.search);
  const RENDER = PARAMS.has("render");
  if (RENDER) document.body.classList.add("render");

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = (k) => k * k * (3 - 2 * k);

  const tl = gsap.timeline({ paused: true, defaults: { ease: "power3.inOut", duration: 1 } });
  const drivers = [];
  const cues = [];
  const blurBoost = [];
  const cue = (t, sfx, gain = 1, extra = {}) => cues.push({ t: +t.toFixed(4), sfx, gain, ...extra });
  const boost = (a, b) => blurBoost.push([+a.toFixed(3), +b.toFixed(3)]);

  // ---------------------------------------------------------------------------
  // Takes and clips

  const TAKE_NAMES = ["m-home", "d-home", "d-notes", "m-dict"];
  const TAKES = {};
  const shots = $("#shots");
  const pointerTpl = $("#pointer");
  const touchTpl = $("#touch");
  const clips = [];

  // Reel time → take time through [reel, take] points. Monotone cubic, so
  // speed changes between points ramp smoothly instead of jumping.
  function timeMap(points) {
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const n = xs.length;
    if (n === 1) return () => ys[0];
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

  // A clip shows `take` from reel time `from` to `to`, timed by `points`
  // ([[reel, take], …]). `cam` is where the camera starts: centre (cx, cy) and
  // visible height h, in the take's CSS pixels (animate with camTo). `view`
  // moves the whole shot on the stage; `mask` is a circular reveal.
  function clip(take, from, to, points, cam, opts = {}) {
    const meta = TAKES[take];
    const el = document.createElement("div");
    el.className = `shot ${meta.device}`;
    el.innerHTML = '<img alt="">';
    const ptr = pointerTpl.cloneNode(true);
    ptr.removeAttribute("id");
    ptr.className = "ptr";
    const tch = touchTpl.cloneNode(true);
    tch.removeAttribute("id");
    tch.className = "tch";
    el.append(ptr, tch);
    shots.append(el);
    const c = {
      take, meta, from, to, map: timeMap(points), cam: { ...cam }, el, img: $("img", el), ptr, tch,
      frame: -1, follow: [], view: { x: 0, y: 0, s: 1, o: 1 }, mask: null, z: 0, hidePointer: false,
      taps: [], presses: [], punches: [], last: null, ...opts,
    };
    el.style.zIndex = String(c.z);
    clips.push(c);
    return c;
  }

  const camTo = (c, at, dur, to, ease = "power3.inOut") => tl.to(c.cam, { ...to, duration: dur, ease }, at);

  // A small push-in on a beat: in over 2 frames, settling back over 0.6 s.
  const punch = (c, at, amount = 0.035) => c.punches.push([at, amount]);
  const punchZoom = (c, t) => {
    let z = 1;
    for (const [t0, amount] of c.punches) {
      const d = t - t0;
      if (d < 0 || d >= 0.7) continue;
      const u = (d - 0.06) / 0.64;
      z += amount * (d < 0.06 ? smooth(d / 0.06) : Math.pow(2, -8 * u) * (1 - u));
    }
    return z;
  };

  // Keep a tracked element (e.g. the scroll indicator) in frame between
  // `from` and `to`, easing in and out of the follow over `ramp` seconds.
  function follow(c, from, to, rect, { axis = "y", amount = 1, offset = 0, window: win = 0.3, ramp = 0.4 } = {}) {
    c.follow.push({ from, to, rect, axis, amount, offset, win, ramp });
  }

  const takeTime = (c, t) => c.map(t);

  // The reel time at which a clip shows take time `te` (null if it doesn't).
  function reelTime(c, te) {
    let a = c.from, b = c.to;
    if (te < c.map(a) || te > c.map(b)) return null;
    for (let i = 0; i < 40; i++) {
      const m = (a + b) / 2;
      if (c.map(m) < te) a = m; else b = m;
    }
    return (a + b) / 2;
  }

  const frameOf = (meta, tt) => clamp(Math.round(tt * meta.fps), 0, meta.frames - 1);

  function sample(meta, tt) {
    const f = clamp(tt * meta.fps, 0, meta.frames - 1);
    const i = Math.floor(f);
    return { a: meta.track[i], b: meta.track[Math.min(meta.frames - 1, i + 1)], k: f - i };
  }

  function trackedCenter(meta, name, tt, axis, win) {
    // Average the element's centre over ±win seconds: a steady camera.
    let sum = 0, n = 0;
    for (let d = -win; d <= win + 1e-6; d += 1 / meta.fps) {
      const r = meta.track[frameOf(meta, tt + d)].rects[name];
      if (!r) continue;
      sum += axis === "y" ? r[1] + r[3] / 2 : r[0] + r[2] / 2;
      n++;
    }
    return n ? sum / n : null;
  }

  // Centre of a tracked element on the stage, as last drawn.
  function onStage(c, name) {
    if (!c.last) return null;
    const r = c.meta.track[frameOf(c.meta, c.last.tt)].rects[name];
    if (!r) return null;
    return { x: c.last.tx + (r[0] + r[2] / 2) * c.last.k, y: c.last.ty + (r[1] + r[3] / 2) * c.last.k };
  }

  function applyClip(c, t) {
    const meta = c.meta;
    const tt = takeTime(c, t);
    const f = frameOf(meta, tt);
    let wait = null;
    if (f !== c.frame) {
      c.frame = f;
      c.img.src = `.cache/takes/${c.take}/f${String(f).padStart(5, "0")}.jpg`;
      wait = c.img.decode().catch(() => {});
    }

    // The shot on the stage
    const v = c.view;
    c.el.style.transform = v.x || v.y || v.s !== 1 ? `translate(${v.x.toFixed(1)}px, ${v.y.toFixed(1)}px) scale(${v.s.toFixed(4)})` : "";
    c.el.style.opacity = v.o < 1 ? v.o.toFixed(3) : "";
    c.el.style.clipPath = c.mask && c.mask.r < 2250 ? `circle(${c.mask.r.toFixed(1)}px at ${c.mask.x.toFixed(1)}px ${c.mask.y.toFixed(1)}px)` : "";

    // Camera
    let { cx, cy, h } = c.cam;
    h /= punchZoom(c, t);
    for (const fo of c.follow) {
      if (t < fo.from - fo.ramp || t > fo.to + fo.ramp) continue;
      const w = fo.amount * smooth(clamp((t - (fo.from - fo.ramp)) / fo.ramp)) * smooth(clamp((fo.to + fo.ramp - t) / fo.ramp));
      const val = trackedCenter(meta, fo.rect, tt, fo.axis, fo.win);
      if (val == null) continue;
      if (fo.axis === "y") cy = lerp(cy, val + fo.offset, w); else cx = lerp(cx, val + fo.offset, w);
    }
    const dsf = meta.scale;
    const s = 1920 / (h * dsf);
    const k = dsf * s; // take CSS px → stage px
    const tx = 540 - cx * k;
    const ty = 960 - cy * k;
    c.img.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${s.toFixed(5)})`;
    c.last = { tt, tx, ty, k };

    // Cursor (desktop) or finger (mobile)
    const { a, b, k: fk } = sample(meta, tt);
    if (meta.device === "desktop") {
      c.tch.style.display = "none";
      if (c.hidePointer) {
        c.ptr.style.display = "none";
      } else {
        let x = lerp(a.mouse[0], b.mouse[0], fk);
        let y = lerp(a.mouse[1], b.mouse[1], fk);
        const cb = c.cursorFrom; // continue the previous shot's cursor
        if (cb && t < cb.t1) {
          const w = smooth(clamp((t - cb.t0) / (cb.t1 - cb.t0)));
          x = lerp(cb.x, x, w);
          y = lerp(cb.y, y, w);
        }
        const press = c.presses.some(([t0, t1]) => tt >= t0 && tt <= t1);
        c.ptr.style.display = "block";
        c.ptr.classList.toggle("hand", a.pointer === "hand");
        const size = (press ? 0.82 : 1) * k * 0.62;
        c.ptr.style.transform = `translate(${(tx + x * k).toFixed(1)}px, ${(ty + y * k).toFixed(1)}px) scale(${size.toFixed(3)})`;
      }
    } else {
      c.ptr.style.display = "none";
      const touch = a.touch || (fk > 0.5 ? b.touch : null);
      const ripple = c.taps.find((tp) => tt >= tp.t && tt < tp.t + 0.55);
      if ((touch || ripple) && !c.hidePointer) {
        const pt = touch || ripple;
        c.tch.style.display = "block";
        c.tch.style.transform = `translate(${(tx + pt.x * k).toFixed(1)}px, ${(ty + pt.y * k).toFixed(1)}px) scale(${(k * 0.4).toFixed(3)})`;
        const dot = c.tch.firstElementChild;
        const ring = c.tch.lastElementChild;
        dot.style.opacity = touch ? "1" : "0";
        dot.style.transform = touch && touch.kind === "press" ? "scale(0.8)" : "scale(1)";
        if (ripple) {
          const p = (tt - ripple.t) / 0.55;
          ring.style.opacity = String(0.55 * (1 - p));
          ring.style.transform = `scale(${lerp(0.7, 2.1, 1 - Math.pow(1 - p, 3))})`;
        } else {
          ring.style.opacity = "0";
        }
      } else {
        c.tch.style.display = "none";
      }
    }
    return wait;
  }

  // A circular reveal of `c` that opens from wherever `from()` points to —
  // tracked every frame (a pure function of time, so render workers agree).
  function iris(c, at, dur, from) {
    c.mask = { x: 540, y: 960, r: 0 };
    tl.fromTo(c.mask, { r: 0 }, { r: 2300, duration: dur, ease: "expo.inOut" }, at);
    drivers.push((t) => {
      if (t < at || t > at + dur) return;
      Object.assign(c.mask, from() || { x: 540, y: 960 });
      c.el.style.clipPath = `circle(${c.mask.r.toFixed(1)}px at ${c.mask.x.toFixed(1)}px ${c.mask.y.toFixed(1)}px)`;
    });
  }

  // ---------------------------------------------------------------------------
  // The edit. Music (vol3.wav) is 120 BPM: a bar every 2 s from 2.0 s.

  const END = { at: 0, mask: { x: 540, y: 960, r: 0 } };
  let DURATION = 40;

  function buildEdit() {
    // Desktop framings, in take CSS px (the desktop viewport is 1440×900).
    const SCROLLBAR = { cx: 1200, cy: 450, h: 820 }; // the branch scrollbar up close

    // 01 · Mobile — the real preloader, sped up to land on the first downbeat.
    clip("m-home", 0, 4.0, [[0, 0.25], [2.0, 4.12], [4.0, 6.0]], { cx: 216, cy: 384, h: 768 });

    // 02 · Desktop — a match cut on the title, then the custom scrollbar: a
    // branch that fills with light as the page turns, the node riding it.
    // (the desktop title framed to sit exactly where the phone's title was)
    const dh = clip("d-home", 4.0, 11.2, [
      [4.0, 0.45], [5.0, 1.62], [7.0, 4.03], [7.7, 4.75], [8.4, 6.0], [9.4, 7.0], [10.3, 8.6], [10.6, 8.95], [11.2, 10.6],
    ], { cx: 633.5, cy: 472, h: 1535 });
    camTo(dh, 4.0, 1.0, { cx: 934, cy: 450, h: 1800 }, "power3.out");
    punch(dh, 5.05, 0.03);
    punch(dh, 7.05, 0.025);
    camTo(dh, 5.7, 1.1, SCROLLBAR, "power3.inOut");
    boost(5.7, 6.5);
    camTo(dh, 7.5, 0.9, { cx: 700, cy: 450, h: 1800 }, "expo.inOut");
    boost(7.5, 8.3);
    camTo(dh, 9.2, 1.1, { cx: 440, cy: 420, h: 1100 }, "power3.inOut");
    camTo(dh, 10.45, 0.75, { cx: 720, cy: 450, h: 1800 }, "expo.inOut");
    boost(10.4, 11.2);

    // 03 · Notes — the list, a note, reading mode with the linear progress.
    const dn = clip("d-notes", 11.2, 18.5, [
      [11.2, 0.62], [12.3, 1.92], [13.2, 3.1], [14.0, 4.52], [14.6, 5.2], [15.0, 6.23], [17.8, 10.43], [18.4, 11.0],
    ], { cx: 720, cy: 450, h: 1800 }, { cursorFrom: { t0: 11.2, t1: 12.1, x: 375, y: 237 } });
    camTo(dn, 12.2, 1.4, { cx: 520, cy: 400, h: 1500 }, "power2.inOut");
    // Reading mode: the text column and the node in one frame while the text
    // runs; then the camera dives into the node, and the next shot opens
    // out of it.
    camTo(dn, 13.95, 0.9, { cx: 842, cy: 450, h: 1800 }, "expo.inOut"); // x 336–1348
    camTo(dn, 14.85, 2.2, { cy: 470 }, "sine.inOut");
    camTo(dn, 17.05, 0.75, { cx: 1300, cy: 690, h: 700 }, "power2.in");
    boost(17.2, 17.75);

    // 04 · The personal dictionary, on the phone — iris in from the node.
    // Every tap lands on a beat; typing and waiting run fast, the meaning
    // popping up runs in real time.
    const md = clip("m-dict", 17.7, 32.9, [
      [17.7, 0.3], [18.5, 1.35], [19.5, 2.97], [20.3, 4.6], [20.5, 5.48], [21.4, 7.35], [23.0, 11.0], [23.5, 12.02],
      [24.0, 14.13], [25.0, 15.75], [25.8, 17.5], [26.0, 18.2], [27.4, 19.6], [28.0, 20.47], [28.8, 22.33],
      [29.5, 23.43], [30.0, 24.18], [32.6, 26.6],
    ], { cx: 216, cy: 384, h: 768 }, { z: 2 });
    iris(md, 17.7, 0.8, () => onStage(dn, "readingIndicator"));
    boost(17.65, 18.55);
    // Close on the typing, pull back, close on the glyph and its meaning. At
    // h 600 the frame is 338 px of the phone wide: keep the left edge (where
    // the text starts) and never look past the bottom of the screen.
    const CLOSE = 600;
    camTo(md, 19.1, 0.6, { cx: 180, cy: 350, h: CLOSE });
    camTo(md, 19.7, 0.6, { cy: 362, h: CLOSE - 30 }, "sine.inOut");
    camTo(md, 20.25, 0.4, { cy: 468, h: CLOSE });
    camTo(md, 23.0, 0.5, { cx: 216, cy: 384, h: 768 });
    camTo(md, 24.6, 0.5, { cx: 180, cy: 400, h: CLOSE });
    camTo(md, 25.7, 0.45, { cx: 180, cy: 305, h: CLOSE });
    camTo(md, 27.5, 0.45, { cx: 216, cy: 384, h: 768 });
    camTo(md, 29.6, 0.6, { cx: 216, cy: 300, h: 520 }); // the reader's view: glyph → meaning
    for (const t of [18.5, 23.5, 28.0, 30.0]) punch(md, t + 0.03, 0.03);
    boost(20.25, 20.6); // the take runs at ~4× between the fields
    boost(23.45, 24.05); // …and while the modal closes

    // 05 · End card, opening from the glyph under the finger.
    buildEndCard(31.8, () => onStage(md, "postGlyph"));
    DURATION = 38;

    // Sound for the camera and the transitions (clicks, keys and wheel
    // notches come from the takes themselves).
    cue(1.42, "suck", 0.5); // into the preloader's burst on the downbeat
    cue(3.95, "whoosh-soft", 0.45);
    cue(5.65, "whoosh-soft", 0.3);
    cue(7.42, "whoosh-soft", 0.4);
    cue(10.38, "whoosh-soft", 0.3);
    cue(17.68, "whoosh", 0.5);
    cue(31.78, "whoosh", 0.5);
    cue(32.15, "impact-soft", 0.4);
  }

  // ---------------------------------------------------------------------------
  // End card: the logo and the two QR codes.

  function buildEndCard(at, from) {
    END.at = at;
    const end = $("#end");
    tl.set(end, { display: "block" }, at);
    tl.fromTo(END.mask, { r: 0 }, { r: 2300, duration: 0.8, ease: "expo.inOut" }, at);
    drivers.push((t) => {
      if (t < at || END.mask.r >= 2250) { end.style.clipPath = ""; return; }
      const o = from() || { x: 540, y: 960 };
      end.style.clipPath = `circle(${END.mask.r.toFixed(1)}px at ${o.x.toFixed(1)}px ${o.y.toFixed(1)}px)`;
    });
    boost(at - 0.05, at + 0.85);
    tl.from(".end-logo", { y: 60, opacity: 0, duration: 1.1, ease: "expo.out" }, at + 0.35);
    tl.from("#end .qr", { y: 90, opacity: 0, duration: 1.0, stagger: 0.18, ease: "expo.out" }, at + 0.6);
  }

  // ---------------------------------------------------------------------------
  // API for the renderer + a preview player

  let frameRand = 1;
  Math.random = () => {
    frameRand = (frameRand * 16807) % 2147483647;
    return (frameRand - 1) / 2147483646;
  };

  async function seek(t, frame = Math.round(t * FPS)) {
    t = clamp(t, 0, DURATION);
    frameRand = (frame + 1) * 7919;
    tl.seek(t, true);
    const waits = [];
    for (const c of clips) {
      const on = t >= c.from && t < c.to;
      c.el.style.display = on ? "block" : "none";
      if (!on) continue;
      const w = applyClip(c, t);
      if (w) waits.push(w);
    }
    for (const d of drivers) d(t, frame);
    await Promise.all(waits);
  }

  const ready = (async () => {
    await document.fonts.ready;
    await document.fonts.load('40px "Entropia"').catch(() => {});
    for (const n of TAKE_NAMES) {
      const r = await fetch(`.cache/takes/${n}/track.json`);
      if (!r.ok) throw new Error(`take ${n} is not recorded — run scripts/record.mjs`);
      TAKES[n] = await r.json();
    }
    for (const box of $$(".qr-code")) {
      box.innerHTML = await (await fetch(box.dataset.src)).text();
    }
    buildEdit();
    // Taps, clicks and keystrokes in the takes become sound cues (sped-up
    // typing is thinned out so it stays a patter, not a buzz).
    let lastKey = -1;
    for (const c of clips) {
      const meta = c.meta;
      c.taps = meta.events.filter((e) => e.type === "tap").map((e) => ({ t: e.frame / meta.fps, x: e.x, y: e.y }));
      c.presses = meta.events.filter((e) => e.type === "click").map((e) => [e.frame / meta.fps - 0.03, e.frame / meta.fps + 0.14]);
      for (const e of meta.events) {
        const tr = reelTime(c, e.frame / meta.fps);
        if (tr == null || tr < c.from || tr >= c.to) continue;
        if (e.type === "tap" || e.type === "click") cue(tr, "click", 0.8);
        if (e.type === "key" && tr - lastKey >= 0.075) {
          lastKey = tr;
          const seed = cues.length % 17;
          cue(tr, "key", 0.6, { seed, pan: ((seed * 7) % 9 - 4) / 20 });
        }
        if (e.type === "notch") cue(tr, "tick", 0.8);
      }
    }
    cues.sort((a, b) => a.t - b.t);
    await seek(0, 0);
  })();

  window.__reel = {
    fps: FPS,
    get duration() { return DURATION; },
    width: 1080,
    height: 1920,
    ready,
    seek,
    cues,
    blurBoost,
    timeline: tl,
  };

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
      if (playing) {
        t0 = performance.now();
        start = (+scrub.value / 1000) * DURATION;
        if (start >= DURATION - 0.05) start = 0;
        requestAnimationFrame(loop);
      }
    };
    scrub.oninput = () => { playing = false; play.textContent = "play"; show((+scrub.value / 1000) * DURATION); };
    addEventListener("keydown", (e) => { if (e.code === "Space") { e.preventDefault(); play.onclick(); } });
    ready.then(() => show(parseFloat(PARAMS.get("t") || "0")));
  }
})();
