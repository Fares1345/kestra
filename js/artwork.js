/**
 * Every pixel on the can is drawn here, at runtime, on 2D canvases.
 *
 * The body of the can is unwrapped to a single 2048x1024 sheet: x runs around
 * the circumference, y runs from the top rim down to the base. We paint four
 * synchronised sheets from that one layout — colour, roughness, metalness and
 * a normal map for the condensation — so the print, the varnish and the water
 * always line up.
 */

import { BRAND } from './data.js';

const BODY_W = 2048;
const BODY_H = 1024;

// Where the printed sleeve sits on the unwrapped body, in canvas rows.
const PRINT_TOP = 189;
const PRINT_BOTTOM = 939;
const PRINT_H = PRINT_BOTTOM - PRINT_TOP;

const PAPER = '#F6F3EE'; // off-white ink; pure white never looks printed

/* ------------------------------------------------------------------ *
 * small canvas helpers
 * ------------------------------------------------------------------ */

function surface(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d') };
}

const supportsLetterSpacing = (() => {
  try {
    return 'letterSpacing' in document.createElement('canvas').getContext('2d');
  } catch {
    return false;
  }
})();

const supportsStretch = (() => {
  try {
    return 'fontStretch' in document.createElement('canvas').getContext('2d');
  } catch {
    return false;
  }
})();

/**
 * Archivo carries a width axis. Where the canvas API can reach it we narrow the
 * display face the way a real can would; elsewhere we simply fall back to the
 * normal width rather than smearing the glyphs with a transform.
 */
function setFont(ctx, { weight = 400, size = 40, family = 'Inter Variable', stretch = null }) {
  if (supportsStretch) ctx.fontStretch = stretch || 'normal';
  ctx.font = `${weight} ${size}px "${family}", system-ui, sans-serif`;
}

/** Letterspaced small caps, drawn glyph by glyph so tracking is exact everywhere. */
function tracked(ctx, text, x, y, tracking, align = 'center') {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
  let cursor = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((c, i) => {
    ctx.fillText(c, cursor, y);
    cursor += widths[i] + tracking;
  });
  ctx.textAlign = prevAlign;
  return total;
}

