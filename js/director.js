/**
 * Camera direction for the whole site.
 *
 * The intro and the store are not two scenes — they are one continuous shot.
 * The same canvas, camera and can that finish the opening sequence become the
 * hero of the storefront, and then keep going: the can travels the page,
 * section by section, and turns into the twelve-pack when the page reaches the
 * pack builder. There is never a swap or a fade to a poster.
 */

import * as THREE from 'three';

const ease = {
  smooth: (t) => t * t * (3 - 2 * t),
  smoother: (t) => t * t * t * (t * (t * 6 - 15) + 10),
  outExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -9 * t)),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => {
    const c = 1.24;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  },
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/* ------------------------------------------------------------------ *
 * the opening shot list
 * ------------------------------------------------------------------ */

const SHOTS = [
  {
    // Macro. We open inside the condensation, before there is enough light to
    // read what the object even is.
    t: 0,
    pos: [0.36, 0.58, 0.44],
    target: [0, 0.649, 0],
    fov: 56, spin: 0, exposure: 0.18, dust: 0, burst: 0, bloom: 0.2, accent: 0.25,
    focus: 0.42, aperture: 0.0026, sweep: 0,
    curve: 'smooth',
  },
  {
    // Light comes up across the surface and the beads catch it.
    t: 1.5,
    pos: [0.52, 0.74, 0.62],
    target: [0, 0.733, 0],
    fov: 52, spin: 0.85, exposure: 1.02, dust: 0.3, burst: 0, bloom: 0.34, accent: 0.7,
    focus: 0.56, aperture: 0.0016, sweep: 0.26,
    curve: 'inOutCubic',
  },
  {
    // Pull back through the shoulder; the silhouette resolves.
    t: 3.1,
    pos: [1.35, 1.28, 1.95],
    target: [0, 0.523, 0],
    fov: 44, spin: 3.4, exposure: 1.1, dust: 0.62, burst: 0.15, bloom: 0.4, accent: 1.25,
    focus: 1.95, aperture: 0.0008, sweep: 0.52,
    curve: 'inOutCubic',
  },
  {
    // Ignition beat.
    t: 4.25,
    pos: [2.05, 1.0, 3.15],
    target: [0, 0.587, 0],
    fov: 38, spin: 7.3, exposure: 1.14, dust: 0.78, burst: 1, bloom: 0.62, accent: 1.5,
    focus: 3.15, aperture: 0.00035, sweep: 0.74,
    curve: 'outExpo',
  },
  {
    // Settle into the framing the storefront inherits. Two full turns, landing
    // with a printed face square on: the sleeve is drawn twice per revolution
    // and u = 0.25 sits on +X, so the settle is a quarter turn short.
    t: 6.2,
    pos: [0.944, 0.992, 4.604],
    target: [0, 0.774, 0],
    fov: 30, spin: Math.PI * 4 - Math.PI / 2, exposure: 1.0, dust: 0.42, burst: 0, bloom: 0.2, accent: 1,
    focus: 4.4, aperture: 0.00004, sweep: 1,
    curve: 'outBack',
  },
];

const DURATION = SHOTS[SHOTS.length - 1].t;
// How far into the shot list a portrait screen starts (seconds). The macro
// opening runs to t=4.25 and only reads as a can once it starts pulling back,
// so portrait joins during the pull-back and gets a 3.4s intro, not 6.2s.
const INTRO_SKIP_IN = 2.8;

const CUES = [
  { t: 0.35, name: 'wake' },
  { t: 1.9, name: 'name' },
  { t: 3.4, name: 'claim' },
  { t: 4.35, name: 'flash' },
  { t: 5.65, name: 'handoff' },
];

/* ------------------------------------------------------------------ *
 * scroll stations
 *
 * Each is anchored to a section. The camera lerps between whichever two the
 * page currently sits across, so the can is continuously choreographed rather
 * than snapping between states.
 * ------------------------------------------------------------------ */

