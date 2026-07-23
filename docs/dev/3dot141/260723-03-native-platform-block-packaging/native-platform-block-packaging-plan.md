# Native Platform Packaging Implementation Plan

**Goal**: 用源码内明文 Claude/Codex 平台块和机械静态打包，完整替代 Capability/profile/provider/using-nocode 运行时抽象。
**Architecture**: 共享 Markdown 只在原生工具调用处包含相邻平台块；`package.platform.mjs` 校验并过滤平台块、合并显式 overlay、生成 manifest/policy 和确定性发布树。业务 Skill 直接使用各平台原生工具与句柄，旧 domain registry、workflow receipt/state 和 provider 路由仅在全部消费者迁移后删除。
**Tech Stack**: Node.js ESM、`node:test`、Markdown、JSON、Claude Code/Codex 原生工具说明。
**Design Doc**: `docs/dev/3dot141/260723-03-native-platform-block-packaging/native-platform-block-packaging-design.md`
**Test Objectives**: 平台块解析失败可定位；双端原生语法互斥；生成树确定且兼容 `umask=077`；Hook、workflow、Open Design、personal knowledge 和 worktree 代表路径回归；源码和发布物无旧运行时语义。
**Execution**: executing

## Restate 与边界

路径 ID：

- `P1`：Markdown 平台块解析、过滤与错误定位。
- `P2`：静态 allowlist、overlay、manifest/policy、文件模式和 drift check。
- `P3`：workflow 原生操作（Skill、plan、decision、agent 生命周期）。
- `P4`：profile、agent prompt 与全局语义搜索规则。
- `P5`：workspace、design、personal knowledge、lifecycle/runtime-state 的直接执行。
- `P6`：旧 Capability/provider/domain registry/execution receipt 的物理删除。
- `P7`：双平台生成物、文档、major 版本和客户端 smoke。

约束 ID：

- `C1`：业务方法论只维护一份；平台差异必须在源码同一位置明文可见。
- `C2`：打包器不得理解 Capability、profile、provider、task graph 或 receipt。
- `C3`：生成物目录禁止手改；每个迁移 checkpoint 必须能重新生成双端发布物。
- `C4`：不得覆盖主工作区中在途的 `agents-launcher` 改动。
- `C5`：最终源码、版本和生成物同一 commit；major 版本升级。
- `C6`：Skill 只能引用 Skill 或自身/共享 references，不跨层引用插件内部实现。

Out of Scope：

- 重写业务方法论；
- 统一 Claude/Codex 原生 agent 生命周期；
- 引入新的宏、DSL 或第三平台扩展层；
- 合并主工作区的 `agents-launcher` 在途改动。

## 依赖图

```text
T1 platform-block parser
 └─ T2 packager integration
     ├─ T3 overlay + permissions + CLI rename
     │   └─ T3a import migration
     └─ T4 syntax-isolation guard
         └─ T5 workflow tracer slice
             ├─ T6 engineering workflow
             ├─ T7 design/review workflow
             └─ T8 research/parallel workflow
                 ├─ T9 product workflow
                 ├─ T9a remaining coordinators
                 ├─ T10 rules/model/worktree
                 └─ T11/T11a/T11b commands/hubs
                     └─ T12 remove profiles/using-nocode
                         └─ T13 direct domain runtimes
                             └─ T13a hook runtime relink
                                 └─ T14/T14a/T14b/T14c delete registries/contracts/state
                                 └─ T15 version/artifacts
                                     └─ T15a docs
                                         └─ T16 full verification + smoke
```

切片策略：

- `Vertical`：T5 先让一个真实 workflow 从作者态 Markdown 穿透到 Claude/Codex 生成物，验证方案可行后再批量迁移。
- `Risk-first`：平台块 parser、生成树变换和跨模块调用契约排在最前；大规模删除排在消费者归零之后。
- 回滚边界：T4、T8、T11、T14、T16 后设置 checkpoint。

## Task 1: 建立平台块 parser/filter [Size: S]

**描述**: 新增只理解 Markdown 平台块的纯函数，并用错误文件名和行号覆盖所有非法语法。

**文件**:

- Create: `scripts/lib/platform-blocks.mjs`
- Create: `hooks/platform-blocks.test.mjs`

**covers**: `P1, C1, C2`
**依赖**: None
**HITL / AFK**: AFK

**真实改动**:

```js
const OPEN = /^<!-- nocode:platform (claude|codex) -->$/;
const CLOSE = '<!-- /nocode:platform -->';

export function renderPlatformBlocks(source, { platform, file = '<markdown>' }) {
  if (!['claude', 'codex'].includes(platform)) {
    throw new Error(`${file}: unknown target platform: ${platform}`);
  }
  const output = [];
  let active = null;
  for (const [index, line] of String(source).split('\n').entries()) {
    const match = OPEN.exec(line);
    if (match) {
      if (active) throw new Error(`${file}:${index + 1}: nested platform block`);
      active = { platform: match[1], line: index + 1 };
      continue;
    }
    if (line === CLOSE) {
      if (!active) throw new Error(`${file}:${index + 1}: unexpected platform block close`);
      active = null;
      continue;
    }
    if (/^<!-- nocode:platform /.test(line)) {
      throw new Error(`${file}:${index + 1}: invalid platform block`);
    }
    if (!active || active.platform === platform) output.push(line);
  }
  if (active) throw new Error(`${file}:${active.line}: unclosed ${active.platform} platform block`);
  return output.join('\n');
}
```

