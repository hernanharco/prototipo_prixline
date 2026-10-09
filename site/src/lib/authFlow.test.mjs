// site/src/lib/authFlow.test.mjs — T4 (spec S1/S3 de odd/tasks/prixline-admin-auth.md)
// Helpers puros del flujo de login con authCore (patrón spoke AUTH-FLOW.md):
// URL de Google OAuth, callback con token, y cookie de sesión.
// Run: node --test site/src/lib/authFlow.test.mjs
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AUTH_CALLBACK_PATH,
  AUTH_COOKIE,
  AUTH_COOKIE_MAX_AGE_SECONDS,
  authCoreBaseUrl,
  buildAuthCookie,
  googleAuthUrl,
  parseCallbackToken,
} from './authFlow.ts';

describe('authCoreBaseUrl — deriva la base del hub desde el JWKS', () => {
  it('quita el sufijo /.well-known/jwks.json y barras sobrantes', () => {
    assert.equal(
      authCoreBaseUrl('https://api-authcore.rincom.es/.well-known/jwks.json'),
      'https://api-authcore.rincom.es',
    );
    assert.equal(
      authCoreBaseUrl('http://localhost:8000/.well-known/jwks.json'),
      'http://localhost:8000',
    );
  });

  it('tolera barra final y raíz de dominio con puerto', () => {
    assert.equal(authCoreBaseUrl('https://api-authcore.rincom.es/'), 'https://api-authcore.rincom.es');
    assert.equal(authCoreBaseUrl('http://localhost:8000'), 'http://localhost:8000');
  });
});

describe('googleAuthUrl — punto de entrada /api/v1/auth/google', () => {
  it('construye la URL con redirect_to codificado', () => {
    const url = new URL(
      googleAuthUrl('https://api-authcore.rincom.es', 'https://prixline.rincom.es/auth/callback'),
    );
    assert.equal(url.origin, 'https://api-authcore.rincom.es');
    assert.equal(url.pathname, '/api/v1/auth/google');
    assert.equal(
      url.searchParams.get('redirect_to'),
      'https://prixline.rincom.es/auth/callback',
    );
  });

  it('no pierde parámetros del propio redirect_to (query anidada)', () => {
    const url = new URL(
      googleAuthUrl('http://localhost:8000', 'http://localhost:4322/auth/callback?next=/keystatic'),
    );
    assert.equal(
      url.searchParams.get('redirect_to'),
      'http://localhost:4322/auth/callback?next=/keystatic',
    );
    assert.equal(url.searchParams.getAll('redirect_to').length, 1);
  });
});

describe('parseCallbackToken — extrae ?token= de la URL del callback', () => {
  it('acepta token presente y devuelve null si falta o está vacío', () => {
    assert.equal(parseCallbackToken('?token=abc.def.ghi'), 'abc.def.ghi');
    assert.equal(parseCallbackToken('token=abc.def.ghi'), 'abc.def.ghi');
    assert.equal(parseCallbackToken('?otra=x'), null);
    assert.equal(parseCallbackToken('?token='), null);
    assert.equal(parseCallbackToken(''), null);
    assert.equal(parseCallbackToken('?token=a&token=b'), 'a');
  });
});

describe('buildAuthCookie — cookie de sesión del ecosistema', () => {
  it('fija nombre, max-age (7 días), path y samesite; secure solo en https', () => {
    assert.equal(AUTH_COOKIE, 'token');
    assert.equal(AUTH_COOKIE_MAX_AGE_SECONDS, 7 * 24 * 60 * 60);
    const secure = buildAuthCookie('abc.def.ghi', { secure: true });
    assert.match(secure, /^token=abc\.def\.ghi;/);
    assert.match(secure, /path=\//);
    assert.match(secure, /max-age=604800/);
    assert.match(secure, /samesite=lax/);
    assert.match(secure, /secure/i);
    const insecure = buildAuthCookie('abc.def.ghi', { secure: false });
    assert.doesNotMatch(insecure, /(^|;)\s*secure/i);
  });

  it('rechaza valores con caracteres de inyección de cookie', () => {
    for (const bad of ['a;b=1', 'a\nSet-Cookie: x=y', 'a b', 'a\r\nx']) {
      assert.throws(() => buildAuthCookie(bad, { secure: false }), /invalid/i);
    }
  });
});
