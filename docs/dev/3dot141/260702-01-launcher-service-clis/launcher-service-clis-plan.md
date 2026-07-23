# agents-launcher per-service CLI 拆分 Implementation Plan

**Goal**: 把 agents-launcher 的 per-service 处理（dev-start.sh 900 行 bash + orchestrator 内联 + SKILL.md prose）收敛成 server-cli / web-cli / agents-cli 三个可独立调用的 node CLI，orchestrator 退纯编排，并新增 server worktree ANTLR 生成类预热能力。
**Architecture**: 三个 CLI 为可 import 的零依赖 node ESM 模块 + `main()` 入口守卫；orchestrator import 函数直调（不 spawn 子进程）；per-service 知识单源在各 CLI 与 `lib/server/*`，共享基础设施（probe/proc/paths/env-file/ports）留 `lib/`；askUser gate 全部留在 SKILL.md 层，CLI 非交互（破坏性动作显式 flag）。
**Tech Stack**: node ESM（零外部依赖）+ node:test（exec/spawn/fetch 注入 mock）
**Design Doc**: 无（Standard 场景，Define restate 直入 Plan）
**Test Objectives**: SC-1 三 CLI 独立调用 / SC-2 web 四步 prose 收编 / SC-3 ANTLR 预热两代接线（Given 基于 origin/release 新建 server worktree，When `server-cli prepare`，Then 生成目录非空 exit 0）/ SC-4 start 链与 dev-start.sh app 等价 + orchestrator 行为不回归 / SC-5 删 bash 后零引用残留 / SC-6 node --test 全过
**Execution**: executing

> 来源：Define restate（会话内已确认，Standard 场景）。restate 路径清单：启停.P1-P5 + 系统.1/2 + 约束.1-4。

## 依赖图（无环）

```
T1 lib/probe.mjs 共享探测抽取（无依赖）
T2 server-cli 骨架+prepare（ANTLR+GraalVM）← T1
T3 server-cli infra                        ← T2
T4 server-cli start                        ← T3
T4b server-cli stop/status                 ← T4
T5 agents-cli                              ← T1（与 T2-T4b/T6 并行）
T6 web-cli                                 ← T1（并行）
T7 orchestrator 退纯编排                    ← T4b+T5+T6
T8 SKILL.md 收编+删 bash+版本 bump          ← T7
```

## 切片策略

- **垂直切片**：每 task 交付一个独立可调用能力（T2 完成即可在真实 server 仓跑 `server-cli prepare` 解 ANTLR 坑；T3 的 `infra` 动词独立可跑）。
- **Risk-first**：server 重写（T2-T4b）最不确定（bash→node 等价、GraalVM 跨平台、容器 fallback），排最前；T5/T6 简单；T7 集成、T8 文档收尾。
- **中间态防破坏**（Round 1 红蓝军修正）：T5/T6 不动 `lib/ports.mjs`/`lib/proc.mjs` 旧导出，旧导出删除统一归 T7/T8（orchestrator 切换 import 的同一批 commit）。
- **版本纪律**（红蓝裁决 I）：仓库规则要求改动插件加载文件的每个 commit 同步 bump `plugin.json`——T1-T7 patch 递增（6.5.1 → 6.5.8），T8 定稿 6.6.0；并行的 T5/T6 按实际 commit 顺序取号。

## 路径 → Task 映射

| 路径/约束 | 覆盖 task |
|---|---|
| 启停.P1 主仓启动 | T3, T4, T7 |
| 启停.P2 worktree 启动 | T5, T6, T8 |
| 启停.P3 server worktree IDE 预热 | T2, T8 |
| 启停.P4 状态与停服 | T1, T4b, T7 |
| 启停.P5 单服务操作 | T5, T6 |
| 系统.1 幂等重启 kill 链 | T1, T4, T7 |
| 系统.2 teardown | T4b, T7 |
| 约束.1 CLI 非交互/gate 留 skill | T4（killOld fail-loud）, T6（--reset 显式）, T8 |
| 约束.2 知识单源不双写 | T7 |
| 约束.3 入口语义不回归 | T7 |
| 约束.4 ANTLR 聚合 task 兼容两代 | T2 |

## 不测项（显式声明 + 风险）

| 不测项 | 原因 | 风险缓解 |
|---|---|---|
| server 容器 fallback 真实运行（无 JAVA_HOME 时 docker run temurin + gradle bootJar） | 本机有 GraalVM，无法自然触发；伪造环境成本不合理 | 命令构造有单测锚定原 bash 541-609 行；真实路径保留原语义逐行迁移 |
| bootRun 真实起 Spring 全程 | 需要完整 fx 基础设施 + 6 分钟编译，单测不可行 | C1/C3 checkpoint 真机 smoke（HITL）覆盖 |
| docker compose 真实容器编排 | 同上 | startInfra 的 exec 调用序列有 mock 断言 |

---

## 任务序列

## Task T1: 抽取 lib/probe.mjs（端口/健康探测公共化）[Size: S]

**描述**: `dev-orchestrator.mjs` 里内联的 `tcpOpen`/`httpOk`（60-70 行）和 `--status` 里的 `pidOn`（19-32 行）是三个 CLI 都要用的探测原语，抽成 `lib/probe.mjs` 独立模块，`dev-orchestrator.mjs` 改为 import，避免 server-cli/web-cli/agents-cli 各自重复实现。

**验收标准**:
- [ ] `lib/probe.mjs` 导出 `tcpOpen` / `httpOk` / `pidOnPort` 三个函数
- [ ] `dev-orchestrator.mjs` 不再内联定义这三个函数，改 import
- [ ] `node --test skills/agents-launcher/lib/probe.test.mjs` 全绿
- [ ] 现有 `node --test skills/agents-launcher/lib/*.test.mjs` 仍全绿（无回归）

**covers**: 启停.P4, 系统.1

**验证命令**:
- `node --test skills/agents-launcher/lib/probe.test.mjs` — 预期输出: `# pass 6` `# fail 0`
- `node --test skills/agents-launcher/lib/*.test.mjs` — 预期输出: 全部 pass，0 fail（含既有 186 条 + 新增）

**文件**: (2 个)
- `skills/agents-launcher/lib/probe.mjs`（新建）
- `skills/agents-launcher/lib/probe.test.mjs`（新建）
- `skills/agents-launcher/dev-orchestrator.mjs`（改：import 替换内联定义）

**依赖**: None（server-cli/web-cli/agents-cli 三条线都依赖它，是唯一的入口 task）

**真实改动**:

`skills/agents-launcher/lib/probe.mjs`：

```js
// 端口/健康探测公共原语。原内联在 dev-orchestrator.mjs（tcpOpen/httpOk 60-70 行，
// pidOn 19-32 行），三个 CLI（server-cli/web-cli/agents-cli）都要用，抽成独立模块。
import { execFileSync } from 'node:child_process';
import net from 'node:net';

// TCP 端口是否有进程在监听。
export function tcpOpen(port, { host = '127.0.0.1', timeoutMs = 800 } = {}) {
  return new Promise((res) => {
    const s = net.connect({ host, port }, () => { s.destroy(); res(true); });
    s.on('error', () => res(false));
    s.setTimeout(timeoutMs, () => { s.destroy(); res(false); });
  });
}

// HTTP 探测：2xx-4xx 视为“进程活着”（4xx 也说明服务在响应，只有网络层失败才算 DOWN）。
export async function httpOk(url, { timeoutMs = 1500 } = {}) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return r.status >= 200 && r.status < 500;
  } catch {
    return false;
  }
}

// 监听某端口的进程 PID，没有则返回 ''。可注入 exec 便于测试。
export function pidOnPort(port, { exec = execFileSync } = {}) {
  try {
    return exec('sh', ['-c', `lsof -ti tcp:${port} -sTCP:LISTEN | head -1`], { encoding: 'utf8' }).trim() || '';
  } catch {
    return '';
  }
}
```

`skills/agents-launcher/lib/probe.test.mjs`：

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { tcpOpen, httpOk, pidOnPort } from './probe.mjs';

