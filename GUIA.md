# Sitio 715IND: guía de publicación y uso

Sitio de marca multi idioma (español, inglés, portugués, alemán, francés e italiano), sin carro de compra, con armador de ruedas, formulario para distribuidores y dealers, y panel de edición propio.

**Costo mensual: $0.** Solo sigues pagando el dominio que ya tienen.

| Pieza | Servicio | Plan |
|---|---|---|
| Código y contenido | GitHub (repositorio privado) | Gratis |
| Hosting, seguridad, antibots | Cloudflare Pages + Turnstile | Gratis |
| Envío de correos del formulario | Resend (la cuenta que ya usas) | Gratis hasta 100 correos al día y 3.000 al mes |
| Panel de edición | Sveltia CMS | Gratis, código abierto |

---

## Cómo funciona (en una línea)

Editas en el panel → el panel guarda en GitHub → Cloudflare detecta el cambio y publica el sitio nuevo en 1 a 2 minutos.

El sitio publicado son archivos estáticos: no hay base de datos ni servidor que atacar. El único punto que recibe datos es el formulario, y está protegido (ver "Seguridad" al final).

---

## Parte 1. Subir el proyecto a GitHub (10 minutos)

1. Entra a <https://github.com> y crea una cuenta si no tienes. **Activa la verificación en dos pasos**: foto de perfil → Settings → Password and authentication → Two-factor authentication.
2. Arriba a la derecha: **+** → **New repository**.
   - Repository name: `715ind-web`
   - Marca **Private**.
   - No marques ninguna otra opción. Clic en **Create repository**.
3. Descarga e instala **GitHub Desktop**: <https://desktop.github.com>. Inicia sesión con tu cuenta.
4. En GitHub Desktop: **File → Clone repository** → elige `715ind-web` → elige una carpeta de tu computador → **Clone**.
5. Descomprime el archivo `715ind-web.zip` que te entregué. Abre la carpeta descomprimida, selecciona **todo lo que hay dentro** (carpetas `functions`, `public`, `scripts`, `src` y los archivos sueltos) y cópialo dentro de la carpeta que creó GitHub Desktop en el paso anterior.
6. Vuelve a GitHub Desktop. Verás la lista de archivos nuevos. Abajo a la izquierda escribe en "Summary": `Primera versión del sitio` → **Commit to main** → arriba **Push origin**.

> Si prefieres no hacer este paso, crea el repositorio vacío (pasos 1 y 2) y dime el nombre exacto: lo subo yo.

---

## Parte 2. Publicar en Cloudflare Pages (10 minutos)

1. Crea una cuenta gratis en <https://dash.cloudflare.com/sign-up> y **activa la verificación en dos pasos** (My Profile → Authentication).
2. Menú izquierdo: **Workers & Pages** → **Create** → pestaña **Pages** → **Connect to Git**.
3. Autoriza GitHub, elige el repositorio `715ind-web` → **Begin setup**.
4. Configuración de compilación:
   - Project name: `715ind` (tu dirección provisoria será `715ind.pages.dev`)
   - Production branch: `main`
   - Framework preset: **Astro**
   - Build command: `npm run build`
   - Build output directory: `dist`
5. Abre **Environment variables (advanced)** y agrega estas dos variables por ahora:
   - `SITE_URL` = `https://www.TU-DOMINIO.com` (tu dominio real, con https y sin barra final)
   - `NODE_VERSION` = `22`
6. Clic en **Save and Deploy**. En 2 a 3 minutos el sitio queda en `https://715ind.pages.dev`.

El formulario todavía no envía correos: falta la Parte 3.

---

## Parte 3. Formulario seguro: Turnstile + Resend (10 minutos)

### 3.1 Turnstile (antibots de Cloudflare, gratis)

1. En Cloudflare, menú izquierdo: **Turnstile** → **Add widget**.
2. Widget name: `Formulario 715IND`.
3. Hostnames: agrega `715ind.pages.dev` y tu dominio (ej: `715ind.com`).
4. Widget Mode: **Managed** → **Create**.
5. Copia las dos claves que aparecen: **Site Key** (pública) y **Secret Key** (secreta).

### 3.2 Clave de Resend

1. Entra a <https://resend.com> → **API Keys** → **Create API Key**.
2. Name: `web-715ind` · Permission: **Sending access** · Domain: `news.farinabikestore.com` → **Add**.
3. Copia la clave (empieza con `re_`). Solo se muestra una vez.

> Los correos saldrán desde `news.farinabikestore.com`, que ya tienes verificado en Resend, así funciona desde el primer día. Al responder, la respuesta va directo al interesado porque el formulario usa su correo como "responder a". Si más adelante quieres que salgan desde el dominio de 715IND, el plan gratis de Resend permite verificar hasta 3 dominios: lo agregas en Resend → Domains y cambias `MAIL_FROM`.

### 3.3 Cargar las claves en Cloudflare

En Cloudflare: **Workers & Pages** → proyecto `715ind` → **Settings** → **Variables and Secrets** → **Add**. Agrega estas (entorno **Production**):

