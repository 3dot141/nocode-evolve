# agents-launcher 声明式服务拓扑 Implementation Plan

**Goal**: 用一份受限 `agents-launcher.yml` 驱动现有 workspace 的启动、逆序停止与运行期 restart propagation；当 `agents` 形成新的稳定监听实例时，`web` 恰好重启一次。
**Architecture**: `launcher-config` 在副作用边界前完成 YAML 安全解析与 schema 校验，`topology` 生成确定性 plan；`service-adapters` 继续委托既有 per-service CLI，`ServiceRuntime + GenerationSupervisor` 只负责跨服务生命周期、generation 识别与 single-flight 级联。`dev-orchestrator.mjs` 保留路径解析、确认和现有 preflight，并改为消费已验证 plan。
**Tech Stack**: Node ESM、Node `node:test` / `assert/strict`、vendored `yaml@2.9.0` browser ESM distribution、现有 `lib/probe.mjs` / `lib/proc.mjs`
**Design Doc**: `docs/dev/3dot141/260730-01-agents-launcher-declarative-topology/agents-launcher-declarative-topology-design.md`
**Test Objectives**: TO-1 至 TO-12、TO-14、TO-15 由 task 内测试承接；TO-13、TO-16、TO-17 留给 Verify 取证。
**Execution**: `executing`

> 来源：approved Design 的轻量 Restate、BF1-BF5、CONTRACT-1 至 CONTRACT-4、TO-1 至 TO-17 与 Implementation Item Registry。

## Restate 路径 ID 归一化

Design 的「路径」采用有序编号但未写稳定前缀；Plan 不改变语义，只把它们按原顺序固化为系统路径 ID，供 `covers` 与后续 Build/Review/Verify 追踪：

| ID | 原 Design 路径 |
|---|---|
| 系统.1 | workspace 裁剪后按拓扑顺序启动并等待 readiness |
| 系统.2 | 对同一 selected graph 按拓扑精确逆序停止 |
| 系统.3 | 未选中的 optional dependency 不扩大 launcher 所有权 |
| 系统.4 | 新稳定 generation 沿显式传播边重启下游闭包 |
| 系统.5 | 解析、schema、引用或 DAG 失败时在副作用前退出 |
| 系统.6 | 抖动和并发 generation 只消费最新稳定代际 |
| 约束.1 | 发布物运行时不要求用户额外安装 npm 包 |
| 约束.2 | orchestrator 只做跨服务编排，per-service 知识留在既有 CLI |
| 约束.3 | YAML 是窄 schema，不执行 shell，不接受 tag、alias 或未知字段 |
| 约束.4 | 不自动修改插件版本；源码变化后同步三平台发布物 |

## 依赖图

```text
T1 安全 YAML loader
 └─→ T2 YAML→拓扑 plan
      ├─→ T3 allowlisted service adapters
      └─→ T4 config-driven CLI projection

T5 generation 纯状态机
 └─→ T6 supervisor 轮询纪律

T2 + T3
 └─→ T7 runtime 初始启停/readiness

T6 + T7
 └─→ T8 runtime cascade/close single-flight

T4 + T7 + T8
 └─→ T9 orchestrator 原子接线
```

依赖图无回边。T1/T5 在实现层无依赖，但按 risk-first 先完成外部输入边界，再进入并发状态机；T3/T4 可在 T2 后独立实施。

## 切片策略

- **形态：Vertical**。每个 task 交付一条可独立执行的窄能力：读一份配置、产一份 plan、调用一个 adapter 契约、消费一次 observation、执行一次 lifecycle/cascade。
- **Risk-first**。T1/T2 优先撞 YAML 安全与 schema 风险；T5/T6 紧接着验证 PID generation 与轮询不重入；最后才把已验证接口接入长驻 orchestrator。
- **中间态兼容**。T4 用 `plan.selected` 临时投影出当前 `args.services`，让旧 imperative 主体在 T9 原子替换前仍能运行；T9 删除该兼容投影，不保留双拓扑事实源。
- **第三方 subtree 计数**。`vendor/yaml/browser/**` 是一次机械导入、不可手改的上游工件，在 task 文件门禁中按一个路径工件计数；手写文件仍不超过 5 个。
- **版本纪律**。整个 Build 不改 `plugin/metadata.json`；全部源码完成后统一运行三平台生成脚本，并把源码与生成物放进同一个 commit。

## Task 1：安全加载一份窄 YAML 配置 [Size: M]

**描述**: vendoring 固定版本的无运行时依赖 parser，并用一个深冻结 loader 完成单文档、alias/tag、重复 key、exact-key schema 与 adapter allowlist 校验。这个 slice 做完即可把任意 YAML 文本安全地收敛为无命令字段的内存配置。

**验收标准**:

- [ ] `yaml@2.9.0` browser distribution、LICENSE 与来源/integrity NOTICE 完整进入源码树。
- [ ] 合法 schema v1 返回 `{ config, sourcePath }`，两层以上对象也不可修改。
- [ ] 语法错误、多文档、alias、自定义 tag、重复 key、未知字段、禁用命令字段、未知 adapter 均抛出 `[topology]` 错误。
- [ ] 错误只包含来源路径与 parser/schema 定位，不回显整份 YAML 或环境变量。

**covers**: [系统.5, 约束.1, 约束.3]

**designCovers**: [Q1, BF1, CONTRACT-1, SEC-1, TO-1, TO-15]

**设计文档段落**: 「YAML 数据契约 CONTRACT-1」「BF1 — 配置加载与无副作用失败」「单测设计 / BF1」

**HITL / AFK**: AFK。网络只用于 `npm pack yaml@2.9.0`；integrity 不匹配时立即停止，不接受近似版本。

**UI 设计源**: N/A（无 UI）。

**文件**:（5 个路径工件）

- `skills/agents-launcher/vendor/yaml/browser/**`（新建，不可手改）
- `skills/agents-launcher/vendor/yaml/LICENSE`（新建，不可手改）
- `skills/agents-launcher/vendor/yaml/NOTICE.md`（新建）
- `skills/agents-launcher/lib/launcher-config.mjs`（新建）
- `skills/agents-launcher/lib/launcher-config.test.mjs`（新建）

**依赖**: None

**TDD steps**:

- [ ] Step 1：先写 loader 测试，使用注入的 `readFile` 覆盖合法文档与拒绝矩阵。
- [ ] Step 2：运行单测，确认因 `launcher-config.mjs` 尚不存在而失败。
- [ ] Step 3：机械导入 parser，写 NOTICE，再实现 AST 安全检查、exact schema 与 deep-freeze。
- [ ] Step 4：重跑单测并执行一次真实 vendored import。

**失败测试代码**（`launcher-config.test.mjs`）:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLauncherConfig } from './launcher-config.mjs';

const VALID = `
schema_version: 1
supervision:
  interval_ms: 1000
  stable_successes: 2
  failure_threshold: 2
workspaces:
  ui: [agents, web]
services:
  agents:
    adapter: agents
    lifecycle: service
  web:
    adapter: web
    lifecycle: service
    depends_on:
      agents:
        condition: service_healthy
        required: false
        propagate_restart: true
`;

function load(source, adapterNames = ['agents', 'web']) {
  return loadLauncherConfig({
    path: '/fixture/agents-launcher.yml',
    readFile: () => source,
    adapterNames,
  });
}

test('合法 schema v1 被规范化并递归冻结', () => {
  const loaded = load(VALID);
  assert.equal(loaded.sourcePath, '/fixture/agents-launcher.yml');
  assert.equal(loaded.config.services.web.depends_on.agents.propagate_restart, true);
  assert.equal(Object.isFrozen(loaded.config), true);
  assert.equal(Object.isFrozen(loaded.config.services.web.depends_on), true);
  assert.throws(() => {
    loaded.config.supervision.interval_ms = 20;
  }, TypeError);
});

test('YAML 安全拒绝矩阵全部 fail-loud', async (t) => {
  const cases = [
    ['syntax', 'schema_version: [1', /\[topology\].*agents-launcher\.yml/],
    ['multi-document', `${VALID}\n---\nschema_version: 1`, /必须恰好包含一个 YAML document/],
    ['alias', `${VALID}\ncopy: &x value\nalias: *x`, /不允许 YAML alias/],
    ['custom-tag', VALID.replace('schema_version: 1', 'schema_version: !unsafe 1'), /不允许自定义 YAML tag/],
    ['duplicate-key', VALID.replace('schema_version: 1', 'schema_version: 1\nschema_version: 1'), /Map keys must be unique|重复/],
    ['unknown-key', VALID.replace('schema_version: 1', 'schema_version: 1\ncommand: rm -rf repo'), /未知字段 root\.command/],
  ];
  for (const [name, source, pattern] of cases) {
    await t.test(name, () => assert.throws(() => load(source), pattern));
  }
});

test('未知 adapter 在返回配置前失败', () => {
  const source = VALID.replace('adapter: web', 'adapter: shell');
  assert.throws(() => load(source), /\[topology\].*未知 adapter "shell"/);
});

test('schema 错误不回显字段值', () => {
  const source = VALID.replace(
    'schema_version: 1',
    'schema_version: 1\nenv: TOP_SECRET_VALUE',
  );
  let caught = null;
  try {
    load(source);
  } catch (error) {
    caught = error;
  }
  assert.ok(caught);
  assert.match(caught.message, /未知字段 root\.env/);
  assert.doesNotMatch(caught.message, /TOP_SECRET_VALUE/);
});
```

**最小实现代码**（`launcher-config.mjs`）:

```js
import { readFileSync } from 'node:fs';
import {
  isAlias,
  parseAllDocuments,
  visit,
} from '../vendor/yaml/browser/index.js';

const ID = /^[a-z][a-z0-9-]*$/;
const CORE_TAGS = new Set([
  'tag:yaml.org,2002:map',
  'tag:yaml.org,2002:seq',
  'tag:yaml.org,2002:str',
  'tag:yaml.org,2002:null',
  'tag:yaml.org,2002:bool',
  'tag:yaml.org,2002:int',
  'tag:yaml.org,2002:float',
]);

function topologyError(sourcePath, message) {
  return new Error(`[topology] ${sourcePath}: ${message}`);
}

function conciseError(message) {
  return String(message).split('\n', 1)[0];
}

function assertObject(value, at, sourcePath) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw topologyError(sourcePath, `${at} 必须是 object`);
  }
}

function assertExactKeys(value, { at, allowed, required = [] }, sourcePath) {
  assertObject(value, at, sourcePath);
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      throw topologyError(sourcePath, `未知字段 ${at}.${key}`);
    }
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) {
      throw topologyError(sourcePath, `缺少字段 ${at}.${key}`);
    }
  }
}

function assertId(value, at, sourcePath) {
  if (typeof value !== 'string' || !ID.test(value)) {
    throw topologyError(sourcePath, `${at} 必须匹配 ${ID}`);
  }
}

