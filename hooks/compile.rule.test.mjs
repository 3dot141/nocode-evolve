import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  parseFrontmatter,
  loadRules,
  genCatalogSharded,
  renderAll,
  check,
  SHARD_LIMIT,
  MAX_CATALOG_SHARDS,
} from '../scripts/compile.rule.js';

test('parseFrontmatter: 解析 name/description(折叠标量)/skip', () => {
  const text = `---
name: foo
description: >-
  第一行
  第二行
skip: true
---

# 正文
`;
  const data = parseFrontmatter(text);
  assert.equal(data.name, 'foo');
  assert.equal(data.description, '第一行 第二行');
  assert.equal(data.skip, true);
});

test('parseFrontmatter: 无 frontmatter 返回 null', () => {
  assert.equal(parseFrontmatter('# no frontmatter\n'), null);
});

test('loadRules: 当前仓库全部 rule-*.md 都能解析出 name/description, 文件名与 name 一致', () => {
  const rules = loadRules();
  assert.ok(rules.length >= 6, '当前仓库应至少有 6 条 rule');
  for (const r of rules) {
    assert.ok(r.id, `rule 缺 id: ${r.relPath}`);
    assert.ok(r.description, `rule 缺 description: ${r.relPath}`);
    assert.equal(r.relPath, `rules/rule-${r.id}.md`, 'name 应与文件名 slug 一致');
  }
});

test('genCatalogSharded: 当前规则集在阈值内, 文件名按序号, 表格结构正确', () => {
  const rules = loadRules();
  const shards = genCatalogSharded(rules);
  assert.ok(shards.length >= 1);
  shards.forEach((s, i) => {
    assert.equal(path.basename(s.file), `agent-rule-catalog-${i + 1}.md`);
    assert.ok(s.text.length < SHARD_LIMIT, `片 ${i + 1} 应在阈值内`);
    assert.match(s.text, new RegExp(`^# agent-rule-catalog-${i + 1}\\n`));
    assert.match(s.text, /> 当前章节为 规则目录/);
    assert.match(s.text, new RegExp(`> 当前是第 ${i + 1} 页`));
    assert.match(s.text, /相对于 \{CLAUDE_PLUGIN_ROOT\}/);
    assert.match(s.text, /\| 文件相对地址 \| 描述 \|/);
  });
});

test('genCatalogSharded: Codex 发布物使用 PLUGIN_ROOT 占位符', () => {
  const rules = [{ id: 'foo', description: '触发条件 X。', skip: false, relPath: 'rules/rule-foo.md' }];
  const text = genCatalogSharded(rules, 'codex')[0].text;
  assert.match(text, /相对于 \{PLUGIN_ROOT\}/);
  assert.doesNotMatch(text, /\{CLAUDE_PLUGIN_ROOT\}/);
});

test('genCatalogSharded: skip:true 的规则不渲染进任何分片', () => {
  const rules = [
    { id: 'a', description: 'DESC_A', skip: false, relPath: 'rules/rule-a.md' },
    { id: 'b', description: 'DESC_B', skip: true, relPath: 'rules/rule-b.md' },
  ];
  const full = genCatalogSharded(rules)
    .map((s) => s.text)
    .join('\n');
  assert.match(full, /rules\/rule-a\.md/);
  assert.ok(!full.includes('rules/rule-b.md'), 'skip:true 规则不应出现');
});

test('genCatalogSharded: 每条规则渲染成一行表格, 含相对路径与 description', () => {
  const rules = [{ id: 'foo', description: '触发条件 X。不触发 Y。', skip: false, relPath: 'rules/rule-foo.md' }];
  const text = genCatalogSharded(rules)[0].text;
  assert.match(text, /\| rules\/rule-foo\.md \| 触发条件 X。不触发 Y。 \|/);
});

test('genCatalogSharded: description 里的 | 和换行被转义/折叠, 不破坏表格行数', () => {
  const rules = [{ id: 'foo', description: 'a | b\nc', skip: false, relPath: 'rules/rule-foo.md' }];
  const text = genCatalogSharded(rules)[0].text;
  const rows = text.split('\n').filter((l) => l.startsWith('| rules/'));
  assert.equal(rows.length, 1, '一条规则应只产出一行表格, 不因内嵌换行/管道符裂成多行');
  assert.match(rows[0], /a \\\| b c/);
});

test('genCatalogSharded: 超长规则集切多片 (在 MAX 内), 单条规则不被截断', () => {
  const big = 'x'.repeat(8000);
  const rules = Array.from({ length: 3 }, (_, i) => ({
    id: `r${i}`,
    description: big,
    skip: false,
    relPath: `rules/rule-r${i}.md`,
  }));
  const shards = genCatalogSharded(rules);
  assert.ok(shards.length >= 2, '超长应切多片');
  for (const s of shards) {
    assert.match(s.text, /x{8000}/, '每片应含完整未截断的规则行');
  }
});

test('genCatalogSharded: 超 MAX_CATALOG_SHARDS 时 throw (防静默漏注入)', () => {
  const big = 'x'.repeat(8500);
  const rules = Array.from({ length: 7 }, (_, i) => ({
    id: `r${i}`,
    description: big,
    skip: false,
    relPath: `rules/rule-r${i}.md`,
  }));
  assert.throws(() => genCatalogSharded(rules), {
    message: new RegExp(`> MAX_CATALOG_SHARDS=${MAX_CATALOG_SHARDS}`),
  });
});

test('check: 生成物与源一致时返回 []', () => {
  assert.deepEqual(check(), []);
});

test('renderAll(false): 不写文件, 返回当前 targets', () => {
  const shards = renderAll(false);
  assert.ok(shards.some((s) => s.file.endsWith('agent-rule-catalog-1.md')));
});
