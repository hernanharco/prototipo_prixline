# Prixline Internal Content (fase 3)

Objetivo: que el visitante **no salga nunca a prixline.blog** navegando por
nuestra información. Todo el contenido ya está importado en `content/`; falta
renderizarlo internamente y re-apuntar los enlaces.

Feedback del usuario: "tenemos muchos enlaces que llevan a blogs… que no lleve
a la página vieja sino mantener toda la información en esta parte".

## Inventario de enlaces externos a internalizar

- Tarjetas de artículos de la home → `post.data.originUrl` (externo)
- CTA "Ver todos los artículos" → blog origen
- Sección Prácticas → página `/practicas` del blog
- Header CTA "Hablar con Prixline" → `prixline.blog/contacto`
- Footer: Blog, Sugerencias (`prix.com/contacto`), Opiniones (comentarios WP)

## Externos legítimos (NO tocar)

- Vídeos de YouTube (el vídeo vive ahí) y CTA "Ver canal completo"
- Nota "Fuente: prixline.blog" al pie de cada ficha de curso (atribución)
- Chips de comunidad (redes sociales reales de `social.json`)

## Tareas

- [x] T13. `/articulos/[slug]/` — 813 páginas de artículo internas desde
      `content/posts/*` (cuerpo HTML con `set:html`, saneando `<script>` y
      atributos `on*` de forma defensiva), con breadcrumb, fecha, categorías,
      CTA comunidad y enlace discreto a la fuente. Las tarjetas de la home
      enlazan al detalle interno. — commit `2f7f8c51`
- [x] T14. `/articulos/` — índice interno de los 813 artículos (agrupados por
      año, buscador simple sin dependencias); reemplaza "Ver todos los
      artículos" y el enlace "Blog" del footer. — commit `6b382661`
- [x] T15. Páginas internas `/practicas/` y `/contacto/` desde
      `content/pages/*` + canales reales de `social.json` (incluye Telegram,
      YouTube, Spotify, formulario solo si hay backend — sin backend: enlaces
      de contacto reales). Header CTA, footer (Sugerencias/Opiniones) y CTA de
      la sección Prácticas apuntan a estas rutas internas. — commit `70014968`

## Criterios de aceptación

- `pnpm build` / `pnpm check` en `site/` → exit 0; rutas de curso siguen en 303.
- grep de la home y del footer: ningún enlace interno a contenido nuestro
  apunte a `prixline.blog` salvo la nota de fuente (atribución) y los
  enlaces de comunidad con dominio propio de Luis.
- Ningún `<script>` ni atributo `on*` del HTML importado llega al `dist`.
- Ningún archivo > 400 líneas; imágenes/medios solo desde campos de datos.
- Tests del pipeline en verde (58+) y recuentos sin cambios.

## Evidencia

- T13: `2f7f8c51` — tests **83/83** (25 del saneador, RED→GREEN); build **1.117 páginas** (813 artículos + 303 cursos + home), check 0; 0 nodos peligrosos en el `.prose` de los 813; 0 `onerror/onclick/javascript:` en dist; tarjetas home 6/6 internas y 0 al blog; **fix**: `generateId` decodificaba mal los slugs percent-encoded (79 posts con emoji daban 404 en toda forma de URL) → ahora crudo y percent-encoded responden 200. Nota: 1 vídeo VideoPress cae por allowlist (host no listado).
- T14: `6b382661` — build **1.118 páginas**, check 0; `dist/articulos` = **814** (813 + índice); índice con 813 links de detalle, 16 encabezados de año (2026→2012), contador SSR `813 de 813`; CTA "Ver todos" y footer "Blog" internos; 0 `prixline.blog` en la sección de artículos de la home; tests **83/83**. Nota: se añadió link "Blog" nuevo en footer (no existía); "Sitio original" queda externo a propósito.
- T15: `70014968` — build **1.120 páginas** (fase completa: 813 artículos + índice + 303 cursos + home + prácticas + contacto), check 0, tests **83/83**; `/contacto/` data-only (chat real + 11 chips, **0** mailto/tel inventados); Header CTA → `/contacto/`, CTA prácticas → `/practicas/`, footer Sugerencias → `/contacto/`; **0** `prixline.blog/contacto` y **0** `prixline.blog/practicas` ajenos en dist. Externos restantes (legítimos): nota Fuente, "Sitio original", Opiniones (hilo vivo), vídeos YouTube, chat prix.com.

- Commits por tarea: (se rellena al cerrar)
