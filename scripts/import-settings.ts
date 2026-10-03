/**
 * scripts/import-settings.ts
 *
 * Extractor for the Prixline content pipeline (T4): parses the `redes` page
 * of https://prixline.blog/ into structured social-channel settings.
 *
 * Pure parts:
 *   - parseChannels(html)          → Channel[]  ({platform,label,url} per
 *     URL-bearing line; prose lines without URLs are excluded)
 *   - normalizeChannelUrl(raw)     → canonical url (query stripped; http→https
 *     ONLY for twitter/instagram/linkedin/youtube hosts)
 *   - buildSocialSettings(...)     → content/settings/social.json shape
 *   - buildSiteSettings(...)       → content/settings/site.json shape
 *
 * CLI (guarded by import.meta.url):
 *   --fixture   reads scripts/fixtures/pages-sample.json (NO network), parses
 *               the redes page and prints what would be written — dry run.
 *   default     fetches the redes page live and writes BOTH files into
 *               content/settings/ (social.json + site.json).
 *
 * Run: node scripts/import-settings.ts --fixture
 * Tests: node --test scripts/import-pages.test.ts (offline)
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { decodeEntities } from "./extract-courses.ts";
import { PAGES_API_BASE, type WpPage } from "./import-pages.ts";

export interface Channel {
  platform: string;
  label: string;
  url: string;
}

export interface SocialSettings {
  channels: Channel[];
  sourceUrl: string;
  extractedAt: string;
}

export interface SiteSettings {
  name: string;
  tagline: string;
  originSite: string;
  live: { youtubeHandle: string; checkIntervalSeconds: number };
  sourceUrl: string;
  extractedAt: string;
}

export const REDES_SLUG = "redes";
export const SITE_NAME = "Prixline";
export const SITE_TAGLINE = "Cursos -> prácticas -> trabajo";
export const ORIGIN_SITE = "https://prixline.blog/";
export const YOUTUBE_HANDLE = "@prixline";
export const LIVE_CHECK_INTERVAL_SECONDS = 300;

/** API record URL of the redes page (sourceUrl for both settings files). */
export function redesSourceUrl(): string {
  return `${PAGES_API_BASE}?slug=${REDES_SLUG}`;
}

/** Hosts whose channel links are forced to https (canonical social URLs). */
const HTTPS_HOSTS = ["twitter.com", "instagram.com", "linkedin.com", "youtube.com"];

/** Host → platform mapping (label fallback covers the rest, e.g. TikTok on prixline.tv). */
const HOST_PLATFORMS: Array<[string, string]> = [
  ["youtube.com", "youtube"],
  ["spotify.com", "spotify"],
  ["instagram.com", "instagram"],
  ["twitter.com", "twitter"],
  ["linkedin.com", "linkedin"],
  ["tiktok.com", "tiktok"],
  ["pinterest.com", "pinterest"],
  ["ivoox.com", "ivoox"],
  ["spreaker.com", "spreaker"],
];

function matchesHost(host: string, suffix: string): boolean {
  return host === suffix || host.endsWith(`.${suffix}`);
}

/** Plain text of an HTML fragment: tags removed, entities decoded, collapsed. */
function plainText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, "")).replace(/[\s\u00a0]+/g, " ").trim();
}

/** First URL of a block: prefer the anchor href, fall back to plain-text URL. */
function firstUrl(inner: string): string {
  const href = /<a\b[^>]*?href="([^"]*)"/i.exec(inner)?.[1];
  if (href !== undefined && href.trim().length > 0) return href.trim();
  return /https?:\/\/[^\s<>"']+/i.exec(plainText(inner))?.[0] ?? "";
}

/** Strip emoji / decorative punctuation from a label edge. */
function cleanLabel(label: string): string {
  return label
    .replace(/^[\s\p{Extended_Pictographic}\u200d\ufe0f¡!¿?:;.,·•\-–—]+/u, "")
    .replace(/[\s:;.,!¡¿?]+$/u, "")
    .trim();
}

/** Label = the bolded text of the block (e.g. "YouTube", "iTunes Orientación"). */
function extractLabel(inner: string): string {
  const parts: string[] = [];
  const re = /<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner)) !== null) {
    const text = plainText(m[2] ?? "");
    if (text.length > 0) parts.push(text);
  }
  let label = parts.join(" ");
  if (label.length === 0) {
    // Defensive: no bold text — strip anchors/URLs from the plain text.
    label = plainText(inner.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, "")).replace(
      /https?:\/\/[^\s<>"']+/gi,
      "",
    );
  }
  return cleanLabel(label);
}

/** Platform: known host wins; otherwise ascii-slug of the label's first word. */
function platformFor(label: string, url: string): string {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    host = "";
  }
  for (const [suffix, platform] of HOST_PLATFORMS) {
    if (matchesHost(host, suffix)) return platform;
  }
  const firstWord = label.split(/\s+/)[0] ?? "";
  return firstWord
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Canonical channel URL: strip the query string; upgrade http→https ONLY for
 * twitter/instagram/linkedin/youtube hosts (other hosts keep their protocol).
 */
