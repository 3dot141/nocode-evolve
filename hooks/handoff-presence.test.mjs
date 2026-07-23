import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('handoff-state exists without automatic lifecycle hooks', () => {
  assert.equal(existsSync(path.join(ROOT, 'scripts/handoff-state.mjs')), true);
  const hooks = JSON.parse(readFileSync(path.join(ROOT, 'hooks/hooks.json'), 'utf8'));
  assert.equal(Object.hasOwn(hooks.hooks, 'Stop'), false);
  assert.doesNotMatch(JSON.stringify(hooks), /plan-change|handoff/i);
  assert.equal(existsSync(path.join(ROOT, 'scripts/workflow-state.mjs')), false);
  assert.equal(existsSync(path.join(ROOT, 'core/domains')), false);
});
