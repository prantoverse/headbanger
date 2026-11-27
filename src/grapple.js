import * as THREE from 'three';
import { CHUNK, LANES, WALL_X, BIOMES } from './world.js';
import { isGrid } from './style.js';

// LAVA GAP set piece: the track breaks over a pit. JUMP / E / tap the hook at the edge
// to grapple, swing across in slow-mo past floating gunmen, land on a wall and wall-run
// over the lava (A/D hops between walls), then drop back onto the track.
const SWING = 2 * CHUNK, WALLRUN = 2 * CHUNK;
const BOXG = new THREE.BoxGeometry(1, 1, 1);
const flat = (c) => new THREE.MeshBasicMaterial({ color: c });
const toon = (c) => new THREE.MeshLambertMaterial({ color: c });

const lavaMat = () => new THREE.ShaderMaterial({
  uniforms: { time: { value: 0 }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() }, c3: { value: new THREE.Color() }, grid: { value: 0 } },
  vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform float time, grid; uniform vec3 c1, c2, c3; varying vec3 vW;
    void main(){
      vec2 p = vW.xz * 0.22;
      float n = sin(p.x * 1.7 + time * 0.7) + sin(p.y * 1.3 - time * 0.5) + sin((p.x + p.y) * 0.9 + time * 0.9) + sin(length(p * 1.4) * 2.0 - time);
      n = n * 0.125 + 0.5;
      vec3 col;
      if (grid > 0.5) {
        vec2 g = abs(fract(vW.xz * 0.5) - 0.5);
        float l = smoothstep(0.44, 0.5, max(g.x, g.y));
        col = c1 * (0.12 + pow(n, 3.0) * 0.7) + c2 * l * (0.5 + n);
      } else {
        float t = floor(n * 4.0) / 4.0;            // toon-banded magma
        col = mix(c1, c2, t);
        col = mix(col, c3, step(0.78, n));
      }
      gl_FragColor = vec4(col, 1.0);
    }`,
});

export class Grapple {
  constructor(game) { this.g = game; this.sets = []; this.reset(); }

  reset() {
    for (const s of this.sets) this.g.scene.remove(s.group);
    this.sets = []; this.cur = null; this.nextBar = 12; this.fov = 0; this.seen = false;
    if (this.rope) this.rope.visible = false;
    if (this.g.world) this.g.world.gaps = [];
  }

  // --- scheduling (called once per bar from spawnBar)
  onBar(bar) {
    const g = this.g;
    if (g.mode !== 'run' || bar < this.nextBar || this.sets.some((s) => !s.done)) return;
    this.nextBar = bar + 18 + Math.floor(Math.random() * 8);
    const w = g.world;
    const z0 = w.nextZ - CHUNK;                  // first chunk not built yet
    const s = { z0, zSwing: z0 - SWING, zEnd: z0 - SWING - WALLRUN, state: 'approach', done: false, spawned: false };
    w.gaps.push({ a: z0, wallFrom: s.zSwing, b: s.zEnd });
    this.build(s);
    this.sets.push(s);
  }

  // is z over open lava (no floor)?
  overPit(z) { return this.sets.some((s) => z <= s.z0 && z > s.zEnd); }
  blocks(z) { return this.sets.some((s) => !s.done && z <= s.z0 + 4 && z > s.zEnd - 6); }

  build(s) {
    const grid = isGrid(), b = BIOMES[this.g.world.biomeAt(s.z0)];
    const grp = new THREE.Group(); s.group = grp;
    const len = s.z0 - s.zEnd;
    // the lava
    const m = lavaMat();
    if (grid) { m.uniforms.c1.value.set(0xff1f3d); m.uniforms.c2.value.set(b.accents[0]); m.uniforms.grid.value = 1; }
    else { m.uniforms.c1.value.set(0xb3122e); m.uniforms.c2.value.set(0xff6a00); m.uniforms.c3.value.set(0xffe14a); }
    const lava = new THREE.Mesh(new THREE.PlaneGeometry(90, len + 6), m);
    lava.rotation.x = -Math.PI / 2; lava.position.set(0, -5, s.z0 - len / 2); grp.add(lava); s.lavaMat = m;
    // cliff faces + glowing lips on both edges
    const lip = flat(grid ? b.accents[0] : 0xffe600);
    for (const [z, dir] of [[s.z0, -1], [s.zEnd, 1]]) {
      const cliff = new THREE.Mesh(BOXG, toon(grid ? b.wall : 0x2a1430)); cliff.scale.set(7, 5, 1); cliff.position.set(0, -2.75, z - dir * 0.5); grp.add(cliff);
      const l = new THREE.Mesh(BOXG, lip); l.scale.set(6.8, 0.12, 0.25); l.position.set(0, 0.02, z + dir * 0.1); grp.add(l);
    }
    // glow rising off the lava (embers)
    s.embers = [];
    const emberMat = flat(grid ? b.accents[0] : 0xffb020);
    for (let i = 0; i < 26; i++) {
      const e = new THREE.Mesh(BOXG, emberMat); e.scale.setScalar(0.08 + Math.random() * 0.08);
      e.position.set((Math.random() - 0.5) * 16, -5 + Math.random() * 8, s.z0 - Math.random() * len); grp.add(e); s.embers.push(e);
    }
    // the hook anchor, mid-swing, hanging from a cable into the sky
    const anchor = new THREE.Group(); anchor.position.set(0, 7.5, s.z0 - SWING * 0.55);
    const ringCol = grid ? 0x6ab4ff : 0x00e5ff;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.14, 8, 32), flat(ringCol));
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.05, 6, 40), flat(grid ? 0xffffff : 0xffe600));
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 0), flat(0xffffff));
    const cable = new THREE.Mesh(BOXG, toon(grid ? 0x2a2e5a : 0x1a1020)); cable.scale.set(0.12, 60, 0.12); cable.position.y = 30.9;
    anchor.add(ring, ring2, core, cable); grp.add(anchor);
    s.anchor = anchor; s.ring = ring; s.ring2 = ring2;
    // floating platforms: two in the swing (sides), three in the wall-run (centre)
    s.platforms = [];
    const pm = toon(grid ? b.wall : 0x4a2a70), pl = flat(grid ? b.accents[1] : 0xff2e88);
    const plat = (x, y, z, coneH = 1.6) => {
      const pg = new THREE.Group(); pg.position.set(x, y, z);
      const top = new THREE.Mesh(BOXG, pm); top.scale.set(2.2, 0.4, 2.2); top.position.y = -0.2; pg.add(top);
      const edge = new THREE.Mesh(BOXG, pl); edge.scale.set(2.25, 0.08, 2.25); edge.position.y = -0.02; pg.add(edge);
      const under = new THREE.Mesh(new THREE.ConeGeometry(1.1, coneH, 4), pm); under.rotation.set(Math.PI, Math.PI / 4, 0); under.position.y = -0.4 - coneH / 2; pg.add(under);
      grp.add(pg); s.platforms.push({ x, y, z, pg, ph: Math.random() * 6 });
    };
    plat(-5.6, 2.6, s.z0 - 9); plat(5.6, 1.8, s.z0 - 20);
    plat(0, 4.6, s.zSwing - 8, 0.8); plat(-1.2, 5.2, s.zSwing - 18, 0.8); plat(1.2, 4.6, s.zSwing - 28, 0.8); // high: hop under them
    this.g.scene.add(grp);
  }

  spawnGoons(s) {
    const g = this.g, beat = g.audio.beat, pool = g.heat >= 4 ? ['pistol', 'smg', 'shotgun'] : ['pistol', 'pistol', 'smg'];
    s.platforms.forEach((pf, i) => {
      const e = g.spawnEnemy(pool[Math.floor(Math.random() * pool.length)], pf.x, g.p.z - pf.z, beat + 1 + (i % 3), pf.y);
      e.platform = pf;
    });
    // a ninja hanging off the hook cable for flavour
    if (g.heat >= 3) g.spawnEnemy('ninja', 2.4, g.p.z - (s.anchor.position.z + 6), beat + 2, 4.7);
  }

  // --- player input hooks; return true if consumed
  ready() { const s = this.cur; return !!s && (s.state === 'approach' || s.state === 'fall') && this.g.p.z < s.z0 + 24 && this.g.p.z > s.z0 - 9 && !this.g.p.dead; }
  tryTap(sx, sy) { // tapping/clicking near the hook on screen also grapples
    if (!this.ready()) return false;
    const v = this.cur.anchor.getWorldPosition(new THREE.Vector3()).project(this.g.camera);
    const x = (v.x + 1) / 2 * innerWidth, y = (1 - v.y) / 2 * innerHeight;
    if (v.z < 1 && Math.hypot(sx - x, sy - y) < Math.max(90, innerWidth * 0.08)) { this.fire(); return true; }
    return false;
  }
  fire() {
    const g = this.g, p = g.p, s = this.cur;
    if (!this.ready()) return false;
    s.state = 'swing'; s.zs = Math.max(p.z, s.z0 + 2); s.y0 = p.y; s.x0 = p.x;
    s.side = p.lane === 0 ? -1 : p.lane === 2 ? 1 : (Math.random() < 0.5 ? -1 : 1);
    p.wall = 0; p.vy = 0; p.slide = 0;
    g.audio.sfx('whiz'); g.audio.sfx('jump'); g.haptics([20, 20, 40]);
    g.ui.pop('GRAPPLE!', innerWidth / 2, innerHeight * 0.32, isGrid() ? '#6ab4ff' : '#00e5ff', 56, true);
    g.addScore(100, false);
    g.autoSlowCd = 0; g.triggerAutoSlow(0.4, 1.8);  // the slow-mo kill window
    g.emit('grapple');
    return true;
  }
  onLane(dir) {
    const s = this.cur, p = this.g.p; if (!s) return false;
    if (s.state === 'swing') { s.side = dir; return true; }    // steer which wall you'll land on
    if (s.state === 'wall') {                                  // hop to the other wall
      if (dir === -p.wallSide) {
        p.wallSide = dir; p.wall = 1; this.g.audio.sfx('jump'); this.g.addScore(75, false);
        this.g.ui.pop('WALL HOP!', innerWidth / 2 + dir * innerWidth * 0.2, innerHeight * 0.45, '#00e5ff', 36);
      }
      return true;
    }
    return false;
  }
  onJumpOrSlide() { const s = this.cur; if (!s) return false; if (this.ready()) return this.fire(); return s.state === 'swing' || s.state === 'wall'; }

  // --- per frame. Returns true when it drives the player's position itself (swing).
  drive(dt, realDt) {
    const g = this.g, p = g.p;
    this.fov *= Math.exp(-realDt * 2);
    if (!this.cur || this.cur.done) this.cur = this.sets.find((s) => !s.done && s.zEnd < p.z) || null;
    const s = this.cur;
    p.pitch = (p.pitch || 0) * Math.exp(-realDt * 4);
    if (this.rope) this.rope.visible = false;
    if (!s) return false;
    if (!s.spawned && p.z - s.z0 < 75) { s.spawned = true; this.spawnGoons(s); }
    if (s.state === 'approach' && p.z < s.z0) s.state = 'fall';
    if (s.state === 'fall') {
      if (p.y < -3.2 && !p.dead) { // into the lava: hurt, then yank back up on the hook
        g.hurt('lava');
        g.spray(new THREE.Vector3(p.x, -4.5, p.z - 1), isGrid() ? 0xff2ea8 : 0xff6a00, 18, 8);
        if (!p.dead) { p.invuln = Math.max(p.invuln, 1.2); s.state = 'approach'; s.z0 = Math.max(s.z0, p.z + 1); this.fire(); }
      }
      return false;
    }
    if (s.state === 'swing') {
      const k = Math.min(1, (s.zs - p.z) / (s.zs - s.zSwing));
      const tx = s.side * (WALL_X - 0.75);
      p.y = THREE.MathUtils.lerp(s.y0, 1.3, k) - 2.6 * Math.sin(Math.PI * k);
      p.x += ((k < 0.55 ? THREE.MathUtils.lerp(s.x0, 0, k / 0.55) : THREE.MathUtils.lerp(0, tx, (k - 0.55) / 0.45)) - p.x) * (1 - Math.exp(-realDt * 10));
      p.roll += (-Math.sin(Math.PI * k * 2) * 0.22 - s.side * 0.12 * k - p.roll) * (1 - Math.exp(-realDt * 6));
      p.pitch = Math.sin(Math.PI * k) * 0.14;
      this.fov = Math.max(this.fov, Math.sin(Math.PI * k) * 14);
      this.drawRope(s);
      if (k >= 1) {
        s.state = 'wall'; p.wall = 1; p.wallSide = s.side; p.y = 1.3; p.vy = 0;
        g.ui.pop('LAVA RUN!', innerWidth / 2 + s.side * innerWidth * 0.2, innerHeight * 0.45, '#ff7a00', 44, true);
        g.audio.sfx('jump'); g.haptics([15, 30, 15]); g.addScore(150, false);
      }
      return true;
    }
    if (s.state === 'wall') {
      if (p.z > s.zEnd) { p.wall = Math.max(p.wall, 0.5); return false; }
      s.state = 'done'; s.done = true; p.wall = 0; p.vy = 3.5; p.lane = p.wallSide < 0 ? 0 : 2;
    }
    return false;
  }

  drawRope(s) {
    if (!this.rope) {
      this.rope = new THREE.Mesh(BOXG, flat(0xffffff)); this.rope.frustumCulled = false; this.g.scene.add(this.rope);
    }
    const r = this.rope; r.visible = true;
    r.material.color.set(isGrid() ? 0x6ab4ff : 0xfff6e0);
    const a = new THREE.Vector3(-0.35, -0.3, -0.9).applyMatrix4(this.g.camera.matrixWorld);
    const b = s.anchor.getWorldPosition(new THREE.Vector3());
    r.position.copy(a).add(b).multiplyScalar(0.5);
    r.lookAt(b); r.scale.set(0.03, 0.03, a.distanceTo(b));
  }

  update(dt, realDt, beatPulse) {
    const p = this.g.p, rdy = this.ready();
    for (let i = this.sets.length - 1; i >= 0; i--) {
      const s = this.sets[i];
      s.lavaMat.uniforms.time.value += dt;
      for (const e of s.embers) { e.position.y += dt * (1.2 + (e.userData.v ??= Math.random()) * 2); if (e.position.y > 4) e.position.y = -5; }
      for (const pf of s.platforms) pf.pg.position.y = pf.y + Math.sin(this.g.time * 1.3 + pf.ph) * 0.12;
      const on = s === this.cur && rdy;
      s.ring.rotation.z += realDt * (on ? 6 : 1.5); s.ring2.rotation.z -= realDt * 2;
      const sc = 1 + beatPulse * 0.15 + (on ? 0.35 + Math.sin(performance.now() / 90) * 0.15 : 0);
      s.ring.scale.setScalar(sc); s.ring2.scale.setScalar(on ? 1.4 : 1);
      s.anchor.lookAt(this.g.camera.position);
      if (s.zEnd > p.z + 40) { this.g.scene.remove(s.group); this.sets.splice(i, 1); }
    }
    // first-time hint
    if (rdy && !this.seen) { this.seen = true; }
  }

  // alert row for the big centre-screen banner
  alert(touchUI) {
    if (this.ready()) return ['grapple', 'GRAPPLE!', touchUI ? 'SWIPE ↑  or  TAP THE HOOK' : 'JUMP  /  E  /  CLICK THE HOOK', isGrid() ? '#6ab4ff' : '#00e5ff'];
    const s = this.cur;
    if (s && s.state === 'swing') return ['steer', 'PICK A WALL', touchUI ? 'SWIPE ← →' : 'A / D', '#ff7a00'];
    return null;
  }
}
