// Goofy stuff: pigeon swarms, banana peels, confetti, twinkles, disco beats and GROOVE ZONES.
import * as THREE from 'three';
import { BEAT } from './audio.js';
import { LANES, toon, flat, BIOMES } from './world.js';

const SPH = new THREE.SphereGeometry(1, 10, 8);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const PLANE = new THREE.PlaneGeometry(1, 0.6);
const hitMat = new THREE.MeshBasicMaterial({ visible: false });
const RAINBOW = [0xff1f3d, 0xff7a00, 0xffe600, 0x9dff3c, 0x00e5ff, 0x7a3aff, 0xff2e88];
const confettiMats = RAINBOW.map((c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
const m = (geo, mat, x, y, z, sx, sy, sz) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.scale.set(sx, sy, sz); return o; };

function buildPigeon() {
  const g = new THREE.Group();
  const grey = toon(0x8a8aa0), dark = toon(0x4a4a60), neck = toon(0x5ad0a0);
  g.add(m(SPH, grey, 0, 0.25, 0, 0.22, 0.18, 0.3));
  const head = new THREE.Group(); head.position.set(0, 0.42, -0.22); g.add(head);
  head.add(m(SPH, neck, 0, -0.06, 0.04, 0.12, 0.12, 0.12), m(SPH, dark, 0, 0.04, 0, 0.1, 0.1, 0.1));
  head.add(m(BOX, flat(0xff9a1a), 0, 0.02, -0.12, 0.04, 0.03, 0.08), m(SPH, flat(0xff4a1a), 0.06, 0.07, -0.05, 0.025, 0.025, 0.025), m(SPH, flat(0xff4a1a), -0.06, 0.07, -0.05, 0.025, 0.025, 0.025));
  const wL = new THREE.Group(), wR = new THREE.Group();
  wL.position.set(-0.16, 0.32, 0); wR.position.set(0.16, 0.32, 0);
  wL.add(m(BOX, dark, -0.18, 0, 0.05, 0.36, 0.03, 0.26)); wR.add(m(BOX, dark, 0.18, 0, 0.05, 0.36, 0.03, 0.26));
  g.add(wL, wR, m(BOX, dark, 0, 0.26, 0.32, 0.16, 0.04, 0.2));
  const hit = new THREE.Mesh(BOX, hitMat); hit.scale.set(0.9, 0.9, 0.9); hit.position.y = 0.3; g.add(hit);
  g.userData = { head, wL, wR, hit };
  g.scale.setScalar(1.6);
  return g;
}

function buildBanana() {
  const g = new THREE.Group();
  const peel = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.11, 6, 12, Math.PI * 0.75), toon(0xffe24a));
  peel.rotation.x = -Math.PI / 2; g.add(peel);
  for (let i = 0; i < 3; i++) { // floppy peel flaps
    const f = m(BOX, toon(0xffd02a), Math.cos(i * 2.1) * 0.25, 0.03, Math.sin(i * 2.1) * 0.25 + 0.3, 0.12, 0.03, 0.4);
    f.rotation.y = i * 2.1; g.add(f);
  }
  g.add(m(SPH, toon(0x5a3a1a), 0.42, 0, 0, 0.06, 0.06, 0.06));
  g.scale.setScalar(1.5);
  return g;
}

export class Goofy {
  constructor(game) {
    this.g = game; this.scene = game.scene;
    this.flocks = []; this.bananas = []; this.bits = []; this.twinkles = [];
    this.reset();
  }
  reset() {
    for (const f of this.flocks) for (const p of f.birds) this.scene.remove(p.obj);
    for (const b of this.bananas) this.scene.remove(b.obj);
    for (const b of this.bits) this.scene.remove(b.m);
    for (const t of this.twinkles) this.scene.remove(t.obj);
    this.flocks = []; this.bananas = []; this.bits = []; this.twinkles = [];
    this.discoUntil = -1; this.groove = 0; this.grooveUntil = -1; this.nextGroove = 40 + Math.random() * 20;
    this.headCount = 0; this.trip = 0;
  }

