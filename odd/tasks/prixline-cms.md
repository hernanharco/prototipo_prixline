# Prixline CMS (fase 7 — Keystatic sobre content/)

Objetivo: poder editar el contenido en vivo desde un admin en el propio
sitio, sin backend propio y sin salir del repositorio como fuente de
verdad.

## Decisiones del usuario (2026-10-04)

1. **Motor**: **Keystatic** (git-based, `/admin` dentro del sitio, edita
   `content/` como commits a GitHub → Vercel Git redespliega solo).
   Cero backend, cero base de datos. Descartados: Decap (editor md
   deprecado), patrón propio LANDING-CRM (backend Hetzner a mantener,
   pensado para `business.json`), Sanity (migraría el contenido fuera
   del repo).
2. **Alcance**: **total** — ajustes (`settings/*.json`), editar
   frontmatter y cuerpo de los 813 artículos y 302 cursos, y **crear
   contenido nuevo** desde el admin.
3. **Incidente** `gentle-ai-verify`/`gentle-ai-explore`: crear issue en
   `Gentleman-Programming/gentle-ai` (decisión del usuario).

## Contexto técnico (verificado)

- `content/`: `posts/` (813 .md con frontmatter + cuerpo HTML),
  `courses/` (302 .md, temario), `pages/` (4 .md), `settings/`
  (social.json 13 canales, site.json, videos.json).
- El cuerpo de posts se renderiza con `set:html` + saneador en build →
  el campo de cuerpo debe editarse como **HTML crudo** (textarea/código),
  nunca con un editor richtext que reescriba el HTML.
- Deploy: Vercel Git (push a `main` ⇒ build ⇒ prod), sin Actions.
- **Advertencia de convivencia**: re-ejecutar `pnpm pipeline:posts|pages`
  regenera `content/` desde WordPress y pisaría ediciones hechas en el
  admin. Documentar que, una vez adoptado el CMS, los importadores NO se
  re-ejecutan sobre contenido ya editado (el origen es estático).
- Auth de escritura: GitHub storage de Keystatic requiere OAuth App de
  GitHub (client id/secret) → acción del usuario; el modo `local`
  (storage local en dev) sirve para desarrollo sin OAuth.
- Política: archivos <400 líneas (el config de Keystatic se parte en
  módulos de esquema), TS estricto, tests del pipeline intactos.

## Tareas

- [x] T26. Spike: `@keystatic/core@0.6.9` + `@keystatic/astro@6.0.0`,
      config base con `storage: local` y los **settings** (3 singletons
      JSON con todos los campos reales de `content/settings/*.json`),
      ruta `/admin` (redirect a `/keystatic`, que es donde Keystatic
      monta su UI). **Veredicto del camino crítico**: local storage NO
      alcanza `../content/` (rechazado por `getIsPathValid`), pero las
      rutas inyectadas resuelven contra `process.cwd()` → solución
      oficial: dev desde la raíz con `pnpm dev:site` (`astro dev --root
      site`) + rutas repo-relative en el config; dos shims mínimos en
      `astro.config.mjs` (resolveId de `virtual:keystatic-config` +
      `optimizeDeps.exclude`) resuelven el anclaje a cwd y el módulo
      virtual `astro:env/server`. Overrides custom eliminados. — commit
      de T26
- [ ] T27. Colecciones: `posts` (813, frontmatter completo + cuerpo
      HTML crudo), `courses` (302), `pages` (4). Esquemas en módulos
      separados (<400 líneas). Verificar en dev que `/admin` lista
      entradas y abre el formulario de una entrada de cada colección.
- [ ] T28. GitHub storage + media: `storage: github` con env vars,
      media store apuntando a un directorio del repo, y guía de los pasos
      del usuario (crear OAuth App de GitHub + variables en Vercel y en
      dev local).
- [ ] T29. Cierre: verificación completa (build 1.120, check 0, tsc 0,
      tests 106+13, `/admin` 200), doc de uso ("cómo editar en /admin" +
      advertencia de no re-ejecutar importadores), review nativa,
      evidencia.
- [x] T30. Issue en `Gentleman-Programming/gentle-ai` por
      `gentle-ai-verify`/`gentle-ai-explore` rotos, con evidencia de la
      reproducción de esta sesión + historial.
      **Hecho**: issue **#5259** creado con el form `bug_report.yml`
      (búsqueda de duplicados sin coincidencias, preflight con evidencia
      + afirmación del usuario, body con privacy scan limpio, read-back
      confirmado OPEN). Labels del form (`type:bug`,
      `status:needs-review`) NO aplicados: mutación post-publicación
      rechazada autoritativamente (`AddLabelsToLabelable` sin permiso
      para `hernanharco`) → `no_write`, sin reintento.

## Criterios de aceptación

- `/admin` desplegado en `prixline.rincom.es/admin/` (o ruta equivalente)
  y accesible; en dev, edición local de settings/post/cours funcionando.
- Ningún archivo >400 líneas; tsc 0; build/check 0; tests intactos.
- El flujo documentado: editar en `/admin` → commit → push → Vercel
  redespliega.
- Un commit por tarea en la rama feature.

## Evidencia

- T26: build **1.121 páginas**, check 0/0/0, tsc 0, tests **106/106 +
  13/13**. Dev con `pnpm dev:site` (repo root): `/keystatic` 200,
  `/admin` 200, `/api/keystatic/tree` 200 con
  `content/settings/{site,social,videos}.json` (1.661 entradas), blob
  byte-idéntico (git-blob sha1 verificado), 0 ERROR en log. Escritura
  live pendiente de smoke (paso humano/T27): guardar una vez desde el
  admin y ver `git diff content/settings`. Nota: `cd site && astro dev`
  (workflow viejo) deja la UI viva pero la API base en `site/` →
  singletons vacíos; el comando correcto es `pnpm dev:site` desde la
  raíz. Storage github (T28) exigirá env vars
  `KEYSTATIC_GITHUB_CLIENT_ID/SECRET`, `KEYSTATIC_SECRET`,
  `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` + adapter SSR en producción.
- T27: (se rellena al cerrar)
- T28: (se rellena al cerrar)
- T29: (se rellena al cerrar)
- T30: issue **#5259**
  (https://github.com/Gentleman-Programming/gentle-ai/issues/5259) —
  repro fresca 2026-10-04 (`muuczlhn-5-i0mh`: `gentle-ai-verify`,
  4 turns, **0 tool calls**, `assistant reported an error`) + historial
  2026-10-03/04 + contraste `gentle-ai-worker` OK. Form `bug_report.yml`
  (labels declarados `type:bug`/`status:needs-review`), duplicados
  descartados (#5254, #2609 son otros síntomas), privacy scan limpio,
  read-back OPEN confirmado. Labels: `no_write` (permiso insuficiente
  de `hernanharco` en la repo).