const STATIONS = [
  {
    // Scene 1. Descending into the vessel, then drifting across the surface
    // as it fills. The camera never stops moving and never orbits a subject.
    id: 'mix',
    selector: '#scene-mix',
    at: 0.5,
    scene: 'mix',
    // Starts wide enough to read the tank as a tank, then tips over the rim
    // toward the surface as it fills. Never inside the vessel looking at fog.
    from: { pos: [6.6, 8.2, 8.4], target: [-0.4, 3.1, 0] },
    via: { pos: [6.4, 5.5, 6.6], target: [-0.4, 2.5, -0.2] },
    pos: [4.4, 5.15, 6.2],
    target: [-0.4, 1.9, -0.5],
    fov: 38, offsetX: 1.0, spin: 0, dust: 0, exposure: 0.94, pack: 0, opacity: 1, accent: 0,
    mDist: 2.4, mLift: -1.05,
  },
  {
    // Scene 2. A slow lateral track along the filling line, the way a plant
    // is actually filmed: parallel to the machine, not circling it.
    id: 'fill',
    selector: '#scene-fill',
    at: 0.5,
    scene: 'fill',
    // A slow lateral track along the line, far enough back that whole cans
    // stay in frame — a cropped can cannot show off the thing it is here for.
    from: { pos: [-4.4, 1.85, 4.3], target: [-1.5, 0.753, 0] },
    pos: [4.4, 1.7, 4.3],
    target: [1.4, 0.753, 0],
    fov: 33, offsetX: -1.45, spin: 0, dust: 0, exposure: 1.0, pack: 0, opacity: 1, accent: 0,
    mDist: 1.5, mLift: -0.6,
  },
  {
    // Scene 3. Low and close to the belt, riding with the cans, then lifting
    // to find the tray at the end of the line.
    id: 'packing',
    selector: '#scene-pack',
    at: 0.5,
    scene: 'packing',
    // Rides low beside the belt, then overtakes the line and comes round to
    // find the tray filling at the end of it. One continuous dolly, no cuts.
    from: { pos: [4.9, 1.02, -5.4], target: [0, 0.649, -1.0] },
    // The arc keeps the lens outside the line instead of ploughing through it.
    via: { pos: [6.6, 1.5, 3.4], target: [0, 0.628, 4.2] },
    pos: [4.8, 3.4, 15.2],
    target: [0, 0.628, 8.9],
    fov: 31, offsetX: 1.9, spin: 0, dust: 0, exposure: 0.98, pack: 0, opacity: 1, accent: 0,
    mDist: 1.45, mLift: -0.8,
  },
  {
    // Scene 4. Out of the plant and back into the studio: a slow push-in on
    // the finished can that hands straight over to the store's own hero.
    id: 'reveal',
    selector: '#scene-reveal',
    at: 0.5,
    from: { pos: [2.456, 1.782, 5.336], target: [0, 0.879, 0] },
    via: { pos: [2.090, 0.992, 4.296], target: [0, 0.837, 0] },
    pos: [1.050, 0.732, 3.506],
    target: [0, 0.817, 0],
    fov: 33, offsetX: -0.95, spin: 0.12, dust: 0.5, exposure: 1.06, pack: 0, opacity: 1, accent: 1.3,
    mDist: 1.34, mLift: -0.4,
  },
  {
    id: 'hero',
    selector: '#hero',
    at: 0.25, // fraction into the section where this station is fully reached
    pos: [0.944, 0.992, 4.604],
    target: [0, 0.774, 0],
    fov: 30, offsetX: 0.86, spin: 0.085, dust: 0.42, exposure: 1.04, pack: 0, opacity: 1, accent: 1,
    mDist: 1.14, mLift: -0.46,
  },
  {
    id: 'shop',
    selector: '#shop',
    at: 0.1,
    // The cards carry the product imagery here, so the can steps back and up.
    pos: [1.570, 1.984, 6.492],
    target: [0, 1.570, 0],
    fov: 30, offsetX: 0.2, spin: 0.05, dust: 0.2, exposure: 0.9, pack: 0, opacity: 0, accent: 0.7,
    mDist: 1.2, mLift: -0.3,
  },
  {
    id: 'pack',
    selector: '#mix',
    at: 0.34,
    // Raised three-quarter, looking down into the tray. The tray is 2.5 across,
    // so this sits much further back than the single-can shots.
    pos: [2.620, 3.333, 6.184],
    target: [0, 0.471, 0],
    fov: 32, offsetX: 1.34, spin: 0.05, dust: 0.28, exposure: 0.96, pack: 1, opacity: 1, accent: 0.85,
    // The tray is far wider than a can, so narrow screens need it much further back.
    mDist: 1.9, mLift: 0.34,
  },
  {
    id: 'formula',
    selector: '#formula',
    at: 0.28,
    // Back to a single can, tight and slowly turning, opposite the copy.
    pos: [0.751, 0.944, 4.084],
    target: [0, 0.774, 0],
    fov: 28, offsetX: 0.92, spin: 0.1, dust: 0.34, exposure: 1.02, pack: 0, opacity: 1, accent: 1.15,
    mDist: 1.3, mLift: -0.42,
  },
  {
    id: 'exit',
    selector: '#reviews',
    at: 0.15,
    pos: [0.944, 1.570, 5.856],
    target: [0, 1.256, 0],
    fov: 30, offsetX: -0.3, spin: 0.06, dust: 0.1, exposure: 0.85, pack: 0, opacity: 0, accent: 0.6,
    mDist: 1.2, mLift: -0.3,
  },
];

