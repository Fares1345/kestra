/**
 * Boot order matters here:
 *
 *   language -> fonts -> stage -> product photography -> intro -> store
 *
 * The can artwork is drawn with canvas text, so nothing can be painted until
 * the webfonts are resident. And the shop grid is photographed from the real
 * geometry while the loader still covers the screen, which is why the capture
 * pass happens before the intro rather than after it.
 */

import { PRODUCTS } from './data.js';
import { detectQuality, createStage } from './stage.js';
import { createDirector } from './director.js';
import { createStore } from './store.js';
import { t, lang, applyDocumentLanguage, toggleLanguage, onLanguageChange } from './i18n.js';
import { observeReveals } from './reveal.js';

const root = document.documentElement;
const body = document.body;
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ------------------------------------------------------------------ *
 * static strings
 * ------------------------------------------------------------------ */

/** Fill every [data-i18n*] hook in the markup for the active language. */
function applyStaticStrings() {
  $$('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
  $$('[data-i18n-html]').forEach((el) => (el.innerHTML = t(el.dataset.i18nHtml)));
  $$('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  $$('[data-i18n-placeholder]').forEach((el) => el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder)));

  const ticker = $('[data-ticker]');
  if (ticker) {
    const items = Array.from({ length: 6 }, (_, i) => t(`ticker.${i}`));
    // Doubled, because the marquee translates by exactly half its own width.
    ticker.innerHTML = [...items, ...items]
      .map((s) => `<span>${s}</span><i>◆</i>`)
      .join('');
  }

  const year = $('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  document.title =
    lang() === 'ar'
      ? 'كسترا — طاقة فوّارة، بهندسة دقيقة | السعودية'
      : 'KESTRA — Sparkling energy, engineered | Saudi Arabia';
}

/* ------------------------------------------------------------------ *
 * theme
 * ------------------------------------------------------------------ */

function applyAccent(product) {
  root.style.setProperty('--accent', product.accent);
  root.style.setProperty('--accent-deep', product.accentDeep);
  root.style.setProperty('--accent-ink', product.ink);
  // Not `data-flavour`: the store uses [data-flavour] for its rail buttons, and
  // an attribute of that name on <html> makes closest() match for every click.
  root.dataset.themeFlavour = product.id;
}

/* ------------------------------------------------------------------ *
 * fonts
 * ------------------------------------------------------------------ */

async function readyFonts() {
  if (!document.fonts) return;
  const faces = [
    ['800 190px "Archivo Variable"', 'KESTRA SOLSTICE 0123456789'],
    ['700 44px "Archivo Variable"', 'KESTRA 0123456789'],
    ['600 34px "Inter Variable"', 'KESTRA CAFFEINE'],
    ['500 26px "Inter Variable"', 'BLOOD ORANGE BERGAMOT'],
    ['500 30px "Cairo Variable"', 'كسترا مشروب طاقة فوّار'],
    ['600 54px "Cairo Variable"', 'سولستيس أورورا مونسون'],
  ];
  try {
    await Promise.all(faces.map(([f, sample]) => document.fonts.load(f, sample)));
    await document.fonts.ready;
  } catch {
    /* fall through to whatever is available */
  }
}

/* ------------------------------------------------------------------ *
 * scroll plumbing
 * ------------------------------------------------------------------ */

function setupScrollEffects(onScroll) {
  const scenePanels = $$('.scene');
  const header = $('[data-header]');
  const progress = $('[data-progress]');
  let lastY = 0;
  let queued = false;

  function read() {
    queued = false;
    const y = scrollY;
    onScroll(y);

    header?.classList.toggle('is-stuck', y > 40);
    header?.classList.toggle('is-tucked', y > 460 && y > lastY + 4);
    if (y < lastY - 4) header?.classList.remove('is-tucked');

    observeReveals();

    // The scene copy belongs to whichever panel currently owns the viewport.
    for (const panel of scenePanels) {
      const r = panel.getBoundingClientRect();
      panel.classList.toggle('is-near', r.top < innerHeight * 0.65 && r.bottom > innerHeight * 0.3);
    }

    if (progress) {
      const max = root.scrollHeight - innerHeight;
      progress.style.setProperty('--p', `${max > 0 ? (y / max) * 100 : 0}%`);
    }
    lastY = y;
  }

  addEventListener(
    'scroll',
    () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(read);
    },
    { passive: true }
  );
  return read;
}


/* ------------------------------------------------------------------ *
 * boot
 * ------------------------------------------------------------------ */

async function boot() {
  applyDocumentLanguage();
  applyStaticStrings();

  const canvas = $('[data-stage]');
  const loader = $('[data-loader]');
  const loaderBar = $('[data-loader-bar]');
  const introUI = $('[data-intro]');

  let stage = null;
  let director = null;

  const store = createStore({
    onFlavour: (p, meta) => switchFlavour(p, meta),
    onPackChange: (ids) => stage?.setPackContents(ids),
  });

  store.mount();
  applyAccent(PRODUCTS[0]);
  observeReveals();

  onLanguageChange(() => {
    applyStaticStrings();
    observeReveals();
    requestAnimationFrame(() => director?.measure());
  });

  const quality = canvas ? detectQuality() : null;

  /* ---- no WebGL: the store still has to work ---- */
  if (!quality) {
    body.classList.add('no-webgl');
    body.classList.remove('is-intro');
    loader?.remove();
    introUI?.remove();
    setupScrollEffects(() => {})();
    return;
  }

  body.dataset.tier = quality.tier;

  const setProgress = (v) => loaderBar && (loaderBar.style.transform = `scaleX(${v})`);
  setProgress(0.08);

  await readyFonts();
  setProgress(0.25);

  stage = createStage(canvas, { quality, product: PRODUCTS[0], products: PRODUCTS });
  director = createDirector(stage, {
    onCue: (name) => {
      // Cues stack, so the CSS can hold earlier reveals in place.
      introUI?.classList.add(`cue-${name}`);
      introUI?.setAttribute('data-cue', name);
    },
    onFinish: () => handoff(),
    onVisual: (opacity) => {
      canvas.style.opacity = String(opacity);
    },
    onStation: (id) => {
      body.dataset.station = id;
    },
  });

  director.prime();
  stage.renderOnce();
  setProgress(0.35);

  /* ---- photograph the range while the loader is still up ---- */
  const shots = {};
  for (const [i, product] of PRODUCTS.entries()) {
    await new Promise((r) => requestAnimationFrame(r));
    const url = stage.capture(product, 560, 720);
    if (url) shots[product.id] = url;
    setProgress(0.35 + ((i + 1) / PRODUCTS.length) * 0.6);
  }
  if (Object.keys(shots).length) store.setThumbnails(shots);
  stage.setFlavour(PRODUCTS[0]);
  stage.setPackContents(store.packContents);
  director.prime();
  setProgress(1);

  // The first scene is built while the loader is still up; the rest arrive
  // lazily as the page approaches them.
  stage.prewarmScene('mix');

  stage.update = (dt) => director.update(dt);
  stage.start();

  loader?.classList.add('is-done');
  setTimeout(() => loader?.remove(), 700);

  const skipIntro = () => director.skip();
  $('[data-skip]')?.addEventListener('click', skipIntro);
  const onKey = (e) => {
    if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') skipIntro();
  };
  addEventListener('keydown', onKey);
  addEventListener('wheel', skipIntro, { passive: true, once: true });
  addEventListener('touchmove', skipIntro, { passive: true, once: true });

  await director.play({ instant: prefersReduced });

  function handoff() {
    removeEventListener('keydown', onKey);
    body.classList.remove('is-intro');
    body.classList.add('is-live');
    introUI?.classList.add('cue-done');
    setTimeout(() => introUI?.remove(), 1200);
    observeReveals();
    director.measure();
  }

  /* ---- live interaction ---- */
  const read = setupScrollEffects(() => {});
  director.measure();
  read();

  if (!prefersReduced) {
    addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerType === 'touch') return;
        director.setPointer((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1));
      },
      { passive: true }
    );
  }

  let resizeTimer = 0;
  addEventListener(
    'resize',
    () => {
      stage.resize();
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => director.measure(), 160);
    },
    { passive: true }
  );

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stage.stop();
    else stage.start();
  });

  /* ---- flavour switching ---- */
  let switching = false;
  function switchFlavour(product, meta = {}) {
    applyAccent(product);
    if (!stage || !director) return;
    if (switching || director.phase !== 'live') {
      if (director.phase === 'live') stage.setFlavour(product);
      return;
    }
    switching = true;
    director.nudgeSpin(6.4);

    // A hard bloom flash covers the moment the sleeve changes, so the swap
    // reads as a lighting hit rather than a texture pop.
    const t0 = performance.now();
    const FLASH = 420;
    let swapped = false;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / FLASH);
      const curve = Math.sin(p * Math.PI);
      stage.setExposure(1.04 + curve * 0.7);
      stage.setBloom(0.34 + curve * 0.9);
      stage.setAccentPower(1 + curve * 1.4);
      if (!swapped && p >= 0.5) {
        swapped = true;
        stage.setFlavour(product);
      }
      if (p < 1) requestAnimationFrame(tick);
      else {
        stage.setExposure(1.04);
        stage.setBloom(0.34);
        stage.setAccentPower(1);
        switching = false;
      }
    };
    requestAnimationFrame(tick);
  }
}

/* ------------------------------------------------------------------ *
 * chrome that does not depend on WebGL
 * ------------------------------------------------------------------ */

function setupChrome() {
  const nav = $('[data-nav]');
  const toggle = $('[data-nav-toggle]');
  toggle?.addEventListener('click', () => {
    const open = body.classList.toggle('is-nav-open');
    toggle.setAttribute('aria-expanded', String(open));
    nav?.toggleAttribute('data-open', open);
  });

  $('[data-lang-toggle]')?.addEventListener('click', () => toggleLanguage());

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute('href').slice(1);
    const target = id && document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    body.classList.remove('is-nav-open');
    nav?.removeAttribute('data-open');
    toggle?.setAttribute('aria-expanded', 'false');
    target.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', `#${id}`);
  });
}

setupChrome();
boot().catch((error) => {
  // Never let a WebGL problem take the shop down with it.
  console.error('[kestra] boot failed', error);
  body.classList.add('no-webgl');
  body.classList.remove('is-intro');
  $('[data-loader]')?.remove();
  $('[data-intro]')?.remove();
});
