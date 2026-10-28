// Lógica compartida de /api/warranty/register y /api/warranty/claim (Cloudflare Pages Functions).
//
// Recibe el formulario del sitio, verifica Turnstile, valida contra el catálogo de garantías
// (/warranty.json, generado al compilar) y lo reenvía al panel de garantías (Render) con una clave compartida.
//
// Variables en Cloudflare Pages > Settings > Variables and Secrets:
//   GARANTIA_TOKEN  (secreta, obligatoria) la misma clave que GARANTIA_TOKEN en Render
//   PANEL_URL       (opcional) por defecto https://panel-marketing.onrender.com
//   TURNSTILE_SECRET_KEY, ALLOWED_ORIGINS, RATE_LIMIT, TURNSTILE_TEST_MODE: las mismas del formulario de contacto

const LANGS = ['es', 'en', 'pt', 'de', 'fr', 'it'];
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
const MAX = { register: 6 * 1024 * 1024, claim: 22 * 1024 * 1024 };
const DAY = 86400000;

const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

function clean(v, max, multiline = false) {
  if (typeof v !== 'string') return '';
  let s = v.normalize('NFC');
  s = multiline ? s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '') : s.replace(/[\u0000-\u001F\u007F]/g, ' ');
  s = s.trim();
  return s.length > max ? s.slice(0, max) : s;
}

async function readCapped(request, max) {
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) { try { await reader.cancel(); } catch {} return null; }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.byteLength; }
  return out;
}

function photo(p) {
  if (!p || typeof p !== 'object') return null;
  const mime = String(p.mime || '');
  const base64 = String(p.base64 || '');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) return null;
  if (!base64 || base64.length > 4.2 * 1024 * 1024 || !/^[A-Za-z0-9+/]+=*$/.test(base64)) return null;
  return { mime, base64 };
}

export const panelUrl = (env) => String(env.PANEL_URL || 'https://panel-marketing.onrender.com').replace(/\/$/, '');

