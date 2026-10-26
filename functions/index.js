// Cloudflare Pages Function: al entrar a la raíz "/", redirige al idioma del navegador.
const SUPPORTED = ['es', 'en', 'pt', 'de', 'fr', 'it'];

export function onRequestGet({ request }) {
  const header = request.headers.get('Accept-Language') || '';
  const prefs = header
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { lang: tag.slice(0, 2).toLowerCase(), q: q ? parseFloat(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  const pick = prefs.find((p) => SUPPORTED.includes(p.lang))?.lang || 'en';
  const url = new URL(request.url);
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${url.origin}/${pick}/`,
      'Cache-Control': 'private, no-store',
      Vary: 'Accept-Language',
    },
  });
}
