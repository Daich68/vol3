// Renders individual frames of the reel to PNG for quick review.
//
//   node portfolio-reel/scripts/stills.mjs [--out dir] [--sheet] 0.5 2.2 3.1 ...
//
// With --sheet the frames are also tiled into one contact sheet (needs ffmpeg).
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { openReel } from "./reel-page.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
let out = path.resolve(here, "../out/stills");
let sheet = false;
const times = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--out") out = path.resolve(args[++i]);
  else if (args[i] === "--sheet") sheet = true;
  else times.push(parseFloat(args[i]));
}
fs.mkdirSync(out, { recursive: true });

const reel = await openReel();
const files = [];
try {
  for (const t of times) {
    const file = path.join(out, `t${t.toFixed(2).padStart(6, "0")}.png`);
    const png = await reel.frameAt(t, Math.round(t * reel.fps));
    fs.writeFileSync(file, png);
    files.push(file);
    console.log(file);
  }
} finally {
  await reel.close();
}

if (sheet && files.length) {
  const cols = Math.min(files.length, 6);
  const rows = Math.ceil(files.length / cols);
  const ffmpeg = process.env.FFMPEG || "ffmpeg";
  const inputs = files.flatMap((f) => ["-i", f]);
  const scaled = files.map((_, i) => `[${i}:v]scale=270:480,drawtext=text='${times[i].toFixed(2)}':x=8:y=8:fontsize=22:fontcolor=red:box=1:boxcolor=white@0.7[v${i}]`);
  const pads = [];
  for (let i = files.length; i < rows * cols; i++) pads.push(`color=c=gray:s=270x480:d=1[v${i}]`);
  const layout = Array.from({ length: rows * cols }, (_, i) => `${(i % cols) * 270}_${Math.floor(i / cols) * 480}`).join("|");
  const graph = [...scaled, ...pads, `${Array.from({ length: rows * cols }, (_, i) => `[v${i}]`).join("")}xstack=inputs=${rows * cols}:layout=${layout}[out]`].join(";");
  const sheetFile = path.join(out, "sheet.jpg");
  try {
    execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...inputs, "-filter_complex", graph, "-map", "[out]", "-frames:v", "1", "-q:v", "3", sheetFile], { stdio: "ignore" });
  } catch {
    // drawtext needs a font; fall back to an unlabeled sheet
    const plain = [...files.map((_, i) => `[${i}:v]scale=270:480[v${i}]`), ...pads, `${Array.from({ length: rows * cols }, (_, i) => `[v${i}]`).join("")}xstack=inputs=${rows * cols}:layout=${layout}[out]`].join(";");
    execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...inputs, "-filter_complex", plain, "-map", "[out]", "-frames:v", "1", "-q:v", "3", sheetFile]);
  }
  console.log(sheetFile);
}
