/** Estado de audio compartido: lo rellena main.ts y lo leen las secciones que reaccionan al sonido. */
export const beat = {
  amt: 0,
  active: false,
  bands: new Float32Array(8),
  /** Espectro (512 bins) y su frecuencia de muestreo, y nombre de la fuente que suena. */
  spec: new Uint8Array(512),
  rate: 44100,
  label: '',
  /** Enfoca una zona del espectro en el audio real (main.ts lo conecta). */
  setFocus: (_freq: number, _amount: number, _q: number): void => undefined,
  /** Pide un muestreo del audio; main.ts lo conecta. Es idempotente dentro del mismo fotograma. */
  sample: (_dt: number): void => undefined,
};
