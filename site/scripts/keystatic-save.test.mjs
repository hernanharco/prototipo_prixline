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
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import YAML from 'js-yaml';

import config from '../keystatic.config.ts';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const COLLECTION_DIRS = { posts: 'posts', courses: 'courses', pages: 'pages' };

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
function saveLikeKeystatic(collection, frontmatter, filenameSlug) {
  const schema = collection.schema;
  const slugKey = collection.slugField;
  const state = {};

  for (const [key, field] of Object.entries(schema)) {
    if (field.kind === 'form' && field.formKind === 'content') continue; // cuerpo, aparte
    const present = key in frontmatter;
    if (key === slugKey) {
      state[key] = field.parse(present ? frontmatter[key] : undefined, { slug: filenameSlug });
    } else if (field.kind === 'array') {
      const value = present ? frontmatter[key] : [];
      state[key] = (Array.isArray(value) ? value : []).map((item) => field.element.parse(item));
    } else if (field.kind === 'form') {
      state[key] = present ? field.parse(frontmatter[key]) : field.defaultValue();
    } else {
      state[key] = present ? frontmatter[key] : field.defaultValue();
    }
  }

  const data = {};
  for (const [key, field] of Object.entries(schema)) {
    if (field.kind === 'form' && field.formKind === 'content') continue;
    let value;
    if (key === slugKey) {
      value = field.serializeWithSlug(state[key]).value;
    } else if (field.kind === 'array') {
      value = state[key].map((item) => field.element.serialize(item).value);
    } else {
      value = field.serialize(state[key]).value;
    }
    // visitor `object`: las claves undefined NO se escriben en el YAML.
    if (value !== undefined) data[key] = value;
  }

  return YAML.load(YAML.dump(data));
}

const iso = (value) => (value instanceof Date ? value.toISOString() : String(value));

function checkEntry(collectionName, file, filenameSlug) {
  const collection = config.collections[collectionName];
  const original = loadEntry(file);
  const saved = saveLikeKeystatic(collection, original, filenameSlug);
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
