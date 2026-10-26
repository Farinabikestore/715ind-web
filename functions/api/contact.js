// Cloudflare Pages Function: recibe el formulario de contacto y lo envía por correo con Resend.
//
// Variables que se configuran en Cloudflare Pages > Settings > Variables and Secrets:
//   TURNSTILE_SECRET_KEY  (secreta)  clave secreta de Cloudflare Turnstile
//   RESEND_API_KEY        (secreta)  clave de API de Resend
//   MAIL_TO                          correo(s) que reciben las consultas, separados por coma
//   MAIL_FROM                        remitente verificado en Resend, ej: 715IND Web <web@news.farinabikestore.com>
//   ALLOWED_ORIGINS       (opcional) dominios extra permitidos, separados por coma
//   RATE_LIMIT            (opcional) espacio KV para limitar envíos por IP (5 por hora)
//   TURNSTILE_TEST_MODE   (opcional) solo para pruebas con las claves de prueba de Turnstile
//
// Protecciones: tamaño máximo, origen del navegador, campo trampa (honeypot),
// verificación Turnstile en el servidor, validación de campos, límite por IP y escape de HTML.

const MAX_BYTES = 32 * 1024;
const TYPES = { distributor: 'Distribuidor internacional', dealer: 'Tienda o taller en Chile', other: 'Otra consulta' };
const LIMITS = { name: 120, company: 160, country: 80, city: 80, email: 160, phone: 40, website: 200, product: 120, message: 4000, config: 1500 };
const REQUIRED = ['name', 'company', 'country', 'email', 'message'];
const LANGS = ['es', 'en', 'pt', 'de', 'fr', 'it'];
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

