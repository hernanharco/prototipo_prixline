# Prixline Auth Chain — tenant + iss/aud (fase 9)

Cierre del login del admin de Prixline contra el hub authCore del ecosistema
(`core/auth/AUTH-FLOW.md`, patrón spoke). Este documento cubre los bloqueadores
encontrados al diagnosticar por qué el admin no entra, y sólo esos.

Toca dos repos: `authCore` (hub, `.../elrincondeharco.com/authCore`) y
`webprixline` (spoke, este repo). Los commits del hub se anotan con prefijo
`authCore`.

## Specs

- **S1** — "como estamos en este proyecto tenemos problemas en al autenticacion
  este es mi ecosistema /home/harco/Documentos/elrincondeharco.com/core"
- **S2** — "y estaba viendo que authcore no esta creado el tenant de prixline"
- **S3** — Alcance (decisión del usuario, Ask): "Arreglar toda la cadena" —
  "Crear tenant prixline + aprobar tu usuario Google y asignarle ese tenant +
  mergear feat/token-iss-aud (emite iss) + setear AUTHCORE_* en webprixline.
  Es lo único que deja el login funcionando de punta a punta."
- **S4** — Token (decisión del usuario, Ask): "Mergear iss + activar
  aud=prixline" — "Además setear JWT_AUDIENCE=prixline en el hub y
  AUTHCORE_JWT_AUDIENCE=prixline en webprixline."

## Tasks

| ID | S# | Tarea | Route | Commit |
|----|----|-------|-------|--------|
| T1 | S3,S4 | authCore: mergear `feat/token-iss-aud` (`0777260`) → `main` en rama feature: `Settings.jwt_issuer`/`jwt_audience` + `TokenService` emite `iss` siempre y `aud` sólo con `JWT_AUDIENCE` + `JWT_AUDIENCE=prixline` en composes dev y prod | inline test-first | `0ed1c91` + `58d52ad` |
| T2 | S4 | authCore: los 4 `jwt.decode` sin `audience` (`security.py:get_current_user`, `TokenService.verify_token`, `TokenService.get_token_payload`, `data_token.py:get_hub_token_claims`) fallan con python-jose en cuanto el token lleva `aud` — pasar `audience` cuando `JWT_AUDIENCE` esté seteado | inline test-first | `d87e20d` |
| T3 | S2 | authCore: crear tenant `prixline` (seed + DB dev) y verificar `GET /tenants/by-slug/prixline` | inline test-first | `88caa3d` |
| T4 | S3 | authCore: aprobar el usuario Google `hernan.harco@gmail.com` (hoy `PENDING`/`NONE` → `403 PENDING_APPROVAL`) y asignarle el tenant `prixline` (`users.tenant_id` + membresía `user_tenants`) | inline | — (sólo datos; sin commit) |
| T5 | S3,S4 | Reconstruir el hub dev, emitir un token real y verificar de punta a punta: `iss` + `aud` presentes, hub propio sigue autenticando, y el gate de webprixline (`site/.env` con las tres `AUTHCORE_*`) deja entrar a `/keystatic` | verify | |
| T6 | S3 | **[usuario]** push de `main` en authCore + deploy del hub en producción (el `JWT_ISSUER` de `compose.prod.yaml` ya viaja en `0777260`) | push + deploy | authCore `0d16478` en `/opt/authcore` (verificado 2026-10-12) |
| T7 | S4 | Tests: `_decode()` y el roundtrip JWKS de `test_data_token.py` declaran `audience=settings.jwt_audience` — las 8 fallas del gate al correr con `JWT_AUDIENCE` ya presente en el env | inline test-first | `0d16478` |
| T8 | S3,S4 | Gate de webprixline con **env vars inline** (decisión del usuario; la safety policy bloquea escribir `site/.env`): `astro dev --port 4325` con las 3 `AUTHCORE_*` | verify | — |
| T9 | S3 | Verificación independiente (`gentle-ai-verify`, sólo lectura) sobre `main..feat/prixline-audience` | verify | ver L11 |
| T10 | — | Review nativa RDD del candidato de docs (`odd/tasks/prixline-authchain.md`, tier **low** por `non_executable_only`, 1 fichero / 151 líneas, sin lentes) | native review | `review-3ad793127501a86e` (approved/ack) |
| T11 | S4 | Portfolio: `TokenValidator` acepta tokens de authCore que llevan `aud` — `authcore_jwt_audience` opcional; si no está, `options={"verify_aud": False}`. Rama `fix/authcore-token-audience` | inline test-first | Portfolio `9748fb2` |
| T12 | S3 | Env vars de Vercel `AUTHCORE_JWKS_URL` + `AUTHCORE_JWT_ISSUER` en Production y activas en el build desplegado (`/admin/login` → 200 con `data-auth-base=https://api-authcore.rincom.es`) | verify | ver L14 |
| T13 | S2,S3 | **[prod]** INSERT del tenant `prixline` + `users.tenant_id` + membresía `user_tenants` en la DB de producción (Hetzner; `psql -1 -v ON_ERROR_STOP=1` + SELECTs de verificación) — 8 tenants | inline data | — (sólo datos; sin commit) |
| T14 | S4 | Portfolio: merge fast-forward `fix/authcore-token-audience` → `main` y deploy manual en Hetzner (el repo no tiene webhook de deploy; ff preservando los cambios locales del worktree + fix de redes en `compose.prod.yaml`) | delivery | Portfolio `9748fb2` en `/opt/portfolio`, CI verde |
| T15 | S3 | E2E en producción: login con Google → callback → cookie → `/keystatic` (requiere al usuario; depende de T13 y T14) | verify | pendiente |

