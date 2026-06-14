// One-off audit: for every "peer" edge, ask MusicBrainz whether the two artists
// have co-credited recordings/releases. Pairs that do are demonstrable
// collaborations (the "peer" label undersells them). Writes scripts/_peer-audit.json.
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
async function mb(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error("http " + r.status);
  return r.json();
}
async function coCount(a, b) {
  const clean = (s) => s.replace(/"/g, "").trim();
  const q = encodeURIComponent(`artist:"${clean(a)}" AND artist:"${clean(b)}"`);
  try {
    const d = await mb(`https://musicbrainz.org/ws/2/recording?query=${q}&fmt=json&limit=3`);
    return d.count || 0;
  } catch (e) { return -1; }
}

const out = [];
let n = 0, total = 0;
for (const [g, G] of Object.entries(sb.window.GENRE_DATA))
  total += G.edges.filter((e) => e.rel === "peer").length;

for (const [g, G] of Object.entries(sb.window.GENRE_DATA)) {
  const byId = {}; G.nodes.forEach((x) => (byId[x.id] = x));
  for (const e of G.edges.filter((e) => e.rel === "peer")) {
    await sleep(1150);
    const c = await coCount(byId[e.a].name, byId[e.b].name);
    n++;
    out.push({ g, a: e.a, b: e.b, names: byId[e.a].name + " / " + byId[e.b].name, count: c });
    if (c > 0) console.log(`[${n}/${total}] ✓ ${c}  ${g}: ${byId[e.a].name} / ${byId[e.b].name}`);
    else if (n % 25 === 0) console.log(`[${n}/${total}] …`);
  }
}
writeFileSync(join(root, "scripts/_peer-audit.json"), JSON.stringify(out, null, 0));
const hits = out.filter((x) => x.count > 0);
console.log(`\nDONE. ${hits.length}/${total} peer pairs have co-credited records on MusicBrainz.`);
