/**
 * site/src/lib/authcore.ts — T2 (specs S1/S3 de odd/tasks/prixline-admin-auth.md)
 *
 * Verificador JWT RS256 contra el JWKS de authCore (tu ecosistema:
 * core/auth/AUTH-FLOW.md; hub en FastAPI con `/.well-known/jwks.json`, prod
 * `https://api-authcore.rincom.es`). Módulo puro y apto para `node --test`
 * con type stripping nativo: cero imports de paquetes; usa Web Crypto
 * (`globalThis.crypto.subtle`), disponible en Node >= 20 y en los runtimes
 * SSR de Astro (T3 lo consume desde el middleware).
 *
 * Qué valida (en orden, siempre con la red después de parsear):
 *   1. Forma: tres partes base64url, header/payload JSON, `exp` numérico.
 *   2. `alg` debe ser RS256 (bloquea `none` y confusión de algoritmo HS*).
 *   3. Firma contra la clave JWKS elegida por `kid`.
 *   4. `iss` (si se configura) y `aud` (si se configura, string o array).
 *   5. `exp` en el futuro (reloj del sistema, sin tolerancia).
 *
 * Caché de claves: por URL de JWKS con TTL (10 min por defecto); si el `kid`
 * del token no está en la caché se refresca UNA vez (rotación de claves de
 * authCore) y si sigue sin aparecer se rechaza sin más llamadas.
 *
 * Variables de entorno del contrato (las consume T5 vía verifyOptionsFromEnv):
 *   AUTHCORE_JWKS_URL     — endpoint JWKS (obligatoria en T5)
 *   AUTHCORE_JWT_ISSUER   — issuer esperado (obligatoria en T5)
 *   AUTHCORE_JWT_AUDIENCE — audience esperado (opcional: el payload actual
 *                           de authCore no incluye `aud`; verificar con un
 *                           token real antes de activarla)
 */

export class AuthCoreVerifyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthCoreVerifyError';
  }
}

/** Claims del JWT de authCore (AUDITORIA-AUTHCORE.md + AUTH-FLOW.md). */
export interface AuthCoreClaims {
  sub: string;
  username?: string;
  email?: string;
  role?: string;
  type?: string;
  iss?: string;
  aud?: string | string[];
  iat?: number;
  exp: number;
  jti?: string;
  [key: string]: unknown;
}

export interface VerifyOptions {
  /** Endpoint JWKS (p. ej. https://api-authcore.rincom.es/.well-known/jwks.json). */
  jwksUrl: string;
  /** Si se indica, `iss` del token debe coincidir exactamente. */
  issuer?: string;
  /** Si se indica, `aud` del token (string o array) debe contenerlo. */
  audience?: string;
  /** Inyección para tests; por defecto globalThis.fetch. */
  fetchFn?: typeof fetch;
  /** TTL de la caché de claves en ms (defecto 10 min). */
  cacheTtlMs?: number;
}

/** Salida de verifyOptionsFromEnv: las tres claves siempre presentes. */
export interface EnvVerifyOptions {
  jwksUrl: string | undefined;
  issuer: string | undefined;
  audience: string | undefined;
}

interface CachedJwks {
  expiresAt: number;
  keys: Map<string, CryptoKey>;
}

const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;
const jwksCache = new Map<string, CachedJwks>();

/** Mapea el contrato de env vars AUTHCORE_* a VerifyOptions (T5/T3). */
export function verifyOptionsFromEnv(env: Record<string, string | undefined>): EnvVerifyOptions {
  return {
    jwksUrl: env.AUTHCORE_JWKS_URL,
    issuer: env.AUTHCORE_JWT_ISSUER,
    audience: env.AUTHCORE_JWT_AUDIENCE,
  };
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded); // lanza en entrada inválida
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlToString(value: string): string {
  return new TextDecoder().decode(base64UrlToBytes(value));
}

function parseJsonPart(value: string, what: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(base64UrlToString(value));
  } catch {
    throw new AuthCoreVerifyError(`malformed token: invalid ${what}`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new AuthCoreVerifyError(`malformed token: ${what} is not an object`);
  }
  return parsed as Record<string, unknown>;
}

