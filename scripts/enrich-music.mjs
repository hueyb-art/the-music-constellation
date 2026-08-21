// Harvest verifiable facts for the three HAND-AUTHORED genres (jazz, hip hop,
// reggae) into scripts/music-enriched.json — so their CVs can be rewritten
// facts-first, the way art and classical were, and the provenance note can be
// uniformly true.
//
//   node scripts/enrich-music.mjs [--genre jazz] [--limit N] [--refresh] [--retry]
//
// SAME GUARD AS CLASSICAL, and it matters even more here: stage names collide
// constantly ("Common", "Nas", "Q-Tip", "Prince Buster", "Duke Reid"), and a
// bare title lookup lands on a word, a place, or the wrong person. Every node
// carries dates in `life` ("b.1965 · American", "1928–2008 · American"), so a
// candidate is accepted only if Wikidata's dates agree — tight for exact dates,
// looser for approximations. Where dates are missing we fall back to requiring a
// music-related human.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUT = ROOT + "scripts/music-enriched.json";
const UA = "TheMusicConstellation/1.0 (https://github.com/hueyb-art/the-music-constellation; hueyb@me.com)";
const args = process.argv.slice(2);
const argv = k => { const i = args.indexOf(k); return i < 0 ? null : args[i + 1]; };
const LIMIT = argv("--limit") ? +argv("--limit") : Infinity;
const ONLY = argv("--genre");
const REFRESH = args.includes("--refresh"), RETRY = args.includes("--retry");

const MUSIC_OCC = /(music|singer|song|rapper|composer|producer|guitar|drum|bass|saxoph|trumpet|pian|organ|keyboard|vocal|band|dj|disc jockey|percussion|violin|trombone|clarinet|flaut|harmonic|vibraph|arrang|conduct|entertainer|performer|record|hip hop|jazz|reggae|ska|dub|toaster|deejay|sound system|engineer|toaster|selector|mc|hip.hop|group|duo|trio|collective|ensemble|orchestra|sound system)/i;

const GENRE_HINT = { jazz: "jazz musician", hiphop: "rapper hip hop", reggae: "reggae musician Jamaica" };

/* Hand-verified titles for the stragglers: stage names that are common words
   ("Eve", "Common", "Wale", "Dave", "Culture"), renames, and disputed birth
   years. Each was checked by hand, so these skip the automatic name and date
   tests. Pete DJ Jones and the Jamaican deejay Charlie Chaplin are deliberately
   ABSENT — neither has an English Wikipedia article, and the search returns
   topic pages ("Hip-hop culture", "Dancehall"), so they carry no facts rather
   than an article about a genre. */
const OVERRIDE = {
  ninetheobserver: "Niney the Observer", tomscott: "Tom Scott (saxophonist)",
  viviangarry: "Vivien Garry", eve: "Eve (rapper)", "2pac": "Tupac Shakur",
  organizednoize: "Organized Noize", common: "Common (rapper)", wale: "Wale (rapper)",
  dave: "Dave (rapper)", jme: "Jme", wiley: "Wiley (musician)",
  bunnystrikerlee: "Bunny Lee", innercircle: "Inner Circle (band)", culture: "Culture (band)",
  joseywales: "Josey Wales (singer)", admiralbailey: "Admiral Bailey",
  michaelrose: "Michael Rose (singer)", glenwashington: "Glen Washington",
};

const genres = {};
for (const g of ["jazz", "hiphop", "reggae"]) {
  const w = {}; new Function("window", readFileSync(ROOT + `js/data/${g}.js`, "utf8"))(w);
  genres[g] = w.GENRE_DATA[g].nodes;
}
/* dates out of the curated life string: "b.1965 · American" / "1928–2008 · American" */
function srcYears(life) {
  const head = String(life || "").split("·")[0];
  const y = (head.match(/\d{4}/g) || []).map(Number);
  if (/^\s*b\.?/i.test(head)) return { born: y[0] || null, died: null };
  if (/^\s*d\.?\s*\d/i.test(head)) return { born: null, died: y[0] || null };
  return { born: y[0] || null, died: y.length > 1 ? y[y.length - 1] : null };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url, tries = 3) {
  for (let t = 0; t < tries; t++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (r.status === 404) return null;
      if (r.status === 429 || r.status >= 500) { await sleep(700 * (t + 1)); continue; }
      if (!r.ok) return null;
      return await r.json();
    } catch { await sleep(500 * (t + 1)); }
  }
  return null;
}
const ids = (cl, p) => ((cl && cl[p]) || []).map(c => { try { return c.mainsnak.datavalue.value.id; } catch { return null; } }).filter(Boolean);
const yr = (cl, p) => { try { return +cl[p][0].mainsnak.datavalue.value.time.slice(1, 5); } catch { return null; } };
const str = (cl, p) => { try { return cl[p][0].mainsnak.datavalue.value; } catch { return ""; } };

