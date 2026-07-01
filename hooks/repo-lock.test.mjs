import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, existsSync, rmSync, chmodSync, readFileSync, writeFileSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { acquire, release, RepoLock } from '../scripts/repo-lock.mjs';

function makeTmpDir() {
  return mkdtempSync(join(tmpdir(), 'repo-lock-test-'));
}

const IS_ROOT = typeof process.getuid === 'function' && process.getuid() === 0;

test('case 1 — acquire 成功时锁文件写入当前 pid, 且不要求 .git 已存在', () => {
  const tmp = makeTmpDir();
  const personalDir = join(tmp, '.agents-personal'); // 目录本身尚未创建, 也没有 .git
  try {
    const handle = acquire(personalDir, 2000);
    assert.ok(handle, 'personalDir 不存在时 acquire 也应能建目录并成功加锁');
    assert.ok(existsSync(personalDir), 'acquire 应自动创建 personalDir');
    assert.ok(!existsSync(join(personalDir, '.git')), '不依赖 .git 存在');
    const lockPath = join(personalDir, '.dream.lock');
    assert.ok(existsSync(lockPath));
    assert.equal(readFileSync(lockPath, 'utf8'), String(process.pid));
    release(handle);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('case 2 — 两次 acquire 同一个锁, 只有一个成功, 另一个超时返回 null', () => {
  const tmp = makeTmpDir();
  try {
    const handleA = acquire(tmp, 2000);
    assert.ok(handleA, '第一次 acquire 应成功');

    const start = Date.now();
    const handleB = acquire(tmp, 200);
    const elapsed = Date.now() - start;
    assert.equal(handleB, null, '锁被占用时第二次 acquire 应返回 null');
    assert.ok(elapsed >= 150, `应等待到接近超时才返回 (实际 ${elapsed}ms)`);

    release(handleA);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('case 3 — release 后锁文件被删除, 后续 acquire 能立即成功', () => {
  const tmp = makeTmpDir();
  try {
    const handle = acquire(tmp, 2000);
    assert.ok(handle);
    release(handle);
    assert.ok(!existsSync(join(tmp, '.dream.lock')), 'release 后锁文件应被删除');

    const start = Date.now();
    const handle2 = acquire(tmp, 2000);
    const elapsed = Date.now() - start;
    assert.ok(handle2, 'release 后应能立即重新 acquire');
    assert.ok(elapsed < 200, `应几乎立即成功, 不应等待轮询周期 (实际 ${elapsed}ms)`);
    release(handle2);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('case 4 — release 对已被清理的锁句柄是幂等的 (不抛异常)', () => {
  const tmp = makeTmpDir();
  try {
    const handle = acquire(tmp, 2000);
    release(handle);
    assert.doesNotThrow(() => release(handle), '对同一 handle 重复 release 不应抛异常');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test(
  'case 5 — 非 EEXIST 错误 (如目录无写权限) 应直接抛出, 不静默吞掉',
  { skip: IS_ROOT ? 'root 用户会绕过权限检查, 跳过' : false },
  () => {
    const tmp = makeTmpDir();
    const personalDir = join(tmp, 'readonly-personal');
    try {
      mkdirSync(personalDir, { recursive: true });
      chmodSync(personalDir, 0o555); // 只读, 无写权限
      assert.throws(() => acquire(personalDir, 500), (err) => err.code !== 'EEXIST');
    } finally {
      chmodSync(personalDir, 0o755);
      rmSync(tmp, { recursive: true, force: true });
    }
  }
);

test('case 6 — 对象风格 RepoLock.acquire/release 与函数式导出行为一致', () => {
  const tmp = makeTmpDir();
  try {
    const handle = RepoLock.acquire(tmp, 2000);
    assert.ok(handle);
    RepoLock.release(handle);
    assert.ok(!existsSync(join(tmp, '.dream.lock')));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── staleness 检测（Review 复审 W2：进程崩溃遗留的锁此前会永久阻塞，已用真实复现验证）──

function deadPid() {
  // 起一个立刻退出的子进程，拿到它的 pid——子进程退出后这个 pid 保证不再存活
  // （测试运行的极短时间窗口内被系统重新分配给别的进程的概率可忽略）。
  const result = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
  return result.pid;
}

test('case 7 — 锁文件内容是已退出进程的 pid（模拟崩溃遗留）→ 立即回收而不是等满超时', () => {
  const tmp = makeTmpDir();
  try {
    const lockPath = join(tmp, '.dream.lock');
    mkdirSync(tmp, { recursive: true });
    writeFileSync(lockPath, String(deadPid()));

    const start = Date.now();
    const handle = acquire(tmp, 2000);
    const elapsed = Date.now() - start;

    assert.ok(handle, '陈旧锁应被回收，acquire 应成功而不是超时返回 null');
    assert.ok(elapsed < 500, `应远早于 2000ms 超时就成功（实际 ${elapsed}ms），说明走的是回收路径不是等超时`);
    assert.equal(readFileSync(lockPath, 'utf8'), String(process.pid), '回收后锁文件应写入当前进程的新 token');
    release(handle);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('case 8 — 锁文件内容是当前存活进程的 pid（如本进程自己）→ 不回收，按正常竞争超时', () => {
  const tmp = makeTmpDir();
  try {
    const lockPath = join(tmp, '.dream.lock');
    mkdirSync(tmp, { recursive: true });
    writeFileSync(lockPath, String(process.pid)); // 用当前测试进程自己的 pid，一定存活

    const start = Date.now();
    const handle = acquire(tmp, 200);
    const elapsed = Date.now() - start;

    assert.equal(handle, null, '锁持有者进程仍存活时不应回收，应正常超时返回 null');
    assert.ok(elapsed >= 150, `应等待到接近超时才返回 (实际 ${elapsed}ms)`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('case 9 — 锁文件 mtime 超过 staleness TTL → 即使 pid 仍存活也当陈旧回收（兜底 pid 复用场景）', () => {
  const tmp = makeTmpDir();
  try {
    const lockPath = join(tmp, '.dream.lock');
    mkdirSync(tmp, { recursive: true });
    writeFileSync(lockPath, String(process.pid)); // 当前进程 pid，一定存活
    const longAgo = new Date(Date.now() - 10 * 60 * 1000); // 10 分钟前，远超 TTL
    utimesSync(lockPath, longAgo, longAgo);

    const start = Date.now();
    const handle = acquire(tmp, 2000);
    const elapsed = Date.now() - start;

    assert.ok(handle, 'mtime 超过 TTL 时即使 pid 存活也应被当作陈旧锁回收');
    assert.ok(elapsed < 500, `应远早于超时就成功（实际 ${elapsed}ms）`);
    release(handle);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
