// Catálogo de garantías para las funciones del servidor (/api/warranty/*).
// Se genera al compilar desde los productos y la página "Garantía" del panel.
import { getProducts, getPage } from '../lib/content.js';

export function GET() {
  const items = getPage('warranty', 'es').items || [];
  const terms = Object.fromEntries(items.filter((i) => i && i.product).map((i) => [i.product, i.term || '']));
  const products = {};
  for (const p of getProducts('es')) {
    if (p.category === 'apparel') continue;   // la ropa no se registra
    products[p.slug] = {
      name: p.title,
      category: p.category,
      hub: p.category === 'hubs',
      term: terms[p.slug] || '',
      colors: (p.colors || []).map((c) => c && c.name).filter(Boolean),
    };
  }
  return new Response(JSON.stringify({ products }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
