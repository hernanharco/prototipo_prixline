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
| T6 | S3 | **[usuario]** push de `main` en authCore + deploy del hub en producción (el `JWT_ISSUER` de `compose.prod.yaml` ya viaja en `0777260`) | blocked: usuario | |

Orden: T1 → T2 → T3 → T4 → T5; T6 lo decide el usuario.

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
