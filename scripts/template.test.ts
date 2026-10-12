/**
 * scripts/template.test.ts (fase 10 — cms-coverage)
 *
 * TDD (RED primero) para site/src/lib/template.ts.
 *
 * Run: node --test scripts/template.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fillTemplate } from '../site/src/lib/template.ts';

describe('fillTemplate — placeholders del CMS', () => {
  it('sustituye el placeholder por el valor (string y number)', () => {
    assert.equal(fillTemplate('{count} canales abiertos', { count: 11 }), '11 canales abiertos');
    assert.equal(
      fillTemplate('Catálogo: {count} cursos ordenados.', { count: 302 }),
      'Catálogo: 302 cursos ordenados.',
    );
  });

  it('sustituye todas las apariciones del mismo placeholder', () => {
    assert.equal(fillTemplate('{n} de {n} canales', { n: 4 }), '4 de 4 canales');
  });

  it('placeholder desconocido se conserva tal cual (fail-visible)', () => {
    assert.equal(fillTemplate('Hola {nombre}', { count: 3 }), 'Hola {nombre}');
  });

  it('texto sin placeholders vuelve intacto', () => {
    assert.equal(fillTemplate('Sin marcadores.', { count: 1 }), 'Sin marcadores.');
  });
});
