# Data format

All curation lives in `js/data/<genre>.js`. Each file is an IIFE that registers one object on `window.GENRE_DATA`. Run `node scripts/validate.mjs` after any edit.

## Adding an artist

Add one `n(...)` line to the `nodes` array, in the appropriate era section:

```js
n("id","Name","eraKey","Role · role2","1901–1971 · American","One-line hook for the card.","Full biography paragraph for the encyclopedia page.",[["1959","Album Title","optional note"],...]),
```

- `id`: lowercase a–z0–9, unique within the genre. Used in edges, lib, wiki, preview, discoAs.
- `era`: must be a key of the file's `eras` object.
- `role`: the part before the first `·` drives the instrument/role filter (see `roleGroups`).
- `disco`: the *essentials* fallback shown if MusicBrainz is unreachable; the live discography loads automatically.
- Optional: add `mbid` to a node object to pin its MusicBrainz artist id when name lookup is ambiguous.

## Adding a connection

```js
e("idA","idB","relationship"),
```

- Symmetric words (listed in the file's `sym` array) read the same from both sides: peer, bandmate, collaborated…
- Directional words are translated per side by `REL_DIR` in js/engine.js: mentored, influenced, produced, member, founded, signed, dj, engineered, arranged for. Order matters: `e("mentor","student","mentored")`.
- Line styling is automatic: mentored = thick, influence = dashed, rivals/beef = dotted red, everything else = solid.
- A pair may have several edges with different relationships; the same relationship twice is a validation error.

## Supporting maps (all keyed by node id; validated)

- `lib` — books for an artist's page: `{bios:[[author,title,year],…], reads:[…]}`
- `wiki` — Wikipedia page-title override when the artist's name is ambiguous (drives photos)
- `preview` — audio preview overrides. Apple/iTunes is resolved first (by `artist` + `q`); these mainly tune the **Deezer fallback**: `{did:<deezer artist id>}` pins the Deezer artist; `{artist, q}` matches `artist` and searches the `q` query (used by both Apple and Deezer); `only:true` keeps a famous-namesake artist to the specific `q` on Deezer only (skips name-based and Apple searches)
- `discoAs` — pull another act's discography (sidemen with thin solo catalogues)

## The rooms (Reading / Films / Deep Cuts)

The **Rooms** button opens one page with three tabs, each backed by a per-genre array:

- `critics` — Reading tab: `[{name, note, books:[[title, year], …]}, …]`
- `resources` — Reading tab "Periodicals & community": `[[title, note, https-url], …]`
- `archives` — Reading tab "Archives & primary sources" (optional): `[[title, note, https-url], …]`. For serious institutional collections (Library of Congress, Smithsonian, university archives). Same shape as `resources`, rendered in its own section above the periodicals.
- `radio` — Reading tab "Radio & airwaves" (optional): `[[name, note, https-url], …]`. Stations and shows; same shape as `resources`.
- `films` — Films & docs tab: `[{title, year, director, note, url?}, …]`. `url` is optional; without it the app shows YouTube + "where to watch" search links built from the title.
- `deepcuts` — Deep Cuts tab: `[{title, artist, year, kind, note, id?}, …]`. `kind` is a free label ("Album", "Track", "Project"). `id` is optional — set it to a node id and the artist name becomes a link that opens that artist's page; listen links (Spotify/Apple/YouTube) are generated automatically from `artist + title`. The validator checks that any `id` references a real node.

- `refs` — Deep Cuts tab "Reference shelf" (optional): `[{title, author, year, note}, …]`. Guides, encyclopedias and listening references (distinct from the Reading tab's biographer/critic shelf). Rendered as a list under the deep-cut records.

`films`, `deepcuts`, `archives`, `radio` and `refs` are optional (a genre without films/deepcuts shows a "coming soon" line; the others just omit their section). Remember to list every new const in the `window.GENRE_DATA[...]` object literal at the bottom of the file.

## Adding a genre

1. Copy an existing data file to `js/data/<key>.js`; replace key, names, theme colors, eras, roleGroups, and curation.
2. Add the key to `GENRE_ORDER` in js/engine.js.
3. Add `<script src="js/data/<key>.js"></script>` to index.html (before engine.js).
4. Validate, preview locally, push.
