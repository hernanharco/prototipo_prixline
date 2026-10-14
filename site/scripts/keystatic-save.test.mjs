#!/usr/bin/env node
// T1 (spec S4 de odd/tasks/prixline-admin-auth.md) — contrato de GUARDADO de
// Keystatic sobre el corpus real.
//
// Pregunta que responde: si alguien guarda una entrada desde /admin, ¿sigue
// el frontmatter siendo legible para el schema de Astro (site/src/
// content.config.ts) y se conservan los valores? T27 solo verificaba la
// LECTURA (verify-content-reader.mjs); aquí se fija el ciclo completo
// parse → serialize → YAML, que es lo que ejecuta el cliente de Keystatic
// en el navegador antes de POSTear a /api/keystatic/update.
//
// Réplica fiel del guardado (evidencia en site/node_modules/@keystatic/core/
// dist/index-3c244051.js, funciones transformProps/serializeProps y en
// keystatic-core-ui.js serializeEntryToFiles + dump de js-yaml):
//   1. parse: el campo slugField se parsea con el slug del NOMBRE DE ARCHIVO
//      (extra.slug), no con el valor frontmatter (deserializeProps).
//   2. serialize: para la clave slugField se usa serializeWithSlug(...).value;
//      para el resto, serialize(...).value; el visitor `object` elimina del
//      YAML toda clave cuyo valor serializado sea undefined.
//   3. YAML.dump es lo que viaja al servidor y se escribe en disco.
//
// Run (desde la raíz del repo): node --test site/scripts/keystatic-save.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import YAML from 'js-yaml';

import config from '../keystatic.config.ts';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const COLLECTION_DIRS = { posts: 'posts', courses: 'courses', pages: 'pages' };
// fields.image (S4, fase prixline-cms-ux): disco = directory/<slug>/<fichero>.
const IMAGE_DIRECTORY = join('site', 'public', 'media', 'uploads');

function loadEntry(file) {
  const raw = readFileSync(file, 'utf8');
  const match = raw.match(/^---\r?\n([^]*?)\r?\n---\r?\n?([^]*)$/);
  assert.ok(match, `${file}: no tiene frontmatter YAML`);
  const frontmatter = YAML.load(match[1]);
  assert.ok(
    frontmatter !== null && typeof frontmatter === 'object' && !Array.isArray(frontmatter),
    `${file}: el frontmatter no es un objeto`,
  );
  return frontmatter;
}

// Réplica del ciclo parse → serialize → dump de Keystatic (ver cabecera).
// soporta: campos slug, arrays, objetos anidados (p. ej. `contact` de
// pages, que antes rompía el test) y campos asset (fields.image: parse y
// serialize reciben `extra` con el slug, y el cliente además escribe el
// binario en directory/<slug>/<fichero>).
// Default por tipo: los objetos/arrays no tienen defaultValue(); una clave
// de objeto ausente simplemente NO se escribe (visitor `object` de Keystatic).
function defaultValueOf(field) {
  if (field.kind === 'object') return undefined;
  if (field.kind === 'array') return [];
  return typeof field.defaultValue === 'function' ? field.defaultValue() : undefined;
}

function parseValue(field, raw, ctx) {
  if (field.kind === 'object') {
    if (raw === undefined || raw === null) return undefined;
    const out = {};
    for (const [key, child] of Object.entries(field.fields)) {
      if (child.kind === 'form' && child.formKind === 'content') continue;
      out[key] =
        raw !== undefined && key in raw
          ? parseValue(child, raw[key], { ...ctx, key })
          : defaultValueOf(child);
    }
    return out;
  }
  if (field.kind === 'array') {
    const items = Array.isArray(raw) ? raw : [];
    return items.map((item) => parseValue(field.element, item, ctx));
  }
  if (field.kind === 'form') {
    if (field.formKind === 'content') return raw;
    if (field.formKind === 'asset') {
      // El cliente real pide el binario a `directory/<slug>/<filename>`
      // (blob) antes de parsear; sin binario, el campo queda vacío.
      let asset;
      if (typeof raw === 'string' && raw !== '') {
        const rel = field.filename(raw, { suggestedFilenamePrefix: ctx.key, slug: ctx.slug });
        const abs = join(REPO_ROOT, IMAGE_DIRECTORY, ctx.slug, rel ?? '');
        if (rel && existsSync(abs)) asset = new Uint8Array(readFileSync(abs));
      }
      return field.parse(raw, { asset, slug: ctx.slug });
    }
    return raw !== undefined ? field.parse(raw) : field.defaultValue();
  }
  return raw !== undefined ? raw : field.defaultValue();
}

