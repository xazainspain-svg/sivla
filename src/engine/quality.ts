/** Calidad adaptativa con histéresis. Pura: se alimenta con tiempos de fotograma en ms. */
export type QualityLevel = 0 | 1 | 2;

export interface QualityProfile {
  label: string;
  maxPixelRatio: number;
  /** Segmentos angulares y radiales de la malla del disco. */
  thetaSegments: number;
  phiSegments: number;
}

export const PROFILES: Record<QualityLevel, QualityProfile> = {
  0: { label: 'Baja', maxPixelRatio: 1, thetaSegments: 96, phiSegments: 260 },
  1: { label: 'Media', maxPixelRatio: 1.25, thetaSegments: 128, phiSegments: 380 },
  2: { label: 'Alta', maxPixelRatio: 2, thetaSegments: 160, phiSegments: 520 },
};

export class QualityController {
  level: QualityLevel;
  auto: boolean;
  private samples: number[] = [];
  private cooldown = 0;

  constructor(level: QualityLevel = 2, auto = true) {
    this.level = level;
    this.auto = auto;
  }

  setManual(level: QualityLevel): void {
    this.level = level;
    this.auto = false;
    this.samples.length = 0;
  }

  /** Registra un fotograma (ms). Devuelve el nivel nuevo si cambió, o null. */
  push(frameMs: number): QualityLevel | null {
    if (!this.auto) return null;
    if (this.cooldown > 0) {
      this.cooldown--;
      return null;
    }
    this.samples.push(frameMs);
    if (this.samples.length > 90) this.samples.shift();
    if (this.samples.length < 60) return null;
    const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    if (avg > 24 && this.level > 0) return this.change((this.level - 1) as QualityLevel);
    if (avg < 12.5 && this.level < 2 && this.samples.length >= 90) return this.change((this.level + 1) as QualityLevel);
    return null;
  }

  private change(next: QualityLevel): QualityLevel {
    this.level = next;
    this.samples.length = 0;
    this.cooldown = 120;
    return next;
  }
}
