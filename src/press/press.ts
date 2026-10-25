import { clamp, damp, lerp, easeOutExpo, easeInOutCubic } from '../engine/math';
import { beat } from '../app/beat';
import { prefersReducedMotion } from '../app/capabilities';
import './press.css';

/** Recortes con los créditos y colaboraciones reales del perfil de Muso de Siv-La (sin citas ni artículos inventados). */
const P = 1200; // perspectiva (px)
type Kind = 'news' | 'mag' | 'strip' | 'doc' | 'clip' | 'poster';
interface Clip { kind: Kind; x: number; y: number; z: number; rot: number; k: string; h: string; s?: string; rows?: [string, string][]; ring?: number }
const SIZE: Record<Kind, [number, number]> = { news: [520, 680], mag: [420, 560], strip: [560, 200], doc: [460, 600], clip: [340, 260], poster: [640, 800] };

// Los seis primeros llevan el nombre ({n}) y se visitan en este orden; el sexto es el cartel final.
const CLIPS: Clip[] = [
  { kind: 'news', x: -820, y: -120, z: 0, rot: -4, k: 'Productor · 129 créditos', h: 'Producido por {n}', s: 'Historia · Jay Wheeler · 2024', ring: 0 },
  { kind: 'clip', x: 330, y: -560, z: -100, rot: -7, k: 'Catalina · 2025', h: '{n}: producción, ingeniería y mezcla', s: 'Oliwi • Afro Nigga • Teo' },
  { kind: 'doc', x: -420, y: 560, z: -150, rot: 3, k: 'Ficha de crédito', h: 'Productor: {n}', rows: [['Título', 'Dividí'], ['Artistas', 'Oliwi • Afro Nigga'], ['Rol', 'Productor'], ['Año', '2025']] },
  { kind: 'strip', x: 680, y: 260, z: -80, rot: -3, k: 'De locos · 2026', h: '{n} × Mari La Carajita' },
  { kind: 'mag', x: 700, y: -330, z: 0, rot: 5, k: 'Colaboraciones', h: '{n}', s: 'Jay Wheeler · Oliwi · Afro Nigga · Mari La Carajita' },
  { kind: 'poster', x: 0, y: 0, z: 0, rot: 0, k: '145 créditos · 256 colaboradores', h: '{n}', s: 'Productor musical · Valencia, Venezuela' },
  { kind: 'clip', x: -1250, y: 380, z: -250, rot: 6, k: 'Dándote · 2026', h: 'Producción para Sammer y Came Beats', s: 'Productor' },
  { kind: 'news', x: 1250, y: -100, z: -220, rot: 5, k: 'Productor · 2026', h: 'Pida la bendición', s: 'Mari La Carajita • Manira', ring: 1 },
  { kind: 'strip', x: -300, y: -620, z: -150, rot: -4, k: 'Perfil de Muso', h: '256 colaboradores' },
  { kind: 'mag', x: 1150, y: 560, z: -300, rot: -6, k: 'Compositor · 2026', h: 'Primer Amor', s: 'Kobi Cantillo · NOREH · Erick Brian' },
  { kind: 'doc', x: -1300, y: -560, z: -200, rot: -5, k: 'Créditos por rol', h: 'Roles acreditados', rows: [['Producción', '129'], ['Mezcla', '89'], ['Ingeniería', '21'], ['Masterización', '11'], ['Composición', '5']] },
  { kind: 'clip', x: 60, y: 640, z: -60, rot: 2, k: 'Con quién ha trabajado', h: 'Jay Wheeler, Oliwi, Afro Nigga, Teo, Mari La Carajita', s: 'Muso.AI' },
];
const SHOTS = 6;

