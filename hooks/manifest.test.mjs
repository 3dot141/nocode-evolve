import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadManifest } from './generate.mjs';

test('manifest: rule id 唯一', () => {
  const m = loadManifest();
  const ids = m.rules.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, 'rule id 有重复');
});

test('manifest: 每条 rule 的 bucket / also_buckets 都在 buckets 里存在', () => {
  const m = loadManifest();
  const bids = new Set(m.buckets.map((b) => b.id));
  for (const r of m.rules) {
    assert.ok(bids.has(r.bucket), `rule ${r.id} 的 bucket ${r.bucket} 不存在`);
    for (const ab of r.also_buckets || []) assert.ok(bids.has(ab), `rule ${r.id} 的 also_bucket ${ab} 不存在`);
  }
});

test('manifest: 必填字段齐全', () => {
  const m = loadManifest();
  for (const r of m.rules) {
    for (const f of ['id', 'bucket', 'trigger_type', 'action', 'read', 'summary']) {
      assert.ok(r[f] !== undefined, `rule ${r.id} 缺字段 ${f}`);
    }
  }
});

test('manifest: 每个 bucket 有 trigger_summary + negatives', () => {
  const m = loadManifest();
  for (const b of m.buckets) {
    assert.ok(b.trigger_summary, `bucket ${b.id} 缺 trigger_summary`);
    assert.ok(Array.isArray(b.negatives), `bucket ${b.id} 缺 negatives`);
  }
});
