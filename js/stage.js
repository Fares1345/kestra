/**
 * The WebGL stage: one renderer, one can, one twelve-pack, and a small
 * procedural photo studio.
 *
 * Realism here comes from the environment map rather than from lamps.
 * Cylindrical metal reads as metal because of the long vertical highlights
 * thrown by strip softboxes, so the room is built from emissive planes and
 * prefiltered. The coloured lights on top only add the accent rim.
 *
 * The can and the pack share one geometry set and one material per flavour.
 * The pack is not built at all until the page is near it.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';

import { createCan, buildCanGeometries, CAN_DIMENSIONS } from './can.js';
import { createPack } from './pack.js';
import {
  makeFactoryMaterials,
  createMixingScene,
  createFillingScene,
  createPackingScene,
} from './scenes.js';
import {
  paintColourSheet,
  paintSurfaceSheets,
  paintLidSheets,
  paintCartonSheets,
  makeGlowSprite,
  makeContactShadow,
  makeFloorFade,
  makeBackdrop,
  makeReflectionFade,
  makeSteelSheets,
  makeLiquidNormal,
  makeBeltSheets,
} from './artwork.js';

/* ------------------------------------------------------------------ *
 * capability probing
 * ------------------------------------------------------------------ */

export function detectQuality() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  if (!gl) return null;

  const coarse = matchMedia('(pointer: coarse)').matches;
  const narrow = innerWidth < 820;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  const low = coarse || narrow || cores <= 4 || memory <= 4;

  gl.getExtension?.('WEBGL_lose_context')?.loseContext();

  return {
    tier: low ? 'low' : 'high',
    segments: low ? 96 : 176,
    packSegments: low ? 28 : 72,
    dust: low ? 240 : 680,
    bloom: !low,
    dof: !low,
    // A DPR-3 phone at 1.75 is drawing 3x the fragments of a 1x canvas across
    // the whole viewport, every frame. 1.4 is a third fewer and, on a screen
    // this dense, not a difference you can see.
    maxPixelRatio: low ? 1.4 : 2,
    beads: low ? 320 : 620,
  };
}

/* ------------------------------------------------------------------ *
 * procedural studio, prefiltered into an environment map
 * ------------------------------------------------------------------ */

function glowPanel(w, h, colour, intensity) {
  return new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(colour).multiplyScalar(intensity) })
  );
}

function buildStudio() {
  const room = new THREE.Scene();

  room.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(14, 14, 14),
      new THREE.MeshBasicMaterial({ color: 0x0a0b0e, side: THREE.BackSide })
    )
  );

  const key = glowPanel(7, 5, 0xffffff, 3.1);
  key.position.set(-2.6, 5.2, 3.4);
  key.lookAt(0, 0.6, 0);
  room.add(key);

  // The two tall strips are what make aluminium look like aluminium.
  // Broad, soft softboxes. Narrow bright strips throw a hard vertical bar down
  // a cylinder; a real product table uses large sources close in, which wrap
  // the curve instead of cutting a stripe across it.
  const stripL = glowPanel(2.3, 11, 0xf2f6ff, 4.4);
  stripL.position.set(-3.5, 1.4, 1.9);
  stripL.rotation.y = Math.PI * 0.34;
  room.add(stripL);

  const stripR = glowPanel(2.7, 11, 0xffffff, 3.6);
  stripR.position.set(3.9, 1.4, 0.6);
  stripR.rotation.y = -Math.PI * 0.44;
  room.add(stripR);

  // Dark occluders between the sources. The gaps are what put contrast into
  // the reflection: unbroken softboxes reflect as one smooth wash.
  for (const [x, y, z, ry, w, h] of [
    [-3.05, 3.4, 2.3, Math.PI * 0.34, 0.5, 8],
    [-3.05, -0.9, 2.3, Math.PI * 0.34, 0.5, 8],
    [3.45, 3.2, 1.0, -Math.PI * 0.44, 0.6, 8],
  ]) {
    const bar = glowPanel(w, h, 0x05060a, 1);
    bar.position.set(x, y, z);
    bar.rotation.y = ry;
    room.add(bar);
  }

  // Two small hard accents. Every real set has a few little bright things in
  // it, and they are what read as specular sparkle rather than sheen.
  for (const [x, y, z, i] of [[-1.9, 0.35, 3.1, 6.5], [2.4, 2.9, 2.2, 5]]) {
    const spark = glowPanel(0.32, 0.32, 0xffffff, i);
    spark.position.set(x, y, z);
    spark.lookAt(0, 0.7, 0);
    room.add(spark);
  }

  const kicker = glowPanel(1.4, 9, 0xdce6ff, 3.2);
  kicker.position.set(1.6, 1.6, -3.6);
  kicker.rotation.y = Math.PI * 0.06;
  room.add(kicker);

  const top = glowPanel(7, 5, 0xffffff, 1.5);
  top.position.set(0.4, 6.2, 0.2);
  top.rotation.x = Math.PI / 2;
  room.add(top);

  // A bright bounce card low and close, so the base flare comes back as a
  // metal ring. Left dark it merges with the black info panel above it and
  // the bottom of the can reads as thick smoked glass.
  const bounce = glowPanel(6, 3.2, 0xffd8b4, 2.4);
  bounce.position.set(1.2, -1.05, 2.6);
  bounce.rotation.x = -Math.PI * 0.22;
  room.add(bounce);

  const flag = glowPanel(6, 6, 0x05060a, 1);
  flag.position.set(0, 6.6, -1);
  flag.rotation.x = Math.PI / 2;
  room.add(flag);

  return room;
}

