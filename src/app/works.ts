/** Créditos reales (perfil de Muso de Siv-La) y portadas provisionales generadas por código. */
export interface Work { title: string; artists: string; roles: string; year: string; muso: string; spotify?: string; cover?: string }

export const WORKS: Work[] = [
  { title: 'Historia', artists: 'Jay Wheeler', roles: 'producer', year: '2024', muso: 'e29e5c91-039a-493c-a4af-44567e396dd2', spotify: 'https://open.spotify.com/track/7zHZTHScVaGQ7ETXBiuHRH', cover: 'https://i.scdn.co/image/ab67616d0000e1a35c5230ec148ee7be3bd51194' },
  { title: 'Catalina', artists: 'Oliwi • Afro Nigga • Teo', roles: 'producer • engineer • mixing', year: '2025', muso: '34f6696c-32a1-4c48-adde-b3e42033a6f2' },
  { title: 'Dividí', artists: 'Oliwi • Afro Nigga', roles: 'producer', year: '2025', muso: 'cf167121-6ae7-4d3f-9d19-c862eed010ba' },
  { title: 'De locos', artists: 'Mari La Carajita', roles: 'producer', year: '2026', muso: '22338313-ac9d-4814-87ed-c2866c1d246f' },
  { title: 'Dándote', artists: 'Sammer • Came Beats', roles: 'producer', year: '2026', muso: '81529b39-c86f-4629-b910-28a4fdac6bad' },
  { title: 'Pida la bendición', artists: 'Mari La Carajita • Manira', roles: 'producer', year: '2026', muso: '63a707bb-efc1-40db-b82a-9cee8872a0ca', spotify: 'https://open.spotify.com/track/34lrJcxN9PyLB5kMw8BTHF', cover: 'https://i.scdn.co/image/ab67616d0000e1a309633c4e00239760650b6e72' },
  { title: 'Primer Amor', artists: 'Kobi Cantillo • NOREH • Erick Brian', roles: 'composer', year: '2026', muso: '8a7b2b9d-9fa8-4f9a-a216-3971ee636093', spotify: 'https://open.spotify.com/track/26KTjx2syaXcGcMgyPP6VY', cover: 'https://i.scdn.co/image/ab67616d0000e1a34f062092c7196d399c3c7a06' },
  { title: 'De Locos 2', artists: 'Mari La Carajita • Neeus', roles: 'crédito por confirmar', year: '2026', muso: '', spotify: 'https://open.spotify.com/track/3OOkerqs3upJSBXHvlgvrc', cover: 'https://i.scdn.co/image/ab67616d0000e1a309633c4e00239760650b6e72' },
];

let uid = 0;
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/**
 * Portada provisional ORIGINAL (anillos concéntricos con el título). Sustituye a la portada oficial hasta que
 * el propietario aporte los archivos originales. No imita ninguna portada existente.
 */
export function placeholderCover(w: Work, index: number): string {
  const id = `pc${++uid}`;
  const warm = index % 2 === 0;
  const a = warm ? '#E08A45' : '#2F5BEE';
  const b = warm ? '#2F5BEE' : '#E08A45';
  const rings = Array.from({ length: 9 }, (_, i) => `<circle cx="50" cy="42" r="${6 + i * 4.4}" fill="none" stroke="${i % 2 ? b : a}" stroke-opacity="${(0.9 - i * 0.08).toFixed(2)}" stroke-width="${i % 2 ? 0.6 : 1.1}"/>`).join('');
  return `<svg viewBox="0 0 100 100" role="img" aria-label="Portada provisional de ${esc(w.title)}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F6F7FB"/><stop offset="1" stop-color="#DDE2F6"/></linearGradient></defs><rect width="100" height="100" fill="url(#${id})"/>${rings}<text x="8" y="86" font-family="Hanken Grotesk,system-ui,sans-serif" font-weight="300" font-size="${w.title.length > 12 ? 8 : 10}" fill="#0E1230">${esc(w.title)}</text><text x="8" y="94" font-family="IBM Plex Mono,monospace" font-size="3.2" letter-spacing=".4" fill="#6a6f92">PORTADA PENDIENTE · ${esc(w.year)}</text></svg>`;
}
