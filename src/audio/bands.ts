/** Análisis de espectro puro (sin Web Audio): FFT en bytes → 8 bandas suavizadas + detector de bombo. Probable sin navegador. */

/** Límites de las 8 bandas en Hz: sub, bajo, medio-bajo, medio, medio-alto, presencia, brillo, aire. */
export const BAND_EDGES = [20, 60, 150, 300, 600, 1200, 2500, 5000, 12000] as const;
export const BAND_COUNT = 8;
/** Compensación: el oído y la música reparten menos energía a los agudos. */
const GAIN = [1, 1, 1.1, 1.3, 1.6, 2.0, 2.6, 3.4];

/** Convierte datos de `getByteFrequencyData` (0–255) en 8 bandas normalizadas 0–1. */
export function bandsFromFFT(data: ArrayLike<number>, sampleRate: number, fftSize: number, out = new Float32Array(BAND_COUNT)): Float32Array {
  const binHz = sampleRate / fftSize;
  for (let b = 0; b < BAND_COUNT; b++) {
    const lo = Math.max(1, Math.floor(BAND_EDGES[b] / binHz));
    const hi = Math.max(lo + 1, Math.min(data.length, Math.ceil(BAND_EDGES[b + 1] / binHz)));
    let sum = 0;
    for (let i = lo; i < hi; i++) sum += data[i];
    out[b] = Math.min(1, (sum / (hi - lo) / 255) * GAIN[b]);
  }
  return out;
}

/** Suavizado con ataque rápido y caída lenta, independiente de la tasa de fotogramas. */
export class BandSmoother {
  readonly value = new Float32Array(BAND_COUNT);
  private attack: number;
  private release: number;
  constructor(attack = 30, release = 6) {
    this.attack = attack;
    this.release = release;
  }
  update(raw: ArrayLike<number>, dt: number): Float32Array {
    for (let i = 0; i < BAND_COUNT; i++) {
      const k = raw[i] > this.value[i] ? this.attack : this.release;
      this.value[i] += (raw[i] - this.value[i]) * (1 - Math.exp(-k * dt));
    }
    return this.value;
  }
  reset(): void { this.value.fill(0); }
}

/** Detector de golpe de bombo: umbral adaptativo sobre sub + bajo, con subida brusca y tiempo refractario. */
export class KickDetector {
  private mean = 0;
  private prev = 0;
  private last = -10;
  private refractory: number;
  private minLevel: number;
  constructor(refractory = 0.12, minLevel = 0.3) {
    this.refractory = refractory;
    this.minLevel = minLevel;
  }
  /** `bands` crudas, `now` en segundos. Devuelve true si hay golpe. */
  detect(bands: ArrayLike<number>, now: number, dt: number): boolean {
    const energy = (bands[0] + bands[1]) / 2;
    const threshold = Math.max(this.minLevel, this.mean * 1.35 + 0.08);
    const rising = energy - this.prev > 0.03;
    const hit = energy > threshold && rising && now - this.last > this.refractory;
    this.mean += (energy - this.mean) * (1 - Math.exp(-1.5 * dt));
    this.prev = energy;
    if (hit) this.last = now;
    return hit;
  }
}
