// Media the recorder swaps in while filming the app:
//  - public/*.mp4 → all-intra VP9 WebM (Playwright's Chromium has no H.264, and
//    every frame being a keyframe makes per-frame seeking exact and fast);
//  - src/static/icons/*.gif → horizontal sprite strips + their frame rates, so
//    the time shim can step GIF frames on the virtual clock.
// Everything lands in portfolio-reel/.cache/media (not committed).
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const repo = path.resolve(here, "../..");
export const cacheDir = path.join(repo, "portfolio-reel/.cache/media");
const ffmpeg = process.env.FFMPEG || "ffmpeg";
const run = (args) => execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args]);

export function prepareMedia() {
  fs.mkdirSync(cacheDir, { recursive: true });
  const manifest = { videos: {}, gifs: {} };

  for (const file of fs.readdirSync(path.join(repo, "public")).filter((f) => f.endsWith(".mp4"))) {
    const out = path.join(cacheDir, `${path.basename(file, ".mp4")}.webm`);
    if (!fs.existsSync(out)) {
      run(["-i", path.join(repo, "public", file), "-an", "-c:v", "libvpx-vp9", "-g", "1", "-crf", "32", "-b:v", "0",
        "-deadline", "good", "-cpu-used", "5", "-row-mt", "1", "-vf", "scale=960:-2", out]);
    }
    manifest.videos[file] = out;
  }

  const icons = path.join(repo, "src/static/icons");
  for (const file of fs.readdirSync(icons).filter((f) => f.endsWith(".gif"))) {
    const name = path.basename(file, ".gif");
    const out = path.join(cacheDir, `${name}.png`);
    const probe = spawnSync(ffmpeg, ["-hide_banner", "-i", path.join(icons, file), "-f", "null", "-"], { encoding: "utf8" }).stderr;
    const dur = parseFloat((probe.match(/Duration: (\d+):(\d+):([\d.]+)/) || []).slice(1).reduce((s, v, i) => s + v * [3600, 60, 1][i], 0)) || 1;
    const tmp = fs.mkdtempSync(path.join(cacheDir, ".gif-"));
    run(["-i", path.join(icons, file), "-fps_mode", "passthrough", "-vf", "scale=512:512", path.join(tmp, "f%03d.png")]);
    const frames = fs.readdirSync(tmp).length;
    if (!fs.existsSync(out)) {
      run(["-framerate", "1", "-i", path.join(tmp, "f%03d.png"), "-vf", `tile=${frames}x1`, "-frames:v", "1", out]);
    }
    fs.rmSync(tmp, { recursive: true });
    manifest.gifs[name] = { file: out, frames, fps: +(frames / dur).toFixed(3) };
  }
  return manifest;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  console.log(JSON.stringify(prepareMedia(), null, 2));
}
