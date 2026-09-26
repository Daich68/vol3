// Films the real app (the production build in /build) frame by frame on a
// virtual clock (see timeshim.js), following scripted takes — scrolling,
// hovering, clicking, typing — exactly as a person would use the site.
//
//   yarn build && node portfolio-reel/scripts/record.mjs [take…] [--parallel=N]
//   … --dry            quick check of the screenplays (a small still every 12th frame)
//   … --frames=A-B     film only frames A…B-1 of a take
//
// Each take is written to portfolio-reel/.cache/takes/<name>/ as a 60 fps JPEG
// sequence plus track.json: per-frame cursor/touch position, clicks, taps and
// keystrokes, and the on-screen rects of elements the edit follows.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "./serve.mjs";
import { loadPlaywright } from "./playwright.mjs";
import { createApi, EPOCH, ME, usingRealData } from "./mock-api.mjs";
import { prepareMedia } from "./media.mjs";
import { TAKES } from "./takes.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const buildDir = path.join(repo, "build");
const takesDir = path.join(repo, "portfolio-reel/.cache/takes");
const ffmpeg = process.env.FFMPEG || "ffmpeg";
const FPS = 60; // takes are filmed at 60 fps; the edit re-times and blurs them
// --dry: run the takes on the same clock but keep only a small still every
// 12th frame (in .cache/dry/) — a quick check of a screenplay before filming.
const DRY = process.argv.includes("--dry");
const dryDir = path.join(repo, "portfolio-reel/.cache/dry");
// --frames=A-B: film only frames A…B-1 of a take (the clock still runs from
// the start), so a long take can be filmed by several processes at once.
const RANGE = (() => {
  const m = process.argv.find((a) => a.startsWith("--frames="))?.match(/^--frames=(\d+)-(\d*)$/);
  return m ? { a: +m[1], b: m[2] ? +m[2] : Infinity } : null;
})();
const STOP = Symbol("stop");

