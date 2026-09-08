/**
 * Accessibility: what the page measures at rest, and what it does under a
 * keyboard.
 *
 * Two passes run in the same browser session per language, because opening the
 * site is by far the most expensive thing here.
 *
 *   a11y           — contrast, touch targets, headings, labels. The contrast
 *                    pass composites the whole background stack: a 4%-alpha
 *                    white over black is nearly black, and reading only the
 *                    first non-transparent layer as if it were opaque is how an
 *                    earlier pass invented a failure that was not there.
 *   a11y/keyboard  — a whole purchase driven by Tab, Enter and Space; both
 *                    overlays trapping focus and giving it back; a visible ring
 *                    on every stop; the live regions that say what changed; and
 *                    the reveals under reduced motion.
 *
 * Nothing below uses `.click()` or `.focus()`. A control that only a script can
 * reach is, to a keyboard user, unreachable, so a walk that takes the shortcut
 * proves nothing. The scroll probe is a real wheel gesture for the same reason:
 * `window.scrollTo` walks straight through `overflow: hidden` and would call
 * every scroll lock broken.
 *
 * The keyboard pass runs in English only. Tab order is DOM order in both
 * directions and the trap is direction-agnostic; the RTL-specific risks live in
 * rtl.mjs, and a second full walk would cost another site load.
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

/* ------------------------------------------------------------------ *
 * keyboard plumbing
 *
 * Everything here is asked of the page one key at a time. `tabTo` is the only
 * way anything below reaches a control: if it cannot find it inside `max`
 * presses, the control is unreachable and that is the failure.
 * ------------------------------------------------------------------ */

/** One line naming what has focus, for failure messages. */
const ACTIVE = () => {
  const el = document.activeElement;
  if (!el || el === document.body) return '<body>';
  const data = [...el.attributes].filter((a) => a.name.startsWith('data-') && a.name !== 'data-fi');
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 22);
  return `${el.tagName.toLowerCase()}.${String(el.className || '').split(' ')[0]}[${data
    .map((a) => a.name)
    .join('|')}]${text ? ` "${text}"` : ''}`;
};

const describe = (page) => page.evaluate(ACTIVE);

const activeMatches = (page, sel) => page.evaluate((s) => !!document.activeElement?.matches?.(s), sel);

/**
 * Wait for a panel to be open (or closed) rather than for a number of
 * milliseconds — under software rendering, and with another check sharing the
 * machine, a fixed sleep is a coin toss. A timeout is not reported here: the
 * assertion that follows says what was actually wrong.
 */
const waitPanel = (page, sel, open) =>
  page
    .waitForFunction(
      ([s, o]) => (document.querySelector(s)?.hidden !== true) === o,
      [sel, open],
      { timeout: 6000 }
    )
    .catch(() => {});

/** Tab (or Shift+Tab) until the focused element matches. Presses used, or -1. */
async function tabTo(page, sel, { max = 90, back = false } = {}) {
  for (let i = 0; i <= max; i++) {
    if (await activeMatches(page, sel)) return i;
    await page.keyboard.press(back ? 'Shift+Tab' : 'Tab');
  }
  return -1;
}

/**
 * Tag every focusable under `root` and remember how it looks unfocused, so a
 * later stop can be compared against its own resting appearance rather than
 * against a neighbour's.
 *
 * Two wrinkles the site actually has:
 *
 *   - The pack radios and the subscribe switch are inputs at opacity 0 with a
 *     painted proxy beside them, so the appearance that matters belongs to the
 *     label around them. `subject` follows that, and the signature covers the
 *     subject's subtree, which is where `.switch__track` draws its ring.
 *   - A panel autofocuses something the moment it opens, so whatever is tagged
 *     at that instant has its *focused* look recorded as its resting one. The
 *     walk repairs each entry as focus leaves it, and only an element's last
 *     visit counts.
 */
const FI_BASELINE = (rootSel) => {
  const SEL =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const subject = (el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const proxied = el.tagName === 'INPUT' && (Number(s.opacity) < 0.1 || r.width < 2 || r.height < 2);
    return proxied ? el.closest('label') || el.parentElement || el : el;
  };
  const props = (el) => {
    const subj = subject(el);
    // Descendants that cannot be seen cannot carry the indicator: the pack
    // radios are inputs at opacity 0, and the page's own :focus-visible rule
    // duly draws an outline on them that nobody will ever see. Only the
    // subject itself is measured unconditionally.
    const nodes = [subj, ...subj.querySelectorAll('*')]
      .filter((n, i) => {
        if (i === 0) return true;
        const s = getComputedStyle(n);
        const r = n.getBoundingClientRect();
        return Number(s.opacity) >= 0.1 && s.visibility !== 'hidden' && r.width >= 2 && r.height >= 2;
      })
      .slice(0, 14);
    const out = { outline: '', shadow: '', border: '', opacity: '', background: '', color: '', underline: '' };
    for (const n of nodes) {
      const s = getComputedStyle(n);
      out.outline += `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}|`;
      out.shadow += `${s.boxShadow}|`;
      out.border += `${s.borderTopWidth} ${s.borderTopColor} ${s.borderTopStyle} ${s.borderBottomWidth} ${s.borderBottomColor}|`;
      out.opacity += `${s.opacity}|`;
      out.background += `${s.backgroundColor}|`;
      out.color += `${s.color}|`;
      out.underline += `${s.textDecorationLine}|`;
    }
    return out;
  };
  const root = document.querySelector(rootSel);
  if (!root) return 0;
  const base = {};
  [...root.querySelectorAll(SEL)].forEach((el, i) => {
    el.dataset.fi = String(i);
    base[i] = props(el);
  });
  window.__fi = { base, props, subject };
  return Object.keys(base).length;
};

