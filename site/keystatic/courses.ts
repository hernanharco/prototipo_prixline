// Colección Keystatic `courses` (T27) — espejo del corpus real de
// content/courses/*.md (302 archivos). Inventario de frontmatter hecho antes
// de escribir el schema: extractedAt 302/302 (Date vía js-yaml), slug 302/302
// (string), sourceUrl 302/302 (string), title 302/302 (string). Sin claves
// opcionales ni vacías en la realidad actual.
//
// El cuerpo del .md es el temario (HTML/Markdown crudo); se expone con
// rawHtmlContent — NUNCA con un campo richtext/markdoc, que lo reescribiría.
import { collection, fields } from '@keystatic/core';

import { isoDateField, rawHtmlContent } from './helpers.ts';

export const courses = collection({
  label: 'Cursos',
  path: 'content/courses/*',
  slugField: 'slug',
  format: { contentField: 'content' },
  schema: {
    // Realidad: timestamp ISO sin comillas → Date de js-yaml; ver helpers.ts.
    extractedAt: isoDateField('extractedAt (fecha de extracción)'),
    slug: fields.text({
      label: 'Slug',
      validation: { isRequired: true },
    }),
    sourceUrl: fields.text({
      label: 'sourceUrl (URL de origen)',
      validation: { isRequired: true },
    }),
    title: fields.text({
      label: 'Título',
      validation: { isRequired: true },
    }),
    // Cuerpo del temario en texto crudo: ver helpers.ts (rawHtmlContent).
    content: rawHtmlContent(),
  },
});
