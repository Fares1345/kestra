/**
 * The WebGL stage: one renderer, one can, and a small procedural photo studio.
 *
 * The realism here comes almost entirely from the environment map rather than
 * from lamps. Cylindrical metal reads as metal because of the long vertical
 * highlights thrown by strip softboxes, so we build a tiny room out of emissive
 * planes and prefilter it. The lights on top only add the accent rims.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { createCan, CAN_DIMENSIONS } from './can.js';
import {
  paintColourSheet,
  paintSurfaceSheets,
  paintLidSheets,
  makeGlowSprite,
  makeContactShadow,
  makeFloorFade,
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
  if (typeof gl.getExtension === 'function') gl.getExtension('WEBGL_lose_context')?.loseContext();

  return {
    tier: low ? 'low' : 'high',
    segments: low ? 96 : 176,
    dust: low ? 240 : 680,
    bloom: !low,
    maxPixelRatio: low ? 1.75 : 2,
    beads: low ? 320 : 620,
  };
}

/* ------------------------------------------------------------------ *
 * procedural studio, prefiltered into an environment map
 * ------------------------------------------------------------------ */

function glowPanel(w, h, colour, intensity) {
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(colour).multiplyScalar(intensity) });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

function buildStudio() {
  const room = new THREE.Scene();

  // The walls. Not black — a real studio bounces a little light back.
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(14, 14, 14),
    new THREE.MeshBasicMaterial({ color: 0x0a0b0e, side: THREE.BackSide })
  );
  room.add(shell);

  // Key softbox, high and slightly front-left.
  const key = glowPanel(7, 5, 0xffffff, 3.1);
  key.position.set(-2.6, 5.2, 3.4);
  key.lookAt(0, 0.6, 0);
  room.add(key);

  // Two tall strips. These are the highlights that make aluminium look like
  // aluminium — narrow, bright, and far enough apart to wrap the cylinder.
  const stripL = glowPanel(0.75, 11, 0xf2f6ff, 9.5);
  stripL.position.set(-3.5, 1.4, 1.9);
  stripL.rotation.y = Math.PI * 0.34;
  room.add(stripL);

  const stripR = glowPanel(1.15, 11, 0xffffff, 7.2);
  stripR.position.set(3.9, 1.4, 0.6);
  stripR.rotation.y = -Math.PI * 0.44;
  room.add(stripR);

  // A narrow kicker behind, to separate the silhouette from the background.
  const kicker = glowPanel(0.5, 9, 0xdce6ff, 6);
  kicker.position.set(1.6, 1.6, -3.6);
  kicker.rotation.y = Math.PI * 0.06;
  room.add(kicker);

  // Warm bounce card at floor level, filling the shadow side.
  const bounce = glowPanel(6, 2.6, 0xffd8b4, 0.85);
  bounce.position.set(1.4, -1.6, 3);
  bounce.rotation.x = -Math.PI * 0.22;
  room.add(bounce);

  // Dark flag overhead so the top of the can does not blow out.
  const flag = glowPanel(6, 6, 0x05060a, 1);
  flag.position.set(0, 6.6, -1);
  flag.rotation.x = Math.PI / 2;
  room.add(flag);

  return room;
}

/* ------------------------------------------------------------------ *
 * particles
 * ------------------------------------------------------------------ */

