/**
 * scripts/migrate-post-thumbnails.test.ts (fase prixline-cms-ux — T5/S4)
 *
 * TDD (RED primero) para la migración "Migración completa" elegida por el
 * usuario: los thumbnails de content/posts pasan de texto libre a campo
 * image de Keystatic.
 *
 *   - valor local `/media/uploads/<ruta>` → copia el binario a
 *     `uploads/<slug>/thumbnail.<ext>` y reescribe el valor a
 *     `/media/uploads/<slug>/thumbnail.<ext>` (layout canónico: con el
 *     slug de la entrada presente, parse/serialize de fields.image exigen
 *     publicPath + slug + '/' + fichero).
 *   - valor URL externa (las 142 del corpus) → se DESCARTA la clave
 *     (decisión del usuario, S4) y el binario original no se toca.
 *   - ausente o ya canónico → intacto.
 *   - Idempotente: la segunda pasada no modifica nada.
 *   - Borrado nunca: los ficheros origen siguen ahí (pueden citarlos los
 *     cuerpos .md).
 *
 * Run: node --test scripts/migrate-post-thumbnails.test.ts
 */
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { migratePostThumbnails } from './migrate-post-thumbnails.ts';

type Fixture = {
  root: string;
  postsDir: string;
  uploadsDir: string;
  write: (rel: string, content: string | Uint8Array) => void;
  read: (rel: string) => string;
  bytes: (rel: string) => Uint8Array;
  snapshot: () => Record<string, string>;
};

function makeFixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), 'prx-thumb-'));
  const postsDir = join(root, 'posts');
  const uploadsDir = join(root, 'uploads');
  mkdirSync(postsDir, { recursive: true });
  mkdirSync(uploadsDir, { recursive: true });
  const write = (rel: string, content: string | Uint8Array) => {
    const abs = join(root, rel);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, content);
  };
  const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
  const bytes = (rel: string) => new Uint8Array(readFileSync(join(root, rel)));
  const snapshot = (): Record<string, string> => {
    const out: Record<string, string> = {};
    const walk = (dir: string) => {
      for (const name of readdirSync(dir, { withFileTypes: true })) {
        const abs = join(dir, name.name);
        if (name.isDirectory()) walk(abs);
        else out[abs.slice(root.length + 1)] = Buffer.from(readFileSync(abs)).toString('base64');
      }
    };
    walk(root);
    return out;
  };
  return { root, postsDir, uploadsDir, write, read, bytes, snapshot };
}

const POST_A = [
  '---',
  'id: 1',
  'title: Entrada A',
  'slug: a',
  'thumbnail: /media/uploads/2017/11/x.jpg',
  '---',
  '<p>cuerpo a</p>',
  '',
].join('\n');

const POST_B = [
  '---',
  'id: 2',
  'title: Entrada B',
  'slug: b',
  'thumbnail: "http://ex.com/b.jpg?w=300"',
  '---',
  '<p>cuerpo b</p>',
  '',
].join('\n');

const POST_C = ['---', 'id: 3', 'title: Entrada C', 'slug: c', '---', '<p>cuerpo c</p>', ''].join(
  '\n',
);

const POST_D = [
  '---',
  'id: 4',
  'title: Entrada D',
  'slug: d',
  'thumbnail: /media/uploads/d/thumbnail.png',
  '---',
  '<p>cuerpo d</p>',
  '',
].join('\n');

