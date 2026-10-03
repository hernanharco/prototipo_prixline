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
 *   excerpt (plain text)
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
    "---",
    "",
    `# ${title}`,
    "",
    body,
    "",
  ];
  return lines.join("\n");
}
