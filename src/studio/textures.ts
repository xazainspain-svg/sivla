import * as THREE from 'three';
import { WORKS } from '../app/works';

const FONT = '"Hanken Grotesk", system-ui, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')!];
}
function tex(c: HTMLCanvasElement, aniso = 4): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t;
}

/** Acabado cepillado: líneas finas horizontales para el mapa de rugosidad del metal. */
export function brushedMap(): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const v = 120 + Math.random() * 110;
    g.fillStyle = `rgba(${v},${v},${v},${0.15 + Math.random() * 0.25})`;
    g.fillRect(0, Math.random() * 256, 256, Math.random() * 1.4 + 0.4);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); return t;
}

/** Superficie de la consola: 16 canales con ranuras de fader y potenciómetros. */
export function consoleTop(): THREE.CanvasTexture {
  const [c, g] = canvas(1024, 512);
  g.fillStyle = '#15171d'; g.fillRect(0, 0, 1024, 512);
  const cw = 1024 / 16;
  for (let i = 0; i < 16; i++) {
    const x = i * cw + cw / 2;
    g.fillStyle = i % 4 === 0 ? 'rgba(47,91,238,.16)' : 'rgba(255,255,255,.03)';
    g.fillRect(i * cw + 3, 6, cw - 6, 500);
    for (let k = 0; k < 4; k++) {
      g.beginPath(); g.arc(x, 44 + k * 52, 11, 0, 7);
      g.fillStyle = '#0b0c10'; g.fill();
      g.strokeStyle = k === 0 ? '#e08a45' : '#5b6078'; g.lineWidth = 2; g.stroke();
      g.beginPath(); g.moveTo(x, 44 + k * 52); g.lineTo(x + Math.cos(i + k) * 8, 44 + k * 52 + Math.sin(i + k) * 8); g.strokeStyle = '#f2efe8'; g.stroke();
    }
    g.fillStyle = '#05060a'; g.fillRect(x - 3, 282, 6, 200);
    g.fillStyle = '#4a4f66'; g.font = `500 11px ${MONO}`; g.textAlign = 'center'; g.fillText(String(i + 1).padStart(2, '0'), x, 500);
  }
  return tex(c);
}

/** Panel de cristal con los créditos reales (datos de src/app/works.ts, perfil de Muso). */
export function creditsPanel(): THREE.CanvasTexture {
  const [c, g] = canvas(1024, 640);
  const grad = g.createLinearGradient(0, 0, 1024, 640);
  grad.addColorStop(0, 'rgba(24,30,62,.92)'); grad.addColorStop(1, 'rgba(12,14,30,.92)');
  g.fillStyle = grad; g.fillRect(0, 0, 1024, 640);
  g.strokeStyle = 'rgba(160,185,255,.55)'; g.lineWidth = 3; g.strokeRect(10, 10, 1004, 620);
  g.fillStyle = '#e08a45'; g.font = `500 22px ${MONO}`; g.fillText('CRÉDITOS · MUSO.AI', 44, 62);
  g.fillStyle = '#f2efe8'; g.font = `200 46px ${FONT}`; g.fillText('Siv-La', 44, 120);
  WORKS.forEach((w, i) => {
    const y = 180 + i * 62;
    g.fillStyle = '#f2efe8'; g.font = `300 30px ${FONT}`; g.fillText(w.title, 44, y);
    g.fillStyle = '#9aa3d6'; g.font = `400 20px ${FONT}`; g.fillText(w.artists.replaceAll(' • ', ' · '), 44, y + 26);
    g.fillStyle = '#e08a45'; g.font = `500 22px ${MONO}`; g.textAlign = 'right'; g.fillText(w.year, 980, y); g.textAlign = 'left';
  });
  return tex(c);
}

export function label(lines: [string, string][], w = 512, h = 256, bg = '#0c0e18'): THREE.CanvasTexture {
  const [c, g] = canvas(w, h);
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  let y = 60;
  for (const [text, spec] of lines) { g.font = spec; g.fillStyle = '#f2efe8'; g.textAlign = 'center'; g.fillText(text, w / 2, y); y += 56; }
  return tex(c);
}

export function neonSign(): THREE.CanvasTexture {
  const [c, g] = canvas(1024, 256);
  g.clearRect(0, 0, 1024, 256);
  g.textAlign = 'center'; g.fillStyle = '#ffd9b3'; g.shadowColor = '#e08a45'; g.shadowBlur = 28;
  g.font = `200 120px ${FONT}`; g.fillText('CONTACTO', 512, 140);
  g.shadowBlur = 0; g.font = `500 26px ${MONO}`; g.fillStyle = '#e08a45'; g.fillText('SOLICITAR UNA PRODUCCIÓN', 512, 200);
  return tex(c);
}

/** Disco de vinilo: surcos concéntricos y etiqueta ámbar. */
export function vinylTex(): THREE.CanvasTexture {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#0a0b0f'; g.fillRect(0, 0, 512, 512);
  for (let r = 70; r < 250; r += 2.2) { g.beginPath(); g.arc(256, 256, r, 0, 7); g.strokeStyle = `rgba(255,255,255,${0.03 + Math.random() * 0.06})`; g.lineWidth = 1; g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.moveTo(256, 256); g.arc(256, 256, 250, -0.5, 0.2); g.fill();
  g.beginPath(); g.arc(256, 256, 62, 0, 7); g.fillStyle = '#e08a45'; g.fill();
  g.fillStyle = '#0e1230'; g.font = `500 26px ${FONT}`; g.textAlign = 'center'; g.fillText('SIV-LA', 256, 264);
  g.beginPath(); g.arc(256, 256, 5, 0, 7); g.fillStyle = '#0a0b0f'; g.fill();
  return tex(c);
}
