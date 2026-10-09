import { fileURLToPath } from 'node:url';

import vercel from '@astrojs/vercel';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';

// T5: el admin pasa a publicarse en producción.
//
// - @keystatic/astro inyecta /keystatic (UI) y /api/keystatic (API) ambas
//   `prerender: false` (dist de @keystatic/astro@6). Sin adapter eso rompía
//   el build ([NoAdapterInstalled], verificado en T26) — por eso T26-T4
//   sólo inyectaban en dev (keystaticDevOnly). Con @astrojs/vercel@9 esas
//   rutas se despliegan como funciones serverless y el resto del sitio
//   sigue prerenderizado (output 'static' + adapter = SSR opt-in por ruta).
// - El middleware (src/middleware.ts, T3) corre en runtime en esas
//   funciones: gate authCore activo en producción. Las páginas públicas
//   lo ejecutan sólo en build (paso `public` → next() sin efectos).
// - El adapter escribe `.vercel/output` bajo ESTE root (site/); Vercel lo
//   espera en la raíz del repo, así que vercel.json lo copia tras el build.
//
// T26 follow-up (Option A): el plugin de @keystatic/astro resuelve
// `virtual:keystatic-config` con `this.resolve('./keystatic.config', './a')`,
// un importador relativo que Vite ancla al cwd del proceso. Con
// `astro dev --root site` lanzado desde la raíz del repo ese resolve falla
// (`Cannot find module 'virtual:keystatic-config'`) y la API inyectada
// devuelve 500. Este shim resuelve el id virtual al config real
// (site/keystatic.config.ts) con ruta absoluta, independiente del cwd.
function resolveKeystaticConfigVirtual() {
  return {
    name: 'prixline:resolve-keystatic-config-virtual',
    resolveId(id) {
      if (id === 'virtual:keystatic-config') {
        return fileURLToPath(new URL('./keystatic.config.ts', import.meta.url));
      }
      return null;
    },
  };
}

// Production domain of the Prixline gift site.
// En dev, la UI de Keystatic queda en /keystatic (y su API en /api/keystatic);
// src/pages/admin/[...key].astro redirige /admin → /keystatic, y el middleware
// exige JWT de authCore salvo en /admin/login (T3/T4).
export default defineConfig({
  site: 'https://prixline.rincom.es',
  integrations: [react(), keystatic()],
  adapter: vercel(),
  vite: {
    plugins: [resolveKeystaticConfigVirtual()],
    // T26 follow-up: el dep optimizer (esbuild) intenta empaquetar
    // @keystatic/astro/api (vía .astro/keystatic-imports.js) y topa con el
    // módulo virtual `astro:env/server`, que solo resuelven los plugins de
    // Astro en el pipeline SSR; desde la raíz del repo el fallo escala a
    // [UnhandledRejection] y tumba la API inyectada. Excluimos los paquetes
    // Keystatic del prebundle: se cargan on-demand, donde Astro sí resuelve
    // sus módulos virtuales.
    optimizeDeps: { exclude: ['@keystatic/astro', '@keystatic/core'] },
  },
});