Orden: T1 → T2 → T3 → T4 → T5; T6 lo decide el usuario. Cierre en prod:
T12 → T13 → T14 → T15.

## Log

- **L1** — "como estamos en este proyecto tenemos problemas en al
  autenticacion este es mi ecosistema
  /home/harco/Documentos/elrincondeharco.com/core" / "y estaba viendo que
  authcore no esta creado el tenant de prixline"
- **L2** — Diagnóstico (2026, sólo lectura): tres bloqueadores encadenados
  confirmados con evidencia. (a) La DB dev (`authcore-dev-db:5434`, schema
  `authharco`) tiene **un solo tenant: `rincom`** — ni `prixline` ni los 6
  del `seed_tenants.py` (el seed no se aplicó a esta DB); `prixline` tiene
  **cero menciones** en todo authCore. (b) `main` **no emite `iss` ni `aud`**:
  T5a vive sin mergear en `feat/token-iss-aud` (`0777260`, ausente también en
  `origin/main`); token real de `POST /api/v1/auth/dev-login` decodificado =
  claims `sub, username, email, role, type, tenant, modules, exp, iat, jti`
  sin `iss`. El middleware de webprixline exige `AUTHCORE_JWT_ISSUER`
  (fail-closed) → rechazaría todo token válido. (c) `hernan.harco@gmail.com`
  está `status=PENDING`, `role=NONE`, `tenant_id=NULL` → `AuthService` lanza
  `403 PENDING_APPROVAL`. Además el seed de tenants (6) no coincide con la
  DB real (1).
- **L3** — Decisión del usuario (Ask): alcance = "Arreglar toda la cadena"
  (S3) y token = "Mergear iss + activar aud=prixline" (S4).
- **L4** — Riesgo medido antes de implementar S4 (python-jose, verificado en
  el contenedor): decodificar un token **con** `aud` sin pasar `audience=`
  lanza `JWTClaimsError: Invalid audience`; con `audience="prixline"` decoda
  OK. Por eso T2 es condición de S4: sin él, activar `JWT_AUDIENCE=prixline`
  tumba `get_current_user` (401 en todo el API y el dashboard del hub),
  `verify_token` (refresh), `get_token_payload` y `get_hub_token_claims`.
  Radio de impacto revisado: CafeMiTierra declara
  `AUTHCORE_JWT_AUDIENCE=cafemitierra` en `.env`/`.env.production` pero
  **no lo lee en ningún fichero `src/`** — no se rompe. **Limitación
  conocida**: `JWT_AUDIENCE` es global, así que TODOS los tokens del hub
  viajan con `aud=prixline`; un futuro spoke que exija su propio `aud` va a
  necesitar audience por `origin` (captura ya existente en `google.py`).
- **L5** — Incidente tooling (2026, T0): `backend/.venv/bin/python` →
  `/usr/bin/python3.12` **no existe** (el sistema pasó a
  `/usr/bin/python3 → python3.14`); `poetry` muere igual (su venv apunta
  al 3.12 borrado: `ModuleNotFoundError: No module named 'encodings'`).
  Los `site-packages` del venv están intactos (185 paquetes) pero no hay
  intérprete. El contenedor `authcore-dev-backend` tiene
  `/usr/local/bin/python` 3.12.15, la app y `/app/tests` completos, pero
  `pytest: False` (es dev-dependency, fuera de la imagen). Sólo lectura
  hasta aquí: ninguna tarea de implementación empezada.
