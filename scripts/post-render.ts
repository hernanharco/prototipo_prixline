/**
 * scripts/post-render.ts
 *
 * Pure markdown renderer for Prixline posts (T3 of the content pipeline).
 * Same shape as scripts/extract-courses.ts renderMarkdown(): frontmatter
 * block + `# title` H1 + original body.
 *
 * No I/O, no network — safe for offline tests.
 */
import { decodeEntities } from "./extract-courses.ts";
import { SIN_CATEGORIA } from "./category-map.ts";

/** WordPress REST post record (subset used by the pipeline). */
export interface WpPost {
  id: number;
  date: string;
  slug: string;
  link: string;
  title: { rendered: string };
  excerpt?: { rendered?: string };
  content?: { rendered?: string };
  categories?: number[];
}

/** Where the pipeline records the data came from (public API). */
export const POSTS_API_BASE =
  "https://public-api.wordpress.com/wp/v2/sites/prixline.blog/posts";

/** Origin site home; originUrl = SITE_HOME-relative permalink (post.link). */
export const SITE_HOME = "https://prixline.blog/";

/** Strip HTML tags, decode entities, collapse whitespace → plain text. */
export function htmlToPlainText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ""))
    .replace(/[\s\u00a0]+/g, " ")
    .trim();
}

/** Media extracted from a post body: absent fields are omitted, never "". */
export interface ThumbnailInfo {
  thumbnail?: string;
  videoId?: string;
}

/** YouTube video ids are exactly 11 chars from [A-Za-z0-9_-]. */
const YT_ID = String.raw`([A-Za-z0-9_-]{11})`;

/** YouTube URL patterns, in priority order (embed before plain links). */
const YT_PATTERNS: RegExp[] = [
  new RegExp(String.raw`youtube\.com/embed/${YT_ID}`),
  new RegExp(String.raw`youtube\.com/watch\?(?:[^\s"'<>]*&)?v=${YT_ID}`),
  new RegExp(String.raw`youtu\.be/${YT_ID}`),
  new RegExp(String.raw`youtube-nocookie\.com/embed/${YT_ID}`),
];

/** All `<img ...>` open tags are scanned; see extractThumbnail. */

/**
 * Attribute value from an img tag: double-quoted, single-quoted or bare.
 * Returns undefined when the attribute is absent.
 */
function imgAttr(tag: string, name: string): string | undefined {
  const re = new RegExp(
    String.raw`(?:^|\s)${name}\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))`,
    "i",
  );
  const m = re.exec(tag);
  if (!m) return undefined;
  const value = m[1] ?? m[2] ?? m[3];
  return value === undefined || value === "" ? undefined : value;
}

/** First URL candidate of a srcset value (`url 600w, url 300w`). */
function firstSrcsetUrl(value: string): string | undefined {
  const first = value.split(",")[0];
  if (first === undefined) return undefined;
  const url = first.trim().split(/\s+/)[0];
  return url === undefined || url === "" ? undefined : url;
}

/** Absolute http(s) URL after entity decoding; undefined otherwise. */
function absoluteHttpUrl(raw: string): string | undefined {
  const decoded = decodeEntities(raw).trim();
  return /^https?:\/\/\S+$/i.test(decoded) ? decoded : undefined;
}

/**
 * Low-value image detection (T11 quality filter, parent decision):
 * reblog-snapshot author avatars are technically valid <img> tags but
 * worthless as card thumbnails. Checks in spec order:
 *   1. the tag's `class` attribute contains "avatar",
 *   2. the URL host is gravatar.com or *.gravatar.com,
 *   3. the URL path contains "/avatar/",
 *   4. the URL carries an avatar size param `s=<n>` with n <= 128.
 * Returns true → the caller must reject this candidate and keep scanning.
 */
function isAvatarImage(tag: string, url: string): boolean {
  const cls = imgAttr(tag, "class");
  if (cls !== undefined && cls.toLowerCase().includes("avatar")) return true;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false; // absoluteHttpUrl already guarantees a parseable URL
  }
  const host = parsed.hostname.toLowerCase();
  if (host === "gravatar.com" || host.endsWith(".gravatar.com")) return true;
  if (parsed.pathname.toLowerCase().includes("/avatar/")) return true;
  const s = parsed.searchParams.get("s");
  if (s !== null && /^\d+$/.test(s) && Number(s) <= 128) return true;
  return false;
}

/**
 * Pure thumbnail extractor for a rendered post body (T11).
 *
 * Priority:
 *   1. YouTube (embed/watch/youtu.be/nocookie) → videoId + stable
 *      `https://i.ytimg.com/vi/<id>/hqdefault.jpg` thumbnail.
 *   2. First QUALIFYING `<img>`: src, then data-lazy-src, data-src, then
 *      the first data-srcset/srcset candidate. The URL must be absolute
 *      http(s). Low-value images (avatars/identicons, see isAvatarImage)
 *      and unusable tags (relative/data: URIs) are rejected and scanning
 *      CONTINUES to the next <img> tag — a post whose first img is an
 *      avatar but which later embeds a real image still gets that image.
 *   3. No qualifying media → both fields absent (never empty strings).
 *
 * Entity-decodes candidates (real origin markup carries `&#038;` in URLs).
 * No WP size-suffix stripping: origin media sizes via `?w=&h=` query params,
 * and path-suffix stripping on foreign hosts is not verifiable offline
 * (spec allows keeping the URL as-is).
 */
