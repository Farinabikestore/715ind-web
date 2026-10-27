// Se ejecuta después de "astro build".
// Crea los íconos de la pestaña y del celular a partir del favicon subido en el panel
// (Configuración general → Ícono de la pestaña). Si no hay uno, usa public/favicon.svg.
import { readFile } from 'node:fs/promises';
import yaml from 'js-yaml';
import sharp from 'sharp';

const root = new URL('../', import.meta.url).pathname;
let src = 'public/favicon.svg';
try {
  const settings = yaml.load(await readFile(`${root}src/content/settings.yml`, 'utf8')) || {};
  const fav = settings.es && settings.es.favicon;
  if (fav && /^\/uploads\/[^.].*\.(png|webp|jpe?g|svg)$/i.test(fav) && !fav.includes('..')) src = `public${fav}`;
} catch (err) {
  console.warn(`[íconos] No se pudo leer settings.yml: ${err.message}`);
}

const input = await readFile(`${root}${src}`).catch(() => readFile(`${root}public/favicon.svg`));
const out = `${root}dist/`;
const clear = { r: 0, g: 0, b: 0, alpha: 0 };
const icons = [
  { file: 'favicon-32.png', size: 32 },
  { file: 'favicon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  // El ícono del iPhone no admite transparencia: se pone sobre el gris grafito de la marca.
  { file: 'apple-touch-icon.png', size: 180, flatten: '#222624' },
];
for (const i of icons) {
  let img = sharp(input, { density: 384 }).resize(i.size, i.size, { fit: 'contain', background: i.flatten || clear });
  if (i.flatten) img = img.flatten({ background: i.flatten });
  await img.png().toFile(out + i.file);
}
console.log(`[íconos] Íconos creados desde ${src}`);
