# Prixline CMS UX — interfaz amigable + imágenes desde el CMS (fase 11)

El usuario entró por primera vez al CMS en producción (OAuth GitHub +
fix `allowedDomains`) y reportó que la UI no es amigable. Este documento
cubre las cuatro mejoras que eligió (Ask multiselect) y la decisión de
media (Ask). Toca un repo: `webprixline` (este).

Clasificación: **grande** (4 entregas, decisión de producto abierta
resuelta en L1, deploy pendiente).

## Specs

- **S1** — Paquete esencial (decisión del usuario, Ask): *"locale es-ES
  + marca Prixline + sidebar agrupada + labels sin sufijo .json. Todo en
  keystatic.config.mjs, bajo riesgo, impacto inmediato."*
- **S2** — Columnas + Ver en la web (decisión del usuario, Ask):
  *"columns en blog/cursos/páginas para escanear listas, y previewUrl
  con botón a la página pública por entrada."*
- **S3** — Labels de campos en español (decisión del usuario, Ask):
  *"Traducir rótulos y agregar descripciones de ayuda en todos los
  campos (home, nav, SEO, contacto, colecciones). Trabajo más mecánico y
  largo."*
- **S4** — Imágenes desde el CMS (decisión del usuario, Ask): *"Keystatic
  media: subir miniaturas/fotos desde el editor en vez de pegar URLs.
  El más grande; requiere decidir dónde viven las imágenes."* +
  alcance (Ask): *"Migración completa"* — *"Convertir thumbnail → image:
  migrar 265 rutas locales al directorio del CMS y descartar 142 URLs
  externas."* Sólo aplica a `posts` (los cursos no renderizan imagen y
  `videos.thumbnail` es URL de YouTube que se refresca sola — queda como
  campo texto).

## Tasks

- **T1** — [S1] `site/keystatic.config.ts`: `locale: 'es-ES'`, `ui.brand`
  (nombre Prixline), `ui.navigation` con secciones agrupadas, labels de
  singletons sin el sufijo `(fichero.json)`. Rama `feat/prx-cms-ux`.
- **T2** — [S2] `columns` en `posts`/`courses`/`pages` + `previewUrl`
  (`{slug}`) en las 3 colecciones y singletons con página pública.
- **T3** — [S3] labels y `description` en español de TODOS los campos:
  `site/keystatic.config.ts` + `site/keystatic/{posts,courses,pages}.ts`.
- **T4** — [S4] Schema de `posts`: `thumbnail` pasa de `fields.text` a
  `fields.image` (directory `site/public/media/uploads` + publicPath
  `/media/uploads/`). Contrato fijado con sondas y doc oficial: el valor
  serializado es `publicPath + slug + '/' + fichero` (YA es la ruta
  pública ⇒ el render de `/articulos/` NO cambia) y el disco vive en
  `directorio/<slug>/thumbnail.<ext>`. Se actualiza el contrato de
  guardado (`site/scripts/keystatic-save.test.mjs`, formKind `asset`).
- **T5** — [S4] Script de migración idempotente (test-first): 265 rutas
  locales `/media/uploads/...` → valor canonizado del campo image; 142
  URLs externas descartadas (quedan sin thumbnail); nunca toca ficheros
  binarios.
- **T6** — [S1-S4] Verificación: suite raíz + tests de site + `astro
  check` + `astro build` + paridad en `site/dist`; E2E en prod con el
  usuario (subida real de imagen desde el CMS).
- **T7** — Delivery: merge a main + push (decisión del usuario) y
  registro de evidencia en `## Log`.

## Log

- **L1** — Petición original del usuario (2026-10-14) verbatim:
  "pude ingresar … pero hay muchas cosas para mejorar el CMS no es tan
  amigable … que podemos mejorar para que la UI sea mas amigable y mejor
  experiencia". Ask multiselect → eligió LAS CUATRO opciones: "Paquete
  esencial (config)", "Columnas + Ver en la web", "Labels de campos en
  español", "Imágenes desde el CMS (media)". Ask media → eligió
  "Migración completa". Contexto: entró por primera vez al CMS en prod
  (dashboard en inglés, marca "hernanharco/…" truncada, singletons con
  sufijo "(site.json)", 813/302 entradas sin columnas, campos rotulados
  con claves de código).