/* NAME CORROBORATION. Offering search alternatives lifted matching to 100% by
   accepting whatever came back: "Future" resolved to the article Hip-hop
   culture, "Eve" to East Coast hip-hop, "Charlie Chaplin" to Music of Jamaica,
   and — worse, because they look plausible — "Glen Washington" to Gregory
   Isaacs, "Scientist" to Wayne Smith, "Admiral Bailey" to Chaka Demus. Those
   three even passed the date test, Isaacs being within six years of Washington.
   So the article we accept must actually bear the artist's name: strip any
   "(musician)" qualifier and require containment either way, which tolerates
   "Sly & Robbie"→"Sly and Robbie" and "$uicideboy$"→"Suicideboys" while
   rejecting a different person outright. */
const nname = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/&/g, " and ").replace(/\s*\([^)]*\)\s*/g, " ")
  .replace(/[^a-z0-9]+/g, "").trim();
function nameRelated(nodeName, title) {
  const a = nname(nodeName), b = nname(title);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

async function resolve(nd, genre) {
  const want = srcYears(nd.life);
  const out = { id: nd.id, name: nd.name, genre, ok: false, srcBorn: want.born, srcDied: want.died };
  /* Always line up search alternatives, even when the bare title resolves — a
     stage name often IS a common word, so the direct hit succeeds with entirely
     the wrong subject: Q-Tip is a cotton swab, Future is "time after the
     present", Eve is the biblical figure. Those are rejected by the guards
     below, and we then need somewhere else to look. */
  const forced = OVERRIDE[nd.id] || null;
  let titles = forced ? [forced] : [nd.name];
  const first = forced ? null : await get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(nd.name)}`);
  if (!forced) {
    const sr = await get(`https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srlimit=3&srsearch=${encodeURIComponent(nd.name + " " + (GENRE_HINT[genre] || "musician"))}`);
    for (const h of (sr && sr.query && sr.query.search) || []) if (!titles.includes(h.title)) titles.push(h.title);
  }
  for (const title of titles) {
    const s = title === nd.name && first && first.type === "standard" ? first
      : await get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    if (!s || s.type !== "standard" || !s.wikibase_item) continue;
    const wd = await get(`https://www.wikidata.org/wiki/Special:EntityData/${s.wikibase_item}.json`);
    const ent = wd && wd.entities && wd.entities[s.wikibase_item], cl = ent && ent.claims;
    if (!cl) continue;
    const p31 = ids(cl, "P31");
    if (p31.includes("Q4167410") || p31.includes("Q13406463")) continue;    // disambiguation/list
    /* ...but accept a rename or stage name that Wikidata itself records: 2Pac is
       an alias of Tupac Shakur, Mos Def of Yasiin Bey, Too $hort of Too Short.
       Checking the entity's own labels/aliases keeps those while still rejecting
       a different person. */
    const alias = [(ent.labels && ent.labels.en && ent.labels.en.value) || ""]
      .concat(((ent.aliases && ent.aliases.en) || []).map(a => a.value));
    if (!forced && !nameRelated(nd.name, s.title) && !alias.some(a => nameRelated(nd.name, a))) {
      out.nameMismatch = (out.nameMismatch || []).concat(s.title); continue;
    }
    const desc = ((ent.descriptions && ent.descriptions.en && ent.descriptions.en.value) || s.description || "");
    const occ = ids(cl, "P106");
    const born = yr(cl, "P569"), died = yr(cl, "P570");
    const isGroup = !p31.includes("Q5");     // bands/collectives are legitimate nodes here

    if (!forced && (want.born || want.died)) {
      /* Wider than classical's ±5 on purpose: reggae and hip-hop birth years are
         genuinely disputed — artists obscure their age, and reference works
         disagree. Jimmy Cliff is 1944 or 1948 depending who you ask, Trina 1974
         or 1978; both were the right person, rejected by a ±3 window. ±6 keeps
         those while still catching a different human (Dillinger the gangster is
         50 years out, Charlie Chaplin the actor 70). */
      const tol = 6;
      const diffs = [];
      if (want.born && born) diffs.push(Math.abs(want.born - born));
      if (want.died && died) diffs.push(Math.abs(want.died - died));
      const best = diffs.length ? Math.min(...diffs) : null;
      /* a band's "life" is its active years, which won't match a person's dates —
         so for groups fall back to the occupation test rather than the date test */
      if (!isGroup && (best === null || best > tol)) { out.rejected = (out.rejected || []).concat(`${title} (${born || "?"}–${died || "?"})`); continue; }
      if (isGroup && !MUSIC_OCC.test(desc + " " + occ.join(" "))) continue;
      if (!isGroup) out.dateChecked = true;
    } else if (!forced && !MUSIC_OCC.test(desc)) continue;

    out.ok = true; out.title = s.title; out.qid = s.wikibase_item; out.desc = desc;
    out.extract = s.extract || ""; out.born = born; out.died = died; out.isGroup = isGroup;
    out.occQ = occ.slice(0, 5); out.natQ = ids(cl, "P27").slice(0, 2); out.genreQ = ids(cl, "P136").slice(0, 4);
    const p18 = str(cl, "P18");
    if (p18) out.portrait = "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(p18) + "?width=480";
    break;
  }
  return out;
}