测试写入共享文本、相邻双块、未知平台、嵌套、游离 close、未闭合和错误行号的完整 fixture。

**验证命令**:

- `node --test hooks/platform-blocks.test.mjs`
  预期：全部测试 PASS。

## Task 2: 将平台块接入期望生成树 [Size: S]

**描述**: 所有发布 Markdown 在进入 adapter 前先校验并按目标平台过滤；非 Markdown 出现标记立即失败。

**文件**:

- Modify: `scripts/lib/platform-compiler.mjs`
- Modify: `hooks/compile.platform.test.mjs`
- Modify: `adapters/claude/content.mjs`
- Modify: `adapters/codex/content.mjs`

**covers**: `P1, P2, C1, C2, C3`
**依赖**: Task 1
**HITL / AFK**: AFK

**真实改动**:

```js
import { renderPlatformBlocks } from './platform-blocks.mjs';

function selectPlatformContent({ sourcePath, content, platform }) {
  const marker = '<!-- nocode:platform ';
  if (!sourcePath.endsWith('.md')) {
    if (content.includes(marker)) throw new Error(`${sourcePath}: platform blocks are Markdown-only`);
    return content;
  }
  return Buffer.from(renderPlatformBlocks(content.toString('utf8'), {
    platform,
    file: sourcePath,
  }));
}
```

`buildExpectedTree` 先调用 `selectPlatformContent`，再把结果交给 adapter 的 frontmatter、路径变量与 Hook 变换；adapter 不解析平台块。

**验证命令**:

- `node --test hooks/platform-blocks.test.mjs hooks/compile.platform.test.mjs`
  预期：平台选择、非 Markdown 拒绝和原编译器回归全部 PASS。

## Task 3: 收窄为静态 packager 并修正文件模式 [Size: M]

**描述**: 将机械 CLI/核心模块改名为 packager，按源执行位或显式 overlay 生成文件，并在迁移期把 domain reference 生成隔离成明确的 legacy supplement；旧消费者归零后再删除 supplement。

**文件**:

- Create: `scripts/package.platform.mjs`
- Create: `scripts/lib/platform-packager.mjs`
- Modify: `scripts/compile.platform.mjs`
- Modify: `hooks/compile.platform.test.mjs`
- Create: `platform/README.md`

**covers**: `P2, C2, C3`
**依赖**: Task 2
**HITL / AFK**: AFK

**真实改动**:

```js
export function writeExpectedTree(expected, outputRoot, repoRoot) {
  const safeRoot = assertSafeOutputRoot(outputRoot, repoRoot);
  rmSync(safeRoot, { recursive: true, force: true });
  mkdirSync(safeRoot, { recursive: true });
  for (const [relative, entry] of expected) {
    const target = path.join(safeRoot, safeRelative(relative, 'generated path'));
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, entry.content);
    chmodSync(target, entry.mode & 0o111 ? 0o755 : 0o600);
  }
}
```

普通文件测试只断言 `(mode & 0o111) === 0`；脚本断言 `(mode & 0o111) !== 0`。`scripts/compile.platform.mjs` 在 AGENTS 尚未更新前只做兼容转发：

```js
#!/usr/bin/env node
import { main } from './package.platform.mjs';
process.stderr.write('compile.platform.mjs is deprecated; use package.platform.mjs\n');
main(process.argv.slice(2));
```

仓库内脚本、测试和 AGENTS 在最终切换任务统一改用新命令。迁移期 `package.platform.mjs` 可从独立 legacy supplement 取得旧 references，但 `platform-packager.mjs` 不导入或解析 domain registry；Task 14 在消费者归零后删除 supplement。

**验证命令**:

- `env -i PATH="$PATH" HOME="$HOME" node --test hooks/compile.platform.test.mjs`
  预期：在宿主严格 umask 下仍 PASS。
- `node scripts/package.platform.mjs --check`
  预期：当前迁移阶段仅报告预期 drift，不出现 registry/provider 读取错误。

## Task 3a: 迁移 packager 模块 import [Size: S]

**描述**: 将仍使用旧 `platform-compiler.mjs` 名称的维护脚本和测试切换到 `platform-packager.mjs`，迁移期旧模块只保留 re-export。

**文件**:

- Modify: `scripts/check-skills.mjs`
- Modify: `hooks/wiki-read.test.mjs`
- Modify: `hooks/runtime-entry.test.mjs`
- Modify: `hooks/context-budget.test.mjs`
- Modify: `hooks/continuous-learning-exclusion.test.mjs`

**covers**: `P2, C2, C3`
**依赖**: Task 3
**HITL / AFK**: AFK

**真实改动**:

所有 import 的模块路径从 `platform-compiler.mjs` 改为 `platform-packager.mjs`；Task 14c 在旧引用归零后删除 re-export 文件。

**验证命令**:

- `rg -n 'platform-compiler\\.mjs' scripts hooks`
  预期：只剩迁移期 re-export 文件自身和明确的删除断言。
- `node --test hooks/wiki-read.test.mjs hooks/runtime-entry.test.mjs hooks/context-budget.test.mjs hooks/continuous-learning-exclusion.test.mjs`
  预期：全部 PASS。

## Task 4: 建立双平台语法隔离护栏 [Size: S]

**描述**: 扫描生成物，禁止另一平台原生工具、平台块标记和旧 Capability/profile 语义泄漏。

**文件**:

- Create: `hooks/platform-isolation.test.mjs`
- Modify: `hooks/platform-snapshots.test.mjs`
- Modify: `hooks/compile.platform.test.mjs`

