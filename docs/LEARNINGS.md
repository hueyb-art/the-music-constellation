# Learnings

A running log of non-obvious findings. Append, don't rewrite.

## 2026-06-14 — chord-web as the favourite

- The Era chord-web (prototype) became Huey's favourite view; built it up: hover/pin a star to light its chords AND name every node they land on (radial labels just outside the ring, anchored left/right by angle), click a pinned star's connection to open the shared-recordings panel (reuses window.MB.collab), and an animated "living sun" corona (pulsing core + flickering lighter-blend flares) where the chords converge. `frame` counter drives the animation; the prototype draw loop already runs rAF continuously so animation was free.
- Known rough edge: when a hub's connections cluster within one era arc, their outward names overlap (no radial label de-collision yet). Fine for low-degree stars; a hub like Miles stacks. If promoted, add angular label nudging.

## 2026-06-14 — tightening "peer" labels with a data-assisted pass

- 249 edges were tagged "peer"; many undersold real collaborations (Frisell/Scofield made *Grace Under Pressure*). Rather than relabel from memory (error-prone), ran an empirical audit: `scripts/audit-peers.mjs` queries MusicBrainz co-credit count for every peer pair → `scripts/_peer-audit.json`. 110/249 had co-credits.
- Curation rule (in the generator that built `_peer-decisions.json`), conservative because a false "collaborated" is worse than leaving a real one as "peer": **hip hop & reggae** upgrade at count≥3 (features are explicitly co-credited, reliable signal) but founding pioneers (Herc/Bambaataa/Flash) stay peers; **jazz** needs count≥8 (old compilations/loose matching inflate low counts) with skeptic-exclusions for comp artifacts (two-drummer Philly Joe/Blakey=15, Oliver/Morton=14, Reeves/Cassandra=11); plus a short manual set for documented collabs MB misses (Frisell/Scofield sideman, Evan Parker/Brötzmann, AJ Tracey/Dave, Stormzy/Dave, Capleton/Anthony B). Result: 80 upgraded, 169 stayed peer.
- Tooling kept (`audit-peers.mjs`, `apply-peer-upgrades.mjs`, `_peer-audit.json`, `_peer-decisions.json`) so the pass is reproducible/extendable. Lesson: when relabeling curated data at scale, drive it from an external signal + an explicit, conservative rule, not vibes.

## 2026-06-14 — connections must always reveal their nature

