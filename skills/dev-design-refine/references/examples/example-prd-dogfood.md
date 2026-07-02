---
type: prd
topic: nocode——Harrison 个人 Claude Code 工具箱
date: 260511
author: 3dot141
status: approved
---

# PRD：nocode

> dogfood：以 nocode 插件本身作为 PRD 示例。演示新 PRD 骨架（背景 / 目标 / 用户场景 / 验收标准）下"主因辅因 / 场景结构化 / 验收标准 + 明确排除"的写法。

## 背景

**核心问题**：跨多个 Claude Code 会话工作时，**项目背景知识（设计决策、约定、术语）反复丢失**——每开新会话都要重新解释项目特有约定，平均浪费 8 分钟/次。

**附带问题**（本 PRD 一并解，但不是 driver）：

- 每个新项目手动 setup 类似规则 / skill / agent，耗时 30-60 min 且易遗漏
- 不同项目里 AI 行为不一致——同样的"写设计文档"在 A 项目按规范，在 B 项目乱写
- 设计文档质量参差——靠 prompt 即时驱动，没有结构化模板

不解决的代价：每天 5-10 次会话 × 8 分钟 = 40-80 min/天浪费在重复解释；跨项目工作时 AI 体验持续低于预期。

## 目标

- **跨会话延续**：新会话开始 AI 主动 search 项目记忆，≥ 80% 会话不再重新解释项目背景
- **跨项目规则一致**：通过 plugin 统一加载 agent-karpathy，所有项目共享行为基线
- **项目本地覆盖**：项目特定约定（如 `{username}`）可以覆盖默认值
- **结构化设计文档**：4 类 doc-type（PRD / RFC / Design Doc / ADR）骨架统一
- **配置时间**：新项目 setup 从 30-60 min 降到 < 5 min

## 用户场景

#### 场景一：跨项目工作切换

- **角色**：Harrison（多项目并行开发者）
- **触发**：上午在 project-A（后端服务）讨论 auth 设计，下午切到 project-B（前端应用）
- **当前流程**：开 project-B 会话 → AI 不知道 B 的命名约定 → Harrison 重新解释 5-10 分钟 → 才能讨论 UI
- **期望流程**：开 project-B 会话 → AI 加载 nocode 全局规则 + B 的 `.agents-personal/AGENTS.md` 覆盖 → 立即按 B 的约定工作
- **痛点定位**：切项目时的 5-10 分钟"AI 重新校准期"

#### 场景二：写设计文档

- **角色**：Harrison（设计文档作者）
- **触发**：在 project-A 让 Claude "设计一下新的 notification service"
- **当前流程**：Claude 自由发挥 → 输出结构混乱 / 缺 Non-Goals / 没考虑失败模式 → Harrison 反复 prompt 微调
- **期望流程**：Claude 触发 design-doc-writing skill → 识别 doc-type → 按新骨架生成 → reviewer subagent 自动评审 → Harrison 逐条确认修订
- **痛点定位**：缺结构化模板时 prompt 微调的 30-60 分钟反复

#### 场景三：跨会话记忆

- **角色**：Harrison（一周后回访同一项目）
- **触发**：一周前讨论过 project-A 的 auth 架构，跑了 `/wiki-update` 沉淀；今天新会话问"auth 是怎么处理的"
- **当前流程**：Claude 不知道历史 → Harrison 重新解释或 grep 历史会话
- **期望流程**：Claude 受 overlay-wiki rule 驱动主动 `ls .agents-personal/wiki/` → Read INDEX → Read 相关 page → 引用历史决策
- **痛点定位**：跨会话记忆完全靠人工 grep 历史

## 验收标准

- [ ] 新项目 install plugin 后，**5 min 内**能跑通 SessionStart hook 注入 4 个 rule
- [ ] 写设计文档**自动选对 doc-type**（4 选 1 准确率 ≥ 80%）
- [ ] reviewer 至少能 catch 3 类问题：缺主因辅因划分 / 元标签作 H2 / 架构问题与实现逻辑不映射
- [ ] wiki INDEX 自动派生，新会话 AI 能主动 search（≥ 80% 命中）
- [ ] 跨项目行为一致——同一份 design-doc-writing skill 在 3 个不同项目调用，产出骨架完全一致

**明确排除**：

- ❌ **公开 marketplace 发布**——个人工具，不为社区维护
- ❌ **AI 写代码核心能力**——Claude Code 自带，本插件只做配置层
- ❌ **跨用户协作 / 团队权限**——单人工具，不考虑团队场景
- ❌ **GUI 配置界面**——纯 CLI / file-based，不做 web UI
- ❌ **支持非 Claude Code 工具**（如 Cursor / Aider / Codex）——单一目标平台
- ❌ **自动迁移旧 design doc 格式**——手动迁移即可，旧 doc 数量少
