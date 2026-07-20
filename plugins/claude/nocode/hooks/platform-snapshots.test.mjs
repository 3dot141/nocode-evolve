import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLAUDE_ROOT = path.join(ROOT, 'plugins', 'claude', 'nocode');
const FIXTURE = path.join(ROOT, 'hooks', 'fixtures', 'platform', 'claude', 'representative.json');

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

test('Claude representative runtime files match the approved snapshot', () => {
  const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  assert.equal(fixture.schemaVersion, 1);
  for (const [relative, expected] of Object.entries(fixture.files)) {
    assert.equal(sha256(path.join(CLAUDE_ROOT, relative)), expected, relative);
  }
});

test('Claude generated hooks retain all lifecycle boundaries', () => {
  const hooks = JSON.parse(readFileSync(path.join(CLAUDE_ROOT, 'hooks/hooks.json'), 'utf8'));
  assert.deepEqual(Object.keys(hooks.hooks), [
    'SessionStart',
    'PreToolUse',
    'PostToolUse',
    'Stop',
  ]);
  assert.match(JSON.stringify(hooks.hooks.PreToolUse), /pretooluse-guard\.mjs/);
  assert.match(JSON.stringify(hooks.hooks.Stop), /handoff-stop-guard\.mjs/);
});