function listenOnEphemeralPort() {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

test('tcpOpen: 真实监听的端口返回 true', async () => {
  const srv = await listenOnEphemeralPort();
  const port = srv.address().port;
  try {
    assert.equal(await tcpOpen(port), true);
  } finally {
    srv.close();
  }
});

test('tcpOpen: 未监听的端口返回 false（用极大端口号规避占用冲突）', async () => {
  assert.equal(await tcpOpen(59999, { timeoutMs: 200 }), false);
});

test('tcpOpen: 关闭后的端口立刻返回 false', async () => {
  const srv = await listenOnEphemeralPort();
  const port = srv.address().port;
  await new Promise((r) => srv.close(r));
  assert.equal(await tcpOpen(port, { timeoutMs: 200 }), false);
});

test('httpOk: 2xx-4xx 视为 UP', async () => {
  const srv = require('node:http').createServer((_, res) => { res.statusCode = 404; res.end(); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  try {
    assert.equal(await httpOk(`http://127.0.0.1:${port}/`), true);
  } finally {
    srv.close();
  }
});

test('httpOk: 连接失败返回 false', async () => {
  assert.equal(await httpOk('http://127.0.0.1:59998/', { timeoutMs: 200 }), false);
});

test('pidOnPort: 无监听时返回空字符串（注入 mock exec 抛错模拟 lsof 空结果）', () => {
  const mockExec = () => { throw new Error('lsof: no process'); };
  assert.equal(pidOnPort(12345, { exec: mockExec }), '');
});

test('pidOnPort: 有监听时返回 lsof 输出的 PID（注入 mock exec）', () => {
  const mockExec = (cmd, args) => {
    assert.equal(cmd, 'sh');
    assert.ok(args[1].includes('tcp:8070'));
    return '46239\n';
  };
  assert.equal(pidOnPort(8070, { exec: mockExec }), '46239');
});
```

注：`httpOk` 测试用了 `require('node:http')`——ESM 文件里改用 `import { createServer } from 'node:http'` 顶部引入，上面写法仅为说明，最终文件顶部统一 import：

```js
import { createServer } from 'node:http';
```
并把测试体内的 `require('node:http').createServer` 替换为 `createServer`。

`skills/agents-launcher/dev-orchestrator.mjs`（改动片段，替换第 1-70 行相关部分）：

```diff
 import { fileURLToPath } from 'node:url';
 import { dirname, join } from 'node:path';
 import { existsSync } from 'node:fs';
 import { execFileSync } from 'node:child_process';
 import { createInterface } from 'node:readline/promises';
-import net from 'node:net';
 import { parseArgs } from './lib/cli.mjs';
 import { resolveRepos, validateRepos } from './lib/paths.mjs';
 import { PORTS, buildWriteTargets } from './lib/ports.mjs';
 import { upsertEnv } from './lib/env-file.mjs';
 import { buildKillCommands, waitHealthy, runToEnd, spawnPrefixed } from './lib/proc.mjs';
+import { tcpOpen, httpOk, pidOnPort } from './lib/probe.mjs';
```

```diff
 if (args.status) {
-  const pidOn = (port) => {
-    try { return execFileSync('sh', ['-c', `lsof -ti tcp:${port} -sTCP:LISTEN | head -1`], { encoding: 'utf8' }).trim() || '-'; }
-    catch { return '-'; }
-  };
   const row = async (name, port, up) =>
-    console.log(`[status] ${name.padEnd(6)} :${String(port).padEnd(5)} ${up ? 'UP  ' : 'DOWN'} pid=${up ? pidOn(port) : '-'}`);
+    console.log(`[status] ${name.padEnd(6)} :${String(port).padEnd(5)} ${up ? 'UP  ' : 'DOWN'} pid=${up ? (pidOnPort(port) || '-') : '-'}`);
```

```diff
-function tcpOpen(port) {
-  return new Promise((res) => {
-    const s = net.connect({ host: '127.0.0.1', port }, () => { s.destroy(); res(true); });
-    s.on('error', () => res(false));
-    s.setTimeout(800, () => { s.destroy(); res(false); });
-  });
-}
-async function httpOk(url) {
-  try { const r = await fetch(url, { signal: AbortSignal.timeout(1500) }); return r.status >= 200 && r.status < 500; }
-  catch { return false; }
-}
 async function confirm(q) {
```

其余对 `tcpOpen(...)` / `httpOk(...)` 的调用点（原文件内 26-30、150、156-159、182、189 行）签名不变，无需改调用处代码。

**Commit**: `git add skills/agents-launcher/lib/probe.mjs skills/agents-launcher/lib/probe.test.mjs skills/agents-launcher/dev-orchestrator.mjs .claude-plugin/plugin.json && git commit -m "refactor(agents-launcher): 抽取 lib/probe.mjs 端口/健康探测公共原语（6.5.1）"`

---

## Task T2: server-cli 骨架 + prepare 动词（GraalVM 检测 + ANTLR 预热）[Size: M]

**描述**: 新建 `server-cli.mjs` 作为 server 独立入口，先落 verb 分发骨架 + `prepare` 动词——**只挂 `prepare` 这一个 case**，`infra`/`start`/`stop`/`status` 由 T3/T4/T4b 各自补一个 case 时渐进挂载，不在 T2 就声明尚未实现的 verb（后续 task 各自追加 case，避免声明未实现的假契约（红蓝裁决 A））。`prepare` 做两件事：GraalVM 检测（迁移 dev-start.sh `detect_graalvm` 111-170 行）+ ANTLR 语法生成预热（解决 fx-runtime gradle 坑：新建 worktree 里 `src/main/generated` 或 `src/main/antlr-generated` 是 gitignored 空目录，IDE 直接打开会报红，需先跑一次聚合 task `generateGrammarSource` 才有产物）。新旧两代 fx-agent-workspace 构建配置的聚合 task 名都叫 `generateGrammarSource`（新代逐文法生成后聚合进这个任务名，旧代直接是这个任务名），产物目录不同（新代 `src/main/antlr-generated`，旧代 `src/main/generated`），prepare 校验时两个目录任一非空即视为成功。

**验收标准**:
- [ ] `FX_SERVER_DIR=<repo> node server-cli.mjs prepare` 跑通：检测 GraalVM（或报告降级容器方案）+ 跑 ANTLR 聚合 task + 校验产物目录非空
- [ ] `fx-agent-workspace` 模块不存在时报清晰错误，不静默跳过
- [ ] `lib/server/graalvm.mjs` 的纯函数单测覆盖候选路径表 + 缓存读写
- [ ] `node --test skills/agents-launcher/lib/server/graalvm.test.mjs` 全绿

**covers**: 启停.P3, 约束.4（SC-3）

**验证命令**:
- `node --test skills/agents-launcher/lib/server/graalvm.test.mjs` — 预期输出: `# pass 8` `# fail 0`
- `node --test skills/agents-launcher/server-cli.test.mjs` — 预期输出: `# pass 4` `# fail 0`（prepare 命令构造 + 产物校验逻辑，注入 exec mock，不真跑 gradle）

**文件**: (4 个)
- `skills/agents-launcher/server-cli.mjs`（新建）
- `skills/agents-launcher/lib/server/graalvm.mjs`（新建）
- `skills/agents-launcher/lib/server/graalvm.test.mjs`（新建）
- `skills/agents-launcher/server-cli.test.mjs`（新建）

**依赖**: Task T1（复用 lib/paths.mjs 的 validateRepos，不复用 probe 但保持模式一致）

**真实改动**:

`skills/agents-launcher/lib/server/graalvm.mjs`（对应 dev-start.sh 108-175 行 GraalVM 发现逻辑）：

```js
// GraalVM JDK 发现。对应 dev-start.sh detect_graalvm()（111-170 行）+ _cache_java_home（172-175 行）。
// bootRun 需要 GraalVM（EnableJVMCI），本地没有则可选容器方案（server-cli start 时机再决定是否真的走容器）。
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';

export const GRAALVM_IMAGE = 'eclipse-temurin:21-jdk';
const JAVA_HOME_CACHE_FILE = '.java-home';

// 候选路径表，纯函数，还原 dev-start.sh 129-141 行。
export function graalvmCandidates({ home = homedir(), userprofile = process.env.USERPROFILE || '' } = {}) {
  return [
    join(home, '.jdks/graalvm-21/Contents/Home'),
    join(home, '.jdks/graalvm-21'),
    join(home, '.jdks/graalvm-ce-21'),
    '/usr/lib/jvm/graalvm-21',
    join(home, '.sdkman/candidates/java/current'),
    '/c/Program Files/Java/graalvm-21',
    '/c/Program Files/Java/graalvm-ce-21',
    '/c/Java/graalvm-21',
    ...(userprofile ? [join(userprofile, '.jdks/graalvm-21'), join(userprofile, '.jdks/graalvm-ce-21')] : []),
  ];
}

// 某 JAVA_HOME 下的 java 是否是 GraalVM（对应 -version 输出里 grep graalvm）。
export function isGraalvm(javaHome, { exec = execFileSync } = {}) {
  const javaBin = join(javaHome, 'bin/java');
  if (!existsSync(javaBin)) return false;
  try {
    const out = exec(javaBin, ['-version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).toLowerCase();
    return out.includes('graalvm') || out.includes('oracle graalvm');
  } catch (e) {
    // java -version 把版本信息打到 stderr，execFileSync 在非零退出码时把 stdout/stderr 一起挂在 e.stdout/e.stderr
    const out = `${e.stdout || ''}${e.stderr || ''}`.toLowerCase();
    return out.includes('graalvm') || out.includes('oracle graalvm');
  }
}

// 综合检测：已设置 JAVA_HOME → 缓存文件 → 候选路径表 → 容器降级。
// 返回 { mode: 'local', javaHome } | { mode: 'container', image } | { mode: 'missing' }
export function detectGraalvm({ serverDir, env = process.env, exec = execFileSync, hasDocker = true } = {}) {
  if (env.JAVA_HOME && isGraalvm(env.JAVA_HOME, { exec })) {
    writeJavaHomeCache(serverDir, env.JAVA_HOME);
    return { mode: 'local', javaHome: env.JAVA_HOME };
  }

  const cached = readJavaHomeCache(serverDir);
  if (cached && isGraalvm(cached, { exec })) {
    return { mode: 'local', javaHome: cached };
  }

  for (const candidate of graalvmCandidates()) {
    if (isGraalvm(candidate, { exec })) {
      writeJavaHomeCache(serverDir, candidate);
      return { mode: 'local', javaHome: candidate };
    }
  }

  if (hasDocker) {
    return { mode: 'container', image: GRAALVM_IMAGE };
  }
  return { mode: 'missing' };
}

export function readJavaHomeCache(serverDir) {
  const f = join(serverDir, JAVA_HOME_CACHE_FILE);
  if (!existsSync(f)) return '';
  return readFileSync(f, 'utf8').trim();
}

export function writeJavaHomeCache(serverDir, javaHome) {
  writeFileSync(join(serverDir, JAVA_HOME_CACHE_FILE), javaHome);
}
```

`skills/agents-launcher/lib/server/graalvm.test.mjs`：

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { graalvmCandidates, isGraalvm, detectGraalvm, readJavaHomeCache, writeJavaHomeCache, GRAALVM_IMAGE } from './graalvm.mjs';

function fakeJdk(isGraal) {
  const home = mkdtempSync(join(tmpdir(), 'jdk-'));
  mkdirSync(join(home, 'bin'), { recursive: true });
  writeFileSync(join(home, 'bin/java'), '#!/bin/sh\necho stub');
  chmodSync(join(home, 'bin/java'), 0o755);
  return home;
}

test('graalvmCandidates: 含 8 条固定路径 + userprofile 时追加 2 条', () => {
  const base = graalvmCandidates({ home: '/h' });
  assert.equal(base.length, 8);
  assert.ok(base[0].includes('.jdks/graalvm-21/Contents/Home'));
  const withUp = graalvmCandidates({ home: '/h', userprofile: '/up' });
  assert.equal(withUp.length, 10);
});

test('isGraalvm: -version 输出含 graalvm 关键字返回 true（注入 mock exec）', () => {
  const home = fakeJdk(true);
  const mockExec = () => 'openjdk version "21.0.1" 2026-01-01\nGraalVM CE 21.0.1\n';
  assert.equal(isGraalvm(home, { exec: mockExec }), true);
});

test('isGraalvm: 普通 JDK（无 graalvm 关键字）返回 false', () => {
  const home = fakeJdk(false);
  const mockExec = () => 'openjdk version "21.0.1"\nOpenJDK Runtime Environment Temurin\n';
  assert.equal(isGraalvm(home, { exec: mockExec }), false);
});

test('isGraalvm: bin/java 不存在直接返回 false，不调用 exec', () => {
  let called = false;
  const mockExec = () => { called = true; return ''; };
  assert.equal(isGraalvm('/not/exist', { exec: mockExec }), false);
  assert.equal(called, false);
});

test('detectGraalvm: env.JAVA_HOME 已是 GraalVM 时直接采用并写缓存', () => {
  const home = fakeJdk(true);
  const serverDir = mkdtempSync(join(tmpdir(), 'srv-'));
  const mockExec = () => 'GraalVM CE 21.0.1\n';
  const result = detectGraalvm({ serverDir, env: { JAVA_HOME: home }, exec: mockExec });
  assert.deepEqual(result, { mode: 'local', javaHome: home });
  assert.equal(readJavaHomeCache(serverDir), home);
});

test('detectGraalvm: 无 env 也无缓存，候选路径全 miss，有 docker → 降级容器', () => {
  const serverDir = mkdtempSync(join(tmpdir(), 'srv-'));
  const mockExec = () => { throw new Error('not found'); };
  const result = detectGraalvm({ serverDir, env: {}, exec: mockExec, hasDocker: true });
  assert.deepEqual(result, { mode: 'container', image: GRAALVM_IMAGE });
});

test('detectGraalvm: 无 docker 时返回 missing', () => {
  const serverDir = mkdtempSync(join(tmpdir(), 'srv-'));
  const mockExec = () => { throw new Error('not found'); };
  const result = detectGraalvm({ serverDir, env: {}, exec: mockExec, hasDocker: false });
  assert.deepEqual(result, { mode: 'missing' });
});

test('readJavaHomeCache/writeJavaHomeCache: 幂等读写', () => {
  const serverDir = mkdtempSync(join(tmpdir(), 'srv-'));
  assert.equal(readJavaHomeCache(serverDir), '');
  writeJavaHomeCache(serverDir, '/opt/graalvm-21');
  assert.equal(readJavaHomeCache(serverDir), '/opt/graalvm-21');
});
```

`skills/agents-launcher/server-cli.mjs`（骨架 + prepare，verb 分发；infra/start/stop/status 由 T3/T4/T4b 补挂）：

```js
#!/usr/bin/env node
// server (fx-data-server Spring Boot) 独立 dev CLI。取代 scripts/dev-start.sh 的 app 相关子命令
// （ui/sync/fresh/remote/all/restart 不迁移，见设计文档 Out of Scope）。
// 用法: FX_SERVER_DIR=<repo> node server-cli.mjs <verb> [--yes] [--kill-old]
//   verb: prepare（infra/start/stop/status 由 T3/T4/T4b 渐进挂载）
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync, execSync } from 'node:child_process';
import { validateRepos } from './lib/paths.mjs';
import { detectGraalvm } from './lib/server/graalvm.mjs';

const ANTLR_MODULE = 'fx-agent-workspace';
// 新旧两代 fx-agent-workspace build.gradle.kts 接线不同，产物目录不同，两个都探测。
const ANTLR_OUTPUT_DIRS = ['src/main/antlr-generated', 'src/main/generated'];

export async function prepare({ serverDir, exec = execFileSync, log = console.log } = {}) {
  const moduleDir = join(serverDir, ANTLR_MODULE);
  if (!existsSync(moduleDir)) {
    throw new Error(`ANTLR 预热失败：模块目录不存在 ${moduleDir}（fx-agent-workspace 模块缺失或路径不对）`);
  }

  log(`[prepare] 检测 GraalVM...`);
  const graalvm = detectGraalvm({ serverDir, exec });
  if (graalvm.mode === 'local') log(`[prepare] GraalVM: ${graalvm.javaHome}`);
  else if (graalvm.mode === 'container') log(`[prepare] 本地无 GraalVM，start 阶段将用容器方案（${graalvm.image}）`);
  else log(`[prepare] ⚠️ 未找到 GraalVM 且无 docker，start 阶段会失败`);

  log(`[prepare] 跑 ANTLR 语法生成（gradlew :${ANTLR_MODULE}:generateGrammarSource）...`);
  exec('./gradlew', [`:${ANTLR_MODULE}:generateGrammarSource`], { cwd: serverDir, stdio: 'inherit' });

  const producedDir = ANTLR_OUTPUT_DIRS.find((rel) => dirHasFiles(join(moduleDir, rel)));
  if (!producedDir) {
    throw new Error(
      `ANTLR 预热跑完但未检出产物（检查过 ${ANTLR_OUTPUT_DIRS.join(' / ')}），` +
      `生成目录是 gitignored 的，新 worktree 首次必须跑这一步，IDE 才不会对 Lexer/Parser/Visitor 类报红`,
    );
  }
  log(`[prepare] ANTLR 产物就绪: ${moduleDir}/${producedDir}`);
  return { graalvm, antlrOutputDir: producedDir };
}

function dirHasFiles(dir) {
  if (!existsSync(dir)) return false;
  try {
    // fs 递归遍历（不依赖 shell find，可测且跨平台；node 18.17+ 支持 recursive）
    return readdirSync(dir, { recursive: true, withFileTypes: true }).some((e) => e.isFile());
  } catch {
    return false;
  }
}

// 渐进挂载清单：T3/T4/T4b 各自补一个 case 时同步 push 自己的动词名，default 报错文案据此动态生成，
// 避免声明未实现的假契约（红蓝裁决 A）。
const SUPPORTED_VERBS = ['prepare'];

async function main() {
  const [verb, ...flags] = process.argv.slice(2);
  const serverDir = process.env.FX_SERVER_DIR;
  if (!serverDir) throw new Error('FX_SERVER_DIR 未设置');
  validateRepos({ SERVER_DIR: serverDir }, { need: ['SERVER_DIR'] });

  switch (verb) {
    case 'prepare':
      await prepare({ serverDir });
      break;
    // infra / start / stop / status 由 T3 / T4 / T4b 补挂到这个 switch，并各自 SUPPORTED_VERBS.push(...)
    default:
      console.error(`不支持的 verb: ${verb}（当前支持: ${SUPPORTED_VERBS.join('|')}）`);
      process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(`[server-cli] 失败: ${e.message}`); process.exit(1); });
}
```

`skills/agents-launcher/server-cli.test.mjs`：

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepare } from './server-cli.mjs';

function fakeServerRepo({ withAntlrOutput = true } = {}) {
  const serverDir = mkdtempSync(join(tmpdir(), 'srv-'));
  writeFileSync(join(serverDir, 'gradlew'), '#!/bin/sh');
  const moduleDir = join(serverDir, 'fx-agent-workspace');
  mkdirSync(moduleDir, { recursive: true });
  if (withAntlrOutput) {
    const outDir = join(moduleDir, 'src/main/antlr-generated/com/fanruan/x');
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'WorkspaceDslParser.java'), 'class WorkspaceDslParser {}');
  }
  return serverDir;
}

test('prepare: 模块目录不存在时抛清晰错误，不静默跳过', async () => {
  const serverDir = mkdtempSync(join(tmpdir(), 'srv-'));
  writeFileSync(join(serverDir, 'gradlew'), '#!/bin/sh');
  await assert.rejects(
    prepare({ serverDir, exec: () => '' }),
    /fx-agent-workspace 模块缺失或路径不对/,
  );
});

test('prepare: 跑 gradlew 生成 task，产物目录非空则成功', async () => {
  const serverDir = fakeServerRepo({ withAntlrOutput: true });
  const calls = [];
  const mockExec = (cmd, args, opts) => { calls.push([cmd, args, opts]); return ''; };
  const result = await prepare({ serverDir, exec: mockExec, log: () => {} });
  assert.ok(calls.some(([cmd, args]) => cmd === './gradlew' && args.includes(':fx-agent-workspace:generateGrammarSource')));
  assert.equal(result.antlrOutputDir, 'src/main/antlr-generated');
});

test('prepare: gradlew 跑完但两个候选目录都空，报错提示新 worktree 首次必跑', async () => {
  const serverDir = fakeServerRepo({ withAntlrOutput: false });
  const mockExec = () => '';
  await assert.rejects(
    prepare({ serverDir, exec: mockExec, log: () => {} }),
    /未检出产物/,
  );
});

test('prepare: 返回 graalvm 检测结果（容器降级场景）', async () => {
  const serverDir = fakeServerRepo({ withAntlrOutput: true });
  const mockExec = (cmd) => {
    if (cmd === './gradlew') return '';
    throw new Error('java not found');   // isGraalvm 检测全 miss
  };
  const result = await prepare({ serverDir, exec: mockExec, log: () => {} });
  assert.equal(result.graalvm.mode, 'container');
});
```

**Commit**: `git add skills/agents-launcher/server-cli.mjs skills/agents-launcher/lib/server/graalvm.mjs skills/agents-launcher/lib/server/graalvm.test.mjs skills/agents-launcher/server-cli.test.mjs .claude-plugin/plugin.json && git commit -m "feat(agents-launcher): 新增 server-cli，prepare 动词做 ANTLR 预热 + GraalVM 检测（6.5.2）"`

---

## Task T3: server-cli infra 动词（基础设施等待 + 本地 env 表）[Size: M]

**描述**: 迁移 dev-start.sh 的基础设施启动逻辑（`start_infra` 383-452 行）+ 本地 env 表（`force_local_infra` 69-92 行）+ 相关工具函数（`host_ip` 178-189、`resolve_polars_rpc_host` 280-302、`purge_proxy_env`/`proxy_jvm_flags` 271-278）。拆两个纯度不同的模块：`lib/server/infra.mjs`（有副作用的编排函数，注入 exec/fetch）、`lib/server/env.mjs`（纯数据表 + 纯函数）。容器全在运行时 `startInfra` 跳过 compose 与收尾动作（等价原 bash 400-402 行早返回）；readiness/DB 权限/ES 等待的兜底在 `startApp`（`fixDbPermissions`+`waitForEs` 每次启动都跑），full 档 compose 全量重建后也由 `startApp` 兜底（红蓝裁决 G）。

**验收标准**:
- [ ] `lib/server/env.mjs` 的 `localInfraEnv` 产出的 env 键值与 dev-start.sh `force_local_infra` 逐项一致
- [ ] `lib/server/infra.mjs` 的 `startInfra` 按序执行：容器存在性检查 → compose up 缺的 → 等 PG+ES → ensureRabbitmqQueues → fixDbPermissions → 关 ES 磁盘水位
- [ ] `server-cli.mjs` 挂 `infra` verb，调用 `startInfra`
- [ ] 单测注入 mock exec/fetch，不真起 docker

**covers**: 启停.P1, SC-4

**验证命令**:
- `node --test skills/agents-launcher/lib/server/env.test.mjs` — 预期输出: `# pass 6` `# fail 0`
- `node --test skills/agents-launcher/lib/server/infra.test.mjs` — 预期输出: `# pass 7` `# fail 0`

**文件**: (4 个)
- `skills/agents-launcher/lib/server/env.mjs`（新建）
- `skills/agents-launcher/lib/server/env.test.mjs`（新建）
- `skills/agents-launcher/lib/server/infra.mjs`（新建）
- `skills/agents-launcher/lib/server/infra.test.mjs`（新建）

**依赖**: Task T2（server-cli.mjs 骨架已存在，本 task 挂 infra verb）

**真实改动**:

`skills/agents-launcher/lib/server/env.mjs`（对应 dev-start.sh 69-92、178-189、262-302 行）：

```js
// server 本地开发的固定 env 表 + 网络相关纯函数。
// 对应 dev-start.sh force_local_infra（69-92）/ .env 加载（60-64）/ purge_proxy_env+proxy_jvm_flags（262-278）/
// host_ip（178-189）/ resolve_polars_rpc_host（280-302）。
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// 本地模式基础设施地址固定表，纯数据 + overrides 合并，还原 force_local_infra 全部导出变量。
export function localInfraEnv({ overrides = {} } = {}) {
  const base = {
    DB_URL: 'jdbc:postgresql://127.0.0.1:5432/jiushuyun?reWriteBatchedInserts=true',
    DB_USERNAME: 'jiushuyun',
    DB_PASSWORD: 'jiushuyun',
    REDIS_HOST: '127.0.0.1',
    CACHE_MONGO_URI: '127.0.0.1:27017/jiushuyun?authSource=admin',
    CACHE_MONGO_USERNAME: 'admin',
    CACHE_MONGO_PASSWORD: 'jiushuyun',
    DATASOURCE_MONGO_URI: '127.0.0.1:27017/jiushuyun?authSource=admin',
    DATASOURCE_MONGO_USERNAME: 'admin',
    DATASOURCE_MONGO_PASSWORD: 'jiushuyun',
    NEO4J_URL: 'bolt://127.0.0.1:7687',
    ES_HOST: '127.0.0.1',
    S3_ENDPOINT: 'http://127.0.0.1:9000',
    S3_INTERNAL_ENDPOINT: 'http://127.0.0.1:9000',
    CDN_ENDPOINT: 'http://127.0.0.1:9000',
    CDN_INTERNAL_ENDPOINT: 'http://127.0.0.1:9000',
    POLARS_HOST: '127.0.0.1',
    INFRA_HOST: '127.0.0.1',
    POLARS_MASTER_CONFIG_STR: '127.0.0.1:8000',
  };
  return { ...base, ...overrides };
}

// 禁代理 JVM 参数，供 JAVA_TOOL_OPTIONS 拼接。对应 proxy_jvm_flags（276-278）。
export function proxyJvmFlags() {
  return `-Djava.net.useSystemProxies=false -Dhttp.nonProxyHosts='*' -Dhttps.nonProxyHosts='*'`;
}

// 返回去掉代理相关 key 的 env 副本（不 mutate 原 env）。对应 purge_proxy_env（271-273）。
export function purgeProxyEnv(env) {
  const out = { ...env };
  for (const k of ['all_proxy', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'no_proxy', 'NO_PROXY']) {
    delete out[k];
  }
  return out;
}

// 加载 <serverDir>/.env（跳过注释/空行；不覆盖已存在的环境变量）。对应 60-64 行 set -a source .env。
export function loadDotEnv({ serverDir, env = process.env } = {}) {
  const file = join(serverDir, '.env');
  if (!existsSync(file)) return {};
  const loaded = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (line.trim().startsWith('#')) continue;
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    const [, k, vRaw] = m;
    const v = vRaw.replace(/^["']|["']$/g, '');
    loaded[k] = v;
    if (env[k] === undefined) env[k] = v;
  }
  return loaded;
}

// 主机 IP（前端容器通过此 IP 访问后端和 MinIO）。对应 host_ip（178-189，macOS ifconfig 分支）。
export function hostIp({ exec = execFileSync } = {}) {
  try {
    const out = exec('sh', ['-c', `ifconfig 2>/dev/null | grep 'inet ' | grep -v '127.0.0.1' | head -1 | awk '{print $2}'`], { encoding: 'utf8' }).trim();
    return out || '127.0.0.1';
  } catch {
    return '127.0.0.1';
  }
}

// Polars 容器回连宿主机地址。对应 resolve_polars_rpc_host（280-302），简化为容器优先、宿主回退、fallback 常量三段。
export function resolvePolarsRpcHost({ exec = execFileSync } = {}) {
  const fallback = '192.168.65.254';
  try {
    const names = exec('sh', ['-c', `docker ps --format '{{.Names}}'`], { encoding: 'utf8' });
    if (names.split('\n').includes('polars-local')) {
      const ip = exec('sh', ['-c', `docker exec polars-local getent ahosts host.docker.internal 2>/dev/null | awk 'NR==1 {print $1}'`], { encoding: 'utf8' }).trim();
      if (ip) return ip;
    }
  } catch { /* 容器探测失败，走宿主回退 */ }
  try {
    const ip = exec('python3', ['-c', 'import socket; print(socket.gethostbyname("host.docker.internal"))'], { encoding: 'utf8' }).trim();
    if (ip && !ip.startsWith('0.')) return ip;
  } catch { /* 宿主解析也失败，走 fallback 常量 */ }
  return fallback;
}
```

`skills/agents-launcher/lib/server/env.test.mjs`：

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localInfraEnv, proxyJvmFlags, purgeProxyEnv, hostIp, resolvePolarsRpcHost } from './env.mjs';

test('localInfraEnv: 默认值与 dev-start.sh force_local_infra 一致（抽样关键字段）', () => {
  const env = localInfraEnv();
  assert.equal(env.DB_URL, 'jdbc:postgresql://127.0.0.1:5432/jiushuyun?reWriteBatchedInserts=true');
  assert.equal(env.REDIS_HOST, '127.0.0.1');
  assert.equal(env.POLARS_MASTER_CONFIG_STR, '127.0.0.1:8000');
});

test('localInfraEnv: overrides 覆盖默认值', () => {
  const env = localInfraEnv({ overrides: { S3_ENDPOINT: 'http://10.0.0.1:9000' } });
  assert.equal(env.S3_ENDPOINT, 'http://10.0.0.1:9000');
  assert.equal(env.CDN_ENDPOINT, 'http://127.0.0.1:9000');   // 未覆盖的保持默认
});

test('proxyJvmFlags: 含三个禁代理 JVM 参数', () => {
  const flags = proxyJvmFlags();
  assert.ok(flags.includes('-Djava.net.useSystemProxies=false'));
  assert.ok(flags.includes("-Dhttp.nonProxyHosts='*'"));
});

test('purgeProxyEnv: 删除全部代理 key，不 mutate 原对象', () => {
  const original = { http_proxy: 'x', PATH: '/bin' };
  const cleaned = purgeProxyEnv(original);
  assert.equal(cleaned.http_proxy, undefined);
  assert.equal(cleaned.PATH, '/bin');
  assert.equal(original.http_proxy, 'x');   // 原对象未被改
});

test('hostIp: 解析成功返回非回环 IP（注入 mock exec）', () => {
  const mockExec = () => 'inet 192.168.1.5 netmask 0xffffff00 broadcast 192.168.1.255\n192.168.1.5';
  assert.equal(hostIp({ exec: mockExec }), '192.168.1.5');
});

test('resolvePolarsRpcHost: 容器不存在、宿主解析失败 → 回退常量', () => {
  const mockExec = () => { throw new Error('not found'); };
  assert.equal(resolvePolarsRpcHost({ exec: mockExec }), '192.168.65.254');
});
```

`skills/agents-launcher/lib/server/infra.mjs`（对应 dev-start.sh 106、304-309、333-380、383-452 行）：

```js
// 基础设施容器编排。对应 dev-start.sh start_infra（383-452）+ ensure_rabbitmq_queues（333-347）
// + fix_db_permissions（349-359）+ wait_for_es（361-380）+ container_name_of（304-309）。
import { execFileSync } from 'node:child_process';

export const INFRA_SERVICES = ['postgresql', 'redis', 'mongodb', 'rabbitmq', 'neo4j', 'minio', 'elasticsearch'];

export function containerNameOf(svc) {
  return svc === 'postgresql' ? 'postgres' : svc;
}

export async function waitForEs({ fetchFn = fetch, maxRetries = 30 } = {}) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const r = await fetchFn('http://localhost:9200/_cluster/health', {
        headers: { Authorization: `Basic ${Buffer.from('elastic:jiushuyun').toString('base64')}` },
      });
      const body = await r.json();
      if (body.status === 'green' || body.status === 'yellow') return true;
    } catch { /* ES 还没起来，继续重试 */ }
    await new Promise((r) => setTimeout(r, 0));   // 测试里 sleep 注入为 no-op，生产由调用方包 real sleep
  }
  return false;
}

