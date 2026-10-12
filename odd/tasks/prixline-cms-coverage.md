# Prixline CMS Coverage — singletons editables + guardado en prod (fase 10)

La auditoría de cobertura (gentle-ai-explore `mv5g3lu6-2-pi0v`, sólo
lectura) mapeó qué gestiona hoy el CMS y qué está hardcodeado. Este
documento cubre: (1) dejar el CMS **guardable** en producción y (2)
llevar al CMS lo que el cliente quiere editar de la página.

Toca un repo: `webprixline` (este). El admin gate contra authCore ya
funciona (fase 9, `odd/tasks/prixline-authchain.md`).

## Auditoría (resumen — evidencia `path:line` en el reporte del explore)

- **Ya en CMS**: 813 posts, 302 cursos (+`family`), 4 pages, singletons
  `site` (sólo `tagline` y `live.*` se leen), `social` (13 canales),
  `videos`. Páginas que leen del CMS: home, índices y detalles de
  cursos/artículos, prácticas, footer/hero/community/youtube.
- **Hardcodeado**: nav del header (`Header.astro:11-16`), wordmark,
  labels de CTA, hero (`Hero.astro:9-20`), **orden y títulos de las 7
  secciones de la home** (`index.astro:55-65`), copy de secciones
  (`LatestArticles`, `Courses`, `YoutubeChannel`, `Practices`,
  `Community`), labels de Trust, copy y **property de tawk.to**
  (`contacto/index.astro:26-28,86-115`), `title`/meta de los índices,
  © legal y enlaces del footer (`Footer.astro:25-50`).
- **Huérfanos**: `content/pages/{contacto,opiniones,redes}.md` — nadie
  los lee (`Practices.astro:13` sólo consume `practicas`).
- **Guardado en prod**: Vercel Production sólo tiene
  `AUTHCORE_JWKS_URL` + `AUTHCORE_JWT_ISSUER` → storage **local**
  (efímero); `site/ADMIN-SETUP.md` documenta el camino github.

## Specs

- **S1** — Alcance (decisión del usuario, Ask): *"Lo editable del
  cliente"* — 4 singletons nuevos: `nav`, `home`, `contact`, `seo`.
  Quedan fijos: colores de marca (`global.css`), badge «EN VIVO»,
  CTAs de detalle («Consultar por este curso», «Fuente» a rincom.es).
- **S2** — Huérfanas (decisión del usuario, Ask): el copy de contacto
  se **cablea desde `content/pages/contacto.md`** (editable en la
  colección `pages` del CMS); `opiniones.md` y `redes.md` se dejan
  donde están.
- **S3** — Secuencia (decisión del usuario, Ask): *primero* el CMS
  100% guardable en prod (OAuth App + env + deploy + smoke de
  guardado), *después* la cobertura.
- **S4** — Paridad: los singletons nuevos se pueblan con los valores
  actuales (seed por script, nunca `content/` a mano) → el sitio se
  ve idéntico antes de la primera edición desde el CMS.
- **S5** — Push/merge a `main` = decisión del usuario.

## Tasks

| ID | S# | Tarea | Route | Commit |
|----|----|-------|-------|--------|
| T1 | S3 | **[usuario]** OAuth App en GitHub: `Prixline admin`, homepage `https://prixline.rincom.es`, callback `https://prixline.rincom.es/api/keystatic/github/oauth/callback` (Paso 1 de `site/ADMIN-SETUP.md`) → entrega Client ID + Secret | blocked: usuario | — |
| T2 | S3,S4 | Guardado en prod: 4 env en Vercel (`PUBLIC_KEYSTATIC_STORAGE=github`, `KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`, `KEYSTATIC_SECRET` generado con `openssl rand -hex 32`) **juntas** (flag sin creds = 500 en `/api/keystatic/*`) + redeploy + smoke: login → guardar 1 setting → `git diff content/settings` → commit → deploy refleja el cambio | env + verify | `KEYSTATIC_SECRET` ya seteada (2026-10-12); el resto bloqueado en T1 |
| T3 | S1,S4 | Singleton `nav`: links del header + CTA + enlaces del footer + © legal; cablea `Header.astro`/`Footer.astro`; seed con los valores actuales | inline test-first | `e6a89dd4` |
| T4 | S1,S4 | Singleton `home`: hero (eyebrow/H1/subcopy/2 CTAs) + array de secciones `{id, título, intro, enabled}` con el orden actual (Hero→Trust→Latest→Courses→YT→Practices→Community); cablea `Hero.astro` + `index.astro` | inline test-first | `cb4245f4` |
| T5 | S1,S2,S4 | Copy de contacto desde `content/pages/contacto.md` (campos opcionales en la colección `pages` + migración **por script** del copy actual y de la property de tawk.to → frontmatter); cablea `contacto/index.astro` | inline test-first | `53117bbe` |
| T6 | S1,S4 | Singleton `seo`: `title`/meta description de home, `/cursos/`, `/articulos/` y contacto; cablea los 4 templates | inline test-first | `53117bbe` |
| T7 | S1-S5 | Verificación: tests + `build`/`check`/`tsc`, reader smoke (813/302/4 + settings), greps de paridad en `site/dist` (sin cambios visibles con seed), review nativa RDD, commits por work-unit | verify + native review | ver L4/L5 |