- **L6** — T0 cerrado: `pytest 7.4.4` + `pytest-asyncio 0.21.2` +
  `pytest-cov 4.1.0` instalados en el contenedor vivo (la imagen no los
  trae). Runner verificado con `tests/test_auth_services.py::TestTokenService`
  → **7 passed en 2.09s**. El venv/poetry del host NO se reparó: haría
  falta reinstalar Python 3.12 en el sistema, así que se documenta como
  incidente y se usa el contenedor. **`/app/tests` NO está montado** (viene
  de la imagen) → hay que `docker cp backend/tests/.` tras cada cambio de
  tests; `/app/app` y `/app/scripts` sí están montados.
- **L7** — T1: rama `feat/prixline-audience`; **RED** con sólo los 2 tests
  nuevos aplicados → `2 failed` (`KeyError: 'iss'`, `AttributeError: no
  attribute 'jwt_audience'`). Merge limpio `0ed1c91` (el solape de
  ficheros con main era vacío, como predijo el pre-flight: main sólo había
  tocado 3 ficheros frontend desde el merge-base `43a064a`) → **GREEN**.
  `JWT_AUDIENCE=${JWT_AUDIENCE:-prixline}` añadido a `compose.yaml` y
  `compose.prod.yaml` → `58d52ad`. Verificación: **36 passed** en
  `test_auth_services` + **51 passed** en `test_auth_endpoints`,
  `test_data_token`, `test_dev_login_endpoints`, `test_pending_approval_flow`.
- **L8** — T2: **RED** `2 failed` (`401` en `get_current_user` + decoders
  devolviendo `None`) → los **4/4** `jwt.decode` de producción pasan
  `audience=settings.jwt_audience` → **GREEN 2 passed** → **128 passed**
  en 76s (los 7 suites de auth/tenants/users). Commit `d87e20d`.
  **Incidente propio**: mi primer edit de `test_data_token.py` sustituyó
  4 aserciones de `test_request_body_claims_are_ignored` en vez de
  añadirlas; se restauraron y el diff final es de 0 borrados.
- **L9** — T3: **RED** `GET /tenants/by-slug/prixline` = `404 Tenant con
  slug 'prixline' no encontrado` (control `rincom` = 200). `prixline`
  añadido al seed (`88caa3d`) e insertado en la DB dev con el mismo modelo
  → **GREEN 200**, `id=1b25fa2f-222f-419c-b875-8b17e382536b`,
  `is_active=true`. **No se corrió el seed completo**: además habría creado
  5 tenants + 2 módulos + 5 asignaciones que no se pidieron; la DB dev
  sigue con ese drift respecto de `AUDITORIA-AUTHCORE.md`.
- **L10** — T4: decisión del usuario (Ask) = **SUPERADMIN** global +
  membresía `ADMIN` en prixline. **RED** `POST /users/select-tenant` =
  `403 Usuario inactivo` → `PATCH /users/1/role {SUPERADMIN}` (el rol ≠
  NONE activa la cuenta solo: `status=ACTIVE`, `is_active=true`) +
  `PUT /users/1 {tenant_id}` (comprobado: `filter_sensitive_fields` **no**
  descarta `tenant_id`) + membresía por SQL (no hay endpoint que cree
  filas `UserTenant`) → **GREEN 200**. Mint del `AuthService` real (el
  camino de Google OAuth): `role=SUPERADMIN`, `iss=http://localhost:8000`,
  `tenant={…, slug: prixline}`. `aud=null` **esperado** hasta recrear el
  contenedor (arrancó antes del edit del compose) y `modules=null` porque
  prixline no tiene módulos asignados — correcto, no es radar/inventory.
