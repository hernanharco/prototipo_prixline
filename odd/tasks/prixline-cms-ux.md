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
- **L2** — Implementación y verificación locales (2026-10-14, rama
  `feat/prx-cms-ux`, 6 commits): `ea6cb10f` T1 (locale es-ES, marca
  Prixline, sidebar Contenido/Ajustes del sitio, labels sin sufijo
  .json) · `979baeb8` T2 (columns + previewUrl {slug} en las 3
  colecciones) · `16d43c7a` T3 (labels + descriptions en español de
  todos los campos; helpers con `description`) · `ddc00bc6` T4
  (posts.thumbnail → fields.image + contrato de guardado con soporte
  asset/object — arregla además un fallo PREEXISTENTE de pages/contact)
  · `101856ac` doc · `36dd275e` T5 (migración). **Contrato fijado con
  sondas + doc oficial**: valor = `publicPath + slug + '/' + fichero` y
  disco = `directorio/<slug>/thumbnail.<ext>`; los valores viejos
  parsean a basura con el slug presente (`/media/uploads/2017/11/x.jpg`
  → `"pg"`), por eso la migración era obligatoria. **Migración real**:
  265 migradas · 206 descartadas (142 https + 64 http; S4 del usuario)
  · 0 missing · 342 intactas; 2ª pasada 0/0/0/813 (idempotente);
  cirugía textual de la línea `thumbnail:` (sin roundtrip YAML); los
  binarios origen NUNCA se borran. **Checks**: `astro check` 0 errores/
  0 warnings (2 hints) · suite raíz **138/138** · site/lib **40/40** ·
  contrato de guardado **3/3** · reader smoke **813/302/4 OK** (su
  expectativa de thumbnail pasó a `string|null` canónico, consecuencia
  directa de S4) · `tsc --noEmit` raíz 0 · `astro build` OK (140s) ·
  paridad en `.vercel/output/static`: **265/265** thumbnails canónicos
  en `/articulos/` y **0** rutas viejas YYYY/MM, marker de home, metas
  813 y tawk intactos, **265** imágenes copiadas al build. Pendiente:
  E2E en prod (T6) + delivery (T7, decisión del usuario).
