// Giant weird background set pieces that roll past every so often:
// fever-dream set pieces: mechs, sky eyes, sky traffic, a huge sub, satellites, a cat paw, moai heads, a jetpack whale, a sky DJ, a floating croc in a floatie.
import * as THREE from 'three';
import { toon, flat } from './world.js';
import { isGrid } from './style.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 14);
const SPH = new THREE.SphereGeometry(1, 14, 10);
const CONE = new THREE.ConeGeometry(1, 1, 8);
function m(geo, mat, x, y, z, sx, sy, sz) { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.scale.set(sx, sy, sz); return o; }

// ---------------------------------------------------------------- GIANT MECH (original design)
const MECH_SCHEMES = [
  { body: 0xf2f2f2, armor: 0xff7a00, joint: 0x2a2a36, eye: 0x00e5ff },
  { body: 0x1c1c24, armor: 0xff1f3d, joint: 0x55556a, eye: 0xffe600 },
  { body: 0x1a6a6a, armor: 0xffd23a, joint: 0x2a2a36, eye: 0xff2e88 },
  { body: 0xe8e0ff, armor: 0x7a3aff, joint: 0x2a2a36, eye: 0x9dff3c },
];
function buildMech(scheme) {
  const B = toon(scheme.body), A = toon(scheme.armor), J = toon(scheme.joint), E = flat(scheme.eye), F = flat(0xffb020);
  const g = new THREE.Group();
  const pelvis = new THREE.Group(); pelvis.position.y = 11; g.add(pelvis);
  pelvis.add(m(BOX, J, 0, 0, 0, 2.4, 1.2, 1.6));
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 1.1, -0.4, 0); pelvis.add(hip);
    hip.add(m(BOX, B, 0, -2.6, 0, 1.3, 5, 1.5));                 // thigh
    const knee = new THREE.Group(); knee.position.y = -5.2; hip.add(knee);
    knee.add(m(BOX, A, 0, 0.2, -0.6, 1.4, 1.4, 0.8));            // knee guard
    knee.add(m(BOX, B, 0, -2.8, 0.2, 1.1, 5, 1.3));              // shin
    knee.add(m(BOX, A, 0, -5.4, -0.5, 1.5, 0.7, 3));             // long foot
    legs.push({ hip, knee });
  }
  const waist = m(BOX, J, 0, 1.2, 0, 1.2, 1.6, 1); pelvis.add(waist);
  const chest = new THREE.Group(); chest.position.y = 3.4; pelvis.add(chest);
  chest.add(m(BOX, B, 0, 0, 0, 3.6, 3, 2.2));
  chest.add(m(BOX, A, 0, 0.3, -1.15, 2.4, 1.6, 0.3));            // chest plate
  chest.add(m(BOX, E, 0, 0.3, -1.32, 0.6, 0.6, 0.05));           // core light
  const arms = [];
  for (const s of [-1, 1]) {
    chest.add(m(BOX, A, s * 2.5, 1.9, 0, 1.6, 2.6, 2.2));        // tall shoulder pylon
    const sh = new THREE.Group(); sh.position.set(s * 2.5, 0.6, 0); chest.add(sh);
    sh.add(m(BOX, B, 0, -2.4, 0, 0.9, 4.4, 0.9));
    const el = new THREE.Group(); el.position.y = -4.7; sh.add(el);
    el.add(m(BOX, B, 0, -2.2, 0, 0.8, 4.2, 0.8));
    el.add(m(BOX, J, 0, -4.7, 0, 1.2, 1.4, 1));                  // big hand
    arms.push(sh);
  }
  const head = new THREE.Group(); head.position.y = 2.4; chest.add(head);
  head.add(m(BOX, B, 0, 0.7, 0, 1.1, 1.4, 1.4));
  head.add(m(BOX, J, 0, 0.2, -0.75, 0.9, 0.5, 0.3));             // jaw
  head.add(m(BOX, E, 0, 0.95, -0.72, 1.0, 0.2, 0.05));           // visor slit
  for (const s of [-1, 1]) { const fin = m(BOX, A, s * 0.55, 1.6, 0.3, 0.12, 1.8, 0.5); fin.rotation.x = -0.7; fin.rotation.z = s * 0.35; head.add(fin); }
  // backpack thrusters
  const flames = [];
  for (const s of [-1, 1]) {
    const noz = m(CYL, J, s * 0.9, -0.4, 1.4, 0.55, 1.6, 0.55); chest.add(noz);
    const fl = m(CONE, F, s * 0.9, -2.2, 1.4, 0.6, 2.4, 0.6); fl.rotation.x = Math.PI; chest.add(fl); flames.push(fl);
    const fl2 = m(CONE, flat(0xfff6e0), s * 0.9, -1.7, 1.4, 0.3, 1.4, 0.3); fl2.rotation.x = Math.PI; chest.add(fl2); flames.push(fl2);
  }
  g.userData = { pelvis, legs, arms, head, flames, chest };
  return g;
}

