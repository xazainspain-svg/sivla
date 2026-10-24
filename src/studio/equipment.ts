import * as THREE from 'three';
import { consoleTop, creditsPanel, label, neonSign, vinylTex } from './textures';

export interface Sig { t: number; bands: Float32Array; amt: number; active: boolean }
export interface Piece { group: THREE.Group; glow: THREE.MeshStandardMaterial[]; tick?: (s: Sig, light: number, hover: number) => void }
export interface Ctx { brushed: THREE.Texture; mobile: boolean }

const std = (color: number, rough: number, metal: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
};
const level = (s: Sig, i: number): number => (s.active ? s.bands[i % 8] : 0.07 + 0.05 * Math.sin(s.t * 0.9 + i * 0.7));
const emissive = (color: number, intensity: number): THREE.MeshStandardMaterial => {
  const m = std(0x0a0b10, 0.5, 0.2, { emissive: new THREE.Color(color), emissiveIntensity: intensity });
  m.userData.base = intensity; return m;
};

/** Consola de mezcla central con 16 canales: faders y vúmetros que siguen las bandas del audio. */
export function buildConsole(c: Ctx): Piece {
  const group = new THREE.Group();
  const metal = std(0x2a2d36, 0.35, 0.9, { roughnessMap: c.brushed, metalness: 0.9 });
  const graphite = std(0x14161c, 0.55, 0.5);
  const top = new THREE.MeshStandardMaterial({ map: consoleTop(), roughness: 0.5, metalness: 0.35 });
  const desk = box(3.6, 0.07, 1.25, std(0x0d0e12, 0.4, 0.5), 0, 0.74, 0);
  group.add(desk, box(0.08, 0.74, 1.1, graphite, -1.7, 0.37, 0), box(0.08, 0.74, 1.1, graphite, 1.7, 0.37, 0));
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.16, 0.95), [metal, metal, top, metal, metal, metal]);
  body.position.set(0, 0.88, 0.05); body.rotation.x = -0.16; body.castShadow = true; group.add(body);
  const glow: THREE.MeshStandardMaterial[] = [];
  const trim = emissive(0x2f5bee, 0.9); glow.push(trim);
  group.add(box(2.9, 0.014, 0.02, trim, 0, 0.96, 0.52));
  // faders (16)
  const faderGeo = new THREE.BoxGeometry(0.05, 0.045, 0.085);
  const faders = new THREE.InstancedMesh(faderGeo, std(0xcfd3e6, 0.3, 0.9), 16);
  const mat4 = new THREE.Matrix4();
  const cw = 2.9 / 16;
  const place = (i: number, z: number): void => { mat4.makeTranslation(-1.45 + cw * (i + 0.5), 0.98, 0.05 + z); faders.setMatrixAt(i, mat4); };
  for (let i = 0; i < 16; i++) place(i, 0.1);
  faders.instanceMatrix.setUsage(THREE.DynamicDrawUsage); group.add(faders);
  // vúmetros: 16 columnas × 8 segmentos
  const SEG = 8;
  const meterMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const meters = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.017, 0.02), meterMat, 16 * SEG);
  const col = new THREE.Color();
  const off = new THREE.Color(0x14182a);
  for (let i = 0; i < 16; i++) for (let s = 0; s < SEG; s++) {
    mat4.makeTranslation(-1.45 + cw * (i + 0.5), 1.1 + s * 0.026, -0.36); meters.setMatrixAt(i * SEG + s, mat4); meters.setColorAt(i * SEG + s, off);
  }
  meters.instanceColor!.setUsage(THREE.DynamicDrawUsage);
  group.add(meters, box(2.95, 0.34, 0.06, graphite, 0, 1.18, -0.4));
  // pantalla de la consola
  const lo = new THREE.Color(0x2f5bee), hi = new THREE.Color(0xe08a45);
  return {
    group, glow,
    tick: (s, light) => {
      for (let i = 0; i < 16; i++) {
        const L = level(s, i);
        place(i, 0.12 - L * 0.22);
        const lit = Math.round(L * SEG);
        for (let k = 0; k < SEG; k++) {
          if (k < lit) col.copy(lo).lerp(hi, k / (SEG - 1)).multiplyScalar(light); else col.copy(off).multiplyScalar(0.6 + 0.4 * light);
          meters.setColorAt(i * SEG + k, col);
        }
      }
      faders.instanceMatrix.needsUpdate = true; meters.instanceColor!.needsUpdate = true;
    },
  };
}