/** A plant, not a studio: hard overhead runs and a lot of dark between them. */
function buildPlant() {
  const room = new THREE.Scene();
  room.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(30, 18, 30),
      new THREE.MeshBasicMaterial({ color: 0x070809, side: THREE.BackSide })
    )
  );
  // Rows of ceiling strips, the signature reflection in factory stainless.
  for (let i = -2; i <= 2; i++) {
    const strip = glowPanel(1.1, 20, 0xeaf2ff, 3.1);
    strip.position.set(i * 4.2, 8.4, 0);
    strip.rotation.x = Math.PI / 2;
    room.add(strip);
  }
  // Walls on all four sides. Brushed stainless is almost pure specular, so a
  // shell with nothing around it renders black — a plant has walls, and they
  // are what makes the metal read as metal at grazing angles.
  const walls = [
    [0, 3, -11, 0],
    [0, 3, 11, Math.PI],
    [-11, 3, 0, Math.PI / 2],
    [11, 3, 0, -Math.PI / 2],
  ];
  for (const [x, y, z, ry] of walls) {
    const wall = glowPanel(22, 8, 0x39434f, 0.95);
    wall.position.set(x, y, z);
    wall.rotation.y = ry;
    room.add(wall);
  }
  // Tall vertical strips as well as the ceiling rows. A cylinder lit only from
  // above has no vertical highlight, and a vertical highlight running down the
  // shell is the single thing that reads as stainless.
  const uprights = [
    [-8.5, 2.6, -10.6, 0],
    [8.5, 2.6, -10.6, 0],
    [-10.6, 2.6, 5, Math.PI / 2],
    [10.6, 2.6, 5, -Math.PI / 2],
  ];
  for (const [x, y, z, ry] of uprights) {
    const strip = glowPanel(1.5, 11, 0xe6eefc, 3.4);
    strip.position.set(x, y, z);
    strip.rotation.y = ry;
    room.add(strip);
  }

  const floorBounce = glowPanel(24, 24, 0x1b222c, 0.8);
  floorBounce.position.set(0, -3, 0);
  floorBounce.rotation.x = -Math.PI / 2;
  room.add(floorBounce);
  return room;
}

/* ------------------------------------------------------------------ *
 * particles
 * ------------------------------------------------------------------ */

