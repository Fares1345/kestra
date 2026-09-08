/**
 * The money path: add, change quantity, promo, checkout, order.
 * Prices are VAT-inclusive Saudi retail, so the totals are asserted exactly.
 *
 * Two checks live here and both run under `run.mjs shop`:
 *   moneyPath()   — the standard pack, promo codes, checkout, tampered carts
 *   packBuilder() — the mixed twelve in #mix, whose price is computed, not
 *                   looked up, and so can drift without anything looking wrong
 */
import { withPage, openCart, report } from './harness.mjs';

/* ------------------------------------------------------------------ *
 * shared helpers
 * ------------------------------------------------------------------ */

/**
 * The amount out of a formatted riyal string. `money()` renders through Intl,
 * so the check must not care whether that is "SAR 154" or "SAR 154.00" — but
 * it must care, exactly, about 154.
 */
const amount = (s) => Number(String(s).replace(/[^\d.]/g, ''));

const click = (page, sel) => page.evaluate((s) => document.querySelector(s)?.click(), sel);

/**
 * Fire a click that a disabled control cannot swallow, so the guard inside the
 * delegated handler is what gets tested rather than the `disabled` attribute.
 */
const forceClick = (page, sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return false;
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return true;
  }, sel);

/** Press a flavour's + this many times. The row is re-rendered after each. */
const bump = (page, id, times) =>
  page.evaluate(
    ({ i, n }) => {
      for (let k = 0; k < n; k++) document.querySelector(`[data-mix="${i}"][data-delta="1"]`)?.click();
    },
    { i: id, n: times }
  );

/** Everything the mixer is showing, in one round trip. Runs in the page. */
function readMixer() {
  const clean = (s) => String(s ?? '').replace(/[\u2068\u2069]/g, '').replace(/\s+/g, ' ').trim();
  const q = (s) => document.querySelector(s);
  const plus = [...document.querySelectorAll('[data-mix][data-delta="1"]')];
  return {
    count: clean(q('[data-mix-count]')?.textContent),
    price: clean(q('[data-mix-price]')?.textContent),
    meter: q('[data-mix-meter]')?.getAttribute('aria-valuenow'),
    addDisabled: q('[data-mix-add]') ? q('[data-mix-add]').disabled : null,
    addLabel: clean(q('[data-mix-add]')?.textContent),
    fillDisabled: q('[data-mix-fill]') ? q('[data-mix-fill]').disabled : null,
    clearDisabled: q('[data-mix-clear]') ? q('[data-mix-clear]').disabled : null,
    rows: plus.length,
    plusAllDisabled: plus.length > 0 && plus.every((b) => b.disabled),
    counts: Object.fromEntries(
      plus.map((b) => [b.dataset.mix, clean(b.closest('.stepper')?.querySelector('output')?.textContent)])
    ),
  };
}

/** Everything the cart drawer is showing. Runs in the page. */
function readCart() {
  const clean = (s) => String(s ?? '').replace(/[\u2068\u2069]/g, '').replace(/\s+/g, ' ').trim();
  return {
    badge: clean(document.querySelector('[data-cart-count]')?.textContent),
    subtotal: clean(document.querySelector('[data-sum-subtotal]')?.textContent),
    lines: [...document.querySelectorAll('[data-cart-items] .cart-line')].map((el) => ({
      title: clean(el.querySelector('h3')?.textContent),
      meta: clean(el.querySelector('.cart-line__meta')?.textContent),
      price: clean(el.querySelector('.cart-line__price')?.textContent),
      qty: clean(el.querySelector('.stepper output')?.textContent),
    })),
  };
}

/* ------------------------------------------------------------------ *
 * the standard pack, promo, checkout
 * ------------------------------------------------------------------ */

