/**
 * The 3D can — the only part of the site nothing was measuring, and the part
 * that broke three times in one day. Every failure was found by eye, days
 * apart, by somebody complaining:
 *
 *   1. The captured studio washed the print out — the label went pale on the
 *      lit side.
 *   2. The correction was aimed at the ink, so the colour came out garish.
 *   3. The real cause was that the can was lit from everywhere at once — broad
 *      environment, hemisphere fill, two strong rims — so it had no light side
 *      and no dark side and read flat. One rim was the product's own accent at
 *      full saturation, which pushes the ink past its own colour.
 *
 * So this file measures a frozen frame of the hero can and asserts on numbers:
 * that the can is there at all, that the print keeps its colour, that the key
 * light still models the form, and that nothing is blown out. It does it for
 * two flavours, because a lighting change can help one and ruin another.
 *
 * How the frame is frozen — all of this matters, and getting any of it wrong
 * produces confident nonsense:
 *
 *   - `stage.stop()` halts the render loop. The camera rig floats and the
 *     scroll settles differently every run, so the camera, the fov, the can's
 *     spin, the exposure and the accent power are all pinned explicitly. With
 *     them pinned the numbers repeat bit for bit between runs.
 *   - Only the can is drawn. The floor, backdrop, dust, sparks, tray and the
 *     three factory scenes — and the factory scenes' own lights, which are
 *     otherwise still in the scene — are switched off, so the pixels measured
 *     are the can's own and the average is not mostly backdrop.
 *   - The frame is rendered to a fixed 640x800 buffer at pixel ratio 1 and read
 *     back with gl.readPixels, so the measurement does not change with the
 *     viewport or the device pixel ratio. The can's own pixels are the ones
 *     with full alpha; the transparent clear is the mask.
 *   - Everything mutated is snapshotted first and restored afterwards, so the
 *     second flavour is not measured through the first one's leftovers.
 *
 * The lighting numbers are averaged in linear light, not in sRGB: sRGB
 * compresses the top of the range hard enough to flatten a real falloff into
 * nothing.
 *
 * The reference numbers in BANDS were measured on this rig on 2026-09-08 under
 * SwiftShader (quality tier "low"). Every measurement is printed as a note on
 * every run, so if a band ever moves for an honest reason the new number is
 * right there.
 */
import { withPage, BASE, report } from './harness.mjs';

/** Fixed measurement buffer. Independent of viewport and device pixel ratio. */
const W = 640;
const H = 800;

/**
 * Bands. Measured today, then opened up far enough not to be flaky and left
 * tight enough that the regressions above trip them. The evidence for each is
 * in the comment beside it.
 */
const BANDS = {
  // Today 0.3344 of the buffer, identical on every flavour and every run: the
  // can is pinned, so its silhouette is too. An empty or black frame reads 0.
  coverage: [0.2, 0.5],
  // Mean sRGB luminance over the can. Today 78 (Solstice) and 112 (Glacier).
  // A can that renders but is unlit, or whose texture failed to a black
  // material, lands near 0.
  meanLum: 25,
  // Lit side over shadow side, in linear light, across the printed band.
  // Today 1.34 (Solstice) and 1.32 (Glacier), but the label's own art moves it
  // by a few percent per flavour — Vesper reads 1.28 — so this one is the
  // coarse guard on the can as it ships and formNeutral below is the precise
  // one. Restoring the captured studio to 0.09 drops this to 0.99 and 0.16
  // drops it to 0.74: the can stops having a light side at all. The ceiling
  // guards the other direction, where a metal can with no fill goes black on
  // the shadow side.
  form: [1.15, 2.5],
  // The same ratio with the print swapped for neutral grey, which takes the
  // label art out of it: today 1.345 on every flavour, and 1.35 / 1.34 / 1.35
  // on Solstice, Glacier and Vesper, so it can be held tightly. The whole
  // pre-fix fill rig — hemisphere 0.55, rims at 2.1 and 5 — lands under it.
  formNeutral: 1.28,
  // The shadow side still has to be a surface, not a hole. Today 0.12 / 0.19.
  shadowFloor: 0.03,
  // Share of the can at or near pure white. Today 0.0002. The captured studio
  // at full strength puts it at 0.035.
  blown: 0.005,
  // Mean HSV saturation over the can's own pixels, per flavour: today's number
  // +/-15%. A wash drags it down (Solstice 0.64 -> 0.50 with the environment
  // back at 0.16), a neon shift drags it up.
  saturation: {
    solstice: [0.545, 0.737], // measured 0.6407
    glacier: [0.454, 0.614], // measured 0.5335
  },
  // "Rims stay pale" — CLAUDE.md. A lamp in the product's own accent at full
  // saturation pushes the ink past its own colour, and that is a defect you
  // cannot see in a frame-wide average: the rim is a thin band on the
  // silhouette, and putting Solstice's raw accent back on it moves the mean
  // saturation by 1.2%. So this one is asserted on the rig.
  //
  // Solstice's accent is a 0.98-saturation orange and Glacier's a 0.87 cyan.
  // The tint the rig is supposed to use is the accent mixed 72% into white,
  // which measures 0.27 and 0.21. The most saturated thing the rig
  // legitimately runs is the cool rim at 0.37, so 0.55 sits clear of both
  // sides.
  //
  // Judged only on lamps bright enough to deliver light: the hemisphere fill
  // is 0x2a3040, whose hue is technically 0.55-saturated but which is so close
  // to black (0.05 in linear light) that it cannot dye anything.
  lightSaturation: 0.55,
  lightValue: 0.2,
};

