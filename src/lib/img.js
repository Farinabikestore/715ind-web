// Las imágenes subidas desde el panel quedan en /uploads/.
// Al compilar, scripts/make-variants.mjs crea versiones de 480 y 960 px de ancho
// (archivo.w480.webp y archivo.w960.webp) para que el sitio cargue rápido en celulares.
export const VARIANT_WIDTHS = [480, 960];

export function isLocalUpload(src) {
  return typeof src === 'string' && src.startsWith('/uploads/') && /\.(webp|jpe?g|png)$/i.test(src);
}

export function variant(src, w) {
  if (!isLocalUpload(src)) return src;
  return src.replace(/\.(webp|jpe?g|png)$/i, `.w${w}.webp`);
}

export function srcset(src) {
  if (!isLocalUpload(src)) return undefined;
  return [...VARIANT_WIDTHS.map((w) => `${variant(src, w)} ${w}w`), `${src} 1600w`].join(', ');
}
