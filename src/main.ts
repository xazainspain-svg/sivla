import './styles/main.css';
import { Engine } from './engine/engine';
import { hasWebGL2, prefersReducedMotion } from './app/capabilities';
import { easeOutCubic } from './engine/math';
import { tween, wait } from './animation/timeline';
import { AudioEngine } from './audio/AudioEngine';
import { TRACKS } from './audio/tracks';

const body = document.body;
const pre = document.getElementById('pre') as HTMLElement;
const cnt = document.getElementById('cnt') as HTMLElement;
const canvas = document.getElementById('gl') as HTMLCanvasElement;
const hero = document.getElementById('hero') as HTMLElement;

// Las letras del wordmark se rellenan desde el atributo para que el HTML siga siendo legible sin JS.
document.querySelectorAll<HTMLElement>('.wm i').forEach((el) => { el.dataset.c = el.textContent ?? ''; el.textContent = ''; });

const audio = new AudioEngine();

/** Botón "Escuchar", volumen, barras de ecualizador y estado. */
function setupAudioUI(engine: Engine | null, animate: boolean): void {
  const btn = document.getElementById('listen') as HTMLButtonElement;
  const lbl = document.getElementById('listenLbl') as HTMLElement;
  const bar = document.getElementById('audiobar') as HTMLElement;
  const status = document.getElementById('audioStatus') as HTMLElement;
  const vol = document.getElementById('vol') as HTMLInputElement;
  const bars = Array.from(document.querySelectorAll<HTMLElement>('#eq i'));
  vol.addEventListener('input', () => audio.setVolume(Number(vol.value)));
  btn.addEventListener('click', async () => {
    if (audio.playing) {
      audio.stop();
      btn.setAttribute('aria-pressed', 'false');
      lbl.textContent = 'Escuchar';
      bar.hidden = true;
      return;
    }
    try {
      await audio.start();
    } catch {
      status.textContent = 'No se pudo iniciar el audio en este navegador.';
      bar.hidden = false;
      return;
    }
    btn.setAttribute('aria-pressed', 'true');
    lbl.textContent = 'Detener';
    bar.hidden = false;
    status.textContent = audio.mode === 'demo'
      ? (TRACKS.length === 0 ? 'Beat sintético de demostración: aún no hay audio autorizado de SIVLA.' : 'Audio no disponible: se usa un beat sintético de demostración.')
      : audio.trackLabel;
  });
  if (engine) {
    engine.onFrame = (dt, scene) => {
      const f = audio.update(dt);
      scene.setAudio(f.bands, f.kickAge, f.kickAmt, f.active && animate);
      if (f.active && animate) bars.forEach((b, i) => { b.style.transform = `scaleY(${(0.06 + f.bands[i] * 0.94).toFixed(3)})`; });
    };
  }
}

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
    setupAudioUI(null, false);
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
    setupAudioUI(null, false);
    return;
  }
  setupAudioUI(engine, true);
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