| Nombre | Tipo | Valor |
|---|---|---|
| `PUBLIC_TURNSTILE_SITE_KEY` | Text | la Site Key del paso 3.1 |
| `TURNSTILE_SECRET_KEY` | **Secret** | la Secret Key del paso 3.1 |
| `RESEND_API_KEY` | **Secret** | la clave `re_...` del paso 3.2 |
| `MAIL_TO` | Text | correo(s) que reciben las consultas, separados por coma |
| `MAIL_FROM` | Text | `715IND Web <web@news.farinabikestore.com>` |
| `SITE_URL` y `NODE_VERSION` | Text | (ya las agregaste) |

Luego: pestaña **Deployments** → en el último despliegue, menú **⋯** → **Retry deployment**. Las variables nuevas se aplican desde ese despliegue.

**Prueba:** entra a `https://715ind.pages.dev/es/contact/`, envía una consulta de prueba y revisa que llegue el correo.

---

## Parte 4. Conectar tu dominio (15 minutos)

1. En Cloudflare: proyecto `715ind` → **Custom domains** → **Set up a custom domain** → escribe `www.tudominio.com` → sigue los pasos. Repite con `tudominio.com` (sin www).
2. Cloudflare te dirá qué hacer según dónde está tu dominio:
   - **Si el dominio ya está en Cloudflare:** se configura solo.
   - **Si está en otro proveedor (NIC Chile, GoDaddy, etc.):** lo recomendable es pasar el dominio a Cloudflare (gratis). En Cloudflare: **Add a domain** → escribe tu dominio → plan **Free** → Cloudflare copia tus registros actuales (revisa que estén los de correo, tipo MX) → te da 2 "nameservers" → los cambias en tu proveedor del dominio. Puede tardar unas horas.
3. Cuando el dominio funcione, actualiza `SITE_URL` si cambió y vuelve a hacer **Retry deployment**.
4. Edita en GitHub el archivo `public/admin/config.yml` y cambia la línea `site_url: https://www.example.com` por tu dominio.

---

## Parte 5. Activar el panel de edición (5 minutos)

### 5.1 Decirle al panel dónde está el contenido

1. En <https://github.com>, abre tu repositorio → carpeta `public/admin` → archivo `config.yml` → ícono de lápiz (Edit).
2. Cambia esta línea:
   ```yaml
   repo: TU_USUARIO_GITHUB/715ind-web
   ```
   por tu usuario real, por ejemplo `repo: vascofarina/715ind-web`.
3. **Commit changes** → **Commit changes**.

### 5.2 Crear tu llave de acceso

1. GitHub → foto de perfil → **Settings** → abajo a la izquierda **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Token name: `Panel 715IND` · Expiration: 1 año.
3. Repository access: **Only select repositories** → `715ind-web`.
4. Permissions → Repository permissions → **Contents: Read and write**.
5. **Generate token** y cópiala.

### 5.3 Entrar

1. Abre `https://tudominio.com/admin/`.
2. Clic en **Sign In Using Access Token** → pega la llave → listo.
3. La llave queda guardada solo en ese navegador. En otro computador repites el paso 2.

> Cada persona que edite debe tener su propia cuenta de GitHub agregada como colaborador del repositorio (Settings → Collaborators) y su propia llave.

---

## Uso diario del panel

El panel está en inglés (el programa no tiene versión en español), pero todos los campos que creé están en español.

### Agregar un producto
1. **Productos** → **New**.
2. Completa: Nombre, Dirección web (ej: `maza-trail-boost`), Categoría, Fotos (arrastra para ordenar), Colores, Especificaciones y Descripción.
3. **Save**. En 1 a 2 minutos aparece en el sitio.

### Fotos
- Arrastra las fotos al campo. El panel las convierte solo a WebP de máximo 1.600 px, aunque subas archivos de 10 MB.
- En "Colores", cada color puede tener su foto: al hacer clic en el color del sitio se muestra esa foto.

### Armar la portada con bloques (arrastrar y soltar)
**Páginas → Portada → Bloques.** Cada bloque es una sección: Portada (foto grande), Categorías, Destacado (foto + texto), Grilla de productos, Banda armador de ruedas, Llamado a distribuidores, Galería, Video de YouTube y Texto.
- Agregar: botón **+ Add** al final de la lista.
- Reordenar: arrastra el bloque desde su manilla.
- Quitar: menú del bloque → **Remove**.

Los enlaces de botones se escriben sin idioma: `/products/`, `/wheel-builder/`, `/contact/`. El sitio agrega `/es/`, `/en/`, etc. solo.

### Idiomas
- Cada producto y página tiene los 6 idiomas. El panel muestra los idiomas lado a lado.
- Lo que no traduzcas se muestra en español en los demás idiomas, así nunca queda un hueco.
- **Traducción automática (opcional, gratis):** en el panel, menú de usuario → **Settings** → **Translation** → pega una clave de Google Cloud Translation (gratis hasta 500.000 caracteres al mes). Luego, en cada producto, el botón de traducir llena los idiomas vacíos. Revisa siempre el resultado.
- Los textos fijos del sitio (menú, botones, formulario) están en `src/i18n/ui.js`.

