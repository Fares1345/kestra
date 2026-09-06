# KESTRA

Named for the kestrel, which hangs dead still in a forty-mile wind by correcting
continuously — which is the product promise, not decoration.

A storefront for a fictional Saudi energy drink brand. It opens on a cinematic
sequence built around a real-time 3D can, hands that same camera to the shop,
and keeps going: the can travels the page section by section and becomes a
twelve-pack when you reach the pack builder. There is no cut between any of it,
because there is only one scene.

Bilingual English/Arabic with real RTL, priced in Saudi riyal, delivered across
the Kingdom.

No build step, no framework, no production dependencies beyond a vendored copy
of three.js. Open `index.html` through any static server and it runs.

```bash
npm start          # http://127.0.0.1:4173
```

## What is actually rendered

Nothing here is a downloaded model or a photograph. Every pixel of the can is
generated at load time:

- **Geometry** (`js/can.js`) — a 355 mL sleek can lathed from a hand-authored
  profile. The profile is written as corner points with explicit fillet radii,
  because a can has no sharp edges; it has very tight radii, and those radii are
  what catch the long vertical highlights you read as aluminium. The lid is a
  separate lathe with plan-view UVs, and the pull tab is an extruded shape with a
  finger hole and a rivet hole.
- **Artwork** (`js/artwork.js`) — the body is unwrapped to a single 2048×1024
  sheet and painted on a 2D canvas. Each flavour has its own `design` —
  `block`, `gradient`, `split`, `band`, `outline`, `duo` — so the six cans are
  laid out differently rather than being one template recoloured. Packaging is
  bilingual, the way it is on any shelf in the Kingdom. Roughness and metalness
  share one packed texture, and the condensation is stamped from a single
  hemisphere normal sprite, so 620 beads and their run-off cost one upload.
- **Lighting** (`js/stage.js`) — a small studio built from emissive planes and
  prefiltered into an environment map. Cylindrical metal reads as metal because
  of the long vertical highlights thrown by strip softboxes, so the room has
  strip lights rather than point lamps.
- **The twelve-pack** (`js/pack.js`) — a printed tray with a 4 × 3 grid of
  slots. Adding a flavour drops a real can into the next free slot with gravity
  and a small bounce; removing one lifts it out. It shares the hero can's
  geometry and one material per flavour, so twelve cans cost twelve draw calls.

## Choreography

`js/director.js` holds two things: the opening shot list and the scroll
stations. The intro opens as a macro shot inside the condensation, pulls back
through the shoulder as the light comes up, hits an ignition beat, and settles
into the exact framing the storefront inherits. When it lands, the director
stops driving the camera from keyframes and starts driving it from the scroll
position and the pointer.

Each station is anchored to a section, and the camera lerps between whichever
two the page currently sits across — so the can is continuously choreographed
rather than snapping between states. Stations also carry their own narrow-screen
distance and lift, because a tray 2.5 units wide needs far more room than a
single can.

The sequence is timed against the wall clock rather than accumulated frame
deltas, so a slow machine gets a choppier six seconds, never a slower six
seconds. It can be skipped with the button, Escape, space, enter, a scroll or a
touch drag, and `prefers-reduced-motion` jumps straight to the final frame.

## Product photography

The six cards in the shop are real renders of the real geometry. During the
loader, before anything is visible, `stage.capture()` re-skins the can for each
flavour and photographs it one frame at a time. That is why the six shots share
identical lighting and framing — they are the same can.

## Bilingual and localized

`js/i18n.js` holds every user-facing string in both languages. Switching flips
direction, numerals, currency and the whole layout; the choice persists per
visitor. The Arabic is written to read naturally rather than translated word for
word. Prices are Saudi riyal, VAT-inclusive at 15%, with delivery zones and
estimates for Riyadh, Jeddah, Makkah, Madinah, Dammam, Khobar and the rest of
the Kingdom, and Apple Pay / mada / card at checkout.

One detail worth knowing: Arabic is cursive and joins, so the canvas text helper
never splits it into glyphs to letterspace — that would break the shaping and
reverse the order. Tracked text is Latin-only.

## Performance

- Capability is probed once (`detectQuality`); low-tier devices get fewer
  segments, fewer particles, fewer condensation beads and no bloom.
- Device pixel ratio is capped, and an adaptive guard sheds bloom and resolution
  if frames stay over budget for about a second.
- The twelve-pack is not built at all until the page approaches it.
- Drawing stops when the subject scrolls out of frame and when the tab is hidden.
- Only the colour sheet is rebuilt per flavour; surface maps are shared by all
  six, and the hero can and the pack share one geometry set.
- Real shadow maps were dropped in favour of a soft contact pool — with the
  floor faded back they only ever showed as a hard ellipse, and they cost a
  depth pass.

## Fallbacks

If WebGL is unavailable the intro and canvas are removed and the shop renders
normally, with a CSS can standing in for the hero and gradient placeholders on
the cards. A thrown error anywhere in boot lands in the same state.

## Layout

```
index.html          markup, i18n hooks, structured data
styles.css          design system, every component, RTL, touch
js/i18n.js          both languages, direction, SAR formatting
js/data.js          catalogue, nutrition, shipping, reviews, FAQ
js/artwork.js       canvas-painted textures, six can designs
js/can.js           can geometry
js/pack.js          the twelve-pack tray and its slot physics
js/stage.js         renderer, studio, particles, capture, adaptive quality
js/director.js      the shot list and the scroll stations
js/store.js         catalogue, product detail, pack builder, cart, checkout
js/reveal.js        one shared scroll-reveal manager
js/main.js          boot order
vendor/three/       three.js r169, vendored
```

The cart persists to `localStorage`. Checkout is a demonstration — no order is
placed and no payment is taken.
