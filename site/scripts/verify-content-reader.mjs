#!/usr/bin/env node
// Smoke de lectura Keystatic (T27) — herramienta permanente.
//
// Ejecutar SIEMPRE desde la raíz del repo:
//   node site/scripts/verify-content-reader.mjs
//
// Importa el config real de Keystatic (site/keystatic.config.ts) y el reader
// local (@keystatic/core/reader) con storage apuntando al repo (cwd), y
// recorre TODAS las entradas de las tres colecciones (posts/courses/pages),
// cargando datos + cuerpo de cada una. Comprueba:
//   1. Conteos exactos: posts=813, courses=302, pages=4.
//   2. Que toda clave de frontmatter de cada .md esté mapeada por el schema
//      (Keystatic reescribe el frontmatter al guardar: una clave no mapeada
//      se BORRA).
//   3. Que el cuerpo leído por Keystatic sea byte a byte el del archivo.
//   4. Que los tipos de cada campo coincidan con la realidad del corpus y que
//      el slug derivado del nombre de archivo sea coherente con el frontmatter.
// Cualquier desajuste de schema/parseo lanza y sale con código != 0.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import YAML from 'js-yaml';
import { createReader } from '@keystatic/core/reader';

import config from '../keystatic.config.ts';

const EXPECTED = { posts: 813, courses: 302, pages: 4 };

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