function assertInteger(value, at, minimum, sourcePath) {
  if (!Number.isInteger(value) || value < minimum) {
    throw topologyError(sourcePath, `${at} 必须是 >= ${minimum} 的 integer`);
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function normalizeConfig(raw, { sourcePath, adapterNames }) {
  assertExactKeys(raw, {
    at: 'root',
    allowed: ['schema_version', 'supervision', 'workspaces', 'services'],
    required: ['schema_version', 'supervision', 'workspaces', 'services'],
  }, sourcePath);
  if (raw.schema_version !== 1) {
    throw topologyError(sourcePath, 'schema_version 必须精确为 1');
  }

  assertExactKeys(raw.supervision, {
    at: 'supervision',
    allowed: ['interval_ms', 'stable_successes', 'failure_threshold'],
    required: ['interval_ms', 'stable_successes', 'failure_threshold'],
  }, sourcePath);
  assertInteger(raw.supervision.interval_ms, 'supervision.interval_ms', 100, sourcePath);
  assertInteger(raw.supervision.stable_successes, 'supervision.stable_successes', 1, sourcePath);
  assertInteger(raw.supervision.failure_threshold, 'supervision.failure_threshold', 1, sourcePath);

  assertObject(raw.workspaces, 'workspaces', sourcePath);
  if (Object.keys(raw.workspaces).length === 0) {
    throw topologyError(sourcePath, 'workspaces 至少需要一个 workspace');
  }
  const workspaces = {};
  for (const [workspaceId, serviceIds] of Object.entries(raw.workspaces)) {
    assertId(workspaceId, `workspaces key "${workspaceId}"`, sourcePath);
    if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
      throw topologyError(sourcePath, `workspaces.${workspaceId} 必须是非空 array`);
    }
    for (const serviceId of serviceIds) {
      assertId(serviceId, `workspaces.${workspaceId}[]`, sourcePath);
    }
    if (new Set(serviceIds).size !== serviceIds.length) {
      throw topologyError(sourcePath, `workspaces.${workspaceId} 不允许重复 service`);
    }
    workspaces[workspaceId] = [...serviceIds];
  }

  assertObject(raw.services, 'services', sourcePath);
  if (Object.keys(raw.services).length === 0) {
    throw topologyError(sourcePath, 'services 至少需要一个 service');
  }
  const services = {};
  const allowedAdapters = new Set(adapterNames);
  for (const [serviceId, service] of Object.entries(raw.services)) {
    assertId(serviceId, `services key "${serviceId}"`, sourcePath);
    assertExactKeys(service, {
      at: `services.${serviceId}`,
      allowed: ['adapter', 'lifecycle', 'depends_on'],
      required: ['adapter', 'lifecycle'],
    }, sourcePath);
    if (!allowedAdapters.has(service.adapter)) {
      throw topologyError(sourcePath, `services.${serviceId} 使用未知 adapter "${service.adapter}"`);
    }
    if (!['service', 'oneshot'].includes(service.lifecycle)) {
      throw topologyError(sourcePath, `services.${serviceId}.lifecycle 必须是 service 或 oneshot`);
    }
    const dependsOn = {};
    const rawDependsOn = service.depends_on ?? {};
    assertObject(rawDependsOn, `services.${serviceId}.depends_on`, sourcePath);
    for (const [dependencyId, dependency] of Object.entries(rawDependsOn)) {
      assertId(dependencyId, `services.${serviceId}.depends_on key`, sourcePath);
      assertExactKeys(dependency, {
        at: `services.${serviceId}.depends_on.${dependencyId}`,
        allowed: ['condition', 'required', 'propagate_restart'],
        required: ['condition', 'required'],
      }, sourcePath);
      if (!['service_healthy', 'service_completed_successfully'].includes(dependency.condition)) {
        throw topologyError(sourcePath, `services.${serviceId}.depends_on.${dependencyId}.condition 非法`);
      }
      if (typeof dependency.required !== 'boolean') {
        throw topologyError(sourcePath, `services.${serviceId}.depends_on.${dependencyId}.required 必须是 boolean`);
      }
      if (dependency.propagate_restart !== undefined
          && typeof dependency.propagate_restart !== 'boolean') {
        throw topologyError(sourcePath, `services.${serviceId}.depends_on.${dependencyId}.propagate_restart 必须是 boolean`);
      }
      dependsOn[dependencyId] = {
        condition: dependency.condition,
        required: dependency.required,
        propagate_restart: dependency.propagate_restart ?? false,
      };
    }
    services[serviceId] = {
      adapter: service.adapter,
      lifecycle: service.lifecycle,
      depends_on: dependsOn,
    };
  }

  return {
    schema_version: 1,
    supervision: { ...raw.supervision },
    workspaces,
    services,
  };
}

export function loadLauncherConfig({
  path,
  readFile = readFileSync,
  parseAll = parseAllDocuments,
  adapterNames = [],
} = {}) {
  if (!path) throw topologyError('<unknown>', '配置 path 必填');
  let source;
  try {
    source = readFile(path, 'utf8');
  } catch (error) {
    throw topologyError(path, `读取失败：${conciseError(error.message)}`);
  }

  let documents;
  try {
    documents = parseAll(source, {
      version: '1.2',
      schema: 'core',
      strict: true,
      uniqueKeys: true,
      prettyErrors: true,
    });
  } catch (error) {
    throw topologyError(path, conciseError(error.message));
  }
  if (documents.length !== 1) {
    throw topologyError(path, '必须恰好包含一个 YAML document');
  }
  const [document] = documents;
  if (document.errors.length > 0) {
    throw topologyError(path, conciseError(document.errors[0].message));
  }

  let unsafe = null;
  visit(document, (_key, node) => {
    if (isAlias(node)) {
      unsafe = '不允许 YAML alias';
      return visit.BREAK;
    }
    if (node?.tag && !CORE_TAGS.has(node.tag)) {
      unsafe = '不允许自定义 YAML tag';
      return visit.BREAK;
    }
    return undefined;
  });
  if (unsafe) throw topologyError(path, unsafe);

  let raw;
  try {
    raw = document.toJS({ maxAliasCount: 0 });
  } catch (error) {
    throw topologyError(path, conciseError(error.message));
  }
  const config = normalizeConfig(raw, { sourcePath: path, adapterNames });
  return deepFreeze({ config, sourcePath: path });
}
```

**机械 vendoring 命令**:

```bash
yaml_vendor_tmp=$(mktemp -d /tmp/agents-launcher-yaml.XXXXXX)
npm pack yaml@2.9.0 --pack-destination "$yaml_vendor_tmp"
yaml_tarball="$yaml_vendor_tmp/yaml-2.9.0.tgz"
yaml_integrity=$(openssl dgst -sha512 -binary "$yaml_tarball" | openssl base64 -A)
test "$yaml_integrity" = "2AvhNX3mb8zd6Zy7INTtSpl1F15HW6Wnqj0srWlkKLcpYl/gMIMJiyuGq2KeI2YFxUPjdlB+3Lc10seMLtL4cA=="
tar -xzf "$yaml_tarball" -C "$yaml_vendor_tmp"
mkdir -p skills/agents-launcher/vendor/yaml/browser
rsync -a --delete "$yaml_vendor_tmp/package/browser/" skills/agents-launcher/vendor/yaml/browser/
cp "$yaml_vendor_tmp/package/LICENSE" skills/agents-launcher/vendor/yaml/LICENSE
```

`NOTICE.md` 写入以下固定内容：

```markdown
# yaml vendoring notice

- Package: `yaml`
- Version: `2.9.0`
- Source: `https://registry.npmjs.org/yaml/-/yaml-2.9.0.tgz`
- Vendored subset: upstream `browser/**` plus `LICENSE`
- npm integrity: `sha512-2AvhNX3mb8zd6Zy7INTtSpl1F15HW6Wnqj0srWlkKLcpYl/gMIMJiyuGq2KeI2YFxUPjdlB+3Lc10seMLtL4cA==`
- License: ISC; see `LICENSE`
```

**验证命令**:

- `node --test skills/agents-launcher/lib/launcher-config.test.mjs`
  预期：exit 0，TAP 末尾 `# fail 0`。
- `node --input-type=module -e "import { parseAllDocuments } from './skills/agents-launcher/vendor/yaml/browser/index.js'; const docs = parseAllDocuments('ok: true'); if (docs.length !== 1 || docs[0].errors.length) process.exit(1)"`
  预期：exit 0，无输出。

## ✅ Checkpoint C1：覆盖 Task 1

**触发原因**: Task 1 命中风险信号 #1（YAML 文件是外部输入边界）。

**全部测试**:

- `node --test skills/agents-launcher/lib/launcher-config.test.mjs`
  预期：`# fail 0`。

**Build**:

- `node --check skills/agents-launcher/lib/launcher-config.mjs`
  预期：exit 0，无输出。

**用户 Review**:

- [ ] 展示合法 YAML 的冻结结果与一条 alias 拒绝错误。
- [ ] 确认继续、调整或回滚。

**Rollback 点**: 可整体回滚 loader 与 `vendor/yaml`，不影响现有 launcher。

## Task 2：从正式 YAML 生成确定性 topology plan [Size: M]

**描述**: 新增正式关系事实源，补齐引用、condition、identity capability 与全图 DAG 校验，并把 workspace/`--no-*` 投影为唯一的 start/stop/propagation plan。这个 slice 做完可以在零进程副作用下回答“本轮到底启停谁、按什么顺序、传播给谁”。

**验收标准**:

- [ ] 正式 YAML 的 `ui`、`agents`、`full` 精确得到既有服务集合与设计顺序。
- [ ] optional dependency 缺席时只记录 omitted，不回填服务；required dependency 缺席时失败。
- [ ] 未知 service、自依赖、condition/lifecycle 不匹配、无 identity 能力的传播源与 DAG 环均在 plan 返回前失败。
- [ ] `stopOrder` 始终是 `startOrder` 的精确逆序；传播闭包按 plan 顺序稳定去重。

**covers**: [系统.1, 系统.2, 系统.3, 系统.4, 系统.5, 约束.3]

**designCovers**: [Q1, Q2, BF1, BF2, CONTRACT-1, CONTRACT-2, SEC-1, PERF-1, TO-2, TO-3, TO-4, TO-9]

**设计文档段落**: 「拓扑计划契约 CONTRACT-2」「ServiceTopology 聚合」「传播闭包」「BF2」

**HITL / AFK**: AFK。

**UI 设计源**: N/A（无 UI）。

**文件**:（5 个）

- `skills/agents-launcher/agents-launcher.yml`（新建）
- `skills/agents-launcher/lib/topology.mjs`（新建）
- `skills/agents-launcher/lib/topology.test.mjs`（新建）
- `skills/agents-launcher/lib/launcher-config.mjs`（改：调用领域校验）
- `skills/agents-launcher/lib/launcher-config.test.mjs`（改：引用/DAG 拒绝矩阵）

**依赖**: Task 1

**TDD steps**:

- [ ] Step 1：写正式 YAML 投影、optional/required、环与闭包测试。
- [ ] Step 2：运行测试，确认因 `topology.mjs` 缺失而失败。
- [ ] Step 3：实现稳定 Kahn 排序、全图校验、selected plan 与传播闭包，并让 loader 在 freeze 前调用校验。
- [ ] Step 4：运行 topology 与 loader 两组测试。

**正式配置代码**（`agents-launcher.yml`）:

```yaml
schema_version: 1

supervision:
  interval_ms: 1000
  stable_successes: 2
  failure_threshold: 2

workspaces:
  ui: [agents, web]
  agents: [docker, agents, web]
  full: [docker, agents, server, web]

services:
  docker:
    adapter: docker
    lifecycle: oneshot

  agents:
    adapter: agents
    lifecycle: service
    depends_on:
      docker:
        condition: service_completed_successfully
        required: false

  server:
    adapter: server
    lifecycle: service
    depends_on:
      agents:
        condition: service_healthy
        required: false

  web:
    adapter: web
    lifecycle: service
    depends_on:
      agents:
        condition: service_healthy
        required: false
        propagate_restart: true
      server:
        condition: service_healthy
        required: false
```

**失败测试代码**（`topology.test.mjs`）:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadLauncherConfig } from './launcher-config.mjs';
import {
  buildServicePlan,
  propagationClosure,
  validateTopology,
} from './topology.mjs';

const configPath = fileURLToPath(new URL('../agents-launcher.yml', import.meta.url));
const identityAdapterNames = ['agents', 'server', 'web'];
const { config } = loadLauncherConfig({
  path: configPath,
  adapterNames: ['docker', 'agents', 'server', 'web'],
  identityAdapterNames,
});

test('正式 YAML 保持三个 workspace 的服务集合与顺序', () => {
  const expected = {
    ui: ['agents', 'web'],
    agents: ['docker', 'agents', 'web'],
    full: ['docker', 'agents', 'server', 'web'],
  };
  for (const [workspace, startOrder] of Object.entries(expected)) {
    const plan = buildServicePlan(config, { workspace, disabled: [] });
    assert.deepEqual(plan.selected, startOrder);
    assert.deepEqual(plan.startOrder, startOrder);
    assert.deepEqual(plan.stopOrder, [...startOrder].reverse());
  }
});

test('optional dependency 缺席不扩张 launcher 所有权', () => {
  const plan = buildServicePlan(config, { workspace: 'ui', disabled: ['agents'] });
  assert.deepEqual(plan.selected, ['web']);
  assert.deepEqual(plan.startOrder, ['web']);
  assert.deepEqual(plan.omittedOptionalDependencies, [
    { service: 'web', dependency: 'agents' },
  ]);
  assert.deepEqual(plan.propagationEdges, []);
});

test('required dependency 缺席时 fail-loud', () => {
  const fixture = structuredClone(config);
  fixture.services.web.depends_on.agents.required = true;
  assert.throws(
    () => buildServicePlan(fixture, { workspace: 'ui', disabled: ['agents'] }),
    /\[topology\].*web.*required dependency.*agents/,
  );
});

test('引用、自依赖、condition 与环在完整 topology 校验时失败', async (t) => {
  const mutateCases = [
    ['unknown reference', (value) => { value.services.web.depends_on.ghost = value.services.web.depends_on.agents; }, /未知 service "ghost"/],
    ['self dependency', (value) => { value.services.web.depends_on.web = value.services.web.depends_on.agents; }, /不能依赖自身/],
    ['condition mismatch', (value) => { value.services.web.depends_on.agents.condition = 'service_completed_successfully'; }, /condition.*lifecycle/],
    ['cycle', (value) => { value.services.agents.depends_on.web = { condition: 'service_healthy', required: false, propagate_restart: false }; }, /dependency cycle/],
  ];
  for (const [name, mutate, pattern] of mutateCases) {
    await t.test(name, () => {
      const fixture = structuredClone(config);
      mutate(fixture);
      assert.throws(
        () => validateTopology(fixture, { identityAdapterNames }),
        pattern,
      );
    });
  }
});

test('传播闭包稳定去重并从 stop/start 全局顺序投影', () => {
  const fixture = structuredClone(config);
  fixture.workspaces.chain = ['agents', 'server', 'web'];
  fixture.services.server.depends_on.agents.propagate_restart = true;
  fixture.services.web.depends_on.server.propagate_restart = true;
  const plan = buildServicePlan(fixture, { workspace: 'chain', disabled: [] });
  assert.deepEqual([...propagationClosure('agents', plan)], ['server', 'web']);
  assert.deepEqual(
    plan.stopOrder.filter((id) => propagationClosure('agents', plan).has(id)),
    ['web', 'server'],
  );
});
```

**最小实现代码**（`topology.mjs`）:

```js
function topologyError(message) {
  return new Error(`[topology] ${message}`);
}

function dependencyEdges(config, selectedSet = null) {
  const edges = [];
  for (const [downstream, service] of Object.entries(config.services)) {
    if (selectedSet && !selectedSet.has(downstream)) continue;
    for (const [upstream, dependency] of Object.entries(service.depends_on)) {
      if (selectedSet && !selectedSet.has(upstream)) continue;
      edges.push({ upstream, downstream, dependency });
    }
  }
  return edges;
}

function stableTopologicalSort(nodeIds, edges, rankIds = nodeIds) {
  const rank = new Map(rankIds.map((id, index) => [id, index]));
  const outgoing = new Map(nodeIds.map((id) => [id, []]));
  const indegree = new Map(nodeIds.map((id) => [id, 0]));
  for (const { upstream, downstream } of edges) {
    outgoing.get(upstream).push(downstream);
    indegree.set(downstream, indegree.get(downstream) + 1);
  }
  const ready = nodeIds
    .filter((id) => indegree.get(id) === 0)
    .sort((a, b) => rank.get(a) - rank.get(b));
  const result = [];
  while (ready.length > 0) {
    const current = ready.shift();
    result.push(current);
    for (const downstream of outgoing.get(current)) {
      const next = indegree.get(downstream) - 1;
      indegree.set(downstream, next);
      if (next === 0) {
        ready.push(downstream);
        ready.sort((a, b) => rank.get(a) - rank.get(b));
      }
    }
  }
  if (result.length !== nodeIds.length) {
    throw topologyError('dependency cycle detected');
  }
  return result;
}

export function validateTopology(config, { identityAdapterNames = [] } = {}) {
  const serviceIds = Object.keys(config.services);
  const serviceSet = new Set(serviceIds);
  const identityAdapters = new Set(identityAdapterNames);

  for (const [workspaceId, workspaceServices] of Object.entries(config.workspaces)) {
    for (const serviceId of workspaceServices) {
      if (!serviceSet.has(serviceId)) {
        throw topologyError(`workspace "${workspaceId}" 引用未知 service "${serviceId}"`);
      }
    }
  }

  for (const [downstream, service] of Object.entries(config.services)) {
    for (const [upstream, dependency] of Object.entries(service.depends_on)) {
      if (!serviceSet.has(upstream)) {
        throw topologyError(`service "${downstream}" 引用未知 service "${upstream}"`);
      }
      if (upstream === downstream) {
        throw topologyError(`service "${downstream}" 不能依赖自身`);
      }
      const upstreamLifecycle = config.services[upstream].lifecycle;
      const expectedLifecycle = dependency.condition === 'service_healthy'
        ? 'service'
        : 'oneshot';
      if (upstreamLifecycle !== expectedLifecycle) {
        throw topologyError(
          `dependency ${upstream} -> ${downstream} condition ${dependency.condition} 与 lifecycle ${upstreamLifecycle} 不匹配`,
        );
      }
      if (dependency.propagate_restart
          && !identityAdapters.has(config.services[upstream].adapter)) {
        throw topologyError(`传播源 "${upstream}" 的 adapter 不支持 identity`);
      }
    }
  }

  stableTopologicalSort(serviceIds, dependencyEdges(config), serviceIds);
  return config;
}

export function topologyCatalog(config) {
  return Object.freeze({
    workspaceIds: Object.freeze(Object.keys(config.workspaces)),
    serviceIds: Object.freeze(Object.keys(config.services)),
  });
}

export function buildServicePlan(config, { workspace, disabled = [] } = {}) {
  const declared = config.workspaces[workspace];
  if (!declared) {
    throw topologyError(`未知 workspace "${workspace}"`);
  }
  const disabledSet = new Set(disabled);
  const selected = declared.filter((serviceId) => !disabledSet.has(serviceId));
  const selectedSet = new Set(selected);
  const retainedEdges = [];
  const omittedOptionalDependencies = [];

  for (const downstream of selected) {
    for (const [upstream, dependency] of Object.entries(config.services[downstream].depends_on)) {
      if (selectedSet.has(upstream)) {
        retainedEdges.push({ upstream, downstream, dependency });
      } else if (dependency.required) {
        throw topologyError(
          `service "${downstream}" 缺少 required dependency "${upstream}"`,
        );
      } else {
        omittedOptionalDependencies.push({ service: downstream, dependency: upstream });
      }
    }
  }

  const startOrder = stableTopologicalSort(selected, retainedEdges, declared);
  const propagationEdges = retainedEdges
    .filter(({ dependency }) => dependency.propagate_restart)
    .map(({ upstream, downstream }) => ({ upstream, downstream }));
  return Object.freeze({
    workspace,
    selected: Object.freeze([...selected]),
    omittedOptionalDependencies: Object.freeze(omittedOptionalDependencies),
    startOrder: Object.freeze(startOrder),
    stopOrder: Object.freeze([...startOrder].reverse()),
    propagationEdges: Object.freeze(propagationEdges),
  });
}

export function propagationClosure(upstream, plan) {
  const outgoing = new Map();
  for (const edge of plan.propagationEdges) {
    if (!outgoing.has(edge.upstream)) outgoing.set(edge.upstream, []);
    outgoing.get(edge.upstream).push(edge.downstream);
  }
  const reached = new Set();
  const pending = [...(outgoing.get(upstream) ?? [])];
  while (pending.length > 0) {
    const serviceId = pending.shift();
    if (reached.has(serviceId)) continue;
    reached.add(serviceId);
    pending.push(...(outgoing.get(serviceId) ?? []));
  }
  return new Set(plan.startOrder.filter((serviceId) => reached.has(serviceId)));
}
```

`launcher-config.mjs` 做以下精确增量，读取与 parser 错误包装不变：

```diff
 import {
   isAlias,
   parseAllDocuments,
   visit,
 } from '../vendor/yaml/browser/index.js';