export function normalizeChannelUrl(raw: string): string {
  const noQuery = raw.split("?")[0] ?? raw;
  try {
    const url = new URL(noQuery);
    if (url.protocol === "http:" && HTTPS_HOSTS.some((h) => matchesHost(url.hostname.toLowerCase(), h))) {
      url.protocol = "https:";
    }
    return url.href;
  } catch {
    return noQuery;
  }
}

/**
 * Split the redes HTML into channel entries. One channel per <p> block that
 * carries a URL; prose lines without URLs are excluded.
 */
export function parseChannels(html: string): Channel[] {
  const channels: Channel[] = [];
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const inner = m[1] ?? "";
    const rawUrl = firstUrl(inner);
    if (rawUrl.length === 0) continue; // prose line without URL — never a channel
    const url = normalizeChannelUrl(rawUrl);
    if (!/^https?:\/\//.test(url)) continue;
    const label = extractLabel(inner);
    const platform = platformFor(label, url);
    if (platform.length === 0) continue;
    channels.push({ platform, label: label.length > 0 ? label : platform, url });
  }
  return channels;
}

/** Pure: content/settings/social.json shape. */
export function buildSocialSettings(
  channels: Channel[],
  sourceUrl: string,
  extractedAt: string,
): SocialSettings {
  return { channels, sourceUrl, extractedAt };
}

/** Pure: content/settings/site.json shape (live badge config included). */
export function buildSiteSettings(sourceUrl: string, extractedAt: string): SiteSettings {
  return {
    name: SITE_NAME,
    tagline: SITE_TAGLINE,
    originSite: ORIGIN_SITE,
    live: { youtubeHandle: YOUTUBE_HANDLE, checkIntervalSeconds: LIVE_CHECK_INTERVAL_SECONDS },
    sourceUrl,
    extractedAt,
  };
}

const FIXTURE_PAGES_URL = new URL("./fixtures/pages-sample.json", import.meta.url);
const SETTINGS_DIR = new URL("../content/settings/", import.meta.url);

/** Fixture redes page (offline, deterministic). */
async function fixtureRedesPage(): Promise<WpPage> {
  const pages = JSON.parse(await readFile(FIXTURE_PAGES_URL, "utf8")) as WpPage[];
  const found = pages.find((p) => p.slug === REDES_SLUG);
  if (!found) throw new Error("fixture has no redes page");
  return found;
}

/** Live redes page: one API request. Throws on failure. */
async function fetchLiveRedesPage(): Promise<WpPage> {
  const url = `${PAGES_API_BASE}?slug=${REDES_SLUG}&_fields=slug,title,content,link`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Live API request failed (${res.status} ${res.statusText}): ${url}`);
  const rows = (await res.json()) as WpPage[];
  const row = rows[0];
  if (!row) throw new Error(`Live API returned no page for slug=${REDES_SLUG}`);
  return row;
}

/** CLI entry: returns the number of channels parsed. */
export async function run(argv: string[]): Promise<number> {
  const useFixture = argv.includes("--fixture");
  const extractedAtArg = argv.find((a) => a.startsWith("--extracted-at="));
  const extractedAt = extractedAtArg
    ? extractedAtArg.slice("--extracted-at=".length)
    : new Date().toISOString();

  const page = useFixture ? await fixtureRedesPage() : await fetchLiveRedesPage();
  const channels = parseChannels(page.content?.rendered ?? "");
  const sourceUrl = redesSourceUrl();
  const social = buildSocialSettings(channels, sourceUrl, extractedAt);
  const site = buildSiteSettings(sourceUrl, extractedAt);

  if (useFixture) {
    for (const c of channels) console.log(`[fixture] ${c.platform} → ${c.url} (${c.label})`);
    console.log(
      `[fixture] ${channels.length} channel(s) parsed from fixture — dry run, would write:`,
    );
    console.log(`[fixture]   content/settings/social.json (${social.channels.length} channels)`);
    console.log(
      `[fixture]   content/settings/site.json (youtubeHandle ${site.live.youtubeHandle}, ${site.live.checkIntervalSeconds}s)`,
    );
    return channels.length;
  }

  await mkdir(SETTINGS_DIR, { recursive: true });
  await writeFile(
    new URL("social.json", SETTINGS_DIR),
    `${JSON.stringify(social, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    new URL("site.json", SETTINGS_DIR),
    `${JSON.stringify(site, null, 2)}\n`,
    "utf8",
  );
  console.log(
    `Wrote content/settings/social.json (${channels.length} channels) and content/settings/site.json (source: ${sourceUrl}).`,
  );
  return channels.length;
}

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  run(process.argv.slice(2)).catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
