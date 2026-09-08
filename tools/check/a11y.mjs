/**
 * Contrast, touch targets, headings and labels.
 *
 * The contrast pass composites the whole background stack: a 4%-alpha white
 * over black is nearly black, and reading only the first non-transparent layer
 * as if it were opaque is how an earlier pass invented a failure that was not
 * there.
 */
import { withPage, report } from './harness.mjs';

const MEASURE = () => {
  const parse = (s) => (s.match(/[\d.]+/g) || []).map(Number);
  const lum = (c) => {
    const [R, G, B] = c.map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  };
  const bgOf = (el) => {
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const m = parse(getComputedStyle(n).backgroundColor);
      if (m.length >= 3) {
        const a = m.length > 3 ? m[3] : 1;
        if (a > 0) {
          layers.push([m[0], m[1], m[2], a]);
          if (a === 1) break;
        }
      }
    }
    let out = [7, 8, 11];
    for (let i = layers.length - 1; i >= 0; i--) {
      const [r, g, b, a] = layers[i];
      out = [r * a + out[0] * (1 - a), g * a + out[1] * (1 - a), b * a + out[2] * (1 - a)];
    }
    return out;
  };

  const contrast = new Set();
  for (const el of document.querySelectorAll('p,span,a,li,dd,dt,small,h1,h2,h3,h4,b,button,label,legend')) {
    if (!el.offsetParent) continue;
    const txt = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.nodeValue.trim()).join('');
    if (!txt) continue;
    const st = getComputedStyle(el);
    const fg = parse(st.color).slice(0, 3);
    if (fg.length < 3) continue;
    const L1 = lum(fg);
    const L2 = lum(bgOf(el));
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const size = parseFloat(st.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(st.fontWeight) >= 700);
    const need = large ? 3 : 4.5;
    if (ratio < need) contrast.add(`contrast ${ratio.toFixed(2)} < ${need} on ${st.fontSize} "${txt.slice(0, 30)}"`);
  }

  const small = new Set();
  for (const el of document.querySelectorAll('button,a[href],select,summary,[role="button"],[role="radio"]')) {
    if (!el.offsetParent) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (r.width < 44 || r.height < 44) {
      small.add(`target ${Math.round(r.width)}x${Math.round(r.height)} ${el.className || el.tagName}`);
    }
  }

  const unlabelled = [...document.querySelectorAll('input,select')].filter(
    (i) => i.offsetParent && !i.labels?.length && !i.getAttribute('aria-label') && !i.getAttribute('aria-labelledby')
  ).length;

  return {
    contrast: [...contrast],
    small: [...small],
    unlabelled,
    h1: document.querySelectorAll('h1').length,
  };
};

export default async function a11y() {
  const failures = [];
  const notes = [];
  for (const lang of ['en', 'ar']) {
    const r = await withPage({ viewport: 'iphone-390', lang }, async (page, errors) => {
      const m = await page.evaluate(MEASURE);
      return { ...m, errors };
    });
    failures.push(...r.contrast.map((c) => `[${lang}] ${c}`));
    failures.push(...r.small.map((c) => `[${lang}] ${c}`));
    if (r.unlabelled) failures.push(`[${lang}] ${r.unlabelled} input(s) with no accessible name`);
    // Exactly one h1: the intro wordmark is decorative and must not be one.
    if (r.h1 !== 1) failures.push(`[${lang}] ${r.h1} h1 elements, expected 1`);
    failures.push(...r.errors.map((e) => `[${lang}] ${e}`));
    notes.push(`${lang}: ${r.contrast.length} contrast, ${r.small.length} small targets, h1=${r.h1}`);
  }
  return report('a11y', failures, notes);
}
