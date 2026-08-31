// Merge the per-batch CV files written by the write->fact-check fan-out into
// scripts/music-bios.json, which apply-music-bios.mjs writes into the three
// hand-authored genre files.
//   node scripts/merge-music-bios.mjs <dir> [dir...]
//
// A double quote anywhere is FATAL, not a warning: each node field is one
// double-quoted JS string, so a stray " breaks the data file. Those entries are
// refused here rather than discovered at parse time.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const DIRS = process.argv.slice(2).filter(a => !a.startsWith("--"));
if (!DIRS.length) { console.error("usage: node scripts/merge-music-bios.mjs <dir> [dir...]"); process.exit(1); }

const nodes = [];
for (const g of ["jazz", "hiphop", "reggae"]) {
  const w = {}; new Function("window", readFileSync(ROOT + `js/data/${g}.js`, "utf8"))(w);
  for (const n of w.GENRE_DATA[g].nodes) nodes.push({ ...n, genre: g });
}
const valid = new Map(nodes.map(n => [n.id, n]));

const out = {}; let files = 0; const unknown = [], quoted = [], empty = [];
for (const DIR of DIRS) for (const f of readdirSync(DIR).filter(f => /^out-\d+\.json$/.test(f)).sort()) {
  const j = JSON.parse(readFileSync(`${DIR}/${f}`, "utf8")); files++;
  for (const [id, v] of Object.entries(j)) {
    if (!valid.has(id)) { unknown.push(id); continue; }
    const blurb = String((v && v.blurb) || "").trim();
    const bio = String((v && v.bio) || "").trim().replace(/\s+/g, " ");
    if (!bio || !blurb) { empty.push(id); continue; }
    if (bio.includes('"') || blurb.includes('"')) { quoted.push(`${f}:${id}`); continue; }
    out[id] = { blurb, bio };
  }
}

const words = s => s.split(/\s+/).length;
const all = Object.values(out);
const missing = nodes.filter(n => !out[n.id]);
const wc = all.map(b => words(b.bio)).sort((a, b) => a - b);
console.log(`files: ${files} | bios: ${all.length}/${nodes.length}`);
console.log(`words: min ${wc[0]} · median ${wc[Math.floor(wc.length / 2)]} · max ${wc[wc.length - 1]}`);
console.log(`short (<35): ${wc.filter(n => n < 35).length} | long (>170): ${wc.filter(n => n > 170).length}`);
if (unknown.length) console.log(`unknown ids ignored: ${unknown.length}`);
if (empty.length) console.log(`EMPTY (skipped): ${empty.length} — ${empty.slice(0, 8).join(", ")}`);
if (missing.length) console.log(`NO BIO (${missing.length}): ${missing.slice(0, 12).map(n => `${n.name} [${n.genre}]`).join(", ")}`);
if (quoted.length) { console.error(`\nFATAL: ${quoted.length} entries contain a double quote: ${quoted.slice(0, 10).join(", ")}`); process.exit(1); }
if (missing.length) { console.error(`\nRefusing to write a partial set (${missing.length} missing).`); process.exit(1); }

writeFileSync(ROOT + "scripts/music-bios.json", JSON.stringify(out, null, 0));
console.log(`\nwrote scripts/music-bios.json (${all.length} entries)`);