export async function handle(context, mode) {
  const { request, env } = context;
  try {
    if (Number(request.headers.get('Content-Length') || 0) > MAX[mode]) return json(413, { ok: false, error: 'photo' });

    // Solo desde el propio sitio
    const self = new URL(request.url).origin;
    const extra = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const origin = request.headers.get('Origin');
    if (!origin || (origin !== self && !extra.includes(origin))) return json(403, { ok: false, error: 'generic' });
    if (!(request.headers.get('Content-Type') || '').includes('application/json')) return json(415, { ok: false, error: 'form' });

    const raw = await readCapped(request, MAX[mode]);
    if (!raw) return json(413, { ok: false, error: 'photo' });
    let b;
    try { b = JSON.parse(new TextDecoder().decode(raw)); } catch { return json(400, { ok: false, error: 'form' }); }
    if (!b || typeof b !== 'object') return json(400, { ok: false, error: 'form' });

    // Campo trampa
    if (clean(b.hp_x, 100)) return json(200, { ok: true, code: '—' });

    const lang = LANGS.includes(b.lang) ? b.lang : 'es';

    // Catálogo de productos con su garantía (se genera al compilar el sitio)
    const cat = await env.ASSETS.fetch(new Request(new URL('/warranty.json', request.url))).then((r) => r.json()).catch(() => null);
    const products = (cat && cat.products) || {};
    const slug = clean(b.producto, 80);
    const prod = Object.prototype.hasOwnProperty.call(products, slug) ? products[slug] : null;

    const d = { email: clean(b.email, 160).toLowerCase(), numero_serie: clean(b.numero_serie, 60) };
    const bad = [];
    if (!d.email || !EMAIL_RE.test(d.email)) bad.push('email');
    if (!prod) bad.push('producto');
    if (prod && prod.category === 'frames' && !d.numero_serie) bad.push('numero_serie');

    let payload;
    if (mode === 'register') {
      Object.assign(d, {
        nombre: clean(b.nombre, 120),
        pais: ['CL', 'BO'].includes(b.pais) ? b.pais : '',
        color: clean(b.color, 60),
        fecha_compra: /^\d{4}-\d{2}-\d{2}$/.test(String(b.fecha_compra || '')) ? b.fecha_compra : '',
        tienda: clean(b.tienda, 120),
        uso: ['xc', 'trail', 'enduro', 'downhill', 'ebike', 'urbano'].includes(b.uso) ? b.uso : '',
        estilo: ['no_salto', 'saltos_pequenos', 'saltos_grandes'].includes(b.estilo) ? b.estilo : '',
      });
      for (const k of ['nombre', 'pais', 'color', 'fecha_compra', 'tienda', 'uso', 'estilo']) if (!d[k]) bad.push(k);
      if (bad.length) return json(400, { ok: false, error: 'form', fields: [...new Set(bad)] });
      // Plazo: dentro de 15 días desde la compra (con un día de margen por la zona horaria)
      const bought = Date.parse(d.fecha_compra + 'T12:00:00Z');
      if (!Number.isFinite(bought)) return json(400, { ok: false, error: 'form', fields: ['fecha_compra'] });
      if (bought > Date.now() + DAY) return json(400, { ok: false, error: 'future', fields: ['fecha_compra'] });
      if (bought < Date.now() - 16 * DAY) return json(400, { ok: false, error: 'late', fields: ['fecha_compra'] });
      // La foto de la boleta o factura es obligatoria
      if (!b.boleta) return json(400, { ok: false, error: 'receipt', fields: ['fotos'] });
      const boleta = photo(b.boleta);
      if (!boleta) return json(400, { ok: false, error: 'photo' });
      payload = {
        ...d, producto_slug: slug, producto: prod.name, categoria: prod.category,
        garantia: prod.term || '', es_maza: !!prod.hub, idioma: lang, sitio: self, boleta,
      };
    } else {
      Object.assign(d, {
        tipo: ['falla', 'crash'].includes(b.tipo) ? b.tipo : '',
        descripcion: clean(b.descripcion, 3000, true),
      });
      if (!d.tipo) bad.push('tipo');
      if (!d.descripcion) bad.push('descripcion');
      const fotosIn = Array.isArray(b.fotos) ? b.fotos : [];
      if (!fotosIn.length) return json(400, { ok: false, error: 'photos', fields: [...new Set(bad)] });
      if (fotosIn.length > 5) return json(400, { ok: false, error: 'photo' });
      if (bad.length) return json(400, { ok: false, error: 'form', fields: [...new Set(bad)] });
      const fotos = fotosIn.map(photo);
      if (fotos.some((f) => !f)) return json(400, { ok: false, error: 'photo' });
      payload = { ...d, producto_slug: slug, producto: prod.name, categoria: prod.category, fotos, idioma: lang, sitio: self };
    }

    // Turnstile
    const ip = request.headers.get('CF-Connecting-IP') || '';
    const token = String(b.token || '');
    if (!token || token.length > 2048) return json(400, { ok: false, error: 'captcha' });
    if (!env.TURNSTILE_SECRET_KEY) { console.error('Falta TURNSTILE_SECRET_KEY'); return json(500, { ok: false, error: 'generic' }); }
    const verify = new FormData();
    verify.append('secret', env.TURNSTILE_SECRET_KEY);
    verify.append('response', token);
    if (ip) verify.append('remoteip', ip);
    const vj = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: verify }).then((r) => r.json()).catch(() => ({}));
    if (!vj.success) return json(400, { ok: false, error: 'captcha' });
    const hosts = [new URL(request.url).hostname, ...extra.map((o) => { try { return new URL(o).hostname; } catch { return ''; } })];
    if (vj.action && vj.action !== `warranty-${mode}`) return json(400, { ok: false, error: 'captcha' });
    if (vj.hostname && !hosts.includes(vj.hostname) && !env.TURNSTILE_TEST_MODE) return json(400, { ok: false, error: 'captcha' });

    // Límite por IP: 10 envíos por hora (si hay espacio KV)
    if (env.RATE_LIMIT && ip) {
      try {
        const key = `rlw:${ip}`;
        const n = Number((await env.RATE_LIMIT.get(key)) || 0);
        if (n >= 10) return json(429, { ok: false, error: 'rate' });
        await env.RATE_LIMIT.put(key, String(n + 1), { expirationTtl: 3600 });
      } catch (e) { console.warn('Límite por IP no disponible', e && e.message); }
    }

    if (!env.GARANTIA_TOKEN) { console.error('Falta GARANTIA_TOKEN'); return json(500, { ok: false, error: 'generic' }); }

    // Al panel (Render gratis puede tardar en despertar: se espera hasta 100 s)
    const r = await fetch(`${panelUrl(env)}/api/garantias/recibir/${mode === 'register' ? 'registro' : 'solicitud'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Garantia-Token': env.GARANTIA_TOKEN },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(100000),
    });
    const pj = await r.json().catch(() => ({}));
    if (r.ok && pj.ok) return json(200, { ok: true, code: pj.codigo });
    console.error('Panel de garantías respondió', r.status, JSON.stringify(pj).slice(0, 300));
    if (r.status === 400 && pj.error === 'foto') return json(400, { ok: false, error: 'photo' });
    if (r.status === 400 && pj.campos) return json(400, { ok: false, error: 'form', fields: pj.campos.map((c) => (c === 'producto_slug' ? 'producto' : c === 'fotos' ? 'fotos' : c)) });
    return json(502, { ok: false, error: 'generic' });
  } catch (e) {
    console.error('Error en garantía', e && e.message);
    return json(500, { ok: false, error: 'generic' });
  }
}
