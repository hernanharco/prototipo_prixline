/**
 * site/src/lib/adminGate.ts — T3 (specs S1/S3 de odd/tasks/prixline-admin-auth.md)
 *
 * Decisión del middleware de protección del admin (site/src/middleware.ts):
 * qué rutas exigen un JWT válido de authCore y con qué respuesta.
 *
 * - `page`: UI de Keystatic y el redirect /admin → 307/302 a /admin/login.
 * - `api`: API inyectada de Keystatic → 401 JSON (una API no debe recibir
 *   un redirect HTML: el cliente de Keystatic no lo seguiría y el motivo
 *   de fallo queda claro en la respuesta).
 * - `public`: todo lo demás, incluida la propia página de login (si no,
 *   el gate no tendría puerta) y el callback OAuth (/auth/callback).
 *
 * Fronteras de prefijo exactas: '/keystaticx' o '/administrator' NO son
 * rutas del admin (test de no-confusión).
 */

export const ADMIN_LOGIN_PATH = '/admin/login';
export const UNAUTHENTICATED_REDIRECT = ADMIN_LOGIN_PATH;

export type AdminGateDecision = 'public' | 'page' | 'api';

/** `path === prefix` o dentro de `prefix/` (sin coincidencias parciales). */
function under(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/**
 * Clasifica un pathname de Astro (`context.url.pathname`, sin query ni
 * fragmento; el helper los tolera igual por robustez).
 */
export function adminGateDecision(pathname: string): AdminGateDecision {
  const path = pathname.split(/[?#]/, 1)[0] ?? pathname;

  // Puerta de salida del gate: login (T4) siempre accesible.
  if (under(path, ADMIN_LOGIN_PATH)) return 'public';

  // UI de Keystatic + entrada /admin (T26 redirige /admin → /keystatic).
  if (under(path, '/keystatic') || under(path, '/admin')) return 'page';

  // API de Keystatic (inyectada por @keystatic/astro).
  if (under(path, '/api/keystatic')) return 'api';

  return 'public';
}
