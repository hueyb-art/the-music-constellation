# The Music Constellation — agent context

One web app, three (so far) genre constellations. No build step, no dependencies: plain HTML/CSS/JS served by GitHub Pages from this repo's root. Live at https://hueyb-art.github.io/the-music-constellation/.

## Architecture in one paragraph

`index.html` is the only page; `js/engine.js` is the shared engine (canvas 3D force graph, search, panels, audio previews, live MusicBrainz/Wikipedia data); `js/data/<genre>.js` files register curated datasets on `window.GENRE_DATA`; the engine's `loadGenre()` swaps dataset + theme in place, `switchGenre()` animates the swap, and `#/jazz`-style hash routes select the genre. Genre themes are CSS custom properties registered with `@property` so they cross-fade.

## The workflow (non-negotiable)

1. Make changes (data lives in `js/data/`, never in the engine).
2. `node scripts/validate.mjs` — must pass before any commit. It catches duplicate ids, dangling edges, missing fields, bad regexes, syntax errors.
3. Bump the date in `js/version.js` for user-visible changes.
4. Commit with a real message (not "Add files via upload") and push. CI re-runs validation; Pages republishes in ~1 minute.

Huey's standing rule: always commit AND push when validation passes — but ask questions first if you're about to change something structural.

## Views

