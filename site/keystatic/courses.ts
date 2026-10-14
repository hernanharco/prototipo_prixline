// Colección Keystatic `courses` (T27) — espejo del corpus real de
// content/courses/*.md (302 archivos). Inventario de frontmatter hecho antes
// de escribir el schema: extractedAt 302/302 (Date vía js-yaml), slug 302/302
// (string), sourceUrl 302/302 (string), title 302/302 (string). Sin claves
// opcionales ni vacías en la realidad actual.
//
// El cuerpo del .md es el temario (HTML/Markdown crudo); se expone con
// rawHtmlContent — NUNCA con un campo richtext/markdoc, que lo reescribiría.
import { collection, fields } from '@keystatic/core';

// Taxonomía de familias (fase 8): misma fuente que el schema de Astro
// (site/src/content.config.ts) y la tabla scripts/course-families.ts.
import { FAMILIES, FAMILY_LABELS } from '../../scripts/family-map.ts';
import { isoDateField, persistText, rawHtmlContent, slugKeyField } from './helpers.ts';

export const courses = collection({
  label: 'Cursos',
  path: 'content/courses/*',
  // S2 (fase prixline-cms-ux): lista escaneable + botón "Ver en la web".
  columns: ['title', 'family', 'slug'],
  previewUrl: '/cursos/{slug}',
  slugField: 'slug',
  format: { contentField: 'content' },
  schema: {
    // Realidad: timestamp ISO sin comillas → Date de js-yaml; ver helpers.ts.
    extractedAt: isoDateField('Extraído el', 'Clave [extractedAt]: fecha de importación (ISO 8601).'),
    slug: slugKeyField('Slug', 'Clave [slug]: también es el nombre del fichero.'),
    // Fase 8: familia del curso (select de la taxonomía cerrada). Es
    // editable desde el CMS: una corrección aquí gana sobre la tabla
    // (apply-families.ts no pisa valores existentes).
    family: fields.select({
      label: 'Familia',
      description: 'Clave [family]: taxonomía cerrada (informática, salud, gestión…).',
      options: FAMILIES.map((family) => ({ value: family, label: FAMILY_LABELS[family] })),
      defaultValue: 'otros',
    }),
    sourceUrl: persistText('URL de origen', {
      required: true,
      description: 'Clave [sourceUrl]: curso en el sitio de origen.',
    }),
    title: persistText('Título', { required: true, description: 'Clave [title].' }),
    // Cuerpo del temario en texto crudo: ver helpers.ts (rawHtmlContent).
    content: rawHtmlContent(),
  },
});
