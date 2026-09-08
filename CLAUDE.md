# KESTRA

A fictional Saudi energy-drink storefront with a real-time 3D can and a
cinematic opening. Bilingual Arabic/English with genuine RTL.

## Architecture

No framework, no build step, no dependencies. Plain ES modules with an import
map; the committed files are the deployable site. `node server.js` serves it on
:4173. Deploys are static (netlify.toml / vercel.json).

    index.html      one document; every section lives here
    js/main.js      boot, quality tiers, intro handoff
    js/stage.js     renderer, lights, environments, the pack
    js/can.js       can geometry and materials
    js/artwork.js   every texture, painted to canvas at runtime
    js/scenes.js    the four journey scenes
    js/director.js  scroll-driven camera stations
    js/store.js     cart, pricing, PDP, checkout
    js/i18n.js      all copy, both languages, money and numerals
    js/data.js      products, FAQ, reviews, shipping
    vendor/three/   three.js r169, vendored

## Conventions

- Copy never lives in markup. It goes in `js/i18n.js` and reaches the DOM
  through `t()`, which fences interpolated values in bidi isolates.
- `esc()` every value that reaches `innerHTML`. Promo codes are matched against
  a fixed allowlist, never echoed raw.
- Latin logotypes (KESTRA, Apple Pay) carry `direction: ltr` so they do not
  mirror under `dir="rtl"`. The layout around them still mirrors.
- Design tokens live at the top of `styles.css`. `--text-3` is calibrated to
  clear 4.5:1 on every ground the page uses — check before changing it.
- Touch targets are 44x44 under `@media (pointer: coarse)`.
- Structured data is generated: run `node tools/build-jsonld.mjs` after
  changing products, prices, ratings or the FAQ. Never hand-edit that block.

## Verifying a change

    node server.js &
    node tools/check/run.mjs            # everything
    node tools/check/run.mjs a11y rtl   # just these

Checks live in `tools/check/`. They drive a real browser and assert on
measurements, not screenshots. Add one whenever you fix a bug that nothing
would have caught.

WebGL in CI runs on SwiftShader (software). Geometry, layout, DOM state and
console errors are trustworthy. Absolute frame times are inflated roughly
50-100x, so compare ratios and never quote a raw millisecond figure as if it
were a device number.

## Things that have bitten before

- A flex row reverses under `dir="rtl"`. That is how the intro once spelled
  the brand ARTSEK and the header lockup came out backwards.
- `metalness: 1` surfaces have no diffuse term. They go black in a dim room
  and wash out under strong specular.
- Lighting the can with a light in the product's own accent colour pushes the
  ink past its own colour and reads as garish. Rims stay pale.
- The body texture sheet is anamorphic: it is 2048x1024 over a physical area
  that is not 2:1, so art drawn in it renders about 1.7x taller than wide.
  Known and deliberate for now; do not "fix" it without re-typesetting all six
  labels.
- An extruded cap has vertices only on its outline and slot rim, so vertex
  displacement on it collapses into a faceted tent.