/**
 * The focused element: which of its own resting properties moved, and whether
 * anything of it is actually on screen to see. An outline painted on a pane
 * that sits at opacity 0 is not a focus indicator.
 *
 * `prevId` is the stop we just came from; now that it has lost focus, its true
 * resting appearance can be recorded over whatever was captured before.
 */
const FI_ACTIVE = ({ panelSel = null, prevId = null } = {}) => {
  const store = window.__fi;
  if (store && prevId !== null && prevId !== undefined) {
    const prev = document.querySelector(`[data-fi="${prevId}"]`);
    if (prev && prev !== document.activeElement) store.base[prevId] = store.props(prev);
  }

  const el = document.activeElement;
  if (!el || el === document.body) return { id: null, body: true };
  const id = el.dataset.fi ?? null;
  const before = store && id !== null ? store.base[id] : null;
  const now = store ? store.props(el) : null;
  const changed = before && now ? Object.keys(now).filter((k) => now[k] !== before[k]) : null;
  if (store && id !== null && now) (store.focused ||= {})[id] = now;

  const subj = store ? store.subject(el) : el;
  let opacity = 1;
  let visible = true;
  for (let n = subj; n && n.nodeType === 1; n = n.parentElement) {
    const s = getComputedStyle(n);
    opacity *= parseFloat(s.opacity || '1');
    if (s.visibility === 'hidden' || s.visibility === 'collapse' || s.display === 'none') visible = false;
  }
  const r = subj.getBoundingClientRect();
  const panel = panelSel ? document.querySelector(panelSel) : null;

  const data = [...el.attributes].filter((a) => a.name.startsWith('data-') && a.name !== 'data-fi');
  const where =
    subj === el ? '' : ` inside ${subj.tagName.toLowerCase()}.${String(subj.className || '').split(' ')[0]}`;
  return {
    id,
    body: false,
    changed,
    opacity: Number(opacity.toFixed(3)),
    visible,
    size: [Math.round(r.width), Math.round(r.height)],
    inPanel: panel ? panel.contains(el) : null,
    name: `${el.tagName.toLowerCase()}.${String(el.className || '').split(' ')[0]}[${data
      .map((a) => a.name)
      .join('|')}]${where}`,
  };
};

/**
 * The same comparison, made the honest way round: what did this stop look like
 * while it held focus, against what it looks like now that it has let go.
 *
 * The document sweep visits each stop once, and half the page is a `.reveal`
 * that was still at opacity 0 when the baseline was taken — so a section that
 * merely faded in on its way past would otherwise read as "it changed".
 */
const FI_RECHECK = (id) => {
  const store = window.__fi;
  if (!store || id === null || id === undefined) return null;
  const el = document.querySelector(`[data-fi="${id}"]`);
  if (!el || el === document.activeElement) return null;
  const focused = store.focused?.[id];
  if (!focused) return null;
  const resting = store.props(el);
  return Object.keys(resting).filter((k) => resting[k] !== focused[k]);
};

/** The properties that count as a focus indicator a sighted user can see. */
const RING = ['outline', 'shadow', 'border', 'opacity', 'background', 'color', 'underline'];

/**
 * Walk `presses` stops with Tab, collecting for each: where it landed, whether
 * it stayed inside `panelSel`, and whether it changed appearance. One helper
 * serves the whole-document sweep and both overlay traps.
 *
 * A stop that reads as invisible is read again after a pause: the reveals fade
 * in over 800ms and `.card__peek` over 320ms, and catching one of those
 * mid-flight is not the same thing as a control nobody can see.
 */
/**
 * Read the stop Tab has just landed on, giving anything mid-fade time to
 * finish before calling it invisible. Tab scrolls its target into view, the
 * page scrolls smoothly, the card it sits in then reveals over 800ms and
 * `.card__peek` fades in over 320ms — comfortably more than one wait.
 */
