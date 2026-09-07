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

// 58 x 157 mm: the actual dimensions of a 355 mL sleek can as it comes off a
// Ball or Rexam line, 2.71:1. The previous 55.3 x 163 (2.95:1) was slimmer
// than anything anyone manufactures, and a can whose proportions do not match
// a real one reads as a scale model of a can rather than a can — no amount of
// material work fixes that.
const R = 0.29; // body radius
const H = 1.57; // overall height

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

// A real 355 mL sleek can is a 58 mm body closed with a 200-series end, which
// is ~51.5 mm across the seam. That is a 5 mm neck-in, not a 19 mm one: the
// can is a straight cylinder for ~89% of its height and only steps in at the
// very top. Necking it further is what turns a can into a bottle.
const NECK_R = 0.262; // outer radius at the seam: a 202 end, 52.4 mm
const RIM_INNER_R = 0.239; // the lid panel inside the curl
const RIM_TOP_Y = 1.5685; // crown of the rolled rim
const LID_Y = 1.549; // lid panel, recessed ~2 mm below the crown

function bodyProfile() {
  return new Profile()
    .at(0, 0.083) // centre of the concave base dome
    .at(0.105, 0.075, 0.058)
    .at(0.206, 0.023, 0.040)
    .at(0.252, 0.002, 0.009) // the thin ring the can actually stands on
    .at(0.271, 0.014, 0.008)
    .at(R, 0.041, 0.023) // out to full diameter, and fast: the base is a
    .at(R, 1.445, 0.017) //   narrow bright ring, not a thick dark foot
    .at(0.279, 1.486, 0.040) // shoulder — one short, shallow sweep
    .at(NECK_R, 1.522, 0.023) // neck: 5.6 mm of step, and that is all
    .at(NECK_R, 1.541, 0.005)
    .at(0.271, 1.554, 0.006) // rolled rim, outer bulge
    .at(0.262, RIM_TOP_Y, 0.005) // crown of the rim
    .at(RIM_INNER_R, 1.559, 0.005)
    .at(RIM_INNER_R, LID_Y)
    // 16 steps, not 7. At a 4 mm fillet radius seven segments are visible as
    // hard horizontal facets around the shoulder — the "grooves".
    .build(16);
}

