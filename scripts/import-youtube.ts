/**
 * scripts/import-youtube.ts (T12)
 *
 * Importer for the Prixline content pipeline: pulls the latest videos of the
 * YouTube channel (handle from content/settings/site.json → live.youtubeHandle)
 * via the public Atom RSS feed — NO API key, NO quota, NO new dependencies.
 *
 * Pure parts:
 *   - extractChannelId(html)  → UC… id from a channel-page source (regex over
 *     `"channelId"|"externalId"|"browseId"` key forms + generic UC scan; the
 *     channel's own id dominates the page, so the most frequent valid id wins)
 *   - parseFeed(xml)          → { channelId, videos } sorted newest-first,
 *     capped at VIDEOS_LIMIT (12). Throws LOUDLY on empty/malformed feeds:
 *     never writes a silent empty videos.json.
 *   - thumbnailFor/watchUrl/feedUrl/buildVideosData → small builders
 *
 * CLI (guarded by import.meta.url):
 *   --fixture   reads scripts/fixtures/youtube-feed.xml (NO network), parses
 *               and prints what would be written — dry run, writes nothing.
 *   default     resolves channelId (cached in site.json → live.channelId;
 *               fetched once from the channel page otherwise), fetches the
 *               Atom feed, captures scripts/fixtures/youtube-feed.xml on the
 *               first live run and writes content/settings/videos.json +
 *               the live.channelId cache in content/settings/site.json
 *               (this script is the ONLY writer of that field — no hand edit).
 *
 * Run: node scripts/import-youtube.ts [--fixture]
 * Tests: node --test scripts/import-youtube.test.ts (offline)
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { decodeEntities } from "./extract-courses.ts";

export interface YoutubeVideo {
  videoId: string;
  title: string;
  publishedAt: string; // ISO 8601 UTC (…Z)
  thumbnail: string;
  url: string;
}

export interface VideosData {
  channelId: string;
  sourceUrl: string;
  fetchedAt: string;
  videos: YoutubeVideo[];
}

/** Cuántos vídeos conserva el importador (los más recientes primero). */
export const VIDEOS_LIMIT = 12;
/** Handle del canal (origen: content/settings/site.json → live.youtubeHandle). */
export const YOUTUBE_HANDLE = "@prixline";
export const CHANNEL_PAGE_URL = `https://www.youtube.com/${YOUTUBE_HANDLE}`;
/** Host de miniaturas canónico (gate: i.ytimg.com en el HTML construido). */
export const THUMBNAIL_BASE = "https://i.ytimg.com/vi";
export const WATCH_URL_BASE = "https://www.youtube.com/watch?v=";
export const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/;
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/** RSS público del canal (sin API key ni cuota). */
export function feedUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}

/** Miniatura canónica derivada del videoId (fallback del parser). */
export function thumbnailFor(videoId: string): string {
  return `${THUMBNAIL_BASE}/${videoId}/hqdefault.jpg`;
}

/** URL de reproducción canónica de un vídeo. */
export function watchUrl(videoId: string): string {
  return `${WATCH_URL_BASE}${videoId}`;
}

/**
 * Extrae el channelId (UC…) de la fuente HTML de una página de canal.
 * Preferencia: la forma clave `"channelId":"UC…"` (también externalId /
 * browseId) y, en empate o ausencia, el id UC válido MÁS FRECUENTE de la
 * página — el id del propio canal domina su página de forma abrumadora.
 * Lanza si no hay ningún id UC válido (nunca devuelve vacío).
 */
export function extractChannelId(html: string): string {
  const counts = new Map<string, number>();
  const order: string[] = [];
  for (const m of html.matchAll(/UC[A-Za-z0-9_-]{22}/g)) {
    const id = m[0];
    if (!counts.has(id)) order.push(id);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  if (order.length === 0) {
    throw new Error(`No YouTube channel id (UC…) found in channel page source: ${CHANNEL_PAGE_URL}`);
  }
  let best = order[0] as string;
  for (const id of order) {
    if ((counts.get(id) ?? 0) > (counts.get(best) ?? 0)) best = id;
  }
  if (!CHANNEL_ID_RE.test(best)) {
    throw new Error(`Extracted channel id fails validation: ${best}`);
  }
  return best;
}

/** channelId del propio feed (link alternate del canal; fallback yt:channelId). */
function extractFeedChannelId(xml: string): string {
  const fromLink = /<link rel="alternate" href="https?:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})"/.exec(
    xml,
  )?.[1];
  if (fromLink !== undefined) return fromLink;
  const raw = /<yt:channelId>([^<]*)<\/yt:channelId>/.exec(xml)?.[1]?.trim() ?? "";
  const candidate = CHANNEL_ID_RE.test(raw) ? raw : `UC${raw}`;
  if (!CHANNEL_ID_RE.test(candidate)) {
    throw new Error("YouTube feed does not carry a valid channel id");
  }
  return candidate;
}

export interface ParsedFeed {
  channelId: string;
  videos: YoutubeVideo[];
}

/**
 * Parser regex/estado del Atom feed de YouTube (sin dependencias). Ordena de
 * más reciente a más antiguo, deduplica por videoId y limita a VIDEOS_LIMIT.
 * Lanza si el feed está vacío o no produce NINGÚN vídeo válido.
 */
export function parseFeed(xml: string): ParsedFeed {
  const blocks = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => m[1] ?? "");
  if (blocks.length === 0) {
    throw new Error("YouTube feed has no <entry> elements — refusing to write an empty videos.json");
  }
  const videos: YoutubeVideo[] = [];
  const seen = new Set<string>();
  for (const block of blocks) {
    const videoId = /<yt:videoId>([^<]*)<\/yt:videoId>/.exec(block)?.[1]?.trim() ?? "";
    if (!VIDEO_ID_RE.test(videoId) || seen.has(videoId)) continue;
    const rawTitle = /<title>([^<]*)<\/title>/.exec(block)?.[1] ?? "";
    const title = decodeEntities(rawTitle.replace(/<[^>]*>/g, ""))
      .replace(/[\s\u00a0]+/g, " ")
      .trim();
    const publishedMs = Date.parse(/<published>([^<]*)<\/published>/.exec(block)?.[1]?.trim() ?? "");
    if (title.length === 0 || Number.isNaN(publishedMs)) continue;
    seen.add(videoId);
    // media:thumbnail solo si está en el host canónico i.ytimg.com; si no, se
    // deriva del videoId (el feed real suele traer i1/i2/i3.ytimg.com).
    const mediaThumb = /<media:thumbnail[^>]*\burl="([^"]*)"/.exec(block)?.[1]?.trim() ?? "";
    const thumbnail = /^https:\/\/i\.ytimg\.com\/vi\/[A-Za-z0-9_-]{11}\/[A-Za-z0-9_.-]+$/.test(
      mediaThumb,
    )
      ? mediaThumb
      : thumbnailFor(videoId);
    videos.push({
      videoId,
      title,
      publishedAt: new Date(publishedMs).toISOString(),
      thumbnail,
      url: watchUrl(videoId),
    });
  }
  if (videos.length === 0) {
    throw new Error(
      "YouTube feed parsed to zero valid entries — refusing to write an empty videos.json",
    );
  }
  videos.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0));
  return { channelId: extractFeedChannelId(xml), videos: videos.slice(0, VIDEOS_LIMIT) };
}