async function readStop(page, { panelSel = null, prevId = null } = {}) {
  let s = await page.evaluate(FI_ACTIVE, { panelSel, prevId });
  if (!s.body && (!s.visible || s.opacity < 0.1)) {
    // Wait for it to appear rather than for a fixed number of milliseconds: the
    // page scrolls smoothly to the stop, the card it sits in then reveals over
    // 800ms and the button fades in over 320ms, and on a loaded machine that
    // chain runs long. Something that is genuinely invisible costs this wait
    // once and is then reported.
    await page
      .waitForFunction(
        () => {
          const el = document.activeElement;
          if (!el || el === document.body) return true;
          const own = getComputedStyle(el);
          const box = el.getBoundingClientRect();
          const proxied = el.tagName === 'INPUT' && (Number(own.opacity) < 0.1 || box.width < 2 || box.height < 2);
          const subj = proxied ? el.closest('label') || el.parentElement || el : el;
          let op = 1;
          for (let n = subj; n && n.nodeType === 1; n = n.parentElement) {
            const st = getComputedStyle(n);
            op *= parseFloat(st.opacity || '1');
            if (st.visibility === 'hidden' || st.display === 'none') return false;
          }
          const r = subj.getBoundingClientRect();
          return op >= 0.1 && r.width >= 1 && r.height >= 1;
        },
        undefined,
        { timeout: 3500, polling: 'raf' }
      )
      .catch(() => {});
    s = await page.evaluate(FI_ACTIVE, { panelSel });
  }
  // The focused look is transitioned in too — the newsletter field takes 240ms
  // to bring its border round — so a stop that appears unchanged is read once
  // more before it is believed.
  if (!s.body && s.changed && !s.changed.some((k) => RING.includes(k))) {
    await page.waitForTimeout(350);
    s = await page.evaluate(FI_ACTIVE, { panelSel });
  }
  return s;
}

async function walk(page, presses, { panelSel = null } = {}) {
  const stops = [];
  let prev = await page.evaluate(() => document.activeElement?.dataset?.fi ?? null);
  for (let i = 0; i < presses; i++) {
    await page.keyboard.press('Tab');
    const s = await readStop(page, { panelSel, prevId: prev });
    prev = s.id;
    stops.push(s);
  }
  return settle(page, stops);
}

/**
 * Stops with no visible change of appearance, or invisible while focused. An
 * element seen more than once is judged on its last visit: by then its resting
 * appearance has been re-measured while something else held focus.
 */
function ringFailures(stops, label) {
  const verdict = new Map();
  for (const s of stops) {
    if (s.body) continue;
    let msg = null;
    if (!s.visible || s.opacity < 0.1) {
      msg = `[${label}] focus lands on ${s.name} while it is invisible (opacity ${s.opacity}${s.visible ? '' : ', visibility hidden'})`;
    } else if (!s.size[0] || !s.size[1]) {
      msg = `[${label}] focus lands on ${s.name} with a ${s.size[0]}x${s.size[1]} box — nothing to draw a ring on`;
    } else if (s.changed && !s.changed.some((k) => RING.includes(k))) {
      msg = `[${label}] ${s.name} looks identical focused and unfocused — no outline, shadow or border change`;
    }
    verdict.set(s.id ?? s.name, msg);
  }
  // Six identical nav links fail for one identical reason; say it once.
  const counts = new Map();
  for (const m of [...verdict.values()].filter(Boolean)) counts.set(m, (counts.get(m) || 0) + 1);
  return [...counts].map(([m, n]) => (n > 1 ? `${m} (x${n})` : m));
}

/**
 * Re-judge the stops that looked unchanged once their transitions have run.
 *
 * The focus styles here are transitioned — the newsletter field fades its
 * border over 240ms — so a resting reading taken the instant focus leaves is
 * still the focused one, and every such control would read as "identical".
 */
async function settle(page, stops) {
  const suspect = stops.filter(
    (s) => !s.body && s.id !== null && s.changed && !s.changed.some((k) => RING.includes(k))
  );
  if (!suspect.length) return stops;
  await page.waitForTimeout(450);
  for (const s of suspect) {
    const changed = await page.evaluate(FI_RECHECK, s.id);
    if (changed) s.changed = changed;
  }
  return stops;
}

