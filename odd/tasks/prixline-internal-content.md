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

- [ ] T13. `/articulos/[slug]/` — 813 páginas de artículo internas desde
      `content/posts/*` (cuerpo HTML con `set:html`, saneando `<script>` y
      atributos `on*` de forma defensiva), con breadcrumb, fecha, categorías,
      CTA comunidad y enlace discreto a la fuente. Las tarjetas de la home
      enlazan al detalle interno.
- [ ] T14. `/articulos/` — índice interno de los 813 artículos (agrupados por
      año, buscador simple sin dependencias); reemplaza "Ver todos los
      artículos" y el enlace "Blog" del footer.
- [ ] T15. Páginas internas `/practicas/` y `/contacto/` desde
      `content/pages/*` + canales reales de `social.json` (incluye Telegram,
      YouTube, Spotify, formulario solo si hay backend — sin backend: enlaces
      de contacto reales). Header CTA, footer (Sugerencias/Opiniones) y CTA de
      la sección Prácticas apuntan a estas rutas internas.

## Criterios de aceptación

- `pnpm build` / `pnpm check` en `site/` → exit 0; rutas de curso siguen en 303.
- grep de la home y del footer: ningún enlace interno a contenido nuestro
  apunte a `prixline.blog` salvo la nota de fuente (atribución) y los
  enlaces de comunidad con dominio propio de Luis.
- Ningún `<script>` ni atributo `on*` del HTML importado llega al `dist`.
- Ningún archivo > 400 líneas; imágenes/medios solo desde campos de datos.
- Tests del pipeline en verde (58+) y recuentos sin cambios.

## Evidencia

- Commits por tarea: (se rellena al cerrar)
