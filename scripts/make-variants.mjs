// Se ejecuta después de "astro build".
// Crea versiones reducidas (480 y 960 px) de cada foto en dist/uploads para que el sitio cargue rápido.
// Las fotos originales del repositorio no se modifican.
import { readdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import sharp from 'sharp';

const ROOT = new URL('../dist/uploads/', import.meta.url).pathname;
const WIDTHS = [480, 960];
const EXT = new Set(['.webp', '.jpg', '.jpeg', '.png']);

async function walk(dir) {
  let out = [];
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out = out.concat(await walk(p));
    else if (EXT.has(extname(e.name).toLowerCase()) && !/\.w\d+\.webp$/i.test(e.name)) out.push(p);
  }
  return out;
}

const files = await walk(ROOT);
let made = 0;
const started = Date.now();
const queue = [...files];
async function worker() {
  while (queue.length) {
    const file = queue.shift();
    for (const w of WIDTHS) {
      const target = file.replace(/\.(webp|jpe?g|png)$/i, `.w${w}.webp`);
      try {
        await stat(target);
        continue;
      } catch {}
      try {
        await sharp(file).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toFile(target);
        made++;
      } catch (err) {
        console.warn(`[variantes] No se pudo procesar ${file}: ${err.message}`);
      }
    }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
console.log(`[variantes] ${made} imágenes reducidas creadas a partir de ${files.length} fotos en ${((Date.now() - started) / 1000).toFixed(1)} s`);
