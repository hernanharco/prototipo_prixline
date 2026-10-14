/**
 * scripts/migrate-post-thumbnails.ts (fase prixline-cms-ux — T5/S4)
 *
 * Migración "Migración completa" (decisión del usuario, ver
 * odd/tasks/prixline-cms-ux.md S4): los thumbnails de content/posts pasan
 * de texto libre a campo `fields.image` de Keystatic.
 *
 * Contrato canónico de fields.image (fijado con sondas + doc oficial en
 * T4): valor en frontmatter = `publicPath + slug + '/' + fichero` y
 * binario en `directorio/<slug>/thumbnail.<ext>`. Con el slug de la
 * entrada presente, parse/serialize de Keystatic recortan
 * `publicPath + slug + '/'` a ciegas: los valores antiguos
 * `/media/uploads/2017/11/x.jpg` parsean a BASURA (p. ej. "pg"), así que
 * el editor los perdería al primer guardado — de ahí la migración.
 *
 * Reglas:
 *   - local (`/media/uploads/…`)  → copia el binario a
 *     `uploads/<slug>/thumbnail.<ext>` y reescribe el valor. El binario
 *     origen NUNCA se borra (los cuerpos .md pueden citarlo).
 *   - URL externa (142 en el corpus) o vacía → se DESCARTA la clave
 *     (decisión del usuario) — el resto de la línea/frontmatter no se toca.
 *   - local con el binario origen ausente → se descarta y se reporta como
 *     `missing` (la clave quedaría rota igualmente).
 *   - ausente o ya canónico → intacto (byte a byte).
 *
 * Cirugía textual sobre la línea `thumbnail:` (NO hay roundtrip YAML: las
 * fechas, comillas y comentarios del resto del frontmatter quedan intactos).
 * Idempotente por diseño: la segunda pasada es un no-op.
 *
 * Run (desde la raíz del repo):
 *   node scripts/migrate-post-thumbnails.ts          # dry-run, informa
 *   node scripts/migrate-post-thumbnails.ts --apply  # escribe
 * Test: node --test scripts/migrate-post-thumbnails.test.ts
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const PUBLIC_PREFIX = '/media/uploads/';

export type MigrationReport = {
  migrated: { file: string; from: string; to: string }[];
  discarded: { file: string; value: string; reason: 'external' | 'empty' }[];
  missing: { file: string; value: string }[];
  untouched: number;
};

export function migratePostThumbnails(options: {
  postsDir: string;
  uploadsDir: string;
  apply: boolean;
}): MigrationReport {
  const { postsDir, uploadsDir, apply } = options;
  const report: MigrationReport = { migrated: [], discarded: [], missing: [], untouched: 0 };

  const names = readdirSync(postsDir)
    .filter((name) => name.endsWith('.md'))
    .sort();

  for (const name of names) {
    const filePath = join(postsDir, name);
    const slug = name.slice(0, -'.md'.length);
    const raw = readFileSync(filePath, 'utf8');

    // Divide el fichero en frontmatter + resto SIN reconstruir nada más.
    const parts = raw.match(/^(---\r?\n)([^]*?)(\r?\n---[^]*)$/);
    if (!parts) {
      report.untouched += 1;
      continue;
    }
    const [, fence, frontmatter, tail] = parts;
    const eol = fence.endsWith('\r\n') ? '\r\n' : '\n';

    const lineMatch = frontmatter.match(/^thumbnail:[ \t]*.*$/m);
    if (!lineMatch) {
      report.untouched += 1;
      continue;
    }

    const rawValue = lineMatch[0].replace(/^thumbnail:[ \t]*/, '').trim();
    const value =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;

    const rewrite = (line: string | null): void => {
      if (!apply) return;
      // `thumbnail:` puede ser la última clave: entonces el salto de línea
      // sobrante es el PREVIO, no el posterior.
      const nextFm =
        line === null
          ? frontmatter.includes(lineMatch[0] + '\n')
            ? frontmatter.replace(lineMatch[0] + '\n', '')
            : frontmatter.replace('\n' + lineMatch[0], '')
          : frontmatter.replace(lineMatch[0], line);
      writeFileSync(filePath, fence + nextFm + tail);
    };

    if (value === '') {
      report.discarded.push({ file: name, value, reason: 'empty' });
      rewrite(null);
      continue;
    }

    if (!value.startsWith(PUBLIC_PREFIX)) {
      report.discarded.push({ file: name, value, reason: 'external' });
      rewrite(null);
      continue;
    }

    const rel = value.slice(PUBLIC_PREFIX.length);
    const src = join(uploadsDir, rel);
    const ext = extname(src).replace(/^\./, '');
    const canonicalValue = `${PUBLIC_PREFIX}${slug}/thumbnail${ext ? `.${ext}` : ''}`;
    const dst = join(uploadsDir, slug, `thumbnail${ext ? `.${ext}` : ''}`);

    if (value === canonicalValue && existsSync(dst)) {
      report.untouched += 1;
      continue;
    }

    if (!existsSync(src)) {
      report.missing.push({ file: name, value });
      rewrite(null);
      continue;
    }

    if (apply) {
      mkdirSync(join(uploadsDir, slug), { recursive: true });
      if (!existsSync(dst)) copyFileSync(src, dst);
      const nextFm = frontmatter.replace(lineMatch[0], `thumbnail: ${canonicalValue}`);
      writeFileSync(filePath, fence + nextFm + tail);
    }
    report.migrated.push({ file: name, from: value, to: canonicalValue });
  }

  return report;
}

function main(): void {
  const apply = process.argv.includes('--apply');
  const cwd = process.cwd();
  const report = migratePostThumbnails({
    postsDir: join(cwd, 'content', 'posts'),
    uploadsDir: join(cwd, 'site', 'public', 'media', 'uploads'),
    apply,
  });
  const mode = apply ? 'APLICADO' : 'DRY-RUN (sin cambios; usa --apply)';
  console.log(`[migrate-post-thumbnails] ${mode}`);
  console.log(
    `  migradas: ${report.migrated.length} · descartadas: ${report.discarded.length} ` +
      `· missing: ${report.missing.length} · intactas: ${report.untouched}`,
  );
  for (const item of report.migrated.slice(0, 5)) {
    console.log(`    ~ ${item.file}: ${item.from} → ${item.to}`);
  }
  for (const item of [...report.discarded, ...report.missing].slice(0, 5)) {
    console.log(`    - ${item.file}: ${item.value || "(vacío)"}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