const LERPED = ['fov', 'offsetX', 'spin', 'dust', 'exposure', 'pack', 'opacity', 'accent', 'mDist', 'mLift'];

/* ------------------------------------------------------------------ *
 * director
 * ------------------------------------------------------------------ */

export function createDirector(stage, { onCue, onFinish, onVisual, onStation } = {}) {
  const { camera } = stage;

  const positionCurve = new THREE.CatmullRomCurve3(
    SHOTS.map((s) => new THREE.Vector3(...s.pos)), false, 'catmullrom', 0.35
  );
  const targetCurve = new THREE.CatmullRomCurve3(
    SHOTS.map((s) => new THREE.Vector3(...s.target)), false, 'catmullrom', 0.35
  );

  const scratchPos = new THREE.Vector3();
  const scratchTarget = new THREE.Vector3();

  let phase = 'idle';
  let elapsed = 0;
  let startedAt = 0;
  let firedCues = new Set();
  let finishResolve = null;

  /* ---------------- intro ---------------- */

  function sampleShot(time) {
    const clamped = Math.max(0, Math.min(DURATION, time));
    let i = 0;
    while (i < SHOTS.length - 2 && clamped >= SHOTS[i + 1].t) i++;
    const a = SHOTS[i];
    const b = SHOTS[i + 1];
    const span = b.t - a.t;
    const local = span > 0 ? (clamped - a.t) / span : 1;
    const e = (ease[b.curve] || ease.smooth)(clamp01(local));
    const u = (i + e) / (SHOTS.length - 1);
    const mix = (k) => a[k] + (b[k] - a[k]) * e;

    positionCurve.getPoint(u, scratchPos);
    targetCurve.getPoint(u, scratchTarget);
    return {
      position: scratchPos, target: scratchTarget,
      fov: mix('fov'), spin: mix('spin'), exposure: mix('exposure'),
      dust: mix('dust'), burst: mix('burst'), bloom: mix('bloom'), accent: mix('accent'),
      focus: mix('focus'), aperture: mix('aperture'), sweep: mix('sweep'),
    };
  }

  /**
   * The scroll stations each carry a narrow-screen distance, but the intro was
   * driving the camera straight from its shot list, so a phone played the
   * desktop framing on a viewport less than half as wide and the subject ran
   * off both edges. Portrait loses horizontal field, so the camera backs off
   * along its own view axis to put the same amount of can back in frame.
   */
  function introPullback() {
    const aspect = innerWidth / innerHeight;
    if (aspect >= 0.95) return 1;
    return Math.min(1.75, 1 + (0.95 - aspect) * 1.15);
  }

  const introShift = new THREE.Vector3();

  function applyShot(f) {
    const back = introPullback();
    if (back !== 1) {
      introShift.copy(f.position).sub(f.target).multiplyScalar(back).add(f.target);
      camera.position.copy(introShift);
    } else {
      camera.position.copy(f.position);
    }
    camera.lookAt(f.target);
    const wantFov = f.fov + (back !== 1 ? 2 : 0);
    if (Math.abs(camera.fov - wantFov) > 0.001) {
      camera.fov = wantFov;
      camera.updateProjectionMatrix();
    }
    stage.canPivot.rotation.y = f.spin;
    stage.setExposure(f.exposure);
    stage.setDust(f.dust);
    stage.setBurst(f.burst);
    stage.setBloom(f.bloom);
    stage.setAccentPower(f.accent);
    stage.setFocus(f.focus, f.aperture);
    stage.setLightSweep(f.sweep);
  }

  function landImmediately() {
    elapsed = DURATION;
    applyShot(sampleShot(DURATION));
    CUES.forEach((c) => firedCues.add(c.name));
    onCue?.('handoff');
  }

  function finish() {
    if (phase === 'live') return;
    phase = 'live';
    stage.setScene(null, 0);
    stage.setFocus(4.4, 0);
    stage.setLightSweep(1);
    hero.spin = stage.canPivot.rotation.y;
    onFinish?.();
    finishResolve?.();
    finishResolve = null;
  }

  function updateIntro() {
    // Wall clock, not accumulated frame deltas: a slow machine should show a
    // choppier six seconds, never a slower six seconds.
    elapsed = (performance.now() - startedAt) / 1000;
    applyShot(sampleShot(elapsed));
    for (const cue of CUES) {
      if (elapsed >= cue.t && !firedCues.has(cue.name)) {
        firedCues.add(cue.name);
        onCue?.(cue.name);
      }
    }
    if (elapsed >= DURATION) finish();
  }

  /* ---------------- live: scroll stations ---------------- */

  const hero = {
    pointer: { x: 0, y: 0 },
    smoothed: { x: 0, y: 0 },
    spin: SHOTS[SHOTS.length - 1].spin,
    nudge: 0,
  };

  let anchors = [];
  let activeId = 'hero';

  /** Where each station sits in document space. Recomputed on resize. */
  function measure() {
    const mid = innerHeight * 0.5;
    anchors = STATIONS.map((s) => {
      const el = document.querySelector(s.selector);
      if (!el) return { ...s, y: Number.POSITIVE_INFINITY };
      const rect = el.getBoundingClientRect();
      const top = rect.top + scrollY;
      return { ...s, y: Math.max(0, top + rect.height * s.at - mid) };
    }).filter((s) => Number.isFinite(s.y));
    anchors.sort((a, b) => a.y - b.y);
  }

  const framePos = new THREE.Vector3();
  const frameTarget = new THREE.Vector3();
  const scratch = {};

  let sceneId = null;
  let sceneProgress = 0;

  /**
   * A station with a `from` pose is a travelling shot: the camera runs from
   * `from` to its resting pose across the station's own span, so the move
   * belongs to the scene rather than to the gap between scenes.
   */
  function applyTravel(station, local) {
    if (!station.from) return false;
    const e = ease.smooth(clamp01(local));
    const v = station.via;
    if (v) {
      // A straight line between two poses reads as a slide. One control point
      // turns it into an arc, which is what a dolly on a real set describes.
      const a = (1 - e) * (1 - e);
      const b = 2 * (1 - e) * e;
      const c = e * e;
      const bez = (f, t, i) => f[i] * a + v[t][i] * b + station[t][i] * c;
      framePos.set(
        bez(station.from.pos, 'pos', 0),
        bez(station.from.pos, 'pos', 1),
        bez(station.from.pos, 'pos', 2)
      );
      frameTarget.set(
        bez(station.from.target, 'target', 0),
        bez(station.from.target, 'target', 1),
        bez(station.from.target, 'target', 2)
      );
      return true;
    }
    framePos.set(
      station.from.pos[0] + (station.pos[0] - station.from.pos[0]) * e,
      station.from.pos[1] + (station.pos[1] - station.from.pos[1]) * e,
      station.from.pos[2] + (station.pos[2] - station.from.pos[2]) * e
    );
    frameTarget.set(
      station.from.target[0] + (station.target[0] - station.from.target[0]) * e,
      station.from.target[1] + (station.target[1] - station.from.target[1]) * e,
      station.from.target[2] + (station.target[2] - station.from.target[2]) * e
    );
    return true;
  }

  /** Interpolate the two stations the page currently sits between. */
  function sampleStations(y) {
    if (!anchors.length) return null;
    if (y <= anchors[0].y) {
      Object.assign(scratch, anchors[0]);
      sceneId = anchors[0].scene ?? null;
      sceneProgress = 0;
      if (!applyTravel(anchors[0], 0)) {
        framePos.set(...anchors[0].pos);
        frameTarget.set(...anchors[0].target);
      }
      return anchors[0].id;
    }
    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i];
      const b = anchors[i + 1];
      if (y > b.y) continue;
      const span = Math.max(1, b.y - a.y);
      const raw = clamp01((y - a.y) / span);
      const t = ease.smooth(raw);
      for (const k of LERPED) scratch[k] = a[k] + (b[k] - a[k]) * t;

      // While the page is inside a travelling station, that station drives the
      // camera and its scene; the next station only takes over on the handoff.
      if ((a.scene || a.from) && raw < 0.82) {
        sceneId = a.scene;
        sceneProgress = clamp01(raw / 0.82);
        applyTravel(a, sceneProgress);
        return a.id;
      }
      sceneId = raw > 0.82 && b.scene ? b.scene : null;
      sceneProgress = 0;

      framePos.set(
        a.pos[0] + (b.pos[0] - a.pos[0]) * t,
        a.pos[1] + (b.pos[1] - a.pos[1]) * t,
        a.pos[2] + (b.pos[2] - a.pos[2]) * t
      );
      frameTarget.set(
        a.target[0] + (b.target[0] - a.target[0]) * t,
        a.target[1] + (b.target[1] - a.target[1]) * t,
        a.target[2] + (b.target[2] - a.target[2]) * t
      );
      return t < 0.5 ? a.id : b.id;
    }
    const last = anchors[anchors.length - 1];
    Object.assign(scratch, last);
    sceneId = null;
    framePos.set(...last.pos);
    frameTarget.set(...last.target);
    return last.id;
  }

  /**
   * Narrow screens have no room beside the copy, so the subject is centred and
   * pushed back instead of being panned off to one side.
   */
  function layout() {
    const aspect = innerWidth / innerHeight;
    // In Arabic the copy column sits on the right, so the subject has to swap
    // sides with it — the pan is the same distance, mirrored.
    const mirror = document.documentElement.dir === 'rtl' ? -1 : 1;
    if (innerWidth < 900 || aspect < 0.95) {
      // No room beside the copy: the subject is centred, pushed back by the
      // amount this particular station needs, and lifted into its own band.
      const tall = aspect < 0.7 ? 1.08 : 1;
      return { pan: 0, lift: scratch.mLift ?? -0.4, distance: (scratch.mDist ?? 1.15) * tall, fovAdd: 2 };
    }
    return { pan: mirror, lift: 0, distance: 1, fovAdd: 0 };
  }

  const tmp = new THREE.Vector3();
  const tmpTarget = new THREE.Vector3();

  function updateLive(dt) {
    const id = sampleStations(scrollY);
    if (id && id !== activeId) {
      activeId = id;
      onStation?.(id);
    }

    const l = layout();

    // Pointer parallax, heavily damped so it never feels twitchy.
    hero.smoothed.x += (hero.pointer.x - hero.smoothed.x) * Math.min(1, dt * 2.6);
    hero.smoothed.y += (hero.pointer.y - hero.smoothed.y) * Math.min(1, dt * 2.6);

    // offsetX pans camera and target together, so the subject slides across the
    // frame without the viewing angle — and therefore the label — swinging.
    const pan = scratch.offsetX * l.pan;
    tmp.copy(framePos);
    // Pull back along the view axis, not along world Z. Scaling Z only works
    // when the subject sits near the origin; the filling line and the conveyor
    // run down Z, so scaling it there slid the camera past the action instead
    // of away from it.
    if (l.distance !== 1) tmp.sub(frameTarget).multiplyScalar(l.distance).add(frameTarget);
    tmp.x += hero.smoothed.x * 0.26 - pan;
    tmp.y += hero.smoothed.y * 0.15 + l.lift;

    tmpTarget.copy(frameTarget);
    tmpTarget.x -= pan;
    tmpTarget.y += l.lift;

    camera.position.lerp(tmp, Math.min(1, dt * 5));
    camera.lookAt(tmpTarget);

    const wantFov = scratch.fov + l.fovAdd;
    if (Math.abs(camera.fov - wantFov) > 0.01) {
      camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 4);
      camera.updateProjectionMatrix();
    }

    hero.nudge *= 1 - Math.min(1, dt * 2.2);
    hero.spin += (scratch.spin + hero.nudge) * dt;
    stage.canPivot.rotation.y = hero.spin;
    if (stage.packGroup) stage.packGroup.rotation.y = hero.spin * 0.22;

    stage.setDust(scratch.dust);
    stage.setExposure(scratch.exposure);
    stage.setAccentPower(scratch.accent);
    stage.setPackBlend(scratch.pack);
    stage.setScene(sceneId, sceneProgress);

    onVisual?.(scratch.opacity, activeId);
    // Below ~2% opacity there is nothing to see, so stop drawing entirely.
    stage.setVisible(scratch.opacity > 0.02);
  }

  /* ---------------- api ---------------- */

  return {
    get phase() {
      return phase;
    },
    get duration() {
      return DURATION;
    },
    get station() {
      return activeId;
    },

    /** Pose the camera on frame zero without starting the clock. */
    prime() {
      applyShot(sampleShot(0));
    },

    measure,

    play({ instant = false } = {}) {
      phase = 'intro';
      // On a phone the opening macro is an unreadable full-bleed crop for its
      // first couple of seconds — it works at 16:9 and not at 9:19.5. Portrait
      // joins the sequence after it, which also makes the intro shorter on the
      // device where people are least patient with one.
      const portrait = innerWidth / innerHeight < 0.95;
      elapsed = portrait ? INTRO_SKIP_IN : 0;
      startedAt = performance.now() - elapsed * 1000;
      firedCues = new Set();
      if (instant) {
        landImmediately();
        finish();
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        finishResolve = resolve;
      });
    },

    skip() {
      if (phase !== 'intro') return;
      landImmediately();
      finish();
    },

    update(dt) {
      if (phase === 'intro') updateIntro();
      else if (phase === 'live') updateLive(dt);
    },

    setPointer(x, y) {
      hero.pointer.x = x;
      hero.pointer.y = y;
    },

    /** A flavour change spins the can so the swap happens off-camera. */
    nudgeSpin(amount = 6.4) {
      hero.nudge = amount;
    },
  };
}
