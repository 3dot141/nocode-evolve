import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadManifest, genTriggers, genCatalog, genPretooluse, renderAll, check } from './generate.mjs';

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

test('genCatalog: 按粗桶分组, 含桶触发 + 负例 + 子规则三件套', () => {
  const md = genCatalog(loadManifest());
  assert.match(md, /禁手改/, '应有"生成物禁手改"提示');
  assert.match(md, /### 桶: Git 生命周期 \(git-lifecycle\)/);
  assert.match(md, /\*\*粗触发\*\*:/);
  assert.match(md, /\*\*不含 \(负例\)\*\*:/);
  assert.match(md, /#### finishing-branch/);
  assert.match(md, /\*\*读\*\*: `\$\{CLAUDE_PLUGIN_ROOT\}\/rules\/rule-finishing-branch\.md`/);
  assert.match(md, /\*\*关键约束\(上浮\)\*\*: Bitbucket 用 bkt/, '有 guard 的 rule 应上浮 guard');
});

test('genCatalog: 跨桶 rule 标注 also_buckets', () => {
  const md = genCatalog(loadManifest());
  assert.match(md, /#### push-summary[\s\S]*?\*\*也属\*\*: git-lifecycle/);
});

test('genPretooluse: 扁平化所有 rule 的 pretooluse 靶', () => {
  const p = genPretooluse(loadManifest());
  const block = p.find((x) => x.decision === 'block' && /PUT/.test(x.pattern));
  assert.ok(block, '应含 bkt PUT 的 block 靶');
  assert.equal(block.rule, 'finishing-branch');
  assert.ok(p.some((x) => x.decision === 'inject'), '应含 inject 靶');
});

test('check: 生成物与源一致时返回 []', () => {
  renderAll(true);
  assert.deepEqual(check(), []);
});
