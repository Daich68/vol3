// Pre-bakes animated media into sprite sheets so every frame of the reel is
// seekable and deterministic (GIFs and <video> run on their own clocks, and
// Playwright's Chromium can't decode H.264 at all).
//
//   node portfolio-reel/scripts/build-sprites.mjs
//
// Needs ffmpeg on PATH (or FFMPEG=/path/to/ffmpeg).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const out = path.join(repo, "portfolio-reel/assets/sprites");
const ffmpeg = process.env.FFMPEG || "ffmpeg";
fs.mkdirSync(out, { recursive: true });

const run = (args) => execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args]);

// Nav-card hover video: 4s at 12fps, 8x6 grid.
const treeVideo = path.join(repo, "public/grok-video-7223f3a3-740c-4475-94e7-61fb94c7e026.mp4");
run([
  "-i", treeVideo, "-t", "4",
  "-vf", "fps=12,scale=560:310:flags=lanczos,tile=8x6",
  "-frames:v", "1", "-q:v", "3",
  path.join(out, "tree-video.jpg"),
]);

// Dictionary GIF glyphs: one horizontal strip per GIF, 256px cells, alpha kept.
const icons = path.join(repo, "src/static/icons");
const manifest = {};
for (const file of fs.readdirSync(icons).filter((f) => f.endsWith(".gif")).sort()) {
  const name = path.basename(file, ".gif");
  const tmp = fs.mkdtempSync(path.join(out, ".tmp-"));
  run(["-i", path.join(icons, file), "-fps_mode", "passthrough", "-vf", "scale=256:256", path.join(tmp, "f%03d.png")]);
  const frames = fs.readdirSync(tmp).length;
  run([
    "-framerate", "1", "-i", path.join(tmp, "f%03d.png"),
    "-vf", `tile=${frames}x1`, "-frames:v", "1",
    path.join(out, `gif-${name}.png`),
  ]);
  fs.rmSync(tmp, { recursive: true });
  manifest[name] = { frames };
  console.log(`gif-${name}.png  ${frames} frames`);
}
fs.writeFileSync(path.join(out, "gifs.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log("tree-video.jpg");

// The corner branches (public/01.png) with their drop shadow baked in, one per
// orientation — a live CSS drop-shadow on a 2816px PNG is the most expensive
// thing on screen when rendering in software.
const branch = path.join(repo, "public/01.png");
for (const [name, flip] of [["branch-tl", "hflip,vflip,"], ["branch-bl", "hflip,"]]) {
  run([
    "-i", branch,
    "-filter_complex",
    `[0]${flip}scale=1400:-1,format=rgba,split[img][sh];` +
    `[sh]geq=r=0:g=0:b=0:a='alpha(X,Y)*0.34',boxblur=alpha_radius=26:alpha_power=2:luma_radius=0:chroma_radius=0[shb];` +
    `[shb]pad=iw+120:ih+120:78:78:color=black@0[shp];` +
    `[img]pad=iw+120:ih+120:40:40:color=black@0[imgp];` +
    `[shp][imgp]overlay=0:0:format=auto,format=rgba`,
    "-frames:v", "1", path.join(out, `${name}.png`),
  ]);
  console.log(`${name}.png`);
}
