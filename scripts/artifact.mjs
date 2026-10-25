// Convierte dist/sivla.single.html al formato de Artifact de Claude (título, estilos, cuerpo y módulo, sin <head> propio).
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync(new URL('../dist/sivla.single.html', import.meta.url), 'utf8');
const script = html.match(/<script type="module">[\s\S]*?<\/script>/)?.[0];
const styles = html.match(/<style[^>]*>[\s\S]*?<\/style>/g) ?? [];
const style = styles.sort((a, b) => b.length - a.length)[0]; // el bloque grande; el de <noscript> es pequeño
const fonts = html.match(/<link rel="stylesheet" href="https:\/\/fonts[^>]*>/)?.[0] ?? '';
const body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1] ?? '').replace(/<script[\s\S]*?<\/script>/g, '');
if (!script || !style || style.length < 5000) throw new Error('No se encontró la hoja de estilos principal: abortado');
const out = `<title>Sivla</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n${fonts}\n${style}\n${body}\n${script}`;
writeFileSync(new URL('../dist/sivla.artifact.html', import.meta.url), out);
console.log('dist/sivla.artifact.html', Math.round(out.length / 1024), 'KB');