**covers**: `P1, P2, P3, P4, C1, C2, C3`
**依赖**: Tasks 2-3
**HITL / AFK**: AFK

**真实改动**:

```js
const forbidden = {
  claude: /\b(?:spawn_agent|wait_agent|followup_task|interrupt_agent|request_user_input|update_plan)\b/,
  codex: /\b(?:AskUserQuestion|TaskCreate|TaskUpdate|EnterWorktree)\b/,
};
const obsolete = /\bCapability\(|"profile":|fallbackPolicy|nocode:platform/;
```

迁移期测试分别维护 `legacyAllowlist`；每完成一个后续 task 就删掉对应 allowlist 条目，T14 要求 allowlist 为空。

**验证命令**:

- `node scripts/package.platform.mjs`
- `node --test hooks/platform-isolation.test.mjs hooks/platform-snapshots.test.mjs`
  预期：平台互斥检查 PASS，旧语义仅存在于显式迁移 allowlist。

## ✅ Checkpoint 1: 覆盖 Task 1-4

**触发原因**: Tasks 2-4 修改跨模块生成接口，命中风险信号 #7。

**全部测试**:

- `node --test 'hooks/*.test.mjs'`
  预期：除已记录的迁移 allowlist 外全部 PASS。

**Build**:

- `node scripts/package.platform.mjs`
- `node scripts/package.platform.mjs --check`
  预期：双平台生成成功且无 drift。

**用户 Review**:

- [ ] 展示一个相邻双平台块及两端过滤结果。
- [ ] 用户确认继续迁移业务消费者。

**Rollback 点**: 平台块与新 packager 已独立可用，旧业务 runtime 尚未删除。

## Task 5: 打通原生 workflow tracer slice [Size: M]

**描述**: 先迁移 `dev-plan` 的 plan/decision/Skill handoff，证明一个真实多步 Skill 能直接使用两端原生能力。

**文件**:

- Modify: `skills/dev-plan/SKILL.md`
- Modify: `hooks/workflow-consumers.test.mjs`
- Modify: `hooks/platform-isolation.test.mjs`

**covers**: `P3, C1, C3, C6`
**依赖**: Task 4
**HITL / AFK**: HITL（生成物片段 review）

**真实改动**:

```markdown
<!-- nocode:platform claude -->
使用 `TaskCreate` 创建完整计划项，使用 `TaskUpdate` 提交状态变化；需要用户选择时使用 `AskUserQuestion`。
<!-- /nocode:platform -->

<!-- nocode:platform codex -->
使用 `update_plan` 创建并更新完整计划快照；需要结构化选择且该工具可用时使用 `request_user_input`。
<!-- /nocode:platform -->
```

Skill handoff 改成直接点名 `Skill(nocode:dev-build)`；若平台没有显式 Skill 工具，要求按当前会话的 Skill 调用机制执行，不生成内部 receipt。

**验证命令**:

- `node scripts/package.platform.mjs`
- `node --test hooks/workflow-consumers.test.mjs hooks/platform-isolation.test.mjs --test-name-pattern='dev-plan|platform'`
  预期：作者态无 `Capability(`，Claude/Codex 生成物只含各自 plan/decision 指令。

## Task 6: 迁移工程主流程原生 plan 与 handoff [Size: M]

**描述**: 迁移 Define/Design/Build/Verify 主流程，保持现有 Gate 和上下文信封业务字段。

**文件**:

- Modify: `skills/dev-define/SKILL.md`
- Modify: `skills/dev-design/SKILL.md`
- Modify: `skills/dev-build/SKILL.md`
- Modify: `skills/dev-verify/SKILL.md`
- Modify: `hooks/workflow-consumers.test.mjs`

**covers**: `P3, C1, C3, C6`
**依赖**: Task 5
**HITL / AFK**: AFK

**真实改动**:

- `workflow.plan.create/update` 使用 Task 5 的相邻原生 plan 块。
- `workflow.decision.request` 使用相邻 Claude `AskUserQuestion` / Codex `request_user_input` 块。
- `workflow.skill.invoke` 改为直接 `Skill(nocode:<name>)` handoff，并保留 request/context/payload 的业务字段。
- `dev-build` 的 subagent execution 延后到 Task 8 统一迁移，先保留执行方式语义并禁止旧调用进入生成物。

**验证命令**:

- `node scripts/package.platform.mjs`
- `node --test hooks/workflow-consumers.test.mjs hooks/platform-isolation.test.mjs`
  预期：四个 Skill 无旧 plan/decision/skill invoke，Gate 契约测试 PASS。

## Task 7: 迁移设计与 review 子流程 [Size: M]

**描述**: 迁移设计决策、设计写作、brainstorming、reviewing 和红蓝军的 plan/decision/Skill handoff。

**文件**:

- Modify: `skills/dev-design/decision/SKILL.md`
- Modify: `skills/dev-design/writing/SKILL.md`
- Modify: `skills/brainstorming/SKILL.md`
- Modify: `skills/reviewing/SKILL.md`
- Modify: `skills/red-blue-deep/SKILL.md`

**covers**: `P3, C1, C3, C6`
**依赖**: Task 5
**HITL / AFK**: AFK

**真实改动**:

统一采用 Task 5 的原生块；review payload 继续是业务输入文本，不再嵌入 `workflow.skill.invoke` JSON 外壳。自审不派 agent 的规则保持不变。

**验证命令**:

- `node scripts/package.platform.mjs`
- `node --test hooks/workflow-consumers.test.mjs hooks/platform-isolation.test.mjs`
  预期：五个 Skill 的 review/decision 流程契约 PASS。

