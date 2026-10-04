/**
 * scripts/sanitize-html.test.ts
 *
 * TDD (RED primero) para el saneador puro de HTML de artículos de T13:
 * `site/src/lib/sanitizeHtml.ts`. Node (v26, type stripping nativo) importa
 * el `.ts` con extensión explícita; el saneador es autocontenido (cero
 * imports) para que el test no arrastre resolución de módulos.
 *
 * Run: node --test scripts/sanitize-html.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { sanitizeArticleHtml } from '../site/src/lib/sanitizeHtml.ts';

describe('sanitizeArticleHtml — <script>', () => {
  it('elimina un bloque <script> con contenido', () => {
    const html = '<p>hola</p><script>alert("x")</script><p>adios</p>';
    assert.equal(sanitizeArticleHtml(html), '<p>hola</p><p>adios</p>');
  });

  it('conserva el iframe de video.wordpress.com y elimina el <script src=...>', () => {
    const html =
      "<iframe src='https://video.wordpress.com/embed/x'></iframe>" +
      "<script src='https://v0.wordpress.com/js/next/videopress-iframe.js?m=1'></script>";
    // T17: el iframe de VideoPress pasa a la allowlist; el <script> del
    // player se sigue eliminando.
    assert.equal(
      sanitizeArticleHtml(html),
      "<iframe src='https://video.wordpress.com/embed/x'></iframe>",
    );
  });

  it('elimina <script> con atributos type y contenido inline', () => {
    const html = '<script type="text/javascript">var a = 1;</script>';
    assert.equal(sanitizeArticleHtml(html), '');
  });

  it('elimina <script> sin cerrar (hasta fin de cadena)', () => {
    const html = '<p>x</p><script src="https://evil.example/x.js"';
    assert.equal(sanitizeArticleHtml(html), '<p>x</p>');
  });

  it('elimina etiquetas <script> sueltas (sin > o sin </script>)', () => {
    assert.equal(sanitizeArticleHtml('<p>x</p></script>'), '<p>x</p>');
    assert.equal(sanitizeArticleHtml('<p>y</p><script'), '<p>y</p>');
  });
});

describe('sanitizeArticleHtml — iframes y allowlist de hosts', () => {
  const iframe = (src: string) => `<iframe width="640" height="360" src="${src}" allowfullscreen="true"></iframe>`;

  for (const host of [
    'https://www.youtube.com/embed/abcdefghijk?version=3&#038;rel=1',
    'https://youtube-nocookie.com/embed/abcdefghijk',
    'https://youtu.be/abcdefghijk',
    'https://player.vimeo.com/video/12345',
    'https://open.spotify.com/embed/track/abc',
    'https://embed.wistia.com/e/abc123',
  ]) {
    it(`conserva el iframe de host permitido: ${host}`, () => {
      const html = iframe(host);
      assert.equal(sanitizeArticleHtml(html), html);
    });
  }

  it('conserva el iframe de video.wordpress.com con src/width/allow y quita on*', () => {
    const html =
      "<iframe title='VideoPress Video Player' width='400' height='225' " +
      "src='https://video.wordpress.com/embed/eOk1uxWl?hd=0&amp;autoPlay=0' " +
      "allowfullscreen allow='clipboard-write; presentation' " +
      "onerror='alert(1)' onclick='alert(2)'></iframe>";
    assert.equal(
      sanitizeArticleHtml(html),
      "<iframe title='VideoPress Video Player' width='400' height='225' " +
        "src='https://video.wordpress.com/embed/eOk1uxWl?hd=0&amp;autoPlay=0' " +
        "allowfullscreen allow='clipboard-write; presentation'></iframe>",
    );
  });

  it('elimina iframes de hosts NO permitidos', () => {
    assert.equal(sanitizeArticleHtml(iframe('https://evil.example/embed')), '');
    assert.equal(sanitizeArticleHtml(iframe('https://youtube.com.evil.example/x')), '');
    assert.equal(sanitizeArticleHtml(iframe('/embed/relativo')), '');
    assert.equal(sanitizeArticleHtml('<iframe></iframe>'), '');
  });

  it('elimina el iframe no permitido con su </iframe> y conserva el resto', () => {
    const html =
      '<p>a</p><iframe src="https://evil.example/x"></iframe><p>b</p>';
    assert.equal(sanitizeArticleHtml(html), '<p>a</p><p>b</p>');
  });

  it('no se deja engañar por userinfo en el host (youtube.com@evil)', () => {
    assert.equal(
      sanitizeArticleHtml(iframe('https://youtube.com@evil.example/x')),
      '',
    );
  });

  it('elimina <IFRAME> en mayúsculas de host no permitido', () => {
    assert.equal(
      sanitizeArticleHtml('<IFRAME SRC="https://evil.example/x"></IFRAME>'),
      '',
    );
  });
});

describe('sanitizeArticleHtml — atributos on*', () => {
  it('elimina onclick, onerror, onload y variantes en mayúsculas', () => {
    const html =
      '<a href="https://x.example" onclick="alert(1)">link</a>' +
      '<img src="https://x.example/a.jpg" onerror="alert(2)" alt="foto">' +
      '<body ONLOAD="alert(3)">';
    assert.equal(
      sanitizeArticleHtml(html),
      '<a href="https://x.example">link</a>' +
        '<img src="https://x.example/a.jpg" alt="foto">' +
        '<body>',
    );
  });

  it('elimina atributos on* sin valor', () => {
    assert.equal(sanitizeArticleHtml('<img src="x.jpg" onload>'), '<img src="x.jpg">');
  });

  it('no toca texto plano que contenga "on=" fuera de etiquetas', () => {
    const html = '<p>config on=off y onclick=manual</p>';
    assert.equal(sanitizeArticleHtml(html), html);
  });
});

describe('sanitizeArticleHtml — URLs javascript: en href/src', () => {
  it('elimina href/src con esquema javascript:', () => {
    assert.equal(
      sanitizeArticleHtml('<a href="javascript:alert(1)">x</a>'),
      '<a>x</a>',
    );
    assert.equal(
      sanitizeArticleHtml('<img src="javascript:alert(1)" alt="a">'),
      '<img alt="a">',
    );
  });

  it('detecta ofuscación: mayúsculas, entidades y espacios de control', () => {
    assert.equal(sanitizeArticleHtml('<a href="JAVASCRIPT:alert(1)">x</a>'), '<a>x</a>');
    // Entidad numérica dentro del esquema: el parser de URLs del browser
    // la decodifica → javascript: ejecutable → se elimina.
    assert.equal(
      sanitizeArticleHtml('<a href="java&#115;cript:alert(1)">x</a>'),
      '<a>x</a>',
    );
    assert.equal(
      sanitizeArticleHtml('<a href="java\tscript:alert(1)">x</a>'),
      '<a>x</a>',
    );
    // `&colon;` decodifica a `java:script:alert(1)`, cuyo esquema es `java:`
    // (no ejecutable en ningún browser moderno): se conserva el enlace.
    // Contrato documentado en sanitizeHtml.ts: detección de esquema exacta.
    assert.equal(
      sanitizeArticleHtml('<a href="java&colon;script:alert(1)">x</a>'),
      '<a href="java&colon;script:alert(1)">x</a>',
    );
  });

  it('conserva href/src con esquemas normales', () => {
    const html = '<a href="https://example.com/p?x=1&#038;y=2">x</a><img src="https://e.com/a.jpg">';
    assert.equal(sanitizeArticleHtml(html), html);
  });
});

describe('sanitizeArticleHtml — conserva contenido legítimo', () => {
  it('mantiene imágenes, enlaces, formato y entidades intactos', () => {
    const html =
      '<p>Texto con <strong>negrita</strong>, <em>cursiva</em> y&nbsp;entidades &#8220;comillas&#8221; 😬.</p>' +
      '<img class=" size-full wp-image-1 aligncenter" src="https://prixline.wordpress.com/wp-content/uploads/2015/03/a.jpg?w=640&#038;h=427" height="427" width="640" alt="FP">' +
      '<a href="https://example.org/articulo/">enlace</a>' +
      '<ul><li>uno</li><li>dos</li></ul>' +
      '<h3 style="text-align:center">Subtítulo</h3>';
    assert.equal(sanitizeArticleHtml(html), html);
  });

  it('conserva iframes permitidos aunque lleven atributos largos', () => {
    const html =
      '<iframe loading="lazy" class="youtube-player" width="640" height="360" ' +
      'src="https://www.youtube.com/embed/8GqUO2pb4XA?version=3&#038;rel=1&#038;showsearch=0" ' +
      'allowfullscreen="true" style="border:0;" ' +
      'sandbox="allow-scripts allow-same-origin allow-popups"></iframe>';
    assert.equal(sanitizeArticleHtml(html), html);
  });
});

describe('sanitizeArticleHtml — reescribe enlaces del blog de origen (T24)', () => {
  it('internaliza href del blog de origen a rutas internas', () => {
    const cases: Array<[string, string]> = [
      ['<a href="https://prixline.blog/">inicio</a>', '<a href="/">inicio</a>'],
      ['<a href="https://prixline.blog/practicas/">prácticas</a>', '<a href="/practicas/">prácticas</a>'],
      ['<a href="http://prixline.wordpress.com/practicas/">prácticas</a>', '<a href="/practicas/">prácticas</a>'],
      ['<a href="https://www.prixline.blog/practicas/">prácticas</a>', '<a href="/practicas/">prácticas</a>'],
      ['<a href="https://prixline.blog/cursos/">cursos</a>', '<a href="/cursos/">cursos</a>'],
      ['<a href="http://prixline.wordpress.com/cursos/">cursos</a>', '<a href="/cursos/">cursos</a>'],
      ['<a href="http://www.prix.com/cursos">cursos</a>', '<a href="/cursos/">cursos</a>'],
      ['<a href="https://prixline.wordpress.com/contacto">contacto</a>', '<a href="/contacto/">contacto</a>'],
      ['<a href="http://prixline.wordpress.com/contacto/">contacto</a>', '<a href="/contacto/">contacto</a>'],
      ['<a href="https://prixline.blog/?p=123">inicio</a>', '<a href="/">inicio</a>'],
    ];
    for (const [input, expected] of cases) {
      assert.equal(sanitizeArticleHtml(input), expected, input);
    }
  });

  it('internaliza permalinks por fecha a /articulos/<slug>/', () => {
    const cases: Array<[string, string]> = [
      ['<a href="https://prixline.blog/2016/03/11/mi-slug/">art</a>', '<a href="/articulos/mi-slug/">art</a>'],
      ['<a href="http://prixline.wordpress.com/2012/12/11/ingles/">art</a>', '<a href="/articulos/ingles/">art</a>'],
      ['<a href="https://prixline.wordpress.com/2012/12/11/ingles/escuelas-de-ingles-prixline/">art</a>', '<a href="/articulos/escuelas-de-ingles-prixline/">art</a>'],
      ['<a href="https://prixline.blog/2016/03/11/mi%20slug/">art</a>', '<a href="/articulos/mi%20slug/">art</a>'],
      ['<a href="https://prixline.blog/2016/03/11/bad%zz/">art</a>', '<a href="/articulos/bad%25zz/">art</a>'],
    ];
    for (const [input, expected] of cases) {
      assert.equal(sanitizeArticleHtml(input), expected, input);
    }
  });

  it('disuelve anclas wp-admin conservando el texto', () => {
    assert.equal(
      sanitizeArticleHtml(
        '<a href="http://prixline.wordpress.com/wp-admin/post.php?post=269&amp;action=edit">texto</a>',
      ),
      'texto',
    );
  });

  it('disuelve anclas cuyo path de origen no se puede mapear', () => {
    assert.equal(
      sanitizeArticleHtml('<a href="https://prixline.wordpress.com/img_4553/">texto</a>'),
      'texto',
    );
    assert.equal(
      sanitizeArticleHtml(
        '<a href="http://prixline.wordpress.com/wp-content/uploads/2012/03/a.jpg"><img src="http://prixline.wordpress.com/wp-content/uploads/2012/03/a.jpg" alt="a"></a>',
      ),
      '<img src="http://prixline.wordpress.com/wp-content/uploads/2012/03/a.jpg" alt="a">',
    );
  });

  it('conserva enlaces de terceros y opiniones.wordpress.com', () => {
    // Nota: prix.com YA no se conserva — redirige 301 a prixline.blog, así
    // que se internaliza como el resto del blog de origen (decisión del
    // usuario 2026-10-04: ningún link puede terminar en el blog).
    const html =
      '<a href="https://opiniones.wordpress.com/2009/03/20/la-crisis-segun-albert-einstein/">cita</a>' +
      '<a href="http://avanzalaboral.com/2015/05/25/hoteles/">avanza</a>';
    assert.equal(sanitizeArticleHtml(html), html);
  });

  it('reescribe y disuelve en cuerpos reales del corpus', () => {
    const real =
      '<blockquote><p><strong><a title="Editar “Matrix”" href="http://prixline.wordpress.com/wp-admin/post.php?post=269&amp;action=edit">Una dimensión organizativa sin límites</a></strong></p></blockquote>';
    assert.equal(
      sanitizeArticleHtml(real),
      '<blockquote><p><strong>Una dimensión organizativa sin límites</strong></p></blockquote>',
    );
    const wrapped =
      '<a href="https://prixline.blog/practicas/"><img src="https://prixline.wordpress.com/wp-content/uploads/2012/03/practicas.jpeg" alt="x"></a>';
    assert.equal(
      sanitizeArticleHtml(wrapped),
      '<a href="/practicas/"><img src="https://prixline.wordpress.com/wp-content/uploads/2012/03/practicas.jpeg" alt="x"></a>',
    );
  });

  it('idempotente con enlaces de origen reescritos y disueltos', () => {
    const mixed =
      '<a href="https://prixline.blog/practicas/">prácticas</a>' +
      '<a href="http://prixline.wordpress.com/wp-admin/post.php?post=269&amp;action=edit">editar</a>' +
      '<a href="http://prixline.wordpress.com/2012/12/11/ingles/">inglés</a>' +
      '<a href="https://prixline.wordpress.com/img_4553/">foto</a>' +
      '<a href="https://opiniones.wordpress.com/x/">cita</a>';
    const once = sanitizeArticleHtml(mixed);
    assert.ok(!/prixline\.(blog|wordpress\.com)/.test(once));
    assert.equal(sanitizeArticleHtml(once), once);
  });

  it('triangulación: comillas simples, host en mayúsculas y title conservado', () => {
    assert.equal(
      sanitizeArticleHtml("<a href='http://prixline.wordpress.com/cursos/'>c</a>"),
      '<a href="/cursos/">c</a>',
    );
    assert.equal(
      sanitizeArticleHtml('<a href="https://PRIxline.Blog/practicas/">p</a>'),
      '<a href="/practicas/">p</a>',
    );
    assert.equal(
      sanitizeArticleHtml('<a title="Ver" href="https://prixline.blog/contacto">c</a>'),
      '<a title="Ver" href="/contacto/">c</a>',
    );
    assert.equal(
      sanitizeArticleHtml('<a href="http://prixline.wordpress.com/?p=9">i</a>'),
      '<a href="/">i</a>',
    );
  });

  it('triangulación: ancla sin cerrar y ancla sin href se tratan bien', () => {
    assert.equal(
      sanitizeArticleHtml('<a href="https://prixline.wordpress.com/img_4553/">texto'),
      'texto',
    );
    assert.equal(
      sanitizeArticleHtml('<a href="http://prixline.wordpress.com/cursos/">c'),
      '<a href="/cursos/">c',
    );
    assert.equal(sanitizeArticleHtml('<a name="ancla">x</a>'), '<a name="ancla">x</a>');
  });
});

describe('sanitizeArticleHtml — idempotencia', () => {
  it('sanear dos veces es igual que sanear una vez (mezcla hostil)', () => {
    const nasty =
      '<!-- comentario con <script> oculto -->' +
      '<p>intro</p>' +
      "<script src='https://v0.wordpress.com/js/x.js'></script>" +
      '<iframe src="https://video.wordpress.com/embed/x"></iframe>' +
      '<iframe src="https://www.youtube.com/embed/abcdefghijk"></iframe>' +
      '<a href="javascript:alert(1)" onclick="alert(2)" href2="x">malo</a>' +
      '<img src="https://ok.example/a.jpg" onerror="alert(3)" alt="ok">' +
      '<p>final&nbsp;🙂</p>';
    const once = sanitizeArticleHtml(nasty);
    assert.equal(sanitizeArticleHtml(once), once);
  });

  it('idempotente con la muestra real del corpus (VideoPress + YouTube)', () => {
    const real =
      "<p><span class=\"embed-youtube\" style=\"text-align:center; display: block;\">" +
      '<iframe loading="lazy" class="youtube-player" width="640" height="360" ' +
      'src="https://www.youtube.com/embed/8GqUO2pb4XA?version=3&#038;rel=1" ' +
      'allowfullscreen="true" style="border:0;" sandbox="allow-scripts"></iframe></span></p>' +
      "<iframe title='VideoPress Video Player' width='400' height='225' " +
      "src='https://video.wordpress.com/embed/eOk1uxWl?hd=0&amp;autoPlay=0' " +
      "frameborder='0' allowfullscreen allow='clipboard-write; presentation'></iframe>" +
      "<script src='https://v0.wordpress.com/js/next/videopress-iframe.js?m=1790791280'></script>";
    const once = sanitizeArticleHtml(real);
    // T17: YouTube y VideoPress conservados; el <script> del player eliminado.
    assert.ok(once.includes('youtube.com/embed/8GqUO2pb4XA'));
    assert.ok(once.includes('video.wordpress.com/embed/eOk1uxWl'));
    assert.ok(!once.includes('<script'));
    assert.equal(sanitizeArticleHtml(once), once);
  });
});
