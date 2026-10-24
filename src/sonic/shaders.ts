export const TERRAIN_VERT = /* glsl */ `
uniform sampler2D uH;
uniform vec2 uTex;      // columnas, filas
uniform float uFrac;    // avance sub-fila
uniform float uAmp;
varying vec3 vPos;
varying vec2 vUv;
float heightAt(vec2 uv){
  float v = (uv.y * (uTex.y - 1.0) + uFrac + 0.5) / uTex.y;
  return texture2D(uH, vec2(uv.x, min(v, 0.999))).r;
}
float ampMask(vec3 p, vec2 uv){
  float edge = smoothstep(0.0, 0.06, uv.x) * smoothstep(1.0, 0.94, uv.x);
  float far = smoothstep(1.0, 0.9, uv.y);
  float near = smoothstep(0.0, 0.58, uv.y);   // la energía se asienta al llegar bajo la cámara
  return edge * far * mix(0.12, 1.0, near);
}
void main(){
  vUv = uv;
  float h = heightAt(uv);
  vec3 p = position;
  p.y += h * uAmp * ampMask(p, uv);
  vPos = p;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

export const TERRAIN_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uH;
uniform vec2 uTex;
uniform float uFrac, uAmp, uFocus, uFocusAmt, uWidth, uTime, uLevel;
uniform vec3 uFog;
varying vec3 vPos;
varying vec2 vUv;
float heightAt(vec2 uv){
  float v = (uv.y * (uTex.y - 1.0) + uFrac + 0.5) / uTex.y;
  return texture2D(uH, vec2(clamp(uv.x, 0.0, 1.0), min(v, 0.999))).r;
}
float mask(vec2 uv){
  return smoothstep(0.0, 0.06, uv.x) * smoothstep(1.0, 0.94, uv.x) * smoothstep(1.0, 0.9, uv.y) * mix(0.12, 1.0, smoothstep(0.0, 0.58, uv.y));
}
void main(){
  vec2 uv = vUv;
  float du = 1.5 / uTex.x, dv = 1.5 / uTex.y;
  float h  = heightAt(uv) * mask(uv);
  float hx = (heightAt(uv + vec2(du, 0.)) * mask(uv + vec2(du, 0.)) - heightAt(uv - vec2(du, 0.)) * mask(uv - vec2(du, 0.)));
  float hz = (heightAt(uv + vec2(0., dv)) * mask(uv + vec2(0., dv)) - heightAt(uv - vec2(0., dv)) * mask(uv - vec2(0., dv)));
  // 26 x 44 unidades de mundo repartidas en la malla
  vec3 n = normalize(vec3(-hx * uAmp / (2.0 * du * 26.0), 1.0, hz * uAmp / (2.0 * dv * 44.0)));
  vec3 L = normalize(vec3(-0.55, 0.75, 0.35));
  float lam = clamp(dot(n, L) * 0.5 + 0.5, 0.0, 1.0);
  vec3 chalk = vec3(0.965, 0.955, 0.925);
  vec3 shade = vec3(0.40, 0.50, 0.86);                 // cobalto suave en sombra
  vec3 col = mix(shade, chalk, smoothstep(0.38, 0.78, lam));
  col = mix(col, vec3(0.30, 0.42, 0.90), (1.0 - smoothstep(0.0, 0.5, h)) * 0.10);
  // contornos topográficos
  float c = h * 26.0;
  float lw = 0.03 + fwidth(c) * 0.7;
  float line = smoothstep(0.5 - lw, 0.5, abs(fract(c) - 0.5));
  float lineW = smoothstep(0.0, 0.03, h);
  col = mix(col, vec3(0.055, 0.07, 0.19), clamp(line, 0., 1.) * 0.36 * lineW);
  // cresta cálida y reflejo rasante
  float peak = smoothstep(0.42, 0.9, h);
  col = mix(col, vec3(0.88, 0.54, 0.27), peak * 0.55);
  vec3 V = normalize(cameraPosition - vPos);
  float rim = pow(1.0 - clamp(dot(n, V), 0., 1.), 3.0);
  col += vec3(0.30, 0.38, 0.75) * rim * 0.22;
  // foco: la zona de frecuencias que se escucha
  float dx = (uv.x - uFocus);
  float f = exp(-dx * dx / (uWidth * uWidth)) * uFocusAmt;
  col = mix(col, vec3(0.95, 0.60, 0.28), f * (0.35 + h * 0.9));
  col += vec3(0.9, 0.55, 0.2) * f * 0.12;
  // niebla atmosférica
  float dist = length(cameraPosition - vPos);
  float fog = 1.0 - exp(-pow(dist * 0.043, 1.55));
  col = mix(col, uFog, clamp(fog, 0., 1.));
  gl_FragColor = vec4(col, 1.0);
}`;

export const BEAM_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
export const BEAM_FRAG = /* glsl */ `
precision highp float; varying vec2 vUv; uniform float uAmt; uniform float uLevel;
void main(){
  float side = 1.0 - smoothstep(0.0, 0.5, abs(vUv.x - 0.5));
  float up = pow(1.0 - vUv.y, 1.6);
  float fadeFar = smoothstep(0.0, 0.25, vUv.x * 0.0 + 1.0);
  gl_FragColor = vec4(1.0, 0.62, 0.3, side * side * up * uAmt * (0.35 + uLevel * 0.5));
}`;
