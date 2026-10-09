/**
 * site/src/lib/authFlow.ts — T4 (specs S1/S3 de odd/tasks/prixline-admin-auth.md)
 *
 * Helpers puros del flujo de login con authCore (tu ecosistema:
 * core/auth/AUTH-FLOW.md, patrón spoke — igual que CafeMiTierra):
 *
 *   1. /admin/login muestra "Continuar con Google" →
 *      {base}/api/v1/auth/google?redirect_to={origin}/auth/callback
 *   2. authCore hace el OAuth con Google y redirige a
 *      /auth/callback?token={JWT}
 *   3. El callback guarda la cookie de sesión y manda a /keystatic,
 *      donde el middleware (T3) valida el JWT en cada petición.
 *
 * Todo el valor está en la validación del middleware: aquí sólo se mueve el
 * token (guardarlo sin verificar es inofensivo porque T3 lo verifica
 * petición a petición y falla cerrado).
 */

/** Ruta del callback OAuth (debe coincidir con redirect_to del hub). */
export const AUTH_CALLBACK_PATH = '/auth/callback';

/** Cookie de sesión: mismo nombre que el ecosistema (AUTH-FLOW.md). */
export const AUTH_COOKIE = 'token';

/** Validez de la sesión: 7 días (patrón del ecosistema). */
export const AUTH_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/**
 * Base del hub authCore a partir de AUTHCORE_JWKS_URL
 * (https://host/.well-known/jwks.json → https://host).
 */
export function authCoreBaseUrl(jwksUrl: string): string {
  return jwksUrl
    .replace(/\/\.well-known\/jwks\.json\/?$/, '')
    .replace(/\/+$/, '');
}

/**
 * URL de arranque del OAuth en el hub: {base}/api/v1/auth/google con
 * redirect_to (URL completa a nuestro callback). El hub devuelve el JWT
 * como query param en esa URL.
 */
export function googleAuthUrl(base: string, redirect: string): string {
  const url = new URL('/api/v1/auth/google', base);
  url.searchParams.set('redirect_to', redirect);
  return url.toString();
}

/** Extrae `token` de la query del callback (?token=…). Vacío → null. */
export function parseCallbackToken(search: string): string | null {
  if (!search) return null;
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const token = params.get('token');
  return token ? token : null;
}

/**
 * Cookie de sesión para document.cookie (el callback es una página estática:
 * en T5, con adapter SSR, puede pasar a httpOnly server-side).
 * Sólo acepta el subconjunto seguro de un JWT (base64url + puntos).
 */
export function buildAuthCookie(value: string, options: { secure: boolean }): string {
  if (!/^[A-Za-z0-9._-]+$/.test(value)) {
    throw new Error('invalid cookie value: expected a JWT-shaped token');
  }
  const parts = [
    `${AUTH_COOKIE}=${value}`,
    'path=/',
    `max-age=${AUTH_COOKIE_MAX_AGE_SECONDS}`,
    'samesite=lax',
  ];
  if (options.secure) parts.push('secure');
  return parts.join('; ');
}
