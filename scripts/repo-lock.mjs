#!/usr/bin/env node
// RepoLock — .agents-personal/ 嵌套仓库的并发写保护.
// 用 fs.openSync(path, 'wx') 原子创建锁文件, 避免 exists-then-write 竞态.
// 锁文件放 personalDir 根 (不依赖 .git 已存在), 默认超时 2000ms, 50ms 轮询.
//
// 用法(编程接口, 两种风格等价):
//   import { acquire, release } from './repo-lock.mjs';
//   const handle = acquire(personalDir, 2000);
//   if (!handle) { /* 拿不到锁, 跳过本次操作, 不阻塞调用方 */ }
//   try { ... } finally { release(handle); }
//
//   import { RepoLock } from './repo-lock.mjs';
//   const handle = RepoLock.acquire(personalDir, 2000);
//   ... RepoLock.release(handle);
//
// 设计: docs/superpowers/specs/3dot141/260701-dream-incremental-design.md
//   § PersonalHistory 域 / RepoLock 模块 (C1 修正: 原子操作代替 exists-then-write,
//   锁文件位置从 .git/ 内移到 .agents-personal/ 根)
//
// Review 复审 W2 修复：此前锁文件一旦创建就没有任何过期机制——持锁进程被 kill -9/OOM/
// 系统重启杀死后，锁文件永久留在磁盘上，此后每次 acquire 都会稳定超时返回 null，永久
// 静默失效直到人工删除锁文件（已用真实复现验证：手写一个内容为不存在 pid 的锁文件，
// 之后 acquire 稳定超时）。加两层 staleness 判定：① 锁文件内容的 pid 是否仍存活（进程
// 崩溃场景，最常见）；② 锁文件 mtime 是否超过一个远大于正常持锁时长的 TTL（兜底 pid 被
// 系统重新分配给别的无关进程的场景）。命中任一条即认为锁陈旧，删除后立即重试 acquire
// （不进入 sleep 轮询），不需要人工介入。
import { openSync, writeSync, closeSync, mkdirSync, rmSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const LOCK_FILE_NAME = '.dream.lock';
const DEFAULT_TIMEOUT_MS = 2000;
const POLL_INTERVAL_MS = 50;
// 正常一次 git add/commit 操作是毫秒级，30 秒是远超正常持锁时长的保守阈值——
// 只用来兜底"pid 被系统重新分配给别的无关进程"这种 pid 存活性检查会误判的边缘情况，
// 不是常规判定路径（常规路径是下面的 pid 存活性检查，命中率更高也更精确）。
const STALE_TTL_MS = 30_000;

// 同步阻塞式 sleep — Node 主线程允许 Atomics.wait (与浏览器不同), 不需要额外的
// 子进程/worker_thread 就能实现真正的同步等待, 用于原子锁的轮询退避.
function sleepSync(ms) {
  const sab = new SharedArrayBuffer(4);
  const view = new Int32Array(sab);
  Atomics.wait(view, 0, 0, ms);
}

// isPidAlive — signal 0 只做存在性检查, 不真的发信号. ESRCH = 进程不存在;
// EPERM 等其他错误说明进程存在但当前用户无权限探测, 仍算存活(保守, 避免误判陈旧)。
function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code !== 'ESRCH';
  }
}

// isStaleLock — 判断锁文件是否陈旧(持锁进程已崩溃/mtime 远超正常时长)。
// 任何读取失败(文件已被并发删除等)都保守返回 false, 交给调用方走正常轮询重试。
function isStaleLock(lockFile) {
  let stat;
  try {
    stat = statSync(lockFile);
  } catch {
    return false;
  }
  if (Date.now() - stat.mtimeMs > STALE_TTL_MS) return true; // mtime 兜底, 不管 pid 是否存活

  let content;
  try {
    content = readFileSync(lockFile, 'utf8');
  } catch {
    return false;
  }
  const pid = Number(content);
  if (!Number.isInteger(pid) || pid <= 0) return false; // 内容不是合法 pid, 保守起见不判定陈旧
  return !isPidAlive(pid);
}

// reclaimStaleLock — 删除陈旧锁文件. 已经被别的进程先一步删除/重建也视为正常
// (下一轮循环的 openSync('wx') 会自然地重新竞争, 不需要在这里特殊处理)。
function reclaimStaleLock(lockFile) {
  try {
    unlinkSync(lockFile);
  } catch {
    // ENOENT 等——忽略
  }
}

// acquire — 尝试获取锁, 超时前持续轮询. 成功返回 { path, token } 句柄, 超时返回 null.
// token = 本次写入锁文件的内容 (pid), release 靠它确认"还是我的锁"才删除.
// 非 EEXIST 错误 (如磁盘只读/权限不足) 直接抛出, 不静默吞掉.
export function acquire(personalDir, timeoutMs = DEFAULT_TIMEOUT_MS) {
  mkdirSync(personalDir, { recursive: true }); // 确保目录存在, 不管 .git 建没建都能写锁
  const lockFile = join(personalDir, LOCK_FILE_NAME);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const token = String(process.pid);
      const fd = openSync(lockFile, 'wx'); // 'wx': 文件已存在则原子失败, 无竞态窗口
      writeSync(fd, token);
      closeSync(fd);
      return { path: lockFile, token };
    } catch (e) {
      if (e.code !== 'EEXIST') throw e; // 非"文件已存在"的错误直接抛出
      if (isStaleLock(lockFile)) {
        reclaimStaleLock(lockFile);
        continue; // 立即重试 acquire, 不进入 sleep 轮询
      }
      sleepSync(POLL_INTERVAL_MS); // 锁被别的存活进程占着, 轮询等待
    }
  }
  return null; // 超时未拿到锁, 调用方按"跳过本次"处理
}

// release — 删除锁文件, 但先确认锁文件内容仍是自己写的 token 才删 (Round 2 复审 W6:
// 若本进程持有的 handle 早已因某种原因失效、锁文件被其他进程重新 acquire, 无校验的
// release 会删掉别人的锁——读一次内容比对, 不是自己的锁就跳过不删). 锁文件已不存在
// (被清理/从未写入) 时视为幂等成功, 不抛异常.
export function release(handle) {
  if (!handle) return;
  let current;
  try {
    current = readFileSync(handle.path, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return; // 已经不存在, 幂等
    throw e;
  }
  if (current !== handle.token) return; // 不是自己写的内容, 说明锁已被别的进程持有, 不删
  rmSync(handle.path, { force: true });
}

// 对象风格包装, 供偏好 RepoLock.acquire(...) 调用方式的消费者使用（等价于上面两个函数）。
export const RepoLock = { acquire, release };
