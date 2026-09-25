// Renders the reel to an Instagram-ready MP4: 1080x1920, H.264, 30 fps, AAC.
//
//   node portfolio-reel/scripts/render.mjs [options]
//
//   --out <file>        default portfolio-reel/out/vol3-reel.mp4
//   --fps <n>           default 30
//   --samples <n>       motion-blur subframes per frame (default 6, 1 = off)
//   --boost <n>         subframes during the reel's fast moments (default 14)
//   --shutter <deg>     shutter angle for motion blur (default 180)
//   --workers <n>       parallel browsers (default: CPU count - 1, max 4)
//   --from/--to <sec>   render a slice (handy while iterating)
//   --crf <n>           x264 quality (default 16)
//   --credit "<text>"   end-card credit line
//   --grain <n>         film grain strength (default 5, 0 = off)
//   --no-audio          skip the soundtrack
//
// Needs ffmpeg with libx264 on PATH (or FFMPEG=/path/to/ffmpeg).
import { spawn, spawnSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openReel } from "./reel-page.mjs";
import { buildAudio } from "./audio.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const ffmpeg = process.env.FFMPEG || "ffmpeg";

const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
};
const flag = (name) => argv.includes(`--${name}`);

const out = path.resolve(opt("out", path.join(root, "out/vol3-reel.mp4")));
const fps = +opt("fps", 30);
const samples = Math.max(1, +opt("samples", 6));
const boost = Math.max(samples, +opt("boost", 14));
const shutter = +opt("shutter", 180);
const workers = Math.max(1, +opt("workers", Math.min(4, Math.max(1, os.cpus().length - 1))));
const crf = opt("crf", "18");
const credit = opt("credit", null);
const grain = +opt("grain", 4); // temporal film grain strength, 0 = off
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vol3-reel-"));
fs.mkdirSync(path.dirname(out), { recursive: true });

const query = credit ? `credit=${encodeURIComponent(credit)}` : "";
const probe = await openReel({ query });
const duration = probe.duration;
const cues = probe.cues;
const fast = probe.blurBoost;
await probe.close();

const from = +opt("from", 0);
const to = Math.min(duration, +opt("to", duration));
const first = Math.round(from * fps);
const last = Math.round(to * fps); // exclusive
const total = last - first;

// Subframe offsets (in frames) for a centred shutter.
const offsetsFor = (n) => Array.from({ length: n }, (_, j) => (n === 1 ? 0 : ((j + 0.5) / n - 0.5) * (shutter / 360)));
const isFast = (f) => samples > 1 && fast.some(([a, b]) => f / fps >= a && f / fps < b);

function encoder(file, n) {
  const blur = n > 1 ? `tmix=frames=${n},select='not(mod(n+1\\,${n}))',setpts=N/(${fps}*TB),` : "";
  const args = [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "image2pipe", "-framerate", String(fps * n), "-c:v", "mjpeg", "-i", "-",
    "-vf", `${blur}scale=in_color_matrix=bt601:in_range=pc:out_color_matrix=bt709:out_range=tv,format=yuv420p${grain > 0 ? `,noise=c0s=${grain}:c0f=t+u` : ""}`,
    "-r", String(fps),
    "-c:v", "libx264", "-preset", "slow", "-crf", crf, "-maxrate", "14M", "-bufsize", "28M",
    "-profile:v", "high", "-level", "4.2",
    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
    "-g", String(fps * 2), "-bf", "2",
    file,
  ];
  const p = spawn(ffmpeg, args, { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((res, rej) => p.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)))));
  return { stdin: p.stdin, done };
}

const write = (stream, buf) => new Promise((res) => (stream.write(buf) ? res() : stream.once("drain", res)));

// Chunks of up to 45 frames that share one subframe count, rendered by a pool
// of browsers and concatenated in order.
const chunks = [];
for (let f = first; f < last; ) {
  const n = isFast(f) ? boost : samples;
  let g = f + 1;
  while (g < last && g - f < 45 && (isFast(g) ? boost : samples) === n) g++;
  chunks.push({ a: f, b: g, n, file: path.join(tmp, `chunk-${String(chunks.length).padStart(3, "0")}.mp4`) });
  f = g;
}
const captures = chunks.reduce((s, c) => s + (c.b - c.a) * c.n, 0);
console.log(`rendering ${total} frames (${from}s → ${to}s) · ${captures} captures · ${samples}/${boost} subframes · ${workers} workers`);

let doneCaptures = 0;
let shown = -1;
const t0 = Date.now();
function progress(n) {
  doneCaptures += n;
  const pct = Math.floor((doneCaptures / captures) * 100);
  if (pct === shown) return;
  shown = pct;
  const el = (Date.now() - t0) / 1000;
  const eta = (el / doneCaptures) * (captures - doneCaptures);
  const line = `  ${pct}% · ${el.toFixed(0)}s elapsed · ~${eta.toFixed(0)}s left`;
  if (process.stdout.isTTY) process.stdout.write(`\r${line}   `);
  else if (pct % 10 === 0) console.log(line);
}

let next = 0;
async function worker() {
  const reel = await openReel({ query, format: "jpeg", quality: 95 });
  try {
    while (next < chunks.length) {
      const c = chunks[next++];
      const enc = encoder(c.file, c.n);
      const offs = offsetsFor(c.n);
      for (let f = c.a; f < c.b; f++) {
        for (const o of offs) {
          const t = Math.min(duration, Math.max(0, (f + o) / fps));
          await write(enc.stdin, await reel.frameAt(t, f));
        }
        progress(c.n);
      }
      enc.stdin.end();
      await enc.done;
    }
  } finally {
    await reel.close();
  }
}
await Promise.all(Array.from({ length: Math.min(workers, chunks.length) }, worker));
if (process.stdout.isTTY) process.stdout.write("\n");

const video = path.join(tmp, "video.mp4");
fs.writeFileSync(path.join(tmp, "parts.txt"), chunks.map((c) => `file '${c.file}'`).join("\n"));
execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", path.join(tmp, "parts.txt"), "-c", "copy", video]);

if (flag("no-audio")) {
  fs.copyFileSync(video, out);
} else {
  const wav = path.join(tmp, "mix.wav");
  const sliceCues = cues.map((c) => ({ ...c, t: c.t - from })).filter((c) => c.t > -2 && c.t < to - from);
  buildAudio({ cues: sliceCues, duration: to - from, out: wav, musicOffset: 0.05 - from });
  // Two-pass loudness normalisation to the Reels target (-14 LUFS).
  const m = measureLoudness(wav);
  const ln = `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  execFileSync(ffmpeg, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", video, "-i", wav,
    "-map", "0:v", "-map", "1:a",
    "-af", `${ln},aresample=48000`,
    "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-ar", "48000",
    "-shortest", "-movflags", "+faststart",
    out,
  ]);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`✓ ${out}`);

function measureLoudness(wav) {
  const res = spawnSync(ffmpeg, ["-hide_banner", "-nostats", "-i", wav, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], { encoding: "utf8" });
  const err = res.stderr || "";
  return JSON.parse(err.slice(err.lastIndexOf("{"), err.lastIndexOf("}") + 1));
}
