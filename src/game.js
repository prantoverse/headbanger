// Core gameplay: player, enemies, weapons, bullets, hazards, power-ups, scoring.
import * as THREE from 'three';
import { BEAT, LOOP_LEN } from './audio.js';
import { LANES, WALL_X, toon, flat, BIOMES } from './world.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 10);
const SPH = new THREE.SphereGeometry(1, 10, 8);
const box = (mat, sx, sy, sz, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(BOX, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); return m; };
const hitMat = new THREE.MeshBasicMaterial({ visible: false });

export const WEAPONS = {
  pistol: { name: 'PISTOL', ammo: 10, rate: 0.13, sfx: 'pistol' },
  shotgun: { name: 'SHOTGUN', ammo: 4, rate: 0.45, sfx: 'shotgun', spread: 2.8 },
  smg: { name: 'MACHINE PISTOL', ammo: 30, rate: 0.085, sfx: 'smg', auto: true },
  sword: { name: 'KATANA', ammo: Infinity, rate: 0.25, sfx: 'slash', melee: 11 },
  fists: { name: 'FISTS', ammo: Infinity, rate: 0.3, sfx: 'punch', melee: 5 },
};

// Superhot-style hot reds/oranges so goons pop against the purple/blue worlds
const ENEMY = {
  pistol: { jacket: 0xff2a14, skin: 0xff6a3a, pants: 0xa80c06, trim: 0xffb020, weapon: 'pistol', score: 100 },
  smg: { jacket: 0xff4a0a, skin: 0xff7a40, pants: 0xb01a04, trim: 0xffe600, weapon: 'smg', score: 120 },
  shotgun: { jacket: 0xd8140a, skin: 0xff5a2a, pants: 0x7a0804, trim: 0xff8a00, weapon: 'shotgun', score: 150 },
  sword: { jacket: 0xff7a00, skin: 0xff9a4a, pants: 0xc02a04, trim: 0xfff6e0, weapon: 'sword', score: 130 },
};
const hotCache = new Map();
function hot(color) { // toon + self-glow so they stay bright in dark biomes
  if (!hotCache.has(color)) {
    const m = toon(color).clone();
    m.emissive = new THREE.Color(color).multiplyScalar(0.45);
    hotCache.set(color, m);
  }
  return hotCache.get(color);
}
const TETRA = new THREE.TetrahedronGeometry(1, 0);

function buildWeaponModel(type, scale = 1) {
  const g = new THREE.Group();
  const dark = toon(0x4a4a66), metal = toon(0xb8c2da), acc = flat(0xffe600);
  if (type === 'pistol') { g.add(box(dark, 0.09, 0.12, 0.34, 0, 0.03, -0.1), box(dark, 0.08, 0.2, 0.1, 0, -0.1, 0.02), box(acc, 0.1, 0.02, 0.05, 0, 0.1, -0.24)); }
  if (type === 'smg') { g.add(box(toon(0x3a2a5a), 0.1, 0.14, 0.42, 0, 0.03, -0.12), box(dark, 0.08, 0.26, 0.09, 0, -0.14, -0.06), box(acc, 0.11, 0.02, 0.05, 0, 0.11, -0.3)); }
  if (type === 'shotgun') { g.add(box(toon(0x5a3420), 0.12, 0.14, 0.7, 0, 0.02, -0.2), box(metal, 0.07, 0.07, 0.6, 0, 0.1, -0.3), box(toon(0x5a3420), 0.1, 0.2, 0.14, 0, -0.1, 0.12)); }
  if (type === 'sword') { g.add(box(flat(0xfff6e0), 0.04, 0.09, 1.1, 0, 0, -0.6), box(toon(0xff2e88), 0.05, 0.08, 0.26, 0, 0, 0.08), box(acc, 0.2, 0.04, 0.04, 0, 0, -0.06)); }
  if (type === 'fists') { g.add(box(toon(0xffc9a0), 0.16, 0.12, 0.16, 0, 0, -0.05), box(flat(0xff2e88), 0.17, 0.05, 0.17, 0, 0.04, -0.05)); }
  g.scale.setScalar(scale);
  return g;
}

function buildEnemy(type) {
  const d = ENEMY[type];
  const g = new THREE.Group();
  const jacket = hot(d.jacket), skin = hot(d.skin), pants = hot(d.pants), trim = flat(d.trim);
  const torso = box(jacket, 0.62, 0.72, 0.36, 0, 1.18, 0);
  const tie = box(trim, 0.08, 0.5, 0.02, 0, 1.2, -0.19);
  const head = new THREE.Group(); head.position.set(0, 1.78, 0);
  head.add(box(skin, 0.36, 0.4, 0.36));
  head.add(box(hot(d.pants), 0.4, 0.12, 0.4, 0, 0.18, 0));        // hair/hat
  head.add(box(flat(0x0b0410), 0.38, 0.08, 0.02, 0, 0.03, -0.19));  // shades
  head.add(box(trim, 0.38, 0.02, 0.02, 0, 0.07, -0.2));
  const legL = box(pants, 0.22, 0.78, 0.24, -0.15, 0.4, 0), legR = box(pants, 0.22, 0.78, 0.24, 0.15, 0.4, 0);
  const armR = new THREE.Group(); armR.position.set(0.38, 1.46, 0);
  armR.add(box(jacket, 0.17, 0.17, 0.6, 0, 0, -0.26)); armR.add(box(skin, 0.14, 0.14, 0.12, 0, 0, -0.58));
  const gun = buildWeaponModel(d.weapon, 1.1); gun.position.set(0, 0.04, -0.62); armR.add(gun);
  const armL = new THREE.Group(); armL.position.set(-0.38, 1.46, 0);
  armL.add(box(jacket, 0.17, 0.6, 0.17, 0, -0.26, 0));
  g.add(torso, tie, head, legL, legR, armR, armL);
  // hitboxes (invisible, generous)
  const hHead = new THREE.Mesh(BOX, hitMat); hHead.scale.set(0.62, 0.62, 0.62); hHead.position.set(0, 1.8, 0); hHead.userData.part = 'head';
  const hBody = new THREE.Mesh(BOX, hitMat); hBody.scale.set(1.0, 1.55, 0.8); hBody.position.set(0, 0.85, 0); hBody.userData.part = 'body';
  g.add(hHead, hBody);
  g.userData = { torso, head, legL, legR, armR, armL, gun, hHead, hBody };
  g.scale.setScalar(1.15);
  return g;
}

class Pool {
  constructor(make) { this.make = make; this.free = []; }
  get() { return this.free.pop() || this.make(); }
  put(o) { this.free.push(o); }
}

export class Game {
  constructor({ scene, camera, audio, world, ui, post, haptics }) {
    Object.assign(this, { scene, camera, audio, world, ui, post, haptics });
    this.ray = new THREE.Raycaster();
    this.tmpV = new THREE.Vector3(); this.tmpV2 = new THREE.Vector3();
    this.viewmodel = new THREE.Group(); camera.add(this.viewmodel);
    this.particles = [];
    this.partPool = new Pool(() => new THREE.Mesh(BOX, flat(0xffffff)));
    this.markGroup = new THREE.Group(); scene.add(this.markGroup);
    this.running = false;
  }

