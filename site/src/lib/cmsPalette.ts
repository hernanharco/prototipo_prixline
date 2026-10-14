/**
 * site/src/lib/cmsPalette.ts — T9 (S5 de odd/tasks/prixline-cms-ux)
 *
 * Hoja de paleta del CMS y su inyección en el HTML de /keystatic.
 *
 * Por qué existe: Keystatic 0.6.9 NO expone theming — 0 variables CSS en
 * todo @keystatic/core/dist y estilos Emotion con clases hasheadas (Log
 * L4 de la feature doc). La única superficie oficial es ui.brand; el resto
 * se recolorea con una hoja propia inyectada por el middleware sobre
 * selectores ESTRUCTURALES estables (<nav>, aria-current, body, header,
 * button, a) — nunca clases hasheadas como ancla única (se romperían en
 * cada upgrade; T10 declara ese re-check como deuda).
 *
 * Paleta: idéntica a site/src/styles/global.css (navy #12314f, navy-deep
 * #0c2339, oro #c8a24a, fondo #f7f8fa, texto #1b2733, muted #5b6773).
 */

export const PALETTE_STYLE_ID = 'prixline-cms-palette';

/**
 * Selectores estructurales (inmunes al hash de Emotion):
 *  - nav            → sidebar real de Keystatic (keystar-ui-nav-list
 *                     renderiza un <nav>); su item activo lleva
 *                     aria-current (16 usos en el bundle).
 *  - body/main      → fondo de la app.
 *  - header         → barra superior si existe (si no, la regla no hace
 *                     daño).
 *  - a/button       → acentos (enlaces y foco) en oro.
 * Si el selector no existe en una versión futura, la regla se ignora: el
 * fallo es silencioso y degradado, nunca roto.
 */
export const CMS_PALETTE_CSS = `
/* Paleta Prixline para el admin de Keystatic (T9, S5) — el id de la
   hoja lo pone injectPaletteHtml, no el CSS. */
:root { color-scheme: light; }

body {
  background-color: #f7f8fa !important;
  color: #1b2733 !important;
}

/* Sidebar: navy profundo con texto claro, acentos en oro. */
nav {
  background-color: #0c2339 !important;
  border-right-color: #12314f !important;
}
nav a,
nav button,
nav [role="link"] {
  color: #c7d2dc !important;
}
nav a:hover,
nav button:hover {
  color: #ffffff !important;
}
/* Item activo (aria-current) en oro — el gancho estable del bundle. */
nav a[aria-current],
nav [aria-current] {
  color: #c8a24a !important;
  box-shadow: inset 3px 0 0 0 #c8a24a;
}

/* Barra superior si el DOM la expone como <header>. */
header {
  background-color: #ffffff !important;
  border-bottom-color: #dde3ea !important;
  color: #12314f !important;
}

/* Acentos: enlaces y foco visible en oro. */
main a {
  color: #12314f !important;
}
main a:hover {
  color: #8a6b1f !important;
}
:focus-visible {
  outline-color: #c8a24a !important;
}
`.trim();

/**
 * ¿Esta respuesta debe recibir la hoja? Sólo el HTML renderizado de
 * /keystatic* (200 + text/html). La API (/api/keystatic/*), redirecciones
 * y el resto del sitio quedan intactos.
 */
export function shouldInjectPalette(
  pathname: string,
  status: number,
  contentType: string | null,
): boolean {
  return (
    pathname.startsWith('/keystatic') &&
    status === 200 &&
    (contentType ?? '').includes('text/html')
  );
}

/**
 * Inserción idempotente de la hoja. Sin <head>/<body> (HTML parcial) se
 * prepende; con <head> va dentro de él.
 */
export function injectPaletteHtml(html: string): string {
  if (html.includes(PALETTE_STYLE_ID)) return html;
  const style = `<style id="${PALETTE_STYLE_ID}">${CMS_PALETTE_CSS}</style>`;
  if (html.includes('</head>')) {
    return html.replace('</head>', `${style}\n</head>`);
  }
  return style + html;
}
