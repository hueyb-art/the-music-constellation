// One-time migration: extracts genre data from the three legacy single-file apps
// (../jazz-constellation etc.) into js/data/<genre>.js. Kept for provenance; the
// data files in js/data/ are the canonical source going forward.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const GENRES = {
  jazz: {
    legacy: "../jazz-constellation/index.html",
    name: "The Jazz Constellation",
    shortName: "Jazz",
    theme: { bg: "#0c0a0d", glow: "#1a1420", deep: "#08070a", panel: "rgba(22,18,24,0.93)" },
    filterLabel: "All instruments",
    roleGroups: [
      ["trumpet|cornet|flugel", "Trumpet"], ["reeds|sax", "Saxophone"], ["clarinet", "Clarinet"],
      ["piano", "Piano"], ["organ|keyboard", "Organ & keys"], ["bass", "Bass"], ["drums", "Drums"],
      ["guitar", "Guitar"], ["trombone", "Trombone"], ["vibraphone|vibes", "Vibraphone"],
      ["violin", "Violin"], ["harmonica", "Harmonica"], ["harp", "Harp"], ["voice", "Voice"],
      ["composer|arranger|bandleader|theorist|producer", "Composer & arranger"],
    ],
    discoAs: {},
    preview: {},
  },
  hiphop: {
    legacy: "../hiphop-constellation/index.html",
    name: "The Hip Hop Constellation",
    shortName: "Hip Hop",
    theme: { bg: "#0a1633", glow: "#23489a", deep: "#060e22", panel: "rgba(12,20,40,0.94)" },
    filterLabel: "All roles",
    roleGroups: [
      ["dj|turntablist|scratch", "DJ/Turntablist"], ["produc|beatmak", "Producer"],
      ["mogul|executive|label|ceo|impresario", "Mogul/Exec"], ["beatbox", "Beatboxer"],
      ["graffiti|b-boy|bboy|breaker|dancer", "Culture"], ["group|crew|duo|trio|collective", "Group/Crew"],
      ["mc|rapper|emcee|vocal", "MC/Rapper"],
    ],
    discoAs: {},
    preview: {
      crazylegs: { artist: "Rock Steady Crew", q: "Rock Steady Crew Hey You" },
      theneptunes: { artist: "Clipse", q: "Clipse Grindin" },
      jammasterjay: { did: 79236 },
      scottlarock: { did: 8618 },
      souljaboy: { did: 352219 },
      puffdaddy: { did: 173581 },
      keithcowboy: { artist: "Grandmaster Flash & The Furious Five", q: "Grandmaster Flash The Message" },
      juicecrew: { artist: "Marley Marl", q: "Marley Marl The Symphony" },
      chuckd: { artist: "Public Enemy", q: "Public Enemy Fight the Power" },
      questlove: { artist: "The Roots", q: "The Roots You Got Me" },
      rickrubin: { artist: "Beastie Boys", q: "Beastie Boys Fight for Your Right" },
      madlib: { artist: "Madvillain", q: "Madvillain Accordion" },
      busybee: { artist: "Busy Bee", q: "Busy Bee Suicide" },
      tooshort: { q: "Too Short Blow the Whistle" },
      deathrow: { artist: "Dr. Dre", q: "Dr. Dre Nuthin but a G Thang" },
      badboy: { artist: "The Notorious B.I.G.", q: "Notorious B.I.G. Hypnotize" },
      cashmoney: { artist: "Lil Wayne", q: "Lil Wayne A Milli" },
      tde: { artist: "Kendrick Lamar", q: "Kendrick Lamar HUMBLE" },
    },
  },
  reggae: {
    legacy: "../reggae-constellation/index.html",
    name: "The Reggae Constellation",
    shortName: "Reggae",
    theme: { bg: "#07331c", glow: "#1a5e38", deep: "#041e10", panel: "rgba(10,31,19,0.94)" },
    filterLabel: "All roles",
    roleGroups: [
      ["producer|label|studio", "Producer"], ["engineer|dub|mixing", "Engineer & dub"],
      ["deejay|dj|toaster|toasting|mc|rapper", "Deejay/MC"], ["voc|singer|voice", "Vocals"],
      ["bass", "Bass"], ["drum|percussion", "Drums"], ["guitar", "Guitar"],
      ["keyboard|organ|piano|melodica", "Keys"], ["sax", "Saxophone"], ["trombone", "Trombone"],
      ["trumpet", "Trumpet"], ["poet", "Dub poet"], ["band|group", "Band/Group"],
    ],
    discoAs: {
      tootshibbert: "Toots & The Maytals",
      familyman: "Bob Marley and the Wailers",
      carltonbarrett: "Bob Marley and the Wailers",
    },
    preview: {
      tootshibbert: { artist: "Toots and the Maytals", q: "Toots and the Maytals" },
      bobmarley: { did: 719 },
      charliechaplin: { q: "Charlie Chaplin Tribute to Reggae", only: true },
      scientist: { q: "Scientist Vampires Dub" },
      koffee: { q: "Koffee Toast" },
      coxsone: { artist: "The Skatalites", q: "The Skatalites Guns of Navarone" },
      bunnylee: { artist: "Johnny Clarke", q: "Johnny Clarke None Shall Escape the Judgement" },
      winstonriley: { artist: "Tenor Saw", q: "Tenor Saw Ring the Alarm" },
      carltonbarrett: { did: 719 },
      bobbydigital: { artist: "Sizzla", q: "Sizzla Black Woman and Child" },
    },
  },
};

