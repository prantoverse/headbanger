// Spider-Verse style comic post pipeline:
// scene -> RT (color + depth) -> fullscreen shader: ink outlines (depth+color sobel),
// halftone shadows, CMY misregistration, speed lines, slow-mo duotone, impact frames, paper grain.
import * as THREE from 'three';

const vert = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const frag = /* glsl */`
precision highp float;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 res;
uniform float time, slow, impact, shift, speed, near, far, dotScale, hurt, paint;
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

void main(){
  vec2 px = 1.0 / res;
  vec2 uv = vUv;

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

  // --- halftone in shadows (rotated dot grid) ---
  float L = luma(col);
  float cell = dotScale * (1.0 + slow * 0.8);
  mat2 rot = mat2(0.7071, -0.7071, 0.7071, 0.7071);
  vec2 g = rot * (gl_FragCoord.xy) / cell;
  vec2 gc = fract(g) - 0.5;
  float r = clamp((0.62 - L) * 1.25, 0.0, 0.72);
  float dotMask = 1.0 - smoothstep(r - 0.06, r + 0.02, length(gc));
  col = mix(col, col * shadowTint, dotMask * 0.42);
  // light highlight dots (Ben-Day) in bright areas
  vec2 g2 = rot * (gl_FragCoord.xy + 3.0) / (cell * 0.75);
  float hr = clamp((L - 0.72) * 0.9, 0.0, 0.35);
  float hiMask = 1.0 - smoothstep(hr - 0.05, hr + 0.02, length(fract(g2) - 0.5));
  col = mix(col, paperCol, hiMask * 0.12);

  // --- posterize slightly ---
  col = floor(col * 7.0 + 0.5) / 7.0 * 0.35 + col * 0.65;

  // --- slow-mo duotone ---
  vec3 duo = mix(vec3(0.05, 0.02, 0.12), vec3(0.0, 0.9, 1.0), smoothstep(0.05, 0.75, L));
  duo = mix(duo, paperCol, smoothstep(0.78, 1.0, L));
  col = mix(col, duo, slow * 0.72);

  // ink
  col = mix(col, inkCol, edge);

  // --- speed lines ---
  vec2 c = uv - 0.5; c.x *= res.x / res.y;
  float ang = atan(c.y, c.x);
  float rad = length(c);
  float lines = step(0.9, hash(vec2(floor(ang * 60.0), floor(time * 6.0))));
  float lineMask = lines * smoothstep(0.45, 0.85, rad) * speed;
  col = mix(col, slow > 0.2 ? vec3(0.0, 0.9, 1.0) : paperCol, lineMask * 0.28);

  // vignette + hurt
  col *= 1.0 - smoothstep(0.55, 1.05, rad) * (0.35 + slow * 0.4);
  col = mix(col, vec3(1.0, 0.1, 0.25), hurt * smoothstep(0.3, 0.9, rad) * 0.8);

  // --- impact frame: hard threshold black / white / red ---
  if (impact > 0.01) {
    float th = step(0.42, L);
    vec3 imp = mix(inkCol, paperCol, th);
    imp = mix(imp, vec3(1.0, 0.12, 0.3), edge);
    col = mix(col, imp, impact);
  }

  // paper grain
  col += (hash(gl_FragCoord.xy) - 0.5) * 0.012; // static, barely-there paper tooth

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
        shift: { value: 1.5 }, speed: { value: 0 }, hurt: { value: 0 }, paint: { value: 1 },
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
