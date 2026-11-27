// Endless rail world: chunks of corridor generated ahead of the player, four looping biomes.
import * as THREE from 'three';
import { STYLE, isGrid } from './style.js';

export const LANES = [-2.2, 0, 2.2];
export const WALL_X = 3.7;
export const CHUNK = 16;

const grad = (() => {
  const d = new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
})();
const matCache = new Map();
export function toon(color) {
  const k = 't' + color;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshToonMaterial({ color, gradientMap: grad }));
  return matCache.get(k);
}
export function flat(color) {
  const k = 'f' + color;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshBasicMaterial({ color, fog: true }));
  return matCache.get(k);
}

const box = new THREE.BoxGeometry(1, 1, 1);
const EDGES = new THREE.EdgesGeometry(box);
const lineCache = new Map();
function lineMat(color) { if (!lineCache.has(color)) lineCache.set(color, new THREE.LineBasicMaterial({ color, fog: true })); return lineCache.get(color); }
const cyl = new THREE.CylinderGeometry(1, 1, 1, 10);
const ico = new THREE.IcosahedronGeometry(1, 0);
const tor = new THREE.TorusGeometry(1, 0.22, 6, 16);
function mesh(geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); return m;
}

const COMIC_BIOMES = [
  {
    name: 'NEON ROOFTOPS', skyAccent: 0xffd23a, skyTop: 0x2a0a5e, skyBot: 0xff4f9a, fog: 0xb03a8a,
    floor: 0x5a3a9a, floor2: 0x6e48b8, wall: 0x4a2a80, accents: [0xff2e88, 0x00e5ff, 0xffe600],
    sun: 0xffd3f0, hemiSky: 0x7a5cff, hemiGround: 0x5a2a80,
  },
  {
    name: 'INSIDE THE MACHINE', skyAccent: 0xfff0a0, skyTop: 0x3a1a00, skyBot: 0xffa030, fog: 0xa85a10,
    floor: 0x6a4a3a, floor2: 0x80584a, wall: 0x5a3d2a, accents: [0xff7a00, 0x00ffc8, 0xffe600],
    sun: 0xffe2b0, hemiSky: 0xff9a3c, hemiGround: 0x5a3010,
  },
  {
    name: 'ALIEN WORLD', skyAccent: 0xff6ad5, skyTop: 0x0a3a30, skyBot: 0xb8ff5a, fog: 0x3d8a4a,
    floor: 0x6a3a9a, floor2: 0x8048b8, wall: 0x4a2a70, accents: [0x9dff3c, 0xff2e88, 0x00e5ff],
    sun: 0xe9ffd0, hemiSky: 0x9dff3c, hemiGround: 0x4a2a6a,
  },
  {
    name: 'ORBITAL STATION', skyAccent: 0xffe600, skyTop: 0x02021a, skyBot: 0x3a5cff, fog: 0x2a3a90,
    floor: 0xc8d0e0, floor2: 0x9aa4bc, wall: 0xe8ecf4, accents: [0xff1f3d, 0x00e5ff, 0xffe600],
    sun: 0xffffff, hemiSky: 0x9fc4ff, hemiGround: 0x30305a,
  },
];

