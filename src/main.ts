import './styles/main.css';
import { Engine } from './engine/engine';
import { hasWebGL2, prefersReducedMotion } from './app/capabilities';
import { easeOutCubic } from './engine/math';
import { tween, wait } from './animation/timeline';

const body = document.body;
const pre = document.getElementById('pre') as HTMLElement;
const cnt = document.getElementById('cnt') as HTMLElement;
const canvas = document.getElementById('gl') as HTMLCanvasElement;
const hero = document.getElementById('hero') as HTMLElement;

// Las letras del wordmark se rellenan desde el atributo para que el HTML siga siendo legible sin JS.
document.querySelectorAll<HTMLElement>('.wm i').forEach((el) => { el.dataset.c = el.textContent ?? ''; el.textContent = ''; });

async function boot(): Promise<void> {
  const reduced = prefersReducedMotion();
  const webgl = hasWebGL2();

  // Plan B: sin WebGL, imagen estática y contenido completo
  if (!webgl) body.classList.add('still-fallback');
  if (reduced || !webgl) {
    pre.remove();
    body.classList.add('go');
    if (webgl) {
      const engine = new Engine(canvas, { still: true }, hero);
      engine.renderOnce();
    }
    return;
  }

  body.classList.add('pending');
  let engine: Engine;
  try {
    engine = new Engine(canvas, { still: false }, hero);
  } catch {
    body.classList.add('still-fallback', 'go');
    body.classList.remove('pending');
    pre.remove();
    return;
  }
  engine.start();

  // contador de carga (mínimo 1,1 s para que se perciba la entrada)
  await tween(1100, easeOutCubic, (v) => { cnt.textContent = String(Math.round(v * 100)); });
  pre.classList.add('done');
  body.classList.remove('pending');
  body.classList.add('go');
  engine.scene.startIntro();
  await wait(1100);
  pre.remove();
}

boot();
