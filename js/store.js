/**
 * The storefront: catalogue rendering, the 12-can mixer, and a cart that
 * survives a reload. No framework — the page is small enough that direct DOM
 * work is both faster and easier to follow.
 */

import { PRODUCTS, PACKS, SUBSCRIPTION_DISCOUNT, BRAND, FORMULA, SPECS, REVIEWS, FAQ } from './data.js';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const CART_KEY = 'kestra.cart.v1';
const PROMOS = { KESTRA15: 0.15, FIRSTLIGHT: 0.1 };

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
    // Drop anything that no longer matches the catalogue.
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

const lineKey = (l) => `${l.productId}:${l.packId}:${l.subscribe ? 's' : 'o'}${l.mix ? ':' + l.mix : ''}`;

function linePrice(line) {
  const base = packById[line.packId].price;
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
      // Next frame, so the transition has a starting state to animate from.
      requestAnimationFrame(() => panel.classList.add('is-open'));
      document.body.classList.add('is-locked');
      document.addEventListener('keydown', keydown);
      requestAnimationFrame(() => {
        const target = panel.querySelector('[data-autofocus]') || $$(FOCUSABLE, panel)[0];
        target?.focus();
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
      lastFocused?.focus?.();
      onClose?.();
    },
  };
  return api;
}

/* ------------------------------------------------------------------ *
 * store
 * ------------------------------------------------------------------ */