/** Everything the shop says about itself, in one round trip. */
const STATE = () => {
  const clean = (s) => String(s ?? '').replace(/[⁨⁩]/g, '').replace(/\s+/g, ' ').trim();
  const live = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const l = n.getAttribute?.('aria-live');
      const role = n.getAttribute?.('role');
      if (l && l !== 'off') return `aria-live=${l} on ${n.tagName.toLowerCase()}`;
      if (role === 'status' || role === 'alert') return `role=${role} on ${n.tagName.toLowerCase()}`;
    }
    return null;
  };
  const name = (el) => {
    if (!el) return null;
    const by = el.getAttribute('aria-labelledby');
    if (by) {
      const parts = by
        .split(/\s+/)
        .map((id) => document.getElementById(id))
        .filter(Boolean)
        .map((n) => clean(n.textContent));
      if (parts.join(' ').trim()) return clean(parts.join(' '));
    }
    return clean(el.getAttribute('aria-label') || el.textContent);
  };
  const toast = document.querySelector('[data-toasts] .toast');
  const cartLive = document.querySelector('[data-cart-live]');
  const cartBtn = document.querySelector('[data-cart-open]');
  return {
    count: clean(document.querySelector('[data-cart-count]')?.textContent),
    subtotal: clean(document.querySelector('[data-sum-subtotal]')?.textContent),
    total: clean(document.querySelector('[data-sum-total]')?.textContent),
    qty: clean(document.querySelector('[data-cart-items] .stepper output')?.textContent),
    lines: document.querySelectorAll('[data-cart-items] .cart-line').length,
    toast: toast ? { text: clean(toast.textContent), live: live(toast) } : null,
    cartLive: cartLive ? { text: clean(cartLive.textContent), live: live(cartLive) } : null,
    cartName: name(cartBtn),
    cartOpen: !document.querySelector('[data-cart]')?.hidden,
    paying: !!document.querySelector('[data-cart]')?.classList.contains('is-paying'),
    pdpOpen: !document.querySelector('[data-pdp]')?.hidden,
    locked: document.body.classList.contains('is-locked'),
    focusInCart: !!document.activeElement?.closest?.('[data-cart]'),
  };
};

const state = (page) => page.evaluate(STATE);

/**
 * Does the page behind scroll under a real scroll gesture?
 *
 * It has to be the wheel and not `window.scrollTo`: the lock is
 * `body { overflow: hidden }`, which stops a person scrolling but does not stop
 * a script, so a scripted scroll reports every lock as broken.
 */
async function scrollProbe(page) {
  const v = page.viewportSize() || { width: 390, height: 844 };
  const at = () => page.evaluate(() => window.scrollY);
  const before = await at();
  await page.mouse.move(Math.round(v.width / 2), Math.round(v.height / 2));
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(400);
  let after = await at();
  // Tabbing through the footer leaves the page at the bottom, where scrolling
  // down proves nothing. Try the other way before believing it is stuck.
  if (after === before) {
    await page.mouse.wheel(0, -500);
    await page.waitForTimeout(400);
    after = await at();
  }
  if (after !== before) {
    await page.mouse.wheel(0, before - after);
    await page.waitForTimeout(400);
  }
  // Park the pointer out of the way: a card left under it would hover its
  // Quick look into view and hide the very thing the ring check is looking for.
  await page.mouse.move(1, 1);
  return after !== before;
}

/* ------------------------------------------------------------------ *
 * overlays
 * ------------------------------------------------------------------ */

/**
 * One overlay, opened from whatever currently has focus with Enter.
 *
 * A dialog that takes focus and will not give it back is a trap in the bad
 * sense; one that never takes it leaves the screen reader reading the page
 * behind. Both are checked here, along with the wrap (walked far enough to come
 * round more than once), Escape, the return of focus to the opener, and the
 * background sitting still while the panel is up.
 */