  // ------------------------------------------------------------ lifecycle
  reset() {
    for (const e of this.enemies || []) if (e.laser) this.scene.remove(e.laser);
    for (const list of [this.enemies, this.bullets, this.hazards, this.pickups, this.thrown, this.tracers]) if (list) for (const o of list) this.scene.remove(o.obj || o.mesh || o);
    for (const p of this.particles) { this.scene.remove(p.m); this.partPool.put(p.m); }
    this.enemies = []; this.bullets = []; this.hazards = []; this.pickups = []; this.thrown = []; this.tracers = []; this.particles = [];
    this.marks = []; this.markGroup.clear();
    this.p = {
      z: 0, x: 0, lane: 1, y: 0, vy: 0, slide: 0, wall: 0, wallSide: 0, roll: 0,
      armor: 1, regen: 0, dead: false, invuln: 0,
      weapon: 'pistol', ammo: WEAPONS.pistol.ammo, cool: 0, kick: 0,
    };
    this.speed = 11;
    this.time = 0;
    this.score = 0; this.combo = 1; this.comboTimer = 0;
    this.stats = { kills: 0, heads: 0, beats: 0, dist: 0, best: 0 };
    this.timeScale = 1; this.targetScale = 1;
    this.focus = 0;             // seconds of bullet time remaining (real)
    this.bulletTime = false; this.focusKills = 0; this.alertKey = '';
    this.headStreak = 0; this.focusCharges = 0; this.heat = 1; this.ui.setHeat(1);
    for (const sh of this.shards || []) this.scene.remove(sh.m);
    this.shards = []; this.ui.setStreak(0, false); this.ui.setRicochet(false);
    this.aim = { x: 0, y: 0 }; this.aimS = { x: 0, y: 0 };
    this.hitstop = 0; this.autoSlow = 0; this.autoSlowCd = 0; this.impact = 0; this.hurtFx = 0;
    this.ricochet = false;
    this.last16 = -1; this.lastBar = -1; this.barCount = 0;
    this.biomeIndex = 0; this.lap = 0; this.nextPortalBar = 36;
    this.setWeapon('pistol', WEAPONS.pistol.ammo);
    this.ui.setArmor(1); this.ui.setScore(0, 1); this.ui.setFocus(0, false);
  }

  start(mode = 'run') { this.mode = mode; this.reset(); this.running = true; }
  emit(type, data = {}) { if (this.onEvent) this.onEvent(type, data); }

  // ------------------------------------------------------------ weapons
  setWeapon(type, ammo) {
    this.p.weapon = type; this.p.ammo = ammo;
    this.viewmodel.clear();
    const arm = (side) => {
      const a = new THREE.Group();
      const sl = box(toon(0x14101e), 0.08, 0.08, 0.2, 0, -0.07, 0.1); sl.rotation.x = 0.5; a.add(sl);   // sleeve angled down
      a.add(box(flat(0xff2e88), 0.085, 0.085, 0.03, 0, -0.035, 0.03));  // cuff
      a.add(box(toon(0xffc9a0), 0.065, 0.075, 0.08, 0, -0.03, -0.02));  // hand
      return a;
    };
    const m = new THREE.Group();
    const gun = buildWeaponModel(type, 0.52);
    m.add(gun, arm());
    m.position.set(0.22, -0.21, -0.52);
    m.rotation.set(0.04, 0.2, -0.05);
    if (type === 'sword') { gun.rotation.set(1.1, 0, 0); gun.position.set(0, 0.02, -0.02); m.position.set(0.24, -0.24, -0.5); }
    if (type === 'fists') { const l = arm(); l.add(buildWeaponModel('fists', 0.55)); l.position.set(-0.2, -0.2, -0.5); l.rotation.y = -0.16; this.viewmodel.add(l); m.add(buildWeaponModel('fists', 0.55)); }
    this.viewmodel.add(m); this.vm = m;
    this.ui.setWeapon(WEAPONS[type].name, ammo, WEAPONS[type].ammo);
  }

  // ------------------------------------------------------------ input actions
  lane(dir) {
    const p = this.p; if (p.dead) return;
    if (p.wall) { // jump off the wall back toward the middle
      if (dir === -p.wallSide) { p.wall = 0; p.vy = 4; p.lane = 1; }
      return;
    }
    const before = p.lane;
    p.lane = Math.max(0, Math.min(2, p.lane + dir));
    if (p.lane !== before) this.emit('lane', { dir });
    this.audio.sfx('jump');
  }
  jump() {
    const p = this.p; if (p.dead) return;
    if (p.y > 0.05 || p.wall) return;
    const side = p.lane === 0 ? -1 : p.lane === 2 ? 1 : 0;
    if (side && this.world.wallAt(p.z - 2, side) && this.world.wallAt(p.z - 10, side)) {
      p.wall = 1.15; p.wallSide = side; p.vy = 0; // wall run!
      this.ui.pop('WALL RUN!', innerWidth / 2 + side * innerWidth * 0.22, innerHeight * 0.45, '#00e5ff', 40);
      this.audio.sfx('jump'); this.triggerAutoSlow(0.5, 0.45); this.addScore(50, false);
      this.haptics([15, 30, 15]); this.emit('wallrun');
      return;
    }
    p.vy = 7.2; p.slide = 0; this.audio.sfx('jump'); this.emit('jump');
  }
  slide() {
    const p = this.p; if (p.dead) return;
    if (p.wall) { p.wall = 0; return; }
    if (p.y > 0.05) p.vy = -14; // slam down
    p.slide = 0.62; this.emit('slide');
  }

