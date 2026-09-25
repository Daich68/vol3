// Sound design for the reel: the app's own soundtrack (src/static/sound/vol3.wav)
// plus UI sound effects synthesized here and placed on the cues that reel.js
// declares next to its animations. Writes a 32-bit float stereo WAV.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const SR = 44100;

// ---------------------------------------------------------------------------
// WAV I/O

function readWav(file) {
  const buf = fs.readFileSync(file);
  let pos = 12, fmt = null, data = null;
  while (pos < buf.length - 8) {
    const id = buf.toString("ascii", pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === "fmt ") {
      fmt = { format: buf.readUInt16LE(pos + 8), channels: buf.readUInt16LE(pos + 10), rate: buf.readUInt32LE(pos + 12), bits: buf.readUInt16LE(pos + 22) };
    } else if (id === "data") {
      data = buf.subarray(pos + 8, pos + 8 + size);
    }
    pos += 8 + size + (size & 1);
  }
  if (!fmt || !data || fmt.format !== 1 || fmt.bits !== 16) throw new Error(`${file}: expected 16-bit PCM`);
  const n = data.length / 2 / fmt.channels;
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    L[i] = data.readInt16LE((i * fmt.channels) * 2) / 32768;
    R[i] = data.readInt16LE((i * fmt.channels + (fmt.channels > 1 ? 1 : 0)) * 2) / 32768;
  }
  if (fmt.rate !== SR) throw new Error(`${file}: expected ${SR} Hz`);
  return [L, R];
}

function writeWavFloat(file, L, R) {
  const n = L.length;
  const buf = Buffer.alloc(44 + n * 8);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 8, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(3, 20); // IEEE float
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 8, 28);
  buf.writeUInt16LE(8, 32);
  buf.writeUInt16LE(32, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 8, 40);
  for (let i = 0; i < n; i++) {
    buf.writeFloatLE(L[i], 44 + i * 8);
    buf.writeFloatLE(R[i], 48 + i * 8);
  }
  fs.writeFileSync(file, buf);
}

// ---------------------------------------------------------------------------
// DSP helpers

const mulberry32 = (a) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const TAU = Math.PI * 2;
const secs = (s) => Math.max(1, Math.round(s * SR));

// Chamberlin state-variable filter with a per-sample cutoff.
function svf(input, cutoff, q = 0.9, mode = "band") {
  const out = new Float32Array(input.length);
  let low = 0, band = 0;
  const damp = 1 / q;
  for (let i = 0; i < input.length; i++) {
    const fc = typeof cutoff === "function" ? cutoff(i / SR) : cutoff;
    const f = 2 * Math.sin(Math.PI * Math.min(fc, SR / 6) / SR);
    const high = input[i] - low - damp * band;
    band += f * high;
    low += f * band;
    out[i] = mode === "low" ? low : mode === "high" ? high : band;
  }
  return out;
}

function noise(n, seed) {
  const r = mulberry32(seed);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = r() * 2 - 1;
  return out;
}

// Pentatonic notes that sit inside vol3.wav's C major / A minor palette.
const HI = [659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98];
const MID = [392, 440, 523.25, 587.33, 659.25, 783.99];

// ---------------------------------------------------------------------------
// Sound effects — each returns a mono Float32Array (panning happens in the mix)

