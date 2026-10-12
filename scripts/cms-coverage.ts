/**
 * scripts/cms-coverage.ts (fase 10 — prixline-cms-coverage)
 *
 * Defaults de los singletons nuevos del CMS (`nav`, `home`, `seo`) y de
 * los campos de contacto de `content/pages/contacto.md` (S2). Los valores
 * son el copy EXACTO que hoy vive hardcodeado en los componentes (S4:
 * paridad total hasta la primera edición desde el CMS).
 *
 * `seed(baseDir)` los escribe de forma IDEMPOTENTE: sólo crea los settings
 * que no existen y sólo añade el bloque `contact:` al frontmatter de
 * contacto.md si aún no está. Nunca sobreescribe contenido ya presente
 * (las ediciones del CMS son la fuente de verdad a partir del seed).
 *
 * Run: node scripts/seed-cms-coverage.ts (CLI) · node --test scripts/cms-coverage.test.ts
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// ── Defaults (copy actual, byte a byte) ──────────────────────────────────

export const navDefault = {
  wordmark: 'Prixline',
  menuLabel: 'Menú',
  items: [
    { href: '/#migracion', label: 'Migración' },
    { href: '/#cursos', label: 'Cursos' },
    { href: '/#comunidad', label: 'Comunidad' },
    { href: '/#practicas', label: 'Prácticas' },
  ],
  cta: { href: '/contacto/', label: 'Contacto' },
  footer: {
    blog: { href: '/articulos/', label: 'Blog' },
    originalText: 'Sitio original de Prixline',
    copyright: 'Todos los derechos reservados.',
  },
};

export const homeDefault = {
  hero: {
    eyebrow: 'Prixline — orientación y formación',
    heading: 'Migra con responsabilidad y prepárate para estudiar y trabajar en España',
    subcopy:
      'Cursos de calidad, apoyo en las prácticas y canales abiertos para que ' +
      'des el paso con información real y sin sorpresas.',
    primaryCta: { href: '#migracion', label: 'Quiero migrar con responsabilidad' },
    secondaryCta: { href: '#cursos', label: 'Ver los cursos' },
  },
  // Orden de render de las secciones de la home (index.astro lo respeta).
  sectionOrder: ['trust', 'latest', 'courses', 'youtube', 'practices', 'community'],
  sections: {
    trust: {
      enabled: true,
      heading: 'Prixline en datos reales',
      contentSince: {
        label: 'Contenido desde',
        detail: 'El archivo de artículos de Prixline llega hasta este año.',
      },
      articles: {
        label: 'Artículos publicados',
        detail: 'Contenido real importado del blog de origen, sin recuentos inventados.',
      },
      channels: {
        label: 'Canales abiertos',
        detail: 'Redes, podcasts y plataformas donde Prixline está presente.',
      },
    },
    latest: {
      enabled: true,
      eyebrow: 'Migración',
      heading: 'Últimos artículos',
      intro:
        'Información práctica sobre migrar, formarse y encontrar trabajo, tal y ' +
        'como se publicó en el blog de Prixline.',
      ctaLabel: 'Ver todos los artículos',
    },
    courses: {
      enabled: true,
      eyebrow: 'Cursos',
      heading: 'Empieza por aquí',
      intro:
        'Una selección del catálogo de cursos de Prixline. La lista completa ' +
        'está disponible en la página de cursos.',
      ctaLabel: 'Ver el catálogo completo',
    },
    youtube: {
      enabled: true,
      eyebrow: 'Canal de YouTube',
      heading: 'Videoclases y charlas de Prixline',
      handlePrefix: 'Encuéntranos como',
      ctaLabel: 'Ver canal completo',
    },
    practices: {
      enabled: true,
      eyebrow: 'Prácticas',
      heading: 'Prácticas y trabajo',
      ctaLabel: 'Más información sobre prácticas',
    },
    community: {
      enabled: true,
      eyebrow: 'Comunidad',
      heading: 'Sigue a Prixline',
      // {count} = nº real de canales de comunidad (se rellena en render).
      intro:
        '{count} canales abiertos donde publicamos contenido, avisos y ' +
        'recursos para la comunidad.',
    },
  },
};

// Placeholders dinámicos permitidos por página (se rellenan en render con
// recuentos reales; el CMS edita la plantilla, nunca el número).
export const seoDefault = {
  pages: {
    home: {
      title: 'Prixline — Cursos, prácticas y trabajo en España',
      description:
        'Migra con responsabilidad con Prixline: cursos, prácticas y ' +
        'orientación para estudiar y trabajar en España.',
    },
    cursos: {
      title: 'Cursos — Prixline',
      description:
        'Catálogo completo de cursos de Prixline: {count} cursos ordenados ' +
        'alfabéticamente.',
    },
    articulos: {
      title: 'Artículos — Prixline',
      description:
        'Los {total} artículos de Prixline sobre migración, formación y ' +
        'trabajo en España, agrupados por año.',
    },
    contacto: {
      title: 'Contacto — Prixline',
      description:
        'Habla con Prixline por chat y descubre nuestros {channels} canales ' +
        'de comunidad: cursos, prácticas y trabajo en España.',
    },
  },
};

// Bloque `contact:` que el seed añade al frontmatter de contacto.md.
export const contactoContactDefault = {
  eyebrow: 'Contacto',
  heading: 'Contacto',
  intro:
    'La vía más directa es el chat de Prixline; además estamos presentes en ' +
    '{channels} canales de comunidad donde publicamos contenido, avisos y ' +
    'recursos.',
  chatTitle: '¿Hablamos?',
  chatBody:
    'Cuéntanos qué necesitas y te ayudamos con cursos, prácticas y tu ' +
    'camino en España.',
  chatCta: 'Abrir chat con Prixline',
  chatProperty: '58f1d6eaf7bbaa72709c64ff',
  channelsTitle: 'Canales de comunidad',
  channelsIntro: 'Sigue a Prixline donde prefieras: vídeo, podcast, audio y redes.',
  opinionsLine: '¿Quieres saber qué opinan los alumnos?',
};

// ── Seed idempotente ─────────────────────────────────────────────────────

export interface SeedResult {
  written: string[];
  patched: string[];
}

/** YAML plano de un objeto de strings (valores entrecomillados y escapados). */
export function toYamlBlock(key: string, value: Record<string, string>): string {
  const lines = [`${key}:`];
  for (const [field, raw] of Object.entries(value)) {
    const escaped = String(raw).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    lines.push(`  ${field}: "${escaped}"`);
  }
  return lines.join('\n');
}

