/**
 * A 355 mL sleek can, built from a lathed profile.
 *
 * The silhouette is where realism lives or dies: a real can has no truly sharp
 * edges, it has very tight radii, and it is those radii that catch the long
 * vertical highlights you recognise as aluminium. So the profile is authored as
 * corner points with explicit fillets and expanded into arcs below.
 *
 * Units: 1 = 10 cm. The can is 0.58 across and 1.50 tall.
 */

import * as THREE from 'three';

const R = 0.29; // body radius
const H = 1.5; // overall height

/* ------------------------------------------------------------------ *
 * profile builder with corner fillets
 * ------------------------------------------------------------------ */

class Profile {
  constructor() {
    this.corners = [];
  }
  /** radius 0 gives a hard corner; anything else is rounded off. */
  at(x, y, radius = 0) {
    this.corners.push({ x, y, r: radius });
    return this;
  }
  build(arcSteps = 7) {
    const pts = [];
    const c = this.corners;
    for (let i = 0; i < c.length; i++) {
      const cur = c[i];
      const prev = c[i - 1];
      const next = c[i + 1];
      if (!prev || !next || cur.r <= 0) {
        pts.push(new THREE.Vector2(cur.x, cur.y));
        continue;
      }
      // Unit vectors from the corner back toward each neighbour.
      let ax = prev.x - cur.x;
      let ay = prev.y - cur.y;
      let bx = next.x - cur.x;
      let by = next.y - cur.y;
      const al = Math.hypot(ax, ay) || 1;
      const bl = Math.hypot(bx, by) || 1;
      ax /= al; ay /= al; bx /= bl; by /= bl;

      const dot = Math.max(-1, Math.min(1, ax * bx + ay * by));
      const theta = Math.acos(dot);
      // Straight-through or doubled-back corners cannot be filleted.
      if (!isFinite(theta) || theta < 1e-3 || Math.PI - theta < 1e-3) {
        pts.push(new THREE.Vector2(cur.x, cur.y));
        continue;
      }
      const half = theta / 2;
      let tan = cur.r / Math.tan(half);
      tan = Math.min(tan, al * 0.49, bl * 0.49);
      const radius = tan * Math.tan(half);

      const t1 = { x: cur.x + ax * tan, y: cur.y + ay * tan };
      const t2 = { x: cur.x + bx * tan, y: cur.y + by * tan };

      // Centre lies along the angle bisector.
      let mx = ax + bx;
      let my = ay + by;
      const ml = Math.hypot(mx, my) || 1;
      mx /= ml; my /= ml;
      const dist = radius / Math.sin(half);
      const centre = { x: cur.x + mx * dist, y: cur.y + my * dist };

      let a1 = Math.atan2(t1.y - centre.y, t1.x - centre.x);
      let a2 = Math.atan2(t2.y - centre.y, t2.x - centre.x);
      let delta = a2 - a1;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;

      for (let s = 0; s <= arcSteps; s++) {
        const a = a1 + delta * (s / arcSteps);
        pts.push(new THREE.Vector2(centre.x + Math.cos(a) * radius, centre.y + Math.sin(a) * radius));
      }
    }
    // Drop duplicates; lathe normals dislike zero-length segments.
    return pts.filter((p, i) => i === 0 || p.distanceTo(pts[i - 1]) > 1e-5);
  }
}

const RIM_INNER_R = 0.172;
const RIM_TOP_Y = 1.495;
const LID_Y = 1.474;

function bodyProfile() {
  return new Profile()
    .at(0, 0.118) // centre of the concave base dome
    .at(0.115, 0.108, 0.09)
    .at(0.208, 0.042, 0.05)
    .at(0.238, 0.004, 0.014) // the ring the can actually stands on
    .at(0.262, 0.028, 0.012)
    .at(R, 0.086, 0.05) // out to full diameter
    .at(R, 1.212, 0.04) // the straight body
    .at(0.262, 1.335, 0.28) // shoulder
    .at(0.198, 1.44, 0.09) // neck
    .at(0.1925, 1.468, 0.006)
    .at(0.1975, 1.4855, 0.007) // rolled rim, outer bulge
    .at(0.1885, RIM_TOP_Y, 0.006) // crown of the rim
    .at(RIM_INNER_R, 1.4885, 0.005)
    .at(RIM_INNER_R, LID_Y)
    .build();
}

function lidProfile() {
  // Ordered outer to centre so the lathe normals face up.
  return new Profile()
    .at(RIM_INNER_R, LID_Y)
    .at(0.152, 1.4685, 0.02)
    .at(0.08, 1.4655, 0.14)
    .at(0, 1.4645)
    .build(5);
}

