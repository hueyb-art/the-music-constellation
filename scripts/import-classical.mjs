// Importer: parse the two Classical source markdown files into js/data/classical.js
// (the GENRE_DATA["classical"] shape the engine expects).
//
//   node scripts/import-classical.mjs
//
// Source (~/Desktop/Composers and Musical Movements/):
//   "Composers of the Western Tradition.md"  → eras, schools, composers
//   "Musical Connections.md"                 → the typed connections between them
//
// Unlike jazz/hiphop/reggae — which are hand-authored — this genre is GENERATED,
// like the art constellation: edit the markdown and re-run. The enrichment layer
// (portraits, biographies) is merged back in here so re-importing never wipes it.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SRC = "/Users/Huey CCC/Desktop/Composers and Musical Movements";
const COMPOSERS = readFileSync(`${SRC}/Composers of the Western Tradition.md`, "utf8");
const CONNS = readFileSync(`${SRC}/Musical Connections.md`, "utf8");

// ---- helpers ----
const slug = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "");
const years = s => (s.match(/\d{3,4}/g) || []).map(Number);

/* Dates come in a dozen shapes: "1098–1179", "c. 1130–1195", "b. 1935",
   "d. 1594", "fl. c. 1200", "fl. mid-14th c.". Keep the original text for
   display and pull whatever structured years we can for sorting/placement. */
function parseDates(txt) {
  const t = (txt || "").trim();
  const y = years(t);
  const out = { text: t, born: null, died: null, fl: null };
  if (/^b\./i.test(t)) out.born = y[0] ?? null;
  else if (/^d\./i.test(t)) out.died = y[0] ?? null;
  else if (/^fl\./i.test(t)) {
    if (y.length) out.fl = y[0];
    else { const c = t.match(/(\d{1,2})th/); if (c) out.fl = (+c[1] - 1) * 100 + (/late/i.test(t) ? 75 : /mid/i.test(t) ? 50 : 25); }
  } else if (y.length >= 2) { out.born = y[0]; out.died = y[y.length - 1]; }
  else if (y.length === 1) out.born = y[0];
  return out;
}
/* School headings end with "· <where and/or when>": "c. 1420–1470",
   "France, 14th century", "11th–12th century", "Britain, from c. 1975". */
function parseSpan(suffix, eraSpan) {
  const s = suffix || "";
  const y = years(s);
  if (y.length >= 2) return { s: y[0], e: y[y.length - 1] };
  if (/from/i.test(s) && y.length === 1) return { s: y[0], e: eraSpan ? eraSpan.e : y[0] + 25 };
  const cent = [...s.matchAll(/(\d{1,2})(?:st|nd|rd|th)/g)].map(m => +m[1]);
  if (cent.length >= 2) return { s: (cent[0] - 1) * 100, e: cent[cent.length - 1] * 100 };
  if (cent.length === 1) return { s: (cent[0] - 1) * 100, e: cent[0] * 100 };
  if (y.length === 1) return { s: y[0], e: y[0] };
  return eraSpan ? { ...eraSpan } : { s: null, e: null };
}

const ERA_COLORS = ["#8d7bb5", "#4f93d8", "#43b59a", "#e0b15a", "#bf5a2b", "#d9607a", "#cf7bbf"];
const eras = {};       // key -> {label,color,s,e}
const schools = {};    // name -> {s,e,era}
const nodes = new Map();
const edges = [];
const edgeSeen = new Set();

/* 26 composers are listed under two schools (Monteverdi under both the Italian
   madrigal and the seconda pratica). A star can only sit in one cluster, so keep
   the first — except where a school is named after the composer, which is plainly
   their home — and remember the rest in alsoIn rather than discarding it. */