async function overlay(page, { label, panelSel, expectedFirst }) {
  const failures = [];
  const notes = [];
  const opener = await describe(page);

  // Mark the opener so "focus came back" is an identity, not a resemblance —
  // six cards carry the same "Quick look".
  await page.evaluate(() => document.activeElement?.setAttribute('data-kb-opener', ''));

  const scrolls = await scrollProbe(page);
  if (!scrolls) {
    failures.push(`[${label}] the page will not scroll even with nothing open — the scroll-lock assertion below would be vacuous`);
  }

  await page.keyboard.press('Enter');
  await waitPanel(page, panelSel, true);
  await page.waitForTimeout(400);

  const opened = await page.evaluate(
    (sel) => ({
      hidden: document.querySelector(sel)?.hidden,
      inside: !!document.activeElement?.closest(sel),
      focus: document.activeElement?.tagName?.toLowerCase(),
      autofocus: document.activeElement?.hasAttribute?.('data-autofocus'),
      locked: document.body.classList.contains('is-locked'),
      stops: [...document.querySelectorAll(sel + ' a[href], ' + sel + ' button:not([disabled]), ' + sel + ' input:not([disabled]), ' + sel + ' select:not([disabled])')].filter(
        (el) => el.offsetParent !== null
      ).length,
    }),
    panelSel
  );

  if (opened.hidden !== false) failures.push(`[${label}] Enter on ${opener} did not open ${panelSel}`);
  if (!opened.inside) failures.push(`[${label}] opened but focus stayed outside the panel (on ${await describe(page)})`);
  if (expectedFirst && !(await activeMatches(page, expectedFirst))) {
    failures.push(`[${label}] focus went to ${await describe(page)}, expected ${expectedFirst}`);
  }
  if (!opened.locked) failures.push(`[${label}] body is not marked locked while the panel is open`);
  if (opened.stops < 2) failures.push(`[${label}] only ${opened.stops} focusable stop(s) in the panel — a trap cannot be proved`);

  if (await scrollProbe(page)) {
    failures.push(`[${label}] the page behind the panel still scrolls`);
  }

  // Far enough round to wrap at least twice.
  await page.evaluate(FI_BASELINE, panelSel);
  const presses = Math.min(40, opened.stops * 3 + 2);
  const stops = await walk(page, presses, { panelSel });
  const escaped = stops.filter((s) => s.body || s.inPanel === false);
  const firstId = stops[0]?.id;
  const wraps = firstId === null || firstId === undefined ? 0 : stops.filter((s) => s.id === firstId).length - 1;

  if (escaped.length) {
    failures.push(
      `[${label}] Tab left the panel ${escaped.length}/${presses} times — first onto ${escaped[0].body ? '<body>' : escaped[0].name}`
    );
  }
  if (wraps < 2) {
    failures.push(`[${label}] ${presses} presses came back to the first stop ${wraps} time(s); expected the cycle to wrap at least twice`);
  }
  failures.push(...ringFailures(stops, label));

  // And backwards, which is a different branch of the same handler.
  const backStops = [];
  for (let i = 0; i < opened.stops + 2; i++) {
    await page.keyboard.press('Shift+Tab');
    backStops.push(await page.evaluate(FI_ACTIVE, { panelSel }));
  }
  const backEscaped = backStops.filter((s) => s.body || s.inPanel === false);
  if (backEscaped.length) {
    failures.push(`[${label}] Shift+Tab left the panel ${backEscaped.length}/${backStops.length} times`);
  }

  await page.keyboard.press('Escape');
  await waitPanel(page, panelSel, false);
  await page.waitForTimeout(200);
  const closed = await page.evaluate(
    (sel) => ({
      hidden: document.querySelector(sel)?.hidden,
      locked: document.body.classList.contains('is-locked'),
      restored: !!document.activeElement?.hasAttribute?.('data-kb-opener'),
      now: document.activeElement === document.body ? '<body>' : document.activeElement?.tagName?.toLowerCase(),
    }),
    panelSel
  );
  if (closed.hidden !== true) failures.push(`[${label}] Escape did not close the panel`);
  if (closed.locked) failures.push(`[${label}] body stayed locked after Escape`);
  if (!closed.restored) failures.push(`[${label}] focus did not return to the opener (${opener}); it is on ${closed.now}`);
  if (!(await scrollProbe(page))) failures.push(`[${label}] the page still will not scroll after the panel closed`);

  await page.evaluate(() => document.querySelector('[data-kb-opener]')?.removeAttribute('data-kb-opener'));
  notes.push(`${label}: ${opened.stops} stops, ${presses} presses, ${wraps} wraps, ${escaped.length} escapes`);
  return { failures, notes };
}

/* ------------------------------------------------------------------ *
 * a whole purchase, by keyboard
 * ------------------------------------------------------------------ */

/**
 * Reach a product, add it, open the cart, raise the quantity, apply a promo,
 * check out and pay — Tab, Shift+Tab, Enter and Space only. Every step asserts
 * the money and the count, so the walk cannot pass by wandering into something
 * that happens to be focusable.
 *
 * The cart drawer's own behaviour is checked in the middle of this, while it
 * has something in it.
 */