async function fetchJwks(
  options: VerifyOptions,
): Promise<Map<string, CryptoKey>> {
  if (!options.jwksUrl) {
    throw new AuthCoreVerifyError('JWKS url is not configured (AUTHCORE_JWKS_URL)');
  }
  const doFetch = options.fetchFn ?? globalThis.fetch;
  if (typeof doFetch !== 'function') {
    throw new AuthCoreVerifyError('JWKS request failed: no fetch implementation available');
  }
  let response: Response;
  try {
    response = await doFetch(options.jwksUrl);
  } catch (err) {
    throw new AuthCoreVerifyError(
      `JWKS request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!response.ok) {
    throw new AuthCoreVerifyError(`JWKS request failed with status ${response.status}`);
  }
  let document: unknown;
  try {
    document = await response.json();
  } catch {
    throw new AuthCoreVerifyError('JWKS response is not valid JSON');
  }
  const keys = (document as { keys?: unknown })?.keys;
  if (!Array.isArray(keys)) {
    throw new AuthCoreVerifyError('JWKS response has no "keys" array');
  }
  const result = new Map<string, CryptoKey>();
  for (const raw of keys) {
    const jwk = raw as Record<string, unknown>;
    if (
      jwk === null ||
      typeof jwk !== 'object' ||
      jwk.kty !== 'RSA' ||
      typeof jwk.n !== 'string' ||
      typeof jwk.e !== 'string' ||
      typeof jwk.kid !== 'string' ||
      (jwk.use !== undefined && jwk.use !== 'sig')
    ) {
      continue;
    }
    try {
      const key = await crypto.subtle.importKey(
        'jwk',
        { kty: 'RSA', n: jwk.n, e: jwk.e },
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify'],
      );
      result.set(jwk.kid, key);
    } catch {
      // Key inutilizable: se ignora (una clave mala no tumba el resto).
    }
  }
  if (result.size === 0) {
    throw new AuthCoreVerifyError('JWKS contains no usable RSA signing keys');
  }
  return result;
}

async function getKeyForKid(options: VerifyOptions, kid: string): Promise<CryptoKey> {
  const ttl = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const now = Date.now();
  const cached = jwksCache.get(options.jwksUrl);
  if (cached && cached.expiresAt > now && cached.keys.has(kid)) {
    return cached.keys.get(kid) as CryptoKey;
  }
  // Miss de caché o kid desconocido: una única recarga (rotación de claves).
  const keys = await fetchJwks(options);
  jwksCache.set(options.jwksUrl, { expiresAt: Date.now() + ttl, keys });
  const key = keys.get(kid);
  if (!key) {
    throw new AuthCoreVerifyError(`JWKS has no key for kid "${kid}"`);
  }
  return key;
}

/**
 * Verifica un JWT de authCore (RS256 + JWKS) y devuelve sus claims.
 * Lanza AuthCoreVerifyError en cualquier fallo (forma, algoritmo, firma,
 * issuer, audience o expiración): el middleware lo traduce a 401.
 */
export async function verifyToken(
  token: string,
  options: VerifyOptions,
): Promise<AuthCoreClaims> {
  if (typeof token !== 'string' || token.length === 0) {
    throw new AuthCoreVerifyError('malformed token: not a string');
  }
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    throw new AuthCoreVerifyError('malformed token: expected three non-empty parts');
  }
  const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];

  const header = parseJsonPart(headerPart, 'header');
  if (header.alg !== 'RS256') {
    throw new AuthCoreVerifyError(
      `unsupported algorithm: expected RS256, got ${JSON.stringify(header.alg)}`,
    );
  }
  const payload = parseJsonPart(payloadPart, 'payload');
  if (typeof payload.exp !== 'number') {
    throw new AuthCoreVerifyError('malformed token: missing numeric exp');
  }
  if (typeof header.kid !== 'string' || header.kid.length === 0) {
    throw new AuthCoreVerifyError('malformed token: header has no kid');
  }

  const key = await getKeyForKid(options, header.kid);
  let valid = false;
  try {
    const signature = base64UrlToBytes(signaturePart);
    const data = new TextEncoder().encode(`${headerPart}.${payloadPart}`);
    valid = await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      key,
      signature,
      data,
    );
  } catch {
    valid = false;
  }
  if (!valid) {
    throw new AuthCoreVerifyError('signature verification failed');
  }

  if (options.issuer !== undefined && payload.iss !== options.issuer) {
    throw new AuthCoreVerifyError(
      `issuer mismatch: expected ${JSON.stringify(options.issuer)}, got ${JSON.stringify(payload.iss)}`,
    );
  }
  if (options.audience !== undefined) {
    const aud = payload.aud;
    const matches = Array.isArray(aud)
      ? aud.includes(options.audience)
      : aud === options.audience;
    if (!matches) {
      throw new AuthCoreVerifyError(
        `audience mismatch: expected ${JSON.stringify(options.audience)}, got ${JSON.stringify(aud)}`,
      );
    }
  }
  if (Date.now() / 1000 >= payload.exp) {
    throw new AuthCoreVerifyError('token expired');
  }

  return payload as AuthCoreClaims;
}