// ---------------------------------------------------------------- SKY EYES (fever dream)
function almond(w, h) {
  const sh = new THREE.Shape();
  sh.moveTo(-w / 2, 0);
  sh.quadraticCurveTo(0, h, w / 2, 0.08 * h);
  sh.quadraticCurveTo(0, -h * 0.85, -w / 2, 0);
  return new THREE.ShapeGeometry(sh, 16);
}
const CIRC = new THREE.CircleGeometry(1, 32);
function eyeMat(c, opacity = 1) { return new THREE.MeshBasicMaterial({ color: c, fog: false, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 }); }
function buildEye(flip, irisCol) {
  const e = new THREE.Group();
  const shadow = new THREE.Mesh(almond(19, 9.5), eyeMat(0xff2e88, 0.85)); shadow.position.set(0, 1.2, -0.3); e.add(shadow);
  const shadow2 = new THREE.Mesh(almond(17, 8.5), eyeMat(0x7a3aff, 0.8)); shadow2.position.set(0, 0.9, -0.25); e.add(shadow2);
  const white = new THREE.Mesh(almond(15, 7), eyeMat(0xfff6e0)); e.add(white);
  const iris = new THREE.Group(); iris.position.z = 0.1; e.add(iris);
  iris.add(new THREE.Mesh(CIRC, eyeMat(irisCol)).translateZ(0)); iris.children[0].scale.setScalar(2.9);
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 2.95, 32), eyeMat(0x0b0410)); ring.position.z = 0.02; iris.add(ring);
  const pupil = new THREE.Mesh(CIRC, eyeMat(0x0b0410)); pupil.scale.setScalar(1.25); pupil.position.z = 0.03; iris.add(pupil);
  const hl = new THREE.Mesh(CIRC, eyeMat(0xffffff)); hl.scale.setScalar(0.7); hl.position.set(0.9, 0.9, 0.05); iris.add(hl);
  const hl2 = new THREE.Mesh(CIRC, eyeMat(0xffffff)); hl2.scale.setScalar(0.3); hl2.position.set(-0.8, -0.7, 0.05); iris.add(hl2);
  // upper lid line + winged liner
  const lid = new THREE.Mesh(almond(15.6, 7.6), eyeMat(0x0b0410)); lid.position.z = -0.05; e.add(lid);
  const wing = m(BOX, eyeMat(0x0b0410), flip * 8.4, 1.4, 0.1, 3.2, 0.45, 0.1); wing.rotation.z = flip * 0.45; e.add(wing);
  // lashes
  for (let i = 0; i < 9; i++) {
    const t = i / 8, x = -6.5 + t * 13, y = 3.0 * Math.sin(t * Math.PI) + 0.4;
    const lash = m(BOX, eyeMat(0x0b0410), x, y + 1.1, 0.1, 0.28, 2.4 + Math.sin(t * Math.PI) * 1.2, 0.1);
    lash.rotation.z = (t - 0.5) * -1.1 + flip * 0.15; e.add(lash);
  }
  e.userData = { iris };
  return e;
}

// ---------------------------------------------------------------- SATELLITE
function buildSatellite() {
  const g = new THREE.Group();
  g.add(m(BOX, toon(0xffc23a), 0, 0, 0, 2.4, 2.4, 3));                 // gold foil body
  const panel = toon(0x1a3cff), frame = flat(0xdde4ff);
  for (const s of [-1, 1]) {
    g.add(m(BOX, frame, s * 2.2, 0, 0, 1.2, 0.15, 0.15));
    for (let i = 0; i < 3; i++) {
      g.add(m(BOX, panel, s * (3.6 + i * 2.1), 0, 0, 2, 0.08, 3.2));
      g.add(m(BOX, frame, s * (3.6 + i * 2.1), 0.05, 0, 2, 0.02, 0.08));
    }
  }
  const dish = m(CONE, toon(0xeeeeee), 0, 0, -2.4, 1.6, 0.8, 1.6); dish.rotation.x = -Math.PI / 2; g.add(dish);
  g.add(m(CYL, flat(0xff1f3d), 0, 1.8, 0, 0.06, 1.6, 0.06));
  const blink = m(SPH, flat(0xff1f3d), 0, 2.7, 0, 0.18, 0.18, 0.18); g.add(blink);
  g.userData.blink = blink;
  return g;
}

// ---------------------------------------------------------------- SUBMARINE
function buildSub() {
  const g = new THREE.Group();
  const hull = toon(0x2a6a7a), stripe = flat(0xff7a00);
  const body = m(CYL, hull, 0, 0, 0, 2.2, 18, 2.2); body.rotation.z = Math.PI / 2; g.add(body);
  g.add(m(SPH, hull, 9, 0, 0, 2.6, 2.2, 2.2), m(SPH, hull, -9, 0, 0, 2.2, 2.2, 2.2));
  const st = m(CYL, stripe, 0, 0, 0, 2.25, 1.2, 2.25); st.rotation.z = Math.PI / 2; g.add(st);
  g.add(m(BOX, hull, 1.5, 2.8, 0, 4, 2.4, 1.4), m(BOX, stripe, 1.5, 3.9, 0, 4.1, 0.3, 1.45));
  g.add(m(CYL, toon(0x9aa4bc), 2.5, 5, 0, 0.12, 2.2, 0.12), m(BOX, toon(0x9aa4bc), 2.2, 6.1, 0, 0.8, 0.25, 0.25));
  for (let i = -2; i <= 2; i++) { const p = m(CYL, flat(0xfff6e0), i * 2.6 + 1, 0.4, -2.15, 0.45, 0.1, 0.45); p.rotation.x = Math.PI / 2; g.add(p); }
  const fin = m(BOX, hull, -10.5, 0, 0, 1.5, 4, 0.25); g.add(fin, m(BOX, hull, -10.5, 0, 0, 1.5, 0.25, 4));
  const prop = new THREE.Group(); prop.position.x = -11.6; g.add(prop);
  for (let i = 0; i < 3; i++) { const b = m(BOX, toon(0xffc23a), 0, 0, 0, 0.2, 2.6, 0.5); b.rotation.x = (i / 3) * Math.PI; prop.add(b); }
  g.userData.prop = prop;
  return g;
}

