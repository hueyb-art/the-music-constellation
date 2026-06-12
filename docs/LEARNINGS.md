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
