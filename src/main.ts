import './styles/main.css';
import { Engine } from './engine/engine';
import { hasWebGL2, prefersReducedMotion } from './app/capabilities';
import { easeOutCubic, damp } from './engine/math';
import { tween, wait } from './animation/timeline';
import { AudioEngine } from './audio/AudioEngine';
import { TRACKS } from './audio/tracks';
import { journeyProgress, stickyProgress, windowOpacity } from './app/scroll';
import { WORKS, placeholderCover } from './app/works';

const body = document.body;
const pre = document.getElementById('pre') as HTMLElement;
const cnt = document.getElementById('cnt') as HTMLElement;
const canvas = document.getElementById('gl') as HTMLCanvasElement;
const hero = document.getElementById('hero') as HTMLElement;
const sound = document.getElementById('sound') as HTMLElement;
const audio = new AudioEngine();

// Las letras del wordmark se rellenan desde el atributo para que el HTML siga siendo legible sin JS.
document.querySelectorAll<HTMLElement>('.wm i').forEach((el) => { el.dataset.c = el.textContent ?? ''; el.textContent = ''; });

/** Botones "Escuchar" (hero y Sound), volumen, barras de ecualizador y estado. */
function setupAudioUI(engine: Engine | null, animate: boolean): void {
  const btns = Array.from(document.querySelectorAll<HTMLButtonElement>('.listen-btn'));
  const bar = document.getElementById('audiobar') as HTMLElement;
  const status = document.getElementById('audioStatus') as HTMLElement;
  const note = document.getElementById('soundNote') as HTMLElement;
  const vol = document.getElementById('vol') as HTMLInputElement;
  const bars = Array.from(document.querySelectorAll<HTMLElement>('#eq i'));
  const paint = (on: boolean) => btns.forEach((b) => {
    b.setAttribute('aria-pressed', String(on));
    const l = b.querySelector('.listen-lbl'); if (l) l.textContent = on ? 'Detener' : 'Escuchar';
  });
  vol.addEventListener('input', () => audio.setVolume(Number(vol.value)));
  const toggle = async () => {
    if (audio.playing) {
      audio.stop(); paint(false); bar.hidden = true;
      note.textContent = 'Las barras se mueven con un pulso de reposo. Pulsa "Escuchar" para que sigan el audio.';
      return;
    }
    try { await audio.start(); } catch {
      status.textContent = 'No se pudo iniciar el audio en este navegador.'; bar.hidden = false; return;
    }
    paint(true); bar.hidden = false;
    const demo = audio.mode === 'demo';
    status.textContent = demo
      ? (TRACKS.length === 0 ? 'Beat sintético de demostración: aún no hay audio autorizado de SIVLA.' : 'Audio no disponible: se usa un beat sintético de demostración.')
      : audio.trackLabel;
    note.textContent = demo ? 'Las barras siguen un beat sintético de demostración.' : `Las barras siguen: ${audio.trackLabel}.`;
  };
  btns.forEach((b) => b.addEventListener('click', toggle));
  if (engine) {
    engine.onFrame = (dt, scene) => {
      const f = audio.update(dt);
      scene.setAudio(f.bands, f.kickAge, f.kickAmt, f.active && animate);
      if (f.active && animate) bars.forEach((b, i) => { b.style.transform = `scaleY(${(0.06 + f.bands[i] * 0.94).toFixed(3)})`; });
    };
  }
}

/** Recorrido hero → sound: progreso de escena y frases por scroll. */
function setupJourney(engine: Engine | null): void {
  const phrases = Array.from(document.querySelectorAll<HTMLElement>('.phrase'));
  let smooth = 0;
  const frame = () => {
    const vh = window.innerHeight;
    const p = journeyProgress(window.scrollY, hero.offsetHeight, sound.offsetHeight, vh);
    smooth = damp(smooth, p, 8, 0.016);
    engine?.scene.setProgress(smooth);
    const sp = stickyProgress(sound.getBoundingClientRect().top, sound.offsetHeight, vh);
    for (const el of phrases) {
      const o = windowOpacity(sp, Number(el.dataset.from), Number(el.dataset.to), 0.06);
      el.style.opacity = o.toFixed(3);
      el.style.transform = `translateY(${((1 - o) * 24).toFixed(1)}px)`;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/** Lista de producciones: portadas provisionales, vista previa que sigue al cursor y aparición progresiva. */
function setupWorks(): void {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.work'));
  const peek = document.getElementById('peek') as HTMLElement;
  let tx = -999, ty = -999, px = -999, py = -999;
  links.forEach((a) => {
    const w = WORKS[Number(a.dataset.i)];
    const svg = placeholderCover(w, Number(a.dataset.i));
    (a.querySelector('.wth') as HTMLElement).innerHTML = svg;
    a.addEventListener('pointerenter', () => { peek.innerHTML = svg; peek.classList.add('on'); });
    a.addEventListener('pointerleave', () => peek.classList.remove('on'));
    a.parentElement?.classList.add('reveal-row');
  });
  window.addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; });
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.2 });
  links.forEach((a) => a.parentElement && io.observe(a.parentElement));
  const loop = () => {
    if (peek.classList.contains('on')) {
      px += (tx - px) * 0.18; py += (ty - py) * 0.18;
      const w = peek.offsetWidth;
      peek.style.transform = `translate(${Math.min(Math.max(px + 28, 8), innerWidth - w - 8)}px,${Math.min(Math.max(py - w / 2, 8), innerHeight - w - 8)}px) scale(1) rotate(${((tx - px) * 0.05).toFixed(2)}deg)`;
    } else { px = tx; py = ty; }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

async function boot(): Promise<void> {
  const reduced = prefersReducedMotion();
  const webgl = hasWebGL2();
  setupWorks();

  // Plan B: sin WebGL, imagen estática y contenido completo
  if (!webgl) body.classList.add('still-fallback');
  if (reduced || !webgl) {
    pre.remove();
    body.classList.add('go', 'static');
    if (webgl) {
      const engine = new Engine(canvas, { still: true }, [hero]);
      engine.renderOnce();
    }
    setupAudioUI(null, false);
    return;
  }

  body.classList.add('pending');
  let engine: Engine;
  try {
    engine = new Engine(canvas, { still: false }, [hero, sound]);
  } catch {
    body.classList.add('still-fallback', 'go', 'static');
    body.classList.remove('pending');
    pre.remove();
    setupAudioUI(null, false);
    return;
  }
  setupAudioUI(engine, true);
  setupJourney(engine);
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
