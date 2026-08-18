// Find a real, sounding recording for each classical composer and record it as
// their audio search seed (disco[0]) in scripts/classical-tracks.json.
//
//   node scripts/harvest-classical-audio.mjs [--limit N] [--refresh]
//
// WHY THIS EXISTS. playClip seeds from disco[0]'s title; with no seed the engine
// searches the composer's name and plays whatever is most famous — which for
// John Cage was 4'33", i.e. silence. And a seed alone is not enough, because
// iTunes credits the PERFORMER, not the composer: searching Machaut returns The
// Orlando Consort. So the seed must be a WORK TITLE, verified once here rather
// than trusted per click.
//
// ACCEPTANCE RULE. A candidate is taken only when the track title matches the
// work AND one of:
//   - the composer's surname appears in artistName or collectionName (diacritics
//     folded — "Pärt: Portrait" must match Part), or
//   - the work title is DISTINCTIVE on its own.
// The second clause is deliberately narrow. "Vespro della Beata Vergine" is
// effectively unique; "Ave Maria", "Requiem", "Symphony No. 5" are not, and are
// exactly where you would end up playing the wrong composer's music. Generic
// form titles therefore always require corroboration.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUT = ROOT + "scripts/classical-tracks.json";
const UA = "TheMusicConstellation/1.0 (https://github.com/hueyb-art/the-music-constellation; hueyb@me.com)";
const args = process.argv.slice(2);
const LIMIT = (() => { const i = args.indexOf("--limit"); return i < 0 ? Infinity : +args[i + 1]; })();
const REFRESH = args.includes("--refresh");
const RETRY = args.includes("--retry");   /* re-attempt those previously refused */

const fold = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/* light stemming so "Cello Suites" (Wikidata) matches "Cello Suite No. 1"
   (iTunes) — plurals were the single biggest cause of false misses. */
const stem = w => (w.length > 4 && w.endsWith("s")) ? w.slice(0, -1) : w;
const sig = s => fold(s).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)).map(stem);
const STOP = new Set(["the","and","for","der","die","das","les","des","del","della","von","van","auf","mit","in","de","la","le","el","il","un","une","opus","op","no","nos"]);
/* generic form-titles: real works, but the name alone identifies nobody */
const GENERIC = /^(ave maria|requiem|magnificat|te deum|stabat mater|missa[a-z ]*|mass|kyrie|gloria|credo|sanctus|agnus dei|nunc dimittis|salve regina|miserere|symphony|sinfonia|sonata|concerto|nocturne|prelude|fugue|etude|study|quartet|quintet|trio|octet|suite|cantata|motet|madrigal|chanson|ballade|rondo|minuet|serenade|overture|fantasia|toccata|variations|psalm|vespers|passion|oratorio|te lucis|dream|song|songs|piano piece|string quartet)([ ,:.]|$)/i;

const w = {}; new Function("window", readFileSync(ROOT + "js/data/classical.js", "utf8"))(w);
const nodes = w.GENRE_DATA.classical.nodes;
const ENR = JSON.parse(readFileSync(ROOT + "scripts/classical-enriched.json", "utf8"));

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url, tries = 3) {
  for (let t = 0; t < tries; t++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (r.status === 429 || r.status >= 500) { await sleep(3000 * (t + 1)); continue; }
      if (!r.ok) return null;
      return await r.json();
    } catch { await sleep(800 * (t + 1)); }
  }
  return null;
}

