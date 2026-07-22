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

test('source hooks restore every prior lifecycle registration', () => {
  const hooks = JSON.parse(readFileSync(path.join(ROOT, 'hooks/hooks.json'), 'utf8'));
  assert.deepEqual(Object.keys(hooks.hooks), ['SessionStart', 'PreToolUse', 'PostToolUse']);
  assert.equal(hooks.hooks.SessionStart[0].hooks.length, 11);
  assert.equal(hooks.hooks.PreToolUse.length, 2);
  assert.equal(hooks.hooks.PostToolUse.length, 1);
  assert.match(JSON.stringify(hooks), /continuous-learning-v2\/hooks\/observe\.sh/);
  assert.doesNotMatch(JSON.stringify(hooks), /model-nocode/);
});

test('Claude generated hooks retain the active lifecycle registrations', () => {
  const hooks = JSON.parse(readFileSync(path.join(CLAUDE_ROOT, 'hooks/hooks.json'), 'utf8'));
  assert.deepEqual(Object.keys(hooks.hooks), ['SessionStart', 'PreToolUse', 'PostToolUse']);
  const commands = hooks.hooks.SessionStart[0].hooks.map((hook) => hook.command);
  assert.ok(commands.some((command) => /session-open\.mjs/.test(command)));
  assert.ok(commands.some((command) => /inject-nocode\.sh" model-about(?: \d+)?$/.test(command)));
  assert.ok(commands.some((command) => /inject-nocode\.sh" model-rule-catalog-5(?: \d+)?$/.test(command)));
  assert.ok(commands.some((command) => /inject-nocode\.sh" project$/.test(command)));
  assert.ok(commands.some((command) => /personal-snapshot\.mjs/.test(command)));
  assert.doesNotMatch(JSON.stringify(hooks), /model-nocode/);
});
