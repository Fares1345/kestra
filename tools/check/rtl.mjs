/**
 * Bilingual correctness. Every bug here has actually shipped at least once.
 *
 * A flex row reverses its main axis under dir="rtl", which is how the intro
 * once spelled the brand ARTSEK and the header lockup came out word-first.
 * These assert on the order children are painted in, not on how it looks.
 *
 * A run of text in one language sitting inside a document declared as the
 * other is announced in the wrong voice, so every visible run is also matched
 * against the lang it would actually be spoken in.
 */
import { withPage, paintedOrder, report } from './harness.mjs';

/**
 * Text that is conventionally left untagged: a brand name and an address are
 * not really "in" a language, and tagging them buys nothing.
 */
const SCRIPT_ALLOW = ['KESTRA', 'hello@kestra.sa'];

/**
 * Every visible run of text, paired with the lang it would actually be
 * announced in — its own, its nearest tagged ancestor's, or the document's.
 * Runs that mix the two scripts are left alone: t() fences interpolated
 * values in bidi isolates, and an Arabic sentence quoting a Latin promo code
 * is still an Arabic sentence.
 */
const mistaggedRuns = (page, allow) =>
  page.evaluate((allowList) => {
    const ARABIC = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
    const LATIN = /[A-Za-z]/;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const out = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node.nodeValue || '').replace(/\s+/g, ' ').trim();
      if (!text || allowList.includes(text)) continue;
      const el = node.parentElement;
      if (!el || el.closest('script, style, template, noscript')) continue;
      // Nothing hidden from the accessibility tree can be mispronounced.
      if (el.closest('[aria-hidden="true"], [hidden], [inert]')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height) continue;

      const arabic = ARABIC.test(text);
      const latin = LATIN.test(text);
      if (arabic === latin) continue; // no letters at all, or both scripts
      const script = arabic ? 'ar' : 'en';

      const tagged = el.closest('[lang]'); // <html> always carries one
      const effective = String(tagged ? tagged.lang : '').slice(0, 2).toLowerCase();
      if (effective !== script) {
        const where = el.tagName.toLowerCase() + (el.className ? `.${String(el.className).split(' ')[0]}` : '');
        out.push({ text: text.slice(0, 40), script, effective, where });
      }
    }
    return out;
  }, allow);

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
      const runs = await mistaggedRuns(page, SCRIPT_ALLOW);
      // And again after a switch: the label names the *other* language, so it
      // has to be re-tagged on every toggle, not only on first load.
      await page.click('[data-lang-toggle]');
      await page.waitForTimeout(800);
      const toggledTo = await page.evaluate(() => document.documentElement.lang);
      const toggledRuns = await mistaggedRuns(page, SCRIPT_ALLOW);
      return { brand, dir, htmlLang, overflow, marks, runs, toggledTo, toggledRuns, errors };
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
    for (const run of r.runs) {
      failures.push(
        `[${lang}] "${run.text}" is ${run.script === 'ar' ? 'Arabic' : 'Latin'} text announced as lang="${run.effective}" (${run.where}) — it needs lang="${run.script}"`
      );
    }
    for (const run of r.toggledRuns) {
      failures.push(
        `[${lang}->${r.toggledTo}] after toggling, "${run.text}" is ${run.script === 'ar' ? 'Arabic' : 'Latin'} text announced as lang="${run.effective}" (${run.where}) — it needs lang="${run.script}"`
      );
    }
    failures.push(...r.errors.map((e) => `[${lang}] ${e}`));
    notes.push(`${lang}: dir=${r.dir} brand="${r.brand}" overflow=${r.overflow}`);
    const mistagged = r.runs.length + r.toggledRuns.length;
    notes.push(
      mistagged
        ? `${lang}: ${mistagged} run(s) announced in the wrong language, before and after toggling to ${r.toggledTo}`
        : `${lang}: script/lang agrees on every visible run, and again after toggling to ${r.toggledTo}`
    );
  }

  // The intro wordmark spells the name out span by span; it must read forwards.
  const intro = await withPage({ viewport: 'iphone-390', lang: 'ar' }, (page) =>
    paintedOrder(page, '.intro__word')
  );
  if (intro && intro !== 'KESTRA') failures.push(`intro wordmark paints as "${intro}" in Arabic`);
  notes.push(`intro wordmark in Arabic: "${intro}"`);

  return report('rtl', failures, notes);
}
