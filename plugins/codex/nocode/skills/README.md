# skills/

nocode 插件的 skill 源码目录。每个子目录是一个独立 skill（`<name>/SKILL.md` + 可选 `<name>/references/`），由 Claude Code 按 SKILL.md frontmatter 里的 `description` 自动匹配触发，或被用户 `/slash` 命令、其它 skill 显式调起。

## 目录结构

```
skills/
├── <36 个 skill 目录>/SKILL.md      # 各 skill 定义，自动发现
├── references/                      # 共享领域指南库（非 skill，独立 AGENTS.md/README.md）
└── .claude/                         # 与本插件无关的隐藏目录，忽略
```

部分 skill 还有自己的私有 `<skill>/references/`（如 `dev-plan/references/`、`dev-build/references/`），存放该 skill 专属的细节文档——与共享的 `skills/references/` 是两个不同层级，不要混淆。

## Skill 分类一览

### 工程阶段（dev-*，devflow 编排）

| Skill | 一句话 |
|---|---|
| `devflow` | 工程任务流程领航，8 阶段 4 场景路由，给"当前阶段判断 + 下一步建议"，用户拍板不代执行 |
| `dev-define` | 需求定义澄清（restate 目标 / 为谁 / 为何现在 / 成功标准） |
| `dev-design` | 设计流程协调器（decision 选方案 → writing 详细设计+评审 → render 渲染），三阶段内部协议不独立注册 |
| `dev-plan` | 把已定义目标拆成可执行任务计划 |
| `dev-build` | 按 plan 执行实现（顺序派发 subagent 或主 agent 直接执行两种协议） |
| `dev-verify` | 端到端验证实现是否真的可用（先跑起来看证据，不靠读代码推断） |
| `dev-review` | 代码 / diff 评审（五轴 + reviewing 方法库，主路评审 + 升档异源双评） |
| `dev-land` | 着陆收尾：意图推定 → 全景计划 → 全自动执行（PR/merge/keep/discard + post-merge） |

### 产品阶段（pd-*，pdflow 编排）

| Skill | 一句话 |
|---|---|
| `pdflow` | 产品发现流程领航（Research → PRD，2 场景路由），独立于 devflow |
| `pd-research` | 定方案前先探索问题域（竞品 / 市场 / 已有方案） |
| `pd-prd` | 撰写产品需求文档（PRD） |
| `pd-ix` | 交互设计：信息架构 / 页面流 / 交互拆解，产出 `.ix.md` |
| `pd-vd` | 视觉设计：配色 / 原型 / wireframe，产出 `.vd.md` + 可选 `.prototype.html` |

### 工具类（外部 CLI / API / 服务封装）

| Skill | 一句话 |
|---|---|
| `agents-launcher` | 本仓 fx-data-agents 三服务（web/agents/server）本地 dev 启停编排 |
| `bkt` | Bitbucket CLI（仓库 / PR / 分支 / issue / webhook / pipeline） |
| `claude-design` | Claude Design 项目的终端操作（建项目 / 读写文件 / 预览 / 设计系统 / 分享） |
| `lark-project` | 飞书项目管理（工作项读取含附件 / 状态流转 / 搜索 / 创建更新） |
| `lark-read` | 完整读取飞书文档（文字 + 嵌入图片） |
| `signoz-cli` | 查询 SigNoz 的 trace / log / metric，跑 PromQL/ClickHouse SQL |

### 方法论类（跨阶段通用能力）

| Skill | 一句话 |
|---|---|
| `brainstorming` | 创意工作前的意图 / 需求 / 设计探索对话（vendor: superpowers） |
| `caveman` | 精简回复模式，省 token，"正常模式" 前持续生效 |
| `continuous-learning-v2` | 基于 instinct 的会话观察学习系统，置信度评分并演化为 skill/command/agent（vendor: everything-claude-code） |
| `dispatching-parallel-agents` | 2+ 独立任务的并行 subagent 派发方法论（vendor: superpowers） |
| `eval-harness` | EDD（eval 驱动开发）正式评估框架（vendor: everything-claude-code） |
| `receiving-code-review` | 接收 review 反馈时先验证再实现，不盲从（vendor: superpowers） |
| `red-blue-deep` | 评估 / 拍板类问题的红蓝军辩论框架，轻档一句表态、重档四步走 |
| `refactor-clean` | 轻量清理型重构：删死代码 / 清未用依赖 / 消除重复 |
| `research-workflow` | 通用研究引擎，被 pd-research / dev-define / dev-design / brainstorming 等按需调用，不直接面向用户 |
| `reviewing` | review 通用方法论底座（7 步流程骨架 + 方法库 + 统一 findings 契约），被各专项 review 引入 |
| `skill-writing` | 创建 / 编辑 / 测试 / 优化 skill 的 TDD 方法论，替代 writing-skills 和 skill-creator |
| `strategic-compact` | 在逻辑阶段边界建议手动 `/compact`，而非依赖任意时机的自动压缩（vendor: everything-claude-code） |
| `systematic-debugging` | 提出修复前先系统化定位根因（vendor: superpowers） |
| `using-git-worktrees` | 建立 / 清理隔离工作区（`git worktree add -b` 创建 + `Codex workdir(path)` 进入）（vendor: superpowers，fork 改造版） |

## 与 commands/、agents/ 的关系

- **commands/**：用户 `/slash` 命令入口。是 skill 的可选显式触发面，多对多——一个命令可能路由到一个或多个 skill（如 `/nocodehub` 聚合入口），一个 skill 也可能没有对应命令、只靠触发词自动调起。
- **agents/**：subagent 定义（`architect` / `code-reviewer` / `database-reviewer` / `security-reviewer` / `planner` / `tdd-guide` 等），是 `dev-review`、`dev-design`、`dev-plan`、`dev-build` 等 skill 在执行过程中派发的独立评审/规划 subagent，属于 skill 的执行资源。

新增 skill、修改 SKILL.md、workflow 类登记流程等细节见本目录 `AGENTS.md`。
