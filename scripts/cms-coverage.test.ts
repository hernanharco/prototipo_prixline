/**
 * scripts/cms-coverage.test.ts (fase 10 — prixline-cms-coverage)
 *
 * TDD (RED primero) para scripts/cms-coverage.ts:
 *   1. Paridad S4: los defaults son byte a byte el copy ACTUAL hardcodeado
 *      en los componentes (si este test falla después de un refactor de
 *      copy, hay que actualizar componentes y defaults juntos).
 *   2. Seed idempotente: crea los settings que faltan, nunca sobreescribe
 *      contenido existente (ediciones del CMS), y el bloque `contact:` se
 *      añade una sola vez al frontmatter de contacto.md.
 *
 * Run: node --test scripts/cms-coverage.test.ts
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  contactoContactDefault,
  homeDefault,
  navDefault,
  patchFrontmatter,
  seed,
  seoDefault,
  toYamlBlock,
} from './cms-coverage.ts';

describe('defaults de cobertura CMS — paridad con el copy actual (S4)', () => {
  it('nav: wordmark, menú, CTA y footer = Header.astro/Footer.astro actuales', () => {
    assert.equal(navDefault.wordmark, 'Prixline');
    assert.equal(navDefault.menuLabel, 'Menú');
    assert.deepEqual(
      navDefault.items.map((item) => item.label),
      ['Migración', 'Cursos', 'Comunidad', 'Prácticas'],
    );
    assert.deepEqual(navDefault.cta, { href: '/contacto/', label: 'Contacto' });
    assert.deepEqual(navDefault.footer.blog, { href: '/articulos/', label: 'Blog' });
    assert.equal(navDefault.footer.originalText, 'Sitio original de Prixline');
    assert.equal(navDefault.footer.copyright, 'Todos los derechos reservados.');
  });

  it('home: hero = Hero.astro actual (tagline vive en site.json, no acá)', () => {
    assert.equal(navDefault.wordmark, 'Prixline');
    assert.equal(
      homeDefault.hero.heading,
      'Migra con responsabilidad y prepárate para estudiar y trabajar en España',
    );
    assert.equal(homeDefault.hero.primaryCta.label, 'Quiero migrar con responsabilidad');
    assert.equal(homeDefault.hero.secondaryCta.label, 'Ver los cursos');
  });

  it('home: sectionOrder cubre exactamente las secciones declaradas', () => {
    assert.deepEqual(homeDefault.sectionOrder, [
      'trust',
      'latest',
      'courses',
      'youtube',
      'practices',
      'community',
    ]);
    assert.deepEqual(
      [...homeDefault.sectionOrder].sort(),
      Object.keys(homeDefault.sections).sort(),
    );
  });

  it('home: copy de secciones = componentes actuales', () => {
    assert.equal(homeDefault.sections.trust.heading, 'Prixline en datos reales');
    assert.equal(homeDefault.sections.latest.heading, 'Últimos artículos');
    assert.equal(homeDefault.sections.courses.heading, 'Empieza por aquí');
    assert.equal(homeDefault.sections.youtube.heading, 'Videoclases y charlas de Prixline');
    assert.equal(homeDefault.sections.youtube.handlePrefix, 'Encuéntranos como');
    assert.equal(homeDefault.sections.practices.heading, 'Prácticas y trabajo');
    assert.equal(homeDefault.sections.community.heading, 'Sigue a Prixline');
    assert.ok(homeDefault.sections.community.intro.startsWith('{count} canales abiertos'));
  });

  it('seo: títulos actuales de home/cursos/articulos/contacto', () => {
    assert.equal(seoDefault.pages.home.title, 'Prixline — Cursos, prácticas y trabajo en España');
    assert.equal(seoDefault.pages.cursos.title, 'Cursos — Prixline');
    assert.equal(seoDefault.pages.articulos.title, 'Artículos — Prixline');
    assert.equal(seoDefault.pages.contacto.title, 'Contacto — Prixline');
    assert.ok(seoDefault.pages.cursos.description.includes('{count}'));
    assert.ok(seoDefault.pages.articulos.description.includes('{total}'));
    assert.ok(seoDefault.pages.contacto.description.includes('{channels}'));
  });

  it('contacto: property del chat real de Luis + copy actual', () => {
    assert.equal(contactoContactDefault.chatProperty, '58f1d6eaf7bbaa72709c64ff');
    assert.equal(contactoContactDefault.chatCta, 'Abrir chat con Prixline');
    assert.equal(contactoContactDefault.channelsTitle, 'Canales de comunidad');
    assert.ok(contactoContactDefault.intro.includes('{channels}'));
  });
});

describe('toYamlBlock / patchFrontmatter', () => {
  it('emite YAML plano con strings entrecomillados y escapados', () => {
    const yaml = toYamlBlock('contact', { chatTitle: '¿Hablamos?', quote: 'dice "hola"' });
    assert.equal(yaml, 'contact:\n  chatTitle: "¿Hablamos?"\n  quote: "dice \\"hola\\""');
  });

  it('añade el bloque una sola vez y respeta el body', () => {
    const md = '---\ntitle: Contacto\n---\n<p>body</p>\n';
    const block = toYamlBlock('contact', contactoContactDefault);
    const first = patchFrontmatter(md, block);
    assert.equal(first.changed, true);
    assert.ok(first.content.includes('title: Contacto\n\ncontact:'));
    assert.ok(first.content.endsWith('<p>body</p>\n'));
    const second = patchFrontmatter(first.content, block);
    assert.equal(second.changed, false);
    assert.equal(second.content, first.content);
  });

  it('lanza si el archivo no tiene frontmatter', () => {
    assert.throws(() => patchFrontmatter('<p>sin fm</p>', 'contact:'), /sin frontmatter/);
  });
});

describe('seed(baseDir) — idempotente sobre un repo temporal', () => {
  function fixtureRepo(): string {
    const base = mkdtempSync(join(tmpdir(), 'cms-coverage-'));
    mkdirSync(join(base, 'content', 'settings'), { recursive: true });
    mkdirSync(join(base, 'content', 'pages'), { recursive: true });
    writeFileSync(
      join(base, 'content', 'pages', 'contacto.md'),
      '---\ntitle: Contacto\nslug: contacto\n---\n<p>body original</p>\n',
      'utf8',
    );
    return base;
  }

  it('crea los 3 settings y parchea contacto.md; segunda corrida no toca nada', () => {
    const base = fixtureRepo();
    const first = seed(base);
    assert.equal(first.written.length, 3);
    assert.equal(first.patched.length, 1);

    const nav = JSON.parse(readFileSync(join(base, 'content', 'settings', 'nav.json'), 'utf8'));
    assert.equal(nav.wordmark, 'Prixline');
    const contacto = readFileSync(join(base, 'content', 'pages', 'contacto.md'), 'utf8');
    assert.ok(contacto.includes('chatProperty: "58f1d6eaf7bbaa72709c64ff"'));
    assert.ok(contacto.endsWith('<p>body original</p>\n'));

    // Edición del usuario (simulada): el seed no la pisa.
    writeFileSync(
      join(base, 'content', 'settings', 'nav.json'),
      JSON.stringify({ ...nav, wordmark: 'Prixline Editado' }, null, 2),
      'utf8',
    );
    const second = seed(base);
    assert.deepEqual(second, { written: [], patched: [] });
    const navAfter = JSON.parse(readFileSync(join(base, 'content', 'settings', 'nav.json'), 'utf8'));
    assert.equal(navAfter.wordmark, 'Prixline Editado');
    assert.ok(!existsSync(join(base, 'content', 'settings', 'home.json.bak')));
  });
});
