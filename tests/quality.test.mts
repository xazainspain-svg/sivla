import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QualityController, PROFILES } from '../src/engine/quality.ts';
import { clamp, damp, lerp, smoothstep, easeOutExpo, easeOutCubic, easeInOutCubic } from '../src/engine/math.ts';

test('math básico', () => {
  assert.equal(clamp(5, 0, 1), 1);
  assert.equal(lerp(0, 10, 0.5), 5);
  assert.equal(smoothstep(0, 1, 0), 0);
  assert.equal(smoothstep(0, 1, 1), 1);
  const once = damp(0, 1, 5, 1 / 30);
  const twice = damp(damp(0, 1, 5, 1 / 60), 1, 5, 1 / 60);
  assert.ok(Math.abs(once - twice) < 1e-9, 'damp debe ser independiente de la tasa de fotogramas');
});

test('curvas de easing: extremos y monotonía', () => {
  for (const f of [easeOutExpo, easeOutCubic, easeInOutCubic]) {
    assert.ok(Math.abs(f(0)) < 1e-3);
    assert.equal(f(1), 1);
    let prev = -1;
    for (let i = 0; i <= 20; i++) { const v = f(i / 20); assert.ok(v >= prev - 1e-12); prev = v; }
  }
});

test('calidad: baja con fotogramas lentos y sube tras una racha larga de rápidos', () => {
  const q = new QualityController(2, true);
  let changed: number | null = null;
  for (let i = 0; i < 80 && changed === null; i++) changed = q.push(40);
  assert.equal(changed, 1);
  const q2 = new QualityController(0, true);
  for (let i = 0; i < 70; i++) assert.equal(q2.push(8), null);
  let up: number | null = null;
  for (let i = 0; i < 40 && up === null; i++) up = q2.push(8);
  assert.equal(up, 1);
});

test('calidad: en manual no cambia nunca', () => {
  const q = new QualityController(2, true);
  q.setManual(1);
  for (let i = 0; i < 300; i++) assert.equal(q.push(100), null);
});

test('perfiles: más calidad implica más segmentos y más resolución', () => {
  assert.ok(PROFILES[0].phiSegments < PROFILES[1].phiSegments && PROFILES[1].phiSegments < PROFILES[2].phiSegments);
  assert.ok(PROFILES[0].maxPixelRatio <= PROFILES[1].maxPixelRatio && PROFILES[1].maxPixelRatio <= PROFILES[2].maxPixelRatio);
});
