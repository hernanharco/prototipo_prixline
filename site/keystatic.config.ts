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

// Enlace {href,label} reutilizable (nav, CTA, footer). Instancia nueva
// por uso: los descriptores de campo no se comparten entre objetos.
const linkObject = (label: string) =>
  fields.object(
    {
      href: fields.text({ label: 'href' }),
      label: fields.text({ label: 'label' }),
    },
    { label },
  );

const channelSchema = {
  platform: fields.text({ label: 'platform' }),
  label: fields.text({ label: 'label' }),
  url: fields.text({ label: 'url' }),
};

export default config({
  storage: selectKeystaticStorage(import.meta.env),
  // S1 (fase prixline-cms-ux): UI en español y sidebar agrupada. El
  // locale traduce la interfaz de Keystatic (Dashboard, botones…);
  // navigation secciona la barra lateral en Contenido / Ajustes del
  // sitio; brand.name reemplaza el "<owner>/<repo>" truncado.
  locale: 'es-ES',
  ui: {
    brand: { name: 'Prixline' },
    navigation: {
      Contenido: ['posts', 'courses', 'pages'],
      'Ajustes del sitio': ['site', 'nav', 'home', 'seo', 'social', 'videos'],
    },
  },
  collections: {
    posts,
    courses,
    pages,
  },
  singletons: {
    site: singleton({
      label: 'Ajustes del sitio',
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
      label: 'Comunidad',
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
      label: 'Vídeos de YouTube',
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
    // ── Fase 10 (cms-coverage): singletons nuevos, sembrados por
    // scripts/cms-coverage.ts con el copy EXACTO que vivía hardcodeado
    // (S4 paridad). Ver odd/tasks/prixline-cms-coverage.md.
    nav: singleton({
      label: 'Navegación',
      path: 'content/settings/nav',
      format: 'json',
      schema: {
        wordmark: fields.text({ label: 'wordmark (marca en header y pie)' }),
        menuLabel: fields.text({ label: 'menuLabel (botón móvil)' }),
        items: fields.array(linkObject('Enlace del menú'), {
          label: 'items (menú principal)',
          itemLabel: (props) => props.fields.label.value,
        }),
        cta: linkObject('cta (botón del menú)'),
        footer: fields.object(
          {
            blog: linkObject('Blog (enlace interno /articulos/)'),
            originalText: fields.text({ label: 'originalText (texto sin enlace)' }),
            copyright: fields.text({ label: 'copyright (después del año)' }),
          },
          { label: 'footer' },
        ),
      },
    }),
    home: singleton({
      label: 'Home',
      path: 'content/settings/home',
      format: 'json',
      schema: {
        hero: fields.object(
          {
            eyebrow: fields.text({ label: 'eyebrow' }),
            heading: fields.text({ label: 'heading (H1)', multiline: true }),
            subcopy: fields.text({ label: 'subcopy', multiline: true }),
            primaryCta: linkObject('primaryCta'),
            secondaryCta: linkObject('secondaryCta'),
          },
          { label: 'hero' },
        ),
        // Orden de render de las secciones (index.astro lo respeta).
        sectionOrder: fields.array(
          fields.select({
            options: [
              { label: 'trust', value: 'trust' },
              { label: 'latest', value: 'latest' },
              { label: 'courses', value: 'courses' },
              { label: 'youtube', value: 'youtube' },
              { label: 'practices', value: 'practices' },
              { label: 'community', value: 'community' },
            ],
            defaultValue: 'trust',
            label: 'Sección',
          }),
          { label: 'sectionOrder (orden de las secciones)' },
        ),
        sections: fields.object(
          {
            trust: fields.object(
              {
                enabled: fields.checkbox({ label: 'enabled' }),
                heading: fields.text({ label: 'heading (H2 oculto)' }),
                contentSince: fields.object(
                  {
                    label: fields.text({ label: 'label' }),
                    detail: fields.text({ label: 'detail' }),
                  },
                  { label: 'Métrica «Contenido desde»' },
                ),
                articles: fields.object(
                  {
                    label: fields.text({ label: 'label' }),
                    detail: fields.text({ label: 'detail' }),
                  },
                  { label: 'Métrica «Artículos publicados»' },
                ),
                channels: fields.object(
                  {
                    label: fields.text({ label: 'label' }),
                    detail: fields.text({ label: 'detail' }),
                  },
                  { label: 'Métrica «Canales abiertos»' },
                ),
              },
              { label: 'trust (banda de confianza)' },
            ),
            latest: fields.object(
              {
                enabled: fields.checkbox({ label: 'enabled' }),
                eyebrow: fields.text({ label: 'eyebrow' }),
                heading: fields.text({ label: 'heading (H2)' }),
                intro: fields.text({ label: 'intro', multiline: true }),
                ctaLabel: fields.text({ label: 'ctaLabel' }),
              },
              { label: 'latest (últimos artículos)' },
            ),
            courses: fields.object(
              {
                enabled: fields.checkbox({ label: 'enabled' }),
                eyebrow: fields.text({ label: 'eyebrow' }),
                heading: fields.text({ label: 'heading (H2)' }),
                intro: fields.text({ label: 'intro', multiline: true }),
                ctaLabel: fields.text({ label: 'ctaLabel (sin el contador)' }),
              },
              { label: 'courses (cursos destacados)' },
            ),
            youtube: fields.object(
              {
                enabled: fields.checkbox({ label: 'enabled' }),
                eyebrow: fields.text({ label: 'eyebrow' }),
                heading: fields.text({ label: 'heading (H2)' }),
                handlePrefix: fields.text({ label: 'handlePrefix (antes del @handle)' }),
                ctaLabel: fields.text({ label: 'ctaLabel' }),
              },
              { label: 'youtube (banda del canal)' },
            ),
            practices: fields.object(
              {
                enabled: fields.checkbox({ label: 'enabled' }),
                eyebrow: fields.text({ label: 'eyebrow' }),
                heading: fields.text({ label: 'heading (H2)' }),
                ctaLabel: fields.text({ label: 'ctaLabel' }),
              },
              { label: 'practices (prácticas)' },
            ),
            community: fields.object(
              {
                enabled: fields.checkbox({ label: 'enabled' }),
                eyebrow: fields.text({ label: 'eyebrow' }),
                heading: fields.text({ label: 'heading (H2)' }),
                intro: fields.text({
                  label: 'intro ({count} = nº de canales)',
                  multiline: true,
                }),
              },
              { label: 'community (comunidad)' },
            ),
          },
          { label: 'sections (copy por sección)' },
        ),
      },
    }),
    seo: singleton({
      label: 'SEO',
      path: 'content/settings/seo',
      format: 'json',
      schema: {
        pages: fields.object(
          Object.fromEntries(
            ['home', 'cursos', 'articulos', 'contacto'].map((page) => [
              page,
              fields.object(
                {
                  title: fields.text({ label: 'title' }),
                  description: fields.text({ label: 'description', multiline: true }),
                },
                { label: page },
              ),
            ]),
          ),
          { label: 'pages (título y meta por página)' },
        ),
      },
    }),
  },
});