/** Un monitor de referencia: caja, woofer que late con el bajo y tweeter. */
export function buildMonitor(c: Ctx, side: 1 | -1): Piece {
  const group = new THREE.Group();
  const shell = std(0x101218, 0.6, 0.35, { roughnessMap: c.brushed });
  group.add(box(0.52, 0.82, 0.46, shell, 0, 1.7, 0), box(0.06, 0.96, 0.06, std(0x20232c, 0.4, 0.9), 0, 0.5, -0.05), box(0.4, 0.04, 0.34, std(0x20232c, 0.4, 0.9), 0, 0.02, -0.05));
  const glow: THREE.MeshStandardMaterial[] = [];
  const ringMat = emissive(0x2f5bee, 0.7); glow.push(ringMat);
  const wooferMat = std(0x07080b, 0.7, 0.2);
  const woofer = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.06, 32, 1, true), wooferMat);
  const cone = new THREE.Mesh(new THREE.CircleGeometry(0.15, 32), wooferMat);
  const wg = new THREE.Group(); wg.add(woofer, cone); cone.position.y = -0.02; wg.rotation.x = Math.PI / 2; wg.position.set(0, 1.5, 0.235);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.012, 8, 40), ringMat); ring.position.set(0, 1.5, 0.238);
  const tw = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(0x9aa0b8, 0.25, 1)); tw.rotation.x = Math.PI / 2; tw.position.set(0, 1.92, 0.232);
  group.add(wg, ring, tw);
  group.rotation.y = side * -0.2;
  return {
    group, glow,
    tick: (s, light) => {
      const k = s.active ? s.amt : 0.05 + 0.03 * Math.sin(s.t * 1.1);
      wg.scale.set(1, 1 + k * 0.5, 1);
      ring.scale.setScalar(1 + k * 0.05);
      ringMat.userData.pulse = k * 1.4 * light;
    },
  };
}

/** Sintetizador de 61 teclas con fila de potenciómetros iluminados. */
export function buildSynth(c: Ctx): Piece {
  const group = new THREE.Group();
  const body = std(0x15171e, 0.45, 0.7, { roughnessMap: c.brushed });
  group.add(box(1.7, 0.1, 0.52, body, 0, 0.86, 0), box(0.06, 0.86, 0.06, std(0x20232c, 0.4, 0.9), -0.7, 0.43, 0), box(0.06, 0.86, 0.06, std(0x20232c, 0.4, 0.9), 0.7, 0.43, 0), box(0.04, 0.04, 0.5, std(0x20232c, 0.4, 0.9), 0, 0.2, 0));
  const keys = new THREE.InstancedMesh(new THREE.BoxGeometry(0.0715, 0.03, 0.2), std(0xf2efe8, 0.4, 0.05), 24);
  const blacks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 0.035, 0.12), std(0x090a0d, 0.4, 0.2), 16);
  const m = new THREE.Matrix4(); let bi = 0;
  for (let i = 0; i < 24; i++) {
    m.makeTranslation(-0.84 + i * 0.0735 + 0.0357, 0.925, 0.15); keys.setMatrixAt(i, m);
    if (i < 23 && bi < 16 && [0, 1, 3, 4, 5].includes(i % 7)) { m.makeTranslation(-0.84 + (i + 1) * 0.0735, 0.945, 0.098); blacks.setMatrixAt(bi++, m); }
  }
  blacks.count = bi;
  const glow: THREE.MeshStandardMaterial[] = [];
  const knobMat = emissive(0xe08a45, 0.8); glow.push(knobMat);
  const knobs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.02, 0.025, 14), knobMat, 12);
  for (let i = 0; i < 12; i++) { m.makeTranslation(-0.6 + i * 0.11, 0.925, -0.12); knobs.setMatrixAt(i, m); }
  const screen = box(0.34, 0.1, 0.01, emissive(0x2f5bee, 1), 0.55, 0.93, -0.2); screen.rotation.x = -0.9; glow.push(screen.material as THREE.MeshStandardMaterial);
  group.add(keys, blacks, knobs, screen);
  return { group, glow, tick: (s, light) => { knobMat.userData.pulse = (s.active ? s.bands[3] * 1.5 : 0.1 + 0.1 * Math.sin(s.t * 1.7)) * light; } };
}

