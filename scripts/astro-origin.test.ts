/**
 * scripts/astro-origin.test.ts
 *
 * TDD (RED primero) para el origin de las requests SSR en producción.
 *
 * Bug: el OAuth de GitHub de Keystatic arma el `redirect_uri` con el
 * origin de la request (`${reqUrl.origin}/api/keystatic/github/oauth/callback`).
 * Astro 5.18 sólo confía en el header `Host`/`X-Forwarded-Host` cuando
 * `security.allowedDomains` está declarado en astro.config.mjs; sin él,
 * `NodeApp.createRequest` cae al fallback `https://localhost` y GitHub
 * rechaza el authorize con "The redirect_uri is not associated with this
 * application".
 *
 * Run: node --test scripts/astro-origin.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';

type AllowedDomain = { protocol?: string; hostname?: string; port?: string };

const configUrl = pathToFileURL(new URL('../site/astro.config.mjs', import.meta.url).pathname)
  .href;
const astroNodeUrl = pathToFileURL(
  new URL('../site/node_modules/astro/dist/core/app/node.js', import.meta.url).pathname,
).href;

async function loadConfigSecurity(): Promise<{ allowedDomains: AllowedDomain[] }> {
  const mod = (await import(configUrl)) as { default: Record<string, unknown> };
  const security = mod.default.security as { allowedDomains?: AllowedDomain[] } | undefined;
  return { allowedDomains: security?.allowedDomains ?? [] };
}

/** Request Node mínima tal como la ve la función serverless de Vercel. */
function vercelLikeRequest(path: string): {
  url: string;
  method: string;
  headers: Record<string, string>;
  socket: object;
} {
  return {
    url: path,
    method: 'GET',
    headers: {
      host: 'prixline.rincom.es',
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'prixline.rincom.es',
      'x-forwarded-port': '443',
    },
    socket: {},
  };
}

describe('astro SSR origin en producción (Vercel)', () => {
  it('declara security.allowedDomains con el dominio de producción', async () => {
    const { allowedDomains } = await loadConfigSecurity();
    assert.ok(
      allowedDomains.some(
        (d) => d.protocol === 'https' && d.hostname === 'prixline.rincom.es',
      ),
      `astro.config.mjs debe declarar {protocol:'https', hostname:'prixline.rincom.es'} en security.allowedDomains; obtenido: ${JSON.stringify(allowedDomains)}`,
    );
  });

  it('el origin de una request Vercel es https://prixline.rincom.es (no https://localhost)', async () => {
    const { NodeApp } = (await import(astroNodeUrl)) as {
      NodeApp: {
        createRequest: (
          req: ReturnType<typeof vercelLikeRequest>,
          opts: { allowedDomains: AllowedDomain[] },
        ) => Request;
      };
    };
    const { allowedDomains } = await loadConfigSecurity();
    const request = NodeApp.createRequest(
      vercelLikeRequest('/api/keystatic/github/login?from=/keystatic'),
      { allowedDomains },
    );
    const origin = new URL(request.url).origin;
    assert.equal(
      origin,
      'https://prixline.rincom.es',
      `origin=${origin} ⇒ el redirect_uri de GitHub sería inválido`,
    );
    assert.equal(
      new URL(request.url).pathname,
      '/api/keystatic/github/login',
      'el path de la request no debe alterarse',
    );
  });
});
