/**
 * scripts/media.test.ts — T25 media localization suite (pure, offline).
 *
 * Covers scripts/media.ts: origin-media URL extraction (src/srcset/frontmatter),
 * http/https + www normalization, query-string handling, deterministic
 * collision disambiguation, srcset lists, rewrite idempotence and the
 * "non-origin URLs untouched" contract (third-party hosts, YouTube, hrefs and
 * inert data-* attributes stay as-is).
 *
 * Run: node --test scripts/media.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMediaMap,
  canonicalOriginUrl,
  extractOriginMediaUrls,
  isOriginMediaUrl,
  mediaLocalPath,
  normalizeMediaUrl,
  rewriteMediaRefs,
} from "./media.ts";

const IMG = "https://prixline.wordpress.com/wp-content/uploads/2012/03/inquisicion.jpg";
const LOCAL = "/media/uploads/2012/03/inquisicion.jpg";

test("extractOriginMediaUrls: normalizes http/https + www", () => {
  const md =
    '<img src="http://www.prixline.wordpress.com/wp-content/uploads/2019/09/ponlefinalparo-1.jpg">' +
    '<img src="https://prixline.blog/wp-content/uploads/2019/09/ponlefinalparo-1.jpg">';
  assert.deepEqual(extractOriginMediaUrls(md), [
    "https://prixline.wordpress.com/wp-content/uploads/2019/09/ponlefinalparo-1.jpg",
  ]);
});

test("extractOriginMediaUrls: query strings kept in URL, stripped by mediaLocalPath", () => {
  const src =
    'src="https://prixline.wordpress.com/wp-content/uploads/2017/11/155763-ouetgf-944.jpg?w=5642&#038;h=3767"';
  const urls = extractOriginMediaUrls(src);
  assert.equal(urls.length, 1);
  assert.equal(
    urls[0],
    "https://prixline.wordpress.com/wp-content/uploads/2017/11/155763-ouetgf-944.jpg?w=5642&h=3767",
  );
  assert.equal(
    mediaLocalPath(urls[0] ?? ""),
    "/media/uploads/2017/11/155763-ouetgf-944.jpg",
  );
});

test("extractOriginMediaUrls: frontmatter thumbnail field", () => {
  const md = [
    "---",
    'title: "Hola"',
    `thumbnail: "${IMG}?w=300&h=237"`,
    "thumbnailAlt: \"\"",
    "---",
    "",
    "# Hola",
    "",
  ].join("\n");
  assert.deepEqual(extractOriginMediaUrls(md), [`${IMG}?w=300&h=237`]);
});

test("extractOriginMediaUrls: srcset list yields every origin candidate", () => {
  const html =
    `<img srcset="${IMG}?w=300 300w, ${IMG}?w=150 150w, ${IMG} 320w" sizes="auto">`;
  const urls = extractOriginMediaUrls(html);
  assert.equal(urls.length, 3);
  assert.ok(urls.includes(`${IMG}?w=300`));
  assert.ok(urls.includes(`${IMG}?w=150`));
  assert.ok(urls.includes(IMG));
});

test("extractOriginMediaUrls: non-origin hosts ignored", () => {
  const html =
    '<img src="https://i.ytimg.com/vi/jmRtex1vdzU/hqdefault.jpg">' +
    '<img src="http://humanbeingelblogdeandresortega.files.wordpress.com/2012/07/images4.jpg?w=258">' +
    '<img src="https://i0.wp.com/prixlinepodcast.files.wordpress.com/2022/03/x.jpeg?w=1242">' +
    '<img src="https://ticsyformacion.com/wp-content/uploads/2018/05/x.png">';
  assert.deepEqual(extractOriginMediaUrls(html), []);
});

test("extractOriginMediaUrls: origin permalink in frontmatter is not media", () => {
  const md = '---\noriginUrl: "https://prixline.blog/2012/03/03/hola-a-todos/"\n---\n';
  assert.deepEqual(extractOriginMediaUrls(md), []);
});

test("isOriginMediaUrl / canonicalOriginUrl / normalizeMediaUrl", () => {
  assert.equal(
    isOriginMediaUrl("http://www.prixline.wordpress.com/wp-content/uploads/2012/03/x.jpg?w=1"),
    true,
  );
  assert.equal(isOriginMediaUrl("https://prixline.blog/2012/03/03/hola-a-todos/"), false);
  assert.equal(isOriginMediaUrl("https://example.com/wp-content/uploads/2012/03/x.jpg"), false);
  assert.equal(
    canonicalOriginUrl(
      "http://www.prixline.wordpress.com/wp-content/uploads/2012/03/x.jpg?w=1",
    ),
    "https://prixline.wordpress.com/wp-content/uploads/2012/03/x.jpg?w=1",
  );
  // Grouping identity: origin hosts collapse, query stripped.
  assert.equal(normalizeMediaUrl("http://prixline.wordpress.com/wp-content/uploads/a.jpg?w=2"), normalizeMediaUrl("https://www.prixline.blog/wp-content/uploads/a.jpg"));
});

test("mediaLocalPath: preserves the uploads subpath (YYYY/MM/basename)", () => {
  assert.equal(
    mediaLocalPath("https://prixline.blog/wp-content/uploads/2019/09/ponlefinalparo-1.jpg?w=604&h=297"),
    "/media/uploads/2019/09/ponlefinalparo-1.jpg",
  );
  assert.equal(
    mediaLocalPath("https://prixline.wordpress.com/wp-content/uploads/2012/03/deep/nested/pic.png"),
    "/media/uploads/2012/03/deep/nested/pic.png",
  );
});

test("buildMediaMap: query variants collapse to one local path", () => {
  const map = buildMediaMap([`${IMG}?w=300&h=237`, `${IMG}?w=150`, IMG]);
  assert.equal(new Set(map.values()).size, 1);
  assert.equal(map.get(IMG), LOCAL);
  assert.equal(map.get(`${IMG}?w=300&h=237`), LOCAL);
});

test("buildMediaMap: origin http/https/www variants share one path", () => {
  const map = buildMediaMap([
    "http://prixline.wordpress.com/wp-content/uploads/2012/03/inquisicion.jpg",
    "https://www.prixline.wordpress.com/wp-content/uploads/2012/03/inquisicion.jpg",
    "https://prixline.blog/wp-content/uploads/2012/03/inquisicion.jpg",
  ]);
  assert.equal(new Set(map.values()).size, 1);
  assert.equal(map.get("https://prixline.blog/wp-content/uploads/2012/03/inquisicion.jpg"), LOCAL);
});

test("buildMediaMap: basename collision between different URLs → deterministic hash", () => {
  const a = "https://example-a.org/wp-content/uploads/2020/01/photo.jpg";
  const b = "https://example-b.org/wp-content/uploads/2020/01/photo.jpg";
  const forward = buildMediaMap([a, b]);
  const reverse = buildMediaMap([b, a]);
  const pathA = forward.get(a) ?? "";
  const pathB = forward.get(b) ?? "";
  assert.notEqual(pathA, pathB);
  assert.match(pathA, /^\/media\/uploads\/2020\/01\/photo-[0-9a-f]{8}\.jpg$/);
  assert.match(pathB, /^\/media\/uploads\/2020\/01\/photo-[0-9a-f]{8}\.jpg$/);
  // Order-independent: reversed input yields the same assignments.
  assert.deepEqual(
    [...forward.entries()].sort(),
    [...reverse.entries()].sort(),
  );
  // Stable across independent runs.
  assert.deepEqual(forward, buildMediaMap([a, b]));
});

test("rewriteMediaRefs: src/srcset/frontmatter rewritten; href/data-orig-file kept", () => {
  const md = [
    "---",
    'title: "Hola"',
    `thumbnail: "${IMG}?w=300&h=237"`,
    "---",
    "",
    "# Hola",
    "",
    `<p><a href="${IMG}"><img data-orig-file="${IMG}" src="${IMG}?w=300&#038;h=237" srcset="${IMG}?w=300 300w, ${IMG} 320w" /></a></p>`,
    "",
  ].join("\n");
  const map = buildMediaMap(extractOriginMediaUrls(md));
  const out = rewriteMediaRefs(md, map);
  assert.ok(out.includes(`thumbnail: "${LOCAL}"`), "frontmatter thumbnail not rewritten");
  assert.ok(out.includes(`src="${LOCAL}"`), "src not rewritten");
  assert.ok(
    out.includes(`srcset="${LOCAL} 300w, ${LOCAL} 320w"`),
    "srcset not rewritten (descriptors must survive)",
  );
  // href and data-orig-file stay as-is (inert / out of scope, T22-T24).
  assert.ok(out.includes(`href="${IMG}"`), "href must stay untouched");
  assert.ok(out.includes(`data-orig-file="${IMG}"`), "data-orig-file must stay untouched");
  // No origin media URL left in any request position.
  assert.deepEqual(extractOriginMediaUrls(out), []);
});

test("rewriteMediaRefs: idempotent", () => {
  const md = `<img src="${IMG}?w=300&#038;h=237" srcset="${IMG}?w=150 150w, ${IMG} 320w">`;
  const map = buildMediaMap(extractOriginMediaUrls(md));
  const once = rewriteMediaRefs(md, map);
  assert.ok(once.includes(`src="${LOCAL}"`));
  assert.equal(rewriteMediaRefs(once, map), once);
});

test("rewriteMediaRefs: non-origin URLs untouched", () => {
  const third =
    "http://humanbeingelblogdeandresortega.files.wordpress.com/2012/07/images4.jpg?w=258";
  const yt = "https://i.ytimg.com/vi/jmRtex1vdzU/hqdefault.jpg";
  const md = `<img src="${third}"><img src="${yt}"><img src="${IMG}">`;
  const map = buildMediaMap(extractOriginMediaUrls(md));
  const out = rewriteMediaRefs(md, map);
  assert.ok(out.includes(`src="${third}"`));
  assert.ok(out.includes(`src="${yt}"`));
  assert.ok(out.includes(`src="${LOCAL}"`));
});

test("rewriteMediaRefs: &amp;-encoded srcset query strings", () => {
  const md =
    '<img srcset="https://prixline.wordpress.com/wp-content/uploads/2012/03/practicas.jpeg 282w, ' +
    'https://prixline.wordpress.com/wp-content/uploads/2012/03/practicas.jpeg?w=150&amp;h=95 150w">';
  const map = buildMediaMap(extractOriginMediaUrls(md));
  assert.equal(
    rewriteMediaRefs(md, map),
    '<img srcset="/media/uploads/2012/03/practicas.jpeg 282w, /media/uploads/2012/03/practicas.jpeg 150w">',
  );
});

test("rewriteMediaRefs: empty map or empty text is a no-op", () => {
  const md = `<img src="${IMG}">`;
  assert.equal(rewriteMediaRefs(md, new Map()), md);
  assert.equal(rewriteMediaRefs("", buildMediaMap([IMG])), "");
});
