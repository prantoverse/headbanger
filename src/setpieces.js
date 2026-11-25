// Giant weird background set pieces that roll past every so often:
// fever-dream set pieces: blasting-off giant mechs, staring sky eyes, sky traffic, a huge sub, satellites.
import * as THREE from 'three';
import { toon, flat } from './world.js';

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

export class SetPieces {
  constructor(scene, world) { this.scene = scene; this.world = world; this.items = []; this.nextAt = -60; this.last = ''; }
  reset() { for (const it of this.items) this.scene.remove(it.obj); this.items = []; this.nextAt = -30; this.last = ''; }

  spawn(type, z) {
    const g = new THREE.Group(); g.position.z = z; this.scene.add(g);
    if (this.world) this.world.clearZones.push([z - 110, z + 25]);
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
    this.items.push(it);
  }

  update(playerZ, dt, songTime, beatPulse, playerX = 0) {
    for (const it of this.items) it.lookX = playerX;
    // a new oddity roughly every 130m
    if (playerZ < this.nextAt) {
      const types = ['mechs', 'eyes', 'satellites', 'submarine', 'sedan', 'mechs', 'eyes'].filter((t) => t !== this.last);
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
