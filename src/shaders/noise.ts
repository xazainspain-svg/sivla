/** Ruido de gradiente 3D propio (hash trigonométrico + interpolación quíntica suave). */
export const NOISE_GLSL = /* glsl */ `
vec3 hash3(vec3 p){
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}
float gnoise(vec3 p){
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(hash3(i + vec3(0,0,0)), f - vec3(0,0,0));
  float b = dot(hash3(i + vec3(1,0,0)), f - vec3(1,0,0));
  float c = dot(hash3(i + vec3(0,1,0)), f - vec3(0,1,0));
  float d = dot(hash3(i + vec3(1,1,0)), f - vec3(1,1,0));
  float e = dot(hash3(i + vec3(0,0,1)), f - vec3(0,0,1));
  float g = dot(hash3(i + vec3(1,0,1)), f - vec3(1,0,1));
  float h = dot(hash3(i + vec3(0,1,1)), f - vec3(0,1,1));
  float k = dot(hash3(i + vec3(1,1,1)), f - vec3(1,1,1));
  return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, g, u.x), mix(h, k, u.x), u.y), u.z);
}
`;
