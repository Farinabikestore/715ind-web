// Carga el contenido que se edita desde el panel (Sveltia CMS).
// Cada archivo YAML guarda todos los idiomas juntos (es:, en:, pt:, ...).
// Si a un idioma le falta un campo, se usa el valor en español.
import yaml from 'js-yaml';
import { marked } from 'marked';
import { LOCALES, DEFAULT_LOCALE } from '../i18n/ui.js';

const productFiles = import.meta.glob('/src/content/products/*.yml', { query: '?raw', import: 'default', eager: true });
const pageFiles = import.meta.glob('/src/content/pages/*.yml', { query: '?raw', import: 'default', eager: true });
const settingsFile = import.meta.glob('/src/content/settings.yml', { query: '?raw', import: 'default', eager: true });
const builderFile = import.meta.glob('/src/content/builder.yml', { query: '?raw', import: 'default', eager: true });

export const CATEGORIES = ['hubs', 'rims', 'wheels', 'frames', 'cockpit', 'saddles', 'apparel'];

function isEmpty(v) {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

// Mezcla el idioma pedido sobre el idioma por defecto, campo por campo y elemento por elemento.
function merge(base, over) {
  if (Array.isArray(base) || Array.isArray(over)) {
    const b = Array.isArray(base) ? base : [];
    const o = Array.isArray(over) ? over : [];
    if (!o.length) return b;
    // Listas de textos simples (imágenes, viñetas): si el idioma tiene su propia lista, se usa.
    if (o.every((x) => typeof x !== 'object' || x === null)) return o;
    const len = Math.max(b.length, o.length);
    const out = [];
    for (let i = 0; i < len; i++) out.push(merge(b[i], o[i]));
    return out;
  }
  if (base && typeof base === 'object' && over && typeof over === 'object') {
    const out = { ...base };
    for (const k of Object.keys(over)) out[k] = merge(base[k], over[k]);
    return out;
  }
  return isEmpty(over) ? base : over;
}

function parse(raw, file) {
  try {
    return yaml.load(raw) || {};
  } catch (e) {
    throw new Error(`Error de formato en ${file}: ${e.message}`);
  }
}

function localize(doc, lang) {
  const base = doc[DEFAULT_LOCALE] || {};
  if (lang === DEFAULT_LOCALE) return base;
  return merge(base, doc[lang] || {});
}

// El texto del panel no puede insertar HTML propio: se muestra como texto.
const escHtml = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
marked.use({
  renderer: {
    html(token) {
      return escHtml(typeof token === 'string' ? token : token.text || token.raw || '');
    },
    link(token) {
      const href = safeUrl(token.href);
      const text = this.parser.parseInline(token.tokens);
      if (!href) return text;
      const ext = /^https?:/i.test(href);
      return `<a href="${escHtml(href)}"${ext ? ' rel="noopener noreferrer" target="_blank"' : ''}>${text}</a>`;
    },
  },
});

export function md(text) {
  if (!text) return '';
  return marked.parse(String(text), { async: false });
}

// Solo se aceptan enlaces web, correo, teléfono, anclas y rutas internas.
export function safeUrl(href) {
  if (!href) return '';
  const h = String(href).trim();
  if (/^(https?:|mailto:|tel:)/i.test(h) || h.startsWith('#') || (h.startsWith('/') && !h.startsWith('//'))) return h;
  return '';
}

// Convierte enlaces internos del panel ("/products/") en enlaces con idioma ("/en/products/").
export function link(href, lang) {
  if (!href) return '';
  const h = safeUrl(href);
  if (!h) return '';
  if (/^(https?:|mailto:|tel:|#)/i.test(h)) return h;
  const first = h.split('/')[1];
  if (LOCALES.includes(first)) return h;
  if (h.startsWith('/uploads/')) return h;
  return `/${lang}${h === '/' ? '/' : h}`;
}

export function getSettings(lang) {
  const raw = Object.values(settingsFile)[0] || '';
  return localize(parse(raw, 'settings.yml'), lang);
}

export function getPage(name, lang) {
  const key = Object.keys(pageFiles).find((k) => k.endsWith(`/${name}.yml`));
  if (!key) return {};
  return localize(parse(pageFiles[key], key), lang);
}

let _products;
function allRaw() {
  if (!_products) {
    _products = Object.entries(productFiles).map(([file, raw]) => {
      const doc = parse(raw, file);
      const fallbackSlug = file.split('/').pop().replace(/\.yml$/, '');
      return { file, doc, fallbackSlug };
    });
  }
  return _products;
}

export function getProducts(lang) {
  return allRaw()
    .map(({ doc, fallbackSlug }) => {
      const p = localize(doc, lang);
      return {
        ...p,
        slug: slugify(p.slug || fallbackSlug),
        images: (p.images || []).filter(Boolean),
        colors: (p.colors || []).filter((c) => c && (c.name || c.hex)),
        specs: (p.specs || []).filter((s) => s && s.label && !isEmpty(s.value)),
        order: Number(p.order ?? 999),
        hidden: p.hidden === true,
      };
    })
    .filter((p) => !p.hidden && p.title)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

export function getProduct(slug, lang) {
  return getProducts(lang).find((p) => p.slug === slug);
}

export function getBuilder() {
  const raw = Object.values(builderFile)[0] || '';
  return parse(raw, 'builder.yml');
}

export function slugify(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export { LOCALES, DEFAULT_LOCALE };

// Tipografía y color de acento elegidos en el panel (Configuración general).
const TYPES = ['pnw', 'gravity', 'archivo', 'saira', 'oswald'];
export function typeAttrs(settings = {}) {
  const type = TYPES.includes(settings.font_style) ? settings.font_style : 'pnw';
  const kase = ['upper', 'normal'].includes(settings.titles_case) ? settings.titles_case : undefined;
  const hex = /^#[0-9a-f]{6}$/i.test(settings.accent_color || '') ? settings.accent_color : '';
  let style;
  if (hex) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    style = `--ember:${hex};--on-ember:${lum > 0.22 ? '#161817' : '#f5f5f2'}`;
  }
  return { type, kase, style };
}