/** Panel de cristal con los créditos reales. */
export function buildCredits(): Piece {
  const group = new THREE.Group();
  const frame = emissive(0x9fb4ff, 0.5);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.56, 1.6), new THREE.MeshStandardMaterial({ map: creditsPanel(), emissiveMap: null, roughness: 0.15, metalness: 0.25, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.55 }));
  (panel.material as THREE.MeshStandardMaterial).emissiveMap = (panel.material as THREE.MeshStandardMaterial).map;
  panel.material.userData.base = 0.55;
  group.add(panel, box(2.64, 0.04, 0.05, frame, 0, 0.82, 0), box(2.64, 0.04, 0.05, frame, 0, -0.82, 0));
  return { group, glow: [panel.material as THREE.MeshStandardMaterial, frame] };
}

/** Rack de mastering con cinco módulos y barras de LED. */
export function buildMastering(c: Ctx): Piece {
  const group = new THREE.Group();
  const shell = std(0x0f1116, 0.5, 0.6, { roughnessMap: c.brushed });
  group.add(box(0.66, 1.9, 0.5, shell, 0, 0.95, 0));
  const glow: THREE.MeshStandardMaterial[] = [];
  const led = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const leds = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.025, 0.01), led, 5 * 8);
  const col = new THREE.Color(); const m = new THREE.Matrix4();
  for (let u = 0; u < 5; u++) {
    group.add(box(0.58, 0.2, 0.04, std(0x1b1e27, 0.35, 0.9, { roughnessMap: c.brushed }), 0, 0.5 + u * 0.28, 0.255));
    for (let k = 0; k < 8; k++) { m.makeTranslation(-0.2 + k * 0.045, 0.5 + u * 0.28 + 0.045, 0.28); leds.setMatrixAt(u * 8 + k, m); leds.setColorAt(u * 8 + k, col.set(0x14182a)); }
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 16), std(0xcfd3e6, 0.3, 1)); knob.rotation.x = Math.PI / 2; knob.position.set(0.2, 0.5 + u * 0.28 - 0.02, 0.29); group.add(knob);
  }
  leds.instanceColor!.setUsage(THREE.DynamicDrawUsage); group.add(leds);
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.3), new THREE.MeshStandardMaterial({ map: label([['MIX & MASTERING', '300 44px "Hanken Grotesk", sans-serif'], ['Mezcla · Masterización', '500 22px "IBM Plex Mono", monospace']], 512, 256), emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.4 }));
  (tag.material as THREE.MeshStandardMaterial).emissiveMap = (tag.material as THREE.MeshStandardMaterial).map; tag.material.userData.base = 0.4;
  tag.position.set(0, 2.1, 0.0); group.add(tag); glow.push(tag.material as THREE.MeshStandardMaterial);
  const lo = new THREE.Color(0x2f5bee), hi = new THREE.Color(0xe08a45), off = new THREE.Color(0x14182a);
  return {
    group, glow,
    tick: (s, light) => {
      for (let u = 0; u < 5; u++) {
        const L = level(s, u + 1);
        for (let k = 0; k < 8; k++) { if (k < Math.round(L * 8)) col.copy(lo).lerp(hi, k / 7).multiplyScalar(light); else col.copy(off); leds.setColorAt(u * 8 + k, col); }
      }
      leds.instanceColor!.needsUpdate = true;
    },
  };
}