/* ------------------------------------------------------------------ *
 * UV fixes
 * ------------------------------------------------------------------ */

/**
 * LatheGeometry lays V out by point index, so the densely filleted corners
 * would stretch the artwork. Re-derive V from real height instead — which is
 * exactly how a sleeve is printed and applied.
 */
function remapBodyUVs(geometry) {
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < min) min = y;
    if (y > max) max = y;
  }
  const span = max - min || 1;
  for (let i = 0; i < uv.count; i++) uv.setY(i, (pos.getY(i) - min) / span);
  uv.needsUpdate = true;
}

/** Plan-view projection, so lid artwork does not smear toward the centre. */
function planarUVs(geometry, radius) {
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) / radius) * 0.5 + 0.5, (pos.getZ(i) / radius) * 0.5 + 0.5);
  }
  uv.needsUpdate = true;
}

/* ------------------------------------------------------------------ *
 * the pull tab
 * ------------------------------------------------------------------ */

/**
 * A closed ring of explicit points. Going through Path.absellipse instead
 * leaves a duplicated closing vertex, and ExtrudeGeometry's bevel offset
 * divides by that zero-length segment and quietly fills the buffer with NaN.
 */
function ring(cx, cy, rx, ry, steps) {
  const path = new THREE.Path();
  for (let i = 0; i < steps; i++) {
    const a = -(i / steps) * Math.PI * 2; // clockwise, so it reads as a hole
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  path.closePath();
  return path;
}

function tabGeometry() {
  // Laid out in the tab's own plane, in the same units as the can: a narrow
  // nose over the rivet widening to a rounded tail you can get a finger under.
  const shape = new THREE.Shape();
  const noseX = -0.068;
  const noseW = 0.03;
  const tailX = 0.095;
  const tailW = 0.052;

  shape.moveTo(-0.04, -noseW);
  shape.quadraticCurveTo(noseX, -noseW, noseX, 0);
  shape.quadraticCurveTo(noseX, noseW, -0.04, noseW);
  shape.lineTo(0.055, tailW);
  shape.quadraticCurveTo(tailX, tailW, tailX, 0);
  shape.quadraticCurveTo(tailX, -tailW, 0.055, -tailW);
  shape.closePath();

  shape.holes.push(ring(0.04, 0, 0.036, 0.026, 30)); // finger hole
  shape.holes.push(ring(-0.04, 0, 0.011, 0.011, 16)); // rivet hole

  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.006,
    bevelEnabled: true,
    bevelThickness: 0.0025,
    bevelSize: 0.0025,
    bevelSegments: 2,
    curveSegments: 20,
  });
  g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------------ *
 * assembly
 * ------------------------------------------------------------------ */

/**
 * Build the can. `maps` carries the canvases from artwork.js; the caller owns
 * texture lifecycle so labels can be swapped without rebuilding geometry.
 */
export function createCan({ segments = 160, maps }) {
  const group = new THREE.Group();

  const bodyGeo = new THREE.LatheGeometry(bodyProfile(), segments);
  remapBodyUVs(bodyGeo);

  const bodyMat = new THREE.MeshPhysicalMaterial({
    map: maps.colour,
    // One packed texture serves both channels: roughness in G, metalness in B.
    roughnessMap: maps.orm,
    metalnessMap: maps.orm,
    normalMap: maps.normal,
    normalScale: new THREE.Vector2(0.55, 0.55),
    metalness: 1,
    roughness: 1,
    clearcoat: 0.6,
    clearcoatRoughness: 0.22,
    envMapIntensity: 1.35,
  });

  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);

  const lidGeo = new THREE.LatheGeometry(lidProfile(), segments);
  planarUVs(lidGeo, RIM_INNER_R);
  const lidMat = new THREE.MeshPhysicalMaterial({
    map: maps.lidColour,
    roughnessMap: maps.lidRoughness,
    metalness: 1,
    roughness: 1,
    envMapIntensity: 1.2,
  });
  const lid = new THREE.Mesh(lidGeo, lidMat);
  group.add(lid);

  const tabMat = new THREE.MeshPhysicalMaterial({
    color: 0xb8bcc2,
    metalness: 1,
    roughness: 0.26,
    envMapIntensity: 1.3,
  });
  const tab = new THREE.Mesh(tabGeometry(), tabMat);
  tab.position.set(0, LID_Y + 0.0075, -0.012);
  tab.rotation.y = Math.PI * 0.5;
  group.add(tab);

  // Sit the can on the origin so callers can place it on a floor.
  group.userData = { radius: R, height: H, materials: { body: bodyMat, lid: lidMat, tab: tabMat } };
  return group;
}

export const CAN_DIMENSIONS = { radius: R, height: H, rimTop: RIM_TOP_Y };
