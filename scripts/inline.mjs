// Empaqueta dist/ en un único HTML autocontenido (JS, CSS e imágenes locales como data URI).
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url);
let html = readFileSync(new URL('index.html', dist), 'utf8');
for (const f of readdirSync(new URL('assets/', dist))) {
  const body = readFileSync(new URL(`assets/${f}`, dist), 'utf8');
  const rel = new RegExp(`<(script|link)[^>]*(?:src|href)="\\./assets/${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>(?:</script>)?`);
  if (f.endsWith('.js')) html = html.replace(rel, () => `<script type="module">${body.replace(/<\/script>/g, '<\\/script>')}</script>`);
  else if (f.endsWith('.css')) html = html.replace(rel, () => `<style>${body}</style>`);
}
if (existsSync(new URL('img/', dist))) {
  for (const f of readdirSync(new URL('img/', dist))) {
    const mime = f.endsWith('.png') ? 'image/png' : f.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    const uri = `data:${mime};base64,${readFileSync(new URL(`img/${f}`, dist)).toString('base64')}`;
    html = html.split(`./img/${f}`).join(uri);
  }
}
writeFileSync(new URL('sivla.single.html', dist), html);
console.log('dist/sivla.single.html', Math.round(html.length / 1024), 'KB');
