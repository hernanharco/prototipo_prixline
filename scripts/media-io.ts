/**
 * scripts/media-io.ts — T25 producer-side media localization (I/O side).
 *
 * Shared by import-posts.ts, import-pages.ts and extract-courses.ts: collects
 * every origin-blog media URL from the rendered documents, downloads each
 * unique file into site/public/media/<path> (skip-if-exists, so reruns are
 * cheap), and rewrites the documents with local /media/... refs. One failed
 * download never aborts the run: that image keeps its original URL and the
 * failure is listed in the final bounded report.
 *
 * All filesystem/network access is injectable (MediaStore + fetchFn) so
 * scripts/media-io.test.ts runs fully offline.
 *
 * Run: node --test scripts/media-io.test.ts
 */
import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildMediaMap, extractOriginMediaUrls, rewriteMediaRefs } from "./media.ts";

/** Media download summary for importers (bounded log line, no per-file spam). */
export interface MediaDownloadReport {
  /** Origin media URLs found across the processed documents. */
  found: number;
  /** Unique local files downloaded in this run. */
  downloaded: number;
  /** Unique local files already present (rerun skip count). */
  skipped: number;
  /** Failed downloads; the original URL is kept for those images. */
  failed: Array<{ url: string; error: string }>;
}

/** Minimal filesystem surface; real impl backed by node:fs, tests use memory. */
export interface MediaStore {
  exists(path: string): Promise<boolean>;
  write(path: string, data: Uint8Array): Promise<void>;
  mkdirp(path: string): Promise<void>;
}

/** Real store rooted at site/public (localPath starts with "/media/..."). */
export function realMediaStore(root: string): MediaStore {
  return {
    exists: async (p: string): Promise<boolean> => {
      try {
        await stat(join(root, p));
        return true;
      } catch {
        return false;
      }
    },
    write: async (p: string, data: Uint8Array): Promise<void> => {
      await writeFile(join(root, p), data);
    },
    mkdirp: async (p: string): Promise<void> => {
      await mkdir(join(root, p), { recursive: true });
    },
  };
}

/** Site/public directory resolved from this module (scripts/ → site/public). */
export function mediaRoot(): string {
  return fileURLToPath(new URL("../site/public/", import.meta.url));
}

/** Fetch shape used by localizeMediaDocs (injectable for offline tests). */
export type FetchFn = (url: string, init?: { signal?: AbortSignal }) => Promise<Response>;

export interface LocalizeOptions {
  store: MediaStore;
  fetchFn?: FetchFn;
  /** Parallel downloads (bounded politeness). */
  concurrency?: number;
  timeoutMs?: number;
}

export interface LocalizeResult {
  docs: Array<{ id: string; md: string }>;
  report: MediaDownloadReport;
}

/**
 * Representative download URL for one local file: the rendition without a
 * query string (full-size original) if any, else the lexicographically first
 * URL — deterministic, order-independent.
 */
export function representativeUrl(urls: string[]): string {
  const sorted = [...urls].sort();
  return sorted.find((u) => !u.includes("?")) ?? sorted[0] ?? "";
}

/** One bounded log line: counts + failure list, no per-file success spam. */
export function formatMediaReport(report: MediaDownloadReport, label: string): string {
  const failures = report.failed.map((f) => `${f.url} (${f.error})`).join("; ");
  return (
    `[media] ${label}: ${report.found} origin URL(s) → ${report.downloaded} downloaded, ` +
    `${report.skipped} already present, ${report.failed.length} failed` +
    (report.failed.length > 0 ? ` — kept original URL(s): ${failures}` : "")
  );
}

/**
 * Localize all origin media refs across documents:
 *   1. extract + build the URL→localPath map,
 *   2. download each unique local path (skip existing files),
 *   3. rewrite every document; failed images keep their original URLs.
 */
export async function localizeMediaDocs(
  docs: Array<{ id: string; md: string }>,
  options: LocalizeOptions,
): Promise<LocalizeResult> {
  const fetchFn: FetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const all = new Set<string>();
  for (const doc of docs) {
    for (const url of extractOriginMediaUrls(doc.md)) all.add(url);
  }
  const report: MediaDownloadReport = {
    found: all.size,
    downloaded: 0,
    skipped: 0,
    failed: [],
  };
  if (all.size === 0) return { docs, report };

  const map = buildMediaMap(all);
  const byPath = new Map<string, string[]>();
  for (const [url, local] of map) {
    const list = byPath.get(local);
    if (list === undefined) byPath.set(local, [url]);
    else list.push(url);
  }

  const failedPaths = new Set<string>();
  const entries = [...byPath.entries()];
  let cursor = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const idx = cursor++;
      if (idx >= entries.length) return;
      const entry = entries[idx];
      if (entry === undefined) return;
      const [localPath, urls] = entry;
      const url = representativeUrl(urls);
      try {
        if (await options.store.exists(localPath)) {
          report.skipped++;
          continue;
        }
        const res = await fetchFn(url, { signal: AbortSignal.timeout(timeoutMs) });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        const data = new Uint8Array(await res.arrayBuffer());
        if (data.length === 0) throw new Error("empty body");
        const dir = localPath.slice(0, localPath.lastIndexOf("/")) || "/";
        await options.store.mkdirp(dir);
        await options.store.write(localPath, data);
        report.downloaded++;
      } catch (err) {
        failedPaths.add(localPath);
        report.failed.push({ url, error: err instanceof Error ? err.message : String(err) });
      }
    }
  };
  const parallel = Math.max(1, Math.min(options.concurrency ?? 8, entries.length));
  await Promise.all(Array.from({ length: parallel }, () => worker()));

  // Failed images keep their original URL: drop those entries before rewrite.
  const rewriteMap = new Map<string, string>();
  for (const [url, local] of map) {
    if (!failedPaths.has(local)) rewriteMap.set(url, local);
  }
  report.failed.sort((a, b) => (a.url < b.url ? -1 : 1));
  return {
    docs: docs.map((doc) => ({ id: doc.id, md: rewriteMediaRefs(doc.md, rewriteMap) })),
    report,
  };
}
