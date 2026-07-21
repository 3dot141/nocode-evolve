import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadDomainRegistry } from '../scripts/lib/domain-registry.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('handoff-state exists without automatic lifecycle hooks', () => {
  assert.equal(existsSync(path.join(ROOT, 'scripts/handoff-state.mjs')), true);
  const hooks = JSON.parse(readFileSync(path.join(ROOT, 'hooks/hooks.json'), 'utf8'));
  assert.equal(Object.hasOwn(hooks.hooks, 'Stop'), false);
  assert.doesNotMatch(JSON.stringify(hooks), /plan-change|handoff/i);
  const registry = loadDomainRegistry(ROOT);
  for (const capability of [
    'state.handoff.open', 'state.handoff.complete', 'state.handoff.abandon', 'state.handoff.status',
  ]) assert.equal(registry.capabilities.get(capability)?.internal, true, capability);
});
