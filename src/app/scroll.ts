import { clamp } from '../engine/math.ts';

/** Progreso 0–1 de una sección alta con contenido fijo (sticky) según su posición en pantalla. */
export function stickyProgress(rectTop: number, rectHeight: number, viewportH: number): number {
  const span = rectHeight - viewportH;
  return span <= 0 ? 0 : clamp(-rectTop / span, 0, 1);
}

/** Opacidad de una ventana [from, to] con entrada y salida suaves de `fade` de ancho. */
export function windowOpacity(p: number, from: number, to: number, fade: number): number {
  const inn = clamp((p - from) / fade, 0, 1);
  const out = clamp((to - p) / fade, 0, 1);
  return Math.min(inn, out);
}

/** Progreso global del recorrido hero → sound (0 en la parte alta, 1 al terminar la sección Sound). */
export function journeyProgress(scrollY: number, heroH: number, soundH: number, viewportH: number): number {
  const total = heroH + soundH - viewportH;
  return total <= 0 ? 0 : clamp(scrollY / total, 0, 1);
}