### Tipografía y color
**Configuración general → Marca, redes y textos generales:**
- **Tipografía:** cambia la letra de todo el sitio. Opciones: Estilo PNW (condensada en mayúsculas, la que viene puesta), Expandida gruesa, Técnica angosta y Clásica condensada. Todas son gratuitas y van incluidas en el sitio, sin depender de Google Fonts.
- **Títulos en mayúsculas:** según la tipografía, siempre o nunca.
- **Color de acento:** el de los botones y la franja de distribuidores. El color del texto encima se ajusta solo para que se lea.

PNW usa tipografías comerciales con licencia (Trade Gothic Next y Conduit ITC). El estilo PNW del sitio usa Barlow Condensed y Barlow, que son libres y muy parecidas. Si algún día compran una licencia de otra tipografía, se puede agregar como opción más.

### Armador de ruedas
**Armador de ruedas → Piezas del armador.** Ahí agregas llantas, mazas, núcleos, colores de rayos y niples, y la tabla de largos de rayo. Si una combinación no tiene largo en la tabla, el sitio muestra "Lo calculamos al armar".

El armador no muestra precios. Al final, el visitante pulsa **Solicitar cotización** y la configuración llega adjunta en el correo, con los largos de rayo calculados.

---

## Seguridad: qué quedó protegido

- **Sitio estático:** no hay base de datos, ni WordPress, ni plugins. No hay nada que "hackear" en el servidor.
- **HTTPS obligatorio** y cabeceras de seguridad estrictas (archivo `public/_headers`): solo se ejecutan scripts propios y los de Cloudflare Turnstile; el sitio no se puede incrustar en otras páginas (protege contra clickjacking).
- **Formulario** (`functions/api/contact.js`):
  - Verificación antibots Turnstile **en el servidor** (no se puede saltar desde el navegador).
  - Campo trampa invisible para bots.
  - Solo acepta envíos desde tu propio dominio.
  - Valida y limita el largo de cada campo, y escapa todo el HTML del correo.
  - Las claves de Turnstile y Resend son secretas en Cloudflare: no están en el código ni en GitHub.
  - No envía correos automáticos al visitante, para que nadie use el formulario para mandar spam a terceros.
- **Panel:** solo entra quien tenga cuenta de GitHub con permiso sobre el repositorio privado. El script del panel está fijado a una versión y verificado con firma (`integrity`).
- **Historial completo:** cada cambio queda guardado en GitHub. Si algo se borra por error, se recupera.

### Recomendado (gratis, 5 minutos)
1. Verificación en dos pasos en GitHub, Cloudflare y Resend.
2. Cloudflare → tu dominio → **Security** → **Bots** → activar **Bot Fight Mode**.
3. Cloudflare → tu dominio → **Security** → **WAF** → **Rate limiting rules** → crear regla: si la ruta (URI Path) es igual a `/api/contact`, más de 3 solicitudes en 10 segundos por IP → **Block** por 10 segundos. (El plan gratis incluye una regla.)
4. Opcional: límite de 5 envíos por hora por IP desde el propio formulario. Cloudflare → **Storage & Databases** → **KV** → crea `RATE_LIMIT_715` → en el proyecto `715ind` → Settings → **Bindings** → **Add** → KV namespace → nombre de variable `RATE_LIMIT` → elige `RATE_LIMIT_715` → Retry deployment.

---

## Velocidad

- Páginas HTML pre-generadas y servidas desde la red mundial de Cloudflare (cerca de cada visitante en cualquier país).
- Cada foto se publica en 3 tamaños (480, 960 y 1.600 px) y el navegador descarga la que necesita.
- Fuente tipográfica propia (sin Google Fonts), sin rastreadores ni publicidad.
- JavaScript solo donde hace falta: armador, galería y formulario.

---

## Ingreso con botón "Sign In with GitHub" (opcional)

Si prefieres no usar llaves de acceso, puedes instalar el autenticador gratuito de Sveltia en Cloudflare Workers: <https://github.com/sveltia/sveltia-cms-auth> (botón **Deploy to Cloudflare** y sigue su guía). Luego, en `public/admin/config.yml`, quita el `#` de la línea `base_url` y pon la dirección del autenticador.

## Actualizar el panel (una vez al año, opcional)

En `public/admin/index.html` la versión está fija (`@sveltia/cms@0.253.0`). Para actualizarla, cambia el número por la versión nueva y borra la línea `integrity="..."` (o pídeme que calcule la nueva firma).

---

## Para quien programe

```bash
npm install
npm run dev            # sitio local en http://localhost:4321/es/
npm run build          # revisa contenido, compila a dist/ y genera tamaños de foto
npm run check-content  # solo revisa el contenido
```

- Contenido: `src/content/` (YAML, todos los idiomas en el mismo archivo).
- Textos fijos: `src/i18n/ui.js`.
- Estilos: `src/styles/global.css`.
- Formulario: `functions/api/contact.js` (Cloudflare Pages Functions).
- Redirección por idioma en la raíz: `functions/index.js`.
