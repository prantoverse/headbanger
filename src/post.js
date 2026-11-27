// Spider-Verse style comic post pipeline:
// scene -> RT (color + depth) -> fullscreen shader: ink outlines (depth+color sobel),
// CMY misregistration, speed lines, slow-mo duotone, impact frames, soft vignette.
import * as THREE from 'three';

const vert = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const frag = /* glsl */`
precision highp float;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 res;
uniform float time, slow, impact, shift, speed, near, far, dotScale, hurt, paint, trip, beat, dim, glow;
uniform vec3 inkCol, paperCol, shadowTint;
varying vec2 vUv;

float linDepth(vec2 uv){
  float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
  return (2.0 * near * far) / (far + near - z * (far - near));
}
float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
float vnz(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
vec3 srgb(vec3 c){ return pow(max(c, 0.0), vec3(1.0/2.2)); }
vec3 hueShift(vec3 c, float a){ const vec3 k = vec3(0.57735); float ca = cos(a); return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca); }

void main(){
  vec2 px = 1.0 / res;
  vec2 uv = vUv;
  // GROOVE: gentle wavy warp + breathing zoom on the beat
  if (trip > 0.01) {
    uv += vec2(sin(uv.y * 9.0 + time * 2.2), cos(uv.x * 7.0 + time * 1.7)) * 0.006 * trip;
    uv = (uv - 0.5) * (1.0 - beat * 0.03 * trip) + 0.5;
  }

  // --- CMY misregistration (print offset) ---
  vec2 dir = normalize(vec2(1.0, 0.6));
  float off = shift;
  vec3 col;
  col.r = texture2D(tColor, uv + dir * off * px).r;
  col.g = texture2D(tColor, uv).g;
  col.b = texture2D(tColor, uv - dir * off * px).b;
  col = srgb(col);

  // --- ink outlines: depth sobel + color sobel ---
  float d0 = linDepth(uv);
  float o = 1.25;
  float dl = linDepth(uv + vec2(-o, 0.0) * px), dr = linDepth(uv + vec2(o, 0.0) * px);
  float du = linDepth(uv + vec2(0.0, o) * px), dd = linDepth(uv + vec2(0.0, -o) * px);
  float dEdge = (abs(dl - d0) + abs(dr - d0) + abs(du - d0) + abs(dd - d0)) / max(d0, 0.5);
  float lc = luma(srgb(texture2D(tColor, uv).rgb));
  float ll = luma(srgb(texture2D(tColor, uv + vec2(-o, 0.0) * px).rgb));
  float lr = luma(srgb(texture2D(tColor, uv + vec2(o, 0.0) * px).rgb));
  float lu = luma(srgb(texture2D(tColor, uv + vec2(0.0, o) * px).rgb));
  float ld = luma(srgb(texture2D(tColor, uv + vec2(0.0, -o) * px).rgb));
  float cEdge = abs(ll - lr) + abs(lu - ld);
  float fade = 1.0 - smoothstep(far * 0.45, far * 0.95, d0); // distant stuff gets thinner ink
  float edge = max(smoothstep(0.10, 0.22, dEdge), smoothstep(0.20, 0.42, cEdge) * 0.85) * fade;

  float L = luma(col);

  // --- posterize slightly ---
  col = floor(col * 7.0 + 0.5) / 7.0 * 0.35 + col * 0.65;

  // --- slow-mo duotone ---
  vec3 duo = mix(vec3(0.05, 0.02, 0.12), vec3(0.0, 0.9, 1.0), smoothstep(0.05, 0.75, L));
  duo = mix(duo, paperCol, smoothstep(0.78, 1.0, L));
  col = mix(col, duo, slow * 0.72);

  // GROOVE: rainbow hue roll sweeping across the screen
  if (trip > 0.01) col = mix(col, hueShift(col, time * 1.6 + (vUv.x + vUv.y) * 3.0), trip * 0.7);

  // GRID: bloom-ish glow from bright pixels
  if (glow > 0.01) {
    vec3 gl = vec3(0.0);
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.7854;
      for (int r = 1; r <= 2; r++) {
        vec3 s = srgb(texture2D(tColor, uv + vec2(cos(a), sin(a)) * px * float(r) * 5.0).rgb);
        gl += max(s - 0.62, 0.0);
      }
    }
    col += gl / 16.0 * 1.1 * glow;
  }

  // ink
  col = mix(col, inkCol, edge * (1.0 - glow * 0.7));

  // --- speed lines ---
  vec2 c = uv - 0.5; c.x *= res.x / res.y;
  float ang = atan(c.y, c.x);
  float rad = length(c);
  float lines = step(0.9, hash(vec2(floor(ang * 60.0), floor(time * 6.0))));
  float lineMask = lines * smoothstep(0.45, 0.85, rad) * speed;
  col = mix(col, slow > 0.2 ? vec3(0.0, 0.9, 1.0) : paperCol, lineMask * 0.28);

  // vignette + hurt
  // soft vignette
  col *= 1.0 - smoothstep(0.42, 0.95, rad) * (0.42 + slow * 0.3);
  col = mix(col, vec3(1.0, 0.1, 0.25), hurt * smoothstep(0.3, 0.9, rad) * 0.8);

  // --- briefing: blur, darken and desaturate the world behind the instruction card
  if (dim > 0.01) {
    vec3 bl = vec3(0.0);
    float rr = 6.0 * dim;
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.7854;
      bl += srgb(texture2D(tColor, vUv + vec2(cos(a), sin(a)) * px * rr).rgb);
      bl += srgb(texture2D(tColor, vUv + vec2(cos(a + 0.39), sin(a + 0.39)) * px * rr * 2.2).rgb);
    }
    bl /= 16.0;
    float lb = luma(bl);
    bl = mix(vec3(lb), bl, 0.35) * 0.45;
    bl *= 1.0 - smoothstep(0.2, 0.85, rad) * 0.7;
    col = mix(col, bl, dim);
  }

  // --- impact frame: hard threshold black / white / red ---
  if (impact > 0.01) {
    float th = step(0.42, L);
    vec3 imp = mix(inkCol, paperCol, th);
    imp = mix(imp, vec3(1.0, 0.12, 0.3), edge);
    col = mix(col, imp, impact);
  }


  gl_FragColor = vec4(col, 1.0);
}`;

