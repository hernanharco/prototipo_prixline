/**
 * scripts/import-youtube.test.ts (T12)
 *
 * Offline suite for the YouTube RSS importer. Asserts ONLY against the
 * deterministic fixture scripts/fixtures/youtube-feed.xml (captured from the
 * live channel feed on the first import run). NO network access anywhere.
 *
 * Run: node --test scripts/import-youtube.test.ts
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildVideosData,
  extractChannelId,
  feedUrl,
  parseFeed,
  thumbnailFor,
  VIDEOS_LIMIT,
  watchUrl,
} from "./import-youtube.ts";

const FIXTURE_FEED_URL = new URL("./fixtures/youtube-feed.xml", import.meta.url);
const fixtureXml = (): Promise<string> => readFile(FIXTURE_FEED_URL, "utf8");

const CHANNEL_A = "UCcEX40UDEqB3a_6o9j0NozQ";
const ISO_Z_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** Synthetic Atom entry for parser edge-case tests (fixture untouched). */
function entryXml(opts: {
  videoId: string;
  title: string;
  published: string;
  thumb?: string;
}): string {
  const thumbTag = opts.thumb
    ? `<media:thumbnail url="${opts.thumb}" width="480" height="360"/>`
    : "";
  return `<entry>
 <id>yt:video:${opts.videoId}</id>
 <yt:videoId>${opts.videoId}</yt:videoId>
 <title>${opts.title}</title>
 <link rel="alternate" href="https://www.youtube.com/watch?v=${opts.videoId}"/>
 <published>${opts.published}</published>
 <media:group><media:title>${opts.title}</media:title>${thumbTag}</media:group>
</entry>`;
}

/** Synthetic feed wrapper carrying the channel id (same shape as the real feed). */
function feedXml(channelId: string, ...entries: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <id>yt:channel:${channelId.slice(2)}</id>
 <yt:channelId>${channelId.slice(2)}</yt:channelId>
 <link rel="alternate" href="https://www.youtube.com/channel/${channelId}"/>
${entries.join("\n")}
</feed>`;
}

test("fixture parses into the latest videos (>= 10, capped at VIDEOS_LIMIT)", async () => {
  const { videos } = parseFeed(await fixtureXml());
  assert.ok(videos.length >= 10, `expected >= 10 videos, got ${videos.length}`);
  assert.equal(videos.length, VIDEOS_LIMIT);
});

test("fixture carries a valid UC channel id and feedUrl() builds the RSS url", async () => {
  const { channelId } = parseFeed(await fixtureXml());
  assert.match(channelId, /^UC[A-Za-z0-9_-]{22}$/);
  assert.equal(
    feedUrl(channelId),
    `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
  );
});

test("every fixture video: id, title, ISO date, i.ytimg.com thumbnail, watch url", async () => {
  const { videos } = parseFeed(await fixtureXml());
  for (const v of videos) {
    assert.match(v.videoId, /^[A-Za-z0-9_-]{11}$/, `bad videoId: ${v.videoId}`);
    assert.ok(v.title.length > 0, `empty title for ${v.videoId}`);
    assert.match(v.publishedAt, ISO_Z_RE, `publishedAt not UTC ISO for ${v.videoId}`);
    assert.ok(!Number.isNaN(Date.parse(v.publishedAt)), `unparseable date for ${v.videoId}`);
    assert.match(
      v.thumbnail,
      /^https:\/\/i\.ytimg\.com\/vi\/[A-Za-z0-9_-]{11}\/hqdefault\.jpg$/,
      `bad thumbnail: ${v.thumbnail}`,
    );
    assert.equal(v.url, watchUrl(v.videoId));
  }
});

test("fixture videos are newest-first and unique", async () => {
  const { videos } = parseFeed(await fixtureXml());
  assert.equal(new Set(videos.map((v) => v.videoId)).size, videos.length, "duplicate ids");
  for (let i = 1; i < videos.length; i += 1) {
    assert.ok(
      videos[i - 1]!.publishedAt >= videos[i]!.publishedAt,
      `out of order at ${i}: ${videos[i - 1]!.publishedAt} before ${videos[i]!.publishedAt}`,
    );
  }
});

test("parser sorts out-of-order entries newest-first", () => {
  const xml = feedXml(
    CHANNEL_A,
    entryXml({ videoId: "aaaaaaaaaaa", title: "viejo", published: "2026-01-01T10:00:00+00:00" }),
    entryXml({ videoId: "bbbbbbbbbbb", title: "nuevo", published: "2026-10-03T08:46:19+00:00" }),
    entryXml({ videoId: "ccccccccccc", title: "medio", published: "2026-05-05T09:00:00+00:00" }),
  );
  const { videos } = parseFeed(xml);
  assert.deepEqual(videos.map((v) => v.videoId), ["bbbbbbbbbbb", "ccccccccccc", "aaaaaaaaaaa"]);
});

