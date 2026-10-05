// Keystatic spike (T26/T27) — ajustes JSON como singletons + colecciones de
// contenido markdown; storage local (dev).
//
// Colecciones (T27): posts/courses/pages viven en site/keystatic/{posts,
//courses,pages}.ts; el schema mapea TODA clave real del corpus (inventario
//previo en cada módulo) porque Keystatic borra al guardar toda clave no
// mapeada. Smoke de lectura: node site/scripts/verify-content-reader.mjs
// (desde la raíz del repo).
//
// Rutas relativas al REPO (`content/settings/*`), sin extensión: los
// singletons JSON resuelven a `${path}.json` (getEntryDataFilepath) y esta es
// además la forma correcta para el storage github de T28. La API local de
// Keystatic prohíbe '..' y usa cwd como base, así que el acceso a
// content/ (raíz del repo, fuera de site/) se resuelve con el endpoint
// propio site/src/pages/api/keystatic/[...params].js, que pasa
// `localBaseDirectory` = raíz del repo a makeGenericAPIRouteHandler.
// Evidencia del por qué en ese fichero y en el informe T26.
import { config, fields, singleton } from '@keystatic/core';

import { courses } from './keystatic/courses.ts';
import { pages } from './keystatic/pages.ts';
import { posts } from './keystatic/posts.ts';

// Claves comunes site.json / social.json (mismo orden que el JSON real).
const sourceMeta = {
  sourceUrl: fields.text({ label: 'sourceUrl (WordPress de origen)' }),
  extractedAt: fields.text({ label: 'extractedAt (ISO 8601)' }),
};

const channelSchema = {
  platform: fields.text({ label: 'platform' }),
  label: fields.text({ label: 'label' }),
  url: fields.text({ label: 'url' }),
};

export default config({
  storage: { kind: 'local' },
  collections: {
    posts,
    courses,
    pages,
  },
  singletons: {
    site: singleton({
      label: 'Ajustes del sitio (site.json)',
      path: 'content/settings/site',
      format: 'json',
      schema: {
        name: fields.text({ label: 'name' }),
        tagline: fields.text({ label: 'tagline' }),
        originSite: fields.text({ label: 'originSite' }),
        live: fields.object(
          {
            youtubeHandle: fields.text({ label: 'youtubeHandle' }),
            checkIntervalSeconds: fields.integer({ label: 'checkIntervalSeconds' }),
            channelId: fields.text({ label: 'channelId' }),
          },
          { label: 'live' },
        ),
        ...sourceMeta,
      },
    }),
    social: singleton({
      label: 'Comunidad (social.json)',
      path: 'content/settings/social',
      format: 'json',
      schema: {
        channels: fields.array(fields.object(channelSchema, { label: 'Canal' }), {
          label: 'channels',
          itemLabel: (props) => props.fields.label.value,
        }),
        ...sourceMeta,
      },
    }),
    videos: singleton({
      label: 'Vídeos de YouTube (videos.json)',
      path: 'content/settings/videos',
      format: 'json',
      schema: {
        channelId: fields.text({ label: 'channelId' }),
        sourceUrl: fields.text({ label: 'sourceUrl' }),
        fetchedAt: fields.text({ label: 'fetchedAt (ISO 8601)' }),
        videos: fields.array(
          fields.object(
            {
              videoId: fields.text({ label: 'videoId' }),
              title: fields.text({ label: 'title' }),
              publishedAt: fields.text({ label: 'publishedAt (ISO 8601)' }),
              thumbnail: fields.text({ label: 'thumbnail (URL)' }),
              url: fields.text({ label: 'url' }),
            },
            { label: 'Vídeo' },
          ),
          {
            label: 'videos',
            itemLabel: (props) => props.fields.title.value,
          },
        ),
      },
    }),
  },
});