function ensureNode(name, extra = {}) {
  const id = slug(name);
  if (!id) return null;
  if (!nodes.has(id)) nodes.set(id, { id, name, era: "", school: "", alsoIn: [], dates: null, place: "", works: "", ...extra });
  else {
    const n = nodes.get(id);
    if (extra.school && n.school && extra.school !== n.school) {
      const surname = name.split(/[\s,]+/).filter(Boolean).pop().toLowerCase();
      const named = s => s.toLowerCase().includes(surname);
      if (named(extra.school) && !named(n.school)) { n.alsoIn.push(n.school); n.school = extra.school; if (extra.era) n.era = extra.era; }
      else if (!n.alsoIn.includes(extra.school)) n.alsoIn.push(extra.school);
    }
    for (const k of ["era", "school", "place", "works"]) if (!n[k] && extra[k]) n[k] = extra[k];
    if (!n.dates && extra.dates) n.dates = extra.dates;
    if (extra.works && n.works && extra.works !== n.works && !n.works.includes(extra.works)) n.works += "; " + extra.works;
  }
  return id;
}

// ---- parse composers ----
{
  let era = null, school = null;
  for (const raw of COMPOSERS.split("\n")) {
    const line = raw.trim();
    let m;
    if ((m = line.match(/^## ERA (\d+) — (.+)$/))) {
      era = "era" + m[1];
      const ey = years(m[2]);
      eras[era] = { label: m[2].replace(/\s*\(.*\)\s*$/, "").trim(), color: ERA_COLORS[(+m[1] - 1) % ERA_COLORS.length], s: ey[0] || null, e: ey[ey.length - 1] || null };
      school = null;
    } else if (line.startsWith("## ")) { era = null; school = null; }   // a non-ERA section: stop attributing
    else if ((m = line.match(/^### (.+)$/))) {
      const full = m[1], parts = full.split("·");
      school = parts[0].trim();
      if (era && !schools[school]) schools[school] = { ...parseSpan(parts.slice(1).join("·"), eras[era]), era };
    }
    /* **Name (dates), Place** — works.  The name may itself contain commas
       ("Guillaume IX, Duke of Aquitaine"), so the place is taken after the
       closing bracket, never by splitting the name on a comma. */
    else if (era && school && (m = line.match(/^\*\*(.+?)\s*\(([^)]*)\)(?:,\s*([^*]+?))?\s*\*\*\s*(?:—\s*(.*))?$/))) {
      ensureNode(m[1].trim(), { era, school, dates: parseDates(m[2]), place: (m[3] || "").trim(), works: (m[4] || "").trim() });
    }
  }
}

// ---- parse connections ----
// rel words chosen to match what the engine already draws: kindOf() maps
// "mentored"→mentor, /influenc/→influence, "rivals"→rivalry, everything else
// →collab. SYM (below) lists the symmetric ones.
const REL = {
  "Teacher → pupil": { rel: "mentored", dir: true },
  "Attested influence": { rel: "influenced", dir: true },
  "Patron, employer or champion": { rel: "championed", dir: true },
  "Family": { rel: "family", dir: false },
  "Romantic or marital partners": { rel: "partner", dir: false },
  "Circle, school or group": { rel: "circle", dir: false },
  "Direct collaboration": { rel: "collaborated", dir: false },
  "Rivalry, quarrel or denunciation": { rel: "rivals", dir: false },
};
{
  let era = null, rel = null;
  for (const raw of CONNS.split("\n")) {
    const line = raw.trim();
    let m;
    if ((m = line.match(/^## ERA (\d+)/))) { era = "era" + m[1]; rel = null; }
    else if ((m = line.match(/^### (.+)$/))) { rel = REL[m[1].trim()] || null; }
    else if (rel && (m = line.match(/^\*\*(.+?)\*\*\s*(→|·)\s*\*\*(.+?)\*\*\s*[—–]\s*(.+)$/))) {
      const A = m[1].trim(), B = m[3].trim(), note = m[4].trim();
      const ida = ensureNode(A, { era }), idb = ensureNode(B, { era });
      if (!ida || !idb || ida === idb) continue;
      const key = rel.dir ? `${ida}|${idb}|${rel.rel}` : [ida, idb].sort().join("|") + "|" + rel.rel;
      if (edgeSeen.has(key)) continue; edgeSeen.add(key);
      edges.push({ a: ida, b: idb, rel: rel.rel, note });
    }
  }
}

// figures who appear only in the connections (patrons, theorists, librettists)
for (const n of nodes.values()) if (!n.era) n.era = "era1";

/* Fold connection-only figures into the school of the composer they are most
   tied to, rather than piling them into one undated bucket — the mistake the
   art constellation had to undo later. A few passes let chains resolve. */
{
  const deg = {}, nbrs = {};
  edges.forEach(e => {
    deg[e.a] = (deg[e.a] || 0) + 1; deg[e.b] = (deg[e.b] || 0) + 1;
    (nbrs[e.a] = nbrs[e.a] || []).push(e.b); (nbrs[e.b] = nbrs[e.b] || []).push(e.a);
  });
  for (let pass = 0; pass < 4; pass++) for (const n of nodes.values()) {
    if (n.school) continue;
    let best = null;
    for (const id of nbrs[n.id] || []) {
      const o = nodes.get(id);
      if (!o || !o.school) continue;
      if (!best || (deg[id] || 0) > (deg[best.id] || 0)) best = o;
    }
    if (best) { n.school = best.school; if (best.era) n.era = best.era; }
  }
  for (const n of nodes.values()) if (!n.school) n.school = "Patrons, theorists & circles";
}
// every school a node uses needs a dated entry (for the timeline)
for (const n of nodes.values()) {
  if (!schools[n.school]) schools[n.school] = { ...(eras[n.era] ? { s: eras[n.era].s, e: eras[n.era].e } : { s: null, e: null }), era: n.era };
}

/* tie each still-unconnected composer to their school's best-connected member,
   so schools read as clusters and nobody floats alone */
{
  const deg = {}; edges.forEach(e => { deg[e.a] = (deg[e.a] || 0) + 1; deg[e.b] = (deg[e.b] || 0) + 1; });
  const linked = new Set(); edges.forEach(e => { linked.add(e.a); linked.add(e.b); });
  const bySchool = {}; for (const n of nodes.values()) (bySchool[n.school] = bySchool[n.school] || []).push(n);
  for (const members of Object.values(bySchool)) {
    if (members.length < 2) continue;
    const anchor = members.slice().sort((a, b) => (deg[b.id] || 0) - (deg[a.id] || 0))[0];
    for (const n of members) {
      if (n.id === anchor.id || linked.has(n.id)) continue;
      edges.push({ a: n.id, b: anchor.id, rel: "circle", note: n.school });
      linked.add(n.id);
    }
  }
}

/* Curated signature recordings, used as the AUDIO SEARCH SEED — playClip uses
   disco[0]'s title, so without one the engine just searches the composer's name
   and returns whatever is most famous. For John Cage that was 4'33", which is
   four and a half minutes of silence: the most faithful preview imaginable and
   completely useless. Seed a piece that actually sounds. iTunes credits the
   PERFORMER, not the composer, so a seed only resolves where the release also
   credits the composer — verified per entry before being added here. */
const TRACKS = {
  johncage: [["1948", "In a Landscape", "solo piano — a Cage that makes a sound"]],
};

// ---- enrichment merge (portraits/bios, when those layers exist) ----
const readJSON = p => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } };
const ENR = readJSON(new URL("./classical-enriched.json", import.meta.url)) || { artists: {}, labels: {} };
const BIOS = readJSON(new URL("./classical-bios.json", import.meta.url)) || {};

// ---- emit ----
const q = s => JSON.stringify(s == null ? "" : String(s));
const lifeOf = n => [n.dates && n.dates.text, n.place].filter(Boolean).join(" · ");
const nodeLines = [...nodes.values()].map(n =>
  `n(${q(n.id)},${q(n.name)},${q(n.era)},${q(n.school)},${q(lifeOf(n))},${q(n.works)},${JSON.stringify(n.alsoIn||[])}),`).join("\n");
const edgeLines = edges.map(e => `e(${q(e.a)},${q(e.b)},${q(e.rel)},${q(e.note)}),`).join("\n");
const erasLit = "{\n" + Object.entries(eras).map(([k, v]) => `  ${q(k)}:{label:${q(v.label)},color:${q(v.color)},s:${v.s || "null"},e:${v.e || "null"}},`).join("\n") + "\n}";
const schoolsLit = "{\n" + Object.entries(schools).map(([k, v]) => `  ${q(k)}:{s:${v.s || "null"},e:${v.e || "null"},era:${q(v.era)}},`).join("\n") + "\n}";
const factsOut = {};
for (const n of nodes.values()) {
  const e = ENR.artists[n.id], b = BIOS[n.id], f = {};
  if (e && e.ok) { if (e.title) f.wiki = e.title; if (e.portrait) f.img = e.portrait; }
  if (b && b.blurb) f.blurb = b.blurb;
  if (b && b.bio) f.bio = b.bio;
  if (TRACKS[n.id]) f.disco = TRACKS[n.id];
  if (Object.keys(f).length) factsOut[n.id] = f;
}
const factsLit = Object.keys(factsOut).length
  ? "{\n" + Object.entries(factsOut).map(([k, v]) => `  ${JSON.stringify(k)}:${JSON.stringify(v)},`).join("\n") + "\n}" : "{}";

const out = `/* The Classical Constellation — composers of the Western tradition.
   GENERATED by scripts/import-classical.mjs from the source markdown in
   ~/Desktop/Composers and Musical Movements/ — edit the source and re-run.
   n(id,name,era,school,life,works,alsoIn)  ·  e(idA,idB,relationship,note) */
(()=>{
const n=(id,name,era,school,life,works,alsoIn)=>({id,name,era,role:school,school,alsoIn,life,works,blurb:"",bio:"",disco:[]});
const e=(a,b,rel,note)=>({a,b,rel,note});

const eras=${erasLit};

/* school date-spans, for the timeline x-axis */
const schools=${schoolsLit};

const nodes=[
${nodeLines}
];

const edges=[
${edgeLines}
];

/* enrichment merged by the importer: wiki title, portrait, blurb, bio */
const facts=${factsLit};
const wiki={};
nodes.forEach(x=>{const f=facts[x.id];if(f){Object.assign(x,f);if(f.wiki)wiki[x.id]=f.wiki;}});

window.GENRE_DATA=window.GENRE_DATA||{};
window.GENRE_DATA["classical"]={
  key:"classical",
  name:"The Classical Constellation",
  shortName:"Classical",
  theme:{"bg":"#24121b","glow":"#63203a","deep":"#160a11","panel":"rgba(42,21,30,0.94)"},
  generated:true,written:true,   /* generated by scripts/import-classical.mjs; blurbs+bios are written, so the validator enforces them */
  filterLabel:"All schools",
  roleGroups:[],          /* filter by school, not instrument — see loadGenre */
  bySchool:true,          /* engine flag: this genre filters/groups by school */
  discoAs:{},mbid:{},preview:{},collabs:{},
  sym:["family","partner","circle","collaborated","rivals"],
  eras,schools,nodes,edges,
  lib:{},critics:[],resources:[],wiki,
};
})();
`;
writeFileSync(ROOT + "js/data/classical.js", out);

// ---- report ----
const byEra = {}, bySchool = {}, byRel = {};
for (const n of nodes.values()) { byEra[n.era] = (byEra[n.era] || 0) + 1; bySchool[n.school] = (bySchool[n.school] || 0) + 1; }
for (const e of edges) byRel[e.rel] = (byRel[e.rel] || 0) + 1;
const dated = [...nodes.values()].filter(n => n.dates && (n.dates.born || n.dates.died || n.dates.fl)).length;
console.log(`eras: ${Object.keys(eras).length} | composers: ${nodes.size} | edges: ${edges.length} | schools: ${Object.keys(bySchool).length}`);
console.log("with parsed dates:", dated, `(${Math.round(100 * dated / nodes.size)}%)`, "| with works:", [...nodes.values()].filter(n => n.works).length);
console.log("by era:", JSON.stringify(byEra));
console.log("by relationship:", JSON.stringify(byRel));
const orphans = [...nodes.values()].filter(n => !edges.some(e => e.a === n.id || e.b === n.id)).length;
console.log("orphans:", orphans, "| undated schools:", Object.values(schools).filter(s => !s.s).length);