- MusicBrainz co-credit search is blind to SIDEMAN sessions: "Grace Under Pressure" is credited to "John Scofield" only, so Frisell/Motian/Haden (who played on it) return 0 on `artist:"A" AND artist:"B"`. Verified by curl. Catching these needs per-release relationship crawling (dozens of requests/click) — not viable inline.
- The fix isn't more MusicBrainz, it's product: the collab panel now ALWAYS leads with the curated relationship ("bandmate", "X mentored Y" — from the edge `rel`, directional words via REL_DIR, symmetric via the genre's `sym`), so a line means something even with zero co-credits; then it lists co-credited records (recordings + releases) if any; and ALWAYS offers a "hear their work together" search (Spotify/YouTube/**Discogs** — Discogs indexes sideman credits, so it surfaces exactly the sessions MusicBrainz misses). Empty state is reframed from "no collaborations" to "no co-credited records — sideman sessions often aren't indexed."
- Lesson: when an automated data source has a structural blind spot, don't present its silence as truth — show the curated fact you DO have, and hand off to a source that covers the gap.

## 2026-06-13 — hard data for collaborations

- MusicBrainz co-credit recording search (`recording?query=artist:"A" AND artist:"B"`) is a genuinely good, free source for "what did these two make together": excellent for joint billings and hip-hop features (Jay-Z × Kanye returns 200+), decent for jazz duos; uncredited-sideman-only sessions can be partial. Dedupe by normalised title, keep earliest year, sort.
- Consolidated ALL MusicBrainz access into one rate-limited queue (`js/collab.js` `window.MB.get`, a serial promise chain ≥1.1s apart) so discographies and collab lookups can't both fire inside the 1 req/sec window. engine.js's `mbFetch` now delegates to it.
- Preview-verification gotcha: the preview browser aggressively caches subresources (`js/engine.js`), so after editing engine.js a reload can still run the OLD code (`toggleCollab` undefined) even though the dev server serves the new file (confirm with `curl localhost:.../js/engine.js | grep`). Brand-new files (collab.js) and inline scripts in cache-busted HTML (the prototype) load fresh, so verify new logic there; confirm the cached file's wiring via curl+grep on the server.

## 2026-06-13 — the timeline became a voyage

- The horizontal road was rebuilt as a depth voyage (time runs into the screen, you fly through it). The road's lessons carried over directly: enforce camera invariants in the frame loop, clamp every free axis, give released gestures momentum. One reversal: depth shading and depth-based label priority — disabled on the flat road because micro-jitter made them flicker — are correct again in the voyage, where depth is macro-scale chronology, smooth and meaningful.

## 2026-06-12 — consolidation from the three legacy repos

- **Fork drift was real and shipping bugs.** The three legacy apps forked one engine: jazz had the older, unverified preview logic (could play the wrong artist); the hiphop site's `<title>` said "The Reggae Constellation" (never updated when forked); hiphop's engine carried reggae's `DISCO_AS` ids. Consolidating to one engine ended the class of bug.
- **The first validation run caught 10 multi-edges; 4 were genuine data bugs** (a chronologically backwards `popsmoke→chiefkeef influenced`, a reversed `burningspear→coxsone produced`, a doubled symmetric peer edge, a redundant bandmate+collaborated pair). The other 6 were legitimate dual relationships — the validator now keys duplicates on pair+relationship.
- **`js/data/*.js` were extracted once from the legacy repos and then hand-fixed.** Never re-run `scripts/extract-legacy.mjs` expecting current data — it would resurrect the 4 removed edges.
- **The silent-WAV audio-unlock blob must be byte-exact.** Its RIFF header declares the data length; truncating the base64 corrupts it and silently breaks audio unlock on iOS.
- **All hueyb-art.github.io sites share one localStorage origin.** Legacy sites use `jc_*` keys; this app namespaces `tmc_<genre>_*`. Without namespacing, same node ids across genres would cross-contaminate caches.
- **MusicBrainz strings must be HTML-escaped** before innerHTML — it's a community-editable database (release titles can contain markup). `esc()` in engine.js covers discography rendering.
- **thingproxy.freeboard.io is dead**; it was removed from the CORS fallback chain. Chain is now: own Cloudflare relay → direct → corsproxy.io → allorigins.
- **Canvas photo candidates must be filtered to the viewport** — at high zoom most high-priority nodes are off-screen and would silently consume the photo budget.
- When testing via the preview panel, the page can reload between eval calls (state resets to `tmc_last` genre) — do multi-step assertions in a single atomic eval.
- **A hidden preview panel pauses requestAnimationFrame entirely** — positions freeze and look like a crashed loop (no console error, `tick` static). Check `document.hidden` before debugging; pump `step()` manually in an eval to test physics.
- **Pinned springs + hard collisions = permanent jitter.** Same-year artists pinned to near-identical targets shove each other forever if collision kicks are hard (force ~1/d at tiny distances); soften and cap the collision and raise damping and the layout settles to zero movement. Related: any visual property derived from depth (label size/alpha, draw priority) is pure noise on a flat layout — light uniformly and use stable tiebreaks there, or labels flicker.
- **Era lanes need springs + contact collision, not long-range repulsion.** In timeline mode, any inverse-square repulsion (even at 40% strength) overwhelms a lane spring across 230 nodes and smears the bands together; zeroing repulsion and keeping only the `minD` collision term holds lanes cleanly with x pinned to years.
- Every node in all three genres has parseable years in `life` (verified 2026-06-12) — the timeline relies on this; keep new entries in the `1901–1971` / `b.1930` format.
- **The moment a mode introduces free panning, clamp every pan axis.** The stretched timeline shipped with x clamped but y unbounded — vertical drag could push all lanes off screen with no way to know where they went. Same family as the axis bug: enforce view invariants in the loop.
- Verifying in the preview panel while Huey is also using it is racy — toggles double-fire and pan targets drift mid-eval. Check current state before acting (e.g. `if(viewMode!=="timeline")`) and assert within a single eval.
- **Mode-dependent camera state must be continuously enforced, not set once.** The timeline axis fades with `|yaw|+|pitch|`; originally rotation was only eased to zero by a one-shot animation when entering timeline mode, so a drag (or Fit) during that second cancelled the easing and stranded the axis invisible — found by Huey after ~15 minutes of real use. The loop now always eases the camera flat while in timeline mode. General rule: an invariant ("flat in timeline") belongs in the frame loop, not in the transition.
