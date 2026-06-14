# The Music Constellation

Interactive 3D maps of music history. Each genre is a constellation: musicians appear as stars in a globe you can spin and zoom, connected by the mentorships, collaborations, influences, and rivalries that link them. Tap any star for a biography, a full discography (pulled live from MusicBrainz), a photo, links to listen on Spotify / Apple Music / YouTube, and a 30-second preview clip. Zoom in close and the stars become faces.

**Live site:** https://hueyb-art.github.io/the-music-constellation/

Three constellations so far, switchable in the app (each keeps its own theme, eras, and curation):

| Constellation | Artists | Connections | Route |
|---|---|---|---|
| The Jazz Constellation | 232 | 544 | [`#/jazz`](https://hueyb-art.github.io/the-music-constellation/#/jazz) |
| The Hip Hop Constellation | 240 | 362 | [`#/hiphop`](https://hueyb-art.github.io/the-music-constellation/#/hiphop) |
| The Reggae Constellation | 163 | 233 | [`#/reggae`](https://hueyb-art.github.io/the-music-constellation/#/reggae) |

This repo supersedes three earlier single-file apps ([jazz-](https://github.com/hueyb-art/jazz-constellation), [hiphop-](https://github.com/hueyb-art/hiphop-constellation), [reggae-constellation](https://github.com/hueyb-art/reggae-constellation)), consolidating their forked engines into one shared engine so improvements land everywhere at once.

## How it works

- A custom 3D force-directed graph rendered on an HTML canvas — no frameworks, no dependencies, no build step. Plain HTML/CSS/JS served as-is by GitHub Pages.
- **Discographies** load live from MusicBrainz; **photos** from Wikipedia; **preview clips** from Deezer/Apple (artist-verified before playing); **Apple Music links** via Apple's iTunes lookup.
- **Collaborations are clickable**: tap the ♪ on any connection in an artist's card and it unfolds the recordings the two actually made together — title and year, pulled live from MusicBrainz co-credits (strong for joint billings and features; uncredited sideman sessions can be partial).
- Search is diacritic-folded and typo-tolerant ("thelonius" finds Thelonious Monk).
- A **Chord web** view (`#/<genre>/chord`) lays everyone on a ring grouped by era, every relationship arcing across to a living, flickering sun, the whole figure drifting slowly in starfield-and-galaxy space until you touch it. Hover a star to light its ties and name each connection by kind; click for its card and the records.
- Connection lines are styled by relationship: quiet gold = collaboration, bright white-gold = mentorship, dashed silver-blue = influence, dotted rose = rivalry (line styles double as a colorblind-safe encoding).

## Repo layout

```
index.html          app shell (one page, hash-routed: #/jazz, #/hiphop, #/reggae)
css/style.css       shared styles; genre themes cross-fade via CSS @property vars
js/engine.js        the shared engine (rendering, physics, search, audio, pages)
js/data/<genre>.js  curated data per genre — the editorial heart of the project
js/version.js       build stamp shown in the header
scripts/validate.mjs   validation gate — run before every push
scripts/extract-legacy.mjs / port-engine.mjs   one-time migration tooling (frozen, kept for provenance)
docs/               roadmap, data format guide, learnings, relay setup
```

## Editing and publishing

1. Edit data in `js/data/<genre>.js` (format guide: [docs/DATA-FORMAT.md](docs/DATA-FORMAT.md)) or the engine in `js/engine.js`.
2. Run the gate: `node scripts/validate.mjs` (checks ids, edges, required fields, syntax). CI runs the same check on every push.
3. Bump the date in `js/version.js` for notable changes.
4. Commit and push — GitHub Pages republishes within a minute or two.

To preview locally, open `index.html` in a browser, or serve the folder (`python3 -m http.server`).

## Adding a genre

Create `js/data/<key>.js` registering a new entry on `window.GENRE_DATA` (copy an existing file as the template), add the key to `GENRE_ORDER` in `js/engine.js`, and add a `<script>` tag in `index.html`. The engine does the rest — tabs, routing, theme, legend, filters.

## Editorial note

Rosters and connections are a curated selection, not an exhaustive census — chosen to tell the story of how each music's figures shaped one another. Biographies are written for the project; discographies, photos, and audio are drawn live from the open sources above.

## License

Code is [MIT](LICENSE). The curated editorial content — rosters, biographies, connection data in `js/data/` — is [CC BY 4.0](LICENSE-CONTENT.md): reuse it with credit to this project.
