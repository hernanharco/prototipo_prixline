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
- [x] T2. Extractor de cursos: `/cursos` → `content/courses/*` (~281 fichas con temario) — test-first con fixture — commit `WIP`
- [ ] T3. Importador de posts: API WP.com → `content/posts/*` (813, categorías limpias, frontmatter) — test-first
- [ ] T4. Importar páginas estáticas (prácticas, redes, contacto) +canales a `content/settings`
- [ ] T5. Scaffolding Astro en `site/` con content collections (courses, posts, pages) — build + typecheck en 0
- [ ] T6. UI home con contenido real (secciones: hero dual, confianza, artículos, YouTube, cursos, prácticas, comunidad, CTA)
- [ ] T7. Badge EN VIVO (YouTube Data API `eventType=live`) configurable desde settings
- [ ] T8. Verificación final: recuentos vs fuente, build, typecheck, <400 líneas, commits

## Evidencia

- T1: `c8112e65` chore(pipeline): scaffold content pipeline with fixtures (fixtures: cursos 60KB, 3 posts, 54 categorías)
- T2: extractor test-first (RED module-not-found → GREEN 6/6 tests); run live: **302 fichas** (297 títulos únicos, 4 repetidos con slug `-2`), 0 cuerpos vacíos, 0 títulos basura; regla de frontera: párrafo que empieza por `CURSO` en mayúsculas (el fixture no tiene elementos heading)
