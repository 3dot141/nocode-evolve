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
import { openSync, writeSync, closeSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const LOCK_FILE_NAME = '.dream.lock';
const DEFAULT_TIMEOUT_MS = 2000;
const POLL_INTERVAL_MS = 50;

// 同步阻塞式 sleep — Node 主线程允许 Atomics.wait (与浏览器不同), 不需要额外的
// 子进程/worker_thread 就能实现真正的同步等待, 用于原子锁的轮询退避.
function sleepSync(ms) {
  const sab = new SharedArrayBuffer(4);
  const view = new Int32Array(sab);
  Atomics.wait(view, 0, 0, ms);
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
      sleepSync(POLL_INTERVAL_MS); // 锁被别的进程占着, 轮询等待
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