function makeDust(count, sprite) {
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const drift = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    // A tall cylinder of motes around the can, denser near it.
    const radius = 0.5 + Math.pow(Math.random(), 0.65) * 4.2;
    const angle = Math.random() * Math.PI * 2;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = -1.2 + Math.random() * 5.4;
    positions[i * 3 + 2] = Math.sin(angle) * radius;
    scales[i] = 0.007 + Math.pow(Math.random(), 3.4) * 0.026;
    drift[i * 3] = (Math.random() - 0.5) * 0.05;
    drift[i * 3 + 1] = 0.03 + Math.random() * 0.12;
    drift[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
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
        // Slow convection plus a per-mote wobble, so nothing moves in lockstep.
        p.y = mod(p.y + uTime * 0.055 + aScale * 40.0 + 1.2, 5.4) - 1.2;
        p.x += sin(uTime * 0.28 + p.y * 1.7) * 0.09;
        p.z += cos(uTime * 0.23 + p.y * 1.4) * 0.09;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aScale * 620.0 * uPixelRatio / -mv.z;
        // Fade motes out as they reach the top of the column.
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
  points.userData.drift = drift;
  return points;
}

/** Fast vertical streaks, only used for the ignition beat of the intro. */
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

export function createStage(canvas, { quality, product }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality.maxPixelRatio));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;


  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.05, 60);

  /* ---------- environment ---------- */
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const studio = buildStudio();
  const envTarget = pmrem.fromScene(studio, 0.035);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 1.0;
  studio.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });

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
    tex.generateMipmaps = true;
    return tex;
  }

  const surfaceSheets = paintSurfaceSheets({ beadCount: quality.beads });
  const lidSheets = paintLidSheets();

  const maps = {
    colour: wrapTexture(paintColourSheet(product), { srgb: true }),
    orm: wrapTexture(surfaceSheets.orm),
    normal: wrapTexture(surfaceSheets.normal),
    lidColour: wrapTexture(lidSheets.colour, { srgb: true, repeat: false }),
    lidRoughness: wrapTexture(lidSheets.roughness, { repeat: false }),
  };

  /** Colour sheets are the only per-flavour cost, so a tiny LRU is plenty. */
  const sheetCache = new Map([[product.id, maps.colour]]);
  const SHEET_LIMIT = 4;

  function colourFor(next) {
    if (sheetCache.has(next.id)) return sheetCache.get(next.id);
    const tex = wrapTexture(paintColourSheet(next), { srgb: true });
    sheetCache.set(next.id, tex);
    if (sheetCache.size > SHEET_LIMIT) {
      for (const [id, tex2] of sheetCache) {
        if (id !== next.id && tex2 !== can.userData.materials.body.map) {
          tex2.dispose();
          sheetCache.delete(id);
          break;
        }
      }
    }
    return tex;
  }

  /* ---------- the can ---------- */
  const can = createCan({ segments: quality.segments, maps });
  const canPivot = new THREE.Group(); // rotation lives here; the rig handles placement
  canPivot.add(can);
  const rig = new THREE.Group();
  rig.add(canPivot);
  scene.add(rig);

  /* ---------- floor, shadow, lights ---------- */
  const shadowSprite = new THREE.Mesh(
    new THREE.PlaneGeometry(2.5, 2.5),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(makeContactShadow()),
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: THREE.NormalBlending,
    })
  );
  shadowSprite.rotation.x = -Math.PI / 2;
  shadowSprite.position.y = 0.002;
  shadowSprite.renderOrder = -1;
  rig.add(shadowSprite);

  // A dark, faintly reflective sweep. The alpha map dissolves it well inside
  // its own radius — a visible floor edge is the fastest way to make a render
  // look like a render.
  const floorFade = new THREE.CanvasTexture(makeFloorFade());
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(7, 64),
    new THREE.MeshStandardMaterial({
      color: 0x07080b,
      roughness: 0.62,
      metalness: 0.14,
      envMapIntensity: 0.35,
      transparent: true,
      alphaMap: floorFade,
      depthWrite: false,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  rig.add(floor);

  const key = new THREE.DirectionalLight(0xfff4ea, 2.4);
  key.position.set(-2.4, 4.4, 3.2);
  scene.add(key);

  // Accent rim — retinted whenever the flavour changes.
  const rimWarm = new THREE.PointLight(new THREE.Color(product.accent), 16, 5.5, 2);
  rimWarm.position.set(1.45, 1.6, -1.15);
  scene.add(rimWarm);

  const rimCool = new THREE.PointLight(0x5b7dff, 5, 4.5, 2);
  rimCool.position.set(-1.1, 1.5, -1.1);
  scene.add(rimCool);

  const fill = new THREE.HemisphereLight(0x2a3040, 0x05060a, 0.55);
  scene.add(fill);

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
  if (quality.bloom) {
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(Math.min(devicePixelRatio || 1, quality.maxPixelRatio));
    composer.setSize(innerWidth, innerHeight);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.34, 0.55, 0.92);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
  }

  /* ---------- loop ---------- */
  let running = false;
  let rafId = 0;
  let last = performance.now();
  let clock = 0;
  let onUpdate = null;
  let visible = true;

  function resize() {
    const w = innerWidth;
    const h = innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality.maxPixelRatio));
    renderer.setSize(w, h, false);
    composer?.setSize(w, h);
    bloomPass?.setSize(w, h);
    dust.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
    sparks.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  }

  function drawFrame() {
    if (composer) composer.render();
    else renderer.render(scene, camera);
  }

  function tick(now) {
    rafId = requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    clock += dt;
    dust.material.uniforms.uTime.value = clock;
    sparks.material.uniforms.uTime.value = clock;
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
    rig,
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

    /** Keeps the loop alive (for timeline state) but skips the draw call. */
    setVisible(v) {
      visible = v;
    },

    renderOnce: drawFrame,
    resize,

    setDust(v) {
      dust.material.uniforms.uOpacity.value = v;
    },
    setBurst(v) {
      sparks.material.uniforms.uBurst.value = v;
    },
    setExposure(v) {
      renderer.toneMappingExposure = v;
    },
    setBloom(v) {
      if (bloomPass) bloomPass.strength = v;
    },
    setAccentPower(v) {
      rimWarm.intensity = 16 * v;
      rimCool.intensity = 5 * v;
    },

    /** Swap the printed sleeve and retint everything that keys off the flavour. */
    setFlavour(next) {
      const body = can.userData.materials.body;
      body.map = colourFor(next);
      body.needsUpdate = true;
      rimWarm.color.set(next.accent);
      sparks.material.uniforms.uTint.value.set(next.accent).lerp(new THREE.Color('#ffffff'), 0.4);
      dust.material.uniforms.uTint.value.set(next.accent).lerp(new THREE.Color('#ffffff'), 0.82);
    },

    /**
     * Render one product on a plain backdrop and hand back a PNG. Used to fill
     * the shop grid with real photography of the real geometry, generated once
     * while the loader is still up so nothing flashes on screen.
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
      const shadowVisible = shadowSprite.visible;

      try {
        dust.material.uniforms.uOpacity.value = 0;
        sparks.material.uniforms.uBurst.value = 0;
        floor.visible = false;
        shadowSprite.visible = true;
        stage.setFlavour(next);

        const camX = 0.72;
        const camZ = 4.6;
        // u = 0.25 of the sleeve sits on +X, so a quarter turn back brings a
        // printed face to camera; the azimuth term keeps it square as the
        // camera is offset.
        canPivot.rotation.y = -Math.PI / 2 + Math.atan2(camX, camZ);

        // Card thumbnails are viewed small on a dark ground, so they carry a
        // little more exposure than the hero does.
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
        shadowSprite.visible = shadowVisible;
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
      }
    },

    dispose() {
      stage.stop();
      composer?.dispose();
      envTarget.dispose();
      pmrem.dispose();
      scene.traverse((o) => {
        o.geometry?.dispose();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material?.dispose();
      });
      sheetCache.forEach((t) => t.dispose());
      Object.values(maps).forEach((t) => t.dispose());
      renderer.dispose();
    },
  };

  return stage;
}
