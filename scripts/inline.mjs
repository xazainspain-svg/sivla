// Empaqueta dist/ en un único HTML autocontenido (útil para compartir la demo como un solo archivo).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url);
let html = readFileSync(new URL('index.html', dist), 'utf8');
const assets = readdirSync(new URL('assets/', dist));
for (const f of assets) {
  const body = readFileSync(new URL(`assets/${f}`, dist), 'utf8');
  const rel = new RegExp(`<(script|link)[^>]*(?:src|href)="\\./assets/${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>(?:</script>)?`);
  if (f.endsWith('.js')) html = html.replace(rel, () => `<script type="module">${body.replace(/<\/script>/g, '<\\/script>')}</script>`);
  else if (f.endsWith('.css')) html = html.replace(rel, () => `<style>${body}</style>`);
}
writeFileSync(new URL('sivla.single.html', dist), html);
console.log('dist/sivla.single.html', Math.round(html.length / 1024), 'KB');