- **L11** — T5/T7/T8/T9 cerrados. Recreate del hub dev → env con
  `JWT_ISSUER=http://localhost:8000` y `JWT_AUDIENCE=prixline`; token real
  con `iss` + `aud` y `GET /api/v1/tenants/` → **200** (T2 validado bajo
  `aud` presente), JWKS → `authcore-key-1`. **Primer gate FALLÓ: 8 failed /
  264 passed** — las 8 en `test_data_token.py` con `JWTClaimsError: Invalid
  audience`, porque los helpers de test decodifican sin `audience` y hasta
  ahora la suite nunca había corrido con `JWT_AUDIENCE` en el env. Fix
  `0d16478` → **suite completa 272 passed, coverage 86.92% (gate ≥80),
  EXIT=0**. Gate de webprixline (6 chequeos): `/` 200 · `/keystatic` sin
  cookie **302 `/admin/login`** · `/admin` sin cookie **302** ·
  `/api/keystatic/tree` sin cookie **401** · con cookie válida **200**
  (4226 bytes) · API con cookie **400** (ya no 401: pasó el gate; el 400 es
  de Keystatic por un GET sin parámetros). Verificación independiente
  `gentle-ai-verify`: **ítems 1-7 PASS** (diff 9 ficheros / +179 −6, 4/4
  decoders con audience, Settings con defaults correctos, composes ok, DB =
  prixline + rincom sin duplicados, user 1 = SUPERADMIN/ACTIVE con 1
  membresía, suite 272 passed) y trajo un **HIGH**:
  `Portfolio…/backend/app/services/auth/TokenValidator.py` hace
  `jwt.decode(token, key, algorithms=["RS256"])` **sin `audience`** y
  traga `JWTError` → devuelve `None` → 401 en todas sus rutas cuando los
  tokens lleven `aud` (confirmado por mí en el fichero; `JWTClaimsError` ⊂
  `JWTError`). Hoy el backend de Portfolio **no está corriendo ni tiene
  `AUTHCORE_*` en `.env`** → es latente, pero hay que resolverlo ANTES de
  T6. LOW: `CafeMiTierra/.env` declara `AUTHCORE_JWT_AUDIENCE=cafemitierra`
  sin leerlo en `src/` (trampa futura). Assess nativo sobre el commit de
  docs (`10306e8a..38f1062d`) → risk **passive**, `reviewDue: false`.
  Sobre authCore no corrió: es otro repo y el ciclo nativo exige
  autorización explícita del usuario para un root distinto.
- **L12** — Review nativa RDD (2026-10-12) sobre el candidato
  `sha256:c84c6e03…` de este repo: los dos commits de docs de esta
  fase. Primer START rechazado en preflight (`invalid_request`, sin
  linaje) porque seleccione lentes de agente para un candidato que el
  proveedor evalúa en **low** — cura aplicada: omitir `lenses` y reintentar
  con key fresca. Segundo START → `state: approved`, `risk_tier: low`
  (`non_executable_only`), `lenses_required: false`, 1 fichero / 151
  líneas / budget 76. STATUS bound ofreció
  `approved_acknowledgement_required` → `acknowledge-approved` ejecutado
  sin cambios → **`authority: burned`**, `outcome:
  native-approved-acknowledgement-completed`. La review es informativa y
  **no autoriza delivery**: push y deploy siguen siendo decisión del
  usuario (T6).
- **L13** — Corregido el **HIGH** de L11 (2026-10-12, decisión del usuario
  = "proceder"): rama `fix/authcore-token-audience` en Portfolio,
  commit `9748fb2` (2 ficheros, +24/−2). `config.py` gana
  `authcore_jwt_audience` (opcional, alias `AUTHCORE_JWT_AUDIENCE`) y
  `TokenValidator.verify_token` decodifica con `audience=` si está
  configurado o con `options={"verify_aud": False}` si no — soportado en
  `jose/jwt.py:499`. **RED** con el módulo real (ejecutado dentro del
  contenedor del hub, que tiene python-jose y el JWKS en su propio
  :8000): token del hub con `aud` → `verify_token` → `None`. **GREEN** con
  `DEBUG=false` (producción) en 3 escenarios: sin `AUTHCORE_JWT_AUDIENCE`
  → claims OK · `=prixline` → claims OK · `=cafemitierra` → `None` con
  `Invalid audience` (rechazo correcto del token ajeno).
  **Incidentes**: (a) el runner local de Portfolio está roto igual que el
  de authCore (`.venv/bin/python` → py3.12 borrado) y no tenía tests de
  `TokenValidator`, así que la verificación fue funcional sobre el módulo
  real copiado al contenedor; (b) el hook pre-commit de Portfolio (husky +
  lint-staged → `python3 -m black`) falla porque el `python3` del sistema
  es brew 3.14 sin black — formateado con `black 23.12.1` (line-length 88,
  py312) y commiteado con `--no-verify`, dejándolo constancia en el
  mensaje; (c) `.atl/skill-registry.md` y `.gitignore` estaban staged
  ANTES de la sesión y se dejaron intactos (commit por pathspec).