Orden: T1 ∥ T2 (T2 bloqueada por T1); T3-T6 en paralelo posibles
después de T2; T7 cierra. Backlog fuera de alcance (S1): colores,
badge EN VIVO (también depende de `PUBLIC_YOUTUBE_API_KEY`, T20 de
fases previas), textos de estado vacío.

## Log

- **L1** — Auditoría de cobertura con `gentle-ai-explore` (task
  `mv5g3lu6-2-pi0v`, sólo lectura): inventario CMS + gap de singletons
  + huérfanos (arriba). Confirmado: `site.name` existe en el singleton
  y **nunca se lee** (`Hero`/`Footer` usan wordmark hardcodeado);
  `content/pages/contacto.md`, `opiniones.md`, `redes.md` sin
  consumidores; Vercel Production = sólo 2 env vars.
- **L2** — Decisiones del usuario (Ask, 2026-10-12): alcance "lo
  editable del cliente" (S1); "cablear contacto desde content/pages"
  (S2); "primero habilitar el guardado" (S3).
- **L3** — Reconciliación de diseño (2026-10-12, antes de escribir
  código): S1 mencionaba 4 singletons (`nav`, `home`, `contact`,
  `seo`), pero S2 manda que el copy de contacto viva en
  `content/pages/contacto.md` → **no hay singleton `contact`**: el
  copy + la property de tawk.to van en el frontmatter de `contacto.md`
  (campos **opcionales** nuevos en la colección `pages`, visibles en
  el widget del CMS y usados sólo por esa página). Quedan **3
  singletons nuevos** (`nav`, `home`, `seo`) + la extensión de
  `pages`. Paridad (S4): seed por script idempotente
  (`scripts/seed-cms-coverage.ts`) que sólo escribe los JSON si no
  existen, con el copy EXACTO actual.
- **L4** — **T3-T6 implementados** (2026-10-12, rama `feat/prx-cms-coverage`,
  5 commits atómicos según `core/GIT-WORKFLOW.md`):
  `6585cdae` seed+helper `fillTemplate`+tests (10+4 GREEN) y los 3
  JSON sembrados + bloque `contact:` en `contacto.md` · `81c3e8a6`
  singletons en `keystatic.config.ts` + campos `contact` en el widget
  `pages` y en el schema de Astro · `e6a89dd4` nav en Header/Footer ·
  `cb4245f4` home (hero + 6 secciones con `enabled` y orden por
  `sectionOrder`) · `53117bbe` contacto desde el frontmatter (guard
  fail-loud, URLs de tawk desde `chatProperty`) y SEO de las 4
  páginas. Cableado por 3 workers gentle-ai paralelos con superficies
  disjuntas (nav / home / contacto+seo), cada uno con relectura propia
  y spot-check del padre.
  **T7 evidencia**: `astro check` 0 errores/0 warnings (2 hints) ·
  `astro build` completo (Vercel adapter) · suite raíz **132/132** ·
  `tsc --noEmit` raíz 0 · greps de paridad en `site/dist/client`:
  **18/18** strings de home + **10/10** de contacto/cursos/articulos
  (títulos, metas con los recuentos vivos 11/302/813, id de tawk) y el
  orden de secciones en el HTML = `sectionOrder` (trust→migracion→
  cursos→ytband→practicas→comunidad). Única divergencia de bytes: 4
  párrafos que en el template estaban partidos a varias líneas salen
  ahora en una línea del JSON — render idéntico tras el colapso de
  whitespace de HTML. Review nativa RDD: ver L5.
- **L5** — Review nativa RDD (2026-10-12): linaje
  `review-8280312ed90efac2`, target `sha256:9f5f6623…` (rango commiteado
  `main..feat/prx-cms-coverage`, 25 ficheros / 1.210 líneas), tier
  **medium** (`configuration_change` en `content/settings/home.json`),
  4 lentes (risk/resilience/readability/reliability) ejecutadas como
  grupo materialize vía pi host relay (forecast 4 runs, autorizados).
  **OUTCOME: approved + acknowledged → `authority: burned`**
  (`native-approved-acknowledgement-completed`). Un incidente de
  proceso: el primer intento de START quedó sin `baseRef` (candidato
  vacío = todo commiteado → el rango es `baseRef=5d03ad91 +
  committed-only`) y el consentimiento caducó a los 10 min → re-START
  con consentimiento fresco.
  **10 hallazgos advisories (informativos, ninguno bloquea ni reabre,
  backlog aparte)**: readability R2 — campos de contacto listados 4
  veces (`contacto/index.astro:34-58`), cadena de dispatch por id de
  sección (`index.astro:82-97`), rationale obsoleto del suite de
  paridad (`cms-coverage.test.ts:5-7`), dos switches de presencia de
  sección (`keystatic.config.ts:161-175`), línea de run fantasma del
  seeder (`cms-coverage.ts:14`), aserción de nav suelta en el test del
  hero (`cms-coverage.test.ts:45`); resilience R4 — `index.astro:70,57`
  (orden/sectionOrder) y `cms-coverage.ts:185` (CLI); reliability R3 —
  `index.astro:73`.