// ---------------------------------------------------------------- FLYING SEDAN
function buildSedan() {
  const g = new THREE.Group();
  const paint = toon(0xfff6e0), trim = toon(0xff2e88), glass = toon(0x1a2a6a);
  g.add(m(BOX, paint, 0, 0, 0, 4.6, 1, 2));
  g.add(m(BOX, paint, -0.2, 0.85, 0, 2.6, 0.8, 1.8));
  g.add(m(BOX, glass, -0.2, 0.88, 0, 2.62, 0.55, 1.82));
  g.add(m(BOX, trim, 0, -0.1, 0, 4.65, 0.2, 2.05));
  g.add(m(BOX, flat(0xffe600), 2.31, 0.1, 0.65, 0.05, 0.25, 0.4), m(BOX, flat(0xffe600), 2.31, 0.1, -0.65, 0.05, 0.25, 0.4));
  g.add(m(BOX, flat(0xff1f3d), -2.31, 0.1, 0.7, 0.05, 0.2, 0.4), m(BOX, flat(0xff1f3d), -2.31, 0.1, -0.7, 0.05, 0.2, 0.4));
  const wheels = [];
  for (const [x, z] of [[1.5, 1], [1.5, -1], [-1.5, 1], [-1.5, -1]]) {
    const w = m(CYL, toon(0x14101e), x, -0.5, z, 0.48, 0.3, 0.48); w.rotation.x = Math.PI / 2; g.add(w); wheels.push(w);
    const fl = m(CONE, flat(0x00e5ff), x, -1.25, z, 0.35, 1.1, 0.35); fl.rotation.x = Math.PI; g.add(fl); wheels.push(fl);
  }
  g.userData.wheels = wheels;
  return g;
}

