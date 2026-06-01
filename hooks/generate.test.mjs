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

// 改造前 triggers.json 的原始 patterns 快照 (写死作回归基线, 防迁移丢/改 pattern)
const ORIGINAL_TRIGGERS = {
  'finishing-branch': ['提\\s*个?\\s*pr', '创建\\s*pr', '建\\s*个?\\s*pr', 'pull\\s*request', '提.*?PR', '合并到\\s*(release|main|master|主干)', '收尾', '完成\\s*worktree', '删\\s*(branch|分支)', 'discard\\s*worktree'],
  'push-summary': ['总结.{0,4}push', 'push.{0,6}(总结|包含|改了|是什么)', 'pr\\s*描述', 'pr\\s*description', '给.{0,4}(标题|描述)', '沉淀', '这次\\s*push'],
  'superpowers-brainstorming': ['设计文档', 'design\\s*doc', '\\bprd\\b', '\\brfc\\b', '\\badr\\b', '重构方案', '技术\\s*spec', '技术方案'],
  'git-worktree': ['(创建|建|新建|开|搞).{0,3}worktree', 'worktree.{0,3}(创建|新建)'],
  'codex-review': ['review\\s*一下', '帮我?\\s*审', '审一遍', '看.{0,6}(改动|代码|实现).{0,4}(问题|有没有|对不对)', 'codex\\s*review', 'adversarial'],
  'red-blue-deep': ['行不行', '值得吗', '合适吗', '该不该', '选.{0,10}还是', '哪个(更好|好|合适)', '红蓝军', '第一性原理'],
};

test('回归: genTriggers 的每条 rule patterns 与改造前 triggers.json 完全一致', () => {
  const t = genTriggers(loadManifest());
  for (const [rule, patterns] of Object.entries(ORIGINAL_TRIGGERS)) {
    const got = t.find((x) => x.rule === rule);
    assert.ok(got, `triggers 应含 ${rule}`);
    assert.deepEqual(got.patterns, patterns, `${rule} patterns 与改造前不一致 (迁移丢/改了 pattern)`);
  }
});

test('集合错位消除: catalog 集合 ⊇ triggers 集合; git-inspection 只在 catalog', () => {
  const m = loadManifest();
  const catalogIds = new Set(m.rules.map((r) => r.id));
  const triggerIds = new Set(genTriggers(m).map((x) => x.rule));
  assert.ok(catalogIds.has('git-inspection'), 'git-inspection 应在 catalog');
  assert.ok(!triggerIds.has('git-inspection'), 'git-inspection 无 regex, 不该在 triggers');
  assert.ok(catalogIds.has('red-blue-deep') && triggerIds.has('red-blue-deep'), 'red-blue-deep 两边都应有 (错位修复)');
  for (const id of triggerIds) assert.ok(catalogIds.has(id), `triggers 里的 ${id} 必须也在 catalog (单源保证)`);
});
