# Plan: dream 命令族增量化改造

**Goal**: 给 project-dream / personal-dream / plugin-dream 加增量能力，personal-dream 额外获得引用频率信号
**Architecture**: `.agents-personal/` 内嵌 git 仓库（合并原 personal-snapshot 的 bare repo 机制）+ 通用 baseline diff 模块（personal-dream/project-dream 共用）+ plugin-dream 复用 git config 分支隔离模式 + 新增 PostToolUse hook 采集引用频率
**Tech Stack**: Node.js（.mjs，无框架依赖）+ git CLI（子进程调用）
**Design Doc**: `docs/superpowers/specs/3dot141/260701-dream-incremental-design.md`
**Test Objectives**: 18 条 TO，覆盖 9 条使用路径 + 4 条跨域路径 + 6 条系统路径 + 4 条约束
**Execution**: workflow-sequential（Step 9 用户确认，260701）

> 来源：Define restate + dev-design-refine 设计文档（PersonalHistory/PluginRepo/ProjectTreeBaseline/UsageTracking 四个域）

> **Round 1 骨架经两路独立评审（general-purpose subagent + Codex 红军）+ sequential-thinking 自查发现 4 Critical + 6 Warning，已修正落地。修正记录见文末「Plan Review Log」。**

## 依赖图（已修正）

```
T1 repo-lock.mjs（无依赖）
T2 project-tree-detect.mjs（无依赖，与 T1 并行——risk-first 提前：本轮审视刚在这里找到 2 个 critical bug）
  → T3 personal-snapshot.mjs 重写 + personal-migrate.mjs 迁移脚本（合并任务，依赖 T1；Round 2 复审 C1：
     原 T3/T4 两个独立 task 之间存在文件级循环 import——personal-snapshot.mjs 要 import migrateIfNeeded，
     migrate 又要 import personal-snapshot 的 snapshot/resolvePersonalDir，拆成两个 task 顺序执行会在
     "只写了一半"的中间状态触发 ERR_MODULE_NOT_FOUND；合并成一个 task 一次性把两个文件都写完，
     不再有"T4"这个独立编号）
    → T5 dream-baseline.mjs（依赖 T1+T3，pluggable snapshot 回调 + pathspec + includeDirty 支持）
      → T6 commands/personal-dream.md 接入（依赖 T3+T5）
      → T7 commands/project-dream.md 接入（依赖 T2+T5）
  → T8 usage-tracker.mjs（依赖 T1+T3——resolvePersonalDir 符号耦合，见 Review Log）
    → T9 hooks/hooks.json 改（依赖 T8）
T10 plugin-dream-baseline.mjs（无依赖，含 setBaseline）
  → T11 commands/plugin-dream.md 接入（依赖 T10）
T12 .claude-plugin/plugin.json 版本升级（依赖 T1-T11 全部完成，收尾）
```

无环。`T1` 是嵌套仓库相关任务的前置依赖；`T2`、`T10` 各自独立，可与 T1 并行开始。**任务编号里没有独立的"Task 4"**——原骨架阶段的 T3/T4 在 Round 2 复审时合并成一个 Task 3（详见该 task 描述的整合说明），编号从 T1/T2/T3/T5/T6...一路跳过 4，不影响依赖图正确性，只是编号不连续。

## 切片策略

- **垂直切片**：每个 task 端到端可交付（写完能跑测试验证）
- **Risk-first（已按复审修正）**：T1（原子锁 TOCTOU）与 T2（project-tree-detect：本轮刚发现 ref 命名冲突 + 缺推断算法两个 critical bug，风险不亚于 T1，提前到第二位验证）→ T3（最大行为变更 + 碰真实用户数据的迁移，合并任务）→ T5（两命令共用的通用 diff，接口收窄避免误耦合）→ T6/T7（收尾接入）→ T8/T9（usage-tracking，虽是全局 hook 但设计已收敛、复用成熟 pattern，不确定性低于前面几项）→ T10/T11（plugin-dream，复用已验证模式，风险最低）→ T12（版本号收尾）

## 任务序列

## Task 1: RepoLock 原子文件锁 [Size: S]

**描述**：实现 `.agents-personal/` 嵌套仓库的并发写保护——`fs.openSync(path, 'wx')` 原子创建锁文件，超时 2 秒轮询等待，避免 exists-then-write 竞态（红军 C1 修复）。

**验收标准**:
- [ ] 两个进程同时 `acquire` 同一个锁，只有一个成功，另一个等待/超时返回 null
- [ ] `acquire` 不要求 `.git` 已存在（锁文件放 `.agents-personal/.dream.lock`）
- [ ] `release` 后锁文件被删除，后续 `acquire` 能立即成功

**covers**: 系统.6

**验证命令**:
- `node --test hooks/repo-lock.test.mjs` — 预期输出: `# pass N` `# fail 0`

**文件**: (2 个)
- `scripts/repo-lock.mjs`（NEW）
- `hooks/repo-lock.test.mjs`（NEW）

**依赖**: None

**真实改动**:

> **整合说明**：三个并行填充 subagent 对 `repo-lock.mjs` 的导出形状假设不一致（T5 假设裸函数 `acquire`/`release`；T8 假设对象 `RepoLock.acquire()`；T1 本身写的是 `class RepoLock` 需要 `new`）。最终统一成：核心逻辑是函数式 `acquire`/`release`（沿用 T1 原始实现的原子锁细节：`fs.openSync(path, 'wx')` + `Atomics.wait` 同步 sleep），再导出一个 `RepoLock = { acquire, release }` 对象供对象风格调用——T5（`import { acquire, release }`）和 T8（`import { RepoLock }` 然后 `RepoLock.acquire(...)`）都不需要改代码；T3/T4 里原来 `new RepoLock()` 后 `lock.acquire()/lock.release()` 的调用点，改成直接调用导入的 `acquire()/release()` 函数（整合时已同步替换，见 Task 3/4）。

```javascript
// scripts/repo-lock.mjs
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
```

```javascript
// hooks/repo-lock.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, existsSync, rmSync, chmodSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
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
```

---

## Task 2: project-tree-detect.mjs — 非 git 目录检测 + baseline ref 命名 [Size: M]

**描述**（**Plan 复审新增**：原设计把 `detectGitRepo`/`promptInitIfNeeded` 当纯 markdown 内联判断，两路独立评审都指出没有脚本/测试承载，且 ref 命名公式在默认调用路径会产生非法 ref。本 task 把这两件事一起落地为可测试脚本）：

1. `detectGitRepo(dirPath)`：判断目标目录是否在 git 仓库内（`git rev-parse --show-toplevel` 是否成功）
2. `findUpperProjectRoot(dirPath)`："上层项目根"推断算法——从 `dirPath` 逐级向上找最近的 `.git` 目录；一路到文件系统根都没有则返回 `dirPath` 本身（两个候选退化成同一个）
3. `refName(dirPath, gitRoot)`：baseline ref 命名，扁平化避免 D/F 冲突——`dirPath===gitRoot` 时用 `refs/dream/last-baseline__root`，否则 `refs/dream/last-baseline__<相对路径把/换成_>`

**验收标准**:
- [ ] `detectGitRepo` 对 git 仓库内目录返回 true，对非 git 目录返回 false
- [ ] `findUpperProjectRoot`：目标目录本身是 git 根 → 返回自身；目标目录是某仓库子目录 → 返回该仓库根；完全没有 `.git` → 返回目标目录本身
- [ ] `refName(dirPath, gitRoot)` 当 `dirPath === gitRoot` 时返回 `refs/dream/last-baseline__root`（不含尾部斜杠，`git check-ref-format --allow-onelevel` 校验通过）
- [ ] `refName` 对不同子目录（如 `src` 和 `docs`）返回不同的合法 ref 名，且都通过 `git check-ref-format` 校验
- [ ] 同一 repo 先后为 `.`（根）和 `src`（子目录）建 ref，两个 ref 能同时存在，不发生 D/F 冲突

**covers**: 系统.3

**验证命令**:
- `node --test hooks/project-tree-detect.test.mjs` — 预期输出: `# pass N` `# fail 0`

**文件**: (2 个)
- `scripts/project-tree-detect.mjs`（NEW）
- `hooks/project-tree-detect.test.mjs`（NEW）

**依赖**: None

**真实改动**:

> **整合说明**：填充时发现设计文档 `refName` 伪代码字面展开是三个下划线（`last-baseline___root`），与设计文档自己举的例子及本 Plan 验收标准要求的 `last-baseline__root`（两个下划线）矛盾——是设计文档伪代码笔误。以下实现按 Plan 验收标准（唯一可执行判据）为准，已用 `git check-ref-format` 实测验证。

```javascript
// scripts/project-tree-detect.mjs
#!/usr/bin/env node
// project-dream 目标目录树的 git 检测 + baseline ref 命名 —— ProjectTreeBaseline 域.
// 用法（CLI）:
//   node project-tree-detect.mjs detect <dir-path>
//   node project-tree-detect.mjs find-root <dir-path>
//   node project-tree-detect.mjs ref-name <dir-path> <git-root>
// 设计: docs/superpowers/specs/3dot141/260701-dream-incremental-design.md ProjectTreeBaseline 域
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// git -C <dirPath> rev-parse --show-toplevel 成功即返回 toplevel 绝对路径（git 已把它解析为物理路径，
// symlink 已展开）；不在任何 git 仓库内（或 dirPath 不存在）时返回 null，不抛异常——调用方按"非 git 目录"
// 处理，不让异常冒泡中断命令。
function gitToplevel(dirPath) {
  try {
    const out = execFileSync(
      'git',
      ['-C', dirPath, 'rev-parse', '--show-toplevel'],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();
    return out || null;
  } catch {
    return null;
  }
}

// realpath 失败（目标不存在等）时退化为 path.resolve，不抛异常。
function safeRealpath(p) {
  try {
    return realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

// detectGitRepo(dirPath) —— dirPath 是否在 git 仓库内（含子目录场景：git 自己逐级向上找 .git）。
export function detectGitRepo(dirPath) {
  return gitToplevel(dirPath) !== null;
}

// findUpperProjectRoot(dirPath) —— "上层项目根"推断算法：
//   从 dirPath 逐级向上找最近的 .git 目录，找到即为该仓库根；
//   一路到文件系统根都没有 .git → 退化为 dirPath 本身（AskUserQuestion 的两个候选在这种情况下等价）。
export function findUpperProjectRoot(dirPath) {
  const toplevel = gitToplevel(dirPath);
  if (toplevel) return toplevel;
  return safeRealpath(dirPath);
}

// refName(dirPath, gitRoot) —— baseline ref 命名，扁平化避免 D/F 冲突：
//   dirPath === gitRoot（realpath 对齐后比较，兼容 symlink/相对路径输入）→ 'refs/dream/last-baseline__root'
//   否则 → 'refs/dream/last-baseline__' + relative(gitRoot, dirPath)，把 '/' 和 '\' 都替换成 '_'
export function refName(dirPath, gitRoot) {
  const resolvedDirPath = safeRealpath(dirPath);
  const resolvedGitRoot = safeRealpath(gitRoot);
  const rel = path.relative(resolvedGitRoot, resolvedDirPath);
  const suffix = rel === '' ? 'root' : rel.replace(/[\\/]/g, '_');
  return `refs/dream/last-baseline__${suffix}`;
}

function output(result) {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

function usage() {
  process.stderr.write(
    'usage:\n' +
    '  project-tree-detect.mjs detect <dir-path>\n' +
    '  project-tree-detect.mjs find-root <dir-path>\n' +
    '  project-tree-detect.mjs ref-name <dir-path> <git-root>\n',
  );
}

export function main(argv) {
  const [cmd, ...rest] = argv;

  if (cmd === 'detect') {
    const dirPath = rest[0];
    if (!dirPath) { usage(); process.exit(2); return; }
    const gitRoot = gitToplevel(dirPath);
    output({ dirPath: safeRealpath(dirPath), isGitRepo: gitRoot !== null, gitRoot });
    return;
  }

  if (cmd === 'find-root') {
    const dirPath = rest[0];
    if (!dirPath) { usage(); process.exit(2); return; }
    const resolvedDirPath = safeRealpath(dirPath);
    const upperRoot = findUpperProjectRoot(dirPath);
    output({ dirPath: resolvedDirPath, upperRoot, sameAsDirPath: upperRoot === resolvedDirPath });
    return;
  }

  if (cmd === 'ref-name') {
    const [dirPath, gitRoot] = rest;
    if (!dirPath || !gitRoot) { usage(); process.exit(2); return; }
    output({
      dirPath: safeRealpath(dirPath),
      gitRoot: safeRealpath(gitRoot),
      refName: refName(dirPath, gitRoot),
    });
    return;
  }

  usage();
  process.exit(2);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
```

```javascript
// hooks/project-tree-detect.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { detectGitRepo, findUpperProjectRoot, refName } from '../scripts/project-tree-detect.mjs';

function makeTmpDir() {
  // realpath 立刻展开，避免 macOS /tmp -> /private/tmp 之类的 symlink 导致
  // 后续 git 返回值（git 内部已 realpath）与测试侧字符串比较时出现假性不等。
  return realpathSync(mkdtempSync(join(tmpdir(), 'ptd-test-')));
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function initRepo(dir) {
  git(['init', '-q', '-b', 'main', dir]);
  git(['-C', dir, 'config', 'user.email', 'test@local']);
  git(['-C', dir, 'config', 'user.name', 'test']);
  git(['-C', dir, 'commit', '--allow-empty', '-q', '-m', 'init']); // 保证 HEAD 存在，供 update-ref 测试使用
}

function checkRefFormat(name) {
  try {
    execFileSync('git', ['check-ref-format', '--allow-onelevel', name], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

function scriptPath() {
  return join(import.meta.dirname, '..', 'scripts', 'project-tree-detect.mjs');
}

function runCli(args) {
  return execFileSync('node', [scriptPath(), ...args], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

// ── detectGitRepo ──

test('detectGitRepo — git 仓库内目录返回 true', () => {
  const tmp = makeTmpDir();
  try {
    initRepo(tmp);
    assert.equal(detectGitRepo(tmp), true);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('detectGitRepo — 非 git 目录返回 false', () => {
  const tmp = makeTmpDir();
  try {
    assert.equal(detectGitRepo(tmp), false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('detectGitRepo — git 仓库的子目录也返回 true（git 自己逐级向上找 .git）', () => {
  const tmp = makeTmpDir();
  try {
    initRepo(tmp);
    const sub = join(tmp, 'src');
    mkdirSync(sub);
    assert.equal(detectGitRepo(sub), true);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── findUpperProjectRoot ──

test('findUpperProjectRoot — 目标目录本身是 git 根 → 返回自身', () => {
  const tmp = makeTmpDir();
  try {
    initRepo(tmp);
    assert.equal(findUpperProjectRoot(tmp), tmp);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('findUpperProjectRoot — 目标目录是某仓库子目录 → 返回该仓库根', () => {
  const tmp = makeTmpDir();
  try {
    initRepo(tmp);
    const sub = join(tmp, 'src', 'nested');
    mkdirSync(sub, { recursive: true });
    assert.equal(findUpperProjectRoot(sub), tmp);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('findUpperProjectRoot — 完全没有 .git → 返回目标目录本身（两候选退化为同一个）', () => {
  const tmp = makeTmpDir();
  try {
    const sub = join(tmp, 'no-git-here');
    mkdirSync(sub);
    assert.equal(findUpperProjectRoot(sub), sub);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── refName ──

test('refName — dirPath === gitRoot 时返回 refs/dream/last-baseline__root，不含尾部斜杠，check-ref-format 通过', () => {
  const tmp = makeTmpDir();
  try {
    const name = refName(tmp, tmp);
    assert.equal(name, 'refs/dream/last-baseline__root');
    assert.ok(!name.endsWith('/'), '不应有尾部斜杠');
    assert.ok(checkRefFormat(name), 'git check-ref-format --allow-onelevel 应校验通过');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('refName — 子目录 src 返回合法且与 root 不同的 ref 名', () => {
  const tmp = makeTmpDir();
  try {
    const src = join(tmp, 'src');
    mkdirSync(src);
    const name = refName(src, tmp);
    assert.equal(name, 'refs/dream/last-baseline__src');
    assert.notEqual(name, refName(tmp, tmp));
    assert.ok(checkRefFormat(name), 'git check-ref-format --allow-onelevel 应校验通过');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('refName — docs 与 src 两个不同子目录返回不同且都合法的 ref 名', () => {
  const tmp = makeTmpDir();
  try {
    const src = join(tmp, 'src');
    const docs = join(tmp, 'docs');
    mkdirSync(src);
    mkdirSync(docs);
    const nameSrc = refName(src, tmp);
    const nameDocs = refName(docs, tmp);
    assert.notEqual(nameSrc, nameDocs);
    assert.ok(checkRefFormat(nameSrc));
    assert.ok(checkRefFormat(nameDocs));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('refName — 多级嵌套子目录把 / 替换成 _，仍是单层合法 ref', () => {
  const tmp = makeTmpDir();
  try {
    const nested = join(tmp, 'skills', 'dev-build');
    mkdirSync(nested, { recursive: true });
    const name = refName(nested, tmp);
    assert.equal(name, 'refs/dream/last-baseline__skills_dev-build');
    assert.ok(checkRefFormat(name));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── D/F 冲突：同一 repo 先后为根目录和子目录建 ref，不冲突 ──

test('同一 repo 先后为根目录(root)和子目录(src)建 ref，两者能同时存在，不发生 D/F 冲突', () => {
  const tmp = makeTmpDir();
  try {
    initRepo(tmp);
    const src = join(tmp, 'src');
    mkdirSync(src);

    const rootRef = refName(tmp, tmp);
    const srcRef = refName(src, tmp);

    git(['-C', tmp, 'update-ref', rootRef, 'HEAD']);
    assert.doesNotThrow(() => git(['-C', tmp, 'update-ref', srcRef, 'HEAD']));

    const rootSha = git(['-C', tmp, 'rev-parse', rootRef]);
    const srcSha = git(['-C', tmp, 'rev-parse', srcRef]);
    assert.match(rootSha, /^[0-9a-f]{40}$/, 'root ref 应能解析成合法 commit sha');
    assert.match(srcSha, /^[0-9a-f]{40}$/, 'src ref 应能解析成合法 commit sha');

    const listing = git(['-C', tmp, 'for-each-ref', 'refs/dream/']);
    assert.match(listing, /last-baseline__root/, 'for-each-ref 应同时列出 root ref');
    assert.match(listing, /last-baseline__src/, 'for-each-ref 应同时列出 src ref');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── CLI 层 ──

test('CLI detect 子命令 — git 仓库返回 isGitRepo true 且带 gitRoot', () => {
  const tmp = makeTmpDir();
  try {
    initRepo(tmp);
    const out = JSON.parse(runCli(['detect', tmp]));
    assert.equal(out.isGitRepo, true);
    assert.equal(out.gitRoot, tmp);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('CLI detect 子命令 — 非 git 目录返回 isGitRepo false 且 gitRoot 为 null', () => {
  const tmp = makeTmpDir();
  try {
    const out = JSON.parse(runCli(['detect', tmp]));
    assert.equal(out.isGitRepo, false);
    assert.equal(out.gitRoot, null);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('CLI find-root 子命令 — 非 git 目录时 sameAsDirPath 为 true', () => {
  const tmp = makeTmpDir();
  try {
    const out = JSON.parse(runCli(['find-root', tmp]));
    assert.equal(out.sameAsDirPath, true);
    assert.equal(out.upperRoot, tmp);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('CLI ref-name 子命令 — 输出与直接调用 refName 一致', () => {
  const tmp = makeTmpDir();
  try {
    const src = join(tmp, 'src');
    mkdirSync(src);
    const out = JSON.parse(runCli(['ref-name', src, tmp]));
    assert.equal(out.refName, refName(src, tmp));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
```

---

## Task 3: personal-snapshot.mjs 重写 + personal-migrate.mjs 迁移脚本（合并）[Size: M]

