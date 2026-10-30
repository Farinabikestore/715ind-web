// Configuración de Astro (generador del sitio estático).
// Dirección oficial del sitio (enlaces canónicos, sitemap y redes sociales).
import { defineConfig } from 'astro/config';

const site = 'https://715ind.com';

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
