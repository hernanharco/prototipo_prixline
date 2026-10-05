import { fileURLToPath } from 'node:url';

import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';

// @keystatic/astro@6 inyecta rutas no-prerenderizadas (/keystatic y
// /api/keystatic, ambas `prerender: false`); un build `static` sin adapter las
// rechaza con [NoAdapterInstalled] (verificado en T26). El admin es dev-only
// mientras el storage sea `local`: T28 decidirá el adapter SSR si el admin
// debe publicarse en producción con storage github.
function keystaticDevOnly() {
  const integration = keystatic();
  return {
    ...integration,
    hooks: {
      ...integration.hooks,
      'astro:config:setup': (options) => {
        const setup = integration.hooks['astro:config:setup'];
        if (options.command === 'dev' && setup) setup(options);
      },
    },
  };
}

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
// src/pages/admin/[...key].astro redirige /admin → /keystatic.
export default defineConfig({
  site: 'https://prixline.rincom.es',
  integrations: [react(), keystaticDevOnly()],
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
