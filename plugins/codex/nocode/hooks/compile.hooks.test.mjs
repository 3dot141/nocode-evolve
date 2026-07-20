import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RULES, render, check } from '../scripts/compile.hooks.js';

test('RULES: 每条规则字段齐全, pattern 是合法正则', () => {
  assert.ok(RULES.length >= 6);
  for (const r of RULES) {
    assert.ok(r.rule, 'rule 字段不能为空');
    assert.ok(r.pattern, 'pattern 字段不能为空');
    assert.ok(['block', 'inject'].includes(r.decision), `decision 只能是 block/inject: ${r.rule}`);
    assert.ok(r.reason, 'reason 字段不能为空');
    assert.doesNotThrow(() => new RegExp(r.pattern, 'i'), `pattern 应是合法正则: ${r.pattern}`);
  }
});

test('render: 输出合法 JSON, 字段结构匹配 pretooluse-guard.mjs 期望', () => {
  const json = JSON.parse(render());
  assert.ok(Array.isArray(json));
  assert.ok(json.length > 0);
  for (const item of json) {
    assert.deepEqual(Object.keys(item).sort(), ['decision', 'pattern', 'reason', 'rule']);
  }
});

test('render: 幂等——连续两次调用结果一致', () => {
  assert.equal(render(), render());
});

test('check: 生成物与源一致时返回 []', () => {
  assert.deepEqual(check(), []);
});

test('integration: RULES 能被 pretooluse-guard.mjs 的 matchRules 正确匹配', async () => {
  const { matchRules } = await import('../hooks/pretooluse-guard.mjs');
  const worktreeHits = matchRules('git worktree add ../foo -b feature/x', RULES);
  assert.ok(worktreeHits.some((h) => h.rule === 'git-worktree'));

  const rgHits = matchRules('rg TODO src/', RULES);
  assert.ok(rgHits.some((h) => h.rule === 'git-freshness'));

  const rmHits = matchRules('rm -rf .agents-personal/wiki/', RULES);
  assert.ok(rmHits.some((h) => h.rule === 'personal-deletion-guard'));
});
