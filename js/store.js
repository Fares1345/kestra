/**
 * The storefront: catalogue, product detail, the pack builder, the cart and
 * checkout. No framework — the page is small enough that direct DOM work is
 * both faster and easier to follow.
 *
 * Everything rendered here is rebuilt when the language changes, so English and
 * Arabic are the same store rather than two of them.
 */

import {
  BRAND, PRODUCTS, PACKS, SHIPPING, FORMULA, NUTRITION, SPECS,
  REVIEWS, RATING_SUMMARY, FAQ, SUBSCRIPTION_DISCOUNT, MIX_TARGET,
  priceFor, mixedPackPrice,
} from './data.js';
import { t, pick, money, num, deliveryWindow, VAT_RATE, onLanguageChange } from './i18n.js';
import { observeReveals } from './reveal.js';

const CART_KEY = 'kestra.cart.v2';
const PROMOS = { KESTRA15: 0.15, RIYADH10: 0.1 };

const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
const packById = Object.fromEntries(PACKS.map((p) => [p.id, p]));

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ------------------------------------------------------------------ *
 * cart state
 * ------------------------------------------------------------------ */

function loadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY));
    if (!Array.isArray(raw)) return [];
    return raw.filter((l) => byId[l.productId] && packById[l.packId] && l.qty > 0).slice(0, 40);
  } catch {
    return [];
  }
}

function saveCart(lines) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(lines));
  } catch {
    /* private mode — the cart just will not persist */
  }
}

const lineKey = (l) => `${l.productId}:${l.packId}:${l.subscribe ? 's' : 'o'}${l.mixKey ? ':' + l.mixKey : ''}`;

function linePrice(line) {
  const base = line.mixPrice ?? priceFor(byId[line.productId], line.packId);
  return line.subscribe ? base * (1 - SUBSCRIPTION_DISCOUNT) : base;
}

/* ------------------------------------------------------------------ *
 * focus-trapping overlays
 * ------------------------------------------------------------------ */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

function createOverlay(panel, { onClose } = {}) {
  let lastFocused = null;
  let open = false;

  function keydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      api.close();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = $$(FOCUSABLE, panel).filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const api = {
    get isOpen() {
      return open;
    },
    open() {
      if (open) return;
      open = true;
      lastFocused = document.activeElement;
      panel.hidden = false;
      requestAnimationFrame(() => panel.classList.add('is-open'));
      document.body.classList.add('is-locked');
      document.addEventListener('keydown', keydown);
      requestAnimationFrame(() => {
        (panel.querySelector('[data-autofocus]') || $$(FOCUSABLE, panel)[0])?.focus();
      });
    },
    close() {
      if (!open) return;
      open = false;
      panel.classList.remove('is-open');
      document.body.classList.remove('is-locked');
      document.removeEventListener('keydown', keydown);
      const done = () => {
        if (!open) panel.hidden = true;
      };
      panel.addEventListener('transitionend', done, { once: true });
      setTimeout(done, 500);
      if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
      onClose?.();
    },
  };
  return api;
}

/* ------------------------------------------------------------------ *
 * small view helpers
 * ------------------------------------------------------------------ */

const STAR =
  '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M6 0.6 7.5 4.1 11.3 4.5 8.5 7 9.3 10.8 6 8.9 2.7 10.8 3.5 7 0.7 4.5 4.5 4.1Z" fill="currentColor"/></svg>';

const stars = (rating) =>
  Array.from({ length: 5 }, (_, i) => STAR.replace('<svg', `<svg class="${i < rating ? '' : 'is-dim'}"`)).join('');

/* ------------------------------------------------------------------ *
 * store
 * ------------------------------------------------------------------ */

