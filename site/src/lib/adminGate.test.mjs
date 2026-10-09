// site/src/lib/adminGate.test.mjs — T3 (spec S1/S3 de odd/tasks/prixline-admin-auth.md)
// Decision de proteccion del middleware del admin: que rutas exigen JWT de
// authCore y con que respuesta (redirect de pagina vs 401 de API).
// Run: node --test site/src/lib/adminGate.test.mjs
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { adminGateDecision, ADMIN_LOGIN_PATH } from './adminGate.ts';

describe('adminGateDecision — rutas protegidas del admin (T3)', () => {
  it('deja pasar el sitio publico', () => {
    for (const path of [
      '/',
      '/articulos/',
      '/articulos/mi-post/',
      '/cursos/',
      '/cursos/curso-x/',
      '/contacto/',
      '/practicas/',
      '/auth/callback',
      '/favicon.ico',
    ]) {
      assert.equal(adminGateDecision(path), 'public', path);
    }
  });

  it('protege la UI de Keystatic y el redirect /admin', () => {
    assert.equal(adminGateDecision('/keystatic'), 'page');
    assert.equal(adminGateDecision('/keystatic/'), 'page');
    assert.equal(adminGateDecision('/keystatic/posts'), 'page');
    assert.equal(adminGateDecision('/keystatic/posts/123'), 'page');
    assert.equal(adminGateDecision('/admin'), 'page');
    assert.equal(adminGateDecision('/admin/'), 'page');
  });

  it('excluye la pagina de login (si no, el gate no tiene puerta)', () => {
    assert.equal(adminGateDecision(ADMIN_LOGIN_PATH), 'public');
    assert.equal(adminGateDecision('/admin/login/'), 'public');
  });

  it('responde 401 a la API de Keystatic en vez de redirigir', () => {
    assert.equal(adminGateDecision('/api/keystatic'), 'api');
    assert.equal(adminGateDecision('/api/keystatic/tree'), 'api');
    assert.equal(adminGateDecision('/api/keystatic/blob/abc/content/x.md'), 'api');
    assert.equal(adminGateDecision('/api/keystatic/update'), 'api');
  });

  it('no confunde prefijos parecidos con rutas protegidas', () => {
    for (const path of ['/administrator', '/adminx', '/keystaticx', '/api/keystaticx', '/api/other', '/v1/admin']) {
      assert.equal(adminGateDecision(path), 'public', path);
    }
  });

  it('normaliza el path: query y fragment no cuentan, slash final opcional', () => {
    // El middleware pasa pathname solo; aun asi el helper es robusto.
    assert.equal(adminGateDecision('/keystatic?x=1'), 'page');
    assert.equal(adminGateDecision('/admin/login?next=/keystatic'), 'public');
  });
});