/** The two flavours checked. A change can help one and ruin another. */
const FLAVOURS = ['solstice', 'glacier'];

/* ------------------------------------------------------------------ *
 * the measurement, run inside the page
 * ------------------------------------------------------------------ */

/**
 * Freeze the frame, draw the can alone into a fixed buffer, read the pixels
 * back and reduce them to numbers. Restores every piece of state it touches.
 */
function measureCan({ width, height, neutral }) {
  const stage = globalThis.__kestraStage;
  if (!stage) throw new Error('stage probe missing — load the page with ?stage-probe=1');
  const { THREE, renderer, scene, camera, can, canPivot, rig } = stage;

  stage.stop();

  const body = can.userData.materials.body;
  const lights = [];
  scene.traverse((o) => o.isLight && lights.push(o));
  const size = new THREE.Vector2();
  renderer.getSize(size);

  const snap = {
    ratio: renderer.getPixelRatio(),
    w: size.x,
    h: size.y,
    exposure: renderer.toneMappingExposure,
    aspect: camera.aspect,
    fov: camera.fov,
    pos: camera.position.clone(),
    quat: camera.quaternion.clone(),
    spin: canPivot.rotation.clone(),
    rigScale: rig.scale.clone(),
    rigPos: rig.position.clone(),
    map: body.map,
    colour: body.color.clone(),
    intensity: lights.map((l) => l.intensity),
    visible: new Map(),
  };
  scene.traverse((o) => snap.visible.set(o, o.visible));

  const toLinear = (c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };

  let out = null;
  try {
    /* ---- the can, and nothing else ---- */
    for (const child of scene.children) if (!child.isLight) child.visible = false;
    rig.visible = true;
    // The contact-shadow sprite and the floor reflection hang off the rig and
    // the pivot; neither is the can.
    rig.traverse((o) => o !== rig && (o.visible = false));
    canPivot.visible = true;
    can.traverse((o) => (o.visible = true));

    /* ---- pin everything that floats ---- */
    rig.scale.setScalar(1);
    rig.position.set(0, 0, 0);
    // A quarter turn back brings a printed face square to camera, the same
    // way stage.capture() frames the shop photography.
    canPivot.rotation.set(0, -Math.PI / 2, 0);
    // The director scales the rims by scroll position. 1 is their declared
    // strength, so a change to the declared strength still shows up here.
    stage.setAccentPower(1);
    // The lighting-only pass. The printed sleeve is not flat: its own art is
    // lighter on one side than the other, which moves the lit-over-shadow
    // ratio by a few percent from flavour to flavour and forces a loose floor.
    // Swap the print for a neutral grey and the same ratio becomes a pure
    // measurement of the rig — 1.35, 1.34, 1.35 on Solstice, Glacier and
    // Vesper — which can be held to a tight one.
    if (neutral) {
      body.map = null;
      body.color.set(0x808080);
      body.needsUpdate = true;
    }

    renderer.toneMappingExposure = 1;
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = 23;
    camera.position.set(0, 0.9, 4.6);
    camera.lookAt(0, 0.75, 0);
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);

    const gl = renderer.getContext();
    const buf = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buf);

    /* ---- the can's own pixels ---- */
    let minX = width;
    let maxX = -1;
    let minY = height;
    let maxY = -1;
    let px = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Full alpha only, so the antialiased silhouette — whose colour is
        // premultiplied against the clear and therefore darkened — is out.
        if (buf[(y * width + x) * 4 + 3] < 250) continue;
        px++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (!px) {
      return { px: 0, coverage: 0, tier: stage.quality.tier, empty: true };
    }

    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    // The printed band, away from the lid and the base, where the label is.
    const top = minY + bh * 0.1;
    const bottom = minY + bh * 0.7;

    const cols = new Float64Array(bw);
    const colN = new Float64Array(bw);
    let lum = 0;
    let sat = 0;
    let satN = 0;
    let blown = 0;
    let r = 0;
    let g = 0;
    let b = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (buf[i + 3] < 250) continue;
        const R = buf[i];
        const G = buf[i + 1];
        const B = buf[i + 2];
        r += R;
        g += G;
        b += B;
        lum += 0.2126 * R + 0.7152 * G + 0.0722 * B;
        const mx = Math.max(R, G, B);
        const mn = Math.min(R, G, B);
        // Saturation is meaningless in the near-black, and averaging it there
        // is just averaging noise.
        if (mx >= 24) {
          sat += (mx - mn) / mx;
          satN++;
        }
        if (mn >= 246) blown++;
        if (y >= top && y <= bottom) {
          const c = x - minX;
          cols[c] += 0.2126 * toLinear(R) + 0.7152 * toLinear(G) + 0.0722 * toLinear(B);
          colN[c]++;
        }
      }
    }

    const profile = Array.from(cols, (v, i) => (colN[i] ? v / colN[i] : 0));
    const band = (a, z) => {
      let total = 0;
      let n = 0;
      for (let i = Math.floor(bw * a); i < Math.floor(bw * z); i++) {
        total += profile[i];
        n++;
      }
      return n ? total / n : 0;
    };
    // The key is at -x, and the camera looks down -z with +x to the right, so
    // the key side of the can is the left of the frame.
    const lit = band(0.08, 0.38);
    const shadow = band(0.62, 0.92);

    /* ---- the rig itself ---- */
    const rigLights = scene.children.filter((o) => o.isLight).map((l) => {
      const c = l.color;
      const mx = Math.max(c.r, c.g, c.b);
      const mn = Math.min(c.r, c.g, c.b);
      return {
        type: l.type,
        hex: `#${c.getHexString()}`,
        intensity: +l.intensity.toFixed(3),
        saturation: mx > 0 ? +((mx - mn) / mx).toFixed(3) : 0,
        // Colours reach three.js already in linear working space, so this is
        // how much light the lamp actually carries.
        value: +mx.toFixed(3),
      };
    });

    /* ---- geometry and textures, where a NaN or a failed load hides ---- */
    let nonFinite = 0;
    let vertices = 0;
    can.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      for (const name of ['position', 'normal']) {
        const attr = o.geometry.attributes[name];
        if (!attr) continue;
        if (name === 'position') vertices += attr.count;
        const a = attr.array;
        for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) nonFinite++;
      }
    });

    out = {
      tier: stage.quality.tier,
      px,
      coverage: px / (width * height),
      meanLum: lum / px,
      meanRGB: [r / px, g / px, b / px],
      saturation: satN ? sat / satN : 0,
      blown: blown / px,
      lit,
      shadow,
      form: shadow > 1e-6 ? lit / shadow : 0,
      triangles: renderer.info.render.triangles,
      calls: renderer.info.render.calls,
      vertices,
      nonFinite,
      envIntensity: body.envMapIntensity,
      hasEnvMap: !!body.envMap,
      hasColourMap: !!(body.map && body.map.image && body.map.image.width > 0),
      lights: rigLights,
    };
  } finally {
    snap.visible.forEach((v, o) => (o.visible = v));
    lights.forEach((l, i) => (l.intensity = snap.intensity[i]));
    rig.scale.copy(snap.rigScale);
    rig.position.copy(snap.rigPos);
    canPivot.rotation.copy(snap.spin);
    if (neutral) {
      body.map = snap.map;
      body.color.copy(snap.colour);
      body.needsUpdate = true;
    }
    renderer.toneMappingExposure = snap.exposure;
    renderer.setPixelRatio(snap.ratio);
    renderer.setSize(snap.w, snap.h, false);
    camera.aspect = snap.aspect;
    camera.fov = snap.fov;
    camera.position.copy(snap.pos);
    camera.quaternion.copy(snap.quat);
    camera.updateProjectionMatrix();
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * the check
 * ------------------------------------------------------------------ */

const f2 = (n) => (Math.round(n * 100) / 100).toFixed(2);
const f3 = (n) => (Math.round(n * 1000) / 1000).toFixed(3);
const f4 = (n) => (Math.round(n * 10000) / 10000).toFixed(4);

export default async function render() {
  const failures = [];
  const notes = [];

  await withPage({ viewport: 'desktop' }, async (page, errors) => {
    // The stage keeps no handle on itself unless it is asked for one. Reload
    // with the opt-in so the frame can be frozen and read back.
    await page.goto(`${BASE}?stage-probe=1`, { waitUntil: 'load' });
    await page.waitForFunction(() => !!globalThis.__kestraStage, { timeout: 300000 });

    // The intro runs on wall clock and under software rendering that is slow.
    // Any key press skips it; the rail only drives the stage once the director
    // has handed off to the live page.
    for (let i = 0; i < 60; i++) {
      if (await page.evaluate(() => document.body.classList.contains('is-live'))) break;
      await page.keyboard.press('Escape');
      await page.waitForTimeout(700);
    }
    if (!(await page.evaluate(() => document.body.classList.contains('is-live')))) {
      failures.push('the intro never handed off to the live page');
      return;
    }
    // The captured studio loads off the critical path, and it is most of what
    // the print is lit by. Measuring before it lands measures a different can.
    await page.waitForFunction(
      () => !!globalThis.__kestraStage?.can?.userData?.materials?.body?.envMap,
      { timeout: 120000 }
    );
    await page.evaluate(() => document.getElementById('hero').scrollIntoView());
    await page.waitForTimeout(1500);

    const seen = {};
    for (const id of FLAVOURS) {
      // Through the rail, in this one page load: reloading for each flavour
      // costs another software-rendered intro, and the rail is how a visitor
      // changes the can anyway.
      const clicked = await page.evaluate((f) => {
        const btn = document.querySelector(`[data-flavour-rail] button[data-flavour="${f}"]`);
        if (!btn) return false;
        btn.click();
        return true;
      }, id);
      if (!clicked) {
        failures.push(`[${id}] no rail button for this flavour`);
        continue;
      }
      // The swap is covered by a bloom flash that lasts 420ms and resets the
      // exposure, the bloom and the accent power when it finishes.
      await page.waitForTimeout(1200);

      const m = await page.evaluate(measureCan, { width: W, height: H });
      seen[id] = m;
      // A second frozen frame with the print replaced by neutral grey, so the
      // rig can be measured without the label's own art in the average.
      const grey = await page.evaluate(measureCan, { width: W, height: H, neutral: true });

      /* ---- it renders at all ---- */
      if (!m.px) {
        failures.push(`[${id}] the can is not in the frame at all — 0 pixels of it`);
        continue;
      }
      notes.push(
        `${id}: coverage ${f4(m.coverage)}  lum ${f2(m.meanLum)}  sat ${f4(m.saturation)}  ` +
          `lit ${f4(m.lit)} / shadow ${f4(m.shadow)} = form ${f3(m.form)}  ` +
          `blown ${f4(m.blown)}`
      );
      notes.push(
        `${id}: tier ${m.tier}  ${m.triangles} triangles in ${m.calls} draws  ` +
          `${m.vertices} vertices  env ${m.envIntensity}`
      );

      const [covLo, covHi] = BANDS.coverage;
      if (m.coverage < covLo || m.coverage > covHi) {
        failures.push(
          `[${id}] the can covers ${f4(m.coverage)} of the frame, outside ${covLo}-${covHi} — ` +
            'the frame is empty, or the geometry is not where it should be'
        );
      }
      if (m.nonFinite) {
        failures.push(`[${id}] ${m.nonFinite} non-finite values in the can's geometry buffers`);
      }
      if (!m.triangles) failures.push(`[${id}] nothing was drawn: 0 triangles`);
      if (!m.hasColourMap) failures.push(`[${id}] the printed sleeve texture is missing or empty`);
      if (!m.hasEnvMap) {
        failures.push(`[${id}] the captured studio never reached the body material`);
      }
      if (m.meanLum < BANDS.meanLum) {
        failures.push(
          `[${id}] the can is black: mean luminance ${f2(m.meanLum)}, floor ${BANDS.meanLum}`
        );
      }

      /* ---- the print keeps its colour ---- */
      const [satLo, satHi] = BANDS.saturation[id];
      if (m.saturation < satLo) {
        failures.push(
          `[${id}] the print is washed out: mean saturation ${f4(m.saturation)} below ${satLo} ` +
            '(the lit side is being flooded — check the body envMapIntensity)'
        );
      } else if (m.saturation > satHi) {
        failures.push(
          `[${id}] the print has gone garish: mean saturation ${f4(m.saturation)} above ${satHi}`
        );
      }

      /* ---- the can has form ---- */
      const [formLo, formHi] = BANDS.form;
      if (m.form < formLo) {
        failures.push(
          `[${id}] the can is flat: lit side ${f4(m.lit)} over shadow side ${f4(m.shadow)} is ` +
            `${f3(m.form)}, below ${formLo}. It is being lit from everywhere at once, so it has ` +
            'no light side and no dark side'
        );
      } else if (m.form > formHi) {
        failures.push(
          `[${id}] the shadow side has collapsed: form ${f3(m.form)} above ${formHi}`
        );
      }
      notes.push(
        `${id}: neutral albedo  lit ${f4(grey.lit)} / shadow ${f4(grey.shadow)} = ` +
          `form ${f3(grey.form)}`
      );
      if (grey.form < BANDS.formNeutral) {
        failures.push(
          `[${id}] the rig has stopped modelling the can: with the print replaced by neutral ` +
            `grey the lit side is only ${f3(grey.form)}x the shadow side, below ` +
            `${BANDS.formNeutral}. The fill is erasing the falloff the key creates`
        );
      }
      if (m.shadow < BANDS.shadowFloor) {
        failures.push(
          `[${id}] the shadow side is a hole, not a surface: ${f4(m.shadow)} below ` +
            `${BANDS.shadowFloor}`
        );
      }

      /* ---- nothing is blown out ---- */
      if (m.blown > BANDS.blown) {
        failures.push(
          `[${id}] ${(m.blown * 100).toFixed(2)}% of the can is at or near pure white, over ` +
            `${(BANDS.blown * 100).toFixed(2)}%`
        );
      }

      /* ---- the rims stay pale ---- */
      // Lighting the can with a lamp in the product's own accent pushes the ink
      // past its own colour. This reads the rig rather than the pixels because
      // the rim is a thin band on the silhouette: it is plainly garish to look
      // at and barely moves a frame-wide average.
      for (const l of m.lights) {
        if (l.intensity <= 0 || l.value < BANDS.lightValue) continue;
        if (l.saturation > BANDS.lightSaturation) {
          failures.push(
            `[${id}] the can is lit by ${l.hex}, a ${f2(l.saturation)}-saturation ${l.type} at ` +
              `intensity ${l.intensity} (ceiling ${BANDS.lightSaturation}). Lighting the can in ` +
              'its own accent pushes the ink past its own colour — rims stay pale'
          );
        }
      }
      notes.push(
        `${id}: rig ${m.lights
          .map((l) => `${l.hex} i${l.intensity} s${l.saturation} v${l.value}`)
          .join('  ')}`
      );
    }

    /* ---- the flavours are actually different cans ---- */
    // Cheap, and it is what fails if the rail ever stops reaching the sleeve:
    // every flavour would measure identically. Solstice is an orange can and
    // Glacier a cyan one, so red minus blue has to cross zero between them.
    const warm = (m) => m.meanRGB[0] - m.meanRGB[2];
    const s = seen.solstice;
    const g = seen.glacier;
    if (s && g) {
      notes.push(`red-minus-blue: solstice ${f2(warm(s))}, glacier ${f2(warm(g))}`);
      if (!(warm(s) > 8 && warm(g) < -8)) {
        failures.push(
          `the rail is not reaching the sleeve: solstice reads ${f2(warm(s))} red-over-blue and ` +
            `glacier ${f2(warm(g))}, and an orange can and a cyan one cannot both be that colour`
        );
      }
    }

    failures.push(...errors.map((e) => `[console] ${e}`));
  });

  return report('render', failures, notes);
}
