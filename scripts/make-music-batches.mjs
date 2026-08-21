// Batches for rewriting the jazz/hip hop/reggae CVs facts-first.
//   node scripts/make-music-batches.mjs <outdir> [batches]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUTDIR = process.argv[2], BATCHES = +(process.argv[3] || 14);
mkdirSync(OUTDIR, { recursive: true });
const E = JSON.parse(readFileSync(ROOT + "scripts/music-enriched.json", "utf8"));
const lab = q => E.labels[q] || "";
const items = [];
for (const g of ["jazz", "hiphop", "reggae"]) {
  const w = {}; new Function("window", readFileSync(ROOT + `js/data/${g}.js`, "utf8"))(w);
  const G = w.GENRE_DATA[g], byId = new Map(G.nodes.map(n => [n.id, n]));
  const conns = {};
  for (const ed of G.edges) {
    const A = byId.get(ed.a), B = byId.get(ed.b); if (!A || !B) continue;
    (conns[ed.a] = conns[ed.a] || []).push({ rel: ed.rel, with: B.name });
    (conns[ed.b] = conns[ed.b] || []).push({ rel: ed.rel, with: A.name });
  }
  for (const n of G.nodes) {
    const e = E.artists[n.id] || {};
    items.push({
      id: n.id, name: n.name, genre: g,
      era: (G.eras[n.era] || {}).label || "",
      curated_role: n.role, curated_life: n.life,
      signature_recordings: (n.disco || []).map(d => `${d[1]} (${d[0]})${d[2] ? " — " + d[2] : ""}`),
      facts: e.ok ? {
        born: e.born || "", died: e.died || "", description: e.desc || "",
        nationality: (e.natQ || []).map(lab).filter(Boolean),
        occupations: (e.occQ || []).map(lab).filter(Boolean),
        genres: (e.genreQ || []).map(lab).filter(Boolean),
        is_group: !!e.isGroup,
      } : null,
      wikipedia_extract: (e.extract || "").slice(0, 900),
      connections: (conns[n.id] || []).slice(0, 10),
    });
  }
}
const per = Math.ceil(items.length / BATCHES);
let files = 0;
for (let i = 0; i < BATCHES; i++) {
  const slice = items.slice(i * per, (i + 1) * per);
  if (!slice.length) break;
  writeFileSync(`${OUTDIR}/in-${String(i).padStart(2, "0")}.json`, JSON.stringify(slice, null, 1));
  files++;
}
console.log(`nodes: ${items.length} | batches: ${files} (~${per}) | without facts: ${items.filter(x => !x.facts).length}`);
console.log(`with signature recordings: ${items.filter(x => x.signature_recordings.length).length} | with connections: ${items.filter(x => x.connections.length).length}`);