> **（Round 2 复审 Critical 修正，C1）：原 Task 3（personal-snapshot.mjs）与原 Task 4（personal-migrate.mjs）合并成一个 task。** 两路独立评审（subagent + Codex 红军）都独立发现：`personal-snapshot.mjs` 静态 `import { migrateIfNeeded } from './personal-migrate.mjs'`，而 `personal-migrate.mjs` 又 `import { snapshot, resolvePersonalDir, ... } from './personal-snapshot.mjs'`——两个文件互相静态 import，如果按"先交付 Task 3、独立跑通验证、再交付 Task 4"的顺序执行，Task 3 单独完成时跑它自己的验证命令 `node --test hooks/personal-snapshot.test.mjs` 会因为 `personal-migrate.mjs` 还不存在而在模块加载阶段直接报 `ERR_MODULE_NOT_FOUND`，不是等某几个用例失败，是整个测试文件加载不了。两个文件必须一起创建、一起验证，因此合并成同一个 task（不重用"Task 4"这个编号，后续 Task 5 起编号不变，直接从 Task 3 跳到 Task 5）。

**描述**：把 `ensureBareRepo`/`bareRepoPath`（外部 bare repo + `--work-tree`）替换为 `ensureNestedRepo`（`.agents-personal/.git` 内嵌仓库），`snapshot()` 接入 `RepoLock`；`ensureNestedRepo` 内部判断"`.git` 不存在 + 旧 bare repo 存在"时调用同一 task 内的 `personal-migrate.migrateIfNeeded()`——迁移检测入口明确归属这里，不留给其他 task 各自猜测。`migrateIfNeeded` 从旧 `~/.nocode/personal-history/<projectId>/` bare repo 迁移到新嵌套仓库：只导入历史，不做内容匹配校验；导入后立即调用同一文件对里的 `snapshot()` 吸收正常漂移；应用步骤单次原子 `mv`。

**验收标准**:
- [ ] `ensureNestedRepo`：`.git` 不存在 + 检测到旧 bare repo（`~/.nocode/personal-history/<projectId>/`）→ 调用 `migrateIfNeeded()`
- [ ] `ensureNestedRepo`：`.git` 不存在 + 无旧 bare repo → 直接 `git init`
- [ ] `ensureNestedRepo`：`.git` 已存在 → 幂等跳过，不调用迁移也不重新 init
- [ ] `snapshot()` 拿不到锁时返回 `skipped_locked`，不阻塞
- [ ] worktree symlink 场景（`.agents-personal/` 是 symlink）正确 resolve 到物理路径（沿用现有 `resolvePersonalDir` 测试覆盖）
- [ ] `migrateIfNeeded(projectDir, oldBareDir)`：导入历史成功 + 迁移后 snapshot 产生新 commit + 旧 repo 改名 `.migrated`
- [ ] `git fetch` 失败（如旧 repo 损坏）：不改动任何现状，只 warn，返回 `failed`
- [ ] 迁移中拿不到 `RepoLock`：返回 `skipped_locked`，不阻塞
- [ ] 旧 repo 改名步骤失败：`.git` 已迁移完成不受影响，只 warn（下次调用检测到"已迁移+旧repo还在"直接补改名，不重复迁移）

**covers**: 命令.P1（与 T5/T6 共同覆盖，见路径映射表）, 跨域.4, 系统.5

**验证命令**:
- `node --test hooks/personal-snapshot.test.mjs hooks/personal-migrate.test.mjs` — 预期输出: `# pass N` `# fail 0`

**文件**: (4 个)
- `scripts/personal-snapshot.mjs`（改，大改）
- `scripts/personal-migrate.mjs`（NEW）
- `hooks/personal-snapshot.test.mjs`（改，大改——从 bare repo 断言改为嵌套仓库断言 + 迁移入口调用断言）
- `hooks/personal-migrate.test.mjs`（NEW）

**依赖**: Task 1

**真实改动**:

> **整合说明**：原填充代码用 `new RepoLock()` + `lock.acquire()/lock.release()`，已按 Task 1 最终导出形状（函数式 `acquire`/`release`）改成直接调用，逻辑不变。以下先是 `personal-snapshot.mjs` + 其测试，紧接着是 `personal-migrate.mjs` + 其测试——四个文件必须在本 task 一次性全部创建完，才能各自解析对方的 import。

```javascript
// scripts/personal-snapshot.mjs
#!/usr/bin/env node
// .agents-personal/ 版本快照 — SessionStart 时自动 commit 到内嵌 git 仓库 (.agents-personal/.git).
// 用法: node personal-snapshot.mjs [--dry-run] [--json]
// Exit 0 always — errors warn to stderr, never block session.
//
// 环境变量:
//   CLAUDE_PROJECT_DIR  — 当前项目目录 (Claude Code 注入)
//   NOCODE_HISTORY_ROOT — 旧版外部 bare repo 根目录 (默认 ~/.nocode/personal-history,
//                          仅用于迁移检测, 测试用)
//
// 架构变更 (dream-incremental 设计, 260701): 原"外部 bare repo + --work-tree 指向目标目录"
// 模式已废弃, 改为 .agents-personal/ 目录自身内嵌 .git (贴近 Codex `morpheus` 原版, 自包含).
// 检测到旧 bare repo 时, ensureNestedRepo() 委托 personal-migrate.mjs 的 migrateIfNeeded() 迁移历史.
//
// 设计: docs/superpowers/specs/3dot141/260701-dream-incremental-design.md
//   § PersonalHistory 域 / SnapshotWriter 模块
import { execSync } from 'node:child_process';
import { existsSync, realpathSync, mkdirSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { acquire, release } from './repo-lock.mjs';
import { migrateIfNeeded } from './personal-migrate.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const JSON_OUTPUT = process.argv.includes('--json');
const LOCK_TIMEOUT_MS = 2000;

export function resolvePersonalDir(projectDir) {
  const dir = join(projectDir, '.agents-personal');
  if (!existsSync(dir)) return null;
  try {
    return realpathSync(dir);
  } catch {
    return null;
  }
}

export function projectId(physicalPersonalDir) {
  const projectRoot = realpathSync(dirname(physicalPersonalDir));
  const name = basename(projectRoot);
  const hash = createHash('md5').update(projectRoot).digest('hex').slice(0, 8);
  return `${name}-${hash}`;
}

export function bareRepoPath(historyRoot, id) {
  return join(historyRoot, id);
}

export function historyRootDir() {
  return process.env.NOCODE_HISTORY_ROOT || join(homedir(), '.nocode', 'personal-history');
}

function git(personalDir, cmd, config = {}) {
  const parts = ['git'];
  for (const [k, v] of Object.entries(config)) parts.push(`-c`, `${k}=${v}`);
  parts.push(`--git-dir=${join(personalDir, '.git')}`, `--work-tree=${personalDir}`);
  parts.push(cmd);
  return execSync(parts.join(' '), {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function gitQuiet(personalDir, cmd) {
  try {
    git(personalDir, cmd);
    return true;
  } catch {
    return false;
  }
}

// ensureNestedRepo — 幂等建仓, 返回是否新建 (true) / 已存在或迁移未完成 (false).
//   .git 不存在 + 检测到旧 bare repo → 委托 migrateIfNeeded() 迁移历史 (personal-migrate.mjs).
//   .git 不存在 + 无旧 bare repo       → 直接 git init.
//   .git 已存在                       → 幂等跳过, 不调用迁移也不重新 init.
export function ensureNestedRepo(personalDir) {
  const gitDir = join(personalDir, '.git');
  if (existsSync(gitDir)) return false;

  const id = projectId(personalDir);
  const oldBareDir = bareRepoPath(historyRootDir(), id);

  if (existsSync(oldBareDir)) {
    const projectDir = dirname(personalDir);
    const result = migrateIfNeeded(projectDir, oldBareDir);
    if (result.status !== 'migrated') {
      process.stderr.write(`[personal-snapshot] WARN: 迁移未完成 (${result.status}), .git 暂不可用, 下次重试\n`);
    }
    return existsSync(gitDir);
  }

  mkdirSync(personalDir, { recursive: true });
  execSync(`git init -b main "${personalDir}"`, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return true;
}

export function formatTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// snapshot — 对 personalDir 当前磁盘状态做一次 add -A -f + commit (若有变化).
// 内部接入 RepoLock: 拿不到锁直接返回 skipped_locked, 不阻塞调用方.
export function snapshot(personalDir, dryRun = false) {
  const handle = acquire(personalDir, LOCK_TIMEOUT_MS);
  if (!handle) return { status: 'skipped_locked' };

  try {
    if (!existsSync(join(personalDir, '.git'))) {
      return { status: 'error', reason: 'no_repo' };
    }
    const commitConfig = { 'user.name': 'snapshot', 'user.email': 'snapshot@local' };
    // git-dir 恰好等于 work-tree 内的 .git 时, git 本身会自动跳过顶层 .git 目录,
    // 不需要额外 pathspec 排除 (设计文档 S1, 已实测验证).
    // 但 RepoLock 的 .dream.lock 文件 (C1 修正后) 就放在 personalDir 根下, 不在 .git
    // 内部, 不会被上面那条自动跳过规则覆盖 —— 必须显式 pathspec 排除, 否则每次
    // acquire 锁产生的 pid 内容变化都会被当成"有变化"提交进历史 (实测验证过).
    git(personalDir, 'add -A -f -- . ":!.dream.lock"');
    const hasChanges = !gitQuiet(personalDir, 'diff --cached --quiet');
    if (!hasChanges) return { status: 'no_changes' };
    if (dryRun) return { status: 'dry_run', changes: true };
    const ts = formatTimestamp();
    git(personalDir, `commit -m "auto: ${ts}"`, commitConfig);
    return { status: 'committed', timestamp: ts };
  } finally {
    release(handle);
  }
}

function output(result) {
  if (JSON_OUTPUT) console.log(JSON.stringify(result, null, 2));
}

export function main() {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  const physicalDir = resolvePersonalDir(projectDir);
  if (!physicalDir) {
    output({ status: 'skipped', reason: 'no .agents-personal/' });
    return;
  }

  try {
    ensureNestedRepo(physicalDir);
  } catch (e) {
    process.stderr.write(`[personal-snapshot] WARN: cannot init nested repo: ${e.message}\n`);
    output({ status: 'error', reason: 'init_failed' });
    return;
  }

  try {
    const result = snapshot(physicalDir, DRY_RUN);
    output(result);
  } catch (e) {
    process.stderr.write(`[personal-snapshot] WARN: snapshot failed: ${e.message}\n`);
    output({ status: 'error', reason: 'snapshot_failed' });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
  process.exit(0);
}
```

```javascript
// hooks/personal-snapshot.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync, existsSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync, execFileSync } from 'node:child_process';
import { resolvePersonalDir, projectId, ensureNestedRepo, snapshot } from '../scripts/personal-snapshot.mjs';

function makeTmpDir() {
  return mkdtempSync(join(tmpdir(), 'ps-test-'));
}

function nestedGit(personalDir, cmd) {
  return execSync(`git --git-dir="${join(personalDir, '.git')}" --work-tree="${personalDir}" ${cmd}`, {
    encoding: 'utf8',
  }).trim();
}

function nestedGitLog(personalDir) {
  return nestedGit(personalDir, 'log --oneline');
}

function makeOldBareRepoWithHistory(bareDir, seedFileName = 'legacy.md', seedContent = '# legacy history') {
  mkdirSync(bareDir, { recursive: true });
  execSync(`git init --bare -b main "${bareDir}"`, { stdio: 'pipe' });
  const seedWorktree = mkdtempSync(join(tmpdir(), 'ps-seed-'));
  writeFileSync(join(seedWorktree, seedFileName), seedContent);
  execSync(`git --git-dir="${bareDir}" --work-tree="${seedWorktree}" add -A -f`, { stdio: 'pipe' });
  execSync(
    `git -c user.name=seed -c user.email=seed@local --git-dir="${bareDir}" --work-tree="${seedWorktree}" commit -m "legacy commit"`,
    { stdio: 'pipe' }
  );
  rmSync(seedWorktree, { recursive: true, force: true });
}

function runScript(env = {}, args = []) {
  const script = join(import.meta.dirname, '..', 'scripts', 'personal-snapshot.mjs');
  return execFileSync('node', [script, '--json', ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

// ── BF1: 检测与 resolve ──

test('case 1.1 — 无 .agents-personal/ 时 skip', () => {
  const tmp = makeTmpDir();
  try {
    const out = runScript({ CLAUDE_PROJECT_DIR: tmp, NOCODE_HISTORY_ROOT: join(tmp, 'history') });
    const result = JSON.parse(out);
    assert.equal(result.status, 'skipped');
    assert.ok(!existsSync(join(tmp, 'history')), '历史目录不应被创建');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('case 1.2 — 有 .agents-personal/ (非 symlink) 走 snapshot, 建立嵌套仓库', () => {
  const tmp = makeTmpDir();
  const personal = join(tmp, '.agents-personal');
  const history = join(tmp, 'history');
  mkdirSync(personal, { recursive: true });
  writeFileSync(join(personal, 'test.md'), '# test');
  try {
    const out = runScript({ CLAUDE_PROJECT_DIR: tmp, NOCODE_HISTORY_ROOT: history });
    const result = JSON.parse(out);
    assert.equal(result.status, 'committed');
    assert.ok(existsSync(join(personal, '.git')), '嵌套仓库应建立在 .agents-personal/ 自身内');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('case 1.3 — symlink 场景 resolve 到物理路径', () => {
  const tmp = makeTmpDir();
  const mainProject = join(tmp, 'main-project');
  const worktreeProject = join(tmp, 'worktree');
  const physicalPersonal = join(mainProject, '.agents-personal');
  const history = join(tmp, 'history');

  mkdirSync(physicalPersonal, { recursive: true });
  writeFileSync(join(physicalPersonal, 'wiki.md'), '# wiki');
  mkdirSync(worktreeProject, { recursive: true });
  symlinkSync(physicalPersonal, join(worktreeProject, '.agents-personal'));

  try {
    const out = runScript({ CLAUDE_PROJECT_DIR: worktreeProject, NOCODE_HISTORY_ROOT: history });
    const result = JSON.parse(out);
    assert.equal(result.status, 'committed');
    assert.ok(existsSync(join(physicalPersonal, '.git')), '嵌套仓库应建在物理目录, 不是 symlink 内');

    const resolved = resolvePersonalDir(worktreeProject);
    const mainResolved = resolvePersonalDir(mainProject);
    assert.equal(realpathSync(resolved), realpathSync(mainResolved), 'symlink 应 resolve 到同一物理路径');
    assert.equal(projectId(resolved), projectId(mainResolved), 'project-id 应相同');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('case 1.4 — 断裂 symlink 不崩溃', () => {
  const tmp = makeTmpDir();
  const history = join(tmp, 'history');
  symlinkSync('/nonexistent/path/.agents-personal', join(tmp, '.agents-personal'));
  try {
    const out = runScript({ CLAUDE_PROJECT_DIR: tmp, NOCODE_HISTORY_ROOT: history });
    const result = JSON.parse(out);
    assert.equal(result.status, 'skipped');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── BF2: 首次初始化 (ensureNestedRepo) ──

test('case 2.1 — 首次 init + initial commit', () => {
  const tmp = makeTmpDir();
  const personal = join(tmp, '.agents-personal');
  const history = join(tmp, 'history');
  mkdirSync(join(personal, 'wiki'), { recursive: true });
  writeFileSync(join(personal, 'AGENTS.md'), '# AGENTS');
  writeFileSync(join(personal, 'wiki', 'index.md'), '# index');
  writeFileSync(join(personal, 'wiki', 'page.md'), '# page');

  try {
    const out = runScript({ CLAUDE_PROJECT_DIR: tmp, NOCODE_HISTORY_ROOT: history });
    const result = JSON.parse(out);
    assert.equal(result.status, 'committed');

    const log = nestedGitLog(personal);
    assert.equal(log.split('\n').length, 1, '应有 1 个 commit');
    assert.match(log, /auto:/, 'commit message 应含 auto:');

    const files = nestedGit(personal, 'ls-tree -r --name-only HEAD');
    assert.ok(files.includes('AGENTS.md'));
    assert.ok(files.includes('wiki/index.md'));
    assert.ok(files.includes('wiki/page.md'));
    assert.ok(!files.includes('.git'), '顶层 .git 目录不应被追踪进自己的历史');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('case 2.2 — 幂等: .git 已存在时 ensureNestedRepo 跳过, 不重新 init', () => {
  const tmp = makeTmpDir();
  const personal = join(tmp, '.agents-personal');
  const history = join(tmp, 'history');
  mkdirSync(personal, { recursive: true });
  writeFileSync(join(personal, 'test.md'), '# v1');

  const prevHistoryRoot = process.env.NOCODE_HISTORY_ROOT;
  process.env.NOCODE_HISTORY_ROOT = history;
  try {
    const created1 = ensureNestedRepo(personal);
    assert.equal(created1, true, '首次应新建');
    assert.ok(existsSync(join(personal, '.git')));

    snapshot(personal); // 建仓后落一次 commit, 才有 HEAD 可比较
    const logBefore = nestedGitLog(personal);
    const created2 = ensureNestedRepo(personal);
    assert.equal(created2, false, '.git 已存在的仓库不应重新 init');
    const logAfter = nestedGitLog(personal);
    assert.equal(logBefore, logAfter, '幂等调用不应改变仓库历史');
  } finally {
    if (prevHistoryRoot === undefined) delete process.env.NOCODE_HISTORY_ROOT;
    else process.env.NOCODE_HISTORY_ROOT = prevHistoryRoot;
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('case 2.3 — .git 不存在 + 检测到旧 bare repo → 触发迁移, 嵌套仓库导入旧历史', () => {
  const tmp = makeTmpDir();
  const personal = join(tmp, '.agents-personal');
  const history = join(tmp, 'history');
  mkdirSync(personal, { recursive: true });
  writeFileSync(join(personal, 'current.md'), '# current state');

  const id = projectId(personal);
  const oldBareDir = join(history, id);
  makeOldBareRepoWithHistory(oldBareDir);

  try {
    const out = runScript({ CLAUDE_PROJECT_DIR: tmp, NOCODE_HISTORY_ROOT: history });
    const result = JSON.parse(out);
    // ensureNestedRepo 内部的迁移已经吸收了当前磁盘漂移并 commit 过一次,
    // main() 紧接着再跑的 snapshot() 已无新变化可提交.
    assert.equal(result.status, 'no_changes');
    assert.ok(existsSync(join(personal, '.git')), '嵌套仓库应已建立');

    const log = nestedGitLog(personal);
    const commits = log.split('\n').filter(Boolean);
    assert.equal(commits.length, 2, '应有旧历史 1 commit + 迁移吸收漂移 1 commit');
    assert.ok(log.includes('legacy commit'), '应导入旧仓库历史');

    const files = nestedGit(personal, 'ls-tree -r --name-only HEAD');
    assert.ok(files.includes('current.md'), '迁移后应吸收当前磁盘状态');

    assert.ok(existsSync(`${oldBareDir}.migrated`), '旧 bare repo 应被改名为 .migrated');
    assert.ok(!existsSync(oldBareDir), '旧路径不应再存在');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── BF3: 增量快照 ──

test('case 3.1 — 新增文件产生增量 commit', () => {
  const tmp = makeTmpDir();
  const personal = join(tmp, '.agents-personal');
  const history = join(tmp, 'history');
  mkdirSync(personal, { recursive: true });
  writeFileSync(join(personal, 'v1.md'), '# v1');

  try {
    runScript({ CLAUDE_PROJECT_DIR: tmp, NOCODE_HISTORY_ROOT: history });

    writeFileSync(join(personal, 'v2.md'), '# v2');
    const out = runScript({ CLAUDE_PROJECT_DIR: tmp, NOCODE_HISTORY_ROOT: history });
    const result = JSON.parse(out);
    assert.equal(result.status, 'committed');

    const log = nestedGitLog(personal);
    assert.equal(log.split('\n').length, 2, '应有 2 个 commit');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('case 3.2 — 修改文件产生增量 commit', () => {
  const tmp = makeTmpDir();
  const personal = join(tmp, '.agents-personal');
  const history = join(tmp, 'history');
  mkdirSync(personal, { recursive: true });
  writeFileSync(join(personal, 'doc.md'), '# original');

  try {
    runScript({ CLAUDE_PROJECT_DIR: tmp, NOCODE_HISTORY_ROOT: history });

    writeFileSync(join(personal, 'doc.md'), '# modified');
    runScript({ CLAUDE_PROJECT_DIR: tmp, NOCODE_HISTORY_ROOT: history });

    const diff = nestedGit(personal, 'diff HEAD~1 HEAD');
    assert.ok(diff.includes('-# original'));
    assert.ok(diff.includes('+# modified'));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('case 3.3 — 无变更不产生空 commit', () => {
  const tmp = makeTmpDir();
  const personal = join(tmp, '.agents-personal');
  const history = join(tmp, 'history');
  mkdirSync(personal, { recursive: true });
  writeFileSync(join(personal, 'doc.md'), '# stable');

  try {
    runScript({ CLAUDE_PROJECT_DIR: tmp, NOCODE_HISTORY_ROOT: history });
    const out = runScript({ CLAUDE_PROJECT_DIR: tmp, NOCODE_HISTORY_ROOT: history });
    const result = JSON.parse(out);
    assert.equal(result.status, 'no_changes');

    const log = nestedGitLog(personal);
    assert.equal(log.split('\n').length, 1, '应仍然只有 1 个 commit');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('case 3.4 — --dry-run 不执行 commit', () => {
  const tmp = makeTmpDir();
  const personal = join(tmp, '.agents-personal');
  const history = join(tmp, 'history');
  mkdirSync(personal, { recursive: true });
  writeFileSync(join(personal, 'doc.md'), '# test');

  try {
    runScript({ CLAUDE_PROJECT_DIR: tmp, NOCODE_HISTORY_ROOT: history });
    writeFileSync(join(personal, 'new.md'), '# new');

    const out = runScript({ CLAUDE_PROJECT_DIR: tmp, NOCODE_HISTORY_ROOT: history }, ['--dry-run']);
    const result = JSON.parse(out);
    assert.equal(result.status, 'dry_run');
    assert.equal(result.changes, true);

    const log = nestedGitLog(personal);
    assert.equal(log.split('\n').length, 1, '--dry-run 不应产生新 commit');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('case 3.5 — project-id 确定性', () => {
  const tmp = makeTmpDir();
  const personal = join(tmp, '.agents-personal');
  mkdirSync(personal, { recursive: true });

  try {
    const id1 = projectId(personal);
    const id2 = projectId(personal);
    assert.equal(id1, id2, '同一路径的 project-id 应相同');
    assert.match(id1, /.+-[0-9a-f]{8}$/, 'project-id 应为 basename-md5_8 格式');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── BF4: 并发锁 ──

test('case 4.1 — snapshot 拿不到锁时返回 skipped_locked, 不阻塞', () => {
  const tmp = makeTmpDir();
  const personal = join(tmp, '.agents-personal');
  const history = join(tmp, 'history');
  mkdirSync(personal, { recursive: true });
  writeFileSync(join(personal, 'doc.md'), '# v1');

  try {
    runScript({ CLAUDE_PROJECT_DIR: tmp, NOCODE_HISTORY_ROOT: history });
    const logBefore = nestedGitLog(personal);

    // 手工占用锁, 模拟另一进程正在写
    writeFileSync(join(personal, '.dream.lock'), '999999');
    writeFileSync(join(personal, 'doc.md'), '# v2 while locked');

    const out = runScript({ CLAUDE_PROJECT_DIR: tmp, NOCODE_HISTORY_ROOT: history });
    const result = JSON.parse(out);
    assert.equal(result.status, 'skipped_locked');

    const logAfter = nestedGitLog(personal);
    assert.equal(logBefore, logAfter, '拿不到锁时不应产生新 commit');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
```

