# Prixline Course UX + Real Thumbnails

Segunda fase del sitio (continúa `prixline-content-pipeline`, ya cerrado con T1-T8).
Feedback del usuario sobre `http://localhost:4322/cursos/`:

1. Demasiado texto: la vista cansa la vista.
2. Al hacer click en un curso redirige al blog de Luis — el visitante debe
   **permanecer en la página** con fichas propias y profesionales.
3. Faltan miniaturas; el blog origen las usa mucho (YouTube + imágenes inline).

Decisiones del usuario:
- **Imágenes**: solo fotos reales cuando existen fuente (YouTube `i.ytimg.com`,
  `<img>` inline del post). Los cursos NO llevan fotos de stock ni portadas
  generadas: van tipográficos con jerarquía fuerte.
- Todo el temario de los cursos ya está importado en `content/courses/*`
  (302 fichas con el cuerpo completo) — se reutiliza para las fichas internas.

## Tareas

- [x] T9. Páginas de detalle `/cursos/[slug]/` (302 rutas estáticas): temario
      renderizado con jerarquía, migas, CTA de contacto interno, sin salida al
      blog origen (la fuente queda como enlace discreto al pie). Las tarjetas
      del catálogo enlazan al detalle interno. — commit `b0c70f66`
- [x] T10. Rediseño visual del catálogo `/cursos/`: menos texto por tarjeta
      (título + categoría + nº de temas), grid con respiración, jerarquía
      tipográfica, buscador con chips de categoría, sin enlace externo.
      — commit `355970db`
- [x] T11. Miniaturas reales en artículos: el importador de posts extrae
      `thumbnail` (primer id de YouTube del contenido o primera `<img>`) y la
      home muestra los 6 artículos con imagen real (fallback tipográfico si no
      hay). — commit `55a1086f`
- [x] T12. Sección YouTube con vídeos reales del canal vía RSS de build
      (`youtube.com/feeds/videos.xml?channel_id=...`, sin API key): últimos
      vídeos con miniatura real `i.ytimg.com`, enlazados, sustituyendo el
      bloque solo-enlace actual. — commit `WIP12`

## Criterios de aceptación

- **Imágenes editables desde el CMS**: toda imagen (miniatura de artículo,
  vídeo, futura imagen de curso) vive en un campo de datos (frontmatter o
  `content/settings/*`) con su `alt`; los componentes solo leen ese campo.
  Cero URLs de imagen hardcodeadas en componentes. El importador propone un
  valor por defecto (YouTube/`<img>` inline) pero un editor del CMS puede
  sobreescribirlo o vaciarlo sin tocar código.

- `pnpm build` y `pnpm check` en `site/` → exit 0.
- Ninguna tarjeta de curso sale del sitio; `/cursos/<slug>/` existe para los
  302 cursos y renderiza el temario completo.
- Ningún archivo > 400 líneas.
- Las imágenes remotas se piden a CDNs estables (i.ytimg.com) o al origen;
  sin métricas inventadas.
- Verificación estructural documentada (markup sin framework de tests).

## Evidencia

- T9: `b0c70f66` — `Temario.astro` (161 l.) clasifica líneas en h2/li/dt/p sin set:html; `[slug].astro` (145 l.); build **304 páginas**, check 0/0/0, `dist/cursos` = **303** rutas, **302** enlaces internos y **0** externos en el catálogo; spot-check guitarra: 1 h1, 21 li, dt de modalidades, breadcrumb con `aria-current`, CTA `/#comunidad`. Pendiente T10: anclas del Header (`#cursos`) muertas en detalle.
- T10: `355970db` — `CourseCard.astro` (127 l.), grid 1/2/3 cols, tarjeta = título (clamp 2) + nº de temario + hasta 3 chips de la línea de palabras clave real (274/302 con chips, 253 con contador; **0 inventados**); contador vivo `N de 302 cursos` + estado vacío; sin JS se ve la lista completa y el contador es cierto; Header con anclas root `/#…` (arregladas en detalle); gates: build 304, check 0/0/0, 303 rutas, 302 enlaces internos, 0 `<p>`/externos en tarjetas.
- T11: tests **45/45** (RED→GREEN en extractor y en el filtro); campos CMS `thumbnail`/`videoId`/`thumbnailAlt` en frontmatter (alt siempre presente, editable desde panel); **471 miniaturas reales** (265 prixline.wordpress.com + 94 i.ytimg.com + 37 i0.wp.com + CDN varios) y **0 gravatar** tras el filtro de avatares (clase `avatar`, host gravatar, `s≤128`, escaneo que continúa hasta la primera imagen útil — decisión del padre tras el flag del worker: 623→471); `videoId` 94; home: 6 imgs lazy i.ytimg, 0 src vacío; build/check 0, 303 rutas.
- T12: tests **58/58** (13 nuevos, RED→GREEN, fixture RSS capturado `scripts/fixtures/youtube-feed.xml`); canal `UCcEX40UDEqB3a_6o9j0NozQ` resuelto desde `externalId` (la página no trae `"channelId":"UC…"`); `content/settings/videos.json` con **12 vídeos** (CMS-editable, 12/12 thumbs i.ytimg); componente con grid de 6, fallback si vacío, badge EN VIVO intacto, **0 ids hardcodeados** en `.astro`; build offline (sin fetch en build); gates: build 304 páginas, check 0/0/0, 303 rutas.

- Commits por tarea: (se rellena al cerrar)
