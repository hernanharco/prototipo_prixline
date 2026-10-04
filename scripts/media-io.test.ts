/**
 * scripts/media-io.test.ts — T25 producer I/O suite (fully offline).
 *
 * Exercises localizeMediaDocs() with an in-memory MediaStore and a stub
 * fetchFn: downloads land on the right /media paths, existing files are
 * skipped on rerun, a single failed download keeps that image's original URL
 * while everything else is rewritten, and the report stays bounded.
 *
 * Run: node --test scripts/media-io.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  formatMediaReport,
  localizeMediaDocs,
  representativeUrl,
  type FetchFn,
  type MediaStore,
} from "./media-io.ts";

const IMG = "https://prixline.wordpress.com/wp-content/uploads/2012/03/inquisicion.jpg";
const LOCAL = "/media/uploads/2012/03/inquisicion.jpg";

class MemoryStore implements MediaStore {
  readonly files = new Map<string, Uint8Array>();
  exists = async (p: string): Promise<boolean> => this.files.has(p);
  write = async (p: string, data: Uint8Array): Promise<void> => {
    this.files.set(p, data);
  };
  mkdirp = async (): Promise<void> => {
    /* directories implied by the Map */
  };
}

function stubFetch(
  outcomes: Map<string, { ok: boolean; body?: Uint8Array; error?: string }>,
  calls: string[],
): FetchFn {
  return async (url: string): Promise<Response> => {
    calls.push(url);
    const outcome = outcomes.get(url);
    if (outcome === undefined) throw new Error(`unexpected fetch: ${url}`);
    if (!outcome.ok) throw new Error(outcome.error ?? "network down");
    return new Response(outcome.body ?? new Uint8Array([1, 2, 3]), { status: 200 });
  };
}

const doc = (body: string): Array<{ id: string; md: string }> => [{ id: "a.md", md: body }];

test("localizeMediaDocs: downloads to /media path and rewrites body + frontmatter", async () => {
  const md =
    `---\ntitle: "T"\nthumbnail: "${IMG}?w=300&h=237"\n---\n` +
    `<img src="${IMG}?w=300&#038;h=237" srcset="${IMG}?w=300 300w, ${IMG} 320w">`;
  const store = new MemoryStore();
  const calls: string[] = [];
  const { docs, report } = await localizeMediaDocs(doc(md), {
    store,
    fetchFn: stubFetch(new Map([[IMG, { ok: true, body: new Uint8Array([9]) }]]), calls),
  });
  // 3 raw URL strings (query variants) → 1 unique local file.
  assert.equal(report.found, 3);
  assert.equal(report.downloaded, 1);
  assert.equal(report.failed.length, 0);
  // Representative URL prefers the query-less rendition when present.
  assert.deepEqual(calls, [IMG]);
  assert.ok(store.files.has(LOCAL), "file must land on the local media path");
  const out = docs[0]?.md ?? "";
  assert.ok(out.includes(`thumbnail: "${LOCAL}"`));
  assert.ok(out.includes(`src="${LOCAL}"`));
  assert.ok(out.includes(`srcset="${LOCAL} 300w, ${LOCAL} 320w"`));
});

test("localizeMediaDocs: rerun skips existing files, no refetch", async () => {
  const md = `<img src="${IMG}">`;
  const store = new MemoryStore();
  store.files.set(LOCAL, new Uint8Array([9]));
  const calls: string[] = [];
  const { report } = await localizeMediaDocs(doc(md), {
    store,
    fetchFn: stubFetch(new Map(), calls),
  });
  assert.equal(calls.length, 0);
  assert.equal(report.skipped, 1);
  assert.equal(report.downloaded, 0);
});

test("localizeMediaDocs: one failed download keeps that URL, rewrites the rest", async () => {
  const good = "https://prixline.wordpress.com/wp-content/uploads/2019/09/ponlefinalparo-1.jpg";
  const goodLocal = "/media/uploads/2019/09/ponlefinalparo-1.jpg";
  const md = `<img src="${IMG}"><img src="${good}">`;
  const { docs, report } = await localizeMediaDocs(doc(md), {
    store: new MemoryStore(),
    fetchFn: stubFetch(
      new Map([
        [IMG, { ok: false, error: "HTTP 404 Not Found" }],
        [good, { ok: true }],
      ]),
      [],
    ),
  });
  assert.equal(report.downloaded, 1);
  assert.equal(report.failed.length, 1);
  assert.equal(report.failed[0]?.url, IMG);
  const out = docs[0]?.md ?? "";
  assert.ok(out.includes(`src="${IMG}"`), "failed image keeps original URL");
  assert.ok(out.includes(`src="${goodLocal}"`), "successful image is rewritten");
  assert.ok(formatMediaReport(report, "posts").includes("kept original URL(s)"));
});

test("localizeMediaDocs: no origin media → zero report, no fetch", async () => {
  const calls: string[] = [];
  const { docs, report } = await localizeMediaDocs(doc('<img src="https://i.ytimg.com/vi/x/hqdefault.jpg">'), {
    store: new MemoryStore(),
    fetchFn: stubFetch(new Map(), calls),
  });
  assert.equal(report.found, 0);
  assert.equal(calls.length, 0);
  assert.equal(docs[0]?.md, '<img src="https://i.ytimg.com/vi/x/hqdefault.jpg">');
});

test("representativeUrl: query-less rendition wins, else lexicographic first", () => {
  assert.equal(representativeUrl([`${IMG}?w=300`, IMG]), IMG);
  assert.equal(representativeUrl([`${IMG}?w=300`, `${IMG}?w=150`]), `${IMG}?w=150`);
  assert.equal(representativeUrl([]), "");
});
