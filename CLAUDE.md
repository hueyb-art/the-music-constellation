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

## Conventions and gotchas

- **`js/data/*.js` are the canonical source.** `scripts/extract-legacy.mjs` and `port-engine.mjs` were one-time migration tools from the three legacy repos (../jazz-constellation etc.) and are frozen — re-running extract-legacy would resurrect data bugs that were fixed here after extraction (see docs/LEARNINGS.md).
- A pair of artists may have multiple edges with *different* relationships ("produced" + "crew"); the same relationship twice is a validation error.
- Directional relationship words live in `REL_DIR` in engine.js (union across genres); symmetric words per genre in each data file's `sym`.
- localStorage keys are namespaced `tmc_<genre>_…` because this origin is shared with the legacy sites (which use `jc_…`). Don't change prefixes casually — it orphans users' caches.
- The iTunes relay (`https://jazz-itunes.hueyb.workers.dev`) is genre-agnostic despite the name; deployment guide in docs/itunes-relay-setup.md.
- Preview-test locally: `.claude/launch.json` serves the repo on :8741 (python http.server). The genre switch, search ("stephane", "thelonius"), node select, photo-zoom (`tzoom=1.8` after `centerOn`), and the Timeline toggle (lanes stay separated per era; globe re-inflates on return) are the key manual checks.
- Timeline mode (`viewMode` in engine.js) repositions the same nodes: each star is pinned to its debut year (first essential record; lifespan midpoint if no records survive), its career line spans the `life` years (`TL.pxy` world-units per year — the world is a long road, thousands of px wide), y springs to the era lane, and only contact collision remains (long-range repulsion would smear the lanes). Drag and scroll-wheel travel along the years (ctrl/meta+wheel zooms); both pan axes are clamped in `loop()`; `frameTimeline()` fits the lanes vertically and starts at the genre's origins.
- The preview panel pauses requestAnimationFrame when hidden — for physics assertions in evals, pump `step()` manually instead of waiting.
- Mobile layout kicks in under 700px width; the bottom-sheet panel replaces the side panel.

## Where things are documented

- docs/ROADMAP.md — deferred work, including the post-validation step for the legacy repos
- docs/DATA-FORMAT.md — how to add artists, connections, or a whole genre
- docs/LEARNINGS.md — running log of non-obvious findings; append as you learn
- README.md — public-facing overview
