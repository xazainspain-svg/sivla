/** Utilidades de secuencia por tiempo. Sin dependencias. */
export const wait = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));

/** Anima un valor 0→1 durante `duration` ms con la curva dada y llama a `onUpdate` en cada fotograma. */
export function tween(duration: number, ease: (t: number) => number, onUpdate: (v: number) => void): Promise<void> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / duration);
      onUpdate(ease(k));
      if (k < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}
