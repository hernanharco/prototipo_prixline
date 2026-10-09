/**
 * site/src/middleware.ts — T3 (specs S1/S3 de odd/tasks/prixline-admin-auth.md)
 *
 * Gate de autenticación del CMS/admin sobre authCore (tu ecosistema:
 * core/auth/AUTH-FLOW.md, patrón spoke; verificación en site/src/lib/
 * authcore.ts). Aplica a `/keystatic`, `/admin` y `/api/keystatic`:
 *
 *   - Sin cookie `token` (o sin env AUTHCORE_* configuradas) → FAIL-CLOSED:
 *     redirect a /admin/login en páginas, 401 JSON en la API.
 *   - Con cookie → verifyToken (RS256 + JWKS, iss obligatorio — advisory
 *     R1-optional-iss-aud-skipped de T2b; `aud` opcional porque el payload
 *     actual de authCore no lo emite) → dentro.
 *   - Token inválido/expirado → misma respuesta que sin token.
 *
 * Variables (contrato T5, mapeadas por verifyOptionsFromEnv):
 *   AUTHCORE_JWKS_URL, AUTHCORE_JWT_ISSUER (obligatorias; sin ellas el
 *   gate queda cerrado), AUTHCORE_JWT_AUDIENCE (opcional).
 *
 * El resto del sitio es público: el middleware pasa a next() sin tocar nada.
 */
import { defineMiddleware } from 'astro:middleware';

import { adminGateDecision, UNAUTHENTICATED_REDIRECT } from './lib/adminGate.ts';
import { verifyOptionsFromEnv, verifyToken } from './lib/authcore.ts';

const COOKIE_NAME = 'token'; // nombre del ecosistema (AUTH-FLOW.md)

export const onRequest = defineMiddleware(async (context, next) => {
  const decision = adminGateDecision(context.url.pathname);
  if (decision === 'public') return next();

  const token = context.cookies.get(COOKIE_NAME)?.value;
  const { jwksUrl, issuer, audience } = verifyOptionsFromEnv(process.env);

  if (token && jwksUrl && issuer) {
    try {
      await verifyToken(token, { jwksUrl, issuer, audience, fetchFn: globalThis.fetch });
      return next();
    } catch {
      // Token inválido/expirado o JWKS inaccesible → fail-closed abajo.
    }
  }

  if (decision === 'api') {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: {
        'content-type': 'application/json',
        'www-authenticate': 'Bearer realm="keystatic"',
      },
    });
  }
  return context.redirect(UNAUTHENTICATED_REDIRECT);
});
