import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadManifest, genPretooluse, genWorkflowSkills, genCatalogSharded, renderBucketBody, check, renderAll, SHARD_LIMIT } from './generate.mjs';

test('genCatalogSharded: 当前 manifest 分片 — 每片在阈值内, 文件名按序号', () => {
  const shards = genCatalogSharded(loadManifest());
  assert.ok(shards.length >= 1);
  shards.forEach((s, i) => {
    assert.equal(path.basename(s.file), `agent-catalog-${i + 1}.md`);
    assert.ok(s.text.length < SHARD_LIMIT, `片 ${i + 1} 应在阈值内 (桶过大需拆桶)`);
  });
});

test('genCatalogSharded: 首片含头部指令, 分片合集含各非空桶 + 每条非 skip_catalog rule 的一行索引', () => {
  const m = loadManifest();
  const shards = genCatalogSharded(m);
  const [first] = shards;
  assert.match(first.text, /禁手改/);
  assert.match(first.text, /触发协议/, '应有触发协议 / Step 0 扫桶硬指令段');
  assert.match(first.text, /Step 0/, '应有 Step 0 扫桶硬指令');
  assert.match(first.text, /\/devflow/, '应提示 devflow 入口');
  const full = shards.map((s) => s.text).join('\n');
  const bucketHasContent = (b) =>
    m.rules.some((r) => !r.skip_catalog && (r.bucket === b.id || (r.also_buckets || []).includes(b.id)));
  for (const b of m.buckets) {
    if (!bucketHasContent(b)) continue;
    assert.match(full, new RegExp(`### 桶: ${b.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  }
  for (const r of m.rules) {
    if (r.skip_catalog) {
      assert.ok(!full.includes(`**${r.id}**`), `skip_catalog rule ${r.id} 不应渲染索引行`);
      continue;
    }
    assert.match(full, new RegExp(`- \\*\\*${r.id}\\*\\*: ${r.trigger_short.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), `缺 rule ${r.id} 的一行索引`);
  }
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
      trigger_short: big,
      triggers: [],
      action: '',
      read: 'rules/rule-test.md',
      summary: 'unused',
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

test('genCatalogSharded: 跨桶 rule (also_buckets) 在每个所属桶都能发现同一行索引', () => {
  const m = loadManifest();
  const full = genCatalogSharded(m).map((s) => s.text).join('\n');
  const bucketSections = Object.fromEntries(
    full.split(/(?=### 桶:)/).filter((s) => s.trim()).map((s) => [/### 桶: [^(]+\(([^)]+)\)/.exec(s)?.[1], s]),
  );
  // push-summary: bucket=memory, also_buckets=[git-lifecycle] → 两个桶都应出现
  assert.match(bucketSections['memory'] || '', /\*\*push-summary\*\*/);
  assert.match(bucketSections['git-lifecycle'] || '', /\*\*push-summary\*\*/);
  // codex-review: bucket=review, also_buckets=[design] → 两个桶都应出现
  assert.match(bucketSections['review'] || '', /\*\*codex-review\*\*/);
  assert.match(bucketSections['design'] || '', /\*\*codex-review\*\*/);
});

test('genCatalogSharded: guard 内容不进常驻文本 (已确认被 pretooluse/skill 自身文档覆盖, 全部下沉)', () => {
  const m = loadManifest();
  const full = genCatalogSharded(m).map((s) => s.text).join('\n');
  for (const r of m.rules) {
    if (!r.guard) continue;
    assert.ok(!full.includes(r.guard), `rule ${r.id} 的 guard 文本不应出现在常驻 catalog 里 (应已下沉到 pretooluse/skill/rule 文件)`);
  }
  assert.ok(!full.includes('关键约束'), 'catalog 不应再有「关键约束(上浮)」这类字段');
});

test('renderBucketBody: 复用同一渲染逻辑, skip_catalog rule 不渲染索引行', () => {
  const m = loadManifest();
  const body = renderBucketBody(m);
  for (const r of m.rules) {
    if (r.skip_catalog) {
      assert.ok(!body.includes(`**${r.id}**`), `skip_catalog rule ${r.id} 不应渲染`);
      continue;
    }
    assert.ok(body.includes(`- **${r.id}**: ${r.trigger_short}`), `缺 rule ${r.id} 的一行索引`);
  }
});

test('renderBucketBody: 只留 trigger_short + 读路径指针, 有 read 才带箭头, summary/guard 不进正文', () => {
  const m = {
    buckets: [{ id: 'b1', title: 'B1', trigger_summary: 't', negatives: ['n'] }],
    rules: [
      { id: 'rule-with-file', bucket: 'b1', trigger_type: 'regex', trigger_desc: 'td', trigger_short: 'SHORT_A', triggers: [], action: '', read: 'rules/rule-x.md', summary: 'RULE_SUMMARY', guard: 'RULE_GUARD', pretooluse: [], also_buckets: [] },
      { id: 'skill-no-file', bucket: 'b1', trigger_type: 'skill', trigger_desc: 'td', trigger_short: 'SHORT_B', triggers: [], action: '', read: '', summary: 'SKILL_SUMMARY', guard: '', pretooluse: [], also_buckets: [] },
      { id: 'skill-marker', bucket: 'b1', trigger_type: 'skill', trigger_desc: 'td', trigger_short: 'SHORT_C', triggers: [], action: '', read: '(skill, 无 rule 文件)', summary: 'MARKER_SUMMARY', guard: '', pretooluse: [], also_buckets: [] },
    ],
  };
  const body = renderBucketBody(m);
  assert.match(body, /- \*\*rule-with-file\*\*: SHORT_A → 读 `rules\/rule-x\.md`/, '有 read 的 rule 应带 → 读 指针');
  assert.match(body, /- \*\*skill-no-file\*\*: SHORT_B\n/, 'read="" 的 rule 不应带 → 读 指针');
  assert.match(body, /- \*\*skill-marker\*\*: SHORT_C\n/, 'read="(...)" 的 rule 不应带 → 读 指针');
  assert.ok(!body.includes('RULE_SUMMARY') && !body.includes('SKILL_SUMMARY') && !body.includes('MARKER_SUMMARY'), 'summary 不应进正文');
  assert.ok(!body.includes('RULE_GUARD'), 'guard 不应进正文');
});

test('genPretooluse: 扁平化 pretooluse 靶 (不变)', () => {
  const p = genPretooluse(loadManifest());
  const inject = p.find((x) => x.decision === 'inject' && /worktree/.test(x.pattern));
  assert.ok(inject, '应含 git-worktree 的 inject 靶');
  assert.equal(inject.rule, 'git-worktree');
  assert.ok(p.some((x) => x.decision === 'inject'), '应含 inject 靶');
});

test('genWorkflowSkills: manifest.workflow_skills → {skills} 生成物 (含 15 个带前缀 skill)', () => {
  const m = {
    buckets: [],
    rules: [],
    workflow_skills: [
      'nocode:devflow', 'nocode:pdflow', 'nocode:dev-define',
      'nocode:dev-design', 'nocode:dev-design-refine', 'nocode:dev-design-render',
      'nocode:dev-plan', 'nocode:dev-build', 'nocode:dev-verify',
      'nocode:dev-review', 'nocode:dev-land', 'nocode:pd-research',
      'nocode:pd-prd', 'nocode:pd-ix', 'nocode:pd-vd',
    ],
  };
  const out = genWorkflowSkills(m);
  assert.ok(out.file.endsWith('hooks/workflow-skills.json'), '生成物路径应为 hooks/workflow-skills.json');
  const parsed = JSON.parse(out.text);
  assert.equal(parsed.skills.length, 15, '应含 15 个 skill');
  for (const s of m.workflow_skills) assert.ok(parsed.skills.includes(s), `缺 skill ${s}`);
  assert.ok(parsed.skills.every((s) => s.startsWith('nocode:')), '每个 skill 都应带 nocode: 前缀');
});

test('genWorkflowSkills: 真实 manifest 含 17 skill 名单', () => {
  const parsed = JSON.parse(genWorkflowSkills(loadManifest()).text);
  assert.equal(parsed.skills.length, 17, '真实 manifest 应含 17 个 workflow skill (含 dev-finish-branch + dev-design-select)');
});

test('targets: 含 workflow-skills.json 生成物', () => {
  const t = renderAll(false);
  assert.ok(t.some((x) => x.file.endsWith('workflow-skills.json')), 'workflow-skills.json 应在 targets');
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
      trigger_short: 'x'.repeat(5500),
      triggers: [],
      action: '',
      read: 'rules/rule-test.md',
      summary: 'unused',
      guard: '',
      pretooluse: [],
      also_buckets: [],
    })),
  };
  assert.throws(() => genCatalogSharded(m), {
    message: new RegExp(`> MAX_CATALOG_SHARDS=${MAX_CATALOG_SHARDS}`),
  });
});
