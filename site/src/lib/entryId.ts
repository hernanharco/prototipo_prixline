/**
 * site/src/lib/entryId.ts — T16
 *
 * `generateId` puro para la colección `posts`
 * (site/src/content.config.ts). Extraído del loader (antes inline en
 * content.config.ts) para poder testearlo sin Astro: cero imports, apto
 * para `node --test` con type stripping nativo (ver
 * scripts/entry-id.test.ts).
 *
 * Reality check: 55 posts have unquoted numeric slugs (`slug: 100`),
 * which js-yaml parses as numbers. Astro's default generateId returns
 * `data.slug` verbatim and then crashes on `id.endsWith(...)`.
 * Coerce to string here; entry ids stay unique (verified no duplicate
 * slug lines across the 813 posts).
 *
 * Second fix: 79 posts carry percent-encoded UTF-8 in the slug (mostly
 * emoji, `...-%f0%9f%98%ac`). Keeping it writes literal `%xx` directory
 * names that no URL variant can reach (404 on every form). Decode to the
 * raw characters so routes and links resolve; malformed sequences fall
 * back to the raw value. Decoding preserves uniqueness (bijection over
 * well-formed slugs).
 */

/** Entrada que consume generateId (espejo de los args de Astro). */
export interface EntryIdInput {
  entry: string;
  data: { slug?: unknown };
}

/**
 * Id de entrada de la colección `posts`: `data.slug` percent-decodificado
 * (coercido a string); si `data.slug` no existe cae a `entry`; si la
 * decodificación falla devuelve el valor crudo sin lanzar.
 */
export function generateId({ entry, data }: EntryIdInput): string {
  const raw = String(data.slug ?? entry);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
