# Prixline Content Pipeline + Web Nueva

**Objetivo**: importar TODO el contenido de https://prixline.blog/ a un modelo de datos estructurado y construir la web nueva de Prixline (sorpresa para Luis) con Astro + CMS headless.

**Fuente única de contenido**: el WordPress de Luis (sin preguntarle nada).
API disponible: `https://public-api.wordpress.com/wp/v2/sites/prixline.blog/...`
(`/wp-json/` propio está bloqueado; `/feed/` RSS operativo).

**Alcance de importación (decisión del usuario: TODO)**:
- ~281 cursos embebidos en la página `/cursos` (394.684 caracteres)
- 813 posts (migración/opinión/empleo), con categorías limpias
- Páginas estáticas: practicas, redes (13 canales), contacto, opiniones
- Canales sociales para la sección comunidad + badge EN VIVO (YouTube `@prixline`)

**Restricciones del proyecto**:
- Ningún archivo de código > 400 líneas (política del usuario)
- TypeScript estricto (`pnpm typecheck` debe pasar en 0 errores)
- Cada tarea cierra con un work-unit commit (rama feature, sin push)
- Contenido placeholder del prototipo React NO se migra (solo referencia)

## Tareas

- [x] T1. Rama feature + pipeline base (scripts/, content/, fixtures de prueba) — commit `c8112e65`
- [x] T2. Extractor de cursos: `/cursos` → `content/courses/*` (~281 fichas con temario) — test-first con fixture — commit `e236501b`
- [x] T3. Importador de posts: API WP.com → `content/posts/*` (813, categorías limpias, frontmatter) — test-first — commit `88136a88`
- [x] T4. Importar páginas estáticas (prácticas, redes, contacto) +canales a `content/settings` — commit `953f5ebc`
- [x] T5. Scaffolding Astro en `site/` con content collections (courses, posts, pages) — build + typecheck en 0 — commit 5bfcff5c
- [x] T6. UI home con contenido real (secciones: hero dual, confianza, artículos, YouTube, cursos, prácticas, comunidad, CTA) — commit `7f672208`
- [x] T7. Badge EN VIVO (YouTube Data API `eventType=live`) configurable desde settings — commit `91050e94` (+ `ab554d69` mantenimiento pipeline)
- [x] T8. Verificación final: recuentos vs fuente, build, typecheck, <400 líneas, commits

## Evidencia

- T1: `c8112e65` chore(pipeline): scaffold content pipeline with fixtures (fixtures: cursos 60KB, 3 posts, 54 categorías)
- T2: extractor test-first (RED module-not-found → GREEN 6/6 tests); run live: **302 fichas** (297 títulos únicos, 4 repetidos con slug `-2`), 0 cuerpos vacíos, 0 títulos basura; regla de frontera: párrafo que empieza por `CURSO` en mayúsculas (el fixture no tiene elementos heading)
- T3: `88136a88` — 813 fichas (3,5MB), tests 5/5, mapa cerrado 51 claves → 8 categorías limpias; 546 posts solo `sin-categoria` (marca `prixline`/`prix-line`), 104 cuerpos <200 chars (fuente fiel)
- T4: tests 9/9 (suite total 20/20); 4 páginas importadas; `social.json` con 13 canales (2 son CTAs no-redes: `sugerencias`→prix.com/contacto, `opiniones`→comentarios) y `site.json` con bloque `live` (handle `@prixline`, 300s)
- T5: Astro 5.18.2 en `site/` (collections glob courses/posts/pages, schemas validan 1119/1119). **Bloqueo resuelto**: 46 posts tenían `@AlertasEmpleo` sin comillas en YAML (indicador reservado) → bug en NUESTRO emisor `post-render.ts` (no en el contenido); fix test-first (RED real: 1/6 fallaba) + regeneración de 813 + build/check en 0. Conteos: **813 / 302 / 4**
- T6: paleta Confianza (navy `#12314F` + oro `#C8A24A`, contraste AA, font del sistema). 9 componentes Astro (máx 284 líneas) + home + `/cursos/` con 302 cursos y filtro sin dependencias. Hechos reales en Trust (2012 / 813 / 13), 0 métricas inventadas, 0 `<img>`, marcador TEMPORARY eliminado, build/check en 0
- T7: `91050e94` — badge oculto por defecto, 0 peticiones sin `PUBLIC_YOUTUBE_API_KEY`, intervalo 900s (9.600 u/día < cuota 10.000), channelId cacheado 24h, tests 13/13 con RED→GREEN, build/check 0 con y sin key; `ab554d69` — `pipeline:*` ahora regeneran de verdad (antes fixture/dry-run) + README corregida (settings lo escribe `import-settings.ts`)
- T8 (verificación completa): tests **34/34**; typecheck raíz **0 errores**; build raíz **0**; site build+check **0/0**; recuentos vs fuente **302 / 813 / 4 / 13** coinciden; **0 archivos >400 líneas** (máx 353: `src/app/components/ui/chart.tsx`); home real: 6 artículos, 4 secciones ancla, badge EN VIVO, 0 `<img>`
- **Review nativa**: la rama completa (`main..HEAD`) la rechazó el provider con `lens_context_budget_exceeded` (1.119 archivos de contenido); se reintentó acotada al rango de código `5bfcff5c..HEAD` → linaje `review-9763e3bcc3f6cecc` (tier medium, lente `review-reliability`, 24 archivos / 1.899 líneas, budget corrección 200). Veredicto: 3 hallazgos (1 CRITICAL `R3-MetaDescriptionLiteralExpression`, 1 WARNING `R3-EarliestYearInfinityBoundary`, 1 SUGGESTION `R3-ChannelCountInconsistency`) → corregidos en commit `9a099e42` (plan 12 diff líneas, reales 11; verificado: meta con “302 cursos”, sin `Infinity`, canales 11/11, build/check/tests en 0). La validación dirigida posterior falló nativamente → estado `escalated`, stop terminal **`native_stop_required`**: la review NO quedó aprobada; requiere decisión del maintainer (inspeccionar autoría/linaje, o desactivar el switch con `gentle-ai review mode disable --scope clone` y seguir con la política ordinaria de entrega).