/**
 * Añade el bloque `contact:` al frontmatter de un .md si no existe.
 * Devuelve el contenido final y si hubo cambio.
 */
export function patchFrontmatter(md: string, block: string): { content: string; changed: boolean } {
  const match = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) throw new Error('contacto.md sin frontmatter (--- ... ---).');
  const frontmatter = match[1];
  if (/^contact:/m.test(frontmatter)) {
    return { content: md, changed: false };
  }
  const insertAt = match[0].lastIndexOf('---');
  const content = `${md.slice(0, insertAt)}\n${block}\n${md.slice(insertAt)}`;
  return { content, changed: true };
}

/**
 * Escribe content/settings/{nav,home,seo}.json (sólo si no existen) y
 * añade el bloque `contact:` a content/pages/contacto.md (sólo si falta).
 */
export function seed(baseDir: string): SeedResult {
  const result: SeedResult = { written: [], patched: [] };

  const settings: Array<[string, unknown]> = [
    ['nav.json', navDefault],
    ['home.json', homeDefault],
    ['seo.json', seoDefault],
  ];
  for (const [name, data] of settings) {
    const file = join(baseDir, 'content', 'settings', name);
    if (!existsSync(file)) {
      writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
      result.written.push(file);
    }
  }

  const contactFile = join(baseDir, 'content', 'pages', 'contacto.md');
  const md = readFileSync(contactFile, 'utf8');
  const patched = patchFrontmatter(md, toYamlBlock('contact', contactoContactDefault));
  if (patched.changed) {
    writeFileSync(contactFile, patched.content, 'utf8');
    result.patched.push(contactFile);
  }

  return result;
}

// CLI: node scripts/cms-coverage.ts [repoRoot]
if (process.argv[1] && /cms-coverage\.ts$/.test(process.argv[1])) {
  const result = seed(process.argv[2] ?? process.cwd());
  console.log(
    `seed: ${result.written.length} settings creados, ` +
      `${result.patched.length} frontmatter parcheado.`,
  );
}
