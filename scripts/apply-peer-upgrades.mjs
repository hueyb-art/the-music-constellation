// Applies a curated list of peer→collaborated (or other) upgrades to js/data/*.js.
// Edit UPGRADES below, then: node scripts/apply-peer-upgrades.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// [genre, idA, idB, newRel] — idA/idB order must match how the edge appears in the data file.
const UPGRADES = JSON.parse(readFileSync(join(root, "scripts/_peer-decisions.json"), "utf8"));

const byGenre = {};
for (const u of UPGRADES) (byGenre[u[0]] = byGenre[u[0]] || []).push(u);

let changed = 0, missed = [];
for (const [g, ups] of Object.entries(byGenre)) {
  const file = join(root, "js/data", g + ".js");
  let src = readFileSync(file, "utf8");
  for (const [, a, b, rel] of ups) {
    const from1 = `e("${a}","${b}","peer")`, from2 = `e("${b}","${a}","peer")`;
    if (src.includes(from1)) { src = src.replace(from1, `e("${a}","${b}","${rel}")`); changed++; }
    else if (src.includes(from2)) { src = src.replace(from2, `e("${b}","${a}","${rel}")`); changed++; }
    else missed.push(`${g}: ${a} <> ${b}`);
  }
  writeFileSync(file, src);
}
console.log(`Applied ${changed} upgrades.`);
if (missed.length) { console.log("NOT FOUND (check ids/order):"); missed.forEach((m) => console.log("  " + m)); }
