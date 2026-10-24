import { clamp, damp, lerp, easeOutExpo, easeInOutCubic } from '../engine/math';
import { beat } from '../app/beat';
import { prefersReducedMotion } from '../app/capabilities';
import './press.css';

/** Recortes de prensa 100 % ficticios: relleno en latín y marca "demostración". Nada se atribuye a SIVLA. */
const P = 1200; // perspectiva (px)
type Kind = 'news' | 'mag' | 'strip' | 'doc' | 'clip' | 'poster';
interface Clip { kind: Kind; x: number; y: number; z: number; rot: number; name?: boolean; v?: number }
const SIZE: Record<Kind, [number, number]> = { news: [520, 680], mag: [420, 560], strip: [560, 200], doc: [460, 600], clip: [340, 260], poster: [640, 800] };

// Los seis primeros llevan el nombre y se visitan en este orden; el último es el cartel final.
const CLIPS: Clip[] = [
  { kind: 'news', x: -820, y: -120, z: 0, rot: -4, name: true },
  { kind: 'clip', x: 330, y: -560, z: -100, rot: -7, name: true },
  { kind: 'doc', x: -420, y: 560, z: -150, rot: 3, name: true },
  { kind: 'strip', x: 680, y: 260, z: -80, rot: -3, name: true },
  { kind: 'mag', x: 700, y: -330, z: 0, rot: 5, name: true },
  { kind: 'poster', x: 0, y: 0, z: 0, rot: 0, name: true },
  { kind: 'clip', x: -1250, y: 380, z: -250, rot: 6, v: 1 },
  { kind: 'news', x: 1250, y: -100, z: -220, rot: 5, v: 1 },
  { kind: 'strip', x: -300, y: -620, z: -150, rot: -4, v: 1 },
  { kind: 'mag', x: 1150, y: 560, z: -300, rot: -6, v: 1 },
  { kind: 'doc', x: -1300, y: -560, z: -200, rot: -5, v: 1 },
  { kind: 'clip', x: 60, y: 640, z: -60, rot: 2, v: 1 },
];
const SHOTS = 6;

const HEADS = ['CONSECTETUR ADIPISCING ELIT', 'SED DO EIUSMOD TEMPOR', 'UT ENIM AD MINIM VENIAM', 'DUIS AUTE IRURE DOLOR', 'EXCEPTEUR SINT OCCAECAT'];
const MASTS = ['GACETA DEMO', 'EL DIARIO FICTICIO', 'DAILY PLACEHOLDER', 'REVISTA MUESTRA', 'BOLETÍN DE PRUEBA'];

function rng(seed: number): () => number { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
const lines = (n: number, r: () => number): string => Array.from({ length: n }, () => `<i class="ln" style="width:${(62 + r() * 38).toFixed(0)}%"></i>`).join('');
const nm = '<span class="nm">SIVLA</span>';

function markup(c: Clip, idx: number): string {
  const r = rng(idx * 97 + 13);
  const mast = MASTS[idx % MASTS.length];
  const head = HEADS[idx % HEADS.length];
  const tag = '<em class="demo">Demostración · ficticio</em>';
  switch (c.kind) {
    case 'news': return `<header class="mh">${mast}</header>${tag}<h3 class="hd">${c.name ? `LOREM IPSUM ${nm} DOLOR SIT AMET` : head}</h3><div class="ph"></div><div class="cols">${lines(14, r)}</div>`;
    case 'mag': return `<div class="mg-top">${mast}</div><div class="mg-name">${c.name ? nm : 'LOREM'}</div><div class="mg-sub">${c.name ? 'Portada de demostración' : head}</div>${tag}`;
    case 'strip': return `<div class="st-k">${mast}</div><div class="st-h">${c.name ? `${nm} IPSUM` : head}</div>${tag}`;
    case 'doc': return `<div class="dc-t">EXPEDIENTE DE MUESTRA Nº ${100 + idx}</div>${lines(3, r)}<p class="dc-l">LOREM IPSUM ${c.name ? nm : 'DOLOR'} SIT AMET</p>${lines(6, r)}<i class="rd" style="width:70%"></i>${lines(5, r)}${tag}`;
    case 'clip': return `<div class="cl-k">${mast}</div><p class="cl-h">${c.name ? `Lorem ${nm} ipsum` : head}</p>${lines(4, r)}${tag}`;
    case 'poster': return `<div class="po-k">${mast}</div><div class="po-n">${nm}</div><div class="po-s">Cartel de demostración · material ficticio</div>`;
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
  CLIPS.forEach((c, i) => {
    const [w, h] = SIZE[c.kind];
    const el = document.createElement('div');
    el.className = `pp ${c.kind}`;
    el.style.cssText = `width:${w}px;height:${h}px;left:${-w / 2}px;top:${-h / 2}px;transform:translate3d(${c.x}px,${c.y}px,${c.z}px) rotateZ(${c.rot}deg)`;
    el.innerHTML = markup(c, i);
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
    const { p, cutNear } = reduced ? { p: segs[1].at(1), cutNear: 0 } : poseAt(tau);
    const zc = P * (1 - 1 / p.F);
    world.style.transform = `translateZ(${zc.toFixed(1)}px) rotateZ(${p.roll.toFixed(3)}deg) rotateX(${(py * 3).toFixed(2)}deg) rotateY(${(px * 3).toFixed(2)}deg) translate3d(${(-p.ax).toFixed(1)}px,${(-p.ay).toFixed(1)}px,0)`;
    const b = p.blur + (beat.active ? beat.amt * 1.2 : 0);
    stage.style.filter = b > 0.3 ? `blur(${b.toFixed(2)}px) brightness(${(1 + 0.15 * cutNear).toFixed(2)})` : '';
    stage.style.transform = beat.active ? `scale(${(1 + beat.amt * 0.012).toFixed(4)})` : '';
    flash.style.opacity = (cutNear * 0.55).toFixed(2);
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
    document.body.classList.toggle('on-night-press', visible && e.boundingClientRect.top < 60);
    cancelAnimationFrame(raf);
    if (visible && !reduced) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }), { rootMargin: '0px', threshold: [0, 0.01] }).observe(section);
}
