/**
 * site/src/lib/sanitizeHtml.ts — T13
 *
 * Sanitizador puro y SIN dependencias para el cuerpo HTML importado de
 * WordPress (colección `posts`). Se aplica en `articulos/[slug].astro`
 * antes de `set:html`. Sin DOM, sin red, sin I/O: solo transformaciones
 * sobre la cadena, aptas para `node --test` offline (ver
 * `scripts/sanitize-html.test.ts`).
 *
 * Contrato (ver tests):
 *   1. Elimina `<script>...</script>` (con contenido, con solo atributos,
 *      sin cerrar) y etiquetas `<script`/`</script>` sueltas.
 *   2. Elimina `<iframe>` cuyo host NO está en la allowlist:
 *      youtube.com (y subdominios), youtube-nocookie.com, youtu.be,
 *      player.vimeo.com, open.spotify.com y hosts `embed.*`.
 *      Todo lo demás (p. ej. video.wordpress.com) se elimina con su
 *      `</iframe>` y su contenido.
 *   3. Elimina TODO atributo manejador `on*` (onclick, onerror, ONLOAD,
 *      sin valor, …) de cada etiqueta.
 *   4. Elimina los atributos `href`/`src` cuyo valor es una URL con
 *      esquema `javascript:` (mayúsculas, entidades `&#115;`/`&colon;` y
 *      espacios de control ofuscados se detectan igual).
 *   5. Conserva intactos imágenes, enlaces, formato y los embeds
 *      permitidos (bytes idénticos).
 *   6. Idempotente: sanear dos veces == sanear una vez.
 *
 * Nota: también se eliminan comentarios HTML `<!-- -->` (markup no
 * deseado que puede ocultar marcado hostil); el resto del contenido
 * legítimo no se toca.
 */

/** Hosts de iframe permitidos (subdominios incluidos). */
const EMBED_HOSTS = [
  'youtube.com',
  'youtube-nocookie.com',
  'youtu.be',
  'player.vimeo.com',
  'open.spotify.com',
];

/** Entidades mínimas para leer esquemas de URL ofuscados. */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  colon: ':',
  sol: '/',
  tab: '\t',
  newline: '\n',
  nbsp: ' ',
};

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&([a-zA-Z]+);/g, (match, name: string) =>
      name in NAMED_ENTITIES ? NAMED_ENTITIES[name] : match,
    );
}

/** Valor de un atributo (comillas dobles, simples o desnudas). */
function attrValue(tag: string, name: string): string | null {
  const re = new RegExp(
    String.raw`\s${name}\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))`,
    'i',
  );
  const m = re.exec(tag);
  if (m === null) return null;
  const value = m[1] ?? m[2] ?? m[3];
  return value === undefined || value === '' ? null : value;
}

/** ¿La URL (ya decodificada) usa el esquema javascript:? */
function isJsUrl(value: string): boolean {
  const decoded = decodeBasicEntities(value)
    // Browsers ignoran espacios y controles dentro del esquema.
    .replace(/[\u0000-\u0020\u007f]/g, '')
    .toLowerCase();
  return decoded.startsWith('javascript:');
}

/** ¿El src de un iframe apunta a un host de la allowlist? */
function isAllowedEmbedSrc(raw: string): boolean {
  const decoded = decodeBasicEntities(raw).trim();
  const m = /^(?:https?:)?\/\/([^/?#]+)/i.exec(decoded);
  if (m === null) return false; // relativo o no parseable → fuera
  let host = m[1].toLowerCase();
  const at = host.lastIndexOf('@'); // descarta userinfo (host@evil)
  if (at !== -1) host = host.slice(at + 1);
  const colon = host.lastIndexOf(':'); // descarta puerto
  if (colon !== -1) host = host.slice(0, colon);
  if (host.startsWith('embed.')) return true;
  return EMBED_HOSTS.some((d) => host === d || host.endsWith(`.${d}`));
}

/** Limpia una etiqueta abierta: quita on* y href/src javascript:. */
function sanitizeTag(tag: string): string {
  // 1) Atributos manejadores (con valor o sin él), con cualquier case.
  let out = tag
    .replace(/\s+on[a-z-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    .replace(/\s+on[a-z-]+(?=[\s/>])/gi, '');
  // 2) href/src con esquema javascript: (ofuscados incluidos).
  out = out.replace(
    /\s+(href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    (match, _name: string, dq?: string, sq?: string, bare?: string) => {
      const value = dq ?? sq ?? bare ?? '';
      return value !== '' && isJsUrl(value) ? '' : match;
    },
  );
  return out;
}

export function sanitizeArticleHtml(html: string): string {
  if (typeof html !== 'string' || html === '') return html;
  let out = html;

  // Comentarios HTML (markup no deseado; pueden ocultar marcado hostil).
  out = out.replace(/<!--[\s\S]*?-->/g, '');

  // <script> con contenido y/o atributos, hasta </script> o fin de cadena.
  out = out.replace(/<script\b[^>]*>[\s\S]*?(?:<\/script\s*>|$)/gi, '');
  // Restos: </script> sueltos y <script ... sin '>' (a fin de cadena).
  out = out.replace(/<\/script\s*>/gi, '');
  out = out.replace(/<script\b[^>]*/gi, '');

  // Iframes: solo los de hosts permitidos sobreviven.
  out = out.replace(
    /<iframe\b[^>]*>(?:[\s\S]*?<\/iframe\s*>|)/gi,
    (element: string) => {
      const open = /^<iframe\b[^>]*>/i.exec(element)?.[0] ?? '';
      const src = attrValue(open, 'src');
      return src !== null && isAllowedEmbedSrc(src) ? element : '';
    },
  );

  // Etiquetas abiertas: on* y javascript: en href/src.
  // El regex solo engancha etiquetas (<nombre …>), nunca texto plano.
  out = out.replace(
    /<[a-zA-Z][^"'>]*(?:"[^"]*"|'[^']*'|[^"'>])*>/g,
    (tag: string) => sanitizeTag(tag),
  );

  return out;
}