function ensureRabbitmqQueues({ exec }) {
  const queues = [
    'hihidata-web-socket-honeypot-queue',
    'hihidata-web-socket-refresh-jsy-token-queue',
    'hihidata-web-socket-jsy-refresh-token-fanout-message-queue',
  ];
  for (const q of queues) {
    try {
      const listed = exec('sh', ['-c', `docker exec rabbitmq rabbitmqadmin -u test -p test -V local list queues name`], { encoding: 'utf8' });
      if (listed.includes(q)) continue;
      exec('sh', ['-c', `docker exec rabbitmq rabbitmqadmin -u test -p test -V local declare queue name="${q}" durable=true`]);
    } catch { /* 声明失败不阻塞启动，下次重试 */ }
  }
}

function fixDbPermissions({ exec, dbUser = 'jiushuyun' }) {
  try {
    exec('sh', ['-c', `docker exec postgres psql -U postgres -d jiushuyun -c "GRANT ALL ON TABLE flyway_history_post_startup TO ${dbUser};"`]);
    return true;
  } catch {
    return false;
  }
}

function disableEsDiskThreshold({ exec }) {
  try {
    exec('sh', ['-c', `curl --noproxy localhost -s -X PUT http://localhost:9200/_cluster/settings -u elastic:jiushuyun -H 'Content-Type: application/json' -d '{"transient":{"cluster.routing.allocation.disk.threshold_enabled":false}}'`]);
  } catch { /* 非阻塞：磁盘水位关闭失败不影响启动，只是单节点开发环境可能因磁盘满报警 */ }
}

// 编排：检查容器 → 起缺的 → 等 PG+ES 就绪 → 队列 + 权限 + ES 配置收尾。
export async function startInfra({ exec = execFileSync, fetchFn = fetch, env = process.env, log = console.log } = {}) {
  const running = new Set(
    exec('sh', ['-c', `docker ps --format '{{.Names}}'`], { encoding: 'utf8' }).split('\n').filter(Boolean),
  );
  const needStart = INFRA_SERVICES.filter((svc) => !running.has(containerNameOf(svc)));

  if (needStart.length === 0) {
    log('[infra] 所有基础设施容器已就绪');
    return { started: [], pgReady: true, esReady: true };
  }

  log(`[infra] 启动容器: ${needStart.join(' ')}`);
  exec('sh', ['-c', `docker compose up -d ${needStart.join(' ')}`]);

  let pgReady = false;
  try {
    exec('sh', ['-c', 'docker exec postgres pg_isready -q']);
    pgReady = true;
  } catch { /* 未就绪，调用方按需重试 */ }

  const esReady = await waitForEs({ fetchFn });

  if (pgReady && esReady) {
    ensureRabbitmqQueues({ exec });
    fixDbPermissions({ exec, dbUser: env.DB_USERNAME });   // env.DB_USERNAME 未设时 fixDbPermissions 走自身默认值 'jiushuyun'
    disableEsDiskThreshold({ exec });
  }

  return { started: needStart, pgReady, esReady };
}
```

`skills/agents-launcher/lib/server/infra.test.mjs`：

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INFRA_SERVICES, containerNameOf, waitForEs, startInfra } from './infra.mjs';

test('INFRA_SERVICES: 7 个固定服务，与 dev-start.sh 106 行一致', () => {
  assert.deepEqual(INFRA_SERVICES, ['postgresql', 'redis', 'mongodb', 'rabbitmq', 'neo4j', 'minio', 'elasticsearch']);
});

test('containerNameOf: postgresql 映射为 postgres，其余原样', () => {
  assert.equal(containerNameOf('postgresql'), 'postgres');
  assert.equal(containerNameOf('redis'), 'redis');
});

test('waitForEs: 第二次探测 status=yellow 返回 true', async () => {
  let n = 0;
  const mockFetch = async () => ({ json: async () => (++n >= 2 ? { status: 'yellow' } : { status: 'red' }) });
  assert.equal(await waitForEs({ fetchFn: mockFetch, maxRetries: 5 }), true);
});

test('waitForEs: 一直不健康则超时返回 false', async () => {
  const mockFetch = async () => ({ json: async () => ({ status: 'red' }) });
  assert.equal(await waitForEs({ fetchFn: mockFetch, maxRetries: 3 }), false);
});

test('startInfra: 全部容器已运行时不调 compose up，直接返回', async () => {
  const calls = [];
  const mockExec = (cmd, args) => {
    calls.push(args?.[1] || '');
    if (args?.[1]?.includes('docker ps')) return 'postgres\nredis\nmongodb\nrabbitmq\nneo4j\nminio\nelasticsearch\n';
    return '';
  };
  const result = await startInfra({ exec: mockExec, fetchFn: async () => ({ json: async () => ({ status: 'green' }) }), log: () => {} });
  assert.deepEqual(result.started, []);
  assert.ok(!calls.some((c) => c.includes('compose up')));
});

test('startInfra: 缺容器时调 compose up 起缺的那些', async () => {
  const calls = [];
  const mockExec = (cmd, args) => {
    const s = args?.[1] || '';
    calls.push(s);
    if (s.includes('docker ps')) return 'postgres\nredis\n';   // 缺 mongodb/rabbitmq/neo4j/minio/elasticsearch
    if (s.includes('pg_isready')) return '';
    return '';
  };
  const result = await startInfra({ exec: mockExec, fetchFn: async () => ({ json: async () => ({ status: 'green' }) }), log: () => {} });
  assert.deepEqual(result.started, ['mongodb', 'rabbitmq', 'neo4j', 'minio', 'elasticsearch']);
  assert.ok(calls.some((c) => c.includes('compose up -d mongodb rabbitmq neo4j minio elasticsearch')));
});

test('startInfra: PG 未就绪时不跑 ensureRabbitmqQueues/fixDbPermissions（收尾动作跳过）', async () => {
  const calls = [];
  const mockExec = (cmd, args) => {
    const s = args?.[1] || '';
    calls.push(s);
    if (s.includes('docker ps')) return '';
    if (s.includes('pg_isready')) throw new Error('not ready');
    return '';
  };
  const result = await startInfra({ exec: mockExec, fetchFn: async () => ({ json: async () => ({ status: 'green' }) }), log: () => {} });
  assert.equal(result.pgReady, false);
  assert.ok(!calls.some((c) => c.includes('rabbitmqadmin')));
});
```

server-cli.mjs 挂 infra verb（追加到 T2 的 switch）：

```diff
+import { startInfra } from './lib/server/infra.mjs';
+
+SUPPORTED_VERBS.push('infra');
+
 switch (verb) {
   case 'prepare':
     await prepare({ serverDir });
     break;
+  case 'infra':
+    await startInfra();
+    break;
```

**Commit**: `git add skills/agents-launcher/lib/server/env.mjs skills/agents-launcher/lib/server/env.test.mjs skills/agents-launcher/lib/server/infra.mjs skills/agents-launcher/lib/server/infra.test.mjs skills/agents-launcher/server-cli.mjs .claude-plugin/plugin.json && git commit -m "feat(agents-launcher): server-cli 挂 infra 动词，基础设施等待 + 本地 env 表（6.5.3）"`

---

## Task T4: server-cli start 动词（GC patch + bootRun 启动）[Size: M]

**描述**: 迁移 dev-start.sh 的应用启动核心逻辑（`start_app` 498-673 行）+ `patch_gc_for_graaljs`（234-241 行）。**关键行为变化**：原脚本端口占用时走交互式 `read -r answer` 问 y/N（506-518 行），CLI 场景改为非交互——`killOld=false`（默认）时直接 fail loud 报错，调用方要杀旧进程显式传 `--kill-old`（对应 restate 约束.1：CLI 非交互）。容器分支（本地无 GraalVM 时用 Podman/Docker 跑 `gradle bootJar`）保留命令构造逻辑，但不在自动化测试里真跑（无沙箱环境），标记为不测项。start 不内嵌 ANTLR prepare——生成 task 挂在 `compileJava.dependsOn`（新旧两代 `build.gradle.kts` 均已核实），bootRun 自愈；prepare 是 IDE 场景专用入口（红蓝裁决 F，有证据驳回）。

