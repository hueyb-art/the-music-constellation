// Harvest verifiable facts for the classical genre from Wikipedia + Wikidata
// into scripts/classical-enriched.json — the layer the biographies and the
// portraits are built on. import-classical.mjs merges it back in.
//
//   node scripts/enrich-classical.mjs            # resume
//   node scripts/enrich-classical.mjs --refresh  # start over
//   node scripts/enrich-classical.mjs --retry    # only prior failures
//   node scripts/enrich-classical.mjs --limit 20
//
// THE GUARD THAT MATTERS. Classical is full of same-surname relatives — the
// Bachs, the Gabrielis (uncle and nephew), the Couperins, the Scarlattis, the
// Haydns, the Strausses — so a plain title lookup lands on the wrong man far
// more easily than in the art project. Here we have something that project did
// not: Huey's source already gives each composer's dates. So a candidate is
// accepted only if Wikidata's dates AGREE with the source's, within a tolerance
// that follows the source's own certainty: ±5 years for an exact date, ±15 for a
// "c." estimate or anything medieval, where reference works genuinely differ by a
// decade. That is a far stronger test than name or occupation matching, and it
// catches a wrong relative a generation away. Where the source gives no dates
// (patrons, librettists) we fall back to requiring a music- or patron-related
// record that is a human.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUT = ROOT + "scripts/classical-enriched.json";
const UA = "TheMusicConstellation/1.0 (https://github.com/hueyb-art/the-music-constellation; hueyb@me.com)";
const args = process.argv.slice(2);
const LIMIT = (() => { const i = args.indexOf("--limit"); return i < 0 ? Infinity : +args[i + 1]; })();
const REFRESH = args.includes("--refresh"), RETRY = args.includes("--retry");

const MUSIC_OCC = /(compos|music|conduct|organ|violin|pianist|harpsichord|cellist|singer|soprano|tenor|bass|cantor|kapellmeister|choir|opera|librett|theor|lutenist|flautist|clarinet|trumpet|percussion|conductor)/i;
const PATRON_OCC = /(patron|noble|monarch|king|queen|duke|duchess|emperor|empress|prince|cardinal|bishop|abbess|politician|philanthrop|writer|poet|playwright|dramatist|philosoph|impresario|publisher|dancer|choreograph)/i;

/* Hand-verified overrides: names where the bare title lands on somebody else
   entirely. Found by the date test (John Adams -> the US President; Chris Dench
   -> Judi Dench) and by an era-plausibility scan for the undated, where no date
   test is possible (Charles II -> "Charles Fox (composer)"; Robert Wilson ->
   "John Wilson"). Each title below was checked by hand against the source dates,
   so these skip the automatic date test. Chris Dench is deliberately absent: he
   has no English Wikipedia article, so he carries no facts rather than Judi's. */
const OVERRIDE = {
  johnadams: "John Adams (composer)",              // not the second US President
  johnbull: "John Bull (composer)",                // 1562-1628, matches the source exactly
  antoniodesalazar: "Antonio de Salazar (composer)", // 1650-1715, ditto
  juanhidalgo: "Juan Hidalgo de Polanco",          // not the 20th-c Spanish artist
  charlesii: "Charles II of England",              // the patron, not a modern composer
  robertwilson: "Robert Wilson (director)",        // Einstein on the Beach, with Glass
  philippeverdelot: "Philippe Verdelot",           // right man; his death year is disputed
  baudecordier: "Baude Cordier",                   // right man; dates disputed
};

