/**
 * Every pixel on the can is drawn here, at runtime, on 2D canvases.
 *
 * The body is unwrapped to a single 2048x1024 sheet: x runs around the
 * circumference, y from the top rim down to the base. Four synchronised sheets
 * come off that one layout — colour, roughness, metalness and a normal map for
 * the condensation — so print, varnish and water always line up.
 *
 * Each flavour has its own `design`, and the six are laid out differently
 * rather than being one template recoloured. Packaging is bilingual, the way it
 * is on any shelf in the Kingdom: Latin display name, Arabic beneath it.
 */

import { BRAND } from './data.js';

const BODY_W = 2048;
const BODY_H = 1024;

// The print band is pinned to the straight part of the body: it starts just
// under the shoulder and stops just above the base flare, the way a real can
// is decorated. These are texture rows, mapped by remapBodyUVs onto real
// height, so they move whenever the profile does.
// The ink runs to the rolled rim. On a real can the shoulder and neck are
// printed like the rest of the body and only the narrow curl stays bare — a
// wide exposed silver shoulder is a mock-up tell, not a can. Rows 16..84 of
// this sheet land exactly on the shoulder and neck; the face layout below
// still starts at PRINT_TOP, so the design itself is untouched.
const SHOULDER_TOP = 16;
const PRINT_TOP = 84;
const PRINT_BOTTOM = 978;
const PRINT_H = PRINT_BOTTOM - PRINT_TOP;

const PAPER = '#F6F3EE'; // off-white ink; pure white never looks printed

/* ------------------------------------------------------------------ *
 * canvas helpers
 * ------------------------------------------------------------------ */

function surface(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d') };
}

const supports = (prop) => {
  try {
    return prop in document.createElement('canvas').getContext('2d');
  } catch {
    return false;
  }
};
const HAS_LETTER_SPACING = supports('letterSpacing');
const HAS_STRETCH = supports('fontStretch');

const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
const isArabic = (s) => ARABIC.test(s);

function setFont(ctx, { weight = 400, size = 40, family = 'Inter Variable', stretch = null }) {
  if (HAS_STRETCH) ctx.fontStretch = stretch || 'normal';
  ctx.font = `${weight} ${size}px "${family}", system-ui, sans-serif`;
}

function setArabicFont(ctx, { weight = 500, size = 30 }) {
  if (HAS_STRETCH) ctx.fontStretch = 'normal';
  ctx.font = `${weight} ${size}px "Cairo Variable", "Noto Sans Arabic", system-ui, sans-serif`;
}

/** Letterspaced caps, drawn glyph by glyph so tracking is exact everywhere. */
function tracked(ctx, text, x, y, tracking, align = 'center') {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
  let cursor = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const prev = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((c, i) => {
    ctx.fillText(c, cursor, y);
    cursor += widths[i] + tracking;
  });
  ctx.textAlign = prev;
  return total;
}

/**
 * Arabic is cursive and joins: splitting it into glyphs to letterspace would
 * break the shaping and reverse the order. So tracked text is Latin-only, and
 * Arabic goes through the engine in one piece.
 */
function line(ctx, text, x, y, { tracking = 0, align = 'center' } = {}) {
  if (isArabic(text)) {
    const prevAlign = ctx.textAlign;
    const prevDir = ctx.direction;
    ctx.textAlign = align;
    ctx.direction = 'rtl';
    ctx.fillText(text, x, y);
    ctx.textAlign = prevAlign;
    ctx.direction = prevDir;
    return;
  }
  if (tracking) tracked(ctx, text, x, y, tracking, align);
  else {
    const prev = ctx.textAlign;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
    ctx.textAlign = prev;
  }
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixHex(a, b, t) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const to = (x) => Math.round(x).toString(16).padStart(2, '0');
  return `#${to(r1 + (r2 - r1) * t)}${to(g1 + (g2 - g1) * t)}${to(b1 + (b2 - b1) * t)}`;
}

const rgba = (hex, a) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};

/* ------------------------------------------------------------------ *
 * shared sprites
 * ------------------------------------------------------------------ */

let noiseTile = null;
function getNoiseTile() {
  if (noiseTile) return noiseTile;
  const { canvas, ctx } = surface(256, 256);
  const img = ctx.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 118 + Math.random() * 30;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  noiseTile = canvas;
  return canvas;
}

/**
 * One hemisphere as a tangent-space normal map. A normal is a direction, so it
 * stays correct at any scale — this single sprite stamps every water bead.
 */
let dropSprite = null;
function getDropSprite() {
  if (dropSprite) return dropSprite;
  const size = 96;
  const { canvas, ctx } = surface(size, size);
  const img = ctx.createImageData(size, size);
  const r = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const nx = (x - r + 0.5) / r;
      const ny = (y - r + 0.5) / r;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1) {
        img.data[i + 3] = 0;
        continue;
      }
      const nz = Math.sqrt(1 - d2);
      const k = 0.46; // water on a vertical wall sags; it is not a marble
      const len = Math.hypot(nx * k, ny * k, nz);
      img.data[i] = Math.round((((nx * k) / len) * 0.5 + 0.5) * 255);
      img.data[i + 1] = Math.round(((-(ny * k) / len) * 0.5 + 0.5) * 255);
      img.data[i + 2] = Math.round(((nz / len) * 0.5 + 0.5) * 255);
      img.data[i + 3] = Math.round(255 * Math.min(1, (1 - Math.sqrt(d2)) * 7));
    }
  }
  ctx.putImageData(img, 0, 0);
  dropSprite = canvas;
  return canvas;
}