function serializeValue(field, value, ctx, assetWrites) {
  if (field.kind === 'object') {
    if (value === undefined || value === null) return undefined;
    const out = {};
    for (const [key, child] of Object.entries(field.fields)) {
      if (child.kind === 'form' && child.formKind === 'content') continue;
      const childValue = key in value ? value[key] : defaultValueOf(child);
      const serialized = serializeValue(child, childValue, { ...ctx, key }, assetWrites);
      if (serialized !== undefined) out[key] = serialized;
    }
    return out;
  }
  if (field.kind === 'array') {
    return (value ?? []).map((item) => serializeValue(field.element, item, ctx, assetWrites));
  }
  if (field.kind === 'form') {
    if (field.formKind === 'content') return undefined; // el cuerpo va aparte
    if (field.formKind === 'asset') {
      if (value === undefined || value === null) return undefined;
      const result = field.serialize(value, {
        suggestedFilenamePrefix: ctx.key,
        slug: ctx.slug,
      });
      if (result.asset) {
        assetWrites.push({
          path: join(IMAGE_DIRECTORY, ctx.slug, result.asset.filename),
          exists: existsSync(join(REPO_ROOT, IMAGE_DIRECTORY, ctx.slug, result.asset.filename)),
        });
      }
      return result.value;
    }
    return field.serialize(value).value;
  }
  return value;
}

function saveLikeKeystatic(collection, frontmatter, filenameSlug) {
  const schema = collection.schema;
  const slugKey = collection.slugField;
  const ctx = { slug: filenameSlug, key: undefined };
  const state = {};
  const assetWrites = [];

  for (const [key, field] of Object.entries(schema)) {
    if (field.kind === 'form' && field.formKind === 'content') continue; // cuerpo, aparte
    const present = key in frontmatter;
    if (key === slugKey) {
      state[key] = field.parse(present ? frontmatter[key] : undefined, { slug: filenameSlug });
    } else {
      state[key] = present
        ? parseValue(field, frontmatter[key], { ...ctx, key })
        : defaultValueOf(field);
    }
  }

  const data = {};
  for (const [key, field] of Object.entries(schema)) {
    if (field.kind === 'form' && field.formKind === 'content') continue;
    let value;
    if (key === slugKey) {
      value = field.serializeWithSlug(state[key]).value;
    } else {
      value = serializeValue(field, state[key], { ...ctx, key }, assetWrites);
    }
    // visitor `object`: las claves undefined NO se escriben en el YAML.
    if (value !== undefined) data[key] = value;
  }

  return { saved: YAML.load(YAML.dump(data)), assetWrites };
}

const iso = (value) => (value instanceof Date ? value.toISOString() : String(value));

function checkEntry(collectionName, file, filenameSlug) {
  const collection = config.collections[collectionName];
  const original = loadEntry(file);
  const { saved, assetWrites } = saveLikeKeystatic(collection, original, filenameSlug);
  const problems = [];

  for (const key of Object.keys(original)) {
    if (!(key in saved)) {
      problems.push(`la clave "${key}" desaparece al guardar`);
      continue;
    }
    if (key === collection.slugField) {
      // El slug canónico es el nombre de archivo (criterio del smoke T27).
      let decoded;
      try {
        decoded = decodeURIComponent(String(saved[key]));
      } catch {
        decoded = String(saved[key]);
      }
      if (decoded !== filenameSlug) {
        problems.push(`slug guardado "${saved[key]}" != nombre de archivo "${filenameSlug}"`);
      }
      continue;
    }
    if (saved[key] instanceof Date || original[key] instanceof Date) {
      if (iso(saved[key]) !== iso(original[key])) {
        problems.push(`fecha "${key}": original ${iso(original[key])}, tras guardar ${iso(saved[key])}`);
      }
      continue;
    }
    assert.deepEqual(saved[key], original[key], `${file}: valor de "${key}" alterado`);
  }

  // fields.image: el binario que reescribe/crea el cliente debe existir
  // en disco en su ruta canónica (si no, el editor no podría recargarlo).
  for (const write of assetWrites) {
    if (!write.exists) {
      problems.push(`el binario de imagen "${write.path}" no existe en disco`);
    }
  }

  return problems;
}

function checkCollection(collectionName) {
  const dir = join(REPO_ROOT, 'content', COLLECTION_DIRS[collectionName]);
  const files = readdirSync(dir).filter((name) => name.endsWith('.md')).sort();
  const failures = [];
  for (const name of files) {
    const filenameSlug = name.slice(0, -'.md'.length);
    const problems = checkEntry(collectionName, join(dir, name), filenameSlug);
    if (problems.length > 0) {
      failures.push(`${collectionName}/${name}: ${problems.join(' · ')}`);
    }
  }
  return { total: files.length, failures };
}

describe('Keystatic save contract — T1 (S4): guardar desde /admin no rompe la lectura de Astro', () => {
  for (const collectionName of Object.keys(COLLECTION_DIRS)) {
    it(`${collectionName}: conserva claves, valores y fecha tras el guardado`, () => {
      const { total, failures } = checkCollection(collectionName);
      assert.ok(total > 0, `${collectionName}: no hay entradas que comprobar`);
      assert.equal(
        failures.length,
        0,
        `${collectionName}: ${failures.length}/${total} entradas rompen el contrato de guardado.\n` +
          failures.slice(0, 10).map((line) => `  - ${line}`).join('\n'),
      );
    });
  }
});
