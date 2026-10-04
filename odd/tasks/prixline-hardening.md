# Prixline Hardening (fase 4 — deuda técnica)

Objetivo: cerrar la deuda técnica informativa que dejaron las reviews de
fases 1–3 y dejar el deploy listo para no romperse solo.

Alcance (decisión del usuario: "arrancar" con 1–3):

- Test del decode de `generateId` (hallazgo review fase 3
  `R3-generateid-untested-decode`).
- Host `video.wordpress.com` en la allowlist del saneador (1 vídeo
  VideoPress que hoy se elimina).
- Limpieza de docs/comentario: placeholder de fase 3 y `TODO: real domain`
  obsoleto en el footer.
- Secrets de Vercel (`VERCEL_TOKEN` sin expiración, `PUBLIC_YOUTUBE_API_KEY`)
  requieren acción del usuario → se instruyen y quedan como paso humano.

Fuera de alcance (decisiones de producto, pendientes aparte):
546 posts `sin-categoria`, opiniones/tawk.to sin cablear, CMS/CRM real.

## Tareas

- [x] T16. Extraer `generateId` de `site/src/content.config.ts` a un módulo
      puro `site/src/lib/entryId.ts` + test test-first (`node --test`):
      decode de slugs percent-encoded, fallback en secuencias malformadas,
      slug numérico → string, id crudo sin `%`. — commit `e5423dfc`
- [x] T17. Añadir `video.wordpress.com` a `EMBED_HOSTS` en
      `site/src/lib/sanitizeHtml.ts` con test-first (RED: los tests que hoy
      exigen `''` pasan a exigir el iframe conservado); scripts `on*`
      siguen eliminados. Verificar en `site/dist` que el iframe del único
      post afectado queda renderizado. — commit `f50bd27f`
- [x] T18. Limpieza de docs: completar "Commits por tarea" en
      `odd/tasks/prixline-internal-content.md` y quitar el comentario
      `<!-- TODO: real domain -->` de `site/src/components/Footer.astro`. —
      commit `06f923cc`
- [ ] T19. Secrets de Vercel (usuario): `gh secret set VERCEL_TOKEN`
      (token de dashboard "No expiration"). **Pendiente.**
- [ ] T20. Pendiente de producto (decisión del usuario): key de YouTube
      (`PUBLIC_YOUTUBE_API_KEY`) para encender el badge EN VIVO —
      *movido a la lista de pendientes a pedido del usuario (2026-10-04)*.
- [ ] T21. Decisión del usuario: doble caminho de deploy (workflow
      Actions con token inválido vs integración Git de Vercel activa) +
      diseño "un secreto general para todos los proyectos" (org-level
      secrets / Vercel Git / reusable workflow).

## Criterios de aceptación

- `node --test scripts/*.test.ts` y `site/src/lib/*.test.mjs` en verde
  (70 + live tests), con tests nuevos añadidos (RED observado → GREEN).
- `site/`: `pnpm build` + `pnpm check` en 0; dist contiene el iframe
  VideoPress saneado y ningún `<script>`/`on*`.
- Sin archivos > 400 líneas; TS estricto en 0.
- Un commit por tarea en la rama feature.

## Evidencia

- T16: `e5423dfc` — RED `ERR_MODULE_NOT_FOUND` (1 test) → GREEN **5/5**;
  suite completa scripts **76/76**; `site/src/lib/*.test.mjs` **13/13**;
  tsc estricto 0; módulo puro (0 imports, sin `any`).
- T17: `f50bd27f` — RED **23/26** (3 aserciones flipeadas fallan) → GREEN
  **26/26**, suite scripts **76/76** (+1 test positivo: atributos
  conservados, `on*` quitado); build Astro **1.120 páginas**, check 0/0/0;
  iframe VideoPress presente en `site/dist/articulos/la-opinion-y-el-
  comentario-de-rosa.../index.html`; 0 `onerror`/`onclick` y 0
  `videopress-iframe.js` en dist.
- T18: `06f923cc` — placeholder de fase 3 completado con los commits
  reales (`2f7f8c51`/`6b382661`/`70014968`/`3dd8a4ac`/`a2522172`),
  `<!-- TODO: real domain -->` eliminado, check 0 errores.
- T19: (acción del usuario — se registra al ejecutarse)
  - Evidencia 2026-10-04: workflow `37202597472` FALLÓ —
    `Error: The token provided via --token argument is not valid` → el
    `VERCEL_TOKEN` de GitHub Secrets ya sirve/expiró. El sitio igual se
    actualizó en producción (el iframe VideoPress responde 200), lo que
    indica que hay un segundo mecanismo de deploy activo (integración Git
    de Vercel) además del workflow de Actions.
- **Review nativa fase 4**: linaje `review-b8abf0ae01f8f5d8` sobre el rango
  `cb924976..8eb6ad00` (8 archivos / 218 líneas, lente `review-reliability`)
  → **APROBADA**, ack ejecutado, authority burned, `consumed: true`.
  4 hallazgos informativos no bloqueantes: R3-001 (entry-id.test.ts:17-47),
  R3-002 (sanitizeHtml.ts:39-42), R3-003 (hardening.md:41), R3-004
  (Footer.astro:23).
