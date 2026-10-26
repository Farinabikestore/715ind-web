// Revisión rápida del contenido: formato YAML, campos obligatorios, fotos que existen y URLs repetidas.
// Uso: npm run check-content
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import yaml from 'js-yaml';

const root = new URL('../', import.meta.url).pathname;
const errors = [];
const warn = [];
const load = (f) => {
  try {
    return yaml.load(readFileSync(root + f, 'utf8')) || {};
  } catch (e) {
    errors.push(`${f}: formato inválido (${e.message.split('\n')[0]})`);
    return {};
  }
};
const checkImg = (src, where) => {
  if (src && String(src).startsWith('/uploads/') && !existsSync(root + 'public' + src)) errors.push(`${where}: no existe la foto ${src}`);
};

const slugs = new Map();
for (const f of readdirSync(root + 'src/content/products')) {
  if (!f.endsWith('.yml')) continue;
  const doc = load(`src/content/products/${f}`);
  const es = doc.es || {};
  if (!es.title) errors.push(`${f}: falta el nombre en español`);
  if (!es.slug) errors.push(`${f}: falta la dirección web (slug)`);
  if (!es.category) errors.push(`${f}: falta la categoría`);
  if (!(es.images || []).length) warn.push(`${f}: no tiene fotos`);
  if (es.slug) {
    if (slugs.has(es.slug)) errors.push(`${f}: la URL "${es.slug}" se repite con ${slugs.get(es.slug)}`);
    slugs.set(es.slug, f);
  }
  (es.images || []).forEach((i) => checkImg(i, f));
  (es.colors || []).forEach((c) => checkImg(c.image, f));
  for (const l of ['en', 'pt', 'de', 'fr', 'it']) if (!doc[l] || !doc[l].title) warn.push(`${f}: sin traducción (${l}), se mostrará en español`);
}
for (const f of readdirSync(root + 'src/content/pages')) load(`src/content/pages/${f}`);
load('src/content/settings.yml');
const b = load('src/content/builder.yml');
for (const group of ['rims', 'front_hubs', 'rear_hubs']) for (const p of b[group] || []) for (const c of p.colors || []) checkImg(c.image, `builder ${p.name}`);

warn.forEach((w) => console.log('Aviso:', w));
if (errors.length) {
  errors.forEach((e) => console.error('Error:', e));
  process.exit(1);
}
console.log(`Contenido OK: ${slugs.size} productos.`);