export function createStore({ onFlavour } = {}) {
  let lines = loadCart();
  let promo = null;
  let thumbnails = {};
  let filter = 'all';

  const cartPanel = $('[data-cart]');
  const quickPanel = $('[data-quickview]');
  const cartOverlay = createOverlay(cartPanel);
  const quickOverlay = createOverlay(quickPanel);

  /* ---------------- toast ---------------- */
  const toastHost = $('[data-toasts]');
  let toastTimer = 0;
  function toast(message, tone = 'ok') {
    if (!toastHost) return;
    toastHost.innerHTML = `<div class="toast toast--${tone}" role="status">${esc(message)}</div>`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastHost.innerHTML = ''), 3200);
  }

  /* ---------------- totals ---------------- */
  function totals() {
    const subtotal = lines.reduce((sum, l) => sum + linePrice(l) * l.qty, 0);
    const cans = lines.reduce((sum, l) => sum + packById[l.packId].cans * l.qty, 0);
    const discount = promo ? subtotal * PROMOS[promo] : 0;
    const shipping = subtotal - discount >= BRAND.freeShippingAt || subtotal === 0 ? 0 : 5.95;
    return { subtotal, discount, shipping, cans, total: subtotal - discount + shipping };
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

  /* ---------------- catalogue ---------------- */
  function thumbFor(product) {
    const src = thumbnails[product.id];
    if (src) return `<img src="${src}" alt="A can of ${esc(BRAND.name)} ${esc(product.name)}" loading="lazy" decoding="async">`;
    return `<span class="thumb__fallback" aria-hidden="true"></span>`;
  }

  function matchesFilter(p) {
    if (filter === 'all') return true;
    if (filter === 'zero') return p.sugar === 0;
    if (filter === 'strong') return p.caffeine >= 180;
    if (filter === 'new') return p.badges.includes('New');
    return true;
  }

  function renderGrid() {
    const host = $('[data-shop-grid]');
    if (!host) return;
    const visible = PRODUCTS.filter(matchesFilter);
    host.innerHTML = visible
      .map(
        (p) => `
      <article class="card" style="--accent:${p.accent}; --accent-deep:${p.accentDeep}" data-product="${p.id}">
        <div class="card__media">
          <div class="card__glow" aria-hidden="true"></div>
          <div class="thumb" data-thumb="${p.id}">${thumbFor(p)}</div>
          <button class="card__peek" type="button" data-quick="${p.id}">
            <span>Quick look</span>
          </button>
        </div>
        <div class="card__body">
          <div class="card__row">
            <span class="card__index">No. ${p.index}</span>
            <span class="card__rating" aria-label="Rated ${p.rating} out of 5 from ${p.reviews} reviews">
              <svg viewBox="0 0 12 12" aria-hidden="true" width="11" height="11"><path d="M6 0.6 7.5 4.1 11.3 4.5 8.5 7 9.3 10.8 6 8.9 2.7 10.8 3.5 7 0.7 4.5 4.5 4.1Z" fill="currentColor"/></svg>
              ${p.rating}
            </span>
          </div>
          <h3 class="card__name">${esc(p.name)}</h3>
          <p class="card__flavour">${esc(p.flavour)}</p>
          <ul class="card__stats">
            <li><b>${p.caffeine}</b> mg caffeine</li>
            <li><b>${p.sugar === 0 ? '0' : p.sugar}</b> g sugar</li>
          </ul>
          <div class="card__foot">
            <span class="card__price">${money.format(packById['12'].price)} <small>/ 12 cans</small></span>
            <button class="btn btn--solid btn--sm" type="button" data-add="${p.id}">Add</button>
          </div>
        </div>
      </article>`
      )
      .join('');
    const count = $('[data-grid-count]');
    if (count) count.textContent = `${visible.length} of ${PRODUCTS.length}`;
  }

  function renderFlavourRail() {
    const host = $('[data-flavour-rail]');
    if (!host) return;
    host.innerHTML = PRODUCTS.map(
      (p, i) => `
      <button class="chip-flavour${i === 0 ? ' is-active' : ''}" type="button"
        data-flavour="${p.id}" style="--accent:${p.accent}"
        aria-pressed="${i === 0}">
        <span class="chip-flavour__dot" aria-hidden="true"></span>
        <span class="chip-flavour__label">${esc(p.name)}</span>
      </button>`
    ).join('');
  }

  function renderStatic() {
    const formula = $('[data-formula]');
    if (formula) {
      formula.innerHTML = FORMULA.map(
        (f, i) => `
        <li class="formula__row reveal" style="--i:${i}">
          <div class="formula__head">
            <h3>${esc(f.label)}</h3>
            <span class="formula__amount">${esc(f.amount)}</span>
          </div>
          <p class="formula__source">${esc(f.source)}</p>
          <p class="formula__note">${esc(f.note)}</p>
        </li>`
      ).join('');
    }

    const specs = $('[data-specs]');
    if (specs) {
      specs.innerHTML = SPECS.map(
        (s) => `<div class="spec"><dt>${esc(s.k)}</dt><dd>${esc(s.v)}</dd></div>`
      ).join('');
    }

    const reviews = $('[data-reviews]');
    if (reviews) {
      reviews.innerHTML = REVIEWS.map(
        (r) => `
        <figure class="review">
          <div class="review__stars" aria-label="${r.rating} out of 5">
            ${Array.from({ length: 5 }, (_, i) => `<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" class="${i < r.rating ? '' : 'is-dim'}"><path d="M6 0.6 7.5 4.1 11.3 4.5 8.5 7 9.3 10.8 6 8.9 2.7 10.8 3.5 7 0.7 4.5 4.5 4.1Z" fill="currentColor"/></svg>`).join('')}
          </div>
          <blockquote>${esc(r.body)}</blockquote>
          <figcaption>
            <b>${esc(r.name)}</b>
            <span>${esc(r.role)}</span>
            <span class="review__product">Drinks ${esc(r.product)}</span>
          </figcaption>
        </figure>`
      ).join('');
    }

    const faq = $('[data-faq]');
    if (faq) {
      faq.innerHTML = FAQ.map(
        (f, i) => `
        <div class="faq__item">
          <h3>
            <button class="faq__q" type="button" aria-expanded="false" aria-controls="faq-a-${i}" id="faq-q-${i}">
              <span>${esc(f.q)}</span>
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
          </h3>
          <div class="faq__a" id="faq-a-${i}" role="region" aria-labelledby="faq-q-${i}" hidden>
            <p>${esc(f.a)}</p>
          </div>
        </div>`
      ).join('');
    }
  }

  /* ---------------- the 12-can mixer ---------------- */
  const mix = Object.fromEntries(PRODUCTS.map((p) => [p.id, 0]));
  mix[PRODUCTS[0].id] = 6;
  mix[PRODUCTS[1].id] = 6;
  const MIX_TARGET = 12;

  function renderMixer() {
    const host = $('[data-mixer]');
    if (!host) return;
    const used = Object.values(mix).reduce((a, b) => a + b, 0);
    host.innerHTML = PRODUCTS.map(
      (p) => `
      <div class="mixer__row" style="--accent:${p.accent}">
        <span class="mixer__swatch" aria-hidden="true"></span>
        <span class="mixer__name">${esc(p.name)}<small>${esc(p.flavour)}</small></span>
        <div class="stepper stepper--sm">
          <button type="button" data-mix="${p.id}" data-delta="-1" aria-label="One less ${esc(p.name)}" ${mix[p.id] === 0 ? 'disabled' : ''}>&minus;</button>
          <output aria-live="off">${mix[p.id]}</output>
          <button type="button" data-mix="${p.id}" data-delta="1" aria-label="One more ${esc(p.name)}" ${used >= MIX_TARGET ? 'disabled' : ''}>+</button>
        </div>
      </div>`
    ).join('');

    const meter = $('[data-mix-meter]');
    if (meter) {
      meter.style.setProperty('--fill', `${(used / MIX_TARGET) * 100}%`);
      meter.setAttribute('aria-valuenow', String(used));
    }
    const label = $('[data-mix-count]');
    if (label) label.textContent = `${used} of ${MIX_TARGET}`;
    const cta = $('[data-mix-add]');
    if (cta) {
      cta.disabled = used !== MIX_TARGET;
      cta.textContent = used === MIX_TARGET ? `Add mixed pack — ${money.format(packById['12'].price)}` : `Pick ${MIX_TARGET - used} more`;
    }
  }

  /* ---------------- cart ---------------- */
  function renderBadge() {
    const cans = lines.reduce((s, l) => s + packById[l.packId].cans * l.qty, 0);
    $$('[data-cart-count]').forEach((el) => {
      el.textContent = String(cans);
      el.dataset.empty = cans === 0 ? 'true' : 'false';
    });
    const live = $('[data-cart-live]');
    if (live) live.textContent = cans === 0 ? 'Cart is empty' : `${cans} cans in cart`;
  }

  function renderCart() {
    const host = $('[data-cart-items]');
    if (!host) return;
    const t = totals();

    if (!lines.length) {
      host.innerHTML = `
        <div class="cart__empty">
          <p>Your cart is empty.</p>
          <button class="btn btn--ghost btn--sm" type="button" data-cart-shop>Browse the range</button>
        </div>`;
    } else {
      host.innerHTML = lines
        .map((l) => {
          const p = byId[l.productId];
          const pack = packById[l.packId];
          const key = lineKey(l);
          return `
          <article class="cart-line" style="--accent:${p.accent}">
            <div class="cart-line__thumb">${thumbFor(p)}</div>
            <div class="cart-line__main">
              <div class="cart-line__top">
                <h3>${esc(l.mix ? 'Mixed pack' : p.name)}</h3>
                <button class="cart-line__remove" type="button" data-remove="${key}" aria-label="Remove ${esc(p.name)}">
                  <svg viewBox="0 0 14 14" width="13" height="13" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
                </button>
              </div>
              <p class="cart-line__meta">${esc(l.mix ? l.mix : p.flavour)} · ${pack.cans} cans${l.subscribe ? ' · Subscription' : ''}</p>
              <div class="cart-line__foot">
                <div class="stepper">
                  <button type="button" data-qty="${key}" data-delta="-1" aria-label="Decrease quantity">&minus;</button>
                  <output>${l.qty}</output>
                  <button type="button" data-qty="${key}" data-delta="1" aria-label="Increase quantity">+</button>
                </div>
                <span class="cart-line__price">${money.format(linePrice(l) * l.qty)}</span>
              </div>
            </div>
          </article>`;
        })
        .join('');
    }

    const remaining = Math.max(0, BRAND.freeShippingAt - (t.subtotal - t.discount));
    const ship = $('[data-ship-progress]');
    if (ship) {
      const pct = Math.min(100, ((t.subtotal - t.discount) / BRAND.freeShippingAt) * 100);
      ship.style.setProperty('--fill', `${pct}%`);
      $('[data-ship-note]').textContent =
        remaining > 0 ? `${money.format(remaining)} away from free shipping` : 'Free shipping unlocked';
      ship.dataset.done = remaining > 0 ? 'false' : 'true';
    }

    $('[data-sum-subtotal]').textContent = money.format(t.subtotal);
    const discountRow = $('[data-sum-discount-row]');
    if (discountRow) {
      discountRow.hidden = t.discount <= 0;
      $('[data-sum-discount]').textContent = `− ${money.format(t.discount)}`;
    }
    $('[data-sum-shipping]').textContent = t.shipping === 0 ? 'Free' : money.format(t.shipping);
    $('[data-sum-total]').textContent = money.format(t.total);
    const checkout = $('[data-checkout]');
    if (checkout) checkout.disabled = lines.length === 0;
  }

  /* ---------------- quick look ---------------- */
  let quickState = { productId: PRODUCTS[0].id, packId: '12', subscribe: false };

  function renderQuick() {
    const p = byId[quickState.productId];
    const body = $('[data-quickview-body]');
    if (!body) return;
    const pack = packById[quickState.packId];
    const unit = (pack.price * (quickState.subscribe ? 1 - SUBSCRIPTION_DISCOUNT : 1)) / pack.cans;

    body.style.setProperty('--accent', p.accent);
    body.style.setProperty('--accent-deep', p.accentDeep);
    body.innerHTML = `
      <div class="quick__media">
        <div class="quick__glow" aria-hidden="true"></div>
        <div class="thumb thumb--lg">${thumbFor(p)}</div>
      </div>
      <div class="quick__info">
        <span class="eyebrow">No. ${p.index} · ${esc(p.flavour)}</span>
        <h2 id="quickview-title" class="quick__name">${esc(p.name)}</h2>
        <p class="quick__blurb">${esc(p.blurb)}</p>

        <ul class="quick__notes">
          ${p.notes.map((n) => `<li>${esc(n)}</li>`).join('')}
        </ul>

        <dl class="quick__facts">
          <div><dt>Caffeine</dt><dd>${p.caffeine} mg</dd></div>
          <div><dt>Sugar</dt><dd>${p.sugar === 0 ? 'Zero' : `${p.sugar} g`}</dd></div>
          <div><dt>Calories</dt><dd>${p.calories}</dd></div>
          <div><dt>Rating</dt><dd>${p.rating} / 5</dd></div>
        </dl>

        <fieldset class="quick__packs">
          <legend>Pack size</legend>
          ${PACKS.map(
            (k) => `
            <label class="pack${k.id === quickState.packId ? ' is-active' : ''}">
              <input type="radio" name="pack" value="${k.id}" ${k.id === quickState.packId ? 'checked' : ''}>
              <span class="pack__cans">${k.label}</span>
              <span class="pack__price">${money.format(k.price)}</span>
              ${k.tag ? `<span class="pack__tag">${esc(k.tag)}</span>` : ''}
            </label>`
          ).join('')}
        </fieldset>

        <label class="switch">
          <input type="checkbox" data-subscribe ${quickState.subscribe ? 'checked' : ''}>
          <span class="switch__track" aria-hidden="true"><span class="switch__thumb"></span></span>
          <span class="switch__text">
            <b>Subscribe &amp; save 15%</b>
            <small>Delivered every 4 weeks. Skip or cancel anytime.</small>
          </span>
        </label>

        <div class="quick__buy">
          <div class="quick__price">
            <b>${money.format(pack.price * (quickState.subscribe ? 1 - SUBSCRIPTION_DISCOUNT : 1))}</b>
            <small>${money.format(unit)} per can</small>
          </div>
          <button class="btn btn--solid" type="button" data-quick-add>Add to cart</button>
        </div>
      </div>`;
  }

  function openQuick(productId) {
    quickState = { productId, packId: '12', subscribe: false };
    renderQuick();
    quickOverlay.open();
    onFlavour?.(byId[productId], { source: 'quickview' });
  }

  /* ---------------- events ---------------- */
  function bind() {
    document.addEventListener('click', (e) => {
      const t = e.target;

      const addBtn = t.closest('[data-add]');
      if (addBtn) {
        const p = byId[addBtn.dataset.add];
        add({ productId: p.id, packId: '12', subscribe: false, qty: 1 });
        toast(`${p.name} · 12 cans added`);
        return;
      }

      const quickBtn = t.closest('[data-quick]');
      if (quickBtn) {
        openQuick(quickBtn.dataset.quick);
        return;
      }

      const flavourBtn = t.closest('[data-flavour]');
      if (flavourBtn) {
        $$('[data-flavour]').forEach((b) => {
          const on = b === flavourBtn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-pressed', String(on));
        });
        onFlavour?.(byId[flavourBtn.dataset.flavour], { source: 'rail' });
        return;
      }

      const filterBtn = t.closest('[data-filter]');
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

      if (t.closest('[data-cart-open]')) {
        cartOverlay.open();
        return;
      }
      if (t.closest('[data-cart-close]') || t.closest('[data-cart-scrim]')) {
        cartOverlay.close();
        return;
      }
      if (t.closest('[data-quick-close]') || t.closest('[data-quick-scrim]')) {
        quickOverlay.close();
        return;
      }
      if (t.closest('[data-cart-shop]')) {
        cartOverlay.close();
        document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      const qtyBtn = t.closest('[data-qty]');
      if (qtyBtn) {
        const key = qtyBtn.dataset.qty;
        const line = lines.find((l) => lineKey(l) === key);
        if (line) setQty(key, line.qty + Number(qtyBtn.dataset.delta));
        return;
      }

      const removeBtn = t.closest('[data-remove]');
      if (removeBtn) {
        setQty(removeBtn.dataset.remove, 0);
        toast('Removed from cart', 'muted');
        return;
      }

      const mixBtn = t.closest('[data-mix]');
      if (mixBtn) {
        const id = mixBtn.dataset.mix;
        const used = Object.values(mix).reduce((a, b) => a + b, 0);
        const delta = Number(mixBtn.dataset.delta);
        if (delta > 0 && used >= MIX_TARGET) return;
        mix[id] = Math.max(0, Math.min(MIX_TARGET, mix[id] + delta));
        renderMixer();
        return;
      }

      if (t.closest('[data-mix-add]')) {
        const chosen = PRODUCTS.filter((p) => mix[p.id] > 0);
        add({
          productId: chosen[0].id,
          packId: '12',
          subscribe: false,
          qty: 1,
          mix: chosen.map((p) => `${mix[p.id]}× ${p.name}`).join(', '),
        });
        toast('Mixed 12-pack added');
        return;
      }

      if (t.closest('[data-quick-add]')) {
        add({ ...quickState, qty: 1 });
        toast(`${byId[quickState.productId].name} added`);
        quickOverlay.close();
        return;
      }

      const faqBtn = t.closest('.faq__q');
      if (faqBtn) {
        const expanded = faqBtn.getAttribute('aria-expanded') === 'true';
        faqBtn.setAttribute('aria-expanded', String(!expanded));
        const answer = document.getElementById(faqBtn.getAttribute('aria-controls'));
        if (answer) answer.hidden = expanded;
        faqBtn.closest('.faq__item')?.classList.toggle('is-open', !expanded);
        return;
      }

      if (t.closest('[data-checkout]')) {
        const t2 = totals();
        toast(`Order placed — ${money.format(t2.total)}. Check your inbox.`);
        lines = [];
        promo = null;
        commit();
        setTimeout(() => cartOverlay.close(), 900);
      }
    });

    document.addEventListener('change', (e) => {
      const t = e.target;
      if (t.name === 'pack') {
        quickState.packId = t.value;
        renderQuick();
      }
      if (t.matches('[data-subscribe]')) {
        quickState.subscribe = t.checked;
        renderQuick();
      }
    });

    const promoForm = $('[data-promo-form]');
    promoForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('[data-promo-input]', promoForm);
      const code = input.value.trim().toUpperCase();
      if (PROMOS[code]) {
        promo = code;
        toast(`${code} applied — ${Math.round(PROMOS[code] * 100)}% off`);
        renderCart();
      } else {
        toast('That code is not recognised', 'warn');
      }
      input.value = '';
    });

    const newsletter = $('[data-newsletter]');
    newsletter?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('input[type=email]', newsletter);
      if (!input.value) return;
      toast('You are on the list. Welcome.');
      newsletter.reset();
    });
  }

  /* ---------------- public ---------------- */
  return {
    mount() {
      renderGrid();
      renderFlavourRail();
      renderStatic();
      renderMixer();
      renderCart();
      renderBadge();
      bind();
    },

    /** Called once the 3D stage has photographed each flavour. */
    setThumbnails(map) {
      thumbnails = map;
      $$('[data-thumb]').forEach((el) => {
        const p = byId[el.dataset.thumb];
        if (p && map[p.id]) el.innerHTML = thumbFor(p);
      });
      if (quickOverlay.isOpen) renderQuick();
      renderCart();
    },

    openCart: () => cartOverlay.open(),
    get cartOpen() {
      return cartOverlay.isOpen;
    },
  };
}
