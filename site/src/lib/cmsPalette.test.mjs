/**
 * site/src/lib/cmsPalette.test.mjs — T9 (S5 de odd/tasks/prixline-cms-ux)
 *
 * TDD (RED primero) para la inyección de la hoja de paleta del CMS.
 * Keystatic 0.6.9 no expone theming (Log L4): la hoja se inyecta en el
 * HTML de /keystatic desde el middleware. Contrato de injectPaletteHtml:
 *   1. idempotente (dos inyecciones ⇒ una sola hoja);
 *   2. sin <head>/<body> (HTML parcial) ⇒ prepend sin romper;
 *   3. la hoja marca su presencia con un id concreto.
 *
 * Run (desde la raíz del repo): node --test site/src/lib/cmsPalette.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { injectPaletteHtml, PALETTE_STYLE_ID } from './cmsPalette.ts';

describe('injectPaletteHtml (inyección de la paleta del CMS)', () => {
  it('inyecta la hoja antes de </head> una sola vez', () => {
    const html = '<!doctype html><html><head><title>x</title></head><body><div id="root"></div></body></html>';
    const once = injectPaletteHtml(html);
    assert.ok(once.includes(PALETTE_STYLE_ID), 'la hoja debe estar presente');
    assert.ok(
      once.indexOf(PALETTE_STYLE_ID) < once.indexOf('</head>'),
      'la hoja debe ir dentro de <head>',
    );
    const twice = injectPaletteHtml(once);
    const count = twice.split(PALETTE_STYLE_ID).length - 1;
    assert.equal(count, 1, 'la segunda inyección no debe duplicar la hoja');
  });

  it('sin </head> ni </body> hace prepend sin romper el HTML', () => {
    const partial = '<div>panel</div>';
    const out = injectPaletteHtml(partial);
    assert.ok(out.startsWith('<style'), 'sin head/body la hoja se prepende');
    assert.ok(out.endsWith(partial), 'el HTML original queda intacto al final');
  });

  it('la hoja usa sólo la paleta de la web (navy/oro)', () => {
    const out = injectPaletteHtml('<html><head></head><body></body></html>');
    assert.match(out, /#12314f/, 'navy');
    assert.match(out, /#0c2339/, 'navy-deep');
    assert.match(out, /#c8a24a/, 'oro');
  });
});