function bytesEqual(a, b) {
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function assertString(value, where, { nonEmpty = false } = {}) {
  assert(typeof value === 'string', `${where}: esperaba string, llegó ${typeof value}`);
  if (nonEmpty) assert(value.length > 0, `${where}: esperaba string no vacío`);
}

function assertStringArray(value, where) {
  assert(Array.isArray(value), `${where}: esperaba array, llegó ${typeof value}`);
  for (const [i, item] of value.entries()) {
    assertString(item, `${where}[${i}]`);
  }
}

// Reproduce splitFrontmatter() de @keystatic/core (dist, generic-*.node.js)
// para poder comparar el cuerpo leído por Keystatic contra el archivo crudo.
function splitFrontmatter(raw) {
  const str = textDecoder.decode(raw);
  const match = str.match(/^---(?:\r?\n([^]*?))?\r?\n---\r?\n?/);
  if (!match) return null;
  return {
    frontmatter: match[1] ?? '',
    body: raw.subarray(textEncoder.encode(match[0]).byteLength),
  };
}

// Comprobaciones de tipo por colección, contra la realidad inventariada.
function checkEntryTypes(collection, slug, data) {
  const where = `${collection}/${slug}`;
  // Contrato slugField de Keystatic: el slug canónico vive en el nombre de
  // archivo (entry.slug); el valor frontmatter del campo slug se descarta en
  // la lectura y vuelve como null.
  assert(data.slug === null, `${where}: data.slug debería ser null (contrato slugField), llegó ${JSON.stringify(data.slug)}`);
  assertString(data.content, `${where}: content`, { nonEmpty: true });
  assert(/^\d{4}-\d{2}-\d{2}$/.test(data.date ?? data.extractedAt), `${where}: fecha debería ser YYYY-MM-DD`);
  if (collection === 'posts') {
    assert(Number.isInteger(data.id), `${where}: id debería ser entero`);
    assertString(data.title, `${where}: title`);
    assertString(data.sourceUrl, `${where}: sourceUrl`, { nonEmpty: true });
    assertString(data.originUrl, `${where}: originUrl`, { nonEmpty: true });
    assertStringArray(data.categories, `${where}: categories`);
    assertStringArray(data.originCategories, `${where}: originCategories`);
    assertString(data.excerpt, `${where}: excerpt`);
    assertString(data.thumbnail, `${where}: thumbnail`);
    assertString(data.videoId, `${where}: videoId`);
    assertString(data.thumbnailAlt, `${where}: thumbnailAlt`);
    return;
  }
  // courses y pages
  assertString(data.title, `${where}: title`, { nonEmpty: true });
  assertString(data.sourceUrl, `${where}: sourceUrl`, { nonEmpty: true });
  if (collection === 'pages') {
    assertString(data.originUrl, `${where}: originUrl`, { nonEmpty: true });
  }
}

async function verifyCollection(reader, name) {
  const expected = EXPECTED[name];
  const collectionReader = reader.collections[name];
  assert(collectionReader, `coleccion "${name}" no existe en el config`);
  const schemaKeys = new Set(Object.keys(reader.config.collections[name].schema));
  // resolveLinkedFiles: true → los campos de contenido (formKind 'content')
  // se resuelven a string en la lectura; sin él, Keystatic devuelve una
  // función lazy para el cuerpo.
  const entries = await collectionReader.all({ resolveLinkedFiles: true });
  assert(
    entries.length === expected,
    `${name}: esperaba ${expected} entradas, el reader devolvió ${entries.length}`,
  );
  let bodyBytesChecked = 0;
  for (const { slug, entry } of entries) {
    const where = `${name}/${slug}`;
    assertString(slug, `${where}: slug derivado del nombre de archivo`, { nonEmpty: true });
    checkEntryTypes(name, slug, entry);

    const filePath = join(process.cwd(), 'content', name, `${slug}.md`);
    let raw;
    try {
      raw = readFileSync(filePath);
    } catch {
      fail(`${where}: el reader listó la entrada pero no existe el fichero ${filePath}`);
    }
    const split = splitFrontmatter(raw);
    assert(split, `${where}: el fichero crudo no tiene frontmatter`);

    // 1) Cobertura de claves: cada clave real del frontmatter debe estar
    //    mapeada por el schema (si no, Keystatic la BORRA al guardar).
    const frontmatter = YAML.load(split.frontmatter);
    assert(
      frontmatter !== null && typeof frontmatter === 'object' && !Array.isArray(frontmatter),
      `${where}: frontmatter crudo no es un objeto`,
    );
    for (const key of Object.keys(frontmatter)) {
      assert(schemaKeys.has(key), `${where}: clave de frontmatter "${key}" NO mapeada por el schema`);
    }

    // 2) Cuerpo byte a byte: lo que Keystatic expone debe ser el HTML crudo.
    const viaKeystatic = textEncoder.encode(entry.content);
    assert(
      bytesEqual(viaKeystatic, split.body),
      `${where}: el cuerpo leído por Keystatic difiere del fichero crudo (${viaKeystatic.byteLength} vs ${split.body.byteLength} bytes)`,
    );
    bodyBytesChecked += viaKeystatic.byteLength;

    // 3) Coherencia slug: el slug del nombre de archivo es el frontmatter
    //    slug percent-decodificado (mismo criterio que generateId en Astro).
    let decoded;
    try {
      decoded = decodeURIComponent(String(frontmatter.slug));
    } catch {
      decoded = String(frontmatter.slug);
    }
    assert(decoded === slug, `${where}: slug de archivo "${slug}" != frontmatter slug decodificado "${decoded}"`);
  }
  return { count: entries.length, bodyBytesChecked };
}

async function main() {
  const reader = createReader(process.cwd(), config);
  const summary = [];
  for (const name of Object.keys(EXPECTED)) {
    const { count, bodyBytesChecked } = await verifyCollection(reader, name);
    summary.push(
      `${name.padEnd(8)} ${String(count).padStart(4)}/${EXPECTED[name]} entradas · ` +
        `cuerpo byte-idéntico (${bodyBytesChecked} bytes) · frontmatter cubierto por el schema`,
    );
  }
  console.log('Keystatic reader smoke (T27)');
  console.log(`repo root: ${process.cwd()}`);
  for (const line of summary) console.log(line);
  console.log(`OK: posts=${EXPECTED.posts}, courses=${EXPECTED.courses}, pages=${EXPECTED.pages}`);
}

main().catch((err) => {
  console.error('FAIL:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
