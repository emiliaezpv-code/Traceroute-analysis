# Traceroute analysis

An interactive 3D globe of traceroute results. Drag to spin, scroll to zoom, hover a point to see its hop, click a line to read the notes for that path.

Files: `index.html` (page), `app.js` (globe), `traces.js` (**your data, the only file you edit**), `vendor.js` (globe math + world map, bundled).

## Add a trace

Open `traces.js`. The comment at the top explains every field. In short: copy one object in the `traces` list, change `id`, `dest`, `from`, `label`, `target`, `finalRtt`, `conclusion`, and list the hops as
`[hop number, "what you see", "what it likely is", place]`.

- `place` is a key from `places` (like `"CHI"`), an inline `[longitude, latitude, "Name"]`, or `null` when you have no location clue yet.
- Hops set to `null` aren't drawn; they appear in the popup of the last placed hop and in "Show all hops".
- For a school trace use `from: "school"`. It draws at 45% opacity (change it under `origins`).
- New destination? Add a line to `destinations` with a color. New city? Add a line to `places`.

## Publish on GitHub Pages

1. Create a new repository on GitHub (public), for example `traceroute-map`.
2. Upload `index.html`, `app.js`, `traces.js` and `vendor.js` to the **root** of the repository (Add file > Upload files).
3. Go to Settings > Pages. Under "Build and deployment", choose "Deploy from a branch", pick `main` and `/ (root)`, and save.
4. After a minute the site is live at `https://YOUR-USERNAME.github.io/traceroute-map/`.

To update it later, upload the new `traces.js` over the old one and commit.

## Test locally

Double-click `index.html`. Nothing needs a server. Add `?lite` to the address to turn off the digital rain on slow computers.

## Notes

Points are city-level estimates from hostname clues. Fonts (VT323, Share Tech Mono) load from Google Fonts; without a connection the page falls back to a system monospace font.