export function makeGlowSprite(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const { canvas, ctx } = surface(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, inner.replace(/[\d.]+\)$/, '0.55)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return canvas;
}

/** Luminance ramp used as the floor's alpha map, so its edge never shows. */
export function makeFloorFade() {
  const { canvas, ctx } = surface(256, 256);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 256, 256);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, '#e8e8e8');
  g.addColorStop(0.26, '#8e8e8e');
  g.addColorStop(0.5, '#242424');
  g.addColorStop(0.78, '#000000');
  g.addColorStop(1, '#000000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return canvas;
}

/** Vertical ramp: the mirrored can is strongest at the floor and gone by mid-height. */
export function makeReflectionFade() {
  const { canvas, ctx } = surface(8, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#000000');
  g.addColorStop(0.84, '#000000');
  g.addColorStop(0.95, '#0e0e0e');
  g.addColorStop(1, '#242424');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 256);
  return canvas;
}

/**
 * The graduated backdrop every product photograph is shot against. Without
 * something behind it the can reads as floating in a void rather than standing
 * in a room.
 */
export function makeBackdrop(accent = '#FF6B2C') {
  const W = 512;
  const H = 320;
  const { canvas, ctx } = surface(W, H);
  ctx.fillStyle = '#05060a';
  ctx.fillRect(0, 0, W, H);

  // The pool of light the subject stands in. A product shot has a graduated
  // sweep behind it — light behind the subject, falling off to the corners.
  // Tightened and darkened it reads as a void, and the can floats in it.
  const pool = ctx.createRadialGradient(W * 0.5, H * 0.56, 0, W * 0.5, H * 0.56, W * 0.46);
  pool.addColorStop(0, '#2b313c');
  pool.addColorStop(0.42, '#171b23');
  pool.addColorStop(1, 'rgba(5,6,10,0)');
  ctx.fillStyle = pool;
  ctx.fillRect(0, 0, W, H);

  // A breath of the flavour colour, low and off to one side.
  const wash = ctx.createRadialGradient(W * 0.72, H * 0.7, 0, W * 0.72, H * 0.7, W * 0.24);
  wash.addColorStop(0, rgba(accent, 0.11));
  wash.addColorStop(1, rgba(accent, 0));
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.1;
  const tile = getNoiseTile();
  for (let y = 0; y < H; y += 256) for (let x = 0; x < W; x += 256) ctx.drawImage(tile, x, y);
  ctx.restore();

  return canvas;
}

export function makeContactShadow() {
  const { canvas, ctx } = surface(256, 256);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,0.85)');
  g.addColorStop(0.45, 'rgba(0,0,0,0.42)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return canvas;
}

