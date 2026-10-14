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
// courses, pages}.ts; el schema mapea TODA clave real del corpus (inventario
// previo en cada módulo) porque Keystatic borra al guardar toda clave no
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
//
// Etiquetas (fase prixline-cms-ux, S3): `label` es SÓLO texto de UI (nunca
// se serializa en los JSON/MD); `description` explica qué hace el campo y
// conserva la clave técnica entre corchetes para quien edite el repo a mano.
import { config, fields, singleton } from '@keystatic/core';

import { courses } from './keystatic/courses.ts';
import { pages } from './keystatic/pages.ts';
import { posts } from './keystatic/posts.ts';
import { selectKeystaticStorage } from './src/lib/keystaticStorage.ts';

// Claves comunes site.json / social.json (mismo orden que el JSON real).
const sourceMeta = {
  sourceUrl: fields.text({
    label: 'URL de origen (WordPress)',
    description: 'Clave [sourceUrl]: sitio WordPress del que se importó.',
  }),
  extractedAt: fields.text({
    label: 'Extraído el',
    description: 'Clave [extractedAt]: fecha de la importación (ISO 8601).',
  }),
};

// Enlace {href,label} reutilizable (nav, CTA, footer). Instancia nueva
// por uso: los descriptores de campo no se comparten entre objetos.
const linkObject = (label: string) =>
  fields.object(
    {
      href: fields.text({
        label: 'Enlace (URL)',
        description: 'Clave [href]: URL de destino.',
      }),
      label: fields.text({
        label: 'Texto visible',
        description: 'Clave [label]: texto que se muestra en el enlace.',
      }),
    },
    { label },
  );