## Task 8: 迁移 agent dispatch/wait/followup/cancel [Size: M]

**描述**: 用平台原生 agent 生命周期替换统一 task graph、profile、executionId 和 receipt。

**文件**:

- Modify: `skills/dev-build/SKILL.md`
- Modify: `skills/dispatching-parallel-agents/SKILL.md`
- Modify: `skills/research-workflow/SKILL.md`
- Modify: `rules/rule-codex-review.md`
- Modify: `hooks/workflow-consumers.test.mjs`

**covers**: `P3, P4, C1, C2, C3`
**依赖**: Tasks 6-7
**HITL / AFK**: HITL（原生 agent 行为 review）

**真实改动**:

```markdown
<!-- nocode:platform claude -->
使用 Claude 原生 `Agent` 派发自足任务；保存其返回句柄，使用当前平台原生等待/续派/取消操作。原生 Agent 不可用时由主会话执行并说明未获得隔离。
<!-- /nocode:platform -->

<!-- nocode:platform codex -->
调用 `spawn_agent` 派发自足任务并保存 agent id；用 `wait_agent` 等待，用 `followup_task` 续派，用 `interrupt_agent` 取消。工具不可用时由主会话执行并说明未获得隔离。
<!-- /nocode:platform -->
```

删除 `profile`、`dependsOn`、`writeScope`、`timeoutMs`、`fallbackPolicy`、`executionId` 和 `collect receipt`；把必要的写范围、时限和证据要求写进 objective 自身。

**验证命令**:

- `node scripts/package.platform.mjs`
- `node --test hooks/workflow-consumers.test.mjs hooks/platform-isolation.test.mjs`
  预期：agent 代表路径只含平台原生生命周期，无 profile/receipt。

## ✅ Checkpoint 2: 覆盖 Task 5-8

**触发原因**: Task 8 修改多个高频 Skill 的跨模块 agent 接口，命中风险信号 #7。

**全部测试**:

- `node --test 'hooks/*.test.mjs'`
  预期：workflow、生成物和 Hook 回归全部 PASS。

**Build**:

- `node scripts/package.platform.mjs --check`
  预期：无 drift。

**用户 Review**:

- [ ] Claude/Codex 各展示 plan、decision、agent dispatch 的最终 Markdown。
- [ ] 用户确认不需要统一 execution receipt。

**Rollback 点**: 核心 workflow 已原生化，其余消费者仍可分组回退。

## Task 9: 迁移产品流程 [Size: M]

**描述**: 迁移 pdflow/PRD/IX/VD/research 的 plan、decision、handoff 和 agent 说明。

**文件**:

- Modify: `skills/pdflow/SKILL.md`
- Modify: `skills/pd-prd/SKILL.md`
- Modify: `skills/pd-ix/SKILL.md`
- Modify: `skills/pd-vd/SKILL.md`
- Modify: `skills/pd-research/SKILL.md`

**covers**: `P3, P4, C1, C3, C6`
**依赖**: Task 8
**HITL / AFK**: AFK

**真实改动**:

复用 Tasks 5/8 的相邻平台块；视觉生成与研究方法论保持共享，不把平台工具差异散到 reference。

**验证命令**:

- `node scripts/package.platform.mjs`
- `node --test hooks/workflow-consumers.test.mjs hooks/platform-isolation.test.mjs`
  预期：五个产品 Skill 无 `Capability(`、profile 或平台语法泄漏。

## Task 9a: 迁移剩余流程协调器 [Size: M]

**描述**: 迁移 land/review/devflow/skill-writing/Lark hub 的 plan、decision、Skill handoff，关闭工程流程和外部入口的旧调用。

**文件**:

- Modify: `skills/dev-land/SKILL.md`
- Modify: `skills/dev-review/SKILL.md`
- Modify: `skills/devflow/SKILL.md`
- Modify: `skills/skill-writing/SKILL.md`
- Modify: `skills/larkhub/SKILL.md`

**covers**: `P3, P4, C1, C3, C6`
**依赖**: Task 8
**HITL / AFK**: AFK

**真实改动**:

- plan/decision/Skill handoff 复用 Task 5 的相邻平台块。
- 独立 review 复用 Task 8 的原生 agent 块，不再声称 cross-model profile 一定可用。
- Lark 路由直接点名目标 Skill；连接器不可用时报告真实缺失能力，不经过 provider fallback。

**验证命令**:

- `node scripts/package.platform.mjs`
- `node --test hooks/workflow-consumers.test.mjs hooks/platform-isolation.test.mjs`
  预期：五个协调器无旧 workflow/profile 调用，原有 Gate 和路由条件仍 PASS。

## Task 10: 迁移全局规则、模型与 worktree [Size: M]

**描述**: 删除全局强制语义搜索 agent 路由，改为本地判断；worktree 使用两端原生入口。

**文件**:

- Modify: `model/agent-about.md`
- Modify: `model/agent-personal.md`
- Modify: `rules/rule-git-worktree.md`
- Modify: `rules/rule-superpowers-brainstorming.md`
- Modify: `skills/using-git-worktrees/SKILL.md`

**covers**: `P3, P4, P5, C1, C3`
**依赖**: Tasks 8-9a
**HITL / AFK**: HITL（全局行为变化 review）

**真实改动**:

```markdown
语义搜索默认由当前会话使用可用的代码搜索工具完成。只有任务可独立、边界清楚且派发成本合理时才使用原生 agent；不得仅因“语义搜索”四个字强制派发。

<!-- nocode:platform claude -->
创建隔离工作区后使用 `EnterWorktree` 进入返回的绝对路径。
<!-- /nocode:platform -->

<!-- nocode:platform codex -->
使用 `git worktree add` 创建隔离工作区；继续在该绝对路径执行后续命令，不模拟 `EnterWorktree`。
<!-- /nocode:platform -->
```

**验证命令**:

- `node scripts/compile.rule.js`
- `node scripts/package.platform.mjs`
- `node --test hooks/workflow-consumers.test.mjs hooks/platform-isolation.test.mjs hooks/compile.rule.test.mjs`
  预期：worktree 与 rule catalog 回归 PASS；全局模型不含强制 search profile。

## ✅ Checkpoint 2a: 覆盖 Task 9-10

**触发原因**: Task 10 修改全局注入规则并命中风险信号 #7；同时避免超过三个迁移 task 无 checkpoint。

**全部测试**:

- `node --test 'hooks/*.test.mjs'`
  预期：全部 PASS。

**Build**:

- `node scripts/package.platform.mjs --check`
  预期：无 drift。

**用户 Review**:

- [ ] 产品流程与全局 search/worktree 行为符合设计。

**Rollback 点**: 所有 Skill 流程迁移完成，commands 尚未批量迁移。

## Task 11: 迁移 command/hub Skill 调用 [Size: M]

**描述**: 把 command 的内部 Capability handoff 改为直接点名目标 Skill，并保留业务 payload。

**文件**:

- Modify: `commands/distill.md`
- Modify: `commands/personalhub.md`
- Modify: `commands/projecthub.md`
- Modify: `commands/nocodehub.md`
- Modify: `commands/plugin-dream.md`

**covers**: `P3, C1, C3, C6`
**依赖**: Task 8
**HITL / AFK**: AFK

**真实改动**:

每个 `workflow.skill.invoke` 改成：

```markdown
调用 `Skill(nocode:personal-distill)`，传入当前 request、context 和已确认的 `arguments.payload.candidates[]`；不得丢弃 disposition、target、slug 或目标文件字段。
```

目标 Skill 名按原调用逐项保留，不引入通用 router。

**验证命令**:

- `node scripts/package.platform.mjs`
- `node --test hooks/workflow-consumers.test.mjs hooks/platform-isolation.test.mjs`
  预期：五个 command 无 `Capability(`，payload 合同仍 PASS。

## Task 11a: 迁移 distill 与维护子命令 [Size: M]

**描述**: 迁移 distill 目标、dream 和 sow 子命令的 Skill handoff，保留候选项与 disposition 合同。

**文件**:

- Modify: `commands/personal-distill.md`
- Modify: `commands/plugin-distill.md`
- Modify: `commands/personal-dream.md`
- Modify: `commands/project-dream.md`
- Modify: `commands/sow.md`

**covers**: `P3, P5, C1, C3, C6`
**依赖**: Task 11
**HITL / AFK**: AFK

**真实改动**:

把每个 `workflow.skill.invoke` 替换为直接目标 Skill 调用；`arguments.payload.candidates[]`、`disposition`、`target_file` 等字段原样保留为目标 Skill 输入，不创建统一 receipt。

**验证命令**:

- `node scripts/package.platform.mjs`
- `node --test hooks/workflow-consumers.test.mjs hooks/platform-isolation.test.mjs`
  预期：五个子命令无 `Capability(`，distill caller/target 合同 PASS。

## Task 11b: 迁移剩余入口与 personal knowledge 调用 [Size: M]

**描述**: 迁移 eval、personal init/recall 和 lark-read 的剩余 capability 调用。

**文件**:

- Modify: `commands/eval.md`
- Modify: `commands/personal-init.md`
- Modify: `commands/personal-recall.md`
- Modify: `skills/lark-read/SKILL.md`

**covers**: `P3, P5, C1, C3, C6`
**依赖**: Task 11a
**HITL / AFK**: AFK

**真实改动**:

- personal knowledge 直接调用所属维护 Skill 或仓库脚本，使用脚本真实 stdout/exit code。
- `lark-read` 使用当前平台已安装的 Lark 工具；缺失时明确请求连接，不使用 provider registry。
- eval/review handoff 使用 Task 5/8 的原生 Skill/agent 块。

**验证命令**:

- `node scripts/package.platform.mjs`
- `node --test hooks/workflow-consumers.test.mjs hooks/platform-isolation.test.mjs hooks/wiki-read.test.mjs`
  预期：剩余入口无旧 capability 调用，wiki 读取回归 PASS。

## ✅ Checkpoint 3: 覆盖 Task 11-11b

**触发原因**: Tasks 11-11b 修改多个 command 路由，且达到连续三个 task 的 fallback checkpoint。

**全部测试**:

- `node --test 'hooks/*.test.mjs'`
  预期：全部 PASS。

**Build**:

- `node scripts/package.platform.mjs --check`
  预期：无 drift。

**用户 Review**:

- [ ] 全局模型、产品流程和 command handoff 代表片段已展示。
- [ ] 用户确认继续删除 profile/router。

**Rollback 点**: 所有高频消费者已原生化，删除阶段前可整体回退。

## Task 12: 删除 agent profile 与 using-nocode [Size: M]

**描述**: 将仍被消费的 prompt 移入所属 Skill reference，删除 profile 生成链、using-nocode 和 policy 依赖。

**文件**:

- Delete: `agents/`
- Delete: `skills/using-nocode/`
- Modify: `adapters/shared/skill-renderers.mjs`
- Modify: `adapters/claude/adapter.mjs`
- Modify: `adapters/codex/adapter.mjs`