test("only the newest VIDEOS_LIMIT entries are kept when the feed is longer", () => {
  const entries = Array.from({ length: 15 }, (_, i) =>
    entryXml({
      videoId: `vid${String(i).padStart(8, "0")}`,
      title: `v${i}`,
      published: `2026-09-${String(15 - i).padStart(2, "0")}T10:00:00+00:00`,
    }),
  );
  const { videos } = parseFeed(feedXml(CHANNEL_A, ...entries));
  assert.equal(videos.length, VIDEOS_LIMIT);
  assert.equal(videos[0]!.videoId, "vid00000000", "newest entry must be kept");
  assert.equal(videos[videos.length - 1]!.videoId, `vid${String(VIDEOS_LIMIT - 1).padStart(8, "0")}`);
});

test("media:thumbnail on i.ytimg.com is preferred over the derived url", () => {
  const thumb = "https://i.ytimg.com/vi/ddddddddddd/maxresdefault.jpg";
  const xml = feedXml(
    CHANNEL_A,
    entryXml({
      videoId: "ddddddddddd",
      title: "con thumb",
      published: "2026-10-01T00:00:00+00:00",
      thumb,
    }),
  );
  assert.equal(parseFeed(xml).videos[0]!.thumbnail, thumb);
});

test("media:thumbnail on another host (or missing) falls back to derived i.ytimg.com url", () => {
  const xml = feedXml(
    CHANNEL_A,
    entryXml({
      videoId: "eeeeeeeeeee",
      title: "host ajeno",
      published: "2026-10-01T00:00:00+00:00",
      thumb: "https://i1.ytimg.com/vi/eeeeeeeeeee/hqdefault.jpg",
    }),
    entryXml({ videoId: "fffffffffff", title: "sin thumb", published: "2026-10-02T00:00:00+00:00" }),
  );
  const { videos } = parseFeed(xml);
  assert.equal(videos[0]!.videoId, "fffffffffff");
  assert.equal(videos[0]!.thumbnail, thumbnailFor("fffffffffff"));
  assert.equal(videos[1]!.thumbnail, thumbnailFor("eeeeeeeeeee"));
});

test("HTML entities in titles are decoded", () => {
  const xml = feedXml(
    CHANNEL_A,
    entryXml({
      videoId: "ggggggggggg",
      title: "A &amp; B &lt;C&gt;",
      published: "2026-10-01T00:00:00+00:00",
    }),
  );
  assert.equal(parseFeed(xml).videos[0]!.title, "A & B <C>");
});

test("empty feed fails loudly (no silent empty JSON)", () => {
  assert.throws(
    () =>
      parseFeed(
        '<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom"></feed>',
      ),
    /no <entry>/i,
  );
});

test("malformed feed (entries missing video id / published date) fails loudly", () => {
  const xml = feedXml(
    CHANNEL_A,
    `<entry><id>yt:video:</id><title>sin id</title><published>2026-01-01T00:00:00+00:00</published></entry>`,
    entryXml({ videoId: "hhhhhhhhhhh", title: "sin fecha", published: "" }),
  );
  assert.throws(() => parseFeed(xml), /zero valid/i);
});

test("extractChannelId: key forms, dominant UC id, and loud failure", () => {
  assert.equal(extractChannelId('"channelId":"UCcEX40UDEqB3a_6o9j0NozQ"'), CHANNEL_A);
  assert.equal(
    extractChannelId('externalId":"UCcEX40UDEqB3a_6o9j0NozQ","keywords"'),
    CHANNEL_A,
  );
  const idA = `UC${"a".repeat(22)}`;
  const idB = `UC${"b".repeat(22)}`;
  const page = `"browseId":"${idA}"`.repeat(3) + `"browseId":"${idB}"`;
  assert.equal(extractChannelId(page), idA);
  assert.throws(() => extractChannelId("<html>sin ids</html>"), /channel id/i);
});

test("buildVideosData exposes the CMS JSON shape", async () => {
  const { channelId, videos } = parseFeed(await fixtureXml());
  const data = buildVideosData(channelId, feedUrl(channelId), "2026-10-03T12:00:00.000Z", videos);
  assert.deepEqual(Object.keys(data), ["channelId", "sourceUrl", "fetchedAt", "videos"]);
  assert.equal(data.channelId, channelId);
  assert.equal(data.sourceUrl, feedUrl(channelId));
  assert.equal(data.fetchedAt, "2026-10-03T12:00:00.000Z");
  assert.equal(data.videos.length, VIDEOS_LIMIT);
});