const SFX = {
  tick(o) {
    const n = secs(0.05), out = noise(n, 11 + (o.seed | 0));
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      out[i] = out[i] * Math.exp(-t / 0.0018) * 0.5 + Math.sin(TAU * 4200 * t) * Math.exp(-t / 0.012) * 0.6;
    }
    return out;
  },
  blip(o) {
    const f = HI[(o.pitch | 0) % HI.length];
    const n = secs(0.3), out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const a = Math.min(1, t / 0.002) * Math.exp(-t / 0.075);
      out[i] = a * (Math.sin(TAU * f * t + 0.8 * Math.sin(TAU * 2 * f * t) * Math.exp(-t / 0.04)) + 0.25 * Math.sin(TAU * 3 * f * t) * Math.exp(-t / 0.02));
    }
    return out;
  },
  pop(o) {
    const f0 = MID[(o.pitch | 0) % MID.length];
    const n = secs(0.2), out = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      ph += (TAU * f0 * (1 + 0.9 * Math.exp(-t / 0.012))) / SR;
      out[i] = Math.sin(ph) * Math.min(1, t / 0.001) * Math.exp(-t / 0.045);
    }
    return out;
  },
  whoosh(o) {
    const len = o.len || 0.62, n = secs(len);
    const peak = o.peak || 0.68;
    const lo = o.lo || 320, hi = o.hi || 3400;
    const src = noise(n, 21 + (o.seed | 0));
    const band = svf(src, (t) => {
      const k = t / len;
      const m = k < peak ? k / peak : 1 - (k - peak) / (1 - peak) * 0.8;
      return lo * Math.pow(hi / lo, Math.max(0, m));
    }, 1.1);
    const air = svf(src, 900, 0.7, "low");
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const k = i / n;
      const e = k < peak ? Math.pow(Math.sin((k / peak) * Math.PI / 2), 2.2) : Math.pow(1 - (k - peak) / (1 - peak), 1.8);
      out[i] = (band[i] * 1.4 + air[i] * 0.35) * e;
    }
    return out;
  },
  "whoosh-soft"(o) {
    return SFX.whoosh({ ...o, len: 0.5, lo: 220, hi: 1900 });
  },
  swipe(o) {
    return SFX.whoosh({ ...o, len: 0.3, lo: 900, hi: 5200, peak: 0.55 });
  },
  suck(o) {
    return SFX.whoosh({ ...o, len: 0.55, lo: 400, hi: 4200, peak: 0.93 });
  },
  riser(o) {
    const len = o.dur || 1.5, n = secs(len);
    const src = noise(n, 31);
    const hp = svf(src, (t) => 300 * Math.pow(20, t / len), 1.4, "band");
    const out = new Float32Array(n);
    let p1 = 0, p2 = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR, k = t / len;
      const f = 110 * Math.pow(4, k * k);
      p1 += (TAU * f) / SR;
      p2 += (TAU * f * 1.007) / SR;
      const saw = ((p1 / TAU) % 1) * 2 - 1 + (((p2 / TAU) % 1) * 2 - 1);
      const e = Math.pow(k, 2.2) * Math.min(1, (len - t) / 0.01);
      out[i] = (hp[i] * 0.9 + saw * 0.08) * e;
    }
    return out;
  },
  impact(o) {
    const soft = o.soft;
    const n = secs(soft ? 0.7 : 1.6), out = new Float32Array(n);
    const crack = svf(noise(n, 41), 3500, 0.7, "high");
    const body = svf(noise(n, 43), 1400, 0.7, "low");
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      ph += (TAU * (36 + 70 * Math.exp(-t / 0.07))) / SR;
      const sub = Math.sin(ph) * Math.exp(-t / (soft ? 0.28 : 0.62)) * (soft ? 0.7 : 1);
      const hit = body[i] * Math.exp(-t / 0.05) * 0.9 + (soft ? 0 : crack[i] * Math.exp(-t / 0.012) * 0.6);
      out[i] = Math.tanh((sub + hit) * 1.4) * Math.min(1, t / 0.0015);
    }
    return out;
  },
  "impact-soft"(o) {
    return SFX.impact({ ...o, soft: true });
  },
  thump() {
    const n = secs(0.45), out = new Float32Array(n);
    const click = noise(n, 51);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      ph += (TAU * (46 + 110 * Math.exp(-t / 0.028))) / SR;
      out[i] = Math.tanh(Math.sin(ph) * Math.exp(-t / 0.2) * 1.6) + click[i] * Math.exp(-t / 0.002) * 0.3;
    }
    return out;
  },
  glitch(o) {
    const r = mulberry32(61 + (o.seed | 0));
    const n = secs(0.18), out = new Float32Array(n);
    const seg = secs(0.022);
    for (let s = 0; s * seg < n; s++) {
      const kind = r();
      const f = 180 + r() * 2200;
      const on = r() > 0.2;
      for (let i = s * seg; i < Math.min(n, (s + 1) * seg); i++) {
        const t = i / SR;
        if (!on) continue;
        out[i] = kind < 0.5 ? Math.sign(Math.sin(TAU * f * t)) * 0.5 : Math.round((r() * 2 - 1) * 4) / 4 * 0.6;
      }
    }
    return out;
  },
  swarm(o) {
    const r = mulberry32(71 + (o.seed | 0));
    const len = 0.95, n = secs(len), out = new Float32Array(n);
    const bed = svf(noise(n, 73), 2400, 1.2);
    for (let i = 0; i < n; i++) out[i] = bed[i] * Math.sin(Math.PI * i / n) * 0.35;
    for (let k = 0; k < 110; k++) {
      const t0 = len * Math.pow(r(), 1.5);
      const f = 2200 + r() * 4200;
      const a = 0.25 + r() * 0.5;
      const i0 = Math.floor(t0 * SR);
      for (let i = 0; i < secs(0.012) && i0 + i < n; i++) {
        const t = i / SR;
        out[i0 + i] += Math.sin(TAU * f * t) * Math.exp(-t / 0.004) * a;
      }
    }
    return out;
  },
  hover() {
    const n = secs(0.4), out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const e = Math.min(1, t / 0.02) * Math.exp(-t / 0.13);
      out[i] = e * (Math.sin(TAU * 880 * t) * 0.6 + Math.sin(TAU * 1318.51 * t) * 0.4);
    }
    return out;
  },
  tap() {
    const n = secs(0.07), out = svf(noise(secs(0.07), 81), 2200, 0.8, "low");
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      out[i] = out[i] * Math.exp(-t / 0.004) * 1.5 + Math.sin(TAU * 950 * t) * Math.exp(-t / 0.018) * 0.5;
    }
    return out;
  },
  select() {
    const a = SFX.blip({ pitch: 5 }), b = SFX.blip({ pitch: 6 });
    const off = secs(0.07), out = new Float32Array(b.length + off);
    a.forEach((v, i) => { out[i] += v * 0.8; });
    b.forEach((v, i) => { out[i + off] += v; });
    return out;
  },
  scribble() {
    const r = mulberry32(91);
    const len = 0.95, n = secs(len);
    const src = svf(noise(n, 93), 3800, 2.2);
    const bumps = Array.from({ length: 7 }, () => [r() * len, 0.04 + r() * 0.1]);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let a = 0;
      for (const [c, w] of bumps) a += Math.exp(-(((t - c) / w) ** 2));
      out[i] = src[i] * Math.min(1.2, a) * (1 + 0.5 * Math.sin(TAU * 31 * t));
    }
    return out;
  },
  decode() {
    const r = mulberry32(101);
    const n = secs(0.66), out = new Float32Array(n);
    const seg = secs(0.022);
    for (let s = 0; s * seg < n; s++) {
      const f = HI[Math.floor(r() * HI.length)] * (r() < 0.5 ? 1 : 2);
      for (let i = s * seg; i < Math.min(n, (s + 1) * seg); i++) {
        const t = (i - s * seg) / SR;
        out[i] = (Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * 3 * f * t)) * Math.exp(-t / 0.012) * 0.6;
      }
    }
    return out;
  },
};

