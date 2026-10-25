import './styles/main.css';
import { Engine } from './engine/engine';
import { hasWebGL2, prefersReducedMotion } from './app/capabilities';
import { easeOutCubic, damp } from './engine/math';
import { tween, wait } from './animation/timeline';
import { AudioEngine } from './audio/AudioEngine';
import { TRACKS } from './audio/tracks';
import { journeyProgress, stickyProgress, windowOpacity } from './app/scroll';
import { WORKS, placeholderCover } from './app/works';
import { MosaicScene } from './scenes/MosaicScene';
import { setupPress } from './press/press';
import { beat } from './app/beat';
import { setupSonic } from './sonic/ui';

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
  // un único muestreo por fotograma, compartido por el disco del hero y el estudio 3D
  let lastT = -1;
  let cached: ReturnType<AudioEngine['update']> | null = null;
  const sample = (dt: number): NonNullable<typeof cached> => {
    const now = performance.now();
    if (!cached || now - lastT > 4) {
      cached = audio.update(dt); lastT = now;
      beat.active = cached.active; beat.amt = cached.kickAmt * Math.exp(-cached.kickAge * 6); beat.bands.set(cached.bands);
      if (cached.active) { const sp = audio.spectrum; beat.spec.set(sp.data.subarray(0, 512)); beat.rate = sp.sampleRate; }
      beat.label = cached.active ? audio.trackLabel : '';
    }
    return cached;
  };
  beat.sample = (dt) => { sample(dt); };
  beat.setFocus = (f, a, q) => audio.setFocus(f, a, q);
  if (engine) {
    engine.onFrame = (dt, scene) => {
      const f = sample(dt);
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

/** Works: escenario con la portada activa (funda + vinilo que asoma y gira) que cambia al pasar, enfocar o hacer scroll por la lista. */
function setupWorks(): void {
  const section = document.getElementById('works') as HTMLElement;
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.work'));
  const tilt = document.getElementById('wkTilt') as HTMLElement;
  const stage = document.getElementById('wkStage') as HTMLElement;
  const cap = document.getElementById('wkCap') as HTMLElement;
  const art = (i: number): string => {
    const w = WORKS[i];
    const svg = placeholderCover(w, i);
    // portada oficial (Spotify) si existe; si no carga, se queda la provisional
    return w.cover ? `<img src="${w.cover}" alt="" width="640" height="640" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML=this.dataset.fb" data-fb="${svg.replace(/"/g, '&quot;')}">` : svg;
  };
  const items = WORKS.map((_, i) => {
    const el = document.createElement('div');
    el.className = 'wk-item';
    el.innerHTML = `<div class="wk-vslide"><div class="wk-vinyl"><i></i></div></div><div class="wk-sleeve">${art(i)}<span class="wk-sheen"></span></div>`;
    tilt.appendChild(el);
    return el;
  });
  let active = -1;
  let lockUntil = 0;
  const pad = (n: number): string => String(n).padStart(2, '0');
  const setActive = (i: number): void => {
    if (i === active || i < 0) return;
    active = i;
    items.forEach((el, k) => el.classList.toggle('on', k === i));
    links.forEach((a, k) => a.parentElement?.classList.toggle('act', k === i));
    const w = WORKS[i];
    cap.textContent = `${pad(i + 1)} / ${pad(WORKS.length)} · ${w.title} · ${w.year}`;
  };
  links.forEach((a, k) => {
    const i = Number(a.dataset.i);
    (a.querySelector('.wth') as HTMLElement).innerHTML = art(i);
    const n = document.createElement('span');
    n.className = 'wn'; n.setAttribute('aria-hidden', 'true'); n.textContent = pad(k + 1);
    a.prepend(n);
    const hit = (): void => { lockUntil = performance.now() + 700; setActive(i); };
    a.addEventListener('pointerenter', hit);
    a.addEventListener('focus', hit);
    a.parentElement?.classList.add('reveal-row');
  });
  section.classList.add('js-wk');
  setActive(0);
  // la fila que cruza el centro de la pantalla pasa a ser la activa
  const mid = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting || performance.now() < lockUntil) return;
    const idx = links.findIndex((a) => a.parentElement === e.target);
    if (idx >= 0) setActive(Number(links[idx].dataset.i));
  }), { rootMargin: '-45% 0px -45% 0px' });
  links.forEach((a) => a.parentElement && mid.observe(a.parentElement));
  // inclinación 3D del escenario con el cursor
  stage.parentElement?.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect();
    const x = clamp01((e.clientX - r.left) / r.width), y = clamp01((e.clientY - r.top) / r.height);
    tilt.style.setProperty('--ry', `${((x - 0.5) * 16).toFixed(2)}deg`);
    tilt.style.setProperty('--rx', `${((0.5 - y) * 12).toFixed(2)}deg`);
    tilt.style.setProperty('--mx', `${(x * 100).toFixed(0)}%`);
  });
  stage.parentElement?.addEventListener('pointerleave', () => { tilt.style.setProperty('--ry', '0deg'); tilt.style.setProperty('--rx', '0deg'); });
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.2 });
  links.forEach((a) => a.parentElement && io.observe(a.parentElement));
}
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Menú móvil e indicador de sección activa. */
function setupNav(): void {
  const btn = document.getElementById('menuBtn') as HTMLButtonElement;
  const sheet = document.getElementById('sheet') as HTMLElement;
  const setOpen = (open: boolean) => {
    sheet.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? 'Cerrar' : 'Menú';
    body.classList.toggle('menu-open', open);
    if (open) (sheet.querySelector('a') as HTMLElement | null)?.focus(); else btn.focus({ preventScroll: true });
  };
  btn.addEventListener('click', () => setOpen(Boolean(sheet.hidden)));
  sheet.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) setOpen(false); });
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('nav a[href^="#"]'));
  const ids = ['sound', 'works', 'sonic', 'services', 'about', 'contact'];
  const secs = ids.map((id) => document.getElementById(id)).filter((x): x is HTMLElement => !!x);
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((l) => l.setAttribute('aria-current', String(l.getAttribute('href') === `#${e.target.id}`)));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  secs.forEach((el) => io.observe(el));
  // la cabecera se invierte sobre la sección oscura de Contact
  const contact = document.getElementById('contact');
  if (contact) {
    const nio = new IntersectionObserver((es) => es.forEach((e) => body.classList.toggle('on-night', e.isIntersecting)), { rootMargin: '0px 0px -92% 0px' });
    nio.observe(contact);
  }
}

