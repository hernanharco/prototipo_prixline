/**
 * scripts/thumbnail.test.ts
 *
 * T11 thumbnail extraction suite (split from import-posts.test.ts to keep
 * every file under the 400-line cap). Pure/offline: synthetic HTML only,
 * no fixtures, no network.
 *
 * Covers extractThumbnail(): YouTube priority, <img> attribute priority,
 * the low-value-image (avatar) filter, and the "never emit empty strings"
 * guarantee.
 *
 * Run: node --test scripts/thumbnail.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { extractThumbnail } from "./post-render.ts";

test("extractThumbnail: YouTube embed → videoId + hqdefault thumbnail", () => {
  const html =
    '<figure class="wp-block-embed is-provider-youtube"><div class="embed-youtube">' +
    '<iframe src="https://www.youtube.com/embed/jmRtex1vdzU?feature=oembed"></iframe>' +
    "</div></figure>\n<p>Texto después del vídeo.</p>";
  assert.deepEqual(extractThumbnail(html), {
    videoId: "jmRtex1vdzU",
    thumbnail: "https://i.ytimg.com/vi/jmRtex1vdzU/hqdefault.jpg",
  });
});

test("extractThumbnail: YouTube URL variants (watch, youtu.be, nocookie)", () => {
  const cases: Array<[string, string]> = [
    ['<a href="https://www.youtube.com/watch?v=ZsEG-uHdYfw&amp;t=540s">x</a>', "ZsEG-uHdYfw"],
    ['<a href="https://youtu.be/ySvMnOIFhhE">x</a>', "ySvMnOIFhhE"],
    [
      '<iframe src="https://www.youtube-nocookie.com/embed/88dXKrMH2sg?feature=oembed"></iframe>',
      "88dXKrMH2sg",
    ],
  ];
  for (const [html, videoId] of cases) {
    assert.deepEqual(
      extractThumbnail(html),
      { videoId, thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` },
      `variant not matched: ${html}`,
    );
  }
});

test("extractThumbnail: first <img> — src, then lazy attrs, then srcset", () => {
  // Plain absolute src wins.
  assert.deepEqual(
    extractThumbnail('<img src="https://prixline.blog/wp-content/uploads/2015/03/fp.jpg" alt="x">'),
    { thumbnail: "https://prixline.blog/wp-content/uploads/2015/03/fp.jpg" },
  );
  // Lazy-load shape: src is a data: placeholder → data-lazy-src is the real URL.
  assert.deepEqual(
    extractThumbnail(
      '<img class="lazyload" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" ' +
        'data-lazy-src="https://prixline.blog/wp-content/uploads/2024/05/curso-fp.jpg">',
    ),
    { thumbnail: "https://prixline.blog/wp-content/uploads/2024/05/curso-fp.jpg" },
  );
  // data-src without any src attribute.
  assert.deepEqual(
    extractThumbnail('<img data-src="http://empleoyorientacionsalamanca.files.wordpress.com/2011/10/sectores.jpg">'),
    { thumbnail: "http://empleoyorientacionsalamanca.files.wordpress.com/2011/10/sectores.jpg" },
  );
  // srcset present only → first candidate.
  assert.deepEqual(
    extractThumbnail(
      '<img srcset="https://prixline.blog/wp-content/uploads/2024/05/a.jpg 600w, https://prixline.blog/wp-content/uploads/2024/05/b.jpg 300w">',
    ),
    { thumbnail: "https://prixline.blog/wp-content/uploads/2024/05/a.jpg" },
  );
  // Relative URL is not valid → no thumbnail.
  assert.deepEqual(extractThumbnail('<img src="/wp-content/uploads/2024/05/x.jpg">'), {});
});

test("extractThumbnail: no media at all → both fields absent (never empty strings)", () => {
  assert.deepEqual(extractThumbnail("<p>Solo texto, sin medios.</p>"), {});
  assert.deepEqual(extractThumbnail(""), {});
});

// --- T11 quality filter: reject low-value (avatar/identicon) images --------

test("extractThumbnail: avatar first, real inline image later → real image wins", () => {
  // Real reblog-snapshot shape: gravatar avatar (class="avatar avatar-32",
  // ?s=32&d=identicon) followed by the actual content image.
  const html =
    '<div class="wpcom-reblog-snapshot"><p>' +
    "<img alt='El Blog de TEIDE-HEASE&#039;s avatar' " +
    'src="https://2.gravatar.com/avatar/5072f325eae065a28fe7a4b90d6b679d94d9e48aa90b2afb1f594b9331272509?s=32&#038;d=identicon&#038;r=G" ' +
    'class="avatar avatar-32" height="32" width="32" /></p></div>' +
    '<p><img class=" size-full wp-image-10295 aligncenter" ' +
    'src="https://prixline.wordpress.com/wp-content/uploads/2015/03/fp-telefonica.jpg?w=640&#038;h=427" ' +
    'height="427" width="640" alt="FP Telefónica"></p>';
  assert.deepEqual(extractThumbnail(html), {
    thumbnail:
      "https://prixline.wordpress.com/wp-content/uploads/2015/03/fp-telefonica.jpg?w=640&h=427",
  });
});

test("extractThumbnail: avatar-only post → both fields absent", () => {
  const html =
    '<p><img alt="avatar" src="https://0.gravatar.com/avatar/abc123?s=32&#038;d=identicon" class="avatar avatar-32"></p>' +
    "<p>Solo texto después del avatar.</p>";
  assert.deepEqual(extractThumbnail(html), {});
});

test("extractThumbnail: gravatar s=32 rejected even without avatar class", () => {
  // No class attribute at all — the s=<n> param (n ≤ 128) alone rejects it.
  assert.deepEqual(
    extractThumbnail('<img src="https://2.gravatar.com/avatar/96772dfc?s=32&#038;d=identicon">'),
    {},
  );
  // ANY *.gravatar.com host is rejected unconditionally (parent spec), even
  // without class, /avatar/ path or s= param — gravatar only serves avatars.
  assert.deepEqual(extractThumbnail('<img src="https://2.gravatar.com/logo.png">'), {});
  // A plain non-avatar URL on an unrelated host stays.
  assert.deepEqual(
    extractThumbnail('<img src="https://example.com/logo.png">'),
    { thumbnail: "https://example.com/logo.png" },
  );
});

test("extractThumbnail: avatar filters — class, /avatar/ path, small s= param", () => {
  // class attribute contains "avatar" on a NON-gravatar host → rejected.
  assert.deepEqual(
    extractThumbnail('<img class="wp-image-avatar" src="https://example.com/photo.jpg">'),
    {},
  );
  // /avatar/ in the path on any host → rejected.
  assert.deepEqual(
    extractThumbnail('<img src="https://example.com/users/avatar/large.png">'),
    {},
  );
  // s=<n> with n ≤ 128 on any host → rejected.
  assert.deepEqual(extractThumbnail('<img src="https://example.com/photo.jpg?s=32">'), {});
  // s=<n> with n > 128 is a real image → kept.
  assert.deepEqual(
    extractThumbnail('<img src="https://example.com/photo.jpg?s=640">'),
    { thumbnail: "https://example.com/photo.jpg?s=640" },
  );
});

test("extractThumbnail: scanning continues past unusable and avatar tags", () => {
  // Relative tag + avatar tag + real image → real image (scanning must not
  // stop at the first rejected candidate).
  const html =
    '<img src="/wp-content/uploads/2024/05/relative.jpg">' +
    '<img class="avatar" src="https://1.gravatar.com/avatar/x?s=32">' +
    '<img src="https://ticsyformacion.com/wp-content/uploads/2019/03/infografia.png">';
  assert.deepEqual(extractThumbnail(html), {
    thumbnail: "https://ticsyformacion.com/wp-content/uploads/2019/03/infografia.png",
  });
});

test("extractThumbnail: YouTube priority unchanged when avatars present", () => {
  const html =
    '<img class="avatar avatar-32" src="https://0.gravatar.com/avatar/x?s=32">' +
    '<iframe src="https://www.youtube.com/embed/NgHQgpGmivs?feature=oembed"></iframe>';
  assert.deepEqual(extractThumbnail(html), {
    videoId: "NgHQgpGmivs",
    thumbnail: "https://i.ytimg.com/vi/NgHQgpGmivs/hqdefault.jpg",
  });
});
