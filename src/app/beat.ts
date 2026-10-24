/** Estado de audio compartido: lo rellena main.ts y lo leen las secciones que reaccionan al sonido. */
export const beat = {
  amt: 0,
  active: false,
  bands: new Float32Array(8),
  /** Pide un muestreo del audio; main.ts lo conecta. Es idempotente dentro del mismo fotograma. */
  sample: (_dt: number): void => undefined,
};
