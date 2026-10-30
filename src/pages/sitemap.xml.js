// Mapa del sitio para Google, con todas las páginas en los 6 idiomas.
import { LOCALES } from '../i18n/ui.js';
import { getProducts, getPosts } from '../lib/content.js';

export function GET({ site }) {
  const paths = ['/', '/products/', '/wheel-builder/', '/about/', '/contact/', '/where-to-buy/', '/privacy/', '/stories/', '/warranty/', '/warranty/register/', '/warranty/claim/'];
  for (const p of getProducts('es')) paths.push(`/products/${p.slug}/`);
  for (const p of getPosts('es')) paths.push(`/stories/${p.slug}/`);
  const url = (p) => new URL(p, site).href;
  const body = paths
    .flatMap((p) =>
      LOCALES.map(
        (l) => `  <url>\n    <loc>${url(`/${l}${p}`)}</loc>\n${LOCALES.map((a) => `    <xhtml:link rel="alternate" hreflang="${a}" href="${url(`/${a}${p}`)}"/>`).join('\n')}\n  </url>`
      )
    )
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