/** Pure builder de la forma JSON de content/settings/videos.json (CMS). */
export function buildVideosData(
  channelId: string,
  sourceUrl: string,
  fetchedAt: string,
  videos: YoutubeVideo[],
): VideosData {
  return { channelId, sourceUrl, fetchedAt, videos };
}

const FIXTURE_FEED_URL = new URL("./fixtures/youtube-feed.xml", import.meta.url);
const VIDEOS_JSON_URL = new URL("../content/settings/videos.json", import.meta.url);
const SITE_JSON_URL = new URL("../content/settings/site.json", import.meta.url);
const SETTINGS_DIR = new URL("../content/settings/", import.meta.url);

/** Subconjunto de site.json que necesita el importador (read-modify-write). */
interface SiteJson {
  live?: { youtubeHandle?: string; checkIntervalSeconds?: number; channelId?: string };
  [key: string]: unknown;
}

/** Pure: site.json con el channelId cacheado bajo live (otros campos intactos). */
export function withChannelId(site: SiteJson, channelId: string): SiteJson {
  return { ...site, live: { ...(site.live ?? {}), channelId } };
}

async function readSiteJson(): Promise<SiteJson> {
  return JSON.parse(await readFile(SITE_JSON_URL, "utf8")) as SiteJson;
}

/** channelId cacheado en site.json; si falta, se resuelve UNA vez del HTML. */
async function resolveChannelId(site: SiteJson): Promise<string> {
  const cached = site.live?.channelId;
  if (typeof cached === "string" && CHANNEL_ID_RE.test(cached)) return cached;
  const res = await fetch(CHANNEL_PAGE_URL, { headers: { "user-agent": UA } });
  if (!res.ok) {
    throw new Error(`Channel page request failed (${res.status} ${res.statusText}): ${CHANNEL_PAGE_URL}`);
  }
  return extractChannelId(await res.text());
}

/** Feed Atom del canal. Lanza ante cualquier fallo HTTP. */
async function fetchFeed(channelId: string): Promise<string> {
  const url = feedUrl(channelId);
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) {
    throw new Error(`Feed request failed (${res.status} ${res.statusText}): ${url}`);
  }
  return res.text();
}

/** CLI entry: devuelve el nº de vídeos parseados (fixture) / escritos (live). */
export async function run(argv: string[]): Promise<number> {
  const useFixture = argv.includes("--fixture");
  const fetchedAt = new Date().toISOString();

  if (useFixture) {
    const xml = await readFile(FIXTURE_FEED_URL, "utf8"); // falla alto si falta
    const { channelId, videos } = parseFeed(xml);
    console.log(
      `[fixture] ${videos.length} video(s) from fixture (channel ${channelId}) — dry run, no files written.`,
    );
    for (const v of videos) console.log(`[fixture]   ${v.publishedAt} ${v.videoId} ${v.title}`);
    return videos.length;
  }

  const site = await readSiteJson();
  const channelId = await resolveChannelId(site);
  const xml = await fetchFeed(channelId);
  let fixtureSaved = false;
  try {
    await readFile(FIXTURE_FEED_URL, "utf8");
  } catch {
    await writeFile(FIXTURE_FEED_URL, xml, "utf8"); // primera ejecución live
    fixtureSaved = true;
  }
  const { videos } = parseFeed(xml);
  const data = buildVideosData(channelId, feedUrl(channelId), fetchedAt, videos);
  await mkdir(SETTINGS_DIR, { recursive: true });
  await writeFile(VIDEOS_JSON_URL, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  const cacheMiss = site.live?.channelId !== channelId;
  if (cacheMiss) {
    await writeFile(SITE_JSON_URL, `${JSON.stringify(withChannelId(site, channelId), null, 2)}\n`, "utf8");
  }
  console.log(
    `Wrote content/settings/videos.json (${videos.length} videos, channel ${channelId}${fixtureSaved ? "; fixture captured" : ""}).`,
  );
  if (cacheMiss) console.log(`Cached live.channelId=${channelId} in content/settings/site.json.`);
  return videos.length;
}

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  run(process.argv.slice(2)).catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