  // ---------------- pigeons
  spawnFlock(zAhead) {
    const z = this.g.p.z - zAhead, birds = [];
    const cx = LANES[Math.floor(Math.random() * 3)];
    const n = 7 + Math.floor(Math.random() * 6);
    for (let i = 0; i < n; i++) {
      const obj = buildPigeon();
      obj.position.set(cx + (Math.random() - 0.5) * 3.2, 0, z + (Math.random() - 0.5) * 4);
      obj.rotation.y = Math.random() * 6;
      this.scene.add(obj);
      birds.push({ obj, flying: false, v: new THREE.Vector3(), ph: Math.random() * 6, alive: true });
    }
    this.flocks.push({ birds, z, scattered: false });
  }
  targets() {
    const t = [];
    for (const f of this.flocks) for (const b of f.birds) if (b.alive) t.push(b.obj.userData.hit);
    return t;
  }
  findBird(hitMesh) {
    for (const f of this.flocks) for (const b of f.birds) if (b.obj.userData.hit === hitMesh) return { f, b };
    return null;
  }
  shootBird({ f, b }, point) {
    b.alive = false; this.scene.remove(b.obj);
    this.scatter(f);
    const s = this.g.toScreen(point);
    this.g.ui.pop(Math.random() < 0.5 ? 'COO!' : 'PRRRT!', s.x, s.y - 20, '#fff6e0', 46);
    this.g.audio.sfx('coo'); this.g.addScore(60, false);
    for (let i = 0; i < 14; i++) this.bit(point, [0xffffff, 0xd8d8e8, 0x8a8aa0][i % 3], 4, 2.2, 0.08);
  }
  scatter(f) {
    if (f.scattered) return; f.scattered = true;
    for (const b of f.birds) {
      b.flying = true;
      b.v.set((Math.random() - 0.5) * 8, 5 + Math.random() * 5, -2 - Math.random() * 6);
    }
    this.g.audio.sfx('flap');
  }

  // ---------------- banana peels
  spawnBanana(x, z) {
    const lane = LANES.reduce((a, b, i) => (Math.abs(b - x) < Math.abs(LANES[a] - x) ? i : a), 0);
    const obj = buildBanana(); obj.position.set(LANES[lane], 0.05, z); obj.rotation.y = Math.random() * 6;
    this.scene.add(obj); this.bananas.push({ obj, lane });
  }