describe('migrate-post-thumbnails (S4 "Migración completa")', () => {
  it('migra valores locales, descarta URLs externas y respeta ausentes/canónicos', () => {
    const fx = makeFixture();
    fx.write('posts/a.md', POST_A);
    fx.write('posts/b.md', POST_B);
    fx.write('posts/c.md', POST_C);
    fx.write('posts/d.md', POST_D);
    fx.write('uploads/2017/11/x.jpg', 'IMG-JPG');
    fx.write('uploads/d/thumbnail.png', 'IMG-PNG');

    const report = migratePostThumbnails({
      postsDir: fx.postsDir,
      uploadsDir: fx.uploadsDir,
      apply: true,
    });

    // a: valor canónico + binario copiado al layout <slug>/thumbnail.<ext>
    assert.match(fx.read('posts/a.md'), /thumbnail: \/media\/uploads\/a\/thumbnail\.jpg/);
    assert.deepEqual(fx.bytes('uploads/a/thumbnail.jpg'), new Uint8Array(Buffer.from('IMG-JPG')));
    // el binario original NUNCA se borra (los cuerpos pueden citarlo)
    assert.ok(existsSync(join(fx.root, 'uploads/2017/11/x.jpg')), 'el origen debe seguir');
    assert.match(fx.read('posts/a.md'), /<p>cuerpo a<\/p>/, 'el cuerpo no cambia');

    // b: URL externa descartada (clave fuera, cuerpo intacto)
    assert.ok(!fx.read('posts/b.md').includes('thumbnail:'), 'la clave externa se elimina');
    assert.match(fx.read('posts/b.md'), /<p>cuerpo b<\/p>/);

    // c: sin thumbnail → byte a byte
    assert.equal(fx.read('posts/c.md'), POST_C);

    // d: ya canónico → byte a byte
    assert.equal(fx.read('posts/d.md'), POST_D);

    assert.deepEqual(
      { migrated: report.migrated.length, discarded: report.discarded.length, missing: report.missing.length, untouched: report.untouched },
      { migrated: 1, discarded: 1, missing: 0, untouched: 2 },
    );
  });

  it('es idempotente: la segunda pasada no cambia nada', () => {
    const fx = makeFixture();
    fx.write('posts/a.md', POST_A);
    fx.write('posts/b.md', POST_B);
    fx.write('posts/c.md', POST_C);
    fx.write('posts/d.md', POST_D);
    fx.write('uploads/2017/11/x.jpg', 'IMG-JPG');
    fx.write('uploads/d/thumbnail.png', 'IMG-PNG');

    migratePostThumbnails({ postsDir: fx.postsDir, uploadsDir: fx.uploadsDir, apply: true });
    const after = fx.snapshot();
    const report = migratePostThumbnails({
      postsDir: fx.postsDir,
      uploadsDir: fx.uploadsDir,
      apply: true,
    });
    assert.deepEqual(fx.snapshot(), after, 'la segunda pasada debe ser un no-op');
    assert.equal(report.migrated.length, 0);
    assert.equal(report.discarded.length, 0);
    assert.equal(report.missing.length, 0);
    assert.equal(report.untouched, 4);
  });

  it('dry-run (apply=false) no toca nada pero reporta lo que haría', () => {
    const fx = makeFixture();
    fx.write('posts/a.md', POST_A);
    fx.write('posts/b.md', POST_B);
    fx.write('uploads/2017/11/x.jpg', 'IMG-JPG');
    const before = fx.snapshot();

    const report = migratePostThumbnails({
      postsDir: fx.postsDir,
      uploadsDir: fx.uploadsDir,
      apply: false,
    });

    assert.deepEqual(fx.snapshot(), before, 'dry-run no debe escribir');
    assert.equal(report.migrated.length, 1);
    assert.equal(report.discarded.length, 1);
    assert.equal(existsSync(join(fx.root, 'uploads/a/thumbnail.jpg')), false);
  });

  it('un valor local cuyo binario no existe se descarta y se reporta como missing', () => {
    const fx = makeFixture();
    fx.write(
      'posts/e.md',
      [
        '---',
        'slug: e',
        'thumbnail: /media/uploads/2099/01/gone.jpg',
        '---',
        '<p>cuerpo e</p>',
        '',
      ].join('\n'),
    );

    const report = migratePostThumbnails({
      postsDir: fx.postsDir,
      uploadsDir: fx.uploadsDir,
      apply: true,
    });

    assert.ok(!fx.read('posts/e.md').includes('thumbnail:'), 'missing ⇒ se descarta la clave');
    assert.equal(report.missing.length, 1);
    assert.equal(report.migrated.length, 0);
    assert.match(fx.read('posts/e.md'), /<p>cuerpo e<\/p>/);
  });
});