function trackedWidth(ctx, text, tracking) {
  const chars = [...text];
  return chars.reduce((a, c) => a + ctx.measureText(c).width, 0) + tracking * (chars.length - 1);
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

/* ------------------------------------------------------------------ *
 * reusable sprites, built once and shared
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
 * One hemisphere rendered as a tangent-space normal map. Because a normal is a
 * direction it stays correct at any scale, so this single sprite stamps every
 * droplet on the can no matter how big.
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
      // Flatten the dome slightly: a bead of water is not a full hemisphere.
      const nz = Math.sqrt(1 - d2);
      const k = 0.72;
      const len = Math.hypot(nx * k, ny * k, nz);
      img.data[i] = Math.round((((nx * k) / len) * 0.5 + 0.5) * 255);
      img.data[i + 1] = Math.round(((-(ny * k) / len) * 0.5 + 0.5) * 255);
      img.data[i + 2] = Math.round(((nz / len) * 0.5 + 0.5) * 255);
      // Feather the rim so droplets do not show a hard cut-out.
      img.data[i + 3] = Math.round(255 * Math.min(1, (1 - Math.sqrt(d2)) * 7));
    }
  }
  ctx.putImageData(img, 0, 0);
  dropSprite = canvas;
  return canvas;
}

/** Soft round falloff — used for dust motes and the contact shadow. */
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

/** Luminance ramp used as the floor's alpha map — it fades out before its rim. */
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
 * the printed sleeve
 * ------------------------------------------------------------------ */

function paintFace(ctx, cx, product, faceWidth) {
  const { accent, ink } = product;
  const top = PRINT_TOP;

  ctx.textBaseline = 'alphabetic';

  /* --- ghosted issue numeral, sitting behind the wordmark --- */
  ctx.save();
  ctx.globalAlpha = 0.13;
  ctx.fillStyle = PAPER;
  setFont(ctx, { weight: 700, size: 400, family: 'Archivo Variable', stretch: 'condensed' });
  ctx.textAlign = 'center';
  ctx.fillText(product.index, cx, top + 430);
  ctx.restore();

  /* --- house wordmark --- */
  ctx.fillStyle = PAPER;
  setFont(ctx, { weight: 600, size: 34, family: 'Inter Variable' });
  tracked(ctx, BRAND.name, cx, top + 92, 15);

  // hairline under the wordmark, tapered at both ends
  const ruleW = 300;
  const grad = ctx.createLinearGradient(cx - ruleW, 0, cx + ruleW, 0);
  grad.addColorStop(0, 'rgba(246,243,238,0)');
  grad.addColorStop(0.5, 'rgba(246,243,238,0.6)');
  grad.addColorStop(1, 'rgba(246,243,238,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(cx - ruleW, top + 116, ruleW * 2, 2);

  setFont(ctx, { weight: 500, size: 22, family: 'Inter Variable' });
  ctx.fillStyle = 'rgba(246,243,238,0.72)';
  tracked(ctx, `NO. ${product.index}`, cx, top + 158, 9);

  /* --- the product name, the loudest thing on the can --- */
  ctx.fillStyle = PAPER;
  ctx.textAlign = 'center';
  setFont(ctx, { weight: 800, size: 188, family: 'Archivo Variable', stretch: 'condensed' });
  if (supportsLetterSpacing) ctx.letterSpacing = '-3px';
  const upper = product.name.toUpperCase();
  // Never let a long name run into the seam.
  const measured = ctx.measureText(upper).width;
  const maxW = faceWidth * 0.86;
  if (measured > maxW) {
    ctx.save();
    ctx.translate(cx, 0);
    ctx.scale(maxW / measured, 1);
    ctx.fillText(upper, 0, top + 400);
    ctx.restore();
  } else {
    ctx.fillText(upper, cx, top + 400);
  }
  if (supportsLetterSpacing) ctx.letterSpacing = '0px';

  /* --- flavour line --- */
  setFont(ctx, { weight: 500, size: 26, family: 'Inter Variable' });
  ctx.fillStyle = 'rgba(246,243,238,0.9)';
  tracked(ctx, product.flavour.toUpperCase().replace(/ · /g, '  ·  '), cx, top + 462, 7);

  /* --- ink panel across the lower third --- */
  const panelTop = top + PRINT_H * 0.715;
  ctx.fillStyle = ink;
  ctx.fillRect(cx - faceWidth / 2, panelTop, faceWidth, PRINT_BOTTOM - panelTop);

  // a bright hairline where the colour meets the ink
  ctx.fillStyle = mixHex(accent, '#ffffff', 0.45);
  ctx.fillRect(cx - faceWidth / 2, panelTop - 3, faceWidth, 3);

  /* --- three spec cells inside the ink panel --- */
  const cells = [
    ['CAFFEINE', `${product.caffeine} MG`],
    ['SUGAR', product.sugar === 0 ? 'ZERO' : `${product.sugar} G`],
    ['NET', '355 ML'],
  ];
  const cellW = faceWidth / 3;
  const cellY = panelTop + 74;
  cells.forEach(([label, value], i) => {
    const x = cx - faceWidth / 2 + cellW * (i + 0.5);
    ctx.fillStyle = accent;
    setFont(ctx, { weight: 600, size: 19, family: 'Inter Variable' });
    tracked(ctx, label, x, cellY, 6);
    ctx.fillStyle = PAPER;
    setFont(ctx, { weight: 700, size: 44, family: 'Archivo Variable', stretch: 'condensed' });
    tracked(ctx, value, x, cellY + 52, 1);
    if (i > 0) {
      ctx.fillStyle = 'rgba(246,243,238,0.16)';
      ctx.fillRect(cx - faceWidth / 2 + cellW * i, cellY - 30, 1, 90);
    }
  });

  /* --- the small print nobody reads but every real can carries --- */
  ctx.fillStyle = 'rgba(246,243,238,0.5)';
  setFont(ctx, { weight: 500, size: 17, family: 'Inter Variable' });
  tracked(ctx, 'SPARKLING ENERGY DRINK  ·  L-THEANINE  ·  ELECTROLYTES', cx, panelTop + 178, 3);
  ctx.fillStyle = 'rgba(246,243,238,0.32)';
  setFont(ctx, { weight: 400, size: 14, family: 'Inter Variable' });
  tracked(ctx, `${BRAND.legal.toUpperCase()}  ·  ${BRAND.city}  ·  ${BRAND.domain}`, cx, panelTop + 208, 2);
}

/** A vertical strip of print detail dropped on the seam side of the can. */
function paintSeamPanel(ctx, cx, product, rng) {
  const top = PRINT_TOP;
  ctx.save();
  ctx.fillStyle = 'rgba(246,243,238,0.55)';

  // barcode — irregular bar widths, like the real thing
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
  ctx.fillText('8 41902 00' + product.index + ' 4', cx, by + bcH + 24);

  // a recycling glyph, drawn rather than stamped from a font
  ctx.strokeStyle = 'rgba(246,243,238,0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  const ry = top + PRINT_H * 0.42;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
    const a2 = a + (Math.PI * 2) / 3.6;
    ctx.moveTo(cx + Math.cos(a) * 26, ry + Math.sin(a) * 26);
    ctx.arc(cx, ry, 26, a, a2);
  }
  ctx.stroke();

  ctx.fillStyle = 'rgba(246,243,238,0.55)';
  setFont(ctx, { weight: 600, size: 17, family: 'Inter Variable' });
  tracked(ctx, 'ALU 41', cx, ry + 62, 4);
  tracked(ctx, 'BEST BEFORE', cx, top + PRINT_H * 0.2, 4);
  ctx.fillStyle = 'rgba(246,243,238,0.35)';
  setFont(ctx, { weight: 400, size: 15, family: 'Inter Variable' });
  tracked(ctx, 'SEE BASE OF CAN', cx, top + PRINT_H * 0.2 + 26, 2);
  ctx.restore();
}

/**
 * The printed sleeve for one flavour. Only the colour changes between SKUs, so
 * this is the only sheet that gets rebuilt when you switch can — the surface
 * maps below are shared by all six.
 */
export function paintColourSheet(product) {
  const rng = seeded(seedFrom(product.id));
  const { canvas, ctx: c } = surface(BODY_W, BODY_H);

  // Bare aluminium above and below the sleeve.
  c.fillStyle = '#C9CDD2';
  c.fillRect(0, 0, BODY_W, BODY_H);

  // The printed field: a slow vertical shift keeps it from reading as flat fill.
  const field = c.createLinearGradient(0, PRINT_TOP, 0, PRINT_BOTTOM);
  field.addColorStop(0, mixHex(product.accent, '#ffffff', 0.1));
  field.addColorStop(0.42, product.accent);
  field.addColorStop(1, product.accentDeep);
  c.fillStyle = field;
  c.fillRect(0, PRINT_TOP, BODY_W, PRINT_H);

  // Faint vertical rule grid — structure you feel more than see.
  c.save();
  c.globalAlpha = 0.05;
  c.fillStyle = '#ffffff';
  for (let x = 0; x < BODY_W; x += 32) c.fillRect(x, PRINT_TOP, 1, PRINT_H);
  c.restore();

  // Two identical faces a half-turn apart, so one always faces the camera.
  paintFace(c, BODY_W * 0.25, product, BODY_W * 0.42);
  paintFace(c, BODY_W * 0.75, product, BODY_W * 0.42);
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
 * varnish over the print, and the condensation that makes the whole thing read
 * as cold. Roughness goes in green and metalness in blue, the standard packing,
 * so both maps cost one texture.
 */
export function paintSurfaceSheets({ droplets = true, beadCount = 620 } = {}) {
  const rng = seeded(0x5eed1234);
  const orm = surface(BODY_W, BODY_H);
  const nrm = surface(BODY_W, BODY_H);
  const r = orm.ctx;
  const n = nrm.ctx;

  // Base: polished aluminium everywhere, fully metallic.
  r.fillStyle = 'rgb(255,46,255)'; // G = roughness 0.18, B = metalness 1.0
  r.fillRect(0, 0, BODY_W, BODY_H);
  // The sleeve: duller varnish, and ink knocks the metalness back a little.
  r.fillStyle = 'rgb(255,77,143)';
  r.fillRect(0, PRINT_TOP, BODY_W, PRINT_H);

  // Circumferential brushing on the exposed metal bands.
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
      // Bias condensation toward the lower half, the way it actually forms.
      const t = Math.pow(rng(), 0.6);
      const y = PRINT_TOP + 30 + t * (PRINT_H - 60);
      const x = rng() * BODY_W;
      const size = 5 + Math.pow(rng(), 2.4) * 30;
      n.drawImage(sprite, x - size / 2, y - size / 2, size, size);
      // Water is smoother than the varnish beneath it.
      r.save();
      r.globalAlpha = 0.85;
      r.fillStyle = 'rgb(255,13,120)';
      r.beginPath();
      r.arc(x, y, size / 2, 0, Math.PI * 2);
      r.fill();
      r.restore();
    }
    // A handful of beads that have started to run. The stamps are stepped at a
    // fraction of their own width and wander a little, so the trail reads as
    // one continuous rivulet rather than a column of separate drops.
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
        // Narrow toward the tail, the way surface tension actually leaves it.
        const s = w * (1 - Math.pow(k / len, 1.5) * 0.62);
        x += wander;
        n.drawImage(sprite, x - s / 2, y + k - s / 2, s, s);
        r.rect(x - s / 2, y + k, s, w * 0.2);
      }
      r.fill();
      r.restore();
      // The bead still sitting at the head of the trail.
      const head = w * 1.35;
      n.drawImage(sprite, x - head / 2, y + len - head / 2, head, head);
    }
  }

  return { orm: orm.canvas, normal: nrm.canvas };
}

