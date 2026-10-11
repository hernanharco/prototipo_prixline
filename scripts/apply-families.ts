/**
 * scripts/apply-families.ts
 *
 * Backfill del campo `family` en content/courses/*.md (fase 8, S4).
 *
 * Productor del campo: toma la familia de la tabla cerrada
 * `scripts/course-families.ts` (decisión humana, fijada por test) y la
 * escribe en el frontmatter SOLO donde falta. Reglas:
 *   - Slug sin asignación en la tabla → error y exit 1 (nunca se infiere).
 *   - `family` existente → se conserva (una corrección hecha desde el
 *     CMS gana sobre la tabla).
 *   - Idempotente: re-ejecutarlo sobre el corpus ya backfilleado no
 *     escribe nada.
 *
 * Uso: node scripts/apply-families.ts [--dry-run]
 * (con --dry-run imprime el plan sin escribir).
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { COURSE_FAMILIES, familyForSlug } from "./course-families.ts";
import type { Family } from "./family-map.ts";

export const COURSES_DIR = join(import.meta.dirname, "..", "content", "courses");

/**
 * Pure: devuelve el markdown con `family: <family>` insertado tras la
 * línea `slug:` del frontmatter. Si `family` ya existe, devuelve el
 * markdown sin cambios (la corrección del CMS gana).
 */
export function addFamilyToMarkdown(markdown: string, family: Family): string {
  const lines = markdown.split("\n");
  if (lines[0]?.trim() !== "---") {
    throw new Error("markdown sin frontmatter (no empieza por ---)");
  }
  const closing = lines.indexOf("---", 1);
  if (closing === -1) {
    throw new Error("frontmatter sin cierre");
  }
  if (lines.slice(1, closing).some((line) => line.startsWith("family:"))) {
    return markdown;
  }
  const slugLine = lines.findIndex((line, i) => i < closing && line.startsWith("slug:"));
  if (slugLine === -1) {
    throw new Error("frontmatter sin línea slug:");
  }
  lines.splice(slugLine + 1, 0, `family: ${family}`);
  return lines.join("\n");
}

/** CLI: backfill sobre el corpus real (o dry-run con --dry-run). */
async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const files = (await readdir(COURSES_DIR))
    .filter((file) => file.endsWith(".md"))
    .sort();

  let added = 0;
  let kept = 0;
  let unchanged = 0;

  for (const file of files) {
    const path = join(COURSES_DIR, file);
    const markdown = await readFile(path, "utf8");
    const slug = /^slug: (.+)$/m.exec(markdown)?.[1];
    if (!slug) throw new Error(`${file}: frontmatter sin slug`);
    const family = familyForSlug(slug);
    if (!family) throw new Error(`${file}: slug sin familia en la tabla: ${slug}`);

    const hasFamily = /^family: /m.test(markdown);
    const result = addFamilyToMarkdown(markdown, family);
    if (result !== markdown) {
      if (!dryRun) await writeFile(path, result);
      added += 1;
    } else if (hasFamily) {
      const current = /^family: (.+)$/m.exec(markdown)?.[1];
      current === family ? (unchanged += 1) : (kept += 1);
    } else {
      unchanged += 1;
    }
  }

  const prefix = dryRun ? "[dry-run] " : "";
  console.log(
    `${prefix}courses=${files.length} added=${added} kept(cms-editado)=${kept} unchanged=${unchanged} table=${Object.keys(COURSE_FAMILIES).length}`,
  );
}

if (process.argv[1] === import.meta.filename) {
  await main();
}
