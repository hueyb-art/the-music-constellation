// Merge the per-batch bio files written by the agents into
// scripts/classical-bios.json, which import-classical.mjs bakes into
// js/data/classical.js. Reports anything missing or out of spec.
//   node scripts/merge-classical-bios.mjs <dir> [dir...]
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const DIRS = process.argv.slice(2).filter(a => !a.startsWith("--"));
if (!DIRS.length) { console.error("usage: node scripts/merge-classical-bios.mjs <dir> [dir...]"); process.exit(1); }

const w = {}; new Function("window", readFileSync(ROOT + "js/data/classical.js", "utf8"))(w);
const nodes = w.GENRE_DATA.classical.nodes;
const valid = new Set(nodes.map(n => n.id));

const out = {};
let files = 0, unknown = [];
for (const DIR of DIRS) for (const f of readdirSync(DIR).filter(f => /^out-\d+\.json$/.test(f)).sort()) {
  const j = JSON.parse(readFileSync(`${DIR}/${f}`, "utf8")); files++;
  for (const [id, v] of Object.entries(j)) {
    if (!valid.has(id)) { unknown.push(id); continue; }
    if (v && typeof v.bio === "string" && v.bio.trim())
      out[id] = { blurb: String(v.blurb || "").trim(), bio: v.bio.trim().replace(/\s+/g, " ") };
  }
}
writeFileSync(ROOT + "scripts/classical-bios.json", JSON.stringify(out, null, 0));

const words = s => s.split(/\s+/).length;
const all = Object.values(out);
const missing = nodes.filter(n => !out[n.id]);
const wc = all.map(b => words(b.bio)).sort((a, b) => a - b);
console.log(`files: ${files} | bios: ${all.length}/${nodes.length}`);
if (unknown.length) console.log(`unknown ids ignored: ${unknown.length}`);
console.log(`words: min ${wc[0]} · median ${wc[Math.floor(wc.length / 2)]} · max ${wc[wc.length - 1]}`);
console.log(`short (<35): ${wc.filter(n => n < 35).length} | long (>170): ${wc.filter(n => n > 170).length} | missing blurb: ${all.filter(b => !b.blurb).length}`);
if (missing.length) console.log(`NO BIO (${missing.length}): ${missing.slice(0, 10).map(n => n.name).join(", ")}`);
