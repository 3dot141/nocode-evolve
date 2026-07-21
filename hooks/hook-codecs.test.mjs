import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decidePretool, matchRules } from './lib/pretool-decision.mjs';
import {
  detectPlatform,
  encodePretoolDecision,
  encodeSessionContext,
  encodeStopDecision,
} from './lib/hook-codecs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RULES = [
  { rule: 'warn', pattern: 'git\\s+push', decision: 'inject', reason: 'review first' },
  { rule: 'deny', pattern: 'danger', decision: 'block', reason: 'do not run' },
];

test('pretool domain decision is platform-neutral', () => {
  assert.deepEqual(decidePretool(matchRules('git push', RULES)), {
    effect: 'remind',
    reason: 'Command matched 1 nocode rule',
    context: '[PreToolUse 规则提醒] 你即将跑的命令命中真实绕过点, 动手前先确认:\n⚠️ [rule:warn] review first',
  });
  assert.deepEqual(decidePretool(matchRules('git push && danger', RULES)), {
    effect: 'deny',
    reason: '[rule:deny] do not run',
    context: '[rule:deny] do not run',
  });
  assert.equal(decidePretool([]), null);
});

test('detectPlatform prefers explicit override, then Codex PLUGIN_ROOT', () => {
  assert.equal(detectPlatform({ NOCODE_PLATFORM: 'claude', PLUGIN_ROOT: '/codex' }), 'claude');
  assert.equal(detectPlatform({ NOCODE_PLATFORM: 'codex' }), 'codex');
  assert.equal(detectPlatform({ PLUGIN_ROOT: '/plugin' }), 'codex');
  assert.equal(detectPlatform({ CLAUDE_PLUGIN_ROOT: '/plugin' }), 'claude');
});

test('Claude and Codex pretool codecs emit only supported fields', () => {
  const deny = decidePretool([RULES[1]]);
  assert.deepEqual(encodePretoolDecision(deny, 'claude'), {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: '[rule:deny] do not run',
    },
  });
  const codex = encodePretoolDecision(deny, 'codex');
  assert.deepEqual(Object.keys(codex), ['systemMessage']);
  assert.match(codex.systemMessage, /无法硬阻断|do not run/);
  assert.equal('continue' in codex, false);
  assert.equal('stopReason' in codex, false);
});

test('session and stop codecs expose the platform lifecycle difference', () => {
  assert.deepEqual(encodeSessionContext('context', 'claude'), {
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: 'context' },
  });
  assert.deepEqual(encodeSessionContext('context', 'codex'), { systemMessage: 'context' });
  const decision = { decision: 'block', reason: 'handoff pending' };
  assert.deepEqual(encodeStopDecision(decision, 'claude'), decision);
  assert.deepEqual(encodeStopDecision(decision, 'codex'), {
    continue: false, stopReason: 'handoff pending',
  });
});

test('session-context CLI encodes stdin using the selected platform', () => {
  const script = path.join(ROOT, 'hooks', 'session-context.mjs');
  const result = spawnSync(process.execPath, [script], {
    input: 'hello',
    encoding: 'utf8',
    env: { ...process.env, NOCODE_PLATFORM: 'codex' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { systemMessage: 'hello' });
});
