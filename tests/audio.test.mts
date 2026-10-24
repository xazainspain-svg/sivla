import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bandsFromFFT, BandSmoother, KickDetector, BAND_COUNT } from '../src/audio/bands.ts';

const SR = 48000, FFT = 1024, BINS = FFT / 2;
/** Espectro sintético con energía solo en la frecuencia dada. */
function tone(hz: number, amp = 220): Uint8Array {
  const d = new Uint8Array(BINS);
  const bin = Math.round(hz / (SR / FFT));
  d[bin] = amp; d[bin - 1] = amp * 0.5; d[bin + 1] = amp * 0.5;
  return d;
}
const argmax = (a: ArrayLike<number>) => { let m = 0; for (let i = 1; i < a.length; i++) if (a[i] > a[m]) m = i; return m; };

test('bandas: un tono grave cae en las primeras bandas y uno agudo en las últimas', () => {
  assert.ok(argmax(bandsFromFFT(tone(80), SR, FFT)) <= 1);
  assert.equal(argmax(bandsFromFFT(tone(440), SR, FFT)), 3);
  assert.ok(argmax(bandsFromFFT(tone(8000), SR, FFT)) >= 6);
  assert.equal(bandsFromFFT(tone(1000), SR, FFT).length, BAND_COUNT);
});

test('bandas: el silencio da ceros y la saturación no pasa de 1', () => {
  assert.ok(bandsFromFFT(new Uint8Array(BINS), SR, FFT).every((v) => v === 0));
  const full = new Uint8Array(BINS).fill(255);
  assert.ok(bandsFromFFT(full, SR, FFT).every((v) => v <= 1 && v > 0.9));
});

test('suavizado: ataque rápido y caída lenta', () => {
  const s = new BandSmoother(30, 6);
  const on = new Float32Array(BAND_COUNT).fill(1), off = new Float32Array(BAND_COUNT);
  for (let i = 0; i < 6; i++) s.update(on, 1 / 60);
  const up = s.value[0];
  assert.ok(up > 0.8, `ataque lento: ${up}`);
  for (let i = 0; i < 6; i++) s.update(off, 1 / 60);
  assert.ok(s.value[0] > 0.3, 'la caída debe ser más lenta que el ataque');
});

test('bombo: detecta golpes, respeta el tiempo refractario y no dispara con nivel constante', () => {
  const k = new KickDetector(0.12, 0.3), dt = 1 / 60;
  const quiet = new Float32Array(BAND_COUNT), hit = new Float32Array(BAND_COUNT);
  hit[0] = hit[1] = 0.9;
  let t = 0, hits = 0;
  for (let i = 0; i < 30; i++) { t += dt; if (k.detect(quiet, t, dt)) hits++; }
  assert.equal(hits, 0, 'el silencio no debe disparar');
  t += dt; assert.equal(k.detect(hit, t, dt), true);
  t += dt; assert.equal(k.detect(quiet, t, dt), false);
  t += dt; assert.equal(k.detect(hit, t, dt), false, 'dentro del tiempo refractario');
  for (let i = 0; i < 20; i++) { t += dt; k.detect(quiet, t, dt); }
  t += dt; assert.equal(k.detect(hit, t, dt), true, 'pasado el tiempo refractario vuelve a detectar');
  // nivel alto y constante: tras el golpe inicial no hay subidas, no dispara
  const k2 = new KickDetector(0.12, 0.3); let n = 0;
  for (let i = 0; i < 120; i++) { t += dt; if (k2.detect(hit, t, dt)) n++; }
  assert.ok(n <= 1, `nivel constante disparó ${n} veces`);
});
