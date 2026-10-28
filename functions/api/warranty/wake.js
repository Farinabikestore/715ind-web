// Despierta el panel de garantías (Render gratis se duerme) cuando alguien abre un formulario.
import { panelUrl } from '../../../functions-lib/warranty.js';
export function onRequestPost(context) {
  context.waitUntil(fetch(`${panelUrl(context.env)}/despierta`, { signal: AbortSignal.timeout(60000) }).catch(() => {}));
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
