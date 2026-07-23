# nocode Claude / Codex Dual Runtime Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从同一份 nocode 业务源码确定性生成可独立安装的 Claude Code 与 Codex 插件，并让平台差异只存在于 adapter。

**Architecture:** 现有 `skills/`、`commands/`、`agents/`、`rules/`、`model/` 与运行脚本先作为 Common Core 的业务源码保留原位，新增 `core/` 保存 capability contract 和平台无关定义，避免 major migration 同时做无价值的大规模路径搬迁。`adapters/<platform>/` 负责 manifest、内容、Hook codec 与能力降级；`scripts/compile.platform.mjs` 确定性生成并校验 `plugins/claude/nocode/`、`plugins/codex/nocode/`（末级目录与 manifest name 一致）。当所有调用点都迁成语义 token 后，再单独评估是否把业务源码物理移动到 `core/`；物理目录不是运行时边界。

**Tech Stack:** Node.js ESM、`node:test`、JSON/Markdown 模板、Claude Code plugin manifest、Codex plugin/marketplace/hooks schema。

**Source spec:** `docs/dev/3dot141/260720-01-claude-codex-dual-runtime/claude-codex-dual-runtime-design.md`

---

## Chunk 1: Contract and deterministic compiler

### Task 1: 建立版本与 capability 单源

**Files:**
- Create: `plugin/metadata.json`
- Create: `core/capabilities/contract.json`
- Create: `core/capabilities/README.md`
- Create: `hooks/platform-contract.test.mjs`
- Delete after marketplace cutover: `.claude-plugin/plugin.json`

- [x] **Step 1: 写 metadata / contract 失败测试**

测试读取 metadata 与 contract，断言：

```js
assert.equal(metadata.version, '14.0.0');
assert.deepEqual(Object.keys(contract.platforms).sort(), ['claude', 'codex']);
for (const capability of contract.capabilities) {
  for (const platform of ['claude', 'codex']) {
    assert.match(capability.platforms[platform].status, /^(supported|degraded|unsupported)$/);
    if (capability.platforms[platform].status !== 'supported') {
      assert.ok(capability.platforms[platform].fallback);
    }
  }
}
```

- [x] **Step 2: 运行 RED**

Run: `node --test hooks/platform-contract.test.mjs`

Expected: FAIL，原因是 metadata/contract 不存在。

- [x] **Step 3: 添加最小 metadata 与 capability contract**

首版 capability：

```text
skill.invoke
agent.dispatch
agent.wait
plan.create
plan.update
user.ask
workspace.enter
hook.session_context
hook.pretool_decision
hook.stop_decision
```

每个平台条目必须有 `status`、`implementation`；非 supported 必须有 `fallback`。

- [x] **Step 4: 运行 GREEN**

Run: `node --test hooks/platform-contract.test.mjs`

Expected: PASS。

- [x] **Step 5: 把根 Claude manifest 版本同步为 14.0.0**

在切换 marketplace 前，根 manifest 仍是当前可运行插件的兼容入口；版本必须立即与单源一致，编译器测试会禁止漂移。

### Task 2: 实现确定性平台编译器骨架

**Files:**
- Create: `scripts/lib/platform-compiler.mjs`
- Create: `scripts/compile.platform.mjs`
- Create: `hooks/compile.platform.test.mjs`
- Create: `adapters/claude/adapter.mjs`
- Create: `adapters/codex/adapter.mjs`

- [x] **Step 1: 写平台编译器 RED 测试**

覆盖：

```text
loadMetadata() 校验严格 SemVer
validateContract() 拒绝漏 adapter/fallback
buildExpectedTree('claude'|'codex') 返回稳定 Map
writeTree() 清理残留文件
checkTree() 报告 changed/missing/extra
连续两次 build 字节一致
```

- [x] **Step 2: 运行 RED**

Run: `node --test hooks/compile.platform.test.mjs`

Expected: FAIL，原因是 compiler module 不存在。

- [x] **Step 3: 实现纯函数层**

`scripts/lib/platform-compiler.mjs` 只负责：

