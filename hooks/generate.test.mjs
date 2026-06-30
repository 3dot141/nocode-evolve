import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadManifest, genPretooluse, genCatalogSharded, renderBucketBody, check, renderAll, SHARD_LIMIT } from './generate.mjs';

test('genCatalogSharded: 当前 manifest 分片 — 每片在阈值内, 文件名按序号', () => {
  const shards = genCatalogSharded(loadManifest());
  assert.ok(shards.length >= 1);
  shards.forEach((s, i) => {
    assert.equal(path.basename(s.file), `agent-catalog-${i + 1}.md`);
    assert.ok(s.text.length < SHARD_LIMIT, `片 ${i + 1} 应在阈值内 (桶过大需拆桶)`);
  });
});

test('genCatalogSharded: 首片含头部指令, 分片合集含 4 桶 + 每条 rule + 触发/读', () => {
  const m = loadManifest();
  const shards = genCatalogSharded(m);
  const [first] = shards;
  assert.match(first.text, /禁手改/);
  assert.match(first.text, /触发协议/, '应有触发协议 / Step 0 扫桶硬指令段');
  assert.match(first.text, /Step 0/, '应有 Step 0 扫桶硬指令');
  assert.match(first.text, /\/devflow/, '应提示 devflow 入口');
  const full = shards.map((s) => s.text).join('\n');
  for (const b of m.buckets) {
    assert.match(full, new RegExp(`### 桶: ${b.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  }
  for (const r of m.rules) {
    assert.ok(full.includes(r.id), `缺 rule ${r.id}`);
  }
  assert.match(full, /\*\*触发\*\*/);
  assert.match(full, /\*\*读\*\*/);
});

test('genCatalogSharded: 构造超长 manifest 切多片, 桶不被切断 (在 MAX 内)', () => {
  // 构造 2-3 片 (≤ MAX_CATALOG_SHARDS=3); 超 MAX 的 throw 行为见末尾独立 test
  const big = 'x'.repeat(5500);
  const subset = Array.from({ length: 3 }, (_, i) => ({
    id: `b${i}`,
    title: `B${i}`,
    trigger_summary: 't',
    negatives: ['n'],
  }));
  const m = {
    buckets: subset,
    rules: subset.map((b, i) => ({
      id: `r${i}`,
      bucket: b.id,
      trigger_type: 'regex',
      trigger_desc: 'x'.repeat(200),
      triggers: [],
      action: '',
      read: 'rules/rule-test.md',
      summary: big,
      guard: '',
      pretooluse: [],
      also_buckets: [],
    })),
  };
  const shards = genCatalogSharded(m);
  assert.ok(shards.length >= 2, '超长应切多片 (≤ MAX_CATALOG_SHARDS)');
  for (let i = 1; i < shards.length; i++) {
    assert.match(shards[i].text, /续片/, `第 ${i + 1} 片应有续片头`);
  }
  // 桶为切分粒度: 每片内的 ### 桶: 是完整的(没被截断到下一片)
  const full = shards.map((s) => s.text).join('');
  for (const b of subset) {
    assert.ok(full.includes(`### 桶: ${b.title}`), `桶 ${b.id} 应在分片合集中`);
  }
});

test('genCatalogSharded: 跨桶 rule (also_buckets) 在目标桶可发现', () => {
  const m = loadManifest();
  const full = genCatalogSharded(m).map((s) => s.text).join('\n');
  // push-summary also_buckets=git-lifecycle → 应在 git-lifecycle 桶以(跨桶)出现
  assert.match(full, /#### push-summary \(跨桶\)/);
  // codex-review also_buckets=design → 应在 design 桶以(跨桶)出现
  assert.match(full, /#### codex-review \(跨桶\)/);
});

test('genCatalogSharded: 有 guard 的 rule 上浮 guard 行', () => {
  const m = loadManifest();
  const full = genCatalogSharded(m).map((s) => s.text).join('\n');
  assert.match(full, /\*\*关键约束\(上浮\)\*\*: Bitbucket 用 bkt/, 'finishing-branch guard 应上浮');
});

test('renderBucketBody: 复用同一渲染逻辑', () => {
  const m = loadManifest();
  const body = renderBucketBody(m);
  // body 不含头部, 但所有桶/rule 应在
  for (const r of m.rules) assert.ok(body.includes(r.id));
});

test('renderBucketBody: skill 类条目 (read 为空) 不输出摘要行', () => {
  const m = {
    buckets: [{ id: 'b1', title: 'B1', trigger_summary: 't', negatives: ['n'] }],
    rules: [
      { id: 'rule-with-file', bucket: 'b1', trigger_type: 'regex', trigger_desc: 'td', triggers: [], action: '', read: 'rules/rule-x.md', summary: 'RULE_SUMMARY', guard: '', pretooluse: [], also_buckets: [] },
      { id: 'skill-no-file', bucket: 'b1', trigger_type: 'skill', trigger_desc: 'td', triggers: [], action: '', read: '', summary: 'SKILL_SUMMARY', guard: '', pretooluse: [], also_buckets: [] },
      { id: 'skill-marker', bucket: 'b1', trigger_type: 'skill', trigger_desc: 'td', triggers: [], action: '', read: '(skill, 无 rule 文件)', summary: 'MARKER_SUMMARY', guard: '', pretooluse: [], also_buckets: [] },
    ],
  };
  const body = renderBucketBody(m);
  assert.ok(body.includes('RULE_SUMMARY'), 'rule 类条目应有摘要');
  assert.ok(!body.includes('SKILL_SUMMARY'), 'skill 类条目 (read="") 不应有摘要');
  assert.ok(!body.includes('MARKER_SUMMARY'), 'skill 类条目 (read="(...)") 不应有摘要');
});

test('genPretooluse: 扁平化 pretooluse 靶 (不变)', () => {
  const p = genPretooluse(loadManifest());
  const block = p.find((x) => x.decision === 'block' && /PUT/.test(x.pattern));
  assert.ok(block, '应含 bkt PUT 的 block 靶');
  assert.equal(block.rule, 'dev-finish-branch');
  assert.ok(p.some((x) => x.decision === 'inject'), '应含 inject 靶');
});

test('targets: 含 catalog 分片 + pretooluse, 不含 route 区/triggers/旧 catalog.md', () => {
  const t = renderAll(false);
  assert.ok(t.some((x) => x.file.endsWith('agent-catalog-1.md')), 'catalog-1 应在 targets');
  assert.ok(t.some((x) => x.file.endsWith('pretooluse-rules.json')), 'pretooluse 应在 targets');
  assert.ok(!t.some((x) => x.file.endsWith('triggers.json')), 'triggers.json 应不在');
  assert.ok(!t.some((x) => /skills[\\/]route[\\/]SKILL\.md/.test(x.file)), 'route 应不在');
  assert.ok(!t.some((x) => /[\\/]agent-catalog\.md$/.test(x.file)), '旧 agent-catalog.md (无 N) 应不在');
});

test('check: 生成物与源一致时返回 []', () => {
  assert.deepEqual(check(), []);
});

test('genCatalogSharded: 超 MAX_CATALOG_SHARDS 时 throw (防静默漏注入)', async () => {
  const { MAX_CATALOG_SHARDS } = await import('./generate.mjs');
  // 构造 7 桶 × 单桶 5500 字符 → 每片基本只能放 1 桶 → 7 片 > MAX
  const m = {
    buckets: Array.from({ length: 7 }, (_, i) => ({
      id: `b${i}`,
      title: `B${i}`,
      trigger_summary: 't',
      negatives: ['n'],
    })),
    rules: Array.from({ length: 7 }, (_, i) => ({
      id: `r${i}`,
      bucket: `b${i}`,
      trigger_type: 'regex',
      trigger_desc: 'x'.repeat(200),
      triggers: [],
      action: '',
      read: 'rules/rule-test.md',
      summary: 'x'.repeat(5500),
      guard: '',
      pretooluse: [],
      also_buckets: [],
    })),
  };
  assert.throws(() => genCatalogSharded(m), {
    message: new RegExp(`> MAX_CATALOG_SHARDS=${MAX_CATALOG_SHARDS}`),
  });
});
