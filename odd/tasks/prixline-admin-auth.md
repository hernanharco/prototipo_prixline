# Prixline Admin Auth + Cierre CMS (fase 8)

El admin de Keystatic (`/admin`, `/keystatic`) se protege con el login de
authCore de tu ecosistema (`core/auth/AUTH-FLOW.md`, patrón spoke ya
validado en CafeMiTierra); Keystatic conserva `storage: github`, que pide
autorización de GitHub sólo la primera vez por navegador.

Documento consolidado de TODO lo que queda abierto del proyecto
(CMS, hardening y pendientes de producto), para cerrarlo por partes.

## Specs

- **S1** — "este proyecto debe loguearse para ver el CMS/admin se debe
  loguear por medio de authcore. mantener mi ecosistema
  /home/harco/Documentos/elrincondeharco.com/core"
- **S2** — "enlistemos todas estas tareas y arrancamos. cuando tengamos
  las tareas listas."
- **S3** — Decisión del usuario sobre el login (2026-10-05): opción
  "authCore + GitHub (1ª vez)": middleware protege `/keystatic`, `/admin`
  y `/api/keystatic` con el JWT RS256 de authCore (Google OAuth);
  `storage: github` se mantiene y GitHub pide autorizar una sola vez por
  navegador.
- **S4** — Riesgos de T27 a resolver ANTES de cualquier escritura live
  (verbatim de `odd/tasks/prixline-cms.md`): "`fields.date` truncaría la
  hora al guardar (solo fecha en el frontmatter actual), y `slugField`
  hace que Keystatic omita la key `slug` del frontmatter al guardar
  mientras el schema de Astro la exige".
- **S5** — T28 (verbatim): "GitHub storage + media: `storage: github` con
  env vars, media store apuntando a un directorio del repo, y guía de los
  pasos del usuario (crear OAuth App de GitHub + variables en Vercel y en
  dev local)."
- **S6** — T29 (verbatim): "Cierre: verificación completa (build 1.120,
  check 0, tsc 0, tests 106+13, `/admin` 200), doc de uso ("cómo editar
  en /admin" + advertencia de no re-ejecutar importadores), review
  nativa, evidencia."
- **S7** — T19 (verbatim): "Secrets de Vercel (usuario): `gh secret set
  VERCEL_TOKEN` (token de dashboard "No expiration"). **Pendiente.**"
- **S8** — T20 (verbatim): "Pendiente de producto (decisión del usuario):
  key de YouTube (`PUBLIC_YOUTUBE_API_KEY`) para encender el badge EN
  VIVO."
- **S9** — Pendientes de producto heredados (verbatim de
  `prixline-hardening.md`): "546 posts `sin-categoria`, opiniones/tawk.to
  sin cablear".

## Tasks

| ID | S# | Tarea | Route | Commit |
|----|----|-------|-------|--------|
| T1 | S4 | Arreglar riesgos T27 (`fields.date` sin truncar hora, `slugField` vs key `slug` exigida por Astro) test-first, con reader smoke + build | inline test-first | |
| T2 | S1,S3 | Verificador JWT RS256 puro (`site/src/lib/authcore.ts`: fetch/cache JWKS, iss/exp/aud) + tests `node --test` | inline test-first | |
| T3 | S1,S3 | Middleware Astro: `/keystatic`, `/admin`, `/api/keystatic` exigen cookie JWT válida → redirect `/admin/login` | writer (seguridad) + verify | |
| T4 | S1,S3 | `/admin/login` (botón "Continuar con Google" → `{AUTHCORE_URL}/api/v1/auth/google?redirect_to={origin}/auth/callback`) + `/auth/callback` (cookie + redirect al admin), patrón CafeMiTierra | writer + verify | |
| T5 | S1,S3 | Adapter SSR de producción (hoy `keystaticDevOnly` + static) para publicar `/admin` en Vercel + env vars `AUTHCORE_*` en dev y Vercel | writer | |
| T6 | S3,S5 | `storage: github` + media store en el repo + guía de pasos del usuario (OAuth App / GitHub App, `KEYSTATIC_*`, 1er login GitHub tras authCore) | inline + guía | |
| T7 | S1 | Smoke live: guardar una vez desde `/admin` y verificar `git diff content/` | inline (humano asiste) | |
| T8 | S6 | Cierre T29: build 1.120+ / check 0 / tsc 0 / tests / `/admin` 200 con login, doc "cómo editar en /admin" + advertencia de no re-ejecutar importadores, review nativa, evidencia | verify | |
| T9 | S7 | **[usuario]** `gh secret set VERCEL_TOKEN` (sin expiración) | blocked: usuario | |
| T10 | S8 | **[usuario]** key `PUBLIC_YOUTUBE_API_KEY` para el badge EN VIVO | blocked: usuario | |
| T11 | S9 | Pendiente de producto: 546 posts `sin-categoria` — decidir categorización (Ask) | pending decisión | |
| T12 | S9 | Pendiente de producto: opiniones / tawk.to sin cablear (Ask) | pending decisión | |

Orden de ejecución: T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8.
T9–T10 en paralelo (son tuyos); T11–T12 esperan decisión.

## Log

- **L1** — "enlistemos todas estas tareas y arrancamos. cuando tengamos
  las tareas listas. este proyecto debe loguearse para ver el CMS/admin se
  debe loguear por medio de authcore. mantener mi ecosistema
  /home/harco/Documentos/elrincondeharco.com/core"
- **L2** — Decisión del usuario (ask 2026-10-05): login admin =
  "authCore + GitHub (1ª vez)".
