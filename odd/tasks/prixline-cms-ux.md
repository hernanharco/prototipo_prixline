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
- **S5** — UI con la paleta de la web (petición del usuario, Log L4,
  verbatim): *"este diseño no me gusta … podemos mejorar la UI manejar
  una paleta de colores mucho mejor, una que sea acorde con la pagina
  web. siento muy basico este CMS"*. Alcance (Ask, opción C = A+B):
  **marca + paleta**: (A) `ui.brand.mark` con monograma navy+oro (soporte
  oficial de Keystatic) y (B) capa CSS propia — helper + middleware — que
  recolorea sidebar/header/accentos con la paleta de `global.css` (navy
  `#12314f`, navy profundo `#0c2339`, oro `#c8a24a`, fondo `#f7f8fa`).
  Deuda declarada: Keystatic NO expone theming (0 variables CSS en su
  bundle, estilos Emotion con clases hasheadas) ⇒ selectores
  estructurales estables + re-check en cada upgrade.

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
- **T8** — [S5] Marca Prixline: `site/keystatic/brand.ts` con monograma
  SVG (navy+oro, invertido en dark) vía `createElement` (el config es
  `.ts`, sin JSX) + `ui.brand.mark` + test del elemento raíz.
- **T9** — [S5] Paleta: `site/src/lib/cmsPalette.ts` (CSS +
  `injectPaletteHtml`, test-first) + middleware que inyecta la hoja en
  el HTML de `/keystatic*` (200 text/html sólo; API y resto intactos).
- **T10** — [S5] Verificación: `astro check` + suite + build + E2E
  visual en prod (captura del usuario) + evidencia en `## Log`.

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
- **L3** — **Delivery** (2026-10-14, decisión del usuario = "Sí, merge +
  push ahora"): merge fast-forward `feat/prx-cms-ux` → `main`
  (`fd63035e..c9e8d88d`, 746 ficheros, +1.275/−613) y push. Vercel Git
  redespliega: deployment `webprixline-aa3nmzrpt` **Ready en 40s**,
  aliased a `prixline.rincom.es`. **Verificación en vivo**: `/articulos/`
  200 con **265/265** thumbnails canónicos y **0** rutas viejas YYYY/MM;
  imagen de prueba servida `200 image/jpeg 79960b`;
  `/media/uploads/100-becas-para-alumnos-de-fp/thumbnail.jpg` OK;
  marker de home presente; `/keystatic` → 302 `/admin/login` (gate
  intacto). Pendiente: E2E de subida real desde el CMS (T6).
- **L4** — Petición del usuario (2026-10-14) verbatim: *"este diseño no
  me gusta … podemos mejorar la UI manejar una paleta de colores mucho
  mejor, una que sea acorde con la pagina web. siento muy basico este
  CMS"*. Investigación (sólo lectura): Keystatic 0.6.9 no expone
  theming — 0 variables CSS en todo `@keystatic/core/dist`, estilos
  Emotion con clases hasheadas, doc Keystar: "internal component styles
  … not available to override"; lo único oficial es `ui.brand` (name +
  mark). Ask → usuario eligió **C: Marca + paleta (A+B)**. Tareas
  nuevas T8-T10; T6 queda blocked en el E2E de subida de imagen.
- **L5** — **T8-T10 implementados** (2026-10-14, rama `feat/prx-cms-ux`,
  2 commits): `4a350697` T8 — monograma SVG navy+oro en
  `site/keystatic/brand.ts` (`createElement` porque el config es `.ts`;
  inverso en dark) cableado como `ui.brand.mark`, test
  `site/scripts/keystatic-brand.test.mjs` **2/2** · `d0e44b62` T9 — hoja
  `site/src/lib/cmsPalette.ts` (paleta idéntica a `global.css`) +
  `injectPaletteHtml`/`shouldInjectPalette` inyectados por el middleware
  sólo en respuestas **200 text/html de `/keystatic\*`** (API y resto del
  sitio intactos), test-first `cmsPalette.test.mjs` **3/3**. Ganchos:
  selectores estructurales (`<nav>`, `aria-current`, `header`, `main`,
  `a`, `:focus-visible`) — nunca clases Emotion hasheadas como ancla;
  si un selector no existe en un upgrade, la regla se ignora (degradado
  silencioso, re-check declarado como deuda). **Fallo encontrado y
  corregido en T9**: el literal del id duplicado en el comentario del
  CSS rompía la idempotencia del test. **Checks**: `astro check`
  0/0/2 · site/lib **43/43** · site/scripts **5/5** · raíz **138/138** ·
  `astro build` OK (52s). Pendiente: E2E visual en prod (captura del
  usuario) + cierre.
