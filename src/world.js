// Endless rail world: chunks of corridor generated ahead of the player, four looping biomes.
import * as THREE from 'three';

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
const cyl = new THREE.CylinderGeometry(1, 1, 1, 10);
const ico = new THREE.IcosahedronGeometry(1, 0);
const tor = new THREE.TorusGeometry(1, 0.22, 6, 16);
function mesh(geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); return m;
}

export const BIOMES = [
  {
    name: 'NEON ROOFTOPS', skyTop: 0x2a0a5e, skyBot: 0xff4f9a, fog: 0xb03a8a,
    floor: 0x5a3a9a, floor2: 0x6e48b8, wall: 0x4a2a80, accents: [0xff2e88, 0x00e5ff, 0xffe600],
    sun: 0xffd3f0, hemiSky: 0x7a5cff, hemiGround: 0x5a2a80,
  },
  {
    name: 'INSIDE THE MACHINE', skyTop: 0x3a1a00, skyBot: 0xffa030, fog: 0xa85a10,
    floor: 0x6a4a3a, floor2: 0x80584a, wall: 0x5a3d2a, accents: [0xff7a00, 0x00ffc8, 0xffe600],
    sun: 0xffe2b0, hemiSky: 0xff9a3c, hemiGround: 0x5a3010,
  },
  {
    name: 'ALIEN WORLD', skyTop: 0x0a3a30, skyBot: 0xb8ff5a, fog: 0x3d8a4a,
    floor: 0x6a3a9a, floor2: 0x8048b8, wall: 0x4a2a70, accents: [0x9dff3c, 0xff2e88, 0x00e5ff],
    sun: 0xe9ffd0, hemiSky: 0x9dff3c, hemiGround: 0x4a2a6a,
  },
  {
    name: 'ORBITAL STATION', skyTop: 0x02021a, skyBot: 0x3a5cff, fog: 0x2a3a90,
    floor: 0xc8d0e0, floor2: 0x9aa4bc, wall: 0xe8ecf4, accents: [0xff1f3d, 0x00e5ff, 0xffe600],
    sun: 0xffffff, hemiSky: 0x9fc4ff, hemiGround: 0x30305a,
  },
];

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

    // sky dome
    this.skyU = { top: { value: new THREE.Color(BIOMES[0].skyTop) }, bot: { value: new THREE.Color(BIOMES[0].skyBot) }, time: { value: 0 }, stars: { value: 0.3 } };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: this.skyU,
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top, bot; uniform float time, stars; varying vec3 vP;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
        void main(){
          float t = smoothstep(-0.15, 0.55, vP.y);
          vec3 c = mix(bot, top, t);
          // banded comic gradient
          c = mix(bot, top, floor(t * 6.0) / 6.0);
          vec3 q = floor(vP * 220.0);
          float s = step(1.0 - 0.006 * stars, h(q)) * smoothstep(0.0, 0.4, vP.y);
          c += s * 0.9;
          gl_FragColor = vec4(c, 1.0);
        }`,
    }));
    sky.renderOrder = -1;
    this.sky = sky; scene.add(sky);

    // backdrop "hero" objects per biome (moon, sun gear, ringed planet, earth)
    this.backdrops = BIOMES.map((b, i) => {
      const g = new THREE.Group();
      if (i === 0) { g.add(mesh(new THREE.SphereGeometry(1, 24, 16), flat(0xfff6e0), 0, 0, 0, 38, 38, 38)); }
      if (i === 1) { const gear = mesh(tor, flat(0xff7a00), 0, 0, 0, 60, 60, 60); g.add(gear); g.userData.spin = gear; }
      if (i === 2) {
        g.add(mesh(new THREE.SphereGeometry(1, 24, 16), toon(0xff2e88), 0, 0, 0, 55, 55, 55));
        const ring = mesh(new THREE.TorusGeometry(1, 0.06, 4, 48), flat(0x9dff3c), 0, 0, 0, 90, 90, 90); ring.rotation.x = 1.2; g.add(ring);
      }
      if (i === 3) { g.add(mesh(new THREE.SphereGeometry(1, 24, 16), toon(0x1a6cff), 0, 0, 0, 80, 80, 80)); g.add(mesh(new THREE.SphereGeometry(1, 16, 12), toon(0x2fd06b), 22, 30, 60, 30, 26, 30)); }
      g.position.set(i === 2 ? -60 : 40, i === 3 ? -40 : 70, -300);
      g.visible = i === 0; scene.add(g); return g;
    });

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
    this.chunks = []; this.animated = []; this.nextZ = 8;
    if (this.portal) { this.scene.remove(this.portal); this.portal = null; }
    this.portalZ = -Infinity; this.pendingBiome = 0; this.biome = 0;
    const b = BIOMES[0];
    this.backdrops.forEach((g, i) => (g.visible = i === 0));
    this.fogTarget.set(b.fog); this.scene.fog.color.set(b.fog);
    this.skyU.top.value.set(b.skyTop); this.skyU.bot.value.set(b.skyBot); this.skyU.stars.value = 0.3;
    this.hemi.color.set(b.hemiSky); this.hemi.groundColor.set(b.hemiGround); this.sun.color.set(b.sun);
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
    for (const b of this.backdrops) { b.position.z = playerZ - 300; if (b.userData.spin) b.userData.spin.rotation.z += dt * 0.2; }
    this.beatPulse = Math.pow(1 - beatPhase, 3);

    let crossed = false;
    if (playerZ < this.portalZ) {
      this.biome = this.pendingBiome; this.portalZ = -Infinity; crossed = true;
      const b = BIOMES[this.biome];
      this.backdrops.forEach((g, i) => (g.visible = i === this.biome));
      this.fogTarget.set(b.fog);
      this.skyU.top.value.set(b.skyTop); this.skyU.bot.value.set(b.skyBot);
      this.skyU.stars.value = this.biome === 3 ? 3 : this.biome === 2 ? 1.2 : 0.3;
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
    const c = { z0, group: g, biome: bi, wallL: Math.random() < 0.55, wallR: Math.random() < 0.55 };
    const zc = z0 - CHUNK / 2;
    const idx = Math.round(-z0 / CHUNK);
    const acc = (i) => b.accents[i % b.accents.length];
    const anim = (obj, fn) => this.animated.push({ chunk: c, obj, fn });

    // floor: checker strip per lane
    for (let i = 0; i < 3; i++) {
      g.add(mesh(box, toon((i + idx) % 2 ? b.floor : b.floor2), LANES[i], -0.25, zc, 2.18, 0.5, CHUNK - 0.04));
    }
    // lane edge stripes (neon)
    for (const x of [-1.1, 1.1]) g.add(mesh(box, flat(acc(1)), x, 0.01, zc, 0.06, 0.02, CHUNK));

    // walls (runnable) — bright panels with neon trim
    for (const side of [-1, 1]) {
      const has = side < 0 ? c.wallL : c.wallR;
      if (has) {
        const w = mesh(box, toon(b.wall), side * (WALL_X + 0.3), 2.4, zc, 0.6, 4.8, CHUNK - 0.3);
        g.add(w);
        const trim = mesh(box, flat(acc(side < 0 ? 0 : 1)), side * WALL_X, 0.6, zc, 0.05, 0.12, CHUNK - 0.3);
        g.add(trim);
        const trim2 = mesh(box, flat(acc(side < 0 ? 0 : 1)), side * WALL_X, 4.5, zc, 0.05, 0.12, CHUNK - 0.3);
        g.add(trim2);
        anim(trim, (o, t, p) => o.scale.y = 0.12 + p * 0.5);
      }
    }

    // biome scenery
    if (bi === 0) this.cityProps(g, zc, b, acc, anim, idx);
    if (bi === 1) this.machineProps(g, zc, b, acc, anim, idx);
    if (bi === 2) this.alienProps(g, zc, b, acc, anim, idx);
    if (bi === 3) this.orbitProps(g, zc, b, acc, anim, idx);

    this.scene.add(g); this.chunks.push(c); this.nextZ -= CHUNK;
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