Two view modes in engine.js, both genre-themed and routed via the hash:
- **globe** (`#/<genre>`, default) — the 3D force-directed constellation.
- **chord** (`#/<genre>/chord`) — everyone on a ring by era, ties arcing to a living sun, ambient slow spin, deep-space backdrop. **Two-step, silent interaction (NOT the globe's `select()`):** clicking goes through `chordPick()` — 1st click anchors a star (sets `chordAnchor`/`selNode`, lights ties via `computeFocus`) with no card and no audio; 2nd click on one of that star's ties calls `renderChordCollab()`, which opens the side panel as a breakout card (the pair, the relationship chip, and the shared records via the shared `loadCollabInto()` loader) **and plays a preview of one of those shared records** (`playCollabClip()` — Deezer search verified to a collaborator/band, cached per pair under `cclip_<a>_<b>`; the anchor/re-anchor/clear/close paths pause it so audio only sounds while a collab card is open). Clicking a non-tie star re-anchors; empty space clears; the panel close button keeps the anchor (drops back to anchored-and-silent) in chord. `dblclick`→full-page is disabled in chord. Self-contained `drawChordView()` + `drawChordSpace`/`drawSunCorona`/`drawRingFire`; node ring angle is `nd._cang` (set in loadGenre, ordered by era to match the era arcs). `nodeAt()` in chord is **angle-based**: the stars are tiny dots on a thin ring, so instead of hit-testing each dot (you'd have to land exactly on one — "no names when scrolling around" was this), it returns the star whose ring angle (`_cea`) is nearest the cursor's, for any cursor in the ring band (`R*0.6`–`R*1.25`). Hover and click are both forgiving as a result. The highlight is `active=selNode||hoverNode` — the **anchor sticks** (once you click a star its web stays put so you can follow the lines and click its collaborators); hover only previews names *before* anything is anchored. (We briefly tried `hoverNode||selNode` so hover would follow the cursor even while anchored — it broke "click a star then click its collaborator", because the web jumped to whatever you moved over. Don't reintroduce it.) On **touch** there's no hover, so a tap is the only aim — to make selecting a connection reliable, the connection **names** are registered as tappable hitboxes (`chordLabelBoxes`, rebuilt each frame in `drawChordView`; `nodeAt` checks `chordLabelAt` *before* the angular ring test). Tapping a de-collided name selects exactly that artist rather than an angular neighbour. Names/spacing are larger on mobile, and the touch-move handler has a ~10px tap-slop so a wobbly tap isn't misread as a pan. `setView()` switches modes and writes the hash; `parseHash()`/`updateHashView()` keep URL ↔ view in sync; `switchGenre()` preserves the current view in the hash. (`parseHash()` maps any non-`chord` view — including stale `#/<genre>/timeline` links from the removed Timeline view — back to globe.)

## The Rooms

The **Rooms** button (`rrBtn`, was "Reading room") opens `openRooms()` — one full-screen page (reusing `pageInner`/`pageEl`) with three tabs held in `roomTab`: **Reading** (`critics`, then `archives` under "Archives & primary sources", then `resources` under "Periodicals & community"), **Films & docs** (`films`), **Deep cuts** (`deepcuts`). Each tab has its own `room*HTML()` builder. Deep-cut entries with an `id` matching a node render the artist as a link that calls `openPage(nd)`; listen links come from the shared `svc()`. Data shapes and how to add entries are in docs/DATA-FORMAT.md. `films`/`deepcuts` are optional per genre (engine reads `G.films||[]`).

## Instrument tag

Every node carries `nd.roleTag` (the primary segment of its curated `role`, e.g. "Trumpet", "Arranger", "Producer"), set in `loadGenre`. Both views draw it as a small gold line under the name **only while exploring** — the hovered/anchored musician and their lit connections (globe gates on `focusSet`; chord shows it for every label, which are always the focus set). It's free across all genres because it reads the existing `role`. Changing what shows: globe in the name loop in `draw()`, chord in the `if(active)` label block in `drawChordView()` (note the de-collision `gap` and tap-hitbox were widened for the second line).

## Conventions and gotchas

- **All MusicBrainz access goes through `js/collab.js`** (`window.MB.get`), a single rate-limited request queue shared by discographies and collaboration lookups so they never collide on MB's ~1 req/sec limit. `window.MB.collab(nameA, nameB, cacheKey)` returns deduped shared recordings; used by the app's connection cards (the ♪ expander in `toggleCollab`) and the prototype's Solar view. Loaded before engine.js in index.html.
- **`js/data/*.js` are the canonical source.** `scripts/extract-legacy.mjs` and `port-engine.mjs` were one-time migration tools from the three legacy repos (../jazz-constellation etc.) and are frozen — re-running extract-legacy would resurrect data bugs that were fixed here after extraction (see docs/LEARNINGS.md).
- A pair of artists may have multiple edges with *different* relationships ("produced" + "crew"); the same relationship twice is a validation error.
- Directional relationship words live in `REL_DIR` in engine.js (union across genres); symmetric words per genre in each data file's `sym`.
- localStorage keys are namespaced `tmc_<genre>_…` because this origin is shared with the legacy sites (which use `jc_…`). Don't change prefixes casually — it orphans users' caches.
- The iTunes relay (`https://jazz-itunes.hueyb.workers.dev`) is genre-agnostic despite the name; deployment guide in docs/itunes-relay-setup.md.
- Preview-test locally: `.claude/launch.json` serves the repo on :8741 (python http.server). The genre switch, search ("stephane", "thelonius"), node select, photo-zoom (`tzoom=1.8` after `centerOn`), and the Chord web toggle (ring stays grouped by era; globe re-inflates on return) are the key manual checks.
- A Timeline/depth-voyage view existed earlier and was fully removed on 2026-06-14 (Huey only wanted globe + chord). All of its state and renderers are gone from engine.js; `#/<genre>/timeline` URLs now resolve to globe. Don't reintroduce it without an explicit ask. (Prototype code for time views still lives in `prototypes/views.html`.)
- The preview panel pauses requestAnimationFrame when hidden — for physics assertions in evals, pump `step()` manually instead of waiting.
- Mobile layout kicks in under 700px width; the bottom-sheet panel replaces the side panel.

## Where things are documented

- docs/ROADMAP.md — deferred work, including the post-validation step for the legacy repos
- docs/DATA-FORMAT.md — how to add artists, connections, or a whole genre
- docs/LEARNINGS.md — running log of non-obvious findings; append as you learn
- README.md — public-facing overview