const nodes = (() => { const w = {}; new Function("window", readFileSync(ROOT + "js/data/classical.js", "utf8"))(w); return w.GENRE_DATA.classical.nodes; })();
/* the source's own dates, recovered from the life string ("1685–1750 · Leipzig") */
function srcYears(life) {
  const m = String(life || "").split("·")[0];
  const y = (m.match(/\d{3,4}/g) || []).map(Number);
  if (/^\s*b\./i.test(m)) return { born: y[0] || null, died: null };
  if (/^\s*d\./i.test(m)) return { born: null, died: y[0] || null };
  if (/^\s*fl\./i.test(m)) return { born: null, died: null, fl: y[0] || null };
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
const yr = (cl, p) => { try { const t = cl[p][0].mainsnak.datavalue.value.time; return +t.slice(1, 5); } catch { return null; } };
const str = (cl, p) => { try { return cl[p][0].mainsnak.datavalue.value; } catch { return ""; } };

async function candidates(name) {
  const out = [name];
  const sr = await get(`https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srlimit=3&srsearch=${encodeURIComponent(name + " composer")}`);
  for (const h of (sr && sr.query && sr.query.search) || []) if (!out.includes(h.title)) out.push(h.title);
  return out;
}

async function resolve(nd) {
  const want = srcYears(nd.life);
  const out = { id: nd.id, name: nd.name, ok: false, srcBorn: want.born, srcDied: want.died };
  const forced = OVERRIDE[nd.id] || null;
  let titles = forced ? [forced] : [nd.name];
  const first = forced ? null : await get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(nd.name)}`);
  if (!forced && (!first || first.type !== "standard")) titles = await candidates(nd.name);
  for (const title of titles) {
    const s = title === nd.name && first && first.type === "standard" ? first
      : await get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    if (!s || s.type !== "standard" || !s.wikibase_item) continue;
    const wd = await get(`https://www.wikidata.org/wiki/Special:EntityData/${s.wikibase_item}.json`);
    const ent = wd && wd.entities && wd.entities[s.wikibase_item], cl = ent && ent.claims;
    if (!cl) continue;
    const p31 = ids(cl, "P31");
    if (p31.includes("Q4167410") || p31.includes("Q13406463")) continue;      // disambiguation / list
    const desc = ((ent.descriptions && ent.descriptions.en && ent.descriptions.en.value) || s.description || "");
    const occ = ids(cl, "P106");
    const born = yr(cl, "P569"), died = yr(cl, "P570");
    const near = (a, b) => a && b && Math.abs(a - b) <= 4;

    /* THE TEST: when the source dates a composer, the record must match them —
       with a tolerance that follows the source's OWN certainty. "1685–1750" is
       a claim; "c. 1300–1377" is an estimate, and reference works routinely
       differ by a decade on a troubadour. So an approximate source date gets a
       wide window, an exact one a narrow one; and a candidate is rejected if
       ANY comparable date is wildly out, which is what catches a same-name
       relative a generation away. */
    if (!forced && (want.born || want.died)) {
      const approx = /c\.|fl\.|\?|after|before/i.test(String(nd.life || "")) || (want.born || want.died) < 1500;
      const tol = approx ? 15 : 5;
      const diffs = [];
      if (want.born && born) diffs.push(Math.abs(want.born - born));
      if (want.died && died) diffs.push(Math.abs(want.died - died));
      const best = diffs.length ? Math.min(...diffs) : null;
      const worst = diffs.length ? Math.max(...diffs) : null;
      const okDates = best !== null && best <= tol && worst <= tol * 4;
      if (!okDates) { out.rejected = (out.rejected || []).concat(`${title} (${born || "?"}–${died || "?"})`); continue; }
      out.dateChecked = true;
    } else if (!forced) {
      if (!p31.includes("Q5")) continue;
      const occText = desc + " " + occ.join(" ");
      if (!MUSIC_OCC.test(occText) && !PATRON_OCC.test(occText) && !MUSIC_OCC.test(desc)) continue;
    }
    out.ok = true; out.title = s.title; out.qid = s.wikibase_item; out.desc = desc;
    out.extract = s.extract || ""; out.born = born; out.died = died;
    out.occQ = occ.slice(0, 4); out.natQ = ids(cl, "P27").slice(0, 2); out.worksQ = ids(cl, "P800").slice(0, 6);
    const p18 = str(cl, "P18");
    if (p18) out.portrait = "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(p18) + "?width=480";
    break;
  }
  return out;
}

const cache = (!REFRESH && existsSync(OUT)) ? JSON.parse(readFileSync(OUT, "utf8")) : { artists: {}, labels: {} };
cache.artists = cache.artists || {}; cache.labels = cache.labels || {};
const todo = nodes.filter(n => RETRY ? (cache.artists[n.id] && !cache.artists[n.id].ok) : !cache.artists[n.id])
  .slice(0, LIMIT === Infinity ? undefined : LIMIT);
console.log(`composers: ${nodes.length} | cached: ${Object.keys(cache.artists).length} | fetching: ${todo.length}`);

let done = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (todo.length) {
    const nd = todo.shift(); if (!nd) break;
    cache.artists[nd.id] = await resolve(nd);
    if (++done % 25 === 0) { console.log(`  …${done}`); writeFileSync(OUT, JSON.stringify(cache)); }
    await sleep(70);
  }
}));
writeFileSync(OUT, JSON.stringify(cache));

// labels for referenced QIDs
const need = new Set();
for (const a of Object.values(cache.artists)) if (a.ok) [...(a.occQ || []), ...(a.natQ || [])].forEach(q => { if (!cache.labels[q]) need.add(q); });
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
for (const c of chunk([...need], 45)) {
  const d = await get(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&languages=en&ids=${c.join("|")}`);
  for (const [q, e] of Object.entries((d && d.entities) || {})) cache.labels[q] = (e.labels && e.labels.en && e.labels.en.value) || "";
  await sleep(120);
}
// prune anyone no longer in the dataset
{
  const live = new Set(nodes.map(n => n.id));
  const gone = Object.keys(cache.artists).filter(id => !live.has(id));
  gone.forEach(id => delete cache.artists[id]);
  if (gone.length) console.log("pruned:", gone.length);
}
writeFileSync(OUT, JSON.stringify(cache));

// ---- report ----
const A = Object.values(cache.artists), ok = A.filter(a => a.ok);
const dated = A.filter(a => a.srcBorn || a.srcDied);
const pct = (n, d) => Math.round(100 * n / (d || A.length)) + "%";
console.log("\n--- HARVEST ---");
console.log("nodes            :", A.length);
console.log("matched          :", ok.length, pct(ok.length));
console.log("  of the dated   :", ok.filter(a => a.srcBorn || a.srcDied).length, pct(ok.filter(a => a.srcBorn || a.srcDied).length, dated.length), "(date-verified)");
console.log("free portrait    :", pct(ok.filter(a => a.portrait).length));
console.log("extract >120     :", pct(ok.filter(a => (a.extract || "").length > 120).length));
const wrongRel = A.filter(a => !a.ok && a.rejected && a.rejected.length);
console.log("rejected on dates:", wrongRel.length, "(a same-name relative or namesake)");
wrongRel.slice(0, 12).forEach(a => console.log(`   ${a.name} (source ${a.srcBorn || "?"}–${a.srcDied || "?"}) rejected ${a.rejected[0]}`));
