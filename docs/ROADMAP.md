# Roadmap

## Pending — do after Huey validates the live consolidated site

- [ ] **Legacy repo handover** (deliberately deferred 2026-06-12): once the new site is confirmed working as expected, add a short "superseded by [The Music Constellation](https://github.com/hueyb-art/the-music-constellation)" note to the READMEs of jazz-constellation, hiphop-constellation, and reggae-constellation (creating READMEs for hiphop/reggae, which have none), and add a meta-refresh redirect from each legacy site to the matching genre route. Until then the legacy repos stay untouched and live.

## Nice-to-have, unscheduled

- [ ] Rename the iTunes relay worker (`jazz-itunes.hueyb.workers.dev`) to a genre-neutral name; it serves all genres. Requires redeploying the Cloudflare Worker (docs/itunes-relay-setup.md) and updating `fetchJSON` in js/engine.js. Keep the old route alive a while for legacy sites.
- [ ] Cross-genre bridge edges: the data model already supports them in principle (genre-scoped ids); the engine currently renders one genre at a time. First candidates: Kool Herc's Jamaican sound-system roots (reggae→hiphop), The Roots/Robert Glasper (hiphop↔jazz), sampling lineages.
- [ ] Per-artist deep links (e.g. `#/jazz/miles`) so search results and pages are shareable.
- [ ] Pin MusicBrainz artist ids (`mbid` field is already honored by `resolveAndFetch`) for artists whose name lookup is ambiguous.

## Considered and not planned

- **Unified single-universe view** (all genres in one 3D space with genre-galaxies). Discussed 2026-06-12; parked deliberately — it needs new curation (cross-genre edges), new era/legend UX, and performance work. The switcher architecture doesn't preclude it later.
- **Search aliases** ("Bird" → Charlie Parker) and **cross-genre search results** — offered, declined for now.