```js
loadJson(path)
validateMetadata(metadata)
validateContract(contract, adapters)
collectFiles(root, allowlist)
buildExpectedTree(platform, options)
diffTree(expected, actualRoot)
writeExpectedTree(expected, actualRoot)
```

禁止纯函数层读取 `process.cwd()`；所有根路径显式传入。

- [x] **Step 4: 实现 CLI 层**

```bash
node scripts/compile.platform.mjs
node scripts/compile.platform.mjs --check
node scripts/compile.platform.mjs --platform claude
node scripts/compile.platform.mjs --platform codex
```

CLI 默认双平台，未知参数 exit 2，漂移 check exit 1。

- [x] **Step 5: 运行 GREEN 与回归**

Run:

```bash
node --test hooks/compile.platform.test.mjs hooks/platform-contract.test.mjs
node --test 'hooks/*.test.mjs'
```

Expected: 全部 PASS。

---

## Chunk 2: Claude behavior-equivalent artifact

### Task 3: 生成 Claude 发布物

**Files:**
- Create: `adapters/claude/manifest.mjs`
- Create: `adapters/claude/content.mjs`
- Create: `plugins/claude/nocode/**` (generated)
- Test: `hooks/compile.platform.test.mjs`

- [x] **Step 1: 写 Claude artifact RED 测试**

断言生成树包含：

```text
.claude-plugin/plugin.json
skills/**
commands/**
agents/**
hooks/**
model/**
rules/**
scripts/**
references/**
vendor/**
```

并断言生成 manifest 的 name/version/author/license 与 metadata 一致。

- [x] **Step 2: 运行 RED**

Run: `node --test hooks/compile.platform.test.mjs --test-name-pattern='Claude'`

Expected: FAIL，缺 Claude artifact renderer。

- [x] **Step 3: 实现 Claude allowlist 与 manifest renderer**

Claude adapter 对业务文件做字节等价复制；只允许复制显式目录，不递归复制 `.git`、docs、benchmark、eval、另一个平台产物。

- [x] **Step 4: 生成并验证 Claude artifact**

Run:

```bash
node scripts/compile.platform.mjs --platform claude
node scripts/compile.platform.mjs --check --platform claude
node --test 'hooks/*.test.mjs'
```

Expected: exit 0。

### Task 4: Claude snapshot 与安装边界

**Files:**
- Create: `hooks/platform-snapshots.test.mjs`
- Create: `hooks/fixtures/platform/claude/**`

- [x] **Step 1: 为高风险入口写 snapshot RED**

覆盖 `devflow`、`dev-build`、`dev-review`、`rule-codex-review`、`hooks.json`、PreToolUse block/inject、Stop handoff。

- [x] **Step 2: 运行 RED**

Expected: FAIL，fixture 不存在。

- [x] **Step 3: 生成经人工核对的 Claude fixture**

fixture 只保存代表文件/结构摘要，不复制完整插件第二遍。

- [x] **Step 4: 运行 GREEN**

Run: `node --test hooks/platform-snapshots.test.mjs`

Expected: PASS。

---

## Chunk 3: Codex adapter, skills, and hook codec

### Task 5: Codex manifest、marketplace 与内容 renderer

**Files:**
- Create: `adapters/codex/manifest.mjs`
- Create: `adapters/codex/content.mjs`
- Create: `adapters/codex/command-renderer.mjs`
- Create: `adapters/codex/agent-renderer.mjs`
- Create: `.agents/plugins/marketplace.json`
- Create: `plugins/codex/nocode/**` (generated)
- Test: `hooks/compile.platform.test.mjs`

- [x] **Step 1: 写 Codex manifest/marketplace RED 测试**

断言：

```text
plugins/codex/nocode/.codex-plugin/plugin.json 存在
manifest.skills == './skills/'
默认 hooks/hooks.json 可被发现，manifest 不依赖 hooks 字段
marketplace source.path == './plugins/codex/nocode'
每个 marketplace entry 有 installation/authentication/category
所有相对路径以 ./ 开头且不逃逸 marketplace/plugin 根
```

- [x] **Step 2: 运行 RED**