// GRID MODE: dark void, glowing lines; goons glow white/red against it
const GRID_BIOMES = [ // moody haze: dark navy silhouettes, a few neon accents (track edge = accents[0])
  { name: 'THE GRID', skyAccent: 0x6ab4ff, skyTop: 0x05041a, skyBot: 0x3a2c6e, fog: 0x2a2152,
    floor: 0x120a20, floor2: 0x3a0f3e, wall: 0x161a3e, accents: [0xff2ea8, 0x6ab4ff, 0xffffff],
    sun: 0x9aa4ff, hemiSky: 0x6a74ff, hemiGround: 0x1a1030 },
  { name: 'DATA STREAM', skyAccent: 0x40e0d0, skyTop: 0x020c14, skyBot: 0x124050, fog: 0x0f3442,
    floor: 0x061218, floor2: 0x0a3a40, wall: 0x0e2838, accents: [0x2ef2ff, 0xff9a3a, 0xffffff],
    sun: 0x9fe8ff, hemiSky: 0x40a0c0, hemiGround: 0x061018 },
  { name: 'THE CORE', skyAccent: 0xff6ad5, skyTop: 0x0c0414, skyBot: 0x4a1650, fog: 0x3a1442,
    floor: 0x180818, floor2: 0x4a0c3a, wall: 0x2a1036, accents: [0xffd23a, 0xff6ad5, 0xffffff],
    sun: 0xffb0e8, hemiSky: 0xb04ac0, hemiGround: 0x18081c },
  { name: 'OUTLANDS', skyAccent: 0xff6a5a, skyTop: 0x0c0306, skyBot: 0x4a1418, fog: 0x3a1418,
    floor: 0x180808, floor2: 0x420c14, wall: 0x2a0e12, accents: [0xff3a3a, 0xffb05a, 0xffffff],
    sun: 0xffc0b0, hemiSky: 0xc0504a, hemiGround: 0x180808 },
];
// live list the rest of the game reads; swapped in place when the style changes
export const BIOMES = COMIC_BIOMES.slice();
export function applyBiomes(mode) { BIOMES.splice(0, BIOMES.length, ...(mode === 'grid' ? GRID_BIOMES : COMIC_BIOMES)); }


