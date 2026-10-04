# Prixline Exit Links (fase 5 — cero salida al blog)

Objetivo: que ningún enlace de navegación ni ningún medio haga salir al
visitante de nuestro sitio hacia el blog viejo (prixline.blog /
prixline.wordpress.com).

Auditoría de partida (dist, 1.120 páginas):

- Footer "Sitio original de Prixline" → `prixline.blog/` — 1.119 páginas
  (`Footer.astro:47`, `siteSettings.originSite`).
- Footer "Opiniones de los alumnos" → `prixline.wordpress.com/opiniones/`
  — 1.120 páginas (canal `opiniones` de `content/settings/social.json`).
- Pie "Fuente: …" en detalle de artículo — 813 páginas
  (`articulos/[slug].astro:126`, `originUrl`).
- Pie "Fuente: …" en ficha de curso — 302 páginas
  (`cursos/[slug].astro:89`, `sourceUrl`).
- Links viejos embebidos en cuerpos importados (~7 páginas): prácticas,
  cursos, contacto, `2012/…/ingles`, `img_4553`, ⚠️ **2 URLs `wp-admin/
  post.php` públicas** (URL de edición de WP de Luis — filtración).
- 567 imágenes hotlink a `…/wp-content/uploads/…` del blog en 283 páginas
  (+ imágenes en hosts de terceros, fuera de alcance por ahora).

## Decisiones del usuario (2026-10-04)

1. **Fuente**: el `href` del pie pasa a `https://www.rincom.es/` (página
   personal del usuario). El texto visible se mantiene.
2. **Footer**: "Sitio original" y "Opiniones" quedan como **texto sin
   enlace** en las 1.120 páginas.
3. **Imágenes**: sí migrar las 567 del blog al sitio (tarea nueva).

Fuera de alcance: imágenes de hosts de terceros (portalparados.es, etc.),
traer el hilo de comentarios a interno, CMS.

## Tareas

- [x] T22. `Fuente` → `href="https://www.rincom.es/"` en
      `articulos/[slug].astro` y `cursos/[slug].astro` (+
      `practicas/index.astro` por paridad, hecho en T24); 1.115 enlaces a
      rincom.es en dist. — commit `0f7d3b0d`
- [x] T23. Footer sin enlaces salientes: "Sitio original" y "Opiniones"
      como texto plano (sin `<a>`) en las 1.120 páginas. — commit
      `f1c1fdbf`
- [x] T24. Cuerpos importados: reescritura de URLs internas del blog
      viejo a rutas internas + disolución de anclas `wp-admin` (host-
      agnóstico) en `sanitizeArticleHtml`, y línea de opiniones de
      `/contacto/` sin enlace. Enfoque: transformación en build vía
      saneador (productor de render), sin regenerar `content/`. — commit
      `6ef90807`
- [x] T25. Migración de imágenes: bajadas las imágenes del blog a
      `site/public/media/` desde el importador (test-first en `media.ts`:
      mapeo URL→ruta + reescritor; I/O en `media-io.ts` con
      skip-if-exists y fallo por imagen que conserva la URL original),
      `content/` regenerado por los productores. — commit `b22a3f9c`

## Criterios de aceptación

- `grep href=` en `site/dist`: **0** enlaces a `prixline.blog` y **0** a
  `prixline.wordpress.com` (navegación); imágenes: 0 `wp-content` del blog.
- Ninguna URL `wp-admin` en dist.
- Tests en verde (76+13, más los nuevos de T24/T25); build 1.120 páginas,
  check 0/0/0, tsc 0, ningún archivo >400 líneas.
- Un commit por tarea en la rama feature.

## Evidencia

- T22: `0f7d3b0d` — build 1.120, check 0; dist: **1.115** `href` a
  `https://www.rincom.es/` (813 artículos + 302 cursos), pies con texto
  visible "prixline.blog" sin salir al blog.
- T23: `f1c1fdbf` — dist: **0** `href` a `prixline.blog` y **0** a
  `opiniones` desde el footer en las 1.120 páginas.
- T24: `6ef90807` — RED 27/33 → GREEN **33/33** (triangulación 35/35),
  suite scripts **85/85**, lib **13/13**; build 1.120, check 0/0/0, tsc 0;
  dist: **0** `href` a `prixline.blog`, **0** a `prixline.wordpress.com`,
  **0** `wp-admin` (incluye una ancla `wp-admin` de terceros disuelta);
  813/814 slugs reescritos resuelven a rutas construidas. Conocido:
  `/articulos/escuelas-de-ingles-prixline/` queda como interna rota (el
  slug no está en el corpus importado). Fuera de alcance intactos:
  `opiniones.wordpress.com` (2, tercero) y `prix.com` (2).
- T25: `b22a3f9c` — RED `ERR_MODULE_NOT_FOUND` → GREEN **16/16** en
  `media.test.ts` + **5/5** offline en `media-io.test.ts`; suite scripts
  **106/106**, lib **13/13**. Regeneración por productor:
  `pipeline:posts` → 813 archivos (325 URLs → 272 descargadas, 0 fallos),
  `pipeline:pages` → 4 (extractedAt preservado); recuentos 813/4/302
  intactos; 272 archivos (30 MB) en `site/public/media/`.
  dist: **0** peticiones de imagen a `prixline.wordpress.com`/`prixline.blog`,
  **539** `src="/media/..."` (272 únicos, spot-checks OK);
  build 1.120, check 0/0/0, tsc 0; todos los archivos <400 líneas.
  **Decisión A** (conflicto de criterio resuelto): el grep literal de
  `wp-content` queda en **28** srcs de **hosts de terceros**
  (i0.wp.com ×16, ticsyformacion ×4, trabajarporelmundo ×4,
  ristomejide ×2, elblogdelinkedin ×2) — exímente fuera de alcance en el
  doc; ampliarlos = opción B (pendiente opcional). Remanentes inertes
  `data-orig-file`/`data-permalink` (57, sin peticiones) quedan por diseño.
