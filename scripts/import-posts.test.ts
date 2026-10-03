/**
 * scripts/import-posts.test.ts
 *
 * Test-first suite for the Prixline post importer (T3 of the content pipeline).
 * Asserts ONLY against the deterministic fixtures:
 *   - scripts/fixtures/posts-sample.json      (3 real posts)
 *   - scripts/fixtures/categories-sample.json (54 origin categories)
 * NO network access anywhere in this file.
 *
 * Run: node --test scripts/import-posts.test.ts
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CLEAN_CATEGORIES,
  cleanCategoryForName,
  mapCategories,
  originCategoryNames,
} from "./category-map.ts";
import { renderPost, type WpPost } from "./import-posts.ts";

const FIXTURE_POSTS_URL = new URL("./fixtures/posts-sample.json", import.meta.url);
const FIXTURE_CATEGORIES_URL = new URL("./fixtures/categories-sample.json", import.meta.url);

interface CategoryRecord {
  id: number;
  name: string;
  slug?: string;
  count?: number;
}

const fixturePromise = (async () => {
  const posts = JSON.parse(await readFile(FIXTURE_POSTS_URL, "utf8")) as WpPost[];
  const categories = JSON.parse(
    await readFile(FIXTURE_CATEGORIES_URL, "utf8"),
  ) as CategoryRecord[];
  return { posts, categories };
})();

/** Minimal frontmatter parser handling plain scalars and `  - item` lists. */
function parseFrontmatter(md: string): {
  fields: Record<string, string>;
  lists: Record<string, string[]>;
} {
  assert.ok(md.startsWith("---\n"), "markdown must start with frontmatter");
  const end = md.indexOf("\n---\n", 4);
  assert.notEqual(end, -1, "frontmatter must be closed with a --- line");
  const fields: Record<string, string> = {};
  const lists: Record<string, string[]> = {};
  const lines = md.slice(4, end).split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^  - /.test(line)) continue; // handled by list parsing below
    const sep = line.indexOf(":");
    assert.notEqual(sep, -1, `malformed frontmatter line: ${JSON.stringify(line)}`);
    const key = line.slice(0, sep);
    const rest = line.slice(sep + 1);
    if (rest === "") {
      // list field: subsequent `  - item` lines (or `  []`)
      const items: string[] = [];
      while (i + 1 < lines.length && /^  - /.test(lines[i + 1])) {
        const raw = lines[i + 1].slice(4);
        items.push(raw.startsWith('"') ? (JSON.parse(raw) as string) : raw);
        i++;
      }
      lists[key] = items;
      fields[key] = "";
    } else {
      const value = rest.startsWith(" ") ? rest.slice(1) : rest;
      fields[key] = value.startsWith('"') ? (JSON.parse(value) as string) : value;
    }
  }
  return { fields, lists };
}

function lookupFrom(categories: CategoryRecord[]): Map<number, string> {
  return new Map(categories.map((c) => [c.id, c.name]));
}

function idByName(categories: CategoryRecord[], name: string): number {
  const row = categories.find((c) => c.name === name);
  assert.ok(row !== undefined, `fixture category not found: ${name}`);
  return row.id;
}

test("all 3 fixture posts render to markdown", async () => {
  const { posts, categories } = await fixturePromise;
  const lookup = lookupFrom(categories);
  assert.equal(posts.length, 3);
  for (const post of posts) {
    const clean = mapCategories(post.categories ?? [], lookup);
    const md = renderPost(post, clean, originCategoryNames(post.categories ?? [], lookup));
    assert.ok(md.length > 0, `empty markdown for post ${post.id}`);
    assert.ok(md.startsWith("---\n"), `post ${post.id}: no frontmatter`);
    assert.ok(md.includes(`\n# ${post.title.rendered}\n`), `post ${post.id}: missing H1`);
    assert.ok(
      md.includes(post.content?.rendered?.trim() ?? ""),
      `post ${post.id}: original body missing`,
    );
  }
});

test("frontmatter fields present; date and id correct", async () => {
  const { posts, categories } = await fixturePromise;
  const lookup = lookupFrom(categories);
  for (const post of posts) {
    const clean = mapCategories(post.categories ?? [], lookup);
    const md = renderPost(post, clean, originCategoryNames(post.categories ?? [], lookup));
    const { fields, lists } = parseFrontmatter(md);
    assert.equal(fields.id, String(post.id), `post ${post.id}: id mismatch`);
    assert.equal(fields.date, post.date, `post ${post.id}: date mismatch`);
    assert.equal(fields.slug, post.slug, `post ${post.id}: slug mismatch`);
    assert.ok(fields.title.length > 0, `post ${post.id}: empty title`);
    assert.equal(fields.originUrl, post.link, `post ${post.id}: originUrl mismatch`);
    assert.ok(fields.sourceUrl.includes("/posts/"), `post ${post.id}: sourceUrl missing`);
    assert.ok(typeof fields.excerpt === "string", `post ${post.id}: excerpt missing`);
    assert.ok(!fields.excerpt.includes("<"), `post ${post.id}: excerpt still has HTML`);
    const cats = lists.categories ?? [];
    assert.ok(Array.isArray(cats) && cats.length > 0, `post ${post.id}: categories empty`);
    assert.deepEqual(cats, clean.slice().sort(), `post ${post.id}: categories not sorted-unique`);
    for (const c of cats) {
      assert.ok(
        (CLEAN_CATEGORIES as readonly string[]).includes(c),
        `post ${post.id}: non-clean category ${c}`,
      );
    }
    assert.ok(Array.isArray(lists.originCategories), `post ${post.id}: originCategories missing`);
  }
});

