import * as THREE from 'three';
import { clamp, damp } from '../engine/math';
import { disposeTree } from '../engine/dispose';

const TRAIL = 12;
const ROWS = 6;

const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uMask;
uniform vec2 uRes;
uniform float uAspect, uTime, uScroll, uRep;
uniform vec4 uTrail[${TRAIL}];

void trail(vec2 p, out vec2 off, out float rip){
  off = vec2(0.); rip = 0.;
  for (int i = 0; i < ${TRAIL}; i++) {
    vec4 t = uTrail[i];
    if (t.w <= 0.001) continue;
    vec2 d = p - t.xy;
    float r2 = dot(d, d);
    float g = exp(-r2 / 0.03);
    off += d * g * t.w * 1.1;
    float r = sqrt(r2);
    rip += sin(r * 34.0 - t.z * 9.0) * exp(-r2 / 0.14) * t.w * 0.22;
  }
  off += 0.01 * vec2(sin(p.y * 7.0 + uTime * 0.8), cos(p.x * 6.0 + uTime * 0.7));
}

float field(vec2 uv){
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
  vec2 off; float rip; trail(p, off, rip);
  vec2 w = uv - off / vec2(uAspect, 1.0);
  float row = floor(w.y * ${ROWS}.0);
  float dir = mod(row, 2.0) < 1.0 ? 1.0 : -1.0;
  w.x += dir * uScroll * 0.6;
  float r = 5.0 / uRes.y;
  vec2 q = vec2(w.x * uRep, w.y);
  vec2 e = vec2(r * uRep / uAspect * 1.0, r);
  float h = texture2D(uMask, q).r * 0.36
    + (texture2D(uMask, q + vec2(e.x, 0.)).r + texture2D(uMask, q - vec2(e.x, 0.)).r
     + texture2D(uMask, q + vec2(0., e.y)).r + texture2D(uMask, q - vec2(0., e.y)).r) * 0.16;
  return h + rip;
}

vec3 env(vec3 r){
  float y = r.y * 0.5 + 0.5;
  vec3 c = mix(vec3(0.03, 0.05, 0.14), vec3(0.78, 0.85, 1.0), smoothstep(0.3, 0.8, y));
  c += vec3(0.9) * smoothstep(0.035, 0.0, abs(y - 0.5));
  c += vec3(0.95, 0.55, 0.22) * smoothstep(0.22, 0.0, abs(r.x - 0.6)) * 0.55 * smoothstep(0.3, 0.7, y);
  c += vec3(1.0) * pow(max(dot(r, normalize(vec3(-0.4, 0.6, 0.7))), 0.0), 36.0) * 2.0;
  return c;
}

