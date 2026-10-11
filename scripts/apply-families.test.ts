/**
 * scripts/apply-families.test.ts
 *
 * TDD (RED primero) para el backfill de `family` en content/courses
 * (fase 8, S4). Reglas fijadas aquí:
 *   - Inserta `family: <id>` tras la línea `slug:` del frontmatter.
 *   - Idempotente: re-ejecutar sobre un archivo ya backfilleado no cambia nada.
 *   - No pisa un `family` existente (una corrección hecha desde el CMS
 *     gana sobre la tabla; el productor solo rellena huecos).
 *   - No toca el cuerpo del temario.
 *
 * Run: node --test scripts/apply-families.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { addFamilyToMarkdown } from './apply-families.ts';

const SAMPLE = `---
title: CURSO DE CONTABILIDAD
slug: curso-de-contabilidad
sourceUrl: https://prixline.blog/cursos/
extractedAt: 2026-10-03T06:06:31.424Z
---

# CURSO DE CONTABILIDAD

contabilidad, empresa, numeros

– Temario de ejemplo.
`;

describe('addFamilyToMarkdown — backfill de family (S4)', () => {
  it('inserta family tras la línea slug del frontmatter', () => {
    const result = addFamilyToMarkdown(SAMPLE, 'gestion');
    const lines = result.split('\n');
    assert.equal(lines[lines.indexOf('slug: curso-de-contabilidad') + 1], 'family: gestion');
    assert.ok(result.includes('slug: curso-de-contabilidad\nfamily: gestion'));
  });

  it('es idempotente: dos aplicaciones = mismo resultado', () => {
    const once = addFamilyToMarkdown(SAMPLE, 'gestion');
    const twice = addFamilyToMarkdown(once, 'gestion');
    assert.equal(twice, once);
  });

  it('no pisa un family existente (gana la corrección del CMS)', () => {
    const edited = addFamilyToMarkdown(SAMPLE, 'gestion').replace(
      'family: gestion',
      'family: salud',
    );
    assert.equal(addFamilyToMarkdown(edited, 'informatica'), edited);
  });

  it('no toca el cuerpo del temario', () => {
    const result = addFamilyToMarkdown(SAMPLE, 'gestion');
    const body = result.slice(result.indexOf('---', 3) + 3);
    assert.equal(body, SAMPLE.slice(SAMPLE.indexOf('---', 3) + 3));
  });

  it('falla a la vista si el archivo no tiene frontmatter con slug', () => {
    assert.throws(() => addFamilyToMarkdown('sin frontmatter', 'gestion'), /frontmatter/);
  });
});