// Relative levels so a cue's `gain` of 1 means "sits right in the mix".
const LEVEL = {
  tick: 0.22, blip: 0.3, pop: 0.35, whoosh: 0.55, "whoosh-soft": 0.42, swipe: 0.35, suck: 0.5,
  riser: 0.5, impact: 0.95, "impact-soft": 0.6, thump: 0.65, glitch: 0.2, swarm: 0.42, hover: 0.22,
  click: 0.9, tap: 0.4, select: 0.3, scribble: 0.28, decode: 0.18,
};
const PAN = { whoosh: 0.25, "whoosh-soft": -0.2, swipe: 0.3, suck: -0.25, glitch: 0.15, blip: 0.1, pop: -0.1, tick: 0.1 };

export function buildAudio({ cues, duration, out, musicOffset = 0.05, musicGain = 0.45 }) {
  const n = Math.ceil(duration * SR);
  const L = new Float32Array(n), R = new Float32Array(n);

  // Music: vol3.wav's first downbeat (1.95s) lands on the reel's drop (2.0s).
  const [mL, mR] = readWav(path.join(repo, "src/static/sound/vol3.wav"));
  const fadeFrom = duration - 2.2;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const j = Math.round((t - musicOffset) * SR);
    if (j < 0 || j >= mL.length) continue;
    let g = musicGain;
    if (t > fadeFrom) g *= Math.pow(Math.max(0, 1 - (t - fadeFrom) / (duration - fadeFrom)), 2);
    L[i] += mL[j] * g;
    R[i] += mR[j] * g;
  }

  // The app's real button sound for clicks.
  const [bL] = readWav(path.join(repo, "src/static/sound/button.wav"));
  const cache = new Map();
  for (const c of cues) {
    const key = JSON.stringify({ ...c, t: 0, gain: 0 });
    let s = cache.get(key);
    if (!s) {
      s = c.sfx === "click" ? bL : SFX[c.sfx] ? SFX[c.sfx](c) : null;
      if (!s) { console.warn(`audio: unknown sfx "${c.sfx}"`); continue; }
      cache.set(key, s);
    }
    const g = (LEVEL[c.sfx] ?? 0.4) * (c.gain ?? 1);
    const pan = c.pan ?? PAN[c.sfx] ?? 0;
    const gl = g * Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2;
    const gr = g * Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2;
    const i0 = Math.round(c.t * SR);
    for (let i = 0; i < s.length && i0 + i < n; i++) {
      if (i0 + i < 0) continue;
      L[i0 + i] += s[i] * gl;
      R[i0 + i] += s[i] * gr;
    }
  }

  // Gentle master: soft clip anything that would exceed full scale; the final
  // loudness normalisation happens in ffmpeg (loudnorm, two-pass).
  for (let i = 0; i < n; i++) {
    L[i] = Math.tanh(L[i] * 0.9) / 0.9;
    R[i] = Math.tanh(R[i] * 0.9) / 0.9;
  }
  // 10 ms fade-in / fade-out to avoid clicks at the edges.
  const edge = secs(0.01);
  for (let i = 0; i < edge; i++) {
    const k = i / edge;
    L[i] *= k; R[i] *= k;
    L[n - 1 - i] *= k; R[n - 1 - i] *= k;
  }
  writeWavFloat(out, L, R);
  return out;
}

// Standalone: node audio.mjs cues.json out.wav [duration]
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cuesFile, out, dur] = process.argv.slice(2);
  const cues = JSON.parse(fs.readFileSync(cuesFile, "utf8"));
  buildAudio({ cues, duration: parseFloat(dur || "34"), out });
  console.log(out);
}
