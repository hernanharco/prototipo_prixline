/**
 * scripts/import-pages.ts
 *
 * Importer for the Prixline content pipeline (T4): pulls the 4 static pages
 * (practicas, redes, contacto, opiniones) of https://prixline.blog/ from the
 * WordPress.com public API and renders each one to content/pages/<slug>.md.
 *
 * Pure part:
 *   - renderPage(page, extractedAt) → markdown (frontmatter + `# title` H1 +
 *     original HTML body — same shape as scripts/extract-courses.ts)
 *
 * CLI (guarded by import.meta.url):
 *   --fixture   reads scripts/fixtures/pages-sample.json (NO network) and
 *               prints what would be written — dry run, writes nothing.
 *   default     fetches each page live from the API and writes one .md per
 *               page into content/pages/ (created if needed).
 *
 * Run: node scripts/import-pages.ts --fixture
 * Tests: node --test scripts/import-pages.test.ts (offline)
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { yamlScalar } from "./post-render.ts";

/** WordPress REST page record (subset used by the pipeline). */
export interface WpPage {
  slug: string;
  title: string | { rendered?: string };
  link: string;
  content?: { rendered?: string };
}

/** Where the pipeline records the data came from (public API). */
export const PAGES_API_BASE =
  "https://public-api.wordpress.com/wp/v2/sites/prixline.blog/pages";

/** Static pages imported by T4 (`cursos` is handled by extract-courses.ts). */
export const PAGE_SLUGS = ["practicas", "redes", "contacto", "opiniones"] as const;

/** API record URL for one page (slug is the record identifier). */
export function pageSourceUrl(slug: string): string {
  return `${PAGES_API_BASE}?slug=${slug}`;
}

/** Title as plain string (fixture) or WP rendered object (live API). */
function pageTitle(page: WpPage): string {
  return typeof page.title === "string" ? page.title : (page.title?.rendered ?? "");
}

/**
 * Pure renderer: markdown for one page.
 *
 * Frontmatter fields (order fixed): title, slug, sourceUrl (API record URL),
 * originUrl (permalink = page.link), extractedAt (passed in).
 * Then `# title` H1 + the original HTML body — same shape as extract-courses.
 */
export function renderPage(page: WpPage, extractedAt: string): string {
  const title = pageTitle(page);
  const body = (page.content?.rendered ?? "").trim();
  const lines = [
    "---",
    `title: ${yamlScalar(title)}`,
    `slug: ${yamlScalar(page.slug)}`,
    `sourceUrl: ${yamlScalar(pageSourceUrl(page.slug))}`,
    `originUrl: ${yamlScalar(page.link)}`,
    `extractedAt: ${extractedAt}`,
    "---",
    "",
    `# ${title}`,
    "",
    body,
    "",
  ];
  return lines.join("\n");
}

const FIXTURE_PAGES_URL = new URL("./fixtures/pages-sample.json", import.meta.url);
const PAGES_DIR = new URL("../content/pages/", import.meta.url);

/** Fixture pages (offline, deterministic). */
async function fixturePages(): Promise<WpPage[]> {
  return JSON.parse(await readFile(FIXTURE_PAGES_URL, "utf8")) as WpPage[];
}

/** Live pages: one API request per slug. Throws on any failure. */
async function fetchLivePages(): Promise<WpPage[]> {
  const pages: WpPage[] = [];
  for (const slug of PAGE_SLUGS) {
    const url = `${PAGES_API_BASE}?slug=${slug}&_fields=slug,title,content,link`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Live API request failed (${res.status} ${res.statusText}): ${url}`);
    const rows = (await res.json()) as WpPage[];
    const row = rows[0];
    if (!row) throw new Error(`Live API returned no page for slug=${slug}`);
    pages.push(row);
  }
  return pages;
}

/** CLI entry: returns the number of pages rendered (fixture) / written (live). */
export async function run(argv: string[]): Promise<number> {
  const useFixture = argv.includes("--fixture");
  const extractedAtArg = argv.find((a) => a.startsWith("--extracted-at="));
  const extractedAt = extractedAtArg
    ? extractedAtArg.slice("--extracted-at=".length)
    : new Date().toISOString();

  const pages = useFixture ? await fixturePages() : await fetchLivePages();
  const rendered = pages.map((page) => ({ page, md: renderPage(page, extractedAt) }));

  if (useFixture) {
    for (const { page, md } of rendered) {
      console.log(
        `[fixture] ${page.slug} "${pageTitle(page)}" → content/pages/${page.slug}.md (${md.length} chars)`,
      );
    }
    console.log(
      `[fixture] Rendered ${rendered.length} page(s) from fixture — dry run, no files written.`,
    );
    return rendered.length;
  }

  await mkdir(PAGES_DIR, { recursive: true });
  for (const { page, md } of rendered) {
    await writeFile(new URL(`${page.slug}.md`, PAGES_DIR), md, "utf8");
  }
  console.log(
    `Wrote ${rendered.length} page file(s) to content/pages/ (source: ${PAGES_API_BASE}).`,
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
