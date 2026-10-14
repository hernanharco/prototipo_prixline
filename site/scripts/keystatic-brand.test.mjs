#!/usr/bin/env node
// T8 (S5 de odd/tasks/prixline-cms-ux) — brand mark de Prixline para
// ui.brand.mark de Keystatic.
//
// Verifica que el monograma:
//   1. cumple el contrato BrandMark (function que recibe {colorScheme}
//      y devuelve un ReactElement svg);
//   2. usa SÓLO la paleta de la web (site/src/styles/global.css):
//      navy #12314f, navy-deep #0c2339, oro #c8a24a, y sus versiones
//      para fondo oscuro (inverso);
//   3. marca el svg como decorativo (aria-hidden) — el nombre visible
//      lo pone ui.brand.name ("Prixline").
//
// Run (desde la raíz del repo): node --test site/scripts/keystatic-brand.test.mjs
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { brandMark, PALETTE } from '../keystatic/brand.ts';

function collectFills(node, out = []) {
  if (node === null || node === undefined || typeof node !== 'object') return out;
  if (node.props) {
    if (typeof node.props.fill === 'string') out.push(node.props.fill);
    const children = node.props.children;
    if (Array.isArray(children)) {
      for (const child of children) collectFills(child, out);
    } else if (children) {
      collectFills(children, out);
    }
  }
  return out;
}

describe('brand mark Prixline (ui.brand.mark)', () => {
  it('devuelve un svg decorativo con la paleta de la web (light)', () => {
    const el = brandMark({ colorScheme: 'light' });
    assert.equal(el.type, 'svg');
    assert.equal(el.props['aria-hidden'], 'true');
    const fills = collectFills(el);
    assert.ok(fills.length >= 2, 'el monograma debe tener fondo + glifo');
    for (const fill of fills) {
      assert.ok(
        Object.values(PALETTE).includes(fill),
        `fill "${fill}" fuera de la paleta Prixline`,
      );
    }
    assert.ok(fills.includes(PALETTE.navy), 'light: el fondo del monograma es navy');
  });

  it('invierte la paleta en dark para seguir visible', () => {
    const fills = collectFills(brandMark({ colorScheme: 'dark' }));
    assert.ok(fills.includes(PALETTE.gold), 'dark: el fondo pasa a oro');
    assert.ok(fills.includes(PALETTE.navyDeep), 'dark: el glifo pasa a navy profundo');
  });
});
