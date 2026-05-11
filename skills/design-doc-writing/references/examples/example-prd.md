---
type: prd
topic: nocode-evolve——Harrison 个人 Claude Code 工具箱
date: 260511
author: 3dot141
status: approved
---

# PRD：nocode-evolve

## Problem Statement

我个人用 Claude Code 跨多个项目时遇到：

1. **重复配置**：每个新项目都要手动 setup 类似规则、skill、agent，耗时且易遗漏
2. **缺一致性**：不同项目里 AI 行为不一致——同样的「写设计文档」在 A 项目按规范，在 B 项目可能乱写
3. **项目记忆丢失**：跨会话讨论决策（"为什么选 X 不用 Y"）经常重复解释，AI 不记得
4. **设计文档质量参差**：靠 prompt 即时驱动，没有结构化模板

不做的代价：每次新项目花 30-60 分钟手动设置；跨会话信息丢失；AI 输出质量随机。

## Target Users

- **主用户**：Harrison（我自己）——用 Claude Code 高频处理多项目的个人开发者
- **次用户**：未来可能开源给社区，但当前不优先

使用频率：每天 5-10 次会话，跨 3-5 个活跃项目。

## Goals

1. **跨项目规则一致**：通过 plugin 加载，所有项目共享 agent-guidelines
2. **项目本地覆盖**：项目特定约定（如 `{username}`）可以覆盖默认值
3. **结构化设计文档**：标准化 PRD / RFC / Design Doc / ADR 4 类
4. **项目级记忆**：跨会话沉淀项目知识（wiki 系统）

## Non-Goals【明确不做】

- ❌ **公开 marketplace 发布**——个人工具，不为社区维护
- ❌ **AI 写代码的核心能力**——Claude Code 自带，本插件只做配置层
- ❌ **跨用户协作**——单人工具，不考虑团队场景
- ❌ **GUI 配置界面**——纯 CLI / file-based，不做 web UI
- ❌ **支持非 Claude Code 工具**（如 Cursor / Aider）——单一目标平台

## Success Metrics

1. **配置时间**：新项目 setup 从 30-60 min 降到 < 5 min
2. **设计文档一致性**：跨项目文档结构一致（按 doc-type 模板）
3. **跨会话延续**：新会话开始 AI 主动 search wiki，≥ 80% 会话不再重新解释项目背景
4. **个人满意度**：感觉每个会话都"AI 懂我项目"

## User Stories

**Story 1：跨项目工作切换**

Harrison 上午在 project-A（backend service）讨论 auth 设计，下午切到 project-B（frontend app）继续 UI 工作。两个项目都加载 nocode-evolve plugin，相同的 agent-guidelines 保证 AI 行为一致；项目本地的 `.agents-personal/AGENTS.md` 各自覆盖项目特定约定。

**Story 2：写设计文档**

Harrison 在 project-A 让 Claude "设计一下新的 notification service"。Claude 触发 design-doc-writing skill，识别这是 system-level → 加载 architecture + implementation layer-supplements，生成两半结构的 design doc。reviewer subagent 自动检查质量，writer 修订 1-2 轮后通过。

**Story 3：跨会话记忆**

一周前 Harrison 讨论过 project-A 的 auth 架构，跑了 `/wiki-update` 沉淀。今天新会话问 "auth 是怎么处理的"，Claude 受 overlay-wiki rule 驱动主动 `ls .agents-personal/wiki/` → Read INDEX → Read 相关 page → 引用历史决策。

## Acceptance Criteria

- [ ] 新项目 install plugin 后，5 min 内能跑通 SessionStart hook 注入 4 个 rule
- [ ] 写设计文档自动选对 doc-type（4 选 1 准确率 ≥ 80%）
- [ ] reviewer 至少能 catch 3 类问题：缺 Non-Goals / 缺 Alternatives 否决理由 / 章节空话
- [ ] wiki INDEX 自动派生，新会话 AI 能主动 search

## Out of Scope

- 多用户协作 / 团队权限管理
- 与 Cursor / Aider / Codex 等其他 AI 工具的兼容
- Web 配置 UI
- 商业化分发（marketplace 收费）
- 自动迁移旧 design doc 格式（手动迁移即可）
