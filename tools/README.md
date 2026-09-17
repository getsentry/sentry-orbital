# tools/

Scripts that generate things the app or the page needs. **None of this is
served, shipped, or run at build time.** Everything here is run by hand, by a
person, when an input actually changes — which for most of it is roughly never.

Four separate guards keep it out of production, so you can add to this folder
without worrying about it leaking:

- Vite copies only `public/` into `static/`; `tools/` sits outside it.
- `main.go` serves only `static/`, and so does `npm run preview`.
- The runtime image is `FROM scratch` with just the binary and `static/` — there
  is no filesystem for this folder to sit in.
- `tools/` is in `.dockerignore`, so it never enters the build context either.

It *is* reachable at `localhost:5190/tools/…` while `npm run dev` is running,
because the dev server serves the project root. That is the point — `og.html`
needs a server to load fonts and images.

## The globe's land mask

| | |
| --- | --- |
| `build-worldmap.mjs` | Rasterises Natural Earth land polygons into `src/data/worldmap.json`, the bit-packed equirectangular grid the globe samples. Re-run only if the resolution or the source data changes. |
| `preview-globe.mjs` | Ray-traces that mask from a viewpoint straight to a PNG, using the same sampling the app does. Lets you look at the globe without a browser; it is how a false polar ring was once caught. |

## The favicon set

`build-icons.mjs` writes all nine icon files into `public/` — the `.svg`, the
`.ico`, and seven PNGs.

```bash
node tools/build-icons.mjs --ink '#000000' --bg '#51ff00'
```

Those are the colours currently shipped; run it with no flags and you get the
same. `--all <dir>` writes every colourway in `VARIANTS` side by side, which is
how the current one was chosen.

The mark is not hand-drawn. `icon-grids.mjs` holds `MARK_32`, derived from
`Sentry Logo.svg` by rasterising the path at 1024px, cropping to its tight
bounding box and box-sampling into 32 square cells. Sizes 32 and up scale that
grid by whole numbers so the pixels stay square; below 32 a 32-cell grid cannot
have whole-number cells at all, so the same mark is rendered at 16× and averaged
down rather than swapped for a simpler drawing.

`png.mjs` is a dependency-free PNG encoder/decoder plus an `.ico` packer. It
exists so this repo can write image files without taking on a dependency.

## The social card

`og.html` builds `public/og-v1.png`, the 1200×630 card. Start the dev server,
open <http://localhost:5190/tools/og.html>, and use the download link.

It composites rather than screenshots. The app fits the planet to the viewport,
so the card's framing — a lot of sky over a distinctly curved horizon — is not a
camera the app can be put into. Scaling a captured disc into position is the
only way to set the globe's radius and its crest independently.

That is why `plates/` has two kinds of image. `plates/globe/*.png` is the planet
alone on the page ground; `plates/stars.png` is the star field alone. Baking
them together and scaling would shrink the stars along with the globe and leave
a denser, finer patch of sky wherever the disc landed. `brand/lockup.png` is the
Sentry lockup, supplied as artwork and drawn over the top.

The plates are captures from the running app, and the header comment in
`og.html` has the full recipe for retaking them — viewport sizes, the
`localStorage` style overrides, and why each one is needed. The short version is
that it needs `preserveDrawingBuffer` temporarily switched on in
`src/render/Scene.tsx`, and that clouds and star count both have to be tuned
away from their defaults because the card shows the globe at a very different
scale from the app.

All the layout numbers — globe radius, crest height, lockup position, the
gradient stops — are named constants at the top of the script, in fractions of
the card.
