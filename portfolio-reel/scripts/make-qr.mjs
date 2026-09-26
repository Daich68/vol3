// Generates the end-card QR codes as SVG (black on white, high error correction
// so they survive Instagram's compression).
//
//   node portfolio-reel/scripts/make-qr.mjs
//
// Uses the `qrcode` package through npx, so nothing is added to the project.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "../assets/qr");
fs.mkdirSync(out, { recursive: true });

export const QR = {
  telegram: "https://t.me/vastu_sastra",
  site: "https://vol-3.web-almanac.com/",
};

for (const [name, url] of Object.entries(QR)) {
  const file = path.join(out, `${name}.svg`);
  execFileSync("npx", ["--yes", "qrcode@1.5.4", "-t", "svg", "-e", "Q", "-q", "4", "-d", "#111111ff", "-l", "#ffffffff", "-o", file, url], { stdio: "inherit" });
  console.log(`${file}  ←  ${url}`);
}
