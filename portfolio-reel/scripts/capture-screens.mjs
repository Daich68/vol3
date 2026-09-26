// Captures real screens of the built app (../../build) for use in the reel.
// The production API is swapped for demo data from mock-api.mjs.
//
//   yarn build && node portfolio-reel/scripts/capture-screens.mjs [name-filter…]
//
// Output: portfolio-reel/assets/screens/{d,m}-*.jpg (desktop 1800x1125,
// mobile 1170x2532) and d-layer-*.png (transparent layers of the hero page).
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { serve } from "./serve.mjs";
import { mockResponse, HERO_AUTHOR } from "./mock-api.mjs";
import { loadPlaywright } from "./playwright.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const buildDir = path.join(repo, "build");
const outDir = path.join(repo, "portfolio-reel/assets/screens");
const only = process.argv.slice(2);

if (!fs.existsSync(path.join(buildDir, "index.html"))) {
  console.error("build/ not found — run `yarn build` first");
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const { chromium } = await loadPlaywright();
const { server, url: base } = await serve(buildDir, { spa: true });
const browser = await chromium.launch();

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function newPage(kind) {
  const context = await browser.newContext(
    kind === "d"
      ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.25 }
      : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
  );
  await context.route(/web-almanac\.com/, (route) => {
    const body = mockResponse(route.request().url());
    if (body === null) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(body),
    });
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.warn(`[${kind}] pageerror:`, e.message));
  return page;
}

async function shot(page, name) {
  if (only.length && !only.some((o) => name.includes(o))) return;
  await page.evaluate(() => document.fonts.ready);
  const file = path.join(outDir, `${name}.jpg`);
  await page.screenshot({ path: file, type: "jpeg", quality: 90 });
  console.log("  ✓", name);
}

// Client-side navigation keeps the preloader from replaying on every page.
async function go(page, route, settle = 2500) {
  await page.evaluate((r) => {
    window.history.pushState({}, "", r);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, route);
  await wait(settle);
}

// Scrolls the PageFrame's inner container (the app never scrolls the window)
// with real wheel input, so Lenis, ScrollTrigger snapping and reveals all run.
async function scrollFrame(page, fraction, settle = 1800) {
  const vp = page.viewportSize();
  await page.mouse.move(vp.width * 0.45, vp.height * 0.5);
  for (let i = 0; i < 5; i++) {
    const delta = await page.evaluate((f) => {
      const el = document.querySelector(".page-frame-content");
      return el ? (el.scrollHeight - el.clientHeight) * f - el.scrollTop : 0;
    }, fraction);
    if (Math.abs(delta) < 3) break;
    await page.mouse.wheel(0, delta);
    await wait(1400);
  }
  await wait(settle);
}

async function hover(page, selector) {
  const box = await page.locator(selector).first().boundingBox();
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
  await wait(900);
}

// Splits the hero page into its real layers (transparent PNGs) for the
// exploded "architecture" shot. Each pass hides everything but one layer.
const LAYER_BASE = `
  html, body, #root { background: transparent !important; }
  .liquid-bg-container { display: none !important; }
  .page-frame-layout { border-color: transparent !important; background: transparent !important;
    box-shadow: none !important; backdrop-filter: none !important; }
  .page-frame-inner-border { border-color: transparent !important; background: transparent !important; }
  .page-frame-sidebar { background: transparent !important; border-color: transparent !important; backdrop-filter: none !important; }
  .page-frame-sidebar > *, .page-frame-content, .interactive-object-container { opacity: 0 !important; }
`;
const LAYERS = {
  bg: { opaque: true, css: `.page-frame-layout { opacity: 0 !important; }` },
  frame: { css: LAYER_BASE + `
    .page-frame-layout { border-color: #777 !important; background: rgba(220,220,220,0.4) !important;
      box-shadow: 0 15px 50px rgba(0,0,0,0.15) !important; }
    .page-frame-inner-border { border-color: #777 !important; background: #fff !important; }` },
  content: { css: LAYER_BASE + `.page-frame-content { opacity: 1 !important; }` },
  sidebar: { css: LAYER_BASE + `
    .page-frame-sidebar { background: rgba(158,158,158,0.5) !important; border-left: 1px solid #777 !important; }
    .page-frame-sidebar > * { opacity: 1 !important; }` },
  objects: { css: LAYER_BASE + `.interactive-object-container { opacity: 1 !important; }` },
};

async function layers(page) {
  for (const [name, { css, opaque }] of Object.entries(LAYERS)) {
    const file = `d-layer-${name}`;
    if (only.length && !only.some((o) => file.includes(o))) continue;
    const tag = await page.addStyleTag({ content: css });
    await wait(400);
    await page.screenshot({ path: path.join(outDir, `${file}.png`), omitBackground: !opaque });
    await tag.evaluate((el) => el.remove());
    console.log("  ✓", file);
  }
  await wait(300);
}

async function run(kind) {
  console.log(kind === "d" ? "desktop 1440x900@1.25x" : "mobile 390x844@3x");
  const page = await newPage(kind);
  const p = (n) => `${kind}-${n}`;

  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await wait(kind === "d" ? 1700 : 2300);
  await shot(page, p("preloader"));
  await wait(kind === "d" ? 7000 : 6400);
  await shot(page, p("home-hero"));
  if (kind === "d") await layers(page);
  if (only.length && only.every((o) => o.startsWith("d-layer") || o === "d-home-hero")) {
    await page.context().close();
    return;
  }
  await scrollFrame(page, kind === "d" ? 0.5 : 0.42);
  await shot(page, p("home-features"));
  await scrollFrame(page, 1, 2500);
  if (kind === "d") await hover(page, '.branch[data-branch-id="notes"] .branch-content');
  await shot(page, p("home-nav"));
  await page.mouse.move(5, 5);

  await go(page, "/philosophy", 3200);
  await shot(page, p("philosophy"));
  await scrollFrame(page, 0.25);
  await shot(page, p("philosophy-concept"));
  await scrollFrame(page, 0.5, 2200);
  await shot(page, p("philosophy-principles"));
  await scrollFrame(page, 1, 2200);
  await shot(page, p("philosophy-final"));

  await go(page, "/login", 2200);
  await shot(page, p("login"));
  await page.locator(".login-input-premium").first().fill("tihiy.sad");
  await page.locator(".login-input-premium").nth(1).fill("vol3forest");
  await page.locator(".login-input-premium").nth(1).focus();
  await wait(600);
  await shot(page, p("login-filled"));

  await go(page, "/notes", 3000);
  await shot(page, p("notes"));
  await scrollFrame(page, 1, 2200);
  await shot(page, p("notes-list"));
  await page.locator(".notice-button").first().click();
  await wait(1500);
  await shot(page, p("notes-read"));

  await go(page, "/search", 3000);
  await shot(page, p("search"));
  await scrollFrame(page, 1, 2000);
  await shot(page, p("search-results"));

  await go(page, `/author/${HERO_AUTHOR._id}`, 3500);
  await shot(page, p("author"));
  await scrollFrame(page, 1, 2500);
  if (kind === "d") await hover(page, ".post-card .gif-container");
  await shot(page, p("author-posts"));
  await page.mouse.move(5, 5);
  await scrollFrame(page, 0, 1500);
  await page.locator(".author-nav-item").first().click();
  await wait(1800);
  await shot(page, p("author-dict"));

  await page.context().close();
}

try {
  await run("d");
  await run("m");
} finally {
  await browser.close();
  server.close();
}