---

> 接续 Task 3 的第二个文件对——`personal-migrate.mjs` + 其测试。填充过程中发现并修了两个真实 bug（已体现在下面代码里）：① 自锁死锁——`migrateIfNeeded` 持有锁期间直接调用 `snapshot()`，而 `snapshot()` 内部会对同一把锁再次 `acquire`，同进程重入会卡满超时后静默降级；修正为 `.git` rename 完成后立即释放锁，再调用 `snapshot()`。② 临时目录 `mkdtempSync` 建在系统 tmp 下会跨卷，导致 `.git` 目录 rename 到 `personalDir` 时触发 `EXDEV`（跨设备不能原子 rename）；修正为临时目录建在 `projectDir` 下（与 `personalDir` 同一文件系统/卷），保证 rename 真正原子。

```javascript
// scripts/personal-migrate.mjs
#!/usr/bin/env node
// PersonalHistory 域 — MigrationRunner: 从旧外部 bare repo 迁移到 .agents-personal/ 内嵌 git 仓库.
//
// 用法(CLI, 手动 demo 用): node personal-migrate.mjs [--json]
//   自动定位 CLAUDE_PROJECT_DIR 下的 .agents-personal/ 与对应的旧 bare repo
//   (~/.nocode/personal-history/<projectId>/).
//
// 编程接口: migrateIfNeeded(projectDir, oldBareDir) — 由 personal-snapshot.mjs 的
//   ensureNestedRepo() 调用, 调用方不需要自行判断"要不要迁移", 本函数内部是幂等的:
//     - .git 已存在 + 旧 repo 还在   → 只补做旧 repo 改名 (上次改名步骤失败的补偿路径),
//                                      不重复导入历史
//     - .git 已存在 + 旧 repo 不在   → 视为已完成迁移, 无操作
//     - .git 不存在 + 旧 repo 不存在 → 无需迁移
//     - .git 不存在 + 旧 repo 存在   → 完整迁移流程
//
// 迁移流程 (设计文档 C4 修正): 只导入历史 (git fetch + update-ref), 不做"内容必须匹配"
// 校验; 导入完立即对当前磁盘真实状态做一次新的 snapshot commit, 吸收迁移前的正常漂移.
// 应用步骤先在临时目录完整构建好 (git init + fetch + update-ref), 再一次性原子 rename
// 替换, 避免"替换到一半"的中间态. 临时目录建在 projectDir 下 (与 personalDir 同一
// 文件系统/卷), 保证 rename 是同卷操作、真正原子 (跨卷 rename 会报 EXDEV).
//
// 设计: docs/superpowers/specs/3dot141/260701-dream-incremental-design.md
//   § PersonalHistory 域 / MigrationRunner 模块
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, release } from './repo-lock.mjs';
import { snapshot, resolvePersonalDir, projectId, bareRepoPath, historyRootDir } from './personal-snapshot.mjs';

const JSON_OUTPUT = process.argv.includes('--json');
const LOCK_TIMEOUT_MS = 2000;

function git(gitDir, cmd) {
  return execSync(`git --git-dir="${gitDir}" ${cmd}`, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

// migrateIfNeeded — 幂等迁移入口. 不要求调用方预先判断"要不要迁移".
export function migrateIfNeeded(projectDir, oldBareDir) {
  const personalDir = join(projectDir, '.agents-personal');
  const gitDir = join(personalDir, '.git');

  if (existsSync(gitDir)) {
    if (!existsSync(oldBareDir)) {
      return { status: 'already_migrated' };
    }
    // .git 已就绪但旧 repo 还在 — 上次改名步骤失败, 这里只补做改名, 不重新导入历史.
    try {
      renameSync(oldBareDir, `${oldBareDir}.migrated`);
    } catch (e) {
      process.stderr.write(`[personal-migrate] WARN: 补做旧 repo 改名失败: ${e.message}\n`);
      return { status: 'rename_retry_failed' };
    }
    return { status: 'migrated_rename_completed' };
  }

  if (!existsSync(oldBareDir)) {
    return { status: 'no_old_repo' };
  }

  const handle = acquire(personalDir, LOCK_TIMEOUT_MS);
  if (!handle) {
    return { status: 'skipped_locked' }; // 拿不到锁, 下次调用再试, 不阻塞本次会话
  }

  let tmpDir;
  let handleReleased = false; // snapshot() 内部会自己再 acquire 同一把锁, 必须先释放外层持有,
  // 否则同一进程对同一锁重入会自锁到超时 (release 只做一次, 避免释放到别的进程新持有的锁)
  try {
    mkdirSync(personalDir, { recursive: true });
    tmpDir = mkdtempSync(join(projectDir, '.personal-migrate-tmp-')); // 建在 projectDir 下, 与 personalDir 同卷,
                                                                       // 保证下面的 renameSync 是同设备原子操作 (不触发 EXDEV)
    const tmpGitDir = join(tmpDir, '.git');

    execSync(`git init -b main "${tmpDir}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    git(tmpGitDir, `fetch "${oldBareDir}"`); // 旧 bare repo 本身就是合法的 git remote
    git(tmpGitDir, 'update-ref refs/heads/main FETCH_HEAD');
    // 只导入历史指针, 不 reset 工作区、不要求内容匹配.

    renameSync(tmpGitDir, gitDir); // 单次 rename, 同卷内原子操作, 不会出现半迁移状态

    // 关键写操作 (.git 替换) 已完成, 释放外层锁再调用 snapshot() —— snapshot() 自己会
    // 重新 acquire/release 同一把锁保护 add/commit, 嵌套持锁只会导致自锁到超时.
    release(handle);
    handleReleased = true;

    snapshot(personalDir); // 用当前真实磁盘状态提交一次新 commit, 吸收迁移前的漂移

    try {
      renameSync(oldBareDir, `${oldBareDir}.migrated`);
    } catch (e) {
      // .git 已迁移完成, 这一步失败不影响正确性; 下次调用会走上面的补做改名分支
      process.stderr.write(`[personal-migrate] WARN: 旧 repo 改名失败, 下次调用会补做: ${e.message}\n`);
    }

    return { status: 'migrated' };
  } catch (e) {
    process.stderr.write(`[personal-migrate] WARN: 迁移失败: ${e.message}\n`); // fetch 失败等场景; 不阻断 session
    return { status: 'failed', reason: e.message };
  } finally {
    if (!handleReleased) release(handle);
    if (tmpDir && existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }
}

function output(result) {
  if (JSON_OUTPUT) console.log(JSON.stringify(result, null, 2));
}

export function main() {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const personalDir = resolvePersonalDir(projectDir);
  if (!personalDir) {
    output({ status: 'skipped', reason: 'no .agents-personal/' });
    return;
  }
  const id = projectId(personalDir);
  const oldBareDir = bareRepoPath(historyRootDir(), id);
  const result = migrateIfNeeded(dirname(personalDir), oldBareDir);
  output(result);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
  process.exit(0);
}
```

```javascript
// hooks/personal-migrate.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { migrateIfNeeded } from '../scripts/personal-migrate.mjs';
import { acquire, release } from '../scripts/repo-lock.mjs';

const IS_ROOT = typeof process.getuid === 'function' && process.getuid() === 0;

function makeTmpDir() {
  return mkdtempSync(join(tmpdir(), 'pm-test-'));
}

function nestedGit(personalDir, cmd) {
  return execSync(`git --git-dir="${join(personalDir, '.git')}" --work-tree="${personalDir}" ${cmd}`, {
    encoding: 'utf8',
  }).trim();
}

function makeOldBareRepoWithHistory(bareDir, seedFileName = 'legacy.md', seedContent = '# legacy history') {
  mkdirSync(bareDir, { recursive: true });
  execSync(`git init --bare -b main "${bareDir}"`, { stdio: 'pipe' });
  const seedWorktree = mkdtempSync(join(tmpdir(), 'pm-seed-'));
  writeFileSync(join(seedWorktree, seedFileName), seedContent);
  execSync(`git --git-dir="${bareDir}" --work-tree="${seedWorktree}" add -A -f`, { stdio: 'pipe' });
  execSync(
    `git -c user.name=seed -c user.email=seed@local --git-dir="${bareDir}" --work-tree="${seedWorktree}" commit -m "legacy commit"`,
    { stdio: 'pipe' }
  );
  rmSync(seedWorktree, { recursive: true, force: true });
}