function lidProfile() {
  // Ordered outer to centre so the lathe normals face up.
  return new Profile()
    // A real beverage end is not a dish. Coming in from the curl the wall
    // drops into the countersink — a narrow groove that is the lowest ring on
    // the lid and the thing that catches a hard line of light on every can
    // you have ever picked up — and only then does the centre panel rise back
    // up, very slightly domed, sitting a couple of millimetres below the curl
    // so the cans stack.
    .at(RIM_INNER_R, LID_Y)
    .at(0.222, 1.5385, 0.010) // down the countersink wall
    .at(0.206, 1.5356, 0.008) // the countersink floor
    .at(0.189, 1.5416, 0.010) // back up to the panel
    .at(0.100, 1.5454, 0.16) // the panel, gently domed
    .at(0, 1.5464)
    .build(9);
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

/**
 * A C-shaped slot: the narrow gap punched around the lift pad on a real tab,
 * open at the rivet end so the pad stays joined to the tab there. Built from
 * explicit points, walking the outer edge and back along the inner one — an
 * arc helper would leave a duplicated vertex and the bevel divides by it.
 */
function cSlot(cx, cy, rx, ry, w, steps) {
  const path = new THREE.Path();
  const a0 = -Math.PI * 0.63;
  const a1 = Math.PI * 0.63;
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (a1 - a0) * (i / steps);
    const x = cx + Math.cos(a) * (rx + w / 2);
    const y = cy + Math.sin(a) * (ry + w / 2);
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  for (let i = steps; i >= 0; i--) {
    const a = a0 + (a1 - a0) * (i / steps);
    path.lineTo(cx + Math.cos(a) * (rx - w / 2), cy + Math.sin(a) * (ry - w / 2));
  }
  path.closePath();
  return path;
}

function tabGeometry() {
  // Laid out in the tab's own plane, in the same units as the can: a narrow
  // nose over the rivet widening to a rounded tail you can get a finger under.
  const shape = new THREE.Shape();
  // Narrow at the nose, widening to a broad rounded lift end — the stadium
  // silhouette of a stay-on tab, not a ring with a hole punched through it.
  const noseX = -0.098;
  const noseW = 0.029;
  const tailX = 0.130;
  const tailW = 0.064;

  shape.moveTo(-0.060, -noseW);
  shape.quadraticCurveTo(noseX, -noseW, noseX, 0);
  shape.quadraticCurveTo(noseX, noseW, -0.060, noseW);
  shape.lineTo(0.062, tailW);
  shape.quadraticCurveTo(tailX, tailW, tailX, 0);
  shape.quadraticCurveTo(tailX, -tailW, 0.062, -tailW);
  shape.closePath();

  // The lift pad stays solid; only a slot is punched round it.
  shape.holes.push(cSlot(0.070, 0, 0.049, 0.039, 0.010, 26));
  shape.holes.push(ring(-0.058, 0, 0.0155, 0.0155, 16)); // rivet hole

  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.007,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
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
 * Geometry only, so the hero can and the twelve cans in the pack builder can
 * share one buffer set instead of twelve.
 */
export function buildCanGeometries({ segments = 160, tab = true } = {}) {
  const body = new THREE.LatheGeometry(bodyProfile(), segments);
  remapBodyUVs(body);
  const lid = new THREE.LatheGeometry(lidProfile(), segments);
  planarUVs(lid, RIM_INNER_R);
  return { body, lid, tab: tab ? tabGeometry() : null };
}

// A real end is riveted dead centre, and the tab hangs off that point: nose
// toward the score, finger lift the other way. Placing the tab by its middle
// instead put the rivet off-centre and swung the nose to the wrong side.
export const TAB_OFFSET = { y: LID_Y + 0.008, z: -0.058 };

/**
 * Build the can. `maps` carries the canvases from artwork.js; the caller owns
 * texture lifecycle so labels can be swapped without rebuilding geometry.
 */
export function createCan({ segments = 160, maps, geometries = null }) {
  const group = new THREE.Group();
  const geo = geometries || buildCanGeometries({ segments });
  const bodyGeo = geo.body;

  const bodyMat = new THREE.MeshPhysicalMaterial({
    map: maps.colour,
    // One packed texture serves both channels: roughness in G, metalness in B.
    roughnessMap: maps.orm,
    metalnessMap: maps.orm,
    normalMap: maps.normal,
    normalScale: new THREE.Vector2(0.55, 0.55),
    metalness: 1,
    roughness: 1,
    // Varnish over the print.
    // A tighter, weaker varnish. At 0.6 the clearcoat laid a broad white veil
    // over the print, which read as haze rather than gloss.
    clearcoat: 0.34,
    clearcoatRoughness: 0.14,
    // Rolled aluminium stretches its highlight along the grain. UV u runs
    // around the can, so rotation 0 lines the stretch up with the brushing.
    anisotropy: 0.62,
    anisotropyRotation: 0,
    envMapIntensity: 1.35,
  });

  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);

  const lidGeo = geo.lid;
  const lidMat = new THREE.MeshPhysicalMaterial({
    map: maps.lidColour,
    // Roughness in green, metalness in blue: the lacquer is a glossy
    // dielectric and the rivet is bare metal, from one texture.
    roughnessMap: maps.lidRoughness,
    metalnessMap: maps.lidRoughness,
    normalMap: maps.lidNormal,
    normalScale: new THREE.Vector2(1.1, 1.1),
    metalness: 1,
    roughness: 1,
    // Sprayed lacquer over stamped aluminium: the coat is what you see, and
    // it is wet-looking.
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.15,
  });
  const lid = new THREE.Mesh(lidGeo, lidMat);
  group.add(lid);

  const tabMat = new THREE.MeshPhysicalMaterial({
    color: 0xb8bcc2,
    metalness: 1,
    roughness: 0.26,
    envMapIntensity: 1.3,
  });
  const tab = new THREE.Mesh(geo.tab || tabGeometry(), tabMat);
  tab.position.set(0, TAB_OFFSET.y, TAB_OFFSET.z);
  tab.rotation.y = Math.PI * 0.5;
  group.add(tab);

  // Sit the can on the origin so callers can place it on a floor.
  group.userData = { radius: R, height: H, materials: { body: bodyMat, lid: lidMat, tab: tabMat } };
  return group;
}

export const CAN_DIMENSIONS = { radius: R, height: H, rimTop: RIM_TOP_Y, lidY: LID_Y };
