/**
 * Boot order matters here:
 *
 *   fonts -> stage -> product photography -> intro -> store
 *
 * The can artwork is drawn with canvas text, so nothing can be painted until
 * the webfonts are actually resident. And the shop grid is photographed from
 * the real geometry while the loader is still covering the screen, which is why
 * the capture pass happens before the intro rather than after it.
 */

import { PRODUCTS } from './data.js';
import { detectQuality, createStage } from './stage.js';
import { createDirector } from './director.js';
import { createStore } from './store.js';

const root = document.documentElement;
const body = document.body;
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ------------------------------------------------------------------ *
 * theme
 * ------------------------------------------------------------------ */

function applyAccent(product) {
  root.style.setProperty('--accent', product.accent);
  root.style.setProperty('--accent-deep', product.accentDeep);
  root.style.setProperty('--accent-ink', product.ink);
  $$('[data-hero-flavour]').forEach((el) => (el.textContent = product.flavour));
  $$('[data-hero-name]').forEach((el) => (el.textContent = product.name));
  $$('[data-hero-caffeine]').forEach((el) => (el.textContent = String(product.caffeine)));
  $$('[data-hero-index]').forEach((el) => (el.textContent = product.index));
}

/* ------------------------------------------------------------------ *
 * fonts
 * ------------------------------------------------------------------ */

async function readyFonts() {
  if (!document.fonts) return;
  const faces = [
    '800 190px "Archivo Variable"',
    '700 44px "Archivo Variable"',
    '600 34px "Inter Variable"',
    '500 26px "Inter Variable"',
    '400 15px "Inter Variable"',
  ];
  try {
    await Promise.all(faces.map((f) => document.fonts.load(f, 'KESTRA SOLSTICE 0123456789')));
    await document.fonts.ready;
  } catch {
    /* fall through to whatever is available */
  }
}

/* ------------------------------------------------------------------ *
 * scroll plumbing
 * ------------------------------------------------------------------ */

function setupScrollEffects(onProgress) {
  const header = $('[data-header]');
  const progress = $('[data-progress]');
  const hero = $('#hero');
  let lastY = 0;
  let queued = false;

  function read() {
    queued = false;
    const y = scrollY;
    const heroHeight = hero ? hero.offsetHeight : innerHeight;
    onProgress(Math.min(1.2, y / Math.max(1, heroHeight * 0.85)));

    header?.classList.toggle('is-stuck', y > 40);
    // Get out of the way going down, come back on the way up.
    header?.classList.toggle('is-tucked', y > 420 && y > lastY + 4);
    if (y < lastY - 4) header?.classList.remove('is-tucked');

    if (progress) {
      const max = document.documentElement.scrollHeight - innerHeight;
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
  read();
}

function setupReveals() {
  const items = $$('.reveal');
  if (!items.length) return;
  if (prefersReduced || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.12 }
  );
  items.forEach((el) => io.observe(el));
}

/* ------------------------------------------------------------------ *
 * boot
 * ------------------------------------------------------------------ */

async function boot() {
  const canvas = $('[data-stage]');
  const loader = $('[data-loader]');
  const introUI = $('[data-intro]');
  const store = createStore({ onFlavour: (p, meta) => switchFlavour(p, meta) });

  store.mount();
  applyAccent(PRODUCTS[0]);
  setupReveals();

  const quality = canvas ? detectQuality() : null;

  /* ---- no WebGL: the store still has to work ---- */
  if (!quality) {
    body.classList.add('no-webgl');
    body.classList.remove('is-intro');
    loader?.remove();
    introUI?.remove();
    setupScrollEffects(() => {});
    return;
  }

  body.dataset.tier = quality.tier;

  await readyFonts();
  const stage = createStage(canvas, { quality, product: PRODUCTS[0] });
  const director = createDirector(stage, {
    onCue: (name) => {
      // Cues stack, so the CSS can hold earlier reveals in place.
      introUI?.classList.add(`cue-${name}`);
      introUI?.setAttribute('data-cue', name);
    },
    onFinish: () => handoff(),
  });

  director.prime();
  stage.renderOnce();

  /* ---- photograph the range while the loader is still up ---- */
  const shots = {};
  const shotWidth = 560;
  const shotHeight = 720;
  for (const product of PRODUCTS) {
    // One per frame keeps the loader animation smooth.
    await new Promise((r) => requestAnimationFrame(r));
    const url = stage.capture(product, shotWidth, shotHeight);
    if (url) shots[product.id] = url;
  }
  if (Object.keys(shots).length) store.setThumbnails(shots);
  stage.setFlavour(PRODUCTS[0]);
  director.prime();

  /* ---- hand the loop to the director ---- */
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
    introUI?.setAttribute('data-cue', 'done');
    setTimeout(() => introUI?.remove(), 1200);
    setupReveals();
  }

  /* ---- live interaction ---- */
  setupScrollEffects((p) => {
    director.setScroll(p);
    // Stop drawing entirely once the can has left the viewport.
    stage.setVisible(p < 1.05);
    canvas.style.opacity = String(Math.max(0, 1 - Math.max(0, p - 0.55) / 0.45));
  });

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

  addEventListener('resize', () => stage.resize(), { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stage.stop();
    else stage.start();
  });

  /* ---- flavour switching ---- */
  let switching = false;
  function switchFlavour(product, meta = {}) {
    applyAccent(product);
    if (meta.source === 'quickview' || switching || director.phase !== 'live') {
      if (director.phase === 'live' && meta.source !== 'quickview') stage.setFlavour(product);
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
      const t = Math.min(1, (now - t0) / FLASH);
      const curve = Math.sin(t * Math.PI);
      stage.setExposure(1.04 + curve * 0.7);
      stage.setBloom(0.34 + curve * 0.9);
      stage.setAccentPower(1 + curve * 1.4);
      if (!swapped && t >= 0.5) {
        swapped = true;
        stage.setFlavour(product);
      }
      if (t < 1) requestAnimationFrame(tick);
      else {
        stage.setExposure(1.04);
        stage.setBloom(0.34);
        stage.setAccentPower(1);
        switching = false;
      }
    };
    requestAnimationFrame(tick);
  }

  // Expose the current flavour to the hero copy on first paint.
  applyAccent(PRODUCTS[0]);
}

/* ------------------------------------------------------------------ *
 * misc chrome that does not depend on WebGL
 * ------------------------------------------------------------------ */

function setupChrome() {
  const nav = $('[data-nav]');
  const toggle = $('[data-nav-toggle]');
  toggle?.addEventListener('click', () => {
    const open = body.classList.toggle('is-nav-open');
    toggle.setAttribute('aria-expanded', String(open));
    nav?.toggleAttribute('data-open', open);
  });

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute('href').slice(1);
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    body.classList.remove('is-nav-open');
    nav?.removeAttribute('data-open');
    toggle?.setAttribute('aria-expanded', 'false');
    target.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', `#${id}`);
  });

  const year = $('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
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
