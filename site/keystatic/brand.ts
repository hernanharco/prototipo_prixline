/**
 * site/keystatic/brand.ts — T8 (S5 de odd/tasks/prixline-cms-ux)
 *
 * Monograma de Prixline para `ui.brand.mark` de Keystatic (único theming
 * oficial que expone: name + mark — ver Log L4 de la feature doc; su UI
 * no tiene variables CSS ni clases estables).
 *
 * Contrato BrandMark: `(props: { colorScheme: 'light' | 'dark' }) =>
 * ReactElement`. El config es `.ts` (sin JSX) ⇒ se construye con
 * `createElement`. Paleta idéntica a site/src/styles/global.css; en dark
 * se invierte (fondo oro, glifo navy-deep) para seguir visible sobre el
 * sidebar oscuro. El svg es decorativo: el nombre lo pone `ui.brand.name`.
 */
import { createElement } from 'react';

export const PALETTE = {
  navy: '#12314f',
  navyDeep: '#0c2339',
  gold: '#c8a24a',
} as const;

type ColorScheme = 'light' | 'dark';

export function brandMark({ colorScheme }: { colorScheme: ColorScheme }) {
  const background = colorScheme === 'dark' ? PALETTE.gold : PALETTE.navy;
  const glyph = colorScheme === 'dark' ? PALETTE.navyDeep : PALETTE.gold;

  return createElement(
    'svg',
    {
      viewBox: '0 0 32 32',
      width: 26,
      height: 26,
      role: 'img',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    // Fondo: cuadrado redondeado navy (oro en dark).
    createElement('rect', {
      x: 0,
      y: 0,
      width: 32,
      height: 32,
      rx: 8,
      fill: background,
    }),
    // Glifo "P" de Prixline, en oro (navy-deep en dark).
    createElement('path', {
      d: 'M11 25V7h6.2a5.6 5.6 0 0 1 0 11.2h-2.6V25H11Zm3.6-9.2h2.4a2.2 2.2 0 0 0 0-4.4h-2.4v4.4Z',
      fill: glyph,
    }),
  );
}