+import { validateTopology } from './topology.mjs';

 export function loadLauncherConfig({
   path,
   readFile = readFileSync,
   parseAll = parseAllDocuments,
   adapterNames = [],
+  identityAdapterNames = [],
 } = {}) {
   if (!path) throw topologyError('<unknown>', '配置 path 必填');
   let source;
   try {
     source = readFile(path, 'utf8');
   } catch (error) {
     throw topologyError(path, `读取失败：${conciseError(error.message)}`);
   }
   let documents;
   try {
     documents = parseAll(source, {
       version: '1.2',
       schema: 'core',
       strict: true,
       uniqueKeys: true,
       prettyErrors: true,
     });
   } catch (error) {
     throw topologyError(path, conciseError(error.message));
   }
   if (documents.length !== 1) {
     throw topologyError(path, '必须恰好包含一个 YAML document');
   }
   const [document] = documents;
   if (document.errors.length > 0) {
     throw topologyError(path, conciseError(document.errors[0].message));
   }
   let unsafe = null;
   visit(document, (_key, node) => {
     if (isAlias(node)) {
       unsafe = '不允许 YAML alias';
       return visit.BREAK;
     }
     if (node?.tag && !CORE_TAGS.has(node.tag)) {
       unsafe = '不允许自定义 YAML tag';
       return visit.BREAK;
     }
     return undefined;
   });
   if (unsafe) throw topologyError(path, unsafe);
   let raw;
   try {
     raw = document.toJS({ maxAliasCount: 0 });
   } catch (error) {
     throw topologyError(path, conciseError(error.message));
   }
   const config = normalizeConfig(raw, { sourcePath: path, adapterNames });
+  try {
+    validateTopology(config, { identityAdapterNames });
+  } catch (error) {
+    throw topologyError(
+      path,
+      conciseError(error.message).replace(/^\[topology\]\s*/, ''),
+    );
+  }
   return deepFreeze({ config, sourcePath: path });
 }
```

**验证命令**:

- `node --test skills/agents-launcher/lib/topology.test.mjs skills/agents-launcher/lib/launcher-config.test.mjs`
  预期：exit 0，TAP 末尾 `# fail 0`。
- `node --input-type=module -e "import { loadLauncherConfig } from './skills/agents-launcher/lib/launcher-config.mjs'; import { buildServicePlan } from './skills/agents-launcher/lib/topology.mjs'; const loaded = loadLauncherConfig({ path: './skills/agents-launcher/agents-launcher.yml', adapterNames: ['docker','agents','server','web'], identityAdapterNames: ['agents','server','web'] }); console.log(buildServicePlan(loaded.config, { workspace: 'full' }).startOrder.join('>'))"`
  预期：输出 `docker>agents>server>web`。

## ✅ Checkpoint C2：覆盖 Task 2

**触发原因**: Task 2 继续命中风险信号 #1（外部 YAML 中的引用、DAG 与能力字段决定后续进程操作）。

**全部测试**:

- `node --test skills/agents-launcher/lib/launcher-config.test.mjs skills/agents-launcher/lib/topology.test.mjs`
  预期：`# fail 0`。

**Build**:

- `node --check skills/agents-launcher/lib/topology.mjs`
  预期：exit 0，无输出。

**用户 Review**:

- [ ] 展示 `full` start/stop order 与 `ui --no-agents` 的 omitted dependency。
- [ ] 用户确认继续、调整或回滚。

**Rollback 点**: 可回滚到 C1；旧 launcher 此时仍未消费 YAML。

## Task 3：把现有 service CLI 收口为 allowlisted adapter [Size: M]

**描述**: 建立唯一 adapter registry，把统一的 `start/stop/status` 契约翻译成现有 `agents-cli`、`web-cli`、`server-cli` 调用；YAML 永远只能引用 allowlisted key，不能提供 command、module path 或端口。

**验收标准**:

- [ ] registry 精确包含 `docker/agents/server/web`，对象及 capability 表均冻结。
- [ ] agents/web/server 的 start、stop、status 均委托现有 CLI 或共享 probe，不复制命令构造。
- [ ] web 每次 start 都调用 `webCli.start({ webDir })`；既有 Vite cache 与 `BROWSER=none` 测试继续作为行为锚。
- [ ] Docker normal stop 为 no-op，只有 `{ downDocker: true }` 执行 `docker compose down`。

**covers**: [系统.1, 系统.2, 系统.4, 约束.2, 约束.3]

**designCovers**: [Q2, BF3, CONTRACT-3, SEC-1, TO-11, TO-15]

**设计文档段落**: 「Adapter 契约 CONTRACT-3」「适配边界：Integration」「BF3 — 初次启停」

**HITL / AFK**: AFK。测试只用 spy，不接触真实仓库、端口或 Docker。

**UI 设计源**: N/A（无 UI）。

**文件**:（2 个）

- `skills/agents-launcher/lib/service-adapters.mjs`（新建）
- `skills/agents-launcher/lib/service-adapters.test.mjs`（新建）

**依赖**: Task 2

**TDD steps**:

- [ ] Step 1：写四个 adapter 的委托、status 规范化与 Docker stop 测试。
- [ ] Step 2：运行测试，确认因 registry 模块缺失而失败。
- [ ] Step 3：实现冻结 registry、命令序列执行 helper 与 status 规范化。
- [ ] Step 4：运行 adapter 测试和既有三个 CLI 测试。

**失败测试代码**（`service-adapters.test.mjs`）:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADAPTER_CAPABILITIES,
  ADAPTER_NAMES,
  createServiceAdapters,
} from './service-adapters.mjs';

function fixture({ runCode = 0 } = {}) {
  const calls = [];
  const child = { pid: 41 };
  const services = {
    agents: {
      start: (options) => { calls.push(['agents.start', options]); return child; },
      killCommands: () => [['pkill', ['-f', 'telemetry/preload.ts']]],
      status: async () => ({ up: true, pid: '80701' }),
    },
    web: {
      start: (options) => { calls.push(['web.start', options]); return child; },
      killCommands: () => [['sh', ['-c', 'kill-web']]],
      status: async () => ({ up: true, pid: '100011' }),
    },
    server: {
      infra: async (options) => { calls.push(['docker.start', options]); },
      start: async (options) => { calls.push(['server.start', options]); return child; },
      killCommands: () => [['sh', ['-c', 'kill-server']]],
    },
  };
  const io = {
    runToEnd: async (label, command, args, options) => {
      calls.push(['run', label, command, args, options]);
      return runCode;
    },
    httpOk: async () => true,
    pidOnPort: () => '80811',
  };
  const adapters = createServiceAdapters({
    repos: { AGENTS_DIR: '/agents', WEB_DIR: '/web', SERVER_DIR: '/server' },
    ports: { agents: 8070, server: 8081, web: 10001 },
    options: { dockerScriptPath: '/tmp/docker-start.sh' },
    services,
    io,
  });
  return { adapters, calls, child };
}

test('adapter allowlist 与 identity capability 固定且冻结', () => {
  assert.deepEqual(ADAPTER_NAMES, ['docker', 'agents', 'server', 'web']);
  assert.equal(ADAPTER_CAPABILITIES.docker.supportsIdentity, false);
  assert.equal(ADAPTER_CAPABILITIES.agents.supportsIdentity, true);
  assert.equal(Object.isFrozen(ADAPTER_CAPABILITIES), true);
});

test('web start 委托 webCli.start 并返回 handle', async () => {
  const { adapters, calls, child } = fixture();
  assert.deepEqual(await adapters.web.start({}), { handles: [child] });
  assert.deepEqual(calls[0], ['web.start', { webDir: '/web' }]);
});

test('agents/web status 被规范化为 healthy + listener identity', async () => {
  const { adapters } = fixture();
  assert.deepEqual(await adapters.agents.status({}), {
    healthy: true,
    identity: '80701',
  });
  assert.deepEqual(await adapters.web.status({}), {
    healthy: true,
    identity: '100011',
  });
});

test('server start 根据 selected docker 决定是否重复起 infra', async () => {
  const { adapters, calls } = fixture();
  await adapters.server.start({ plan: { selected: ['docker', 'server'] } });
  assert.equal(calls[0][0], 'server.start');
  assert.equal(calls[0][1].ensureInfra, false);
  assert.equal(calls[0][1].killOld, true);
});

test('docker normal stop no-op，显式 down 才执行 compose down', async () => {
  const { adapters, calls } = fixture();
  await adapters.docker.stop({ downDocker: false });
  assert.deepEqual(calls, []);
  await adapters.docker.stop({ downDocker: true });
  assert.deepEqual(calls[0], [
    'run',
    'docker-down',
    'docker',
    ['compose', 'down'],
    { cwd: '/server' },
  ]);
});

test('per-service stop 在进程已不存在时保持幂等', async () => {
  const { adapters } = fixture({ runCode: 1 });
  await assert.doesNotReject(() => adapters.agents.stop({}));
});
```

**最小实现代码**（`service-adapters.mjs`）:

```js
import * as agentsCli from '../agents-cli.mjs';
import * as serverCli from '../server-cli.mjs';
import * as webCli from '../web-cli.mjs';
import { httpOk, pidOnPort, tcpOpen } from './probe.mjs';
import { runToEnd } from './proc.mjs';
import { PORTS } from './ports.mjs';

export const ADAPTER_CAPABILITIES = Object.freeze({
  docker: Object.freeze({ lifecycle: 'oneshot', supportsIdentity: false }),
  agents: Object.freeze({ lifecycle: 'service', supportsIdentity: true }),
  server: Object.freeze({ lifecycle: 'service', supportsIdentity: true }),
  web: Object.freeze({ lifecycle: 'service', supportsIdentity: true }),
});

export const ADAPTER_NAMES = Object.freeze(Object.keys(ADAPTER_CAPABILITIES));

function handles(child) {
  return { handles: child ? [child] : [] };
}

function normalizeStatus(status) {
  const identity = status.up && status.pid && status.pid !== '-'
    ? String(status.pid)
    : null;
  return { healthy: Boolean(status.up), identity };
}

async function runCommands(label, commands, run) {
  for (const [command, args] of commands) {
    await run(label, command, args);
  }
}

export function createServiceAdapters({
  repos,
  ports = PORTS,
  options = {},
  services = { agents: agentsCli, server: serverCli, web: webCli },
  io = {},
} = {}) {
  const run = io.runToEnd ?? runToEnd;
  const probes = {
    httpOk: io.httpOk ?? httpOk,
    pidOnPort: io.pidOnPort ?? pidOnPort,
    tcpOpen: io.tcpOpen ?? tcpOpen,
  };

  const registry = {
    docker: {
      ...ADAPTER_CAPABILITIES.docker,
      async start() {
        await services.server.infra({
          serverDir: repos.SERVER_DIR,
          dockerScriptPath: options.dockerScriptPath,
        });
        return { handles: [] };
      },
      async stop({ downDocker = false } = {}) {
        if (!downDocker) return;
        const code = await run(
          'docker-down',
          'docker',
          ['compose', 'down'],
          { cwd: repos.SERVER_DIR },
        );
        if (code !== 0) throw new Error(`[docker-down] docker compose down failed (${code})`);
      },
      async status() {
        return { healthy: true, identity: null };
      },
    },
    agents: {
      ...ADAPTER_CAPABILITIES.agents,
      async start() {
        return handles(services.agents.start({ agentsDir: repos.AGENTS_DIR }));
      },
      async stop() {
        await runCommands('agents-stop', services.agents.killCommands({ ports }), run);
      },
      async status() {
        return normalizeStatus(await services.agents.status({ ports, probes }));
      },
    },
    server: {
      ...ADAPTER_CAPABILITIES.server,
      async start(context) {
        const child = await services.server.start({
          serverDir: repos.SERVER_DIR,
          ports,
          killOld: true,
          ensureInfra: !context.plan.selected.includes('docker'),
        });
        return handles(child);
      },
      async stop() {
        await runCommands(
          'server-stop',
          services.server.killCommands({ ports, serverDir: repos.SERVER_DIR }),
          run,
        );
      },
      async status() {
        const healthy = await probes.httpOk(`http://127.0.0.1:${ports.server}/`);
        const identity = healthy ? String(await probes.pidOnPort(ports.server) || '') : '';
        return { healthy, identity: identity || null };
      },
    },
    web: {
      ...ADAPTER_CAPABILITIES.web,
      async start() {
        return handles(services.web.start({ webDir: repos.WEB_DIR }));
      },
      async stop() {
        await runCommands('web-stop', services.web.killCommands({ ports }), run);
      },
      async status() {
        return normalizeStatus(await services.web.status({
          ports,
          probes: {
            tcpOpen: probes.tcpOpen,
            pidOnPort: probes.pidOnPort,
          },
        }));
      },
    },
  };

  for (const adapter of Object.values(registry)) Object.freeze(adapter);
  return Object.freeze(registry);
}
```

**验证命令**:

- `node --test skills/agents-launcher/lib/service-adapters.test.mjs`
  预期：exit 0，`# fail 0`。
- `node --test skills/agents-launcher/agents-cli.test.mjs skills/agents-launcher/web-cli.test.mjs skills/agents-launcher/server-cli.test.mjs`
  预期：现有 per-service CLI suite 全绿，`# fail 0`。

## Task 4：让 CLI 从 topology catalog 选择本轮所有权 [Size: M]

**描述**: 删除 `lib/cli.mjs` 的硬编码 `WORKSPACES`，让 argv 只解析 workspace 与 disabled service，再由 topology 产 plan；同时先把 plan 投影回旧 `args.services`，保持 T9 前的主启动体可运行，并为 `--dry-run` 输出配置来源、start/stop order、omitted 与传播边。

**验收标准**:

- [ ] workspace 与 service 合法值只来自已验证 YAML catalog。
- [ ] `ui/agents/full`、默认 `ui` 与四个 `--no-*` 外部 CLI 兼容。
- [ ] 未知 workspace 和未知 `--no-<service>` 给出列明合法值的 `[topology]` 错误。
- [ ] `--dry-run` 子进程输出 config source、selected、start/stop order、omitted 与 propagation，且不创建 `.env.local`、不执行 kill/start。

**covers**: [系统.1, 系统.2, 系统.3, 系统.5, 约束.2]

**designCovers**: [BF2, CONTRACT-2, CONTRACT-4, LOG-1, MIG-1, GATE-1, TO-3, TO-12]

**设计文档段落**: 「CLI 兼容契约 CONTRACT-4」「BF2 — workspace 投影与 preflight」「MIG-1」

**HITL / AFK**: AFK。dry-run 集成测试只写 OS 临时目录。

**UI 设计源**: N/A（无 UI）。

**文件**:（4 个）

- `skills/agents-launcher/lib/cli.mjs`（改）
- `skills/agents-launcher/lib/cli.test.mjs`（改）
- `skills/agents-launcher/dev-orchestrator.mjs`（改：只接 config/plan 与诊断）
- `skills/agents-launcher/dev-orchestrator.test.mjs`（新建）

**依赖**: Task 2、Task 3

**TDD steps**:

- [ ] Step 1：先改 CLI 单测为注入 catalog，并新增真实 `--dry-run` 子进程测试。
- [ ] Step 2：运行两组测试，确认旧 `parseArgs(argv)` 与旧 orchestrator 输出不满足断言。
- [ ] Step 3：实现 catalog-driven `parseArgs`，在 orchestrator 顶部 load→catalog→parse→plan，再建立临时 `services` 投影。
- [ ] Step 4：重跑两组测试，确认 dry-run 零副作用。

**失败测试代码**（`cli.test.mjs` 的新契约）:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from './cli.mjs';

const catalog = {
  workspaceIds: ['ui', 'agents', 'full'],
  serviceIds: ['docker', 'agents', 'server', 'web'],
};

test('默认 workspace 与 flags 兼容', () => {
  const args = parseArgs(['--no-web', '--css-watch', '--yes'], catalog);
  assert.equal(args.workspace, 'ui');
  assert.deepEqual(args.disabled, ['web']);
  assert.equal(args.cssWatch, true);
  assert.equal(args.yes, true);
});

test('workspace 值来自 catalog', () => {
  assert.equal(
    parseArgs(['--workspace=agents'], catalog).workspace,
    'agents',
  );
  assert.throws(
    () => parseArgs(['--workspace=ghost'], catalog),
    /\[topology\] 未知 workspace: ghost（可选 ui \| agents \| full）/,
  );
});

