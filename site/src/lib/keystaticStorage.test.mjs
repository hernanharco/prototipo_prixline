// site/src/lib/keystaticStorage.test.mjs — T6 (spec S5 de odd/tasks/prixline-admin-auth.md)
// Selección del storage de Keystatic: github en prod (flag público) vs local en dev.
// Run: node --test site/src/lib/keystaticStorage.test.mjs
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { KEYSTATIC_REPO, selectKeystaticStorage } from './keystaticStorage.ts';

describe('selectKeystaticStorage — prod github vs dev local (T6)', () => {
  it('usa github cuando PUBLIC_KEYSTATIC_STORAGE=github', () => {
    assert.deepEqual(
      selectKeystaticStorage({ PUBLIC_KEYSTATIC_STORAGE: 'github' }),
      { kind: 'github', repo: KEYSTATIC_REPO },
    );
  });

  it('usa local sin el flag (dev sin env, T7 y el smoke de git diff)', () => {
    assert.deepEqual(selectKeystaticStorage({}), { kind: 'local' });
    // Node puro (smoke reader, tests): import.meta.env no existe → undefined
    assert.deepEqual(selectKeystaticStorage(undefined), { kind: 'local' });
    assert.deepEqual(
      selectKeystaticStorage({ PUBLIC_KEYSTATIC_STORAGE: 'local' }),
      { kind: 'local' },
    );
    assert.deepEqual(
      selectKeystaticStorage({ PUBLIC_KEYSTATIC_STORAGE: '' }),
      { kind: 'local' },
    );
  });

  it('el repo apunta al remoto real del proyecto', () => {
    assert.equal(KEYSTATIC_REPO, 'hernanharco/prototipo_prixline');
  });

  it('rechaza valores desconocidos del flag (fail-closed a local)', () => {
    for (const value of ['true', '1', 'GitHub', 'gh']) {
      assert.deepEqual(selectKeystaticStorage({ PUBLIC_KEYSTATIC_STORAGE: value }), { kind: 'local' });
    }
  });
});