test("category mapping covers 100% of the 54 fixture categories", async () => {
  const { categories } = await fixturePromise;
  const lookup = lookupFrom(categories);
  assert.equal(categories.length, 54);
  for (const cat of categories) {
    const mapped = mapCategories([cat.id], lookup);
    assert.equal(
      mapped.length,
      1,
      `category ${cat.id} (${cat.name}) did not map to exactly one value`,
    );
    const value = mapped[0] as string;
    assert.ok(
      value !== undefined && value.length > 0,
      `category ${cat.id} (${cat.name}) mapped to empty/undefined`,
    );
    assert.ok(
      (CLEAN_CATEGORIES as readonly string[]).includes(value),
      `category ${cat.id} (${cat.name}) mapped to non-clean value: ${value}`,
    );
    assert.equal(value, cleanCategoryForName(cat.name));
  }
  const all = mapCategories(categories.map((c) => c.id), lookup);
  assert.deepEqual(all, [...all].sort(), "mapCategories output must be sorted");
  assert.equal(new Set(all).size, all.length, "mapCategories output must be unique");
});

test("known mappings verified", async () => {
  const { categories } = await fixturePromise;
  const lookup = lookupFrom(categories);
  const cases: Array<[string, string]> = [
    ["@AlertasEmpleo", "empleo"],
    ["b83066696", "sin-categoria"],
    ["Prácticas", "practicas"],
    ["mascurso.com", "formacion"],
  ];
  for (const [name, expected] of cases) {
    const id = idByName(categories, name);
    const mapped = mapCategories([id], lookup);
    assert.deepEqual(mapped, [expected], `${name} → ${mapped[0]} (expected ${expected})`);
  }
  // duplicates collapse through normalisation
  const practicas = idByName(categories, "Prácticas");
  const practicasLower = idByName(categories, "practicas");
  assert.deepEqual(mapCategories([practicas, practicasLower], lookup), ["practicas"]);
});

test("unknown id → sin-categoria; empty ids → empty list", async () => {
  const { categories } = await fixturePromise;
  const lookup = lookupFrom(categories);
  assert.deepEqual(mapCategories([999999999], lookup), ["sin-categoria"]);
  assert.deepEqual(mapCategories([], lookup), []);
  assert.deepEqual(mapCategories([51348], new Map()), ["sin-categoria"]);
});

test("YAML string values are emitted safely (@-values, numeric lookalikes)", () => {
  // Synthetic render: fixture posts contain no `@` values, so this exercises
  // the emitter against the exact shapes that broke js-yaml in production
  // (originCategories like `- @AlertasEmpleo` and `- 83066696`).
  const post: WpPost = {
    id: 1054,
    date: "2012-10-16T22:01:38",
    slug: "1054",
    link: "https://prixline.blog/2012/10/16/1054/",
    title: { rendered: "Webs de empleo&nbsp;sectoriales" },
    excerpt: { rendered: "Texto de ejemplo&hellip;" },
    content: { rendered: "<p>cuerpo</p>" },
    categories: [],
  };
  const origin = ["@AlertasEmpleo", "@AyudaExperta", "83066696"];
  const md = renderPost(post, ["empleo"], origin);

  // Raw emitted form: every YAML-unsafe string must come out quoted.
  assert.ok(
    md.includes('  - "@AlertasEmpleo"'),
    "originCategories item @AlertasEmpleo must be emitted quoted",
  );
  assert.ok(
    md.includes('  - "@AyudaExperta"'),
    "originCategories item @AyudaExperta must be emitted quoted",
  );
  assert.ok(
    md.includes('  - "83066696"'),
    "numeric-lookalike category must be emitted as a quoted string",
  );
  assert.ok(!/^\s*- @/m.test(md), "emitter must never write an unquoted '- @' list item");
  // id stays an unquoted number; date keeps its current unquoted behaviour.
  assert.ok(/^id: 1054$/m.test(md), "id must stay unquoted");
  assert.ok(
    /^date: 2012-10-16T22:01:38$/m.test(md),
    "date keeps its current unquoted behaviour",
  );
  // Round-trip: quoted scalars parse back to exactly the source strings.
  const { fields, lists } = parseFrontmatter(md);
  assert.deepEqual(lists.originCategories, origin, "originCategories must round-trip exactly");
  assert.deepEqual(lists.categories, ["empleo"], "clean categories must round-trip");
  assert.equal(fields.slug, "1054", "numeric-lookalike slug must round-trip as string");
  assert.equal(
    fields.title,
    "Webs de empleo&nbsp;sectoriales",
    "title must round-trip exactly",
  );
});
