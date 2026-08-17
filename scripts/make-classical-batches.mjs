// Build the per-agent input batches for classical biography writing.
// Each entry carries only verified material — the source's own dates, place and
// works, the harvested Wikipedia/Wikidata facts, and the curated connection
// notes — so a writer works from evidence rather than recall.
//   node scripts/make-classical-batches.mjs <outdir> [batches] [--missing]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUTDIR = process.argv[2] || (ROOT + "scratch/classical");
const BATCHES = +(process.argv[3] || 16);
const MISSING = process.argv.includes("--missing");
mkdirSync(OUTDIR, { recursive: true });

const w = {}; new Function("window", readFileSync(ROOT + "js/data/classical.js", "utf8"))(w);
const G = w.GENRE_DATA.classical;
const E = JSON.parse(readFileSync(ROOT + "scripts/classical-enriched.json", "utf8"));
const existing = (() => { try { return JSON.parse(readFileSync(ROOT + "scripts/classical-bios.json", "utf8")); } catch { return {}; } })();
const byId = new Map(G.nodes.map(n => [n.id, n]));
const lab = q => E.labels[q] || "";

/* connections, with the curated note — the "who shaped whom" evidence. The
   auto-added "circle" filler edges that merely tie a composer to their school
   anchor carry no information, so they are dropped. */
const conns = {};
for (const ed of G.edges) {
  const A = byId.get(ed.a), B = byId.get(ed.b); if (!A || !B) continue;
  if (ed.rel === "circle" && ed.note === A.school && A.school === B.school) continue;
  (conns[ed.a] = conns[ed.a] || []).push({ rel: ed.rel, with: B.name, note: ed.note || "" });
  (conns[ed.b] = conns[ed.b] || []).push({ rel: ed.rel === "mentored" ? "mentored by" : ed.rel === "influenced" ? "influenced by" : ed.rel === "championed" ? "championed by" : ed.rel, with: A.name, note: ed.note || "" });
}

const pool = MISSING ? G.nodes.filter(n => !existing[n.id]) : G.nodes;
const items = pool.map(n => {
  const e = E.artists[n.id] || {};
  return {
    id: n.id, name: n.name,
    school: n.school, alsoIn: n.alsoIn || [],
    era: (G.eras[n.era] || {}).label || "",
    source_dates_and_place: n.life || "",
    source_works: n.works || "",
    facts: e.ok ? {
      born: e.born || "", died: e.died || "",
      description: e.desc || "",
      nationality: (e.natQ || []).map(lab).filter(Boolean),
      occupations: (e.occQ || []).map(lab).filter(Boolean),
    } : null,
    wikipedia_extract: (e.extract || "").slice(0, 900),
    connections: (conns[n.id] || []).slice(0, 9),
  };
});

const per = Math.ceil(items.length / BATCHES);
let files = 0;
for (let i = 0; i < BATCHES; i++) {
  const slice = items.slice(i * per, (i + 1) * per);
  if (!slice.length) break;
  writeFileSync(`${OUTDIR}/in-${String(i).padStart(2, "0")}.json`, JSON.stringify(slice, null, 1));
  files++;
}
console.log(`nodes: ${items.length} | batches: ${files} (~${per} each) | dir: ${OUTDIR}`);
console.log(`without harvested facts (write from source + connections only): ${items.filter(x => !x.facts).length}`);
console.log(`with source works: ${items.filter(x => x.source_works).length} | with connections: ${items.filter(x => x.connections.length).length}`);