/* ------------------------------------------------------------------ *
 * deterministic randomness, so a flavour always looks identical
 * ------------------------------------------------------------------ */

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function seedFrom(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ------------------------------------------------------------------ *
 * the mark
 * ------------------------------------------------------------------ */

/**
 * The Kestra wing-K, in canvas form. Same geometry as the SVG in index.html,
 * authored on a 32-unit grid: a solid stem with the upper arm swept long and
 * shallow like an outstretched primary feather.
 */
export function drawMark(ctx, cx, cy, size, colour) {
  const u = size / 32;
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(u, u);
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.rect(4, 3, 6.2, 26);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(10.2, 18.3);
  ctx.lineTo(28.8, 2.4);
  ctx.lineTo(28.8, 8.5);
  ctx.lineTo(17.6, 18);
  ctx.lineTo(29.2, 29);
  ctx.lineTo(20.9, 29);
  ctx.lineTo(10.2, 19.1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* ------------------------------------------------------------------ *
 * shared type blocks
 * ------------------------------------------------------------------ */

function drawWordmark(ctx, cx, y, colour, size = 34, tracking = 15) {
  ctx.fillStyle = colour;
  setFont(ctx, { weight: 600, size, family: 'Inter Variable' });
  line(ctx, BRAND.name, cx, y, { tracking });
}

function drawRule(ctx, cx, y, halfWidth, colour, height = 2) {
  const g = ctx.createLinearGradient(cx - halfWidth, 0, cx + halfWidth, 0);
  g.addColorStop(0, rgba(colour, 0));
  g.addColorStop(0.5, rgba(colour, 0.62));
  g.addColorStop(1, rgba(colour, 0));
  ctx.fillStyle = g;
  ctx.fillRect(cx - halfWidth, y, halfWidth * 2, height);
}

/** The display name, scaled down rather than allowed to run into the seam. */
function drawDisplayName(ctx, text, cx, y, size, faceWidth, { stroke = null, fill = PAPER } = {}) {
  setFont(ctx, { weight: 800, size, family: 'Archivo Variable', stretch: 'condensed' });
  if (HAS_LETTER_SPACING) ctx.letterSpacing = '-3px';
  const measured = ctx.measureText(text).width;
  const maxW = faceWidth * 0.88;
  const scale = measured > maxW ? maxW / measured : 1;
  ctx.save();
  ctx.translate(cx, 0);
  if (scale !== 1) ctx.scale(scale, 1);
  ctx.textAlign = 'center';
  if (stroke) {
    ctx.lineWidth = 5 / scale;
    ctx.strokeStyle = stroke;
    ctx.strokeText(text, 0, y);
  } else {
    ctx.fillStyle = fill;
    ctx.fillText(text, 0, y);
  }
  ctx.restore();
  if (HAS_LETTER_SPACING) ctx.letterSpacing = '0px';
}

/** Latin flavour line with the Arabic beneath it. */
function drawFlavour(ctx, product, cx, y, colour, size = 26) {
  ctx.fillStyle = colour;
  setFont(ctx, { weight: 500, size, family: 'Inter Variable' });
  line(ctx, product.flavour.en.toUpperCase().replace(/ · /g, '  ·  '), cx, y, { tracking: 7 });
  setArabicFont(ctx, { weight: 500, size: size * 1.05 });
  ctx.fillStyle = rgba(PAPER, 0.72);
  line(ctx, product.flavour.ar, cx, y + size * 1.85);
}

/** Caffeine / sugar / volume, the three numbers people check on the shelf. */
function drawSpecRow(ctx, product, cx, y, faceWidth, { labelColour, valueColour, dividers = true }) {
  const cells = [
    ['CAFFEINE', `${product.caffeine} MG`],
    ['SUGAR', product.sugar === 0 ? 'ZERO' : `${product.sugar} G`],
    ['NET', '355 ML'],
  ];
  const cellW = faceWidth / 3;
  cells.forEach(([label, value], i) => {
    const x = cx - faceWidth / 2 + cellW * (i + 0.5);
    ctx.fillStyle = labelColour;
    setFont(ctx, { weight: 600, size: 19, family: 'Inter Variable' });
    line(ctx, label, x, y, { tracking: 6 });
    ctx.fillStyle = valueColour;
    setFont(ctx, { weight: 700, size: 44, family: 'Archivo Variable', stretch: 'condensed' });
    line(ctx, value, x, y + 52, { tracking: 1 });
    if (dividers && i > 0) {
      ctx.fillStyle = rgba(valueColour, 0.18);
      ctx.fillRect(cx - faceWidth / 2 + cellW * i, y - 30, 1, 90);
    }
  });
}

function drawSmallPrint(ctx, cx, y, colour) {
  ctx.fillStyle = rgba(colour, 0.5);
  setFont(ctx, { weight: 500, size: 17, family: 'Inter Variable' });
  line(ctx, 'SPARKLING ENERGY DRINK  ·  L-THEANINE  ·  ELECTROLYTES', cx, y, { tracking: 3 });
  setArabicFont(ctx, { weight: 500, size: 18 });
  ctx.fillStyle = rgba(colour, 0.44);
  line(ctx, 'مشروب طاقة فوّار · إل-ثيانين · أملاح معدنية', cx, y + 28);
  ctx.fillStyle = rgba(colour, 0.3);
  setFont(ctx, { weight: 400, size: 14, family: 'Inter Variable' });
  line(ctx, `${BRAND.legal.en.toUpperCase()}  ·  ${BRAND.city.en}  ·  ${BRAND.domain}`, cx, y + 54, { tracking: 2 });
}

/* ------------------------------------------------------------------ *
 * the six designs
 *
 * Backgrounds run right around the circumference; only type is per face.
 * ------------------------------------------------------------------ */

const BACKGROUNDS = {
  /** Broad colour field over a deep ink panel. */
  block(ctx, p) {
    const field = ctx.createLinearGradient(0, PRINT_TOP, 0, PRINT_BOTTOM);
    field.addColorStop(0, mixHex(p.accent, '#ffffff', 0.1));
    field.addColorStop(0.42, p.accent);
    field.addColorStop(1, p.accentDeep);
    ctx.fillStyle = field;
    ctx.fillRect(0, PRINT_TOP, BODY_W, PRINT_H);
    const panelTop = PRINT_TOP + PRINT_H * 0.775;
    ctx.fillStyle = p.ink;
    ctx.fillRect(0, panelTop, BODY_W, PRINT_BOTTOM - panelTop);
    ctx.fillStyle = mixHex(p.accent, '#ffffff', 0.45);
    ctx.fillRect(0, panelTop - 3, BODY_W, 3);
    return { panelTop, onInk: true };
  },

  /** Full-bleed wash, no panel — the lightest can in the range. */
  gradient(ctx, p) {
    const field = ctx.createLinearGradient(0, PRINT_TOP, 0, PRINT_BOTTOM);
    field.addColorStop(0, mixHex(p.accent, '#ffffff', 0.34));
    field.addColorStop(0.5, p.accent);
    field.addColorStop(1, mixHex(p.accentDeep, '#000000', 0.15));
    ctx.fillStyle = field;
    ctx.fillRect(0, PRINT_TOP, BODY_W, PRINT_H);
    // A hairline frame instead of a solid panel.
    ctx.strokeStyle = rgba(PAPER, 0.4);
    ctx.lineWidth = 2;
    ctx.strokeRect(0, PRINT_TOP + 34, BODY_W, PRINT_H - 68);
    return { panelTop: PRINT_TOP + PRINT_H * 0.74, onInk: false };
  },

  /** A shallow diagonal, which wraps the cylinder as a slow helix. */
  split(ctx, p) {
    ctx.fillStyle = p.accent;
    ctx.fillRect(0, PRINT_TOP, BODY_W, PRINT_H);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, PRINT_TOP + PRINT_H * 0.58);
    ctx.lineTo(BODY_W, PRINT_TOP + PRINT_H * 0.82);
    ctx.lineTo(BODY_W, PRINT_BOTTOM);
    ctx.lineTo(0, PRINT_BOTTOM);
    ctx.closePath();
    ctx.fillStyle = p.ink;
    ctx.fill();
    ctx.strokeStyle = mixHex(p.accent, '#ffffff', 0.5);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, PRINT_TOP + PRINT_H * 0.58);
    ctx.lineTo(BODY_W, PRINT_TOP + PRINT_H * 0.82);
    ctx.stroke();
    ctx.restore();
    return { panelTop: PRINT_TOP + PRINT_H * 0.7, onInk: true };
  },

  /** Three horizontal bands. */
  band(ctx, p) {
    const bands = [
      [0, 0.22, mixHex(p.accentDeep, '#000000', 0.3)],
      [0.22, 0.7, p.accent],
      [0.7, 1, p.ink],
    ];
    bands.forEach(([a, b, colour]) => {
      ctx.fillStyle = colour;
      ctx.fillRect(0, PRINT_TOP + PRINT_H * a, BODY_W, PRINT_H * (b - a));
    });
    ctx.fillStyle = rgba(PAPER, 0.3);
    ctx.fillRect(0, PRINT_TOP + PRINT_H * 0.22 - 1, BODY_W, 2);
    ctx.fillStyle = mixHex(p.accent, '#ffffff', 0.5);
    ctx.fillRect(0, PRINT_TOP + PRINT_H * 0.7 - 2, BODY_W, 3);
    return { panelTop: PRINT_TOP + PRINT_H * 0.7, onInk: true, topBand: PRINT_TOP + PRINT_H * 0.22 };
  },

  /** Near-black, with the colour spent only on rules and the numeral. */
  outline(ctx, p) {
    const field = ctx.createLinearGradient(0, PRINT_TOP, 0, PRINT_BOTTOM);
    field.addColorStop(0, mixHex(p.ink, p.accentDeep, 0.35));
    field.addColorStop(0.55, p.ink);
    field.addColorStop(1, '#050505');
    ctx.fillStyle = field;
    ctx.fillRect(0, PRINT_TOP, BODY_W, PRINT_H);
    ctx.fillStyle = p.accent;
    ctx.fillRect(0, PRINT_TOP, BODY_W, 5);
    ctx.fillRect(0, PRINT_BOTTOM - 5, BODY_W, 5);
    return { panelTop: PRINT_TOP + PRINT_H * 0.72, onInk: true, outlined: true };
  },

  /** Two-tone, divided around the circumference rather than down the height. */
  duo(ctx, p) {
    ctx.fillStyle = p.accent;
    ctx.fillRect(0, PRINT_TOP, BODY_W, PRINT_H);
    // The dark half is centred on each face's trailing edge, so both faces read.
    ctx.fillStyle = mixHex(p.accentDeep, '#000000', 0.25);
    ctx.fillRect(BODY_W * 0.0, PRINT_TOP, BODY_W * 0.12, PRINT_H);
    ctx.fillRect(BODY_W * 0.38, PRINT_TOP, BODY_W * 0.24, PRINT_H);
    ctx.fillRect(BODY_W * 0.88, PRINT_TOP, BODY_W * 0.12, PRINT_H);
    const panelTop = PRINT_TOP + PRINT_H * 0.79;
    ctx.fillStyle = p.ink;
    ctx.fillRect(0, panelTop, BODY_W, PRINT_BOTTOM - panelTop);
    ctx.fillStyle = mixHex(p.accent, '#ffffff', 0.4);
    ctx.fillRect(0, panelTop - 3, BODY_W, 3);
    return { panelTop, onInk: true };
  },
};

/** Type layout for one face, positioned against whatever the background left. */
function paintFace(ctx, cx, product, faceWidth, bg) {
  const top = PRINT_TOP;
  ctx.textBaseline = 'alphabetic';

  const outlined = !!bg.outlined;
  const headColour = outlined ? product.accent : PAPER;

  /* ghosted issue numeral behind the lockup */
  ctx.save();
  ctx.globalAlpha = outlined ? 0.2 : 0.13;
  ctx.fillStyle = outlined ? product.accent : PAPER;
  setFont(ctx, { weight: 700, size: 400, family: 'Archivo Variable', stretch: 'condensed' });
  ctx.textAlign = 'center';
  ctx.fillText(product.index, cx, top + 430);
  ctx.restore();

  /* the mark, then the wordmark under it */
  const markY = bg.topBand ? bg.topBand - 46 : top + 96;
  drawMark(ctx, cx, markY - 58, 40, headColour);
  drawWordmark(ctx, cx, markY, headColour);
  drawRule(ctx, cx, markY + 24, 300, headColour);

  setFont(ctx, { weight: 500, size: 22, family: 'Inter Variable' });
  ctx.fillStyle = rgba(headColour, 0.72);
  line(ctx, `NO. ${product.index}`, cx, markY + 66, { tracking: 9 });

  /* the display name */
  const nameY = bg.topBand ? top + 470 : top + 400;
  if (outlined) {
    drawDisplayName(ctx, product.name.en.toUpperCase(), cx, nameY, 188, faceWidth, { stroke: PAPER });
  } else {
    drawDisplayName(ctx, product.name.en.toUpperCase(), cx, nameY, 188, faceWidth);
  }

  /* Arabic name, set beneath the Latin */
  setArabicFont(ctx, { weight: 600, size: 54 });
  ctx.fillStyle = rgba(PAPER, 0.88);
  line(ctx, product.name.ar, cx, nameY + 66);

  drawFlavour(ctx, product, cx, nameY + 128, rgba(PAPER, 0.92));

  /* specs, inside the panel where there is one */
  const specY = bg.panelTop + 74;
  drawSpecRow(ctx, product, cx, specY, faceWidth, {
    labelColour: product.accent === PAPER ? PAPER : bg.onInk ? product.accent : rgba(PAPER, 0.8),
    valueColour: PAPER,
    dividers: true,
  });

  drawSmallPrint(ctx, cx, bg.panelTop + 178, PAPER);
}

/** The seam-side strip: barcode, recycling mark, the bits nobody reads. */
function paintSeamPanel(ctx, cx, product, rng) {
  const top = PRINT_TOP;
  ctx.save();

  const bcW = 150;
  const bcH = 92;
  const bx = cx - bcW / 2;
  const by = top + PRINT_H * 0.78;
  ctx.fillStyle = PAPER;
  ctx.fillRect(bx - 12, by - 12, bcW + 24, bcH + 44);
  ctx.fillStyle = '#101010';
  let px = bx;
  while (px < bx + bcW - 2) {
    const w = 1 + Math.floor(rng() * 4);
    if (rng() > 0.38) ctx.fillRect(px, by, w, bcH);
    px += w + 1 + Math.floor(rng() * 3);
  }
  ctx.textAlign = 'center';
  setFont(ctx, { weight: 500, size: 16, family: 'Inter Variable' });
  ctx.fillText('6 281100 0' + product.index + '4', cx, by + bcH + 24);

  ctx.strokeStyle = rgba(PAPER, 0.6);
  ctx.lineWidth = 3;
  ctx.beginPath();
  const ry = top + PRINT_H * 0.42;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
    ctx.moveTo(cx + Math.cos(a) * 26, ry + Math.sin(a) * 26);
    ctx.arc(cx, ry, 26, a, a + (Math.PI * 2) / 3.6);
  }
  ctx.stroke();

  ctx.fillStyle = rgba(PAPER, 0.55);
  setFont(ctx, { weight: 600, size: 17, family: 'Inter Variable' });
  line(ctx, 'ALU 41', cx, ry + 62, { tracking: 4 });
  line(ctx, 'BEST BEFORE', cx, top + PRINT_H * 0.2, { tracking: 4 });
  setArabicFont(ctx, { weight: 500, size: 18 });
  ctx.fillStyle = rgba(PAPER, 0.4);
  line(ctx, 'يُحفظ في مكان بارد', cx, top + PRINT_H * 0.2 + 30);
  ctx.restore();
}