const DEVICES = {
  mobile: { viewport: { width: 432, height: 768 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

class Recorder {
  constructor({ name, page, cdp, device, dsf, subframes, trackSelectors, api }) {
    Object.assign(this, { name, page, cdp, device, subframes, trackSelectors, api });
    this.vp = DEVICES[device].viewport;
    this.dsf = dsf;
    this.dir = path.join(DRY ? dryDir : takesDir, name);
    if (!RANGE) fs.rmSync(this.dir, { recursive: true, force: true });
    fs.mkdirSync(this.dir, { recursive: true });
    this.frames = [];
    this.events = [];
    this.mouse = { x: DEVICES[device].viewport.width / 2, y: DEVICES[device].viewport.height * 0.62 };
    this.pressed = false;
    this.touch = null; // visual touch state for mobile: { x, y, kind }
    this.encoder = subframes > 1 && !DRY ? this.startEncoder() : null;
  }

  startEncoder() {
    const n = this.subframes;
    const blur = n > 1 ? `tmix=frames=${n},select='not(mod(n+1\\,${n}))',setpts=N/(${FPS}*TB)` : "null";
    const p = spawn(ffmpeg, [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "image2pipe", "-framerate", String(FPS * n), "-c:v", "mjpeg", "-i", "-",
      "-vf", blur, "-fps_mode", "passthrough", "-q:v", "2", "-start_number", "0",
      path.join(this.dir, "f%05d.jpg"),
    ], { stdio: ["pipe", "inherit", "inherit"] });
    const done = new Promise((res, rej) => p.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg ${c}`)))));
    return { stdin: p.stdin, done };
  }

  async settleNetwork() {
    if (this.api.pending > 0 || this.api.changed) {
      while (this.api.pending > 0) await wait(5);
      this.api.changed = false;
      await wait(60); // let React commit what the responses scheduled
    }
  }

  async advance(ms) {
    await this.settleNetwork();
    await this.page.evaluate((ms) => window.__vt.advance(ms), ms);
  }

  // Runs the clock without filming (e.g. to skip the preloader).
  async preroll(sec) {
    const steps = Math.round(sec * 60);
    for (let i = 0; i < steps; i++) await this.advance(1000 / 60);
  }

  // One output frame = `subframes` captures spread over one frame interval.
  async step() {
    const shots = [];
    if (RANGE && this.frames.length >= RANGE.b) throw STOP;
    const keep = (!DRY || this.frames.length % 12 === 0) && (!RANGE || this.frames.length >= RANGE.a);
    for (let s = 0; s < this.subframes; s++) {
      await this.advance(1000 / (FPS * this.subframes));
      await this.page.evaluate(() => window.__vt.idle());
      if (!keep || (DRY && s > 0)) continue;
      const shot = await this.cdp.send("Page.captureScreenshot", {
        format: "jpeg", quality: DRY ? 70 : 92, optimizeForSpeed: true,
        clip: { x: 0, y: 0, width: this.vp.width, height: this.vp.height, scale: DRY ? 0.5 : this.dsf },
      });
      shots.push(Buffer.from(shot.data, "base64"));
    }
    if (!shots.length) {
      // nothing filmed for this frame (a dry run, or before --frames)
    } else if (this.encoder) {
      for (const b of shots) {
        if (!this.encoder.stdin.write(b)) await new Promise((r) => this.encoder.stdin.once("drain", r));
      }
    } else {
      fs.writeFileSync(path.join(this.dir, `f${String(this.frames.length).padStart(5, "0")}.jpg`), shots[0]);
    }
    this.frames.push(await this.sample());
  }

  async sample() {
    const { x, y } = this.mouse;
    const info = await this.page.evaluate(({ sels, x, y }) => {
      const rects = {};
      for (const [k, sel] of Object.entries(sels)) {
        const el = window.__pick(sel);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.width || r.height) rects[k] = [r.left, r.top, r.width, r.height].map((v) => +v.toFixed(1));
      }
      const hit = document.elementFromPoint(x, y);
      const cursor = hit ? getComputedStyle(hit).cursor : "auto";
      return { rects, pointer: cursor === "pointer" ? "hand" : cursor === "text" ? "text" : "arrow" };
    }, { sels: this.trackSelectors, x, y });
    return { mouse: [+x.toFixed(1), +y.toFixed(1)], down: this.pressed, touch: this.touch, ...info };
  }

  event(type, extra = {}) {
    this.events.push({ frame: this.frames.length, type, x: this.mouse.x, y: this.mouse.y, ...extra });
  }

  async hold(sec) {
    const n = Math.round(sec * FPS);
    for (let i = 0; i < n; i++) await this.step();
  }

  async moveTo(x, y, sec = 0.6, ease = easeInOut) {
    const from = { ...this.mouse };
    const n = Math.max(1, Math.round(sec * FPS));
    // a slight arc, like a hand moving a mouse
    const bow = Math.min(60, Math.hypot(x - from.x, y - from.y) * 0.12);
    for (let i = 1; i <= n; i++) {
      const k = ease(i / n);
      const arc = Math.sin(Math.PI * k) * bow;
      this.mouse = { x: from.x + (x - from.x) * k, y: from.y + (y - from.y) * k - arc };
      await this.page.mouse.move(this.mouse.x, this.mouse.y);
      await this.step();
    }
  }

  async center(selector) {
    const r = await this.page.evaluate((sel) => {
      const el = window.__pick(sel);
      if (!el) return null;
      el.scrollIntoView({ block: "nearest" });
      const b = el.getBoundingClientRect();
      return [b.left + b.width / 2, b.top + b.height / 2];
    }, selector);
    if (!r) throw new Error(`${this.name}: no element ${selector}`);
    return { x: r[0], y: r[1] };
  }

  async moveOn(selector, sec = 0.6, dx = 0, dy = 0) {
    const c = await this.center(selector);
    await this.moveTo(c.x + dx, c.y + dy, sec);
  }

  async click() {
    this.pressed = true;
    this.event(this.device === "mobile" ? "tap" : "click");
    await this.page.mouse.down();
    await this.step();
    await this.page.mouse.up();
    this.pressed = false;
  }

  // Mobile: a finger lands on the element (the recording shows a touch dot).
  async tap(selector, { travel = 0.35, hold = 0.25 } = {}) {
    const c = await this.center(selector);
    if (process.env.REC_DEBUG) {
      const hit = await this.page.evaluate(([x, y]) => {
        const el = document.elementFromPoint(x, y);
        return el ? `${el.tagName.toLowerCase()}.${[...el.classList].join(".")}` : null;
      }, [c.x, c.y]);
      console.log(`[${this.name}] tap ${selector} @ ${c.x.toFixed(0)},${c.y.toFixed(0)} → ${hit}`);
    }
    this.touch = { x: c.x, y: c.y, kind: "hover" };
    this.mouse = { x: c.x, y: c.y };
    await this.page.mouse.move(c.x, c.y);
    await this.hold(travel);
    this.touch = { x: c.x, y: c.y, kind: "press" };
    await this.click();
    await this.hold(hold);
    this.touch = null;
  }

  async type(text, cps = 14) {
    const per = FPS / cps;
    let acc = 0;
    for (const ch of text) {
      await this.page.keyboard.type(ch);
      this.event("key", { ch });
      acc += per;
      while (acc >= 1) { await this.step(); acc -= 1; }
    }
  }

  // Wheel scroll spread over `sec` with an ease-in-out velocity profile.
  async wheel(dy, sec = 1, at = null) {
    if (at) { this.mouse = { ...at }; await this.page.mouse.move(at.x, at.y); }
    const n = Math.max(1, Math.round(sec * FPS));
    let sent = 0;
    this.event("scroll-start", { dy, frames: n });
    if (this.device === "mobile") this.touch = { x: this.mouse.x, y: this.mouse.y, kind: "swipe" };
    for (let i = 1; i <= n; i++) {
      const target = Math.round(dy * easeInOut(i / n));
      const d = target - sent;
      sent = target;
      if (d) await this.page.mouse.wheel(0, d);
      if (this.touch && this.touch.kind === "swipe") this.touch = { ...this.touch, y: this.mouse.y - 140 * easeInOut(i / n) };
      await this.step();
    }
    this.touch = null;
    this.event("scroll-end");
  }

  // One wheel notch, like a mouse wheel click (the landing page snaps on it).
  async notch(dy) {
    this.event("notch", { dy });
    await this.page.mouse.wheel(0, dy);
    await this.step();
  }

  // Scroll a native scroller (modal lists, the reading overlay) precisely.
  // `dy` may be "end" to scroll to the bottom.
  async scrollEl(selector, dy, sec = 0.8) {
    const { start, max } = await this.page.evaluate((sel) => {
      const el = window.__pick(sel);
      return el ? { start: el.scrollTop, max: el.scrollHeight - el.clientHeight } : { start: 0, max: 0 };
    }, selector);
    if (dy === "end") dy = max - start;
    const n = Math.max(1, Math.round(sec * FPS));
    this.event("scroll-start", { dy, frames: n });
    const fingerY = this.mouse.y;
    if (this.device === "mobile") this.touch = { x: this.mouse.x, y: fingerY, kind: "swipe" };
    for (let i = 1; i <= n; i++) {
      const k = easeInOut(i / n);
      await this.page.evaluate(([sel, y]) => {
        const el = window.__pick(sel);
        if (el) el.scrollTop = y;
      }, [selector, start + dy * k]);
      if (this.touch) this.touch = { ...this.touch, y: fingerY - 160 * k };
      await this.step();
    }
    this.touch = null;
    this.event("scroll-end");
  }

  async finish() {
    if (this.encoder) {
      this.encoder.stdin.end();
      await this.encoder.done;
    }
    if (RANGE) { // a partial take: the full run (or --dry) writes the track
      console.log(`  ✓ ${this.name}: frames ${RANGE.a}–${this.frames.length - 1}`);
      return;
    }
    fs.writeFileSync(path.join(this.dir, "track.json"), JSON.stringify({
      name: this.name, fps: FPS, device: this.device, viewport: this.vp, scale: this.dsf,
      frames: this.frames.length, realData: usingRealData(), events: this.events, track: this.frames,
    }));
    console.log(`  ✓ ${this.name}: ${this.frames.length} frames (${(this.frames.length / FPS).toFixed(1)}s)`);
  }
}

async function recordTake(browser, base, media, name) {
  const spec = TAKES[name];
  const data = createApi();
  const device = { ...DEVICES[spec.device], ...(spec.scale ? { deviceScaleFactor: spec.scale } : {}) };
  const context = await browser.newContext(device);
  const gifFps = Object.fromEntries(Object.entries(media.gifs).map(([k, v]) => [k, v.fps]));
  await context.addInitScript((cfg) => { window.__VT_CONFIG__ = cfg; }, { epoch: EPOCH, gifFps });
  await context.addInitScript({ path: path.join(here, "timeshim.js") });
  // Closed modals stay in the DOM with the same class names, so selectors
  // resolve to the first element that is actually on screen.
  await context.addInitScript(() => {
    window.__pick = (sel) => {
      const all = [...document.querySelectorAll(sel)];
      const shown = (el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return false;
        for (let e = el; e; e = e.parentElement) {
          const cs = getComputedStyle(e);
          if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) return false;
        }
        return true;
      };
      return all.find(shown) || all[0] || null;
    };
  });
  if (spec.loggedIn) {
    await context.addInitScript((id) => {
      localStorage.setItem("ID", id);
      localStorage.setItem("accessToken", "demo");
    }, ME._id);
  }

  const api = { pending: 0, changed: false };
  await context.route(/web-almanac\.com/, async (route) => {
    api.pending++;
    try {
      const req = route.request();
      const res = data.handle(req.method(), req.url(), req.postData());
      if (req.method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: cors() });
      } else if (!res) {
        await route.fulfill({ status: 404, headers: cors(), body: "" });
      } else {
        await route.fulfill({ status: res.status, contentType: "application/json", headers: cors(), body: JSON.stringify(res.body) });
      }
    } finally {
      api.pending--;
      api.changed = true;
    }
  });
  // H.264 → VP9, GIF → sprite strips.
  await context.route(/\.(mp4|gif)(\?|$)/, async (route) => {
    const url = decodeURIComponent(new URL(route.request().url()).pathname);
    const base = path.basename(url);
    if (base.endsWith(".mp4") && media.videos[base]) {
      return route.fulfill({ status: 200, contentType: "video/webm", body: fs.readFileSync(media.videos[base]) });
    }
    const gif = base.match(/^([a-z0-9-]+)\.(?:[0-9a-f]+\.)?gif$/i);
    if (gif && media.gifs[gif[1]]) {
      return route.fulfill({ status: 200, contentType: "image/png", body: fs.readFileSync(media.gifs[gif[1]].file) });
    }
    return route.continue();
  });

  const page = await context.newPage();
  page.on("pageerror", (e) => console.warn(`[${name}] pageerror:`, e.message));
  const cdp = await context.newCDPSession(page);
  const rec = new Recorder({
    name, page, cdp, device: spec.device, dsf: device.deviceScaleFactor, subframes: spec.subframes ?? 1,
    trackSelectors: spec.track || {}, api,
  });
  rec.goto = async (route, { preroll = 0 } = {}) => {
    await page.goto(base + route, { waitUntil: "load" });
    if (spec.css) await page.addStyleTag({ content: spec.css });
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(rec.mouse.x, rec.mouse.y);
    if (preroll) await rec.preroll(preroll);
  };
  const t0 = Date.now();
  try {
    await spec.run(rec);
  } catch (e) {
    if (e !== STOP) throw e;
  }
  await rec.finish();
  console.log(`    ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  await context.close();
}

function cors() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS,DELETE",
  };
}

// ---------------------------------------------------------------------------
if (!fs.existsSync(path.join(buildDir, "index.html"))) {
  console.error("build/ not found — run `yarn build` first");
  process.exit(1);
}
const wanted = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const names = wanted.length ? wanted : Object.keys(TAKES);
const parallel = Math.max(1, +(process.argv.find((a) => a.startsWith("--parallel="))?.split("=")[1] || 3));

const media = prepareMedia();
const { chromium } = await loadPlaywright();
const { server, url: base } = await serve(buildDir, { spa: true });
// One browser per worker: contexts of a single browser share its GPU process,
// which serialises the screenshots. The compositor flags make every frame
// wait for its raster and image decodes: without them a screenshot can catch
// a layer (a tooltip, the scrollbar, a button) before it is drawn.
const launch = () => chromium.launch({
  args: [
    "--disable-smooth-scrolling", "--force-color-profile=srgb", "--hide-scrollbars", "--disable-lcd-text",
    "--font-render-hinting=none", "--autoplay-policy=no-user-gesture-required",
    "--run-all-compositor-stages-before-draw", "--disable-checker-imaging",
  ],
});
console.log(`recording ${names.join(", ")}${usingRealData() ? " (real API data)" : " (demo data)"}`);
try {
  const queue = [...names];
  await Promise.all(Array.from({ length: Math.min(parallel, queue.length) }, async () => {
    const browser = await launch();
    try {
      while (queue.length) await recordTake(browser, base, media, queue.shift());
    } finally {
      await browser.close();
    }
  }));
} finally {
  server.close();
}
