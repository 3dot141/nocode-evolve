import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadManifest, genCatalog, genPretooluse, check, patchGeneratedRegion, genCatalogSlim, genRouteTable, renderAll } from './generate.mjs';

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

test('genCatalog: also_buckets 可路由 (跨桶 rule 在目标桶可发现, Codex review)', () => {
  const md = genCatalog(loadManifest());
  // codex-review also_buckets=[design], 应在 design 桶 section 出现
  const designIdx = md.indexOf('### 桶: 设计与文档');
  // 取 design 桶到下一个 ### 桶 之间
  const afterDesign = md.slice(designIdx);
  const nextBucket = afterDesign.indexOf('\n### 桶:', 1);
  const designBlock = nextBucket > 0 ? afterDesign.slice(0, nextBucket) : afterDesign;
  assert.match(designBlock, /#### codex-review \(跨桶\)/, 'codex-review 应在 design 桶可发现');

  // push-summary also_buckets=[git-lifecycle], 应在 git-lifecycle 桶出现
  const glIdx = md.indexOf('### 桶: Git 生命周期');
  const afterGl = md.slice(glIdx);
  const nextGl = afterGl.indexOf('\n### 桶:', 1);
  const glBlock = nextGl > 0 ? afterGl.slice(0, nextGl) : afterGl;
  assert.match(glBlock, /#### push-summary \(跨桶\)/, 'push-summary 应在 git-lifecycle 桶可发现');
});

test('genPretooluse: 扁平化所有 rule 的 pretooluse 靶', () => {
  const p = genPretooluse(loadManifest());
  const block = p.find((x) => x.decision === 'block' && /PUT/.test(x.pattern));
  assert.ok(block, '应含 bkt PUT 的 block 靶');
  assert.equal(block.rule, 'finishing-branch');
  assert.ok(p.some((x) => x.decision === 'inject'), '应含 inject 靶');
});

test('check: 生成物与源一致时返回 [] (不写文件, 直接断言, Codex review)', () => {
  // 不调 renderAll: 直接验证当前磁盘生成物与 manifest 一致;
  // 若 stale 该 test 失败提示重新生成 (而非静默修复)
  assert.deepEqual(check(), []);
});

test('genCatalog: 4 桶全部填充 (无空桶)', () => {
  const m = loadManifest();
  const md = genCatalog(m);
  for (const b of m.buckets) {
    assert.match(md, new RegExp(`### 桶: ${b.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), `桶 ${b.id} 应在 catalog 出现`);
  }
});

test('genCatalog: 含二级分类指引 (命中桶后如何选具体 rule)', () => {
  const md = genCatalog(loadManifest());
  assert.match(md, /先命中桶.*再在桶内子规则/, '应有桶→子规则二级分类指引');
});

test('patchGeneratedRegion 只替换 marker 区间，手写区保留', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const f = path.join(dir, 'SKILL.md');
  fs.writeFileSync(f,
    '手写头\n<!-- BEGIN generated: rule-routes (from manifest, 禁手改) -->\nOLD\n<!-- END generated: rule-routes -->\n手写尾\n');
  const out = patchGeneratedRegion(f, 'rule-routes', 'NEW BODY');
  assert.match(out, /手写头/);
  assert.match(out, /手写尾/);
  assert.match(out, /NEW BODY/);
  assert.doesNotMatch(out, /OLD/);
});

test('patchGeneratedRegion marker 缺失则抛错（不整文件覆盖）', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const f = path.join(dir, 'SKILL.md');
  fs.writeFileSync(f, '没有 marker 的文件\n');
  assert.throws(() => patchGeneratedRegion(f, 'rule-routes', 'X'), /缺 marker/);
});

test('patchGeneratedRegion 文件不存在则抛错', () => {
  assert.throws(() => patchGeneratedRegion('/nonexistent/SKILL.md', 'rule-routes', 'X'), /不存在/);
});

test('genCatalogSlim 含 4 粗桶 + 调 route，不含单 rule 细节', () => {
  const m = loadManifest();
  const out = genCatalogSlim(m);
  for (const b of m.buckets) assert.ok(out.includes(b.title), `缺桶 ${b.title}`);
  assert.match(out, /Skill\(nocode-evolve:route\)/);
  // 不含单条 rule 的「读」路径（那是 route 正文的事）
  assert.doesNotMatch(out, /rules\/rule-finishing-branch\.md/);
});

test('genRouteTable 含每条 rule 的触发/读/摘要', () => {
  const m = loadManifest();
  const out = genRouteTable(m);
  for (const r of m.rules) {
    assert.ok(out.includes(r.id), `缺 rule ${r.id}`);
  }
  assert.match(out, /\*\*触发\*\*/);
  assert.match(out, /\*\*读\*\*/);
});

test('targets 不再含 triggers.json', () => {
  // renderAll(false) 返回 targets 数组（{file,text}），不写盘
  const t = renderAll(false);
  assert.ok(!t.some((x) => x.file.endsWith('triggers.json')), 'triggers.json 不该在 targets');
  assert.ok(t.some((x) => x.file.endsWith('agent-catalog.md')), 'catalog 应在 targets');
  assert.ok(t.some((x) => x.file.endsWith('pretooluse-rules.json')), 'pretooluse 应在 targets');
});

test('catalog target 用 slim 内容', () => {
  const t = renderAll(false);
  const cat = t.find((x) => x.file.endsWith('agent-catalog.md'));
  assert.match(cat.text, /Skill\(nocode-evolve:route\)/);
});
