# Skill 折叠方案 — 红蓝对抗评估记录

> 状态快照，防会话中断/压缩丢失。评估已完成，**尚未执行任何改动**，等待用户拍板范围。

## 背景

本次会话围绕 nocode 插件做 context/token 精简，经历过一次 24-skill 自动化压缩批次的数据污染事故（`reviewing` description 被写成字面 schema 占位符、`dev-land` description 混入 YAML 语法泄漏），已 `git revert efcccef` 全部撤销。

在此基础上，用户提出更激进的架构改造：把"折叠子 skill 进协调器，只留一个常驻 description"这套模式应用到 5 个目标。用户原话验收标准："只要保证调用没问题就可以"。

## 5 项提案

1. **larkhub**：`commands/larkhub.md` 改造成真正的 skill，聚合吸收 nocode 自己的 `lark-project`/`lark-read` + 用户级 `~/.claude/skills/` 下的 `lark-doc`/`lark-shared`/`lark-wiki`（属于另一个独立 lark 系插件）
2. **devflow**：聚合吸收 8 个阶段 skill（`dev-define`/`dev-design`/`dev-plan`/`dev-build`/`dev-verify`/`dev-review`/`dev-land`/`dev-finish-branch`）
3. **dev-design**：聚合吸收 3 个子阶段（`dev-design-select`/`dev-design-refine`/`dev-design-render`）
4. **pdflow**：聚合吸收 4 个阶段 skill（`pd-research`/`pd-prd`/`pd-ix`/`pd-vd`）
5. **frontendhub**（新建）：把用户级 `~/.claude/skills/` 下 `gsap-*` 系列 8 个 + `design-taste-frontend`/`high-end-visual-design`/`industrial-brutalist-ui`/`minimalist-ui`/`redesign-existing-projects` 直接拷贝进 nocode 插件仓库

## 已核实的技术约束

- Claude Code skill 发现只认 `<name>/SKILL.md` 精确路径；子内容挪成协调器 `references/` 下的非 SKILL.md 文件会从常驻列表消失。`disable-model-invocation: true` 是"只能用户手动调，模型完全不能调"，不是"隐藏但仍可内部调用"——这条路走不通。
- 折叠唯一可行实现：子内容变成协调器自己 `references/` 下的纯文本文件，协调器正文维护路由表，命中后 `Read` 该文件、照着执行——**不再有独立的 `Skill(nocode:dev-build)` 调用**，等于把"skill 调用"降级成"读文件 + 自己照做"。
- 现有 hub 模式（`personalhub`/`larkhub`/`nocodehub`）不是这个模式——只是加聚合入口，被聚合的子命令仍独立注册可调用，常驻开销一分没省。这次要做的是更激进的真正折叠（删除子项独立注册）。
- devflow/pdflow/dev-design 是插件核心骨架（8 阶段路由的顶层编排入口），不是边缘工具。
- `lark-doc`/`lark-shared`/`lark-wiki`、`gsap-*`、5 个视觉方向 skill 全在 `~/.claude/skills/`（用户级，跨项目共享，不在本仓库、无版本控制、无 vendor-sync 机制）。

## 红蓝对抗评估结论

### 风险分层（sequential-thinking 阶段识别）

| 类别 | 项目 | 风险性质 |
|---|---|---|
| A. 核心执行语义迁移 | devflow / pdflow / dev-design | 删除现有 `Skill()` 调用回执这个确定性硬 Gate，换成"Read 文件 + 自己照做"的软约束 |
| B. 入口/认证边界迁移 | larkhub | 吸收外部 lark 系插件能力说明，但认证身份/CLI/scope 等运行时依赖不会跟着文本搬过来 |
| C. 未审计供应链引入 | frontendhub | 直接拷贝跨仓库内容，跳过本仓库已有的 `vendor-sync.mjs` + `vendor-integration.json` 纪律 |

### 蓝军论点（成立但不足以支撑"一次性全量做"）

减少顶层认知入口、协调器可集中管理状态、减少多 skill 竞争触发——这些价值分批做同样能拿到，不需要绑定"一次性全量 + 同样的自动化验证方式"。

### 独立审查（Codex，只读检查，未修改工作区）关键发现

- `devflow`/`pdflow` 的 SKILL.md 明确把"没看到 Skill 调用回执 = 跳步 bug"写成硬约束，且记录过真实故障案例（`skills/devflow/SKILL.md:64`、`skills/pdflow/SKILL.md:89`）。折叠会主动拆掉这套保障，不是简单文件搬家。
- 上一批 24-skill 压缩已证明"workflow 生成路由 + agent 验证"这条链路存在未被发现的失败模式，本次若沿用同一套自动化验证方式，不会自动免疫同样的问题。
- frontendhub 直接拷贝不会减少 skill 发现数量（用户级原件还在），反而变成"两份并存各自漂移"，且许可证/来源未审查。
- 现有 benchmark 不覆盖 pdflow/larkhub，不足以当验收门控。
- 相关代码约 4507 行；三种失败模式（执行语义迁移 / 认证边界迁移 / 供应链引入）验收标准完全不同，混在一批会让"整体验证通过"掩盖局部失败。

完整 Codex 审查原文（优势/弱点/盲区/替代方案/推荐批次）见本次会话记录中 agent `af70d62312159791e` 的最终结果，未另存副本——如需要可重新派发同类独立审查复核。

### 最终结论

**不建议一次性做完 5 项。** 分批执行，按风险从低到高：

- **批次 0（先做）**：不折叠任何 skill。先建路由/断链静态检查 + frontmatter 占位符检测（专门拦截 `description="..."` 泄漏这类问题）+ coordinator↔child 契约测试。
- **批次 1**：`larkhub` 从 command 升级成真正的 skill，但**不吸收、不删除**子 skill（`lark-project`/`lark-read` 仍独立可调）。低爆炸半径，先验证 hub 模式本身有没有用。
- **批次 2**：`dev-design` 走影子模式试点——reference 路由和原生 `Skill()` 两条路径并存，多个全新会话比对，原生子 skill 先不删。
- **批次 3**：`pdflow`，待批次 2 稳定后再做。
- **批次 4（最高风险，放最后）**：`devflow`。
- **frontendhub 独立处理**，不与以上批次绑定：13 个 skill 逐个审查内容/依赖/许可证，决定"调用现有的"还是"走 vendor 流程"，不做一次性硬拷贝。

**本轮建议最多做**：批次 0 + larkhub 入口升级，其余留到后续会话分别验证。

## 当前状态

结论已呈现给用户，**用户尚未拍板**具体执行范围。下一步等用户明确选择要不要先做批次 0 / larkhub，或有其他范围调整。
