import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

import { generateId } from './lib/entryId';

// Imported content lives at repo-root `content/`, one level above this
// package (`site/`). `base` is resolved relative to the Astro project root
// (site/), per installed astro@5.18.2 loaders/glob.js and glob.d.ts docs.
const courses = defineCollection({
  loader: glob({ base: '../content/courses', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    sourceUrl: z.string(),
    // Deviation from the task's `z.string()`: verified against real data via
    // @astrojs/markdown-remark parseFrontmatter (js-yaml default schema) that
    // unquoted frontmatter timestamps arrive as Date objects. z.coerce.date()
    // accepts both Date and string inputs; output type is Date.
    extractedAt: z.coerce.date(),
  }),
});

const posts = defineCollection({
  loader: glob({
    base: '../content/posts',
    pattern: '**/*.md',
    // Entry ids: slugs numéricos coercidos a string y percent-decode de
    // UTF-8 (fallback al valor crudo si la secuencia es malformada).
    // Lógica y rationale completo en site/src/lib/entryId.ts (T16; test en
    // scripts/entry-id.test.ts).
    generateId,
  }),
  schema: z.object({
    id: z.number(),
    title: z.string(),
    // See note on extractedAt above: unquoted ISO timestamps parse as Date.
    date: z.coerce.date(),
    // Deviation from the task's `z.string()`: 55 posts carry numeric YAML
    // slugs (e.g. `slug: 100`) that parse as numbers; coerce to string.
    slug: z.coerce.string(),
    sourceUrl: z.string(),
    originUrl: z.string(),
    // Reality check (verified over all 813 posts): `categories` items are
    // always plain strings (spec schema kept as-is). `originCategories`
    // mixes strings with numeric items — WordPress category IDs such as
    // `- 83066696` — that js-yaml parses as numbers, so coerce items to
    // string. Documented deviation from `z.array(z.string())` for
    // originCategories only.
    categories: z.array(z.string()),
    originCategories: z.array(z.coerce.string()),
    excerpt: z.string(),
    // T11: campos de medios editables desde el CMS (regla del usuario: toda
    // imagen vive en un campo de datos, cero URLs hardcodeadas en componentes).
    // `thumbnail` lo propone el importador desde el contenido origen (URL
    // i.ytimg.com de YouTube o la primera <img> absoluta) y es opcional:
    // ausente = sin medios = bloque tipográfico en la home.
    // T25: tras localizar los medios del blog origen, `thumbnail` puede ser
    // una ruta local (`/media/uploads/...`) además de una URL absoluta
    // (p. ej. i.ytimg.com de YouTube); por eso ya no se exige `.url()`.
    thumbnail: z.string().optional(),
    videoId: z.string().optional(),
    // El importador lo emite SIEMPRE ("" por defecto); el editor lo rellena
    // desde el panel y el panel puede sobreescribirlo después sin tocar código.
    thumbnailAlt: z.string().optional(),
  }),
});

const pages = defineCollection({
  loader: glob({ base: '../content/pages', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    sourceUrl: z.string(),
    originUrl: z.string(),
    // See note on extractedAt above: unquoted ISO timestamps parse as Date.
    extractedAt: z.coerce.date(),
  }),
});

export const collections = { courses, posts, pages };