test('未知 no-service flag fail-loud', () => {
  assert.throws(
    () => parseArgs(['--no-shell'], catalog),
    /\[topology\] 未知 service: shell/,
  );
});
```

**最小实现代码**（`cli.mjs`）:

```js
export function parseArgs(argv, catalog) {
  if (!catalog?.workspaceIds?.length || !catalog?.serviceIds?.length) {
    throw new Error('[topology] parseArgs 需要已验证的 workspace/service catalog');
  }
  let workspace = 'ui';
  const flags = new Set();
  for (const arg of argv) {
    const match = arg.match(/^--workspace=(.+)$/);
    if (match) {
      workspace = match[1];
      continue;
    }
    if (arg.startsWith('--')) flags.add(arg.slice(2));
  }
  if (!catalog.workspaceIds.includes(workspace)) {
    throw new Error(
      `[topology] 未知 workspace: ${workspace}（可选 ${catalog.workspaceIds.join(' | ')}）`,
    );
  }

  for (const flag of flags) {
    if (!flag.startsWith('no-')) continue;
    const serviceId = flag.slice('no-'.length);
    if (!catalog.serviceIds.includes(serviceId)) {
      throw new Error(`[topology] 未知 service: ${serviceId}`);
    }
  }

  return {
    workspace,
    disabled: catalog.serviceIds.filter((serviceId) => flags.has(`no-${serviceId}`)),
    dryRun: flags.has('dry-run'),
    cssWatch: flags.has('css-watch'),
    dockerDownOnExit: flags.has('docker-down-on-exit'),
    yes: flags.has('yes'),
    status: flags.has('status'),
    stop: flags.has('stop'),
  };
}
```

**orchestrator 顶部接线代码**:

```js
import { dirname, join } from 'node:path';
import { loadLauncherConfig } from './lib/launcher-config.mjs';
import {
  buildServicePlan,
  topologyCatalog,
} from './lib/topology.mjs';
import {
  ADAPTER_CAPABILITIES,
  ADAPTER_NAMES,
} from './lib/service-adapters.mjs';

const toolDir = dirname(fileURLToPath(import.meta.url));
const configPath = join(toolDir, 'agents-launcher.yml');
const identityAdapterNames = Object.entries(ADAPTER_CAPABILITIES)
  .filter(([, capability]) => capability.supportsIdentity)
  .map(([adapterName]) => adapterName);
const { config, sourcePath } = loadLauncherConfig({
  path: configPath,
  adapterNames: ADAPTER_NAMES,
  identityAdapterNames,
});
const parsedArgs = parseArgs(process.argv.slice(2), topologyCatalog(config));
const plan = buildServicePlan(config, parsedArgs);
const args = {
  ...parsedArgs,
  services: Object.fromEntries(
    Object.keys(config.services).map((serviceId) => [
      serviceId,
      plan.selected.includes(serviceId),
    ]),
  ),
};
const repos = resolveRepos({ toolDir });
```

`main()` 的首段诊断替换为：

```js
console.log(`[topology.loaded] ${JSON.stringify({
  sourcePath,
  schemaVersion: config.schema_version,
  workspace: plan.workspace,
  selected: plan.selected,
})}`);
console.log(`[plan.created] ${JSON.stringify({
  startOrder: plan.startOrder,
  stopOrder: plan.stopOrder,
  omittedOptionalDependencies: plan.omittedOptionalDependencies,
  propagationEdges: plan.propagationEdges,
})}`);
```

**dry-run 集成测试代码**（`dev-orchestrator.test.mjs`）:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

function touch(path) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, '');
}

test('--dry-run 输出 topology plan 且不写 web env', () => {
  const root = mkdtempSync(join(tmpdir(), 'agents-launcher-dry-run-'));
  const agentsDir = join(root, 'agents');
  const webDir = join(root, 'web');
  touch(join(agentsDir, 'packages/server/conf/config.example.yaml'));
  touch(join(agentsDir, 'packages/server/conf/config.yaml'));
  touch(join(agentsDir, 'packages/desktop/dist/style.css'));
  touch(join(agentsDir, 'packages/ui/dist/agent-ui.css'));
  touch(join(webDir, 'packages/jsy-web/src/entry/config.ts'));

  const script = fileURLToPath(new URL('./dev-orchestrator.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [
    script,
    '--workspace=ui',
    '--dry-run',
    '--yes',
  ], {
    encoding: 'utf8',
    env: {
      ...process.env,
      FX_AGENTS_DIR: agentsDir,
      FX_WEB_DIR: webDir,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\[topology\.loaded\].*"schemaVersion":1/);
  assert.match(result.stdout, /"startOrder":\["agents","web"\]/);
  assert.match(result.stdout, /"stopOrder":\["web","agents"\]/);
  assert.match(result.stdout, /"propagationEdges":\[\{"upstream":"agents","downstream":"web"\}\]/);
  assert.equal(existsSync(join(webDir, 'packages/jsy-web/server/.env.local')), false);
});
```

**验证命令**:

- `node --test skills/agents-launcher/lib/cli.test.mjs skills/agents-launcher/dev-orchestrator.test.mjs`
  预期：exit 0，`# fail 0`。
- `node --check skills/agents-launcher/dev-orchestrator.mjs`
  预期：exit 0，无输出；dry-run JSON 内容由上一条临时仓集成测试判定。

## ✅ Checkpoint C3：覆盖 Task 3-4

**触发原因**: fallback；C2 后已完成两个跨边界 slice，并且 T4 是旧 CLI 到新 topology plan 的原子迁移点。

**全部测试**:

- `node --test 'skills/agents-launcher/lib/*.test.mjs' 'skills/agents-launcher/*.test.mjs'`
  预期：所有 launcher 测试 `# fail 0`，保留既有一条环境相关 skip。

**Build**:

- `node --check skills/agents-launcher/dev-orchestrator.mjs`
  预期：exit 0，无输出。

**用户 Review**:

- [ ] 演示默认 `ui`、`full` 与 `ui --no-agents` 的 dry-run。
- [ ] 用户确认旧启动体仍可用，并允许进入 generation 监督实现。

**Rollback 点**: 可回滚到 C2；YAML 与 planner 仍可独立保留，CLI 继续旧硬编码。

## Task 5：把 health + identity observation 收敛为 generation 事件 [Size: M]

**描述**: 先实现无 timer、无进程副作用的 generation 纯状态机。每次输入一条 `{ healthy, identity }`，输出新状态、可选 generation event 与可选 warning；这让 baseline、迟滞、同 identity 恢复和快速替换可以逐 observation 精确测试。

**验收标准**:

- [ ] 初始 identity 连续稳定达到阈值后建立 generation 0 baseline，不发事件。
- [ ] 单次探测失败不改变 stable phase；达到 failure threshold 才进入 degraded。
- [ ] degraded 后同 identity 连续恢复不发事件；新 identity 连续稳定只发一次 generation event。
- [ ] 未采到 down 的 `healthy(A) → healthy(B)` 和候选 `B → C` 均按最新稳定 identity 处理。
- [ ] healthy 但缺 identity 时返回 warning，不猜 generation。

**covers**: [系统.4, 系统.6]

**designCovers**: [Q3, BF4, LOG-1, TO-5, TO-6, TO-7, TO-8]

**设计文档段落**: 「GenerationSupervisor 模块 / 状态转换」「BF4 — agents 新 generation 级联 web」「单测设计 / BF4」

**HITL / AFK**: AFK。纯函数测试，不使用 clock 或端口。

**UI 设计源**: N/A（无 UI）。

**文件**:（2 个）

- `skills/agents-launcher/lib/supervisor.mjs`（新建：纯状态部分）
- `skills/agents-launcher/lib/supervisor.test.mjs`（新建）

**依赖**: None

**TDD steps**:

- [ ] Step 1：写 baseline、failure hysteresis、同 PID 恢复、快速替换和候选覆盖测试。
- [ ] Step 2：运行测试，确认模块缺失。
- [ ] Step 3：实现 `createGenerationState` 与 `observeGeneration`。
- [ ] Step 4：重跑测试，确认每条 observation 序列的 event 数与 generation 精确匹配。

**失败测试代码**（`supervisor.test.mjs`）:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGenerationState,
  observeGeneration,
} from './supervisor.mjs';

const policy = {
  serviceId: 'agents',
  stableSuccesses: 2,
  failureThreshold: 2,
};
const healthy = (identity) => ({ healthy: true, identity });
const down = { healthy: false, identity: null };

function drive(observations) {
  let state = createGenerationState();
  const events = [];
  for (const observation of observations) {
    const transition = observeGeneration(state, observation, policy);
    state = transition.state;
    if (transition.event) events.push(transition.event);
  }
  return { state, events };
}

test('首次稳定 identity 只建立 generation 0 baseline', () => {
  const result = drive([healthy('A'), healthy('A')]);
  assert.equal(result.state.phase, 'healthy');
  assert.equal(result.state.stableIdentity, 'A');
  assert.equal(result.state.generation, 0);
  assert.deepEqual(result.events, []);
});

test('单次失败不降级，两次失败后同 identity 恢复不发事件', () => {
  const result = drive([
    healthy('A'),
    healthy('A'),
    down,
    healthy('A'),
    down,
    down,
    healthy('A'),
    healthy('A'),
  ]);
  assert.equal(result.state.phase, 'healthy');
  assert.equal(result.state.stableIdentity, 'A');
  assert.equal(result.state.generation, 0);
  assert.deepEqual(result.events, []);
});

test('新 identity 连续稳定只发一次 generation event', () => {
  const result = drive([
    healthy('A'),
    healthy('A'),
    down,
    down,
    healthy('B'),
    healthy('B'),
    healthy('B'),
  ]);
  assert.equal(result.state.stableIdentity, 'B');
  assert.equal(result.state.generation, 1);
  assert.deepEqual(result.events, [{
    id: 'agents:g1',
    serviceId: 'agents',
    generation: 1,
    previousIdentity: 'A',
    identity: 'B',
  }]);
});

test('快速替换不需要观察到 down', () => {
  const result = drive([
    healthy('A'),
    healthy('A'),
    healthy('B'),
    healthy('B'),
  ]);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].id, 'agents:g1');
});

test('未稳定候选被更新 identity 覆盖', () => {
  const result = drive([
    healthy('A'),
    healthy('A'),
    healthy('B'),
    healthy('C'),
    healthy('C'),
  ]);
  assert.equal(result.state.stableIdentity, 'C');
  assert.equal(result.events[0].identity, 'C');
});

test('healthy 但没有 identity 时告警且不推进 generation', () => {
  const baseline = drive([healthy('A'), healthy('A')]).state;
  const transition = observeGeneration(
    baseline,
    { healthy: true, identity: null },
    policy,
  );
  assert.equal(transition.warning, 'identity_missing');
  assert.equal(transition.state.generation, 0);
  assert.equal(transition.event, null);
});
```

**最小实现代码**（`supervisor.mjs` 的纯状态部分）:

```js
export function createGenerationState() {
  return {
    phase: 'unobserved',
    stableIdentity: null,
    candidateIdentity: null,
    candidateSuccesses: 0,
    consecutiveFailures: 0,
    generation: 0,
  };
}

function recordCandidate(state, identity) {
  if (state.candidateIdentity === identity) {
    state.candidateSuccesses += 1;
  } else {
    state.candidateIdentity = identity;
    state.candidateSuccesses = 1;
  }
}

function clearCandidate(state) {
  state.candidateIdentity = null;
  state.candidateSuccesses = 0;
}

export function observeGeneration(state, observation, {
  serviceId,
  stableSuccesses,
  failureThreshold,
}) {
  const next = { ...state };

  if (!observation.healthy) {
    next.consecutiveFailures += 1;
    clearCandidate(next);
    if (next.stableIdentity !== null
        && next.consecutiveFailures >= failureThreshold) {
      next.phase = 'degraded';
    }
    return { state: next, event: null, warning: null };
  }

  if (observation.identity === null || observation.identity === undefined
      || String(observation.identity).length === 0) {
    next.consecutiveFailures = 0;
    clearCandidate(next);
    return { state: next, event: null, warning: 'identity_missing' };
  }

  const identity = String(observation.identity);
  next.consecutiveFailures = 0;

  if (next.stableIdentity === null) {
    recordCandidate(next, identity);
    if (next.candidateSuccesses >= stableSuccesses) {
      next.stableIdentity = identity;
      next.phase = 'healthy';
      clearCandidate(next);
    }
    return { state: next, event: null, warning: null };
  }

  if (identity === next.stableIdentity) {
    if (next.phase === 'degraded') {
      recordCandidate(next, identity);
      if (next.candidateSuccesses >= stableSuccesses) {
        next.phase = 'healthy';
        clearCandidate(next);
      }
    } else {
      next.phase = 'healthy';
      clearCandidate(next);
    }
    return { state: next, event: null, warning: null };
  }

  recordCandidate(next, identity);
  if (next.candidateSuccesses < stableSuccesses) {
    return { state: next, event: null, warning: null };
  }

  const previousIdentity = next.stableIdentity;
  next.stableIdentity = identity;
  next.phase = 'healthy';
  next.generation += 1;
  clearCandidate(next);
  return {
    state: next,
    warning: null,
    event: {
      id: `${serviceId}:g${next.generation}`,
      serviceId,
      generation: next.generation,
      previousIdentity,
      identity,
    },
  };
}
```

**验证命令**:

- `node --test skills/agents-launcher/lib/supervisor.test.mjs`
  预期：exit 0，六条顶层 case 全绿，`# fail 0`。

## Task 6：监督传播源且禁止 tick 重入 [Size: M]

**描述**: 在纯状态机外增加可注入 timer/probe 的 supervisor。它只为 `plan.propagationEdges` 的 upstream 建状态，seed generation 0 后启动 interval；同时到来的 100 次 tick 共享同一个 promise，不产生并行 probe。

**验收标准**:

- [ ] seed 要求每个传播源达到 stable successes，且 baseline 期间 event 数为零。
- [ ] 只创建传播源状态；当前正式 plan 不探测 web/server/docker。
- [ ] 任意数量的并发 `tick()` 最多有一个未决 probe 批次，最大 probe concurrency 为 1。
- [ ] generation callback 的异步执行不阻塞下一次 observation，拒绝时被结构化记录而非形成 unhandled rejection。
- [ ] `stop()` 清 timer 并等待当前 tick settle；`acceptBaseline()` 静默同步 runtime 主动重启的传播源。

**covers**: [系统.4, 系统.6]

**designCovers**: [Q3, BF4, LOG-1, PERF-1, TO-5, TO-6, TO-7, TO-8, TO-14]

**设计文档段落**: 「GenerationSupervisor 模块 / 轮询纪律」「级联 single-flight」「性能 PERF-1」

**HITL / AFK**: AFK。timer、sleep、status 与 callback 全部注入。

**UI 设计源**: N/A（无 UI）。

**文件**:（2 个）

- `skills/agents-launcher/lib/supervisor.mjs`（改：增加 supervisor factory）
- `skills/agents-launcher/lib/supervisor.test.mjs`（改）

**依赖**: Task 5

**TDD steps**:

- [ ] Step 1：追加 seed、只探测传播源、100 ticks 与 stop settle 测试。
- [ ] Step 2：运行测试，确认 factory export 缺失。
- [ ] Step 3：实现 states map、共享 `tickPromise`、seed/start/stop 与异步 callback 防护。
- [ ] Step 4：运行 supervisor 全部测试。

**失败测试代码**（追加到 `supervisor.test.mjs`）:

