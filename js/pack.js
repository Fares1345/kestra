/**
 * The twelve-pack you build in real time.
 *
 * A printed tray with a 4 x 3 grid of slots. Adding a flavour drops a real can
 * into the next free slot; removing one lifts it back out. It is the same
 * geometry as the hero can — one shared buffer set, one material per flavour —
 * so twelve cans cost twelve draw calls and nothing else.
 */

import * as THREE from 'three';
import { CAN_DIMENSIONS } from './can.js';

const COLS = 4;
const ROWS = 3;
export const SLOT_COUNT = COLS * ROWS;

const PITCH = 0.615; // centre to centre; a real fridge pack is a snug fit
const WALL = 0.022;
const TRAY_H = 0.52;

const TRAY_W = COLS * PITCH;
const TRAY_D = ROWS * PITCH;

/* ------------------------------------------------------------------ *
 * the tray
 * ------------------------------------------------------------------ */

function buildTray(cartonMap) {
  const group = new THREE.Group();

  const board = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: cartonMap,
    roughness: 0.78,
    metalness: 0,
    envMapIntensity: 0.6,
  });
  const plain = new THREE.MeshPhysicalMaterial({
    color: 0x14171d,
    roughness: 0.82,
    metalness: 0,
    envMapIntensity: 0.5,
  });

  const base = new THREE.Mesh(new THREE.BoxGeometry(TRAY_W, WALL, TRAY_D), plain);
  base.position.y = WALL / 2;
  group.add(base);

  // Long walls carry the print; the short ones stay plain board.
  const front = new THREE.Mesh(new THREE.BoxGeometry(TRAY_W, TRAY_H, WALL), board);
  front.position.set(0, TRAY_H / 2, TRAY_D / 2 - WALL / 2);
  group.add(front);

  const back = front.clone();
  back.position.z = -TRAY_D / 2 + WALL / 2;
  back.rotation.y = Math.PI;
  group.add(back);

  const side = new THREE.Mesh(new THREE.BoxGeometry(WALL, TRAY_H * 0.82, TRAY_D), plain);
  side.position.set(TRAY_W / 2 - WALL / 2, (TRAY_H * 0.82) / 2, 0);
  group.add(side);

  const side2 = side.clone();
  side2.position.x = -TRAY_W / 2 + WALL / 2;
  group.add(side2);

  group.userData.materials = { board, plain };
  return group;
}

/* ------------------------------------------------------------------ *
 * slots
 * ------------------------------------------------------------------ */

function slotPosition(i) {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  return {
    x: (col - (COLS - 1) / 2) * PITCH,
    z: (row - (ROWS - 1) / 2) * PITCH,
  };
}

/**
 * @param geometries shared { body, lid } buffers from can.js
 * @param materialFor (productId) => { body, lid } — owned by the stage, so the
 *        pack never allocates textures of its own
 */
export function createPack({ geometries, materialFor, cartonMap }) {
  const group = new THREE.Group();
  const tray = buildTray(cartonMap);
  group.add(tray);

  const slots = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    const { x, z } = slotPosition(i);
    const holder = new THREE.Group();
    holder.position.set(x, WALL, z);
    // Each can sits at a slightly different angle, the way they land in a tray.
    holder.rotation.y = -Math.PI / 2 + (((i * 37) % 23) / 23 - 0.5) * 0.5;

    const body = new THREE.Mesh(geometries.body, materialFor(null).body);
    const lid = new THREE.Mesh(geometries.lid, materialFor(null).lid);
    holder.add(body, lid);
    holder.visible = false;
    group.add(holder);

    slots.push({
      holder,
      body,
      lid,
      id: null,
      // Animation state: cans drop in and lift out rather than popping.
      y: 1.4,
      targetY: 1.4,
      velocity: 0,
      settled: true,
    });
  }

  // Slot order is deliberately not left-to-right: filling looks more natural
  // when the pack builds outward from the middle of the front row.
  const FILL_ORDER = [5, 6, 4, 7, 1, 2, 0, 3, 9, 10, 8, 11];

  let contents = [];

  /** `ids` is a flat list of product ids, at most SLOT_COUNT long. */
  function setContents(ids) {
    contents = ids.slice(0, SLOT_COUNT);
    FILL_ORDER.forEach((slotIndex, n) => {
      const slot = slots[slotIndex];
      const id = contents[n] ?? null;
      if (id && slot.id !== id) {
        const mats = materialFor(id);
        slot.body.material = mats.body;
        slot.lid.material = mats.lid;
        if (!slot.id) {
          // Arriving: start above the tray and fall in.
          slot.y = 1.5;
          slot.velocity = 0;
        }
      }
      // Only disturb a slot whose contents actually changed; re-rendering the
      // list must not make the whole tray bounce.
      const nextTarget = id ? 0 : 1.6;
      if (slot.id !== id || slot.targetY !== nextTarget) {
        slot.targetY = nextTarget;
        slot.settled = false;
      }
      slot.id = id;
      if (id) slot.holder.visible = true;
    });
  }

  function update(dt) {
    const step = Math.min(dt, 0.033);
    for (const slot of slots) {
      if (slot.settled) continue;
      const diff = slot.targetY - slot.y;
      if (slot.id) {
        // Gravity in, with a small bounce off the tray floor.
        slot.velocity += -9.4 * step;
        slot.y += slot.velocity * step;
        if (slot.y <= 0) {
          slot.y = 0;
          if (Math.abs(slot.velocity) > 0.35) slot.velocity *= -0.24;
          else {
            slot.velocity = 0;
            slot.settled = true;
          }
        }
      } else {
        // Leaving: eased lift, then hide.
        slot.y += diff * Math.min(1, step * 7);
        if (slot.y > 1.5) {
          slot.holder.visible = false;
          slot.settled = true;
        }
      }
      slot.holder.position.y = 0.022 + slot.y;
      const t = 1 - Math.min(1, Math.abs(slot.y) / 1.6);
      slot.holder.scale.setScalar(0.9 + t * 0.1);
    }
  }

  function tintTray(colour) {
    tray.userData.materials.plain.color.set(colour).multiplyScalar(0.35);
  }

  group.userData = { tray, slots };

  return {
    group,
    setContents,
    update,
    tintTray,
    get size() {
      return { width: TRAY_W, depth: TRAY_D, height: CAN_DIMENSIONS.height + TRAY_H };
    },
    dispose() {
      tray.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
    },
  };
}
