import { NOISE_GLSL } from './noise';

/**
 * El disco líquido: una única malla radial cuyo relieve (surcos concéntricos) se calcula en la GPU.
 * - Los anillos nacen del centro hacia fuera (uIntro, en segundos) con un destello ámbar en el frente.
 * - El cursor hunde la superficie como una gota y propaga ondas.
 * - uPulse es un pulso de reposo procedural (NO es una señal de audio).
 * - Con audio activo (uAudio = 1): cada zona radial del disco sigue una de las 8 bandas de frecuencia
 *   (graves en el centro, agudos en el borde) y cada golpe de bombo lanza una onda de dentro hacia fuera.
 * - Las normales se derivan por diferencias finitas del campo de alturas.
 */
export const DISC_VERT = /* glsl */ `
${NOISE_GLSL}
uniform float uTime;
uniform float uIntro;
uniform vec2 uPointer;
uniform float uForce;
uniform float uPulse;
uniform float uBands[8];
uniform float uAudio;
uniform float uKickAge;
uniform float uKickAmt;
uniform float uInner;
uniform float uOuter;
varying vec3 vNormalW;
varying vec3 vPosW;
varying float vBirth;
varying float vRadial;

const float RINGS = 60.0;

float bandAt(float x){
  float f = clamp(x, 0.0, 1.0) * 7.0;
  int i = int(floor(f));
  int j = min(i + 1, 7);
  return mix(uBands[i], uBands[j], fract(f));
}

float ringReveal(float idx){
  float delay = idx * 0.026;
  float lt = clamp((uIntro - 0.15 - delay) / 0.75, 0.0, 1.0);
  return 1.0 - pow(1.0 - lt, 3.0);
}

float height(vec2 p){
  float r = length(p);
  float f = (r - uInner) / (uOuter - uInner) * RINGS;
  float idx = floor(f);
  float e = ringReveal(idx);
  float ridge = 0.5 + 0.5 * cos(6.2831853 * f);
  float breathe = 1.0 + 0.04 * sin(uTime * 0.38);
  float zone = bandAt((r - uInner) / (uOuter - uInner));
  float h = ridge * 0.085 * (1.0 + uAudio * zone * 1.7) * e * breathe;
  h += gnoise(vec3(p * 0.55, uTime * 0.12)) * 0.12 * e;
  float d = length(p - uPointer);
  h -= uForce * 0.24 * exp(-d * d * 1.3);
  h += uForce * 0.05 * sin(d * 13.0 - uTime * 6.0) * exp(-d * 0.9);
  h += (1.0 - uAudio) * uPulse * 0.035 * sin(r * 9.0 - uTime * 3.0) * e;
  float front = uInner + uKickAge * 3.6;
  h += uAudio * uKickAmt * 0.075 * exp(-pow((r - front) * 2.6, 2.0)) * exp(-uKickAge * 1.6) * e;
  return h + (1.0 - e) * 0.55;
}

void main(){
  vec2 p = position.xy;
  float eps = 0.006;
  float h0 = height(p);
  float hx = height(p + vec2(eps, 0.0));
  float hy = height(p + vec2(0.0, eps));
  vec3 n = normalize(vec3(-(hx - h0) / eps, -(hy - h0) / eps, 1.0));
  float f = (length(p) - uInner) / (uOuter - uInner) * RINGS;
  float e = ringReveal(floor(f));
  vBirth = e * (1.0 - e) * 4.0;
  vRadial = (length(p) - uInner) / (uOuter - uInner);
  vNormalW = normalize(mat3(modelMatrix) * n);
  vec4 wp = modelMatrix * vec4(p, h0, 1.0);
  vPosW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const DISC_FRAG = /* glsl */ `
uniform float uTime;
uniform float uAudio;
uniform float uKickAge;
uniform float uKickAmt;
varying vec3 vNormalW;
varying vec3 vPosW;
varying float vBirth;
varying float vRadial;

// Estudio analítico: gradiente de fondo + cajas de luz ámbar, cobalto y blanca.
vec3 studio(vec3 r){
  vec3 c = mix(vec3(0.03, 0.04, 0.10), vec3(0.64, 0.70, 0.94), smoothstep(-0.6, 0.9, r.y));
  c += vec3(3.2, 3.0, 2.8) * pow(max(dot(r, normalize(vec3(0.4, 0.9, 0.5))), 0.0), 38.0);
  c += vec3(0.4, 0.7, 2.6) * pow(max(dot(r, normalize(vec3(-0.9, 0.2, 0.3))), 0.0), 22.0);
  c += vec3(2.8, 1.2, 0.4) * pow(max(dot(r, normalize(vec3(0.9, -0.1, 0.2))), 0.0), 22.0);
  c += vec3(0.4, 0.5, 1.6) * pow(max(dot(r, normalize(vec3(0.0, -0.9, 0.4))), 0.0), 10.0);
  return c;
}
vec3 palette(float t){ return 0.5 + 0.5 * cos(6.2831853 * (vec3(0.0, 0.33, 0.67) + t)); }

void main(){
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vPosW);
  vec3 R = reflect(-V, N);
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 3.0);
  vec3 env = studio(R);
  vec3 film = palette(ndv * 1.3 + vRadial * 0.6 + uTime * 0.04);
  vec3 col = env * mix(vec3(0.92), film, 0.30 + 0.35 * fres);
  col += fres * vec3(0.18, 0.32, 0.9) * 0.55;
  col += vBirth * vec3(0.88, 0.54, 0.27) * 1.4;
  col += uAudio * uKickAmt * exp(-uKickAge * 3.0) * vec3(0.88, 0.54, 0.27) * 0.18;
  // el borde exterior se funde con el papel
  col = mix(col, vec3(0.96, 0.97, 0.985), smoothstep(0.96, 1.0, vRadial));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
