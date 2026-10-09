# Admin de Prixline — guía de setup (T6)

Cómo queda el `/admin` (Keystatic) conectado en producción, con login vía
**authCore** (tu ecosistema, `core/auth/AUTH-FLOW.md`) y escritura en
**GitHub** (`hernanharco/prototipo_prixline`).

## Cómo funciona el flujo

```
/admin/login ──(Google OAuth vía authCore)──▶ /keystatic
     │                                              │
     │  gate: middleware T3 exige JWT (cookie       │ 1ª vez: "Sign in
     │  `token`, JWKS + iss de authCore)            │ with GitHub"
     │                                              ▼
     └─────────────────────────────── guardar ⇒ commit a la rama por
                                      defecto (main) ⇒ Vercel redespliega
```

- **Sin las dos `AUTHCORE_*` el gate queda cerrado** (fail-closed): todo
  `/keystatic`, `/admin` y `/api/keystatic` redirige a `/admin/login` o
  devuelve 401. El advisory `R3-login-env-gate-mismatch` lo dice claro:
  hace falta `AUTHCORE_JWKS_URL` **y** `AUTHCORE_JWT_ISSUER`.
- **`PUBLIC_KEYSTATIC_STORAGE=github`** cambia el storage de `local` a
  `github` (idéntico en bundle cliente y servidor, ver
  `site/src/lib/keystaticStorage.ts`). Sin el flag, el admin escribe en
  el disco local (dev normal y el smoke T7 con `git diff content/`).

## Paso 1 — OAuth App en GitHub (una sola vez)

1. GitHub → Settings → Developer settings → **OAuth Apps** → New OAuth App.
2. Campos:
   - Application name: `Prixline admin`
   - Homepage URL: `https://prixline.rincom.es`
   - **Authorization callback URL**:
     `https://prixline.rincom.es/api/keystatic/github/oauth/callback`
3. Genera el **Client Secret** y copia **Client ID** + **Secret**.
   (Alternativa: GitHub App — en ese caso añade también
   `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`; el flujo automático de Keystatic
   está en `/keystatic/setup`.)

## Paso 2 — `KEYSTATIC_SECRET`

Cadena aleatoria de **≥32 caracteres** (la exige Keystatic para sus
cookies internas):

```bash
openssl rand -hex 32
```

## Paso 3 — Variables en Vercel (Project → Settings → Environment Variables)

| Variable | Valor |
|---|---|
| `AUTHCORE_JWKS_URL` | `https://api-authcore.rincom.es/.well-known/jwks.json` |
| `AUTHCORE_JWT_ISSUER` | `https://api-authcore.rincom.es` |
| `PUBLIC_KEYSTATIC_STORAGE` | `github` |
| `KEYSTATIC_GITHUB_CLIENT_ID` | Client ID del paso 1 |
| `KEYSTATIC_GITHUB_CLIENT_SECRET` | Client Secret del paso 1 |
| `KEYSTATIC_SECRET` | valor del paso 2 |
| `PUBLIC_YOUTUBE_API_KEY` | *(opcional, T10 — badge EN VIVO)* |

> `PUBLIC_KEYSTATIC_STORAGE` se inyecta en **build**: tras añadirla hay
> que hacer redeploy (la página `/admin/login` se prerenderiza con el
> flag). Las `KEYSTATIC_*` de credenciales son server-only: jamás con
> prefijo `PUBLIC_`.
> 
> ⚠️ **Flag y credenciales van JUNTOS**: en producción, `github` sin
> `KEYSTATIC_*` hace que **todos los `/api/keystatic/*` respondan 500**
> para usuarios ya autenticados (el gate sigue cerrando a los demás).
> En dev, sin creds, `/keystatic` te lleva a `/keystatic/setup`.

## Paso 4 — Desarrollo local

```bash
cp site/env.example site/.env      # gate abierto contra authCore (ver valores)
pnpm dev:site                      # desde la RAÍZ del repo (truco T26)
```

Por defecto el storage es **local** (escribe en `content/` del repo;
`git diff content/` muestra el resultado del smoke T7). Para probar el
modo GitHub en local añade a `site/.env`:
`PUBLIC_KEYSTATIC_STORAGE=github` + las tres `KEYSTATIC_*`.

## Primer login (una sola vez por persona)

1. `/admin/login` → **Continuar con Google** (cuenta aprobada en el
   dashboard de authCore; usuarios nuevos quedan `PENDING_APPROVAL`).
2. Dentro de `/keystatic`, Keystatic pedirá **Sign in with GitHub** (la
   sesión de GitHub dura en cookie; sin ella no puede escribir).
3. Editar → guardar ⇒ commit a la rama por defecto ⇒ Vercel redespliega.

## Medios (media store)

- Las imágenes migradas del blog viven en **`site/public/media/uploads/`
  (272 ficheros, rastreados en git)** y se referencian como
  `/media/uploads/...`.
- Si en el futuro se añade un `fields.image` en el schema de Keystatic,
  su `directory` debe apuntar a esa carpeta (`public/media/uploads`,
  ruta relativa al config en `site/`).
- El campo `thumbnail` de los posts es **texto** (URL o ruta `/media/...`)
  a propósito: no convertirlo a image field (hay thumbnails remotos
  i.ytimg.com en el corpus).

## Reglas

1. **No re-ejecutar los importadores** (`pnpm pipeline:*`) sobre contenido
   ya editado desde el admin: regeneran `content/` desde WordPress y
   pisarían las ediciones (T27).
2. El admin escribe a la **rama por defecto** del repo (verificado en T6:
   `origin/HEAD → refs/heads/main`; el tipo de config de Keystatic NO
   admite rama destino distinta). En producción eso es correcto (commit
   ⇒ Vercel redespliega), pero mientras se trabaje en una rama de
   contenido (`feat/prx-cms`) los commits del admin caen en `main`:
   revisar antes de guardar si la rama de contenido ya se mergeó.
3. El gate falla cerrado: cualquier duda de config ⇒ login en vez de
   acceso.

Referencias: `site/env.example`, `odd/tasks/prixline-admin-auth.md`
(specs S1/S3/S5, Log L1-L11), `core/auth/AUTH-FLOW.md`.
