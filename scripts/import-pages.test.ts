/**
 * scripts/import-pages.test.ts
 *
 * Test-first suite for the Prixline static-page importer + social-settings
 * extractor (T4 of the content pipeline). Asserts ONLY against the
 * deterministic fixture:
 *   - scripts/fixtures/pages-sample.json  (practicas, redes, contacto, opiniones)
 * NO network access anywhere in this file.
 *
 * Run: node --test scripts/import-pages.test.ts
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderPage, type WpPage } from "./import-pages.ts";
import {
  buildSiteSettings,
  buildSocialSettings,
  LIVE_CHECK_INTERVAL_SECONDS,
  parseChannels,
} from "./import-settings.ts";

const FIXTURE_PAGES_URL = new URL("./fixtures/pages-sample.json", import.meta.url);

const EXPECTED_SLUGS = ["practicas", "redes", "contacto", "opiniones"] as const;
const EXTRACTED_AT = "2024-06-01T00:00:00.000Z";
const SOURCE_URL = "https://public-api.wordpress.com/wp/v2/sites/prixline.blog/pages?slug=redes";

const fixturePromise = (async () => {
  const pages = JSON.parse(await readFile(FIXTURE_PAGES_URL, "utf8")) as WpPage[];
  return pages;
})();

/** Minimal frontmatter parser for plain `key: value` lines (no lists). */
function parseFrontmatter(md: string): Record<string, string> {
  assert.ok(md.startsWith("---\n"), "markdown must start with frontmatter");
  const end = md.indexOf("\n---\n", 4);
  assert.notEqual(end, -1, "frontmatter must be closed with a --- line");
  const fields: Record<string, string> = {};
  for (const line of md.slice(4, end).split("\n")) {
    const sep = line.indexOf(":");
    assert.notEqual(sep, -1, `malformed frontmatter line: ${JSON.stringify(line)}`);
    const key = line.slice(0, sep);
    const rest = line.slice(sep + 1);
    const value = rest.startsWith(" ") ? rest.slice(1) : rest;
    fields[key] = value.startsWith('"') ? (JSON.parse(value) as string) : value;
  }
  return fields;
}

test("fixture holds the 4 expected pages", async () => {
  const pages = await fixturePromise;
  assert.equal(pages.length, 4);
  assert.deepEqual(pages.map((p) => p.slug), [...EXPECTED_SLUGS]);
});

test("all 4 fixture pages render with correct frontmatter", async () => {
  const pages = await fixturePromise;
  for (const page of pages) {
    const md = renderPage(page, EXTRACTED_AT);
    assert.ok(md.startsWith("---\n"), `${page.slug}: no frontmatter`);
    const fields = parseFrontmatter(md);
    assert.equal(fields.title, page.title, `${page.slug}: title mismatch`);
    assert.equal(fields.slug, page.slug, `${page.slug}: slug mismatch`);
    assert.equal(fields.originUrl, page.link, `${page.slug}: originUrl mismatch`);
    assert.equal(fields.extractedAt, EXTRACTED_AT, `${page.slug}: extractedAt mismatch`);
    assert.ok(fields.sourceUrl.includes("/pages"), `${page.slug}: sourceUrl missing API base`);
    assert.ok(
      fields.sourceUrl.includes(page.slug),
      `${page.slug}: sourceUrl does not reference the record slug`,
    );
    assert.ok(
      md.includes(`\n# ${page.title}\n`),
      `${page.slug}: missing H1 heading`,
    );
    const body = page.content?.rendered?.trim() ?? "";
    assert.ok(body.length > 0, `${page.slug}: empty fixture body`);
    assert.ok(md.includes(body), `${page.slug}: original HTML body missing`);
  }
});

test("redes page yields at least 10 channels", async () => {
  const pages = await fixturePromise;
  const redes = pages.find((p) => p.slug === "redes");
  assert.ok(redes !== undefined, "fixture redes page missing");
  const channels = parseChannels(redes.content?.rendered ?? "");
  assert.ok(channels.length >= 10, `expected >= 10 channels, got ${channels.length}`);
});

test("YouTube channel resolves to https://youtube.com/@prixline", async () => {
  const pages = await fixturePromise;
  const redes = pages.find((p) => p.slug === "redes");
  assert.ok(redes !== undefined, "fixture redes page missing");
  const channels = parseChannels(redes.content?.rendered ?? "");
  const youtube = channels.find((c) => c.platform === "youtube");
  assert.ok(youtube !== undefined, "no youtube channel extracted");
  assert.equal(youtube.url, "https://youtube.com/@prixline");
  assert.equal(youtube.label, "YouTube");
});

