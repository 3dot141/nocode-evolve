import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import {
  ContextBudgetError, loadContextBudget, renderDynamicContext, splitStaticContext, utf8Bytes,
} from '../scripts/lib/context-budget.mjs';
import { contextSegmentPlan } from '../scripts/lib/platform-packager.mjs';

test('UTF-8 byte upper bound and deterministic static splitting stay within budget', () => {
  assert.equal(utf8Bytes('中a'), 4);
  const chunks = splitStaticContext('one\ntwo\nthree\n', { safeBytes: 8 }, 'model/test.md');
  assert.deepEqual(chunks, ['one\ntwo', 'three']);
  assert.ok(chunks.every((chunk) => utf8Bytes(chunk) <= 8));
  assert.deepEqual(splitStaticContext('one\ntwo\nthree\n', { safeBytes: 8 }, 'model/test.md'), chunks);
});

test('unsplittable static source fails with source attribution', () => {
  assert.throws(() => splitStaticContext('123456789', { safeBytes: 8 }, 'model/huge.md'),
    (error) => error instanceof ContextBudgetError
      && error.code === 'CONTEXT_SEGMENT_TOO_LARGE'
      && error.source === 'model/huge.md');
});

test('oversize dynamic context is omitted with an explicit source error', () => {
  assert.equal(renderDynamicContext('123456789', { safeBytes: 8 }, 'project/AGENTS.md'),
    'CONTEXT_SEGMENT_TOO_LARGE: omitted project/AGENTS.md; 9 bytes exceeds 8');
});

test('Codex delegates oversized dynamic context to its native spill mechanism', () => {
  const content = 'x'.repeat(2654);
  assert.equal(renderDynamicContext(content, {
    safeBytes: 2000,
    dynamicOverflow: 'passthrough',
  }, 'project/AGENTS.md'), content);
});

test('platform budgets record the Claude release policy and Codex documented limit', () => {
  const claude = loadContextBudget('platform/claude/runtime/context-budget.json');
  const codex = loadContextBudget('platform/codex/runtime/context-budget.json');
  const deepseek = loadContextBudget('platform/deepseek/runtime/context-budget.json');
  assert.equal(claude.safeBytes, 8000);
  assert.equal(claude.policy, 'nocode release injection budget');
  assert.equal(codex.safeBytes, 2000);
  assert.equal(codex.documentedApproximateTokenLimit, 2500);
  assert.equal(codex.dynamicOverflow, 'passthrough');
  assert.equal(deepseek.safeBytes, 8000);
  assert.equal(deepseek.policy, 'nocode release injection budget for DeepSeek Harness');
});

test('generated SessionStart hooks load their colocated platform budget', () => {
  for (const platform of ['claude', 'codex']) {
    const script = path.resolve(`plugins/${platform}/nocode/hooks/session-context.mjs`);
    const result = spawnSync(process.execPath, [script], {
      input: 'generated context', encoding: 'utf8',
      env: { ...process.env, NOCODE_PLATFORM: platform },
    });
    assert.equal(result.status, 0, `${platform}: ${result.stderr}`);
    assert.match(result.stdout, /generated context/);
  }
});

test('generated Codex project injection preserves a 2654-byte AGENTS file', (t) => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), 'nocode-project-context-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  const personal = path.join(workspace, '.agents-personal');
  mkdirSync(personal, { recursive: true });
  const content = `PROJECT_CONTEXT_START\n${'x'.repeat(2600)}\nPROJECT_CONTEXT_END`;
  writeFileSync(path.join(personal, 'AGENTS.md'), content);

  const pluginRoot = path.resolve('plugins/codex/nocode');
  const result = spawnSync('bash', [path.join(pluginRoot, 'hooks/inject-nocode.sh'), 'project'], {
    cwd: workspace,
    input: JSON.stringify({ cwd: workspace }),
    encoding: 'utf8',
    env: { ...process.env, NOCODE_PLATFORM: 'codex', PLUGIN_ROOT: pluginRoot },
  });

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout).systemMessage;
  assert.match(output, /PROJECT_CONTEXT_START/);
  assert.match(output, /PROJECT_CONTEXT_END/);
  assert.doesNotMatch(output, /CONTEXT_SEGMENT_TOO_LARGE|omitted/);
});

test('packager attributes an unsplittable static segment by segment and source path', (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'nocode-context-plan-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'platform/codex/runtime'), { recursive: true });
  mkdirSync(path.join(root, 'model'), { recursive: true });
  writeFileSync(path.join(root, 'platform/codex/runtime/context-budget.json'),
    JSON.stringify({ safeBytes: 300 }));
  writeFileSync(path.join(root, 'model/agent-about.md'), 'x'.repeat(50));
  assert.throws(() => contextSegmentPlan(root, 'codex'), (error) =>
    error.code === 'CONTEXT_SEGMENT_TOO_LARGE'
      && error.source === 'model-about (model/agent-about.md)');
});