export function createStore({ onFlavour, onPackChange } = {}) {
  let lines = loadCart();
  let promo = null;
  let thumbnails = {};
  let filter = 'all';
  let selectedId = PRODUCTS[0].id;
  let zoneIndex = 0;

  const cartPanel = $('[data-cart]');
  const pdpPanel = $('[data-pdp]');
  const cartOverlay = createOverlay(cartPanel);
  const pdpOverlay = createOverlay(pdpPanel);

  /* ---------------- toast ---------------- */
  const toastHost = $('[data-toasts]');
  let toastTimer = 0;
  function toast(message, tone = 'ok') {
    if (!toastHost) return;
    toastHost.innerHTML = `<div class="toast toast--${tone}" role="status">${esc(message)}</div>`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastHost.innerHTML = ''), 3400);
  }

  /* ---------------- totals ---------------- */
  function totals() {
    const subtotal = lines.reduce((sum, l) => sum + linePrice(l) * l.qty, 0);
    const cans = lines.reduce((sum, l) => sum + packById[l.packId].cans * l.qty, 0);
    const discount = promo ? subtotal * PROMOS[promo] : 0;
    const net = subtotal - discount;
    const shipping = net >= SHIPPING.freeAt || subtotal === 0 ? 0 : SHIPPING.fee;
    const total = net + shipping;
    // Prices are shown VAT-inclusive, Saudi retail convention.
    const vat = total - total / (1 + VAT_RATE);
    return { subtotal, discount, shipping, cans, total, vat };
  }

  /* ---------------- mutations ---------------- */
  function add(line) {
    const key = lineKey(line);
    const existing = lines.find((l) => lineKey(l) === key);
    if (existing) existing.qty += line.qty;
    else lines.push({ ...line });
    commit();
  }

  function setQty(key, qty) {
    const line = lines.find((l) => lineKey(l) === key);
    if (!line) return;
    if (qty <= 0) lines = lines.filter((l) => lineKey(l) !== key);
    else line.qty = Math.min(qty, 20);
    commit();
  }

  function commit() {
    saveCart(lines);
    renderCart();
    renderBadge();
  }

  /* ---------------- product media ---------------- */
  function thumbFor(product, cls = '') {
    const src = thumbnails[product.id];
    const alt = `${BRAND.name} ${pick(product.name)}`;
    if (src) return `<img class="${cls}" src="${src}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
    return `<span class="thumb__fallback ${cls}" aria-hidden="true"></span>`;
  }

  /* ---------------- hero ---------------- */
  function renderHero() {
    const p = byId[selectedId];
    const host = $('[data-hero-panel]');
    if (!host) return;
    host.style.setProperty('--accent', p.accent);
    host.innerHTML = `
      <p class="eyebrow hero__eyebrow">
        <span class="eyebrow__dot" aria-hidden="true"></span>
        No. ${esc(p.index)} — ${esc(pick(p.name))}
      </p>
      <h1 class="display hero__title">${t('hero.title')}</h1>
      <p class="hero__lede">${esc(t('hero.lede'))}</p>

      <dl class="hero__stats">
        <div><dt>${esc(t('stat.caffeine'))}</dt><dd>${num(p.caffeine)}<small>${esc(t('unit.mg'))}</small></dd></div>
        <div><dt>${esc(t('stat.sugar'))}</dt><dd>${num(p.sugar)}<small>${esc(t('unit.g'))}</small></dd></div>
        <div><dt>${esc(t('stat.volume'))}</dt><dd>${num(355)}<small>${esc(t('unit.ml'))}</small></dd></div>
        <div><dt>${esc(t('stat.rated'))}</dt><dd>${num(p.rating)}<small>${esc(t('unit.outOf5'))}</small></dd></div>
      </dl>

      <div class="hero__buy">
        <div class="hero__price">
          <b>${money(priceFor(p, '12'))}</b>
          <small>${esc(t('shop.perPack'))} · ${esc(t('pdp.inStock'))}</small>
        </div>
        <div class="hero__cta">
          <button class="btn btn--solid btn--lg" type="button" data-hero-buy>${esc(t('hero.buy'))}</button>
          <a class="btn btn--ghost btn--lg" href="#shop">${esc(t('hero.explore'))}</a>
        </div>
      </div>

      <div class="hero__rail">
        <p class="hero__rail-label">${esc(t('hero.rail'))}</p>
        <div class="flavour-rail" data-flavour-rail role="group" aria-label="${esc(t('hero.rail'))}"></div>
        <p class="hero__rail-note" data-hero-flavour>${esc(pick(p.flavour))}</p>
      </div>`;
    renderFlavourRail();
  }

  function renderFlavourRail() {
    const host = $('[data-flavour-rail]');
    if (!host) return;
    host.innerHTML = PRODUCTS.map(
      (p) => `
      <button class="chip-flavour${p.id === selectedId ? ' is-active' : ''}" type="button"
        data-flavour="${p.id}" style="--accent:${p.accent}" aria-pressed="${p.id === selectedId}">
        <span class="chip-flavour__dot" aria-hidden="true"></span>
        <span class="chip-flavour__label">${esc(pick(p.name))}</span>
      </button>`
    ).join('');
  }

  /* ---------------- catalogue ---------------- */
  function matchesFilter(p) {
    if (filter === 'zero') return p.sugar === 0;
    if (filter === 'strong') return p.caffeine >= 180;
    if (filter === 'new') return p.badges.some((b) => b.en === 'New');
    return true;
  }

  function renderGrid() {
    const host = $('[data-shop-grid]');
    if (!host) return;
    const visible = PRODUCTS.filter(matchesFilter);
    host.innerHTML = visible
      .map(
        (p, i) => `
      <article class="card reveal" style="--accent:${p.accent}; --accent-deep:${p.accentDeep}; --i:${i}"
               data-product="${p.id}" data-design="${p.design}">
        <div class="card__media">
          <div class="card__glow" aria-hidden="true"></div>
          <div class="thumb" data-thumb="${p.id}">${thumbFor(p)}</div>
          <ul class="card__badges">
            ${p.badges.map((b) => `<li>${esc(pick(b))}</li>`).join('')}
          </ul>
          <button class="card__peek" type="button" data-pdp="${p.id}">
            <span>${esc(t('shop.quickLook'))}</span>
          </button>
        </div>
        <div class="card__body">
          <div class="card__row">
            <span class="card__index">No. ${esc(p.index)}</span>
            <span class="card__rating">${STAR}${num(p.rating)}<i>(${num(p.reviews)})</i></span>
          </div>
          <h3 class="card__name">${esc(pick(p.name))}</h3>
          <p class="card__flavour">${esc(pick(p.flavour))}</p>
          <p class="card__blurb">${esc(pick(p.blurb).split('.')[0])}.</p>
          <ul class="card__stats">
            <li><b>${num(p.caffeine)}</b> ${esc(t('shop.caffeineLabel'))}</li>
            <li><b>${num(p.sugar)}</b> ${esc(t('shop.sugarLabel'))}</li>
          </ul>
          <div class="card__foot">
            <span class="card__price">${money(priceFor(p, '12'))}<small>${esc(t('shop.perPack'))}</small></span>
            <button class="btn btn--solid btn--sm" type="button" data-add="${p.id}">${esc(t('shop.add'))}</button>
          </div>
        </div>
      </article>`
      )
      .join('');
    const count = $('[data-grid-count]');
    if (count) count.textContent = `${num(visible.length)} ${t('shop.of')} ${num(PRODUCTS.length)}`;
    observeReveals(host);
  }

  /* ---------------- formula, nutrition, specs ---------------- */
  function renderFormula() {
    const host = $('[data-formula]');
    if (host) {
      host.innerHTML = FORMULA.map(
        (f, i) => `
        <li class="formula__row reveal" style="--i:${i}">
          <div class="formula__head">
            <h3>${esc(pick(f.label))}</h3>
            <span class="formula__amount">${esc(pick(f.amount))}</span>
          </div>
          <p class="formula__source">${esc(pick(f.source))}</p>
          <div class="formula__meter" role="img"
               aria-label="${esc(pick(f.label))} ${esc(pick(f.amount))}">
            <span style="--fill:${Math.round((f.value / f.max) * 100)}%"></span>
          </div>
          <p class="formula__note">${esc(pick(f.note))}</p>
        </li>`
      ).join('');
      observeReveals(host);
    }

    const nut = $('[data-nutrition]');
    if (nut) {
      nut.innerHTML = `
        <div class="nutrition__head">
          <h3>${esc(t('nutrition.title'))}</h3>
          <p>${esc(t('nutrition.per'))}</p>
        </div>
        <table class="nutrition__table">
          <thead>
            <tr><th scope="col">&nbsp;</th><th scope="col">${esc(t('nutrition.amount'))}</th><th scope="col">${esc(t('nutrition.dv'))}</th></tr>
          </thead>
          <tbody>
            ${NUTRITION.map(
              (n) => `<tr><th scope="row">${esc(pick(n.k))}</th><td>${esc(pick(n.v))}</td><td>${esc(n.dv)}</td></tr>`
            ).join('')}
          </tbody>
        </table>
        <p class="nutrition__note">${esc(t('nutrition.footnote'))}</p>`;
    }

    const specs = $('[data-specs]');
    if (specs) {
      specs.innerHTML = SPECS.map(
        (s) => `<div class="spec"><dt>${esc(pick(s.k))}</dt><dd>${esc(pick(s.v))}</dd></div>`
      ).join('');
    }
  }

  /* ---------------- reviews ---------------- */
  function renderReviews() {
    const summary = $('[data-review-summary]');
    if (summary) {
      summary.innerHTML = `
        <div class="rating__score">
          <b>${num(RATING_SUMMARY.average)}</b>
          <div class="rating__stars">${stars(5)}</div>
          <span>${num(RATING_SUMMARY.count)} ${esc(t('reviews.eyebrow')).toLowerCase()}</span>
        </div>
        <div class="rating__bars">
          ${RATING_SUMMARY.breakdown
            .map(
              (pct, i) => `
            <div class="rating__bar">
              <span class="rating__bar-label">${num(5 - i)}${STAR}</span>
              <span class="rating__bar-track"><i style="--fill:${pct}%"></i></span>
              <span class="rating__bar-pct">${num(pct)}%</span>
            </div>`
            )
            .join('')}
        </div>`;
    }

    const host = $('[data-reviews]');
    if (!host) return;
    host.innerHTML = REVIEWS.map(
      (r, i) => {
        const p = byId[r.product];
        return `
        <figure class="review reveal" style="--accent:${p.accent}; --i:${i}">
          <div class="review__top">
            <div class="review__stars" aria-label="${num(r.rating)} ${esc(t('reviews.of5'))}">${stars(r.rating)}</div>
            <span class="review__date">${esc(pick(r.date))}</span>
          </div>
          <blockquote>${esc(pick(r.body))}</blockquote>
          <figcaption>
            <span class="review__avatar" aria-hidden="true">${esc(pick(r.name).trim().replace(/^د\. /, '').charAt(0))}</span>
            <span class="review__who">
              <b>${esc(pick(r.name))}</b>
              <span>${esc(pick(r.role))}</span>
            </span>
            <span class="review__verified">${esc(t('reviews.verified'))}</span>
          </figcaption>
          <p class="review__product">${esc(t('reviews.drinks'))} ${esc(pick(p.name))}</p>
        </figure>`;
      }
    ).join('');
    observeReveals(host);
  }

  /* ---------------- faq ---------------- */
  function renderFaq() {
    const host = $('[data-faq]');
    if (!host) return;
    host.innerHTML = FAQ.map(
      (f, i) => `
      <div class="faq__item">
        <h3>
          <button class="faq__q" type="button" aria-expanded="false" aria-controls="faq-a-${i}" id="faq-q-${i}">
            <span class="faq__num">${String(i + 1).padStart(2, '0')}</span>
            <span class="faq__text">${esc(pick(f.q))}</span>
            <span class="faq__icon" aria-hidden="true"><i></i><i></i></span>
          </button>
        </h3>
        <div class="faq__a" id="faq-a-${i}" role="region" aria-labelledby="faq-q-${i}">
          <div class="faq__a-inner"><p>${esc(pick(f.a))}</p></div>
        </div>
      </div>`
    ).join('');
  }

  /* ---------------- the pack builder ---------------- */
  const mix = Object.fromEntries(PRODUCTS.map((p) => [p.id, 0]));
  mix[PRODUCTS[0].id] = 6;
  mix[PRODUCTS[1].id] = 6;

  const mixUsed = () => Object.values(mix).reduce((a, b) => a + b, 0);

  /** A flat list of ids, in catalogue order, for the 3D tray. */
  function mixContents() {
    const out = [];
    PRODUCTS.forEach((p) => {
      for (let i = 0; i < mix[p.id]; i++) out.push(p.id);
    });
    return out;
  }

  function renderMixer() {
    const host = $('[data-mixer]');
    if (!host) return;
    const used = mixUsed();
    host.innerHTML = PRODUCTS.map(
      (p) => `
      <div class="mixer__row${mix[p.id] > 0 ? ' is-on' : ''}" style="--accent:${p.accent}">
        <span class="mixer__swatch" aria-hidden="true"></span>
        <span class="mixer__name">${esc(pick(p.name))}<small>${esc(pick(p.flavour))}</small></span>
        <span class="mixer__price">${money(priceFor(p, '12') / 12)}</span>
        <div class="stepper stepper--sm">
          <button type="button" data-mix="${p.id}" data-delta="-1"
            aria-label="${esc(t('cart.decrease'))} ${esc(pick(p.name))}" ${mix[p.id] === 0 ? 'disabled' : ''}>&minus;</button>
          <output>${num(mix[p.id])}</output>
          <button type="button" data-mix="${p.id}" data-delta="1"
            aria-label="${esc(t('cart.increase'))} ${esc(pick(p.name))}" ${used >= MIX_TARGET ? 'disabled' : ''}>+</button>
        </div>
      </div>`
    ).join('');

    const meter = $('[data-mix-meter]');
    if (meter) {
      meter.style.setProperty('--fill', `${(used / MIX_TARGET) * 100}%`);
      meter.setAttribute('aria-valuenow', String(used));
    }
    const label = $('[data-mix-count]');
    if (label) label.textContent = `${num(used)} / ${num(MIX_TARGET)}`;
    const priceEl = $('[data-mix-price]');
    if (priceEl) priceEl.textContent = money(mixedPackPrice(mix));

    const cta = $('[data-mix-add]');
    if (cta) {
      cta.disabled = used !== MIX_TARGET;
      cta.textContent = used === MIX_TARGET ? t('pack.add') : t('pack.more', { n: num(MIX_TARGET - used) });
    }
    const fillBtn = $('[data-mix-fill]');
    if (fillBtn) fillBtn.disabled = used >= MIX_TARGET;
    const clearBtn = $('[data-mix-clear]');
    if (clearBtn) clearBtn.disabled = used === 0;

    onPackChange?.(mixContents());
  }

  /* ---------------- cart ---------------- */
  function renderBadge() {
    const cans = lines.reduce((s, l) => s + packById[l.packId].cans * l.qty, 0);
    $$('[data-cart-count]').forEach((el) => {
      el.textContent = num(cans);
      el.dataset.empty = cans === 0 ? 'true' : 'false';
    });
    const live = $('[data-cart-live]');
    if (live) live.textContent = cans === 0 ? t('cart.liveEmpty') : t('cart.live', { n: num(cans) });
  }

  function renderCart() {
    const host = $('[data-cart-items]');
    if (!host) return;
    const sums = totals();

    if (!lines.length) {
      host.innerHTML = `
        <div class="cart__empty">
          <p>${esc(t('cart.empty'))}</p>
          <button class="btn btn--ghost btn--sm" type="button" data-cart-shop>${esc(t('cart.browse'))}</button>
        </div>`;
    } else {
      host.innerHTML = lines
        .map((l) => {
          const p = byId[l.productId];
          const pack = packById[l.packId];
          const key = lineKey(l);
          const title = l.mixKey ? t('cart.mixed') : pick(p.name);
          const meta = l.mixLabel || pick(p.flavour);
          return `
          <article class="cart-line" style="--accent:${p.accent}">
            <div class="cart-line__thumb">${thumbFor(p)}</div>
            <div class="cart-line__main">
              <div class="cart-line__top">
                <h3>${esc(title)}</h3>
                <button class="cart-line__remove" type="button" data-remove="${key}"
                        aria-label="${esc(t('cart.remove'))} ${esc(title)}">
                  <svg viewBox="0 0 14 14" width="13" height="13" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
                </button>
              </div>
              <p class="cart-line__meta">${esc(meta)} · ${num(pack.cans)} ${esc(t('cart.cans'))}${l.subscribe ? ' · ' + esc(t('cart.subscription')) : ''}</p>
              <div class="cart-line__foot">
                <div class="stepper">
                  <button type="button" data-qty="${key}" data-delta="-1" aria-label="${esc(t('cart.decrease'))}">&minus;</button>
                  <output>${num(l.qty)}</output>
                  <button type="button" data-qty="${key}" data-delta="1" aria-label="${esc(t('cart.increase'))}">+</button>
                </div>
                <span class="cart-line__price">${money(linePrice(l) * l.qty)}</span>
              </div>
            </div>
          </article>`;
        })
        .join('');
    }

    const remaining = Math.max(0, SHIPPING.freeAt - (sums.subtotal - sums.discount));
    const ship = $('[data-ship-progress]');
    if (ship) {
      ship.style.setProperty('--fill', `${Math.min(100, ((sums.subtotal - sums.discount) / SHIPPING.freeAt) * 100)}%`);
      ship.dataset.done = remaining > 0 ? 'false' : 'true';
      $('[data-ship-note]').textContent =
        remaining > 0 ? t('cart.freeAway', { amount: money(remaining) }) : t('cart.freeDone');
    }

    const zone = SHIPPING.zones[zoneIndex];
    const eta = $('[data-eta]');
    if (eta) {
      eta.innerHTML = `
        <span class="cart__eta-label">${esc(t('cart.eta'))}</span>
        <select class="cart__zone" data-zone aria-label="${esc(t('cart.eta'))}">
          ${SHIPPING.zones
            .map((z, i) => `<option value="${i}" ${i === zoneIndex ? 'selected' : ''}>${esc(pick(z.city))}</option>`)
            .join('')}
        </select>
        <b>${esc(deliveryWindow(zone.min, zone.max))}</b>`;
    }

    $('[data-sum-subtotal]').textContent = money(sums.subtotal);
    const discountRow = $('[data-sum-discount-row]');
    if (discountRow) {
      discountRow.hidden = sums.discount <= 0;
      $('[data-sum-discount]').textContent = `− ${money(sums.discount)}`;
    }
    $('[data-sum-shipping]').textContent = sums.shipping === 0 ? t('cart.free') : money(sums.shipping);
    $('[data-sum-total]').textContent = money(sums.total);
    const vatNote = $('[data-sum-vat]');
    if (vatNote) vatNote.textContent = `${t('cart.vat')} · ${money(sums.vat)}`;

    const checkout = $('[data-checkout]');
    if (checkout) checkout.disabled = lines.length === 0;
  }

  /* ---------------- checkout ---------------- */
  let payMethod = 'applepay';

  function renderCheckout() {
    const host = $('[data-pay]');
    if (!host) return;
    const sums = totals();
    const zone = SHIPPING.zones[zoneIndex];
    host.innerHTML = `
      <div class="pay__summary">
        ${lines
          .map((l) => {
            const p = byId[l.productId];
            return `<div class="pay__line">
              <span class="pay__line-thumb">${thumbFor(p)}</span>
              <span class="pay__line-name">${esc(l.mixKey ? t('cart.mixed') : pick(p.name))}
                <small>${num(packById[l.packId].cans)} ${esc(t('cart.cans'))} × ${num(l.qty)}</small></span>
              <span class="pay__line-price">${money(linePrice(l) * l.qty)}</span>
            </div>`;
          })
          .join('')}
        <dl class="pay__sums">
          <div><dt>${esc(t('cart.subtotal'))}</dt><dd>${money(sums.subtotal)}</dd></div>
          ${sums.discount > 0 ? `<div><dt>${esc(t('cart.discount'))}</dt><dd>− ${money(sums.discount)}</dd></div>` : ''}
          <div><dt>${esc(t('cart.shipping'))}</dt><dd>${sums.shipping === 0 ? esc(t('cart.free')) : money(sums.shipping)}</dd></div>
          <div class="pay__total"><dt>${esc(t('cart.total'))}</dt><dd>${money(sums.total)}</dd></div>
        </dl>
        <p class="pay__eta">${esc(t('cart.eta'))} · <b>${esc(pick(zone.city))}</b> · ${esc(deliveryWindow(zone.min, zone.max))}</p>
        <p class="pay__vat">${esc(t('cart.vatNote'))}</p>
      </div>
      <h3 class="pay__title">${esc(t('pay.title'))}</h3>
      <div class="pay__methods" role="radiogroup" aria-label="${esc(t('pay.title'))}">
        <button class="pay__method${payMethod === 'applepay' ? ' is-active' : ''}" type="button"
                role="radio" aria-checked="${payMethod === 'applepay'}" data-pay-method="applepay">
          <svg viewBox="0 0 40 17" width="40" height="17" aria-hidden="true" focusable="false">
            <path fill="currentColor" d="M7.3 2.2c.5-.6.8-1.4.7-2.2-.7 0-1.6.5-2.1 1.1-.5.5-.9 1.4-.7 2.2.8 0 1.6-.4 2.1-1.1Zm.7 1.2c-1.2-.1-2.2.7-2.7.7-.6 0-1.4-.6-2.3-.6-1.2 0-2.3.7-2.9 1.8-1.2 2.1-.3 5.3.9 7 .6.9 1.3 1.8 2.2 1.8.9 0 1.2-.6 2.3-.6 1.1 0 1.4.6 2.3.6.9 0 1.5-.8 2.1-1.7.7-1 .9-1.9.9-2-.1 0-1.8-.7-1.8-2.7 0-1.6 1.3-2.4 1.4-2.5-.8-1.1-2-1.2-2.4-1.3Z"/>
            <text x="13" y="13" font-size="11" font-weight="600" fill="currentColor" font-family="system-ui, sans-serif">Pay</text>
          </svg>
          <span class="sr-only">${esc(t('pay.applePay'))}</span>
        </button>
        <button class="pay__method${payMethod === 'mada' ? ' is-active' : ''}" type="button"
                role="radio" aria-checked="${payMethod === 'mada'}" data-pay-method="mada">
          <span class="pay__mada" aria-hidden="true"><i></i><i></i><b>${esc(t('pay.mada'))}</b></span>
          <span class="sr-only">${esc(t('pay.mada'))}</span>
        </button>
        <button class="pay__method${payMethod === 'card' ? ' is-active' : ''}" type="button"
                role="radio" aria-checked="${payMethod === 'card'}" data-pay-method="card">
          <svg viewBox="0 0 24 16" width="26" height="17" aria-hidden="true" focusable="false">
            <rect x="0.75" y="0.75" width="22.5" height="14.5" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.4"/>
            <path d="M1 5.4h22" stroke="currentColor" stroke-width="1.8"/>
            <path d="M4 11h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          <span class="sr-only">${esc(t('pay.card'))}</span>
        </button>
      </div>
      <div class="pay__card" data-pay-card ${payMethod === 'card' ? '' : 'hidden'}>
        <input type="text" inputmode="numeric" autocomplete="cc-number" placeholder="•••• •••• •••• ••••" aria-label="${esc(t('pay.card'))}">
        <div class="pay__card-row">
          <input type="text" inputmode="numeric" autocomplete="cc-exp" placeholder="MM / YY" aria-label="MM / YY">
          <input type="text" inputmode="numeric" autocomplete="cc-csc" placeholder="CVC" aria-label="CVC">
        </div>
      </div>
      <button class="btn btn--solid btn--wide btn--pay" type="button" data-place-order>
        ${payMethod === 'applepay' ? '' : esc(t('cart.checkout')) + ' · '}${money(sums.total)}
      </button>
      <p class="pay__secure">${esc(t('pay.secure'))}</p>`;
  }

  /* ---------------- product detail ---------------- */
  let pdpState = { productId: PRODUCTS[0].id, packId: '12', subscribe: false };

  function renderPdp() {
    const p = byId[pdpState.productId];
    const body = $('[data-pdp-body]');
    if (!body) return;
    const pack = packById[pdpState.packId];
    const base = priceFor(p, pdpState.packId);
    const price = pdpState.subscribe ? base * (1 - SUBSCRIPTION_DISCOUNT) : base;

    body.style.setProperty('--accent', p.accent);
    body.style.setProperty('--accent-deep', p.accentDeep);
    body.innerHTML = `
      <div class="pdp__media" data-design="${p.design}">
        <div class="pdp__glow" aria-hidden="true"></div>
        <div class="thumb thumb--lg">${thumbFor(p)}</div>
        <ul class="pdp__badges">${p.badges.map((b) => `<li>${esc(pick(b))}</li>`).join('')}</ul>
      </div>
      <div class="pdp__info">
        <span class="eyebrow">No. ${esc(p.index)} · ${esc(pick(p.flavour))}</span>
        <h2 id="pdp-title" class="pdp__name">${esc(pick(p.name))}</h2>
        <div class="pdp__rating">
          <span class="pdp__stars">${stars(Math.round(p.rating))}</span>
          <span>${num(p.rating)} · ${num(p.reviews)}</span>
        </div>
        <p class="pdp__blurb">${esc(pick(p.blurb))}</p>

        <h3 class="pdp__sub">${esc(t('pdp.notes'))}</h3>
        <ul class="pdp__notes">${pick(p.notes).map((n) => `<li>${esc(n)}</li>`).join('')}</ul>

        <dl class="pdp__facts">
          <div><dt>${esc(t('stat.caffeine'))}</dt><dd>${num(p.caffeine)} ${esc(t('unit.mg'))}</dd></div>
          <div><dt>${esc(t('stat.sugar'))}</dt><dd>${num(p.sugar)} ${esc(t('unit.g'))}</dd></div>
          <div><dt>${esc(t('pdp.calories'))}</dt><dd>${num(p.calories)}</dd></div>
          <div><dt>${esc(t('stat.volume'))}</dt><dd>${num(355)} ${esc(t('unit.ml'))}</dd></div>
        </dl>

        <p class="pdp__serve"><b>${esc(t('pdp.serve'))}</b> ${esc(pick(p.serve))}</p>

        <fieldset class="pdp__packs">
          <legend>${esc(t('pdp.pack'))}</legend>
          ${PACKS.map(
            (k) => `
            <label class="pack${k.id === pdpState.packId ? ' is-active' : ''}">
              <input type="radio" name="pack" value="${k.id}" ${k.id === pdpState.packId ? 'checked' : ''}>
              <span class="pack__cans">${num(k.cans)} ${esc(t('pdp.cans'))}</span>
              <span class="pack__price">${money(priceFor(p, k.id))}</span>
              ${k.tag ? `<span class="pack__tag">${esc(t(k.tag))}</span>` : ''}
            </label>`
          ).join('')}
        </fieldset>

        <label class="switch">
          <input type="checkbox" data-subscribe ${pdpState.subscribe ? 'checked' : ''}>
          <span class="switch__track" aria-hidden="true"><span class="switch__thumb"></span></span>
          <span class="switch__text">
            <b>${esc(t('pdp.subscribe'))}</b>
            <small>${esc(t('pdp.subscribeNote'))}</small>
          </span>
        </label>

        <div class="pdp__buy">
          <div class="pdp__price">
            <b>${money(price)}</b>
            <small>${esc(t('pdp.perCan', { amount: money(price / pack.cans) }))}</small>
          </div>
          <button class="btn btn--solid btn--lg" type="button" data-pdp-add>${esc(t('pdp.addToCart'))}</button>
        </div>
      </div>`;
  }

  function openPdp(productId) {
    pdpState = { productId, packId: '12', subscribe: false };
    renderPdp();
    pdpOverlay.open();
    // Deliberately does not change the hero selection: the modal is about one
    // product, the rail is about which can is on stage. Coupling them left the
    // headline naming a flavour the can was not showing.
  }

  /* ---------------- selection ---------------- */
  function select(id, source) {
    if (!byId[id]) return;
    selectedId = id;
    renderHero();
    onFlavour?.(byId[id], { source });
  }

  /* ---------------- events ---------------- */
  function bind() {
    document.addEventListener('click', (e) => {
      const target = e.target;

      const addBtn = target.closest('[data-add]');
      if (addBtn) {
        const p = byId[addBtn.dataset.add];
        add({ productId: p.id, packId: '12', subscribe: false, qty: 1 });
        toast(t('cart.added', { name: pick(p.name) }));
        pulse(addBtn);
        return;
      }

      const pdpBtn = target.closest('[data-pdp]');
      if (pdpBtn) return openPdp(pdpBtn.dataset.pdp);

      const flavourBtn = target.closest('button[data-flavour]');
      if (flavourBtn) return select(flavourBtn.dataset.flavour, 'rail');

      if (target.closest('[data-hero-buy]')) {
        const p = byId[selectedId];
        add({ productId: p.id, packId: '12', subscribe: false, qty: 1 });
        toast(t('cart.added', { name: pick(p.name) }));
        cartOverlay.open();
        return;
      }

      const filterBtn = target.closest('[data-filter]');
      if (filterBtn) {
        filter = filterBtn.dataset.filter;
        $$('[data-filter]').forEach((b) => {
          const on = b === filterBtn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-pressed', String(on));
        });
        renderGrid();
        return;
      }

      if (target.closest('[data-cart-open]')) return cartOverlay.open();
      if (target.closest('[data-cart-close]') || target.closest('[data-cart-scrim]')) return cartOverlay.close();
      if (target.closest('[data-pdp-close]') || target.closest('[data-pdp-scrim]')) return pdpOverlay.close();
      if (target.closest('[data-cart-shop]')) {
        cartOverlay.close();
        document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      const qtyBtn = target.closest('[data-qty]');
      if (qtyBtn) {
        const line = lines.find((l) => lineKey(l) === qtyBtn.dataset.qty);
        if (line) setQty(qtyBtn.dataset.qty, line.qty + Number(qtyBtn.dataset.delta));
        return;
      }

      const removeBtn = target.closest('[data-remove]');
      if (removeBtn) {
        setQty(removeBtn.dataset.remove, 0);
        toast(t('cart.removed'), 'muted');
        return;
      }

      const mixBtn = target.closest('[data-mix]');
      if (mixBtn) {
        const id = mixBtn.dataset.mix;
        const delta = Number(mixBtn.dataset.delta);
        if (delta > 0 && mixUsed() >= MIX_TARGET) return;
        mix[id] = Math.max(0, Math.min(MIX_TARGET, mix[id] + delta));
        renderMixer();
        return;
      }

      if (target.closest('[data-mix-clear]')) {
        PRODUCTS.forEach((p) => (mix[p.id] = 0));
        renderMixer();
        return;
      }

      if (target.closest('[data-mix-fill]')) {
        // Spread whatever is left evenly across the flavours already chosen,
        // or across the whole range if nothing is.
        let left = MIX_TARGET - mixUsed();
        const pool = PRODUCTS.filter((p) => mix[p.id] > 0);
        const spread = pool.length ? pool : PRODUCTS;
        let i = 0;
        while (left > 0) {
          mix[spread[i % spread.length].id]++;
          left--;
          i++;
        }
        renderMixer();
        return;
      }

      if (target.closest('[data-mix-add]')) {
        const chosen = PRODUCTS.filter((p) => mix[p.id] > 0);
        const label = chosen.map((p) => `${num(mix[p.id])}× ${pick(p.name)}`).join(', ');
        add({
          productId: chosen[0].id,
          packId: '12',
          subscribe: false,
          qty: 1,
          mixKey: chosen.map((p) => `${p.id}${mix[p.id]}`).join('-'),
          mixLabel: label,
          mixPrice: mixedPackPrice(mix),
        });
        toast(t('cart.added', { name: t('cart.mixed') }));
        return;
      }

      if (target.closest('[data-pdp-add]')) {
        add({ ...pdpState, qty: 1 });
        toast(t('cart.added', { name: pick(byId[pdpState.productId].name) }));
        pdpOverlay.close();
        return;
      }

      const faqBtn = target.closest('.faq__q');
      if (faqBtn) {
        const expanded = faqBtn.getAttribute('aria-expanded') === 'true';
        faqBtn.setAttribute('aria-expanded', String(!expanded));
        faqBtn.closest('.faq__item')?.classList.toggle('is-open', !expanded);
        return;
      }

      const methodBtn = target.closest('[data-pay-method]');
      if (methodBtn) {
        payMethod = methodBtn.dataset.payMethod;
        renderCheckout();
        return;
      }

      if (target.closest('[data-checkout]')) {
        cartPanel.classList.add('is-paying');
        renderCheckout();
        requestAnimationFrame(() => $('[data-pay] button')?.focus());
        return;
      }

      if (target.closest('[data-pay-back]')) {
        cartPanel.classList.remove('is-paying');
        return;
      }

      if (target.closest('[data-place-order]')) {
        const sums = totals();
        toast(t('pay.placed', { amount: money(sums.total) }));
        lines = [];
        promo = null;
        commit();
        cartPanel.classList.remove('is-paying');
        setTimeout(() => cartOverlay.close(), 1100);
      }
    });

    document.addEventListener('change', (e) => {
      const el = e.target;
      if (el.name === 'pack') {
        pdpState.packId = el.value;
        renderPdp();
      }
      if (el.matches('[data-subscribe]')) {
        pdpState.subscribe = el.checked;
        renderPdp();
      }
      if (el.matches('[data-zone]')) {
        zoneIndex = Number(el.value) || 0;
        renderCart();
      }
    });

    $('[data-promo-form]')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('[data-promo-input]');
      const code = input.value.trim().toUpperCase();
      if (PROMOS[code]) {
        promo = code;
        toast(t('cart.promoOk', { code, pct: num(Math.round(PROMOS[code] * 100)) }));
        renderCart();
      } else {
        toast(t('cart.promoBad'), 'warn');
      }
      input.value = '';
    });

    $('[data-newsletter]')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('input[type=email]', e.currentTarget);
      if (!input.value) return;
      toast(t('signup.done'));
      e.currentTarget.reset();
    });
  }

  /** A short scale pop, so a tap has a visible consequence. */
  function pulse(el) {
    el.classList.remove('is-pulsing');
    void el.offsetWidth;
    el.classList.add('is-pulsing');
  }

  /* ---------------- public ---------------- */
  function renderAll() {
    renderHero();
    renderGrid();
    renderFormula();
    renderReviews();
    renderFaq();
    renderMixer();
    renderCart();
    renderBadge();
    renderCheckout();
    if (pdpOverlay.isOpen) renderPdp();
  }

  return {
    mount() {
      renderAll();
      bind();
      onLanguageChange(() => renderAll());
    },
    renderAll,
    setThumbnails(map) {
      thumbnails = map;
      $$('[data-thumb]').forEach((el) => {
        const p = byId[el.dataset.thumb];
        if (p && map[p.id]) el.innerHTML = thumbFor(p);
      });
      if (pdpOverlay.isOpen) renderPdp();
      renderCart();
    },
    get selected() {
      return byId[selectedId];
    },
    get packContents() {
      return mixContents();
    },
    openCart: () => cartOverlay.open(),
  };
}
