/**
 * scripts/extract-courses.ts
 *
 * Extractor for the Prixline content pipeline (T2): splits the WordPress
 * /cursos page of https://prixline.blog/ into one structured file per course.
 *
 * Pure, testable functions (no I/O):
 *   - parseCourses(html)   → Course[]  (boundary rule + defensive filtering)
 *   - slugify(title)       → ascii slug, unique-ified via an optional seen-map
 *   - renderMarkdown(...)  → frontmatter + body (extractedAt is passed in)
 *
 * CLI (guarded by import.meta.url): reads the fixture with --fixture (dry run,
 * never fetches and never writes), otherwise
 * fetches the live WordPress.com API page, then writes one .md per course into
 * content/courses/. Never fetches when --fixture is present.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export interface Course {
  title: string;
  slug: string;
  body: string;
  modules?: string[];
}

export const CURSO_PAGE_URL = "https://prixline.blog/cursos/";
export const LIVE_API_URL =
  "https://public-api.wordpress.com/wp/v2/sites/prixline.blog/pages?slug=cursos&_fields=content";

interface Block {
  /** Inner HTML of the block, before tag stripping. */
  raw: string;
  /** Plain text: tags removed, <br> → newline, entities decoded, whitespace normalised. */
  text: string;
}

const NAMED_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&nbsp;": " ",
};

export function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (m, name: string) => NAMED_ENTITIES[`&${name};`] ?? m);
}

function inlineText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ""));
}

function collapse(text: string): string {
  return text
    .replace(/[\s\u00a0]+/g, " ")
    .trim();
}

/** Split the HTML into block-level chunks (<p> / <h1..h6>), keeping raw + plain text. */
export function extractBlocks(html: string): Block[] {
  const blocks: Block[] = [];
  const re = /<(p|h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const inner = match[2].replace(/<br\s*\/?\s*>/gi, "\n");
    const plain = inlineText(inner)
      .replace(/[ \t\u00a0]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    blocks.push({ raw: match[2], text: plain });
  }
  return blocks;
}

/**
 * Course boundary rule (derived empirically from the fixture): a block whose
 * plain text starts with the uppercase word "CURSO" (the live page has no
 * heading elements — every course title sits in <p><a …>CURSO …</a></p>).
 * Case-sensitive on purpose: temario prose uses lowercase "Curso" mid-line and
 * must never open a course.
 */
const COURSE_HEADING_RE = /^CURSO\b/;

export function isCourseHeading(text: string): boolean {
  return COURSE_HEADING_RE.test(text.trim());
}

/** Title = first anchor inside the heading block whose text starts with CURSO. */
function headingTitle(block: Block): string {
  const anchorRe = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorRe.exec(block.raw)) !== null) {
    const text = collapse(inlineText(match[1]));
    if (text.startsWith("CURSO")) return text;
  }
  // Fallback: first line of the plain text (drop any keyword tail after <br>).
  const firstLine = block.text.split("\n")[0] ?? "";
  return collapse(firstLine);
}

function stripTitle(text: string, title: string): string {
  let rest: string;
  if (text.startsWith(title)) {
    rest = text.slice(title.length);
  } else {
    // Defensive: whitespace-normalisation drift — drop the heading line itself.
    const lines = text.split("\n");
    rest = lines.length > 0 && COURSE_HEADING_RE.test(lines[0]) ? lines.slice(1).join("\n") : text;
  }
  rest = rest.replace(/^[\s:;\-–—]+/, "");
  return rest.trim();
}

/** Paragraphs that carry no signal: bare punctuation like the stray ";" blocks. */
function isJunk(text: string): boolean {
  return /^[;.,:·•\-–—\s]*$/.test(text);
}

function normalizeBody(parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !isJunk(p))
    .join("\n\n")
    .trim();
}

export function extractModules(body: string): string[] {
  const modules: string[] = [];
  for (const line of body.split("\n")) {
    const t = collapse(line);
    if (/^(tema|m[óo]dulo|unidad de competencia)\b/i.test(t)) modules.push(t);
  }
  return modules;
}

/**
 * Split the page HTML into courses. Defensive: empty titles and empty bodies
 * are dropped; consecutive identical titles are deduplicated.
 */
