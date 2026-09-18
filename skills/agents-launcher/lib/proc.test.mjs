import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { waitHealthy, spawnPrefixed } from './proc.mjs';

test('waitHealthy 第三次通过则成功，可注入 sleep 与 check', async () => {
  let n = 0;
  const ok = await waitHealthy('x', async () => ++n >= 3, { tries: 5, intervalMs: 0, sleep: async () => {} });
  assert.equal(ok, true);
  assert.equal(n, 3);
});

test('waitHealthy 超时抛错', async () => {
  await assert.rejects(
    waitHealthy('x', async () => false, { tries: 2, intervalMs: 0, sleep: async () => {} }),
    /健康检查超时/,
  );
});

// ---- spawnPrefixed：子进程输出落文件（防父进程猝死连带 SIGPIPE）----

function makeLogDir() {
  const dir = mkdtempSync(join(tmpdir(), 'proc-logs-'));
  process.env.FX_LAUNCHER_LOG_DIR = dir;
  return dir;
}

function cleanupLogDir(dir) {
  delete process.env.FX_LAUNCHER_LOG_DIR;
  rmSync(dir, { recursive: true, force: true });
}

const waitExit = (child) => new Promise((resolve) => child.once('exit', resolve));

test('spawnPrefixed: 子进程 stdout 是文件不是管道，输出落 <logDir>/<label>.log', async () => {
  const dir = makeLogDir();
  try {
    const child = spawnPrefixed('t-proc', 'sh', [
      '-c',
      'if [ -p /dev/stdout ]; then echo PIPE; else echo NOTPIPE; fi; echo child-line',
    ]);
    await waitExit(child);
    const log = readFileSync(join(dir, 't-proc.log'), 'utf8');
    assert.doesNotMatch(log, /^PIPE$/m, 'stdout 仍是管道 —— 父进程死后会 SIGPIPE 陪葬');
    assert.match(log, /NOTPIPE/);
    assert.match(log, /child-line/);
    assert.match(log, /^===== /m, '每次启动写分隔行');
  } finally {
    cleanupLogDir(dir);
  }
});

test('spawnPrefixed: 子进程退出后 tail 回显进程被回收', async () => {
  const dir = makeLogDir();
  try {
    const child = spawnPrefixed('t-tail', 'sh', ['-c', 'sleep 0.1; echo bye']);
    await waitExit(child);
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(child.logTail.killed, true);
  } finally {
    cleanupLogDir(dir);
  }
});

test('spawnPrefixed: 父进程猝死后子进程仍存活（旧管道实现会死在这里）', async () => {
  const dir = makeLogDir();
  const procUrl = new URL('./proc.mjs', import.meta.url).href;
  let childPid = null;
  try {
    const helper = `
      import { spawnPrefixed } from ${JSON.stringify(procUrl)};
      const c = spawnPrefixed('t-survive', 'sh', ['-c', 'while true; do echo tick; sleep 0.2; done']);
      console.log(c.pid);
      process.exit(0);
    `;
    const out = execFileSync(process.execPath, ['--input-type=module', '-e', helper], { encoding: 'utf8' });
    // helper 的 stdout 还含 spawnPrefixed 的 `[t-survive] $ …` 行与 tail 回显，取最后一个纯数字行当 pid
    childPid = Number(out.trim().split('\n').map((l) => l.trim()).filter((l) => /^\d+$/.test(l)).pop());
    await new Promise((resolve) => setTimeout(resolve, 1200));   // 留足多次写日志的时间
    assert.doesNotThrow(() => process.kill(childPid, 0), '父进程退出后子进程应仍存活');
  } finally {
    if (childPid) { try { process.kill(childPid, 'SIGKILL'); } catch { /* 已退出 */ } }
    cleanupLogDir(dir);
  }
});