// ---------------------------------------------------------------- GOOFY SKY STUFF
const TOR = new THREE.TorusGeometry(1, 0.25, 8, 20);
function buildPaw() {
  const g = new THREE.Group();
  const fur = toon(0xffa040), stripe = toon(0xc86414), pink = toon(0xff8ab0), white = toon(0xfff1e0);
  const arm = m(CYL, fur, 0, 34, 0, 6, 60, 6); g.add(arm);
  for (let i = 0; i < 6; i++) g.add(m(CYL, stripe, 0, 12 + i * 8, 0, 6.15, 2, 6.15));
  g.add(m(SPH, white, 0, 2, 0, 8, 5, 8.5));                                  // paw
  g.add(m(SPH, pink, 0, -1.6, 1.2, 3.6, 1.2, 3));                            // big bean
  for (const [x, z] of [[-4.2, -3], [-1.5, -5], [1.5, -5], [4.2, -3]]) g.add(m(SPH, pink, x, -1.2, z, 1.4, 0.7, 1.4)); // toe beans
  return g;
}
function buildMoai() {
  const g = new THREE.Group();
  const stone = toon(0x8a8a9a), dark = toon(0x55556a);
  g.add(m(BOX, stone, 0, 0, 0, 5, 11, 4.4));
  g.add(m(BOX, stone, 0, 3.4, -2.6, 5.2, 1.4, 1.2));          // heavy brow
  g.add(m(BOX, dark, -1.2, 2.2, -2.3, 1.5, 1.1, 0.4), m(BOX, dark, 1.2, 2.2, -2.3, 1.5, 1.1, 0.4)); // eye shadows
  g.add(m(BOX, stone, 0, 0.6, -2.9, 1.2, 4.2, 1.6));          // long nose
  g.add(m(BOX, dark, 0, -2.6, -2.35, 2.8, 0.7, 0.6));         // pout
  g.add(m(BOX, stone, 0, -4.8, -2.0, 3.6, 1.6, 1.5));         // chin
  g.add(m(CYL, toon(0xb04a3a), 0, 6.3, 0, 2.6, 1.8, 2.6));    // red topknot
  return g;
}
function buildWhale() {
  const g = new THREE.Group();
  const blue = toon(0x3a6aff), belly = toon(0xbfd8ff), metal = toon(0x9aa4bc);
  g.add(m(SPH, blue, 0, 0, 0, 14, 6.5, 6.5));
  g.add(m(SPH, belly, 1.5, -2.6, 0, 11, 3.2, 5.2));
  const tail = new THREE.Group(); tail.position.x = -13; g.add(tail);
  tail.add(m(SPH, blue, -2, 0, 0, 4, 2.2, 2.2));
  const fl1 = m(BOX, blue, -6, 0, 2.6, 3.5, 0.6, 5); fl1.rotation.y = 0.5; const fl2 = m(BOX, blue, -6, 0, -2.6, 3.5, 0.6, 5); fl2.rotation.y = -0.5; tail.add(fl1, fl2);
  for (const z of [-6, 6]) { const fin = m(BOX, blue, 3, -3, z, 4, 0.5, 2.5); fin.rotation.x = Math.sign(z) * 0.5; g.add(fin); }
  for (const z of [-5.6, 5.6]) { g.add(m(SPH, flat(0xffffff), 9, 1, z, 1.1, 1.1, 0.4), m(SPH, flat(0x0b0410), 9.4, 1, z * 1.04, 0.55, 0.55, 0.3)); }
  const flames = [];
  for (const z of [-2.5, 2.5]) {
    g.add(m(CYL, metal, -2, 6.4, z, 1.4, 6, 1.4));
    const fl = m(CONE, flat(0xff7a00), -2, 1.6, z, 1.3, 4, 1.3); fl.rotation.z = Math.PI; g.add(fl); flames.push(fl);
  }
  g.userData = { tail, flames };
  return g;
}
function buildCroc(grid) {
  // a fat, happy crocodile floating through the sky in a pool floatie, chomping on the beat
  const g = new THREE.Group();
  const skin = toon(grid ? 0x161a3e : 0x3fae3a), belly = toon(grid ? 0x2a2e5a : 0xd8e86a), dark = toon(grid ? 0x0d1030 : 0x2a7a2a);
  const tooth = flat(0xffffff), trim = flat(grid ? 0xff2ea8 : 0x2a7a2a);
  g.add(m(SPH, skin, 0, 0, 0, 12, 3.4, 4.6), m(SPH, belly, 0.5, -1.7, 0, 10.5, 2, 3.8));
  for (let x = -9; x <= 7; x += 2.2) { const r = m(CONE, dark, x, 3.1, 0, 0.9, 1.3, 0.9); g.add(r); } // back ridges
  if (grid) g.add(m(BOX, trim, 0, 0.2, 4.4, 22, 0.12, 0.12), m(BOX, trim, 0, 0.2, -4.4, 22, 0.12, 0.12));
  // head: skull + long upper snout, hinged lower jaw
  const head = new THREE.Group(); head.position.set(10.5, 0.6, 0); g.add(head);
  head.add(m(BOX, skin, 2.5, 0.2, 0, 5.5, 2.4, 4), m(BOX, skin, 7.6, 0.1, 0, 6.5, 1.2, 2.9));
  head.add(m(SPH, dark, 10.6, 0.6, 0.7, 0.35, 0.25, 0.3), m(SPH, dark, 10.6, 0.6, -0.7, 0.35, 0.25, 0.3)); // nostrils
  for (let x = 5; x <= 10.4; x += 0.9) for (const z of [-1.3, 1.3]) { const t = m(CONE, tooth, x, -0.75, z, 0.22, 0.6, 0.22); t.rotation.x = Math.PI; head.add(t); }
  const jaw = new THREE.Group(); jaw.position.set(0.5, -1.0, 0); head.add(jaw);
  jaw.add(m(BOX, belly, 4.8, -0.3, 0, 9.6, 0.8, 2.7));
  for (let x = 5; x <= 9.6; x += 0.9) for (const z of [-1.15, 1.15]) jaw.add(m(CONE, tooth, x, 0.35, z, 0.2, 0.55, 0.2));
  jaw.add(m(BOX, flat(0xff6a8a), 4.5, 0.12, 0, 7, 0.1, 2)); // pink mouth
  for (const z of [-1.5, 1.5]) { // big googly eyes on top
    head.add(m(SPH, skin, 1.8, 1.7, z, 1.1, 1.1, 1.1), m(SPH, flat(grid ? 0xff1f3d : 0xffe600), 2.3, 2.0, z * 1.15, 0.75, 0.75, 0.75));
    head.add(m(BOX, flat(0x0b0410), 2.85, 2.0, z * 1.15, 0.12, 0.8, 0.25));
  }
  // tail
  const tail = new THREE.Group(); tail.position.set(-11, 0, 0); g.add(tail);
  tail.add(m(SPH, skin, -3.5, 0, 0, 5, 2, 2.6));
  const tip = m(CONE, skin, -9, 0, 0, 1.6, 6, 1.6); tip.rotation.z = Math.PI / 2; tail.add(tip);
  for (let x = -2; x >= -8; x -= 2) tail.add(m(CONE, dark, x, 1.6 + x * 0.12, 0, 0.6, 0.9, 0.6));
  // stubby paddling legs
  const legs = [];
  for (const [x, z] of [[6, 3.8], [6, -3.8], [-6, 3.8], [-6, -3.8]]) { const l = new THREE.Group(); l.position.set(x, -1.5, z); l.add(m(BOX, skin, 0, -1.2, 0, 1.4, 2.6, 1.4), m(BOX, dark, 0.5, -2.6, 0, 2.2, 0.5, 1.6)); g.add(l); legs.push(l); }
  // pool floatie
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5.4, 1.5, 10, 28), grid ? flat(0x2ef2ff) : toon(0xff6ab4)); ring.rotation.y = Math.PI / 2; ring.position.x = 1; g.add(ring);
  if (!grid) for (let k = 0; k < 4; k++) { const st = new THREE.Mesh(new THREE.TorusGeometry(5.4, 1.55, 10, 4, 0.5), toon(0xffffff)); st.rotation.set(0, Math.PI / 2, k * Math.PI / 2); st.position.x = 1; g.add(st); }
  g.userData = { jaw, tail, legs, head };
  return g;
}
function buildSynthCat() {
  // original GRID mascot: a neon wireframe cat in big headphones, flying to the beat
  const g = new THREE.Group();
  const fill = toon(0x0d1030), cyan = 0x2ef2ff, mag = 0xff2ea8;
  const glow = (geo, col, x, y, z, sx, sy, sz) => {
    const o = new THREE.Group(); o.position.set(x, y, z); o.scale.set(sx, sy, sz);
    o.add(new THREE.Mesh(geo, fill));
    o.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: col })));
    return o;
  };
  const body = glow(BOX, cyan, 0, 0, 0, 6, 2.2, 2.4); g.add(body);
  const head = new THREE.Group(); head.position.set(3.9, 0.9, 0); g.add(head);
  head.add(glow(BOX, cyan, 0, 0, 0, 2.6, 2.2, 2.4));
  const earG = new THREE.ConeGeometry(1, 1, 4);
  for (const z of [-0.75, 0.75]) { const e = glow(earG, mag, -0.2, 1.6, z, 0.6, 1.2, 0.5); e.rotation.y = Math.PI / 4; head.add(e); }
  for (const z of [-0.55, 0.55]) head.add(m(BOX, flat(cyan), 1.31, 0.25, z, 0.05, 0.22, 0.55)); // visor eyes
  head.add(m(BOX, flat(mag), 1.31, -0.35, 0, 0.05, 0.12, 0.3)); // nose
  for (const z of [-1, 1]) for (const dy of [-0.15, 0.1]) { const w = m(BOX, flat(0xffffff), 1.6, -0.3 + dy, z * 0.9, 1.0, 0.03, 0.03); w.rotation.y = z * 0.4; head.add(w); } // whiskers
  // headphones
  const band = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.14, 6, 24, Math.PI), flat(mag)); band.rotation.y = Math.PI / 2; band.position.y = 0.3; head.add(band);
  for (const z of [-1.3, 1.3]) { const cup = m(CYL, toon(0x161a3e), 0, 0.2, z, 0.7, 0.4, 0.7); cup.rotation.x = Math.PI / 2; head.add(cup, m(CYL, flat(cyan), 0, 0.2, z * 1.17, 0.45, 0.05, 0.45)); head.children[head.children.length - 1].rotation.x = Math.PI / 2; }
  // legs stretched out like it's flying
  const legs = [];
  for (const [x, z] of [[2.3, 1], [2.3, -1], [-2.3, 1], [-2.3, -1]]) { const l = glow(BOX, cyan, x + (x > 0 ? 0.6 : -0.6), -1.3, z, 1.6, 0.45, 0.45); l.rotation.z = x > 0 ? -0.5 : 0.5; g.add(l); legs.push(l); }
  // tail: wavy segments
  const tail = [];
  for (let k = 0; k < 6; k++) { const t = glow(BOX, k % 2 ? mag : cyan, -3.4 - k * 0.75, 0.6 + k * 0.2, 0, 0.8, 0.35, 0.35); g.add(t); tail.push(t); }
  g.userData = { head, legs, tail };
  return g;
}
function buildDJ() {
  const g = new THREE.Group();
  const booth = toon(0x1c1c28), neon = flat(0xff2e88), cyan = flat(0x00e5ff), red = toon(0xff2418);
  g.add(m(BOX, booth, 0, 0, 0, 16, 4, 6), m(BOX, neon, 0, 1.2, -3.05, 16, 0.4, 0.1), m(BOX, cyan, 0, -0.6, -3.05, 16, 0.2, 0.1));
  const decks = [];
  for (const x of [-4.5, 4.5]) {
    const d = new THREE.Group(); d.position.set(x, 2.15, 0);
    d.add(m(CYL, toon(0x0b0410), 0, 0, 0, 2.6, 0.3, 2.6), m(CYL, flat(x < 0 ? 0xffe600 : 0x9dff3c), 0, 0.2, 0, 0.9, 0.1, 0.9), m(BOX, flat(0xffffff), 1.6, 0.25, 0, 1.2, 0.08, 0.15));
    g.add(d); decks.push(d);
  }
  const speakers = [];
  for (const x of [-11, 11]) {
    const sp = new THREE.Group(); sp.position.set(x, 1, 0);
    sp.add(m(BOX, booth, 0, 0, 0, 5, 9, 5));
    const cone = m(CYL, toon(0x55556a), 0, -1.6, -2.55, 1.8, 0.3, 1.8); cone.rotation.x = Math.PI / 2; sp.add(cone);
    const tw = m(CYL, toon(0x55556a), 0, 2.4, -2.55, 0.8, 0.3, 0.8); tw.rotation.x = Math.PI / 2; sp.add(tw);
    g.add(sp); speakers.push(cone, tw);
  }
  // giant faceless crystal DJ with headphones
  const dj = new THREE.Group(); dj.position.set(0, 2, 2.5); g.add(dj);
  dj.add(m(CYL, red, 0, 3, 0, 2.2, 5, 1.6));
  const head = new THREE.Group(); head.position.y = 7.4; dj.add(head);
  head.add(m(SPH, red, 0, 0, 0, 1.7, 2, 1.7));
  const hp = m(TOR, toon(0x0b0410), 0, 0.6, 0, 1.9, 1.9, 1.9); hp.rotation.y = Math.PI / 2; head.add(hp);
  for (const x of [-1.8, 1.8]) head.add(m(CYL, flat(0xff2e88), x, 0, 0, 0.8, 0.5, 0.8)).children.at(-1).rotation.z = Math.PI / 2;
  const arm = new THREE.Group(); arm.position.set(2.2, 4.8, 0); dj.add(arm);
  arm.add(m(CYL, red, 0, -1.6, -1.2, 0.5, 3.6, 0.5));
  arm.children[0].rotation.x = -0.9;
  g.userData = { decks, speakers, head, arm };
  return g;
}

