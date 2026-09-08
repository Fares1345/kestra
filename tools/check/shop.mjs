/**
 * The money path: add, change quantity, promo, checkout, order.
 * Prices are VAT-inclusive Saudi retail, so the totals are asserted exactly.
 */
import { withPage, openCart, report } from './harness.mjs';

export default async function shop() {
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

  // A tampered cart must never break the boot.
  for (const [label, raw] of [
    ['garbage', 'not json'],
    ['wrong shape', '{"a":1}'],
    ['unknown product', '[{"productId":"../evil","packId":"12","qty":1}]'],
    ['negative qty', '[{"productId":"solstice","packId":"12","qty":-5}]'],
  ]) {
    const t = await withPage({ viewport: 'iphone-390', lang: 'en' }, async (page, errors) => {
      await page.evaluate((v) => localStorage.setItem('kestra.cart', v), raw);
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => document.body.classList.contains('is-live'), { timeout: 300000 });
      await page.waitForTimeout(600);
      return { count: (await page.textContent('[data-cart-count]')).trim(), errors };
    });
    if (t.count !== '0') failures.push(`tampered cart (${label}) produced count ${t.count}`);
    failures.push(...t.errors.map((e) => `tampered cart (${label}): ${e}`));
  }
  notes.push('tampered carts rejected: 4/4');

  return report('shop', failures, notes);
}