  // ---------------- confetti, twinkles
  bit(pos, color, force, life = 2.2, size = 0.12) {
    const mesh = new THREE.Mesh(PLANE, typeof color === 'number' ? new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }) : color);
    mesh.scale.setScalar(size); mesh.position.copy(pos);
    mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    this.scene.add(mesh);
    this.bits.push({ m: mesh, v: new THREE.Vector3((Math.random() - 0.5) * force * 2, Math.random() * force * 1.4 + 1, (Math.random() - 0.5) * force * 2), spin: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10), life });
    if (this.bits.length > 500) this.scene.remove(this.bits.shift().m);
  }
  confetti(pos, n = 90) {
    for (let i = 0; i < n; i++) this.bit(pos, confettiMats[i % confettiMats.length], 7, 2.6, 0.14);
    this.g.audio.sfx('party');
  }
  twinkle(pos) {
    const obj = new THREE.Group();
    const mat = flat(0xfff6e0), mat2 = flat(0xffe600);
    obj.add(m(BOX, mat, 0, 0, 0, 1.6, 0.18, 0.05), m(BOX, mat, 0, 0, 0, 0.18, 1.6, 0.05));
    const d = new THREE.Group(); d.add(m(BOX, mat2, 0, 0, 0, 0.9, 0.12, 0.05), m(BOX, mat2, 0, 0, 0, 0.12, 0.9, 0.05)); d.rotation.z = Math.PI / 4; obj.add(d);
    obj.position.copy(pos); obj.scale.setScalar(0.01);
    this.scene.add(obj); this.twinkles.push({ obj, t: 0 });
    this.g.audio.sfx('twinkle');
  }

  // ---------------- disco + groove
  startDisco() {
    this.discoUntil = this.g.audio.beat + 4;
    this.g.ui.pop('DISCO!', innerWidth / 2, innerHeight * 0.3, '#ff2e88', 76, true);
    this.g.audio.sfx('party');
  }
  get discoOn() { return this.g.audio.beat < this.discoUntil; }

  update(realDt, dt) {
    const g = this.g, p = g.p, beat = g.audio.beat;
    // pigeons: peck on twos, scatter when you get close (or someone shoots near them)
    const step = Math.floor(g.time * 10) / 10;
    for (let i = this.flocks.length - 1; i >= 0; i--) {
      const f = this.flocks[i];
      if (!f.scattered && p.z - f.z < 13) this.scatter(f);
      let any = false;
      for (const b of f.birds) {
        if (!b.alive) continue; any = true;
        const u = b.obj.userData;
        if (!b.flying) { u.head.rotation.x = Math.sin(step * 7 + b.ph) > 0.4 ? 0.7 : 0; }
        else {
          b.v.y += 3 * dt; b.obj.position.addScaledVector(b.v, dt);
          const fl = Math.sin(g.time * 30 + b.ph) * 0.9;
          u.wL.rotation.z = fl; u.wR.rotation.z = -fl;
          b.obj.rotation.y = Math.atan2(-b.v.x, -b.v.z);
          if (b.obj.position.y > 30) { b.alive = false; this.scene.remove(b.obj); }
        }
        if (b.obj.position.z > p.z + 6) { b.alive = false; this.scene.remove(b.obj); }
      }
      if (!any) this.flocks.splice(i, 1);
    }
    // bananas: slip if you run over one on the ground
    for (let i = this.bananas.length - 1; i >= 0; i--) {
      const b = this.bananas[i], dz = p.z - b.obj.position.z;
      if (Math.abs(dz) < 0.9 && Math.abs(p.x - b.obj.position.x) < 1 && p.y < 0.3 && !p.wall) {
        p.spin = Math.PI * 2; this.scene.remove(b.obj); this.bananas.splice(i, 1);
        g.ui.pop('WHOOPS!', innerWidth / 2, innerHeight * 0.45, '#ffe600', 64, true);
        g.audio.sfx('whistle'); g.haptics([10, 20, 10, 20, 10]);
        continue;
      }
      if (dz < -6) { this.scene.remove(b.obj); this.bananas.splice(i, 1); }
    }
    // confetti / feathers flutter down
    for (let i = this.bits.length - 1; i >= 0; i--) {
      const q = this.bits[i]; q.life -= dt;
      q.v.y -= 6 * dt; q.v.multiplyScalar(Math.exp(-dt * 1.6));
      q.m.position.addScaledVector(q.v, dt);
      q.m.position.x += Math.sin(q.life * 6 + i) * dt * 0.6;
      q.m.rotation.x += q.spin.x * dt; q.m.rotation.y += q.spin.y * dt;
      if (q.m.position.y < 0.02) { q.m.position.y = 0.02; q.v.set(0, 0, 0); }
      if (q.life <= 0) { this.scene.remove(q.m); this.bits.splice(i, 1); }
    }
    for (let i = this.twinkles.length - 1; i >= 0; i--) {
      const t = this.twinkles[i]; t.t += realDt;
      const k = t.t / 0.45; t.obj.scale.setScalar(Math.sin(Math.min(1, k) * Math.PI) * 2.4 + 0.01);
      t.obj.rotation.z += realDt * 6; t.obj.lookAt(g.camera.position);
      if (k >= 1) { this.scene.remove(t.obj); this.twinkles.splice(i, 1); }
    }

    // GROOVE ZONE every ~minute in runs
    if (g.mode === 'run' && !p.dead) {
      this.nextGroove -= dt;
      if (this.nextGroove <= 0 && !g.bulletTime) {
        this.grooveUntil = beat + 16; this.nextGroove = 50 + Math.random() * 25;
        g.ui.pop('GROOVE ZONE', innerWidth / 2, innerHeight * 0.3, '#9dff3c', 80, true);
        g.audio.sfx('slowIn');
      }
    }
    this.groove = beat < this.grooveUntil ? 1 : 0;
    const disco = this.discoOn;
    const tripTarget = this.groove ? 1 : disco ? 0.7 : 0;
    this.trip += (tripTarget - this.trip) * (1 - Math.exp(-realDt * 3));

    // disco / groove lighting: rainbow per beat
    const w = g.world, B = BIOMES[w.biome];
    if (disco || this.groove) {
      const c = new THREE.Color(RAINBOW[Math.floor(beat) % RAINBOW.length]);
      w.hemi.color.copy(c); w.sun.color.copy(new THREE.Color(RAINBOW[(Math.floor(beat) + 3) % RAINBOW.length]));
      this.lit = true;
    } else if (this.lit) { w.hemi.color.set(B.hemiSky); w.sun.color.set(B.sun); this.lit = false; }
    w.skyU.kaleido.value += ((this.groove ? 1 : 0) - w.skyU.kaleido.value) * (1 - Math.exp(-realDt * 2));
  }
}
