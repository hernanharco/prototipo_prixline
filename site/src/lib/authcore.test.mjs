// site/src/lib/authcore.test.mjs — T2 (spec S1/S3 de odd/tasks/prixline-admin-auth.md)
// Verificador JWT RS256 contra el JWKS de authCore (core/auth/AUTH-FLOW.md).
// Pruebas `node --test` sin dependencias: node:test + node:assert y Web Crypto
// de Node (>= 23.6, instalado v26) con type stripping nativo de ./authcore.ts.
// Run: node --test site/src/lib/authcore.test.mjs
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AuthCoreVerifyError, verifyOptionsFromEnv, verifyToken } from './authcore.ts';

// ---- utilidades locales: keypair RSA + JWT firmado (RS256) ----

const enc = new TextEncoder();
let urlSeq = 0;
// Cada test usa una URL de JWKS distinta para no compartir la caché de claves.
const freshUrl = () => `https://authcore.test/jwks/${(urlSeq += 1)}`;

async function makeKeypair(kid) {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  const exported = await crypto.subtle.exportKey('jwk', pair.publicKey);
  return { pair: { ...pair, kid }, jwk: { ...exported, kid, use: 'sig', alg: 'RS256' } };
}

const b64url = (input) =>
  Buffer.from(input instanceof Uint8Array ? input : enc.encode(input)).toString('base64url');

async function signToken(pair, payload, { kid = pair.kid, alg = 'RS256' } = {}) {
  const head = `${b64url(JSON.stringify({ alg, kid }))}.${b64url(JSON.stringify(payload))}`;
  const signature = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, enc.encode(head)),
  );
  return `${head}.${b64url(signature)}`;
}

