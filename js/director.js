/**
 * Camera direction for the whole site.
 *
 * The intro and the store are not two scenes — they are one continuous shot.
 * The same canvas, camera and can that finish the opening sequence become the
 * hero of the storefront, so there is never a swap, a fade to a poster, or a
 * second renderer starting up. When the intro lands, the director simply hands
 * the camera over to the scroll and the pointer.
 */

import * as THREE from 'three';

const easing = {
  linear: (t) => t,
  smooth: (t) => t * t * (3 - 2 * t),
  smoother: (t) => t * t * t * (t * (t * 6 - 15) + 10),
  outExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -9 * t)),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => {
    const c = 1.24;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  },
};

/**
 * The shot list. Position and target are in can-units (the can is 1.5 tall);
 * everything else is a plain scalar lerped with the named curve.
 */
const SHOTS = [
  {
    // Macro. We open inside the condensation, before there is enough light to
    // read what the object even is.
    t: 0,
    pos: [0.36, 0.58, 0.44],
    target: [0, 0.62, 0],
    fov: 56,
    spin: 0,
    exposure: 0.18,
    dust: 0,
    burst: 0,
    bloom: 0.2,
    accent: 0.25,
    ease: 'smooth',
  },
  {
    // Light comes up across the surface and the beads catch it.
    t: 1.5,
    pos: [0.52, 0.74, 0.62],
    target: [0, 0.7, 0],
    fov: 52,
    spin: 0.85,
    exposure: 1.02,
    dust: 0.3,
    burst: 0,
    bloom: 0.34,
    accent: 0.7,
    ease: 'inOutCubic',
  },
  {
    // Pull back through the shoulder; the silhouette resolves.
    t: 3.1,
    pos: [1.35, 1.28, 1.95],
    target: [0, 0.5, 0],
    fov: 44,
    spin: 3.4,
    exposure: 1.1,
    dust: 0.62,
    burst: 0.15,
    bloom: 0.4,
    accent: 1.25,
    ease: 'inOutCubic',
  },
  {
    // Ignition beat.
    t: 4.25,
    pos: [2.05, 1.0, 3.15],
    target: [0, 0.56, 0],
    fov: 38,
    spin: 7.3,
    exposure: 1.14,
    dust: 0.78,
    burst: 1,
    bloom: 0.62,
    accent: 1.5,
    ease: 'outExpo',
  },
  {
    // Settle into the framing the storefront inherits.
    t: 6.2,
    pos: [0.9, 0.95, 4.4],
    target: [0, 0.74, 0],
    fov: 30,
    // Two full turns, landing with a printed face square on. The label is
    // drawn twice per revolution, and u = 0.25 sits on +X, so the settle is
    // a quarter turn short of the whole number.
    spin: Math.PI * 4 - Math.PI / 2,
    exposure: 1.06,
    dust: 0.42,
    burst: 0,
    bloom: 0.34,
    accent: 1,
    ease: 'outBack',
  },
];

const DURATION = SHOTS[SHOTS.length - 1].t;

/** Cue points for the overlay typography, fired once each as the shot runs. */
const CUES = [
  { t: 0.35, name: 'wake' },
  { t: 1.9, name: 'name' },
  { t: 3.4, name: 'claim' },
  { t: 4.35, name: 'flash' },
  { t: 5.4, name: 'handoff' },
];