```js
import { createGenerationSupervisor } from './supervisor.mjs';

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test('seed 只建立传播源 baseline，不发 generation event', async () => {
  const observations = [
    { healthy: true, identity: 'A' },
    { healthy: true, identity: 'A' },
  ];
  const events = [];
  const logs = [];
  const supervisor = createGenerationSupervisor({
    serviceIds: ['agents'],
    adapters: {
      agents: { status: async () => observations.shift() },
      web: { status: async () => { throw new Error('web 不应被探测'); } },
    },
    supervision: {
      interval_ms: 1000,
      stable_successes: 2,
      failure_threshold: 2,
    },
    onGenerationChanged: (event) => events.push(event),
    log: (event, payload) => logs.push([event, payload]),
    sleep: async () => {},
  });
  await supervisor.seed();
  assert.equal(supervisor.getState('agents').stableIdentity, 'A');
  assert.deepEqual(events, []);
  assert.equal(supervisor.getState('web'), null);
  assert.deepEqual(
    logs.find(([event]) => event === 'service.state_changed')[1],
    {
      serviceId: 'agents',
      previousState: 'unobserved',
      newState: 'healthy',
      identity: 'A',
      generation: 0,
    },
  );
});

test('100 个并发 tick 共享一个 probe batch', async () => {
  const gate = deferred();
  let calls = 0;
  let active = 0;
  let maxActive = 0;
  const supervisor = createGenerationSupervisor({
    serviceIds: ['agents'],
    adapters: {
      agents: {
        status: async () => {
          calls += 1;
          active += 1;
          maxActive = Math.max(maxActive, active);
          await gate.promise;
          active -= 1;
          return { healthy: true, identity: 'A' };
        },
      },
    },
    supervision: {
      interval_ms: 1000,
      stable_successes: 1,
      failure_threshold: 2,
    },
  });
  const ticks = Array.from({ length: 100 }, () => supervisor.tick());
  gate.resolve();
  await Promise.all(ticks);
  assert.equal(calls, 1);
  assert.equal(maxActive, 1);
});

test('stop 清 timer 并等待未决 tick', async () => {
  const gate = deferred();
  const cleared = [];
  const supervisor = createGenerationSupervisor({
    serviceIds: ['agents'],
    adapters: {
      agents: {
        status: async () => {
          await gate.promise;
          return { healthy: true, identity: 'A' };
        },
      },
    },
    supervision: {
      interval_ms: 1000,
      stable_successes: 1,
      failure_threshold: 2,
    },
    setIntervalFn: () => 73,
    clearIntervalFn: (timer) => cleared.push(timer),
  });
  supervisor.start();
  const tick = supervisor.tick();
  const stopping = supervisor.stop();
  gate.resolve();
  await Promise.all([tick, stopping]);
  assert.deepEqual(cleared, [73]);
});
```

**最小实现代码**（追加到 `supervisor.mjs`）:

```js
const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createGenerationSupervisor({
  serviceIds,
  adapters,
  supervision,
  onGenerationChanged = () => {},
  log = () => {},
  sleep = defaultSleep,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
} = {}) {
  const states = new Map(
    serviceIds.map((serviceId) => [serviceId, createGenerationState()]),
  );
  const policy = {
    stableSuccesses: supervision.stable_successes,
    failureThreshold: supervision.failure_threshold,
  };
  let timer = null;
  let tickPromise = null;

  async function tickService(serviceId) {
    let observation;
    try {
      observation = await adapters[serviceId].status({ serviceId });
    } catch (error) {
      log('state.probe_failed', { serviceId, message: error.message });
      observation = { healthy: false, identity: null };
    }
    const before = states.get(serviceId);
    const transition = observeGeneration(before, observation, {
      ...policy,
      serviceId,
    });
    states.set(serviceId, transition.state);
    if (transition.warning) {
      log('state.warning', { serviceId, warning: transition.warning });
    }
    if (before.phase !== transition.state.phase
        || before.stableIdentity !== transition.state.stableIdentity) {
      log('service.state_changed', {
        serviceId,
        previousState: before.phase,
        newState: transition.state.phase,
        identity: transition.state.stableIdentity,
        generation: transition.state.generation,
      });
    }
    if (transition.event) {
      Promise.resolve()
        .then(() => onGenerationChanged(transition.event))
        .catch((error) => {
          log('cascade.callback_failed', {
            serviceId,
            generation: transition.event.generation,
            message: error.message,
          });
        });
    }
  }

  function tick() {
    if (tickPromise) return tickPromise;
    tickPromise = Promise.all(serviceIds.map(tickService))
      .finally(() => { tickPromise = null; });
    return tickPromise;
  }

  async function seed({
    maxAttempts = supervision.stable_successes * 3,
  } = {}) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      await tick();
      const complete = serviceIds.every(
        (serviceId) => states.get(serviceId).stableIdentity !== null,
      );
      if (complete) return;
      if (attempt < maxAttempts) await sleep(supervision.interval_ms);
    }
    throw new Error('[supervisor] baseline 建立超时');
  }

  function start() {
    if (timer !== null || serviceIds.length === 0) return;
    timer = setIntervalFn(() => { void tick(); }, supervision.interval_ms);
  }

  async function stop() {
    if (timer !== null) {
      clearIntervalFn(timer);
      timer = null;
    }
    if (tickPromise) await tickPromise;
  }

  function acceptBaseline(serviceId, observation) {
    if (!states.has(serviceId) || !observation.healthy || !observation.identity) return;
    const current = states.get(serviceId);
    states.set(serviceId, {
      ...current,
      phase: 'healthy',
      stableIdentity: String(observation.identity),
      candidateIdentity: null,
      candidateSuccesses: 0,
      consecutiveFailures: 0,
    });
  }

  return Object.freeze({
    tick,
    seed,
    start,
    stop,
    acceptBaseline,
    getState(serviceId) {
      const state = states.get(serviceId);
      return state ? { ...state } : null;
    },
  });
}
```

**验证命令**:

- `node --test skills/agents-launcher/lib/supervisor.test.mjs`
  预期：exit 0，包含 `100 个并发 tick` case，TAP 末尾 `# fail 0`。

## ✅ Checkpoint C4：覆盖 Task 5-6

**触发原因**: Task 6 命中风险信号 #5（interval tick、异步 callback 与 stop 存在竞态）。

**全部测试**:

- `node --test skills/agents-launcher/lib/supervisor.test.mjs`
  预期：`# fail 0`。

**Build**:

- `node --check skills/agents-launcher/lib/supervisor.mjs`
  预期：exit 0，无输出。

**用户 Review**:

- [ ] 演示 `A → down×2 → B×2` 只产生 `agents:g1`。
- [ ] 演示 100 次并发 tick 的 probe count 与 max concurrency 均为 1。
- [ ] 用户确认继续、调整或回滚。

**Rollback 点**: 可回滚到 C3；CLI 已能读 topology，但尚未启用运行期 supervision。

## Task 7：按 plan 执行初始 stop/start/readiness [Size: M]

**描述**: 实现 `ServiceRuntime` 的初始生命周期 slice：先按 stopOrder 清上一轮，再按 startOrder 逐个启动并等待 service healthy；任一步失败只逆序清理本轮已启动项，Docker normal stop 保持 no-op。

**验收标准**:

- [ ] full plan 的 trace 精确为 reverse stop 后 `docker → agents → server → web` start/readiness。
- [ ] oneshot start promise resolve 即完成，不调用 status；service 必须等待 healthy。
- [ ] server start 失败时只逆序清理已启动的 agents/docker，web 从未启动，Docker 不 down。
- [ ] readiness 超时时后续 service 不启动。
- [ ] child handles 按 service 登记，重复 stop 幂等。

**covers**: [系统.1, 系统.2, 系统.5, 约束.2]

**designCovers**: [BF3, BF5, CONTRACT-3, TO-4, TO-10, TO-11]

**设计文档段落**: 「ServiceRuntime 模块」「BF3 — 初次启停与 readiness」「BF5 — 停止、信号与失败退出」

**HITL / AFK**: AFK。所有 adapter 与 wait helper 使用 fake。

**UI 设计源**: N/A（无 UI）。

**文件**:（2 个）

- `skills/agents-launcher/lib/service-runtime.mjs`（新建）
- `skills/agents-launcher/lib/service-runtime.test.mjs`（新建）

**依赖**: Task 2、Task 3

**TDD steps**:

- [ ] Step 1：写 full trace、start failure、readiness timeout 与 handle 幂等测试。
- [ ] Step 2：运行测试，确认 runtime 模块缺失。
- [ ] Step 3：实现 `startSelected`、`stopSelected`、`startOne`、`stopOne` 与 failure cleanup。
- [ ] Step 4：重跑 runtime 测试。

**失败测试代码**（`service-runtime.test.mjs`）:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { ServiceRuntime } from './service-runtime.mjs';

const fullPlan = {
  selected: ['docker', 'agents', 'server', 'web'],
  startOrder: ['docker', 'agents', 'server', 'web'],
  stopOrder: ['web', 'server', 'agents', 'docker'],
  propagationEdges: [{ upstream: 'agents', downstream: 'web' }],
};

function fakeAdapters(trace, { failStart = null } = {}) {
  return Object.fromEntries(
    fullPlan.selected.map((serviceId) => [
      serviceId,
      {
        lifecycle: serviceId === 'docker' ? 'oneshot' : 'service',
        async start() {
          trace.push(`start:${serviceId}`);
          if (serviceId === failStart) throw new Error(`${serviceId} start failed`);
          return { handles: [] };
        },
        async stop() {
          trace.push(`stop:${serviceId}`);
        },
        async status() {
          trace.push(`status:${serviceId}`);
          return { healthy: true, identity: `${serviceId}-pid` };
        },
      },
    ]),
  );
}

test('full plan 逆序清理后按拓扑顺序启动并等待 readiness', async () => {
  const trace = [];
  const runtime = new ServiceRuntime({
    plan: fullPlan,
    adapters: fakeAdapters(trace),
    waitHealthyFn: async (_label, check) => {
      assert.equal((await check()), true);
    },
  });
  await runtime.startSelected();
  assert.deepEqual(trace, [
    'stop:web',
    'stop:server',
    'stop:agents',
    'stop:docker',
    'start:docker',
    'start:agents',
    'status:agents',
    'start:server',
    'status:server',
    'start:web',
    'status:web',
  ]);
  assert.equal(runtime.phase, 'running');
});

test('中途 start 失败只逆序清理本轮已启动项', async () => {
  const trace = [];
  const runtime = new ServiceRuntime({
    plan: fullPlan,
    adapters: fakeAdapters(trace, { failStart: 'server' }),
    waitHealthyFn: async (_label, check) => {
      assert.equal((await check()), true);
    },
  });
  await assert.rejects(() => runtime.startSelected(), /server start failed/);
  assert.deepEqual(trace.slice(trace.lastIndexOf('start:server')), [
    'start:server',
    'stop:agents',
    'stop:docker',
  ]);
  assert.equal(trace.includes('start:web'), false);
});

test('readiness 超时阻止后续 service 启动', async () => {
  const trace = [];
  const runtime = new ServiceRuntime({
    plan: fullPlan,
    adapters: fakeAdapters(trace),
    waitHealthyFn: async (label) => {
      if (label === 'agents') throw new Error('[agents] 健康检查超时');
    },
  });
  await assert.rejects(() => runtime.startSelected(), /agents.*健康检查超时/);
  assert.equal(trace.includes('start:server'), false);
  assert.equal(trace.includes('start:web'), false);
  assert.deepEqual(trace.slice(trace.lastIndexOf('start:agents')), [
    'start:agents',
    'stop:agents',
    'stop:docker',
  ]);
});

test('同一个 child handle 只 SIGTERM 一次', async () => {
  const trace = [];
  const killed = [];
  const adapters = fakeAdapters(trace);
  adapters.agents.start = async () => {
    trace.push('start:agents');
    return {
      handles: [{
        kill: (signal) => killed.push(signal),
      }],
    };
  };
  const runtime = new ServiceRuntime({
    plan: fullPlan,
    adapters,
    waitHealthyFn: async (_label, check) => {
      assert.equal((await check()), true);
    },
  });
  await runtime.startSelected();
  await runtime.stopSelected();
  await runtime.stopSelected();
  assert.deepEqual(killed, ['SIGTERM']);
});
```

**最小实现代码**（`service-runtime.mjs`）:

```js
import { waitHealthy } from './proc.mjs';

export class ServiceRuntime {
  constructor({
    plan,
    adapters,
    waitHealthyFn = waitHealthy,
    readiness = { tries: 120, intervalMs: 1000 },
    log = () => {},
  } = {}) {
    this.plan = plan;
    this.adapters = adapters;
    this.waitHealthyFn = waitHealthyFn;
    this.readiness = readiness;
    this.log = log;
    this.handlesByService = new Map();
    this.auxiliaryHandles = new Set();
    this.phase = 'idle';
  }

  context(serviceId) {
    return { serviceId, plan: this.plan, runtime: this };
  }

  registerHandles(serviceId, handles = []) {
    const existing = this.handlesByService.get(serviceId) ?? new Set();
    for (const handle of handles) existing.add(handle);
    this.handlesByService.set(serviceId, existing);
  }

  registerAuxiliaryHandle(handle) {
    if (handle) this.auxiliaryHandles.add(handle);
  }

  async launchOne(serviceId) {
    const adapter = this.adapters[serviceId];
    const result = await adapter.start(this.context(serviceId));
    this.registerHandles(serviceId, result?.handles ?? []);
  }

  async waitOne(serviceId) {
    const adapter = this.adapters[serviceId];
    if (adapter.lifecycle === 'oneshot') return;
    await this.waitHealthyFn(
      serviceId,
      async () => (await adapter.status(this.context(serviceId))).healthy,
      this.readiness,
    );
  }

  async startOne(serviceId) {
    await this.launchOne(serviceId);
    await this.waitOne(serviceId);
  }

  async stopOne(serviceId, { downDocker = false } = {}) {
    const handles = this.handlesByService.get(serviceId) ?? new Set();
    for (const handle of handles) {
      try {
        handle.kill('SIGTERM');
      } catch (error) {
        this.log('handle.stop_failed', { serviceId, message: error.message });
      }
    }
    this.handlesByService.delete(serviceId);
    await this.adapters[serviceId].stop({
      ...this.context(serviceId),
      downDocker,
    });
  }

  async stopServices(serviceIds, {
    downDocker = false,
    bestEffort = false,
  } = {}) {
    let firstError = null;
    for (const serviceId of serviceIds) {
      try {
        await this.stopOne(serviceId, { downDocker });
      } catch (error) {
        firstError ??= error;
        this.log('service.stop_failed', { serviceId, message: error.message });
        if (!bestEffort) throw error;
      }
    }
    return firstError;
  }

  async stopSelected({ includeDocker = false } = {}) {
    return this.stopServices(this.plan.stopOrder, {
      downDocker: includeDocker,
      bestEffort: false,
    });
  }

  async startSelected() {
    this.phase = 'starting';
    const started = [];
    try {
      await this.stopSelected({ includeDocker: false });
      for (const serviceId of this.plan.startOrder) {
        await this.launchOne(serviceId);
        started.push(serviceId);
        await this.waitOne(serviceId);
      }
      this.phase = 'running';
    } catch (error) {
      await this.stopServices([...started].reverse(), {
        downDocker: false,
        bestEffort: true,
      });
      this.phase = 'idle';
      throw error;
    }
  }
}
```

**验证命令**:

- `node --test skills/agents-launcher/lib/service-runtime.test.mjs`
  预期：exit 0，full trace、failure cleanup 与 timeout case 均通过，`# fail 0`。

## Task 8：用 single-flight operation lock 管理 runtime 事务 [Size: M]

**描述**: 在 runtime 上增加 propagation closure、pending latest-generation map 与共享 operation lock。generation event 到达时只重启下游闭包；级联中再来的更高 generation 排队到当前事务后，失败事件终态 settle；signal close 复用同一锁并只 teardown 一次。

**验收标准**:

- [ ] `agents:g1` 只执行一次 `web stop → web start → web healthy`，不 stop agents。
- [ ] 上游不健康时不动 web；web 重启失败只记录一次 `cascade.failed`，同 generation 不重试，更高 generation 可重新尝试。
- [ ] g1 执行期间到达 g2 时没有并行 adapter 操作，g1 完成后只消费最新 pending generation。
- [ ] close 与 cascade 竞态时等待当前原子段，连续两次 close 复用同一 promise、逆序 teardown 一次。
- [ ] auxiliary CSS watcher 只在 close 时 SIGTERM，不参与 web cascade。

**covers**: [系统.2, 系统.4, 系统.6, 约束.2]

**designCovers**: [Q3, BF4, BF5, LOG-1, PERF-1, TO-6, TO-8, TO-9, TO-10, TO-14]

**设计文档段落**: 「ServiceRuntime 模块」「级联 single-flight」「BF4」「BF5」

**HITL / AFK**: AFK。竞态由 deferred promise 确定性控制。

**UI 设计源**: N/A（无 UI）。

**文件**:（2 个）

- `skills/agents-launcher/lib/service-runtime.mjs`（改）
- `skills/agents-launcher/lib/service-runtime.test.mjs`（改）

**依赖**: Task 6、Task 7

**TDD steps**:

- [ ] Step 1：追加 exact-once、上游 degraded、失败终态、g1/g2 single-flight、close race 与 auxiliary 测试。
- [ ] Step 2：运行测试，确认 cascade/close API 缺失。
- [ ] Step 3：实现 supervisor factory 接线、pending/settled maps、operation lock、cascade drain 与 close。
- [ ] Step 4：运行 runtime + topology + supervisor 三组测试。

