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
| T1 | S4 | ~~Arreglar riesgos T27~~ `fields.date` sin truncar hora, `slugField` vs key `slug` + textos vacíos — test-first | inline test-first | `997884f1` |
| T2 | S1,S3 | Verificador JWT RS256 puro (`site/src/lib/authcore.ts`: fetch/cache JWKS, iss/exp/aud) + tests `node --test` | inline test-first | `bd5a6e09` |
| T2b | S1 | Review nativa RDD del rango commiteado de T2 (`d6364889..a274bda9`) | native review | `review-c3636f88b79047ff` (approved/ack) |
| T3 | S1,S3 | Middleware Astro: `/keystatic`, `/admin`, `/api/keystatic` exigen cookie JWT válida → redirect `/admin/login` | verify (seguridad) + inline | `2010e508` |
| T4 | S1,S3 | `/admin/login` (botón "Continuar con Google" → `{AUTHCORE_URL}/api/v1/auth/google?redirect_to={origin}/auth/callback`) + `/auth/callback` (cookie + redirect al admin), patrón CafeMiTierra | verify + inline | `45bd166f` |
| T5 | S1,S3 | Adapter SSR de producción (hoy `keystaticDevOnly` + static) para publicar `/admin` en Vercel + env vars `AUTHCORE_*` en dev y Vercel | writer | |
| T6 | S3,S5 | `storage: github` + media store en el repo + guía de pasos del usuario (OAuth App / GitHub App, `KEYSTATIC_*`, 1er login GitHub tras authCore) | inline + guía | |
| T7 | S1 | Smoke live: guardar una vez desde `/admin` y verificar `git diff content/` | inline (humano asiste) | |
| T8 | S6 | Cierre T29: build 1.120+ / check 0 / tsc 0 / tests / `/admin` 200 con login, doc "cómo editar en /admin" + advertencia de no re-ejecutar importadores, review nativa, evidencia | verify | |
| T9 | S7 | **[usuario]** `gh secret set VERCEL_TOKEN` (sin expiración) | blocked: usuario | |
| T10 | S8 | **[usuario]** key `PUBLIC_YOUTUBE_API_KEY` para el badge EN VIVO | blocked: usuario | |
| T11 | S9 | Pendiente de producto: 546 posts `sin-categoria` — decidir categorización (Ask) | pending decisión | |
| T12 | S9 | Pendiente de producto: opiniones / tawk.to sin cablear (Ask) | pending decisión | |
| T13 | — | Backlog advisory T2b (no bloqueante): timeout/AbortSignal al fetch del JWKS, dedup de refetch en vuelo, distinguir fallo upstream (5xx) de token inválido (401), validar scheme de `AUTHCORE_JWKS_URL`, exigir `AUTHCORE_JWT_ISSUER` en T5, test del cache-hit | pendiente | |

Orden de ejecución: T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8.
T9–T10 en paralelo (son tuyos); T11–T12 esperan decisión.

## Log

- **L1** — "enlistemos todas estas tareas y arrancamos. cuando tengamos
  las tareas listas. este proyecto debe loguearse para ver el CMS/admin se
  debe loguear por medio de authcore. mantener mi ecosistema
  /home/harco/Documentos/elrincondeharco.com/core"
- **L2** — Decisión del usuario (ask 2026-10-05): login admin =
  "authCore + GitHub (1ª vez)".
- **L3** — Evidencia T1 (2026-10-05), commit `997884f1`: test RED
  observado (3/3 colecciones rompían el contrato: fecha truncada en las
  1.119, `slug` borrado en las 1.119, `excerpt` 170 y `thumbnailAlt` 813
  borrados) → fixes en `site/keystatic/helpers.ts` (`isoDateField`,
  `persistText`, `slugKeyField`) usados por las 3 colecciones → GREEN
  3/3 (`site/scripts/keystatic-save.test.mjs`, corpus completo).
  Verificación: reader smoke 813/302/4 cuerpos byte-idénticos, tests
  106/106 + 13/13, `tsc` 0, `astro check` 0 errores, build **1.121**
  páginas. Descubierto además (más allá de S4): los strings vacíos
  (`title`/`excerpt`/`thumbnailAlt`) también se borraban al guardar y
  romperían `z.string()` — cubierto por `persistText`.