**covers**: `P4, P6, C2, C6`
**依赖**: Tasks 9-11
**HITL / AFK**: AFK

**真实改动**:

- `recall-search.md` 的有效检索约束内联到唯一消费者 `commands/personal-recall.md`；无消费者 profile 删除。
- adapter 不再调用 `generateAgentReferences`，Codex 不再生成 `skills/using-nocode/scripts/runtime-entry.mjs`。
- policy renderer 只处理真实 Skill，不识别 profile。

**验证命令**:

- `rg -n 'profile|using-nocode|generateAgentReferences' agents skills adapters model rules commands`
  预期：仅文档语境或零匹配；无可执行路由语义。
- `node scripts/package.platform.mjs`
- `node --test hooks/platform-isolation.test.mjs hooks/platform-snapshots.test.mjs`
  预期：双端生成物无 profile/using-nocode。

## ✅ Checkpoint 3a: 覆盖 Task 12

**触发原因**: Task 12 删除 profile/using-nocode 文件树，命中风险信号 #8。

**全部测试**:

- `node --test 'hooks/*.test.mjs'`
  预期：全部 PASS。

**Build**:

- `node scripts/package.platform.mjs --check`
  预期：无 drift。

**用户 Review**:

- [ ] agent prompt 的内联/删除去向已核对。

**Rollback 点**: profile/router 已删除，真实 runtime 尚未搬离 domain。

## Task 13: 将真实 domain 实现归位到直接消费者 [Size: M]

**描述**: 保留 Open Design、personal knowledge、Hook codec 和 plugin-data 的真实脚本，但移除 provider/domain 命名与间接路由。

**文件**:

- Create: `platform/claude/`
- Create: `platform/codex/`
- Modify: `scripts/lib/platform-packager.mjs`
- Create: `scripts/open-design-launch.mjs`
- Modify: `hooks/open-design-launcher.test.mjs`

**covers**: `P2, P5, C2, C3, C6`
**依赖**: Task 12
**HITL / AFK**: AFK

**真实改动**:

- Hook codec/entry/context budget 放入对应 platform overlay。
- Open Design launcher 移到 `scripts/open-design-launch.mjs`，作为 `.mcp.json` 的直接启动脚本复制，不通过 provider registry。
- 已有 `scripts/wiki-read.mjs`、`scripts/personal-snapshot.mjs` 继续由所属 command/Skill 直接引用，不再复制 domain provider 包装。
- `platform-packager` 以显式 `sharedRoots` + `overlayRoot` 合并，不扫描 `core/domains`。

**验证命令**:

- `node scripts/package.platform.mjs`
- `node --test hooks/open-design-launcher.test.mjs hooks/hook-codecs.test.mjs hooks/wiki-read.test.mjs hooks/personal-snapshot.test.mjs`
  预期：Open Design、Hook 和 personal knowledge 代表路径 PASS。

## Task 13a: 重连 Hook/session 原生 runtime [Size: M]

**描述**: 将 SessionStart/plugin-data 入口改为 overlay 的直接路径，并更新 runtime 代表测试，不再经过 using-nocode/provider 目录。

**文件**:

- Modify: `hooks/session-open.mjs`
- Modify: `hooks/session-open.test.mjs`
- Modify: `hooks/runtime-entry.test.mjs`
- Modify: `adapters/codex/runtime-entry.mjs`
- Modify: `hooks/hooks.json`

**covers**: `P2, P5, C2, C3`
**依赖**: Task 13
**HITL / AFK**: AFK

**真实改动**:

- 生成后的 Hook 命令只指向 `${PLUGIN_ROOT}/runtime/...` 或 `${CLAUDE_PLUGIN_ROOT}/runtime/...`。
- `runtime-entry.mjs` 只负责 argv/env/stdio 安全传递，不解析 Capability 或 provider。
- SessionStart 测试直接构造两个 overlay runtime，断言退出码、stdout/stderr 和 plugin-data root。

**验证命令**:

- `node scripts/package.platform.mjs`
- `node --test hooks/session-open.test.mjs hooks/runtime-entry.test.mjs hooks/hook-codecs.test.mjs`
  预期：Claude/Codex runtime entry 代表路径全部 PASS。

## Task 14: 删除 domain registry、contracts 与 workflow state [Size: M]

**描述**: 在消费者归零后物理删除 capability/provider/domain runtime 与 package CLI 的 legacy supplement，并把测试改为禁止旧架构复生。

**文件**:

- Delete: `core/domains/`
- Delete: `core/contracts/`
- Delete: `scripts/lib/domain-registry.mjs`
- Delete: `scripts/lib/domain-renderer.mjs`
- Delete: `scripts/workflow-state.mjs`

**covers**: `P5, P6, C2, C3`
**依赖**: Task 13
**HITL / AFK**: HITL（不可逆大规模删除 review）

**真实改动**:

删除 domain/capability/provider 文件树和只被它们使用的 registry/renderer/state 入口。保留的脚本必须已有 Task 13 的直接消费者。

**验证命令**:

- `rg -n -g '!docs/**' -g '!plugins/**' -g '!vendor/**' 'domain-registry|domain-renderer|workflow-state' scripts hooks adapters skills commands model rules`
  预期：只剩待 Task 14a 删除的旧测试。

## ✅ Checkpoint 3b: 覆盖 Task 13-14

**触发原因**: Task 14 删除 domain/contracts/runtime 文件树，命中风险信号 #7/#8。

**全部测试**:

- `node --test 'hooks/*.test.mjs'`
  预期：除下一任务明确删除的旧实现测试外，真实行为测试全部 PASS。

**Build**:

- `node scripts/package.platform.mjs --check`
  预期：无 drift，packager 不扫描已删除目录。

**用户 Review**:

- [ ] 保留 runtime 均有直接消费者，删除项均无消费者。

**Rollback 点**: domain 主文件树删除完成，辅助 helper/test 清理尚可独立回滚。

## Task 14a: 删除旧 workflow/workspace helper 与测试 [Size: M]

**描述**: 删除统一 execution graph、workspace provider 和只验证旧架构的第一组测试。

**文件**:

- Delete: `scripts/lib/workflow-provider.mjs`
- Delete: `scripts/lib/workflow-control.mjs`
- Delete: `scripts/lib/workspace-provider.mjs`
- Delete: `hooks/domain-registry.test.mjs`
- Delete: `hooks/domain-renderer.test.mjs`

**covers**: `P5, P6, C2, C3`
**依赖**: Task 14
**HITL / AFK**: AFK

**真实改动**:

这些模块不得由新 packager 或原生 Skill 引用；删除后通过 `rg` 验证零 import。

**验证命令**:

- `rg -n 'workflow-provider|workflow-control|workspace-provider|domain-registry|domain-renderer' scripts hooks adapters skills commands model rules`
  预期：零匹配。
- `node --test 'hooks/*.test.mjs'`
  预期：全部现存测试 PASS。

## Task 14b: 删除旧状态测试并建立反复生断言 [Size: M]

**描述**: 删除仅验证统一 receipt/state/provider 的剩余测试，并将平台合同测试改成禁止旧架构复生。

**文件**:

- Delete: `hooks/workflow-provider.test.mjs`
- Delete: `hooks/workflow-state.test.mjs`
- Delete: `hooks/workflow-control.test.mjs`
- Delete: `hooks/workspace-provider.test.mjs`
- Modify: `hooks/platform-contract.test.mjs`

**covers**: `P5, P6, C2, C3`
**依赖**: Task 14a
**HITL / AFK**: AFK

**真实改动**:

在 `platform-contract.test.mjs` 增加：

```js
for (const obsolete of [
  'core/domains',
  'scripts/lib/domain-registry.mjs',
  'scripts/lib/domain-renderer.mjs',
  'scripts/workflow-state.mjs',
  'skills/using-nocode',
]) assert.equal(existsSync(path.join(ROOT, obsolete)), false, obsolete);
```

**验证命令**:

- `rg -n -g '!docs/**' -g '!plugins/**' -g '!vendor/**' 'Capability\\(|fallbackPolicy|domain-registry|domain-renderer|workflow-state|using-nocode|\"profile\"' .`
  预期：零可执行语义匹配。
- `node --test 'hooks/*.test.mjs'`
  预期：全部 PASS。

## Task 14c: 收口旧架构测试与源扫描 [Size: S]

**描述**: 删除 using-nocode 专属测试，把 handoff/workflow 测试改为验证真实状态和原生平台块，并要求迁移 allowlist 归零。

**文件**:

- Delete: `hooks/using-nocode-skill.test.mjs`
- Modify: `hooks/handoff-state.test.mjs`
- Modify: `hooks/workflow-consumers.test.mjs`
- Modify: `hooks/platform-isolation.test.mjs`

**covers**: `P3, P5, P6, C2, C3`
**依赖**: Task 14b
**HITL / AFK**: AFK

**真实改动**:

- `handoff-state.test` 保留跨 session 恢复的真实行为断言，删除 Capability 文本断言。
- `workflow-consumers.test` 断言作者态平台块成对、objective 自足、plan/decision/agent 原生说明存在。
- `platform-isolation.test` 的 `legacyAllowlist` 改成空数组，并对全部作者态业务文件断言无 `Capability(`、profile、fallbackPolicy。

**验证命令**:

- `node --test hooks/handoff-state.test.mjs hooks/workflow-consumers.test.mjs hooks/platform-isolation.test.mjs`
  预期：全部 PASS，legacy allowlist 为空。

## ✅ Checkpoint 4: 覆盖 Task 12-14c

**触发原因**: Tasks 12/14-14c 是不可逆删除并修改跨模块入口，命中风险信号 #7/#8。

**全部测试**:

- `node --test 'hooks/*.test.mjs'`
  预期：全部 PASS。

**Build**:

- `node scripts/package.platform.mjs`
- `node scripts/package.platform.mjs --check`
  预期：双端产物无 drift。

**用户 Review**:

- [ ] 删除清单和保留/归位清单逐项核对。
- [ ] 确认生成物无 Capability/profile/provider/runtime receipt。

**Rollback 点**: 旧架构完整删除后的稳定基线。

## Task 15: 更新 major 版本和双平台生成物 [Size: M]

**描述**: 更新仓库维护约束、升级 major 版本并生成完整双平台发布树。

**文件**:

- Modify: `plugin/metadata.json`
- Modify: `AGENTS.md`
- Delete: `scripts/compile.platform.mjs`
- Modify: `plugins/claude/nocode/`
- Modify: `plugins/codex/nocode/`

**covers**: `P7, C3, C5`
**依赖**: Task 14c
**HITL / AFK**: AFK

**真实改动**:

- 版本从 `16.1.2` 升到 `17.0.0`。
- AGENTS/CLAUDE 同义入口的生成命令改为 `node scripts/package.platform.mjs` / `--check`。
- 删除迁移期兼容 wrapper，运行 packager 更新 `plugins/claude/nocode/**`、`plugins/codex/nocode/**`。

