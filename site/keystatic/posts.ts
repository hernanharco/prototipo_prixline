// Colección Keystatic `posts` (T27) — espejo del corpus real de
// content/posts/*.md (813 archivos). Inventario de frontmatter hecho antes de
// escribir el schema (Keystatic borra al guardar toda clave no mapeada):
//   categories 813/813 (array<string>), date 813/813 (Date vía js-yaml),
//   excerpt 813/813 (string; vacío en 170), id 813/813 (number),
//   originCategories 813/813 (array<string>), originUrl 813/813 (string),
//   slug 813/813 (string; 55 van entrecomillados como número),
//   sourceUrl 813/813 (string), thumbnail 471/813 (string, opcional),
//   thumbnailAlt 813/813 (string, siempre vacía), title 813/813 (string;
//   vacío en 9), videoId 94/813 (string, opcional).
//
// El cuerpo del .md es HTML crudo (se renderiza en build con set:html +
// sanitizer); se expone con rawHtmlContent — NUNCA con un campo
// richtext/markdoc, que reescribiría el HTML.
import { collection, fields } from '@keystatic/core';

import { isoDateField, rawHtmlContent } from './helpers.ts';

export const posts = collection({
  label: 'Entradas del blog',
  path: 'content/posts/*',
  // El slug vive en el nombre de archivo; con slugField 'slug' Keystatic lo
  // trata como canónico al guardar (riesgo T29 documentado en el informe).
  slugField: 'slug',
  // El cuerpo del .md se almacena en el campo `content` (texto crudo).
  format: { contentField: 'content' },
  schema: {
    id: fields.integer({
      label: 'ID (WordPress)',
      validation: { isRequired: true },
    }),
    // Realidad: vacío ('') en 9/813 → no requerido.
    title: fields.text({ label: 'Título' }),
    // Realidad: timestamp ISO sin comillas → Date de js-yaml; ver helpers.ts.
    date: isoDateField('Fecha'),
    slug: fields.text({
      label: 'Slug',
      validation: { isRequired: true },
    }),
    sourceUrl: fields.text({
      label: 'sourceUrl (API WordPress)',
      validation: { isRequired: true },
    }),
    originUrl: fields.text({
      label: 'originUrl (URL original)',
      validation: { isRequired: true },
    }),
    // Realidad: 1550 items, todos string (sin numéricos ni null).
    categories: fields.array(fields.text({ label: 'Categoría' }), {
      label: 'Categorías',
      itemLabel: (props) => props.value ?? '',
    }),
    originCategories: fields.array(
      fields.text({ label: 'Categoría de origen' }),
      {
        label: 'Categorías de origen (WordPress)',
        itemLabel: (props) => props.value ?? '',
      },
    ),
    // Realidad: vacío ('') en 170/813 → no requerido.
    excerpt: fields.text({ label: 'Extracto', multiline: true }),
    // Opcional en la realidad (471/813): ruta local (/media/uploads/...) o URL.
    thumbnail: fields.text({ label: 'thumbnail (ruta local o URL)' }),
    // Opcional en la realidad (94/813).
    videoId: fields.text({ label: 'videoId (YouTube)' }),
    // Clave que el importador emite SIEMPRE ('' por defecto).
    thumbnailAlt: fields.text({ label: 'thumbnailAlt (texto alternativo)' }),
    // Cuerpo HTML crudo: ver helpers.ts (rawHtmlContent).
    content: rawHtmlContent(),
  },
});
