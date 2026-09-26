// Opens the reel in headless Chromium at 1080x1920 and exposes a
// frame-accurate capture helper shared by stills.mjs and render.mjs.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "./serve.mjs";
import { loadPlaywright } from "./playwright.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");

export async function openReel({ format = "png", quality = 92, query = "" } = {}) {
  const { chromium } = await loadPlaywright();
  const { server, url } = await serve(repo);
  const browser = await chromium.launch({
    args: ["--force-color-profile=srgb", "--hide-scrollbars", "--disable-lcd-text", "--font-render-hinting=none"],
  });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.error("[reel] pageerror:", e.message));
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.error("[reel]", m.text()); });
  await page.goto(`${url}/portfolio-reel/index.html?render${query ? `&${query}` : ""}`, { waitUntil: "load" });
  await page.evaluate(() => window.__reel.ready);
  const meta = await page.evaluate(() => ({
    fps: window.__reel.fps,
    duration: window.__reel.duration,
    cues: window.__reel.cues,
    blurBoost: window.__reel.blurBoost || [],
  }));
  const cdp = await page.context().newCDPSession(page);

  async function frameAt(t, frame) {
    await page.evaluate(async ([t, frame]) => {
      await window.__reel.seek(t, frame); // waits for footage frames to decode
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, [t, frame]);
    const shot = await cdp.send("Page.captureScreenshot", {
      format,
      ...(format === "jpeg" ? { quality } : {}),
      optimizeForSpeed: true,
      captureBeyondViewport: false,
    });
    return Buffer.from(shot.data, "base64");
  }

  async function close() {
    await browser.close();
    server.close();
  }

  return { ...meta, page, frameAt, close };
}
