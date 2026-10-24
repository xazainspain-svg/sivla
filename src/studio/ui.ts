import { StudioScene, HOTSPOTS, type HotId } from './StudioScene';
import { hasWebGL2, prefersReducedMotion } from '../app/capabilities';
import { smoothstep } from '../engine/math';
import { WORKS } from '../app/works';

const ROLE: Record<string, string> = { producer: 'Productor', engineer: 'Ingeniería', mixing: 'Mezcla', composer: 'Compositor', mastering: 'Masterización' };
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

/** Enlaza el estudio 3D con la página: controles, objetos interactivos, diálogo de créditos, intro y alternativa sin WebGL. */
export function setupStudio(): void {
  const section = document.getElementById('studio');
  if (!section) return;
  const canvas = $<HTMLCanvasElement>('studioGl');
  const stage = $('studioStage');
  const tip = $('studioTip');
  const load = $('studioLoad');
  const name = $('studioName');
  const veil = document.querySelector<HTMLElement>('.studio-intro')!;
  const skip = $<HTMLButtonElement>('studioSkip');
  const dlg = $<HTMLDialogElement>('creditsDlg');
  const reduced = prefersReducedMotion();
  const smooth: ScrollBehavior = reduced ? 'auto' : 'smooth';
  let scene: StudioScene | null = null;

  // ---- diálogo de créditos (datos reales de src/app/works.ts)
  $('creditsList').innerHTML = WORKS.map((w) => `<li><a href="https://muso.ai/track/${w.muso}" target="_blank" rel="noopener"><b>${w.title}</b><span>${w.artists.replaceAll(' • ', ' · ')}</span><em>${w.roles.split(' • ').map((r) => ROLE[r] ?? r).join(' · ')} · ${w.year}</em></a></li>`).join('');
  $('creditsClose').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  // ---- acciones de cada objeto
  const toggleAudio = (): void => (document.querySelector('.listen-btn') as HTMLButtonElement | null)?.click();
  const go = (id: string): void => document.getElementById(id)?.scrollIntoView({ behavior: smooth });
  const act: Record<HotId, () => void> = {
    console: () => { if (!document.querySelector('.listen-btn[aria-pressed="true"]')) toggleAudio(); },
    monitors: toggleAudio,
    synth: () => go('works'),
    credits: () => dlg.showModal(),
    mastering: () => (document.querySelector('[data-service="Mix y Mastering"]') as HTMLButtonElement | null)?.click(),
    contact: () => go('contact'),
  };
  const later = new Set<HotId>(['synth', 'credits', 'mastering', 'contact']);
  const activate = (id: HotId): void => {
    scene?.focus(id);
    if (scene && later.has(id)) window.setTimeout(act[id], reduced ? 0 : 650); else act[id]();
  };
  document.querySelectorAll<HTMLButtonElement>('[data-hot]').forEach((b) => b.addEventListener('click', () => activate(b.dataset.hot as HotId)));

  // ---- controles
  const bind = (id: string, fn: () => void): void => $(id).addEventListener('click', fn);
  bind('studioReset', () => scene?.rig.reset());
  bind('studioZoomIn', () => scene?.rig.zoom(-8));
  bind('studioZoomOut', () => scene?.rig.zoom(8));
  const fsBtn = $<HTMLButtonElement>('studioFs');
  if (!stage.requestFullscreen) fsBtn.hidden = true;
  fsBtn.addEventListener('click', () => { if (document.fullscreenElement) void document.exitFullscreen(); else void stage.requestFullscreen(); });
  document.addEventListener('fullscreenchange', () => { fsBtn.textContent = document.fullscreenElement ? 'Salir' : 'Modo inmersivo'; scene?.resize(); });
  skip.addEventListener('click', () => scene?.skipIntro());

  if (!hasWebGL2()) { section.classList.add('no-gl'); load.hidden = true; skip.hidden = true; return; }

  // ---- puntero: arrastre (rotar), toque (accionar), pellizco (zoom), hover (etiqueta)
  const pts = new Map<number, { x: number; y: number }>();
  let down: { x: number; y: number; t: number; moved: number; id: number } | null = null;
  let lastT = 0;
  let pinch = 0;
  canvas.addEventListener('pointerdown', (e) => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, id: e.pointerId };
    canvas.setPointerCapture(e.pointerId); scene?.rig.begin(); lastT = performance.now();
    stage.classList.add('drag');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!scene) return;
    const p = pts.get(e.pointerId);
    if (!p) { // hover (ratón)
      if (e.pointerType === 'mouse') {
        const r = canvas.getBoundingClientRect();
        scene.rig.setParallax(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
        const id = scene.pick(e.clientX, e.clientY);
        scene.setHover(id);
        canvas.style.cursor = id ? 'pointer' : 'grab';
        tip.hidden = !id;
        if (id) { tip.textContent = HOTSPOTS.find((h) => h.id === id)!.label; tip.style.transform = `translate(${e.clientX - r.left + 14}px,${e.clientY - r.top + 14}px)`; }
      }
      return;
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) scene.rig.zoom(-(d - pinch) * 0.12);
      pinch = d; if (down) down.moved = 99; return;
    }
    if (down) down.moved += Math.abs(dx) + Math.abs(dy);
    const now = performance.now();
    scene.rig.drag(dx, dy, (now - lastT) / 1000, e.pointerType !== 'touch');
    lastT = now;
  });
  const up = (e: PointerEvent): void => {
    pts.delete(e.pointerId); pinch = 0;
    if (pts.size === 0) { scene?.rig.end(); stage.classList.remove('drag'); }
    if (down && down.id === e.pointerId && e.type === 'pointerup' && down.moved < 7 && performance.now() - down.t < 450 && scene) {
      const id = scene.pick(e.clientX, e.clientY);
      if (id) activate(id);
    }
    if (down && down.id === e.pointerId) down = null;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', () => { scene?.setHover(null); tip.hidden = true; scene?.rig.setParallax(0, 0); });
  canvas.addEventListener('keydown', (e) => {
    const k: Record<string, [number, number]> = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] };
    if (k[e.key]) { e.preventDefault(); scene?.rig.begin(); scene?.rig.drag(k[e.key][0], k[e.key][1], 0, true); scene?.rig.end(); }
    else if (e.key === '+' || e.key === '=') scene?.rig.zoom(-6);
    else if (e.key === '-') scene?.rig.zoom(6);
    else if (e.key === 'Home') scene?.rig.reset();
  });

  // ---- creación diferida, pausa fuera de pantalla y limpieza
  let building = false;
  const build = (): void => {
    building = true;
    try {
      scene = new StudioScene(canvas, { mobile: matchMedia('(pointer: coarse)').matches || window.innerWidth < 760, reduced });
    } catch {
      section.classList.add('no-gl'); load.hidden = true; return;
    }
    scene.onFrame = () => {
      if (!scene) return;
      const t = scene.introT;
      if (scene.introDone) { if (!stage.classList.contains('ready')) { stage.classList.add('ready'); skip.hidden = true; name.style.opacity = '0'; veil.style.opacity = '0'; } return; }
      name.style.opacity = String(smoothstep(0.3, 1.2, t));
      veil.style.opacity = String(1 - smoothstep(2.4, 4.2, t));
    };
    load.hidden = true;
    if (reduced) { stage.classList.add('ready'); skip.hidden = true; veil.style.opacity = '0'; }
    window.addEventListener('resize', () => scene?.resize());
    if (visible) scene.start();
  };
  let visible = false;
  new IntersectionObserver((es) => es.forEach((e) => {
    visible = e.isIntersecting;
    if (visible && !scene && !building) requestAnimationFrame(build);
    else if (scene) { if (visible) scene.start(); else scene.stop(); }
  }), { rootMargin: '200px 0px' }).observe(stage);
  window.addEventListener('pagehide', () => scene?.dispose());
}
