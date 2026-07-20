import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { upsertEnv } from './env-file.mjs';

function tmpFile(content) {
  const dir = mkdtempSync(join(tmpdir(), 'envtest-'));
  const f = join(dir, '.env.local');
  if (content != null) writeFileSync(f, content);
  return f;
}

test('文件不存在时新建并写入', () => {
  const f = tmpFile(null);
  upsertEnv(f, { A: '1', B: '2' });
  assert.equal(readFileSync(f, 'utf8'), 'A=1\nB=2\n');
});

test('已有 key 原地替换，保留其他行与注释', () => {
  const f = tmpFile('# comment\nA=old\nKEEP=yes\n');
  upsertEnv(f, { A: 'new' });
  assert.equal(readFileSync(f, 'utf8'), '# comment\nA=new\nKEEP=yes\n');
});

test('缺失 key 追加到末尾', () => {
  const f = tmpFile('A=1\n');
  upsertEnv(f, { B: '2' });
  assert.equal(readFileSync(f, 'utf8'), 'A=1\nB=2\n');
});

test('幂等：重复跑结果一致', () => {
  const f = tmpFile('A=1\n');
  upsertEnv(f, { A: '9', B: '2' });
  const once = readFileSync(f, 'utf8');
  upsertEnv(f, { A: '9', B: '2' });
  assert.equal(readFileSync(f, 'utf8'), once);
});
