// Validation gate — run before every commit/push: node scripts/validate.mjs
// Dependency-free. Exits non-zero on any failure.
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const fail = (msg) => { failures++; console.error("✗ " + msg); };
const ok = (msg) => console.log("✓ " + msg);

/* 1. Every shipped JS file parses */
const jsFiles = ["js/engine.js", "js/version.js", "js/collab.js", ...readdirSync(join(root, "js/data")).map(f => "js/data/" + f)];
for (const f of jsFiles) {
  try { execFileSync(process.execPath, ["--check", join(root, f)], { stdio: "pipe" }); }
  catch (e) { fail(`${f} does not parse: ${e.stderr}`); }
}
ok(`${jsFiles.length} JS files parse`);

/* 2. index.html references exist */
const html = readFileSync(join(root, "index.html"), "utf8");
for (const m of html.matchAll(/(?:src|href)="((?:js|css)\/[^"]+)"/g)) {
  try { readFileSync(join(root, m[1])); } catch { fail(`index.html references missing file ${m[1]}`); }
}
ok("index.html asset references resolve");

/* 3. Version stamp format */
const ver = readFileSync(join(root, "js/version.js"), "utf8").match(/MC_BUILD="(\d{4}-\d{2}-\d{2})"/);
if (!ver) fail("js/version.js: MC_BUILD must be a YYYY-MM-DD string");
else ok(`build stamp ${ver[1]}`);

/* 4. Genre data integrity */
const sandbox = { window: {} };
for (const f of readdirSync(join(root, "js/data")))
  vm.runInNewContext(readFileSync(join(root, "js/data", f), "utf8"), sandbox, { filename: f });
const genres = sandbox.window.GENRE_DATA || {};
const required = ["key", "name", "shortName", "theme", "filterLabel", "roleGroups", "discoAs", "preview", "sym", "eras", "nodes", "edges", "lib", "critics", "resources", "wiki"];

for (const [key, g] of Object.entries(genres)) {
  const p = (msg) => fail(`${key}: ${msg}`);
  for (const field of required) if (g[field] == null) p(`missing field ${field}`);

  const ids = new Set();
  for (const nd of g.nodes) {
    if (ids.has(nd.id)) p(`duplicate node id "${nd.id}"`);
    ids.add(nd.id);
    for (const field of ["id", "name", "era", "role", "life", "blurb", "bio"])
      if (!nd[field]) p(`node "${nd.id || nd.name}" missing ${field}`);
    if (!g.eras[nd.era]) p(`node "${nd.id}" has unknown era "${nd.era}"`);
    if (!Array.isArray(nd.disco)) p(`node "${nd.id}" disco must be an array`);
  }

  /* A pair may carry several DIFFERENT relationships (e.g. "produced" + "crew");
     the same relationship twice between a pair (either direction) is an error. */
  const seenEdges = new Set();
  for (const ed of g.edges) {
    if (!ids.has(ed.a)) p(`edge references missing node "${ed.a}" (${ed.a}—${ed.b})`);
    if (!ids.has(ed.b)) p(`edge references missing node "${ed.b}" (${ed.a}—${ed.b})`);
    if (ed.a === ed.b) p(`self-edge on "${ed.a}"`);
    if (!ed.rel) p(`edge ${ed.a}—${ed.b} missing relationship`);
    const k = [ed.a, ed.b].sort().join("|") + "|" + ed.rel;
    if (seenEdges.has(k)) p(`duplicate edge ${ed.a}—${ed.b} (${ed.rel})`);
    seenEdges.add(k);
  }

  for (const map of ["lib", "wiki", "preview", "discoAs"])
    for (const id of Object.keys(g[map]))
      if (!ids.has(id)) p(`${map} references missing node "${id}"`);

  for (const [k2, v] of Object.entries(g.eras))
    if (!v.label || !/^#[0-9a-f]{6}$/i.test(v.color)) p(`era "${k2}" needs a label and #rrggbb color`);

  for (const r of g.resources)
    if (!Array.isArray(r) || r.length !== 3 || !/^https:\/\//.test(r[2])) p(`resource ${JSON.stringify(r && r[0])} must be [title, note, https-url]`);

  for (const [re] of g.roleGroups) {
    try { new RegExp(re); } catch { p(`roleGroups pattern "${re}" is not a valid regex`); }
  }

  if (!failures) ok(`${key}: ${g.nodes.length} nodes, ${g.edges.length} edges, ${Object.keys(g.eras).length} eras — all integrity checks pass`);
}
if (!Object.keys(genres).length) fail("no genres registered in js/data/");

if (failures) { console.error(`\n${failures} validation failure(s)`); process.exit(1); }
console.log("\nAll validation checks passed.");