**验收标准**:
- [ ] `patchGcForGraaljs` 幂等：跑两次结果一致，且只在 `build.gradle.kts` 含 `+UseZGC` 时才 patch
- [ ] `startApp` 端口被占用且 `killOld=false` 时抛错，不静默阻塞等交互输入
- [ ] `startApp` 端口被占用且 `killOld=true` 时先 kill 旧进程再继续
- [ ] `buildBootRunEnv` 产出的 JAVA_TOOL_OPTIONS 含代理禁用参数 + rpc.host
- [ ] `server-cli.mjs` 挂 `start` verb，支持 `--kill-old` flag

**covers**: 启停.P1, 系统.1（SC-4）

**验证命令**:
- `node --test skills/agents-launcher/lib/server/boot.test.mjs` — 预期输出: `# pass 9` `# fail 0`

**文件**: (3 个)
- `skills/agents-launcher/lib/server/boot.mjs`（新建）
- `skills/agents-launcher/lib/server/boot.test.mjs`（新建）
- `skills/agents-launcher/server-cli.mjs`（改：挂 start verb）

**依赖**: Task T2（graalvm 检测）、Task T3（env.mjs 的 hostIp/resolvePolarsRpcHost/purgeProxyEnv/proxyJvmFlags）

**真实改动**:

`skills/agents-launcher/lib/server/boot.mjs`（对应 dev-start.sh 231-241、498-673 行）：

```js
// Spring Boot 应用启动。对应 dev-start.sh patch_gc_for_graaljs（234-241）+ start_app（498-673）。
// 与原脚本的关键差异：端口占用时不做交互式 y/N 问询（CLI 非交互，restate 约束.1），
// 默认 fail loud，调用方需显式传 killOld=true 才杀旧进程重启。
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync, spawn as nodeSpawn } from 'node:child_process';
import { pidOnPort } from '../probe.mjs';
import { purgeProxyEnv, proxyJvmFlags, hostIp, resolvePolarsRpcHost, localInfraEnv } from './env.mjs';
import { fixDbPermissions, waitForEs } from './infra.mjs';

// ZGC 与 GraalVM 21 的 JVMCI 不兼容，临时 patch 为 G1GC。幂等：已 patch 过则跳过。
// 对应 234-241 行 sed 逻辑。
export function patchGcForGraaljs({ serverDir }) {
  const file = join(serverDir, 'build.gradle.kts');
  if (!existsSync(file)) return { patched: false, reason: 'build.gradle.kts 不存在' };
  const content = readFileSync(file, 'utf8');
  if (!content.includes('+UseZGC')) return { patched: false, reason: '未使用 ZGC，无需 patch' };

  const patched = content
    .replace('"-XX:+UseZGC"', '"-XX:+UseG1GC", "-XX:+UnlockExperimentalVMOptions", "-XX:+EnableJVMCI"')
    .split('\n')
    .filter((line) => !line.includes('ZGenerational'))
    .join('\n');
  writeFileSync(file, patched);
  return { patched: true };
}

// bootRun 用的 env（S3/CDN endpoint + JAVA_TOOL_OPTIONS）。对应 526-531 + 605-614 行。
export function buildBootRunEnv({ hostIp, rpcHost, baseEnv = {} } = {}) {
  return {
    ...baseEnv,
    S3_ENDPOINT: baseEnv.S3_ENDPOINT || `http://${hostIp}:9000`,
    CDN_ENDPOINT: baseEnv.CDN_ENDPOINT || `http://${hostIp}:9000`,
    JAVA_TOOL_OPTIONS: `${baseEnv.JAVA_TOOL_OPTIONS || ''} ${proxyJvmFlags()} -Drpc.host=${rpcHost}`.trim(),
  };
}

// 容器内自举脚本：装 gradle → bootJar → java -jar。对应 585-609 行。
export const CONTAINER_BOOT_SCRIPT = [
  'apt-get update -qq && apt-get install -y -qq git procps iproute2 unzip curl >/dev/null 2>&1',
  'GRADLE_HOME=/opt/gradle',
  'if [ ! -d "$GRADLE_HOME" ]; then curl -sL https://services.gradle.org/distributions/gradle-8.5-bin.zip -o /tmp/gradle.zip && unzip -q /tmp/gradle.zip -d /opt && mv /opt/gradle-8.5 $GRADLE_HOME; fi',
  'export PATH=$GRADLE_HOME/bin:$PATH',
  'gradle bootJar --no-daemon --no-parallel --max-workers=1 > /app/dev-start.log 2>&1',
  'java -jar build/libs/*.jar > /app/dev-start-run.log 2>&1',
].join('\n');

// 容器分支命令构造（本地无 GraalVM 时）。对应 541-609 行。不在自动化测试里真跑，仅测命令构造。
export function buildContainerRunArgs({ serverDir, image, envArgs }) {
  return [
    'run', '-d', '--name', 'dev-backend', '--privileged', '--network=host',
    '-v', `${serverDir}:/app`, '-w', '/app',
    ...envArgs.flatMap(([k, v]) => ['-e', `${k}=${v}`]),
    '-e', 'GRADLE_OPTS=-Dorg.gradle.daemon=false -Dorg.gradle.workers.max=1',
    image,
    'bash', '-c', CONTAINER_BOOT_SCRIPT,
  ];
}

// 容器分支的存活检查（原 626-629 行）。
function containerRunning({ exec = execFileSync } = {}) {
  try { return exec('sh', ['-c', `docker ps --format '{{.Names}}'`], { encoding: 'utf8' }).split('\n').includes('dev-backend'); }
  catch { return false; }
}

// 启动应用主流程。graalvm 为 T2 detectGraalvm 的结果。
export async function startApp({ serverDir, appPort = 8081, graalvm, env = process.env, exec = execFileSync, spawn = nodeSpawn, fetchFn = fetch, waitFn = waitAppHealthy, killOld = false, log = console.log } = {}) {
  const existingPid = pidOnPort(appPort, { exec });
  if (existingPid) {
    if (!killOld) {
      throw new Error(`端口 ${appPort} 已被占用 (PID: ${existingPid})。传 --kill-old 杀旧进程后重启，或先手动确认。`);
    }
    log(`[start] 端口 ${appPort} 被占用 (PID: ${existingPid})，killOld=true，终止旧进程`);
    try { exec('kill', [existingPid]); } catch { /* 进程可能已经退出 */ }
  }

  // 复用 infra.mjs 实现（原 521 行 fix_db_permissions），不重复内联 SQL
  try { fixDbPermissions({ exec }); } catch { /* 非阻塞 */ }
  // 原 524 行 wait_for_es：ES 刚重启时 Spring 上下文初始化会失败，等 green/yellow 再起（超时 warn 不阻断）
  await waitForEs({ fetchFn });

  if (graalvm.mode === 'missing') {
    throw new Error('未找到 GraalVM 且无 docker 可用，无法启动（bootRun 需要 EnableJVMCI）');
  }

  if (graalvm.mode === 'container') {
    try { exec('docker', ['rm', '-f', 'dev-backend']); } catch { /* 旧容器可能不存在 */ }
    const args = buildContainerRunArgs({
      serverDir,
      image: graalvm.image,
      // 原 548-573 行：完整基础设施 env 清单传给容器（容器内 bootJar + java -jar 需要）
      envArgs: [
        ...Object.entries(localInfraEnv({ overrides: {} })),
        ['APP_PORT', String(appPort)], ['GRPC_PORT', '9090'], ['MGMT_PORT', '8075'],
        ['SPRING_PROFILES_ACTIVE', 'dev'],
      ],
    });
    log(`[start] 本地无 GraalVM，用容器方案启动 (docker run …${args.length} args)`);
    exec('docker', args);
    writeFileSync(join(serverDir, '.dev-start.pid'), 'container');   // 原 604 行
    await waitFn({ appPort, alive: () => containerRunning({ exec }), fetchFn, log });
    return { mode: 'container' };
  }

  // 本地分支：patch GC → 拼 env → 后台 bootRun
  patchGcForGraaljs({ serverDir });
  const cleanEnv = purgeProxyEnv({ ...env, JAVA_HOME: graalvm.javaHome });
  // 原 526-531/612 行：S3/CDN 用宿主机 IP 兜底，rpc.host 从 polars 容器视角动态解析（写死会在 Docker Desktop 环境失联）
  const bootEnv = buildBootRunEnv({ hostIp: hostIp({ exec }), rpcHost: resolvePolarsRpcHost({ exec }), baseEnv: cleanEnv });

  const child = spawn('./gradlew', ['bootRun', '--no-build-cache'], {
    cwd: serverDir,
    env: bootEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  writeFileSync(join(serverDir, '.dev-start.pid'), String(child.pid));
  // 原 620-661 行：等待 编译+Spring 初始化（最多 180×2s=6 分钟），进程死掉立即 fail loud
  await waitFn({ appPort, alive: () => { try { process.kill(child.pid, 0); return true; } catch { return false; } }, fetchFn, log });
  return { mode: 'local', pid: child.pid };
}

// 应用健康等待（原 620-661 行）：每轮先查存活再探 HTTP，进程/容器死亡立即抛错。
export async function waitAppHealthy({ appPort = 8081, alive = () => true, fetchFn = fetch, maxRetries = 180, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), log = console.log } = {}) {
  for (let i = 0; i < maxRetries; i++) {
    if (!alive()) throw new Error('应用启动失败，查看日志: tail -50 dev-start.log');
    try {
      const r = await fetchFn(`http://localhost:${appPort}/`, { signal: AbortSignal.timeout(1500) });
      if (r.status >= 200 && r.status < 500) { log('[start] 应用启动成功'); return true; }
    } catch { /* 未就绪继续等 */ }
    await sleep(2000);
  }
  throw new Error(`等待超时（${maxRetries * 2}s），应用可能仍在启动中——tail -f dev-start.log 查看`);
}
```

`skills/agents-launcher/lib/server/boot.test.mjs`：

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { patchGcForGraaljs, buildBootRunEnv, buildContainerRunArgs, startApp } from './boot.mjs';

function fakeRepo(gradleContent) {
  const dir = mkdtempSync(join(tmpdir(), 'srv-'));
  writeFileSync(join(dir, 'build.gradle.kts'), gradleContent);
  return dir;
}

test('patchGcForGraaljs: 含 +UseZGC 时替换为 G1GC + JVMCI 参数', () => {
  const dir = fakeRepo('tasks.withType<JavaExec> {\n  jvmArgs = listOf("-XX:+UseZGC", "-XX:+ZGenerational")\n}');
  const result = patchGcForGraaljs({ serverDir: dir });
  assert.equal(result.patched, true);
  const content = readFileSync(join(dir, 'build.gradle.kts'), 'utf8');
  assert.ok(content.includes('-XX:+UseG1GC'));
  assert.ok(content.includes('-XX:+EnableJVMCI'));
  assert.ok(!content.includes('ZGenerational'));
});

test('patchGcForGraaljs: 不含 +UseZGC 时跳过，返回未 patch', () => {
  const dir = fakeRepo('tasks.withType<JavaExec> {\n  jvmArgs = listOf("-XX:+UseG1GC")\n}');
  const result = patchGcForGraaljs({ serverDir: dir });
  assert.equal(result.patched, false);
});

test('patchGcForGraaljs: 幂等——跑两次结果一致', () => {
  const dir = fakeRepo('jvmArgs = listOf("-XX:+UseZGC")');
  patchGcForGraaljs({ serverDir: dir });
  const once = readFileSync(join(dir, 'build.gradle.kts'), 'utf8');
  const second = patchGcForGraaljs({ serverDir: dir });
  assert.equal(second.patched, false);   // 第二次已无 +UseZGC 可 patch
  assert.equal(readFileSync(join(dir, 'build.gradle.kts'), 'utf8'), once);
});

test('buildBootRunEnv: 拼出 S3/CDN endpoint + JAVA_TOOL_OPTIONS 含 rpc.host', () => {
  const env = buildBootRunEnv({ hostIp: '192.168.1.5', rpcHost: '10.0.0.1' });
  assert.equal(env.S3_ENDPOINT, 'http://192.168.1.5:9000');
  assert.ok(env.JAVA_TOOL_OPTIONS.includes('-Drpc.host=10.0.0.1'));
  assert.ok(env.JAVA_TOOL_OPTIONS.includes('useSystemProxies=false'));
});

test('buildBootRunEnv: baseEnv 已有 S3_ENDPOINT 时不覆盖', () => {
  const env = buildBootRunEnv({ hostIp: '1.2.3.4', rpcHost: 'x', baseEnv: { S3_ENDPOINT: 'http://custom:9000' } });
  assert.equal(env.S3_ENDPOINT, 'http://custom:9000');
});

test('buildContainerRunArgs: 含 --privileged --network=host 与 env 参数', () => {
  const args = buildContainerRunArgs({ serverDir: '/repo', image: 'eclipse-temurin:21-jdk', envArgs: [['APP_PORT', '8081']] });
  assert.ok(args.includes('--privileged'));
  assert.ok(args.includes('--network=host'));
  assert.ok(args.includes('-e') && args.includes('APP_PORT=8081'));
});

test('startApp: 端口空闲时直接走本地分支 spawn bootRun', async () => {
  let spawned = null;
  const mockExec = () => '';   // pidOnPort 查不到 → 端口空闲；grant 权限调用也走这条不抛错
  const mockSpawn = (cmd, args, opts) => { spawned = { cmd, args, opts }; return { pid: 12345 }; };
  const dir = fakeRepo('no zgc here');
  const result = await startApp({ serverDir: dir, graalvm: { mode: 'local', javaHome: '/opt/graal' }, exec: mockExec, spawn: mockSpawn, fetchFn: async () => ({ json: async () => ({ status: 'green' }) }), waitFn: async () => true, log: () => {} });
  assert.equal(result.mode, 'local');
  assert.equal(result.pid, 12345);
  assert.equal(spawned.cmd, './gradlew');
  assert.deepEqual(spawned.args, ['bootRun', '--no-build-cache']);
});

test('startApp: 端口被占用且 killOld=false 时 fail loud，不静默等待', async () => {
  const mockExec = (cmd, args) => {
    if (args?.[1]?.includes('lsof')) return '99999\n';
    return '';
  };
  const dir = fakeRepo('no zgc');
  await assert.rejects(
    startApp({ serverDir: dir, graalvm: { mode: 'local', javaHome: '/opt/graal' }, exec: mockExec, killOld: false }),
    /端口 8081 已被占用.*--kill-old/,
  );
});

test('startApp: 端口被占用且 killOld=true 时先杀旧进程再继续', async () => {
  const killed = [];
  const mockExec = (cmd, args) => {
    if (cmd === 'kill') { killed.push(args[0]); return ''; }
    if (args?.[1]?.includes('lsof')) return '99999\n';
    return '';
  };
  const mockSpawn = () => ({ pid: 1 });
  const dir = fakeRepo('no zgc');
  await startApp({ serverDir: dir, graalvm: { mode: 'local', javaHome: '/opt/graal' }, exec: mockExec, spawn: mockSpawn, fetchFn: async () => ({ json: async () => ({ status: 'green' }) }), waitFn: async () => true, killOld: true, log: () => {} });
  assert.deepEqual(killed, ['99999']);
});
```

> **不测项**：容器分支（`graalvm.mode === 'container'`）的真实 `docker run` 执行不在自动化测试覆盖——本机沙箱通常无 Docker daemon 权限跑特权容器，命令构造逻辑已由 `buildContainerRunArgs` 单测覆盖，实际容器行为留给 dev-verify 阶段人工验证（风险：低——容器分支是本地无 GraalVM 时的降级路径，非默认路径）。

server-cli.mjs 挂 start verb（追加）：

```diff
+import { startApp } from './lib/server/boot.mjs';
+import { localInfraEnv, loadDotEnv } from './lib/server/env.mjs';
+
+SUPPORTED_VERBS.push('start');
+
 case 'infra':
   await startInfra();
   break;
+case 'start':
+  await start({ serverDir, killOld: flags.includes('--kill-old') });
+  break;
```

`server-cli.mjs` 同时导出完整 app 链（orchestrator T7 import 直调的入口；等价 dev-start.sh `app` 子命令 = .env 加载 → force_local_infra → start_infra → start_app，对应 1117-1121 行）：

```js
// bash force_local_infra 里带 ${VAR:-default} 语义（尊重已有环境变量）的 key；其余 key 强制覆盖为 localhost。
const RESPECT_EXISTING = ['DB_USERNAME', 'DB_PASSWORD', 'CACHE_MONGO_USERNAME', 'CACHE_MONGO_PASSWORD', 'DATASOURCE_MONGO_USERNAME', 'DATASOURCE_MONGO_PASSWORD', 'POLARS_MASTER_CONFIG_STR'];

export async function start({ serverDir, ports, killOld = false, log = console.log } = {}) {
  // 局部 env：不污染 process.env——orchestrator 同进程直调，后续起 web 不能继承 server 的 DB/S3/代理配置（红蓝裁决 E；bash 时代 dev-start.sh 是子进程天然隔离，node 直调必须显式隔离）
  const env = { ...process.env };
  loadDotEnv({ serverDir, env });   // 原 60-64 行：.env 先载入（不覆盖已有值）
  Object.assign(env, localInfraEnv({
    overrides: Object.fromEntries(RESPECT_EXISTING.filter((k) => env[k] !== undefined).map((k) => [k, env[k]])),
  }));   // 原 force_local_infra：本地模式强制基础设施指向 localhost
  await startInfra({ env, log });
  const graalvm = detectGraalvm({ serverDir, env });
  return startApp({ serverDir, appPort: ports?.server ?? 8081, graalvm, env, killOld, log });
}
```

**Commit**: `git add skills/agents-launcher/lib/server/boot.mjs skills/agents-launcher/lib/server/boot.test.mjs skills/agents-launcher/server-cli.mjs .claude-plugin/plugin.json && git commit -m "feat(agents-launcher): server-cli 挂 start 动词，GC patch + bootRun 启动链（6.5.4）"`

---

## Task T4b: server-cli stop/status 动词 [Size: S]

**描述**: 迁移 dev-start.sh 的停止逻辑（`stop_app` 859-907 行）+ 状态查询（`show_status` 973-1041 行的后端段，997-1019 行）。基础设施容器状态段不迁移——已由 `dev-orchestrator.mjs --status` 覆盖 pg/minio 探测（见现有 `dev-orchestrator.mjs:26-30`），不重复。

**验收标准**:
- [ ] `stopApp` 按序：容器模式先 `docker rm -f`；本地模式读 `.dev-start.pid` 杀进程组；再清端口残留
- [ ] `serverStatus` 输出 http/grpc/mgmt 三端口 UP/DOWN + PID，格式与现有 `dev-orchestrator.mjs --status` 一致
- [ ] `server-cli.mjs` 挂 `stop`/`status` verb

**covers**: 启停.P4, 系统.2

**验证命令**:
- `node --test skills/agents-launcher/lib/server/lifecycle.test.mjs` — 预期输出: `# pass 6` `# fail 0`

**文件**: (3 个)
- `skills/agents-launcher/lib/server/lifecycle.mjs`（新建）
- `skills/agents-launcher/lib/server/lifecycle.test.mjs`（新建）
- `skills/agents-launcher/server-cli.mjs`（改：挂 stop/status verb）

**依赖**: Task T1（probe.mjs）、Task T2（server-cli 骨架）

**真实改动**:

`skills/agents-launcher/lib/server/lifecycle.mjs`（对应 dev-start.sh 859-907、997-1019 行）：

```js
// server 停止 + 状态查询。对应 dev-start.sh stop_app（859-907）+ show_status 后端段（997-1019）。
// 基础设施容器状态不在此——已由 dev-orchestrator.mjs --status 覆盖 pg/minio 探测，不重复。
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pidOnPort } from '../probe.mjs';

export function stopApp({ serverDir, appPort = 8081, exec = execFileSync, log = console.log } = {}) {
  let killed = false;

  try {
    exec('docker', ['rm', '-f', 'dev-backend']);
    killed = true;
    log('[stop] 已停止容器 dev-backend');
  } catch { /* 容器模式未使用，忽略 */ }

  const pidFile = join(serverDir, '.dev-start.pid');
  if (existsSync(pidFile)) {
    const pid = readFileSync(pidFile, 'utf8').trim();
    if (pid && pid !== 'container') {
      try { exec('kill', ['--', `-${pid}`]); } catch { try { exec('kill', [pid]); } catch { /* 进程已退出 */ } }
      killed = true;
      log(`[stop] 已终止进程组 (PID: ${pid})`);
    }
    unlinkSync(pidFile);
  }

  const residualPid = pidOnPort(appPort, { exec });
  if (residualPid) {
    try { exec('kill', [residualPid]); } catch { /* 已退出 */ }
    killed = true;
    log(`[stop] 已终止 :${appPort} 残留进程 (PID: ${residualPid})`);
  }

  if (!killed) {
    log('[stop] 未找到运行中的后端服务');
  }
  return { killed };
}

export function serverStatus({ appPort = 8081, grpcPort = 9090, mgmtPort = 8075, exec = execFileSync } = {}) {
  const row = (name, port) => {
    const pid = pidOnPort(port, { exec });
    return { name, port, up: Boolean(pid), pid: pid || '-' };
  };
  return {
    http: row('HTTP', appPort),
    grpc: row('gRPC', grpcPort),
    mgmt: row('管理', mgmtPort),
  };
}
```

`skills/agents-launcher/lib/server/lifecycle.test.mjs`：

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stopApp, serverStatus } from './lifecycle.mjs';

