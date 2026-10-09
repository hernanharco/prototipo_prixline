// Keystatic (T26/T27/T6) — ajustes JSON como singletons + colecciones de
// contenido markdown.
//
// Storage (T6): seleccionado por selectKeystaticStorage (site/src/lib/
// keystaticStorage.ts) con PUBLIC_KEYSTATIC_STORAGE — el `kind` debe ser
// idéntico en el bundle del servidor (API) y el de la UI, así que el flag
// es PÚBLICO y las credenciales (KEYSTATIC_*) siguen server-only. Sin el
// flag ⇒ `local` (dev y el smoke T7 de git diff); en Vercel con
// PUBLIC_KEYSTATIC_STORAGE=github ⇒ commits a la rama por defecto de
// hernanharco/prototipo_prixline (main ⇒ Vercel redespliega).
//
// Colecciones (T27): posts/courses/pages viven en site/keystatic/{posts,
//courses,pages}.ts; el schema mapea TODA clave real del corpus (inventario
//previo en cada módulo) porque Keystatic borra al guardar toda clave no
// mapeada. Smoke de lectura: node site/scripts/verify-content-reader.mjs
// (desde la raíz del repo).
//
// Rutas relativas al REPO (`content/settings/*`), sin extensión: los
// singletons JSON resuelven a `${path}.json` (getEntryDataFilepath) y esta es
// además la forma correcta para el storage github (las rutas del repo tal
// cual, sin '..'). Con storage `local` la API resuelve contra process.cwd():
// dev desde la RAÍZ del repo (`pnpm dev:site`) ⇒ content/ alcanzable (solución
// T26; el endpoint propio site/src/pages/api/keystatic/[...params].js que
// decía este comentario NUNCA existió — verificar con git log).
import { config, fields, singleton } from '@keystatic/core';

import { courses } from './keystatic/courses.ts';
import { pages } from './keystatic/pages.ts';
import { posts } from './keystatic/posts.ts';
import { selectKeystaticStorage } from './src/lib/keystaticStorage.ts';

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
  storage: selectKeystaticStorage(import.meta.env),
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