export function parseCourses(html: string): Course[] {
  const blocks = extractBlocks(html);
  const seen = new Map<string, number>();
  const courses: Course[] = [];
  let current: { title: string; parts: string[] } | null = null;

  const flush = (): void => {
    if (!current) return;
    const title = current.title.trim();
    const body = normalizeBody(current.parts);
    const last = courses[courses.length - 1];
    const isConsecutiveDuplicate = last !== undefined && last.title === title;
    if (title.length > 0 && body.length > 0 && !isConsecutiveDuplicate) {
      const modules = extractModules(body);
      courses.push({
        title,
        slug: slugify(title, seen),
        body,
        ...(modules.length > 0 ? { modules } : {}),
      });
    }
    current = null;
  };

  for (const block of blocks) {
    if (isCourseHeading(block.text)) {
      flush();
      current = { title: headingTitle(block), parts: [] };
      const remainder = stripTitle(block.text, current.title);
      if (remainder.length > 0 && !isJunk(remainder)) current.parts.push(remainder);
    } else if (current) {
      current.parts.push(block.text);
    }
  }
  flush();
  return courses;
}

/**
 * Stable ascii-safe slug. With an optional `seen` map, collisions are
 * unique-ified by appending -2, -3, … (first occurrence keeps the base slug).
 */
export function slugify(title: string, seen?: Map<string, number>): string {
  const base =
    title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "curso";
  if (!seen) return base;
  const count = (seen.get(base) ?? 0) + 1;
  seen.set(base, count);
  return count === 1 ? base : `${base}-${count}`;
}

function yamlScalar(value: string): string {
  const plainSafe = /^[\w ./:@+-]+$/.test(value) && !value.includes(": ") && !value.includes(" #");
  return plainSafe ? value : JSON.stringify(value);
}

/** Pure: frontmatter (title, slug, sourceUrl, extractedAt) + heading + body. */
export function renderMarkdown(course: Course, sourceUrl: string, extractedAt: string): string {
  const lines = [
    "---",
    `title: ${yamlScalar(course.title)}`,
    `slug: ${course.slug}`,
    `sourceUrl: ${yamlScalar(sourceUrl)}`,
    `extractedAt: ${extractedAt}`,
    "---",
    "",
    `# ${course.title}`,
    "",
    course.body.trim(),
    "",
  ];
  return lines.join("\n");
}

const FIXTURE_URL = new URL("./fixtures/cursos-sample.html", import.meta.url);
const COURSES_DIR = new URL("../content/courses/", import.meta.url);

/** CLI entry: live mode writes course files; --fixture is a dry run (no writes).
 *  Returns the number of courses parsed either way. */
export async function run(argv: string[]): Promise<number> {
  const useFixture = argv.includes("--fixture");
  const extractedAtArg = argv.find((a) => a.startsWith("--extracted-at="));
  const extractedAt = extractedAtArg
    ? extractedAtArg.slice("--extracted-at=".length)
    : new Date().toISOString();

  let html: string;
  let sourceLabel: string;
  if (useFixture) {
    html = await readFile(FIXTURE_URL, "utf8");
    sourceLabel = "fixture";
  } else {
    const res = await fetch(LIVE_API_URL);
    if (!res.ok) throw new Error(`Live API request failed: ${res.status} ${res.statusText}`);
    const data = (await res.json()) as Array<{ content?: { rendered?: string } }>;
    html = data[0]?.content?.rendered ?? "";
    if (html.length === 0) throw new Error("Live API returned no rendered content");
    sourceLabel = LIVE_API_URL;
  }

  const courses = parseCourses(html);
  if (useFixture) {
    console.log(`Dry run: parsed ${courses.length} course(s) from fixture (no files written)`);
    return courses.length;
  }
  await mkdir(COURSES_DIR, { recursive: true });
  for (const course of courses) {
    const md = renderMarkdown(course, CURSO_PAGE_URL, extractedAt);
    await writeFile(new URL(`${course.slug}.md`, COURSES_DIR), md, "utf8");
  }
  console.log(`Wrote ${courses.length} course file(s) to content/courses/ (source: ${sourceLabel})`);
  return courses.length;
}

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  run(process.argv.slice(2)).catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
