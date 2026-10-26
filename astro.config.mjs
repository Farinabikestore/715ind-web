// Configuración de Astro (generador del sitio estático).
// SITE_URL se define en Cloudflare Pages > Settings > Variables (ej: https://www.715ind.com)
import { defineConfig } from 'astro/config';

const site = process.env.SITE_URL || 'https://www.example.com';
if (!process.env.SITE_URL) {
  console.warn('\n[715IND] Falta la variable SITE_URL. Se usa https://www.example.com en enlaces canónicos y sitemap.\n');
}

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    inlineStylesheets: 'auto',
  },
  vite: {
    build: {
      // Nunca incrustar scripts en el HTML: la política de seguridad (CSP) solo permite archivos propios.
      assetsInlineLimit: 0,
    },
  },
});