**失败测试代码**（追加到 `service-runtime.test.mjs`）:

```js
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function cascadeFixture({ failWebStart = false, upstreamHealthy = true } = {}) {
  const trace = [];
  let webStarts = 0;
  const adapters = fakeAdapters(trace);
  adapters.agents.status = async () => ({
    healthy: upstreamHealthy,
    identity: upstreamHealthy ? 'B' : null,
  });
  adapters.web.start = async () => {
    webStarts += 1;
    trace.push('start:web');
    if (failWebStart && webStarts > 1) throw new Error('web restart failed');
    return { handles: [] };
  };
  const logs = [];
  const runtime = new ServiceRuntime({
    plan: fullPlan,
    adapters,
    waitHealthyFn: async (_label, check) => {
      assert.equal((await check()), true);
    },
    log: (event, data) => logs.push([event, data]),
  });
  return { runtime, trace, logs };
}

test('一个 generation event 对 web 恰好 stop/start 一次', async () => {
  const { runtime, trace, logs } = cascadeFixture();
  await runtime.startSelected();
  trace.length = 0;
  await runtime.requestCascade({
    id: 'agents:g1',
    serviceId: 'agents',
    generation: 1,
    identity: 'B',
  });
  assert.deepEqual(trace, ['stop:web', 'start:web', 'status:web']);
  assert.equal(trace.includes('stop:agents'), false);
  assert.deepEqual(logs.find(([name]) => name === 'cascade.started')[1], {
    eventId: 'agents:g1',
    upstream: 'agents',
    generation: 1,
    targets: ['web'],
  });
  assert.equal(
    typeof logs.find(([name]) => name === 'cascade.completed')[1].durationMs,
    'number',
  );
});

test('同一 in-flight generation 返回同一 cascade promise', async () => {
  const { runtime, trace } = cascadeFixture();
  await runtime.startSelected();
  trace.length = 0;
  const event = {
    id: 'agents:g1',
    serviceId: 'agents',
    generation: 1,
    identity: 'B',
  };
  const first = runtime.requestCascade(event);
  const duplicate = runtime.requestCascade(event);
  assert.equal(first, duplicate);
  await first;
  assert.equal(trace.filter((entry) => entry === 'start:web').length, 1);
});

test('上游未恢复时不停止下游', async () => {
  const { runtime, trace } = cascadeFixture({ upstreamHealthy: false });
  await runtime.startSelected();
  trace.length = 0;
  await runtime.requestCascade({
    id: 'agents:g1',
    serviceId: 'agents',
    generation: 1,
    identity: 'B',
  });
  assert.equal(trace.includes('stop:web'), false);
});

test('失败 generation 终态 settle，相同 generation 不重试', async () => {
  const { runtime, trace, logs } = cascadeFixture({ failWebStart: true });
  await runtime.startSelected();
  trace.length = 0;
  const event = {
    id: 'agents:g1',
    serviceId: 'agents',
    generation: 1,
    identity: 'B',
  };
  await runtime.requestCascade(event);
  await runtime.requestCascade(event);
  assert.equal(trace.filter((entry) => entry === 'stop:web').length, 1);
  assert.equal(logs.filter(([name]) => name === 'cascade.failed').length, 1);
  assert.deepEqual(logs.find(([name]) => name === 'cascade.failed')[1], {
    eventId: 'agents:g1',
    service: 'web',
    stage: 'start',
    error: 'web restart failed',
  });
  assert.equal(trace.includes('stop:agents'), false);
});

test('cascade 期间只串行消费最新 pending generation', async () => {
  const gate = deferred();
  const entered = deferred();
  const { runtime, trace } = cascadeFixture();
  await runtime.startSelected();
  let restartNumber = 0;
  const originalStart = runtime.adapters.web.start;
  runtime.adapters.web.start = async (context) => {
    restartNumber += 1;
    if (restartNumber === 1) {
      entered.resolve();
      await gate.promise;
    }
    return originalStart(context);
  };
  trace.length = 0;
  const g1 = runtime.requestCascade({
    id: 'agents:g1',
    serviceId: 'agents',
    generation: 1,
    identity: 'B',
  });
  await entered.promise;
  const g2 = runtime.requestCascade({
    id: 'agents:g2',
    serviceId: 'agents',
    generation: 2,
    identity: 'C',
  });
  const g3 = runtime.requestCascade({
    id: 'agents:g3',
    serviceId: 'agents',
    generation: 3,
    identity: 'D',
  });
  gate.resolve();
  await Promise.all([g1, g2, g3]);
  assert.equal(trace.filter((entry) => entry === 'stop:web').length, 2);
  assert.equal(trace.filter((entry) => entry === 'start:web').length, 2);
  assert.equal(
    runtime.settledEventsByUpstream.get('agents').generation,
    3,
  );
});

test('close 复用 single-flight 且 auxiliary 只整体停止一次', async () => {
  const gate = deferred();
  const entered = deferred();
  const { runtime } = cascadeFixture();
  await runtime.startSelected();
  const originalStart = runtime.adapters.web.start;
  runtime.adapters.web.start = async (context) => {
    entered.resolve();
    await gate.promise;
    return originalStart(context);
  };
  let auxiliaryStops = 0;
  runtime.registerAuxiliaryHandle({
    kill(signal) {
      assert.equal(signal, 'SIGTERM');
      auxiliaryStops += 1;
    },
  });
  const cascading = runtime.requestCascade({
    id: 'agents:g1',
    serviceId: 'agents',
    generation: 1,
    identity: 'B',
  });
  await entered.promise;
  const first = runtime.close({ downDocker: false });
  const second = runtime.close({ downDocker: false });
  assert.equal(first, second);
  gate.resolve();
  await Promise.all([cascading, first]);
  assert.equal(auxiliaryStops, 1);
  assert.equal(runtime.phase, 'closed');
});

test('传播源 child 的 exit/close 只 nudge 一次 supervisor tick', async () => {
  const { runtime } = cascadeFixture();
  const callbacks = {};
  let ticks = 0;
  runtime.supervisor = { tick: async () => { ticks += 1; } };
  runtime.registerHandles('agents', [{
    once(event, callback) {
      callbacks[event] = callback;
    },
  }]);
  callbacks.exit();
  callbacks.close();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(ticks, 1);
});
```

**最小实现代码**（追加/替换 `ServiceRuntime` 对应方法）:

```js
import { createGenerationSupervisor } from './supervisor.mjs';
import { propagationClosure } from './topology.mjs';

// constructor 追加
this.supervision = supervision;
this.supervisorFactory = supervisorFactory ?? createGenerationSupervisor;
this.supervisor = null;
this.pendingGenerationEvents = new Map();
this.settledEventsByUpstream = new Map();
this.cascadePromise = null;
this.operationTail = Promise.resolve();
this.closePromise = null;
this.now = now;

attachHandleNudge(serviceId, handle) {
  const isPropagationSource = this.plan.propagationEdges.some(
    ({ upstream }) => upstream === serviceId,
  );
  if (!isPropagationSource || typeof handle?.once !== 'function') return;
  let nudged = false;
  const nudge = () => {
    if (nudged) return;
    nudged = true;
    Promise.resolve()
      .then(() => this.supervisor?.tick())
      .catch((error) => {
        this.log('state.nudge_failed', { serviceId, message: error.message });
      });
  };
  handle.once('exit', nudge);
  handle.once('close', nudge);
}

registerHandles(serviceId, handles = []) {
  const existing = this.handlesByService.get(serviceId) ?? new Set();
  for (const handle of handles) {
    if (existing.has(handle)) continue;
    existing.add(handle);
    this.attachHandleNudge(serviceId, handle);
  }
  this.handlesByService.set(serviceId, existing);
}

runExclusive(operation) {
  const execution = this.operationTail.then(operation, operation);
  this.operationTail = execution.catch(() => {});
  return execution;
}

async startSupervisor() {
  if (this.supervisor) return this.supervisor;
  const serviceIds = [...new Set(
    this.plan.propagationEdges.map(({ upstream }) => upstream),
  )];
  if (serviceIds.length === 0) return null;
  this.supervisor = this.supervisorFactory({
    serviceIds,
    adapters: this.adapters,
    supervision: this.supervision,
    onGenerationChanged: (event) => this.requestCascade(event),
    log: this.log,
  });
  await this.supervisor.seed();
  this.supervisor.start();
  return this.supervisor;
}

requestCascade(event) {
  if (this.phase === 'closing' || this.phase === 'closed') {
    return Promise.resolve();
  }
  const settled = this.settledEventsByUpstream.get(event.serviceId);
  const pending = this.pendingGenerationEvents.get(event.serviceId);
  const newestKnown = Math.max(
    settled?.generation ?? -1,
    pending?.generation ?? -1,
  );
  if (event.generation <= newestKnown) {
    return this.cascadePromise ?? Promise.resolve();
  }
  this.pendingGenerationEvents.set(event.serviceId, event);
  if (!this.cascadePromise) {
    this.cascadePromise = this.drainCascades()
      .finally(() => { this.cascadePromise = null; });
  }
  return this.cascadePromise;
}

async drainCascades() {
  while (this.pendingGenerationEvents.size > 0
      && this.phase !== 'closing'
      && this.phase !== 'closed') {
    const [upstream, event] = this.pendingGenerationEvents.entries().next().value;
    this.pendingGenerationEvents.delete(upstream);
    this.settledEventsByUpstream.set(upstream, {
      generation: event.generation,
      status: 'running',
    });
    await this.runExclusive(() => this.runCascade(event));
  }
}

async runCascade(event) {
  const startedAt = this.now();
  const targets = propagationClosure(event.serviceId, this.plan);
  const stopOrder = this.plan.stopOrder.filter((id) => targets.has(id));
  const startOrder = this.plan.startOrder.filter((id) => targets.has(id));
  if (targets.size === 0) {
    this.settledEventsByUpstream.set(event.serviceId, {
      generation: event.generation,
      status: 'completed',
    });
    return;
  }

  this.phase = 'cascading';
  this.log('cascade.started', {
    eventId: event.id,
    upstream: event.serviceId,
    generation: event.generation,
    targets: [...targets],
  });
  const restarted = [];
  let stage = 'upstream_check';
  let failedService = event.serviceId;
  try {
    const upstream = await this.adapters[event.serviceId].status(
      this.context(event.serviceId),
    );
    if (!upstream.healthy) {
      throw new Error(`upstream ${event.serviceId} is not healthy`);
    }
    stage = 'stop';
    for (const serviceId of stopOrder) {
      failedService = serviceId;
      await this.stopOne(serviceId);
    }
    stage = 'start';
    for (const serviceId of startOrder) {
      failedService = serviceId;
      await this.launchOne(serviceId);
      restarted.push(serviceId);
      await this.waitOne(serviceId);
    }

    stage = 'baseline';
    for (const serviceId of startOrder) {
      if (!this.supervisor?.getState(serviceId)) continue;
      failedService = serviceId;
      const observation = await this.adapters[serviceId].status(
        this.context(serviceId),
      );
      this.supervisor.acceptBaseline(serviceId, observation);
    }
    this.settledEventsByUpstream.set(event.serviceId, {
      generation: event.generation,
      status: 'completed',
    });
    this.log('cascade.completed', {
      eventId: event.id,
      targets: [...targets],
      durationMs: this.now() - startedAt,
    });
  } catch (error) {
    await this.stopServices([...restarted].reverse(), {
      downDocker: false,
      bestEffort: true,
    });
    this.settledEventsByUpstream.set(event.serviceId, {
      generation: event.generation,
      status: 'failed',
    });
    this.log('cascade.failed', {
      eventId: event.id,
      service: failedService,
      stage,
      error: error.message,
    });
  } finally {
    if (this.phase !== 'closing') this.phase = 'running';
  }
}

stopAuxiliaryHandles() {
  for (const handle of this.auxiliaryHandles) {
    try {
      handle.kill('SIGTERM');
    } catch (error) {
      this.log('auxiliary.stop_failed', { message: error.message });
    }
  }
  this.auxiliaryHandles.clear();
}

close({ downDocker = false } = {}) {
  if (this.closePromise) return this.closePromise;
  this.phase = 'closing';
  this.pendingGenerationEvents.clear();
  this.closePromise = this.runExclusive(async () => {
    try {
      await this.supervisor?.stop();
    } catch (error) {
      this.log('supervisor.stop_failed', { message: error.message });
    }
    await this.stopServices(this.plan.stopOrder, {
      downDocker,
      bestEffort: true,
    });
    this.stopAuxiliaryHandles();
    this.phase = 'closed';
  });
  return this.closePromise;
}
```

`constructor` 的签名同步扩为以下精确参数，未传时沿用 T7 默认值：

```js
constructor({
  plan,
  adapters,
  supervision,
  supervisorFactory,
  now = Date.now,
  waitHealthyFn = waitHealthy,
  readiness = { tries: 120, intervalMs: 1000 },
  log = () => {},
} = {})
```

`startSelected()` 的 T7 函数体改成以下两个精确方法，避免 close 已进入 closing 后又写回 running：

```js
async startSelectedUnlocked() {
  this.phase = 'starting';
  const started = [];
  try {
    await this.stopSelected({ includeDocker: false });
    for (const serviceId of this.plan.startOrder) {
      await this.launchOne(serviceId);
      started.push(serviceId);
      await this.waitOne(serviceId);
    }
    if (this.phase !== 'closing') this.phase = 'running';
  } catch (error) {
    await this.stopServices([...started].reverse(), {
      downDocker: false,
      bestEffort: true,
    });
    if (this.phase !== 'closing') this.phase = 'idle';
    throw error;
  }
}

startSelected() {
  return this.runExclusive(() => this.startSelectedUnlocked());
}
```

**验证命令**:

- `node --test skills/agents-launcher/lib/service-runtime.test.mjs skills/agents-launcher/lib/supervisor.test.mjs skills/agents-launcher/lib/topology.test.mjs`
  预期：exit 0，cascade/close 竞态 case 全绿，`# fail 0`。

## ✅ Checkpoint C5：覆盖 Task 7-8

**触发原因**: Task 8 命中风险信号 #5（generation queue、cascade、startup 与 signal close 共用异步 operation lock）。

**全部测试**:

- `node --test skills/agents-launcher/lib/service-runtime.test.mjs skills/agents-launcher/lib/supervisor.test.mjs skills/agents-launcher/lib/topology.test.mjs skills/agents-launcher/lib/service-adapters.test.mjs`
  预期：`# fail 0`。

**Build**:

- `node --check skills/agents-launcher/lib/service-runtime.mjs`
  预期：exit 0，无输出。

**用户 Review**:

- [ ] 演示 `agents:g1` 的 trace 只有 `web stop/start/status`。
- [ ] 演示 web restart failure 后相同 g1 不重试、g2 可再次尝试。
- [ ] 演示 close 与级联没有重叠 adapter 操作。
- [ ] 用户确认继续、调整或回滚。

**Rollback 点**: 可回滚到 C4；supervisor 可产生事件，但尚未接管真实 service 生命周期。

## Task 9：原子切换 orchestrator 到 plan/runtime [Size: M]

**描述**: 把 `dev-orchestrator.mjs` 的硬编码 kill/start/teardown 主体替换为 `load → parse → plan → preflight → adapters → runtime`。`--status` 仍输出固定五行，`--stop` 走 plan.stopOrder 且不 down Docker，CSS watcher 只注册一个 auxiliary handle；入口改成可注入的 `runLauncher()` 与直接执行 guard。

**验收标准**:

- [ ] config/schema/reference/DAG 全部成功前，不调用 validate/write/kill/start。
- [ ] live `ui/full` 只通过 `ServiceRuntime.startSelected/startSupervisor` 触发 service 生命周期，不保留硬编码 Step 1/2/3。
- [ ] `--status` 仍输出 web/agents/server/pg/minio 五行；`--stop` 不启动 supervisor 且传 `includeDocker:false`。
- [ ] `--dry-run` 在 repo validation、writeEnv、ensureCss、adapter/runtime 创建前返回。
- [ ] `--css-watch` 只 spawn 一次并登记为 auxiliary；signal 与 startup failure 都 await `runtime.close()`。
- [ ] 日志只输出 topology/version/service IDs/order/eventId/error message，不输出 env 或 YAML 全文。

**covers**: [系统.1, 系统.2, 系统.3, 系统.4, 系统.5, 系统.6, 约束.1, 约束.2, 约束.3, 约束.4]