  // world-space pick at screen point
  pick(sx, sy, assist = true) {
    const ndc = new THREE.Vector2((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const targets = [];
    for (const e of this.enemies) if (e.alive && e.landed) targets.push(e.obj.userData.hHead, e.obj.userData.hBody);
    for (const h of this.hazards) if (h.kind === 'canister' && !h.broken) targets.push(h.hit);
    for (const pk of this.pickups) targets.push(pk.hit);
    const hits = this.ray.intersectObjects(targets, false);
    if (hits.length) {
      const o = hits[0].object;
      const e = this.enemies.find((e) => e.obj.userData.hHead === o || e.obj.userData.hBody === o);
      if (e) return { enemy: e, part: o.userData.part, point: hits[0].point };
      const h = this.hazards.find((h) => h.hit === o); if (h) return { canister: h, point: hits[0].point };
      const pk = this.pickups.find((pk) => pk.hit === o); if (pk) return { pickup: pk, point: hits[0].point };
    }
    if (!assist) return null;
    // aim assist: nearest head on screen
    const rad = matchMedia('(pointer:coarse)').matches ? 80 : 42;
    let best = null, bd = rad;
    for (const e of this.enemies) {
      if (!e.alive || !e.landed) continue;
      e.obj.userData.head.getWorldPosition(this.tmpV);
      if (this.tmpV.z > this.p.z - 1.5) continue;
      this.tmpV.project(this.camera);
      const hx = (this.tmpV.x + 1) / 2 * innerWidth, hy = (1 - this.tmpV.y) / 2 * innerHeight;
      const dh = Math.hypot(hx - sx, hy - sy);
      const db = Math.hypot(hx - sx, hy + 40 - sy); // body a bit below head
      const dd = Math.min(dh, db);
      if (dd < bd) { bd = dd; best = { enemy: e, part: dh < rad * 0.35 ? 'head' : 'body', point: e.obj.position.clone().setY(1.4) }; }
    }
    return best;
  }

  fire(sx, sy) {
    const p = this.p; if (p.dead || !this.running) return;
    if (this.bulletTime) return this.focusShot(sx, sy);
    if (p.cool > 0) return;
    const W = WEAPONS[p.weapon];
    if (p.ammo <= 0) { this.audio.sfx('empty'); p.cool = 0.15; this.ui.flashThrow(); return; }
    const t = this.pick(sx, sy);

    // pickups: tap a dropped weapon to snatch it
    if (t && t.pickup) { this.grabPickup(t.pickup); return; }

    if (W.melee) {
      p.cool = W.rate;
      if (t && t.enemy && t.enemy.obj.position.z > p.z - W.melee && t.enemy.obj.position.z < p.z + 0.5) {
        this.audio.sfx(W.sfx); this.vmKick(0.6);
        this.killEnemy(t.enemy, t.part, { melee: true, point: t.point });
      } else { this.audio.sfx('throw'); this.vmKick(0.3); }
      return;
    }

    p.cool = W.rate; p.ammo--; this.ui.setAmmo(p.ammo);
    this.audio.sfx(W.sfx); this.vmKick(p.weapon === 'shotgun' ? 1 : 0.5);
    this.haptics(p.weapon === 'shotgun' ? 40 : 12);
    this.post.u.shift.value = p.weapon === 'shotgun' ? 7 : 4;
    const muzzle = this.muzzlePos();

    if (t && t.canister) { this.tracer(muzzle, t.point); this.breakCanister(t.canister); return; }
    if (!t || !t.enemy) {
      // miss: tracer into the distance
      const ndc = new THREE.Vector2((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1);
      this.ray.setFromCamera(ndc, this.camera);
      this.tracer(muzzle, this.ray.ray.at(60, new THREE.Vector3()));
      return;
    }
    this.tracer(muzzle, t.point);
    if (this.ricochet) { this.ricochet = false; this.ui.setRicochet(false); this.ricochetChain(t.enemy, t.part); return; }
    const killed = [t.enemy];
    if (p.weapon === 'shotgun') {
      for (const e of this.enemies) if (e !== t.enemy && e.alive && e.landed && e.obj.position.distanceTo(t.enemy.obj.position) < W.spread) killed.push(e);
    }
    killed.forEach((e, i) => this.killEnemy(e, i === 0 ? t.part : 'body', { multi: killed.length, point: i === 0 ? t.point : null }));
    if (killed.length > 1) this.multiPop(killed.length);
  }

  throwWeapon(sx, sy) {
    const p = this.p; if (p.dead || !this.running || p.weapon === 'fists') return;
    let t = sx != null ? this.pick(sx, sy) : null;
    if (!t || !t.enemy) {
      // auto-target nearest enemy ahead
      let best = null, bd = 40;
      for (const e of this.enemies) {
        if (!e.alive || !e.landed) continue;
        const dz = p.z - e.obj.position.z; if (dz < 1 || dz > bd) continue;
        bd = dz; best = { enemy: e, part: 'body' };
      }
      t = best;
    }
    const g = buildWeaponModel(p.weapon, 1.6);
    this.camera.getWorldPosition(g.position); g.position.y -= 0.2; g.position.x += 0.3;
    this.scene.add(g);
    const target = t ? t.enemy.obj.position.clone().setY(t.part === 'head' ? 1.8 : 1.25) : this.camera.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0, -30));
    this.thrown.push({ obj: g, from: g.position.clone(), target, enemy: t && t.enemy, part: t && t.part, t: 0, dur: 0.32 });
    this.audio.sfx('throw'); this.haptics(20);
    this.setWeapon('fists', Infinity);
  }

  grabPickup(pk) {
    this.scene.remove(pk.obj); this.pickups.splice(this.pickups.indexOf(pk), 1);
    this.setWeapon(pk.type, WEAPONS[pk.type].ammo);
    this.audio.sfx('pickup'); this.haptics(15);
    const s = this.toScreen(pk.obj.position);
    this.ui.pop('SNATCHED!', s.x, s.y, '#ffe600', 32);
  }

  // ------------------------------------------------------------ bullet time
  breakCanister(h) {
    h.broken = true; this.scene.remove(h.obj);
    this.audio.sfx('glass'); this.spray(h.obj.position, h.type === 'chrono' ? 0xffe600 : 0xff2e88, 24, 6);
    const s = this.toScreen(h.obj.position);
    if (h.type === 'chrono') {
      this.ui.pop('BULLET TIME', s.x, s.y, '#ffe600', 54, true);
      this.enterBulletTime();
    } else {
      this.ricochet = true; this.ui.setRicochet(true);
      this.ui.pop('RICOCHET ROUND', s.x, s.y, '#ff2e88', 46, true);
      this.audio.sfx('ricochet');
    }
    this.haptics([30, 40, 60]);
  }
  enterBulletTime() {
    this.bulletTime = true; this.focus = 5; this.focusKills = 0;
    this.targetScale = 0.2; this.audio.sfx('tapeStop');
    this.ui.setFocus(1, true); this.ui.setMarking(true);
  }
  // FOCUS: every click is a free, instant shot. Just point and click.
  focusShot(sx, sy) {
    const p = this.p;
    if (p.cool > 0) return;
    p.cool = 0.09;
    const t = this.pick(sx, sy);
    const muzzle = this.muzzlePos();
    this.audio.sfx(p.weapon === 'shotgun' ? 'shotgun' : 'pistol'); this.vmKick(0.6); this.haptics(15);
    if (t && t.canister) { this.tracer(muzzle, t.point); this.breakCanister(t.canister); return; }
    if (t && t.pickup) { this.grabPickup(t.pickup); return; }
    if (!t || !t.enemy) {
      const ndc = new THREE.Vector2((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1);
      this.ray.setFromCamera(ndc, this.camera);
      this.tracer(muzzle, this.ray.ray.at(60, new THREE.Vector3()), 0x00e5ff);
      return;
    }
    this.tracer(muzzle, t.point, 0x00e5ff);
    this.focusKills++;
    this.killEnemy(t.enemy, t.part, { point: t.point });
    this.hitstop = 0;
    const s2 = this.toScreen(t.point);
    if (this.focusKills > 1) this.ui.pop('×' + this.focusKills, s2.x + 50, s2.y - 50, '#00e5ff', 40);
  }
  execute() { if (this.bulletTime) this.exitBulletTime(); }
  exitBulletTime() {
    this.emit('bulletTimeEnd', { kills: this.focusKills || 0 });
    if (this.focusKills > 1) this.multiPop(this.focusKills);
    this.bulletTime = false; this.targetScale = 1; this.focus = 0; this.focusKills = 0;
    this.audio.sfx('tapeStart'); this.ui.setFocus(0, false); this.ui.setMarking(false);
  }
  triggerAutoSlow(scale, dur) {
    if (this.autoSlowCd > 0 || this.bulletTime) return;
    this.autoSlow = dur; this.autoSlowScale = scale; this.autoSlowCd = 2.0;
  }
  ricochetChain(first, part) {
    const chain = [first]; let cur = first;
    while (chain.length < 5) {
      let best = null, bd = 30;
      for (const e of this.enemies) {
        if (!e.alive || !e.landed || chain.includes(e)) continue;
        const d = e.obj.position.distanceTo(cur.obj.position); if (d < bd) { bd = d; best = e; }
      }
      if (!best) break; chain.push(best); cur = best;
    }
    this.autoSlow = 0.25 * chain.length + 0.2; this.autoSlowScale = 0.25; this.autoSlowCd = 2;
    chain.forEach((e, i) => setTimeout(() => {
      if (!this.running) return;
      const prev = i ? chain[i - 1].obj.position.clone().setY(1.5) : this.muzzlePos();
      this.tracer(prev, e.obj.position.clone().setY(1.6), 0xff2e88);
      this.audio.sfx('ricochet');
      if (e.alive) this.killEnemy(e, i === 0 ? part : 'head', { multi: chain.length });
      if (i === chain.length - 1 && chain.length > 1) this.multiPop(chain.length, 'RICOCHET ×' + chain.length);
    }, i * 220));
  }

  // ------------------------------------------------------------ combat helpers
  muzzlePos() { return (this.vm || this.camera).localToWorld(new THREE.Vector3(0, 0.06, -0.4)); }
  onScreen(e) {
    this.tmpV.copy(e.obj.position); this.tmpV.y += 1.3; this.tmpV.project(this.camera);
    return this.tmpV.z < 1 && Math.abs(this.tmpV.x) < 0.95 && Math.abs(this.tmpV.y) < 0.95;
  }
  // red Superhot laser sight from a goon's gun to you; flares right before the shot
  updateLaser(e, dz) {
    const armed = e.alive && e.landed && !e.passive && e.type !== 'sword' && dz > 8 && dz < 24 && this.onScreen(e) && !this.bulletTime;
    if (!armed) { if (e.laser) e.laser.visible = false; return; }
    if (!e.laser) {
      e.laser = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ color: 0xff1f3d, transparent: true, opacity: 0.3, depthWrite: false, fog: false }));
      this.scene.add(e.laser);
    }
    const a = e.obj.userData.gun.getWorldPosition(this.tmpV2);
    const b = this.camera.position.clone(); b.y -= 0.25;
    const dir = b.clone().sub(a); const len = Math.max(0.1, dir.length() - 1.6);
    dir.normalize();
    e.laser.visible = true;
    e.laser.position.copy(a).addScaledVector(dir, len / 2);
    e.laser.lookAt(b);
    const w = 0.025 + (e.warn > 0 ? 0.03 : 0);
    e.laser.scale.set(w, w, len);
    e.laser.material.opacity = e.warn > 0 ? 0.9 : 0.22 + this.world.beatPulse * 0.15;
  }
  setAim(sx, sy) { this.aim.x = (sx / innerWidth) * 2 - 1; this.aim.y = -(sy / innerHeight) * 2 + 1; }
  vmKick(k) { this.p.kick = Math.min(1.2, this.p.kick + k); }
  toScreen(v) { const s = v.clone().project(this.camera); return { x: (s.x + 1) / 2 * innerWidth, y: (1 - s.y) / 2 * innerHeight }; }

  onBeatQuality() {
    const b = this.audio.beat; const d = Math.abs(b - Math.round(b));
    return d < 0.14 ? 'perfect' : d < 0.28 ? 'good' : null;
  }

  killEnemy(e, part, opt = {}) {
    if (!e.alive) return;
    e.alive = false; e.deadT = 0;
    const head = part === 'head';
    const beat = this.onBeatQuality();
    this.emit('kill', { head, beat, thrown: !!opt.thrown, melee: !!opt.melee, exec: this.executing });
    if (this.executing) this.execKills = (this.execKills || 0) + 1;
    let pts = ENEMY[e.type].score * (head ? 2 : 1) * (beat === 'perfect' ? 1.5 : beat === 'good' ? 1.2 : 1);
    if (opt.thrown) pts *= 1.5;
    if (opt.melee) pts *= 1.3;
    this.combo = Math.min(16, this.combo + 1); this.comboTimer = 4;
    this.addScore(Math.round(pts));
    this.stats.kills++; if (head) this.stats.heads++; if (beat) this.stats.beats++;
    const pos = e.obj.position.clone().setY(head ? 1.8 : 1.2);
    const s = this.toScreen(pos);
    const words = opt.melee ? ['SLASH!', 'THWACK!', 'KRAK!'] : opt.thrown ? ['BONK!', 'CATCH!', 'YOINK!'] : head ? ['BLAM!', 'HEADSHOT!', 'BOOM!'] : ['BANG!', 'POW!', 'BLAT!'];
    const w = words[Math.floor(Math.random() * words.length)];
    this.ui.pop(w, s.x, s.y - 20, head ? '#ff1f3d' : '#ffe600', head ? 58 : 42, head);
    if (beat === 'perfect') this.ui.pop('ON BEAT', s.x, s.y + 32, '#00e5ff', 24);
    this.ui.burst(s.x, s.y, head ? '#ff2e88' : '#ffe600');
    this.audio.sfx(head ? 'headshot' : 'hit');
    this.spray(opt.point || pos, 0xfff6e0, head ? 10 : 5, head ? 8 : 5);
    if (head) { this.hitstop = 0.07; this.impact = 1; this.haptics([25, 20, 45]); }
    else this.haptics(18);
    // SHATTER from the exact hit point
    this.shatter(e, opt.point || pos, head);
    // headshot streak → FOCUS charge
    if (!this.bulletTime) {
      if (head) {
        this.headStreak++;
        if (this.headStreak % 3 === 0 && !this.focusCharges) {
          this.focusCharges = 1; this.audio.sfx('slowIn');
          this.ui.pop('FOCUS READY!', innerWidth / 2, innerHeight * 0.42, '#00e5ff', 60, true);
          this.haptics([20, 30, 20, 30, 60]);
        }
        if (this.headStreak === 6) { this.ricochet = true; this.ui.setRicochet(true); this.ui.pop('RICOCHET LOADED', innerWidth / 2, innerHeight * 0.5, '#ff2e88', 40, true); }
      } else this.headStreak = 0;
      this.ui.setStreak(this.headStreak % 3 || (this.focusCharges ? 3 : 0), !!this.focusCharges);
    }
    // drop weapon (not for throw kills — you catch it)
    if (!opt.thrown && !opt.melee) this.dropPickup(ENEMY[e.type].weapon, e.obj.position);
    this.ui.setScore(this.score, this.combo);
  }

  // Superhot-style: every visible block of the goon becomes shards flung away from the hit point
  shatter(e, hit, head) {
    const o = e.obj; o.updateMatrixWorld(true);
    const wp = new THREE.Vector3(), ws = new THREE.Vector3(), dir = new THREE.Vector3();
    const push = new THREE.Vector3(0, 0, -1); // away from the player
    const meshes = [];
    o.traverse((m) => { if (m.isMesh && m.material.visible !== false) meshes.push(m); });
    for (const m of meshes) {
      m.getWorldPosition(wp); m.getWorldScale(ws);
      const vol = ws.x * ws.y * ws.z;
      const n = Math.max(2, Math.min(9, Math.round(vol * 140)));
      for (let i = 0; i < n; i++) {
        const sh = new THREE.Mesh(TETRA, m.material);
        sh.position.set(wp.x + (Math.random() - 0.5) * ws.x, wp.y + (Math.random() - 0.5) * ws.y, wp.z + (Math.random() - 0.5) * ws.z);
        const sz = Math.cbrt(vol / n) * (0.75 + Math.random() * 0.6);
        sh.scale.setScalar(Math.max(0.05, sz)); sh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        dir.subVectors(sh.position, hit); const d = dir.length(); dir.normalize();
        const blast = (head ? 10 : 7) / (0.5 + d * 1.6) + 1.2;
        const v = dir.multiplyScalar(blast).addScaledVector(push, 2 + Math.random() * 3); v.y += 1.5 + Math.random() * 2;
        this.scene.add(sh);
        this.shards.push({ m: sh, v: v.clone(), spin: new THREE.Vector3(Math.random() * 14 - 7, Math.random() * 14 - 7, Math.random() * 14 - 7), life: 1.3 + Math.random() * 0.9, s0: sh.scale.x });
      }
    }
    this.scene.remove(o); e.shattered = true;
    if (e.laser) { this.scene.remove(e.laser); e.laser = null; }
    while (this.shards.length > 450) { const old = this.shards.shift(); this.scene.remove(old.m); }
  }

  activateFocus() {
    if (!this.running || this.p.dead || this.bulletTime || !this.focusCharges) return false;
    this.focusCharges = 0; this.headStreak = 0; this.ui.setStreak(0, false);
    this.ui.pop('FOCUS', innerWidth / 2, innerHeight * 0.4, '#00e5ff', 80, true);
    this.enterBulletTime(); this.emit('focus');
    return true;
  }

  multiPop(n, label) {
    const words = { 2: 'DOUBLE!', 3: 'TRIPLE!', 4: 'QUAD!', 5: 'PENTA!!' };
    const txt = label || words[Math.min(n, 5)];
    const bonus = { 2: 2, 3: 3, 4: 5, 5: 8 }[Math.min(n, 5)] || 1;
    this.addScore(150 * bonus);
    this.ui.pop(txt + ' ×' + bonus, innerWidth / 2, innerHeight * 0.3, '#ff2e88', 72, true);
    this.impact = 1; this.hitstop = 0.12;
  }

  addScore(n, combo = true) { this.score += Math.round(n * (combo ? this.combo : 1)); this.ui.setScore(this.score, this.combo); }

  dropPickup(type, pos) {
    const g = new THREE.Group();
    const m = buildWeaponModel(type, 2.2); g.add(m);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 4, 20), flat(0xffe600)); ring.rotation.x = Math.PI / 2; g.add(ring);
    const hit = new THREE.Mesh(BOX, hitMat); hit.scale.set(1.6, 1.6, 1.6); g.add(hit);
    g.position.set(pos.x, 1.2, pos.z);
    this.scene.add(g);
    this.pickups.push({ obj: g, hit, type, t: 0 });
  }

  tracer(a, b, color = 0xffe600) {
    const len = a.distanceTo(b);
    const m = new THREE.Mesh(BOX, flat(color));
    m.scale.set(0.05, 0.05, len); m.position.copy(a).lerp(b, 0.5); m.lookAt(b);
    this.scene.add(m); this.tracers.push({ obj: m, life: 0.09 });
  }

  spray(pos, color, n, force) {
    for (let i = 0; i < n; i++) {
      const m = this.partPool.get(); m.material = flat(color);
      const s = 0.06 + Math.random() * 0.14; m.scale.set(s, s, s);
      m.position.copy(pos);
      this.scene.add(m);
      this.particles.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * force, Math.random() * force, (Math.random() - 0.5) * force), life: 0.5 + Math.random() * 0.5 });
    }
  }

  hurt(src) {
    const p = this.p;
    if (p.invuln > 0 || p.dead) return;
    if (this.mode === 'tutorial') {
      p.invuln = 0.6; this.audio.sfx('hurt'); this.hurtFx = 0.8; this.haptics(50);
      this.ui.pop('OUCH! TRY AGAIN', innerWidth / 2, innerHeight * 0.55, '#ff1f3d', 38);
      this.emit('hurt', { src }); return;
    }
    this.audio.sfx('hurt'); this.haptics([60, 30, 90]);
    this.hurtFx = 1; this.combo = 1; this.ui.setScore(this.score, this.combo);
    this.headStreak = 0; this.ui.setStreak(this.focusCharges ? 3 : 0, !!this.focusCharges);
    if (p.armor > 0) {
      p.armor = 0; p.regen = 7; p.invuln = 0.9; this.ui.setArmor(0);
      this.ui.pop('ARMOR BROKEN', innerWidth / 2, innerHeight * 0.55, '#ff1f3d', 40);
    } else {
      p.dead = true; this.impact = 1; this.targetScale = 0.15;
      setTimeout(() => this.onGameOver && this.onGameOver(), 1100);
    }
  }

  // ------------------------------------------------------------ spawning
  spawnEnemy(type, x, zAhead, landBeat, elevated = 0, passive = false) {
    const obj = buildEnemy(type);
    const z = this.p.z - zAhead;
    obj.position.set(x, elevated + 9, z);
    obj.rotation.y = 0;
    this.scene.add(obj);
    this.enemies.push({ obj, type, alive: true, landed: false, landBeat, baseY: elevated, fireOffset: Math.floor(Math.random() * 2), rushing: false, t: 0, burst: 0, passive });
    return this.enemies[this.enemies.length - 1];
  }

  spawnBar(barBeat) {
    if (this.mode === 'tutorial') return;
    const bar = this.barCount++;
    const H = this.heat;                       // 1..10, rises every 25s
    const diff = Math.min(1, (H - 1) / 7);
    const pool = ['pistol'];
    if (H >= 2) pool.push('smg');
    if (H >= 3) pool.push('sword', 'pistol');
    if (H >= 4) pool.push('shotgun');
    if (H >= 6) pool.push('smg', 'shotgun');
    // gentle ramp: 1 goon early, up to 3 per bar later, never more than 5 alive ahead
    // a new group only every other bar; 1 early, up to 3 later; max 3 alive ahead
    const ahead = this.enemies.filter((e) => e.alive && this.p.z - e.obj.position.z > 0).length;
    const everyBar = H >= 4 && Math.random() < 0.35 + diff * 0.6;
    const want = bar % 2 && !everyBar ? 0 : 1 + Math.floor(Math.random() * Math.min(3, 0.6 + H * 0.35));
    const maxAhead = Math.min(5, 1 + Math.ceil(H / 2));
    const n = Math.max(0, Math.min(want, maxAhead - ahead));
    const zBase = 26 + this.speed * 0.4; // close enough that you watch them drop in
    const used = new Set();
    for (let i = 0; i < n; i++) {
      const type = pool[Math.floor(Math.random() * pool.length)];
      const zA = zBase + i * 3 + Math.random() * 3;
      let x, elev = 0;
      const r = Math.random();
      // only spots you can actually see: a lane, the corridor edge, or on top of a wall
      if (type === 'sword' || r < 0.5) x = LANES[Math.floor(Math.random() * 3)];
      else {
        const side = Math.random() < 0.5 ? -1 : 1;
        if (r < 0.75 && this.world.wallAt(this.p.z - zA, side)) { x = side * (WALL_X + 0.3); elev = 4.8; }
        else x = side * 3.15;
      }
      const key = Math.round(x) + ':' + elev;
      if (used.has(key)) continue; used.add(key);
      this.spawnEnemy(type, x, zA, barBeat + 1 + (i % 3), elev);
    }
    // hazards
    if (bar > 2 && bar % 2 === 1 && Math.random() < 0.3 + diff * 0.55) this.spawnHazard(40 + this.speed);
    // power-ups
    // biome portal
    if (bar === this.nextPortalBar) {
      const next = (this.biomeIndex + 1) % BIOMES.length;
      this.world.schedulePortal(this.p.z - 70, next);
      this.nextPortalBar += 36;
    }
  }

  spawnHazard(zAhead, forceKind) {
    const z = this.p.z - zAhead;
    const kinds = ['low', 'high', 'lane', 'dive', 'cross'];
    const kind = forceKind || kinds[Math.floor(Math.random() * kinds.length)];
    const b = BIOMES[this.world.biomeAt(z)];
    const g = new THREE.Group(); g.position.z = z;
    const red = flat(0xff1f3d), stripe = flat(0xffe600);
    let h = { kind, obj: g, z };
    if (kind === 'low') { // full-width low barrier -> jump
      g.add(box(toon(b.wall), 7, 0.8, 0.5, 0, 0.4, 0));
      for (let i = -3; i <= 3; i++) g.add(box(i % 2 ? red : stripe, 0.9, 0.82, 0.52, i, 0.4, 0));
      h.yMin = 0; h.yMax = 0.6; h.lanes = [0, 1, 2];
    } else if (kind === 'high') { // bar at head height -> slide
      g.add(box(red, 7.4, 0.35, 0.35, 0, 1.45, 0));
      g.add(box(toon(b.wall), 0.3, 1.6, 0.3, -3.6, 0.8, 0), box(toon(b.wall), 0.3, 1.6, 0.3, 3.6, 0.8, 0));
      for (let i = -3; i <= 3; i += 2) g.add(box(stripe, 0.4, 0.37, 0.37, i, 1.45, 0));
      h.yMin = 1.2; h.yMax = 1.7; h.lanes = [0, 1, 2];
    } else if (kind === 'lane') { // two lanes blocked by crates -> pick the open one
      const open = Math.floor(Math.random() * 3);
      h.lanes = [0, 1, 2].filter((l) => l !== open);
      for (const l of h.lanes) { g.add(box(toon(0x8a5a2a), 1.9, 1.9, 1.9, LANES[l], 0.95, 0)); g.add(box(stripe, 1.95, 0.25, 1.95, LANES[l], 1.5, 0)); }
      h.yMin = 0; h.yMax = 1.9;
    } else if (kind === 'dive') { // rocket from above into one lane
      const lane = Math.floor(Math.random() * 3);
      h.lanes = [lane]; h.yMin = 0; h.yMax = 3;
      const warn = box(red, 2, 0.03, 10, LANES[lane], 0.04, 4); warn.material = red; g.add(warn); h.warn = warn;
      const rocket = new THREE.Group();
      rocket.add(box(toon(0xfff6e0), 0.35, 1.3, 0.35), box(red, 0.37, 0.4, 0.37, 0, 0.5, 0), box(flat(0xff7a00), 0.25, 0.7, 0.25, 0, -0.95, 0));
      rocket.position.set(LANES[lane] + 8, 18, -6); g.add(rocket); h.rocket = rocket; h.lane = lane; h.armed = true;
    } else if (kind === 'cross') { // rocket flying across from the right at chest height -> slide/jump
      h.lanes = [0, 1, 2]; h.yMin = 0.9; h.yMax = 1.7;
      const rocket = new THREE.Group();
      rocket.add(box(toon(0xfff6e0), 1.3, 0.35, 0.35), box(red, 0.4, 0.37, 0.37, -0.5, 0, 0), box(flat(0xff7a00), 0.7, 0.25, 0.25, 0.95, 0, 0));
      rocket.position.set(30, 1.3, 0); g.add(rocket); h.rocket = rocket; h.armed = true;
      const warn = box(red, 7.4, 0.04, 0.6, 0, 1.3, 0); g.add(warn); h.warn = warn;
    }
    this.scene.add(g); this.hazards.push(h); return h;
  }

  spawnCanister(type, zAhead) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const g = new THREE.Group();
    const col = type === 'chrono' ? 0xffe600 : 0xff2e88;
    const core = new THREE.Mesh(CYL, flat(col)); core.scale.set(0.42, 1.1, 0.42); g.add(core);
    g.add(box(toon(0x2a2a36), 0.95, 0.18, 0.95, 0, 0.62, 0), box(toon(0x2a2a36), 0.95, 0.18, 0.95, 0, -0.62, 0));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.06, 4, 20), flat(col)); ring.rotation.x = Math.PI / 2; g.add(ring);
    const hit = new THREE.Mesh(BOX, hitMat); hit.scale.set(2, 2.4, 2); g.add(hit);
    g.position.set(side * 2.9, 2.6, this.p.z - zAhead);
    this.scene.add(g);
    const h = { kind: 'canister', type, obj: g, hit, core, ring, z: g.position.z, lanes: [] };
    this.hazards.push(h); return h;
  }

  // ------------------------------------------------------------ per-16th rhythm events
  on16th(step) {
    const inBeat = step % 4;
    const beatIdx = Math.floor(step / 4);
    if (inBeat === 0 && this.biomeIndex >= 0) this.ui.beat();
    if (this.bulletTime) { if (inBeat === 0) this.audio.sfx('heart'); return; }
    for (const e of this.enemies) {
      if (!e.alive || !e.landed || e.passive) continue;
      const dz = this.p.z - e.obj.position.z;
      if (dz < 8 || dz > 24 || !this.onScreen(e)) continue;
      if (inBeat === 3) e.warn = 0.2; // laser flares a 16th before the beat
      if (e.type === 'pistol' && inBeat === 0 && (this.heat >= 7 || (beatIdx + e.fireOffset) % 2 === 0)) this.enemyFire(e, 1);
      if (e.type === 'shotgun' && inBeat === 0 && beatIdx % 4 === (e.fireOffset ? 2 : 0) && dz < 30) this.enemyFire(e, 3);
      if (e.type === 'smg' && (e.tut ? beatIdx % 2 === 0 : beatIdx % 4 === 2 + e.fireOffset) && inBeat < 3) this.enemyFire(e, 1);
      if (e.type === 'sword' && inBeat === 0 && dz < 30) e.rushing = true;
    }
  }

  enemyFire(e, pellets) {
    const p = this.p;
    e.warn = 0.18;
    const muzzle = e.obj.userData.gun.getWorldPosition(new THREE.Vector3());
    const T = 2 * BEAT; // game-time travel: lands two beats later
    const targetZ = p.z - this.speed * T;
    for (let i = 0; i < pellets; i++) {
      const lx = pellets > 1 ? LANES[i] : this.camera.position.x;
      const ty = pellets > 1 ? 1.25 : 1.3;
      const target = new THREE.Vector3(lx, ty, targetZ);
      const vel = target.clone().sub(muzzle).divideScalar(T);
      const m = new THREE.Group();
      const core = new THREE.Mesh(SPH, flat(0xfff6e0)); core.scale.set(0.16, 0.16, 0.16);
      const trail = new THREE.Mesh(BOX, flat(0xff1f3d)); trail.scale.set(0.09, 0.09, 1.4); trail.position.z = -0.7;
      const tg = new THREE.Group(); tg.add(core, trail); m.add(tg);
      m.position.copy(muzzle); tg.lookAt(muzzle.clone().sub(vel)); // trail points back along path
      this.scene.add(m);
      this.bullets.push({ obj: m, vel, t: 0, T, prevZ: muzzle.z, passed: false });
    }
    e.recoil = 1;
    this.audio.sfx('enemyShot');
  }

  // ------------------------------------------------------------ main update
  update(realDt) {
    if (!this.running) return;
    const p = this.p;

    // time scale: hitstop > bullet time > auto slow > normal
    let target = this.targetScale;
    if (this.autoSlow > 0) { this.autoSlow -= realDt; target = Math.min(target, this.autoSlowScale); }
    this.autoSlowCd -= realDt;
    if (this.hitstop > 0) { this.hitstop -= realDt; this.timeScale = 0.03; }
    else this.timeScale += (target - this.timeScale) * (1 - Math.exp(-realDt * (target < this.timeScale ? 14 : 6)));
    if (p.dead) this.timeScale = Math.max(0.12, this.timeScale);
    const dt = realDt * this.timeScale;
    this.time += dt;
    this.audio.update(realDt, this.timeScale, this.bulletTime);

    // focus timer
    if (this.bulletTime) {
      this.focus -= realDt;
      this.ui.setFocus(this.focus / 5, true);
      if (this.focus <= 0) this.exitBulletTime();
    }

    // 16th-note rhythm clock
    const s16 = Math.floor(this.audio.songPos / (BEAT / 4));
    if (s16 !== this.last16) {
      for (let s = this.last16 + 1; s <= s16; s++) {
        if (this.last16 >= 0 || s === s16) this.on16th(s);
        if (s % 16 === 0) this.spawnBar(s / 4);
      }
      this.last16 = s16;
    }

    // speed ramp
    if (this.mode !== 'tutorial') {
      const H = Math.min(10, 1 + Math.floor(this.time / 25) + this.lap * 2);
      if (H !== this.heat) {
        this.heat = H; this.ui.setHeat(H); this.audio.sfx('warn');
        this.ui.pop('HEAT ' + H + '!', innerWidth / 2, innerHeight * 0.28, H >= 7 ? '#ff1f3d' : '#ff7a00', 70, true);
      }
    }
    const targetSpeed = this.mode === 'tutorial' ? 9 : Math.min(21, 10.5 + (this.heat - 1) * 1.0 + this.lap * 1.2);
    this.speed += (targetSpeed - this.speed) * (1 - Math.exp(-dt * 0.8));
    if (!p.dead) p.z -= this.speed * dt;
    this.stats.dist = -p.z;

    // player movement — lateral uses real dt so you feel fast in slow-mo
    const quick = 1 - Math.exp(-realDt * 16);
    let tx = LANES[p.lane];
    if (p.wall > 0) {
      p.wall -= dt;
      tx = p.wallSide * (WALL_X - 0.75);
      p.y += (1.3 - p.y) * quick;
      p.roll += (-p.wallSide * 0.32 - p.roll) * quick;
      if (p.wall <= 0 || !this.world.wallAt(p.z - 1, p.wallSide)) { p.wall = 0; p.vy = 3; p.lane = p.wallSide < 0 ? 0 : 2; }
    } else {
      p.vy -= 22 * dt; p.y += p.vy * dt;
      if (p.y < 0) { p.y = 0; p.vy = 0; }
      p.roll += (0 - p.roll) * quick;
    }
    p.x += (tx - p.x) * quick;
    if (p.slide > 0) p.slide -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.armor === 0 && !p.dead) { p.regen -= dt; if (p.regen <= 0) { p.armor = 1; this.ui.setArmor(1); this.audio.sfx('pickup'); } }
    p.cool -= realDt;
    this.comboTimer -= dt; if (this.comboTimer <= 0 && this.combo > 1) { this.combo = 1; this.ui.setScore(this.score, 1); }

    // camera
    const slideY = p.slide > 0 ? -0.85 : 0;
    const bob = p.y === 0 && p.slide <= 0 ? Math.sin(this.time * 14) * 0.04 : 0;
    this.camera.position.set(p.x, 1.6 + p.y + slideY + bob, p.z);
    this.camera.rotation.set(-0.03, (this.p.x - tx) * -0.05, p.roll);
    const fovT = (this.camera.aspect < 1 ? 90 : 72) + (this.bulletTime ? -8 : 0) + (this.speed - 11) * 0.6;
    this.camera.fov += (fovT - this.camera.fov) * quick * 0.5; this.camera.updateProjectionMatrix();

    // body hit volume
    const bodyMin = p.y + (p.slide > 0 ? 0 : 0.0), bodyMax = p.y + (p.slide > 0 ? 0.85 : 1.75);

    // viewmodel kick/sway
    p.kick *= Math.exp(-realDt * 14);
    if (this.vm) {
      // aim the gun at the crosshair
      const k = 1 - Math.exp(-realDt * 18);
      this.aimS.x += (this.aim.x - this.aimS.x) * k; this.aimS.y += (this.aim.y - this.aimS.y) * k;
      const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
      const gx = 0.22 + this.aimS.x * 0.07, gy = -0.21 + this.aimS.y * 0.05;
      const vx = this.aimS.x * tanV * this.camera.aspect * 20 - gx, vy = this.aimS.y * tanV * 20 - gy, vz = -20 + 0.52;
      this.vm.rotation.order = 'YXZ';
      this.vm.rotation.y = Math.atan2(-vx, -vz);
      this.vm.rotation.x = Math.atan2(vy, Math.hypot(vx, vz)) + p.kick * 0.45;
      this.vm.rotation.z = -0.05 - this.aimS.x * 0.15;
      this.vm.position.set(gx, gy, -0.5 + p.kick * 0.07);
      this.viewmodel.position.y = bob * 0.5 + (p.slide > 0 ? 0.08 : 0);
    }

    // enemies
    const stepT = Math.floor(this.time * 12) / 12; // animate on twos (12fps) — Spider-Verse
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i], o = e.obj, u = o.userData;
      const dz = p.z - o.position.z;
      if (e.alive) {
        if (!e.landed) {
          const left = (e.landBeat - this.audio.beat) * BEAT;
          if (left <= 0) {
            e.landed = true; o.position.y = e.baseY; u.legL.scale.y = u.legR.scale.y = 0.7; // squash
            this.spray(o.position, 0xfff6e0, 6, 3);
          } else o.position.y = e.baseY + Math.min(9, left * left * 4.5);
        } else {
          u.legL.scale.y += (1 - u.legL.scale.y) * 0.2; u.legR.scale.y = u.legL.scale.y;
        }
        if (e.rushing && dz > 1) {
          o.position.z += this.speed * 0.35 * dt; // charge toward player
          const lx = LANES.reduce((a, b) => (Math.abs(b - p.x) < Math.abs(a - p.x) ? b : a));
          if (dz < 14) o.position.x += (lx - o.position.x) * (1 - Math.exp(-dt * 2));
        }
        // face player & aim (stepped)
        const look = Math.atan2(p.x - o.position.x, p.z - o.position.z);
        o.rotation.y = Math.round(look * 8) / 8 + Math.PI;
        u.armR.rotation.x = Math.round((-Math.PI / 2 + 0.1 * Math.sin(stepT * 6) + (e.recoil || 0) * 0.5) * 10) / 10 + Math.PI / 2 - Math.PI / 2;
        u.armR.rotation.x = (e.recoil || 0) * 0.6 + (e.type === 'sword' ? Math.sin(stepT * 10) * 0.8 : 0);
        e.recoil = (e.recoil || 0) * Math.exp(-dt * 10);
        u.torso.position.y = 1.18 + Math.sin(stepT * 8 + i) * 0.03;
        if (e.rushing) { u.legL.rotation.x = Math.sin(stepT * 18) * 0.7; u.legR.rotation.x = -u.legL.rotation.x; }
        // collision with player
        if (e.landed && Math.abs(dz) < 0.9 && Math.abs(o.position.x - p.x) < 1.0 && e.baseY < 1 && bodyMin < 1.2 && !p.wall) {
          if (p.weapon === 'sword' || p.weapon === 'fists') this.killEnemy(e, 'body', { melee: true });
          else { this.hurt(); e.alive = false; e.deadT = 0; e.vel = new THREE.Vector3(3, 3, 4); e.spin = new THREE.Vector3(3, 2, 1); }
        }
        if (e.warn > 0) e.warn -= realDt;
        this.updateLaser(e, dz);
        if (dz < -6) { this.scene.remove(o); if (e.laser) this.scene.remove(e.laser); this.enemies.splice(i, 1); }
      } else if (e.shattered) {
        this.enemies.splice(i, 1);
      } else {
        if (e.laser) { this.scene.remove(e.laser); e.laser = null; }
        e.deadT += dt;
        e.vel.y -= 18 * dt;
        o.position.addScaledVector(e.vel, dt);
        o.rotation.x += e.spin.x * dt; o.rotation.z += e.spin.z * dt;
        if (o.position.y < -6 || e.deadT > 2.5) { this.scene.remove(o); this.enemies.splice(i, 1); }
      }
    }

    // enemy bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.prevZ = b.obj.position.z;
      b.obj.position.addScaledVector(b.vel, dt);
      b.t += dt;
      const bz = b.obj.position.z;
      if (!b.passed && bz >= p.z && b.prevZ < p.z + 0.01) {
        b.passed = true;
        const dx = Math.abs(b.obj.position.x - p.x), by = b.obj.position.y;
        const hit = dx < 0.62 && by > bodyMin && by < bodyMax;
        this.emit('bullet', { hit, dx });
        if (hit && !p.dead) this.hurt('bullet');
        else if (dx < 1.9 && !p.dead) {
          this.audio.sfx('whiz');
          if (this.autoSlowCd <= 0 && !this.bulletTime) {
            this.triggerAutoSlow(0.3, 0.4);
            this.ui.pop('CLOSE CALL', innerWidth / 2, innerHeight * 0.62, '#00e5ff', 34);
            this.addScore(40); this.haptics(12);
          }
        }
      }
      if (b.t > 4 || bz > p.z + 8) { this.scene.remove(b.obj); this.bullets.splice(i, 1); }
    }

    // hazards
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      const dz = p.z - h.obj.position.z;
      if (h.kind === 'canister') {
        h.obj.rotation.y += realDt * 2; h.ring.scale.setScalar(1 + this.world.beatPulse * 0.4);
        if (dz < -4 || h.broken) { this.scene.remove(h.obj); this.hazards.splice(i, 1); }
        continue;
      }
      if (h.rocket && h.armed) {
        // rocket arrives exactly when the player reaches the hazard z
        const timeToReach = dz / this.speed;
        if (h.kind === 'dive') {
          const k = Math.max(0, Math.min(1, 1 - timeToReach / 1.6));
          h.rocket.position.set(LANES[h.lane] + 8 * (1 - k), 18 * (1 - k) + 1.2, -6 * (1 - k));
          h.rocket.rotation.z = 0.4 * (1 - k);
          if (h.warn) h.warn.visible = Math.floor(this.time * 10) % 2 === 0;
          if (timeToReach < 1.6 && !h.warned) { h.warned = true; this.audio.sfx('warn'); }
          if (k >= 1) { h.armed = false; this.explode(h, new THREE.Vector3(LANES[h.lane], 0.8, h.obj.position.z)); }
        } else {
          const k = Math.max(0, Math.min(1, 1 - timeToReach / 1.2));
          h.rocket.position.x = 30 * (1 - k) - 2 * k;
          if (h.warn) h.warn.visible = Math.floor(this.time * 10) % 2 === 0;
          if (timeToReach < 1.2 && !h.warned) { h.warned = true; this.audio.sfx('warn'); }
          if (k >= 1) h.armed = false;
        }
      }
      if (!h.checked && dz <= 0) {
        h.checked = true;
        const lane = LANES.reduce((a, b, idx) => (Math.abs(b - p.x) < Math.abs(LANES[a] - p.x) ? idx : a), 0);
        const inLane = h.lanes.includes(lane) && !p.wall;
        const overlap = bodyMax > h.yMin && bodyMin < h.yMax;
        this.emit('hazard', { kind: h.kind, ok: !(inLane && overlap) });
        if (inLane && overlap) this.hurt('hazard');
        else if (h.kind !== 'lane') { this.addScore(30); this.ui.pop(h.kind === 'high' ? 'LIMBO!' : h.kind === 'low' ? 'VAULT!' : 'DODGED!', innerWidth / 2, innerHeight * 0.66, '#fff6e0', 28); }
        if (h.kind === 'cross' && h.rocket) { this.scene.remove(h.rocket); }
      }
      if (dz < -10) { this.scene.remove(h.obj); this.hazards.splice(i, 1); }
    }

    // pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i]; pk.t += dt;
      pk.obj.rotation.y += realDt * 3; pk.obj.position.y = 1.2 + Math.sin(pk.t * 4) * 0.15;
      const dz = p.z - pk.obj.position.z;
      // auto-grab when running through it with an empty / no gun
      if (Math.abs(dz) < 1.2 && Math.abs(pk.obj.position.x - p.x) < 1.3 && (p.ammo <= 0 || p.weapon === 'fists')) { this.grabPickup(pk); continue; }
      if (dz < -5) { this.scene.remove(pk.obj); this.pickups.splice(i, 1); }
    }

    // thrown weapons
    for (let i = this.thrown.length - 1; i >= 0; i--) {
      const th = this.thrown[i]; th.t += realDt;
      const k = Math.min(1, th.t / th.dur);
      const tgt = th.enemy ? th.enemy.obj.position.clone().setY(th.part === 'head' ? 1.8 : 1.25) : th.target;
      th.obj.position.lerpVectors(th.from, tgt, k); th.obj.position.y += Math.sin(k * Math.PI) * 0.8;
      th.obj.rotation.x -= realDt * 25;
      if (k >= 1) {
        this.scene.remove(th.obj); this.thrown.splice(i, 1);
        if (th.enemy && th.enemy.alive) {
          const etype = ENEMY[th.enemy.type].weapon;
          this.killEnemy(th.enemy, th.part, { thrown: true });
          this.setWeapon(etype, WEAPONS[etype].ammo);
          const s = this.toScreen(tgt);
          this.ui.pop('STOLE ' + WEAPONS[etype].name + '!', s.x, s.y + 40, '#00e5ff', 30);
        }
      }
    }

    // shards
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const q = this.shards[i]; q.life -= dt;
      q.v.y -= 16 * dt; q.m.position.addScaledVector(q.v, dt);
      if (q.m.position.y < 0.03) { q.m.position.y = 0.03; q.v.y *= -0.35; q.v.x *= 0.6; q.v.z *= 0.6; q.spin.multiplyScalar(0.6); }
      q.m.rotation.x += q.spin.x * dt; q.m.rotation.y += q.spin.y * dt; q.m.rotation.z += q.spin.z * dt;
      if (q.life < 0.4) q.m.scale.setScalar(q.s0 * Math.max(0, q.life / 0.4));
      if (q.life <= 0) { this.scene.remove(q.m); this.shards.splice(i, 1); }
    }

    // tracers & particles
    for (let i = this.tracers.length - 1; i >= 0; i--) { const t = this.tracers[i]; t.life -= realDt; t.obj.scale.x = t.obj.scale.y = 0.05 * (t.life / 0.09) + 0.01; if (t.life <= 0) { this.scene.remove(t.obj); this.tracers.splice(i, 1); } }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const q = this.particles[i]; q.life -= dt; q.v.y -= 14 * dt; q.m.position.addScaledVector(q.v, dt);
      q.m.rotation.x += dt * 8;
      if (q.life <= 0) { this.scene.remove(q.m); this.partPool.put(q.m); this.particles.splice(i, 1); }
    }

    // world + biome
    const beatPhase = this.audio.beat % 1;
    if (this.world.update(p.z, dt, beatPhase, this.audio.songPos)) {
      this.biomeIndex = this.world.biome;
      if (this.biomeIndex === 0) this.lap++;
      this.audio.switchSong(this.biomeIndex);
      this.ui.biome(BIOMES[this.biomeIndex].name + (this.lap ? ' · LAP ' + (this.lap + 1) : ''));
      this.impact = 0.8; this.haptics([20, 20, 20, 20, 60]);
    }

    // big centre-screen alerts
    let al = null;
    const touchUI = matchMedia('(pointer:coarse)').matches;
    if (!p.dead) {
      if (this.bulletTime) al = ['focus', 'FOCUS', touchUI ? 'TAP THE GOONS' : 'CLICK THE GOONS', '#00e5ff', true];
      else if (p.ammo <= 0 && !WEAPONS[p.weapon].melee) al = ['throw', 'THROW YOUR GUN!', touchUI ? 'HIT  THROW' : 'PRESS  F  /  RIGHT-CLICK', '#ff1f3d'];
      else if (p.weapon === 'fists') al = ['grab', 'GRAB A GUN!', touchUI ? 'TAP A DROPPED GUN · PUNCH UP CLOSE' : 'CLICK A DROPPED GUN · PUNCH UP CLOSE', '#ffe600'];
    }
    const key = al ? al[0] : '';
    if (key !== this.alertKey) { this.alertKey = key; this.ui.setAlert(al && al[1], al && al[2], al && al[3], al && al[4]); }

    // post fx
    const u = this.post.u;
    u.time.value += realDt;
    u.slow.value += ((this.timeScale < 0.6 ? 1 : 0) - u.slow.value) * (1 - Math.exp(-realDt * 8));
    this.impact = Math.max(0, this.impact - realDt * 9); u.impact.value = this.impact > 0.5 ? 1 : 0;
    u.shift.value += (1.5 + this.world.beatPulse * 2.5 - u.shift.value) * (1 - Math.exp(-realDt * 12));
    u.speed.value = Math.min(1, (this.speed - 12) / 8 + (this.timeScale < 0.6 ? 0.7 : 0) + (p.wall ? 0.6 : 0));
    this.hurtFx = Math.max(0, this.hurtFx - realDt * 2); u.hurt.value = Math.max(this.hurtFx, p.armor === 0 ? 0.35 + Math.sin(this.time * 8) * 0.1 : 0);
  }

  explode(h, pos) {
    this.audio.sfx('boom'); this.spray(pos, 0xff7a00, 20, 9); this.spray(pos, 0xffe600, 12, 7); this.spray(pos, 0x0b0410, 8, 5);
    if (h.rocket) h.obj.remove(h.rocket);
    if (h.warn) h.obj.remove(h.warn);
    const s = this.toScreen(pos); this.ui.pop('KABOOM!', s.x, s.y, '#ff7a00', 64, true);
    this.post.u.shift.value = 9; this.haptics(70);
  }
}