export class ComicPost {
  constructor(renderer, camera) {
    this.renderer = renderer; this.camera = camera;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType });
    this.rt.depthTexture = new THREE.DepthTexture(size.x, size.y);
    this.rt.depthTexture.type = THREE.UnsignedIntType;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, depthTest: false, depthWrite: false,
      uniforms: {
        tColor: { value: this.rt.texture }, tDepth: { value: this.rt.depthTexture },
        res: { value: size.clone() }, time: { value: 0 }, slow: { value: 0 }, impact: { value: 0 },
        shift: { value: 1.5 }, speed: { value: 0 }, hurt: { value: 0 }, paint: { value: 1 }, trip: { value: 0 }, beat: { value: 0 }, dim: { value: 0 }, glow: { value: 0 },
        near: { value: camera.near }, far: { value: camera.far },
        dotScale: { value: 6.5 * Math.max(1, renderer.getPixelRatio()) },
        inkCol: { value: new THREE.Color(0x0b0410) },
        paperCol: { value: new THREE.Color(1.0, 0.965, 0.88) },
        shadowTint: { value: new THREE.Vector3(0.35, 0.12, 0.45) },
      },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.qScene = new THREE.Scene(); this.qScene.add(this.quad);
    this.qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.u = this.mat.uniforms;
  }
  setStyle(mode) {
    const g = mode === 'grid';
    this.u.glow.value = g ? 1 : 0;
    this.u.inkCol.value.set(g ? 0x070818 : 0x0b0410);
    this.gridMode = g; this.u.shift.value = g ? 0 : 1.5;
  }
  setSize() {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.rt.setSize(size.x, size.y);
    this.u.res.value.copy(size);
    this.u.dotScale.value = 6.5 * Math.max(1, this.renderer.getPixelRatio());
  }
  render(scene) {
    const r = this.renderer;
    r.setRenderTarget(this.rt); r.render(scene, this.camera);
    r.setRenderTarget(null); r.render(this.qScene, this.qCam);
  }
}