Run: `node --test hooks/compile.platform.test.mjs --test-name-pattern='Codex'`

Expected: FAIL。

- [x] **Step 3: 实现 Codex renderer**

业务 Skill 保持目录结构；内容 renderer 只处理平台边界 token 与环境变量：

```text
CLAUDE_PLUGIN_ROOT -> PLUGIN_ROOT
CLAUDE_PLUGIN_DATA -> PLUGIN_DATA
Skill(nocode:x) -> $x
AskUserQuestion -> request_user_input
TaskCreate/TaskUpdate/TaskList -> update_plan 对应动作
Agent dispatch -> spawn_agent / 主会话降级说明
EnterWorktree -> 显式 workdir/cwd
```

渲染器必须保留代码块平衡和 frontmatter，不对普通业务正文做自由改写。

- [x] **Step 4: 把 commands 渲染为 Codex Skill**

每个 command 生成同名 `skills/<name>/SKILL.md`（已验证与现有 Skill 零重名），frontmatter：

```yaml
---
name: <name>
description: <从 command frontmatter description 取得的简短触发描述>
---
```

`$ARGUMENTS` 改为“用户本次调用参数”。若 description 缺失，编译失败而不是猜测。

- [x] **Step 5: 把 agents 渲染为私有 profile references**

生成 `skills/agent-profiles/references/<name>.md` 与一个 `agent-profiles/SKILL.md` 路由器；不得写用户全局 `~/.codex/agents/`。

- [x] **Step 6: 运行 GREEN 并校验官方 schema**

Run:

```bash
node scripts/compile.platform.mjs --platform codex
node scripts/compile.platform.mjs --check --platform codex
python3 /Users/yes365/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/codex/nocode
```

Expected: 全部 exit 0。

### Task 6: 拆分 Hook domain decision 与平台 codec

**Files:**
- Create: `hooks/lib/pretool-decision.mjs`
- Create: `hooks/lib/hook-codecs.mjs`
- Modify: `hooks/pretooluse-guard.mjs`
- Modify: `hooks/inject-nocode.sh`
- Create: `hooks/session-context.mjs`
- Modify: `hooks/pretooluse-guard.test.mjs`
- Create: `hooks/hook-codecs.test.mjs`

- [x] **Step 1: 写 domain/codec RED 测试**

Domain result：

```js
{ effect: 'deny', reason, context }
{ effect: 'remind', reason, context }
```

Claude codec 输出 `hookSpecificOutput`；Codex PreToolUse codec 只输出 `systemMessage`，不得输出 Codex 不支持的 `continue/stopReason`。

- [x] **Step 2: 运行 RED**

Run: `node --test hooks/pretooluse-guard.test.mjs hooks/hook-codecs.test.mjs`

Expected: FAIL，codec 尚未拆分。

- [x] **Step 3: 实现 domain decision 与 codec**

运行时平台解析顺序：显式 `NOCODE_PLATFORM` > 存在 `PLUGIN_ROOT` 判 Codex > 默认 Claude。Claude 保持 deny；Codex 首版对 deny 以 `systemMessage` 强提醒并 fail-open，因为官方 Codex PreToolUse common output 不接受 `continue:false`。

- [x] **Step 4: 把 SessionStart 输出迁到 Node codec**

shell 只负责定位 segment，JSON 编码由 `session-context.mjs` 完成；Codex 返回 `systemMessage`，Claude 返回 `hookSpecificOutput.additionalContext`。

- [x] **Step 5: Codex Stop 明确 fail-open**

Codex 生成的 hooks.json 不注册 Claude transcript replay Stop hook；Claude 保留。测试断言两平台差异。

- [x] **Step 6: 运行 GREEN 与 Hook 回归**

Run:

```bash
node --test hooks/hook-codecs.test.mjs hooks/pretooluse-guard.test.mjs hooks/handoff-stop-guard.test.mjs
node --test 'hooks/*.test.mjs'
```

Expected: 全部 PASS。

### Task 7: Codex Skill 自闭环和 metadata budget

**Files:**
- Modify: `scripts/check-skills.mjs`
- Modify: `hooks/check-skills.test.mjs`
- Test: `hooks/compile.platform.test.mjs`

