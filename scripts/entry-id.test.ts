/**
 * scripts/entry-id.test.ts
 *
 * TDD (RED primero) para el módulo puro de ids de entrada de T16:
 * `site/src/lib/entryId.ts`. Node (v26, type stripping nativo) importa
 * el `.ts` con extensión explícita; el módulo es autocontenido (cero
 * imports) para que el test no arrastre resolución de módulos.
 *
 * Run: node --test scripts/entry-id.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { generateId } from '../site/src/lib/entryId.ts';

describe('generateId — T16 (módulo puro extraído de content.config.ts)', () => {
  it('decodifica slugs UTF-8 percent-encoded (emoji del corpus)', () => {
    assert.equal(
      generateId({ entry: 'x', data: { slug: 'mi-entrada-%f0%9f%98%ac' } }),
      'mi-entrada-😬',
    );
  });

  it('secuencia percent malformada (bad%zz%) cae al valor crudo sin lanzar', () => {
    assert.equal(
      generateId({ entry: 'x', data: { slug: 'bad%zz%' } }),
      'bad%zz%',
    );
  });

  it('slug numérico (data.slug === 100) → "100"', () => {
    assert.equal(generateId({ entry: 'x', data: { slug: 100 } }), '100');
  });

  it('slug plano pasa sin cambios', () => {
    assert.equal(
      generateId({ entry: 'x', data: { slug: 'mi-entrada-plana' } }),
      'mi-entrada-plana',
    );
  });

  it('sin data.slug cae al valor de entry', () => {
    assert.equal(
      generateId({ entry: 'entrada-fallback', data: {} }),
      'entrada-fallback',
    );
  });
});
