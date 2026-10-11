/**
 * scripts/family-map.ts
 *
 * Taxonomía de familias de cursos (fase 8 Prixline Course Families).
 *
 * La página origen agrupaba los 302 cursos en una sola lista plana sin
 * ninguna categoría; el cliente pidió un filtro "por familia… informatica,
 * salud, gestion etc…" (odd/tasks/prixline-course-families.md, L1). Esta
 * taxonomía es la única fuente permitida de familias: la usan la tabla
 * cerrada `course-families.ts`, el backfill `apply-families.ts`, el
 * schema del sitio y el widget de Keystatic.
 *
 * Diseño (deliberado, al estilo de `scripts/category-map.ts`):
 *   - Lista cerrada de 13 familias (12 temáticas + `otros` para cursos
 *     sin familia clara). Sin adivinanzas por palabra clave: cada curso
 *     se asigna explícitamente en la tabla cerrada.
 *   - `FAMILY_LABELS` es la etiqueta visible en la UI (español).
 *   - Los ids son ascii estables: van en frontmatter, schema y URLs.
 *
 * Exports:
 *   - FAMILIES        lista cerrada de ids (orden de UI)
 *   - FAMILY_LABELS   id → etiqueta visible
 *   - isFamily(v)     guard en tiempo de ejecución
 */

export const FAMILIES = [
  'informatica',
  'salud',
  'gestion',
  'idiomas',
  'educacion',
  'deporte',
  'diseno',
  'industria',
  'belleza',
  'hosteleria',
  'seguridad',
  'ambiente',
  'otros',
] as const;

export type Family = (typeof FAMILIES)[number];

export const FAMILY_LABELS: Record<Family, string> = {
  informatica: 'Informática y tecnología',
  salud: 'Salud y bienestar',
  gestion: 'Gestión y empresa',
  idiomas: 'Idiomas',
  educacion: 'Educación y trabajo social',
  deporte: 'Deporte y ocio',
  diseno: 'Arte, diseño y comunicación',
  industria: 'Industria, construcción y oficios',
  belleza: 'Belleza y estética',
  hosteleria: 'Hostelería y turismo',
  seguridad: 'Seguridad y protección',
  ambiente: 'Medio ambiente y agricultura',
  otros: 'Otros',
};

/** Guard: true si `value` es un id de la taxonomía. */
export function isFamily(value: unknown): value is Family {
  return typeof value === 'string' && (FAMILIES as readonly string[]).includes(value);
}
