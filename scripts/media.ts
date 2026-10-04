/**
 * scripts/media.ts — T25 pure media-URL helpers.
 *
 * Zero I/O, zero network: only string/URL transformation. Used by the
 * importers (via scripts/media-io.ts, the I/O side) to localize origin-blog
 * media so `site/dist` never requests an image from prixline.wordpress.com /
 * prixline.blog.
 *
 * Public surface:
 *   - extractOriginMediaUrls(text)  → origin-blog media URLs found in src,
 *     srcset and frontmatter fields (http/https + www normalized, entities
 *     decoded, query preserved)
 *   - mediaLocalPath(url)           → stable /media/uploads/YYYY/MM/<basename>
 *     preserving the uploads subpath (query strings stripped)
 *   - buildMediaMap(urls)           → Map<url, localPath>; query variants of
 *     the same file collapse, genuine basename collisions between different
 *     URLs get a deterministic short-hash suffix (order-independent)
 *   - rewriteMediaRefs(text, map)   → replaces origin media URLs inside
 *     request attributes (src/srcset/poster/data-src/data-lazy-src/
 *     data-srcset) and frontmatter scalar fields; href and inert data-*
 *     attributes (data-orig-file, data-large-file, data-permalink) stay
 *     untouched; idempotent
 *
 * Scope: origin blog = prixline.wordpress.com / prixline.blog (www-stripped)
 * whose path contains /wp-content/uploads/. Third-party hosts (other
 * *.files.wordpress.com, i0.wp.com proxies, …) are out of scope by contract.
 *
 * Run: node --test scripts/media.test.ts
 */
import { createHash } from "node:crypto";

/** Origin-blog hosts (lowercased, www-stripped). */
const ORIGIN_HOSTS: ReadonlySet<string> = new Set(["prixline.blog", "prixline.wordpress.com"]);

/** Path marker identifying WordPress media uploads inside a URL pathname. */
const UPLOADS_MARKER = "/wp-content/uploads/";

/** Named entities real origin markup uses inside attribute values. */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Decode numeric + named HTML entities (&#038; / &amp; …). */
export function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_m: string, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_m: string, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (m: string, name: string) => NAMED_ENTITIES[name] ?? m);
}

/** Parsed URL from an entity-decoded string; undefined when unparseable. */
function parseUrl(raw: string): URL | undefined {
  const decoded = decodeEntities(raw).trim();
  if (decoded === "") return undefined;
  try {
    return new URL(decoded);
  } catch {
    return undefined;
  }
}

/** Origin host lowercased with leading www. stripped; undefined otherwise. */
function originHost(raw: string): string | undefined {
  const u = parseUrl(raw);
  if (u === undefined || (u.protocol !== "http:" && u.protocol !== "https:")) return undefined;
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  return ORIGIN_HOSTS.has(host) ? host : undefined;
}

/** True when the URL is origin-blog media (host + /wp-content/uploads/ path). */
export function isOriginMediaUrl(raw: string): boolean {
  const u = parseUrl(raw);
  if (u === undefined || originHost(raw) === undefined) return false;
  return u.pathname.toLowerCase().includes(UPLOADS_MARKER);
}

/** Canonical origin-blog media host: the WP uploads origin, always fetchable. */
const CANONICAL_ORIGIN_HOST = "prixline.wordpress.com";

/**
 * Canonical origin media URL: https scheme, origin hosts collapsed to
 * prixline.wordpress.com (prixline.blog is the same install), query
 * preserved. Undefined for non-origin or unparseable input.
 */
export function canonicalOriginUrl(raw: string): string | undefined {
  const u = parseUrl(raw);
  if (u === undefined || originHost(raw) === undefined) return undefined;
  const port = u.port === "" ? "" : `:${u.port}`;
  const host = ORIGIN_HOSTS.has(u.hostname.toLowerCase().replace(/^www\./, ""))
    ? CANONICAL_ORIGIN_HOST
    : `${u.hostname.toLowerCase().replace(/^www\./, "")}${port}`;
  return `https://${host}${u.pathname}${u.search}`;
}

/**
 * Grouping identity for a media URL: https scheme, query stripped, origin
 * hosts collapsed to one token (prixline.blog and prixline.wordpress.com are
 * the same install). Unparseable input degrades to the entity-decoded string.
 */
