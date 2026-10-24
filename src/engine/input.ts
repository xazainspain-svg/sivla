import { damp, clamp } from './math';

/** Estado de entrada unificado: ratón, tacto y scroll. Todos los valores están normalizados. */
export interface InputState {
  /** Puntero en [-1, 1], eje Y hacia arriba. */
  x: number;
  y: number;
  /** Puntero suavizado. */
  sx: number;
  sy: number;
  /** Velocidad del puntero (unidades NDC por segundo). */
  vx: number;
  vy: number;
  /** Hay un puntero activo sobre la ventana. */
  active: boolean;
  /** Progreso de scroll 0..1 (suavizado). */
  scroll: number;
  /** Velocidad de scroll normalizada. */
  scrollVel: number;
  /** Pulsación mantenida. */
  down: boolean;
}

export class Input {
  readonly state: InputState = { x: 0, y: 0, sx: 0, sy: 0, vx: 0, vy: 0, active: false, scroll: 0, scrollVel: 0, down: false };
  private raw = { x: 0, y: 0 };
  private prev = { x: 0, y: 0 };
  private scrollTarget = 0;
  private off: Array<() => void> = [];

  constructor() {
    const on = <K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      window.addEventListener(type, fn as EventListener, opts);
      this.off.push(() => window.removeEventListener(type, fn as EventListener));
    };
    on('pointermove', (e) => {
      this.raw.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.raw.y = -((e.clientY / window.innerHeight) * 2 - 1);
      this.state.active = true;
    });
    on('pointerdown', (e) => {
      this.raw.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.raw.y = -((e.clientY / window.innerHeight) * 2 - 1);
      this.state.active = true;
      this.state.down = true;
    });
    on('pointerup', () => { this.state.down = false; });
    on('pointercancel', () => { this.state.down = false; this.state.active = false; });
    document.addEventListener('pointerleave', () => { this.state.active = false; });
    on('scroll', () => this.readScroll(), { passive: true });
    on('resize', () => this.readScroll());
    this.readScroll();
  }

  private readScroll(): void {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    this.scrollTarget = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
  }

  update(dt: number): void {
    const s = this.state;
    s.vx = (this.raw.x - this.prev.x) / Math.max(dt, 1e-3);
    s.vy = (this.raw.y - this.prev.y) / Math.max(dt, 1e-3);
    this.prev.x = this.raw.x;
    this.prev.y = this.raw.y;
    s.x = this.raw.x;
    s.y = this.raw.y;
    s.sx = damp(s.sx, this.raw.x, 8, dt);
    s.sy = damp(s.sy, this.raw.y, 8, dt);
    const before = s.scroll;
    s.scroll = damp(s.scroll, this.scrollTarget, 6, dt);
    s.scrollVel = damp(s.scrollVel, (s.scroll - before) / Math.max(dt, 1e-3), 10, dt);
  }

  dispose(): void {
    this.off.forEach((f) => f());
    this.off = [];
  }
}