const channelSchema = {
  platform: fields.text({
    label: 'Plataforma',
    description: 'Clave [platform]: p. ej. youtube, instagram, tiktok.',
  }),
  label: fields.text({
    label: 'Nombre visible',
    description: 'Clave [label]: cómo se llama el canal en la web.',
  }),
  url: fields.text({
    label: 'URL',
    description: 'Clave [url]: enlace directo al canal.',
  }),
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
        name: fields.text({
          label: 'Nombre del sitio',
          description: 'Clave [name].',
        }),
        tagline: fields.text({
          label: 'Eslogan',
          description: 'Clave [tagline]: claim que se muestra en la web.',
        }),
        originSite: fields.text({
          label: 'Sitio de origen',
          description: 'Clave [originSite].',
        }),
        live: fields.object(
          {
            youtubeHandle: fields.text({
              label: 'Handle de YouTube (@…)',
              description: 'Clave [live.youtubeHandle].',
            }),
            checkIntervalSeconds: fields.integer({
              label: 'Intervalo de comprobación (segundos)',
              description: 'Clave [live.checkIntervalSeconds].',
            }),
            channelId: fields.text({
              label: 'ID del canal de YouTube',
              description: 'Clave [live.channelId].',
            }),
          },
          { label: 'Directo (badge EN VIVO)' },
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
          label: 'Canales',
          description: 'Clave [channels]: redes y canales de la sección Comunidad.',
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
        channelId: fields.text({
          label: 'ID del canal de YouTube',
          description: 'Clave [channelId]: de aquí se sincronizan los vídeos.',
        }),
        sourceUrl: fields.text({
          label: 'URL de origen',
          description: 'Clave [sourceUrl]: canal en YouTube.',
        }),
        fetchedAt: fields.text({
          label: 'Sincronizado el',
          description: 'Clave [fetchedAt]: última sincronización (ISO 8601).',
        }),
        videos: fields.array(
          fields.object(
            {
              videoId: fields.text({
                label: 'ID del vídeo',
                description: 'Clave [videoId].',
              }),
              title: fields.text({
                label: 'Título',
                description: 'Clave [title].',
              }),
              publishedAt: fields.text({
                label: 'Publicado el',
                description: 'Clave [publishedAt] (ISO 8601).',
              }),
              thumbnail: fields.text({
                label: 'Miniatura (URL de YouTube)',
                description: 'Clave [thumbnail]: URL de YouTube, no se sube archivo.',
              }),
              url: fields.text({
                label: 'URL',
                description: 'Clave [url]: enlace al vídeo.',
              }),
            },
            { label: 'Vídeo' },
          ),
          {
            label: 'Vídeos',
            description: 'Clave [videos]: lista sincronizada del canal.',
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
        wordmark: fields.text({
          label: 'Marca del sitio (header y pie)',
          description: 'Clave [wordmark].',
        }),
        menuLabel: fields.text({
          label: 'Texto del botón de menú (móvil)',
          description: 'Clave [menuLabel].',
        }),
        items: fields.array(linkObject('Elemento del menú'), {
          label: 'Menú principal',
          description: 'Clave [items]: enlaces del encabezado, en orden.',
          itemLabel: (props) => props.fields.label.value,
        }),
        cta: linkObject('Botón del menú'),
        footer: fields.object(
          {
            blog: linkObject('Enlace a /articulos/'),
            originalText: fields.text({
              label: 'Texto inicial del pie',
              description: 'Clave [originalText]: parte sin enlace del copyright.',
            }),
            copyright: fields.text({
              label: 'Texto tras el año',
              description: 'Clave [copyright]: p. ej. ", Todos los derechos reservados".',
            }),
          },
          { label: 'Pie de página' },
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
            eyebrow: fields.text({
              label: 'Texto pequeño sobre el titular',
              description: 'Clave [hero.eyebrow].',
            }),
            heading: fields.text({
              label: 'Titular (H1)',
              description: 'Clave [hero.heading].',
              multiline: true,
            }),
            subcopy: fields.text({
              label: 'Texto de apoyo',
              description: 'Clave [hero.subcopy].',
              multiline: true,
            }),
            primaryCta: linkObject('Botón principal'),
            secondaryCta: linkObject('Botón secundario'),
          },
          { label: 'Portada (hero)' },
        ),
        // Orden de render de las secciones (index.astro lo respeta).
        sectionOrder: fields.array(
          fields.select({
            options: [
              { label: 'Banda de confianza (trust)', value: 'trust' },
              { label: 'Últimos artículos (latest)', value: 'latest' },
              { label: 'Cursos destacados (courses)', value: 'courses' },
              { label: 'Banda de YouTube (youtube)', value: 'youtube' },
              { label: 'Prácticas (practices)', value: 'practices' },
              { label: 'Comunidad (community)', value: 'community' },
            ],
            defaultValue: 'trust',
            label: 'Sección',
          }),
          {
            label: 'Orden de las secciones',
            description:
              'Clave [sectionOrder]: el orden en que se pintan en la portada.',
          },
        ),
        sections: fields.object(
          {
            trust: fields.object(
              {
                enabled: fields.checkbox({
                  label: 'Sección activa',
                  description: 'Clave [sections.trust.enabled].',
                }),
                heading: fields.text({
                  label: 'Titular (H2 oculto)',
                  description: 'Clave [sections.trust.heading]: sólo accesibilidad.',
                }),
                contentSince: fields.object(
                  {
                    label: fields.text({
                      label: 'Etiqueta',
                      description: 'Clave [label], p. ej. "Contenido desde".',
                    }),
                    detail: fields.text({
                      label: 'Detalle',
                      description: 'Clave [detail], p. ej. "2011".',
                    }),
                  },
                  { label: 'Métrica «Contenido desde»' },
                ),
                articles: fields.object(
                  {
                    label: fields.text({
                      label: 'Etiqueta',
                      description: 'Clave [label], p. ej. "Artículos publicados".',
                    }),
                    detail: fields.text({
                      label: 'Detalle',
                      description: 'Clave [detail], p. ej. el recuento.',
                    }),
                  },
                  { label: 'Métrica «Artículos publicados»' },
                ),
                channels: fields.object(
                  {
                    label: fields.text({
                      label: 'Etiqueta',
                      description: 'Clave [label], p. ej. "Canales abiertos".',
                    }),
                    detail: fields.text({
                      label: 'Detalle',
                      description: 'Clave [detail].',
                    }),
                  },
                  { label: 'Métrica «Canales abiertos»' },
                ),
              },
              { label: 'Banda de confianza (trust)' },
            ),
            latest: fields.object(
              {
                enabled: fields.checkbox({
                  label: 'Sección activa',
                  description: 'Clave [sections.latest.enabled].',
                }),
                eyebrow: fields.text({
                  label: 'Texto pequeño (eyebrow)',
                  description: 'Clave [sections.latest.eyebrow].',
                }),
                heading: fields.text({
                  label: 'Titular (H2)',
                  description: 'Clave [sections.latest.heading].',
                }),
                intro: fields.text({
                  label: 'Texto de apoyo',
                  description: 'Clave [sections.latest.intro].',
                  multiline: true,
                }),
                ctaLabel: fields.text({
                  label: 'Texto del botón',
                  description: 'Clave [sections.latest.ctaLabel].',
                }),
              },
              { label: 'Últimos artículos (latest)' },
            ),
            courses: fields.object(
              {
                enabled: fields.checkbox({
                  label: 'Sección activa',
                  description: 'Clave [sections.courses.enabled].',
                }),
                eyebrow: fields.text({
                  label: 'Texto pequeño (eyebrow)',
                  description: 'Clave [sections.courses.eyebrow].',
                }),
                heading: fields.text({
                  label: 'Titular (H2)',
                  description: 'Clave [sections.courses.heading].',
                }),
                intro: fields.text({
                  label: 'Texto de apoyo',
                  description: 'Clave [sections.courses.intro].',
                  multiline: true,
                }),
                ctaLabel: fields.text({
                  label: 'Texto del botón',
                  description: 'Clave [sections.courses.ctaLabel]: sin el contador.',
                }),
              },
              { label: 'Cursos destacados (courses)' },
            ),
            youtube: fields.object(
              {
                enabled: fields.checkbox({
                  label: 'Sección activa',
                  description: 'Clave [sections.youtube.enabled].',
                }),
                eyebrow: fields.text({
                  label: 'Texto pequeño (eyebrow)',
                  description: 'Clave [sections.youtube.eyebrow].',
                }),
                heading: fields.text({
                  label: 'Titular (H2)',
                  description: 'Clave [sections.youtube.heading].',
                }),
                handlePrefix: fields.text({
                  label: 'Prefijo antes del @handle',
                  description: 'Clave [sections.youtube.handlePrefix].',
                }),
                ctaLabel: fields.text({
                  label: 'Texto del botón',
                  description: 'Clave [sections.youtube.ctaLabel].',
                }),
              },
              { label: 'Banda de YouTube (youtube)' },
            ),
            practices: fields.object(
              {
                enabled: fields.checkbox({
                  label: 'Sección activa',
                  description: 'Clave [sections.practices.enabled].',
                }),
                eyebrow: fields.text({
                  label: 'Texto pequeño (eyebrow)',
                  description: 'Clave [sections.practices.eyebrow].',
                }),
                heading: fields.text({
                  label: 'Titular (H2)',
                  description: 'Clave [sections.practices.heading].',
                }),
                ctaLabel: fields.text({
                  label: 'Texto del botón',
                  description: 'Clave [sections.practices.ctaLabel].',
                }),
              },
              { label: 'Prácticas (practices)' },
            ),
            community: fields.object(
              {
                enabled: fields.checkbox({
                  label: 'Sección activa',
                  description: 'Clave [sections.community.enabled].',
                }),
                eyebrow: fields.text({
                  label: 'Texto pequeño (eyebrow)',
                  description: 'Clave [sections.community.eyebrow].',
                }),
                heading: fields.text({
                  label: 'Titular (H2)',
                  description: 'Clave [sections.community.heading].',
                }),
                intro: fields.text({
                  label: 'Texto de apoyo',
                  description: 'Clave [sections.community.intro]: {count} = nº de canales.',
                  multiline: true,
                }),
              },
              { label: 'Comunidad (community)' },
            ),
          },
          { label: 'Textos por sección' },
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
                  title: fields.text({
                    label: 'Título (title)',
                    description: `Aparece en la pestaña y en Google — página ${page}.`,
                  }),
                  description: fields.text({
                    label: 'Meta descripción',
                    description: `Resumen para Google — página ${page}.`,
                    multiline: true,
                  }),
                },
                { label: `Página: ${page}` },
              ),
            ]),
          ),
          { label: 'Título y meta por página' },
        ),
      },
    }),
  },
});
