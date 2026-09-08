/**
 * Bilingual correctness. Every bug here has actually shipped at least once.
 *
 * A flex row reverses its main axis under dir="rtl", which is how the intro
 * once spelled the brand ARTSEK and the header lockup came out word-first.
 * These assert on the order children are painted in, not on how it looks.
 */
import { withPage, paintedOrder, report } from './harness.mjs';

export default async function rtl() {
  const failures = [];
  const notes = [];

  for (const lang of ['en', 'ar']) {
    const r = await withPage({ viewport: 'iphone-390', lang }, async (page, errors) => {
      const brand = await paintedOrder(page, '.brand');
      const dir = await page.evaluate(() => document.documentElement.dir);
      const htmlLang = await page.evaluate(() => document.documentElement.lang);
      // No element may stick out sideways.
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      // Latin logotypes must not mirror.
      const marks = await page.evaluate(() =>
        [...document.querySelectorAll('.brand, .intro__word, .pay__apple')].map((el) => ({
          cls: el.className.split(' ')[0],
          dir: getComputedStyle(el).direction,
        }))
      );
      return { brand, dir, htmlLang, overflow, marks, errors };
    });

    if (r.htmlLang.slice(0, 2) !== lang) failures.push(`[${lang}] html lang is "${r.htmlLang}"`);
    const wantDir = lang === 'ar' ? 'rtl' : 'ltr';
    if (r.dir !== wantDir) failures.push(`[${lang}] html dir is "${r.dir}", expected ${wantDir}`);
    if (r.overflow > 0) failures.push(`[${lang}] page overflows horizontally by ${r.overflow}px`);
    // The mark leads, the word follows, in both languages.
    if (r.brand && !/^svg/.test(r.brand)) failures.push(`[${lang}] brand lockup paints as "${r.brand}", mark should lead`);
    for (const m of r.marks) {
      if (m.dir !== 'ltr') failures.push(`[${lang}] .${m.cls} has direction:${m.dir}, a Latin logotype must stay ltr`);
    }
    failures.push(...r.errors.map((e) => `[${lang}] ${e}`));
    notes.push(`${lang}: dir=${r.dir} brand="${r.brand}" overflow=${r.overflow}`);
  }

  // The intro wordmark spells the name out span by span; it must read forwards.
  const intro = await withPage({ viewport: 'iphone-390', lang: 'ar' }, (page) =>
    paintedOrder(page, '.intro__word')
  );
  if (intro && intro !== 'KESTRA') failures.push(`intro wordmark paints as "${intro}" in Arabic`);
  notes.push(`intro wordmark in Arabic: "${intro}"`);

  return report('rtl', failures, notes);
}
