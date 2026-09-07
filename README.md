# KESTRA

Named for the kestrel, which hangs dead still in a forty-mile wind by correcting
continuously — which is the product promise, not decoration.

## The mark

The identity is a wing-K: a solid stem with the upper arm swept long and shallow
like an outstretched primary feather, and the lower arm landing hard on the
baseline. It is drawn on a 32-unit grid, entirely from straight edges, so it
stays sharp from a 200 px lockup down to a 16 px favicon and survives being
stamped into an aluminium lid.

It lives in exactly two places: as SVG paths in `index.html` for the navigation,
footer, intro card and favicon, and as `drawMark()` in `js/artwork.js`, which
reproduces the same geometry on canvas for the printed can, the lid emboss and
the twelve-pack carton. The wordmark is Archivo at 700, slightly condensed, set
with wide tracking — the mark carries the distinctiveness, the wordmark stays
quiet.

A storefront for a fictional Saudi energy drink brand. It opens on a cinematic
sequence built around a real-time 3D can, walks you through how the drink is
made in four scroll-driven scenes, hands that same camera to the shop, and keeps
going: the can travels the page section by section and becomes a twelve-pack
when you reach the pack builder. There is no cut between any of it, because
there is only one scene.

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

  The proportions are the whole game, and getting them wrong is what makes a
  can read as a bottle. A real 58 mm sleek can is closed with a 200-series
  end — about 51.5 mm across the seam — so the neck-in is roughly 5 mm, and
  the body is a straight cylinder for ~91% of its height before one short
  shoulder. Necking further, or starting the shoulder lower, immediately
  produces a metallic bottle. The fillets are also built with 16 arc steps
  rather than 7: at a 4 mm radius, seven segments show up as hard horizontal
  facets around the shoulder that look like machined grooves.
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
  strip lights rather than point lamps. Behind the subject is a graduated
  backdrop, because a product photographed in a room does not float in a void,
  and beneath it a mirrored body mesh fading out within a fraction of the can's
  height.
- **Print is not metal** (`js/artwork.js`) — the printed band's metalness sits
  near zero while the bare bands above and below stay fully metallic. This is
  the single biggest realism lever on the whole can: a metal has no diffuse
  term, so when the label was left half-metallic its colour could only come
  back as specular tint, and under a strip light the orange washed to white.
  Ink is a dielectric over a white base coat, and once it is modelled that way
  the print holds its colour and the type stays crisp through the highlight.
- **Realism details** — the body material is anisotropic with the grain running
  around the circumference, which is the direction rolled aluminium is actually
  brushed. The surface carries fine scratches, fingerprint smudges and settled
  dust in its roughness map; the condensation nucleates in clusters of fine mist
  around larger beads rather than scattering evenly, which is how it forms on a
  cold can.
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

The opening is shot with real depth of field: a `BokehPass` racks focus from the
condensation to the whole can as the camera pulls back, then switches itself off
so the storefront never pays for the depth pass. The accent light travels around
the rear of the can throughout, so the highlight sweeps the silhouette instead
of sitting still — that movement is the clearest signal a shot was lit and filmed
rather than posed once and rendered.

The sequence is timed against the wall clock rather than accumulated frame
deltas, so a slow machine gets a choppier six seconds, never a slower six
seconds. It can be skipped with the button, Escape, space, enter, a scroll or a
touch drag, and `prefers-reduced-motion` jumps straight to the final frame.

## The production journey

`js/scenes.js` builds four beats that play out as you scroll, each in its own
place with its own camera move rather than one can turning on the spot:

1. **Ingredient preparation** — inside a jacketed mixing vessel. The camera
   starts wide enough to read the tank as a tank, then tips over the rim as the
   inlet pours and the level climbs. The shell is deliberately not
   metalness-1: a fully metallic surface has no diffuse term, so in a dim plant
   it renders as a black hole no matter how it is lit.
2. **Filling and sealing** — a slow lateral track along the filling line. Each
   can fills slightly after the one before it, and the lids come down and seat
   in the same stagger, so the line reads as a line rather than four things
   doing the same thing at once.
3. **Packaging** — a long dolly that rides low beside the conveyor, overtakes
   the line and comes round to find the tray filling at the end of it. The path
   is a Bézier through a control point rather than a straight lerp; a straight
   line between two poses reads as a slide, an arc reads as a dolly.
4. **Product reveal** — out of the plant and back into the studio for a push-in
   on the finished can, which hands straight over to the store's own hero
   framing. That handoff is the same camera continuing, not a cut.

The plant has its own prefiltered environment (`buildPlant()`) with ceiling rows
*and* tall vertical strips, because a cylinder lit only from above has no
vertical highlight, and a vertical highlight running down the shell is the
single thing that reads as stainless.

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
- Real shadow maps are on above the low tier: the key light casts, the can
  casts and receives, and the floor receives, so the tab shades the lid and
  the shoulder shades the body. Phones keep the painted contact pool instead,
  which costs nothing. Running with no shadows at all — as this did — is the
  single loudest cue that an object was pasted into a frame rather than
  photographed in it.

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