**验证命令**:

- `node scripts/package.platform.mjs`
- `node scripts/package.platform.mjs --check`
  预期：无 drift，两个 manifest 都是 `17.0.0`。

## Task 15a: 更新架构与维护文档 [Size: S]

**描述**: 把公开架构说明切换为原生平台块和静态 package 命令。

**文件**:

- Modify: `README.md`
- Modify: `scripts/README.md`
- Modify: `skills/README.md`
- Modify: `docs/dev/INDEX.md`

**covers**: `P7, C3, C5`
**依赖**: Task 15
**HITL / AFK**: AFK

**真实改动**:

- 所有维护命令改为 `node scripts/package.platform.mjs` / `--check`。
- 文档删除 Capability/profile/provider 架构说明，链接新的 approved design。

**验证命令**:

- `rg -n 'compile\\.platform|Capability|profile|provider registry' README.md scripts/README.md skills/README.md docs/dev/INDEX.md`
  预期：不再把旧命令或旧 runtime 描述为现行架构。

## Task 16: 全量验证与双客户端 smoke [Size: M]

**描述**: 执行 vendor、生成物、Hook 和代表性客户端验证，记录环境无法执行的项，不用推断代替证据。

**文件**:

- Create: `docs/superpowers/smoke/260723-claude-17.0.0.json`
- Create: `docs/superpowers/smoke/260723-codex-17.0.0.json`
- Modify: `docs/dev/3dot141/260723-03-native-platform-block-packaging/native-platform-block-packaging-design.md`

**covers**: `P7, C3, C5`
**依赖**: Task 15a
**HITL / AFK**: HITL（客户端交互与最终验收）

**真实改动**:

smoke 记录六类场景的 `platform`、`version`、`scenario`、`result`、`evidence`：

1. 普通问答不触发 agent；
2. 并行 agent；
3. plan 更新；
4. 用户 decision；
5. Hook 拦截；
6. Open Design 或明确降级。

设计文档状态从 `approved / implementation pending` 改为 `implemented`，验收清单按真实证据勾选。

**验证命令**:

- `node scripts/vendor-sync.mjs --check`
  预期：exit 0。
- `node scripts/package.platform.mjs --check`
  预期：exit 0。
- `node --test 'hooks/*.test.mjs'`
  预期：全部 PASS。
- `git diff --check`
  预期：无输出。
- `git status --short`
  预期：只含本计划范围内源码、版本、文档与双端生成物。

## ✅ Checkpoint 5: 覆盖 Task 15-16

**触发原因**: 发布和 major 版本切换命中风险信号 #8。

**全部测试**:

- `node --test 'hooks/*.test.mjs'`
- `node scripts/vendor-sync.mjs --check`
- `node scripts/package.platform.mjs --check`
  预期：全部 exit 0。

**Build**:

- 检查两个生成 manifest 的版本为 `17.0.0`。
- 检查 smoke 证据完整。

**用户 Review**:

- [ ] 用户确认最终 diff。
- [ ] 创建单一 major migration commit。
- [ ] 询问是否 `git push`，不自动 push。

**Rollback 点**: `codex/simplify-platform-packaging` 的最终提交。

## 路径覆盖映射

| 路径/约束 | Tasks |
|---|---|
| P1 平台块 | 1, 2, 4 |
| P2 静态打包 | 2, 3, 4, 13 |
| P3 workflow 原生化 | 5, 6, 7, 8, 9, 9a, 10, 11, 11a, 11b |
| P4 profile/prompt | 8, 9, 9a, 10, 12 |
| P5 真实 domain runtime | 10, 11a, 11b, 13, 13a, 14-14c |
| P6 删除旧架构 | 12, 14-14c |
| P7 发布与 smoke | 15, 15a, 16 |
| C1 单一业务源/明文差异 | 1, 2, 4-11b |
| C2 packager 无业务语义 | 1-4, 8, 12-14c |
| C3 每阶段双产物可生成 | 2-16 |
| C4 隔离主工作区 | 全部在专用 worktree 执行 |
| C5 major/同 commit | 15, 16 |
| C6 Skill 自闭环 | 5-13a |

## 自查结论

- 切片：T5 是首个端到端 tracer；之后按业务消费者族迁移，不是先横向删除基础层。
- 依赖：parser → packager → 隔离护栏 → 消费者 → 删除 → 发布，无环。
- Risk-first：最不确定的平台过滤和原生 agent 生命周期分别在 Checkpoint 1/2 前验证。
- 粒度：每个 task 一个逻辑动作；大目录删除以单个删除边界计，消费者迁移保持每组不超过五个作者态文件。
- 覆盖：P1-P7、C1-C6 均有任务覆盖；主工作区在途改动明确不进入该分支。
- 跨 task 一致性：T4 的 legacy allowlist 是迁移状态单源，后续任务只做删减；T14 只有在 allowlist 和消费者均归零后执行。

## Plan Validation

- [x] 需求覆盖：P1-P7 全覆盖。
- [x] 路径覆盖：C1-C6 全覆盖。
- [x] 可验证：每个 task 有命令和预期结果。
- [x] 无环：依赖图无环。
- [x] checkpoint：跨模块接口或删除后立即插入，且不超过连续三个迁移 task。
- [x] 零占位符：核心 parser、原生平台块、禁止模式和版本均给出真实内容；批量迁移使用已确定的规范块。
- [x] 用户确认计划。
- [x] 用户选择 `executing`。
