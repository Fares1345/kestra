# KESTRA

Named for the kestrel, which hangs dead still in a forty-mile wind by correcting
continuously — which is the product promise, not decoration.

Storefront for a fictional energy drink brand. It opens on a cinematic sequence
built around a real-time 3D can and then hands the same camera over to the shop —
there is no cut between the two, because there is only one scene.

No build step, no framework, no production dependencies beyond a vendored copy of
three.js. Open `index.html` through any static server and it runs.

```bash
npm start          # http://127.0.0.1:4173
```

## What is actually rendered

Nothing here is a downloaded model or a photograph. Every pixel of the can is
generated at load time:

- **Geometry** (`js/can.js`) — a 355 mL sleek can lathed from a hand-authored
  profile. The profile is written as corner points with explicit fillet radii and
  expanded into arcs, because a can has no sharp edges; it has very tight radii,
  and those radii are what catch the long vertical highlights you read as
  aluminium. The lid is a separate lathe with plan-view UVs, and the pull tab is
  an extruded shape with a finger hole and a rivet hole.
- **Artwork** (`js/artwork.js`) — the body is unwrapped to a single 2048×1024
  sheet and painted on a 2D canvas: the printed sleeve, the brushing on the bare
  metal bands, the varnish, and the condensation. Roughness and metalness share
  one packed texture (green and blue channels), and the condensation is stamped
  from a single hemisphere normal sprite, so 620 beads and their run-off cost one
  texture upload rather than 620.
- **Lighting** (`js/stage.js`) — a small studio built from emissive planes and
  prefiltered into an environment map. Cylindrical metal reads as metal because
  of the long vertical highlights thrown by strip softboxes, so the room has
  strip lights rather than point lamps. The two coloured lights on top only add
  the accent rim, and they retint when the flavour changes.

## The opening sequence

`js/director.js` holds the shot list. It opens as a macro shot inside the
condensation, pulls back through the shoulder as the light comes up, hits an
ignition beat, and settles into the exact framing the storefront inherits. When
it lands, the director stops driving the camera from the timeline and starts
driving it from the scroll position and the pointer instead. The canvas is never
swapped, faded to a poster, or torn down.

The sequence is timed against the wall clock rather than accumulated frame
deltas, so a slow machine gets a choppier six seconds, never a slower six
seconds. It can be skipped with the button, Escape, space, enter, a scroll or a
touch drag, and `prefers-reduced-motion` jumps straight to the final frame.

## Product photography

The six cards in the shop are real renders of the real geometry. During the
loader, before anything is visible, `stage.capture()` re-skins the can for each
flavour and photographs it one frame at a time. That is why the six shots share
identical lighting and framing — they are the same can.

## Performance

- Capability is probed once (`detectQuality`); low-tier devices get fewer
  segments, fewer particles, fewer condensation beads and no bloom.
- Device pixel ratio is capped.
- Drawing stops when the can scrolls out of frame and when the tab is hidden.
- Only the colour sheet is rebuilt when you switch flavour; the surface maps are
  shared across all six, and colour sheets are cached with a small LRU.
- Real shadow maps were dropped in favour of a soft contact pool — with the floor
  faded back they only ever showed as a hard ellipse, and they cost a depth pass.

## Fallbacks

If WebGL is unavailable the intro and canvas are removed and the shop renders
normally, with a CSS can standing in for the hero and gradient placeholders on
the cards. A thrown error anywhere in boot lands in the same state.

## Layout

```
index.html          markup
styles.css          design system and every component
js/data.js          catalogue and copy
js/artwork.js       canvas-painted textures
js/can.js           geometry
js/stage.js         renderer, studio, particles, capture
js/director.js      the shot list and the hero camera
js/store.js         catalogue rendering, mixer, cart
js/main.js          boot order
vendor/three/       three.js r169, vendored
```

The cart persists to `localStorage`. Checkout is a demonstration — no order is
placed and no payment is taken.