// ---------------------------------------------------------------- GRID MODE pieces
function buildBike(color) {
  const g = new THREE.Group();
  const blk = toon(0x0a0a12), glow = flat(color);
  g.add(m(BOX, blk, 0, 0.7, 0, 0.6, 0.5, 2.6), m(BOX, glow, 0, 0.98, 0, 0.62, 0.05, 2.62));
  for (const z of [-1.05, 1.05]) { const w = m(CYL, blk, 0, 0.55, z, 0.55, 0.3, 0.55); w.rotation.z = Math.PI / 2; g.add(w); const r = m(CYL, glow, 0, 0.55, z, 0.57, 0.08, 0.57); r.rotation.z = Math.PI / 2; g.add(r); }
  // rider (faceless, white)
  g.add(m(BOX, toon(0xf4f6ff), 0, 1.3, 0.3, 0.45, 0.6, 0.7), m(SPH, toon(0xf4f6ff), 0, 1.75, -0.1, 0.25, 0.25, 0.25), m(BOX, glow, 0, 1.76, -0.32, 0.3, 0.05, 0.05));
  const trail = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, depthWrite: false }));
  trail.scale.set(0.08, 0.9, 1); trail.position.y = 0.6; g.add(trail);
  g.userData = { trail };
  return g;
}

export class SetPieces {
  constructor(scene, world) { this.scene = scene; this.world = world; this.items = []; this.nextAt = -60; this.last = ''; }
  reset() { for (const it of this.items) this.scene.remove(it.obj); this.items = []; this.nextAt = -30; this.last = ''; }

