# Prixline Course Families (fase 8 — filtro por familia en /cursos/)

Objetivo: el catálogo /cursos/ permite filtrar los 302 cursos por familia
(Informática, Salud, Gestión, etc.) combinado con el buscador existente,
sobre datos reales clasificados con una tabla determinista testeada y
editable desde el CMS.

## Decisiones del usuario (2026-10-05)

1. **Origen de la taxonomía**: el usuario eligió "La propongo yo y
   clasifico" — el asistente define ~12 familias que cubren los 302
   cursos, clasifica con tabla determinista estilo `scripts/category-map.ts`
   (cobertura 100% testeada), y el campo `family` queda editable en el
   CMS (Keystatic) para correcciones posteriores por el cliente.
2. Contexto: el cliente reportó que /cursos/ "deberia tener un filtro
   que fuera por familia… informatica, salud, gestion etc…" (L1).

## Taxonomía (12 familias + otros)

| id | etiqueta UI |
|---|---|
| `informatica` | Informática y tecnología |
| `salud` | Salud y bienestar |
| `gestion` | Gestión y empresa |
| `idiomas` | Idiomas |
| `educacion` | Educación y trabajo social |
| `deporte` | Deporte y ocio |
| `diseno` | Arte, diseño y comunicación |
| `industria` | Industria, construcción y oficios |
| `belleza` | Belleza y estética |
| `hosteleria` | Hostelería y turismo |
| `seguridad` | Seguridad y protección |
| `ambiente` | Medio ambiente y agricultura |
| `otros` | Otros |

## Specs

- **S1** — En `https://prixline.rincom.es/cursos/` el cliente pide: un
  "filtro que fuera por familia… que mostrara lo que son de informatica,
  salud, gestion etc… asi para los clientes es mas facil identificar que
  cursos se imparten y si alguno le interesa". El catálogo muestra chips
  de familia (incluido "Todas") que se combinan con el buscador de texto
  existente; el contador vivo y el estado vacío reflejan ambos filtros;
  sin JS la lista completa sigue navegable (mejora progresiva, como hoy).
- **S2** — Todo curso tiene familia en datos: campo `family` en el
  frontmatter de los 302 `content/courses/*.md`, exigido por el schema de
  `site/src/content.config.ts` y expuesto como select en la colección
  courses de Keystatic (`site/keystatic/courses.ts`).
- **S3** — Clasificación determinista sin adivinanzas: tabla cerrada
  clave-slug → familia (`scripts/course-families.ts` + `family-map.ts`);
  test que fija cobertura 100% del corpus (todo slug de
  `content/courses/` está en la tabla y toda clave existe en el corpus)
  y que toda familia es de la taxonomía. `otros` solo cuando el curso no
  tiene familia clara.
- **S4** — El productor genera el campo: `scripts/apply-families.ts`
  (idempotente, re-ejecutable) escribe `family` en el frontmatter sin
  tocar nada más, y `scripts/extract-courses.ts` emite `family` al
  regenerar. Re-ejecutar el extractor sobre contenido ya editado sigue
  estando prohibido (misma advertencia que posts/páginas).
- **S5** — Cierre verificado: `node --test scripts/*.test.ts` en verde,
  `tsc --noEmit` en 0, `astro check` y `astro build` del sitio en 0,
  ningún archivo >400 líneas, work-unit commit por tarea en la rama
  feature (sin push).

## Tasks

| ID | Specs | Route | Commit |
|---|---|---|---|
| T1 | S3 | inline (juicio de clasificación) | fd985fbd |
| T2 | S4 | inline (script chico + test) | 8854e9f3 |
| T3 | S2 | inline (schema + Keystatic) | f31b61f3 |
| T4 | S1 | gentle-ai-worker (UI de filtro) | — |
| T5 | S1-S5 | inline (verificación global + cierre) | — |

## Log

- **L1** (usuario, 2026-08-… sesión actual): "Hola como estas me
  informaba el cliente que esta parte https://prixline.rincom.es/cursos/
  deberia tener un filtro que fuera por familia el ejemplo que me decia
  que mostrara lo que son de informatica, salud, gestion etc... asi para
  los clientes es mas facil identificar que cursos se imparten y si
  alguno le interesa."
- **L2** (usuario, decisión): elige "La propongo yo y clasifico" para el
  origen de la taxonomía y la asignación de los 302 cursos.
- **L3** (evidencia T1): `fd985fbd` — `scripts/family-map.ts` (taxonomía),
  `scripts/course-families.ts` (304 líneas, tabla cerrada),
  `scripts/family-map.test.ts` 6/6 verde: cobertura 302/302 slugs, cero
  claves huérfanas, 13 familias sin vacías. Distribución (recuento real
  desde la tabla): gestion 68, salud 40, industria 40, informatica 30,
  diseno 22, deporte 19, idiomas 18, educacion 18, hosteleria 14,
  ambiente 14, belleza 8, seguridad 6, otros 5.
- **L4** (evidencia T2/T3): `8854e9f3` — `scripts/apply-families.ts` +
  test 5/5 verde (idempotente, no pisa correcciones del CMS, falla ante
  slug sin asignar) y backfill real: 302 archivos con `family`, re-run
  unchanged=302. `f31b61f3` — `family: z.enum(FAMILIES)` en la colección
  courses (astro check 0; el sync validó los 302) y `fields.select` en
  `site/keystatic/courses.ts` (esta versión de Keystatic no acepta
  `validation` en select; defaultValue 'otros' cubre entradas nuevas).
- **L5** (evidencia T4): worker gentle-ai-worker (tarea mv3un1ix-1-uncx)
  — chips de familia (Todas + 13 familias con recuento real) dentro del
  bloque de mejora progresiva, filtro combinado AND texto+familia,
  contador vivo y estado vacío familia-aware, aria-pressed + group
  label; `data-family` en el `<li>` de CourseCard. Verificación: astro
  check 0, build OK, greps sobre `site/dist/client/cursos/index.html`
  (adaptador Vercel): 302 `data-family`, chips `Todas (302)` /
  `Salud y bienestar (40)`, 14 chips en orden de taxonomía, 390/139
  líneas (≤400). Sin browser test (sin dependencias nuevas).
- **L6** (evidencia T5a): `scripts/extract-courses.ts` emite `family`
  desde la tabla cerrada (omitida para slugs desconocidos — nunca se
  infiere; apply-families.ts cubre) + test RED→GREEN 7/7 en
  extract-courses.test.ts. Verificación global de rama: suites scripts
  118/118, tsc raíz 0, astro check 0 (tras fix `fields.select` — esta
  versión de Keystatic rechaza `validation` en select).