**designCovers**: [BF2, BF3, BF5, CONTRACT-4, LOG-1, MIG-1, GATE-1, TO-11, TO-12]

**设计文档段落**: 「模块架构」「BF1-BF5」「兼容、迁移与发布 / 原子切换」「基础日志设计 LOG-1」

**HITL / AFK**: AFK 实现与 fake 集成测试；真实服务 smoke 明确留到 Verify，并在执行前向用户申请允许。

**UI 设计源**: N/A（无 UI）。

**文件**:（2 个）

- `skills/agents-launcher/dev-orchestrator.mjs`（改）
- `skills/agents-launcher/dev-orchestrator.test.mjs`（改）

**依赖**: Task 4、Task 7、Task 8

**TDD steps**:

- [ ] Step 1：追加 config-before-preflight、live runtime delegation、stop/status、dry-run zero-side-effect 与 CSS auxiliary 测试。
- [ ] Step 2：运行测试，确认旧 top-level 入口无法注入且仍直接执行硬编码 lifecycle。
- [ ] Step 3：实现 `prepareLaunch`、`runPreflight`、`installSignalHandlers`、`runLauncher` 与 main guard，删除 `killCommands/children/teardown` 和硬编码启动步骤。
- [ ] Step 4：运行 orchestrator、runtime 与全部既有 launcher 测试。

**失败测试代码**（追加到 `dev-orchestrator.test.mjs`）:

```js
import {
  installSignalHandlers,
  runLauncher,
} from './dev-orchestrator.mjs';

const config = {
  schema_version: 1,
  supervision: {
    interval_ms: 1000,
    stable_successes: 2,
    failure_threshold: 2,
  },
  workspaces: { ui: ['agents', 'web'] },
  services: {
    agents: {
      adapter: 'agents',
      lifecycle: 'service',
      depends_on: {},
    },
    web: {
      adapter: 'web',
      lifecycle: 'service',
      depends_on: {
        agents: {
          condition: 'service_healthy',
          required: false,
          propagate_restart: true,
        },
      },
    },
  },
};

function injectedRun({ argv = ['--workspace=ui', '--yes'] } = {}) {
  const calls = [];
  const runtime = {
    phase: 'idle',
    registerAuxiliaryHandle: (handle) => calls.push(['aux', handle]),
    stopSelected: async (options) => calls.push(['stopSelected', options]),
    startSelected: async () => { runtime.phase = 'running'; calls.push(['startSelected']); },
    startSupervisor: async () => calls.push(['startSupervisor']),
    close: async (options) => calls.push(['close', options]),
  };
  const deps = {
    loadLauncherConfig: () => {
      calls.push(['loadConfig']);
      return { config, sourcePath: '/plugin/agents-launcher.yml' };
    },
    resolveRepos: () => ({
      AGENTS_DIR: '/agents',
      WEB_DIR: '/web',
      SERVER_DIR: '/server',
      sources: {
        AGENTS_DIR: 'env',
        WEB_DIR: 'env',
        SERVER_DIR: 'env',
      },
    }),
    validateRepos: () => calls.push(['validateRepos']),
    existsSync: () => true,
    createServiceAdapters: () => {
      calls.push(['createAdapters']);
      return {};
    },
    createRuntime: () => runtime,
    agentsApi: {
      configPath: () => '/agents/config.yaml',
      ensureCss: async () => calls.push(['ensureCss']),
    },
    webApi: {
      writeEnv: () => calls.push(['writeEnv']),
    },
    serverApi: {
      validatePreparedDockerScript: () => '/tmp/docker-start.sh',
    },
    tcpOpen: async () => true,
    httpOk: async () => true,
    pidOnPort: () => '1',
    spawnPrefixed: () => ({ pid: 88 }),
    confirm: async () => true,
    installSignals: () => calls.push(['installSignals']),
    log: () => {},
  };
  return {
    calls,
    runtime,
    result: runLauncher({
      argv,
      env: {},
      toolDir: '/plugin',
      deps,
    }),
  };
}

test('合法 topology 在所有 imperative preflight 前加载', async () => {
  const run = injectedRun();
  await run.result;
  assert.deepEqual(run.calls.slice(0, 4), [
    ['loadConfig'],
    ['validateRepos'],
    ['writeEnv'],
    ['ensureCss'],
  ]);
  assert.deepEqual(run.calls.slice(-3), [
    ['installSignals'],
    ['startSelected'],
    ['startSupervisor'],
  ]);
});

test('topology 失败时不进入 repo/preflight/runtime', async () => {
  const calls = [];
  await assert.rejects(
    () => runLauncher({
      argv: ['--workspace=ui', '--yes'],
      toolDir: '/plugin',
      deps: {
        loadLauncherConfig: () => {
          calls.push(['loadConfig']);
          throw new Error('[topology] dependency cycle detected');
        },
        resolveRepos: () => {
          calls.push(['resolveRepos']);
          return {};
        },
        createServiceAdapters: () => {
          calls.push(['createAdapters']);
          return {};
        },
        log: () => {},
      },
    }),
    /\[topology\] dependency cycle/,
  );
  assert.deepEqual(calls, [['loadConfig']]);
});

test('--dry-run 在任何 preflight/adapter/runtime 副作用前返回', async () => {
  const run = injectedRun({
    argv: ['--workspace=ui', '--dry-run', '--yes'],
  });
  await run.result;
  assert.deepEqual(run.calls, [['loadConfig']]);
});

test('--stop 只按 plan stop，不 down Docker、不起 supervisor', async () => {
  const run = injectedRun({
    argv: ['--workspace=ui', '--stop', '--yes'],
  });
  await run.result;
  assert.deepEqual(run.calls, [
    ['loadConfig'],
    ['createAdapters'],
    ['stopSelected', { includeDocker: false }],
  ]);
});

test('--status 保留五行固定视图且不创建 runtime', async () => {
  const lines = [];
  await runLauncher({
    argv: ['--workspace=ui', '--status'],
    toolDir: '/plugin',
    deps: {
      loadLauncherConfig: () => ({
        config,
        sourcePath: '/plugin/agents-launcher.yml',
      }),
      tcpOpen: async () => true,
      httpOk: async () => true,
      pidOnPort: () => '42',
      createServiceAdapters: () => {
        throw new Error('status 不应创建 adapters');
      },
      log: (line) => lines.push(line),
    },
  });
  const statusLines = lines.filter((line) => line.startsWith('[status]'));
  assert.equal(lines.length, 5);
  assert.equal(statusLines.length, 5);
  assert.deepEqual(
    statusLines.map((line) => line.match(/^\[status\] (\w+)/)[1]),
    ['web', 'agents', 'server', 'pg', 'minio'],
  );
});

test('--css-watch 只登记一个 auxiliary handle', async () => {
  const run = injectedRun({
    argv: ['--workspace=ui', '--css-watch', '--yes'],
  });
  await run.result;
  assert.equal(run.calls.filter(([name]) => name === 'aux').length, 1);
});

test('--no-web 时 css-watch 不创建 auxiliary', async () => {
  const run = injectedRun({
    argv: ['--workspace=ui', '--no-web', '--css-watch', '--yes'],
  });
  await run.result;
  assert.equal(run.calls.filter(([name]) => name === 'aux').length, 0);
});

test('重复 signal 复用同一个 runtime.close promise', async () => {
  let resolveClose;
  let closeCalls = 0;
  const closePromise = new Promise((resolve) => { resolveClose = resolve; });
  const exits = [];
  const handlers = {};
  const shutdown = installSignalHandlers({
    runtime: {
      close: async () => {
        closeCalls += 1;
        await closePromise;
      },
    },
    downDocker: false,
    processLike: {
      once: (signal, handler) => { handlers[signal] = handler; },
      exit: (code) => exits.push(code),
    },
    log: () => {},
  });
  assert.equal(typeof handlers.SIGINT, 'function');
  assert.equal(typeof handlers.SIGTERM, 'function');
  const first = shutdown('SIGINT');
  const second = shutdown('SIGTERM');
  assert.equal(first, second);
  resolveClose();
  await first;
  assert.equal(closeCalls, 1);
  assert.deepEqual(exits, [0]);
});
```

**最小实现代码**（`dev-orchestrator.mjs` 的新入口骨架）:

```js
#!/usr/bin/env node
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from './lib/cli.mjs';
import { loadLauncherConfig } from './lib/launcher-config.mjs';
import { resolveRepos, validateRepos } from './lib/paths.mjs';
import { PORTS } from './lib/ports.mjs';
import { httpOk, pidOnPort, tcpOpen } from './lib/probe.mjs';
import { spawnPrefixed } from './lib/proc.mjs';
import {
  ADAPTER_CAPABILITIES,
  ADAPTER_NAMES,
  createServiceAdapters,
} from './lib/service-adapters.mjs';
import { ServiceRuntime } from './lib/service-runtime.mjs';
import {
  buildServicePlan,
  topologyCatalog,
} from './lib/topology.mjs';
import * as agentsCli from './agents-cli.mjs';
import * as serverCli from './server-cli.mjs';
import * as webCli from './web-cli.mjs';

const defaultToolDir = dirname(fileURLToPath(import.meta.url));

function identityAdapterNames() {
  return Object.entries(ADAPTER_CAPABILITIES)
    .filter(([, capability]) => capability.supportsIdentity)
    .map(([adapterName]) => adapterName);
}

export function prepareLaunch({
  argv,
  toolDir,
  loadConfig = loadLauncherConfig,
} = {}) {
  const { config, sourcePath } = loadConfig({
    path: join(toolDir, 'agents-launcher.yml'),
    adapterNames: ADAPTER_NAMES,
    identityAdapterNames: identityAdapterNames(),
  });
  const args = parseArgs(argv, topologyCatalog(config));
  const plan = buildServicePlan(config, args);
  return { args, config, plan, sourcePath };
}

async function askConfirmation(question) {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = (await readline.question(question)).trim().toLowerCase();
    return answer === 'y' || answer === 'yes';
  } finally {
    readline.close();
  }
}

async function printStatus({ log, probes, ports }) {
  const rows = [
    ['web', ports.web, await probes.tcpOpen(ports.web)],
    ['agents', ports.agents, await probes.httpOk(`http://127.0.0.1:${ports.agents}/health`)],
    ['server', ports.server, await probes.tcpOpen(ports.server)],
    ['pg', 5432, await probes.tcpOpen(5432)],
    ['minio', 9000, await probes.tcpOpen(9000)],
  ];
  for (const [name, port, healthy] of rows) {
    const pid = healthy ? probes.pidOnPort(port) || '-' : '-';
    log(`[status] ${name.padEnd(6)} :${String(port).padEnd(5)} ${healthy ? 'UP  ' : 'DOWN'} pid=${pid}`);
  }
}

async function runPreflight({
  args,
  plan,
  repos,
  env,
  deps,
}) {
  const selected = new Set(plan.selected);
  const need = ['AGENTS_DIR'];
  if (selected.has('web')) need.push('WEB_DIR');
  if (selected.has('server') || selected.has('docker')) need.push('SERVER_DIR');
  deps.validateRepos(repos, { need });

  if (selected.has('agents')) {
    const configPath = deps.agentsApi.configPath(repos.AGENTS_DIR);
    if (!deps.existsSync(configPath)) {
      throw new Error(
        `agents config.yaml 不存在: ${configPath}\n`
        + '请先复制 packages/server/conf/config.example.yaml 为 config.yaml 并填写 pg/minio/LLM',
      );
    }
  }

  let dockerScriptPath = env.FX_DOCKER_START_SCRIPT;
  if (selected.has('docker')) {
    dockerScriptPath = deps.serverApi.validatePreparedDockerScript({
      scriptPath: dockerScriptPath,
    });
  }

  const relevant = [
    'AGENTS_DIR',
    ...(selected.has('web') ? ['WEB_DIR'] : []),
    ...(selected.has('server') || selected.has('docker') ? ['SERVER_DIR'] : []),
  ];
  const hasAuto = relevant.some((key) => repos.sources[key] === 'auto');
  if (!args.yes && hasAuto) {
    const confirmed = await deps.confirm(
      '[debug] 以上路径含自动解析项（[auto]）。确认按此继续? (y/N) ',
    );
    if (!confirmed) return { cancelled: true, dockerScriptPath };
  }

  if (selected.has('web')) {
    deps.webApi.writeEnv({
      webDir: repos.WEB_DIR,
      agentsDir: repos.AGENTS_DIR,
      ports: PORTS,
    });
    await deps.agentsApi.ensureCss({ agentsDir: repos.AGENTS_DIR });
  }

  if (selected.has('agents') && !selected.has('docker')) {
    const [pgUp, minioUp] = await Promise.all([
      deps.tcpOpen(5432),
      deps.tcpOpen(9000),
    ]);
    if (!pgUp || !minioUp) {
      throw new Error(
        `agents 依赖的中间件未就绪: pg5432=${pgUp ? 'UP' : 'DOWN'} minio9000=${minioUp ? 'UP' : 'DOWN'}`,
      );
    }
  }
  return { cancelled: false, dockerScriptPath };
}

export function installSignalHandlers({
  runtime,
  downDocker,
  processLike = process,
  log = console.log,
} = {}) {
  let shutdownPromise = null;
  const shutdown = (signal) => {
    if (!shutdownPromise) {
      log(`[debug] 收到 ${signal}，清理中`);
      shutdownPromise = runtime.close({ downDocker })
        .finally(() => processLike.exit(0));
    }
    return shutdownPromise;
  };
  processLike.once('SIGINT', () => { void shutdown('SIGINT'); });
  processLike.once('SIGTERM', () => { void shutdown('SIGTERM'); });
  return shutdown;
}

export async function runLauncher({
  argv = process.argv.slice(2),
  env = process.env,
  toolDir = defaultToolDir,
  deps: overrides = {},
} = {}) {
  const deps = {
    loadLauncherConfig,
    resolveRepos,
    validateRepos,
    existsSync,
    createServiceAdapters,
    createRuntime: (options) => new ServiceRuntime(options),
    agentsApi: agentsCli,
    serverApi: serverCli,
    webApi: webCli,
    tcpOpen,
    httpOk,
    pidOnPort,
    spawnPrefixed,
    confirm: askConfirmation,
    installSignals: installSignalHandlers,
    log: console.log,
    ...overrides,
  };
  const launch = prepareLaunch({
    argv,
    toolDir,
    loadConfig: deps.loadLauncherConfig,
  });
  const { args, config, plan, sourcePath } = launch;
  const emit = (event, payload) => {
    deps.log(`[${event}] ${JSON.stringify(payload)}`);
  };

  if (args.status) {
    await printStatus({
      log: deps.log,
      probes: deps,
      ports: PORTS,
    });
    return { mode: 'status', ...launch };
  }
  emit('topology.loaded', {
    sourcePath,
    schemaVersion: config.schema_version,
    workspace: plan.workspace,
    selected: plan.selected,
  });
  emit('plan.created', {
    startOrder: plan.startOrder,
    stopOrder: plan.stopOrder,
    omittedOptionalDependencies: plan.omittedOptionalDependencies,
    propagationEdges: plan.propagationEdges,
  });
  if (args.dryRun) {
    deps.log('[debug] dry-run 结束，未写配置、未停止或启动任何进程');
    return { mode: 'dry-run', ...launch };
  }

  const repos = deps.resolveRepos({ toolDir, env });
  if (args.stop) {
    const adapters = deps.createServiceAdapters({
      repos,
      ports: PORTS,
      services: {
        agents: deps.agentsApi,
        server: deps.serverApi,
        web: deps.webApi,
      },
      io: deps,
    });
    const runtime = deps.createRuntime({
      plan,
      adapters,
      supervision: config.supervision,
      log: emit,
    });
    await runtime.stopSelected({ includeDocker: false });
    deps.log('[stop] 完成（docker 未动，需要停 docker 请显式 docker compose down）');
    return { mode: 'stop', runtime, repos, ...launch };
  }

  deps.log(`[debug] AGENTS=${repos.AGENTS_DIR} [${repos.sources.AGENTS_DIR}]`);
  deps.log(`[debug] WEB=${repos.WEB_DIR} [${repos.sources.WEB_DIR}]`);
  deps.log(`[debug] SERVER=${repos.SERVER_DIR} [${repos.sources.SERVER_DIR}]`);
  const preflight = await runPreflight({
    args,
    plan,
    repos,
    env,
    deps,
  });
  if (preflight.cancelled) {
    deps.log('[debug] 已取消。可用 FX_AGENTS_DIR / FX_WEB_DIR / FX_SERVER_DIR 显式指定，或加 --yes 跳过确认。');
    return { mode: 'cancelled', repos, ...launch };
  }

  const adapters = deps.createServiceAdapters({
    repos,
    ports: PORTS,
    options: { dockerScriptPath: preflight.dockerScriptPath },
    services: {
      agents: deps.agentsApi,
      server: deps.serverApi,
      web: deps.webApi,
    },
    io: deps,
  });
  const runtime = deps.createRuntime({
    plan,
    adapters,
    supervision: config.supervision,
    log: emit,
  });

  if (args.cssWatch && plan.selected.includes('web')) {
    runtime.registerAuxiliaryHandle(deps.spawnPrefixed(
      'css',
      'pnpm',
      ['build:css:watch'],
      { cwd: repos.AGENTS_DIR },
    ));
  }
  deps.installSignals({
    runtime,
    downDocker: args.dockerDownOnExit,
    log: deps.log,
  });

  try {
    await runtime.startSelected();
    if (runtime.phase === 'running') await runtime.startSupervisor();
  } catch (error) {
    await runtime.close({ downDocker: false });
    throw error;
  }
  if (plan.selected.includes('web')) {
    deps.log(`\n[debug] ✅ 就绪 → http://localhost:${PORTS.web}/decision/home\n`);
  }
  return { mode: 'running', runtime, repos, ...launch };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  runLauncher().catch((error) => {
    console.error(`[debug] 失败: ${error.message}`);
    process.exitCode = 1;
  });
}
```

**验证命令**:

- `node --test skills/agents-launcher/dev-orchestrator.test.mjs skills/agents-launcher/lib/service-runtime.test.mjs`
  预期：exit 0，`# fail 0`。
