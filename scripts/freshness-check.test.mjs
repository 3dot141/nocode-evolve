#!/usr/bin/env node
// freshness-check.mjs 的 gate 节流 (--gate-ttl / --session) 行为测试.
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

// 顺序敏感: 以下测试共享同一 work repo 的 cache, 按声明顺序断言节流状态流转.

test('cold start + behind>=5: 首次 gate (exit 2), 写入 last_gate_ms / gate_session', () => {
  const r = run('sess-a');
  assert.equal(r.status, 2);
  assert.equal(r.json.gate, 'gate');
  assert.equal(r.json.cold_start, true);
  assert.equal(r.json.gate_suppressed, false);
  assert.equal(r.json.behind, 6);
  const entry = cacheEntry();
  assert.equal(typeof entry.last_gate_ms, 'number');
  assert.equal(entry.gate_session, 'sess-a');
});

test('同会话 30min 窗口内再跑: 节流降级放行 (gate_suppressed=true)', () => {
  const r = run('sess-a');
  assert.equal(r.status, 0);
  assert.equal(r.json.gate, 'ok');
  assert.equal(r.json.gate_suppressed, true);
  assert.equal(r.json.cold_start, false);
  assert.equal(r.json.behind, 6); // cache hit, behind 来自 entry
  assert.match(r.json.message, /gate 抑制/);
});

test('不同会话在窗口内: 仍 gate (节流按会话记分)', () => {
  const r = run('sess-b');
  assert.equal(r.status, 2);
  assert.equal(r.json.gate, 'gate');
  assert.equal(r.json.gate_suppressed, false);
  assert.equal(cacheEntry().gate_session, 'sess-b');
});

test('无 session 调用: 窗口内任何新鲜 gate 记录都放行 (worktree 级兜底)', () => {
  const r = run('');
  assert.equal(r.status, 0);
  assert.equal(r.json.gate_suppressed, true);
});

test('--gate-ttl=0 关闭节流: 同会话也照常 gate', () => {
  const r = run('sess-a', ['--gate-ttl=0']);
  assert.equal(r.status, 2);
  assert.equal(r.json.gate, 'gate');
  assert.equal(r.json.gate_suppressed, false);
});
