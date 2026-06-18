# White-label & deployments

The same engine that powers the public site can be rebranded for a museum, a
label, an estate, a festival, or a course — a different name, palette, dataset,
and (optionally) a fullscreen kiosk mode. No fork: it's all driven by one
config object, with URL overrides for quick demos.

## The config

`index.html` defines `window.MC_CONFIG` before the engine loads. The defaults
reproduce the public site exactly; override them for a branded deployment:

| Key | Default | Meaning |
|---|---|---|
| `brand` | `"The Music Constellation"` | Headline (single-brand mode) and browser-tab name |
| `tagline` | `"who shaped whom"` | The line beneath the brand |
| `genres` | `null` | `null` = all datasets; or e.g. `["jazz"]` for one |
| `showTabs` | `true` | Genre switcher (auto-hidden when only one dataset) |
| `accent` | `null` | Hex colour to retint the gold UI accent (e.g. `"#1e63b0"`) |
| `attribution` | `null` | Small credit line, e.g. `"An exhibit by the Blue Note Archive"` |
| `kiosk` | `false` | Fullscreen attract-loop mode for installations |

When `showTabs` is false or only one dataset is shown ("single-brand mode"),
the **brand** becomes the on-screen headline and the tagline sits beneath it.

## URL overrides (for demos & installs)

Any key can be set from the query string — no separate build needed. Great for
pitching ("here's your brand") and for kiosk URLs:

```
index.html?brand=Blue%20Note%20Records&tagline=the%20label%20that%20shaped%20modern%20jazz&genres=jazz&tabs=0&accent=%231e63b0&attribution=An%20exhibit%20by%20the%20Blue%20Note%20Archive&kiosk=1
```

- `genres` is comma-separated (`genres=jazz,reggae`).
- `tabs=0` hides the switcher; `kiosk=1` enables kiosk mode.
- All text is rendered with `textContent`, so brand/tagline/attribution are
  inert (no markup is executed).

## Supplying a client's own data

A branded or institutional dataset is just another file in `js/data/` that
registers on `window.GENRE_DATA` (see [DATA-FORMAT.md](DATA-FORMAT.md) for the
schema, and the validator `scripts/validate.mjs` for the integrity checks).
Point `genres` at its key. A curator can author the artists + relationships in
a spreadsheet and have it converted to the data-file shape.

## Notes for commercial deployments

- The live MusicBrainz / Wikipedia / Deezer / Apple lookups are third-party; a
  self-contained install can rely on the curated data baked into the dataset
  and treat those enrichments as optional (see kiosk/offline mode).
- Code is MIT; the curated editorial content is CC BY 4.0. For an exclusive
  commercial engagement, agree licensing terms for the curation separately.
