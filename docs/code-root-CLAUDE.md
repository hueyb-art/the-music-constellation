# ~/code — Huey's repo workspace

This folder is the root for all of Huey's repos (GitHub: **hueyb-art**). New repos get cloned here. This file is local-only (not in any repo); a versioned copy lives at `the-music-constellation/docs/code-root-CLAUDE.md` — update both together.

## Repos

- **the-music-constellation/** — the active project. One web app, three genre constellations (jazz, hip hop, reggae) with a genre switcher. Full agent context in its `CLAUDE.md`; curation format in `docs/DATA-FORMAT.md`; deferred work in `docs/ROADMAP.md`. Live: https://hueyb-art.github.io/the-music-constellation/
- **the-art-constellation/** — the same engine adapted to **20th-century visual art** (848 artists, 85 movements, 7 eras), as its own standalone project rather than a fourth "genre". Adds a **Timeline view** (movements as dated clusters you pan through time, clusters bloom open on hover) and an **enrichment layer** — biographies, lifespans, portraits and freely-licensed artwork images, harvested from Wikidata/Wikipedia. Source data is authored as markdown in `~/Desktop/20th Century Art Movements/` and imported. See its `CLAUDE.md`. Live: https://hueyb-art.github.io/the-art-constellation/
- **jazz-constellation/**, **hiphop-constellation/**, **reggae-constellation/** — legacy single-file apps, superseded by the above. **Do not modify** until the post-validation handover step in the-music-constellation/docs/ROADMAP.md (README notes + redirects, only after Huey confirms the new site works).

## Standing workflow rules (from Huey, 2026-06-12)

1. **Ask first.** Reach alignment via clarifying questions (one at a time, with a recommended answer) before structural changes. Explore the code instead of asking when the code can answer.
2. **Validate, then commit AND push.** Repos must stay current on GitHub, but only push when validation passes (`node scripts/validate.mjs` in the-music-constellation) and the app is stable.
3. **Capture learnings** in the repo's `docs/LEARNINGS.md`; keep READMEs and CLAUDE.md files current as part of the work, not as an afterthought.
4. Commit messages should describe the change (the legacy repos' history is all "Add files via upload" — don't add to it).