/* ------------------------------------------------------------------ *
 * sheets
 * ------------------------------------------------------------------ */

/** The printed sleeve for one flavour — the only sheet that differs per SKU. */
/** The printed shoulder: the dark collar every can carries above the body. */
function paintShoulderBand(ctx, product) {
  const h = PRINT_TOP - SHOULDER_TOP;
  ctx.save();
  ctx.fillStyle = '#14161a';
  ctx.fillRect(0, SHOULDER_TOP, BODY_W, h);
  ctx.fillStyle = product.accent;
  ctx.fillRect(0, PRINT_TOP - 3, BODY_W, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  setFont(ctx, { weight: 700, size: 21, family: 'Archivo Variable', stretch: '86%' });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const y = SHOULDER_TOP + h * 0.5;
  for (const cx of [BODY_W * 0.25, BODY_W * 0.75]) {
    tracked(ctx, 'SPARKLING ENERGY DRINK', cx, y, 7);
  }
  ctx.restore();
}

export function paintColourSheet(product) {
  const rng = seeded(seedFrom(product.id));
  const { canvas, ctx: c } = surface(BODY_W, BODY_H);

  c.fillStyle = '#C9CDD2'; // bare aluminium above and below the sleeve
  c.fillRect(0, 0, BODY_W, BODY_H);

  const bg = (BACKGROUNDS[product.design] || BACKGROUNDS.block)(c, product);

  // Faint vertical rule grid — structure you feel more than see.
  c.save();
  c.globalAlpha = 0.05;
  c.fillStyle = '#ffffff';
  for (let x = 0; x < BODY_W; x += 32) c.fillRect(x, PRINT_TOP, 1, PRINT_H);
  c.restore();

  // Two identical faces a half turn apart, so one always faces the camera.
  paintFace(c, BODY_W * 0.25, product, BODY_W * 0.42, bg);
  paintFace(c, BODY_W * 0.75, product, BODY_W * 0.42, bg);
  paintSeamPanel(c, BODY_W * 0.5, product, rng);
  paintSeamPanel(c, BODY_W - 2, product, seeded(seedFrom(product.id + 'b')));
  paintShoulderBand(c, product);

  // Print grain.
  c.save();
  c.globalCompositeOperation = 'overlay';
  c.globalAlpha = 0.14;
  const tile = getNoiseTile();
  for (let y = 0; y < BODY_H; y += 256) for (let x = 0; x < BODY_W; x += 256) c.drawImage(tile, x, y);
  c.restore();

  return canvas;
}

/**
 * Surface response, identical for every flavour: brushing on the bare metal,
 * varnish over the print, and the condensation. Roughness goes in green and
 * metalness in blue — the standard packing — so both cost one texture.
 */
export function paintSurfaceSheets({ droplets = true, beadCount = 620 } = {}) {
  const rng = seeded(0x5eed1234);
  const orm = surface(BODY_W, BODY_H);
  const nrm = surface(BODY_W, BODY_H);
  const r = orm.ctx;
  const n = nrm.ctx;

  r.fillStyle = 'rgb(255,70,255)'; // polished aluminium, fully metallic
  r.fillRect(0, 0, BODY_W, BODY_H);
  // Printed ink is a dielectric over a white base coat, so its metalness is
  // near zero — the previous 0.56 left half the label with no diffuse term at
  // all, which is why the colour washed to white under a strip light instead
  // of holding. The unprinted bands above and below stay fully metallic.
  r.fillStyle = 'rgb(255,84,26)';
  r.fillRect(0, SHOULDER_TOP, BODY_W, PRINT_BOTTOM - SHOULDER_TOP);

  // Mill lines on the bare metal. These are confined to the two unprinted
  // bands, and those bands are now narrow — 900 of them packed into ~90 rows
  // stopped reading as fine grain and started reading as machined grooves.
  r.save();
  r.globalAlpha = 0.16;
  for (let i = 0; i < 190; i++) {
    const y = rng() < 0.5 ? rng() * SHOULDER_TOP : PRINT_BOTTOM + rng() * (BODY_H - PRINT_BOTTOM);
    const x = rng() * BODY_W;
    r.fillStyle = rng() > 0.5 ? 'rgb(255,70,255)' : 'rgb(255,52,255)';
    r.fillRect(x, y, 40 + rng() * 220, 1);
  }
  r.restore();

  n.fillStyle = '#8080ff';
  n.fillRect(0, 0, BODY_W, BODY_H);

  // Handling marks. A can that has come off a shelf is not optically perfect,
  // and these are the difference between a render and a photograph.
  r.save();
  // Fine scratches, mostly circumferential from the filling line.
  for (let i = 0; i < 260; i++) {
    const y = rng() * BODY_H;
    const x = rng() * BODY_W;
    const len = 12 + rng() * 90;
    const tilt = (rng() - 0.5) * 0.16;
    r.globalAlpha = 0.1 + rng() * 0.22;
    r.strokeStyle = rng() > 0.45 ? 'rgb(255,20,255)' : 'rgb(255,96,220)';
    r.lineWidth = 0.6 + rng() * 0.9;
    r.beginPath();
    r.moveTo(x, y);
    r.lineTo(x + len, y + len * tilt);
    r.stroke();
  }
  // Fingerprint smudges — soft, slightly rougher, in the places a hand grips.
  for (let i = 0; i < 14; i++) {
    const x = rng() * BODY_W;
    const y = PRINT_TOP + PRINT_H * (0.25 + rng() * 0.55);
    const rad = 26 + rng() * 46;
    const g = r.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(255,150,180,0.30)');
    g.addColorStop(1, 'rgba(255,150,180,0)');
    r.globalAlpha = 1;
    r.fillStyle = g;
    r.beginPath();
    r.arc(x, y, rad, 0, Math.PI * 2);
    r.fill();
  }
  // A little settled dust.
  for (let i = 0; i < 340; i++) {
    r.globalAlpha = 0.12 + rng() * 0.3;
    r.fillStyle = 'rgb(255,180,200)';
    r.fillRect(rng() * BODY_W, rng() * BODY_H, 1 + rng() * 1.6, 1 + rng() * 1.6);
  }
  r.restore();

  if (droplets) {
    const sprite = getDropSprite();

    /** One bead: a dome in the normals, a smoother wetter patch in roughness. */
    const bead = (x, y, size) => {
      n.drawImage(sprite, x - size / 2, y - size / 2, size, size);
      r.save();
      // Bigger beads hold more water and read glossier than the fine mist.
      r.globalAlpha = 0.45 + Math.min(0.45, size / 40);
      r.fillStyle = 'rgb(255,10,116)';
      r.beginPath();
      r.arc(x, y, size / 2, 0, Math.PI * 2);
      r.fill();
      r.restore();
    };

    // Condensation nucleates: a few larger beads with a haze of fine ones
    // crowding around them, rather than an even scatter of equal circles.
    const clusters = Math.round(beadCount / 14);
    for (let c = 0; c < clusters; c++) {
      const t = Math.pow(rng(), 0.55); // heavier low down, where it runs
      const cx = rng() * BODY_W;
      const cy = PRINT_TOP + 24 + t * (PRINT_H - 48);
      const spread = 40 + rng() * 110;

      bead(cx, cy, 9 + Math.pow(rng(), 1.6) * 21);

      const members = 8 + Math.floor(rng() * 8);
      for (let i = 0; i < members; i++) {
        const a = rng() * Math.PI * 2;
        const d = Math.pow(rng(), 0.7) * spread;
        const bx = cx + Math.cos(a) * d;
        const by = cy + Math.sin(a) * d * 0.75;
        if (by < PRINT_TOP + 10 || by > PRINT_BOTTOM - 10) continue;
        // Most of what you see is fine mist; the eye reads that as cold.
        bead(bx, by, 2.2 + Math.pow(rng(), 3) * 11);
      }
    }

    // A dusting of isolated micro-beads over everything else.
    for (let i = 0; i < beadCount; i++) {
      const t = Math.pow(rng(), 0.6);
      const y = PRINT_TOP + 20 + t * (PRINT_H - 40);
      bead(rng() * BODY_W, y, 1.6 + Math.pow(rng(), 3.4) * 7);
    }
    // Beads that have started to run. Stepped at a fraction of their own width
    // and wandering slightly, so a trail reads as one rivulet.
    for (let i = 0; i < 22; i++) {
      let x = rng() * BODY_W;
      const y = PRINT_TOP + 80 + rng() * (PRINT_H - 200);
      const len = 34 + rng() * 120;
      const w = 4 + rng() * 5.5;
      const wander = (rng() - 0.5) * 0.06;
      r.save();
      r.globalAlpha = 0.34;
      r.fillStyle = 'rgb(255,26,124)';
      r.beginPath();
      for (let k = 0; k < len; k += w * 0.11) {
        const s = w * (1 - Math.pow(k / len, 1.5) * 0.62);
        x += wander;
        n.drawImage(sprite, x - s / 2, y + k - s / 2, s, s);
        r.rect(x - s / 2, y + k, s, w * 0.2);
      }
      r.fill();
      r.restore();
      const head = w * 1.35;
      n.drawImage(sprite, x - head / 2, y + len - head / 2, head, head);
    }
  }

  return { orm: orm.canvas, normal: nrm.canvas };
}

/* ------------------------------------------------------------------ *
 * the lid
 * ------------------------------------------------------------------ */

/**
 * The teardrop the opening is scored into. Wide lobe away from the rivet,
 * tapering back toward it — this is the shape on every stay-on-tab end.
 */
function scorePath(ctx, rx, ry) {
  ctx.beginPath();
  ctx.moveTo(0, ry); // the point, nearest the rivet — the tear starts here
  ctx.bezierCurveTo(rx * 0.62, ry * 0.74, rx, ry * 0.02, rx * 0.86, -ry * 0.54);
  ctx.bezierCurveTo(rx * 0.74, -ry * 1.04, -rx * 0.74, -ry * 1.04, -rx * 0.86, -ry * 0.54);
  ctx.bezierCurveTo(-rx, ry * 0.02, -rx * 0.62, ry * 0.74, 0, ry);
  ctx.closePath();
}

/** Height field -> tangent-space normals, by central difference. */
function heightToNormal(height, size, strength) {
  const src = height.getImageData(0, 0, size, size).data;
  const out = new ImageData(size, size);
  const at = (x, y) => src[((y & (size - 1)) * size + (x & (size - 1))) * 4] / 255;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      out.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      out.data[i + 2] = (1 / len) * 0.5 * 255 + 127.5;
      out.data[i + 3] = 255;
    }
  }
  return out;
}

