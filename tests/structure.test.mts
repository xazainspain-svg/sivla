import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('estructura del proyecto y documentación de la Fase 1', () => {
  for (const f of ['index.html', 'src/main.ts', 'src/scenes/DiscScene.ts', 'src/shaders/disc.ts', 'docs/SIVLA_CREATIVE_DIRECTION.md', 'docs/SIVLA_LANDING_ARCHITECTURE.md', 'docs/SIVLA_REFERENCE_AUDIT.md', 'docs/SIVLA_IMPLEMENTATION_ROADMAP.md']) {
    assert.ok(existsSync(f), `falta ${f}`);
  }
});

test('los uniforms del shader del disco coinciden con la escena', () => {
  const sh = readFileSync('src/shaders/disc.ts', 'utf8');
  const sc = readFileSync('src/scenes/DiscScene.ts', 'utf8');
  for (const u of ['uTime', 'uIntro', 'uPointer', 'uForce', 'uPulse', 'uInner', 'uOuter']) {
    assert.ok(sh.includes(`uniform`) && sh.includes(u), `shader no declara ${u}`);
    assert.ok(sc.includes(u), `escena no usa ${u}`);
  }
});

test('el pulso de reposo está documentado como procedural, no como audio', () => {
  assert.match(readFileSync('src/shaders/disc.ts', 'utf8'), /NO es una señal de audio/);
});

test('HTML: wordmark accesible, saltar al contenido y plan B', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.ok(html.includes('aria-label="SIVLA"'));
  assert.ok(html.includes('class="skip"'));
  assert.ok(html.includes('id="fallback"'));
  assert.ok(html.includes('<canvas id="gl" aria-hidden="true">'));
});

test('Fase 4: secciones Sound y Works con créditos reales y portadas provisionales', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.ok(html.includes('id="sound"') && html.includes('id="works"'));
  const links = html.match(/https:\/\/muso\.ai\/track\//g) ?? [];
  assert.equal(links.length, 7, 'deben ser 7 créditos con enlace a Muso');
  const works = readFileSync('src/app/works.ts', 'utf8');
  assert.ok(works.includes('PORTADA PENDIENTE'), 'las portadas provisionales deben declararse como tales');
});

test('Fase 5: About con foto accesible, Contact con tarifas y formulario honesto, menú móvil', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.match(html, /<img src="\.\/img\/sivla\.jpg"[^>]*alt="[^"]{20,}"/);
  assert.ok(existsSync('public/img/sivla.jpg'));
  for (const t of ['$150', '$50', '$35']) assert.ok(html.includes(t), `falta la tarifa ${t}`);
  assert.ok(html.includes('id="menuBtn"') && html.includes('aria-controls="sheet"'));
  const main = readFileSync('src/main.ts', 'utf8');
  assert.ok(main.includes('todavía no envía correos'), 'el formulario debe decir que no envía');
});

test('Servicios: tres servicios con los precios reales y enlace en la navegación', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.ok(html.includes('id="services"') && html.includes('href="#services"'));
  for (const p of ['$150 – $250', '$50 – $100', '$35']) assert.ok(html.includes(p), p);
});

test('Dentro del sonido: sección, botón de entrada y navegación', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.ok(html.includes('id="sonic"') && html.includes('id="sonicPlay"') && html.includes('href="#sonic"'));
});

test('Works: canciones de Spotify con portada y enlace', () => {
  const works = readFileSync('src/app/works.ts', 'utf8');
  for (const id of ['7zHZTHScVaGQ7ETXBiuHRH', '3OOkerqs3upJSBXHvlgvrc', '34lrJcxN9PyLB5kMw8BTHF', '26KTjx2syaXcGcMgyPP6VY']) assert.ok(works.includes(id), id);
  assert.ok(works.includes("title: 'De Locos 2'"));
});