const nm = '<span class="nm">SIVLA</span>';
const rings = (alt: number): string => {
  const [a, b] = alt ? ['#2F5BEE', '#E08A45'] : ['#E08A45', '#2F5BEE'];
  const c = Array.from({ length: 9 }, (_, i) => `<circle cx="50" cy="50" r="${6 + i * 5}" fill="none" stroke="${i % 2 ? b : a}" stroke-opacity="${(0.9 - i * 0.07).toFixed(2)}" stroke-width="${i % 2 ? 0.6 : 1.1}"/>`).join('');
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${c}</svg>`;
};

function markup(c: Clip): string {
  const h = c.h.replace('{n}', nm);
  const rows = c.rows ? `<dl class="rw">${c.rows.map(([a, v]) => `<div><dt>${a}</dt><dd>${v}</dd></div>`).join('')}</dl>` : '';
  const sub = c.s ? `<p class="sb">${c.s}</p>` : '';
  switch (c.kind) {
    case 'news': return `<header class="mh">${c.k}</header><h3 class="hd">${h}</h3>${sub}<div class="ph">${rings(c.ring ?? 0)}</div>`;
    case 'mag': return `<div class="mg-top">${c.k}</div><div class="mg-name">${h}</div>${sub}`;
    case 'strip': return `<div class="st-k">${c.k}</div><div class="st-h">${h}</div>`;
    case 'doc': return `<div class="dc-t">${c.k}</div><p class="dc-l">${h}</p>${rows}`;
    case 'clip': return `<div class="cl-k">${c.k}</div><p class="cl-h">${h}</p>${sub}`;
    case 'poster': return `<div class="po-k">${c.k}</div><div class="po-n">${h}</div><div class="po-r">${rings(1)}</div>${sub}`;
  }
}

interface Pose { ax: number; ay: number; F: number; roll: number; hl: number; blur: number }
interface Seg { t0: number; t1: number; at: (u: number) => Pose; cut?: boolean }

export function setupPress(): void {
  const section = document.getElementById('press');
  const world = document.getElementById('pressWorld');
  if (!section || !world) return;
  const stage = world.parentElement as HTMLElement;
  const flash = section.querySelector<HTMLElement>('.press-flash')!;
  const hint = section.querySelector<HTMLElement>('.press-hint')!;
  const end = section.querySelector<HTMLElement>('.press-end')!;
  const reduced = prefersReducedMotion();
  section.classList.toggle('still', reduced);

  // ---- construir el mundo
  const papers: HTMLElement[] = [];
  const anchors: { ax: number; ay: number; w: number }[] = [];
  CLIPS.forEach((c) => {
    const [w, h] = SIZE[c.kind];
    const el = document.createElement('div');
    el.className = `pp ${c.kind}`;
    el.style.cssText = `width:${w}px;height:${h}px;left:${-w / 2}px;top:${-h / 2}px;transform:translate3d(${c.x}px,${c.y}px,${c.z}px) rotateZ(${c.rot}deg)`;
    el.innerHTML = markup(c);
    world.appendChild(el);
    papers.push(el);
  });
  const measure = (): void => {
    anchors.length = 0;
    for (let i = 0; i < SHOTS; i++) {
      const el = papers[i];
      const n = el.querySelector<HTMLElement>('.nm')!;
      let ox = 0, oy = 0;
      for (let o: HTMLElement | null = n; o && o !== el; o = o.offsetParent as HTMLElement | null) { ox += o.offsetLeft; oy += o.offsetTop; }
      const [w, h] = SIZE[CLIPS[i].kind];
      const lx = ox + n.offsetWidth / 2 - w / 2, ly = oy + n.offsetHeight / 2 - h / 2;
      const a = (CLIPS[i].rot * Math.PI) / 180;
      anchors.push({ ax: CLIPS[i].x + lx * Math.cos(a) - ly * Math.sin(a), ay: CLIPS[i].y + lx * Math.sin(a) + ly * Math.cos(a), w: n.offsetWidth });
    }
  };

  // ---- línea de tiempo (en segundos de "película")
  let segs: Seg[] = [];
  let total = 1;
  let unit = 1;
  const build = (): void => {
    measure();
    const vw = window.innerWidth, vh = window.innerHeight;
    unit = clamp(Math.min(vw / 1000, vh / 700), 0.3, 1.2);
    const rot = (i: number): number => -CLIPS[i].rot;
    const tilt = [-5, 4, -4, 5, -3];
    const frameF = (i: number): number => (0.42 * vw) / anchors[i].w;
    const hiF = (i: number): number => (0.8 * vw) / anchors[i].w;
    const closeF = (0.92 * vw) / anchors[SHOTS - 1].w;
    const ovA: Pose = { ax: -260 * unit, ay: 70, F: 0.46 * unit, roll: 0, hl: 0, blur: 0 };
    const ovB: Pose = { ax: 260 * unit, ay: -60, F: 0.5 * unit, roll: 0, hl: 0, blur: 0 };
    const ovEnd: Pose = { ax: 0, ay: 0, F: 0.42 * unit, roll: 0, hl: 0, blur: 0 };
    const pose = (i: number, F: number, roll: number, hl: number, blur: number): Pose => ({ ax: anchors[i].ax, ay: anchors[i].ay, F, roll, hl, blur });
    const mix = (a: Pose, b: Pose, u: number, blur = 0): Pose => ({
      ax: lerp(a.ax, b.ax, u), ay: lerp(a.ay, b.ay, u), F: Math.exp(lerp(Math.log(a.F), Math.log(b.F), u)),
      roll: lerp(a.roll, b.roll, u), hl: lerp(a.hl, b.hl, u), blur,
    });
    const out: Seg[] = [];
    let t = 0;
    const add = (d: number, at: (u: number) => Pose, cut = false): void => { out.push({ t0: t, t1: t + d, at, cut }); t += d; };
    add(3, (u) => mix(ovA, ovB, easeInOutCubic(u), 0));
    const f0 = pose(0, frameF(0), rot(0) + tilt[0], 0, 0);
    add(2.6, (u) => { const e = easeInOutCubic(u); return mix(ovB, { ...f0, roll: rot(0), hl: 0 }, e, 4 * Math.sin(Math.PI * u)); });
    add(0.9, () => pose(0, frameF(0), rot(0), 1, 0));
    const dp = [1.0, 0.8, 0.65, 0.5, 0.4], ds = [1.3, 1.0, 0.8, 0.6, 0.5], dh = [0.8, 0.55, 0.4, 0.25, 0.2];
    for (let k = 0; k < SHOTS - 1; k++) {
      const a = k, b = k + 1;
      add(dp[k], (u) => { const e = u * u * u; return { ...pose(a, Math.exp(lerp(Math.log(frameF(a)), Math.log(hiF(a)), e)), rot(a), 1, 0), blur: 12 * e }; }, true);
      add(ds[k], (u) => { const e = easeOutExpo(u); return { ...pose(b, Math.exp(lerp(Math.log(hiF(b)), Math.log(frameF(b)), e)), rot(b) + tilt[k] * (1 - e), clamp(u * 2.4, 0, 1), 0), blur: 12 * (1 - e) * (1 - e) }; });
      if (b < SHOTS - 1) add(dh[k], () => pose(b, frameF(b), rot(b), 1, 0));
    }
    const last = SHOTS - 1;
    add(0.8, (u) => { const e = u * u; return { ...pose(last, Math.exp(lerp(Math.log(frameF(last)), Math.log(closeF), e)), rot(last), 1, 0), blur: 8 * e }; });
    add(1.5, (u) => ({ ...pose(last, closeF * (1 + 0.012 * u), rot(last), 1, 0) })); // pausa visual
    add(4.2, (u) => { const e = easeInOutCubic(u); return mix(pose(last, closeF * 1.012, rot(last), 1, 0), ovEnd, e, 5 * Math.sin(Math.PI * u)); });
    add(0.6, () => ovEnd);
    segs = out;
    total = t;
  };

  const poseAt = (tau: number): { p: Pose; cutNear: number } => {
    let s = segs[segs.length - 1];
    for (const g of segs) if (tau < g.t1) { s = g; break; }
    const u = clamp((tau - s.t0) / (s.t1 - s.t0), 0, 1);
    let cutNear = 0;
    for (const g of segs) if (g.cut) cutNear = Math.max(cutNear, clamp(1 - Math.abs(tau - g.t1) / 0.14, 0, 1));
    return { p: s.at(u), cutNear };
  };

  // ---- bucle
  let visible = false;
  let tauT = 0, tau = 0;
  let px = 0, py = 0, tpx = 0, tpy = 0;
  let lastHl = -1;
  let raf = 0;
  let last = performance.now();
  const apply = (dt: number): void => {
    const pr = section.getBoundingClientRect();
    const span = Math.max(1, pr.height - window.innerHeight);
    tauT = reduced ? 0 : clamp(-pr.top / span, 0, 1) * total;
    tau = reduced ? 0 : damp(tau, tauT, 6, dt);
    px = damp(px, tpx, 3, dt); py = damp(py, tpy, 3, dt);
    const { p, cutNear } = reduced ? { p: segs[segs.length - 1].at(1), cutNear: 0 } : poseAt(tau);
    const zc = P * (1 - 1 / p.F);
    world.style.transform = `translateZ(${zc.toFixed(1)}px) rotateZ(${p.roll.toFixed(3)}deg) rotateX(${(py * 3).toFixed(2)}deg) rotateY(${(px * 3).toFixed(2)}deg) translate3d(${(-p.ax).toFixed(1)}px,${(-p.ay).toFixed(1)}px,0)`;
    const b = p.blur + (beat.active ? beat.amt * 1.2 : 0);
    stage.style.filter = b > 0.3 ? `blur(${b.toFixed(2)}px) saturate(${(1 + 0.2 * cutNear).toFixed(2)})` : '';
    stage.style.transform = beat.active ? `scale(${(1 + beat.amt * 0.012).toFixed(4)})` : '';
    flash.style.opacity = (cutNear * 0.35).toFixed(2);
    // resaltado editorial en el recorte que se está mirando
    const shot = reduced ? 0 : activeShot(tau);
    const hl = Math.round(p.hl * 20) / 20;
    const key = shot * 100 + hl * 20;
    if (key !== lastHl) {
      lastHl = key;
      papers.forEach((el, i) => el.style.setProperty('--hl', i === shot ? String(hl) : '0'));
    }
    hint.style.opacity = tau > 0.6 || reduced ? '0' : '1';
    const e = reduced ? 1 : clamp((tau - (total - 2.4)) / 1.2, 0, 1);
    end.style.opacity = e.toFixed(2);
    end.style.pointerEvents = e > 0.6 ? 'auto' : 'none';
    end.toggleAttribute('inert', e <= 0.6);
  };
  // qué recorte lleva el resaltado según el segmento
  const shotStarts: number[] = [];
  const activeShot = (tt: number): number => {
    let s = 0;
    shotStarts.forEach((st, i) => { if (tt >= st) s = i; });
    return s;
  };
  const loop = (now: number): void => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    apply(dt);
  };

  const init = (): void => {
    build();
    // inicio de cada recorte = fin del segmento "punch" anterior (corte); el primero empieza al terminar el vuelo
    shotStarts.length = 0;
    shotStarts.push(0);
    segs.forEach((g) => { if (g.cut) shotStarts.push(g.t1); });
    section.style.height = reduced ? '100vh' : `${Math.round(total * 30 + 100)}vh`;
    apply(1);
  };
  const ready = (document.fonts?.ready ?? Promise.resolve()).catch(() => undefined);
  void ready.then(() => { init(); });
  init();
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = window.setTimeout(init, 150); });
  stage.parentElement?.addEventListener('pointermove', (e) => { tpx = (e.clientX / window.innerWidth - 0.5) * 2; tpy = -(e.clientY / window.innerHeight - 0.5) * 2; });
  section.querySelector('#pressListen')?.addEventListener('click', () => (document.querySelector('.listen-btn') as HTMLButtonElement | null)?.click());
  new IntersectionObserver((es) => es.forEach((e) => {
    visible = e.isIntersecting;
    cancelAnimationFrame(raf);
    if (visible && !reduced) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }), { rootMargin: '0px', threshold: [0, 0.01] }).observe(section);
}
