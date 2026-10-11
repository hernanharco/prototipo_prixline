/**
 * scripts/family-map.test.ts
 *
 * TDD (RED primero) para la taxonomía de familias de cursos (fase 8
 * Prixline Course Families). La tabla `COURSE_FAMILIES` es cerrada y
 * determinista al estilo de `scripts/category-map.ts`: sin adivinanzas
 * por palabra clave, sin familias fuera de la taxonomía, y cobertura
 * 100% del corpus real de `content/courses/*.md` fijada aquí.
 *
 * Run: node --test scripts/family-map.test.ts
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { COURSE_FAMILIES, familyForSlug } from './course-families.ts';
import { FAMILIES, FAMILY_LABELS, isFamily } from './family-map.ts';

const COURSES_DIR = join(import.meta.dirname, '..', 'content', 'courses');

/** Slugs reales del corpus: clave del frontmatter de cada .md. */
function corpusSlugs(): string[] {
  return readdirSync(COURSES_DIR)
    .filter((file) => file.endsWith('.md'))
    .map((file) => {
      const body = readFileSync(join(COURSES_DIR, file), 'utf8');
      const match = /^slug: (.+)$/m.exec(body);
      assert.ok(match, `frontmatter sin slug: ${file}`);
      return match[1];
    })
    .sort();
}

describe('family-map — taxonomía de familias de cursos (S3)', () => {
  it('la taxonomía es única, tiene etiqueta para cada id y cubre las familias del cliente', () => {
    assert.equal(new Set(FAMILIES).size, FAMILIES.length, 'ids duplicados');
    for (const family of FAMILIES) {
      assert.equal(typeof FAMILY_LABELS[family], 'string', `sin etiqueta: ${family}`);
      assert.ok(FAMILY_LABELS[family].length > 0, `etiqueta vacía: ${family}`);
    }
    // El cliente nombró explícitamente informatica, salud y gestion (L1).
    for (const id of ['informatica', 'salud', 'gestion'] as const) {
      assert.ok(FAMILIES.includes(id), `familia requerida ausente: ${id}`);
    }
  });

  it('isFamily acepta solo ids de la taxonomía', () => {
    assert.equal(isFamily('salud'), true);
    assert.equal(isFamily('otro'), false);
    assert.equal(isFamily(''), false);
  });
});

describe('course-families — tabla cerrada clave-slug → familia (S3)', () => {
  it('cubre el 100% del corpus: sin slugs sin familia ni claves huérfanas', () => {
    const slugs = corpusSlugs();
    assert.ok(slugs.length >= 300, `corpus inesperadamente chico: ${slugs.length}`);

    const missing = slugs.filter((slug) => !(slug in COURSE_FAMILIES));
    assert.deepEqual(missing, [], `slugs sin familia: ${missing.join(', ')}`);

    const orphan = Object.keys(COURSE_FAMILIES).filter((slug) => !slugs.includes(slug));
    assert.deepEqual(orphan, [], `claves sin curso: ${orphan.join(', ')}`);
  });

  it('toda asignación es un id válido de la taxonomía', () => {
    for (const [slug, family] of Object.entries(COURSE_FAMILIES)) {
      assert.ok(isFamily(family), `${slug}: familia inválida «${family}»`);
    }
  });

  it('toda familia de la taxonomía tiene al menos un curso (sin familias vacías)', () => {
    const used = new Set(Object.values(COURSE_FAMILIES));
    const empty = FAMILIES.filter((family) => !used.has(family));
    assert.deepEqual(empty, [], `familias sin cursos: ${empty.join(', ')}`);
  });

  it('familyForSlug resuelve la tabla y devuelve undefined para slug desconocido', () => {
    assert.equal(familyForSlug('curso-de-informatica-para-principiantes'), 'informatica');
    assert.equal(familyForSlug('curso-de-auxiliar-de-enfermeria'), 'salud');
    assert.equal(familyForSlug('curso-de-contabilidad'), 'gestion');
    assert.equal(familyForSlug('curso-de-ingles-3-niveles'), 'idiomas');
    assert.equal(familyForSlug('curso-de-ingles-3-niveles'.toUpperCase()), undefined);
    assert.equal(familyForSlug('no-existe'), undefined);
  });
});