export function createDirector(stage, { onCue, onFinish } = {}) {
  const { camera } = stage;

  const positionCurve = new THREE.CatmullRomCurve3(
    SHOTS.map((s) => new THREE.Vector3(...s.pos)),
    false,
    'catmullrom',
    0.35
  );
  const targetCurve = new THREE.CatmullRomCurve3(
    SHOTS.map((s) => new THREE.Vector3(...s.target)),
    false,
    'catmullrom',
    0.35
  );

  const scratchPos = new THREE.Vector3();
  const scratchTarget = new THREE.Vector3();

  let phase = 'idle';
  let elapsed = 0;
  let startedAt = 0;
  let firedCues = new Set();
  let finishResolve = null;

  /* ---------- hero state, live once the intro lands ---------- */
  const hero = {
    scroll: 0,
    pointer: { x: 0, y: 0 },
    smoothed: { x: 0, y: 0 },
    spin: SHOTS[SHOTS.length - 1].spin,
    spinRate: 0.085,
    nudge: 0, // extra rotation injected by a flavour change
    settled: new THREE.Vector3(...SHOTS[SHOTS.length - 1].pos),
    target: new THREE.Vector3(...SHOTS[SHOTS.length - 1].target),
  };

  /**
   * Where the can sits on screen. offsetX pans the camera and its target by the
   * same amount, so the can slides across the frame without the viewing angle
   * — and therefore the label — swinging round with it.
   */
  function heroLayout() {
    const w = innerWidth;
    const aspect = w / innerHeight;
    if (w < 900 || aspect < 0.95) {
      // Stacked layout: the can gets its own band above the copy.
      return { offsetX: 0, offsetY: -0.46, distance: aspect < 0.7 ? 1.2 : 1.04, fov: 32 };
    }
    return { offsetX: 0.86, offsetY: 0, distance: 1, fov: 30 };
  }

  function sample(time) {
    const clamped = Math.max(0, Math.min(DURATION, time));
    let i = 0;
    while (i < SHOTS.length - 2 && clamped >= SHOTS[i + 1].t) i++;
    const a = SHOTS[i];
    const b = SHOTS[i + 1];
    const span = b.t - a.t;
    const local = span > 0 ? (clamped - a.t) / span : 1;
    const e = (easing[b.ease] || easing.smooth)(Math.min(1, Math.max(0, local)));
    const u = (i + e) / (SHOTS.length - 1);
    const mix = (key) => a[key] + (b[key] - a[key]) * e;

    positionCurve.getPoint(u, scratchPos);
    targetCurve.getPoint(u, scratchTarget);

    return {
      position: scratchPos,
      target: scratchTarget,
      fov: mix('fov'),
      spin: mix('spin'),
      exposure: mix('exposure'),
      dust: mix('dust'),
      burst: mix('burst'),
      bloom: mix('bloom'),
      accent: mix('accent'),
    };
  }

  function apply(frame) {
    camera.position.copy(frame.position);
    camera.lookAt(frame.target);
    if (Math.abs(camera.fov - frame.fov) > 0.001) {
      camera.fov = frame.fov;
      camera.updateProjectionMatrix();
    }
    stage.canPivot.rotation.y = frame.spin;
    stage.setExposure(frame.exposure);
    stage.setDust(frame.dust);
    stage.setBurst(frame.burst);
    stage.setBloom(frame.bloom);
    stage.setAccentPower(frame.accent);
  }

  /** Freeze-frame the last shot — used for reduced motion and for skipping. */
  function landImmediately() {
    elapsed = DURATION;
    apply(sample(DURATION));
    CUES.forEach((c) => firedCues.add(c.name));
    onCue?.('handoff');
  }

  function updateIntro() {
    // Wall-clock, not accumulated frame deltas. A slow machine should show a
    // choppier six seconds, never a slower six seconds.
    elapsed = (performance.now() - startedAt) / 1000;
    apply(sample(elapsed));
    for (const cue of CUES) {
      if (elapsed >= cue.t && !firedCues.has(cue.name)) {
        firedCues.add(cue.name);
        onCue?.(cue.name);
      }
    }
    if (elapsed >= DURATION) finish();
  }

  function finish() {
    if (phase === 'live') return;
    phase = 'live';
    hero.spin = stage.canPivot.rotation.y;
    onFinish?.();
    finishResolve?.();
    finishResolve = null;
  }

  const tmp = new THREE.Vector3();
  const tmpTarget = new THREE.Vector3();

  function updateHero(dt) {
    const layout = heroLayout();

    // Pointer parallax, heavily damped so it never feels twitchy.
    hero.smoothed.x += (hero.pointer.x - hero.smoothed.x) * Math.min(1, dt * 2.6);
    hero.smoothed.y += (hero.pointer.y - hero.smoothed.y) * Math.min(1, dt * 2.6);

    // Scroll pushes the can back and lets it drift up out of frame.
    const s = hero.scroll;
    const recede = easing.smooth(Math.min(1, s));

    tmp.copy(hero.settled);
    tmp.x += hero.smoothed.x * 0.28 - layout.offsetX;
    tmp.y += hero.smoothed.y * 0.16 + layout.offsetY + recede * 0.62;
    tmp.z *= layout.distance;
    tmp.z += recede * 1.8;

    tmpTarget.copy(hero.target);
    tmpTarget.x -= layout.offsetX;
    tmpTarget.y += layout.offsetY + recede * 0.48;

    camera.position.lerp(tmp, Math.min(1, dt * 4.5));
    camera.lookAt(tmpTarget);

    const wantFov = layout.fov + recede * 5;
    if (Math.abs(camera.fov - wantFov) > 0.01) {
      camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 4);
      camera.updateProjectionMatrix();
    }

    // Idle turn, plus whatever a flavour swap injected.
    hero.nudge *= 1 - Math.min(1, dt * 2.2);
    hero.spin += (hero.spinRate + hero.nudge) * dt;
    stage.canPivot.rotation.y = hero.spin;

    stage.setDust(0.42 * (1 - recede * 0.7));
    stage.setExposure(1.04 - recede * 0.24);
  }

  const director = {
    get phase() {
      return phase;
    },
    get duration() {
      return DURATION;
    },

    /** Pose the camera on frame zero without starting the clock. */
    prime() {
      apply(sample(0));
    },

    play({ instant = false } = {}) {
      phase = 'intro';
      elapsed = 0;
      startedAt = performance.now();
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
      else if (phase === 'live') updateHero(dt);
    },

    setScroll(v) {
      hero.scroll = Math.max(0, Math.min(1.2, v));
    },

    setPointer(x, y) {
      hero.pointer.x = x;
      hero.pointer.y = y;
    },

    /** A flavour change spins the can so the swap happens off-camera. */
    nudgeSpin(amount = 5.2) {
      hero.nudge = amount;
    },

    /** Half a turn at the current rate — when the new label should face front. */
    get spinPhase() {
      return hero.spin;
    },
  };

  return director;
}
