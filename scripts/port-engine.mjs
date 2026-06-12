// One-time migration: slices the legacy hiphop app (newest engine fork) into
// css/style.css, js/engine.js and a body-html snippet, with the inline data
// segments removed (those now live in js/data/*.js). Kept for provenance.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "../hiphop-constellation/index.html"), "utf8");

const between = (s, a, b) => {
  const i = s.indexOf(a), j = s.indexOf(b, i + a.length);
  if (i < 0 || j < 0) throw new Error(`markers not found: ${a} … ${b}`);
  return s.slice(i + a.length, j);
};

const css = between(src, "<style>", "</style>").trim();
const body = between(src, "<body>", "<script>").trim();
let js = between(src, "<script>", "</script>");

// strip data segments now owned by js/data/*.js
const seg = (name, open, close) => new RegExp(`^const ${name}=\\${open}[\\s\\S]*?^\\${close};?$`, "m");
for (const [name, open, close] of [
  ["ERAS", "{", "}"], ["NODES", "[", "]"], ["EDGES", "[", "]"],
  ["LIB", "{", "}"], ["CRITICS", "[", "]"], ["RESOURCES", "[", "]"],
]) js = js.replace(seg(name, open, close), `/*__DATA:${name}__*/`);
js = js.replace(/^const WIKI=.*$/m, "/*__DATA:WIKI__*/");
js = js.replace(/^const SYM=.*$/m, "/*__DATA:SYM__*/");
js = js.replace(/^function n\(.*$/m, "");
js = js.replace(/^const e=\(a,b,rel\)=>.*$/m, "");

mkdirSync(join(root, "css"), { recursive: true });
writeFileSync(join(root, "css/style.css"), css + "\n");
writeFileSync(join(root, "js/engine.js"), js.trim() + "\n");
writeFileSync(join(root, "scripts/_legacy-body.html"), body + "\n");
console.log(`css ${css.split("\n").length} lines, engine ${js.trim().split("\n").length} lines, body ${body.split("\n").length} lines`);
