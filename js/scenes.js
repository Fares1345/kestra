/**
 * The production journey: three factory scenes that play out as you scroll.
 *
 * Each scene owns its own geometry and lights, is built the first time the page
 * comes near it, and exposes `update(dt, progress)` where progress is 0..1
 * through that scene's scroll range. The action is scroll-linked rather than
 * timed — the tank actually fills, the lids actually seat, the cans actually
 * travel — because a journey you drive yourself reads as storytelling and a
 * loop playing beside you reads as decoration.
 *
 * Everything shares the can geometry and per-flavour materials the stage
 * already owns, so a scene costs draw calls and almost nothing else.
 */

import * as THREE from 'three';
import { CAN_DIMENSIONS } from './can.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
/** Progress window helper: 0 before `a`, 1 after `b`, smooth between. */
const range = (v, a, b) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/* ------------------------------------------------------------------ *
 * shared factory materials
 * ------------------------------------------------------------------ */

export function makeFactoryMaterials({ steel, belt, liquidNormal }) {
  const steelMat = new THREE.MeshPhysicalMaterial({
    map: steel.colour,
    roughnessMap: steel.orm,
    metalnessMap: steel.orm,
    metalness: 1,
    roughness: 1,
    envMapIntensity: 1.05,
  });

  const steelDark = steelMat.clone();
  steelDark.color = new THREE.Color(0x6a7079);
  steelDark.envMapIntensity = 0.7;

  const beltMat = new THREE.MeshPhysicalMaterial({
    map: belt.colour,
    roughnessMap: belt.orm,
    metalnessMap: belt.orm,
    metalness: 1,
    roughness: 1,
    envMapIntensity: 0.5,
  });

  return { steelMat, steelDark, beltMat, liquidNormal };
}

/* ------------------------------------------------------------------ *
 * scene 1 — ingredient preparation
 * ------------------------------------------------------------------ */

/**
 * Inside a stainless mixing vessel. The liquid rises and turns as you scroll,
 * an agitator sweeps through it, and vapour lifts off the surface.
 */
