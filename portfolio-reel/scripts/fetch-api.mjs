// Downloads the site's public data — notes, authors, posts, dictionaries — into
// portfolio-reel/data/api.json. When that file exists, record.mjs films the app
// with it instead of the demo content in mock-api.mjs (the notes take then opens
// the note by Данила Кудимов).
//
//   node portfolio-reel/scripts/fetch-api.mjs [--api=https://vol3.web-almanac.com]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "../data/api.json");
const api = (process.argv.find((a) => a.startsWith("--api="))?.slice(6)
  || process.env.REACT_APP_API_URL || "https://vol3.web-almanac.com").replace(/\/+$/, "");

async function get(route) {
  const res = await fetch(api + route, { headers: { "content-type": "application/json" } });
  if (!res.ok) throw new Error(`${api}${route}: HTTP ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

const [notices, authors, posts] = await Promise.all([get("/notice"), get("/authors"), get("/posts")]);
const dictionaries = [];
for (const a of authors) {
  dictionaries.push(...await get(`/dictionaries?author_id=${encodeURIComponent(a._id)}`));
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ fetched: new Date().toISOString(), api, notices, authors, posts, dictionaries }, null, 1));
console.log(`${path.relative(process.cwd(), out)}: ${notices.length} notes, ${authors.length} authors, `
  + `${posts.length} posts, ${dictionaries.length} dictionaries`);
