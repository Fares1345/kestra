/**
 * Shared browser harness for the checks in this directory.
 *
 * Every check drives the real site and asserts on measurements — geometry,
 * computed style, painted order, DOM state — rather than on screenshots, so a
 * failure names a number and nobody has to eyeball a diff.
 */
/**
 * Playwright is a dev dependency and is not shipped. Resolve it from
 * node_modules when it has been installed, and otherwise from a global
 * install, so these checks run on a bare checkout without npm install.
 */
async function loadChromium() {
  const candidates = [
    'playwright',
    process.env.PLAYWRIGHT_PATH,
    '/opt/node22/lib/node_modules/playwright/index.mjs',
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      return (await import(c)).chromium;
    } catch {
      /* try the next one */
    }
  }
  throw new Error(
    'playwright not found. Run `npm install`, or set PLAYWRIGHT_PATH to a global install.'
  );
}

export const BASE = process.env.KESTRA_URL || 'http://127.0.0.1:4173/';

/** SwiftShader, so this runs on a machine with no GPU. */
const LAUNCH = { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] };

export const VIEWPORTS = {
  'se-320': { width: 320, height: 568, mobile: true },
  'android-360': { width: 360, height: 640, mobile: true },
  'iphone-390': { width: 390, height: 844, mobile: true },
  'max-430': { width: 430, height: 932, mobile: true },
  landscape: { width: 844, height: 390, mobile: true },
  'ipad-768': { width: 768, height: 1024, mobile: true },
  desktop: { width: 1440, height: 900, mobile: false },
};

/**
 * Open the site and wait until the stage has handed off to the live page.
 * `fn` receives the page and the array collecting console/page errors.
 */
export async function withPage({ viewport = 'iphone-390', lang = 'en' } = {}, fn) {
  const v = VIEWPORTS[viewport] || VIEWPORTS['iphone-390'];
  const chromium = await loadChromium();
  const browser = await chromium.launch(LAUNCH);
  const errors = [];
  try {
    const page = await browser.newPage({
      viewport: { width: v.width, height: v.height },
      isMobile: v.mobile,
      hasTouch: v.mobile,
    });
    page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`CONSOLE ${m.text()}`));
    await page.addInitScript((l) => {
      try {
        localStorage.setItem('kestra.lang', l);
      } catch {
        /* storage blocked */
      }
    }, lang);
    await page.goto(BASE, { waitUntil: 'load' });
    // The intro runs on wall clock; under software rendering it is slow.
    await page.waitForFunction(() => document.body.classList.contains('is-live'), {
      timeout: 300000,
    });
    await page.waitForTimeout(1200);
    return await fn(page, errors);
  } finally {
    await browser.close();
  }
}

/** Put one twelve-pack in the cart and open the drawer. */
export async function openCart(page) {
  await page.evaluate(() => document.getElementById('shop').scrollIntoView());
  await page.waitForTimeout(500);
  await page.evaluate(() => document.querySelector('#shop [data-add]')?.click());
  await page.waitForTimeout(350);
  await page.evaluate(() => document.querySelector('[data-cart-open]')?.click());
  await page.waitForTimeout(700);
}

/** The order children are actually painted in, left to right. */
export const paintedOrder = (page, selector) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return [...el.children]
      .filter((c) => c.getBoundingClientRect().width)
      .map((c) => ({ t: (c.textContent || '').trim() || c.tagName.toLowerCase(), x: c.getBoundingClientRect().left }))
      .sort((a, b) => a.x - b.x)
      .map((c) => c.t)
      .join('');
  }, selector);

/* ---------------------------- reporting ---------------------------- */

export function report(name, failures, notes = []) {
  const ok = failures.length === 0;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  notes.forEach((n) => console.log(`      ${n}`));
  failures.forEach((f) => console.log(`   ✗  ${f}`));
  return ok;
}