export async function onRequestPost(context) {
  const { request, env } = context;
  const wantsJson = (request.headers.get('Accept') || '').includes('application/json');
  let lang = 'es';

  const reply = (status, body) => {
    if (wantsJson) {
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
    const url = new URL(request.url);
    const to = body.ok ? `/${lang}/thanks/` : `/${lang}/contact/?error=${encodeURIComponent(body.error || 'generic')}`;
    return Response.redirect(`${url.origin}${to}`, 303);
  };

  try {
    // 1. Tamaño
    if (Number(request.headers.get('Content-Length') || 0) > MAX_BYTES) return reply(413, { ok: false, error: 'form' });

    // 2. Origen: solo se aceptan envíos desde el propio sitio
    const origin = request.headers.get('Origin');
    if (origin) {
      const self = new URL(request.url).origin;
      const extra = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
      if (origin !== self && !extra.includes(origin)) return reply(403, { ok: false, error: 'generic' });
    }

    const ct = request.headers.get('Content-Type') || '';
    if (!ct.includes('multipart/form-data') && !ct.includes('application/x-www-form-urlencoded')) {
      return reply(415, { ok: false, error: 'form' });
    }
    // Se lee el cuerpo con un tope de tamaño (también si no viene Content-Length)
    const body = await readCapped(request, MAX_BYTES);
    if (!body) return reply(413, { ok: false, error: 'form' });
    const form = await new Request(request.url, { method: 'POST', body, headers: { 'Content-Type': ct } }).formData();
    const get = (k) => clean(form.get(k), LIMITS[k] || 200);
    lang = LANGS.includes(get('lang')) ? get('lang') : 'es';

    // 3. Campo trampa: si viene lleno es un bot. Se responde "ok" sin enviar nada.
    if (get('hp_x')) {
      console.log('Envío descartado por campo trampa');
      return reply(200, { ok: true });
    }

    // 4. Validación
    const data = {};
    for (const k of Object.keys(LIMITS)) data[k] = get(k);
    data.message = clean(form.get('message'), LIMITS.message, true);
    data.config = clean(form.get('config'), LIMITS.config, true);
    const type = TYPES[get('type')] ? get('type') : 'other';
    const bad = REQUIRED.filter((k) => !data[k]);
    if (data.email && !EMAIL_RE.test(data.email)) bad.push('email');
    if (form.get('consent') !== 'yes') bad.push('consent');
    if (bad.length) return reply(400, { ok: false, error: 'form', fields: [...new Set(bad)] });

    const ip = request.headers.get('CF-Connecting-IP') || '';

    // 6. Verificación anti-bots (Turnstile) en el servidor
    const token = String(form.get('cf-turnstile-response') || '');
    if (!token || token.length > 2048) return reply(400, { ok: false, error: 'captcha' });
    if (!env.TURNSTILE_SECRET_KEY) {
      console.error('Falta TURNSTILE_SECRET_KEY');
      return reply(500, { ok: false, error: 'generic' });
    }
    const verify = new FormData();
    verify.append('secret', env.TURNSTILE_SECRET_KEY);
    verify.append('response', token);
    if (ip) verify.append('remoteip', ip);
    const vr = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: verify });
    const vj = await vr.json().catch(() => ({}));
    if (!vj.success) return reply(400, { ok: false, error: 'captcha' });
    // El token debe venir de este sitio y de este formulario
    const allowedHosts = [new URL(request.url).hostname, ...(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean).map((o) => { try { return new URL(o).hostname; } catch { return ''; } })];
    if (vj.action && vj.action !== 'contact') return reply(400, { ok: false, error: 'captcha' });
    if (vj.hostname && !allowedHosts.includes(vj.hostname) && !env.TURNSTILE_TEST_MODE) return reply(400, { ok: false, error: 'captcha' });

    // 6b. Límite de envíos por IP (opcional, requiere KV). Va después de Turnstile para que los bots no lo agoten.
    if (env.RATE_LIMIT && ip) {
      try {
        const key = `rl:${ip}`;
        const count = Number((await env.RATE_LIMIT.get(key)) || 0);
        if (count >= 5) return reply(429, { ok: false, error: 'rate' });
        await env.RATE_LIMIT.put(key, String(count + 1), { expirationTtl: 3600 });
      } catch (e) {
        console.warn('Límite por IP no disponible', e && e.message);
      }
    }

    // 7. Filtro simple de spam: demasiados enlaces en el mensaje
    const links = (data.message.match(/https?:\/\//gi) || []).length;
    if (links > 8) return reply(200, { ok: true });

    // 8. Envío del correo
    if (!env.RESEND_API_KEY || !env.MAIL_TO || !env.MAIL_FROM) {
      console.error('Faltan RESEND_API_KEY, MAIL_TO o MAIL_FROM');
      return reply(500, { ok: false, error: 'generic' });
    }
    const subject = oneLine(`[715IND] ${TYPES[type]}: ${data.company} (${data.country})`).slice(0, 180);
    const rows = [
      ['Tipo', TYPES[type]],
      ['Nombre', data.name],
      ['Empresa', data.company],
      ['País', data.country],
      ['Ciudad', data.city],
      ['Correo', data.email],
      ['Teléfono', data.phone],
      ['Web / Instagram', data.website],
      ['Producto', data.product],
      ['Idioma del sitio', lang.toUpperCase()],
    ].filter(([, v]) => v);

    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#161817;line-height:1.5">
<h2 style="margin:0 0 12px">${esc(subject)}</h2>
<table cellpadding="6" style="border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="color:#535c58;border-bottom:1px solid #ddd">${esc(k)}</td><td style="border-bottom:1px solid #ddd"><b>${esc(v)}</b></td></tr>`).join('')}</table>
<h3 style="margin:20px 0 6px">Mensaje</h3>
<p style="white-space:pre-wrap;margin:0">${esc(data.message)}</p>
${data.config ? `<h3 style="margin:20px 0 6px">Configuración de rueda</h3><pre style="background:#f1f0eb;padding:12px;white-space:pre-wrap;margin:0">${esc(data.config)}</pre>` : ''}
<p style="color:#888;font-size:12px;margin-top:24px">Responde este correo para contestarle directamente a ${esc(data.email)}.</p>
</body></html>`;
    const text = [...rows.map(([k, v]) => `${k}: ${v}`), '', 'Mensaje:', data.message, data.config ? `\nConfiguración de rueda:\n${data.config}` : ''].join('\n');

    const idem = await sha256(token);
    const sr = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idem,
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: env.MAIL_TO.split(',').map((s) => s.trim()).filter(Boolean),
        reply_to: data.email,
        subject,
        html,
        text,
        tags: [{ name: 'source', value: 'web_715ind' }, { name: 'type', value: type }],
      }),
    });
    if (!sr.ok) {
      console.error('Resend respondió', sr.status, (await sr.text()).slice(0, 300));
      return reply(502, { ok: false, error: 'generic' });
    }
    return reply(200, { ok: true });
  } catch (err) {
    console.error('Error en /api/contact', err && err.message);
    return reply(500, { ok: false, error: 'generic' });
  }
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
    if (total > max) {
      try { await reader.cancel(); } catch {}
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.byteLength; }
  return out;
}

function clean(v, max, multiline = false) {
  if (typeof v !== 'string') return '';
  let s = v.normalize('NFC');
  // Quita caracteres de control (deja saltos de línea solo en campos de varias líneas)
  s = multiline ? s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '') : s.replace(/[\u0000-\u001F\u007F]/g, ' ');
  s = s.trim();
  return s.length > max ? s.slice(0, max) : s;
}
function oneLine(s) {
  return String(s).replace(/[\r\n]+/g, ' ');
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
