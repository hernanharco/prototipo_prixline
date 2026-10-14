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
    extractedAt: isoDateField('Extraído el', 'Clave [extractedAt]: fecha de importación (ISO 8601).'),
    originUrl: persistText('URL original', {
      required: true,
      description: 'Clave [originUrl]: página original en WordPress.',
    }),
    slug: slugKeyField('Slug', 'Clave [slug]: también es la ruta pública (/…).'),
    sourceUrl: persistText('URL de la API (WordPress)', {
      required: true,
      description: 'Clave [sourceUrl]: endpoint del que vino la página.',
    }),
    title: persistText('Título', { required: true, description: 'Clave [title].' }),
    // ── Fase 10 (cms-coverage, S2): copy de la página de contacto.
    // Usado SOLO por content/pages/contacto.md (cableado en
    // site/src/pages/contacto/index.astro); el resto de páginas lo
    // deja vacío. `{channels}` se rellena en render con el nº real de
    // canales de comunidad.
    contact: fields.object(
      {
        eyebrow: fields.text({
          label: 'Texto pequeño (eyebrow)',
          description: 'Clave [contact.eyebrow]: texto sobre el titular.',
        }),
        heading: fields.text({
          label: 'Titular (H1)',
          description: 'Clave [contact.heading].',
        }),
        intro: fields.text({
          label: 'Texto de apoyo',
          description: 'Clave [contact.intro]: {channels} = nº de canales (se rellena solo).',
          multiline: true,
        }),
        chatTitle: fields.text({
          label: 'Titular del chat (H2)',
          description: 'Clave [contact.chatTitle].',
        }),
        chatBody: fields.text({
          label: 'Texto del chat',
          description: 'Clave [contact.chatBody].',
          multiline: true,
        }),
        chatCta: fields.text({
          label: 'Botón del chat',
          description: 'Clave [contact.chatCta].',
        }),
        chatProperty: fields.text({
          label: 'ID de tawk.to',
          description: 'Clave [contact.chatProperty]: identificador de la propiedad de chat.',
        }),
        channelsTitle: fields.text({
          label: 'Titular de canales (H2)',
          description: 'Clave [contact.channelsTitle].',
        }),
        channelsIntro: fields.text({
          label: 'Texto de canales',
          description: 'Clave [contact.channelsIntro].',
          multiline: true,
        }),
        opinionsLine: fields.text({
          label: 'Línea de opiniones',
          description: 'Clave [contact.opinionsLine].',
        }),
      },
      { label: 'Contacto (sólo lo usa la página contacto)' },
    ),
    // Cuerpo HTML crudo: ver helpers.ts (rawHtmlContent).
    content: rawHtmlContent(),
  },
});
