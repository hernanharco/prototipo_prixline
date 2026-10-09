// Colección Keystatic `pages` (T27) — espejo del corpus real de
// content/pages/*.md (4 archivos). Inventario de frontmatter hecho antes de
// escribir el schema: extractedAt 4/4 (Date vía js-yaml), originUrl 4/4
// (string), slug 4/4 (string), sourceUrl 4/4 (string), title 4/4 (string).
//
// El cuerpo del .md es HTML crudo; se expone con rawHtmlContent — NUNCA con
// un campo richtext/markdoc, que lo reescribiría.
import { collection } from '@keystatic/core';

import { isoDateField, persistText, rawHtmlContent, slugKeyField } from './helpers.ts';

export const pages = collection({
  label: 'Páginas',
  path: 'content/pages/*',
  slugField: 'slug',
  format: { contentField: 'content' },
  schema: {
    // Realidad: timestamp ISO sin comillas → Date de js-yaml; ver helpers.ts.
    extractedAt: isoDateField('extractedAt (fecha de extracción)'),
    originUrl: persistText('originUrl (URL original)', { required: true }),
    slug: slugKeyField('Slug'),
    sourceUrl: persistText('sourceUrl (API WordPress)', { required: true }),
    title: persistText('Título', { required: true }),
    // Cuerpo HTML crudo: ver helpers.ts (rawHtmlContent).
    content: rawHtmlContent(),
  },
});