// ---- 1. work titles: Wikidata P800 (already harvested as worksQ), then the source prose ----
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const workLabels = {};
{
  const need = new Set();
  for (const a of Object.values(ENR.artists)) if (a.ok) (a.worksQ || []).forEach(q => need.add(q));
  for (const c of chunk([...need], 45)) {
    const d = await get(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&languages=en&ids=${c.join("|")}`);
    for (const [q, e] of Object.entries((d && d.entities) || {})) workLabels[q] = (e.labels && e.labels.en && e.labels.en.value) || "";
    await sleep(120);
  }
  console.log(`work titles from Wikidata P800: ${Object.values(workLabels).filter(Boolean).length}`);
}
/* the source's works field is prose — "Messe de Nostre Dame, the first complete
   Mass cycle by one composer". Take the leading clause, but only if it looks
   like a TITLE: Bach's reads "the summation of the entire contrapuntal
   tradition", which is a gloss and must not become a search seed. */
function fromProse(works) {
  const head = String(works || "").split(/[;,]/)[0].trim();
  if (!head || head.length < 4 || head.length > 60) return null;
  if (/^(the|a|an|his|her|their|one|first|among|with|over|more)\b/i.test(head)) return null;
  if (!/[A-Z]/.test(head)) return null;
  return head;
}
/* Wikidata P86 ("composer") links every catalogued work to its composer, where
   P800 ("notable work") is only ever a handful. For the medieval and Renaissance
   end — Landini, Senleches, Hayne van Ghizeghem — P800 is usually empty while
   P86 has their chansons and madrigals. Fetched in batches for whoever we are
   about to check. */
const p86 = {};
async function loadP86(qids) {
  for (const c of chunk(qids, 60)) {
    const q = `SELECT ?c ?w ?wLabel WHERE { VALUES ?c { ${c.map(x => "wd:" + x).join(" ")} }
      ?w wdt:P86 ?c . SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 900`;
    const d = await get(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`);
    for (const b of (d && d.results && d.results.bindings) || []) {
      const k = b.c.value.split("/").pop(), t = b.wLabel ? b.wLabel.value : "";
      if (t && !/^Q\d+$/.test(t) && t.length < 60) { (p86[k] = p86[k] || []); if (p86[k].length < 5 && !p86[k].includes(t)) p86[k].push(t); }
    }
    await sleep(900);
  }
  console.log(`work titles from Wikidata P86: ${Object.values(p86).reduce((n, a) => n + a.length, 0)} across ${Object.keys(p86).length} composers`);
}

const candidatesFor = nd => {
  const e = ENR.artists[nd.id] || {};
  const out = [];
  for (const q of (e.worksQ || [])) { const t = workLabels[q]; if (t && t.length < 60) out.push(t); }
  for (const t of (p86[e.qid] || [])) out.push(t);          /* richer, mostly medieval/Renaissance */
  const p = fromProse(nd.works); if (p) out.push(p);
  return [...new Set(out)].slice(0, 4);
};

// ---- 2. verify against iTunes ----
const titleMatch = (want, got) => {
  const a = sig(want), b = fold(got).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).map(stem);
  if (!a.length) return false;
  const hit = x => b.includes(x);
  return hit(a[0]) && a.filter(hit).length >= Math.min(2, a.length);
};
const distinctive = t => !GENERIC.test(t.trim()) && sig(t).length >= 2;

async function findTrack(nd, work) {
  const surname = fold(nd.name.split(/[\s,]+/).filter(Boolean).pop());
  const d = await get(`https://itunes.apple.com/search?term=${encodeURIComponent(nd.name + " " + work)}&media=music&entity=song&limit=12`);
  const res = (d && d.results || []).filter(x => x.previewUrl && titleMatch(work, x.trackName || ""));
  if (!res.length) return null;
  const corrob = x => fold(x.artistName).includes(surname) || fold(x.collectionName).includes(surname);
  const good = res.filter(corrob);
  if (good.length) return { t: work, why: "composer named", track: good[0].trackName, coll: good[0].collectionName || "" };
  if (distinctive(work)) return { t: work, why: "distinctive title", track: res[0].trackName, coll: res[0].collectionName || "" };
  return null;                                   // generic title with no corroboration → refuse
}

const cache = (!REFRESH && existsSync(OUT)) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
await loadP86(nodes.filter(n => (RETRY ? cache[n.id] === null : !(n.id in cache)))
  .map(n => (ENR.artists[n.id] || {}).qid).filter(Boolean));
const todo = nodes.filter(nd => (RETRY ? cache[nd.id] === null : !(nd.id in cache)) && candidatesFor(nd).length).slice(0, LIMIT === Infinity ? undefined : LIMIT);
console.log(`composers with candidate works: ${nodes.filter(n => candidatesFor(n).length).length} | to check: ${todo.length}`);

let done = 0, found = 0;
for (const nd of todo) {
  let hit = null;
  for (const work of candidatesFor(nd)) {
    hit = await findTrack(nd, work);
    await sleep(1100);                            // iTunes is ~20 req/min; stay well under
    if (hit) break;
  }
  cache[nd.id] = hit ? [["", hit.t, "signature work — " + hit.why]] : null;
  if (hit) { found++; if (found <= 30) console.log(`  ✓ ${nd.name} — ${hit.t}  (${hit.why})`); }
  if (++done % 25 === 0) { writeFileSync(OUT, JSON.stringify(cache)); console.log(`  …${done}/${todo.length}, found ${found}`); }
}
writeFileSync(OUT, JSON.stringify(cache));
const have = Object.values(cache).filter(Boolean).length, checked = Object.keys(cache).length;
console.log(`\n--- AUDIO SEEDS ---`);
console.log(`checked: ${checked} | verified seed: ${have} (${Math.round(100*have/checked)}%) | refused: ${checked-have}`);
