# Prixline Course UX + Real Thumbnails

Segunda fase del sitio (continúa `prixline-content-pipeline`, ya cerrado con T1-T8).
Feedback del usuario sobre `http://localhost:4322/cursos/`:

1. Demasiado texto: la vista cansa la vista.
2. Al hacer click en un curso redirige al blog de Luis — el visitante debe
   **permanecer en la página** con fichas propias y profesionales.
3. Faltan miniaturas; el blog origen las usa mucho (YouTube + imágenes inline).

Decisiones del usuario:
- **Imágenes**: solo fotos reales cuando existen fuente (YouTube `i.ytimg.com`,
  `<img>` inline del post). Los cursos NO llevan fotos de stock ni portadas
  generadas: van tipográficos con jerarquía fuerte.
- Todo el temario de los cursos ya está importado en `content/courses/*`
  (302 fichas con el cuerpo completo) — se reutiliza para las fichas internas.

## Tareas

- [ ] T9. Páginas de detalle `/cursos/[slug]/` (302 rutas estáticas): temario
      renderizado con jerarquía, migas, CTA de contacto interno, sin salida al
      blog origen (la fuente queda como enlace discreto al pie). Las tarjetas
      del catálogo enlazan al detalle interno.
- [ ] T10. Rediseño visual del catálogo `/cursos/`: menos texto por tarjeta
      (título + categoría + nº de temas), grid con respiración, jerarquía
      tipográfica, buscador con chips de categoría, sin enlace externo.
- [ ] T11. Miniaturas reales en artículos: el importador de posts extrae
      `thumbnail` (primer id de YouTube del contenido o primera `<img>`) y la
      home muestra los 6 artículos con imagen real (fallback tipográfico si no
      hay).
- [ ] T12. Sección YouTube con vídeos reales del canal vía RSS de build
      (`youtube.com/feeds/videos.xml?channel_id=...`, sin API key): últimos
      vídeos con miniatura real `i.ytimg.com`, enlazados, sustituyendo el
      bloque solo-enlace actual.

## Criterios de aceptación

- **Imágenes editables desde el CMS**: toda imagen (miniatura de artículo,
  vídeo, futura imagen de curso) vive en un campo de datos (frontmatter o
  `content/settings/*`) con su `alt`; los componentes solo leen ese campo.
  Cero URLs de imagen hardcodeadas en componentes. El importador propone un
  valor por defecto (YouTube/`<img>` inline) pero un editor del CMS puede
  sobreescribirlo o vaciarlo sin tocar código.

- `pnpm build` y `pnpm check` en `site/` → exit 0.
- Ninguna tarjeta de curso sale del sitio; `/cursos/<slug>/` existe para los
  302 cursos y renderiza el temario completo.
- Ningún archivo > 400 líneas.
- Las imágenes remotas se piden a CDNs estables (i.ytimg.com) o al origen;
  sin métricas inventadas.
- Verificación estructural documentada (markup sin framework de tests).

## Evidencia

- Commits por tarea: (se rellena al cerrar)
