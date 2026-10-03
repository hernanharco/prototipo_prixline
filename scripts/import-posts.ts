/**
 * scripts/import-posts.ts
 *
 * Importer for the Prixline content pipeline (T3): pulls the 813 posts of
 * https://prixline.blog/ from the WordPress.com public API and writes one
 * content/posts/<slug>.md per post, with a cleaned category taxonomy.
 *
 * Pure parts live in:
 *   - scripts/category-map.ts  (mapCategories, CLEAN_CATEGORIES)
 *   - scripts/post-render.ts   (renderPost — re-exported below)
 * This file holds the CLI + the live-API paginator only.
 *
 * CLI (guarded by import.meta.url):
 *   --fixture   reads scripts/fixtures/posts-sample.json + categories-sample.json
 *               (NO network) and renders all fixture posts to stdout summary
 *               — dry run, writes nothing (fixture contents are truncated).
 *   default     paginates the live API (per_page=100&page=N) for BOTH posts
 *               and categories; nothing is written until every page has been
 *               fetched successfully; then writes one .md per post into
 *               content/posts/ (created if needed).
 *
 * Run: node scripts/import-posts.ts --fixture
 * Tests: node --test scripts/import-posts.test.ts (offline)
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { mapCategories, originCategoryNames } from "./category-map.ts";
import { POSTS_API_BASE, renderPost } from "./post-render.ts";

export { renderPost };
export type { WpPost } from "./post-render.ts";

const CATEGORIES_API_BASE =
  "https://public-api.wordpress.com/wp/v2/sites/prixline.blog/categories";
const PER_PAGE = 100;
const MAX_PAGES = 200; // safety cap: 813 posts ≈ 9 pages at per_page=100

const FIXTURE_POSTS_URL = new URL("./fixtures/posts-sample.json", import.meta.url);
const FIXTURE_CATEGORIES_URL = new URL("./fixtures/categories-sample.json", import.meta.url);
const POSTS_DIR = new URL("../content/posts/", import.meta.url);

type PostRecord = Parameters<typeof renderPost>[0];

interface CategoryRecord {
  id: number;
  name: string;
  slug?: string;
  count?: number;
}

/**
 * Paginate a WordPress.com REST collection endpoint. Collects every page in
 * memory and only returns when the fetch loop is complete — the caller
 * therefore writes nothing until all pages are in hand.
 */
async function fetchAllPages(urlBase: string): Promise<Array<Record<string, unknown>>> {
  const all: Array<Record<string, unknown>> = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${urlBase}?per_page=${PER_PAGE}&page=${page}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`API request failed (${res.status} ${res.statusText}): ${url}`);
    }
    const batch = (await res.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(batch) || batch.length === 0) break; // last page reached
    all.push(...batch);
    if (batch.length < PER_PAGE) break;
  }
  return all;
}

/** Live posts (all pages). Throws on any page failure — nothing partial. */
export async function fetchAllPosts(): Promise<PostRecord[]> {
  return (await fetchAllPages(POSTS_API_BASE)) as unknown as PostRecord[];
}

/** Live categories → id→name lookup used by mapCategories. */
export async function fetchCategoryLookup(): Promise<Map<number, string>> {
  const rows = (await fetchAllPages(CATEGORIES_API_BASE)) as unknown as CategoryRecord[];
  return new Map(rows.map((c) => [c.id, c.name]));
}

/** Fixture category lookup (offline, deterministic). */
export async function fixtureCategoryLookup(): Promise<Map<number, string>> {
  const rows = JSON.parse(await readFile(FIXTURE_CATEGORIES_URL, "utf8")) as CategoryRecord[];
  return new Map(rows.map((c) => [c.id, c.name]));
}

/** Fixture posts (offline, deterministic). */
export async function fixturePosts(): Promise<PostRecord[]> {
  return JSON.parse(await readFile(FIXTURE_POSTS_URL, "utf8")) as PostRecord[];
}

/** Render every post to markdown; pure w.r.t. its inputs. */
export function renderPosts(
  posts: PostRecord[],
  lookup: Map<number, string>,
): Array<{ post: PostRecord; md: string }> {
  return posts.map((post) => {
    const ids = post.categories ?? [];
    return {
      post,
      md: renderPost(post, mapCategories(ids, lookup), originCategoryNames(ids, lookup)),
    };
  });
}

/** CLI entry: returns the number of posts rendered (fixture) / written (live). */
export async function run(argv: string[]): Promise<number> {
  const useFixture = argv.includes("--fixture");

  if (useFixture) {
    const posts = await fixturePosts();
    const lookup = await fixtureCategoryLookup();
    const rendered = renderPosts(posts, lookup);
    for (const { post, md } of rendered) {
      const cats = mapCategories(post.categories ?? [], lookup).join(", ");
      console.log(`[fixture] ${post.id} "${post.slug}" → ${cats} (${md.length} chars)`);
    }
    console.log(
      `[fixture] Rendered ${rendered.length} post(s) from fixture — dry run, no files written (fixture content is truncated).`,
    );
    return rendered.length;
  }

  // Live mode: fetch EVERYTHING first; write only after all pages succeeded.
  const posts = await fetchAllPosts();
  const lookup = await fetchCategoryLookup();
  if (posts.length === 0) throw new Error("Live API returned 0 posts");

  await mkdir(POSTS_DIR, { recursive: true });
  const rendered = renderPosts(posts, lookup);
  for (const { post, md } of rendered) {
    const filename = `${post.slug || `post-${post.id}`}.md`;
    await writeFile(new URL(filename, POSTS_DIR), md, "utf8");
  }
  console.log(
    `Wrote ${rendered.length} post file(s) to content/posts/ (source: ${POSTS_API_BASE}).`,
  );
  return rendered.length;
}

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  run(process.argv.slice(2)).catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