- `node --test 'skills/agents-launcher/lib/*.test.mjs' 'skills/agents-launcher/*.test.mjs'`
  预期：全部 launcher suite 通过，`# fail 0`；真实环境限定 case 可保持 skip。

## ✅ Checkpoint C6：覆盖 Task 9

**触发原因**: Task 9 命中风险信号 #7（直接 CLI、status/stop、live startup、signal 与测试共用同一入口契约）。

**全部测试**:

- `node --test 'skills/agents-launcher/lib/*.test.mjs' 'skills/agents-launcher/*.test.mjs'`
  预期：全部 launcher suite `# fail 0`。
- `node --test 'hooks/*.test.mjs'`
  预期：hook 回归 `# fail 0`。

**Build**:

- `node scripts/package.platform.mjs`
  预期：claude、codex、qoder 各输出一行 `generated`，exit 0；把 YAML、runtime 与 vendored parser 同步到三平台生成物。
- `node scripts/package.platform.mjs --check`
  预期：exit 0，无 drift 输出。
- `node scripts/vendor-sync.mjs --check`
  预期：末行 `vendor-sync --check: 一致`。
- `git diff --exit-code -- plugin/metadata.json`
  预期：exit 0，证明本次未自动升级 `0.10.0`。

**用户 Review**:

- [ ] 展示 `--dry-run` 的 YAML source、selected/start/stop/propagation。
- [ ] 展示 fake live trace 只经过 runtime；CSS watcher 只登记一次。
- [ ] 展示三平台生成物均包含 `agents-launcher.yml`、五个 runtime/config 模块与 `vendor/yaml`。
- [ ] 用户确认进入 Verify，真实 smoke 另行授权。

**Rollback 点**: 可回滚到 C5；旧 orchestrator 尚可从 git 恢复，所有新模块均为独立新增。

## Round 1 骨架自查

| 自查项 | 判断 | 依据与已落实修正 |
|---|---|---|
| 切片形态 | 通过 | 每个 task 都以可运行契约收口：loader、plan、adapter、argv projection、observation、polling、initial lifecycle、cascade、CLI entry；没有“先建空框架”task。 |
| 依赖完整性 | 通过 | loader 先于 topology；topology/adapter 先于 runtime；state machine 先于 supervisor；supervisor + runtime 先于 orchestrator。T7 不强依赖 T6，T8 才汇合两条线。 |
| Risk-first | 通过 | 外部 YAML 安全边界排第一，竞态状态机排在真实进程接线前；真实 orchestrator 是最后一个原子切换点。 |
| 粒度 | 通过 | 每项 2 个手写文件为主，最多 5 个路径工件；每项只有一个红绿循环。T1 的上游 browser subtree 是不可拆的机械工件，未混入第二个业务动作。 |
| 覆盖 | 通过 | 系统.1-系统.6、约束.1-约束.4、SC-1 至 SC-5 和所有 required Registry ID 均映射到 task；三项 verify-only 有独立取证方法。 |

成立并已修正的质疑：

1. **如果先改 `parseArgs`，旧 orchestrator 会立即坏掉。** T4 同一 task 建立 `plan.selected → args.services` 临时投影，T9 再原子删除。
2. **如果 runtime 在 adapter 前实现，会复制现有 service 知识。** T3 先固定 adapter 委托，T7 只依赖统一契约。
3. **如果把 timer 和 generation transition 一次写完，失败很难定位。** 拆为 T5 纯状态与 T6 可注入轮询，并在 T6 后设置并发 checkpoint。
4. **如果 CSS watcher 作为 web handle，级联会重复拉起。** T8/T9 明确 auxiliary 集合，只在整体 close 清理。
5. **如果把打包做成独立 task，会变成非 tracer 的整体收尾。** 三平台生成和 vendor check 留在最终 checkpoint/Verify，不伪装为业务 slice。

## Checkpoint 分布审计

| 风险/间隔 | 紧随 checkpoint | 结果 |
|---|---|---|
| T1 外部输入 #1 | C1 | 通过 |
| T2 外部输入 #1 | C2 | 通过 |
| T3-T4 完成 YAML 到旧入口迁移 | C3 | 通过；未出现连续 3 task 无 checkpoint |
| T6 并发/竞态 #5 | C4 | 通过 |
| T8 并发/竞态 #5 | C5 | 通过 |
| T9 跨入口契约 #7 | C6 | 通过 |

## 测试目标分配

| Slice | 测试目标 |
|---|---|
| T1 安全 YAML loader | TO-1、TO-15 |
| T2 topology plan | TO-2、TO-3、TO-4、TO-9 |
| T3 adapters | TO-11、TO-15 |
| T4 CLI projection/dry-run | TO-3、TO-12 |
| T5 generation transition | TO-5、TO-6、TO-7、TO-8 |
| T6 polling discipline | TO-5、TO-6、TO-7、TO-8、TO-14 |
| T7 initial lifecycle | TO-4、TO-10、TO-11 |
| T8 cascade/close | TO-6、TO-8、TO-9、TO-10、TO-14 |
| T9 orchestrator integration | TO-11、TO-12 |
| Verify 汇总 | TO-13、TO-16、TO-17 |

## SC → Task 覆盖

| Success Criteria | 覆盖 task | 判定证据 |
|---|---|---|
| SC-1 workspace/`--no-*` 兼容 | T2、T4、T9 | 精确 selected/startOrder 断言 + dry-run |
| SC-2 拓扑启动/readiness | T2、T7、T9 | Kahn 顺序 + fake adapter trace |
| SC-3 agents 新稳定实例后 web 恰好重启一次 | T5、T6、T8、T9 | observation sequence + exact-once cascade trace |
| SC-4 配置错误在副作用前失败 | T1、T2、T4、T9 | 拒绝矩阵 + call-order/zero-side-effect 断言 |
| SC-5 per-service 知识不进 YAML | T1、T3、T7、T9 | exact schema 拒绝 command + CLI delegation spy |

## 路径 → Task 覆盖

| 路径/约束 | 覆盖 task |
|---|---|
| 系统.1 | T2、T3、T4、T7、T9 |
| 系统.2 | T2、T3、T4、T7、T8、T9 |
| 系统.3 | T2、T4、T9 |
| 系统.4 | T2、T3、T5、T6、T8、T9 |
| 系统.5 | T1、T2、T4、T7、T9 |
| 系统.6 | T5、T6、T8、T9 |
| 约束.1 | T1、T9 |
| 约束.2 | T3、T4、T7、T8、T9 |
| 约束.3 | T1、T2、T3、T9 |
| 约束.4 | T9 + C6 三平台生成检查 |

## Design → Task Coverage Matrix

### required

| Design Registry ID | 覆盖 task |
|---|---|
| Q1 | T1、T2 |
| Q2 | T2、T3 |
| Q3 | T5、T6、T8 |
| BF1 | T1、T2 |
| BF2 | T2、T4、T9 |
| BF3 | T3、T7、T9 |
| BF4 | T5、T6、T8 |
| BF5 | T7、T8、T9 |
| CONTRACT-1 | T1、T2 |
| CONTRACT-2 | T2、T4 |
| CONTRACT-3 | T3、T7 |
| CONTRACT-4 | T4、T9 |
| LOG-1 | T4、T5、T6、T8、T9 |
| SEC-1 | T1、T2、T3 |
| PERF-1 | T2、T6、T8 |
| MIG-1 | T4、T9 |
| GATE-1 | T4、T9 |
| TO-1 | T1 |
| TO-2 | T2 |
| TO-3 | T2、T4 |
| TO-4 | T2、T7 |
| TO-5 | T5、T6 |
| TO-6 | T5、T6、T8 |
| TO-7 | T5、T6 |
| TO-8 | T5、T6、T8 |
| TO-9 | T2、T8 |
| TO-10 | T7、T8 |
| TO-11 | T3、T7、T9 |
| TO-12 | T4、T9 |
| TO-14 | T6、T8 |
| TO-15 | T1、T3 |

结论：31 个 required ID 全部至少由一个 task 承接；task 未引用 Registry 外 ID。

### verify-only

| Design Registry ID | Verify 取证方法 |
|---|---|
| TO-13 | 运行全部 agents-launcher suite；人工比对 `--status` 五行与 `--stop` Docker no-op 输出。 |
| TO-16 | 获用户授权后启动真实 `agents + web`，记录变更前后 `:8070/:10001` PID、唯一 cascade eventId 与最终健康结果。 |
| TO-17 | 检查三平台生成树均含 YAML/modules/vendor，运行 `package.platform.mjs --check`。 |

Design Registry 没有 deferred 或 n/a 项，无需用户补充状态确认。

## Round 2 Checklist 与跨 task 一致性自查

### Checklist

| 检查项 | 结论 | 证据 |
|---|---|---|
| API 签名/import 路径 | 通过 | 所有相对 import 均按 `skills/agents-launcher/lib` 到现有 CLI/`probe`/`proc` 的真实层级书写；测试使用仓库现有 Node ESM 风格。 |
| 边界/异常测试 | 通过 | loader 有拒绝矩阵；topology 有 optional/required/ref/cycle；supervisor 有抖动/identity/100 ticks；runtime 有 failure/single-flight/close。 |
| BF/契约一致性 | 通过 | loader 不执行命令，topology 为纯函数，adapter 唯一持有 CLI 翻译，runtime 不知道命令/端口，orchestrator 保留 preflight。 |
| 废弃接口 | 通过 | T4 删除 `WORKSPACES`，T9 删除 `args.services` 兼容投影和旧 `killCommands/children/teardown`；最终态无双读 fallback。 |
| 测试替身 | 通过 | 状态机直接输入 observation；timer/probe/adapter/runtime 用 fake 或 deferred，不 mock 私有实现细节。 |
| secret/log | 通过 | 日志对象只含 source path、service IDs/order、generation/eventId 和 error message；没有 env/config 序列化。 |

### 跨 task 一致性

1. **Loader → topology**：T1 返回可变前的 normalized object；T2 在 deep-freeze 前做完整引用/DAG/capability 校验，后续消费者拿到的始终是 ValidatedConfig。
2. **Topology → CLI/runtime**：T4 与 T9 都调用同一个 `buildServicePlan`；T4 的 `args.services` 只是过渡投影，T9 删除，不成为第二事实源。
3. **Adapter → runtime**：adapter 的 `lifecycle/start/stop/status` 与 T7 调用签名一致；Docker down 只通过 `stop({ downDocker:true })` 可达。
4. **Supervisor → runtime**：T6 callback 允许继续采样而不 await cascade；T8 pending map 与 operation lock 接管串行化，因此不会丢失更高 generation。
5. **Runtime → orchestrator**：T9 在 `startSelected()` 成功且 phase 仍为 running 时才 seed/start supervisor；signal close 使用相同 operation lock。
6. **源码 → 发布物**：C6 只从源码运行 packager，不手改 `plugins/*/nocode`；版本保持用户当前决定的 `0.10.0`。

成立并已落实的修正：

- `web.status()` 的 probe 注入必须带默认 `tcpOpen`，否则 production registry 会把 `undefined` 传给现有 CLI；T3 最终代码使用 `io.tcpOpen ?? tcpOpen`。
- `startSelected()` 在 close 已把 phase 设为 closing 时不得重新写回 running；T8 抽取后的 `startSelectedUnlocked()` 使用条件赋值。
- start failure cleanup 断言只截取最后一次 `start:server` 后的 trace，避免把启动前的正常 stop 与失败清理混算。
- `launcher-config` 的 Task 2 改动只增加 `identityAdapterNames` 参数与 `validateTopology` 调用，保留 T1 的读取/parser 错误包装。

## 非 task 的汇总验证

这些动作跨越全部切片，不作为 tracer task，交给 `nocode:dev-verify`：

1. 运行完整 agents-launcher、hook 与相关 packaging suite。
2. `vendor-sync --check`、三平台生成、`package.platform --check`、`git diff --check`。
3. 检查生成物没有 `*.test.mjs`，但包含 YAML、NOTICE/LICENSE 与全部运行时模块。
4. 审查 YAML 没有 command/module/env/ports，日志没有 secret。
5. 获用户单独允许后做 TO-16 真实 smoke；未授权时明确记为未取证，不用 fake 结果冒充。
6. 完成 Verify/Review 后统一复核 `git status` / `git diff`，按仓库历史风格创建一个 commit；不自动 push，commit 后询问用户是否 `git push`。

## 不测项与剩余风险

| 项目 | 原因 | 处理 |
|---|---|---|
| PID 在极短窗口内被 OS 复用 | 首版 identity 已由 approved Design 固定为 listener PID | 保留 Design 的已接受残余风险；后续若真实误判再扩为 `pid + start time`。 |
| 真实 `tsx watch` + Vite 进程级联 | 会停止/重启用户本机服务 | TO-16 在 Verify 前单独获取允许。 |
| Docker 容器真实启动/down | 依赖用户本机 Docker 与 Agent 生成脚本 | adapter 单测验证委托与 no-op；真实环境沿既有 launcher smoke。 |
| 热加载 YAML | approved Design 明确 Out of Scope | 配置只在显式启动/restart 时读取。 |

## Plan Validation

- [x] 依赖图无环，底层接口先于消费者。
- [x] 9 个 task 均满足 ≤5 路径工件、单一逻辑动作、一个短 TDD 红绿循环。
- [x] 每个 task 有 `covers`、`designCovers`、HITL/AFK、真实测试/实现与带预期的验证命令。
- [x] 连续 3 个 task 内必有 checkpoint；外部输入与并发风险 task 后立即 checkpoint。
- [x] SC、路径/约束与 required Design Registry 均零 orphan。
- [x] TO-13、TO-16、TO-17 明确为 verify-only 且有取证方法。
- [x] API/import、异常边界、跨 task 假设与废弃接口已复核。
- [x] 用户确认本计划。
- [x] 用户选择 `Execution: executing`。
- [x] 用户拍板进入 Build。

## Build 硬交接输入

Plan 确认并写回 `Execution` 后，交给 `nocode:dev-build`：

- **request**: 优化 agents-launcher，用 Compose-like YAML 统一启动/重启；agents 新稳定实例触发 web 单次重启。
- **stage**: Build。
- **restate**: 本文「Restate 路径 ID 归一化」+ SC-1 至 SC-5。
- **artifacts**: approved Design + 本 Plan。
- **constraints**: 不改版本号；手写源码与三平台生成物同 commit；不手改生成物；真实 smoke 需用户授权；完成后 commit、不 push。
- **first slice**: Task 1，安全加载一份窄 YAML 配置。
- **execution**: `executing`。