export function createMixingScene({ materials, accent }) {
  const group = new THREE.Group();
  const R = 3.1;
  const DEPTH = 3.4;

  // The vessel is seen from outside and above, tilting over the rim, so it
  // needs both faces plus a real rolled edge between them. A single BackSide
  // cylinder reads as fog the moment the camera clears the lip.
  const outerMat = materials.steelMat.clone();
  outerMat.map = materials.steelMat.map.clone();
  outerMat.map.wrapS = outerMat.map.wrapT = THREE.RepeatWrapping;
  outerMat.map.repeat.set(5, 1.6);
  // Not fully metallic. A metalness-1 shell has no diffuse term at all, so in
  // a dim plant it renders as a black hole no matter how it is lit. Backing
  // the metalness off lets the work lights actually describe the curve, which
  // is what a jacketed tank looks like on a real shop floor.
  outerMat.roughnessMap = null;
  outerMat.metalnessMap = null;
  outerMat.metalness = 0.5;
  outerMat.roughness = 0.44;
  outerMat.envMapIntensity = 1.25;
  outerMat.color = new THREE.Color(0x99a2ae);
  outerMat.needsUpdate = true;

  const outer = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R * 0.98, DEPTH, 84, 1, true),
    outerMat
  );
  outer.position.y = DEPTH / 2;
  group.add(outer);

  // The inner face is darker: a tank interior is in its own shadow.
  const innerMat = outerMat.clone();
  innerMat.side = THREE.BackSide;
  innerMat.color = new THREE.Color(0x40464e);
  innerMat.metalness = 0.55;
  innerMat.roughness = 0.55;
  innerMat.envMapIntensity = 0.4;
  innerMat.needsUpdate = true;
  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 0.965, R * 0.95, DEPTH, 84, 1, true),
    innerMat
  );
  inner.position.y = DEPTH / 2;
  group.add(inner);

  // The rolled rim. This one ring is what makes the tank read as a tank.
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R * 0.982, 0.055, 12, 96), materials.steelMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = DEPTH;
  group.add(rim);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(R * 0.95, 64), materials.steelDark);
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);

  // A dished bottom on a support skirt. Without them the tank is a bowl
  // floating in the dark; with them it is equipment standing on a plant floor.
  // The dish shares the shell's bottom radius exactly — a wider one shows a
  // second silhouette outside the wall and the whole thing reads as glass.
  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(R * 0.98, 72, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    outerMat
  );
  dish.scale.y = 0.34;
  group.add(dish);

  const skirtMat = materials.steelDark.clone();
  skirtMat.side = THREE.DoubleSide;
  const skirt = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 0.66, R * 0.7, 1.6, 48, 1, true),
    skirtMat
  );
  skirt.position.y = -1.4;
  group.add(skirt);

  // Two banding welds around the shell. Real vessels are made in courses.
  for (const y of [DEPTH * 0.42, DEPTH * 0.78]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(R * 1.004, 0.018, 8, 84), materials.steelDark);
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    group.add(band);
  }

  // The liquid. Opaque with a modest clearcoat rather than transmissive:
  // a real fruit base is not see-through, and transmission costs a lot.
  const liquidNormal = materials.liquidNormal.clone();
  liquidNormal.wrapS = liquidNormal.wrapT = THREE.RepeatWrapping;
  liquidNormal.repeat.set(3, 3);
  const liquidMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(accent).multiplyScalar(0.4),
    roughness: 0.26,
    metalness: 0,
    clearcoat: 0.55,
    clearcoatRoughness: 0.12,
    normalMap: liquidNormal,
    normalScale: new THREE.Vector2(0.7, 0.7),
    envMapIntensity: 0.5,
  });
  const liquid = new THREE.Mesh(new THREE.CircleGeometry(R * 0.95, 96), liquidMat);
  liquid.rotation.x = -Math.PI / 2;
  group.add(liquid);

  // The agitator: a shaft with two swept paddles.
  const agitator = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, DEPTH * 1.1, 24),
    materials.steelMat
  );
  shaft.position.y = DEPTH * 0.58;
  agitator.add(shaft);
  for (let i = 0; i < 2; i++) {
    const paddle = new THREE.Mesh(new THREE.BoxGeometry(R * 1.25, 0.42, 0.07), materials.steelDark);
    paddle.rotation.y = i * Math.PI * 0.5;
    paddle.rotation.z = 0.22;
    paddle.position.y = 0.3;
    agitator.add(paddle);
  }
  group.add(agitator);

  // The inlet: ingredients arrive down a pipe over the rim. This is the beat
  // the scene is actually about, so it gets to be the thing that moves first.
  const inlet = new THREE.Group();
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 2.6, 20), materials.steelMat);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(-R * 0.55, DEPTH + 1.5, 0);
  inlet.add(arm);
  const down = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.85, 20), materials.steelMat);
  down.position.set(-R * 0.42, DEPTH + 1.1, 0);
  inlet.add(down);
  group.add(inlet);

  // The stream. An unlit flat cylinder is what makes a pour read as cartoon:
  // liquid is legible almost entirely through its specular streaks, so this
  // takes light and the environment, and carries a normal map scrolling down
  // its length for surface texture.
  const pourNormal = materials.liquidNormal.clone();
  pourNormal.wrapS = pourNormal.wrapT = THREE.RepeatWrapping;
  pourNormal.repeat.set(2, 7);
  // A thin falling column carries far less pigment than the bulk it comes
  // from, so it reads pale and half-transparent — not a solid rod of juice.
  const pourTint = (hex) => new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), 0.42);
  const pourMat = new THREE.MeshPhysicalMaterial({
    color: pourTint(accent),
    roughness: 0.04,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    normalMap: pourNormal,
    normalScale: new THREE.Vector2(0.5, 1.4),
    envMapIntensity: 2.1,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  // A falling stream accelerates, so it necks as it goes: same flow, less
  // cross-section. A straight tube is the other half of the cartoon look.
  const pourProfile = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pourProfile.push(new THREE.Vector2(0.118 * (0.42 + t * 0.58) + Math.sin(t * 7) * 0.005, t));
  }
  const pour = new THREE.Mesh(new THREE.LatheGeometry(pourProfile, 20), pourMat);
  pour.position.set(-R * 0.42, DEPTH * 0.6, 0);
  group.add(pour);

  // Where it lands: a crown of ripples running out across the surface.
  const rippleMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(accent).lerp(new THREE.Color('#ffffff'), 0.55),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const ripples = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 40), rippleMat.clone());
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(-R * 0.42, 0, 0);
    group.add(ring);
    ripples.push(ring);
  }

  // Vapour lifting off a cold surface.
  const vapourCount = 220;
  const vpos = new Float32Array(vapourCount * 3);
  const vseed = new Float32Array(vapourCount);
  for (let i = 0; i < vapourCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * R * 0.94;
    vpos[i * 3] = Math.cos(a) * d;
    vpos[i * 3 + 1] = Math.random();
    vpos[i * 3 + 2] = Math.sin(a) * d;
    vseed[i] = Math.random();
  }
  const vgeo = new THREE.BufferGeometry();
  vgeo.setAttribute('position', new THREE.BufferAttribute(vpos, 3));
  vgeo.setAttribute('aSeed', new THREE.BufferAttribute(vseed, 1));
  const vapourMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uLevel: { value: 0 }, uOpacity: { value: 0.22 } },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime; uniform float uLevel;
      varying float vFade;
      void main() {
        vec3 p = position;
        float t = fract(uTime * 0.09 + aSeed);
        p.y = uLevel + t * 2.2;
        p.x += sin(uTime * 0.4 + aSeed * 12.0) * 0.5 * t;
        p.z += cos(uTime * 0.33 + aSeed * 9.0) * 0.5 * t;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (36.0 + aSeed * 90.0) * (0.4 + t) / -mv.z * 60.0;
        vFade = (1.0 - t) * smoothstep(0.0, 0.15, t);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying float vFade;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.0, length(d));
        gl_FragColor = vec4(0.82, 0.87, 0.95, a * a * vFade * uOpacity);
      }`,
    transparent: true,
    depthWrite: false,
  });
  const vapour = new THREE.Points(vgeo, vapourMat);
  vapour.frustumCulled = false;
  group.add(vapour);

  // Overhead work light: this is a plant, not a photo studio. It is aimed down
  // the tank so the wall falls off into its own shadow instead of glowing.
  const key = new THREE.SpotLight(0xf2f7ff, 44, 18, 0.62, 0.5, 1.9);
  key.position.set(1.8, DEPTH + 4.4, 2.8);
  key.target.position.set(-0.3, 0.4, -0.4);
  group.add(key, key.target);

  // A cool edge from behind picks the rim out of the dark.
  const edge = new THREE.DirectionalLight(0x9db4dc, 1.1);
  edge.position.set(-4.5, 4.4, -5);
  group.add(edge);

  // And a low, wide wash from the camera side so the shell reads as brushed
  // stainless rather than a black silhouette.
  const wash = new THREE.DirectionalLight(0xc6d4ea, 2.4);
  wash.position.set(5.5, 3.4, 6.5);
  group.add(wash);

  const bounce = new THREE.PointLight(new THREE.Color(accent), 4, 6.5, 2);
  bounce.position.set(0, 0.6, 0);
  group.add(bounce);

  let clock = 0;
  return {
    group,
    update(dt, progress) {
      clock += dt;
      // The vessel fills as you scroll, then settles.
      const level = 0.3 + range(progress, 0.05, 0.8) * 1.55;
      liquid.position.y = level;
      liquid.material.normalMap.offset.set(clock * 0.014, clock * 0.021);
      liquid.material.normalScale.setScalar(0.75 - range(progress, 0.6, 1) * 0.4);
      agitator.rotation.y += dt * (1.6 - range(progress, 0.5, 1) * 1.1);
      vapourMat.uniforms.uTime.value = clock;
      vapourMat.uniforms.uLevel.value = level;
      vapourMat.uniforms.uOpacity.value = 0.08 + range(progress, 0.25, 0.9) * 0.2;

      // The pour runs while the level is climbing and shuts off once it settles.
      const pouring = range(progress, 0.02, 0.14) * (1 - range(progress, 0.62, 0.78));
      pourMat.opacity = pouring * 0.58;
      pour.visible = pouring > 0.01;
      const drop = DEPTH + 0.72 - level;
      pour.scale.y = drop;
      pour.position.y = level;
      // The surface texture runs down the stream far faster than the stream
      // itself moves, which is what sells it as falling rather than hanging.
      pourNormal.offset.y = -clock * 3.2;
      pour.rotation.y = Math.sin(clock * 0.7) * 0.05;

      ripples.forEach((ring, i) => {
        const life = ((clock * 0.9 + i / ripples.length) % 1);
        const rad = 0.06 + life * 0.5;
        ring.scale.setScalar(rad);
        ring.position.y = level + 0.004;
        ring.material.opacity = pouring * (1 - life) * (1 - life) * 0.85;
        ring.visible = ring.material.opacity > 0.01;
      });

      bounce.position.y = level + 0.15;
      bounce.intensity = 2 + range(progress, 0.1, 0.8) * 5;
    },
    setAccent(hex) {
      liquidMat.color.set(hex).multiplyScalar(0.4);
      pourMat.color.copy(pourTint(hex));
      ripples.forEach((r) => r.material.color.set(hex).lerp(new THREE.Color('#ffffff'), 0.55));
      bounce.color.set(hex);
    },
  };
}

/* ------------------------------------------------------------------ *
 * scene 2 — filling and sealing
 * ------------------------------------------------------------------ */

/**
 * A filling head over a line of open can bodies. Liquid runs, the level rises,
 * then the lids come down and seat. All of it keyed to scroll.
 */
export function createFillingScene({ materials, geometries, canMaterials, accent }) {
  // Where a lid comes to rest, taken from the can itself so it cannot drift
  // out of sync the next time the profile changes.
  const LID_SEAT_Y = CAN_DIMENSIONS.lidY;
  const group = new THREE.Group();
  // Four stations, not five: the fifth only ever sat under the copy column.
  const COUNT = 4;
  const PITCH = 0.86;

  // The line: a steel deck with a guide rail behind it.
  const deck = new THREE.Mesh(new THREE.BoxGeometry(COUNT * PITCH + 2.4, 0.16, 1.5), materials.steelDark);
  deck.position.y = -0.08;
  group.add(deck);

  const rail = new THREE.Mesh(new THREE.BoxGeometry(COUNT * PITCH + 2.4, 0.5, 0.09), materials.steelMat);
  rail.position.set(0, 0.42, -0.62);
  group.add(rail);

  const cans = [];
  const fills = [];
  const lids = [];

  for (let i = 0; i < COUNT; i++) {
    const x = (i - (COUNT - 1) / 2) * PITCH;

    const holder = new THREE.Group();
    holder.position.x = x;
    // A quarter turn brings a printed face to camera.
    holder.rotation.y = -Math.PI / 2;

    const body = new THREE.Mesh(geometries.body, canMaterials.body);
    holder.add(body);
    group.add(holder);
    cans.push(holder);

    // The liquid inside, a disc that rises up the can.
    const fill = new THREE.Mesh(
      new THREE.CircleGeometry(0.168, 40),
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(accent).multiplyScalar(0.7),
        roughness: 0.12,
        clearcoat: 1,
        metalness: 0,
      })
    );
    fill.rotation.x = -Math.PI / 2;
    fill.position.set(x, 0.1, 0);
    group.add(fill);
    fills.push(fill);

    const lid = new THREE.Mesh(geometries.lid, canMaterials.lid);
    lid.position.set(x, 2.4, 0);
    lid.rotation.y = -Math.PI / 2;
    group.add(lid);
    lids.push(lid);

    // The filling head above each station.
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.05, 0.5, 20), materials.steelMat);
    nozzle.position.set(x, 2.05, 0);
    group.add(nozzle);
  }

  const head = new THREE.Mesh(new THREE.BoxGeometry(COUNT * PITCH + 0.9, 0.34, 0.7), materials.steelDark);
  head.position.y = 2.42;
  group.add(head);

  // The streams. Thin tapered cylinders, only visible while filling.
  const streamMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(accent).lerp(new THREE.Color('#ffffff'), 0.45),
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const streams = cans.map((_, i) => {
    const x = (i - (COUNT - 1) / 2) * PITCH;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.038, 1.5, 10, 1, true), streamMat);
    m.position.set(x, 1.05, 0);
    group.add(m);
    return m;
  });

  const key = new THREE.SpotLight(0xeef4ff, 62, 18, 0.8, 0.55, 1.8);
  key.position.set(-1.6, 5.2, 3.4);
  key.target.position.set(0, 0.7, 0);
  group.add(key, key.target);

  const rim = new THREE.DirectionalLight(new THREE.Color(accent), 0.7);
  rim.position.set(3.2, 2.6, -3.6);
  group.add(rim);

  // The single overhead key sat off to one side, so the far end of the line
  // fell away into black. A soft frontal wash keeps every printed face on the
  // line readable, which is the whole point of showing the line.
  const face = new THREE.DirectionalLight(0xdce7fa, 1.6);
  face.position.set(1.5, 2.6, 5.5);
  group.add(face);

  return {
    group,
    update(dt, progress) {
      // Each can starts filling slightly after the one before it, so the line
      // reads as a line rather than five things doing the same thing at once.
      cans.forEach((_, i) => {
        const offset = i * 0.07;
        const fillP = range(progress, 0.06 + offset, 0.5 + offset);
        fills[i].position.y = 0.1 + fillP * 1.18;
        streamMat.opacity = 0.55;
        streams[i].visible = fillP > 0.02 && fillP < 0.99;
        streams[i].scale.y = Math.max(0.05, 1 - fillP * 0.8);
        streams[i].position.y = 1.42 - (1 - streams[i].scale.y) * 0.72;

        // Then the lid descends and seats.
        const seatP = range(progress, 0.56 + offset, 0.88 + offset);
        lids[i].position.y = 2.4 - seatP * (2.4 - LID_SEAT_Y);
        lids[i].visible = seatP > 0.001;
      });
    },
    setAccent(hex) {
      fills.forEach((f) => f.material.color.set(hex).multiplyScalar(0.7));
      streamMat.color.set(hex).lerp(new THREE.Color('#ffffff'), 0.45);
      rim.color.set(hex);
    },
  };
}

/* ------------------------------------------------------------------ *
 * scene 3 — packaging
 * ------------------------------------------------------------------ */

/**
 * Finished cans travelling a conveyor into a printed tray. The belt scrolls,
 * the cans ride it, and the tray fills a can at a time.
 */
export function createPackingScene({ materials, geometries, materialFor, cartonMap, products }) {
  const group = new THREE.Group();
  const BELT_LEN = 15;
  // Enough riders that the cycle length matches the belt: with fewer, the cans
  // bunch at the head of the line and the last third of the belt runs empty.
  const RIDERS = 13;
  const SPACING = 1.15;

  const beltMap = materials.beltMat.map.clone();
  beltMap.wrapS = beltMap.wrapT = THREE.RepeatWrapping;
  beltMap.repeat.set(1, BELT_LEN / 1.4);
  const beltMat = materials.beltMat.clone();
  beltMat.map = beltMap;

  const belt = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, BELT_LEN), beltMat);
  belt.position.y = -0.06;
  group.add(belt);

  // Side rails and legs, so the belt sits in a plant rather than in space.
  for (const side of [-1, 1]) {
    const guide = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, BELT_LEN), materials.steelMat);
    guide.position.set(side * 0.78, 0.09, 0);
    group.add(guide);
  }
  for (let i = -2; i <= 2; i++) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.12), materials.steelDark);
    leg.position.set(0.72, -1.16, i * 3.2);
    group.add(leg);
    const leg2 = leg.clone();
    leg2.position.x = -0.72;
    group.add(leg2);
  }

  // The riders: finished cans, one flavour each, cycling down the line.
  const riders = [];
  for (let i = 0; i < RIDERS; i++) {
    const p = products[i % products.length];
    const mats = materialFor(p.id);
    const holder = new THREE.Group();
    holder.rotation.y = -Math.PI / 2 + (i % 3) * 0.18;
    holder.add(new THREE.Mesh(geometries.body, mats.body));
    holder.add(new THREE.Mesh(geometries.lid, mats.lid));
    group.add(holder);
    riders.push(holder);
  }

  // The tray at the end of the line.
  const tray = new THREE.Group();
  const board = new THREE.MeshPhysicalMaterial({
    map: cartonMap,
    color: 0xffffff,
    roughness: 0.8,
    metalness: 0,
    envMapIntensity: 0.55,
  });
  const plain = new THREE.MeshPhysicalMaterial({ color: 0x14171d, roughness: 0.85, metalness: 0 });
  const TW = 2.5;
  const TD = 1.9;
  const base = new THREE.Mesh(new THREE.BoxGeometry(TW, 0.03, TD), plain);
  tray.add(base);
  const front = new THREE.Mesh(new THREE.BoxGeometry(TW, 0.52, 0.03), board);
  front.position.set(0, 0.26, TD / 2);
  tray.add(front);
  const back = front.clone();
  back.position.z = -TD / 2;
  back.rotation.y = Math.PI;
  tray.add(back);
  tray.position.set(0, 0.02, BELT_LEN / 2 + 1.5);
  group.add(tray);

  // Cans already packed in the tray, revealed as the scene runs.
  const packed = [];
  for (let i = 0; i < 8; i++) {
    const p = products[i % products.length];
    const mats = materialFor(p.id);
    const holder = new THREE.Group();
    holder.position.set(((i % 4) - 1.5) * 0.6, 0.02, (Math.floor(i / 4) - 0.5) * 0.62);
    holder.rotation.y = -Math.PI / 2 + (i % 2) * 0.2;
    holder.add(new THREE.Mesh(geometries.body, mats.body));
    holder.add(new THREE.Mesh(geometries.lid, mats.lid));
    holder.visible = false;
    tray.add(holder);
    packed.push(holder);
  }

  const key = new THREE.SpotLight(0xf0f5ff, 190, 26, 0.85, 0.5, 1.6);
  key.position.set(-3.6, 7.4, 9.5);
  key.target.position.set(0, 0.6, 8.4);
  group.add(key, key.target);

  const fill = new THREE.DirectionalLight(0x9fb4d8, 0.75);
  fill.position.set(4, 3, -4);
  group.add(fill);

  // A second, softer head over the middle of the belt so the riders are not
  // travelling through a black tunnel before they reach the packing station.
  const line = new THREE.SpotLight(0xdfe9ff, 110, 22, 0.95, 0.6, 1.7);
  line.position.set(3.4, 5.2, 1.0);
  line.target.position.set(0, 0.55, 1.0);
  group.add(line, line.target);

  // A soft frontal wash so the printed faces are readable the whole way down
  // the belt, not only where a head happens to be overhead.
  const face = new THREE.DirectionalLight(0xd8e4f6, 1.5);
  face.position.set(6, 2.4, 4);
  group.add(face);

  let travelled = 0;
  return {
    group,
    update(dt, progress) {
      // The belt runs continuously; scroll decides how far down it we are.
      travelled += dt * 1.1;
      beltMap.offset.y = -travelled * 0.28;

      const advance = progress * 6.5;
      riders.forEach((r, i) => {
        const z = ((i * SPACING - advance - travelled * 0.55) % (RIDERS * SPACING) + RIDERS * SPACING)
          % (RIDERS * SPACING) - BELT_LEN / 2;
        r.position.set(0, 0.02, z);
        // Fade the ones that have reached the tray end rather than popping.
        r.visible = z < BELT_LEN / 2 - 0.6;
      });

      const filled = Math.floor(range(progress, 0.35, 0.95) * packed.length + 0.001);
      packed.forEach((h, i) => (h.visible = i < filled));
    },
    setAccent() {},
  };
}