- **L4** — Evidencia T2 (2026-10-09), commit `bd5a6e09`:
  `site/src/lib/authcore.ts` (verifyToken RS256: forma → algoritmo →
  firma vía JWKS con caché por URL/TTL 10 min + refetch único ante kid
  desconocido → iss/aud/exp; `AuthCoreVerifyError` para el 401 del
  middleware; `verifyOptionsFromEnv` para el contrato `AUTHCORE_*`).
  Test-first: `site/src/lib/authcore.test.mjs` RED module-not-found →
  GREEN **10/10** (válido, expirado, firma manipulada, alg none/HS256,
  issuer, audience, rotación de kid, JWKS 5xx, 6 tokens malformados sin
  fetch, mapeo de env). Verificación: tests site **23/23**,
  root **106/106**, `astro check` 0 errores. Gotcha: `TextEncoder
 .encode(ArrayBuffer)` stringifica a `"[object ArrayBuffer]"` (firma de
  20 bytes) — envolver en `Uint8Array` antes del base64url. Nota T5:
  el payload actual de authCore NO incluye `aud` (AUDITORIA) → no activar
  `AUTHCORE_JWT_AUDIENCE` sin verificar con un token real.
- **L5** — Evidencia T2b (2026-10-09): review nativa **approved** y
  acknowledge quemado (linaje `review-c3636f88b79047ff`, rango
  `d6364889..a274bda9`, 3 archivos / 490 líneas, tier **high** por
  `hot_path auth`, lentes risk + resilience + reliability, 3 corridas
  host-relay). **11 hallazgos advisories NO bloqueantes** (disposición:
  trabajo posterior por separado, nunca re-abrir esta review):
  `R1-jwks-refetch-amplification`, `R1-jwks-url-scheme-unvalidated`,
  `R1-optional-iss-aud-skipped` (iss/aud vacíos = sin validación: T5 debe
  setearlas siempre), `R3-cache-hit-unproven`,
  `R3-error-echoes-attacker-values`, `R3-jwks-unknown-kid-refetch`,
  `R3-no-inflight-jwks-dedup`, `R3-test-node-type-stripping`,
  `R4-jwks-fetch-no-deadline` (fetch sin timeout),
  `R4-jwks-refetch-unbounded`, `R4-upstream-failure-collapses-to-401`.
  Registrados como T13 (backlog).
- **L6** — Evidencia T3 (2026-10-09), commit `2010e508`: helper puro
  `site/src/lib/adminGate.ts` (public|page|api, login exento, fronteras
  exactas) + `site/src/middleware.ts` (fail-closed: sin cookie/env o
  token inválido → 302 a /admin/login en páginas, 401 JSON con
  WWW-Authenticate en la API; issuer obligatorio, audience opcional).
  Test-first RED→GREEN **6/6**; **verify independiente PASS 5/5**
  (`gentle-ai-verify` mv122epg-1-bdcw, 24 tool calls): cobertura,
  fail-closed, suites 29/29+106/106, astro check 0, sin bypass. Smoke dev
  :4322: `/keystatic` y `/admin` → 302 `/admin/login`,
  `/api/keystatic/*` → 401, `/` → 200; edge del verificador cerrado
  empíricamente: `/%6beystatic` → 302, `/%61pi/keystatic/tree` → 401,
  `/Admin` → 404. Nota del verify: en `output: static` (hasta T5) el
  middleware sólo actúa en dev/SSR.
- **L7** — Evidencia T4 (2026-10-09), commit `45bd166f`: helper puro
  `site/src/lib/authFlow.ts` (`authCoreBaseUrl`, `googleAuthUrl`,
  `parseCallbackToken`, `buildAuthCookie` anti-inyección) + páginas
  `/admin/login` (botón OAuth, estado sin-env explicativo, `?error=`) y
  `/auth/callback` (cookie token 7d sameSite=lax, secure en https,
  `location.replace` sin dejar el token en el historial →
  `/keystatic`). Test-first RED→GREEN **7/7**. Verificado: suites
  **36/36** + 106/106, `astro check` 0 errores, smoke dev con y sin
  env (`data-auth-base="https://api-authcore.rincom.es"` + botón), bug
  de path de CSS corregido en el camino (`../` → `../../`, 500 → 200),
  build estático **1.123 páginas** (incluye `dist/admin/login` y
  `dist/auth/callback`).
