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

const PRINT_TOP = 189;
const PRINT_BOTTOM = 939;
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
      const k = 0.72; // a bead of water is flatter than a full hemisphere
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
    const panelTop = PRINT_TOP + PRINT_H * 0.715;
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
    const panelTop = PRINT_TOP + PRINT_H * 0.73;
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

  /* house wordmark */
  const markY = bg.topBand ? bg.topBand - 46 : top + 92;
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
  const by = top + PRINT_H * 0.72;
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

  r.fillStyle = 'rgb(255,46,255)'; // polished aluminium, fully metallic
  r.fillRect(0, 0, BODY_W, BODY_H);
  r.fillStyle = 'rgb(255,77,143)'; // varnished print, ink knocks metalness back
  r.fillRect(0, PRINT_TOP, BODY_W, PRINT_H);

  r.save();
  r.globalAlpha = 0.45;
  for (let i = 0; i < 900; i++) {
    const y = rng() < 0.5 ? rng() * PRINT_TOP : PRINT_BOTTOM + rng() * (BODY_H - PRINT_BOTTOM);
    const x = rng() * BODY_W;
    r.fillStyle = rng() > 0.5 ? 'rgb(255,66,255)' : 'rgb(255,30,255)';
    r.fillRect(x, y, 40 + rng() * 220, 1);
  }
  r.restore();

  n.fillStyle = '#8080ff';
  n.fillRect(0, 0, BODY_W, BODY_H);

  if (droplets) {
    const sprite = getDropSprite();
    for (let i = 0; i < beadCount; i++) {
      const t = Math.pow(rng(), 0.6); // condensation forms heavier low down
      const y = PRINT_TOP + 30 + t * (PRINT_H - 60);
      const x = rng() * BODY_W;
      const size = 5 + Math.pow(rng(), 2.4) * 30;
      n.drawImage(sprite, x - size / 2, y - size / 2, size, size);
      r.save();
      r.globalAlpha = 0.85;
      r.fillStyle = 'rgb(255,13,120)';
      r.beginPath();
      r.arc(x, y, size / 2, 0, Math.PI * 2);
      r.fill();
      r.restore();
    }
    // Beads that have started to run. Stepped at a fraction of their own width
    // and wandering slightly, so a trail reads as one rivulet.
    for (let i = 0; i < 22; i++) {
      let x = rng() * BODY_W;
      const y = PRINT_TOP + 80 + rng() * (PRINT_H - 200);
      const len = 40 + rng() * 150;
      const w = 5 + rng() * 7;
      const wander = (rng() - 0.5) * 0.06;
      r.save();
      r.globalAlpha = 0.5;
      r.fillStyle = 'rgb(255,19,120)';
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

  // Score line for the opening.
  c.save();
  c.translate(mid, mid + S * 0.12);
  c.strokeStyle = 'rgba(58,64,72,0.85)';
  c.lineWidth = 4;
  c.beginPath();
  c.ellipse(0, 0, S * 0.155, S * 0.115, 0, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.4)';
  c.lineWidth = 2;
  c.beginPath();
  c.ellipse(0, -2, S * 0.155, S * 0.115, 0, 0, Math.PI * 2);
  c.stroke();
  c.restore();

  // Rivet.
  c.save();
  c.translate(mid, mid - S * 0.03);
  const rv = c.createRadialGradient(-4, -6, 1, 0, 0, 26);
  rv.addColorStop(0, '#EFF2F5');
  rv.addColorStop(0.6, '#9BA1A8');
  rv.addColorStop(1, '#6C727A');
  c.fillStyle = rv;
  c.beginPath();
  c.arc(0, 0, 24, 0, Math.PI * 2);
  c.fill();
  c.restore();

  c.save();
  c.fillStyle = 'rgba(90,96,104,0.55)';
  setFont(c, { weight: 600, size: 22, family: 'Inter Variable' });
  c.textAlign = 'center';
  c.translate(mid, mid);
  c.rotate(-Math.PI / 2);
  tracked(c, BRAND.name, 0, -mid * 0.74, 8);
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

  return { colour: col.canvas, roughness: rgh.canvas };
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

  c.fillStyle = PAPER;
  setFont(c, { weight: 600, size: 46, family: 'Inter Variable' });
  c.textAlign = 'center';
  tracked(c, BRAND.name, W / 2, H * 0.42, 22);

  c.fillStyle = rgba(PAPER, 0.55);
  setFont(c, { weight: 500, size: 22, family: 'Inter Variable' });
  tracked(c, 'MIXED TWELVE  ·  12 × 355 ML', W / 2, H * 0.56, 6);

  setArabicFont(c, { weight: 500, size: 24 });
  c.fillStyle = rgba(PAPER, 0.45);
  c.direction = 'rtl';
  c.fillText('علبة مخصصة · ١٢ × ٣٥٥ مل', W / 2, H * 0.66);

  return { colour: col.canvas };
}

export const CAN_SHEET = { width: BODY_W, height: BODY_H, printTop: PRINT_TOP, printBottom: PRINT_BOTTOM };