export async function moneyPath() {
  const failures = [];
  const notes = [];

  const r = await withPage({ viewport: 'iphone-390', lang: 'en' }, async (page, errors) => {
    await openCart(page);
    const out = {};
    out.count = (await page.textContent('[data-cart-count]')).trim();
    out.subtotal = (await page.textContent('[data-sum-subtotal]')).trim();

    await page.fill('[data-promo-input]', 'KESTRA15');
    await page.evaluate(() => document.querySelector('[data-promo-form]').requestSubmit());
    await page.waitForTimeout(500);
    out.total = (await page.textContent('[data-sum-total]')).trim();

    // A code that does not exist must not apply anything.
    await page.fill('[data-promo-input]', 'NOPE-NOT-A-CODE');
    await page.evaluate(() => document.querySelector('[data-promo-form]').requestSubmit());
    await page.waitForTimeout(400);
    out.afterBadPromo = (await page.textContent('[data-sum-total]')).trim();

    await page.evaluate(() => document.querySelector('[data-checkout]')?.click());
    await page.waitForTimeout(700);
    out.method = await page.evaluate(() => document.querySelector('.pay__method.is-active')?.dataset.payMethod);
    await page.evaluate(() => document.querySelector('[data-place-order]').click());
    await page.waitForTimeout(800);
    out.afterOrder = (await page.textContent('[data-cart-count]')).trim();
    return { ...out, errors };
  });

  if (r.count !== '12') failures.push(`cart count ${r.count}, expected 12`);
  if (!/145/.test(r.subtotal)) failures.push(`subtotal "${r.subtotal}" should be SAR 145`);
  if (!/148\.25/.test(r.total)) failures.push(`total with KESTRA15 was "${r.total}", expected SAR 148.25`);
  if (r.afterBadPromo !== r.total) failures.push(`an unknown promo changed the total: ${r.total} -> ${r.afterBadPromo}`);
  if (r.method !== 'applepay') failures.push(`default payment method is "${r.method}"`);
  if (r.afterOrder !== '0') failures.push(`cart still holds ${r.afterOrder} after placing the order`);
  failures.push(...r.errors);
  notes.push(`subtotal ${r.subtotal}, total ${r.total}, method ${r.method}`);

  // A tampered cart must never break the boot. The key has to be the one the
  // store actually reads — CART_KEY in js/store.js — or this proves nothing.
  // Each case names the count it must produce: an outright reject is 0, but a
  // quantity that is merely too large is clamped rather than dropped, and an
  // honestly priced mix has to survive or the guard is just breaking the cart.
  for (const [label, raw, want] of [
    ['garbage', 'not json', '0'],
    ['wrong shape', '{"a":1}', '0'],
    ['unknown product', '[{"productId":"../evil","packId":"12","qty":1}]', '0'],
    ['negative qty', '[{"productId":"solstice","packId":"12","qty":-5}]', '0'],
    // mixPrice is trusted by linePrice over the catalogue, so it has to be
    // recomputed from mixKey on load. Unchecked, -500 drove the basket below
    // zero and 1 bought twelve cans for a riyal.
    [
      'negative mixPrice',
      '[{"productId":"solstice","packId":"12","qty":1,"mixKey":"solstice6-glacier6","mixLabel":"x","mixPrice":-500}]',
      '0',
    ],
    [
      'underpriced mix',
      '[{"productId":"solstice","packId":"12","qty":1,"mixKey":"solstice6-glacier6","mixLabel":"x","mixPrice":1}]',
      '0',
    ],
    ['mixPrice with no mixKey', '[{"productId":"solstice","packId":"12","qty":1,"mixPrice":145}]', '0'],
    // Clamped to MAX_QTY (20), not dropped: 20 x 12 cans.
    ['qty past the cap', '[{"productId":"solstice","packId":"12","qty":9999}]', '240'],
    // And an honest mix still loads: 6 Solstice + 6 Glacier at 145/12 each.
    [
      'honest mix',
      '[{"productId":"solstice","packId":"12","qty":1,"mixKey":"solstice6-glacier6","mixLabel":"Mixed pack","mixPrice":145}]',
      '12',
    ],
  ]) {
    const t = await withPage({ viewport: 'iphone-390', lang: 'en' }, async (page, errors) => {
      await page.evaluate((v) => localStorage.setItem('kestra.cart.v2', v), raw);
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => document.body.classList.contains('is-live'), undefined, {
      timeout: 300000,
    });
      await page.waitForTimeout(600);
      return { count: (await page.textContent('[data-cart-count]')).trim(), errors };
    });
    if (t.count !== want) failures.push(`tampered cart (${label}) produced count ${t.count}, expected ${want}`);
    failures.push(...t.errors.map((e) => `tampered cart (${label}): ${e}`));
  }
  notes.push('tampered carts: 9 cases, including mixPrice forgery and an honest mix that must survive');

  return report('shop', failures, notes);
}

/* ------------------------------------------------------------------ *
 * the pack builder
 * ------------------------------------------------------------------ */

/**
 * The mixed twelve in #mix. Its price is the only one on the site that is
 * computed rather than looked up — `mixedPackPrice()` sums each flavour's
 * 12-pack rate per can and rounds once at the end — so it is the one price
 * that can drift by a riyal without anything on screen looking wrong. Every
 * figure below is written out longhand so a failure says which sum moved.
 *
 * Per-can rates are packs[12] / 12: solstice and glacier and aurora 145/12,
 * vesper 159/12, verde and monsoon 152/12.
 */