/* ------------------------------------------------------------------ *
 * the lid
 * ------------------------------------------------------------------ */

/** Top of the can, drawn in plan view: brushing, score line, rivet, embossing. */
export function paintLidSheets() {
  const S = 1024;
  const col = surface(S, S);
  const rgh = surface(S, S);
  const c = col.ctx;
  const r = rgh.ctx;
  const mid = S / 2;

  c.fillStyle = '#B9BEC4';
  c.fillRect(0, 0, S, S);

  // Concentric turning marks left by the stamping die.
  c.save();
  for (let i = 0; i < 320; i++) {
    const rad = (i / 320) * mid;
    c.strokeStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.05})`;
    c.lineWidth = 0.6 + Math.random() * 1.6;
    c.beginPath();
    c.arc(mid, mid, rad, 0, Math.PI * 2);
    c.stroke();
  }
  c.restore();

  // Countersink ring where the lid steps down.
  c.strokeStyle = 'rgba(70,76,84,0.5)';
  c.lineWidth = 26;
  c.beginPath();
  c.arc(mid, mid, mid * 0.9, 0, Math.PI * 2);
  c.stroke();

  // Score line for the opening — the teardrop shape, offset from centre.
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

  // Rivet that holds the tab.
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

  // Faint embossed lot code around the rim.
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
    const rad = (i / 260) * mid;
    r.strokeStyle = `rgba(255,255,255,${Math.random() * 0.12})`;
    r.lineWidth = 1 + Math.random() * 2;
    r.beginPath();
    r.arc(mid, mid, rad, 0, Math.PI * 2);
    r.stroke();
  }
  r.restore();

  return { colour: col.canvas, roughness: rgh.canvas };
}

export const CAN_SHEET = { width: BODY_W, height: BODY_H, printTop: PRINT_TOP, printBottom: PRINT_BOTTOM };
