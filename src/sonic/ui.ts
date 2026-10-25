import { SonicScene, freqAt } from './SonicScene';
import { beat } from '../app/beat';
import { hasWebGL2, prefersReducedMotion } from '../app/capabilities';
import { clamp } from '../engine/math';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const fmt = (hz: number): string => (hz >= 1000 ? `${(hz / 1000).toFixed(hz >= 10000 ? 0 : 1).replace('.', ',')} kHz` : `${Math.round(hz)} Hz`);
const zone = (hz: number): string => (hz < 120 ? 'subgraves' : hz < 400 ? 'graves' : hz < 2000 ? 'medios' : hz < 6000 ? 'presencia' : 'aire');

/** Sección "Dentro del sonido": paisaje del espectro que se recorre; el cursor enfoca (y hace sonar) una zona de frecuencias. */
export function setupSonic(): void {
  const section = document.getElementById('sonic');
  if (!section) return;
  const canvas = $<HTMLCanvasElement>('sonicGl'), stage = $('sonicStage'), cur = $('sonicCur'), curHz = $('sonicCurHz');
  const play = $<HTMLButtonElement>('sonicPlay'), status = $('sonicStatus');
  const listen = (): HTMLButtonElement | null => document.querySelector('.listen-btn');
  const reduced = prefersReducedMotion();
  let scene: SonicScene | null = null;
  const coarse = matchMedia('(pointer: coarse)').matches;

  const tourBtn = $<HTMLButtonElement>('sonicTour');
  play.addEventListener('click', () => { scene?.stopTour(); listen()?.click(); });
  tourBtn.addEventListener('click', () => {
    if (!scene) return;
    if (scene.touring) { scene.stopTour(); scene.setFocus(scene.focus, false); return; }
    if (listen()?.getAttribute('aria-pressed') !== 'true') listen()?.click();
    window.setTimeout(() => scene?.startTour(), 500);
  });
  const paint = (): void => {
    const on = listen()?.getAttribute('aria-pressed') === 'true';
    play.textContent = on ? 'Pausar' : 'Entrar en el sonido';
    play.setAttribute('aria-pressed', String(on));
    if (!on) scene?.stopTour();
  };
  const lb = listen();
  if (lb) new MutationObserver(paint).observe(lb, { attributes: true, attributeFilter: ['aria-pressed'] });
  paint();

  if (!hasWebGL2()) { section.classList.add('no-gl'); status.textContent = 'Tu navegador no puede mostrar el paisaje 3D; el botón sigue reproduciendo la canción.'; return; }

  // ---- puntero: ratón = enfocar al pasar, arrastrar = mirar; táctil = arrastrar en horizontal para enfocar
  let pressed = false; let lastT = 0; let lx = 0, ly = 0; let touchFocus = false;
  const place = (e: PointerEvent): { u: number; v: number } => {
    const r = canvas.getBoundingClientRect();
    return { u: clamp((e.clientX - r.left) / r.width, 0, 1), v: clamp((e.clientY - r.top) / r.height, 0, 1) };
  };
  const showCursor = (u: number): void => {
    cur.hidden = false; cur.style.transform = `translateX(${(u * canvas.clientWidth).toFixed(1)}px)`; curHz.textContent = fmt(freqAt(u));
  };
  canvas.addEventListener('pointerdown', (e) => {
    scene?.stopTour(); pressed = true; lx = e.clientX; ly = e.clientY; lastT = performance.now(); canvas.setPointerCapture(e.pointerId);
    if (e.pointerType === 'touch') { touchFocus = true; const p = place(e); scene?.setFocus(p.u, true); showCursor(p.u); } else scene?.begin();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!scene) return;
    const p = place(e);
    if (e.pointerType === 'touch') { if (pressed) { scene.setFocus(p.u, true); showCursor(p.u); } return; }
    if (pressed) { const now = performance.now(); scene.look(e.clientX - lx, e.clientY - ly, (now - lastT) / 1000); lx = e.clientX; ly = e.clientY; lastT = now; return; }
    if (scene.touring) return;
    scene.setFocus(p.u, true, p.v); showCursor(p.u);
  });
  const up = (): void => { pressed = false; scene?.end(); if (touchFocus) { touchFocus = false; scene?.setFocus(scene.focus, false); cur.hidden = true; } };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', () => { if (!pressed) { scene?.setFocus(scene.focus, false); cur.hidden = true; } });
  let kt = 0;
  canvas.addEventListener('keydown', (e) => {
    if (!scene) return;
    scene.stopTour();
    const step = e.shiftKey ? 0 : 0.03;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      if (e.shiftKey) { scene.begin(); scene.look(e.key === 'ArrowLeft' ? -30 : 30, 0, 0); scene.end(); return; }
      scene.setFocus(scene.focus + (e.key === 'ArrowLeft' ? -step : step), true); showCursor(scene.focus);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); scene.setFocus(scene.focus, true, scene.width + (e.key === 'ArrowUp' ? -0.1 : 0.1)); }
    else return;
    window.clearTimeout(kt); kt = window.setTimeout(() => { scene?.setFocus(scene.focus, false); cur.hidden = true; }, 1600);
  });

  // ---- creación diferida y pausa fuera de pantalla
  let building = false, visible = false, tick = 0;
  const build = (): void => {
    building = true;
    try { scene = new SonicScene(canvas, { mobile: matchMedia('(pointer: coarse)').matches || window.innerWidth < 760, reduced }); }
    catch { section.classList.add('no-gl'); status.textContent = 'No se pudo iniciar el paisaje 3D.'; return; }
    scene.onFrame = () => {
      const now = performance.now(); if (now - tick < 140 || !scene) return; tick = now;
      tourBtn.textContent = scene.touring ? 'Detener recorrido' : 'Recorrido guiado';
      if (scene.touring && beat.active) status.textContent = scene.tourLabel;
      else if (!beat.active) status.textContent = 'En reposo. Pulsa “Entrar en el sonido” para escuchar la canción y recorrer su relieve.';
      else if (scene.engaged) status.textContent = `Escuchas ${fmt(scene.focusHz)} · ${zone(scene.focusHz)} · foco ${scene.width < 0.34 ? 'estrecho' : scene.width < 0.67 ? 'medio' : 'ancho'}`;
      else status.textContent = `Sonando: ${beat.label}. ${coarse ? 'Desliza el dedo en horizontal' : 'Mueve el cursor'} para enfocar una zona.`;
    };
    section.classList.add('ready');
    window.addEventListener('resize', () => scene?.resize());
    if (visible) scene.start();
  };
  new IntersectionObserver((es) => es.forEach((e) => {
    visible = e.isIntersecting;
    if (visible && !scene && !building) requestAnimationFrame(build);
    else if (scene) { if (visible) scene.start(); else scene.stop(); }
  }), { rootMargin: '150px 0px' }).observe(stage);
  window.addEventListener('pagehide', () => scene?.dispose());
}