- [x] **Step 1: 写 platform-aware checker RED**

新增 `--root <plugin-root> --platform claude|codex`；检查生成 Skill frontmatter、私有 references、逃逸链接和平台禁用语法。

- [x] **Step 2: 写 metadata budget RED**

统计 Codex 所有 `name + description` 字符；超过 8000 时失败并列出最大项。

- [x] **Step 3: 实现最小 checker**

Codex 禁用项至少包括：未渲染的 `Skill(nocode:`、`AskUserQuestion`、`TaskCreate`、`EnterWorktree`、指向 `plugins/claude` 的路径。

- [x] **Step 4: 运行 GREEN**

Run:

```bash
node scripts/check-skills.mjs --check --root plugins/claude/nocode --platform claude
node scripts/check-skills.mjs --check --root plugins/codex/nocode --platform codex
```

Expected: exit 0。

---

## Chunk 4: Marketplace cutover and release gates

### Task 8: 切换双 marketplace 与维护契约

**Files:**
- Modify: `.claude-plugin/marketplace.json`
- Create: `.agents/plugins/marketplace.json`
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `hooks/README.md`
- Modify: `scripts/plugin-dream-baseline.mjs`
- Modify: `hooks/plugin-dream-baseline.test.mjs`
- Modify: `docs/dev/INDEX.md`

- [x] **Step 1: 写 marketplace/path RED 测试**

Claude source 必须指向 `./plugins/claude/nocode`；Codex source 必须指向 `./plugins/codex/nocode`；version 只读 `plugin/metadata.json`。

- [x] **Step 2: 运行 RED**

Expected: FAIL，Claude marketplace 仍是 `./.`。

- [x] **Step 3: 切换 marketplace 并更新维护文档**

AGENTS/CLAUDE 规则改为：修改业务源、adapter、运行脚本时 bump `plugin/metadata.json`，运行 `compile.platform.mjs`，同 commit 提交双生成物。

- [x] **Step 4: 更新增量监控范围**

`plugin-dream-baseline.mjs` 监控 common source、adapter、metadata、compiler 和两个 marketplace；生成物本身不作为“源是否变化”的判断依据。

- [x] **Step 5: 标记 spec/plan 状态**

设计 spec 改 `approved / implemented`，INDEX 同步；plan 勾选完成项。

### Task 9: 全量发布验证

**Files:**
- Modify only if verification exposes defects.

- [x] **Step 1: 生成链检查**

```bash
node scripts/compile.rule.js --check
node scripts/compile.hooks.js --check
node scripts/vendor-sync.mjs --check
node scripts/compile.platform.mjs --check
```

- [x] **Step 2: 全量测试**

```bash
node --test 'hooks/*.test.mjs'
node --test scripts/worktree-setup.test.mjs
node --test skills/agents-launcher/*.test.mjs skills/agents-launcher/lib/*.test.mjs skills/agents-launcher/lib/server/*.test.mjs
node --test skills/dev-land/references/pr-check.test.mjs
python3 -m unittest commands/sow-reference/test_script.py
```

- [x] **Step 3: 双插件静态验证**

```bash
node scripts/check-skills.mjs --check --root plugins/claude/nocode --platform claude
node scripts/check-skills.mjs --check --root plugins/codex/nocode --platform codex
python3 /Users/yes365/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/codex/nocode
git diff --check
```

- [x] **Step 4: 安装说明与 smoke receipt**

记录 Claude/Codex 从各自 marketplace 安装、Skill 发现、SessionStart、PreToolUse 的人工 smoke 命令。当前环境不能替用户操作 ChatGPT desktop UI 的步骤明确标 `manual pending`，不伪造通过。

- [x] **Step 5: 自审 diff**

逐项核对设计成功标准、生成物 allowlist、版本单源、无另一平台上下文泄漏、无误带 `vendor/codex` 到 Codex 发布物。

- [ ] **Step 6: 请求 commit 授权**

按仓库约束先展示 `git status`、`git diff --stat`、测试证据和建议 commit message；用户确认后才创建 commit，不自动 push。
