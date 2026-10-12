/**
 * site/src/lib/template.ts (fase 10 — cms-coverage)
 *
 * Rellena los placeholders `{name}` de las plantillas editables desde el
 * CMS (seo.json, home.json.community.intro, contacto.intro). Los números
 * reales (recuentos de cursos/artículos/canales) los aporta el componente
 * en render: el cliente edita el texto, nunca el dato.
 *
 * - `{name}` con nombre conocido → sustituido por el valor (cualquier
 *   valor no string se stringifica).
 * - Placeholder desconocido → se conserva tal cual (fail-visible en
 *   pantalla, nunca un string vacío silencioso).
 * - Mismo placeholder repetido → sustituye todas las apariciones.
 */

export function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}
