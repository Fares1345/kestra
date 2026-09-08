/**
 * Layout across the sizes the site is actually opened at. Horizontal overflow
 * is the failure that matters: it is invisible on a desktop window and makes a
 * phone scroll sideways.
 */
import { withPage, VIEWPORTS, report } from './harness.mjs';

export default async function layout() {
  const failures = [];
  const notes = [];
  for (const name of Object.keys(VIEWPORTS)) {
    for (const lang of ['en', 'ar']) {
      const r = await withPage({ viewport: name, lang }, async (page, errors) => {
        const doc = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        const worst = await page.evaluate(() => {
          let out = 0;
          let el = null;
          for (const e of document.querySelectorAll('body *')) {
            const r = e.getBoundingClientRect();
            if (!r.width) continue;
            const over = Math.max(Math.ceil(r.right - window.innerWidth), Math.ceil(-r.left));
            if (over > out) { out = over; el = e.className || e.tagName; }
          }
          return { out, el };
        });
        return { doc, worst, errors };
      });
      if (r.doc > 0) failures.push(`[${name}/${lang}] document scrolls ${r.doc}px sideways`);
      failures.push(...r.errors.map((e) => `[${name}/${lang}] ${e}`));
      notes.push(`${name}/${lang}: doc overflow ${r.doc}px`);
    }
  }
  return report('layout', failures, notes);
}
