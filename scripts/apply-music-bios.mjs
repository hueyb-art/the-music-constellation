// Rewrite the blurb (6th) and bio (7th) arguments of each n(...) call in the
// HAND-AUTHORED genre files, by id, leaving every other curated field untouched.
//
//   node scripts/apply-music-bios.mjs <bios.json> [--genre jazz] [--dry] [--identity]
//
// These three files are the canonical source and were written by hand, so this
// does NOT regenerate them the way the art/classical importers do — it edits two
// fields in place. Two hazards it must survive:
//   * names contain escaped quotes: n("coxsone","Clement \"Coxsone\" Dodd",...)
//   * bios must never contain a double quote, since each field is one
//     double-quoted JS string; one stray " breaks the file.
// --identity rewrites every bio with its own current value: the output must come
// back byte-identical, which proves the parser round-trips before it is trusted
// with real edits.
import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const BIOS = args.find(a => !a.startsWith("--"));
const argv = k => { const i = args.indexOf(k); return i < 0 ? null : args[i + 1]; };
const ONLY = argv("--genre"), DRY = args.includes("--dry"), IDENTITY = args.includes("--identity");
const bios = (BIOS && existsSync(BIOS)) ? JSON.parse(readFileSync(BIOS, "utf8")) : {};

/* split a JS argument list at top-level commas, respecting strings, escapes and
   nesting — a naive split on "," destroys the disco array and quoted names */
function splitArgs(src) {
  const out = []; let depth = 0, inStr = false, esc = false, start = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (inStr) { if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === "[" || c === "(" || c === "{") depth++;
    else if (c === "]" || c === ")" || c === "}") depth--;
    else if (c === "," && depth === 0) { out.push(src.slice(start, i)); start = i + 1; }
  }
  out.push(src.slice(start));
  return out;
}
const readStr = lit => { const t = lit.trim(); return (t.startsWith('"') && t.endsWith('"')) ? JSON.parse(t) : null; };

let totals = { files: 0, nodes: 0, changed: 0, skipped: 0 };
for (const g of ["jazz", "hiphop", "reggae"]) {
  if (ONLY && g !== ONLY) continue;
  const path = ROOT + `js/data/${g}.js`;
  const src = readFileSync(path, "utf8");
  const lines = src.split("\n");
  let changed = 0, nodes = 0;
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const m = line.match(/^n\(/); if (!m) continue;
    const close = line.lastIndexOf(")");
    if (close < 0) continue;
    const inner = line.slice(2, close);
    const parts = splitArgs(inner);
    if (parts.length < 8) continue;
    const id = readStr(parts[0]); if (!id) continue;
    nodes++;
    const entry = IDENTITY ? { blurb: readStr(parts[5]), bio: readStr(parts[6]) } : bios[id];
    if (!entry || !entry.bio) { totals.skipped++; continue; }
    if (/"/.test(entry.bio) || /"/.test(entry.blurb || "")) {
      console.error(`  !! ${g}/${id}: contains a double quote — refusing`); totals.skipped++; continue;
    }
    parts[5] = JSON.stringify(entry.blurb || readStr(parts[5]) || "");
    parts[6] = JSON.stringify(entry.bio);
    lines[li] = "n(" + parts.join(",") + line.slice(close);
    changed++;
  }
  const out = lines.join("\n");
  totals.files++; totals.nodes += nodes; totals.changed += changed;
  if (IDENTITY) {
    console.log(`  ${g}: ${nodes} nodes | round-trip ${out === src ? "IDENTICAL ✓" : "DIFFERS ✗"}`);
  } else if (DRY) {
    console.log(`  ${g}: ${nodes} nodes, would rewrite ${changed}`);
  } else {
    copyFileSync(path, path + ".bak");
    writeFileSync(path, out);
    console.log(`  ${g}: ${nodes} nodes, rewrote ${changed} (backup at ${g}.js.bak)`);
  }
}
console.log(`files ${totals.files} | nodes ${totals.nodes} | rewritten ${totals.changed} | skipped ${totals.skipped}`);