test('stopApp: 有 pid 文件时读取并杀进程组，再删文件', () => {
  const dir = mkdtempSync(join(tmpdir(), 'srv-'));
  writeFileSync(join(dir, '.dev-start.pid'), '54321');
  const killed = [];
  const mockExec = (cmd, args) => {
    if (cmd === 'docker') throw new Error('no container');
    if (cmd === 'kill') { killed.push(args); return ''; }
    return '';   // lsof 残留检查查不到
  };
  const result = stopApp({ serverDir: dir, exec: mockExec, log: () => {} });
  assert.equal(result.killed, true);
  assert.ok(killed.some((a) => a.includes('-54321')));
  assert.equal(existsSync(join(dir, '.dev-start.pid')), false);
});

test('stopApp: pid 文件值为 container 时跳过 kill（容器模式已由 docker rm 处理）', () => {
  const dir = mkdtempSync(join(tmpdir(), 'srv-'));
  writeFileSync(join(dir, '.dev-start.pid'), 'container');
  const killed = [];
  const mockExec = (cmd, args) => {
    if (cmd === 'docker') { killed.push('docker-rm'); return ''; }
    if (cmd === 'kill') { killed.push(args); return ''; }
    return '';
  };
  const result = stopApp({ serverDir: dir, exec: mockExec, log: () => {} });
  assert.equal(result.killed, true);
  assert.ok(!killed.some((a) => Array.isArray(a)));   // 没有 kill 数组参数被记录
});

test('stopApp: 无 pid 文件也无残留端口时报告未找到运行中的服务', () => {
  const dir = mkdtempSync(join(tmpdir(), 'srv-'));
  const logs = [];
  const mockExec = () => { throw new Error('none'); };
  const result = stopApp({ serverDir: dir, exec: mockExec, log: (m) => logs.push(m) });
  assert.equal(result.killed, false);
  assert.ok(logs.some((l) => l.includes('未找到运行中的后端服务')));
});

test('stopApp: 端口有残留进程时也 kill 掉', () => {
  const dir = mkdtempSync(join(tmpdir(), 'srv-'));
  const killed = [];
  const mockExec = (cmd, args) => {
    if (cmd === 'docker') throw new Error('no container');
    if (cmd === 'kill') { killed.push(args); return ''; }
    if (args?.[1]?.includes('lsof')) return '77777\n';
    return '';
  };
  const result = stopApp({ serverDir: dir, exec: mockExec, log: () => {} });
  assert.equal(result.killed, true);
  assert.ok(killed.some((a) => a.includes('77777')));
});

test('serverStatus: 全端口 DOWN 时返回 up=false pid=-', () => {
  const mockExec = () => { throw new Error('none'); };
  const status = serverStatus({ exec: mockExec });
  assert.equal(status.http.up, false);
  assert.equal(status.http.pid, '-');
  assert.equal(status.grpc.up, false);
});

test('serverStatus: http 端口 UP 时返回对应 pid', () => {
  const mockExec = (cmd, args) => {
    if (args?.[1]?.includes('tcp:8081')) return '11111\n';
    throw new Error('none');
  };
  const status = serverStatus({ exec: mockExec });
  assert.equal(status.http.up, true);
  assert.equal(status.http.pid, '11111');
  assert.equal(status.grpc.up, false);
});
```

server-cli.mjs 挂 stop/status verb（追加）：

```diff
+import { stopApp, serverStatus } from './lib/server/lifecycle.mjs';
+
+SUPPORTED_VERBS.push('stop', 'status');
+
 case 'start': {
   ...
   break;
 }
+case 'stop':
+  stopApp({ serverDir });
+  break;
+case 'status': {
+  const s = serverStatus();
+  for (const row of Object.values(s)) {
+    console.log(`[status] ${row.name.padEnd(4)} :${row.port} ${row.up ? 'UP  ' : 'DOWN'} pid=${row.pid}`);
+  }
+  break;
+}
```

**Commit**: `git add skills/agents-launcher/lib/server/lifecycle.mjs skills/agents-launcher/lib/server/lifecycle.test.mjs skills/agents-launcher/server-cli.mjs .claude-plugin/plugin.json && git commit -m "feat(agents-launcher): server-cli 挂 stop/status 动词，server-cli 四动词齐全（6.5.5）"`

---


## ✅ Checkpoint C1: 覆盖 Task 1-4b（server-cli 独立可用）

**全部测试**:
- `node --test 'skills/agents-launcher/lib/*.test.mjs' 'skills/agents-launcher/lib/server/*.test.mjs' 'skills/agents-launcher/server-cli.test.mjs'`   # 预期: all passing

**真机 smoke（HITL）**:
- `FX_SERVER_DIR=/Users/yes365/Work/Source/fx-data-server-release node skills/agents-launcher/server-cli.mjs prepare`   # 预期: ANTLR 生成目录非空 + GraalVM 检测结果输出（SC-3 直接验证）
- [ ] 用户确认继续 / 调整 / 回滚

**Rollback 点**: T1-T4b 各自已 commit。


## Task 5: agents-cli — config.yaml 校验/cp + CSS 检查 + kill + start [Size: S]

**描述**: 把 orchestrator 里内联的 agents 专属逻辑（config.yaml 存在性校验、CSS 产物检查、`pnpm dev:server` 启动、kill 命令）收编成独立可 import 的 `agents-cli.mjs`，同时把 SKILL.md Step 1 的「cp config.yaml」手工步骤变成一个可调用的 `prepare()` 函数。契约：导出的 `start()` 返回 ChildProcess 且**不等待健康**——健康等待归调用方（orchestrator `waitHealthy` / CLI main 前台跟随）；CLI main 的 start verb 为前台跟随模式（Ctrl-C 停），编排场景走 orchestrator（红蓝裁决 B）。

**验收标准**:
- [ ] `node skills/agents-launcher/agents-cli.mjs status` 可独立运行，输出 agents `/health` UP/DOWN + PID
- [ ] `prepare()` 在 config.yaml 缺失时给出与现有报错一致的提示（含 cp 模板路径）
- [ ] `node --test skills/agents-launcher/agents-cli.test.mjs` 全过

**covers**: 启停.P2, 启停.P5, SC-1

**验证命令**:
- `node --test skills/agents-launcher/agents-cli.test.mjs`   # 预期输出: 9 passing (含 prepare 三分支 2 + killCommands 1 + ensureCss 2 + configPath/envLocalPath 等边界)
- `node skills/agents-launcher/agents-cli.mjs status`         # 预期输出: `[status] agents :8070 DOWN pid=-`（本机未起时）

**文件**: (3 个)
- `skills/agents-launcher/agents-cli.mjs`
- `skills/agents-launcher/agents-cli.test.mjs`
- `skills/agents-launcher/lib/probe.mjs`（若 Task 1 尚未落地则本 task 顺带建立最小版本，签名与 Task 1 骨架一致，供 Task 1 复核合并）

**依赖**: Task 1（lib/probe.mjs 的 tcpOpen/httpOk/pidOnPort）

**真实改动**:

```js
// skills/agents-launcher/agents-cli.mjs
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolveRepos, validateRepos } from './lib/paths.mjs';
import { httpOk, pidOnPort } from './lib/probe.mjs';
import { spawnPrefixed, runToEnd } from './lib/proc.mjs';

const PORTS = { agents: 8070 };

// ---- 纯函数：路径/命令构造，不碰 fs/进程 ----

export function configPath(agentsDir) {
  return join(agentsDir, 'packages/server/conf/config.yaml');
}

export function killCommands({ ports = PORTS } = {}) {
  const sh = (s) => ['sh', ['-c', s]];
  return [
    ['pkill', ['-f', 'telemetry/preload.ts']],          // tsx watch 父进程，只杀子 node 会被父 watch 重启
    sh(`lsof -ti tcp:${ports.agents} | xargs kill -9 2>/dev/null || true`),
  ];
}

// ---- 有副作用：fs / 进程，接受注入方便测试 ----

export function prepare({ agentsDir, fromDir, fs = { existsSync, mkdirSync, copyFileSync } } = {}) {
  const dst = configPath(agentsDir);
  if (fs.existsSync(dst)) return { action: 'exists', path: dst };

  if (fromDir) {
    const src = configPath(fromDir);
    if (fs.existsSync(src)) {
      fs.mkdirSync(dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
      return { action: 'copied', path: dst, from: src };
    }
  }

  const example = join(agentsDir, 'packages/server/conf/config.example.yaml');
  throw new Error(
    `agents config.yaml 不存在: ${dst}\n请先 cp ${example} ${dst} 并填 pg/minio/LLM`,
  );
}

export async function ensureCss({ agentsDir, run = runToEnd } = {}) {
  const cssOk = existsSync(join(agentsDir, 'packages/desktop/dist/style.css'))
    && existsSync(join(agentsDir, 'packages/ui/dist/agent-ui.css'));
  if (cssOk) return { action: 'skipped' };
  await run('build:css', 'pnpm', ['build:css'], { cwd: agentsDir });
  return { action: 'built' };
}

export function start({ agentsDir, spawn = spawnPrefixed } = {}) {
  return spawn('agents', 'pnpm', ['dev:server'], { cwd: agentsDir });
}

export async function status({ ports = PORTS, probes = { httpOk, pidOnPort } } = {}) {
  const up = await probes.httpOk(`http://127.0.0.1:${ports.agents}/health`);
  const pid = up ? await probes.pidOnPort(ports.agents) : '-';
  return { name: 'agents', port: ports.agents, up, pid };
}

// ---- CLI 分发（仅被直接执行时跑）----

async function main() {
  const toolDir = dirname(fileURLToPath(import.meta.url));
  const verb = process.argv[2];
  const repos = resolveRepos({ toolDir });

  if (verb === 'status') {
    const s = await status({});
    console.log(`[status] agents :${s.port} ${s.up ? 'UP  ' : 'DOWN'} pid=${s.pid}`);
    return;
  }

  validateRepos(repos, { need: ['AGENTS_DIR'] });

  if (verb === 'prepare') {
    const r = prepare({ agentsDir: repos.AGENTS_DIR, fromDir: process.env.FX_AGENTS_FROM });
    console.log(`[prepare] ${r.action} -> ${r.path}`);
    return;
  }
  if (verb === 'stop') {
    for (const [cmd, args] of killCommands({})) await runToEnd('stop', cmd, args);
    return;
  }
  if (verb === 'start') {
    await ensureCss({ agentsDir: repos.AGENTS_DIR });
    start({ agentsDir: repos.AGENTS_DIR });
    return;
  }
  console.error('用法: agents-cli.mjs {prepare|start|stop|status}');
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(`[agents-cli] 失败: ${e.message}`); process.exit(1); });
}
```

```js
// skills/agents-launcher/agents-cli.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configPath, prepare, killCommands, ensureCss } from './agents-cli.mjs';