const cache = (!REFRESH && existsSync(OUT)) ? JSON.parse(readFileSync(OUT, "utf8")) : { artists: {}, labels: {} };
cache.artists = cache.artists || {}; cache.labels = cache.labels || {};
const all = [];
for (const [g, nodes] of Object.entries(genres)) { if (ONLY && g !== ONLY) continue; for (const nd of nodes) all.push({ nd, g }); }
const todo = all.filter(({ nd }) => RETRY ? (cache.artists[nd.id] && !cache.artists[nd.id].ok) : !cache.artists[nd.id])
  .slice(0, LIMIT === Infinity ? undefined : LIMIT);
console.log(`nodes: ${all.length} | cached: ${Object.keys(cache.artists).length} | fetching: ${todo.length}`);

let done = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (todo.length) {
    const job = todo.shift(); if (!job) break;
    cache.artists[job.nd.id] = await resolve(job.nd, job.g);
    if (++done % 25 === 0) { console.log(`  …${done}`); writeFileSync(OUT, JSON.stringify(cache)); }
    await sleep(70);
  }
}));
writeFileSync(OUT, JSON.stringify(cache));

const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const need = new Set();
for (const a of Object.values(cache.artists)) if (a.ok) [...(a.occQ || []), ...(a.natQ || []), ...(a.genreQ || [])].forEach(q => { if (!cache.labels[q]) need.add(q); });
for (const c of chunk([...need], 45)) {
  const d = await get(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&languages=en&ids=${c.join("|")}`);
  for (const [q, e] of Object.entries((d && d.entities) || {})) cache.labels[q] = (e.labels && e.labels.en && e.labels.en.value) || "";
  await sleep(120);
}
writeFileSync(OUT, JSON.stringify(cache));

const A = Object.values(cache.artists), ok = A.filter(a => a.ok);
const pct = n => Math.round(100 * n / A.length) + "%";
console.log("\n--- HARVEST ---");
console.log("nodes           :", A.length);
console.log("matched         :", ok.length, pct(ok.length));
console.log("date-verified   :", ok.filter(a => a.dateChecked).length, "| groups (no date test):", ok.filter(a => a.isGroup).length);
console.log("free portrait   :", pct(ok.filter(a => a.portrait).length));
console.log("extract >120    :", pct(ok.filter(a => (a.extract || "").length > 120).length));
const rej = A.filter(a => !a.ok && a.rejected);
console.log("rejected on dates:", rej.length);
rej.slice(0, 10).forEach(a => console.log(`   ${a.name} (source ${a.srcBorn || "?"}–${a.srcDied || "?"}) rejected ${a.rejected[0]}`));
console.log("unmatched:", A.filter(a => !a.ok).length);
