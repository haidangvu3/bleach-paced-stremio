# Concentrated + Hollowed Bleach for Stremio

A static, keyless Stremio add-on combining Gabby's Concentrated Bleach and Knight's Hollowed Bleach in the order specified by the [Bleach Watch Guide V2](https://docs.google.com/presentation/d/1Tkt-5lpdhNevAMtIy-S4uQ9NsskNZLzZ483JInqMTr8/edit).

Japanese audio with English subtitles is the preferred option. Dual-audio MKVs and the English dub remain available. Google Drive is preferred within each language option, with Pixeldrain supplying the dedicated subbed MP4 when needed. No Google API key, paid server, personal secret, or runtime backend is needed. The repository contains metadata and public links, not video files.

## Nuvio: Japanese audio and English subtitles

Choose **Japanese audio + English subtitles**. Its MP4 has English subtitles burned into the picture; no subtitle menu or separate subtitle download is needed. This option appears first, and automatic next-episode playback groups it separately from the English dub.

For the **Dual audio + embedded subtitles** MKV option, choose Japanese in the player's audio menu and the full English dialogue subtitle track, rather than a signs-and-songs-only track. MKVs are correctly marked as requiring native playback. The add-on cannot force a player's internal audio/subtitle selection; that setting belongs to Nuvio. After updating from version 1.0.0, stop playback and reopen the episode's source list; reinstall or refresh the add-on if Nuvio retains the old source list.

## Put it online

1. Upload this project to a **public GitHub repository**, using `main` as its default branch. Include the hidden `.github` directory and the lockfile. Exclude `node_modules`, `.cache`, and local Git configuration.
2. In **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**.
3. Run **Actions → Update and deploy add-on → Run workflow**, or push to `main`.
4. Open the successful deployment URL and append `/manifest.json`. Paste that HTTPS URL into Stremio's add-on search box and install it.

GitHub Pages continues serving the last successful deployment when your computer is off. The updater runs daily at **06:00 UTC**, on pushes to `main`, and manually. It uses GitHub's automatically supplied deployment authorization; you do not create or publish API keys. It saves the generated public catalog to the repository with a bot identity, keeping a dated build record and regular repository activity. GitHub and source-provider outages remain possible. If GitHub disables scheduled workflows, re-enable the workflow in Actions; the existing Pages deployment stays available.

The public repository and Pages URL are associated with the GitHub account that owns them. The add-on files do not need your name, email, local paths, or credentials.

## Local use

Install Node.js 20.18.1 or later (Node 22 is used in the workflow), then run:

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run check
npm run serve
```

The local manifest is `http://127.0.0.1:8081/manifest.json`. The server enables CORS and disables caching. Use the HTTPS Pages deployment for other devices. `npm run build:offline` uses the bundled public-source snapshot and any saved cache. `npm run probe` checks representative video endpoints with small Range requests; `npm run probe -- --all --backups` checks every stream and may take several minutes.

## Watch order

| Season | Arc | Initial contents |
| --- | --- | --- |
| 1 | Substitute Soul Reaper | CB 01–09: 9 episodes |
| 2 | Soul Society | CB 10–35 plus 27.5 and 35.5 (0): 28 episodes |
| 3 | Arrancar | CB 36–57, SP01 after CB 45, SP02 after CB 50, then HB 22–50 with 29.5 (0.8): 54 episodes |
| 4 | The Lost Agent | HB 51–62: 12 episodes |

Pause CB 50 at **16:15**, watch SP02, then resume CB 50. Start the current v2 HB 22 at **05:28** after CB 57. HB 27 includes its Sub/Dub EX movie alternatives; HB 62 includes the original-anime-ending EX alternative. HB 50 EX is also available.

The generator discovers public Drive folders recursively through `embeddedfolderview`, with the normal folder HTML as fallback. It crawls Pixeldrain folders recursively, correctly encoding each path segment. It refreshes three public Sheets CSVs and uses the provided exact seed table when discovery is unavailable. The initial snapshot includes live metadata and links, so an offline build is usable immediately. Live discoveries take priority over stale seed IDs for the same episode and audio variant.

## Automatic replacements and numbering

Only episodes with a discovered or seeded video are released into the catalog; planned spreadsheet rows alone cannot advance the cutoff. New CB episodes replace HB material whose manga coverage is already completed. Pendulum's negative-numbered chapters and the 0.8 special retain their editorial positions rather than disappearing under a naive positive-chapter cutoff. The Lost Agent crossover works by the same rule.

**Hollowed Bleach v3 uses different numbers.** For example, v3 21 covers v2 22, while v3 48 covers v2 51. Replacements therefore use manga coverage, never the episode number alone. Available v3 MKVs replace fully covered v2 entries. Partially overlapping resegmented entries are retained with a note to avoid losing material. The visible title preserves the actual project/version number. The 05:28 timestamp applies only to v2 HB 22 after CB 57; other overlaps receive a chapter warning rather than an invented timestamp.

The requested `cb_s01e01` style IDs follow sequential positions. When upstream edits change episode counts, later IDs in that season may refer to different content: consult `episode-map.json` and refresh cached series metadata after updates. Previously saved progress may need adjustment.

## Stream behavior and reliability

Drive streams use exactly `https://drive.usercontent.google.com/download?id=FILE_ID&export=download&confirm=t`. Japanese subbed MP4s appear first, followed by dual audio and English dub alternatives. Public sharing does not guarantee unlimited traffic or permanent direct playback: Drive may return quota, consent, or permission pages. Use another provider if that happens. MKV, dual audio, and styled ASS subtitles depend on the player; a native player may be required. MKV streams use `notWebReady: true` and MP4 streams use `false`, following the Stremio protocol. Separate binge groups preserve the chosen language variant across episodes.

The workflow keeps a cache of public metadata. Source failures fall back to saved data and are recorded in `dist/build-report.json`; invalid or incomplete catalogs fail the build before replacing existing output. Only `dist/` is deployed to Pages. Failed updates leave the previous deployment online. External playback is checked separately from metadata correctness.

## Files and public sources

- `scripts/seed-gdrive-ids.json`: exact supplied seed records, grouped by project.
- `scripts/source-snapshot.json`: public CSVs and discovered public file records for offline fallback.
- `scripts/build-addon.mjs`: source discovery, watch order, and static JSON generation.
- `test/addon.test.mjs`: ordering, signed chapters, v3 mapping, crossover, and URL tests.
- `.github/workflows/update-addon.yml`: daily build and Pages deployment.
- `dist/manifest.json`, `dist/catalog`, `dist/meta`, `dist/stream`: generated Stremio resources.

Sources: [CB info](https://docs.google.com/spreadsheets/d/1bz-Ye4yAXmX31K_abAV7kNUq3lwOBg6aiOxAHaFDRl8/edit), [HB v2 info](https://docs.google.com/spreadsheets/d/1-ipC6DpZw4GlmMnUw4fOsIWXCbK0s0St2vbsMPr6WfI/edit), [HB v3 info](https://docs.google.com/spreadsheets/d/1E8h5WKvbYc_15ImxzFqU5P2VBqZ9fyWizOEVpV95Uu0/edit). Architecture references: [Stremio static example](https://github.com/Stremio/stremio-static-addon-example), [One Pace updater](https://github.com/au2001/onepace-stremio), and [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). Fan-edit credits belong to the editors; this is an unofficial catalog.