export async function packBuilder() {
  const failures = [];
  const notes = [];
  // The per-flavour splits are plain objects, so compare them by value with
  // their keys in a fixed order rather than by identity.
  const norm = (v) =>
    v !== null && typeof v === 'object'
      ? JSON.stringify(Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))))
      : JSON.stringify(v);
  const eq = (label, got, want) => {
    if (norm(got) !== norm(want)) failures.push(`${label}: got ${norm(got)}, expected ${norm(want)}`);
  };
  const price = (label, got, want) => {
    if (amount(got) !== want) failures.push(`${label}: priced ${amount(got)} ("${got}"), expected SAR ${want}`);
  };

  const r = await withPage({ viewport: 'iphone-390', lang: 'en' }, async (page, errors) => {
    const out = {};
    await page.evaluate(() => document.getElementById('mix')?.scrollIntoView());
    await page.waitForTimeout(600);

    // 1. It opens full, ready to add.
    out.initial = await page.evaluate(readMixer);

    // 2. A synthetic click does reach the delegated handler — proved here on an
    //    enabled control, so that step 4 below means something.
    await forceClick(page, '[data-mix="solstice"][data-delta="-1"]');
    await page.waitForTimeout(250);
    out.afterMinus = await page.evaluate(readMixer);

    // 3. and back.
    await forceClick(page, '[data-mix="solstice"][data-delta="1"]');
    await page.waitForTimeout(250);
    out.restored = await page.evaluate(readMixer);

    // 4. At the target every + is disabled, and the handler refuses one anyway.
    out.forcedReached = await forceClick(page, '[data-mix="solstice"][data-delta="1"]');
    await page.waitForTimeout(250);
    out.afterOverfill = await page.evaluate(readMixer);

    // 5. Clear empties it.
    await click(page, '[data-mix-clear]');
    await page.waitForTimeout(300);
    out.cleared = await page.evaluate(readMixer);

    // 6. Fill the rest brings it back to exactly the target. From empty there
    //    is no pool, so it spreads over all six: two of each.
    await click(page, '[data-mix-fill]');
    await page.waitForTimeout(400);
    out.filled = await page.evaluate(readMixer);

    // 7. A deliberate, genuinely mixed split: four Solstice and eight Vesper.
    await click(page, '[data-mix-clear]');
    await page.waitForTimeout(300);
    await bump(page, 'solstice', 4);
    await page.waitForTimeout(300);
    await bump(page, 'vesper', 8);
    await page.waitForTimeout(400);
    out.chosen = await page.evaluate(readMixer);

    // 8. It goes into the cart as one line at that price.
    await click(page, '[data-mix-add]');
    await page.waitForTimeout(400);
    await click(page, '[data-cart-open]');
    await page.waitForTimeout(700);
    out.cart = await page.evaluate(readCart);

    // 9. And it is still there, still priced the same, after a reload.
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => document.body.classList.contains('is-live'), undefined, {
      timeout: 300000,
    });
    await page.waitForTimeout(900);
    await click(page, '[data-cart-open]');
    await page.waitForTimeout(700);
    out.reloaded = await page.evaluate(readCart);

    return { ...out, errors };
  });

  /* --- 1. opens at the target -------------------------------------- */
  const i = r.initial;
  if (i.rows !== 6) failures.push(`mixer rendered ${i.rows} flavour rows, expected 6`);
  eq('initial count', i.count, '12 / 12');
  eq('initial meter aria-valuenow', i.meter, '12');
  eq('initial split', i.counts, {
    solstice: '6', glacier: '6', vesper: '0', aurora: '0', verde: '0', monsoon: '0',
  });
  eq('Add enabled at the target', i.addDisabled, false);
  eq('Add label at the target', i.addLabel, 'Add mixed pack');
  eq('Fill disabled at the target', i.fillDisabled, true);
  eq('Clear enabled at the target', i.clearDisabled, false);
  // 6 x 145/12 + 6 x 145/12 = 72.5 + 72.5
  price('initial mixed price', i.price, 145);

  /* --- 2/3. one can out and back ----------------------------------- */
  eq('count after one decrement', r.afterMinus.count, '11 / 12');
  eq('split after one decrement', r.afterMinus.counts.solstice, '5');
  eq('Add disabled below the target', r.afterMinus.addDisabled, true);
  eq('Add label below the target', r.afterMinus.addLabel, 'Pick 1 more');
  // 5 x 145/12 + 6 x 145/12 = 60.416… + 72.5 = 132.916… -> 133
  price('mixed price at eleven cans', r.afterMinus.price, 133);
  eq('count back at the target', r.restored.count, '12 / 12');
  price('mixed price back at the target', r.restored.price, 145);

  /* --- 4. incrementing past the target is refused ------------------ */
  if (!r.forcedReached) failures.push('no + button to force-click at the target');
  eq('every + disabled at the target', r.restored.plusAllDisabled, true);
  eq('count after a forced increment past the target', r.afterOverfill.count, '12 / 12');
  eq('split after a forced increment past the target', r.afterOverfill.counts, r.restored.counts);
  price('mixed price after a forced increment', r.afterOverfill.price, 145);

  /* --- 5. Clear ---------------------------------------------------- */
  eq('count after Clear', r.cleared.count, '0 / 12');
  eq('meter after Clear', r.cleared.meter, '0');
  eq('split after Clear', r.cleared.counts, {
    solstice: '0', glacier: '0', vesper: '0', aurora: '0', verde: '0', monsoon: '0',
  });
  eq('Add disabled after Clear', r.cleared.addDisabled, true);
  eq('Add label after Clear', r.cleared.addLabel, 'Pick 12 more');
  eq('Fill enabled after Clear', r.cleared.fillDisabled, false);
  eq('Clear disabled once empty', r.cleared.clearDisabled, true);
  price('mixed price when empty', r.cleared.price, 0);

  /* --- 6. Fill the rest -------------------------------------------- */
  eq('count after Fill', r.filled.count, '12 / 12');
  eq('split after Fill from empty', r.filled.counts, {
    solstice: '2', glacier: '2', vesper: '2', aurora: '2', verde: '2', monsoon: '2',
  });
  eq('Add enabled after Fill', r.filled.addDisabled, false);
  eq('Fill disabled once full', r.filled.fillDisabled, true);
  // 2 x (145 + 145 + 159 + 145 + 152 + 152) / 12 = 1796/12 = 149.666… -> 150
  price('mixed price two of each', r.filled.price, 150);

  /* --- 7/8. a genuinely mixed pack, in the cart, at its price ------- */
  eq('count for 4 Solstice + 8 Vesper', r.chosen.count, '12 / 12');
  eq('split for 4 Solstice + 8 Vesper', r.chosen.counts, {
    solstice: '4', glacier: '0', vesper: '8', aurora: '0', verde: '0', monsoon: '0',
  });
  // 4 x 145/12 + 8 x 159/12 = 48.333… + 106 = 154.333… -> 154
  price('mixed price 4 Solstice + 8 Vesper', r.chosen.price, 154);

  const c = r.cart;
  if (c.lines.length !== 1) {
    failures.push(`mixed pack made ${c.lines.length} cart lines, expected 1`);
  } else {
    eq('mixed cart line title', c.lines[0].title, 'Mixed pack');
    eq('mixed cart line qty', c.lines[0].qty, '1');
    if (!/4× Solstice/.test(c.lines[0].meta) || !/8× Vesper/.test(c.lines[0].meta)) {
      failures.push(`mixed cart line does not name both flavours: "${c.lines[0].meta}"`);
    }
    price('mixed cart line price', c.lines[0].price, 154);
  }
  eq('cart badge after adding the mixed pack', c.badge, '12');
  price('subtotal with only the mixed pack', c.subtotal, 154);

  /* --- 9. it survives a reload ------------------------------------- */
  const p = r.reloaded;
  if (p.lines.length !== 1) {
    failures.push(`after reload the cart holds ${p.lines.length} lines, expected 1`);
  } else {
    eq('mixed cart line title after reload', p.lines[0].title, 'Mixed pack');
    if (!/4× Solstice/.test(p.lines[0].meta) || !/8× Vesper/.test(p.lines[0].meta)) {
      failures.push(`after reload the mixed line lost its flavours: "${p.lines[0].meta}"`);
    }
    price('mixed cart line price after reload', p.lines[0].price, 154);
  }
  eq('cart badge after reload', p.badge, '12');
  price('subtotal after reload', p.subtotal, 154);

  failures.push(...r.errors);
  notes.push(
    `mixed prices: 6+6 ${amount(r.initial.price)}, 2 of each ${amount(r.filled.price)}, ` +
      `4+8 ${amount(r.chosen.price)} (cart ${amount(r.cart.subtotal)}, after reload ${amount(r.reloaded.subtotal)})`
  );

  return report('shop/pack-builder', failures, notes);
}

export default async function shop() {
  const a = await moneyPath();
  const b = await packBuilder();
  return a && b;
}
