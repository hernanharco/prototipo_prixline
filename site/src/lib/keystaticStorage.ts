/**
 * site/src/lib/keystaticStorage.ts — T6 (spec S5 de odd/tasks/prixline-admin-auth.md)
 *
 * Selección del storage de Keystatic (site/keystatic.config.ts).
 *
 * Por qué un flag PÚBLICO y no una env server-only: el config de Keystatic
 * se evalúa en el bundle del SERVIDOR (API /api/keystatic) y en el bundle
 * del CLIENTO (la UI en /keystatic) — el `kind` debe ser idéntico en ambos,
 * y las credenciales (`KEYSTATIC_*`) jamás deben llegar al cliente. Con
 * `PUBLIC_KEYSTATIC_STORAGE` Vite inyecta el mismo valor en los dos bundles
 * en build, y en dev sin flag todo queda `local`.
 *
 * - Prod (Vercel): PUBLIC_KEYSTATIC_STORAGE=github ⇒ commits de contenido
 *   a la rama por defecto de `hernanharco/prototipo_prixline` (main ⇒
 *   Vercel Git redespliega, flujo T21/T26). Creds server-only:
 *   KEYSTATIC_GITHUB_CLIENT_ID, KEYSTATIC_GITHUB_CLIENT_SECRET,
 *   KEYSTATIC_SECRET (+ PUBLIC_KEYSTATIC_GITHUB_APP_SLUG).
 * - Dev local (sin flag): `local` ⇒ la API escribe en el disco del repo
 *   (cwd = raíz, truco T26) y el smoke T7 (`git diff content/`) funciona
 *   sin tocar GitHub. Es también el fallback si el flag falta o es
 *   inválido (fail-closed a local: nada escribe a GitHub por accidente).
 */

/** Remoto real del proyecto (git remote origin). */
export const KEYSTATIC_REPO = 'hernanharco/prototipo_prixline';

export type KeystaticStorageSelection =
  | { kind: 'github'; repo: typeof KEYSTATIC_REPO }
  | { kind: 'local' };

/**
 * Elige el storage a partir de las variables visibles en build/cliente.
 * Sólo `PUBLIC_KEYSTATIC_STORAGE === 'github'` activa GitHub; cualquier
 * otro valor (vacío, ausente, 'true', 'GitHub'…) queda en local.
 */
export function selectKeystaticStorage(
  env: Record<string, string | undefined> | undefined,
): KeystaticStorageSelection {
  // `env` puede ser undefined fuera de Vite (Node puro: smoke reader y
  // tests importan keystatic.config.ts sin `import.meta.env`).
  return env?.PUBLIC_KEYSTATIC_STORAGE === 'github'
    ? { kind: 'github', repo: KEYSTATIC_REPO }
    : { kind: 'local' };
}