export function extractThumbnail(html: string): ThumbnailInfo {
  for (const pattern of YT_PATTERNS) {
    const m = pattern.exec(html);
    if (m?.[1] !== undefined) {
      return { videoId: m[1], thumbnail: `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` };
    }
  }
  const imgTag = /<img\b[^>]*>/gi;
  for (let m = imgTag.exec(html); m !== null; m = imgTag.exec(html)) {
    const tag = m[0];
    let candidate: string | undefined;
    for (const name of ["src", "data-lazy-src", "data-src"]) {
      const raw = imgAttr(tag, name);
      if (raw !== undefined) {
        const url = absoluteHttpUrl(raw);
        if (url !== undefined) {
          candidate = url;
          break;
        }
      }
    }
    if (candidate === undefined) {
      for (const name of ["data-srcset", "srcset"]) {
        const raw = imgAttr(tag, name);
        if (raw !== undefined) {
          const url = absoluteHttpUrl(firstSrcsetUrl(raw) ?? "");
          if (url !== undefined) {
            candidate = url;
            break;
          }
        }
      }
    }
    if (candidate === undefined) continue; // unusable tag → next <img>
    if (isAvatarImage(tag, candidate)) continue; // avatar → next <img>
    return { thumbnail: candidate };
  }
  return {};
}

/**
 * YAML string emitter: always JSON-quote string values.
 *
 * `JSON.stringify(s)` output is valid YAML double-quoted style, and quoting is
 * what keeps js-yaml 4 (the parser Astro uses) from rejecting or re-typing
 * values: unquoted `@Foo` scalars are YAML 1.1 reserved indicators (hard
 * parse error), and unquoted numeric lookalikes like `83066696` silently
 * become numbers. Parent decision (T5): every string value this renderer
 * writes — frontmatter scalars AND list items — is emitted quoted.
 *
 * Exception: `id` (number) and `date` (ISO timestamp) are emitted raw in
 * renderPost(), not through this function.
 */
export function yamlScalar(value: string): string {
  return JSON.stringify(value);
}

/** Emit a YAML list field with `key:` + `  - item` lines. */
function yamlList(key: string, items: string[]): string[] {
  const lines = [`${key}:`];
  if (items.length === 0) {
    lines.push("  []");
    return lines;
  }
  for (const item of items) lines.push(`  - ${yamlScalar(item)}`);
  return lines;
}

/**
 * Pure renderer: markdown for one post.
 *
 * Frontmatter fields (order fixed):
 *   id, title, date, slug, sourceUrl, originUrl,
 *   categories (clean list), originCategories (origin names, traceability),
 *   excerpt (plain text),
 *   thumbnail (optional, when media found), videoId (optional, YouTube),
 *   thumbnailAlt (ALWAYS emitted, initially "" — CMS-editable; the renderer
 *   may override it later from the panel, see comment in the field block)
 * then `# title` H1 + the original HTML body — same shape as extract-courses.
 *
 * `originCategoryNames` is optional (spec signature renderPost(post, clean));
 * when provided it fills the traceability field in the same order as the
 * origin category ids. Without it the field is empty.
 */
export function renderPost(
  post: WpPost,
  cleanCategories: string[],
  originCategoryNames: string[] = [],
): string {
  const title = post.title?.rendered ?? "";
  const excerpt = htmlToPlainText(post.excerpt?.rendered ?? "");
  const body = (post.content?.rendered ?? "").trim();
  const clean = (cleanCategories.length > 0 ? cleanCategories : [SIN_CATEGORIA]).slice().sort();
  const { thumbnail, videoId } = extractThumbnail(body);

  const lines = [
    "---",
    `id: ${post.id}`,
    `title: ${yamlScalar(title)}`,
    `date: ${post.date}`,
    `slug: ${yamlScalar(post.slug)}`,
    `sourceUrl: ${yamlScalar(`${POSTS_API_BASE}/${post.id}`)}`,
    `originUrl: ${yamlScalar(post.link)}`,
    ...yamlList("categories", clean),
    ...yamlList("originCategories", originCategoryNames),
    `excerpt: ${yamlScalar(excerpt)}`,
    // T11 CMS rule: every image is a data field, never hardcoded in a
    // component. thumbnail/videoId are omitted (not "") when the origin
    // content has no media.
    ...(thumbnail !== undefined ? [`thumbnail: ${yamlScalar(thumbnail)}`] : []),
    ...(videoId !== undefined ? [`videoId: ${yamlScalar(videoId)}`] : []),
    // thumbnailAlt: ALWAYS emitted, initially empty — an explicit
    // CMS-editable field per the user requirement. The importer cannot infer
    // the image's meaning, so the editor fills it from the panel; the
    // renderer may override this value later from the panel without code
    // changes (components read only the data field).
    `thumbnailAlt: ${yamlScalar("")}`,
    "---",
    "",
    `# ${title}`,
    "",
    body,
    "",
  ];
  return lines.join("\n");
}