export function normalizeMediaUrl(raw: string): string {
  const decoded = decodeEntities(raw).trim();
  const u = parseUrl(decoded);
  if (u === undefined) return decoded;
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const authority = ORIGIN_HOSTS.has(host) ? "origin" : `${host}${u.port === "" ? "" : `:${u.port}`}`;
  return `https://${authority}${u.pathname}`;
}

/** Filename-safe path segments: decoded, no empty/./.. segments. */
function safeSegments(subpath: string): string[] {
  let decoded = subpath;
  try {
    decoded = decodeURIComponent(subpath);
  } catch {
    /* malformed percent-encoding → keep raw */
  }
  return decoded.split("/").filter((s) => s !== "" && s !== "." && s !== "..");
}

/** Short deterministic hash suffix for collision disambiguation. */
function hash8(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex").slice(0, 8);
}

/**
 * Stable local path for one media URL: /media/uploads/<uploads subpath>.
 * Query strings and fragments are stripped; URLs without the uploads marker
 * fall back to /media/uploads/<path> (empty → hash-named file).
 */
export function mediaLocalPath(raw: string): string {
  const decoded = decodeEntities(raw).trim();
  const u = parseUrl(decoded);
  let pathname: string;
  if (u !== undefined) {
    pathname = u.pathname;
  } else {
    const cut = decoded.split(/[?#]/)[0] ?? decoded;
    pathname = cut.startsWith("/") ? cut : `/${cut}`;
  }
  const idx = pathname.toLowerCase().indexOf(UPLOADS_MARKER);
  const subpath =
    idx >= 0 ? pathname.slice(idx + UPLOADS_MARKER.length) : pathname.replace(/^\/+/, "");
  const segments = safeSegments(subpath);
  if (segments.length === 0) return `/media/uploads/${hash8(normalizeMediaUrl(decoded))}`;
  return `/media/uploads/${segments.join("/")}`;
}

/**
 * Request-triggering attributes whose values may carry media URLs.
 * Group 1 keeps the leading whitespace (or string start) plus `name=` so the
 * replacement round-trip never drops characters.
 */
const REQUEST_ATTR_RE =
  /((?:^|\s)(?:srcset|src|poster|data-srcset|data-lazy-src|data-src)\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;

/** Frontmatter block (opening --- … closing ---) or undefined. */
function frontmatterSlice(text: string): string | undefined {
  if (!text.startsWith("---")) return undefined;
  const closeIdx = text.indexOf("\n---", 3);
  return closeIdx === -1 ? undefined : text.slice(0, closeIdx);
}

/**
 * All origin-blog media URLs in a markdown/HTML document, from src, srcset
 * (and other request attrs) plus frontmatter scalar fields whose whole value
 * is an origin media URL (e.g. `thumbnail:`). Entity-decoded, http/https +
 * www normalized (https, host lowercased), query preserved, deduped in
 * document order.
 */
export function extractOriginMediaUrls(markdownOrHtml: string): string[] {
  const found: string[] = [];
  const push = (candidate: string): void => {
    // srcset candidates carry a descriptor after the URL ("url 300w"); the
    // URL itself is the first whitespace-delimited token.
    const firstToken = decodeEntities(candidate).trim().split(/\s+/)[0] ?? "";
    if (firstToken === "" || !isOriginMediaUrl(firstToken)) return;
    const canonical = canonicalOriginUrl(firstToken);
    const url = canonical ?? firstToken;
    if (!found.includes(url)) found.push(url);
  };

  const fm = frontmatterSlice(markdownOrHtml);
  if (fm !== undefined) {
    for (const line of fm.split("\n")) {
      const m = /^[A-Za-z_][\w-]*:[ \t]*(.+)$/.exec(line);
      if (m === null || m[1] === undefined) continue;
      const value = m[1].trim().replace(/^["']|["']$/g, "");
      if (isOriginMediaUrl(value)) push(value);
    }
  }

  for (let m = REQUEST_ATTR_RE.exec(markdownOrHtml); m !== null; m = REQUEST_ATTR_RE.exec(markdownOrHtml)) {
    const value = m[2] ?? m[3] ?? m[4] ?? "";
    if (value === "") continue;
    const isList = m[1].toLowerCase().includes("srcset");
    const candidates = isList ? value.split(",") : [value];
    for (const c of candidates) push(c);
  }
  return found;
}

/** Deterministic hash suffix insert before the extension (if any). */
function suffixedPath(path: string, normUrl: string): string {
  const h = hash8(normUrl);
  const extIdx = path.lastIndexOf(".");
  const slashIdx = path.lastIndexOf("/");
  return extIdx > slashIdx ? `${path.slice(0, extIdx)}-${h}${path.slice(extIdx)}` : `${path}-${h}`;
}

/**
 * Map every URL string to its local /media path. Grouping key is
 * normalizeMediaUrl (origin hosts collapsed, query stripped), so http/https/
 * www/query variants of one file share one path. When two genuinely
 * different files (different normalized URLs) land on the same path, EVERY
 * colliding member gets a deterministic `<name>-<hash8><ext>` suffix —
 * order-independent and stable across runs.
 */
export function buildMediaMap(urls: Iterable<string>): Map<string, string> {
  const groups = new Map<string, string[]>(); // normalized id → raw url keys
  for (const url of urls) {
    if (url === "") continue;
    const norm = normalizeMediaUrl(url);
    const list = groups.get(norm);
    if (list === undefined) groups.set(norm, [url]);
    else if (!list.includes(url)) list.push(url);
  }

  const owners = new Map<string, string[]>(); // local path → normalized ids
  const pathOf = new Map<string, string>(); // normalized id → local path
  for (const norm of groups.keys()) {
    const path = mediaLocalPath(norm);
    pathOf.set(norm, path);
    const list = owners.get(path);
    if (list === undefined) owners.set(path, [norm]);
    else list.push(norm);
  }

  const finalPath = new Map<string, string>();
  for (const [path, ids] of owners) {
    if (ids.length === 1) {
      finalPath.set(ids[0] ?? "", path);
    } else {
      for (const id of ids) finalPath.set(id, suffixedPath(path, id));
    }
  }

  const map = new Map<string, string>();
  for (const [norm, raws] of groups) {
    const local = finalPath.get(norm);
    if (local === undefined) continue;
    for (const raw of raws) map.set(raw, local);
  }
  return map;
}

/** URL-like substrings inside an attribute/frontmatter value. */
const URL_SUBSTR_RE = /https?:\/\/[^\s"',]+/gi;

/**
 * Replace every origin media URL in `text` with its local /media path.
 * Rewrites only request-attribute values (src/srcset/poster/data-src/
 * data-lazy-src/data-srcset) and frontmatter scalar values — href links and
 * inert data-* attributes (data-orig-file, data-large-file, data-permalink)
 * stay untouched by contract. Entity-encoded variants (&#038; / &amp;) of the
 * mapped URLs are matched too. Idempotent: a second pass is a no-op.
 */
export function rewriteMediaRefs(text: string, map: ReadonlyMap<string, string>): string {
  if (map.size === 0 || text === "") return text;
  const normMap = new Map<string, string>();
  for (const [key, local] of map) {
    if (key === "" || local === "") continue;
    normMap.set(normalizeMediaUrl(key), local);
  }
  if (normMap.size === 0) return text;

  const rewriteValue = (value: string): string =>
    value.replace(URL_SUBSTR_RE, (candidate: string) => {
      const trimmed = candidate.replace(/[,;]+$/, "");
      if (trimmed === "") return candidate;
      const local = normMap.get(normalizeMediaUrl(trimmed));
      return local !== undefined ? local + candidate.slice(trimmed.length) : candidate;
    });

  let out = text.replace(
    REQUEST_ATTR_RE,
    (match: string, prefix: string, dq?: string, sq?: string, bare?: string): string => {
      if (dq !== undefined) return `${prefix}"${rewriteValue(dq)}"`;
      if (sq !== undefined) return `${prefix}'${rewriteValue(sq)}'`;
      if (bare !== undefined && bare !== "") return `${prefix}${rewriteValue(bare)}`;
      return match;
    },
  );

  const fm = frontmatterSlice(out);
  if (fm !== undefined) {
    const rewritten = fm.replace(
      /^([A-Za-z_][\w-]*):[ \t]*(.*)$/gm,
      (line: string, key: string, value: string): string => {
        const next = rewriteValue(value);
        return next === value ? line : `${key}: ${next}`;
      },
    );
    out = rewritten + out.slice(fm.length);
  }
  return out;
}
