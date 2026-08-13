---
name: agents-launcher
disable-model-invocation: true
description: >-
  Use when explicitly starting, stopping, restarting, or checking the local fx-data-agents
  web/agents/server development stack from a main checkout or worktree. Not for production
  deployment, unrelated repositories, or changing service business code.
---

# agents-launcher — 本地开发服务编排

本 Skill 只保留跨域编排。web、agents、server 的具体准备、启动、健康检查和排障规则按需加载，禁止一开始读取全部域文档。

## 渐进加载

先判断目标服务，再完整读取所需域文档：

| 目标 | 必须读取 |
|---|---|
| 默认 `ui`（web + agents） | `references/agents.md`、`references/web.md` |
| `agents`（ui + Docker） | `references/server.md`、`references/agents.md`、`references/web.md` |
| `full`（ui + Docker + Spring） | `references/server.md`、`references/agents.md`、`references/web.md` |
| 只 agents | `references/agents.md`；pg/minio 未就绪时再读 `references/server.md` |
| 只 web | `references/web.md` |
| 只 server / Docker | `references/server.md` |

规则：

1. 域文档必须在对该域采取动作前读完。
2. 没有进入某个域，不读取它的文档。
3. 启动中临时扩大范围时，先读取新域文档，再更新 launch plan。
4. 跨域依赖由本文件编排；域内实现细节以对应文档为准。

## 服务范围

| 用户表述 | workspace / 裁剪 |
|---|---|
| “起 dev”“重启服务”，未指定范围 | `--workspace=ui` |
| “含 Docker”“起中间件” | `--workspace=agents` |
| “全栈”“含 Spring”“含后端” | `--workspace=full` |
| “只 agents” | `--workspace=ui --no-web` |
| “只 web” | `--workspace=ui --no-agents` |

默认不升级到 `full`。用户明确说 full 时不再二次确认范围。

服务依赖顺序：

```text
Docker 基础设施 → agents → Spring → web
```

## 决策分级

| 类型 | 示例 | 处理 |
|---|---|---|
| 无损、幂等、worktree 局部 | 复用 worktree、补 gitignored 配置、改 worktree `.env.local` | 自动执行，最终汇报 |
| 影响共享状态或不可逆 | reset、改主仓文件、重启正在运行的服务、混搭主仓、替换主仓 agents | 先确认 |

不要把无损准备动作拆成连续确认；也不要替用户决定共享状态变更。

## 入口与路径

运行单源：

```text
${NOCODE_PLUGIN_ROOT}/skills/agents-launcher/dev-orchestrator.mjs
```

launcher 位于插件目录，不能从自身位置推断 fx 仓。每次启动必须显式提供：

| 环境变量 | 目标 |
|---|---|
| `FX_AGENTS_DIR` | fx-data-agents 主仓或目标 worktree |
| `FX_WEB_DIR` | fx-data-web 主仓或目标 worktree |
| `FX_SERVER_DIR` | fx-data-server 主仓或目标 worktree，仅 server 域需要 |

`${NOCODE_PLUGIN_ROOT}` 是文档占位符。构造命令时替换成当前插件根的真实绝对路径，不把占位符原样交给 shell。

## 通用流程

### Step 1 — 识别动作与范围

区分四类动作：

- status：只查询，不准备、不启动。
- stop：按目标域停止，不启动。
- start：目标服务未运行时启动。
- restart：用户明确要求重启时允许替换现有进程。

根据范围表选择服务并加载域文档。

### Step 2 — 解析仓来源

主仓启动直接使用各域主仓路径。当前位于 worktree 时，为每个启用域解析目标路径：

1. 优先复用挂载目标分支的同名 worktree。
2. 该域没有本分支改动时，可复用 base worktree。
3. 配套仓主仓正停在 base 时，可作为混搭候选，但它属于共享状态，按域文档判断是否需要确认。
4. 全部落空时停止并让用户选择：挂 worktree、混搭主仓、跳过该域或自行处理。

目标分支必须来自 `git branch --show-current`，不能根据目录名猜。禁止为了凑路径在主仓 checkout feature 分支，禁止臆造不存在的 worktree 路径。

先形成 launch plan：

| 域 | 路径 | 来源类型 | branch | 准备动作 |
|---|---|---|---|---|
| agents | `<path>` | 主仓 / worktree / base worktree | `<branch>` | 由 `agents.md` 给出 |
| web | `<path>` | 主仓 / worktree / base worktree | `<branch>` | 由 `web.md` 给出 |
| server | `<path>` | 主仓 / worktree / base worktree | `<branch>` | 由 `server.md` 给出 |

未启用的域不出现在计划里。

### Step 3 — 执行域准备

按依赖顺序调用各域文档：

1. server 域准备 Docker/Spring；需要 Docker 时由 launcher 按 server 分支选择固定脚本。
2. agents 域准备配置与本地服务。
3. web 域准备 `.env.local`、包管理器和跨仓指向。

域文档返回的路径和环境变量合并到最终启动命令。任何域准备失败都停止，不启动剩余域。

### Step 4 — 启动前状态检查

统一使用：

```bash
node <插件根>/skills/agents-launcher/dev-orchestrator.mjs --status
```

不要手写 curl、nc 或 lsof 轮询。

目标服务已经运行且用户没有明确说“重启”时，先询问保留还是重启。用户明确说“重启”时直接继续。

### Step 5 — 启动

基础命令：

```bash
FX_AGENTS_DIR=<agents 路径> \
FX_WEB_DIR=<web 路径> \
node <插件根>/skills/agents-launcher/dev-orchestrator.mjs \
  --workspace=<ui|agents|full> [--no-<service>] --yes
```

涉及 server 域时追加：

```bash
FX_SERVER_DIR=<server 路径>
```

launcher 是长驻进程，必须后台启动并记录 task/session ID。禁止绕过 launcher 直接运行 `pnpm dev:server`。

### Step 6 — 健康确认与汇报

launcher 等待各域健康并打印：

```text
就绪 → http://localhost:10001/decision/home
```

完成后再运行一次 `--status`，汇报：

1. 每个服务的端口与 PID。
2. 访问入口。
3. 后台 task/session ID。
4. 每个域的来源路径、branch、主仓/worktree 类型。
5. 自动执行的准备动作。
6. 混搭主仓产生的待还原文件。
7. `tsx watch` 已开启，普通 TS 修改无需重启。

## 停止

优先停止已知后台 task/session，让 orchestrator 执行 teardown。task 未知时：

```bash
node <插件根>/skills/agents-launcher/dev-orchestrator.mjs \
  --stop --workspace=<ui|agents|full>
```

Docker 默认不停；只有用户明确说“停 Docker”才执行 server 域文档中的停止动作。

## 总体禁手

- 不默认扩大服务范围。
- 不在主仓切 feature 分支。
- 不臆造仓路径或 worktree。
- 不自动 reset、覆盖主仓文件或替换正在运行的共享服务。
- 不手写端口轮询和进程清理命令。
- 不绕过域文档直接拼 server、agents 或 web 的启动细节。
- 不把域内故障排查规则重新堆回本文件。