test("every channel has a non-empty platform and an http(s) url", async () => {
  const pages = await fixturePromise;
  const redes = pages.find((p) => p.slug === "redes");
  assert.ok(redes !== undefined, "fixture redes page missing");
  const channels = parseChannels(redes.content?.rendered ?? "");
  assert.ok(channels.length > 0);
  for (const channel of channels) {
    assert.ok(
      typeof channel.platform === "string" && channel.platform.length > 0,
      `empty platform for ${JSON.stringify(channel)}`,
    );
    assert.ok(
      typeof channel.label === "string" && channel.label.length > 0,
      `empty label for ${JSON.stringify(channel)}`,
    );
    assert.match(
      channel.url,
      /^https?:\/\/\S+$/,
      `url is not http(s) for ${JSON.stringify(channel)}`,
    );
  }
});

test("prose lines without URLs are excluded from channels", () => {
  const html = [
    "<p>Esto es prosa sin ningún enlace.</p>",
    "<p>Otra línea meramente informativa.</p>",
    '<p>👍 <strong>YouTube</strong>: <a href="https://youtube.com/@prixline?si=xyz">link</a></p>',
  ].join("\n");
  const channels = parseChannels(html);
  assert.equal(channels.length, 1, `expected only the URL line to survive: ${JSON.stringify(channels)}`);
  assert.equal(channels[0]?.platform, "youtube");
});

test("urls are canonicalised: query stripped, http→https only for the 4 hosts", async () => {
  const pages = await fixturePromise;
  const redes = pages.find((p) => p.slug === "redes");
  assert.ok(redes !== undefined, "fixture redes page missing");
  const channels = parseChannels(redes.content?.rendered ?? "");
  const byPlatform = new Map(channels.map((c) => [c.platform, c.url]));
  // http→https applied: instagram + twitter + linkedin hosts
  assert.match(byPlatform.get("instagram") ?? "", /^https:\/\//);
  assert.match(byPlatform.get("twitter") ?? "", /^https:\/\//);
  assert.match(byPlatform.get("linkedin") ?? "", /^https:\/\//);
  // query strings stripped
  assert.equal(byPlatform.get("spotify"), "https://open.spotify.com/show/16GIk745t5L6hxFMNQcoVK");
  // hosts OUTSIDE the 4-host list keep their original protocol (http stays)
  assert.match(byPlatform.get("pinterest") ?? "", /^http:\/\//);
});

test("site.json shape validates", () => {
  const settings = buildSiteSettings(SOURCE_URL, EXTRACTED_AT);
  assert.equal(settings.name, "Prixline");
  assert.ok(typeof settings.tagline === "string" && settings.tagline.length > 0, "tagline missing");
  assert.equal(settings.tagline, "Cursos -> prácticas -> trabajo");
  assert.equal(settings.originSite, "https://prixline.blog/");
  assert.ok(settings.live !== undefined, "live block missing");
  assert.ok(
    typeof settings.live.youtubeHandle === "string" && settings.live.youtubeHandle.length > 0,
    "live.youtubeHandle missing",
  );
  assert.equal(settings.live.youtubeHandle, "@prixline");
  // Quota-driven value owned by the generator (900s = 96 searches/day, under
  // the 10.000 free YouTube units/day); assert against the source of truth.
  assert.equal(settings.live.checkIntervalSeconds, LIVE_CHECK_INTERVAL_SECONDS);
  assert.equal(LIVE_CHECK_INTERVAL_SECONDS, 900);
  assert.equal(settings.sourceUrl, SOURCE_URL);
  assert.equal(settings.extractedAt, EXTRACTED_AT);
});

test("social.json shape validates", async () => {
  const pages = await fixturePromise;
  const redes = pages.find((p) => p.slug === "redes");
  assert.ok(redes !== undefined, "fixture redes page missing");
  const channels = parseChannels(redes.content?.rendered ?? "");
  const settings = buildSocialSettings(channels, SOURCE_URL, EXTRACTED_AT);
  assert.deepEqual(settings.channels, channels);
  assert.equal(settings.sourceUrl, SOURCE_URL);
  assert.equal(settings.extractedAt, EXTRACTED_AT);
});
