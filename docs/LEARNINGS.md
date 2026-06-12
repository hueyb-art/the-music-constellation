# Learnings

A running log of non-obvious findings. Append, don't rewrite.

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