void main(){
  vec2 uv = vUv;
  vec2 px = 1.5 / uRes;
  float h = field(uv);
  float hx = field(uv + vec2(px.x, 0.));
  float hy = field(uv + vec2(0., px.y));
  vec3 n = normalize(vec3(-(hx - h) / px.x * 0.009, -(hy - h) / px.y * 0.009, 1.0));
  float mask = smoothstep(0.34, 0.6, h);
  vec3 view = vec3(0., 0., -1.);
  vec3 r = reflect(view, n);
  float fres = pow(1.0 - clamp(n.z, 0., 1.), 2.0);
  vec3 metal = env(r) * (0.78 + 0.5 * fres);
  vec3 bg = mix(vec3(0.03, 0.05, 0.17), vec3(0.12, 0.08, 0.3), uv.x * 0.8 + uv.y * 0.2);
  vec3 pool = bg + env(r) * 0.1;
  vec3 col = mix(pool, metal, mask);
  col += vec3(0.5, 0.65, 1.0) * smoothstep(0.55, 0.4, abs(h - 0.47)) * 0.1;
  gl_FragColor = vec4(col, 1.0);
}`;

interface Pt { x: number; y: number; age: number; s: number }

/** Metal líquido: "SIVLA" repetido, deformado por el cursor y con reflejos de cromo. */
export class MetalScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly uniforms: Record<string, THREE.IUniform>;
  private readonly trail: Pt[] = [];
  private tex: THREE.CanvasTexture | null = null;
  private lastX = 0; private lastY = 0; private hasLast = false;
  private lastMove = -10;
  private scroll = 0; private scrollTarget = 0;
  private running = false; private raf = 0; private last = 0; private time = 0;
  private lastAspect = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    for (let i = 0; i < TRAIL; i++) this.trail.push({ x: 0, y: 0, age: 9, s: 0 });
    this.uniforms = {
      uMask: { value: null }, uRes: { value: new THREE.Vector2(1, 1) },
      uAspect: { value: 2 }, uTime: { value: 0 }, uScroll: { value: 0 }, uRep: { value: 4 },
      uTrail: { value: this.trail.map(() => new THREE.Vector4(0, 0, 9, 0)) },
    };
    const mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
    this.resize();
  }

  private buildMask(aspect: number): void {
    const rep = Math.max(1, Math.round(aspect * 1.8));
    const H = 768, W = Math.round((H * aspect) / rep);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d')!;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const row = H / ROWS;
    let size = row * 1.05;
    const face = (s: number): string => `600 ${s}px "Hanken Grotesk", system-ui, sans-serif`;
    g.font = face(size);
    const wmax = W * 0.82;
    const wd = g.measureText('SIVLA').width;
    if (wd > wmax) { size *= wmax / wd; g.font = face(size); }
    for (let i = 0; i < ROWS; i++) g.fillText('SIVLA', W / 2, row * (i + 0.53));
    this.tex?.dispose();
    this.tex = new THREE.CanvasTexture(c);
    this.tex.wrapS = this.tex.wrapT = THREE.RepeatWrapping;
    this.tex.wrapT = THREE.ClampToEdgeWrapping;
    this.tex.minFilter = this.tex.magFilter = THREE.LinearFilter;
    this.tex.generateMipmaps = false;
    this.uniforms.uMask.value = this.tex;
    this.uniforms.uRep.value = rep;
    this.lastAspect = aspect;
  }

  resize(): void {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(w, h, false);
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    (this.uniforms.uRes.value as THREE.Vector2).copy(size);
    const aspect = w / h;
    this.uniforms.uAspect.value = aspect;
    if (Math.abs(aspect - this.lastAspect) > 0.01) this.buildMask(aspect);
  }

  /** Redibuja la máscara (p. ej. cuando termina de cargar la tipografía). */
  rebuild(): void { this.buildMask(this.lastAspect || 2); }

  /** Coordenadas del cursor relativas al canvas (px). */
  pointer(px: number, py: number, w: number, h: number): void {
    const x = (px / w - 0.5) * (w / h), y = 0.5 - py / h;
    const speed = this.hasLast ? Math.hypot(x - this.lastX, y - this.lastY) : 0;
    this.lastMove = this.time;
    if (!this.hasLast || speed > 0.012) {
      const t = this.trail.reduce((a, b) => (b.age > a.age ? b : a));
      t.x = x; t.y = y; t.age = 0; t.s = clamp(0.35 + speed * 9, 0.35, 1.2);
      this.lastX = x; this.lastY = y; this.hasLast = true;
    }
  }
  leave(): void { this.hasLast = false; }
  setScroll(p: number): void { this.scrollTarget = p; }

  start(): void {
    if (this.running) return;
    this.running = true; this.last = performance.now();
    const loop = (now: number): void => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now; this.time += dt;
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop(): void { this.running = false; cancelAnimationFrame(this.raf); }

  private update(dt: number): void {
    // sin cursor, una gota viaja sola para que el metal nunca esté quieto
    if (this.time - this.lastMove > 1.5 && Math.floor(this.time * 4) !== Math.floor((this.time - dt) * 4)) {
      const a = this.time * 0.6;
      const t = this.trail.reduce((p, q) => (q.age > p.age ? q : p));
      t.x = Math.sin(a) * 0.7 * this.uniforms.uAspect.value * 0.5; t.y = Math.sin(a * 1.7) * 0.28; t.age = 0; t.s = 0.4;
    }
    this.scroll = damp(this.scroll, this.scrollTarget, 5, dt);
    this.uniforms.uScroll.value = this.scroll;
    this.uniforms.uTime.value = this.time;
    const arr = this.uniforms.uTrail.value as THREE.Vector4[];
    this.trail.forEach((t, i) => {
      t.age += dt;
      arr[i].set(t.x, t.y, t.age, t.s * clamp(1 - t.age / 1.8, 0, 1));
    });
  }

  dispose(): void { this.stop(); this.tex?.dispose(); disposeTree(this.scene); this.renderer.dispose(); }
}