function makeAgentsDir() {
  const dir = mkdtempSync(join(tmpdir(), 'agents-cli-'));
  mkdirSync(join(dir, 'packages/server/conf'), { recursive: true });
  return dir;
}

test('configPath 拼接 packages/server/conf/config.yaml', () => {
  assert.equal(configPath('/repo'), '/repo/packages/server/conf/config.yaml');
});

test('prepare: config.yaml 已存在 → action=exists，不覆盖', () => {
  const dir = makeAgentsDir();
  try {
    writeFileSync(configPath(dir), 'existing: true\n');
    const r = prepare({ agentsDir: dir });
    assert.equal(r.action, 'exists');
    assert.equal(r.path, configPath(dir));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('prepare: 缺失且给了 fromDir 且源存在 → cp 并返回 copied', () => {
  const dst = makeAgentsDir();
  const src = makeAgentsDir();
  try {
    writeFileSync(configPath(src), 'from: main-repo\n');
    const r = prepare({ agentsDir: dst, fromDir: src });
    assert.equal(r.action, 'copied');
    assert.ok(existsSync(configPath(dst)));
  } finally {
    rmSync(dst, { recursive: true, force: true });
    rmSync(src, { recursive: true, force: true });
  }
});

test('prepare: 缺失且无可用 fromDir → 抛错，报错含 cp 模板提示', () => {
  const dir = makeAgentsDir();
  try {
    assert.throws(() => prepare({ agentsDir: dir }), /config\.example\.yaml/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('killCommands 含 tsx watch 父进程 kill + 端口清理，不碰 web/server', () => {
  const cmds = killCommands({ ports: { agents: 8070 } });
  const flat = cmds.map((c) => c.join(' '));
  assert.ok(flat.some((s) => s.includes('telemetry/preload.ts')));
  assert.ok(flat.some((s) => s.includes('tcp:8070')));
  assert.ok(!flat.some((s) => s.includes('tcp:10001')), '不该碰 web 端口');
});

test('ensureCss: CSS 产物已存在则跳过 build:css', async () => {
  let called = false;
  const dir = makeAgentsDir();
  mkdirSync(join(dir, 'packages/desktop/dist'), { recursive: true });
  mkdirSync(join(dir, 'packages/ui/dist'), { recursive: true });
  writeFileSync(join(dir, 'packages/desktop/dist/style.css'), '');
  writeFileSync(join(dir, 'packages/ui/dist/agent-ui.css'), '');
  try {
    const r = await ensureCss({ agentsDir: dir, run: async () => { called = true; } });
    assert.equal(r.action, 'skipped');
    assert.equal(called, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('ensureCss: CSS 产物缺失则跑 build:css', async () => {
  let calledWith = null;
  const dir = makeAgentsDir();
  try {
    const r = await ensureCss({ agentsDir: dir, run: async (label, cmd, args) => { calledWith = [label, cmd, args]; } });
    assert.equal(r.action, 'built');
    assert.deepEqual(calledWith, ['build:css', 'pnpm', ['build:css']]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
```

**Step 1**: 写上面 7 条测试到 `agents-cli.test.mjs`（此时 `agents-cli.mjs` 尚不存在或为空）。
**Step 2**: `node --test skills/agents-launcher/agents-cli.test.mjs` → 预期 FAIL with `Cannot find module './agents-cli.mjs'`。
**Step 3**: 写上面 `agents-cli.mjs` 实现。
**Step 4**: `node --test skills/agents-launcher/agents-cli.test.mjs` → 预期 PASS，`# pass 7`。
**Step 5**: `git add skills/agents-launcher/agents-cli.mjs skills/agents-launcher/agents-cli.test.mjs .claude-plugin/plugin.json && git commit -m "feat(agents-launcher): 新增 agents-cli，收编 config.yaml 校验/cp + CSS 检查（6.5.6）"`

---

## Task 6: web-cli — .env.local cp/写入 + packageManager patch + fork 对齐 + start [Size: M]

**描述**: 把 SKILL.md Step 1/Gate 1.5/Step 2 里三个手工 prose 步骤（cp `.env.local`、corepack 版本不兼容时改 `packageManager`、两仓 fork 时间不对齐时 `reset --hard`）收编成 `web-cli.mjs` 的可调用函数 + verb，连同现有 `.env.local` 写入（内化 `buildWriteTargets` 的 webEnv 部分，`lib/ports.mjs` 现有导出本 task 不动，留 Task 7 统一清理）与 kill/start。契约：导出的 `start()` 返回 ChildProcess 且**不等待健康**——健康等待归调用方（orchestrator `waitHealthy` / CLI main 前台跟随）；CLI main 的 start verb 为前台跟随模式（Ctrl-C 停），编排场景走 orchestrator（红蓝裁决 B）。

**验收标准**:
- [ ] `pkgmgrCheck` 能正确读出 `package.json` 的 `packageManager` 字段，与 corepack 缓存目录（`~/.cache/node/corepack/v1/pnpm/<version>/`）比对
- [ ] `pkgmgrPatch` 只改 `packageManager` 一个字段的值，其余字段顺序/内容不变（用 diff 验证）
- [ ] `alignReset` 无 `--reset` flag 时不可达（CLI 层拒绝裸跑，防止 skill 层漏 askUser gate 时被误执行）
- [ ] `node --test skills/agents-launcher/web-cli.test.mjs` 全过

**covers**: 启停.P2, 启停.P5, 约束.1, SC-2

**验证命令**:
- `node --test skills/agents-launcher/web-cli.test.mjs`   # 预期输出: 12 passing（含新增 buildWebEnv 永久字面锚，红蓝裁决 H）
- `node skills/agents-launcher/web-cli.mjs status`         # 预期输出: `[status] web :10001 DOWN pid=-`（本机未起时）

**文件**: (2 个)
- `skills/agents-launcher/web-cli.mjs`
- `skills/agents-launcher/web-cli.test.mjs`

**依赖**: Task 1（lib/probe.mjs）；与 Task 5 并行（互不读写对方文件）

**真实改动**:

```js
// skills/agents-launcher/web-cli.mjs
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolveRepos, validateRepos } from './lib/paths.mjs';
import { tcpOpen, pidOnPort } from './lib/probe.mjs';
import { spawnPrefixed, runToEnd } from './lib/proc.mjs';
import { upsertEnv } from './lib/env-file.mjs';

const PORTS = { web: 10001, agents: 8070 };
const COREPACK_PNPM_DIR = join(process.env.HOME || '', '.cache/node/corepack/v1/pnpm');

// ---- 纯函数 ----

export function envLocalPath(webDir) {
  return join(webDir, 'packages/jsy-web/server/.env.local');
}

// 与 lib/ports.mjs buildWriteTargets 的 webEnv 四键保持一致（回归锚见测试）。
// 不改 lib/ports.mjs 现有导出——旧导出的清理/收敛统一放 Task 7（orchestrator 瘦身时一并处理）。
export function buildWebEnv({ agentsDir, ports = PORTS }) {
  return {
    AGENTS_LOCAL_SERVER: `http://127.0.0.1:${ports.agents}`,
    USER_CLIENT: 'localDebugger',
    AGENTS_LOCAL_SRC: agentsDir,
    DEV_SERVER_PORT: String(ports.web),
  };
}

export function killCommands({ ports = PORTS } = {}) {
  const sh = (s) => ['sh', ['-c', s]];
  return [sh(`lsof -ti tcp:${ports.web} | xargs kill -9 2>/dev/null || true`)];
}

// ---- 有副作用（接受注入）----

export function prepare({ webDir, fromDir, fs = { existsSync, mkdirSync, copyFileSync } } = {}) {
  const dst = envLocalPath(webDir);
  if (fs.existsSync(dst)) return { action: 'exists', path: dst };

  if (fromDir) {
    const src = envLocalPath(fromDir);
    if (fs.existsSync(src)) {
      fs.mkdirSync(dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
      return { action: 'copied', path: dst, from: src };
    }
  }
  throw new Error(`web .env.local 不存在: ${dst}\n请从可用来源 cp 一份，或用 --from-dir 指定`);
}

export function writeEnv({ webDir, agentsDir, ports = PORTS }) {
  const path = envLocalPath(webDir);
  upsertEnv(path, buildWebEnv({ agentsDir, ports }));
  return { path };
}

export function pkgmgrCheck({ webDir, corepackDir = COREPACK_PNPM_DIR, fs = { readFileSync, readdirSync, existsSync } } = {}) {
  const pkg = JSON.parse(fs.readFileSync(join(webDir, 'package.json'), 'utf8'));
  const locked = pkg.packageManager || null;   // "pnpm@10.10.0"
  const lockedVersion = locked ? locked.split('@')[1] : null;
  const cached = fs.existsSync(corepackDir) ? fs.readdirSync(corepackDir) : [];
  const needsPatch = Boolean(lockedVersion) && !cached.includes(lockedVersion);
  return { locked, lockedVersion, cached, needsPatch };
}

export function pkgmgrPatch({ webDir, version, fs = { readFileSync, writeFileSync } } = {}) {
  const path = join(webDir, 'package.json');
  const raw = fs.readFileSync(path, 'utf8');
  const pkg = JSON.parse(raw);
  const oldLine = `"packageManager": "${pkg.packageManager}"`;
  const newLine = `"packageManager": "pnpm@${version}"`;
  if (!raw.includes(oldLine)) {
    throw new Error(`package.json 里没找到精确匹配的 packageManager 行，拒绝定向替换（避免误改）: ${oldLine}`);
  }
  // 定向字符串替换而非 JSON.stringify 整体重写——避免 key 顺序 / 缩进 / 尾随逗号风格被重排
  const patched = raw.replace(oldLine, newLine);
  fs.writeFileSync(path, patched);
  return { path, from: pkg.packageManager, to: `pnpm@${version}` };
}

export function alignCheck({ webDir, targetSha, exec = execFileSync }) {
  const headSha = exec('git', ['-C', webDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  return { aligned: headSha === targetSha, headSha };
}

// 对应 SKILL.md Gate 2.2：破坏性动作，只有 skill 层拿到用户 askUser 确认后才应调用本函数。
// CLI 分发层同样要求显式 --reset flag 才可达（见 main() verb='align'），防止裸跑误触发。
export function alignReset({ webDir, targetSha, exec = execFileSync }) {
  exec('git', ['-C', webDir, 'reset', '--hard', targetSha], { encoding: 'utf8' });
  return { reset: true, targetSha };
}

export function start({ webDir, spawn = spawnPrefixed } = {}) {
  return spawn('web', 'pnpm', ['dev'], { cwd: webDir, env: { ...process.env, JSY_DEV_MODE: 'vite' } });
}

export async function status({ ports = PORTS, probes = { tcpOpen, pidOnPort } } = {}) {
  const up = await probes.tcpOpen(ports.web);
  const pid = up ? await probes.pidOnPort(ports.web) : '-';
  return { name: 'web', port: ports.web, up, pid };
}

// ---- CLI 分发 ----

async function main() {
  const toolDir = dirname(fileURLToPath(import.meta.url));
  const verb = process.argv[2];
  const repos = resolveRepos({ toolDir });

  if (verb === 'status') {
    const s = await status({});
    console.log(`[status] web :${s.port} ${s.up ? 'UP  ' : 'DOWN'} pid=${s.pid}`);
    return;
  }

  validateRepos(repos, { need: ['WEB_DIR'] });

  if (verb === 'prepare') {
    const r = prepare({ webDir: repos.WEB_DIR, fromDir: process.env.FX_WEB_FROM });
    console.log(`[prepare] ${r.action} -> ${r.path}`);
    return;
  }
  if (verb === 'env') {
    validateRepos(repos, { need: ['AGENTS_DIR'] });
    const r = writeEnv({ webDir: repos.WEB_DIR, agentsDir: repos.AGENTS_DIR });
    console.log(`[env] 已写入 ${r.path}（目标文件: ${r.path}）`);
    return;
  }
  if (verb === 'pkgmgr') {
    const check = pkgmgrCheck({ webDir: repos.WEB_DIR });
    if (!check.needsPatch) { console.log(`[pkgmgr] ${check.locked} 已在本机缓存，无需 patch`); return; }
    const patchTo = process.argv[3];   // e.g. --patch=10.33.0，由 skill 层 askUser 确认后传入
    if (!patchTo || !patchTo.startsWith('--patch=')) {
      console.log(`[pkgmgr] ${check.locked} 本机未缓存（已缓存: ${check.cached.join(', ') || '无'}）。需 patch 请传 --patch=<version>`);
      return;
    }
    const r = pkgmgrPatch({ webDir: repos.WEB_DIR, version: patchTo.slice('--patch='.length) });
    console.log(`[pkgmgr] ${r.from} -> ${r.to}（目标文件: ${r.path}，worktree 销毁时改动一起没）`);
    return;
  }
  if (verb === 'align') {
    const targetSha = process.argv[3];
    if (!targetSha) { console.error('用法: web-cli.mjs align <target-sha> [--reset]'); process.exit(1); }
    const check = alignCheck({ webDir: repos.WEB_DIR, targetSha });
    if (check.aligned) { console.log(`[align] 已对齐 HEAD=${check.headSha}`); return; }
    if (process.argv.includes('--reset')) {
      alignReset({ webDir: repos.WEB_DIR, targetSha });
      console.log(`[align] 已 reset --hard 到 ${targetSha}（目标文件: ${repos.WEB_DIR}，Gate 1.5 若改过 package.json 需重做）`);
    } else {
      console.log(`[align] 未对齐: HEAD=${check.headSha} != target=${targetSha}。需 reset 请加 --reset（仅限 worktree，禁止对主仓用）`);
    }
    return;
  }
  if (verb === 'stop') {
    for (const [cmd, args] of killCommands({})) await runToEnd('stop', cmd, args);
    return;
  }
  if (verb === 'start') {
    start({ webDir: repos.WEB_DIR });
    return;
  }
  console.error('用法: web-cli.mjs {prepare|env|pkgmgr|align|start|stop|status}');
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(`[web-cli] 失败: ${e.message}`); process.exit(1); });
}
```

```js
// skills/agents-launcher/web-cli.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  envLocalPath, buildWebEnv, prepare, pkgmgrCheck, pkgmgrPatch,
  alignCheck, alignReset, killCommands,
} from './web-cli.mjs';
// 旧导出将在 T8 删除；动态 import + skip 让回归锚在删除后自动跳过而非 import 失败
const legacyPorts = await import('./lib/ports.mjs');

function makeWebDir() {
  const dir = mkdtempSync(join(tmpdir(), 'web-cli-'));
  mkdirSync(join(dir, 'packages/jsy-web/server'), { recursive: true });
  return dir;
}

test('envLocalPath 拼接 packages/jsy-web/server/.env.local', () => {
  assert.equal(envLocalPath('/repo'), '/repo/packages/jsy-web/server/.env.local');
});

test('buildWebEnv 与旧 buildWriteTargets 输出一致（回归锚；T8 删除旧导出后自动跳过）', { skip: !legacyPorts.buildWriteTargets }, () => {
  const legacy = legacyPorts.buildWriteTargets({ agentsDir: '/x/agents', ports: { agents: 8070, web: 10001 } }).webEnv;
  const next = buildWebEnv({ agentsDir: '/x/agents', ports: { agents: 8070, web: 10001 } });
  assert.deepEqual(next, legacy);
});

test('buildWebEnv 四键字面值（永久锚，不依赖旧导出）', () => {
  assert.deepEqual(buildWebEnv({ agentsDir: '/x/agents', ports: { agents: 8070, web: 10001 } }), {
    AGENTS_LOCAL_SERVER: 'http://127.0.0.1:8070',
    USER_CLIENT: 'localDebugger',
    AGENTS_LOCAL_SRC: '/x/agents',
    DEV_SERVER_PORT: '10001',
  });
});

test('prepare: .env.local 已存在 → action=exists', () => {
  const dir = makeWebDir();
  try {
    writeFileSync(envLocalPath(dir), 'EXISTING=1\n');
    const r = prepare({ webDir: dir });
    assert.equal(r.action, 'exists');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('prepare: 缺失 + fromDir 有源 → copied', () => {
  const dst = makeWebDir();
  const src = makeWebDir();
  try {
    writeFileSync(envLocalPath(src), 'AGENTS_LOCAL_SRC=/main\n');
    const r = prepare({ webDir: dst, fromDir: src });
    assert.equal(r.action, 'copied');
    assert.ok(existsSync(envLocalPath(dst)));
  } finally {
    rmSync(dst, { recursive: true, force: true });
    rmSync(src, { recursive: true, force: true });
  }
});

test('prepare: 缺失且无 fromDir → 抛错', () => {
  const dir = makeWebDir();
  try { assert.throws(() => prepare({ webDir: dir }), /\.env\.local 不存在/); }
  finally { rmSync(dir, { recursive: true, force: true }); }
});

test('pkgmgrCheck: 锁定版本本机已缓存 → needsPatch=false', () => {
  const dir = makeWebDir();
  const corepackDir = mkdtempSync(join(tmpdir(), 'corepack-'));
  mkdirSync(join(corepackDir, '10.33.0'));
  try {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', packageManager: 'pnpm@10.33.0' }, null, 2));
    const r = pkgmgrCheck({ webDir: dir, corepackDir });
    assert.equal(r.needsPatch, false);
    assert.equal(r.lockedVersion, '10.33.0');
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(corepackDir, { recursive: true, force: true });
  }
});

test('pkgmgrCheck: 锁定版本本机未缓存 → needsPatch=true，列出已缓存版本', () => {
  const dir = makeWebDir();
  const corepackDir = mkdtempSync(join(tmpdir(), 'corepack-'));
  mkdirSync(join(corepackDir, '10.33.0'));
  try {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', packageManager: 'pnpm@10.10.0' }, null, 2));
    const r = pkgmgrCheck({ webDir: dir, corepackDir });
    assert.equal(r.needsPatch, true);
    assert.deepEqual(r.cached, ['10.33.0']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(corepackDir, { recursive: true, force: true });
  }
});

test('pkgmgrPatch: 只改 packageManager 字段值，其余内容原样保留（含缩进/顺序）', () => {
  const dir = makeWebDir();
  const original = '{\n  "name": "fx-data-web",\n  "version": "1.0.0",\n  "packageManager": "pnpm@10.10.0",\n  "scripts": {\n    "dev": "vite"\n  }\n}\n';
  try {
    writeFileSync(join(dir, 'package.json'), original);
    const r = pkgmgrPatch({ webDir: dir, version: '10.33.0' });
    assert.equal(r.from, 'pnpm@10.10.0');
    assert.equal(r.to, 'pnpm@10.33.0');
    const patched = readFileSync(join(dir, 'package.json'), 'utf8');
    assert.equal(patched, original.replace('pnpm@10.10.0', 'pnpm@10.33.0'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('alignCheck: HEAD 与 targetSha 一致时 aligned=true（注入 exec）', () => {
  const r = alignCheck({ webDir: '/fake', targetSha: 'abc123', exec: () => 'abc123\n' });
  assert.equal(r.aligned, true);
  assert.equal(r.headSha, 'abc123');
});

test('alignCheck: 不一致时 aligned=false', () => {
  const r = alignCheck({ webDir: '/fake', targetSha: 'abc123', exec: () => 'def456\n' });
  assert.equal(r.aligned, false);
});

test('alignReset: 调用 git reset --hard <targetSha>（注入 exec，验证参数）', () => {
  let called = null;
  alignReset({ webDir: '/fake', targetSha: 'abc123', exec: (cmd, args) => { called = [cmd, args]; return ''; } });
  assert.deepEqual(called, ['git', ['-C', '/fake', 'reset', '--hard', 'abc123']]);
});

test('killCommands 只清 web 端口，不碰 agents/server', () => {
  const cmds = killCommands({ ports: { web: 10001 } });
  const flat = cmds.map((c) => c.join(' '));
  assert.ok(flat.some((s) => s.includes('tcp:10001')));
  assert.ok(!flat.some((s) => s.includes('telemetry')), '不该碰 agents');
});
```

**Step 1**: 写上面 11 条测试到 `web-cli.test.mjs`。
**Step 2**: `node --test skills/agents-launcher/web-cli.test.mjs` → 预期 FAIL with `Cannot find module './web-cli.mjs'`。
**Step 3**: 写上面 `web-cli.mjs` 实现。
**Step 4**: `node --test skills/agents-launcher/web-cli.test.mjs` → 预期 PASS，`# pass 11`。
**Step 5**: `git add skills/agents-launcher/web-cli.mjs skills/agents-launcher/web-cli.test.mjs .claude-plugin/plugin.json && git commit -m "feat(agents-launcher): 新增 web-cli，收编 .env.local cp/写入 + packageManager patch + fork 对齐（6.5.7）"`

## ✅ Checkpoint C2: 覆盖 Task 5-6（三 CLI 齐）

**全部测试**:
- `node --test 'skills/agents-launcher/*.test.mjs' 'skills/agents-launcher/lib/*.test.mjs' 'skills/agents-launcher/lib/server/*.test.mjs'`   # 预期: all passing

**用户 Review**:
- [ ] demo: agents-cli prepare 三分支 / web-cli pkgmgr 检测输出
- [ ] 用户确认继续

**Rollback 点**: T5/T6 各自已 commit。


## Task 7: orchestrator 退纯编排 — import 三 CLI 函数直调 [Size: M]

**描述**: dev-orchestrator.mjs 保留跨服务编排（workspace 档位、docker 步、启动顺序、healthy 聚合、teardown），全部 per-service 知识改为 import 三个 CLI 模块的函数直调：agents 的 config 校验/CSS 检查/启动/kill、web 的 env 写入/启动/kill、server 的启动（替换 dev-start.sh spawn）。`lib/proc.mjs` 的 `buildKillCommands` 拆迁到各 CLI 后从 proc.mjs 删除；`server-cli.mjs` 补一个 `killCommands` 导出供 teardown 同步 exec 用。显式决策（红蓝裁决 D）：orchestrator `--status` 保持旧五行输出（probe+PORTS 直接投影，web/agents/server/pg/minio），不改调 CLI status——行为不回归优先；CLI 的 status verb 是 standalone 视图，两者共享 `lib/probe.mjs` 与 `PORTS` 单源，不构成杀法/健康语义双写。

**验收标准**:
- [ ] orchestrator 不再出现任何 per-service 字面量（config.yaml 路径 / .env.local 键 / pkill 关键词 / dev-start.sh）
- [ ] `--workspace` / `--status` / `--stop` / `--yes` / `--dry-run` / `--no-<svc>` 行为与现状一致（输出格式不变）
- [ ] `lib/proc.mjs` 不再导出 `buildKillCommands`，其测试同步删除；`waitHealthy/runToEnd/spawnPrefixed` 保留
- [ ] teardown（SIGINT/SIGTERM/失败清理）仍覆盖三服务 + docker 条件 down

**covers**: [启停.P1, 约束.2, 约束.3, 系统.1, 系统.2]

**验证命令**:
- `node --test 'skills/agents-launcher/lib/*.test.mjs' 'skills/agents-launcher/*.test.mjs'`   # 预期: 全 pass，proc.test.mjs 无 buildKillCommands 用例
- `FX_AGENTS_DIR=/Users/yes365/Work/Source/fx-data-agents FX_WEB_DIR=/Users/yes365/Work/Source/fx-data-web node skills/agents-launcher/dev-orchestrator.mjs --dry-run`   # 预期: 打印 would KILL / would WRITE 计划后退出，不起服务
- `node skills/agents-launcher/dev-orchestrator.mjs --status`   # 预期: web/agents/server/pg/minio 五行 UP/DOWN + pid

**文件**: (4 个)
- `skills/agents-launcher/dev-orchestrator.mjs`（重构）
- `skills/agents-launcher/server-cli.mjs`（补 killCommands 导出）
- `skills/agents-launcher/lib/proc.mjs`（删 buildKillCommands）
- `skills/agents-launcher/lib/proc.test.mjs`（删对应用例）

**依赖**: Task 4b, Task 5, Task 6

**真实改动**:

- [ ] Step 1: 写失败测试 — proc.test.mjs 删 buildKillCommands 用例后，先给 orchestrator 的组合 kill 断言挪到各 CLI 测试（T5/T6/T4b 已各自覆盖 killCommands），本 task 的新增断言：server-cli killCommands 导出

```js
// skills/agents-launcher/server-cli.test.mjs 追加
test('killCommands 返回 gradlew --stop + 容器清理 + 端口清理三段', () => {
  const cmds = killCommands({ ports: { server: 8081 }, serverDir: '/tmp/srv' });
  assert.equal(cmds.length, 3);
  assert.deepEqual(cmds[0], ['sh', ['-c', 'cd /tmp/srv && ./gradlew --stop || true']]);
  assert.deepEqual(cmds[1], ['sh', ['-c', 'docker rm -f dev-backend 2>/dev/null || true']]);
  assert.deepEqual(cmds[2], ['sh', ['-c', 'lsof -ti tcp:8081 | xargs kill -9 2>/dev/null || true']]);
});
```

- [ ] Step 2: 跑测试确认失败
  Run: `node --test skills/agents-launcher/server-cli.test.mjs`
  Expected: FAIL with "killCommands is not a function"（导出尚不存在）

- [ ] Step 3: 最小实现

`server-cli.mjs` 追加导出（放在 verb 分发之前，与 agents/web 的 killCommands 形态对齐）：

```js
// teardown 用的同步 kill 命令段（orchestrator execFileSync 逐条跑）。
// 完整停服（容器/pid 文件/等待释放）走 stopApp；这里只保 gradlew --stop + 端口兜底，
// 语义与旧 lib/proc.mjs buildKillCommands 的 server 段一致。
export function killCommands({ ports, serverDir }) {
  return [
    ['sh', ['-c', `cd ${serverDir} && ./gradlew --stop || true`]],
    // 容器模式启动的 server（.dev-start.pid='container'）gradlew/端口 kill 都够不着——幂等清理（红蓝裁决 C）
    ['sh', ['-c', `docker rm -f dev-backend 2>/dev/null || true`]],
    ['sh', ['-c', `lsof -ti tcp:${ports.server} | xargs kill -9 2>/dev/null || true`]],
  ];
}
```

`dev-orchestrator.mjs` 重构全文：

```js
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from './lib/cli.mjs';
import { resolveRepos, validateRepos } from './lib/paths.mjs';
import { PORTS } from './lib/ports.mjs';
import { tcpOpen, httpOk, pidOnPort } from './lib/probe.mjs';
import { waitHealthy, runToEnd, spawnPrefixed } from './lib/proc.mjs';
import * as agentsCli from './agents-cli.mjs';
import * as webCli from './web-cli.mjs';
import * as serverCli from './server-cli.mjs';

const toolDir = dirname(fileURLToPath(import.meta.url));
const args = parseArgs(process.argv.slice(2));
const repos = resolveRepos({ toolDir });

// ---- 运维子命令（不起服务，不要求仓路径有效）----
if (args.status) {
  const row = (name, port, up) =>
    console.log(`[status] ${name.padEnd(6)} :${String(port).padEnd(5)} ${up ? 'UP  ' : 'DOWN'} pid=${up ? pidOnPort(port) : '-'}`);
  row('web', PORTS.web, await tcpOpen(PORTS.web));
  row('agents', PORTS.agents, await httpOk(`http://127.0.0.1:${PORTS.agents}/health`));
  row('server', PORTS.server, await tcpOpen(PORTS.server));
  row('pg', 5432, await tcpOpen(5432));
  row('minio', 9000, await tcpOpen(9000));
  process.exit(0);
}

// 三服务 kill 段组合：per-service 杀法单源在各 CLI，这里只做拼装
function killCommands() {
  const cmds = [];
  if (args.services.agents) cmds.push(...agentsCli.killCommands({ ports: PORTS }));
  if (args.services.web) cmds.push(...webCli.killCommands({ ports: PORTS }));
  if (args.services.server) cmds.push(...serverCli.killCommands({ ports: PORTS, serverDir: repos.SERVER_DIR }));
  return cmds;
}

if (args.stop) {
  for (const [cmd, a] of killCommands()) await runToEnd('stop', cmd, a);
  console.log('[stop] 完成（docker 未动，需要停 docker 请显式 docker compose down）');
  process.exit(0);
}

// ---- 前置校验（fail loud）----
const need = ['AGENTS_DIR'];
if (args.services.web) need.push('WEB_DIR');
if (args.services.server) need.push('SERVER_DIR');
validateRepos(repos, { need });

if (args.services.agents) {
  const cfg = agentsCli.configPath(repos.AGENTS_DIR);
  if (!existsSync(cfg)) {
    const msg = `agents config.yaml 不存在: ${cfg}\n请先 cp packages/server/conf/config.example.yaml packages/server/conf/config.yaml 并填 pg/minio/LLM（worktree 场景用 agents-cli prepare --from=<主仓>）`;
    if (args.dryRun) console.warn(`[debug] ⚠️  ${msg}`);
    else throw new Error(msg);
  }
}

async function confirm(q) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try { const a = (await rl.question(q)).trim().toLowerCase(); return a === 'y' || a === 'yes'; }
  finally { rl.close(); }
}

// 长驻子进程集合 + 统一清理
const children = [];
let tearingDown = false;
function teardown(downDocker) {
  if (tearingDown) return;
  tearingDown = true;
  for (const c of children) { try { c.kill('SIGTERM'); } catch {} }
  for (const [cmd, a] of killCommands()) {
    try { execFileSync(cmd, a); } catch {}
  }
  if (downDocker && args.services.docker) {
    try { execFileSync('sh', ['-c', `cd ${repos.SERVER_DIR} && docker compose down`]); } catch {}
  }
}
process.on('SIGINT', () => { console.log('\n[debug] 收到中断，清理中…'); teardown(args.dockerDownOnExit); process.exit(0); });
process.on('SIGTERM', () => { teardown(args.dockerDownOnExit); process.exit(0); });

async function main() {
  console.log(`[debug] workspace=${args.workspace} services=${JSON.stringify(args.services)}${args.dryRun ? ' (DRY-RUN)' : ''}`);
  console.log(`[debug] AGENTS=${repos.AGENTS_DIR} [${repos.sources.AGENTS_DIR}]`);
  console.log(`[debug] WEB=${repos.WEB_DIR} [${repos.sources.WEB_DIR}]`);
  console.log(`[debug] SERVER=${repos.SERVER_DIR} [${repos.sources.SERVER_DIR}]`);

  const relevant = ['AGENTS_DIR', ...(args.services.web ? ['WEB_DIR'] : []), ...(args.services.server ? ['SERVER_DIR'] : [])];
  const hasAuto = relevant.some((k) => repos.sources[k] === 'auto');
  if (!args.dryRun && !args.yes && hasAuto) {
    const ok = await confirm('[debug] 以上路径含自动解析项（[auto]）。确认按此继续? (y/N) ');
    if (!ok) {
      console.log('[debug] 已取消。可用 FX_AGENTS_DIR / FX_WEB_DIR / FX_SERVER_DIR 显式指定，或加 --yes 跳过确认。');
      return;
    }
  }

  // ---- Step 0: 杀干净上一轮 ----
  const killCmds = killCommands();
  if (args.dryRun) {
    console.log('[debug] would KILL:'); killCmds.forEach((c) => console.log('   ', c[0], c[1].join(' ')));
  } else {
    for (const [cmd, a] of killCmds) await runToEnd('kill', cmd, a);
  }

  // ---- 写 .env.local（per-service 知识在 web-cli）----
  if (args.dryRun) {
    if (args.services.web) console.log('[debug] would WRITE .env.local:', JSON.stringify(webCli.buildWebEnv({ agentsDir: repos.AGENTS_DIR, ports: PORTS })), '->', webCli.envLocalPath(repos.WEB_DIR));
  } else if (args.services.web) {
    webCli.writeEnv({ webDir: repos.WEB_DIR, agentsDir: repos.AGENTS_DIR, ports: PORTS });
  }

  // ---- CSS 产物检查（agents 知识在 agents-cli）----
  if (args.services.web) {
    await agentsCli.ensureCss({
      agentsDir: repos.AGENTS_DIR,
      run: args.dryRun ? async () => console.log('[debug] would RUN pnpm build:css') : (cmd, a) => runToEnd('build:css', cmd, a, { cwd: repos.AGENTS_DIR }),
    });
  }

  if (args.dryRun) { console.log('[debug] dry-run 结束，未起任何服务'); return; }

  // ---- Step 1: docker（跨服务编排知识，留 orchestrator）----
  if (args.services.docker) {
    const scaleArg = args.services.agents ? '--scale fx-data-agents=0' : '';
    const up = [
      `cd ${repos.SERVER_DIR}`,
      `[ -f docker-compose.yml ] && docker compose down || true`,
      `[ -f docker-compose.yml ] || cp docker-compose.template.yml docker-compose.yml`,
      `BR=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)`,
      `case "$BR" in *release*) PFX=test;; *persist*) PFX=prod;; *) PFX=dev;; esac`,
      `IMAGE_PREFIX=$PFX docker compose up -d ${scaleArg}`,
    ].join(' && ');
    await runToEnd('docker', 'sh', ['-c', up]);
    await waitHealthy('docker', async () => (await tcpOpen(5432)) && (await tcpOpen(9000)), { tries: 60, intervalMs: 1000 });
  }

  // ---- Step 2: agents + server ----
  if (args.services.agents && !args.services.docker) {
    const pgUp = await tcpOpen(5432);
    const minioUp = await tcpOpen(9000);
    if (!pgUp || !minioUp) {
      throw new Error(`agents 依赖的中间件未就绪: pg5432=${pgUp ? 'UP' : 'DOWN'} minio9000=${minioUp ? 'UP' : 'DOWN'}。改用 --workspace=agents 让 launcher 起 docker，或先手动 docker compose up -d`);
    }
  }
  if (args.services.agents) {
    children.push(agentsCli.start({ agentsDir: repos.AGENTS_DIR }));
    await waitHealthy('agents', () => httpOk(`http://127.0.0.1:${PORTS.agents}/health`), { tries: 60, intervalMs: 1000 });
  }
  if (args.services.server) {
    // server 启动知识单源在 server-cli（原 dev-start.sh app 链的 node 重写）。
    // killOld:true = 沿用旧行为（orchestrator 先杀旧，start 内不再交互确认）。
    await serverCli.start({ serverDir: repos.SERVER_DIR, ports: PORTS, killOld: true });
    await waitHealthy('server', () => httpOk(`http://127.0.0.1:${PORTS.server}/`), { tries: 30, intervalMs: 2000 });
  }

  // ---- Step 3: web ----
  if (args.services.web) {
    if (args.cssWatch) children.push(spawnPrefixed('css', 'pnpm', ['build:css:watch'], { cwd: repos.AGENTS_DIR }));
    children.push(webCli.start({ webDir: repos.WEB_DIR }));
    await waitHealthy('web', () => tcpOpen(PORTS.web), { tries: 120, intervalMs: 1000 });
    console.log(`\n[debug] ✅ 就绪 → http://localhost:${PORTS.web}/decision/home\n`);
  }
}

main().catch((e) => {
  console.error(`[debug] 失败: ${e.message}`);
  teardown(false);
  process.exit(1);
});
```

`lib/proc.mjs` 删除 `buildKillCommands`（保留 waitHealthy/runToEnd/spawnPrefixed 与文件头注释更新）；`lib/proc.test.mjs` 删除其用例。

- [ ] Step 4: 跑测试确认通过
  Run: `node --test 'skills/agents-launcher/lib/*.test.mjs' 'skills/agents-launcher/*.test.mjs' && FX_AGENTS_DIR=/Users/yes365/Work/Source/fx-data-agents FX_WEB_DIR=/Users/yes365/Work/Source/fx-data-web node skills/agents-launcher/dev-orchestrator.mjs --dry-run`
  Expected: PASS + dry-run 输出 would KILL / would WRITE 后正常退出

- [ ] Step 5: Commit
  `git add skills/agents-launcher/dev-orchestrator.mjs skills/agents-launcher/server-cli.mjs skills/agents-launcher/lib/proc.mjs skills/agents-launcher/lib/proc.test.mjs skills/agents-launcher/server-cli.test.mjs .claude-plugin/plugin.json && git commit -m "refactor(agents-launcher): orchestrator 退纯编排，per-service 知识下沉三 CLI（6.5.8）"`

**注**: `runToEnd` 的 `run` 注入给 ensureCss 时签名为 `(cmd, args) => Promise<exitCode>`，与 T5 契约一致。

---

## Task 8: SKILL.md 收编 + 删 dev-start.sh + 引用清理 + 版本 bump [Size: M]

**描述**: SKILL.md 的 worktree prose 步骤（Step 1 cp / Gate 1.5 pkgmgr / Step 2 联调对齐）收编为「gate 后调对应 CLI 命令」；server 委派段从 dev-start.sh 改为 server-cli；新增 per-service CLI 速查表与 `server-cli prepare`（ANTLR 预热坑）说明；删除 `scripts/dev-start.sh`；`lib/ports.mjs` 删 `buildWriteTargets`（T6 已内化到 web-cli，orchestrator T7 已不引用）；全仓引用清理；plugin.json bump 6.6.0。

**验收标准**:
- [ ] `rg "dev-start" --hidden -g'!.git'` 在仓内只剩 CHANGELOG/历史文档类命中（SKILL.md / 脚本 / rules 零命中；`dev-start.log`/`.dev-start.pid` 产物名保留在 server-cli 实现与 SKILL.md 说明里，属 server-cli 行为不算引用残留）
- [ ] SKILL.md：Gate 语义全部保留（Gate 0/1/1.5/2.1/2.2/3.1/3.2 一个不少），仅「gate 通过后的执行」换成 CLI 命令
- [ ] SKILL.md 新增「Step 1b — server worktree ANTLR 预热」：新建 server worktree 后跑 `server-cli prepare`（IDE 报红坑的解法）
- [ ] `lib/ports.mjs` 只剩 `PORTS` 导出
- [ ] plugin.json version = 6.6.0

**covers**: [SC-5, 约束.1, 启停.P2, 启停.P3]

**验证命令**:
- `rg -n "dev-start\.sh" skills/ rules/ model/ hooks/ scripts/`   # 预期: 无输出（exit 1）
- `node --test 'skills/agents-launcher/lib/*.test.mjs' 'skills/agents-launcher/*.test.mjs'`   # 预期: 全 pass
- `node hooks/generate.mjs --check`   # 预期: 无漂移（manifest 未动）
- `node scripts/vendor-sync.mjs --check`   # 预期: exit 0

**文件**: (5 个)
- `skills/agents-launcher/SKILL.md`
- `skills/agents-launcher/scripts/dev-start.sh`（删除；父目录 scripts/ 变空则一并删）
- `.claude-plugin/plugin.json`
- `skills/agents-launcher/lib/ports.mjs`
- `skills/agents-launcher/lib/ports.test.mjs`

**依赖**: Task 7

**真实改动**（SKILL.md 关键替换段，其余段落只改引用词）:

1. frontmatter description 改为:

```
本仓 fx-data-agents 三服务 (web :10001 / agents Hono :8070 / server Spring :8081) 的本地 dev 启停编排. 逻辑全在脚本 (dev-orchestrator.mjs 编排 + server-cli/web-cli/agents-cli 三个 per-service CLI), skill 只做路由与 askUser gate. 主仓启动直接执行 orchestrator; worktree 启动按 仓况盘点 → per-service prepare → 联调对齐 → 执行 orchestrator 四步走. server 由 server-cli 承载 (ANTLR 预热/GraalVM 检测/ZGC patch/代理清除/基础设施容器/bootRun). 查状态 --status, 停服 --stop. 关键决策点 (缺 worktree 时建/混搭/跳过 / prepare cp / 改 .env.local / reset worktree / 重启已在跑的服务 / 升档全栈 / 替换主仓 agents) 用 askUser 显式 gate, 不擅自动.
```

2. 「脚本与命令」节新增 CLI 速查表（放在参数表之后）:

```markdown
### per-service CLI（skill gate 通过后的执行单元）

| CLI | 动词 | 用途 |
|---|---|---|
| `server-cli.mjs` | `prepare` / `infra` / `start` / `stop` / `status` | prepare = ANTLR 生成类预热 + GraalVM 检测缓存（新建 server worktree 后必跑一次, 否则 IDE 报红）; start = 原 dev-start.sh app 链的 node 实现 |
| `web-cli.mjs` | `prepare` / `env` / `pkgmgr` / `align` / `start` / `stop` / `status` | prepare = cp .env.local; env = 写 AGENTS_LOCAL_SRC 等四键; pkgmgr = corepack 缓存检查+packageManager patch; align = fork 对齐检查（--reset 显式才 reset） |
| `agents-cli.mjs` | `prepare` / `start` / `stop` / `status` | prepare = cp config.yaml |

调用模板（`${CLAUDE_PLUGIN_ROOT}` 先换插件真实绝对路径; repo 路径用 FX_*_DIR env 传）:

    FX_SERVER_DIR=<server 仓根> node ${CLAUDE_PLUGIN_ROOT}/skills/agents-launcher/server-cli.mjs prepare
    FX_WEB_DIR=<web 仓根> FX_AGENTS_DIR=<agents 仓根> node ${CLAUDE_PLUGIN_ROOT}/skills/agents-launcher/web-cli.mjs env
    FX_AGENTS_DIR=<agents 仓根> node ${CLAUDE_PLUGIN_ROOT}/skills/agents-launcher/agents-cli.mjs prepare --from=<主仓根>

CLI 全部非交互——破坏性动作（align --reset / 改 .env.local）由本 skill 的 Gate 问过用户后才调, CLI 只认显式 flag。
```

3. 「server (Spring) 委派 scripts/dev-start.sh」节整节替换为「server (Spring) 由 server-cli 承载」——保留原坑位说明（GraalVM 检测/.java-home 缓存、ZGC→G1GC patch 且不还原勿误提交、代理清除、-Drpc.host、日志在 `<FX_SERVER_DIR>/dev-start.log`、PID 在 `.dev-start.pid`），命令换 `server-cli start`，并追加:

```markdown
**server worktree 首次准备（ANTLR 坑）**: fx-agent-workspace 的 ANTLR 生成类落在 gitignored 目录
（新接线 `src/main/antlr-generated` / 旧接线 `src/main/generated`），新建 worktree 后为空——命令行
gradle 会自愈，但 IDE (IDEA JPS) 不跑 gradle task，直接打开报红。新建 server worktree 后跑一次:
`FX_SERVER_DIR=<server worktree> node <插件根>/skills/agents-launcher/server-cli.mjs prepare`
（内部执行 `./gradlew :fx-agent-workspace:generateGrammarSource`，两代接线通用聚合入口）。
```

4. Step 1 的 cp 模板（170-175 行）替换为:

```bash
FX_AGENTS_DIR=<agents-worktree> node <插件根>/skills/agents-launcher/agents-cli.mjs prepare --from=<agents-main>
FX_WEB_DIR=<web-worktree> node <插件根>/skills/agents-launcher/web-cli.mjs prepare --from=<web-main>
```

5. Gate 1.5 执行段替换为 `web-cli.mjs pkgmgr`（检测输出 locked/cached/needsPatch，用户确认后 `pkgmgr --set=<Y>`）；Gate 2.1 执行段替换为 `web-cli.mjs env`（写四键含 AGENTS_LOCAL_SRC）；Gate 2.2 的 reset 命令替换为 `web-cli.mjs align --target=<sha>`（检查）/ `align --target=<sha> --reset`（用户确认后）。

6. 「必踩坑速查」12 条中：第 12 条改为 server-cli 语义（patch 不还原勿误提交 / 日志位置不变）；追加第 13 条「新建 server worktree 后先 `server-cli prepare`，否则 IDE 对 ANTLR 生成类报红（dev 启动不受影响，gradle 自愈）」；删除第 74 行旧 sync 子命令警告（脚本已删）。

7. 删除 `skills/agents-launcher/scripts/dev-start.sh`；`lib/ports.mjs` 精简为:

```js
export const PORTS = { agents: 8070, server: 8081, web: 10001 };
```

`lib/ports.test.mjs` 同步只留 PORTS 断言（或删除文件，若无其他用例）。

8. `.claude-plugin/plugin.json` version `6.5.0` → `6.6.0`。

- [ ] Step 1-5（本 task 是文档/删除类，TDD steps 退化为: 改 → 跑验证命令 → commit）
  Run: 上方 4 条验证命令
  Expected: 全过
  Commit: `git add -A && git commit -m "feat(agents-launcher): SKILL.md 收编 per-service CLI, 删 dev-start.sh, ANTLR 预热坑固化（6.6.0）"`

---

## ✅ Checkpoint C3: 覆盖 Task 7-8（全链路）

**全部测试 + 一致性**:
- `node --test 'hooks/*.test.mjs' 'skills/agents-launcher/**/*.test.mjs'`   # 预期: all passing
- `node hooks/generate.mjs --check && node scripts/vendor-sync.mjs --check`   # 预期: 无漂移

**真机 smoke（HITL）**:
- 主仓 `--dry-run` + `--status`；可选: ui 档真实起停一轮
- [ ] 用户确认（这是 Land 前最后 rollback 边界）

## Round 2 红蓝裁决记录（窄化重档：跨 task 一致性）

独立审查：Codex（异源，经 rule-codex-review 场景 1）。裁决：
- 采纳修复：A verb 渐进挂载（T2 假契约）/ C server killCommands 补容器清理层 / E start() 局部 env 防跨服务泄漏 / I 每 commit 版本 bump
- 采纳补充契约：B start() 返回 ChildProcess 不等健康 / D --status 保持旧五行投影（显式决策） / G startInfra 早返回等价原 bash + startApp 兜底 / H buildWebEnv 永久字面断言
- 有证据驳回：F「start 内嵌 prepare」——ANTLR 挂 compileJava.dependsOn，bootRun 自愈，prepare 为 IDE 场景专用
- 替代方案（整体重排为叶子先/façade 后）不采纳：渐进挂 verb 已消掉半成品问题，保住 T2 prepare 早交付

## 退出条件

- [ ] 所有 task ≤ M，零占位符（真实代码/命令/预期输出）
- [ ] 每 2-3 task 有 checkpoint（C1/C2/C3）
- [ ] 每条路径/约束被 ≥1 task 覆盖（见「路径 → Task 映射」）
- [ ] 用户已确认计划与执行方式
