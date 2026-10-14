// Colección Keystatic `pages` (T27) — espejo del corpus real de
// content/pages/*.md (4 archivos). Inventario de frontmatter hecho antes de
// escribir el schema: extractedAt 4/4 (Date vía js-yaml), originUrl 4/4
// (string), slug 4/4 (string), sourceUrl 4/4 (string), title 4/4 (string).
//
// El cuerpo del .md es HTML crudo; se expone con rawHtmlContent — NUNCA con
// un campo richtext/markdoc, que lo reescribiría.
import { collection, fields } from '@keystatic/core';

import { isoDateField, persistText, rawHtmlContent, slugKeyField } from './helpers.ts';

export const pages = collection({
  label: 'Páginas',
  path: 'content/pages/*',
  // S2 (fase prixline-cms-ux): lista escaneable + botón "Ver en la web"
  // (las páginas viven en la raíz: /contacto, /practicas, …).
  columns: ['title', 'slug'],
  previewUrl: '/{slug}',
  slugField: 'slug',
  format: { contentField: 'content' },
  schema: {
    // Realidad: timestamp ISO sin comillas → Date de js-yaml; ver helpers.ts.
    extractedAt: isoDateField('extractedAt (fecha de extracción)'),
    originUrl: persistText('originUrl (URL original)', { required: true }),
    slug: slugKeyField('Slug'),
    sourceUrl: persistText('sourceUrl (API WordPress)', { required: true }),
    title: persistText('Título', { required: true }),
    // ── Fase 10 (cms-coverage, S2): copy de la página de contacto.
    // Usado SOLO por content/pages/contacto.md (cableado en
    // site/src/pages/contacto/index.astro); el resto de páginas lo
    // deja vacío. `{channels}` se rellena en render con el nº real de
    // canales de comunidad.
    contact: fields.object(
      {
        eyebrow: fields.text({ label: 'contact.eyebrow' }),
        heading: fields.text({ label: 'contact.heading (H1)' }),
        intro: fields.text({ label: 'contact.intro ({channels} = nº de canales)', multiline: true }),
        chatTitle: fields.text({ label: 'contact.chatTitle (H2 del chat)' }),
        chatBody: fields.text({ label: 'contact.chatBody', multiline: true }),
        chatCta: fields.text({ label: 'contact.chatCta (botón del chat)' }),
        chatProperty: fields.text({ label: 'contact.chatProperty (id de tawk.to)' }),
        channelsTitle: fields.text({ label: 'contact.channelsTitle (H2)' }),
        channelsIntro: fields.text({ label: 'contact.channelsIntro', multiline: true }),
        opinionsLine: fields.text({ label: 'contact.opinionsLine (línea de opiniones)' }),
      },
      { label: 'Contacto (sólo lo usa la página contacto)' },
    ),
    // Cuerpo HTML crudo: ver helpers.ts (rawHtmlContent).
    content: rawHtmlContent(),
  },
});
