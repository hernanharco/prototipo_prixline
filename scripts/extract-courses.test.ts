/**
 * scripts/extract-courses.test.ts
 *
 * Test-first suite for the Prixline course extractor (T2 of the content pipeline).
 * Asserts ONLY against the deterministic fixture scripts/fixtures/cursos-sample.html
 * (60.005 chars captured from https://prixline.blog/cursos/). No network access.
 *
 * Run: node --test scripts/extract-courses.test.ts
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseCourses, renderMarkdown, slugify } from "./extract-courses.ts";

const FIXTURE_URL = new URL("./fixtures/cursos-sample.html", import.meta.url);
const SOURCE_URL = "https://prixline.blog/cursos/";
const EXTRACTED_AT = "2026-10-03T00:00:00.000Z";

/**
 * Empirically determined once from the fixture: exactly 22 blocks whose plain
 * text starts with the uppercase word "CURSO" (all of them <p><a …>CURSO …</a></p>;
 * the file contains zero heading elements). Pinned here as the contract.
 */
const EXPECTED_COURSE_COUNT = 22;

const fixturePromise = readFile(FIXTURE_URL, "utf8");

/** Minimal frontmatter parser for round-trip assertions. */
function parseFrontmatter(md: string): { fields: Record<string, string>; body: string } {
  assert.ok(md.startsWith("---\n"), "markdown must start with frontmatter");
  const end = md.indexOf("\n---\n", 4);
  assert.notEqual(end, -1, "frontmatter must be closed with a --- line");
  const fields: Record<string, string> = {};
  for (const line of md.slice(4, end).split("\n")) {
    const sep = line.indexOf(": ");
    assert.notEqual(sep, -1, `malformed frontmatter line: ${JSON.stringify(line)}`);
    const key = line.slice(0, sep);
    let value = line.slice(sep + 2);
    if (value.startsWith('"')) value = JSON.parse(value) as string;
    fields[key] = value;
  }
  const body = md.slice(end + "\n---\n".length).trim();
  return { fields, body };
}

test("parseCourses pins the exact course count of the fixture", async () => {
  const courses = parseCourses(await fixturePromise);
  assert.equal(courses.length, EXPECTED_COURSE_COUNT);
});

test("every fixture course has a non-empty title, a non-empty body and a unique slug", async () => {
  const courses = parseCourses(await fixturePromise);
  const slugs = new Set<string>();
  const titles = new Set<string>();
  for (const [i, course] of courses.entries()) {
    assert.ok(course.title.trim().length > 0, `course #${i} has an empty title`);
    assert.ok(course.body.trim().length > 0, `course #${i} (${course.title}) has an empty body`);
    assert.match(course.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `course #${i} slug is not ascii-safe: ${course.slug}`);
    assert.ok(!slugs.has(course.slug), `duplicate slug: ${course.slug}`);
    assert.ok(!titles.has(course.title), `consecutive duplicate title survived: ${course.title}`);
    slugs.add(course.slug);
    titles.add(course.title);
  }
});

test("a known fixture course is present with a non-empty temario", async () => {
  const courses = parseCourses(await fixturePromise);
  const cm = courses.find((c) => c.title === "CURSO DE COMMUNITY MANAGER");
  assert.ok(cm, "CURSO DE COMMUNITY MANAGER missing from fixture parse");
  assert.equal(cm.slug, "curso-de-community-manager");
  assert.match(cm.body, /La figura de un community manager/i);
  assert.match(cm.body, /Reputaci[óo]n online/i);

  const psi = courses.find((c) => c.title === "CURSO DE TÉCNICO EN PSICOMOTRICIDAD");
  assert.ok(psi, "CURSO DE TÉCNICO EN PSICOMOTRICIDAD missing from fixture parse");
  assert.match(psi.body, /Tema 1:\s*ESTRUCTURA, CONTENIDOS Y METODOLOG[ÍI]A/i);
  assert.ok((psi.modules ?? []).length > 0, "psicomotricidad course should expose modules");
});

test("renderMarkdown round-trips every frontmatter field and the body", async () => {
  const courses = parseCourses(await fixturePromise);
  const course = courses.find((c) => c.title === "CURSO DE COMMUNITY MANAGER");
  assert.ok(course);
  const md = renderMarkdown(course, SOURCE_URL, EXTRACTED_AT);
  const { fields, body } = parseFrontmatter(md);
  assert.equal(fields.title, course.title);
  assert.equal(fields.slug, course.slug);
  assert.equal(fields.sourceUrl, SOURCE_URL);
  assert.equal(fields.extractedAt, EXTRACTED_AT);
  assert.ok(body.length > 0, "rendered markdown body must not be empty");
  // renderMarkdown emits an H1 title heading after the frontmatter; the course
  // body itself must follow verbatim.
  const tail = body.replace(/^# .*\n+/, "");
  assert.ok(tail.startsWith(course.body.trim().slice(0, 40)), "body must be preserved verbatim");
});

test("slugify is stable, ascii-safe and unique-ifies collisions with -2, -3", () => {
  assert.equal(slugify("CURSO DE TÉCNICO EN PSICOMOTRICIDAD"), "curso-de-tecnico-en-psicomotricidad");
  assert.equal(slugify("  CURSO   DE  ENOLOGÍA  "), "curso-de-enologia");
  const seen = new Map<string, number>();
  assert.equal(slugify("Curso de Prueba", seen), "curso-de-prueba");
  assert.equal(slugify("CURSO DE PRUEBA", seen), "curso-de-prueba-2");
  assert.equal(slugify("curso de prueba", seen), "curso-de-prueba-3");
});

test("parseCourses drops empty bodies and dedupes consecutive identical titles", () => {
  const synthetic = [
    '<p><a title="A" href="#">CURSO DE ALPHA</a></p>',
    "<p>Tema 1: contenido alpha</p>",
    '<p><a title="A" href="#">CURSO DE ALPHA</a></p>',
    "<p>Tema 2: contenido alpha dos</p>",
    '<p><a title="B" href="#">CURSO DE BETA</a></p>',
    "<p>contenido beta</p>",
    '<p><a title="C" href="#">CURSO DE GAMMA</a></p>',
  ].join("\n");
  const courses = parseCourses(synthetic);
  assert.equal(courses.length, 2, "expected: ALPHA (deduped) + BETA; GAMMA dropped for empty body");
  assert.equal(courses[0].title, "CURSO DE ALPHA");
  assert.match(courses[0].body, /contenido alpha/);
  assert.doesNotMatch(courses[0].body, /contenido alpha dos/);
  assert.equal(courses[1].title, "CURSO DE BETA");
});
