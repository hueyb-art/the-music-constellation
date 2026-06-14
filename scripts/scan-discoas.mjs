// Finds individuals who are `member` of a Group/Band node, lack a discoAs, and
// whose OWN-NAME catalogue on MusicBrainz is thin — i.e. their real output is the
// band's. Proposes discoAs=<band>. Writes scripts/_discoas-scan.json.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const UA = "MusicConstellation/1.0 ( hueyb@me.com )";
const sb = { window: {} };
for (const f of ["jazz", "hiphop", "reggae"])
  vm.runInNewContext(readFileSync(join(root, "js/data", f + ".js"), "utf8"), sb, { filename: f });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function mb(url) { const r = await fetch(url, { headers: { "User-Agent": UA } }); if (!r.ok) throw new Error("http " + r.status); return r.json(); }
async function studioAlbums(name) {
  try {
    const d = await mb(`https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent('artist:"' + name.replace(/"/g, "") + '"')}&fmt=json&limit=5`);
    const list = d.artists || []; if (!list.length) return -1;
    const best = list.find((a) => (a.name || "").toLowerCase() === name.toLowerCase()) || list[0];
    await sleep(1150);
    const d2 = await mb(`https://musicbrainz.org/ws/2/release-group?artist=${best.id}&type=album&fmt=json&limit=100`);
    return (d2["release-groups"] || []).filter((rg) => (rg["primary-type"] || "") === "Album" && !(rg["secondary-types"] || []).includes("Compilation")).length;
  } catch (e) { return -2; }
}

// candidates: individual --member--> Group/Band
const cands = [];
for (const [g, G] of Object.entries(sb.window.GENRE_DATA)) {
  const byId = {}; G.nodes.forEach((n) => (byId[n.id] = n));
  const da = G.discoAs || {};
  const seen = new Set();
  for (const e of G.edges.filter((e) => e.rel === "member")) {
    const A = byId[e.a], B = byId[e.b]; if (!A || !B) continue;
    const isBand = (n) => /\b(group|band)\b/i.test(n.role);
    let person, band;
    if (isBand(B) && !isBand(A)) { person = A; band = B; }
    else if (isBand(A) && !isBand(B)) { person = B; band = A; }
    else continue;
    if (da[person.id] || seen.has(person.id)) continue;
    seen.add(person.id);
    cands.push({ g, id: person.id, name: person.name, role: person.role, band: band.name });
  }
}

const out = [];
for (let i = 0; i < cands.length; i++) {
  const c = cands[i];
  const n = await studioAlbums(c.name);
  out.push({ ...c, personalAlbums: n });
  console.log(`[${i + 1}/${cands.length}] ${c.name} (${c.role}) → ${c.band}  | own albums: ${n}`);
  await sleep(1150);
}
writeFileSync(join(root, "scripts/_discoas-scan.json"), JSON.stringify(out, null, 0));
const thin = out.filter((x) => x.personalAlbums >= 0 && x.personalAlbums <= 1);
console.log(`\nDONE. ${cands.length} member-of-band candidates. ${thin.length} have a thin (<=1) own catalogue → discoAs candidates:`);
thin.forEach((x) => console.log(`  ${x.g}: ${x.name} → "${x.band}"  (own: ${x.personalAlbums})`));
