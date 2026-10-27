// Se ejecuta después de "astro build".
// Crea los íconos de la pestaña y del celular a partir del favicon subido en el panel
// (Configuración general → Ícono de la pestaña). Si no hay uno, usa public/favicon.svg.
import { readFile, writeFile } from 'node:fs/promises';
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

// ¿Es un ícono oscuro sobre fondo transparente? Entonces en pestañas oscuras se invierte a blanco,
// y el ícono del iPhone va sobre fondo claro (si no, negro sobre grafito no se vería).
const { data, info } = await sharp(input, { density: 384 }).resize(64, 64, { fit: 'contain', background: clear }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let lum = 0, solid = 0, transparent = 0;
for (let i = 0; i < data.length; i += info.channels) {
  const a = data[i + 3] / 255;
  if (a < 0.1) { transparent++; continue; }
  solid++;
  lum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
}
const dark = solid > 0 && transparent / (solid + transparent) > 0.15 && lum / solid < 0.25;
const plate = dark ? '#f5f5f2' : '#222624';

const icons = [
  { file: 'favicon-32.png', size: 32 },
  { file: 'favicon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180, flatten: plate, pad: 18 },
];
for (const i of icons) {
  const inner = i.size - 2 * (i.pad || 0);
  let img = sharp(input, { density: 384 }).resize(inner, inner, { fit: 'contain', background: clear });
  if (i.pad) img = img.extend({ top: i.pad, bottom: i.pad, left: i.pad, right: i.pad, background: clear });
  if (i.flatten) img = img.flatten({ background: i.flatten });
  await img.png().toFile(out + i.file);
}

// favicon.svg para pestañas: usa el PNG de 192 px y, si el ícono es oscuro, lo vuelve blanco en modo oscuro.
const png = await sharp(input, { density: 384 }).resize(192, 192, { fit: 'contain', background: clear }).png().toBuffer();
const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 192 192">`
  + (dark ? `<style>@media (prefers-color-scheme: dark){image{filter:invert(1)}}</style>` : '')
  + `<image width="192" height="192" href="data:image/png;base64,${png.toString('base64')}" xlink:href="data:image/png;base64,${png.toString('base64')}"/></svg>`;
await writeFile(out + 'favicon-auto.svg', svg);
console.log(`[íconos] Íconos creados desde ${src}${dark ? ' (oscuro: se invierte en modo oscuro)' : ''}`);
