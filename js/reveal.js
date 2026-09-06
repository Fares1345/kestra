/**
 * One reveal manager for the whole page.
 *
 * Sections are re-rendered whenever the language changes, so elements come and
 * go; a single long-lived observer plus an explicit in-viewport check on
 * registration is far more reliable than wiring a fresh observer per render.
 */

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const supported = 'IntersectionObserver' in window;

let observer = null;

function show(el) {
  el.classList.add('is-in');
}

/** Anything already on screen is revealed at once, without waiting for a tick. */
function inViewport(el) {
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  return r.top < innerHeight * 0.92 && r.bottom > 0;
}

export function observeReveals(root = document) {
  const items = [...root.querySelectorAll('.reveal:not(.is-in)')];
  if (!items.length) return;

  if (reduced || !supported) {
    items.forEach(show);
    return;
  }

  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          show(entry.target);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
  }

  for (const el of items) {
    if (inViewport(el)) show(el);
    else observer.observe(el);
  }
}

/** Reveal everything immediately — used when motion is unwelcome. */
export function revealAll(root = document) {
  root.querySelectorAll('.reveal').forEach(show);
}