export class World {
  constructor(scene) {
    this.scene = scene;
    this.chunks = [];
    this.nextZ = 8;
    this.biome = 0;            // biome the player is currently in
    this.portalZ = -Infinity;  // z where the next biome starts (player crosses it moving -z)
    this.pendingBiome = 0;
    this.animated = [];
    this.beatPulse = 0;
    this.clearZones = [];

    // sky dome
    this.skyU = { top: { value: new THREE.Color(BIOMES[0].skyTop) }, bot: { value: new THREE.Color(BIOMES[0].skyBot) }, accent: { value: new THREE.Color(BIOMES[0].skyAccent) }, time: { value: 0 }, stars: { value: 1 }, kaleido: { value: 0 }, grid: { value: 0 } };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: this.skyU,
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top, bot, accent; uniform float time, stars, kaleido, grid; varying vec3 vP;
        float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
        float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * vn(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
        vec2 swirl(vec2 p, vec2 c, float r, float k){ vec2 d = p - c; float l = length(d); float a = k * exp(-l*l/(r*r)); float s = sin(a), co = cos(a); return c + mat2(co, -s, s, co) * d; }
        void main(){
          vec2 p = vec2(atan(vP.x, -vP.z), vP.y * 2.2);
          if (kaleido > 0.01) { // mirror the sky into spinning segments
            float seg = 6.2831 / 8.0;
            float a = mod(p.x + time * 0.4, seg); a = abs(a - seg * 0.5);
            vec2 kp = vec2(a * 3.0, abs(p.y - 1.0) + time * 0.15);
            p = mix(p, kp, kaleido);
          }
          // Starry-Night vortices
          vec2 q = p * 1.5;
          q = swirl(q, vec2(0.0, 1.2), 0.6, 3.2 + sin(time * 0.25) * 0.6);
          q = swirl(q, vec2(1.4, 0.8), 0.45, -2.6);
          q = swirl(q, vec2(-1.3, 1.5), 0.5, 2.9);
          q = swirl(q, vec2(2.6, 1.6), 0.5, -3.0);
          q.x += time * 0.025;
          float n = fbm(q * 2.2 + fbm(q * 1.4 + time * 0.03) * 1.6);
          // directional brush ridges that follow the swirl
          float ridge = sin(q.y * 26.0 + n * 14.0) * 0.5 + 0.5;
          float strokeId = h2(floor(vec2(q.x * 9.0 + n * 3.0, q.y * 30.0 + n * 5.0)));
          float t = smoothstep(-0.2, 0.6, vP.y) + (n - 0.5) * 0.5;
          t = floor(clamp(t, 0.0, 1.0) * 7.0) / 7.0;
          vec3 c = mix(bot, top, t);
          float sw = smoothstep(0.55, 0.78, n) * smoothstep(-0.15, 0.35, vP.y);
          c = mix(c, accent, sw * 0.6);
          c *= 0.82 + ridge * 0.22 + (strokeId - 0.5) * 0.12;
          // big haloed stars with pulsing rings
          vec2 sg = p * vec2(4.0, 3.2); vec2 cell = floor(sg); vec2 f = fract(sg) - 0.5;
          float rnd = h2(cell);
          if (rnd > 1.0 - 0.1 * stars && vP.y > 0.05) {
            vec2 o = vec2(h2(cell + 3.1), h2(cell + 7.7)) - 0.5;
            float d = length(f - o * 0.4);
            float core = smoothstep(0.07, 0.0, d);
            float rings = (sin(d * 70.0 - time * 2.5) * 0.5 + 0.5) * smoothstep(0.38, 0.06, d);
            c = mix(c, vec3(1.0, 0.95, 0.55), clamp(core + rings * 0.5, 0.0, 1.0));
          }
          if (grid > 0.5) { // dark void: deep gradient, glowing horizon band, faint scanlines, sparse stars
            float hz = vP.y;
            vec3 g2 = mix(bot, top, smoothstep(-0.05, 0.5, hz));
            g2 += accent * exp(-abs(hz) * 6.0) * 0.08;
            vec2 sc = floor(vec2(atan(vP.x, -vP.z), vP.y) * 160.0);
            g2 += step(0.997, h2(sc)) * smoothstep(0.1, 0.5, hz) * 0.55;
            if (kaleido > 0.01) g2 = mix(g2, c, kaleido * 0.6);
            c = g2;
          }
          gl_FragColor = vec4(c, 1.0);
        }`,
    }));
    sky.renderOrder = -1;
    this.sky = sky; scene.add(sky);

    // backdrop "hero" objects per biome (moon, sun gear, ringed planet, earth)
    this.backdrops = COMIC_BIOMES.map((b, i) => {
      const g = new THREE.Group();
      if (i === 0) { // PIZZA MOON with one slice orbiting
        const gap = Math.PI / 4;
        const crust = new THREE.Mesh(new THREE.CylinderGeometry(38, 38, 3, 48, 1, false, gap, Math.PI * 2 - gap), flat(0xd98a3a));
        const cheese = new THREE.Mesh(new THREE.CylinderGeometry(34, 34, 3.4, 48, 1, false, gap, Math.PI * 2 - gap), flat(0xffd35a));
        for (const c of [crust, cheese]) { c.rotation.x = Math.PI / 2; g.add(c); }
        for (let k = 0; k < 10; k++) {
          const a2 = gap + 0.3 + (k / 10) * (Math.PI * 2 - gap - 0.6), r = 10 + (k % 3) * 8;
          const pep = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 3.8, 16), flat(0xc8262a)); pep.rotation.x = Math.PI / 2;
          pep.position.set(Math.sin(a2) * r, Math.cos(a2) * r, 0.2); g.add(pep);
        }
        const slice = new THREE.Group();
        const sc = new THREE.Mesh(new THREE.CylinderGeometry(38, 38, 3, 8, 1, false, 0, gap), flat(0xd98a3a));
        const sch = new THREE.Mesh(new THREE.CylinderGeometry(34, 34, 3.4, 8, 1, false, 0, gap), flat(0xffd35a));
        for (const c of [sc, sch]) { c.rotation.x = Math.PI / 2; slice.add(c); }
        const sp = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 3.8, 16), flat(0xc8262a)); sp.rotation.x = Math.PI / 2; sp.position.set(Math.sin(gap / 2) * 20, Math.cos(gap / 2) * 20, 0.2); slice.add(sp);
        slice.scale.setScalar(0.55); g.add(slice); g.userData.slice = slice;
      }
      if (i === 1) { const gear = mesh(tor, flat(0xff7a00), 0, 0, 0, 60, 60, 60); g.add(gear); g.userData.spin = gear; }
      if (i === 2) {
        g.add(mesh(new THREE.SphereGeometry(1, 24, 16), toon(0xff2e88), 0, 0, 0, 55, 55, 55));
        const ring = mesh(new THREE.TorusGeometry(1, 0.06, 4, 48), flat(0x9dff3c), 0, 0, 0, 90, 90, 90); ring.rotation.x = 1.2; g.add(ring);
      }
      if (i === 3) { g.add(mesh(new THREE.SphereGeometry(1, 24, 16), toon(0x1a6cff), 0, 0, 0, 80, 80, 80)); g.add(mesh(new THREE.SphereGeometry(1, 16, 12), toon(0x2fd06b), 22, 30, 60, 30, 26, 30)); }
      g.position.set(i === 2 ? -60 : 40, i === 3 ? -40 : 70, -300);
      g.visible = i === 0; scene.add(g); return g;
    });

    // GRID backdrop: striped horizon sun + giant ring
    {
      const g = new THREE.Group();
      const sunMat = new THREE.ShaderMaterial({ fog: false, transparent: true, depthWrite: false, uniforms: { col: { value: new THREE.Color(0x00e5ff) }, time: { value: 0 } },
        vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 col; uniform float time; varying vec2 vU;
          void main(){ vec2 p = vU * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard;
            float y = vU.y; float band = step(0.5, fract(y * 14.0 - time * 0.5)) + step(0.55, y);
            if (band < 0.5 && y < 0.55) discard;
            vec3 c = mix(col, vec3(1.0), smoothstep(0.2, 1.0, y) * 0.6);
            gl_FragColor = vec4(c, 1.0); }` });
      const ringM = new THREE.Group(); // (kept name) = laser rig
      const beamMat = new THREE.MeshBasicMaterial({ color: 0x6ab4ff, fog: false, transparent: true, opacity: 0.85 });
      const beams = [];
      for (let k = 0; k < 6; k++) {
        const pivot = new THREE.Group(); pivot.position.set((k - 2.5) * 34, -10, 40 + (k % 2) * 30);
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 420, 6), beamMat); beam.position.y = 210; pivot.add(beam);
        pivot.rotation.z = (k % 2 ? 1 : -1) * 0.45; ringM.add(pivot); beams.push(pivot);
      }
      g.add(ringM);
      g.userData = { sunMat, ringM, beams, beamMat };
      g.visible = false; scene.add(g); this.gridBack = g;
    }

    // lights
    this.hemi = new THREE.HemisphereLight(BIOMES[0].hemiSky, BIOMES[0].hemiGround, 2.6);
    this.sun = new THREE.DirectionalLight(BIOMES[0].sun, 3.2);
    this.sun.position.set(4, 10, 3);
    scene.add(this.hemi, this.sun, this.sun.target);
    scene.fog = new THREE.Fog(BIOMES[0].fog, 45, 200);
    this.fogTarget = new THREE.Color(BIOMES[0].fog);
  }

  reset() {
    for (const c of this.chunks) this.scene.remove(c.group);
    this.chunks = []; this.animated = []; this.nextZ = 8; this.clearZones = [];
    if (this.portal) { this.scene.remove(this.portal); this.portal = null; }
    this.portalZ = -Infinity; this.pendingBiome = 0; this.biome = 0;
    const b = BIOMES[0];
    this.backdrops.forEach((g, i) => (g.visible = !isGrid() && i === 0));
    this.tintGrid(b);
    this.fogTarget.set(b.fog); this.scene.fog.color.set(b.fog);
    this.skyU.top.value.set(b.skyTop); this.skyU.bot.value.set(b.skyBot); this.skyU.accent.value.set(b.skyAccent); this.skyU.stars.value = 1;
    this.hemi.color.set(b.hemiSky); this.hemi.groundColor.set(b.hemiGround); this.sun.color.set(b.sun);
  }

  // switch the whole look (called from the style picker)
  setStyle(mode) {
    applyBiomes(mode);
    this.skyU.grid.value = mode === 'grid' ? 1 : 0;
    this.scene.fog.near = mode === 'grid' ? 6 : 45; this.scene.fog.far = mode === 'grid' ? 115 : 200;
    this.hemi.intensity = mode === 'grid' ? 1.5 : 2.6; this.sun.intensity = mode === 'grid' ? 1.1 : 3.2;
    this.reset();
  }
  tintGrid(b) {
    const on = isGrid(); this.gridBack.visible = on;
    if (on) this.gridBack.userData.beamMat.color.set(b.accents[1]);
  }

  biomeAt(z) { return z < this.portalZ ? this.pendingBiome : this.biome; }

  schedulePortal(z, biome) {
    this.portalZ = z; this.pendingBiome = biome;
    // giant comic portal ring
    const b = BIOMES[biome];
    const g = new THREE.Group();
    const r1 = mesh(tor, flat(b.accents[0]), 0, 2.5, 0, 6.5, 6.5, 6.5);
    const r2 = mesh(tor, flat(b.accents[1]), 0, 2.5, 0, 5.6, 5.6, 5.6);
    g.add(r1, r2); g.position.z = z; g.userData.portal = true; g.userData.spin = [r1, r2];
    this.scene.add(g); this.portal = g;
  }

  // returns true when the player crossed into a new biome this frame
  update(playerZ, dt, beatPhase, songTime) {
    this.skyU.time.value = songTime;
    this.sky.position.z = playerZ;
    this.gridBack.position.z = playerZ - 220;
    if (this.gridBack.visible) this.gridBack.userData.beams.forEach((b, k) => { b.rotation.z = (k % 2 ? 1 : -1) * (0.35 + Math.sin(songTime * 0.8 + k) * 0.25); b.rotation.x = Math.sin(songTime * 0.5 + k * 2) * 0.15; });
    for (const b of this.backdrops) {
      b.position.z = playerZ - 300; if (b.userData.spin) b.userData.spin.rotation.z += dt * 0.2;
      if (b.userData.slice) { const t = songTime * 0.5; b.userData.slice.position.set(Math.cos(t) * 62, Math.sin(t) * 62, 0); b.userData.slice.rotation.z = t * 2; }
    }
    this.beatPulse = Math.pow(1 - beatPhase, 3);

    let crossed = false;
    if (playerZ < this.portalZ) {
      this.biome = this.pendingBiome; this.portalZ = -Infinity; crossed = true;
      const b = BIOMES[this.biome];
      this.backdrops.forEach((g, i) => (g.visible = !isGrid() && i === this.biome));
      this.tintGrid(b);
      this.fogTarget.set(b.fog);
      this.skyU.top.value.set(b.skyTop); this.skyU.bot.value.set(b.skyBot); this.skyU.accent.value.set(b.skyAccent);
      this.skyU.stars.value = this.biome === 3 ? 2.5 : 1.2;
      this.hemi.color.set(b.hemiSky); this.hemi.groundColor.set(b.hemiGround); this.sun.color.set(b.sun);
    }
    this.scene.fog.color.lerp(this.fogTarget, 1 - Math.exp(-dt * 3));
    if (this.portal) {
      this.portal.userData.spin[0].rotation.z += dt * 1.5; this.portal.userData.spin[1].rotation.z -= dt * 2;
      const s = 1 + this.beatPulse * 0.08; this.portal.scale.set(s, s, 1);
      if (this.portal.position.z > playerZ + 10) { this.scene.remove(this.portal); this.portal = null; }
    }

    // generate ahead, drop behind
    while (this.nextZ > playerZ - 170) this.buildChunk(this.nextZ);
    while (this.chunks.length && this.chunks[0].z0 > playerZ + 20) {
      const c = this.chunks.shift(); this.scene.remove(c.group);
      this.animated = this.animated.filter((a) => a.chunk !== c);
    }
    // animate props on the beat
    for (const a of this.animated) a.fn(a.obj, songTime, this.beatPulse);
    return crossed;
  }

  // walls: which sides have a runnable wall in this z-span?
  wallAt(z, side) {
    for (const c of this.chunks) if (z <= c.z0 && z > c.z0 - CHUNK) return side < 0 ? c.wallL : c.wallR;
    return false;
  }

  buildChunk(z0) {
    const bi = this.biomeAt(z0 - CHUNK / 2);
    const b = BIOMES[bi];
    const g = new THREE.Group();
    const c = { z0, group: g, biome: bi, wallL: this.forceWalls || Math.random() < 0.55, wallR: this.forceWalls || Math.random() < 0.55 };
    const zc = z0 - CHUNK / 2;
    const idx = Math.round(-z0 / CHUNK);
    const acc = (i) => b.accents[i % b.accents.length];
    const anim = (obj, fn) => this.animated.push({ chunk: c, obj, fn });

    // floor: checker strip per lane
    for (let i = 0; i < 3; i++) {
      g.add(mesh(box, toon((i + idx) % 2 ? b.floor : b.floor2), LANES[i], -0.25, zc, 2.18, 0.5, CHUNK - 0.04));
    }
    if (!isGrid()) for (const x of [-1.1, 1.1]) g.add(mesh(box, flat(acc(1)), x, 0.01, zc, 0.06, 0.02, CHUNK)); // lane stripes (neon)
    else { // checker tiles + a single bright neon outline on the track edges
      for (let k = 0; k < CHUNK / 2; k++) for (let l = 0; l < 3; l++)
        g.add(mesh(box, toon((k + l + idx) % 2 ? b.floor2 : b.floor), LANES[l], 0.005, z0 - k * 2 - 1, 2.18, 0.02, 1.98));
      for (const x of [-3.35, 3.35]) { g.add(mesh(box, flat(acc(0)), x, 0.06, zc, 0.14, 0.14, CHUNK)); g.add(mesh(box, flat(acc(0)), x * 1.0, -0.6, zc, 0.06, 1.2, CHUNK)); }
    }

    // walls (runnable) — bright panels with neon trim
    for (const side of [-1, 1]) {
      const has = side < 0 ? c.wallL : c.wallR;
      if (has) {
        const w = mesh(box, toon(b.wall), side * (WALL_X + 0.3), 2.4, zc, 0.6, 4.8, CHUNK - 0.3);
        g.add(w);
        const trim = mesh(box, flat(isGrid() ? acc(1) : acc(side < 0 ? 0 : 1)), side * WALL_X, 0.6, zc, 0.05, isGrid() ? 0.05 : 0.12, CHUNK - 0.3);
        g.add(trim);
        const trim2 = mesh(box, flat(acc(side < 0 ? 0 : 1)), side * WALL_X, 4.5, zc, 0.05, 0.12, CHUNK - 0.3);
        g.add(trim2);
        anim(trim, (o, t, p) => o.scale.y = 0.12 + p * 0.5);
      }
    }

    // biome scenery (skipped where a giant set piece needs open sky)
    const clear = this.clearZones.some(([a, b2]) => zc > a && zc < b2);
    if (clear) { this.scene.add(g); this.chunks.push(c); this.nextZ -= CHUNK; return; }
    if (isGrid()) { this.gridProps(g, zc, b, acc, anim, idx); this.scene.add(g); this.chunks.push(c); this.nextZ -= CHUNK; return; }
    if (bi === 0) this.cityProps(g, zc, b, acc, anim, idx);
    if (bi === 1) this.machineProps(g, zc, b, acc, anim, idx);
    if (bi === 2) this.alienProps(g, zc, b, acc, anim, idx);
    if (bi === 3) this.orbitProps(g, zc, b, acc, anim, idx);

    this.scene.add(g); this.chunks.push(c); this.nextZ -= CHUNK;
  }

  gridProps(g, zc, b, acc, anim, idx) {
    // big dark navy silhouettes in the haze, giant speaker stacks pumping, a few soft lights
    const navy = toon(b.wall), navy2 = toon(0x0d1030), ringMat = flat(acc(1));
    for (const side of [-1, 1]) {
      if ((idx + (side > 0 ? 1 : 0)) % 3 === 0) { // speaker stack
        const sp = new THREE.Group(); const x = side * (9 + Math.random() * 3), h = 10 + Math.random() * 6;
        sp.add(mesh(box, navy, 0, h / 2, 0, 6, h, 5));
        for (const [y, r] of [[h * 0.3, 1.6], [h * 0.62, 1.6], [h * 0.87, 0.8]]) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.12, 6, 28), ringMat); ring.position.set(-side * 3.02, y, 0); ring.rotation.y = Math.PI / 2; sp.add(ring);
          const cone = mesh(new THREE.CylinderGeometry(r * 0.85, r * 0.85, 0.2, 20), navy2, -side * 3.05, y, 0, 1, 1, 1); cone.rotation.z = Math.PI / 2; sp.add(cone);
          anim(ring, (o, t, p) => o.scale.setScalar(1 + p * 0.18));
        }
        sp.position.set(x, -1, zc); g.add(sp);
      }
      for (let k = 0; k < 2; k++) { // tall silhouettes fading into the fog
        const h = 14 + Math.random() * 30, w = 4 + Math.random() * 6, d = 4 + Math.random() * 6;
        const x = side * (16 + Math.random() * 18), z = zc + (k - 0.5) * 8;
        g.add(mesh(box, navy, x, h / 2 - 1, z, w, h, d));
        if (Math.random() < 0.35) { const lamp = mesh(box, flat(acc(1)), x - side * (w / 2 + 0.02), h * (0.3 + Math.random() * 0.6), z, 0.05, 0.3, d * 0.5); g.add(lamp); }
      }
      if (Math.random() < 0.25) { // a lonely floating cube
        const cube = mesh(box, navy2, side * (7 + Math.random() * 5), 7 + Math.random() * 8, zc, 1.5, 1.5, 1.5);
        g.add(cube); const ph = Math.random() * 6;
        anim(cube, (o, t) => { o.rotation.x = t * 0.4 + ph; o.rotation.y = t * 0.5; });
      }
    }
  }

  cityProps(g, zc, b, acc, anim, idx) {
    for (const side of [-1, 1]) {
      for (let k = 0; k < 2; k++) {
        const h = 10 + Math.random() * 40, w = 5 + Math.random() * 6;
        const x = side * (12 + Math.random() * 18);
        const z = zc + (k - 0.5) * 8;
        g.add(mesh(box, toon(k ? 0x5a2a9a : 0x7a3ab0), x, h / 2 - 8, z, w, h, 6 + Math.random() * 4));
        // window columns
        const wc = acc(Math.floor(Math.random() * 3));
        for (let r = 0; r < 4; r++) {
          const win = mesh(box, flat(wc), x - side * (w / 2 + 0.05), Math.random() * h - 6, z, 0.1, 0.5, 4);
          g.add(win);
        }
        if (Math.random() < 0.4) {
          const sign = mesh(box, flat(acc(k + idx)), x - side * (w / 2 + 0.3), h - 10 + Math.random() * 4, z, 0.2, 2.2, 4.5);
          g.add(sign); anim(sign, (o, t, p) => { o.scale.x = 0.2 + p * 0.6; });
        }
      }
    }
    // rooftop clutter: AC units, antennas
    if (Math.random() < 0.6) {
      const side = Math.random() < 0.5 ? -1 : 1;
      g.add(mesh(box, toon(0x5a3a7a), side * 6, 0.6, zc, 1.6, 1.2, 1.6));
      g.add(mesh(cyl, toon(0x8a6aaa), side * 6.5, 3, zc - 3, 0.08, 6, 0.08));
    }
  }

  machineProps(g, zc, b, acc, anim, idx) {
    // ceiling beams
    for (let k = 0; k < 2; k++) g.add(mesh(box, toon(0x4a3326), 0, 7.5, zc - 4 + k * 8, 14, 0.6, 0.6));
    for (const side of [-1, 1]) {
      const gear = mesh(tor, toon(k(side) ? 0xb06020 : 0x7a4a2a), side * 8, 3, zc, 3.5, 3.5, 6);
      gear.rotation.y = Math.PI / 2; g.add(gear);
      const teeth = new THREE.Group();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        teeth.add(mesh(box, toon(0xb06020), 0, Math.cos(a) * 4.3, Math.sin(a) * 4.3, 0.6, 1, 1));
        teeth.children[i].rotation.x = a;
      }
      teeth.position.set(side * 8, 3, zc); g.add(teeth);
      const dir = side * (idx % 2 ? 1 : -1);
      anim(gear, (o, t) => (o.rotation.x = t * 0.8 * dir));
      anim(teeth, (o, t) => (o.rotation.x = t * 0.8 * dir));
      // pistons pumping on the beat
      const pist = mesh(cyl, toon(0xc8b090), side * 5.5, 6, zc + 5, 0.5, 4, 0.5); g.add(pist);
      const head = mesh(box, flat(acc(1)), side * 5.5, 4, zc + 5, 1.4, 0.4, 1.4); g.add(head);
      anim(head, (o, t, p) => (o.position.y = 3 + p * 2.2));
      // glowing pipes
      const pipe = mesh(cyl, flat(acc(side > 0 ? 0 : 2)), side * 4.8, 0.3, zc, 0.15, CHUNK, 0.15);
      pipe.rotation.x = Math.PI / 2; g.add(pipe);
    }
    function k(s) { return s > 0; }
  }

  alienProps(g, zc, b, acc, anim, idx) {
    for (let i = 0; i < 4; i++) {
      const side = i % 2 ? 1 : -1;
      const s = 1 + Math.random() * 3;
      const rock = mesh(ico, toon(i % 3 ? 0x6a3a9a : 0x3d1f55), side * (7 + Math.random() * 14), 2 + Math.random() * 10, zc + (Math.random() - 0.5) * CHUNK, s, s * 0.8, s);
      rock.rotation.set(Math.random() * 3, Math.random() * 3, 0); g.add(rock);
      const y0 = rock.position.y, ph = Math.random() * 6;
      anim(rock, (o, t) => { o.position.y = y0 + Math.sin(t * 1.2 + ph) * 0.8; o.rotation.y = t * 0.3 + ph; });
    }
    for (let i = 0; i < 3; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const cr = mesh(new THREE.ConeGeometry(0.6, 1, 5), flat(acc(i)), side * (5 + Math.random() * 3), 1, zc + (Math.random() - 0.5) * CHUNK, 1, 2 + Math.random() * 3, 1);
      g.add(cr); anim(cr, (o, t, p) => (o.scale.x = o.scale.z = 1 + p * 0.4));
    }
  }

  orbitProps(g, zc, b, acc, anim, idx) {
    if (idx % 2 === 0) {
      const arch = mesh(new THREE.TorusGeometry(6, 0.35, 6, 24, Math.PI), toon(0xe8ecf4), 0, 0, zc, 1, 1, 1);
      g.add(arch);
      const light = mesh(new THREE.TorusGeometry(6, 0.08, 4, 24, Math.PI), flat(acc(0)), 0, 0, zc - 0.4, 1, 1, 1);
      g.add(light); anim(light, (o, t, p) => o.scale.setScalar(1 + p * 0.03));
    }
    for (const side of [-1, 1]) {
      g.add(mesh(box, toon(0x9aa4bc), side * 9, -1, zc, 6, 0.6, CHUNK - 1));
      const ant = mesh(box, flat(acc(1)), side * 9, -0.6, zc, 0.2, 0.2, CHUNK - 1); g.add(ant);
      if (Math.random() < 0.5) {
        const panel = mesh(box, toon(0x1a3cff), side * 16, 2, zc, 8, 0.1, 4); panel.rotation.z = side * 0.3; g.add(panel);
      }
    }
  }
}
