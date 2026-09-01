#!/usr/bin/env node
// freshness-check.mjs 的会话跳过 (--ttl / --session) 与 behind 实时计算行为测试.
// 真实 git fixture: bare origin + work clone (behind=6), 不 mock.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'freshness-check.mjs');

let root;
let work;

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function run(session, extra = []) {
  const r = spawnSync(process.execPath, [SCRIPT, ...extra], {
    cwd: work,
    encoding: 'utf8',
    // 显式覆盖, 防止外层会话的 NOCODE_SESSION_ID 泄漏进测试
    env: { ...process.env, NOCODE_SESSION_ID: session || '' },
  });
  assert.equal(r.stderr.includes('Error'), false, `脚本异常: ${r.stderr}`);
  return { status: r.status, json: JSON.parse(r.stdout) };
}

function cacheEntry() {
  const store = JSON.parse(fs.readFileSync(path.join(work, '.git', 'nocode-freshness.json'), 'utf8'));
  assert.equal(store.v, 3, 'cache 结构应为 v3');
  const keys = Object.keys(store.entries || {});
  assert.equal(keys.length, 1, 'cache 应只有 branch+base 一条 entry');
  return store.entries[keys[0]];
}

before(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'freshness-'));
  const origin = path.join(root, 'origin.git');
  work = path.join(root, 'work');
  const other = path.join(root, 'other');

  git(root, ['init', '--bare', '-b', 'main', origin]);
  git(root, ['init', '-b', 'main', work]);
  for (const repo of [work]) {
    git(repo, ['config', 'user.email', 't@example.com']);
    git(repo, ['config', 'user.name', 't']);
    git(repo, ['config', 'commit.gpgsign', 'false']);
  }
  git(work, ['commit', '--allow-empty', '-m', 'init']);
  git(work, ['remote', 'add', 'origin', origin]);
  git(work, ['push', '-u', 'origin', 'main']);

  // 让 origin/main 领先 6 个 commit (>= 默认 max-behind 5)
  git(root, ['clone', origin, other]);
  git(other, ['config', 'user.email', 't@example.com']);
  git(other, ['config', 'user.name', 't']);
  git(other, ['config', 'commit.gpgsign', 'false']);
  for (let i = 1; i <= 6; i++) git(other, ['commit', '--allow-empty', '-m', `c${i}`]);
  git(other, ['push', 'origin', 'main']);
});

after(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

// 顺序敏感: 以下测试共享同一 work repo 的 cache, 按声明顺序断言会话跳过 / 跨会话状态流转.

test('cold start + behind>=5: 首次 gate (exit 2), 写入 last_check_* (无 behind 字段)', () => {
  const r = run('sess-a');
  assert.equal(r.status, 2);
  assert.equal(r.json.gate, 'gate');
  assert.equal(r.json.cold_start, true);
  assert.equal(r.json.session_skipped, false);
  assert.equal(r.json.behind, 6);
  const entry = cacheEntry();
  assert.equal(typeof entry.last_fetch_ms, 'number');
  assert.equal(typeof entry.last_check_ms, 'number');
  assert.equal(entry.last_check_session, 'sess-a');
  assert.equal('behind' in entry, false, 'v3 entry 不落 behind (不冻结落后量)');
});

test('同会话窗口内再跑: 直接跳过执行 (session_skipped=true), cache 不变', () => {
  const before = cacheEntry();
  const r = run('sess-a');
  assert.equal(r.status, 0);
  assert.equal(r.json.gate, 'ok');
  assert.equal(r.json.session_skipped, true);
  assert.match(r.json.message, /session skip/);
  const after = cacheEntry();
  assert.equal(after.last_check_ms, before.last_check_ms, '跳过路径不重写 cache');
});

test('跨会话不共享: 新会话仍完整检查并 gate (实时 behind, 非缓存值)', () => {
  const r = run('sess-b');
  assert.equal(r.status, 2);
  assert.equal(r.json.gate, 'gate');
  assert.equal(r.json.session_skipped, false);
  assert.equal(r.json.behind, 6, 'behind 为实时 rev-list 结果');
  assert.equal(cacheEntry().last_check_session, 'sess-b');
});

test('无 session 调用: 无法识别会话 → 不跳过, 完整执行仍 gate', () => {
  const r = run('');
  assert.equal(r.status, 2);
  assert.equal(r.json.gate, 'gate');
  assert.equal(r.json.session_skipped, false);
});

test('分支追平后: behind 实时归零, 跨会话直接 ok (不残留旧落后量)', () => {
  git(work, ['pull', '--ff-only', 'origin', 'main']);
  const r = run('sess-c'); // 新会话, fetch 缓存命中不重新 fetch, behind 仍实时算
  assert.equal(r.status, 0);
  assert.equal(r.json.gate, 'ok');
  assert.equal(r.json.behind, 0, '本地 ref 已追平, rev-list 实时归零');
  assert.equal(r.json.session_skipped, false, '跨会话不跳过, 是完整检查后 ok');
});