/** About: revelado circular de la foto y cifras que cuentan al entrar. */
function setupAbout(): void {
  const portrait = document.getElementById('portrait') as HTMLElement;
  const nums = Array.from(document.querySelectorAll<HTMLElement>('.facts b'));
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    if (e.target === portrait) { portrait.classList.add('in'); return; }
    const el = e.target as HTMLElement;
    const to = Number(el.dataset.to);
    if (prefersReducedMotion()) return;
    void tween(1400, easeOutCubic, (v) => { el.textContent = String(Math.round(v * to)); });
  }), { threshold: 0.35 });
  io.observe(portrait);
  nums.forEach((n) => { if (!prefersReducedMotion()) n.textContent = '0'; io.observe(n); });
}

/** Mosaico 3D de la foto: se crea al acercarse y solo corre mientras es visible. */
function setupMosaic(): void {
  const canvas = document.getElementById('mosaicGl') as HTMLCanvasElement | null;
  const img = document.querySelector<HTMLImageElement>('#portrait img');
  if (!canvas || !img) return;
  let scene: MosaicScene | null = null;
  const stage = canvas.parentElement as HTMLElement;
  const make = async (): Promise<void> => {
    try { await img.decode(); } catch { /* la imagen ya está cargada o falló */ }
    if (!img.naturalWidth) return;
    scene = new MosaicScene(canvas, img);
    stage.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      scene?.setPointer(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    });
    stage.addEventListener('pointerleave', () => scene?.setPointer(null, null));
    window.addEventListener('resize', () => scene?.resize());
    if (visible) scene.start();
  };
  let visible = false;
  let building = false;
  new IntersectionObserver((es) => es.forEach((e) => {
    visible = e.isIntersecting;
    if (visible && !scene && !building) { building = true; void make(); }
    else if (scene) { if (visible) scene.start(); else scene.stop(); }
  }), { rootMargin: '200px 0px' }).observe(canvas);
}

/** Contact: tarifas que preseleccionan el servicio y formulario honesto (no hay destino real todavía). */
function setupContact(): void {
  const form = document.getElementById('form') as HTMLFormElement;
  const svc = document.getElementById('f-svc') as HTMLSelectElement;
  const status = document.getElementById('formStatus') as HTMLElement;
  document.querySelectorAll<HTMLButtonElement>('[data-service]').forEach((b) => b.addEventListener('click', () => {
    svc.value = b.dataset.service ?? 'Otro';
    (document.getElementById('f-name') as HTMLElement).focus();
    status.textContent = `Servicio elegido: ${svc.value}.`;
  }));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = (document.getElementById('f-name') as HTMLInputElement).value.trim();
    const mail = (document.getElementById('f-mail') as HTMLInputElement).value.trim();
    const msg = (document.getElementById('f-msg') as HTMLTextAreaElement).value.trim();
    if (!name || !/^\S+@\S+\.\S+$/.test(mail) || !msg) { status.textContent = 'Completa nombre, un email válido y tu mensaje.'; return; }
    const text = `Hola SIVLA, soy ${name} (${mail}). Me interesa: ${svc.value}.\n${msg}`;
    let copied = false;
    try { await navigator.clipboard.writeText(text); copied = true; } catch { copied = false; }
    status.innerHTML = (copied ? 'Mensaje copiado. ' : 'Copia tu mensaje desde el cuadro de arriba. ')
      + 'Esta web todavía no envía correos: pégalo en un mensaje directo de <a href="https://www.instagram.com/eselsivla" target="_blank" rel="noopener">Instagram @eselsivla</a>.';
  });
}


async function boot(): Promise<void> {
  const reduced = prefersReducedMotion();
  const webgl = hasWebGL2();
  setupWorks();
  setupNav();
  setupAbout();
  setupMosaic();
  setupPress();
  setupSonic();
  setupContact();

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
  // el logo se construye en ~2,7 s; un clic lo acelera
  let skip = false;
  pre.addEventListener('click', () => { skip = true; pre.classList.add('fast'); }, { once: true });
  const t0 = performance.now();
  while (!skip && performance.now() - t0 < 2700) {
    cnt.textContent = String(Math.min(100, Math.round(((performance.now() - t0) / 2700) * 100)));
    await wait(40);
  }
  cnt.textContent = '100';
  if (skip) await wait(120);
  pre.classList.add('done');
  body.classList.remove('pending');
  body.classList.add('go');
  engine.scene.startIntro();
  await wait(1100);
  pre.remove();
}

boot();
