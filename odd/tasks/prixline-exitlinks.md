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

- [ ] T22. `Fuente` → `href="https://www.rincom.es/"` en
      `articulos/[slug].astro` y `cursos/[slug].astro`; verificar en dist
      que quedan 1.115 enlaces a rincom.es y 0 a `prixline.blog` en esos
      pies.
- [ ] T23. Footer sin enlaces salientes: "Sitio original" y "Opiniones"
      como texto plano (sin `<a>`) en las 1.120 páginas.
- [ ] T24. Cuerpos importados: corregir en el **productor**
      (`scripts/` + saneador) — reescribir URLs internas del blog viejo a
      rutas internas (`/practicas/`, `/cursos/`, `/contacto/`,
      `/articulos/[slug]/` cuando el slug mapea), **desenlazar/quitar**
      toda URL `wp-admin/`, regenerar `content/` y rebuild. Nunca editar
      `content/` a mano.
- [ ] T25. Migración de imágenes: bajar las 567 imágenes del blog a
      `site/public/media/` desde el importador (test-first en el mapeo
      URL→ruta y en el reescritor; descarga con verificación de
      existencia), re-apuntar `src` en los cuerpos, regenerar, verificar
      0 `wp-content` en dist.

## Criterios de aceptación

- `grep href=` en `site/dist`: **0** enlaces a `prixline.blog` y **0** a
  `prixline.wordpress.com` (navegación); imágenes: 0 `wp-content` del blog.
- Ninguna URL `wp-admin` en dist.
- Tests en verde (76+13, más los nuevos de T24/T25); build 1.120 páginas,
  check 0/0/0, tsc 0, ningún archivo >400 líneas.
- Un commit por tarea en la rama feature.

## Evidencia

- T22: (se rellena al cerrar)
- T23: (se rellena al cerrar)
- T24: (se rellena al cerrar)
- T25: (se rellena al cerrar)