/** Zona de contacto: sofá bajo y rótulo luminoso. */
export function buildContact(): Piece {
  const group = new THREE.Group();
  const fabric = std(0x1b1d27, 0.95, 0.05);
  group.add(box(2.2, 0.36, 0.8, fabric, 0, 0.3, 0), box(2.2, 0.55, 0.2, fabric, 0, 0.62, -0.32), box(0.2, 0.5, 0.8, fabric, -1.1, 0.42, 0), box(0.2, 0.5, 0.8, fabric, 1.1, 0.42, 0));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: neonSign(), transparent: true }));
  sign.position.set(0, 1.75, -0.5);
  const glow = emissive(0xe08a45, 0.0); // el sofá no brilla; el rótulo sí (ver tick)
  group.add(sign);
  const signMat = sign.material as THREE.MeshBasicMaterial;
  return { group, glow: [glow], tick: (s, light, hover) => { signMat.color.setScalar(light * (0.85 + 0.15 * Math.sin(s.t * 1.3 + 1) + hover * 0.45)); } };
}

/** Tocadiscos: el vinilo gira cuando suena el audio. */
export function buildTurntable(c: Ctx): Piece {
  const group = new THREE.Group();
  const body = std(0x16181f, 0.5, 0.6, { roughnessMap: c.brushed });
  for (const [x, z] of [[-0.4, -0.3], [0.4, -0.3], [-0.4, 0.3], [0.4, 0.3]]) group.add(box(0.05, 0.8, 0.05, std(0x20232c, 0.4, 0.9), x, 0.4, z));
  group.add(box(1.0, 0.09, 0.78, body, 0, 0.84, 0));
  const platter = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.03, 48), std(0xb9bfd6, 0.3, 1)); platter.position.set(-0.1, 0.905, 0); platter.castShadow = true;
  const vinyl = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.012, 64), [std(0x0a0b0f, 0.4, 0.3), new THREE.MeshStandardMaterial({ map: vinylTex(), roughness: 0.35, metalness: 0.3 }), std(0x0a0b0f, 0.4, 0.3)]);
  vinyl.position.set(-0.1, 0.927, 0);
  const arm = new THREE.Group();
  arm.add(box(0.03, 0.03, 0.03, std(0xcfd3e6, 0.3, 1), 0, 0, 0));
  const rod = box(0.012, 0.012, 0.5, std(0xcfd3e6, 0.25, 1), 0, 0.02, 0.25); arm.add(rod, box(0.05, 0.02, 0.07, std(0x15171e, 0.5, 0.5), 0, 0.02, 0.52));
  arm.position.set(0.36, 0.95, -0.28); arm.rotation.y = 0.45;
  const glow: THREE.MeshStandardMaterial[] = [];
  const led = emissive(0xe08a45, 0.9); glow.push(led);
  group.add(platter, vinyl, arm, box(0.03, 0.01, 0.03, led, 0.4, 0.89, 0.3));
  let ang = 0, spd = 0, last = 0;
  return {
    group, glow,
    tick: (s) => {
      const dt = Math.min(0.1, s.t - last); last = s.t;
      spd += ((s.active ? 3.6 : 0) - spd) * Math.min(1, dt * 1.6);
      ang += spd * dt; vinyl.rotation.y = ang;
      arm.rotation.y = 0.45 + (s.active ? 0.22 : 0);
    },
  };
}

/** Auriculares sobre la mesa: detalle de ambientación, sin interacción. */
export function buildHeadphones(): Piece {
  const group = new THREE.Group();
  const m = std(0x15171e, 0.45, 0.6);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 10, 32, Math.PI), m); band.rotation.z = 0; band.position.y = 0.12;
  const cupL = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.04, 28), m), cupR = cupL.clone();
  cupL.rotation.z = Math.PI / 2; cupR.rotation.z = Math.PI / 2; cupL.position.set(-0.1, 0.12, 0); cupR.position.set(0.1, 0.12, 0);
  const pad = std(0xe08a45, 0.8, 0.05); const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 24), pad), pr = pl.clone();
  pl.rotation.z = Math.PI / 2; pr.rotation.z = Math.PI / 2; pl.position.set(-0.075, 0.12, 0); pr.position.set(0.075, 0.12, 0);
  group.add(band, cupL, cupR, pl, pr); group.rotation.set(-1.2, 0, 0); group.traverse((o) => { o.castShadow = true; });
  return { group, glow: [] };
}
