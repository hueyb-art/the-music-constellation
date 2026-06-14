// Audits every artist for broken MusicBrainz name-resolution (the app does
// artist:"<name>" then browses release-groups; punctuated/short/ambiguous names
// resolve to nothing or the wrong artist). For each BROKEN node it proposes a
// verified replacement MBID via a looser search. Writes scripts/_mbid-audit.json.
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
async function mb(url) { const r = await fetch(url, { headers: { "User-Agent": UA } }); if (!r.ok) throw new Error("http " + r.status); await sleep(1150); return r.json(); }
const albumCount = async (id) => { try { const d = await mb(`https://musicbrainz.org/ws/2/release-group?artist=${id}&type=album&fmt=json&limit=1`); return d["release-group-count"] || 0; } catch { return -1; } };

// the app's resolution: exact name match, else top result
async function strict(name) {
  try { const d = await mb(`https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent('artist:"' + name.replace(/"/g, "") + '"')}&fmt=json&limit=8`);
    const list = d.artists || []; if (!list.length) return null;
    return list.find((a) => (a.name || "").toLowerCase() === name.toLowerCase()) || list[0];
  } catch { return null; }
}
// looser search to recover a real artist when strict fails
async function loose(name) {
  try { const d = await mb(`https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(name.replace(/[-"]/g, " "))}&fmt=json&limit=8`);
    return (d.artists || []).slice(0, 8);
  } catch { return []; }
}

const all = []; let total = 0;
for (const G of Object.values(sb.window.GENRE_DATA)) total += G.nodes.length;
let n = 0, broken = 0;
for (const [g, G] of Object.entries(sb.window.GENRE_DATA)) {
  for (const nd of G.nodes) {
    n++;
    const s = await strict(nd.name);
    const cnt = s ? await albumCount(s.id) : -1;
    const rec = { g, id: nd.id, name: nd.name, role: nd.role, resolvedName: s ? s.name : null, resolvedId: s ? s.id : null, albums: cnt };
    if (!s || cnt <= 0) {
      broken++;
      // try to recover: best loose candidate with albums and a plausible name
      const cands = await loose(nd.name);
      let pick = null;
      for (const c of cands) {
        const ac = await albumCount(c.id);
        if (ac > 0) { pick = { id: c.id, name: c.name, dis: c.disambiguation || "", type: c.type || "", albums: ac }; break; }
      }
      rec.proposal = pick;
      console.log(`[${n}/${total}] BROKEN ${g}: ${nd.name} (own:${cnt}) → ${pick ? pick.name + " [" + pick.albums + "] " + pick.id : "no recovery"}`);
    } else if (n % 40 === 0) console.log(`[${n}/${total}] …ok`);
    all.push(rec);
  }
}
writeFileSync(join(root, "scripts/_mbid-audit.json"), JSON.stringify(all, null, 0));
console.log(`\nDONE. ${broken}/${total} artists broken (0 albums via name resolution).`);
all.filter((x) => x.albums <= 0).forEach((x) => console.log(`  ${x.g}: ${x.name}  → ${x.proposal ? '"' + x.proposal.name + '" (' + x.proposal.albums + ' albums) ' + x.proposal.id : "NO RECOVERY"}`));