  spawn(type, z) {
    const g = new THREE.Group(); g.position.z = z; this.scene.add(g);
    if (this.world) this.world.clearZones.push(['paw', 'whale', 'dj', 'eyes', 'croc', 'synthcat'].includes(type) ? [z - 260, z + 60] : [z - 110, z + 25]);
    const it = { type, obj: g, z, t: 0, parts: [] };
    if (type === 'mechs') {
      // giant mechs crouched beside the route; they blast off as you approach
      const n = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1;
        const mech = buildMech(MECH_SCHEMES[Math.floor(Math.random() * MECH_SCHEMES.length)]);
        mech.position.set(side * (20 + Math.random() * 6), -2, -i * 26);
        mech.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
        mech.scale.setScalar(2.3);
        g.add(mech); it.parts.push({ mech, side, z: z - i * 26, state: 0, t: 0, vx: 0, vy: 0, delay: i * 0.6 });
      }
    }
    if (type === 'eyes') {
      const pal = [0x00e5ff, 0x9dff3c, 0xffd23a, 0xff2e88][Math.floor(Math.random() * 4)];
      const pair = new THREE.Group();
      const L = buildEye(-1, pal), R = buildEye(1, pal);
      L.position.x = -10; R.position.x = 10; pair.add(L, R);
      pair.position.set(0, 34, 0); pair.scale.setScalar(0.01);
      g.add(pair); it.parts.push({ pair, L, R, blink: 2 + Math.random() * 2, wink: 0 });
      it.follow = true; it.life = 14;
    }
    if (type === 'satellites') {
      for (let i = 0; i < 3; i++) {
        const s = buildSatellite(); const side = i % 2 ? 1 : -1;
        s.position.set(side * (7 + Math.random() * 12), 22 + Math.random() * 14, -i * 30);
        s.scale.setScalar(1.6);
        s.rotation.set(Math.random(), Math.random() * 6, Math.random() * 0.6);
        g.add(s); it.parts.push({ s, spin: (Math.random() - 0.5) * 0.6 });
      }
    }
    if (type === 'submarine') {
      const sub = buildSub(); const dir = Math.random() < 0.5 ? 1 : -1;
      sub.position.set(-dir * 60, 42 + Math.random() * 10, -60); sub.rotation.y = dir > 0 ? 0 : Math.PI; sub.scale.setScalar(3.4);
      g.add(sub); it.parts.push({ sub, dir });
      it.bubbles = [];
    }
    if (type === 'sedan') {
      // rush-hour traffic in the sky, flying head-on over you
      const n = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const car = buildSedan(); const dir = i % 2 ? 1 : -1;
        car.traverse((o) => { if (o.isMesh && o.material.color && o.material.color.getHex() === 0xfff6e0) o.material = toon([0xfff6e0, 0xffd23a, 0x00e5ff, 0xff2e88, 0x9dff3c][i % 5]); });
        car.position.set(dir * (2 + Math.random() * 6), 10 + Math.random() * 10, -30 - i * 18);
        car.rotation.y = -Math.PI / 2; car.scale.setScalar(1.5);
        g.add(car); it.parts.push({ car, dir, x0: car.position.x, y0: car.position.y, ph: Math.random() * 6 });
      }
    }
    if (type === 'paw') { const paw = buildPaw(); paw.position.set(-8, 95, 0); paw.scale.setScalar(1.7); g.add(paw); it.parts.push({ paw }); it.follow = 100; it.life = 9; }
    if (type === 'moai') {
      for (let i = 0; i < 4; i++) {
        const mo = buildMoai(); const side = i % 2 ? 1 : -1;
        mo.position.set(side * (8 + Math.random() * 9), 30 + Math.random() * 12, -i * 28); mo.scale.setScalar(1.8);
        g.add(mo); it.parts.push({ mo, ph: Math.random() * 6 });
      }
    }
    if (type === 'whale') { const wh = buildWhale(); wh.position.set(-26, 44, 0); wh.scale.setScalar(1.3); g.add(wh); it.parts.push({ wh }); it.follow = 120; it.life = 16; it.spout = 0; it.bits = []; }
    if (type === 'synthcat') {
      const cat = buildSynthCat(); cat.position.set(-52, 16, 0); cat.rotation.y = 0.28; cat.scale.setScalar(2.4); g.add(cat);
      it.parts.push({ cat }); it.follow = 58; it.life = 13; it.bars = []; it.barT = 0;
    }
    if (type === 'croc') { const cr = buildCroc(isGrid()); const gy = isGrid() ? 20 : 30; cr.position.set(-46, gy, 0); cr.rotation.y = 0.35; cr.scale.setScalar(1.15); g.add(cr); it.parts.push({ cr, gy }); it.follow = 72; it.life = 16; }
    if (type === 'dj') { const dj = buildDJ(); dj.position.set(0, 34, 0); dj.scale.setScalar(1.8); g.add(dj); it.parts.push({ dj }); it.follow = 115; it.life = 13; }
    if (type === 'bikes') { // light bikes racing alongside you, dragging light walls
      const cols = [0x00e5ff, 0xff7a00, 0xff1f3d, 0xffffff];
      for (let i = 0; i < 4; i++) {
        const bike = buildBike(cols[i]); const side = i % 2 ? 1 : -1;
        bike.position.set(side * (7 + (i >> 1) * 5), 0, -14 - i * 9); bike.scale.setScalar(1.6);
        g.add(bike); it.parts.push({ bike, side, x0: bike.position.x, z0: bike.position.z, ph: Math.random() * 6, len: 1 });
      }
      it.follow = 0; it.life = 12;
    }
    if (type === 'rings') { // giant ring gates over the track, pulsing on the beat
      const cols = [0x00e5ff, 0xff2e88, 0xff7a00, 0xffffff];
      for (let i = 0; i < 6; i++) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(9, 0.25, 6, 48), flat(cols[i % cols.length]));
        r.position.set(0, 4, -i * 22); g.add(r); it.parts.push({ r, ph: i * 0.6 });
      }
    }
    this.items.push(it);
  }

  update(playerZ, dt, songTime, beatPulse, playerX = 0) {
    for (const it of this.items) it.lookX = playerX;
    // a new oddity roughly every 130m
    if (playerZ < this.nextAt) {
      const types = (isGrid() ? ['bikes', 'rings', 'satellites', 'synthcat', 'bikes', 'rings', 'mechs', 'croc', 'synthcat'] : ['mechs', 'eyes', 'satellites', 'submarine', 'sedan', 'paw', 'moai', 'whale', 'dj', 'croc', 'mechs', 'eyes', 'paw', 'whale', 'dj', 'croc']).filter((t) => t !== this.last);
      const type = types[Math.floor(Math.random() * types.length)];
      this.last = type; this.spawn(type, playerZ - 185);
      this.nextAt = playerZ - 150;
    }
    const step = Math.floor(songTime * 12) / 12; // animate on twos
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]; it.t += dt;
      if (it.type === 'mechs') {
        for (const p of it.parts) {
          const u = p.mech.userData, dz = playerZ - p.z;
          for (const f of u.flames) f.visible = p.state === 2;
          if (p.state === 0) { // crouched, waiting
            u.pelvis.position.y = 9.5; u.legs.forEach((l) => { l.hip.rotation.x = -0.6; l.knee.rotation.x = 1.1; });
            u.arms.forEach((a) => (a.rotation.x = 0.4)); u.chest.rotation.x = 0.25;
            if (dz < 95) { p.t += dt; if (p.t > p.delay) { p.state = 1; p.t = 0; } }
          } else if (p.state === 1) { // stand + wind up
            p.t += dt; const k = Math.min(1, p.t / 0.5);
            u.pelvis.position.y = 9.5 + k * 1.5; u.legs.forEach((l) => { l.hip.rotation.x = -0.6 * (1 - k); l.knee.rotation.x = 1.1 * (1 - k); });
            if (p.t > 0.6) { p.state = 2; p.t = 0; p.vy = 6; p.vx = -p.side * 4; }
          } else { // blast off across the sky, arms swept back
            p.t += dt; p.vy += 14 * dt; p.vx += -p.side * 9 * dt;
            p.mech.position.y += p.vy * dt; p.mech.position.x += p.vx * dt; p.mech.position.z += 6 * dt;
            p.mech.rotation.z = -p.side * Math.min(0.9, p.t * 0.6) * (p.side > 0 ? -1 : 1);
            u.chest.rotation.x = Math.min(0.9, p.t * 0.8);
            u.arms.forEach((a) => (a.rotation.x = -Math.min(1.6, p.t * 1.5)));
            u.legs.forEach((l, j) => { l.hip.rotation.x = Math.sin(step * 8 + j) * 0.15 + 0.3; l.knee.rotation.x = 0.5; });
            for (const f of u.flames) f.scale.y = 1.8 + Math.random() * 1.6;
          }
        }
      }
      if (it.type === 'eyes') {
        const p = it.parts[0]; it.life -= dt;
        // stay hovering ahead of you, staring
        it.obj.position.z = playerZ - 140;
        const target = it.life > 1 ? 1 : Math.max(0, it.life);
        const sc = p.pair.scale.x + (target - p.pair.scale.x) * (1 - Math.exp(-dt * 3));
        p.blink -= dt;
        let bl = 1;
        if (p.blink < 0) { bl = Math.abs(p.blink + 0.09) / 0.09; if (p.blink < -0.18) { p.blink = 2 + Math.random() * 3; p.wink = Math.random() < 0.35; } }
        p.pair.scale.set(sc, sc, sc);
        p.L.scale.y = p.wink && p.blink < 0 ? 1 : Math.max(0.05, Math.min(1, bl));
        p.R.scale.y = Math.max(0.05, Math.min(1, bl));
        // pupils follow you side to side
        const look = THREE.MathUtils.clamp(-(it.lookX || 0) * 0.4, -2.5, 2.5);
        p.L.userData.iris.position.x += (look - p.L.userData.iris.position.x) * 0.1;
        p.R.userData.iris.position.x = p.L.userData.iris.position.x;
        p.pair.position.y = 34 + Math.sin(songTime * 1.3) * 1.2;
        if (it.life <= 0) { this.scene.remove(it.obj); this.items.splice(i, 1); continue; }
      }
      if (it.follow) it.obj.position.z = playerZ - it.follow;
      if (it.life != null && it.type !== 'eyes') { it.life -= dt; if (it.life <= 0) { this.scene.remove(it.obj); this.items.splice(i, 1); continue; } }
      if (it.type === 'bikes') {
        it.obj.position.z = playerZ; // ride along with you
        for (const p of it.parts) {
          const b = p.bike; b.position.z = p.z0 + Math.sin(it.t * 0.5 + p.ph) * 8; // jostling for position beside you
          b.position.x = p.x0 + Math.sin(it.t * 0.9 + p.ph) * 1.5;
          b.rotation.z = -Math.cos(it.t * 0.9 + p.ph) * 0.2;
          p.len = Math.min(30, p.len + dt * 20);
          const tr = b.userData.trail; tr.scale.z = p.len / 1.6; tr.position.z = 1.3 + p.len / 3.2;
        }
      }
      if (it.type === 'rings') for (const p of it.parts) { p.r.scale.setScalar(1 + beatPulse * 0.08); p.r.rotation.z += dt * 0.4; }
      if (it.type === 'paw') { // reach down out of the swirly sky, bat across the road, pull back up
        const p = it.parts[0], t = it.t;
        const down = t < 2.2 ? t / 2.2 : t < 5.5 ? 1 : Math.max(0, 1 - (t - 5.5) / 2);
        p.paw.position.y = 95 - down * 78;
        p.paw.position.x = t < 2.2 ? -8 : t < 5.5 ? -8 + Math.sin((t - 2.2) / 3.3 * Math.PI * 1.5) * 18 : p.paw.position.x;
        p.paw.rotation.z = Math.sin(t * 3) * 0.12;
      }
      if (it.type === 'moai') for (const p of it.parts) {
        p.mo.position.y += Math.sin(songTime * 0.9 + p.ph) * 0.02;
        const want = Math.atan2(playerX - p.mo.position.x, (playerZ - it.obj.position.z) - p.mo.position.z) + Math.PI;
        p.mo.rotation.y += (want - p.mo.rotation.y) * (1 - Math.exp(-dt * 1.2));
      }
      if (it.type === 'whale') {
        const p = it.parts[0]; p.wh.position.x += dt * 5; p.wh.position.y = 44 + Math.sin(it.t * 0.7) * 2;
        p.wh.userData.tail.rotation.y = Math.sin(it.t * 2.5) * 0.35;
        for (const f of p.wh.userData.flames) f.scale.y = 3 + Math.random() * 3;
        it.spout -= dt;
        if (it.spout <= 0) { // confetti spout from the blowhole
          it.spout = 1.8;
          for (let k = 0; k < 40; k++) {
            const b = new THREE.Mesh(BOX, flat([0xff1f3d, 0xffe600, 0x00e5ff, 0x9dff3c, 0xff2e88][k % 5])); b.scale.setScalar(0.5 + Math.random() * 0.5);
            b.position.copy(p.wh.position); b.position.y += 8; it.obj.add(b);
            it.bits.push({ b, v: new THREE.Vector3((Math.random() - 0.5) * 12, 14 + Math.random() * 10, (Math.random() - 0.5) * 12), life: 2.5 });
          }
        }
        for (let j = it.bits.length - 1; j >= 0; j--) { const q = it.bits[j]; q.life -= dt; q.v.y -= 12 * dt; q.b.position.addScaledVector(q.v, dt); q.b.rotation.x += dt * 6; if (q.life <= 0) { it.obj.remove(q.b); it.bits.splice(j, 1); } }
      }
      if (it.type === 'synthcat') {
        const c = it.parts[0].cat, u = c.userData;
        c.position.x += dt * 9; c.position.y = 16 + Math.sin(it.t * 2.2) * 1.4;
        c.rotation.z = Math.sin(it.t * 2.2 + 1) * 0.08;
        u.head.rotation.z = -beatPulse * 0.25;                 // head-bang
        u.head.scale.setScalar(1 + beatPulse * 0.06);
        u.legs.forEach((l, k) => (l.position.y = -1.3 + Math.sin(step * 9 + k * 1.7) * 0.25));
        u.tail.forEach((t, k) => (t.position.y = 0.6 + k * 0.2 + Math.sin(it.t * 6 - k * 0.8) * 0.35 * (k + 1) * 0.4));
        // equalizer trail: bars dropped behind it, bouncing on the beat, cyan → magenta
        it.barT -= dt;
        if (it.barT <= 0) {
          it.barT = 0.09;
          const k = it.bars.length, col = new THREE.Color(0x2ef2ff).lerp(new THREE.Color(0xff2ea8), (Math.sin(it.t * 3) + 1) / 2);
          const bar = m(BOX, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9 }), 0, 0, 0, 1.0, 1, 1.0);
          bar.position.set(c.position.x - 6.5 * 2.4, c.position.y - 0.4, 0); it.obj.add(bar);
          it.bars.push({ bar, ph: k * 0.7, life: 2.2, y: c.position.y - 0.4 });
        }
        for (let j = it.bars.length - 1; j >= 0; j--) {
          const q = it.bars[j]; q.life -= dt;
          const h = 1 + (Math.sin(it.t * 9 + q.ph) * 0.5 + 0.5) * 4.5 * (0.4 + beatPulse);
          q.bar.scale.y = h; q.bar.position.y = q.y; q.bar.material.opacity = Math.max(0, Math.min(0.9, q.life));
          if (q.life <= 0) { it.obj.remove(q.bar); q.bar.material.dispose(); it.bars.splice(j, 1); }
        }
      }
      if (it.type === 'croc') {
        const c = it.parts[0].cr, u = c.userData;
        c.position.x += dt * 5.5; c.position.y = it.parts[0].gy + Math.sin(it.t * 0.8) * 2.2;
        c.rotation.x = Math.sin(it.t * 0.6) * 0.12; c.rotation.z = Math.sin(it.t * 0.9) * 0.06;
        u.jaw.rotation.z = -(0.08 + beatPulse * 0.55);          // CHOMP on the beat
        u.head.rotation.z = beatPulse * 0.08;
        u.tail.rotation.y = Math.sin(step * 3) * 0.4;
        u.legs.forEach((l, k) => (l.rotation.z = Math.sin(step * 7 + k * 1.6) * 0.6)); // doggy paddle
      }
      if (it.type === 'dj') {
        const u = it.parts[0].dj.userData;
        for (const d of u.decks) d.rotation.y += dt * 3.5;
        for (const sp of u.speakers) sp.scale.y = 0.3 + beatPulse * 0.5;
        u.head.rotation.x = -beatPulse * 0.35;                 // nodding to the beat
        u.arm.rotation.y = Math.sin(songTime * Math.PI * 2.5) * 0.6; // scratching
      }
      if (it.type === 'satellites') for (const p of it.parts) { p.s.rotation.y += p.spin * dt; p.s.userData.blink.visible = Math.floor(songTime * 2) % 2 === 0; }
      if (it.type === 'submarine') {
        const p = it.parts[0];
        p.sub.position.x += p.dir * 9 * dt; p.sub.position.z += 4 * dt;
        p.sub.position.y += Math.sin(it.t * 0.8) * 0.01;
        p.sub.rotation.z = Math.sin(it.t * 0.8) * 0.06;
        p.sub.userData.prop.rotation.x += dt * 8;
        if (Math.random() < dt * 8) { // bubbles trail
          const b = new THREE.Mesh(SPH, flat(0xbff6ff)); const s = 0.2 + Math.random() * 0.35; b.scale.setScalar(s);
          b.position.copy(p.sub.position); b.position.x -= p.dir * 38; b.position.y += (Math.random() - 0.5) * 4; b.scale.multiplyScalar(3);
          it.obj.add(b); it.bubbles.push({ b, life: 3 });
        }
        for (let j = it.bubbles.length - 1; j >= 0; j--) { const q = it.bubbles[j]; q.life -= dt; q.b.position.y += dt * 4; if (q.life <= 0) { it.obj.remove(q.b); it.bubbles.splice(j, 1); } }
      }
      if (it.type === 'sedan') {
        for (const p of it.parts) {
          p.car.position.z += 24 * dt;
          p.car.position.x = p.x0 + Math.sin(it.t * 1.5 + p.ph) * 1.2;
          p.car.position.y = Math.max(6, p.y0 - it.t * 0.8) + Math.sin(it.t * 3 + p.ph) * 0.4;
          p.car.rotation.x = Math.sin(it.t * 2 + p.ph) * 0.12;
          for (const w of p.car.userData.wheels) if (w.geometry === CONE) w.scale.y = 0.8 + Math.random() * 0.8; else w.rotation.y += dt * 12;
        }
      }
      const far = it.type === 'mechs' ? 120 : 60;
      if (it.obj.position.z > playerZ + far) { this.scene.remove(it.obj); this.items.splice(i, 1); }
    }
  }
}