function segment(src, name, open, close) {
  const re = new RegExp(`^const ${name}=\\${open}[\\s\\S]*?^\\${close};?$`, "m");
  const m = src.match(re);
  if (!m) throw new Error(`segment ${name} not found`);
  return m[0];
}
function lineSegment(src, name) {
  const re = new RegExp(`^const ${name}=.*$`, "m");
  const m = src.match(re);
  if (!m) throw new Error(`line segment ${name} not found`);
  return m[0];
}

const js = (v) => JSON.stringify(v);

for (const [key, cfg] of Object.entries(GENRES)) {
  const src = readFileSync(join(root, cfg.legacy), "utf8");
  const code = [
    "const n=(id,name,era,role,life,blurb,bio,disco)=>({id,name,era,role,life,blurb,bio,disco});",
    "const e=(a,b,rel)=>({a,b,rel});",
    segment(src, "ERAS", "{", "}"),
    segment(src, "NODES", "[", "]"),
    segment(src, "EDGES", "[", "]"),
    segment(src, "LIB", "{", "}"),
    segment(src, "CRITICS", "[", "]"),
    segment(src, "RESOURCES", "[", "]"),
    lineSegment(src, "WIKI"),
    lineSegment(src, "SYM"),
    "({ERAS,NODES,EDGES,LIB,CRITICS,RESOURCES,WIKI,SYM})",
  ].join("\n");
  const d = vm.runInNewContext(code, {}, { filename: `${key}-extract` });

  const nodeLines = d.NODES.map(
    (x) => `n(${js(x.id)},${js(x.name)},${js(x.era)},${js(x.role)},${js(x.life)},${js(x.blurb)},${js(x.bio)},${js(x.disco)}),`
  );
  const edgeLines = d.EDGES.map((x) => `e(${js(x.a)},${js(x.b)},${js(x.rel)}),`);
  const eraLines = Object.entries(d.ERAS).map(([k, v]) => `  ${js(k)}:{label:${js(v.label)},color:${js(v.color)}},`);
  const libLines = Object.entries(d.LIB).map(([k, v]) => `  ${js(k)}:${js(v)},`);
  const criticLines = d.CRITICS.map((c) => `  ${js(c)},`);
  const resourceLines = d.RESOURCES.map((r) => `  ${js(r)},`);
  const wikiLines = Object.entries(d.WIKI).map(([k, v]) => `  ${js(k)}:${js(v)},`);

  const out = `/* ${cfg.name} — curated data. Edit here; the engine (js/engine.js) renders it.
   Format: n(id, name, eraKey, role, life, blurb, bio, essentialDisco[[year,title,note],…])
           e(idA, idB, relationship)  — relationship words listed in sym are symmetric. */
(()=>{
const n=(id,name,era,role,life,blurb,bio,disco)=>({id,name,era,role,life,blurb,bio,disco});
const e=(a,b,rel)=>({a,b,rel});

const eras={
${eraLines.join("\n")}
};

const nodes=[
${nodeLines.join("\n")}
];

const edges=[
${edgeLines.join("\n")}
];

/* Biographies & further reading shown on artist pages */
const lib={
${libLines.join("\n")}
};

/* Reading room: critics & historians */
const critics=[
${criticLines.join("\n")}
];

/* Reading room: external resources [title, note, url] */
const resources=[
${resourceLines.join("\n")}
];

/* Wikipedia page-title overrides for photo lookups */
const wiki={
${wikiLines.join("\n")}
};

window.GENRE_DATA=window.GENRE_DATA||{};
window.GENRE_DATA[${js(key)}]={
  key:${js(key)},
  name:${js(cfg.name)},
  shortName:${js(cfg.shortName)},
  theme:${js(cfg.theme)},
  filterLabel:${js(cfg.filterLabel)},
  /* role → filter-category rules, first match wins: [regex, label] */
  roleGroups:${js(cfg.roleGroups)},
  /* artists whose own catalogue is thin: pull this act's discography instead */
  discoAs:${js(cfg.discoAs)},
  /* preview overrides: did = pinned Deezer artist id, artist = exact name a clip
     must match, q = search query, only = trust only q (famous-namesake collisions) */
  preview:${js(cfg.preview)},
  sym:${js(d.SYM)},
  eras,nodes,edges,lib,critics,resources,wiki,
};
})();
`;
  writeFileSync(join(root, "js/data", `${key}.js`), out);
  console.log(`${key}: ${d.NODES.length} nodes, ${d.EDGES.length} edges, ${Object.keys(d.ERAS).length} eras, ${d.CRITICS.length} critics, ${Object.keys(d.WIKI).length} wiki overrides`);
}
