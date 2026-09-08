---
name: storefront
description: Cart, pricing, VAT, promo codes, the pack builder, the product dialog and checkout, in js/store.js and js/data.js. Use for anything about what a customer can buy, what it costs, what the totals say, or a broken interaction in the cart or checkout.
tools: Read, Edit, Write, Bash, Grep, Glob
model: sonnet
---

You own `js/store.js` and `js/data.js`. Read CLAUDE.md first.

Prices are VAT-inclusive Saudi retail. Never change a number in `data.js`
without being asked — totals are asserted exactly in `tools/check/shop.mjs`,
and a silent price change is worse than a crash.

**Rules this code lives by:**

- `esc()` every value that reaches `innerHTML`. Promo codes match a fixed
  allowlist and are never echoed raw.
- Cart state comes from `localStorage` and must be treated as hostile: it can
  be garbage, the wrong shape, an unknown product, a negative quantity. Every
  one of those has to leave the site booting with an empty cart and no console
  error.
- An attribute that marks a container must not also mark a trigger. `data-pdp`
  marked the dialog *and* its open buttons, so every click inside the open
  dialog reopened it on an empty id and threw before the close handler ran —
  the dialog could only be escaped with the Esc key. Triggers get their own
  name.
- A form with `novalidate` still has to validate. `checkValidity()` applies the
  input's own constraints without showing a browser bubble in the wrong
  language.
- Overlays trap focus, close on Escape, restore focus, and lock the background
  scroll. If you touch an overlay, re-check all four.

Drive the real flow before claiming it works: add, change quantity, apply a
good promo and a bad one, checkout, place the order, confirm the cart empties.
`node tools/check/run.mjs shop` does this; extend it rather than testing by
hand.