- **L14** — Cierre de producción (2026-10-12, decisión del usuario vía
  Ask: "Sí, crear tenant en prod" + "Mergear y desplegar").
  **T12**: `vercel env ls production` muestra `AUTHCORE_JWKS_URL` y
  `AUTHCORE_JWT_ISSUER` en Production y el build desplegado las usa
  (`curl /admin/login` → 200 con `data-auth-base`; `/keystatic` → 302 a
  `/admin/login`, gate fail-closed esperado sin cookie).
  **T13**: en la DB de prod (`authcore-postgres-1`, schema `authharco`)
  sólo faltaba el tenant — SELECT previo = 7 tenants sin `prixline`.
  Transacción atómica: INSERT en `tenants` (`1b25fa2f-222f-419c-b875-8b17e382536b`,
  slug `prixline`, name `Prixline`, `website_url`/`admin_url` iguales a
  dev), `UPDATE users SET tenant_id=... WHERE id=1` (estaba `NULL`) e
  INSERT de membresía `user_tenants` `ADMIN` (`gen_random_uuid()`).
  Verificación: 8 tenants con `prixline|Prixline|t`; user 1 =
  `ACTIVE|SUPERADMIN|tenant_id=prixline`; 7 membresías ADMIN.
  El `GET /tenants/by-slug/prixline` devuelve 401 sin token (esperado;
  lo valida el panel con sesión). **Pendiente T15**.
- **L15** — **T14**: `main` de Portfolio era ancestro de `9748fb2` →
  `git push origin fix/authcore-token-audience:main` (fast-forward,
  sin tocar el worktree local: los staged `.atl/skill-registry.md` y
  `.gitignore` quedaron intactos) + `git fetch origin main:main`.
  CI (`ci.yml`): Backend ✅ Frontend ✅ (run 38269604975). **Deploy =
  manual en este repo** (no hay webhook ni job de deploy; el
  `deploy-webhook` del server es sólo de VidaSaludable y el de
  inventario es otro — la topología generalizada de la sesión anterior
  no aplica a portfolio). En `/opt/portfolio`: `git merge --ff-only
  origin/main` en vez de `reset --hard` para **preservar los cambios
  locales** (`compose.prod.yaml` modificado y la migración
  `7969bead0e27_add_cv_url_column.py` borrada en el worktree).
  **Hallazgo latente hecho efectivo**: `compose.prod.yaml` ponía a `api`
  en `elrindeharco_net` + `radar_default` pero `postgres` vive en
  `portfolio_default` → el api recreado no resolvía `postgres` y entró
  en restart loop (el contenedor anterior databa de una config previa).
  Fix en el server (backup `compose.prod.yaml.bak-20261012`): `api`
  gana `portfolio_default` como red externa además de las dos
  existentes. Resultado: arranque OK, `/docs` → 200, fix presente en la
  imagen (`verify_aud` en `TokenValidator.py`),
  `portfolio-api-1 Up` + `portfolio-postgres-1 Up 7 days (healthy)`.
  **Hallazgos sin tocar (backlog)**: (a) alembic falla al arrancar con
  `KeyError: '7969bead0e27'` — `2a3b4c5d6e7f` apunta a la migración
  borrada; el arranque lo traga y compensa con `create_all`, pero
  `alembic_version` **no existe** en la DB de prod → ninguna migración
  corre nunca en producción; (b) el host tenía dos directorios casi
  idénticos (`elrindeharco.com` con `core`/`prototipos` y
  `elrindeharco.com` con el ecosistema real) — los comandos deben
  resolver los paths con `find`, nunca tipeados.
  **Verificación independiente** (`gentle-ai-verify` task
  `mv5f69cw-1-imga`, sólo lectura): **7/7 PASS → VERDICT OK** — HEAD
  `9748fb2` == `origin/main`; api Up 7→8 min sin restart (restarts=0);
  las 3 redes correctas en ambos contenedores; `verify_aud` en la
  imagen corriendo; `/docs` 200 + `GET /api/v1/site-settings/latest/`
  200 (DB alcanzable por la app); `status --short` sólo con los
  cambios locales preexistentes; `diff compose.prod.yaml` = únicamente
  healthcheck 30s + la red `portfolio_default`. Caveats del verificador:
  TLS/tunnel no probado (8003 directo) y el comportamiento JWT `aud`
  sólo verificado en presencia de código, no end-to-end (eso es T15).
