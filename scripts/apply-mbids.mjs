// Inserts verified mbid pin maps into js/data/*.js (after the discoAs property).
// Each pin was confirmed by fetching the artist's real albums from MusicBrainz.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const PINS = {
  jazz: {
    hiromi: "8472f0ce-c57d-46f2-93db-d4a6f6e6473a",     // Hiromi Uehara (Telarc jazz pianist)
    jojones: "ceda2457-e16f-4938-a276-af854b20b22a",    // Jo Jones (Papa Jo Jones)
  },
  hiphop: {
    funky4: "50498fa1-b339-4ac8-9327-d5db0e98a1f8",        // Funky Four (+1 More)
    busybee: "bc7f8533-0ec6-475f-91f8-926e8326989c",       // Busy Bee
    djredalert: "b2c81888-1c43-4253-bc98-1eb66d2a4976",    // Kool DJ Red Alert
    rundmc: "5ecc3f72-20a6-47a0-8dc5-fb0b3dadeea0",        // Run-D.M.C.
    jammasterjay: "5ecc3f72-20a6-47a0-8dc5-fb0b3dadeea0", // → Run-D.M.C. (his catalogue is the group)
    qtip: "b3c94036-6166-41d2-91a2-dc3a0b5fa188",          // Q-Tip
    ultramagnetic: "911fc89f-aea6-463a-9622-b7d8ede07af5", // Ultramagnetic MC's
    gza: "550cb78b-4995-4873-baea-76ef265531f5",           // GZA/Genius
    yoyo: "82335c54-bcdf-465a-b438-2de98ddb74a0",          // Yo-Yo
    puffdaddy: "cabb4fcf-4067-4ba5-908d-76ee66fcf0c6",     // Diddy / Sean Combs
  },
  reggae: {
    bunnylee: "16ad0626-7c09-455c-8841-0cc4b157c22b",      // Bunny Lee
    wailingsouls: "f28a0e2e-d469-4f9d-8080-f5548fc1a239",  // Wailing Souls
    gussieclarke: "4d4a4ac0-07de-4c63-9617-214b5a869655",  // Augustus "Gussie" Clarke
    bobbydigital: "26e73c94-5995-473f-b87d-20be85815773",  // Bobby Digital (Robert Dixon)
    damianmarley: "cbfb9bcd-c5a0-4d7c-865f-2c641c171e1c",  // Damian "Jr. Gong" Marley
    koffee: "7d04679e-a855-4214-9543-febaf02de725",        // Koffee
  },
};

for (const [g, map] of Object.entries(PINS)) {
  const file = join(root, "js/data", g + ".js");
  let src = readFileSync(file, "utf8");
  if (/\bmbid:\{/.test(src)) { console.log(`${g}: mbid already present, skipping`); continue; }
  const entries = Object.entries(map).map(([id, m]) => `${JSON.stringify(id)}:${JSON.stringify(m)}`).join(",");
  const inject = `\n/* Pinned MusicBrainz ids — for artists whose name doesn't resolve (punctuation/\n   ambiguity) or resolves to the wrong artist. Verified against real albums. */\nmbid:{${entries}},`;
  const m = src.match(/discoAs:\{[^}]*\},/);
  if (!m) { console.error(`${g}: could not find discoAs to anchor mbid`); continue; }
  src = src.replace(m[0], m[0] + inject);
  writeFileSync(file, src);
  console.log(`${g}: inserted ${Object.keys(map).length} mbid pins`);
}
