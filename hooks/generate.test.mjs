import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadManifest, genTriggers } from './generate.mjs';

test('genTriggers: 复现 triggers.json 格式 [{rule, action, patterns, note}]', () => {
  const t = genTriggers(loadManifest());
  const fb = t.find((x) => x.rule === 'finishing-branch');
  assert.ok(fb, '应含 finishing-branch');
  assert.equal(fb.action, 'Read rules/rule-finishing-branch.md 并走 Gate TB/PR');
  assert.ok(fb.patterns.includes('提.*?PR'), 'patterns 应来自 manifest.triggers');
  assert.equal(fb.note, 'Bitbucket 用 bkt 不裸 curl; reviewer 用 bkt pr edit 不 PUT。');
});

test('genTriggers: 跳过无 triggers 的 rule', () => {
  const m = loadManifest();
  m.rules.push({ id: 'no-regex', bucket: 'review', trigger_type: 'behavior', triggers: [], action: 'x', read: 'y', summary: 'z' });
  const t = genTriggers(m);
  assert.ok(!t.find((x) => x.rule === 'no-regex'), '无 triggers 的 rule 不该进 triggers.json');
});