export async function keyboardPurchase(page) {
  const failures = [];
  const notes = [];
  const eq = (what, got, want) => {
    if (got !== want) failures.push(`[purchase] ${what}: got "${got}", expected "${want}"`);
  };
  const announced = (what, said, must) => {
    if (!said) return failures.push(`[announce] ${what} said nothing`);
    if (!said.live) failures.push(`[announce] ${what} changed "${said.text}" outside any live region`);
    if (must && !must.test(said.text)) failures.push(`[announce] ${what} announced "${said.text}", expected ${must}`);
  };

  /* --- 1. reach a product and add it ------------------------------- */
  const toAdd = await tabTo(page, '[data-add]');
  if (toAdd < 0) {
    failures.push('[purchase] no Add button is reachable by Tab from the top of the page');
    return { failures, notes };
  }
  notes.push(`${toAdd} tabs from the top of the page to the first Add`);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);

  let s = await state(page);
  eq('cart count after one Add', s.count, '12');
  eq('subtotal after one Add', s.subtotal, 'SAR 145');
  announced('adding to the cart', s.toast, /added/i);
  announced('the cart count', s.cartLive, /12/);
  if (s.cartName && !s.cartName.includes(s.count)) {
    failures.push(`[announce] the cart control is still named "${s.cartName}" with ${s.count} cans in it`);
  }

  /* --- 2. back to the cart button and open it ---------------------- */
  const back = await tabTo(page, '[data-cart-open]', { back: true });
  if (back < 0) {
    failures.push('[purchase] Shift+Tab never reaches the cart button from the shop grid');
    return { failures, notes };
  }
  notes.push(`${back} back-tabs from the shop grid to the cart button`);

  /* --- 3. the drawer, with something in it ------------------------- */
  const drawer = await overlay(page, {
    label: 'cart drawer',
    panelSel: '[data-cart]',
    expectedFirst: '[data-cart-close]',
  });
  failures.push(...drawer.failures);
  notes.push(...drawer.notes);

  // Escape put us back on the cart button; open it again to carry on.
  if ((await tabTo(page, '[data-cart-open]', { max: 4 })) < 0) {
    failures.push('[purchase] lost the cart button after the drawer closed');
    return { failures, notes };
  }
  await page.keyboard.press('Enter');
  await waitPanel(page, '[data-cart]', true);
  await page.waitForTimeout(400);

  /* --- 4. raise the quantity --------------------------------------- */
  const toPlus = await tabTo(page, '[data-qty][data-delta="1"]', { max: 20 });
  if (toPlus < 0) {
    failures.push('[purchase] the quantity + is not reachable by Tab inside the drawer');
    return { failures, notes };
  }
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  s = await state(page);
  eq('quantity after one +', s.qty, '2');
  eq('cart count after one +', s.count, '24');
  eq('subtotal after one +', s.subtotal, 'SAR 290');
  announced('the cart count after a quantity change', s.cartLive, /24/);
  if (!s.focusInCart) {
    failures.push('[purchase] changing the quantity dropped focus out of the drawer (activeElement is now outside it)');
  }

  /* --- 5. promo ---------------------------------------------------- */
  if ((await tabTo(page, '[data-promo-input]', { max: 20 })) < 0) {
    failures.push('[purchase] the promo field is not reachable by Tab inside the drawer');
    return { failures, notes };
  }
  await page.keyboard.type('KESTRA15');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(700);
  s = await state(page);
  eq('total with KESTRA15', s.total, 'SAR 246.5');
  announced('applying a promo', s.toast, /KESTRA15/);

  /* --- 6. checkout ------------------------------------------------- */
  if ((await tabTo(page, '[data-checkout]', { max: 20 })) < 0) {
    failures.push('[purchase] Checkout is not reachable by Tab inside the drawer');
    return { failures, notes };
  }
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
  s = await state(page);
  if (!s.paying) failures.push('[purchase] Enter on Checkout did not open the payment view');
  if (!s.focusInCart) failures.push('[purchase] checkout moved focus outside the drawer');

  // The payment view is rendered fresh, so re-measure the ring on its controls
  // and confirm the trap still holds around them.
  const payStops = await page.evaluate(FI_BASELINE, '[data-cart]');
  const stops = await walk(page, Math.min(20, payStops + 2), { panelSel: '[data-cart]' });
  const out = stops.filter((x) => x.body || x.inPanel === false);
  if (out.length) failures.push(`[purchase] Tab left the payment view ${out.length}/${stops.length} times`);
  failures.push(...ringFailures(stops, 'payment view'));

  // The methods are a radiogroup. Arrows are how ARIA says to move within one;
  // this only reports what happens, because Tab reaches all three either way.
  if ((await tabTo(page, '[data-pay-method]', { max: 20 })) < 0) {
    failures.push('[purchase] no payment method is reachable by Tab');
  } else {
    const before = await page.evaluate(() => document.activeElement.dataset.payMethod);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => document.activeElement.dataset.payMethod);
    notes.push(
      after === before
        ? `payment radiogroup: ArrowRight does not move within it (still "${before}") — Tab does reach all three`
        : `payment radiogroup: ArrowRight moved ${before} -> ${after}`
    );
  }

  /* --- 7. pay ------------------------------------------------------ */
  if ((await tabTo(page, '[data-place-order]', { max: 20 })) < 0) {
    failures.push('[purchase] the pay button is not reachable by Tab');
    return { failures, notes };
  }
  await page.keyboard.press('Space');
  await page.waitForTimeout(1000);
  s = await state(page);
  announced('placing the order', s.toast, /246\.5/);
  eq('cart count after paying', s.count, '0');
  eq('cart lines after paying', String(s.lines), '0');
  announced('the emptied cart', s.cartLive, /empty|فارغ/i);

  // The drawer closes itself a second after the order, then takes its
  // transition to go `hidden`. Wait for that to happen rather than for a
  // number of milliseconds, which on a loaded machine is a coin toss.
  const closedItself = await page
    .waitForFunction(() => document.querySelector('[data-cart]')?.hidden === true, undefined, { timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  const after = await state(page);
  if (!closedItself) failures.push('[purchase] the drawer stayed open 8s after the order was placed');
  if (after.locked) failures.push('[purchase] the background stayed locked after the order was placed');

  notes.push('purchase: 12 cans -> 24 -> KESTRA15 -> SAR 246.5 -> paid, cart 0');
  return { failures, notes };
}

/* ------------------------------------------------------------------ *
 * the product dialog
 * ------------------------------------------------------------------ */

/**
 * The dialog, opened from a card's Quick look: the overlay contract first, and
 * then the part that once broke.
 *
 * Its trigger and the dialog itself both answer to `data-pdp`, and the click
 * handler matched the dialog for anything clicked inside it — so every control
 * in there reopened the dialog on an empty product id and threw, and Escape was
 * the only way out. Enter and Space on a button raise a click, so operating the
 * dialog from the keyboard walks straight into that if it ever comes back: the
 * subscribe switch has to leave the dialog open, and Add has to close it and
 * put twelve cans in the cart. Any throw lands in the harness's error list.
 */
export async function productDialog(page) {
  const failures = [];
  const notes = [];
  if ((await tabTo(page, '[data-pdp-open]')) < 0) {
    return { failures: ['[product dialog] no Quick look is reachable by Tab'], notes };
  }

  const r = await overlay(page, {
    label: 'product dialog',
    panelSel: '[data-pdp]',
    expectedFirst: '[data-pdp-close]',
  });
  failures.push(...r.failures);
  notes.push(...r.notes);

  // Escape left focus on the Quick look that opened it. Open it again and use
  // it this time.
  if ((await tabTo(page, '[data-pdp-open]', { max: 4 })) < 0) {
    failures.push('[product dialog] lost the Quick look button after the dialog closed');
    return { failures, notes };
  }
  await page.keyboard.press('Enter');
  await waitPanel(page, '[data-pdp]', true);
  await page.waitForTimeout(400);

  const priceOf = () =>
    page.evaluate(() => (document.querySelector('.pdp__price b')?.textContent || '').replace(/[\u2068\u2069]/g, '').trim());
  const before = await priceOf();

  if ((await tabTo(page, '[data-subscribe]', { max: 12 })) < 0) {
    failures.push('[product dialog] the subscribe switch is not reachable by Tab inside the dialog');
  } else {
    await page.keyboard.press('Space');
    await page.waitForTimeout(600);
    const after = await page.evaluate(() => ({
      open: document.querySelector('[data-pdp]')?.hidden !== true,
      inside: !!document.activeElement?.closest('[data-pdp]'),
      price: (document.querySelector('.pdp__price b')?.textContent || '').replace(/[\u2068\u2069]/g, '').trim(),
    }));
    if (!after.open) failures.push('[product dialog] the subscribe switch closed the dialog');
    if (after.price === before) {
      failures.push(`[product dialog] subscribing left the price at ${before} — the switch did nothing`);
    }
    if (!after.inside) {
      failures.push('[product dialog] subscribing dropped focus out of the dialog (activeElement is now outside it)');
    }
    notes.push(`product dialog: subscribe took the price ${before} -> ${after.price}`);
  }

  if ((await tabTo(page, '[data-pdp-add]')) < 0) {
    failures.push('[product dialog] Add is not reachable by Tab inside the dialog');
    return { failures, notes };
  }
  await page.keyboard.press('Enter');
  await waitPanel(page, '[data-pdp]', false);
  await page.waitForTimeout(400);
  const done = await state(page);
  if (done.pdpOpen) failures.push('[product dialog] Add did not close the dialog');
  if (done.count !== '12') failures.push(`[product dialog] Add put ${done.count} cans in the cart, expected 12`);
  if (!done.toast?.live) {
    failures.push(`[product dialog] adding from the dialog announced "${done.toast?.text ?? 'nothing'}" outside any live region`);
  }
  if (done.locked) failures.push('[product dialog] the background stayed locked after Add closed the dialog');

  return { failures, notes };
}

/* ------------------------------------------------------------------ *
 * every stop, and the ring on it
 * ------------------------------------------------------------------ */

/**
 * One lap of the whole document's tab order. Each stop must both change
 * appearance when it takes focus and be visible enough for that change to be
 * seen: an outline drawn on a pane sitting at opacity 0 is not an indicator,
 * and a control that is reachable but invisible is worse than one that is not
 * reachable at all.
 */
export async function focusIndicators(page) {
  const failures = [];
  const notes = [];
  const total = await page.evaluate(FI_BASELINE, 'body');
  const seen = new Set();
  const stops = [];
  for (let i = 0; i < Math.min(120, total + 4); i++) {
    await page.keyboard.press('Tab');
    const s = await readStop(page);
    // The stop we just left can now be compared against its resting look.
    const prev = stops[stops.length - 1];
    if (prev && prev.id !== null) {
      const changed = await page.evaluate(FI_RECHECK, prev.id);
      if (changed) prev.changed = changed;
    }
    if (s.id !== null && seen.has(s.id)) break; // a full lap
    if (s.id !== null) seen.add(s.id);
    stops.push(s);
  }
  const last = stops[stops.length - 1];
  if (last && last.id !== null) {
    const changed = await page.evaluate(FI_RECHECK, last.id);
    if (changed) last.changed = changed;
  }
  await settle(page, stops);
  if (stops.length < 10) failures.push(`[focus ring] only ${stops.length} tab stops found on the page`);
  failures.push(...ringFailures(stops, 'focus ring'));
  notes.push(`focus ring: ${stops.length} stops walked, ${total} focusable elements tagged`);
  return { failures, notes };
}

/* ------------------------------------------------------------------ *
 * reduced motion
 * ------------------------------------------------------------------ */

/**
 * The reveals are opacity 0 until something adds `is-in`. Under reduced motion
 * the observer is skipped and everything is meant to be shown at once; a reveal
 * that never fires leaves whole sections blank, which is a good deal worse than
 * the animation it was avoiding.
 *
 * This reloads the page — the only extra load this file makes — because both
 * reveal.js and main.js read the media query once, at module scope.
 */
export async function reducedMotion(page) {
  const failures = [];
  const notes = [];
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.body.classList.contains('is-live'), undefined, { timeout: 300000 });
  await page.waitForTimeout(1200);

  const r = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.reveal')];
    const where = (el) => {
      const sec = el.closest('section,footer,article');
      return `${el.className.split(' ')[0]} in #${sec?.id || sec?.tagName?.toLowerCase() || '?'}`;
    };
    return {
      matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
      total: items.length,
      notMarked: items.filter((el) => !el.classList.contains('is-in')).map(where).slice(0, 6),
      faded: items
        .filter((el) => Number(getComputedStyle(el).opacity) < 0.99 && el.getBoundingClientRect().height > 0)
        .map((el) => `${where(el)} at opacity ${getComputedStyle(el).opacity}`)
        .slice(0, 6),
      notMarkedCount: items.filter((el) => !el.classList.contains('is-in')).length,
      fadedCount: items.filter((el) => Number(getComputedStyle(el).opacity) < 0.99).length,
    };
  });

  if (!r.matches) failures.push('[reduced motion] the page does not see prefers-reduced-motion — the emulation did not take');
  if (r.total < 10) failures.push(`[reduced motion] only ${r.total} .reveal elements found; the check would be vacuous`);
  if (r.notMarkedCount) {
    failures.push(
      `[reduced motion] ${r.notMarkedCount}/${r.total} reveals never fired: ${r.notMarked.join('; ')}`
    );
  }
  if (r.fadedCount) {
    failures.push(`[reduced motion] ${r.fadedCount}/${r.total} reveals are still faded out: ${r.faded.join('; ')}`);
  }
  notes.push(`reduced motion: ${r.total} reveals, ${r.notMarkedCount} unmarked, ${r.fadedCount} faded`);
  return { failures, notes };
}