test('case 1 — 完整迁移: 导入历史 + 迁移后 snapshot 产生新 commit + 旧 repo 改名 .migrated', () => {
  const tmp = makeTmpDir();
  const projectDir = join(tmp, 'project');
  const personal = join(projectDir, '.agents-personal');
  const oldBareDir = join(tmp, 'old-history-repo');
  mkdirSync(personal, { recursive: true });
  writeFileSync(join(personal, 'current.md'), '# current state');
  makeOldBareRepoWithHistory(oldBareDir);

  try {
    const result = migrateIfNeeded(projectDir, oldBareDir);
    assert.equal(result.status, 'migrated');
    assert.ok(existsSync(join(personal, '.git')), '嵌套仓库应建立');

    const log = nestedGit(personal, 'log --oneline');
    const commits = log.split('\n').filter(Boolean);
    assert.equal(commits.length, 2, '应有旧历史 1 commit + 迁移后 snapshot 1 commit');
    assert.ok(log.includes('legacy commit'), '应导入旧仓库历史');

    const files = nestedGit(personal, 'ls-tree -r --name-only HEAD');
    assert.ok(files.includes('current.md'), '迁移后 snapshot 应吸收当前磁盘状态');
    assert.ok(!files.includes('legacy.md'), 'legacy.md 磁盘上已不存在, 迁移 snapshot 应体现为已删除');

    assert.ok(existsSync(`${oldBareDir}.migrated`), '旧 bare repo 应被改名为 .migrated');
    assert.ok(!existsSync(oldBareDir), '旧路径不应再存在');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('case 2 — git fetch 失败 (旧 repo 损坏): 不改动任何现状, 只 warn, 返回 failed', () => {
  const tmp = makeTmpDir();
  const projectDir = join(tmp, 'project');
  const personal = join(projectDir, '.agents-personal');
  const oldBareDir = join(tmp, 'corrupt-old-repo');
  mkdirSync(personal, { recursive: true });
  writeFileSync(join(personal, 'current.md'), '# current state');
  mkdirSync(oldBareDir, { recursive: true });
  writeFileSync(join(oldBareDir, 'not-a-git-repo'), 'garbage');

  try {
    const result = migrateIfNeeded(projectDir, oldBareDir);
    assert.equal(result.status, 'failed');
    assert.ok(!existsSync(join(personal, '.git')), '.git 不应被建立, 现状不应改动');
    assert.ok(existsSync(oldBareDir), '旧目录不应被改名或删除');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('case 3 — 拿不到 RepoLock: 返回 skipped_locked, 不阻塞', () => {
  const tmp = makeTmpDir();
  const projectDir = join(tmp, 'project');
  const personal = join(projectDir, '.agents-personal');
  const oldBareDir = join(tmp, 'old-history-repo');
  mkdirSync(personal, { recursive: true });
  makeOldBareRepoWithHistory(oldBareDir);

  const handle = acquire(personal, 2000);
  assert.ok(handle, '预先占用锁应成功');

  try {
    const result = migrateIfNeeded(projectDir, oldBareDir);
    assert.equal(result.status, 'skipped_locked');
    assert.ok(!existsSync(join(personal, '.git')), '拿不到锁时不应有任何写入');
  } finally {
    release(handle);
    rmSync(tmp, { recursive: true, force: true });
  }
});

test(
  'case 4 — 旧 repo 改名步骤失败: .git 已迁移完成不受影响, 下次调用直接补做改名',
  { skip: IS_ROOT ? 'root 用户会绕过权限检查, 跳过' : false },
  () => {
    const tmp = makeTmpDir();
    const projectDir = join(tmp, 'project');
    const personal = join(projectDir, '.agents-personal');
    const oldBareDir = join(tmp, 'old-history-repo');
    mkdirSync(personal, { recursive: true });
    writeFileSync(join(personal, 'current.md'), '# current state');
    makeOldBareRepoWithHistory(oldBareDir);

    try {
      chmodSync(tmp, 0o555); // tmp 只读 → rename(oldBareDir, oldBareDir+'.migrated') 必然失败
      const result = migrateIfNeeded(projectDir, oldBareDir);
      assert.equal(result.status, 'migrated', '.git 迁移本身应成功, 不受改名失败影响');
      assert.ok(existsSync(join(personal, '.git')), '.git 应已就绪');
      assert.ok(existsSync(oldBareDir), '改名失败, 旧目录应仍在原位');

      chmodSync(tmp, 0o755);
      const beforeLog = nestedGit(personal, 'log --oneline');
      const result2 = migrateIfNeeded(projectDir, oldBareDir);
      assert.equal(result2.status, 'migrated_rename_completed');
      assert.ok(existsSync(`${oldBareDir}.migrated`), '补做改名应成功');
      assert.ok(!existsSync(oldBareDir));
      const afterLog = nestedGit(personal, 'log --oneline');
      assert.equal(beforeLog, afterLog, '补做改名不应重新导入历史, commit 历史不变');
    } finally {
      try {
        chmodSync(tmp, 0o755);
      } catch {
        /* ignore */
      }
      rmSync(tmp, { recursive: true, force: true });
    }
  }
);

test('case 5 — .git 不存在 + 旧 repo 也不存在: 无需迁移', () => {
  const tmp = makeTmpDir();
  const projectDir = join(tmp, 'project');
  const personal = join(projectDir, '.agents-personal');
  const oldBareDir = join(tmp, 'never-existed');
  mkdirSync(personal, { recursive: true });

  try {
    const result = migrateIfNeeded(projectDir, oldBareDir);
    assert.equal(result.status, 'no_old_repo');
    assert.ok(!existsSync(join(personal, '.git')));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('case 6 — .git 已存在 + 旧 repo 不存在: 视为已完成迁移, 无操作', () => {
  const tmp = makeTmpDir();
  const projectDir = join(tmp, 'project');
  const personal = join(projectDir, '.agents-personal');
  const oldBareDir = join(tmp, 'never-existed');
  mkdirSync(personal, { recursive: true });
  execSync(`git init -b main "${personal}"`, { stdio: 'pipe' });

  try {
    const result = migrateIfNeeded(projectDir, oldBareDir);
    assert.equal(result.status, 'already_migrated');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
```

---

## Task 5: dream-baseline.mjs 通用增量 diff 模块 [Size: M]

**描述**：`diffSinceBaseline`/`advanceBaseline` 通用实现，供 personal-dream（固定 ref、整树 diff、总是用 PersonalHistory 的 snapshot 落定状态）与 project-dream（按目标路径参数化 ref、可能是子目录 pathspec diff）共用。**（Plan 复审修正：接口收窄——"diff 前先落定状态"改为可选的 `prepareFn` 回调参数，不硬编码调用 PersonalHistory 专属的 `SnapshotWriter.snapshot`；project-dream 调用时若目标是子目录，`prepareFn` 传 no-op，diff 用 pathspec 限定子目录范围，不整树 diff）**。ref 不可达时 try/catch 降级返回 null（红军 C3 修复）；`advanceBaseline` 按 `hadFailures` 参数决定是否前移（红军 C6 修复）。

**验收标准**:
- [ ] ref 不存在（首次）→ 返回 null，不抛异常
- [ ] ref 存在但指向已丢失的 commit（模拟损坏）→ 捕获异常，返回 null，不崩溃
- [ ] diff 结果排除 `wiki/status.md` 自身变化（personal-dream 用例）
- [ ] `advanceBaseline(dir, ref, hadFailures=true)` 不移动 ref；`hadFailures=false` 才移动
- [ ] 传入 `prepareFn` 回调时，diff 前会先调用它；不传时跳过（project-dream 子目录场景不需要 personal-snapshot 的整树 snapshot）
- [ ] 传入 `pathspec` 参数时，diff 结果只包含该 pathspec 范围内的变更文件（project-dream 子目录场景）
- [ ] 传入 `includeDirty: true` 时，working tree 未提交改动（`git status --porcelain` 能看到但未 commit 的文件）也会出现在结果里（project-dream 场景，Round 2 复审 W1）

**covers**: 命令.P3, 命令.P9, 系统.1

**验证命令**:
- `node --test hooks/dream-baseline.test.mjs` — 预期输出: `# pass N` `# fail 0`

**文件**: (2 个)
- `scripts/dream-baseline.mjs`（NEW）
- `hooks/dream-baseline.test.mjs`（NEW）

**依赖**: Task 1, Task 3

**真实改动**:

```javascript
// scripts/dream-baseline.mjs
#!/usr/bin/env node
// dream-baseline.mjs — 通用 git baseline 增量 diff 模块.
// 供 personal-dream (固定 ref, 整树 diff, prepareFn=SnapshotWriter.snapshot) 与
// project-dream (按目标路径参数化 ref, 可能是子目录 pathspec, 不传 prepareFn) 共用.
// 不硬编码调用任何特定 snapshot 函数, 不强制整树 diff — 通过 options.prepareFn / options.pathspec 收窄.
//
// 设计: docs/superpowers/specs/3dot141/260701-dream-incremental-design.md #BaselineTracker 模块
// 依赖: scripts/repo-lock.mjs (Task 1, acquire/release)
import { execSync } from 'node:child_process';
import { dirname } from 'node:path';
import { acquire, release } from './repo-lock.mjs';

const LOCK_TIMEOUT_MS = 2000;

function quote(value) {
  return `"${String(value).replace(/(["\\$`])/g, '\\$1')}"`;
}

function git(gitDir, workTree, tokens, config = {}) {
  const parts = ['git'];
  for (const [k, v] of Object.entries(config)) parts.push('-c', `${k}=${v}`);
  parts.push(`--git-dir=${quote(gitDir)}`);
  if (workTree) parts.push(`--work-tree=${quote(workTree)}`);
  parts.push(...tokens);
  // 只掐掉末尾换行/空白，不能用 .trim() —— `git status --porcelain` 首行形如
  // " M path"，前导空格是状态码的一部分，全量 trim() 会把它吃掉，导致
  // parsePorcelainPaths 按固定偏移 slice(3) 解析时错位（Build 阶段实跑测试时发现的真实 bug，
  // 与 plugin-dream-baseline.mjs 的 git() helper 同一处理，此处补齐）。
  return execSync(parts.join(' '), {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).replace(/\s+$/, '');
}

// 'missing'  = ref 不存在 (首次, 静默走全量分支, 不 warn)
// 'broken'   = ref 存在但指向的对象不可达 (仓库损坏/history 被裁剪), 调用方需要 warn 后降级
// 'valid'    = ref 存在且指向有效对象
function refStatus(gitDir, refName) {
  try {
    execSync(`git --git-dir=${quote(gitDir)} show-ref --verify --quiet ${quote(refName)}`, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return 'valid';
  } catch (e) {
    if (e.status === 1) return 'missing';
    return 'broken';
  }
}

// git status --porcelain 输出解析成路径列表. rename/copy 行 ("old -> new") 取箭头后的新路径
// (与 scripts/plugin-dream-baseline.mjs 的 parsePorcelain 同一处理, Round 2 复审 W4 一并对齐)。
function parsePorcelainPaths(output) {
  if (!output) return [];
  return output
    .split('\n')
    .filter((l) => l.length > 0)
    .map((l) => l.slice(3).trimEnd())
    .map((p) => {
      const arrowIdx = p.indexOf(' -> ');
      return arrowIdx === -1 ? p : p.slice(arrowIdx + 4);
    });
}

/**
 * diffSinceBaseline — 计算 refName 到 HEAD 之间的变更文件列表.
 *
 * @param {string} gitDir   - 目标仓库的 --git-dir (如 <personalDir>/.git 或 <projectRoot>/.git)
 * @param {string} workTree - 目标仓库的 --work-tree
 * @param {string} refName  - baseline ref 名 (如 refs/dream/last-baseline 或参数化后的变体)
 * @param {object} [options]
 * @param {() => void} [options.prepareFn]     - diff 前调用的回调 (如 SnapshotWriter.snapshot); 不传则跳过, 不硬编码任何特定函数
 * @param {string[]} [options.excludePaths]     - 需要从 diff 结果排除的相对路径 (转成 git pathspec `:!<path>`)
 * @param {string} [options.pathspec]           - 限定 diff 范围的 pathspec (如子目录路径); 不传则默认整树 '.'
 * @param {boolean} [options.includeDirty]      - 额外用 `git status --porcelain` 检测 working tree 未提交改动并入结果
 *   (Round 2 复审 W1 修正：project-dream 场景不传 prepareFn，没有任何组件保证 working tree 干净——
 *    用户在目标目录里编辑了文件但没 commit，纯 commit 层 diff 看不到这些改动，会被误判"无变化"。
 *    personal-dream 场景 prepareFn=snapshot 已经把 working tree 提交干净，默认 false 不受影响)。
 * @returns {string[]|null} 变更文件相对路径列表; ref 不存在或不可达时返回 null (调用方走全量分支)
 */
export function diffSinceBaseline(gitDir, workTree, refName, options = {}) {
  const { prepareFn, excludePaths = [], pathspec, includeDirty = false } = options;

  if (typeof prepareFn === 'function') {
    prepareFn();
  }

  const status = refStatus(gitDir, refName);
  if (status === 'missing') {
    return null; // 首次运行, 调用方走全量分支, 无需 warn
  }
  if (status === 'broken') {
    process.stderr.write(
      `[dream-baseline] WARN: baseline ref ${refName} 存在但不可达 (可能已损坏), 降级为全量扫描\n`
    );
    return null;
  }

  try {
    const pathspecTokens = [quote(pathspec || '.'), ...excludePaths.map((p) => quote(`:!${p}`))];
    const diffTokens = ['diff', '--name-only', quote(refName), 'HEAD', '--', ...pathspecTokens];
    const out = git(gitDir, workTree, diffTokens);
    const changed = new Set(out ? out.split('\n').filter(Boolean) : []);

    if (includeDirty) {
      const statusTokens = ['status', '--porcelain', '--', ...pathspecTokens];
      const dirtyOut = git(gitDir, workTree, statusTokens);
      for (const p of parsePorcelainPaths(dirtyOut)) changed.add(p);
    }

    return Array.from(changed);
  } catch (e) {
    process.stderr.write(
      `[dream-baseline] WARN: diff 失败 (${(e.message || '').split('\n')[0]}), 降级为全量扫描\n`
    );
    return null;
  }
}

/**
 * advanceBaseline — 处理完成后把 refName 前移到当前 HEAD.
 *
 * @param {string} gitDir      - 目标仓库的 --git-dir
 * @param {string} refName     - baseline ref 名
 * @param {boolean} hadFailures - Phase 3 执行阶段是否有系统性失败 (用户主动跳过不算); true 则不前移
 */
export function advanceBaseline(gitDir, refName, hadFailures) {
  if (hadFailures) {
    return; // 有系统性失败时不前移, 下次 diff 仍能看到这些文件重新处理 (C6)
  }
  const lockDir = dirname(gitDir); // gitDir 形如 <root>/.git, 锁文件放 <root> 根, 不依赖 .git 已存在
  const handle = acquire(lockDir, LOCK_TIMEOUT_MS);
  if (!handle) {
    process.stderr.write('[dream-baseline] WARN: 拿不到锁, 跳过本次 baseline 前移\n');
    return; // 不阻塞; 下次运行 diff 范围略大, 不会漏检
  }
  try {
    execSync(`git --git-dir=${quote(gitDir)} update-ref ${quote(refName)} HEAD`, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (e) {
    process.stderr.write(`[dream-baseline] WARN: update-ref 失败: ${e.message}\n`);
  } finally {
    release(handle);
  }
}
```

```javascript
// hooks/dream-baseline.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { diffSinceBaseline, advanceBaseline } from '../scripts/dream-baseline.mjs';

function makeTmpDir() {
  return mkdtempSync(join(tmpdir(), 'db-test-'));
}

function initRepo(tmp) {
  execSync(`git init -q -b main "${tmp}"`, { stdio: ['pipe', 'pipe', 'pipe'] });
  const gitDir = join(tmp, '.git');
  execSync(`git --git-dir="${gitDir}" config user.email test@test.com`);
  execSync(`git --git-dir="${gitDir}" config user.name test`);
  return { gitDir, workTree: tmp };
}

function commitAll(gitDir, workTree, message) {
  execSync(`git --git-dir="${gitDir}" --work-tree="${workTree}" add -A`);
  execSync(`git --git-dir="${gitDir}" --work-tree="${workTree}" commit -q -m "${message}"`);
}

function revParse(gitDir, ref) {
  return execSync(`git --git-dir="${gitDir}" rev-parse ${ref}`, { encoding: 'utf8' }).trim();
}

// ── 首次 / 损坏降级 ──

test('diffSinceBaseline — ref 不存在（首次运行）返回 null，不抛异常', () => {
  const tmp = makeTmpDir();
  try {
    const { gitDir, workTree } = initRepo(tmp);
    writeFileSync(join(tmp, 'a.txt'), 'hello');
    commitAll(gitDir, workTree, 'init');

    const result = diffSinceBaseline(gitDir, workTree, 'refs/dream/last-baseline');
    assert.equal(result, null);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('diffSinceBaseline — ref 存在但指向已丢失的 commit（损坏）返回 null，不崩溃', () => {
  const tmp = makeTmpDir();
  try {
    const { gitDir, workTree } = initRepo(tmp);
    writeFileSync(join(tmp, 'a.txt'), 'hello');
    commitAll(gitDir, workTree, 'init');

    const refPath = join(gitDir, 'refs', 'dream', 'last-baseline');
    mkdirSync(dirname(refPath), { recursive: true });
    writeFileSync(refPath, 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef\n');

    assert.doesNotThrow(() => {
      const result = diffSinceBaseline(gitDir, workTree, 'refs/dream/last-baseline');
      assert.equal(result, null);
    });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── excludePaths ──

test('diffSinceBaseline — excludePaths 排除 wiki/status.md 自身变化（personal-dream 用例）', () => {
  const tmp = makeTmpDir();
  try {
    const { gitDir, workTree } = initRepo(tmp);
    mkdirSync(join(tmp, 'wiki', 'pages'), { recursive: true });
    writeFileSync(join(tmp, 'wiki', 'status.md'), '# status v1');
    writeFileSync(join(tmp, 'wiki', 'pages', 'foo.md'), '# foo v1');
    commitAll(gitDir, workTree, 'init');
    execSync(`git --git-dir="${gitDir}" update-ref refs/dream/last-baseline HEAD`);

    writeFileSync(join(tmp, 'wiki', 'status.md'), '# status v2');
    writeFileSync(join(tmp, 'wiki', 'pages', 'foo.md'), '# foo v2');
    commitAll(gitDir, workTree, 'update');

    const result = diffSinceBaseline(gitDir, workTree, 'refs/dream/last-baseline', {
      excludePaths: ['wiki/status.md'],
    });
    assert.ok(Array.isArray(result));
    assert.ok(result.includes('wiki/pages/foo.md'), 'status.md 以外的变化应出现在结果里');
    assert.ok(!result.includes('wiki/status.md'), 'status.md 自身变化应被排除');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── advanceBaseline / hadFailures ──

test('advanceBaseline — hadFailures=true 不移动 ref', () => {
  const tmp = makeTmpDir();
  try {
    const { gitDir, workTree } = initRepo(tmp);
    writeFileSync(join(tmp, 'a.txt'), 'v1');
    commitAll(gitDir, workTree, 'c1');
    const c1 = revParse(gitDir, 'HEAD');
    execSync(`git --git-dir="${gitDir}" update-ref refs/dream/last-baseline HEAD`);

    writeFileSync(join(tmp, 'a.txt'), 'v2');
    commitAll(gitDir, workTree, 'c2');

    advanceBaseline(gitDir, 'refs/dream/last-baseline', true);

    const refAfter = revParse(gitDir, 'refs/dream/last-baseline');
    assert.equal(refAfter, c1, 'hadFailures=true 时 baseline 不应前移');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('advanceBaseline — hadFailures=false 时前移 ref 到当前 HEAD', () => {
  const tmp = makeTmpDir();
  try {
    const { gitDir, workTree } = initRepo(tmp);
    writeFileSync(join(tmp, 'a.txt'), 'v1');
    commitAll(gitDir, workTree, 'c1');
    execSync(`git --git-dir="${gitDir}" update-ref refs/dream/last-baseline HEAD`);

    writeFileSync(join(tmp, 'a.txt'), 'v2');
    commitAll(gitDir, workTree, 'c2');
    const head = revParse(gitDir, 'HEAD');

    advanceBaseline(gitDir, 'refs/dream/last-baseline', false);

    const refAfter = revParse(gitDir, 'refs/dream/last-baseline');
    assert.equal(refAfter, head, 'hadFailures=false 时 baseline 应前移到 HEAD');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── prepareFn ──

test('diffSinceBaseline — 传入 prepareFn 时，diff 前会先调用它', () => {
  const tmp = makeTmpDir();
  try {
    const { gitDir, workTree } = initRepo(tmp);
    writeFileSync(join(tmp, 'a.txt'), 'v1');
    commitAll(gitDir, workTree, 'c1');
    execSync(`git --git-dir="${gitDir}" update-ref refs/dream/last-baseline HEAD`);

    let called = false;
    const prepareFn = () => {
      called = true;
      writeFileSync(join(tmp, 'b.txt'), 'from-prepare');
      commitAll(gitDir, workTree, 'prepare-snapshot');
    };

    const result = diffSinceBaseline(gitDir, workTree, 'refs/dream/last-baseline', { prepareFn });
    assert.equal(called, true, 'prepareFn 应被调用');
    assert.ok(result.includes('b.txt'), 'prepareFn 落的 commit 应出现在 diff 结果里');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('diffSinceBaseline — 不传 prepareFn 时跳过，不报错（project-dream 子目录场景）', () => {
  const tmp = makeTmpDir();
  try {
    const { gitDir, workTree } = initRepo(tmp);
    writeFileSync(join(tmp, 'a.txt'), 'v1');
    commitAll(gitDir, workTree, 'c1');
    execSync(`git --git-dir="${gitDir}" update-ref refs/dream/last-baseline HEAD`);

    assert.doesNotThrow(() => {
      const result = diffSinceBaseline(gitDir, workTree, 'refs/dream/last-baseline');
      assert.deepEqual(result, [], '无 prepareFn 且无新改动时应返回空数组，而非 null');
    });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── pathspec ──

test('diffSinceBaseline — 传入 pathspec 时，diff 结果只包含该范围内的变更文件（project-dream 子目录场景）', () => {
  const tmp = makeTmpDir();
  try {
    const { gitDir, workTree } = initRepo(tmp);
    mkdirSync(join(tmp, 'src'), { recursive: true });
    mkdirSync(join(tmp, 'docs'), { recursive: true });
    writeFileSync(join(tmp, 'src', 'index.js'), 'v1');
    writeFileSync(join(tmp, 'docs', 'readme.md'), 'v1');
    commitAll(gitDir, workTree, 'init');
    execSync(`git --git-dir="${gitDir}" update-ref refs/dream/last-baseline__src HEAD`);

    writeFileSync(join(tmp, 'src', 'index.js'), 'v2');
    writeFileSync(join(tmp, 'docs', 'readme.md'), 'v2');
    commitAll(gitDir, workTree, 'update both dirs');

    const result = diffSinceBaseline(gitDir, workTree, 'refs/dream/last-baseline__src', {
      pathspec: 'src',
    });
    assert.deepEqual(result, ['src/index.js'], '只应包含 pathspec 范围内 (src/) 的变更');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── includeDirty（Round 2 复审 W1）──

test('diffSinceBaseline — includeDirty=true 时，working tree 未提交改动也计入结果（project-dream 场景）', () => {
  const tmp = makeTmpDir();
  try {
    const { gitDir, workTree } = initRepo(tmp);
    writeFileSync(join(tmp, 'a.txt'), 'v1');
    commitAll(gitDir, workTree, 'init');
    execSync(`git --git-dir="${gitDir}" update-ref refs/dream/last-baseline HEAD`);

    writeFileSync(join(tmp, 'a.txt'), 'v2 (uncommitted)'); // 不 commit，模拟用户正在编辑

    const withoutDirty = diffSinceBaseline(gitDir, workTree, 'refs/dream/last-baseline');
    assert.deepEqual(withoutDirty, [], '不传 includeDirty 时纯 commit diff 看不到未提交改动');

    const withDirty = diffSinceBaseline(gitDir, workTree, 'refs/dream/last-baseline', { includeDirty: true });
    assert.ok(withDirty.includes('a.txt'), 'includeDirty=true 时未提交改动应计入结果');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('diffSinceBaseline — includeDirty=true 时 rename 行取重命名后的新路径（与 plugin-dream-baseline 一致）', () => {
  const tmp = makeTmpDir();
  try {
    const { gitDir, workTree } = initRepo(tmp);
    writeFileSync(join(tmp, 'old.txt'), 'v1');
    commitAll(gitDir, workTree, 'init');
    execSync(`git --git-dir="${gitDir}" update-ref refs/dream/last-baseline HEAD`);

    execSync(`git --git-dir="${gitDir}" --work-tree="${workTree}" mv old.txt new.txt`);

    const result = diffSinceBaseline(gitDir, workTree, 'refs/dream/last-baseline', { includeDirty: true });
    assert.ok(result.includes('new.txt'), `应解析出新路径 (实际: ${JSON.stringify(result)})`);
    assert.ok(!result.some((p) => p.includes(' -> ')), '不应残留箭头分隔的组合字符串');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
```

---

## ✅ Checkpoint 1: 覆盖 Task 1-5（PersonalHistory 域基础设施 + ProjectTreeBaseline 检测模块）

**全部测试**:
- `node --test 'hooks/*.test.mjs'` — 预期: all passing

**用户 Review**:
- [ ] demo：手跑一次 `node scripts/personal-snapshot.mjs` 确认嵌套仓库建立 + commit 产生
- [ ] demo：模拟一个旧 bare repo 目录，跑迁移脚本确认历史正确导入
- [ ] demo：`refName('.','.')` 和 `refName('./src','.')` 都能通过 `git check-ref-format` 且互不冲突
- [ ] 用户确认继续 / 调整 / 回滚

**Rollback 点**：此 checkpoint 之前 Task 1-5 已各自 commit。

---

## Task 6: commands/personal-dream.md 接入增量逻辑 [Size: S]

**描述**：Phase 1 (Scan) 改为先调 `dream-baseline.mjs` 的 `diffSinceBaseline`（`prepareFn` 传 `personal-snapshot.snapshot`）——无变化秒回，有变化只深查变更文件；额外检查未变 wiki 页的 `related:` 路径是否变化（跨域.3，复用现有 stale 检测机制）；Phase 3 (Execute) 完成后调 `advanceBaseline`，`hadFailures` 按"是否有系统性执行失败"判断（用户主动跳过不算失败）。

**验收标准**:
- [ ] 无变化时命令输出"状态良好，无需维护"，不做全量深检查
- [ ] 有变化时只深查变更文件列表 + related 路径变化的页面
- [ ] Phase 3 有执行失败时不前移 baseline

**covers**: 命令.P1（与 T3 共同覆盖）, 命令.P2, 跨域.3, 约束.1

**验证命令**:
- 人工验证（markdown prompt 无法单测）：实跑 `/personal-dream` 两次，第二次确认秒回；模拟 Phase 3 失败场景确认 baseline 不前移

**文件**: (1 个)
- `commands/personal-dream.md`（改）

**依赖**: Task 3, Task 5（Task 4 已合并进 Task 3，不再单独存在）

**真实改动**（基于当前 `commands/personal-dream.md` 全文，102 行；以下为具体插入/替换段落）：

**编辑 A —— 替换 Phase 1 标题+开头（第 12-18 行，"### Phase 1: Scan（提取候选动作）"及其首段）**：

原文第 12-16 行：
```markdown
### Phase 1: Scan（提取候选动作）

先调 `Skill(nocode-evolve:personal-lint)` 获取健康状态，然后对 `wiki/draft/` + `wiki/pages/` 每一页做深度检查：
```

替换为：
```markdown
### Phase 1: Scan（提取候选动作，接入增量判断）

**Step 0 — baseline 增量判断**：先调用：

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/personal-snapshot.mjs" --json
```

（若 `.agents-personal/.git` 不存在，这一步会顺带触发 `ensureNestedRepo`——首次建仓或检测旧 bare repo 触发迁移。）

然后调用：

```bash
node -e "
import('${CLAUDE_PLUGIN_ROOT}/scripts/personal-snapshot.mjs').then(async ({ resolvePersonalDir }) => {
  const { diffSinceBaseline } = await import('${CLAUDE_PLUGIN_ROOT}/scripts/dream-baseline.mjs');
  const { snapshot } = await import('${CLAUDE_PLUGIN_ROOT}/scripts/personal-snapshot.mjs');
  const personalDir = resolvePersonalDir(process.env.CLAUDE_PROJECT_DIR || process.cwd());
  const gitDir = personalDir + '/.git';
  const result = diffSinceBaseline(gitDir, personalDir, 'refs/dream/last-baseline', {
    prepareFn: () => snapshot(personalDir),
    excludePaths: ['wiki/status.md'],
  });
  console.log(JSON.stringify({ changedFiles: result }));
});
"
```

按输出 `{ changedFiles: string[] | null }` 分支：

| `changedFiles` | 处理 |
|---|---|
| `null`（首次运行，或 baseline 不可达降级） | 走全量：对 `wiki/draft/` + `wiki/pages/` 每一页做深度检查（下方原有流程不变）；Phase 3 结束后调 `advanceBaseline`（见编辑 C） |
| `[]`（有 baseline，diff 为空） | **秒回**：直接输出 `wiki 状态良好，无需维护动作。`，命令结束，不进入 Phase 2/3，也不调 `personal-lint` |
| 非空数组 | 只对 `changedFiles` 里列出的 wiki 页做深度检查；额外执行**编辑 B** 的 related 路径检查；结果与 `changedFiles` 覆盖的页面合并成本轮候选范围 |

`changedFiles` 非 `null` 时才继续调 `Skill(nocode-evolve:personal-lint)` 获取健康状态，然后对**候选范围**（而不是 `wiki/draft/` + `wiki/pages/` 全部）做深度检查：
```

**编辑 B —— 新增"related 路径变化检测"小节（插入位置：编辑 A 替换段落之后，原 Phase 1 表格之前）**：

```markdown
**跨域.3 — related 路径变化检测**：对**未出现在** `changedFiles` 里的 wiki 页（即 wiki 页本身没变），仍按现有 stale 检测逻辑（`test -e <related路径>`）检查其 frontmatter `related:` 列出的代码路径是否有变化或不存在。命中的页面也并入本轮深度检查候选，即使它自己没有被 git diff 出来。
```

**编辑 C —— 新增 Phase 3 收尾的 baseline 前移（插入位置：原文件 Phase 3 Execute 段落结尾，第 68 行"全部完成后"之前）**：

> **（Round 2 复审 Critical 修正，C2）：原文本此处写"仅当 `changedFiles` 非 `null` 时才前移"，与编辑A表格里"`changedFiles === null`（首次运行）→ Phase 3 结束后调 `advanceBaseline`"直接矛盾——两处打架，按原编辑C字面执行会导致首次运行永远不建立 `refs/dream/last-baseline`，增量能力永远激活不了。正确逻辑：只要走到了本步骤（意味着 Phase 1 判定不是"秒回"——`changedFiles` 是 `null` 或非空数组，两种都会执行到 Phase 3），处理完就该前移；`changedFiles` 为空数组的"秒回"场景命令在 Phase 1 就已经直接结束，根本不会执行到这里，不需要额外条件判断。**

```markdown
**Baseline 前移**（只要执行到了这一步——即 Phase 1 判定为"首次运行"或"有变化"，不是"秒回"提前退出——处理完就前移，不区分是首次全量还是增量有变化）：

```bash
node -e "
import('${CLAUDE_PLUGIN_ROOT}/scripts/dream-baseline.mjs').then(async ({ advanceBaseline }) => {
  const { resolvePersonalDir } = await import('${CLAUDE_PLUGIN_ROOT}/scripts/personal-snapshot.mjs');
  const personalDir = resolvePersonalDir(process.env.CLAUDE_PROJECT_DIR || process.cwd());
  advanceBaseline(personalDir + '/.git', 'refs/dream/last-baseline', ${HAD_FAILURES});
});
"
```

`${HAD_FAILURES}`：本轮 Phase 3 执行的候选里，若存在**系统性失败**（如文件写入报错、删除护栏确认中途异常取消）→ `true`（baseline 不前移，这些文件下次仍会出现在 diff 里）；用户在 Phase 2 显式勾选"跳过"某候选是正常决策，不算失败 → 其余情况均传 `false`（baseline 前移）。
```

---

## Task 7: commands/project-dream.md 接入增量 + 非 git 目录交互 [Size: M]

**描述**：复用 `project-tree-detect.mjs`（检测 + ref 命名）和 `dream-baseline.mjs`（diff，子目录场景传 pathspec + 不传 `prepareFn`），接入非 git 目录的 AskUserQuestion 交互（Define 阶段已确认：询问是否 `git init` + 基准目录二选一，`findUpperProjectRoot` 两候选退化为同一个时只呈现一个选项）。

**验收标准**:
- [ ] 目标目录是 git 仓库 → 按 `refName` 参数化的 baseline 增量扫描（含 `.` 默认调用场景，不产生非法 ref）
- [ ] 非 git 目录 → AskUserQuestion 问是否 init，选(a)/(b) 基准目录（两者退化为同一个时只展示一个选项，不让用户选一个没有区别的选项）
- [ ] 用户选"不要" → 降级全量扫描，不报错
- [ ] 同一 repo 下跑两个不同 dir-path（如 `.` 和 `src`）→ 各自独立的 ref，不互相覆盖也不冲突

**covers**: 命令.P7, 命令.P8, 命令.P9, 系统.3

**验证命令**:
- 人工验证：对同一目录树跑两次 `/project-dream`，第二次确认只重新生成变化的子目录；对非 git 目录跑一次确认交互正确；对 `.` 和某子目录先后跑确认互不冲突

**文件**: (1 个)
- `commands/project-dream.md`（改）

**依赖**: Task 2, Task 5

**真实改动**（基于当前 `commands/project-dream.md` 全文，117 行；以下四处均为插入，不删除现有内容，Step 编号符合 CLAUDE.md 规则 5）：

**编辑 A —— 新增 Step 0（插入位置：第 15 行 `## 执行流程` 与第 17 行 `### Step 1: 递归扫描` 之间）**：

```markdown
### Step 0: git 仓库检测 + baseline 增量判断

若未传 `dir-path` 参数，取当前项目根（`${CLAUDE_PROJECT_DIR:-$(pwd)}`）。

调用 `project-tree-detect.mjs` 判断 `<dir-path>` 是否在 git 仓库内：

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/project-tree-detect.mjs" detect "<dir-path>"
```

输出形如 `{ "dirPath": "...", "isGitRepo": true|false, "gitRoot": "..."|null }`。

**分支 A：`isGitRepo` 为 `false`（非 git 目录）**

用 `AskUserQuestion` 询问：

> 这个目录不是 git 仓库，要不要初始化一个来支持后续增量扫描？

选项：**要** / **不要**

- 用户选 **不要** → `INCREMENTAL=false`，`SCAN_ROOTS=(<dir-path>)`，直接跳到 Step 1（全量扫描，不阻断命令本身，跳过下面的 baseline 判断）。
- 用户选 **要** → 调用：

  ```bash
  node "${CLAUDE_PLUGIN_ROOT}/scripts/project-tree-detect.mjs" find-root "<dir-path>"
  ```

  输出 `{ "dirPath": "...", "upperRoot": "...", "sameAsDirPath": true|false }`。

  - 若 `sameAsDirPath` 为 `true`（两个候选退化为同一个）→ 不再追问第二个选项，直接确认在 `<dir-path>` 执行 `git init -b main "<dir-path>"`，`gitRoot = <dir-path>`。
  - 若 `sameAsDirPath` 为 `false` → 用 `AskUserQuestion` 二选一：

    | 选项 | 说明 |
    |---|---|
    | (a) 就用 `<dir-path>` 本身 | 只把 `<dir-path>` 纳入版本追踪 |
    | (b) 用 `<upperRoot>`（推断出的上层项目根） | 把整个上层项目纳入版本追踪，`<dir-path>` 只是其中一个子目录 |

    按用户选择的目录执行 `git init -b main "<选定目录>"`，`gitRoot = <选定目录>`。

  **（Round 2 复审 Critical 修正，C3）**：`git init` 完成后仓库没有任何 commit（unborn HEAD）。原文本这里错误地假设"`dream-baseline.mjs` 内部会在 diff 前先做一次 snapshot，天然补出第一个 commit"——这只对 personal-dream 成立（它传了 `prepareFn=snapshot`）；project-dream 场景下面「分支 B」明确**不传** `prepareFn`，没有任何组件会自动打底 commit。若不处理，后面 `advanceBaseline` 对着零 commit 仓库跑 `update-ref ... HEAD` 会以 `fatal: HEAD: not a valid SHA1`（exit 128）失败（虽然会被 try/catch 吞掉只 warn，不阻断命令，但 baseline 永远建立不起来，这个目录会永远退化成全量扫描，用户"要初始化以支持增量"的选择永远无法兑现）。修正：**git init 完成后，在此处显式补一次初始 commit**：

  ```bash
  git -C "<gitRoot>" add -A
  git -C "<gitRoot>" -c user.name=project-dream -c user.email=project-dream@local commit -q -m "init" --allow-empty
  ```

  （`--allow-empty` 兜底目录本身是空的情况；有文件时正常把现有内容纳入首个 commit。）完成后 HEAD 已存在，继续走下面「分支 B」。

**分支 B：`isGitRepo` 为 `true`（含刚 git init 完成的情况）**

`gitRoot` 取自上一步 `detect`（或分支 A 里 git init 时选定的目录）。计算 baseline ref 名：

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/project-tree-detect.mjs" ref-name "<dir-path>" "<gitRoot>"
```

输出 `{ "refName": "refs/dream/last-baseline__..." }`——`<dir-path>` 等于 `<gitRoot>` 时得到 `refs/dream/last-baseline__root`；子目录得到扁平化的 `refs/dream/last-baseline__<相对路径把/换成_>`。同一仓库下对不同 `<dir-path>` 各自算出独立的 ref 名，互不覆盖、不冲突。

调用 `dream-baseline.mjs` 做增量 diff（不传 `prepareFn`——project-dream 场景不需要 personal-dream 专属的整树 snapshot；用 `--pathspec` 把 diff 限定在 `<dir-path>` 范围内，避免子目录场景误报整仓库其他部分的变化）：

> **（Round 2 复审 W5 修正）**：`<gitRoot>`/`<dir-path>`/`<refName>` 里 `<dir-path>` 来自用户输入，不能直接拼进 `node -e` 的 JS 字符串字面量——路径若含 `'` / `` ` `` / `${...}` 会跳出字符串边界注入任意 JS。改为先设 shell 环境变量（同本 task 其它地方 `git -C "<gitRoot>"` 一样只需正常的 shell 双引号转义，不涉及 JS 源码拼接），JS 里用 `process.env` 读取，彻底避免值被当成 JS 源码解析：

```bash
DREAM_GIT_ROOT="<gitRoot>" DREAM_DIR_PATH="<dir-path>" DREAM_REF_NAME="<refName>" node -e "
import('${CLAUDE_PLUGIN_ROOT}/scripts/dream-baseline.mjs').then(({ diffSinceBaseline }) => {
  const gitRoot = process.env.DREAM_GIT_ROOT;
  const dirPath = process.env.DREAM_DIR_PATH;
  const refName = process.env.DREAM_REF_NAME;
  const result = diffSinceBaseline(gitRoot + '/.git', gitRoot, refName, { pathspec: dirPath, includeDirty: true, excludePaths: ['.dream.lock'] });
  console.log(JSON.stringify({ changedFiles: result }));
});
"
```

`includeDirty: true`（Round 2 复审 W1 修正）：project-dream 不传 `prepareFn`，不会像 personal-dream 那样自动把 working tree 提交干净——用户在 `<dir-path>` 下编辑了文件但还没 commit 是正常状态，纯 commit 层 diff 看不到这些改动会导致漏扫描，必须叠加 `git status --porcelain` 结果。`excludePaths: ['.dream.lock']`（Round 2 复审 W3 关联修正）：`advanceBaseline`（Step 3a）的 `RepoLock` 锁文件落在 `gitRoot` 根（`dirname(gitDir)`），是用户自己项目仓库里的一个点文件而非插件专属目录；正常情况下 `acquire`/`release` 瞬时配对不会被 diff 看到，但异常崩溃导致锁文件残留时，若不排除会被 `includeDirty` 当成"变更文件"纳入结果，造成自我污染式的持续误判——与 personal-dream 排除 `wiki/status.md` 同一处理模式。锁文件本身是否应该改放到插件专属位置（而非用户仓库根）留作已知设计限制，见文末 Review Log。

输出 `{ "changedFiles": string[] | null }`：

- `changedFiles === null`（首次运行）→ `SCAN_ROOTS=(<dir-path>)`，等同于原有全量行为。
- `changedFiles` 为空数组 → 完全无变化（命令.P9）——直接输出：

  ```
  project-dream: <dir-path> 自上次运行以来无变化，无需生成。
  ```

  命令到此结束，不进入 Step 1。
- `changedFiles` 非空数组 → 是相对 `<gitRoot>` 的路径列表。取每个文件的 `dirname`，与 `<gitRoot>` 拼接得到绝对目录，去重后再去掉已被其祖先目录覆盖的子目录，剩下的最上层目录集合就是 `SCAN_ROOTS`。

无论走分支 A 还是分支 B，只要没有在「无变化秒回」处提前结束，都带着 `SCAN_ROOTS`（以及分支 B 场景下的 `gitRoot`/`refName`，供 Step 3a 使用）进入 Step 1。
```

**编辑 B —— 改写 Step 1 的扫描命令（替换第 21-23 行原有的单次 `find <dir-path> ... | sort`）**：

```bash
find <scan-root> -type d ! -path '*/.git/*' ! -path '*/node_modules/*' ! -path '*/dist/*' ! -path '*/build/*' ! -path '*/coverage/*' ! -path '*/__pycache__/*' ! -path '*/.agents-personal/*' ! -name '.*'
```

对 `SCAN_ROOTS`（由 Step 0 给出）里的每个 `<scan-root>` 各跑一次，结果合并去重后排序。全量模式下 `SCAN_ROOTS` 只有一个元素——原始的 `<dir-path>`，行为与增量能力接入前完全一致；增量模式下 `SCAN_ROOTS` 是 Step 0 对 diff 结果收窄后的多个目录，扫描范围更小，Step 2/3 后续流程不变。

**编辑 C —— 新增 Step 3a（插入位置：Step 3 代码块结束之后、原"### Step 4: 总报告"之前）**：

```markdown
### Step 3a: 前移 baseline

若 Step 0 判定为增量模式（即成功拿到了 `gitRoot`/`refName`——不论是走「本来就是 git 仓库」还是「刚 git init」的分支）：

> 同 Step 0 分支 B（Round 2 复审 W5 修正）：`<gitRoot>`/`<refName>` 经环境变量传入，不拼进 JS 字符串字面量。`${HAD_FAILURES}` 是本命令自己算出的布尔字面量（`true`/`false`），非用户输入，直接插值不受此约束。

```bash
DREAM_GIT_ROOT="<gitRoot>" DREAM_REF_NAME="<refName>" node -e "
import('${CLAUDE_PLUGIN_ROOT}/scripts/dream-baseline.mjs').then(({ advanceBaseline }) => {
  const gitRoot = process.env.DREAM_GIT_ROOT;
  const refName = process.env.DREAM_REF_NAME;
  advanceBaseline(gitRoot + '/.git', refName, ${HAD_FAILURES});
});
"
```

- Step 3 批量执行全部成功（用户主动不勾选的目录不算失败）→ `HAD_FAILURES=false`，baseline 前移到当前 HEAD。
- Step 3 中有目录因写入失败等**系统性错误**未能完成（不是用户主动不勾选）→ `HAD_FAILURES=true`，baseline 不前移，这些目录下次 `/project-dream` 的 diff 里会重新出现。

若 Step 0 判定为全量模式（非 git 目录且用户选择「不要」）→ 跳过本步骤，没有 baseline 可前移。
```

**编辑 D —— 文件末尾追加说明小节**：

```markdown

## 增量模式与秒回（P7-P9）

- Step 0 分支 A 的「不要」选项 = 全量模式：每次都跑 Step 1-4，不产生/不依赖任何 `refs/dream/last-baseline__*`，行为与增量能力接入前完全一致。
- Step 0 分支 B 判定 `changedFiles` 为空数组 = 秒回：命令在 Step 0 内直接结束，Step 1-4 完全不会执行。
- Step 0 分支 B 判定 `changedFiles` 为 `null` / 非空数组 = 增量模式：Step 1 只扫描 `SCAN_ROOTS`（收窄后的目录集合），Step 3a 负责按执行结果前移或跳过 baseline。
- 同一仓库下对不同 `dir-path`（如 `.` 和 `src`）分别运行 `/project-dream`，各自拿到独立的 `refName`，互不覆盖、互不冲突。
```

---

## ✅ Checkpoint 2: 覆盖 Task 6-7（personal-dream / project-dream 命令层接入）

**全部测试**:
- `node --test 'hooks/*.test.mjs'` — 预期: all passing

**用户 Review**:
- [ ] demo：`/personal-dream` 与 `/project-dream` 各跑两次，确认首次全量、第二次秒回/增量
- [ ] 用户确认继续 / 调整 / 回滚

**Rollback 点**：此 checkpoint 之前 Task 6-7 已各自 commit。

---

## Task 8: usage-tracker.mjs 引用频率采集 [Size: M]

**描述**（**Plan 复审修正**：size 从 S 调整为 M——涉及 hook 事件解析 + realpath/symlink 处理 + status.md 表格解析写入 + 共享 RepoLock + 性能预期，工作量比"计数+1"复杂；依赖从"仅 T1"补上 T3，因为 `resolvePersonalDir` 这个符号目前定义在 `personal-snapshot.mjs` 里，T3 重写时如果改了这个函数的位置/签名，T8 会跟着受影响）：PostToolUse hook 拦截 Read 调用，命中 `.agents-personal/wiki/(pages|draft)/` 路径时更新 `status.md` 聚合表（key 用相对路径避免碰撞，红军 W5 修复；`cwd` 遵循 `CLAUDE_PROJECT_DIR||process.cwd()` 约定 + realpath 解析兼容 symlink，红军 W2/W4 修复）。

**验收标准**:
- [ ] 非 Read 工具调用 / 非 wiki 路径 → 直接跳过，无副作用
- [ ] 命中 wiki 页 → status.md 对应 key 计数+1，最后引用时间刷新
- [ ] 新页（status.md 里没有的 key）→ 新增一行
- [ ] worktree symlink 场景下正确记到主仓真实项目（复用 T3 导出的 `resolvePersonalDir`，签名变了这里的测试会先失败，不会静默出错）

**covers**: 跨域.1

**验证命令**:
- `node --test hooks/usage-tracker.test.mjs` — 预期输出: `# pass N` `# fail 0`

**文件**: (2 个)
- `hooks/usage-tracker.mjs`（NEW）
- `hooks/usage-tracker.test.mjs`（NEW）

**依赖**: Task 1, Task 3

**真实改动**：

```javascript
// hooks/usage-tracker.mjs
#!/usr/bin/env node
// PostToolUse hook (matcher: Read): 拦截对 .agents-personal/wiki/(pages|draft)/ 下页面的 Read 调用，
// 在 status.md 聚合表里给对应 key 计数+1、刷新最后引用时间。
// cwd 约定: CLAUDE_PROJECT_DIR || process.cwd()（与 scripts/personal-snapshot.mjs 一致）。
// 设计: docs/superpowers/specs/3dot141/260701-dream-incremental-design.md § UsageTracking 域
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { resolve as pathResolve, join, dirname } from 'node:path';
import { resolvePersonalDir } from '../scripts/personal-snapshot.mjs';
import { RepoLock } from '../scripts/repo-lock.mjs';

// status.md 首次生成时的骨架（无表格数据行，含说明性 preamble）。
export const DEFAULT_PREAMBLE = `# Wiki Usage Status

> 由 PostToolUse hook 自动维护，记录每个 wiki 页被 Read 的次数与最后引用时间。
> 与 log.md（追加式操作日志）不同——本文件是聚合表，同一 key 只有一行，更新计数而非追加。

| key | 引用次数 | 最后引用时间 |
|---|---|---|`;

const SEPARATOR_RE = /^\s*\|\s*-+\s*\|\s*-+\s*\|\s*-+\s*\|\s*$/;
const ROW_RE = /^\s*\|(.*)\|(.*)\|(.*)\|\s*$/;

export function todayDate() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

export function parseStatusMd(content) {
  const lines = String(content ?? '').split('\n');
  let sepIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (SEPARATOR_RE.test(lines[i])) {
      sepIdx = i;
      break;
    }
  }
  if (sepIdx === -1) {
    return { preamble: DEFAULT_PREAMBLE, rows: [] };
  }
  const preamble = lines.slice(0, sepIdx + 1).join('\n');
  const rows = [];
  for (let i = sepIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const m = ROW_RE.exec(line);
    if (!m) continue;
    const key = m[1].trim();
    const count = parseInt(m[2].trim(), 10);
    const lastReferenced = m[3].trim();
    if (!key || Number.isNaN(count)) continue;
    rows.push({ key, count, lastReferenced });
  }
  return { preamble, rows };
}

export function renderStatusMd({ preamble, rows }) {
  const body = rows.map((r) => `| ${r.key} | ${r.count} | ${r.lastReferenced} |`).join('\n');
  return body ? `${preamble}\n${body}\n` : `${preamble}\n`;
}

// key = 相对 wiki/ 的路径（含 draft/ 或 pages/ 前缀，不带 .md），如 "draft/260701-foo" / "pages/foo"
export function resolveKey(event, projectDir) {
  if (!event || event.tool_name !== 'Read') return null; // 非 Read 调用直接跳过，零开销
  const rawPath = event.tool_input?.file_path;
  if (typeof rawPath !== 'string' || !rawPath.includes('wiki')) return null; // 廉价子串预筛，无 fs 调用
  const personalDir = resolvePersonalDir(projectDir); // 内部 realpathSync，worktree symlink 场景解析回主仓真实路径
  if (!personalDir) return null;
  let filePath;
  try {
    // 相对路径以传入的 projectDir 为基准解析（Round 2 复审 W8 修正：原先用 pathResolve(rawPath)
    // 隐式以 process.cwd() 为基准，hook 子进程的 cwd 不一定等于 CLAUDE_PROJECT_DIR，会解析错目录；
    // rawPath 本身是绝对路径时 path.resolve 的 base 参数不生效，行为不变）。
    filePath = realpathSync(pathResolve(projectDir, rawPath));
  } catch {
    return null; // 文件已不存在 / 权限问题等，跳过不抛出
  }
  const personalWikiPrefix = personalDir.endsWith('/') ? `${personalDir}wiki/` : `${personalDir}/wiki/`;
  if (!filePath.startsWith(personalWikiPrefix)) return null; // 非 wiki 路径跳过
  if (!(filePath.includes('/pages/') || filePath.includes('/draft/'))) return null; // 只关心 pages/draft 下的页面
  return filePath.slice(personalWikiPrefix.length).replace(/\.md$/, '');
}

export function recordUsage(personalDir, key, { repoLock = RepoLock, now = todayDate, timeoutMs = 2000 } = {}) {
  const handle = repoLock.acquire(personalDir, timeoutMs);
  if (!handle) return { status: 'skipped_locked' }; // 拿不到锁就跳过，不阻塞用户的 Read
  try {
    const statusPath = join(personalDir, 'wiki', 'status.md');
    let content;
    try {
      content = readFileSync(statusPath, 'utf8');
    } catch {
      content = `${DEFAULT_PREAMBLE}\n`;
    }
    const parsed = parseStatusMd(content);
    const today = typeof now === 'function' ? now() : now;
    const row = parsed.rows.find((r) => r.key === key);
    if (row) {
      row.count += 1;
      row.lastReferenced = today;
    } else {
      parsed.rows.push({ key, count: 1, lastReferenced: today });
    }
    mkdirSync(dirname(statusPath), { recursive: true });
    writeFileSync(statusPath, renderStatusMd(parsed));
    return { status: 'recorded', key, count: row ? row.count : 1 };
  } finally {
    repoLock.release(handle);
  }
}

function main() {
  let event;
  try {
    event = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    process.exit(0);
  }

  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  let key;
  try {
    key = resolveKey(event, projectDir);
  } catch (e) {
    process.stderr.write(`[usage-tracker] WARN: resolveKey failed: ${e.message}\n`);
    process.exit(0);
  }
  if (!key) process.exit(0);

  const personalDir = resolvePersonalDir(projectDir);
  if (!personalDir) process.exit(0); // 理论上 resolveKey 已保证非空，双重防御

  try {
    recordUsage(personalDir, key);
  } catch (e) {
    process.stderr.write(`[usage-tracker] WARN: recordUsage failed: ${e.message}\n`);
  }
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
```

```javascript
// hooks/usage-tracker.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import {
  resolveKey,
  recordUsage,
  parseStatusMd,
  renderStatusMd,
  todayDate,
  DEFAULT_PREAMBLE,
} from './usage-tracker.mjs';
import { RepoLock } from '../scripts/repo-lock.mjs';

function makeTmpDir() {
  return mkdtempSync(join(tmpdir(), 'ut-test-'));
}

function runScript(stdinObj, env = {}) {
  const script = join(import.meta.dirname, 'usage-tracker.mjs');
  return execFileSync('node', [script], {
    encoding: 'utf8',
    input: JSON.stringify(stdinObj),
    env: { ...process.env, ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

test('resolveKey: 非 Read 工具调用 → null，无副作用', () => {
  const tmp = makeTmpDir();
  try {
    const personal = join(tmp, '.agents-personal');
    mkdirSync(join(personal, 'wiki', 'pages'), { recursive: true });
    writeFileSync(join(personal, 'wiki', 'pages', 'foo.md'), '# foo');
    const event = { tool_name: 'Write', tool_input: { file_path: join(personal, 'wiki', 'pages', 'foo.md') } };
    assert.equal(resolveKey(event, tmp), null);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('resolveKey: Read 但 file_path 不含 "wiki" 子串 → null', () => {
  const tmp = makeTmpDir();
  try {
    const personal = join(tmp, '.agents-personal');
    mkdirSync(personal, { recursive: true });
    const outside = join(tmp, 'README.md');
    writeFileSync(outside, '# readme');
    const event = { tool_name: 'Read', tool_input: { file_path: outside } };
    assert.equal(resolveKey(event, tmp), null);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('resolveKey: 无 .agents-personal/ → null', () => {
  const tmp = makeTmpDir();
  try {
    const event = { tool_name: 'Read', tool_input: { file_path: join(tmp, 'some-wiki-file.md') } };
    assert.equal(resolveKey(event, tmp), null);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('resolveKey: Read wiki/ 下但非 pages|draft（如 index.md）→ 跳过', () => {
  const tmp = makeTmpDir();
  try {
    const personal = join(tmp, '.agents-personal');
    mkdirSync(join(personal, 'wiki'), { recursive: true });
    writeFileSync(join(personal, 'wiki', 'index.md'), '# index');
    const event = { tool_name: 'Read', tool_input: { file_path: join(personal, 'wiki', 'index.md') } };
    assert.equal(resolveKey(event, tmp), null);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('resolveKey: Read wiki/pages/ 页面 → 命中，key 去掉 .md 前缀含 pages/', () => {
  const tmp = makeTmpDir();
  try {
    const personal = join(tmp, '.agents-personal');
    mkdirSync(join(personal, 'wiki', 'pages'), { recursive: true });
    writeFileSync(join(personal, 'wiki', 'pages', 'project-overview.md'), '# overview');
    const event = { tool_name: 'Read', tool_input: { file_path: join(personal, 'wiki', 'pages', 'project-overview.md') } };
    assert.equal(resolveKey(event, tmp), 'pages/project-overview');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('resolveKey: Read wiki/draft/ 页面 → 命中，key 含 draft/ 前缀（与同名 pages/ 页不合并）', () => {
  const tmp = makeTmpDir();
  try {
    const personal = join(tmp, '.agents-personal');
    mkdirSync(join(personal, 'wiki', 'draft'), { recursive: true });
    mkdirSync(join(personal, 'wiki', 'pages'), { recursive: true });
    writeFileSync(join(personal, 'wiki', 'draft', '260701-foo.md'), '# draft foo');
    writeFileSync(join(personal, 'wiki', 'pages', 'foo.md'), '# real foo');
    const draftEvent = { tool_name: 'Read', tool_input: { file_path: join(personal, 'wiki', 'draft', '260701-foo.md') } };
    const pageEvent = { tool_name: 'Read', tool_input: { file_path: join(personal, 'wiki', 'pages', 'foo.md') } };
    assert.equal(resolveKey(draftEvent, tmp), 'draft/260701-foo');
    assert.equal(resolveKey(pageEvent, tmp), 'pages/foo');
    assert.notEqual(resolveKey(draftEvent, tmp), resolveKey(pageEvent, tmp));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('resolveKey: 相对路径输入以 projectDir 为基准解析（不依赖 process.cwd()，Round 2 复审 W8）', () => {
  const tmp = makeTmpDir();
  const cwdBefore = process.cwd();
  try {
    const personal = join(tmp, '.agents-personal');
    mkdirSync(join(personal, 'wiki', 'pages'), { recursive: true });
    writeFileSync(join(personal, 'wiki', 'pages', 'rel.md'), '# rel');
    process.chdir(tmpdir()); // 故意让 cwd 偏离 projectDir，验证解析不依赖 cwd
    const event = { tool_name: 'Read', tool_input: { file_path: '.agents-personal/wiki/pages/rel.md' } };
    assert.equal(resolveKey(event, tmp), 'pages/rel');
  } finally {
    process.chdir(cwdBefore);
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('resolveKey: file_path 已不存在（realpathSync 失败）→ null，不抛出', () => {
  const tmp = makeTmpDir();
  try {
    const personal = join(tmp, '.agents-personal');
    mkdirSync(join(personal, 'wiki', 'pages'), { recursive: true });
    const event = { tool_name: 'Read', tool_input: { file_path: join(personal, 'wiki', 'pages', 'gone.md') } };
    assert.doesNotThrow(() => resolveKey(event, tmp));
    assert.equal(resolveKey(event, tmp), null);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('resolveKey: tool_input 缺失 / file_path 非字符串 → null，不抛出', () => {
  assert.equal(resolveKey({ tool_name: 'Read' }, '/tmp'), null);
  assert.equal(resolveKey({ tool_name: 'Read', tool_input: {} }, '/tmp'), null);
  assert.equal(resolveKey({ tool_name: 'Read', tool_input: { file_path: 123 } }, '/tmp'), null);
});

test('resolveKey: worktree symlink 场景下 key 与主仓一致（不会因入口路径不同而分裂成两行）', () => {
  const tmp = makeTmpDir();
  try {
    const mainProject = join(tmp, 'main-project');
    const worktreeProject = join(tmp, 'worktree');
    const physicalPersonal = join(mainProject, '.agents-personal');

    mkdirSync(join(physicalPersonal, 'wiki', 'pages'), { recursive: true });
    writeFileSync(join(physicalPersonal, 'wiki', 'pages', 'shared.md'), '# shared');
    mkdirSync(worktreeProject, { recursive: true });
    symlinkSync(physicalPersonal, join(worktreeProject, '.agents-personal'));

    const eventFromMain = {
      tool_name: 'Read',
      tool_input: { file_path: join(mainProject, '.agents-personal', 'wiki', 'pages', 'shared.md') },
    };
    const eventFromWorktree = {
      tool_name: 'Read',
      tool_input: { file_path: join(worktreeProject, '.agents-personal', 'wiki', 'pages', 'shared.md') },
    };

    const keyFromMain = resolveKey(eventFromMain, mainProject);
    const keyFromWorktree = resolveKey(eventFromWorktree, worktreeProject);

    assert.equal(keyFromMain, 'pages/shared');
    assert.equal(keyFromWorktree, 'pages/shared');
    assert.equal(keyFromMain, keyFromWorktree, '同一物理页面无论从哪个 worktree 读, key 必须一致');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('resolveKey: 断裂 symlink（指向不存在路径）→ null，不崩溃', () => {
  const tmp = makeTmpDir();
  try {
    symlinkSync('/nonexistent/path/.agents-personal', join(tmp, '.agents-personal'));
    const event = { tool_name: 'Read', tool_input: { file_path: join(tmp, '.agents-personal', 'wiki', 'pages', 'x.md') } };
    assert.doesNotThrow(() => resolveKey(event, tmp));
    assert.equal(resolveKey(event, tmp), null);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('parseStatusMd: 空内容 → 默认 preamble，rows 为空', () => {
  const parsed = parseStatusMd('');
  assert.equal(parsed.preamble, DEFAULT_PREAMBLE);
  assert.deepEqual(parsed.rows, []);
});

test('parseStatusMd: 无合法表格（损坏内容）→ 退化为默认骨架', () => {
  const parsed = parseStatusMd('# 随便写点什么\n没有表格\n');
  assert.equal(parsed.preamble, DEFAULT_PREAMBLE);
  assert.deepEqual(parsed.rows, []);
});

test('parseStatusMd: 解析已有表格行', () => {
  const content = `${DEFAULT_PREAMBLE}\n| pages/project-overview | 12 | 260701 |\n| draft/260701-hooks-system | 3 | 260628 |\n`;
  const parsed = parseStatusMd(content);
  assert.equal(parsed.rows.length, 2);
  assert.deepEqual(parsed.rows[0], { key: 'pages/project-overview', count: 12, lastReferenced: '260701' });
  assert.deepEqual(parsed.rows[1], { key: 'draft/260701-hooks-system', count: 3, lastReferenced: '260628' });
});

test('renderStatusMd → parseStatusMd 往返一致', () => {
  const rows = [
    { key: 'pages/a', count: 1, lastReferenced: '260701' },
    { key: 'draft/260701-b', count: 5, lastReferenced: '260630' },
  ];
  const rendered = renderStatusMd({ preamble: DEFAULT_PREAMBLE, rows });
  const reparsed = parseStatusMd(rendered);
  assert.deepEqual(reparsed.rows, rows);
});

test('todayDate: 返回 6 位 YYMMDD 格式', () => {
  assert.match(todayDate(), /^\d{6}$/);
});

test('recordUsage: status.md 不存在 → 创建骨架并写入新行', () => {
  const tmp = makeTmpDir();
  try {
    const personal = join(tmp, '.agents-personal');
    mkdirSync(personal, { recursive: true });
    const result = recordUsage(personal, 'pages/new-page', { repoLock: RepoLock, now: () => '260701' });
    assert.equal(result.status, 'recorded');
    assert.equal(result.count, 1);

    const statusPath = join(personal, 'wiki', 'status.md');
    assert.ok(existsSync(statusPath));
    const parsed = parseStatusMd(readFileSync(statusPath, 'utf8'));
    assert.deepEqual(parsed.rows, [{ key: 'pages/new-page', count: 1, lastReferenced: '260701' }]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('recordUsage: 已有 key → 计数+1，最后引用时间刷新', () => {
  const tmp = makeTmpDir();
  try {
    const personal = join(tmp, '.agents-personal');
    mkdirSync(join(personal, 'wiki'), { recursive: true });
    writeFileSync(join(personal, 'wiki', 'status.md'), `${DEFAULT_PREAMBLE}\n| pages/existing | 4 | 260601 |\n`);

    const result = recordUsage(personal, 'pages/existing', { repoLock: RepoLock, now: () => '260701' });
    assert.equal(result.status, 'recorded');
    assert.equal(result.count, 5);

    const parsed = parseStatusMd(readFileSync(join(personal, 'wiki', 'status.md'), 'utf8'));
    assert.deepEqual(parsed.rows, [{ key: 'pages/existing', count: 5, lastReferenced: '260701' }]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('recordUsage: 新 key（status.md 里没有）→ 新增一行，已有行不受影响', () => {
  const tmp = makeTmpDir();
  try {
    const personal = join(tmp, '.agents-personal');
    mkdirSync(join(personal, 'wiki'), { recursive: true });
    writeFileSync(join(personal, 'wiki', 'status.md'), `${DEFAULT_PREAMBLE}\n| pages/old | 2 | 260601 |\n`);

    recordUsage(personal, 'pages/brand-new', { repoLock: RepoLock, now: () => '260701' });

    const parsed = parseStatusMd(readFileSync(join(personal, 'wiki', 'status.md'), 'utf8'));
    assert.equal(parsed.rows.length, 2);
    assert.deepEqual(parsed.rows[0], { key: 'pages/old', count: 2, lastReferenced: '260601' });
    assert.deepEqual(parsed.rows[1], { key: 'pages/brand-new', count: 1, lastReferenced: '260701' });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('recordUsage: 拿不到锁 → 返回 skipped_locked，不写文件，不阻塞', () => {
  const tmp = makeTmpDir();
  try {
    const personal = join(tmp, '.agents-personal');
    mkdirSync(personal, { recursive: true });
    const fakeLock = { acquire: () => null, release: () => { throw new Error('不应被调用'); } };
    const result = recordUsage(personal, 'pages/x', { repoLock: fakeLock });
    assert.equal(result.status, 'skipped_locked');
    assert.ok(!existsSync(join(personal, 'wiki', 'status.md')));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('集成: 复用同一把 RepoLock — 锁被占用时短超时返回 null 不阻塞，释放后立即可用', () => {
  const tmp = makeTmpDir();
  try {
    const personal = join(tmp, '.agents-personal');
    mkdirSync(personal, { recursive: true });

    const handle = RepoLock.acquire(personal, 2000);
    assert.ok(handle, '应先成功拿到锁');

    const blocked = recordUsage(personal, 'pages/x', { repoLock: RepoLock, timeoutMs: 150 });
    assert.equal(blocked.status, 'skipped_locked', '锁被占用时应短超时跳过而不是死等');

    RepoLock.release(handle);

    const ok = recordUsage(personal, 'pages/x', { repoLock: RepoLock, now: () => '260701' });
    assert.equal(ok.status, 'recorded', '锁释放后应能立即成功记录');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('CLI: 非 Read 事件 → exit 0，无副作用', () => {
  const tmp = makeTmpDir();
  try {
    const personal = join(tmp, '.agents-personal');
    mkdirSync(join(personal, 'wiki', 'pages'), { recursive: true });
    writeFileSync(join(personal, 'wiki', 'pages', 'foo.md'), '# foo');
    runScript(
      { tool_name: 'Write', tool_input: { file_path: join(personal, 'wiki', 'pages', 'foo.md') } },
      { CLAUDE_PROJECT_DIR: tmp },
    );
    assert.ok(!existsSync(join(personal, 'wiki', 'status.md')));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('CLI: 命中 wiki 页 → status.md 落盘且计数正确', () => {
  const tmp = makeTmpDir();
  try {
    const personal = join(tmp, '.agents-personal');
    mkdirSync(join(personal, 'wiki', 'pages'), { recursive: true });
    writeFileSync(join(personal, 'wiki', 'pages', 'foo.md'), '# foo');

    runScript(
      { tool_name: 'Read', tool_input: { file_path: join(personal, 'wiki', 'pages', 'foo.md') } },
      { CLAUDE_PROJECT_DIR: tmp },
    );
    runScript(
      { tool_name: 'Read', tool_input: { file_path: join(personal, 'wiki', 'pages', 'foo.md') } },
      { CLAUDE_PROJECT_DIR: tmp },
    );

    const parsed = parseStatusMd(readFileSync(join(personal, 'wiki', 'status.md'), 'utf8'));
    assert.equal(parsed.rows.length, 1);
    assert.equal(parsed.rows[0].key, 'pages/foo');
    assert.equal(parsed.rows[0].count, 2);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('CLI: worktree symlink 场景下正确记到主仓真实项目', () => {
  const tmp = makeTmpDir();
  try {
    const mainProject = join(tmp, 'main-project');
    const worktreeProject = join(tmp, 'worktree');
    const physicalPersonal = join(mainProject, '.agents-personal');

    mkdirSync(join(physicalPersonal, 'wiki', 'pages'), { recursive: true });
    writeFileSync(join(physicalPersonal, 'wiki', 'pages', 'shared.md'), '# shared');
    mkdirSync(worktreeProject, { recursive: true });
    symlinkSync(physicalPersonal, join(worktreeProject, '.agents-personal'));

    runScript(
      { tool_name: 'Read', tool_input: { file_path: join(worktreeProject, '.agents-personal', 'wiki', 'pages', 'shared.md') } },
      { CLAUDE_PROJECT_DIR: worktreeProject },
    );

    const statusPath = join(physicalPersonal, 'wiki', 'status.md');
    assert.ok(existsSync(statusPath), 'status.md 应写入主仓物理路径');
    const parsed = parseStatusMd(readFileSync(statusPath, 'utf8'));
    assert.deepEqual(parsed.rows, [{ key: 'pages/shared', count: 1, lastReferenced: todayDate() }]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('CLI: 非法 JSON stdin → exit 0，不抛异常', () => {
  const tmp = makeTmpDir();
  try {
    const script = join(import.meta.dirname, 'usage-tracker.mjs');
    assert.doesNotThrow(() => {
      execFileSync('node', [script], {
        encoding: 'utf8',
        input: '{ 不是合法 json',
        env: { ...process.env, CLAUDE_PROJECT_DIR: tmp },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
```

---

## Task 9: hooks.json 注册 usage-tracker [Size: XS]

**描述**：新增 PostToolUse 条目，`matcher` 精确写 `"Read"`（红军 W6 修复），与现有 `continuous-learning-v2` 的 wildcard hook 独立共存。

**验收标准**:
- [ ] `hooks.json` JSON 格式合法（`node -e "JSON.parse(...)"` 不报错）
- [ ] 新条目 matcher 是 `"Read"` 不是 `"*"`

**covers**: 跨域.1

**验证命令**:
- `node -e "JSON.parse(require('fs').readFileSync('hooks/hooks.json','utf8'))"` — 预期输出: 无报错
- `node hooks/generate.mjs --check` — 预期输出: exit 0（**注：这条只确认没有意外改坏 manifest/catalog 联动，不验证 usage-tracker 本身是否被正确触发——那部分由 Task 8 的单测 + Checkpoint 3 的人工集成测试覆盖，Plan 复审已核实两者职责边界**）

**文件**: (1 个)
- `hooks/hooks.json`（改）

**依赖**: Task 8

**真实改动**：`hooks/hooks.json` 的 `"PostToolUse"` 段（原文件唯一条目是 `continuous-learning-v2` 的通配符 hook）新增一个 `matcher: "Read"` 的独立条目：

```json
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/skills/continuous-learning-v2/hooks/observe.sh"
          }
        ]
      },
      {
        "matcher": "Read",
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/hooks/usage-tracker.mjs"
          }
        ]
      }
    ],
```

`SessionStart`/`PreToolUse`/`Stop` 三段保持原样不变。`hooks/generate.mjs` 只读校验 `SessionStart` 段的 catalog segment 数量，不涉及 `PostToolUse` 段，此改动不影响 `--check`。

---

## Task 10: plugin-dream-baseline.mjs（含 setBaseline）[Size: S]

**描述**（**Plan 复审修正**：补上"记录 baseline"这个写操作——原骨架只有 `diffSinceBaseline` 判断类接口，没有对应的写入函数，"首次运行记录 baseline"这件事被两边默认成顺手做了却没人显式实现）：`plugin-dream` 的 baseline 判断——git config key 按分支隔离（`branch.<branch>.nocode-evolve-plugin-dream-baseline`，红军 C7 修复），同时检查 commit diff 与 `git status --porcelain`（working tree 未提交改动），监控范围含本设计新增文件（红军 W7 修复）。

**验收标准**:
- [ ] `diffSinceBaseline`：首次（无 baseline）→ 返回 null，走全量分支
- [ ] `diffSinceBaseline`：baseline 存在但指向的 commit 因 rebase 丢失 → 捕获异常降级
- [ ] `diffSinceBaseline`：commit 无变化但 working tree 有未提交改动 → 判定"有变化"
- [ ] `setBaseline(pluginRoot)`：写入当前分支的 baseline git config key，值为当前 HEAD commit sha
- [ ] 监控范围含 `hooks/` `scripts/` 整目录（不只是原先两个具体文件）

**covers**: 命令.P4, 命令.P5, 命令.P6, 系统.2, 系统.4, 约束.2（plugin-dream 一侧）

**验证命令**:
- `node --test hooks/plugin-dream-baseline.test.mjs` — 预期输出: `# pass N` `# fail 0`

**文件**: (2 个)
- `scripts/plugin-dream-baseline.mjs`（NEW）
- `hooks/plugin-dream-baseline.test.mjs`（NEW）

**依赖**: None

**真实改动**：

```javascript
// scripts/plugin-dream-baseline.mjs
#!/usr/bin/env node
// plugin-dream 的增量 baseline 判断 —— 复用 freshness-check.mjs 的 git config 隔离模式（branch.<branch>.xxx）.
// 供 commands/plugin-dream.md 的 Layer2 调用（library），也可独立跑 CLI 自检:
//   node scripts/plugin-dream-baseline.mjs [pluginRoot]           查看当前 diff 判断
//   node scripts/plugin-dream-baseline.mjs --set [pluginRoot]     写入/推进 baseline 到当前 HEAD
//
// baseline 存储: git config branch.<branch>.nocode-evolve-plugin-dream-baseline
//   key 按分支隔离，不用全局 key —— 避免多 worktree/分支同时跑 /plugin-dream 时互相覆盖 baseline（红军 C7 修复，
//   与 rule-git-worktree.md 已验证的 branch.<branch>.nocode-evolve-base 模式一致）.
//
// 监控范围（红军 W7 修复，从"只列 generate.mjs/vendor-sync.mjs 两个文件"放宽到整个 hooks/ scripts/ 目录）:
//   rules/ skills/ commands/ hooks/ scripts/ rules/manifest.json .claude-plugin/plugin.json
//
// 设计: docs/superpowers/specs/3dot141/260701-dream-incremental-design.md（PluginRepo 域）
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CONFIG_KEY_SUFFIX = 'nocode-evolve-plugin-dream-baseline';

export const MONITORED_PATHS = [
  'rules/',
  'skills/',
  'commands/',
  'hooks/',
  'scripts/',
  'rules/manifest.json',
  '.claude-plugin/plugin.json',
];

function git(pluginRoot, cmd, allowFail = false) {
  try {
    // 只掐掉末尾换行/空白（trimEnd 语义），不能用 trim() —— `git status --porcelain` 首行形如
    // " M rules/rule-foo.md"（前导空格是状态码的一部分），全量 trim() 会把首行前导空格吃掉，
    // 导致按固定偏移 slice(3) 解析路径时错位（parsePorcelain 依赖这个固定偏移）。
    return execSync(`git -C "${pluginRoot}" ${cmd}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).replace(/\s+$/, '');
  } catch (e) {
    if (allowFail) return '';
    throw e;
  }
}

export function currentBranch(pluginRoot) {
  return git(pluginRoot, 'rev-parse --abbrev-ref HEAD', true) || 'HEAD';
}

function configKey(branch) {
  return `branch.${branch}.${CONFIG_KEY_SUFFIX}`;
}

function pathspecArgs() {
  return MONITORED_PATHS.map((p) => `"${p}"`).join(' ');
}

function parseNameOnly(output) {
  if (!output) return [];
  return output
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function parsePorcelain(output) {
  if (!output) return [];
  // 不能先对整行 trim() 再 slice(3) —— porcelain 每行前两个字符是状态码（未改动的一侧用空格占位，
  // 例如 " M path" 表示"已暂存无改动、working tree 有修改"），先 trim 会把这个有意义的前导空格吃掉，
  // 导致 slice(3) 少切一个字符，路径解析错位。
  return output
    .split('\n')
    .filter((l) => l.length > 0)
    .map((l) => l.slice(3).trimEnd())
    .map((p) => {
      // rename/copy 行是 "old_path -> new_path" 组合成一个字符串（Round 2 复审 W4：原实现
      // 直接把这整段当路径返回，既不是有效路径也无法用于 pathspec 过滤匹配）——取箭头后的新路径，
      // 因为对增量检测而言"文件现在在哪"才是有意义的状态。
      const arrowIdx = p.indexOf(' -> ');
      return arrowIdx === -1 ? p : p.slice(arrowIdx + 4);
    });
}

// 读取当前分支的 baseline，判断自 baseline 以来 rules/skills/commands/hooks/scripts 等受监控路径是否有变化。
// 返回:
//   null                                     — 首次运行（无 baseline）或 baseline 不可达（降级），调用方应走全量分支
//   { commitDiff: string[], dirtyFiles: string[] } — 已提交的变更文件列表 + 未提交的 working tree 变更文件列表
export function diffSinceBaseline(pluginRoot) {
  const branch = currentBranch(pluginRoot);
  const baseline = git(pluginRoot, `config ${configKey(branch)}`, true);
  if (!baseline) {
    return null; // 首次，走全量分支
  }

  const paths = pathspecArgs();
  try {
    const commitDiffRaw = git(pluginRoot, `diff --name-only ${baseline}..HEAD -- ${paths}`);
    const dirtyRaw = git(pluginRoot, `status --porcelain -- ${paths}`);
    return {
      commitDiff: parseNameOnly(commitDiffRaw),
      dirtyFiles: parsePorcelain(dirtyRaw),
    };
  } catch (e) {
    const reason = (e.message || String(e)).split('\n')[0];
    process.stderr.write(`[plugin-dream-baseline] WARN: baseline 不可达（可能因 rebase 丢失）: ${reason}\n`);
    return null; // 降级为全量分支，不让异常冒泡中断命令（C3）
  }
}

// 判断 diffSinceBaseline() 的结果是否代表"有变化"（null 视为有变化，因为 null 意味着走全量分支）。
export function hasChanges(diffResult) {
  if (!diffResult) return true;
  return diffResult.commitDiff.length > 0 || diffResult.dirtyFiles.length > 0;
}

// 把当前分支的 baseline 推进到当前 HEAD（首次运行结束后 / 一轮 /plugin-dream 检查完成后调用）。
export function setBaseline(pluginRoot) {
  const branch = currentBranch(pluginRoot);
  const headSha = git(pluginRoot, 'rev-parse HEAD');
  git(pluginRoot, `config ${configKey(branch)} ${headSha}`);
  return { branch, baseline: headSha };
}

function main() {
  const args = process.argv.slice(2);
  const setFlag = args.includes('--set');
  const pluginRoot = args.find((a) => !a.startsWith('--')) || process.cwd();

  if (setFlag) {
    const result = setBaseline(pluginRoot);
    console.log(JSON.stringify({ action: 'set', ...result }, null, 2));
    return;
  }

  const diff = diffSinceBaseline(pluginRoot);
  console.log(JSON.stringify({ action: 'diff', diff, changed: hasChanges(diff) }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
```

CLI 契约（供 Task 11 的 markdown 调用）：`node "${CLAUDE_PLUGIN_ROOT}/scripts/plugin-dream-baseline.mjs" "${CLAUDE_PLUGIN_ROOT}"` 输出 `{ action: "diff", diff: null | { commitDiff, dirtyFiles }, changed: boolean }`；`--set` 模式输出 `{ action: "set", branch, baseline }`。

```javascript
// hooks/plugin-dream-baseline.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import {
  diffSinceBaseline,
  setBaseline,
  hasChanges,
  currentBranch,
  MONITORED_PATHS,
} from '../scripts/plugin-dream-baseline.mjs';

function git(repo, cmd) {
  return execSync(`git -C "${repo}" ${cmd}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function commit(repo, message) {
  git(repo, 'add -A');
  git(repo, `-c user.name=test -c user.email=test@test.local commit -m "${message}"`);
}

function makeRepo() {
  const repo = mkdtempSync(join(tmpdir(), 'pdb-test-'));
  git(repo, 'init -q -b main');
  mkdirSync(join(repo, 'rules'), { recursive: true });
  mkdirSync(join(repo, 'skills'), { recursive: true });
  mkdirSync(join(repo, 'commands'), { recursive: true });
  mkdirSync(join(repo, 'hooks'), { recursive: true });
  mkdirSync(join(repo, 'scripts'), { recursive: true });
  mkdirSync(join(repo, '.claude-plugin'), { recursive: true });
  mkdirSync(join(repo, 'docs'), { recursive: true }); // 监控范围之外的目录，用来验证"变化不计入"

  writeFileSync(join(repo, 'rules', 'rule-foo.md'), '# rule-foo v1\n');
  writeFileSync(join(repo, 'rules', 'manifest.json'), '{"buckets":[],"rules":[]}\n');
  writeFileSync(join(repo, 'hooks', 'generate.mjs'), '// generate v1\n');
  writeFileSync(join(repo, 'scripts', 'vendor-sync.mjs'), '// vendor-sync v1\n');
  writeFileSync(join(repo, '.claude-plugin', 'plugin.json'), '{"version":"1.0.0"}\n');
  writeFileSync(join(repo, 'docs', 'readme.md'), '# docs\n');
  commit(repo, 'init');

  git(repo, 'checkout -q -b feat/dream-incremental');
  return repo;
}

function cleanup(repo) {
  rmSync(repo, { recursive: true, force: true });
}

test('首次运行（无 baseline）→ 返回 null', () => {
  const repo = makeRepo();
  try {
    const result = diffSinceBaseline(repo);
    assert.equal(result, null);
  } finally {
    cleanup(repo);
  }
});

test('baseline 指向的 commit 不可达（模拟 rebase 丢失）→ 捕获异常降级为 null', () => {
  const repo = makeRepo();
  try {
    const branch = currentBranch(repo);
    const fakeSha = '0'.repeat(40);
    git(repo, `config branch.${branch}.nocode-evolve-plugin-dream-baseline ${fakeSha}`);

    const result = diffSinceBaseline(repo);
    assert.equal(result, null, '异常应被捕获，不冒泡，降级为 null（走全量分支）');
  } finally {
    cleanup(repo);
  }
});

test('commit 无变化但 working tree 有未提交改动 → 判定"有变化"', () => {
  const repo = makeRepo();
  try {
    setBaseline(repo);
    writeFileSync(join(repo, 'rules', 'rule-foo.md'), '# rule-foo v2 (uncommitted)\n');

    const result = diffSinceBaseline(repo);
    assert.notEqual(result, null);
    assert.equal(result.commitDiff.length, 0, 'commit 层面没有新变化');
    assert.ok(result.dirtyFiles.includes('rules/rule-foo.md'), 'working tree 未提交改动应被捕捉');
    assert.equal(hasChanges(result), true);
  } finally {
    cleanup(repo);
  }
});

test('setBaseline(pluginRoot) 写入当前分支的 baseline git config key，值为当前 HEAD commit sha', () => {
  const repo = makeRepo();
  try {
    const branch = currentBranch(repo);
    const headSha = git(repo, 'rev-parse HEAD');

    const result = setBaseline(repo);
    assert.equal(result.branch, branch);
    assert.equal(result.baseline, headSha);

    const configured = git(repo, `config branch.${branch}.nocode-evolve-plugin-dream-baseline`);
    assert.equal(configured, headSha);
  } finally {
    cleanup(repo);
  }
});

test('监控范围常量含 hooks/ 与 scripts/ 整个目录（不只是 generate.mjs/vendor-sync.mjs 两个具体文件）', () => {
  assert.ok(MONITORED_PATHS.includes('hooks/'));
  assert.ok(MONITORED_PATHS.includes('scripts/'));
  assert.ok(
    !MONITORED_PATHS.some((p) => p.includes('generate.mjs') || p.includes('vendor-sync.mjs')),
    '不应硬编码具体文件名——应是整个目录路径'
  );
});

test('监控范围含 hooks/ scripts/ 整目录 → 该目录下新文件（非 generate.mjs/vendor-sync.mjs）也能被增量检测捕获', () => {
  const repo = makeRepo();
  try {
    setBaseline(repo);

    writeFileSync(join(repo, 'hooks', 'usage-tracker.mjs'), '// usage-tracker v1\n');
    writeFileSync(join(repo, 'scripts', 'repo-lock.mjs'), '// repo-lock v1\n');
    commit(repo, 'add usage-tracker + repo-lock');

    const result = diffSinceBaseline(repo);
    assert.notEqual(result, null);
    assert.ok(result.commitDiff.includes('hooks/usage-tracker.mjs'));
    assert.ok(result.commitDiff.includes('scripts/repo-lock.mjs'));
    assert.equal(hasChanges(result), true);
  } finally {
    cleanup(repo);
  }
});

test('baseline 之后完全无变化（无新 commit、working tree clean）→ 判定"无变化"', () => {
  const repo = makeRepo();
  try {
    setBaseline(repo);
    const result = diffSinceBaseline(repo);
    assert.deepEqual(result, { commitDiff: [], dirtyFiles: [] });
    assert.equal(hasChanges(result), false);
  } finally {
    cleanup(repo);
  }
});

test('监控范围之外的路径（如 docs/）变化不计入 diff', () => {
  const repo = makeRepo();
  try {
    setBaseline(repo);
    writeFileSync(join(repo, 'docs', 'readme.md'), '# docs v2\n');
    commit(repo, 'update docs only');

    const result = diffSinceBaseline(repo);
    assert.notEqual(result, null);
    assert.equal(result.commitDiff.length, 0, 'docs/ 不在监控范围内，不应计入 commitDiff');
    assert.equal(hasChanges(result), false);
  } finally {
    cleanup(repo);
  }
});

test('分支名含斜杠（如 feat/dream-incremental）时 baseline 读写不受影响', () => {
  const repo = makeRepo();
  try {
    const branch = currentBranch(repo);
    assert.equal(branch, 'feat/dream-incremental');

    setBaseline(repo);
    const configured = git(repo, `config branch.${branch}.nocode-evolve-plugin-dream-baseline`);
    assert.ok(configured, '带斜杠的分支名也应能正确写入/读取 git config');
  } finally {
    cleanup(repo);
  }
});

test('working tree 有 rename（如 rules/rule-foo.md → rules/rule-bar.md）→ dirtyFiles 取重命名后的新路径（Round 2 复审 W4）', () => {
  const repo = makeRepo();
  try {
    setBaseline(repo);
    git(repo, 'mv rules/rule-foo.md rules/rule-bar.md');

    const result = diffSinceBaseline(repo);
    assert.notEqual(result, null);
    assert.ok(
      result.dirtyFiles.includes('rules/rule-bar.md'),
      `rename 行应解析出新路径而非 "old -> new" 组合字符串（实际: ${JSON.stringify(result.dirtyFiles)}）`
    );
    assert.ok(!result.dirtyFiles.some((p) => p.includes(' -> ')), '不应残留箭头分隔的组合字符串');
  } finally {
    cleanup(repo);
  }
});
```

---

## Task 11: commands/plugin-dream.md 接入增量 [Size: XS]

**描述**：Layer2（语义检查）接入 `plugin-dream-baseline.mjs` 的增量判断 + 首次运行调用 `setBaseline`；Layer1（机械命令）保持全量跑（本来就快）。

**验收标准**:
- [ ] 无变化时秒回"无需维护"
- [ ] 有变化时 Layer2 只深查改动文件，Layer1 仍全量跑
- [ ] 首次运行结束后 `setBaseline` 被调用，git config 里能查到新写入的 baseline

**covers**: 命令.P4, 命令.P5, 命令.P6

**验证命令**:
- 人工验证：实跑 `/plugin-dream` 两次，第二次确认秒回；`git config --get branch.<branch>.nocode-evolve-plugin-dream-baseline` 确认首次运行后有值

**文件**: (1 个)
- `commands/plugin-dream.md`（改）

**依赖**: Task 10

**真实改动**（基于当前 `commands/plugin-dream.md` 全文；4 处改动均标注确切插入/替换位置）：

**改动 1 — 插入新的 Phase 0（插入位置：`### Phase 1: Scan（两层检测）`之前）**：

```markdown
### Phase 0: 增量范围判断（Baseline Diff）

先于 Phase 1 的任何检测，用 `scripts/plugin-dream-baseline.mjs` 判断本次要跑多大范围：

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/plugin-dream-baseline.mjs" "${CLAUDE_PLUGIN_ROOT}"
```

解析输出 JSON（`{ action: "diff", diff: null | { commitDiff, dirtyFiles }, changed: boolean }`），按以下分支处理：

| `diff` | `changed` | 处理 |
|---|---|---|
| `null`（首次运行，或 baseline 指向的 commit 因 rebase 等原因不可达） | `true` | 走全量：Phase 1 Layer1 + Layer2 都对全部对象跑；本轮 Phase 3 执行完毕后进入 **Phase 4**，调用 `setBaseline` 记录本次 HEAD 为新 baseline |
| 非 `null` 且 `commitDiff`/`dirtyFiles` 均为空 | `false` | **秒回**，不进入 Phase 1，直接输出：`✓ plugin-dream：自上次检查以来 rules/skills/commands/hooks/scripts/rules/manifest.json/.claude-plugin/plugin.json 无变化，无需维护`，命令结束 |
| 非 `null` 且 `commitDiff`/`dirtyFiles` 至少一个非空 | `true` | 合并 `commitDiff ∪ dirtyFiles` 得到"变更文件集合"，继续 Phase 1；Layer2 只对该集合覆盖到的 rule/skill/command 对象跑检测；本轮 Phase 3 执行完毕后**同样进入 Phase 4**，调用 `setBaseline` 把 baseline 推进到本次 HEAD（**Round 2 复审 Critical 修正，C4**：原表述"不进入 Phase 4"会导致处理过一轮变化后 baseline 永远停在旧点，diff 范围只会越滚越大，秒回永久失效——处理完必须前移，不止首次运行才前移）|

> 这一步不可跳过——即使用户在参数里指定了范围（如"只查 rule"），也先跑本判断决定 Layer2 的候选文件集合是"全部 rule"还是"变更文件集合 ∩ rule"。
```

**改动 2 — Layer1 标题补充说明（不改动下面的表格）**：

原文：`#### Layer 1 — 客观漂移（机械可测，跑现成命令）`

替换为：`#### Layer 1 — 客观漂移（机械可测，跑现成命令；不受 Phase 0 增量范围影响，每次都全量跑——generate.mjs --check/vendor-sync.mjs --check 本身足够快，不需要增量优化）`

**改动 3 — Layer2 标题补充扫描范围说明**：

原文：`#### Layer 2 — 边界符合性（语义，按对象类型分组读文件判断；单文件级判据，不跨文件推理，保证结论可复现）`

替换为原文 + 追加一段：

```markdown
> **扫描范围**：若 Phase 0 判定为"首次运行/降级"，以下每类对象全量扫描；若判定为"有变化"，每类对象只扫描 Phase 0 产出的"变更文件集合"里出现的那些 `rules/*.md` / `skills/*/SKILL.md` / `commands/*.md`（一个对象文件本身或其 manifest 条目出现在变更集合即算命中），其余对象本轮跳过。
```

**改动 4 — 插入新的 Phase 4（插入位置：`### 完成报告` 之前）**：

```markdown
### Phase 4: 记录 Baseline（首次运行/降级、以及处理完变化之后都执行）

只要没有在 Phase 0 判定"秒回"提前结束（即走到了这里，不论是"首次运行/降级"全量跑完，还是"有变化"处理完毕），本步骤都要执行：

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/plugin-dream-baseline.mjs" --set "${CLAUDE_PLUGIN_ROOT}"
```

`setBaseline` 把 baseline 推进到当前 HEAD——这样下次 `/plugin-dream` 才能拿"这次处理完的点"作为新起点做增量判断；只有 Phase 0 判定"秒回"（无任何变化）时才跳过本步骤，因为那种情况根本不会执行到 Phase 1-3。
```

---

## ✅ Checkpoint 3: 覆盖 Task 8-11（UsageTracking 域 + PluginRepo 域接入）

**全部测试**:
- `node --test 'hooks/*.test.mjs'` — 预期: all passing

**用户 Review**:
- [ ] demo：实跑 `/personal-dream`，读一个 wiki 页后确认 status.md 有记录
- [ ] demo：`/plugin-dream` 首次运行后 git config 确认 baseline 已写入
- [ ] 用户确认继续 / 调整 / 回滚

**Rollback 点**：此 checkpoint 之前 Task 8-11 已各自 commit。

---

## Task 12: .claude-plugin/plugin.json 版本升级 [Size: XS]

**描述**（**Plan 复审新增**：原骨架完全遗漏这个 task，违反 CLAUDE.md「修改插件后升级版本号」规则——本次改动涉及 hooks/ scripts/ commands/ 多个被插件加载的文件，属于 minor 升级）：SemVer minor 升级（新增 hook + 重写脚本 + 新增命令行为，非破坏性变更）。

**验收标准**:
- [ ] `version` 字段按 SemVer minor 升级（如 `5.3.0` → `5.4.0`）
- [ ] 变更包含在收尾 commit 里

**covers**: （无对应 restate 路径，CLAUDE.md 流程规则）

**验证命令**:
- `node -e "console.log(require('./.claude-plugin/plugin.json').version)"` — 预期输出: 新版本号

**文件**: (1 个)
- `.claude-plugin/plugin.json`（改）

**依赖**: Task 1-11 全部完成

**真实改动**：当前 `.claude-plugin/plugin.json` 的 `"version"` 字段现值为 `"5.4.1"`。改为：

```diff
-  "version": "5.4.1",
+  "version": "5.5.0",
```

（minor 升级：本次新增 `hooks/usage-tracker.mjs` 的 PostToolUse hook + 重写 `personal-snapshot.mjs`/新增 `personal-migrate.mjs`/`repo-lock.mjs`/`dream-baseline.mjs`/`plugin-dream-baseline.mjs`/`project-tree-detect.mjs` + 三个 `commands/*.md` 行为变更，均非破坏性变更，符合 CLAUDE.md「新增 hook / skill / 兼容性增强 → minor」。）

---

## ✅ Checkpoint 4: 覆盖 Task 12（全部完成，最终验收）

**全部测试**:
- `node --test 'hooks/*.test.mjs'` — 预期: all passing
- `node hooks/generate.mjs --check` — 预期: exit 0

**用户 Review**:
- [ ] demo：三个 dream 命令各跑两次，确认首次全量、第二次秒回/增量
- [ ] 人工核对 TO-12（删除护栏行为不变）+ TO-18（project-dream 不含段落级遗忘/引用频率逻辑）
- [ ] 用户确认继续 / 调整 / 回滚

**Rollback 点**：此 checkpoint 之前 Task 12 已 commit。

## 路径→Task 映射表（已修正内部一致性）

| 路径/约束 | Task |
|---|---|
| 命令.P1 | T3, T6（首次运行的初始化/迁移/全量深查横跨两个 task 共同覆盖；T3 已合并原骨架 T3/T4，一并含初始化与迁移逻辑）|
| 命令.P2 | T6 |
| 命令.P3 | T5 |
| 命令.P4/P5/P6 | T10, T11 |
| 命令.P7/P8/P9 | T2, T7 |
| 跨域.1 | T8, T9 |
| 跨域.2 | 人工核对（Checkpoint 4）|
| 跨域.3 | T6 |
| 跨域.4 | T3 |
| 系统.1 | T5 |
| 系统.2/系统.4 | T10 |
| 系统.3 | T2, T7 |
| 系统.5 | T3（迁移逻辑，原骨架 T4，已合并进 T3）|
| 系统.6 | T1 |
| 约束.1 | T6 |
| 约束.2 | T3（personal-dream 一侧）, T10（plugin-dream 一侧，本轮复审补上）|
| 约束.3 | 人工核对（Checkpoint 4）|
| 约束.4 | 不实现，仅设计文档「部署注意事项」说明 |

## Plan Review Log

**Round 1 骨架红蓝对抗（heavy 档，dev-plan 强制）**：sequential-thinking 第一性原理拆解 → 蓝军自评 → 独立审查（general-purpose subagent + Codex 红军并行，CLAIM 剥离）→ Step4 结论。

**倾向**：原骨架的依赖图/四域拆分/切片顺序思路合理，但独立审查发现的以下问题是真问题，已修正：

- **Critical 1**（subagent 发现）：baseline ref 命名公式 `refs/dream/last-baseline/<relative-path>` 在 `dirPath===gitRoot`（最常见默认调用）时产生非法尾斜杠 ref，且不同目标间会有 D/F 冲突 → 改为扁平化命名 `refs/dream/last-baseline__<flat-suffix>`，落到 Task 2 新增的 `project-tree-detect.mjs`
- **Critical 2**（我自查 + Codex + subagent 三路独立命中）：ProjectTreeBaseline 域的 `detectGitRepo`/`promptInitIfNeeded` 没有脚本/测试承载，"上层项目根"推断算法未定义 → 新增 Task 2，定义具体算法（逐级向上找 `.git`，找不到则两候选退化为同一个）
- **Critical 3**（Codex + subagent 独立发现）：迁移检测入口归属在 T2/T3/T5（旧编号）之间不清楚 → 明确落在 Task 3 的 `ensureNestedRepo` 内部
- **Critical 4**（Codex 发现）：漏了 `.claude-plugin/plugin.json` 版本升级 → 新增 Task 12
- **Warning**（Codex + subagent 独立发现）：T8（原 T6）漏画对 T3（原 T2）的隐式依赖（`resolvePersonalDir` 符号耦合）→ 依赖图已补
- **Warning**（Codex + subagent 独立发现）：T5（原 T4）不该无条件对 project-dream 也调用 PersonalHistory 专属的 snapshot → 改为 `prepareFn` 可选回调 + `pathspec` 参数
- **Warning**（Codex + subagent 独立发现）：命令.P1 覆盖在原 task 描述与映射表之间自相矛盾 → 映射表改为显式列出共同覆盖的多个 task
- **Warning**（subagent 发现）：约束.2 覆盖遗漏 plugin-dream 一侧 → 映射表补上 T10
- **Warning**（subagent 发现）："记录 baseline"写操作没有归属 → Task 10 补 `setBaseline` 接口 + 验收标准
- **Warning**（Codex + subagent 从不同角度独立命中）：risk-first 排序低估 T2（原 T10，project-tree-detect）的不确定性、也低估了 usage-tracker 的爆炸半径 → project-tree-detect 提前到第二位；usage-tracker 的 size 调整为 M，排序保持在中段（理由：build 顺序按不确定性/返工代价排，不等同于生产爆炸半径排序，已在切片策略里说明）

**Suggestion 处理**：T6/T10（旧编号）size 偏乐观 → 已调整；T7 验证命令覆盖不到 hooks.json 改动的实际效果 → 已在验证命令备注里说明职责边界，接受由 Task 8 单测 + Checkpoint 3 集成验证兜底，不额外增加机械但无效的检查。

修正后未再触发新一轮独立审查——本轮修订均为收窄/补全已识别缺口，不引入新的架构决策点。

**Round 2 填充代码红蓝对抗（heavy 档，dev-plan 强制）**：Round 1 骨架填充为真实代码 + 测试后，对完整计划做第二轮独立审查——general-purpose subagent + Codex 红军并行，CLAIM 剥离，评估"这份填充了真实代码的计划拿去执行可行吗"。

**倾向**：核心切片顺序和模块边界在骨架阶段已经审过一轮，Round 2 命中的问题集中在"填充后才会暴露的执行期 bug"——文件级循环依赖、跨 task 文本互相矛盾、边界场景（空仓库/rename/无锁校验）没覆盖，符合"骨架错误早发现、代码错误填充后才会现形"的预期，不是骨架设计有问题，已逐项修正：

- **Critical 1**（subagent + Codex 独立发现）：原骨架 Task 3（personal-snapshot.mjs）与 Task 4（personal-migrate.mjs）互相静态 `import` 对方的导出符号，按"先交付 T3、独立验证、再交付 T4"的顺序执行会在 T3 单独验证时因 `personal-migrate.mjs` 还不存在而 `ERR_MODULE_NOT_FOUND`，整个测试文件加载不了 → 合并成一个 task 一次性交付两个文件，不再保留独立的"Task 4"编号（依赖图/切片策略/路径映射表/covers 字段已同步修正，见上）
- **Critical 2**（subagent 发现）：Task 6（personal-dream.md）验收标准表格写"首次运行也要前移 baseline"，但同一 task 的编辑C正文写"仅当 `changedFiles` 非 `null` 时前移"——两处字面矛盾，`changedFiles === null` 恰恰是首次运行的返回值，按编辑C字面执行会导致首次运行永远不前移、增量能力永远激活不了 → 改正编辑C为"只要执行到 Phase 3（即 Phase 1 未判定为秒回）就前移，不论首次全量还是增量有变化"
- **Critical 3**（Codex 发现）：Task 7（project-dream.md）非 git 目录 `git init` 后没有任何组件会打底第一个 commit——`prepareFn` 只在 personal-dream 场景传入，project-dream 场景显式不传——导致后续 `advanceBaseline` 对零 commit 仓库跑 `update-ref ... HEAD` 会因 unborn HEAD 报错（虽被 catch 吞掉不阻断命令，但 baseline 永远建立不起来）→ 在 `git init` 后显式补一次 `git add -A && git commit --allow-empty -m "init"`
- **Critical 4**（subagent + Codex 独立发现）：Task 11（plugin-dream.md）Phase 0 决策表"有变化"分支写"不进入 Phase 4"，导致处理完一轮变化后 baseline 永远停在旧点，diff 范围只会越滚越大、秒回永久失效 → 改正为"只要 Phase 1-3 实际执行了就进入 Phase 4 推进 baseline，不止首次运行才推进"
- **Warning（已修复）**（Codex 发现）：`scripts/repo-lock.mjs` 的 `release()` 只按路径删除锁文件，不校验内容仍是自己写的——若本进程持有的 handle 因某种原因失效、锁被其他进程重新 `acquire`，无校验的 release 会删掉别人的锁 → `acquire` 返回的 handle 附带写入时的 token（pid），`release` 先 `readFileSync` 比对内容匹配才删，不匹配则跳过不删（幂等于文件已不存在的情形）
- **Warning（已修复）**（Codex 发现）：`hooks/usage-tracker.mjs` 的 `resolveKey` 用 `pathResolve(rawPath)` 解析相对路径，隐式以 `process.cwd()` 为基准，而不是传入的 `projectDir` 参数——hook 子进程的 cwd 不一定等于 `CLAUDE_PROJECT_DIR` → 改为 `pathResolve(projectDir, rawPath)`，绝对路径输入不受影响（`path.resolve` 遇到绝对路径 base 参数自动失效）
- **Warning（已修复）**（subagent 发现）：`scripts/plugin-dream-baseline.mjs` 的 `parsePorcelain` 对 rename/copy 行（`"R  old_path -> new_path"`）直接把 `slice(3)` 后的整段当路径返回，得到的是 `"old_path -> new_path"` 这个组合字符串，既不是有效路径也无法用于后续匹配 → 检测箭头 `" -> "` 并取箭头后的新路径；`scripts/dream-baseline.mjs` 新增的 `includeDirty` 分支同步套用同一处理，避免同一个 bug 出现两份
- **Warning（已修复）**（subagent 发现）：`commands/project-dream.md` 的两处 `node -e` 调用把 `<gitRoot>`/`<dir-path>`/`<refName>` 直接拼进 JS 字符串字面量——`<dir-path>` 来自用户输入，路径若含 `'`/`` ` ``/`${...}` 会跳出字符串边界注入任意 JS 代码，与 Task 2 已验证的 `execFileSync` 数组式安全调用形成不一致 → 改为先设 shell 环境变量、JS 内用 `process.env` 读取，彻底避免用户输入被当成 JS 源码解析
- **Warning（已修复）**（Codex 发现）：`dream-baseline.mjs` 的 `diffSinceBaseline` 只做 commit 层 diff——personal-dream 场景靠 `prepareFn=snapshot` 保证 working tree 总是干净，但 project-dream 场景不传 `prepareFn`，用户在目标目录里编辑文件但未 commit 是正常状态，纯 commit diff 看不到这些改动会被误判"无变化" → 新增 `includeDirty` 选项，`true` 时叠加 `git status --porcelain` 结果；project-dream 调用点传 `includeDirty: true` + `excludePaths: ['.dream.lock']`（避免 `RepoLock` 锁文件异常残留时被当成"变更文件"自我污染）
- **Warning（接受，标注风险）**：`repo-lock.mjs` 的并发测试（case 2）只模拟同进程内两次连续 `acquire` 调用，不是真正跨进程竞态。接受理由：`fs.openSync(path, 'wx')` 的原子性由操作系统文件系统语义保证（`O_CREAT|O_EXCL`），与调用方是否跨进程无关——真正需要验证的不变量（"已存在则失败"）单进程测试同样能验证到；额外起子进程做跨进程竞态测试的边际置信度提升不足以覆盖增加的测试基础设施复杂度
- **Warning（接受，标注设计限制）**：`advanceBaseline` 的 `RepoLock` 锁文件位置是 `dirname(gitDir)`——project-dream 场景下这是用户自己项目仓库的根目录，而不是插件专属的隔离目录（如 `.agents-personal/`）。已通过 `excludePaths: ['.dream.lock']` 缓解"残留锁文件污染 diff 结果"的直接后果，但"往用户仓库根写点文件"这个设计选择本身没有改——修复需要给 `RepoLock` 增加锁文件路径的显式 override 参数，这会改变 T1/T5/T8 三处已定型调用点的既有约定，超出本轮"修 Round 2 发现的执行期 bug"的范围，留待后续迭代或用户显式要求时再处理
- **Suggestion（已顺带解决）**：旧文本里对"W7"的悬空交叉引用——在 C4 修正 Task 11 的过程中已随文本改写一并移除，核对无残留
- **Suggestion（接受）**：`currentBranch()` 在 detached HEAD 状态下返回字面量 `"HEAD"`，导致不同的 detached checkout 共享同一个 git config baseline key。接受理由：`/plugin-dream`/`/project-dream` 的正常使用场景是在具名分支上跑（worktree 惯例要求每个分支独立 worktree），detached HEAD 是非典型操作场景；即使共享 key，最坏后果是多算/少算一次 diff 范围，不影响正确性下限（数据不会丢，只是这次多扫了几个文件），成本收益比不足以在本轮修复

修正后未再触发新一轮独立审查——本轮修订全部是收窄/修正已识别的执行期问题，未引入新的架构决策点；两个"接受"标注的 Warning 已评估过修复成本与风险收益，非疏漏遗留。

## 退出条件

- [ ] 所有 task ≤ M
- [ ] 每个 task 零占位符，贴了真实代码 / 命令 / 预期输出（Round 2 填充）
- [ ] 每 2-3 task 有 checkpoint
- [ ] 用户已确认