const jwksFetch = (jwks, counter = { calls: 0 }) => {
  const fn = async () => {
    counter.calls += 1;
    return new Response(JSON.stringify(jwks), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  fn.counter = counter;
  return fn;
};

const baseClaims = (overrides = {}) => ({
  sub: '1',
  username: 'harco',
  email: 'harco@rincom.es',
  role: 'SUPERADMIN',
  iss: 'http://localhost:8000',
  iat: 1700000000,
  exp: 4102444800, // 2100-01-01: siempre en el futuro
  jti: 'uuid-1',
  ...overrides,
});

describe('verifyToken — contrato authCore (RS256 + JWKS)', () => {
  it('verifica un token válido y devuelve los claims', async () => {
    const { pair, jwk } = await makeKeypair('kid-ok');
    const url = freshUrl();
    const token = await signToken(pair, baseClaims());
    const claims = await verifyToken(token, {
      jwksUrl: url,
      issuer: 'http://localhost:8000',
      fetchFn: jwksFetch({ keys: [jwk] }),
    });
    assert.equal(claims.sub, '1');
    assert.equal(claims.email, 'harco@rincom.es');
    assert.equal(claims.role, 'SUPERADMIN');
  });

  it('rechaza un token expirado (exp en el pasado)', async () => {
    const { pair, jwk } = await makeKeypair('kid-exp');
    const token = await signToken(pair, baseClaims({ exp: 1700000000 }));
    await assert.rejects(
      verifyToken(token, { jwksUrl: freshUrl(), fetchFn: jwksFetch({ keys: [jwk] }) }),
      (err) => err instanceof AuthCoreVerifyError && /expired/i.test(err.message),
    );
  });

  it('rechaza firma manipulada (payload alterado tras firmar)', async () => {
    const { pair, jwk } = await makeKeypair('kid-tamper');
    const token = await signToken(pair, baseClaims());
    const [head, , sig] = token.split('.');
    const forged = `${head}.${b64url(JSON.stringify(baseClaims({ role: 'HACKED' })))}.${sig}`;
    await assert.rejects(
      verifyToken(forged, { jwksUrl: freshUrl(), fetchFn: jwksFetch({ keys: [jwk] }) }),
      (err) => err instanceof AuthCoreVerifyError && /signature/i.test(err.message),
    );
  });

  it('rechaza algoritmos distintos de RS256 (none/HS256)', async () => {
    const { pair, jwk } = await makeKeypair('kid-alg');
    for (const alg of ['none', 'HS256']) {
      const token = await signToken(pair, baseClaims(), { alg });
      await assert.rejects(
        verifyToken(token, { jwksUrl: freshUrl(), fetchFn: jwksFetch({ keys: [jwk] }) }),
        (err) => err instanceof AuthCoreVerifyError && /algorithm/i.test(err.message),
      );
    }
  });

  it('rechaza issuer distinto del configurado', async () => {
    const { pair, jwk } = await makeKeypair('kid-iss');
    const token = await signToken(pair, baseClaims());
    await assert.rejects(
      verifyToken(token, {
        jwksUrl: freshUrl(),
        issuer: 'https://api-authcore.rincom.es',
        fetchFn: jwksFetch({ keys: [jwk] }),
      }),
      (err) => err instanceof AuthCoreVerifyError && /issuer/i.test(err.message),
    );
  });

  it('rechaza audience que no coincide con el configurado (aud string o array)', async () => {
    const { pair, jwk } = await makeKeypair('kid-aud');
    const url = freshUrl();
    const fetchFn = jwksFetch({ keys: [jwk] });
    const token = await signToken(pair, baseClaims({ aud: 'otro-spoke' }));
    await assert.rejects(
      verifyToken(token, { jwksUrl: url, audience: 'prixline', fetchFn }),
      (err) => err instanceof AuthCoreVerifyError && /audience/i.test(err.message),
    );
    const ok = await signToken(pair, baseClaims({ aud: ['prixline', 'x'] }));
    const claims = await verifyToken(ok, { jwksUrl: freshUrl(), audience: 'prixline', fetchFn: jwksFetch({ keys: [jwk] }) });
    assert.equal(claims.sub, '1');
  });

  it('si el kid no está en la caché, refresca el JWKS una vez (rotación)', async () => {
    const oldKey = await makeKeypair('kid-old');
    const newKey = await makeKeypair('kid-new');
    const url = freshUrl();
    // 1ª llamada: cachea kid-old; 2ª (tras kid desconocido): sirve kid-new.
    let generation = 0;
    const counter = { calls: 0 };
    const fetchFn = async () => {
      counter.calls += 1;
      const keys = generation === 0 ? [oldKey.jwk] : [newKey.jwk];
      generation += 1;
      return new Response(JSON.stringify({ keys }), { status: 200 });
    };
    const stale = await signToken(oldKey.pair, baseClaims());
    await verifyToken(stale, { jwksUrl: url, fetchFn });
    const rotated = await signToken(newKey.pair, baseClaims());
    const claims = await verifyToken(rotated, { jwksUrl: url, fetchFn });
    assert.equal(claims.sub, '1');
    assert.equal(counter.calls, 2);
  });

  it('falla con claridad si el JWKS no se puede descargar', async () => {
    const { pair } = await makeKeypair('kid-5xx');
    const token = await signToken(pair, baseClaims());
    await assert.rejects(
      verifyToken(token, {
        jwksUrl: freshUrl(),
        fetchFn: async () => new Response('boom', { status: 503 }),
      }),
      (err) => err instanceof AuthCoreVerifyError && /jwks/i.test(err.message),
    );
  });

  it('rechaza tokens malformados sin llamar a la red', async () => {
    let called = 0;
    const fetchFn = async () => {
      called += 1;
      return new Response('{}', { status: 200 });
    };
    for (const bad of ['', 'a.b', 'a.b.c', '..', 'not-a-jwt', `${b64url('{"alg":"RS256"}')}.x.y`]) {
      await assert.rejects(
        verifyToken(bad, { jwksUrl: freshUrl(), fetchFn }),
        (err) => err instanceof AuthCoreVerifyError,
      );
    }
    assert.equal(called, 0, 'un token malformado no debe provocar fetch del JWKS');
  });
});

describe('verifyOptionsFromEnv — contrato de variables AUTHCORE_* (T5)', () => {
  it('mapea JWKS_URL/ISSUER/AUDIENCE y marca las requeridas como ausentes', () => {
    const opts = verifyOptionsFromEnv({
      AUTHCORE_JWKS_URL: 'https://api-authcore.rincom.es/.well-known/jwks.json',
      AUTHCORE_JWT_ISSUER: 'https://api-authcore.rincom.es',
      AUTHCORE_JWT_AUDIENCE: 'prixline',
    });
    assert.deepEqual(opts, {
      jwksUrl: 'https://api-authcore.rincom.es/.well-known/jwks.json',
      issuer: 'https://api-authcore.rincom.es',
      audience: 'prixline',
    });
    const missing = verifyOptionsFromEnv({});
    assert.equal(missing.jwksUrl, undefined);
    assert.equal(missing.issuer, undefined);
    assert.equal(missing.audience, undefined);
  });
});
