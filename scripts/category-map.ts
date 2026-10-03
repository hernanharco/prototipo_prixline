/**
 * scripts/category-map.ts
 *
 * Pure, exhaustive category taxonomy for the Prixline content pipeline (T3).
 *
 * The origin WordPress taxonomy (scripts/fixtures/categories-sample.json, 54
 * categories) is dirty: numeric junk, hashtags, platform names, brand
 * catch-alls and duplicated accented/unaccented names. This module maps every
 * origin category NAME to exactly one value of a CLEAN taxonomy of at most 8:
 *
 *   empleo | formacion | practicas | opiniones | recursos | cursos |
 *   migracion | sin-categoria
 *
 * Design decisions (deliberate):
 *   - The mapping is a closed table keyed by NORMALISED origin name
 *     (lowercased, accents stripped). NO keyword guessing: anything not in
 *     the table resolves to "sin-categoria" (spec: "unmapped/unknown ids at
 *     runtime → sin-categoria"). The table covers 100% of the 54 fixture
 *     categories; the test suite pins this.
 *   - Duplicates collapse through normalisation: Prácticas/practicas,
 *     Trabajo/trabajo, Motivación/Motivacion, vídeos→videos.
 *   - Numeric junk (806514296, 83066696, b83066696), brand catch-alls
 *     (prixline, prix-line) → sin-categoria.
 *   - Hashtags/platform names map to their sensible topic when one is clear
 *     (@AlertasEmpleo→empleo, mascurso.com→formacion) or sin-categoria.
 *
 * Exports:
 *   - CLEAN_CATEGORIES              the allowed clean values
 *   - cleanCategoryForName(name)    origin name → clean value
 *   - mapCategories(ids, lookup)    unique SORTED clean categories for a post
 */

export const CLEAN_CATEGORIES = [
  "empleo",
  "formacion",
  "practicas",
  "opiniones",
  "recursos",
  "cursos",
  "migracion",
  "sin-categoria",
] as const;

export type CleanCategory = (typeof CLEAN_CATEGORIES)[number];

export const SIN_CATEGORIA: CleanCategory = "sin-categoria";

/** Normalise an origin category name: lowercase + strip accents/diacritics. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Exhaustive table: NORMALISED origin category name → clean category.
 * Keyed by normalisation, so `Prácticas`, `practicas` and `PRÁCTICAS` share
 * one entry. 51 keys cover all 54 fixture categories (3 duplicate pairs).
 */
export const CATEGORY_NAME_TABLE: Record<string, CleanCategory> = {
  // numeric junk → sin-categoria
  "806514296": SIN_CATEGORIA,
  "83066696": SIN_CATEGORIA,
  "b83066696": SIN_CATEGORIA,
  // hashtags → sensible topic
  "@alertasempleo": "empleo",
  "@alertastrabajo": "empleo",
  "@ayudaexperta": "recursos",
  // empleo
  empleo: "empleo",
  trabajo: "empleo",
  // formacion
  aprender: "formacion",
  autoaprendizaje: "formacion",
  becas: "formacion",
  "certificado de profesionalidad": "formacion",
  estudiar: "formacion",
  formacion: "formacion",
  homologacion: "migracion",
  idiomas: "formacion",
  "mascurso.com": "formacion",
  "planes de estudio": "formacion",
  semipresencial: "formacion",
  // practicas
  "becas y practicas": "practicas",
  practicas: "practicas",
  // cursos (course-specific topics + course catalogues)
  curso: "cursos",
  "curso auxiliar geriatria": "cursos",
  "curso de atencion a personas drogodependientes": "cursos",
  "curso de auxiliar de farmacia": "cursos",
  "curso de funerario": "cursos",
  "curso de instalador antenas y tdt": "cursos",
  "curso de monitor de manualidades": "cursos",
  "curso de monitor de ocio y tiempo libre": "cursos",
  "curso de monitor deportivo": "cursos",
  cursos: "cursos",
  funerario: "cursos",
  masterclass: "cursos",
  "monitor de ocio": "cursos",
  tanatoestetica: "cursos",
  tanatomaquillaje: "cursos",
  tanatopraxia: "cursos",
  veterinaria: "cursos",
  // migracion
  "emigrar a espana": "migracion",
  // opinioneS / editorial
  motivacion: "opiniones",
  opinion: "opiniones",
  opiniones: "opiniones",
  premios: "opiniones",
  solidaridad: "opiniones",
  // recursos
  educadores: "recursos",
  gratis: "recursos",
  recursos: "recursos",
  "tiempo-libre": "recursos",
  videos: "recursos",
  // brand catch-alls → sin-categoria
  "prix-line": SIN_CATEGORIA,
  prixline: SIN_CATEGORIA,
};

/**
 * Resolve one origin category NAME to exactly one clean value.
 * Unknown names → sin-categoria (closed table, no guessing).
 */
export function cleanCategoryForName(name: string): CleanCategory {
  return CATEGORY_NAME_TABLE[normalizeName(name)] ?? SIN_CATEGORIA;
}

export function isCleanCategory(value: string): value is CleanCategory {
  return (CLEAN_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Pure: map a post's origin category ids to the CLEAN taxonomy using the
 * id→name lookup (from the origin categories endpoint / fixture).
 *
 * - id present in lookup  → cleanCategoryForName(name)
 * - id missing from lookup or empty list → sin-categoria (empty list → [])
 *
 * Returns UNIQUE, SORTED clean category names.
 */
export function mapCategories(ids: number[], lookup: Map<number, string>): string[] {
  const out = new Set<CleanCategory>();
  for (const id of ids) {
    const name = lookup.get(id);
    out.add(name === undefined ? SIN_CATEGORIA : cleanCategoryForName(name));
  }
  return [...out].sort();
}

/**
 * Resolve the ORIGINAL origin names for a post (traceability field in the
 * markdown frontmatter). Unknown ids contribute no name; order follows ids.
 */
export function originCategoryNames(ids: number[], lookup: Map<number, string>): string[] {
  const names: string[] = [];
  for (const id of ids) {
    const name = lookup.get(id);
    if (name !== undefined && !names.includes(name)) names.push(name);
  }
  return names;
}
