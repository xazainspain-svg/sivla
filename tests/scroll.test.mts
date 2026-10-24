import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stickyProgress, windowOpacity, journeyProgress } from '../src/app/scroll.ts';

test('progreso de sección sticky', () => {
  assert.equal(stickyProgress(100, 3000, 1000), 0);
  assert.equal(stickyProgress(0, 3000, 1000), 0);
  assert.equal(stickyProgress(-1000, 3000, 1000), 0.5);
  assert.equal(stickyProgress(-2000, 3000, 1000), 1);
  assert.equal(stickyProgress(-5000, 3000, 1000), 1);
  assert.equal(stickyProgress(0, 800, 1000), 0);
});

test('ventana de opacidad con fundidos', () => {
  assert.equal(windowOpacity(0.0, 0.2, 0.5, 0.1), 0);
  assert.equal(windowOpacity(0.35, 0.2, 0.5, 0.1), 1);
  assert.ok(Math.abs(windowOpacity(0.25, 0.2, 0.5, 0.1) - 0.5) < 1e-9);
  assert.equal(windowOpacity(0.6, 0.2, 0.5, 0.1), 0);
});

test('progreso del recorrido hero → sound', () => {
  assert.equal(journeyProgress(0, 900, 2880, 900), 0);
  assert.equal(journeyProgress(2880, 900, 2880, 900), 1);
  assert.ok(journeyProgress(1440, 900, 2880, 900) > 0.4 && journeyProgress(1440, 900, 2880, 900) < 0.6);
});