/* ------------------------------------------------------------------ *
 * the run
 * ------------------------------------------------------------------ */

export default async function a11y() {
  const failures = [];
  const notes = [];
  const kbFailures = [];
  const kbNotes = [];

  for (const lang of ['en', 'ar']) {
    const r = await withPage({ viewport: 'iphone-390', lang }, async (page, errors) => {
      const m = await page.evaluate(MEASURE);
      const keyboard = [];

      // The keyboard pass rides the English session rather than opening the
      // site again. Order matters: the ring sweep wants the page untouched, the
      // purchase leaves the cart empty, and the dialog is opened from the grid
      // afterwards.
      if (lang === 'en') {
        keyboard.push(await focusIndicators(page));
        keyboard.push(await keyboardPurchase(page));

        keyboard.push(await productDialog(page));

        await page.evaluate(() => document.querySelectorAll('[data-fi]').forEach((el) => el.removeAttribute('data-fi')));
        keyboard.push(await reducedMotion(page));
      }
      return { ...m, keyboard, errors };
    });

    failures.push(...r.contrast.map((c) => `[${lang}] ${c}`));
    failures.push(...r.small.map((c) => `[${lang}] ${c}`));
    if (r.unlabelled) failures.push(`[${lang}] ${r.unlabelled} input(s) with no accessible name`);
    // Exactly one h1: the intro wordmark is decorative and must not be one.
    if (r.h1 !== 1) failures.push(`[${lang}] ${r.h1} h1 elements, expected 1`);
    failures.push(...r.errors.map((e) => `[${lang}] ${e}`));
    notes.push(`${lang}: ${r.contrast.length} contrast, ${r.small.length} small targets, h1=${r.h1}`);
    for (const part of r.keyboard) {
      kbFailures.push(...part.failures);
      kbNotes.push(...part.notes);
    }
  }

  const a = report('a11y', failures, notes);
  const b = report('a11y/keyboard', kbFailures, kbNotes);
  return a && b;
}