function makeDust(count, sprite) {
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const radius = 0.5 + Math.pow(Math.random(), 0.65) * 4.2;
    const angle = Math.random() * Math.PI * 2;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = -1.2 + Math.random() * 5.4;
    positions[i * 3 + 2] = Math.sin(angle) * radius;
    scales[i] = 0.005 + Math.pow(Math.random(), 3.8) * 0.019;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: sprite },
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uTint: { value: new THREE.Color('#ffd7bd') },
      uPixelRatio: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute float aScale;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vFade;
      void main() {
        vec3 p = position;
        p.y = mod(p.y + uTime * 0.055 + aScale * 40.0 + 1.2, 5.4) - 1.2;
        p.x += sin(uTime * 0.28 + p.y * 1.7) * 0.09;
        p.z += cos(uTime * 0.23 + p.y * 1.4) * 0.09;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aScale * 620.0 * uPixelRatio / -mv.z;
        vFade = smoothstep(0.0, 0.6, p.y + 1.2) * (1.0 - smoothstep(2.8, 4.2, p.y));
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTexture;
      uniform float uOpacity;
      uniform vec3 uTint;
      varying float vFade;
      void main() {
        float a = texture2D(uTexture, gl_PointCoord).a;
        if (a < 0.01) discard;
        gl_FragColor = vec4(uTint, a * vFade * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return points;
}

/** Fast rising embers, used only for the ignition beat of the intro. */
function makeSparks(count, sprite) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const radius = 0.32 + Math.random() * 1.5;
    const angle = Math.random() * Math.PI * 2;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = Math.random();
    positions[i * 3 + 2] = Math.sin(angle) * radius;
    seeds[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: sprite },
      uTime: { value: 0 },
      uBurst: { value: 0 },
      uTint: { value: new THREE.Color('#ff8a3d') },
      uPixelRatio: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      uniform float uBurst;
      uniform float uPixelRatio;
      varying float vFade;
      void main() {
        vec3 p = position;
        float t = fract(uTime * 0.72 + aSeed);
        p.y = -0.4 + t * 4.4;
        p.x *= 1.0 + t * 0.7;
        p.z *= 1.0 + t * 0.7;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (0.5 + aSeed * 0.9) * 13.0 * uPixelRatio / -mv.z;
        vFade = uBurst * (1.0 - t) * smoothstep(0.0, 0.12, t);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTexture;
      uniform vec3 uTint;
      varying float vFade;
      void main() {
        float a = texture2D(uTexture, gl_PointCoord).a;
        if (a < 0.01 || vFade < 0.001) discard;
        gl_FragColor = vec4(uTint, a * vFade);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return points;
}

/* ------------------------------------------------------------------ *
 * the stage
 * ------------------------------------------------------------------ */

export function createStage(canvas, { quality, product, products }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality.maxPixelRatio));

  // Both flags feed targetPixelRatio(), which buildComposer() calls while the
  // stage is still being constructed, so they have to be initialised here
  // rather than beside the code that flips them.
  let degraded = false;
  let packScaled = false;

  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // The project had no shadow maps at all — the only shadow was a painted
  // sprite, which cannot respond to the light and cannot let the can shade
  // itself. An object that casts nothing reads as pasted onto the frame no
  // matter how good its materials are. Phones keep the painted pool.
  if (quality.tier !== 'low') {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.05, 60);

  /* ---------- environment ---------- */
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const studio = buildStudio();
  const envStudio = pmrem.fromScene(studio, 0.035);
  studio.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });

  const plant = buildPlant();
  const envPlant = pmrem.fromScene(plant, 0.05);
  plant.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });

  scene.environment = envStudio.texture;

  /* ---------- a captured environment, on the can only ---------- */
  // The rooms above are a handful of emissive rectangles, and a mirror-finish
  // metal reflects those as smooth gradients — which is the CG tell. This is a
  // real captured studio (the set react-three-fiber ships as
  // <Environment preset="studio" />), and it goes on the can's own materials
  // rather than on scene.environment, because the set is graded dark: put it
  // on the scene and it lights the seven-unit floor disc too and floods the
  // frame white. Per-material envMap gives the aluminium something real to
  // reflect and leaves the room alone.
  async function loadEnvironments() {
    const tex = await new Promise((res) =>
      new EXRLoader().load('./assets/hdri/studio.exr', res, undefined, () => res(null))
    );
    if (!tex) return;
    const captured = pmrem.fromEquirectangular(tex).texture;
    tex.dispose();

    const dress = (mat, intensity) => {
      if (!mat) return;
      mat.envMap = captured;
      mat.envMapIntensity = intensity;
      mat.needsUpdate = true;
    };
    const m = can.userData.materials;
    // A captured studio carries far more energy than the procedural room the
    // materials were balanced against, so it comes in low: enough for the
    // metal to have something real in its reflection, not enough to wash the
    // print out. The bare-metal tab can take much more than the printed body.
    dress(m.body, 0.16);
    dress(m.lid, 0.2);
    dress(m.tab, 0.5);
    if (reflection) dress(reflection.material, 0.07);
    capturedEnv = captured;
    drawFrame();
  }
  let capturedEnv = null;

  /* ---------- textures ---------- */
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  function wrapTexture(source, { srgb = false, repeat = true } = {}) {
    const tex = new THREE.CanvasTexture(source);
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    if (repeat) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
    }
    tex.anisotropy = maxAniso;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  const surfaceSheets = paintSurfaceSheets({ beadCount: quality.beads });
  const lidSheets = paintLidSheets();

  const shared = {
    orm: wrapTexture(surfaceSheets.orm),
    normal: wrapTexture(surfaceSheets.normal),
    lidColour: wrapTexture(lidSheets.colour, { srgb: true, repeat: false }),
    lidRoughness: wrapTexture(lidSheets.roughness, { repeat: false }),
    lidNormal: wrapTexture(lidSheets.normal, { repeat: false }),
  };

  /** Colour sheets are the only per-flavour cost. Painted once, kept. */
  const sheetCache = new Map();
  function colourFor(p) {
    if (!sheetCache.has(p.id)) sheetCache.set(p.id, wrapTexture(paintColourSheet(p), { srgb: true }));
    return sheetCache.get(p.id);
  }

  const maps = {
    colour: colourFor(product),
    orm: shared.orm,
    normal: shared.normal,
    lidColour: shared.lidColour,
    lidRoughness: shared.lidRoughness,
    lidNormal: shared.lidNormal,
  };

  /* ---------- geometry, shared between the hero can and the pack ---------- */
  const heroGeometries = buildCanGeometries({ segments: quality.segments });
  let packGeometries = null;

  const can = createCan({ maps, geometries: heroGeometries });
  const canPivot = new THREE.Group();
  can.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
  });
  canPivot.add(can);
  const heroRig = new THREE.Group();
  heroRig.add(canPivot);
  scene.add(heroRig);

  /* ---------- floor and contact shadow ---------- */
  const shadowSprite = new THREE.Mesh(
    new THREE.PlaneGeometry(2.5, 2.5),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(makeContactShadow()),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
  );
  shadowSprite.rotation.x = -Math.PI / 2;
  shadowSprite.position.y = 0.002;
  shadowSprite.renderOrder = -1;
  heroRig.add(shadowSprite);

  // Dissolved well inside its own radius — a visible floor edge is the fastest
  // way to make a render look like a render.
  // The floor was 0x07080b against a near-black room, so it rendered as
  // nothing: no surface, and a contact shadow with nothing to fall on. A can
  // with no ground under it reads as a toy floating in a void no matter how
  // well the can itself is built, so the floor is lifted until it is a
  // surface you can see the can standing on.
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(7, 64),
    new THREE.MeshStandardMaterial({
      color: 0x1a1e26,
      roughness: 0.42,
      metalness: 0.2,
      envMapIntensity: 1.05,
      transparent: true,
      alphaMap: new THREE.CanvasTexture(makeFloorFade()),
      depthWrite: false,
    })
  );
  floor.receiveShadow = true;
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  /* ---------- the room behind the subject ---------- */
  // Unlit, so it reads as a lit backdrop rather than another object in the
  // scene. This is what stops the can looking like it floats in a void.
  const backdropTex = new THREE.CanvasTexture(makeBackdrop(product.accent));
  backdropTex.colorSpace = THREE.SRGBColorSpace;
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(46, 28),
    new THREE.MeshBasicMaterial({ map: backdropTex, depthWrite: false, toneMapped: true })
  );
  backdrop.position.set(0, 3.6, -11);
  backdrop.renderOrder = -3;
  scene.add(backdrop);

  /* ---------- the can's reflection in the floor ---------- */
  // Body only: from any camera angle we use, the lid is never in the mirror.
  let reflection = null;
  if (quality.bloom) {
    const reflectMat = can.userData.materials.body.clone();
    reflectMat.transparent = true;
    reflectMat.depthWrite = false;
    reflectMat.side = THREE.DoubleSide; // mirroring inverts the winding
    reflectMat.alphaMap = new THREE.CanvasTexture(makeReflectionFade());
    reflectMat.envMapIntensity = 0.32;
    reflectMat.anisotropy = 0;
    reflection = new THREE.Mesh(heroGeometries.body, reflectMat);
    reflection.scale.y = -1;
    reflection.position.y = -0.004;
    reflection.renderOrder = -2;
    canPivot.add(reflection);
  }

  /* ---------- lights ---------- */
  const key = new THREE.DirectionalLight(0xfff4ea, 2.4);
  key.position.set(-2.4, 4.4, 3.2);
  if (renderer.shadowMap.enabled) {
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const c = key.shadow.camera;
    c.near = 0.5;
    c.far = 14;
    c.left = -2.6;
    c.right = 2.6;
    c.top = 3.4;
    c.bottom = -1.2;
    c.updateProjectionMatrix();
    // Tight, because the subject is small and close: a loose bias is what
    // makes a shadow detach from the thing casting it.
    key.shadow.bias = -0.00035;
    key.shadow.normalBias = 0.012;
    key.shadow.radius = 3;
  }
  scene.add(key);
  scene.add(key.target);

  const rimWarm = new THREE.DirectionalLight(new THREE.Color(product.accent), 2.1);
  rimWarm.position.set(2.6, 2.2, -3.4);
  scene.add(rimWarm);

  const rimCool = new THREE.PointLight(0x5b7dff, 5, 4.5, 2);
  rimCool.position.set(-1.1, 1.5, -1.1);
  scene.add(rimCool);

  scene.add(new THREE.HemisphereLight(0x2a3040, 0x05060a, 0.55));

  /* ---------- particles ---------- */
  const dustSprite = new THREE.CanvasTexture(makeGlowSprite());
  const dust = makeDust(quality.dust, dustSprite);
  const sparks = makeSparks(quality.tier === 'low' ? 70 : 190, dustSprite);
  dust.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  sparks.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  sparks.material.uniforms.uTint.value = new THREE.Color(product.accent).lerp(new THREE.Color('#ffffff'), 0.4);
  scene.add(dust, sparks);

  /* ---------- post ---------- */
  let composer = null;
  let bloomPass = null;
  let bokehPass = null;
  let bloomEnabled = quality.bloom;

  function buildComposer() {
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(targetPixelRatio());
    composer.setSize(innerWidth, innerHeight);
    composer.addPass(new RenderPass(scene, camera));
    if (quality.dof) {
      // Shallow focus for the macro opening. Disabled once the intro lands,
      // because it costs a depth pass every frame.
      bokehPass = new BokehPass(scene, camera, { focus: 1.0, aperture: 0.0008, maxblur: 0.012 });
      bokehPass.enabled = false;
      composer.addPass(bokehPass);
    }
    bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.34, 0.55, 0.92);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
  }
  if (bloomEnabled) buildComposer();

  /* ---------- the pack, built on first demand ---------- */
  let pack = null;
  const packMaterials = new Map();

  function packMaterialFor(id) {
    const key = id || '__empty';
    if (packMaterials.has(key)) return packMaterials.get(key);
    const p = products.find((x) => x.id === id) || product;
    // The tray is twelve cans, so twenty-four draws of whatever this is. On a
    // phone that is the single heaviest thing on the page: clearcoat roughly
    // doubles the fragment cost of a physical material, and at this size on
    // this screen neither it nor the surface normals are visible. Phones get
    // a standard material without either; the hero can is untouched.
    const cheap = quality.tier === 'low';
    const Mat = cheap ? THREE.MeshStandardMaterial : THREE.MeshPhysicalMaterial;
    const gloss = cheap ? {} : { clearcoat: 0.5, clearcoatRoughness: 0.24 };
    const bump = cheap
      ? {}
      : { normalMap: shared.normal, normalScale: new THREE.Vector2(0.4, 0.4) };
    const mats = {
      body: new Mat({
        map: colourFor(p),
        roughnessMap: shared.orm,
        metalnessMap: shared.orm,
        metalness: 1,
        roughness: 1,
        envMapIntensity: 1.3,
        ...bump,
        ...gloss,
      }),
      lid: new Mat({
        map: shared.lidColour,
        roughnessMap: shared.lidRoughness,
        // The end is lacquered, so metalness comes from the map like it does
        // on the hero can — without this the pack lids are bare black metal.
        metalnessMap: shared.lidRoughness,
        metalness: 1,
        roughness: 1,
        // Twelve lids side by side blow out at hero intensity.
        envMapIntensity: 0.55,
        ...(cheap ? {} : { normalMap: shared.lidNormal, clearcoat: 1, clearcoatRoughness: 0.05 }),
      }),
    };
    packMaterials.set(key, mats);
    return mats;
  }

  function ensurePackGeometries() {
    if (!packGeometries) packGeometries = buildCanGeometries({ segments: quality.packSegments, tab: false });
    return packGeometries;
  }

  let cartonMap = null;
  function ensureCartonMap() {
    if (!cartonMap) cartonMap = wrapTexture(paintCartonSheets(product.accent).colour, { srgb: true, repeat: false });
    return cartonMap;
  }

  function ensurePack() {
    if (pack) return pack;
    pack = createPack({
      geometries: ensurePackGeometries(),
      materialFor: packMaterialFor,
      cartonMap: ensureCartonMap(),
    });
    pack.group.visible = false;
    pack.group.scale.setScalar(0.001);
    scene.add(pack.group);
    return pack;
  }

  /* ---------- the production journey ---------- */
  // Each scene is built the first time the page comes near it. Nothing is
  // allocated for a scene the visitor never scrolls to.
  const journey = new Map();
  let factoryMats = null;
  let activeScene = null;

  function ensureFactoryMaterials() {
    if (factoryMats) return factoryMats;
    const steel = makeSteelSheets();
    const belt = makeBeltSheets();
    factoryMats = makeFactoryMaterials({
      steel: { colour: wrapTexture(steel.colour, { srgb: true }), orm: wrapTexture(steel.orm) },
      belt: { colour: wrapTexture(belt.colour, { srgb: true }), orm: wrapTexture(belt.orm) },
      liquidNormal: wrapTexture(makeLiquidNormal(quality.tier === 'low' ? 256 : 512)),
    });
    return factoryMats;
  }

  function ensureScene(id) {
    if (journey.has(id)) return journey.get(id);
    const materials = ensureFactoryMaterials();
    const current = products.find((p) => p.id === lastFlavourId) || product;
    let built = null;
    if (id === 'mix') {
      built = createMixingScene({ materials, accent: current.accent });
    } else if (id === 'fill') {
      built = createFillingScene({
        materials,
        geometries: ensurePackGeometries(),
        canMaterials: packMaterialFor(current.id),
        accent: current.accent,
      });
    } else if (id === 'packing') {
      built = createPackingScene({
        materials,
        geometries: ensurePackGeometries(),
        materialFor: packMaterialFor,
        cartonMap: ensureCartonMap(),
        products,
      });
    }
    if (!built) return null;
    built.group.visible = false;
    scene.add(built.group);
    journey.set(id, built);
    return built;
  }

  /* ---------- hero / pack blend ---------- */
  let packBlend = 0;
  let lastFlavourId = product.id;
  function applyBlend() {
    const b = packBlend;
    const canScale = Math.max(0.0001, 1 - b * 1.35);
    heroRig.scale.setScalar(canScale);
    heroRig.position.y = -b * 0.55;
    heroRig.visible = canScale > 0.02;
    if (pack) {
      const packScale = Math.max(0.0001, (b - 0.25) / 0.75);
      pack.group.scale.setScalar(packScale);
      pack.group.position.y = (1 - packScale) * -0.4;
      pack.group.visible = packScale > 0.02;
    }
    floor.visible = b < 0.9;
  }

  /* ---------- loop ---------- */
  let running = false;
  let rafId = 0;
  let last = performance.now();
  let clock = 0;
  let onUpdate = null;
  let visible = true;

  // Adaptive quality: if the device cannot hold a frame budget, shed load
  // rather than letting the whole page stutter.
  let sceneProgress = 0;
  let slowFrames = 0;

  function resize() {
    const w = innerWidth;
    const h = innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(targetPixelRatio());
    renderer.setSize(w, h, false);
    composer?.setSize(w, h);
    bloomPass?.setSize(w, h);
    dust.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
    sparks.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  }

  function drawFrame() {
    if (composer && bloomEnabled) composer.render();
    else renderer.render(scene, camera);
  }

  // Twelve cans cost roughly three times what the single hero can does, and on
  // a phone that is where the page stops being smooth. Rather than degrade the
  // whole site for it, the buffer drops to 1x while the tray is on screen and
  // goes back afterwards — at 1.4 on a dense screen that is about half the
  // fragments, and on a tray this size it is not a difference you can see.
  /**
   * One place decides the buffer scale. resize() used to recompute it from
   * quality.maxPixelRatio unconditionally, which silently undid everything
   * that tried to lower it — including the adaptive guard, whose resolution
   * shedding therefore never took effect at all.
   */
  function targetPixelRatio() {
    const cap = degraded ? 1.25 : quality.maxPixelRatio;
    const base = Math.min(devicePixelRatio || 1, cap);
    return packScaled ? Math.min(base, 1) : base;
  }

  function scaleForPack(on) {
    if (quality.tier !== 'low' || packScaled === on) return;
    packScaled = on;
    resize();
  }

  function degrade() {
    if (degraded) return;
    degraded = true;
    bloomEnabled = false;
    if (bokehPass) bokehPass.enabled = false;
    dust.material.uniforms.uOpacity.value *= 0.5;
    resize();
  }

  function tick(now) {
    rafId = requestAnimationFrame(tick);
    const raw = (now - last) / 1000;
    const dt = Math.min(raw, 0.05);
    last = now;
    clock += dt;

    if (visible && !degraded) {
      // ~22 fps sustained for a second is the point where shedding wins.
      if (raw > 0.045) slowFrames++;
      else slowFrames = Math.max(0, slowFrames - 1);
      if (slowFrames > 45) degrade();
    }

    dust.material.uniforms.uTime.value = clock;
    sparks.material.uniforms.uTime.value = clock;
    pack?.update(dt);
    if (activeScene) journey.get(activeScene)?.update(dt, sceneProgress);
    onUpdate?.(dt, clock);
    if (visible) drawFrame();
  }

  const stage = {
    THREE,
    renderer,
    scene,
    camera,
    can,
    canPivot,
    rig: heroRig,
    dimensions: CAN_DIMENSIONS,
    quality,

    set update(fn) {
      onUpdate = fn;
    },

    start() {
      if (running) return;
      running = true;
      last = performance.now();
      rafId = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
    },
    /** Keeps timeline state alive but skips the draw call. */
    setVisible(v) {
      visible = v;
    },
    renderOnce: drawFrame,
    resize,

    setDust: (v) => (dust.material.uniforms.uOpacity.value = v),
    setBurst: (v) => (sparks.material.uniforms.uBurst.value = v),
    setExposure: (v) => (renderer.toneMappingExposure = v),
    setBloom: (v) => bloomPass && (bloomPass.strength = v),
    /**
     * Focus distance in world units and how fast it falls off. Aperture 0 turns
     * the pass off entirely rather than rendering a no-op depth buffer.
     */
    setFocus(distance, aperture) {
      if (!bokehPass) return;
      bokehPass.enabled = aperture > 0.00002;
      if (!bokehPass.enabled) return;
      bokehPass.uniforms.focus.value = distance;
      bokehPass.uniforms.aperture.value = aperture;
    },
    setAccentPower(v) {
      rimWarm.intensity = 2.1 * v;
      rimCool.intensity = 5 * v;
    },
    /**
     * Travel the accent light around the can. A highlight that moves across a
     * cylinder is the single clearest signal that a shot was lit and filmed
     * rather than posed once and rendered.
     */
    setLightSweep(t) {
      // Stays in the rear hemisphere for the whole travel: cos(a) > 0 keeps z
      // negative, so the light rims the silhouette instead of washing the face.
      const a = -0.9 + t * 1.7;
      rimWarm.position.set(Math.sin(a) * 4.2, 2.2 + Math.cos(t * 2.4) * 0.7, Math.cos(a) * -3.6);
    },

    /** Swap the printed sleeve and retint everything keyed to the flavour. */
    setFlavour(next) {
      lastFlavourId = next.id;
      journey.forEach((sc) => sc.setAccent(next.accent));
      const body = can.userData.materials.body;
      body.map = colourFor(next);
      body.needsUpdate = true;
      if (reflection) {
        reflection.material.map = body.map;
        reflection.material.needsUpdate = true;
      }
      backdropTex.image = makeBackdrop(next.accent);
      backdropTex.needsUpdate = true;
      rimWarm.color.set(next.accent);
      sparks.material.uniforms.uTint.value.set(next.accent).lerp(new THREE.Color('#ffffff'), 0.4);
      dust.material.uniforms.uTint.value.set(next.accent).lerp(new THREE.Color('#ffffff'), 0.82);
      pack?.tintTray(next.accent);
    },

    /* ---- journey ---- */
    /**
     * Show exactly one journey scene, or none. The studio environment is for
     * the reveal; the factory scenes get the plant.
     */
    setScene(id, progress) {
      if (id && id !== activeScene) {
        const next = ensureScene(id);
        journey.forEach((sc, key) => (sc.group.visible = key === id));
        activeScene = next ? id : null;
      } else if (!id && activeScene) {
        journey.forEach((sc) => (sc.group.visible = false));
        activeScene = null;
      }
      const inPlant = !!activeScene;
      const wantEnv = inPlant ? envPlant.texture : envStudio.texture;
      if (scene.environment !== wantEnv) scene.environment = wantEnv;
      // The hero can, its floor and its backdrop belong to the reveal only.
      heroRig.visible = !inPlant && heroRig.scale.x > 0.02;
      floor.visible = !inPlant && packBlend < 0.9;
      backdrop.visible = !inPlant;
      if (pack) pack.group.visible = !inPlant && packBlend > 0.25;
      sceneProgress = progress;
    },
    prewarmScene: (id) => ensureScene(id),
    loadEnvironments,

    /* ---- pack ---- */
    ensurePack,
    setPackContents(ids) {
      ensurePack().setContents(ids);
    },
    setPackBlend(v) {
      packBlend = Math.max(0, Math.min(1, v));
      if (packBlend > 0.001) ensurePack();
      scaleForPack(packBlend > 0.25);
      applyBlend();
    },
    get packGroup() {
      return pack?.group ?? null;
    },

    /**
     * Render one product on a plain backdrop and hand back a PNG. Used to fill
     * the shop grid with real photography of the real geometry, generated while
     * the loader is still up so nothing flashes on screen.
     */
    capture(next, width, height) {
      const prevSize = new THREE.Vector2();
      renderer.getSize(prevSize);
      const prevRatio = renderer.getPixelRatio();
      const prevAspect = camera.aspect;
      const prevFov = camera.fov;
      const prevPos = camera.position.clone();
      const prevQuat = camera.quaternion.clone();
      const prevRot = canPivot.rotation.y;
      const prevBody = can.userData.materials.body.map;
      const prevRim = rimWarm.color.clone();
      const prevExposure = renderer.toneMappingExposure;
      const dustOpacity = dust.material.uniforms.uOpacity.value;
      const burst = sparks.material.uniforms.uBurst.value;
      const floorVisible = floor.visible;
      const backdropVisible = backdrop.visible;
      const reflectionVisible = reflection ? reflection.visible : false;
      const heroScale = heroRig.scale.x;
      const heroY = heroRig.position.y;

      try {
        dust.material.uniforms.uOpacity.value = 0;
        sparks.material.uniforms.uBurst.value = 0;
        floor.visible = false;
        backdrop.visible = false;
        if (reflection) reflection.visible = false;
        heroRig.visible = true;
        heroRig.scale.setScalar(1);
        heroRig.position.y = 0;
        stage.setFlavour(next);

        const camX = 0.72;
        const camZ = 4.6;
        // u = 0.25 of the sleeve sits on +X, so a quarter turn back brings a
        // printed face to camera; the azimuth term keeps it square.
        canPivot.rotation.y = -Math.PI / 2 + Math.atan2(camX, camZ);

        renderer.toneMappingExposure = 1.32;
        renderer.setPixelRatio(1);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.fov = 23;
        camera.position.set(camX, 0.9, camZ);
        camera.lookAt(0, 0.75, 0);
        camera.updateProjectionMatrix();

        renderer.render(scene, camera);
        return canvas.toDataURL('image/png');
      } catch {
        return null;
      } finally {
        dust.material.uniforms.uOpacity.value = dustOpacity;
        sparks.material.uniforms.uBurst.value = burst;
        floor.visible = floorVisible;
        backdrop.visible = backdropVisible;
        if (reflection) reflection.visible = reflectionVisible;
        heroRig.scale.setScalar(heroScale);
        heroRig.position.y = heroY;
        can.userData.materials.body.map = prevBody;
        can.userData.materials.body.needsUpdate = true;
        rimWarm.color.copy(prevRim);
        canPivot.rotation.y = prevRot;
        renderer.toneMappingExposure = prevExposure;
        renderer.setPixelRatio(prevRatio);
        renderer.setSize(prevSize.x, prevSize.y, false);
        camera.aspect = prevAspect;
        camera.fov = prevFov;
        camera.position.copy(prevPos);
        camera.quaternion.copy(prevQuat);
        camera.updateProjectionMatrix();
        applyBlend();
      }
    },

    dispose() {
      stage.stop();
      composer?.dispose();
      envStudio.dispose();
      envPlant.dispose();
      pmrem.dispose();
      pack?.dispose();
      scene.traverse((o) => {
        o.geometry?.dispose();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material?.dispose();
      });
      journey.forEach((sc) => sc.group.traverse((o) => {
        o.geometry?.dispose();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material?.dispose();
      }));
      sheetCache.forEach((t) => t.dispose());
      Object.values(shared).forEach((t) => t.dispose());
      renderer.dispose();
    },
  };

  return stage;
}
