// Giant weird background set pieces that roll past every so often:
// a guard of honour of huge knights, satellites, a sky-submarine and a flying sedan.
import * as THREE from 'three';
import { toon, flat } from './world.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 14);
const SPH = new THREE.SphereGeometry(1, 14, 10);
const CONE = new THREE.ConeGeometry(1, 1, 8);
function m(geo, mat, x, y, z, sx, sy, sz) { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.scale.set(sx, sy, sz); return o; }

// ---------------------------------------------------------------- KNIGHT
function buildKnight(flip) {
  const steel = toon(0xb8c2da), dark = toon(0x4a5068), gold = toon(0xffc23a), red = toon(0xe0102a);
  const k = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 4; k.add(hips);
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-0.6, 0, 0); legR.position.set(0.6, 0, 0);
  for (const L of [legL, legR]) { L.add(m(BOX, steel, 0, -2, 0, 0.9, 4, 1)); L.add(m(BOX, dark, 0, -3.9, -0.2, 1, 0.4, 1.5)); hips.add(L); }
  const torso = new THREE.Group(); torso.position.y = 0.3; hips.add(torso);
  torso.add(m(BOX, steel, 0, 1.8, 0, 2.4, 3.2, 1.4));                 // breastplate
  torso.add(m(BOX, red, 0, 0.6, 0, 2.5, 1.6, 1.45));                   // tabard
  torso.add(m(BOX, gold, 0, 2.6, -0.72, 0.5, 1.4, 0.05));              // cross
  torso.add(m(BOX, gold, 0, 2.8, -0.73, 1.3, 0.4, 0.05));
  for (const s of [-1, 1]) torso.add(m(SPH, steel, s * 1.5, 3.3, 0, 0.85, 0.6, 0.85)); // pauldrons
  const head = new THREE.Group(); head.position.y = 4; torso.add(head);
  head.add(m(BOX, steel, 0, 0.6, 0, 1.3, 1.5, 1.3));                   // great helm
  head.add(m(BOX, flat(0x0b0410), 0, 0.75, -0.66, 1.0, 0.14, 0.04));   // visor slit
  head.add(m(BOX, gold, 0, 1.38, 0, 1.36, 0.12, 1.36));
  head.add(m(CONE, red, 0, 2.1, 0.2, 0.35, 1.4, 0.35));                // plume
  // sword arm (salutes) — pivot at shoulder
  const arm = new THREE.Group(); arm.position.set(flip * 1.5, 3, 0); torso.add(arm);
  arm.add(m(BOX, steel, 0, -1.2, 0, 0.7, 2.6, 0.7));
  const sword = new THREE.Group(); sword.position.set(0, -2.6, 0); arm.add(sword);
  sword.add(m(BOX, flat(0xfff6e0), 0, 0, -2.6, 0.12, 0.3, 4.6));       // blade (points forward when arm is down-forward)
  sword.add(m(BOX, gold, 0, 0, -0.25, 1.1, 0.2, 0.2));                 // crossguard
  sword.add(m(BOX, dark, 0, 0, 0.25, 0.18, 0.18, 0.8));
  // shield arm
  const sh = new THREE.Group(); sh.position.set(-flip * 1.6, 2.2, -0.3); torso.add(sh);
  sh.add(m(BOX, red, 0, -0.6, -0.4, 0.2, 2.6, 1.9));
  sh.add(m(BOX, gold, 0.02 * flip, -0.6, -0.4, 0.22, 0.4, 1.95));
  k.userData = { hips, legL, legR, arm, head, torso };
  k.scale.setScalar(2.3);
  return k;
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
    if (type === 'knights') {
      // guard of honour: two rows facing the track
      for (let i = 0; i < 6; i++) for (const side of [-1, 1]) {
        const k = buildKnight(-side);
        k.position.set(side * 13, -2, -i * 15);
        k.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2; // face the corridor
        g.add(k); it.parts.push({ k, z: z - i * 15, phase: i * 0.7 + (side > 0 ? 0.35 : 0) });
      }
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
      sub.position.set(-dir * 30, 24 + Math.random() * 6, -40); sub.rotation.y = dir > 0 ? 0 : Math.PI; sub.scale.setScalar(1.4);
      g.add(sub); it.parts.push({ sub, dir });
      it.bubbles = [];
    }
    if (type === 'sedan') {
      const car = buildSedan(); const dir = Math.random() < 0.5 ? 1 : -1;
      car.position.set(dir * 4, 11, -30); car.rotation.y = -Math.PI / 2; car.scale.setScalar(1.5); // nose (+x) points at the player
      g.add(car); it.parts.push({ car, dir });
    }
    this.items.push(it);
  }

  update(playerZ, dt, songTime, beatPulse) {
    // a new oddity roughly every 130m
    if (playerZ < this.nextAt) {
      const types = ['knights', 'satellites', 'submarine', 'sedan'].filter((t) => t !== this.last);
      const type = types[Math.floor(Math.random() * types.length)];
      this.last = type; this.spawn(type, playerZ - 185);
      this.nextAt = playerZ - 150;
    }
    const step = Math.floor(songTime * 12) / 12; // animate on twos
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]; it.t += dt;
      if (it.type === 'knights') {
        for (const p of it.parts) {
          const u = p.k.userData, dz = playerZ - p.z;
          // march in place to the beat
          const w = Math.sin(step * Math.PI * 2 * 1.25 + p.phase);
          u.legL.rotation.x = w * 0.35; u.legR.rotation.x = -w * 0.35;
          u.hips.position.y = 4 + Math.abs(w) * 0.15 + beatPulse * 0.1;
          // salute when you approach: sword up to the visor, hold while you pass
          const target = dz < 55 && dz > -25 ? -Math.PI * 0.92 : -0.25;
          u.arm.rotation.x += (target - u.arm.rotation.x) * (1 - Math.exp(-dt * 4));
        }
      }
      if (it.type === 'satellites') for (const p of it.parts) { p.s.rotation.y += p.spin * dt; p.s.userData.blink.visible = Math.floor(songTime * 2) % 2 === 0; }
      if (it.type === 'submarine') {
        const p = it.parts[0];
        p.sub.position.x += p.dir * 6 * dt; p.sub.position.z += 3 * dt;
        p.sub.position.y += Math.sin(it.t * 0.8) * 0.01;
        p.sub.rotation.z = Math.sin(it.t * 0.8) * 0.06;
        p.sub.userData.prop.rotation.x += dt * 8;
        if (Math.random() < dt * 8) { // bubbles trail
          const b = new THREE.Mesh(SPH, flat(0xbff6ff)); const s = 0.2 + Math.random() * 0.35; b.scale.setScalar(s);
          b.position.copy(p.sub.position); b.position.x -= p.dir * 11; b.position.y += (Math.random() - 0.5);
          it.obj.add(b); it.bubbles.push({ b, life: 3 });
        }
        for (let j = it.bubbles.length - 1; j >= 0; j--) { const q = it.bubbles[j]; q.life -= dt; q.b.position.y += dt * 1.5; if (q.life <= 0) { it.obj.remove(q.b); it.bubbles.splice(j, 1); } }
      }
      if (it.type === 'sedan') {
        const p = it.parts[0];
        p.car.position.z += 22 * dt;
        p.car.position.x = p.dir * (4 - Math.min(it.t, 4) * 0.8) + Math.sin(it.t * 2) * 0.6;
        p.car.position.y = 11 - Math.min(it.t, 5) * 0.9 + Math.sin(it.t * 3) * 0.4;
        p.car.rotation.x = Math.sin(it.t * 2) * 0.12;
        for (const w of p.car.userData.wheels) if (w.geometry === CONE) w.scale.y = 0.8 + Math.random() * 0.8; else w.rotation.y += dt * 12;
      }
      const far = it.type === 'knights' ? 90 : 40;
      if (it.obj.position.z > playerZ + far) { this.scene.remove(it.obj); this.items.splice(i, 1); }
    }
  }
}