export function paintLidSheets() {
  const S = 1024;
  const col = surface(S, S);
  const rgh = surface(S, S);
  const c = col.ctx;
  const r = rgh.ctx;
  const mid = S / 2;

  c.fillStyle = '#B9BEC4';
  c.fillRect(0, 0, S, S);

  // Concentric marks left by the stamping die.
  c.save();
  for (let i = 0; i < 320; i++) {
    c.strokeStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.05})`;
    c.lineWidth = 0.6 + Math.random() * 1.6;
    c.beginPath();
    c.arc(mid, mid, (i / 320) * mid, 0, Math.PI * 2);
    c.stroke();
  }
  c.restore();

  c.strokeStyle = 'rgba(70,76,84,0.5)';
  c.lineWidth = 26;
  c.beginPath();
  c.arc(mid, mid, mid * 0.9, 0, Math.PI * 2);
  c.stroke();

  // The score line. A stay-on-tab end is scored as a teardrop, not an oval:
  // wide at the far lobe where the panel folds in, tapering back toward the
  // rivet so the tear starts at one point and runs.
  c.save();
  c.translate(mid, mid - S * 0.2155);
  scorePath(c, S * 0.16, S * 0.125);
  c.strokeStyle = 'rgba(46,52,60,0.95)';
  c.lineWidth = 5.5;
  c.stroke();
  scorePath(c, S * 0.16, S * 0.125);
  c.translate(0, 2.5);
  c.strokeStyle = 'rgba(255,255,255,0.34)';
  c.lineWidth = 1.8;
  c.stroke();
  c.restore();

  // Rivet.
  c.save();
  c.translate(mid, mid);
  const rv = c.createRadialGradient(-4, -6, 1, 0, 0, 26);
  rv.addColorStop(0, '#EFF2F5');
  rv.addColorStop(0.6, '#9BA1A8');
  rv.addColorStop(1, '#6C727A');
  c.fillStyle = rv;
  c.beginPath();
  c.arc(0, 0, 24, 0, Math.PI * 2);
  c.fill();
  c.restore();

  // Embossed mark and lot code, the way a real lid is stamped.
  drawMark(c, mid + S * 0.3, mid, 42, 'rgba(96,102,110,0.45)');
  c.save();
  c.fillStyle = 'rgba(90,96,104,0.5)';
  setFont(c, { weight: 600, size: 20, family: 'Inter Variable' });
  c.textAlign = 'center';
  c.translate(mid, mid);
  c.rotate(-Math.PI / 2);
  tracked(c, BRAND.name, 0, -mid * 0.76, 8);
  c.restore();

  r.fillStyle = '#3a3a3a';
  r.fillRect(0, 0, S, S);
  r.save();
  for (let i = 0; i < 260; i++) {
    r.strokeStyle = `rgba(255,255,255,${Math.random() * 0.12})`;
    r.lineWidth = 1 + Math.random() * 2;
    r.beginPath();
    r.arc(mid, mid, (i / 260) * mid, 0, Math.PI * 2);
    r.stroke();
  }
  r.restore();

  /* ---- relief ---- */
  // Paint a height field, then differentiate it. The lathe gives the
  // countersink and the panel dome, but the score and the rivet are not
  // radial, so they can only come from a map.
  const hgt = surface(S, S);
  const h = hgt.ctx;
  h.fillStyle = '#808080';
  h.fillRect(0, 0, S, S);

  // The score is a groove: a dark line with a faint raised shoulder either
  // side, which is what the stamping actually leaves.
  h.save();
  h.translate(mid, mid - S * 0.2155);
  h.lineJoin = 'round';
  scorePath(h, S * 0.16, S * 0.125);
  h.strokeStyle = 'rgba(168,168,168,0.85)';
  h.lineWidth = 11;
  h.stroke();
  scorePath(h, S * 0.16, S * 0.125);
  h.strokeStyle = '#3c3c3c';
  h.lineWidth = 6;
  h.stroke();
  h.restore();

  // The rivet: a real dome, with the little collar pressed around its base.
  h.save();
  h.translate(mid, mid);
  h.fillStyle = 'rgba(120,120,120,0.9)';
  h.beginPath();
  h.arc(0, 0, 34, 0, Math.PI * 2);
  h.fill();
  const dome = h.createRadialGradient(0, 0, 1, 0, 0, 24);
  dome.addColorStop(0, '#e8e8e8');
  dome.addColorStop(0.72, '#b4b4b4');
  dome.addColorStop(1, '#8a8a8a');
  h.fillStyle = dome;
  h.beginPath();
  h.arc(0, 0, 24, 0, Math.PI * 2);
  h.fill();
  h.restore();

  const nrm = surface(S, S);
  nrm.ctx.putImageData(heightToNormal(h, S, 5.5), 0, 0);

  return { colour: col.canvas, roughness: rgh.canvas, normal: nrm.canvas };
}

/* ------------------------------------------------------------------ *
 * the twelve-pack carton
 * ------------------------------------------------------------------ */

/**
 * Printed board for the mixed pack. Kraft-toned card with the wordmark and a
 * die-cut window, so the cans inside are what you actually look at.
 */
export function paintCartonSheets(accent = '#FF6B2C') {
  const W = 1024;
  const H = 512;
  const col = surface(W, H);
  const c = col.ctx;

  c.fillStyle = '#15181E';
  c.fillRect(0, 0, W, H);

  // Board texture.
  c.save();
  c.globalAlpha = 0.09;
  const tile = getNoiseTile();
  for (let y = 0; y < H; y += 256) for (let x = 0; x < W; x += 256) c.drawImage(tile, x, y);
  c.restore();

  c.fillStyle = accent;
  c.fillRect(0, 0, W, 8);
  c.fillRect(0, H - 8, W, 8);

  drawMark(c, W / 2, H * 0.26, 68, accent);

  c.fillStyle = PAPER;
  setFont(c, { weight: 600, size: 46, family: 'Inter Variable' });
  c.textAlign = 'center';
  tracked(c, BRAND.name, W / 2, H * 0.5, 22);

  c.fillStyle = rgba(PAPER, 0.55);
  setFont(c, { weight: 500, size: 22, family: 'Inter Variable' });
  tracked(c, 'MIXED TWELVE  ·  12 × 355 ML', W / 2, H * 0.62, 6);

  setArabicFont(c, { weight: 500, size: 24 });
  c.fillStyle = rgba(PAPER, 0.45);
  c.direction = 'rtl';
  c.fillText('علبة مخصصة · ١٢ × ٣٥٥ مل', W / 2, H * 0.74);

  return { colour: col.canvas };
}

/* ------------------------------------------------------------------ *
 * the factory
 * ------------------------------------------------------------------ */

/** Brushed stainless: linear grain, the way rolled plate actually looks. */
export function makeSteelSheets() {
  const W = 1024;
  const H = 1024;
  const col = surface(W, H);
  const orm = surface(W, H);
  const c = col.ctx;
  const r = orm.ctx;
  const rng = seeded(0x57ee11);

  c.fillStyle = '#8d949c';
  c.fillRect(0, 0, W, H);
  r.fillStyle = 'rgb(255,72,255)'; // roughness 0.28, fully metallic
  r.fillRect(0, 0, W, H);

  // The grain. Long, fine, all running the same way.
  for (let i = 0; i < 5200; i++) {
    const y = rng() * H;
    const x = rng() * W;
    const len = 60 + rng() * 420;
    const a = 0.04 + rng() * 0.12;
    c.strokeStyle = rng() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    c.lineWidth = 0.5 + rng() * 1.4;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + len, y + (rng() - 0.5) * 1.5);
    c.stroke();

    r.strokeStyle = rng() > 0.5 ? 'rgba(255,110,255,0.5)' : 'rgba(255,44,255,0.5)';
    r.lineWidth = 0.6 + rng() * 1.6;
    r.beginPath();
    r.moveTo(x, y);
    r.lineTo(x + len, y);
    r.stroke();
  }

  // Weld seams and wear, so a tank does not read as a perfect primitive.
  for (let i = 0; i < 5; i++) {
    const y = rng() * H;
    c.strokeStyle = 'rgba(60,66,74,0.4)';
    c.lineWidth = 3 + rng() * 4;
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(W, y + (rng() - 0.5) * 6);
    c.stroke();
  }

  return { colour: col.canvas, orm: orm.canvas };
}

/**
 * A tiling ripple normal map, built as a height field from overlapping circular
 * waves and differentiated. Cheaper and more convincing than stacked noise:
 * real liquid in a vessel has concentric wavefronts, not fractal fuzz.
 */
export function makeLiquidNormal(size = 512) {
  const { canvas, ctx } = surface(size, size);
  const img = ctx.createImageData(size, size);
  const rng = seeded(0x1119d1);

  const sources = Array.from({ length: 7 }, () => ({
    x: rng() * size,
    y: rng() * size,
    k: 0.05 + rng() * 0.11,
    a: 0.4 + rng() * 0.8,
    p: rng() * Math.PI * 2,
  }));

  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let h = 0;
      for (const s of sources) {
        // Wrap the distance so the map tiles without a visible seam.
        const dx = Math.min(Math.abs(x - s.x), size - Math.abs(x - s.x));
        const dy = Math.min(Math.abs(y - s.y), size - Math.abs(y - s.y));
        h += Math.sin(Math.hypot(dx, dy) * s.k + s.p) * s.a;
      }
      height[y * size + x] = h;
    }
  }

  const at = (x, y) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const nx = (at(x - 1, y) - at(x + 1, y)) * 0.5;
      const ny = (at(x, y - 1) - at(x, y + 1)) * 0.5;
      const len = Math.hypot(nx, ny, 1);
      img.data[i] = Math.round((nx / len) * 0.5 * 255 + 127.5);
      img.data[i + 1] = Math.round((ny / len) * 0.5 * 255 + 127.5);
      img.data[i + 2] = Math.round((1 / len) * 0.5 * 255 + 127.5);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Ribbed conveyor belting: dark rubber with regular cleats. */
export function makeBeltSheets() {
  const W = 256;
  const H = 256;
  const col = surface(W, H);
  const orm = surface(W, H);
  const c = col.ctx;
  const r = orm.ctx;

  c.fillStyle = '#1b1e23';
  c.fillRect(0, 0, W, H);
  r.fillStyle = 'rgb(255,168,10)'; // rough rubber, barely metallic
  r.fillRect(0, 0, W, H);

  for (let y = 0; y < H; y += 32) {
    c.fillStyle = '#23272d';
    c.fillRect(0, y, W, 18);
    c.fillStyle = 'rgba(255,255,255,0.05)';
    c.fillRect(0, y, W, 2);
    c.fillStyle = 'rgba(0,0,0,0.4)';
    c.fillRect(0, y + 17, W, 3);
    r.fillStyle = 'rgb(255,140,10)';
    r.fillRect(0, y, W, 18);
  }

  c.save();
  c.globalCompositeOperation = 'overlay';
  c.globalAlpha = 0.2;
  c.drawImage(getNoiseTile(), 0, 0);
  c.restore();

  return { colour: col.canvas, orm: orm.canvas };
}

export const CAN_SHEET = { width: BODY_W, height: BODY_H, printTop: PRINT_TOP, printBottom: PRINT_BOTTOM };
