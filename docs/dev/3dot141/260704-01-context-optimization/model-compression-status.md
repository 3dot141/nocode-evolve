# model/*.md SkillOpt 压缩 — 进度快照

> 状态快照，防会话中断/压缩丢失。目标：把 SessionStart 常驻注入的 model/*.md 文件压到硬指标以内，且用 eval bank 验证压缩后行为不回归。

## 口径统一说明

**全文统一用字符数（`wc -m`），不用字节数（`wc -c`）。** 本文档早期版本曾混用 `wc -c`（字节，UTF-8 下中文 1 字符 = 3 字节）报数字，跟 workflow 内部（JS `.length`，即字符数）的口径对不上，一度误判为"数据异常"，核实后确认只是单位不同、内容一致。以下全部数字均为字符数。

## 目标 vs 结果

| 文件 | 压缩前（字符数） | 压缩后（字符数） | 目标 | 达标? |
|---|---|---|---|---|
| `model/agent-about.md` | 7705（基线）/ 7760（当前磁盘） | **7289** | ≤5000 | ❌ 差 2289，仅降 5.4% |
| `model/agent-catalog-using.md` | 4807 | 4807（0 次编辑） | ≤5000 | ✅ 本来就已达标 |
| `model/agent-personal.md` | 2609 | 2609（0 次编辑） | ≤4000 | ✅ 本来就已达标 |
| `model/agent-karpathy.md`（不压缩，只作 workflow 输入） | 2558 | 不变 | 不变 | — |
| `model/agent-catalog-1.md`（不在本次压缩范围） | 2898 | 不变 | 不变 | — |

5 个文件字符数合计 20,634（压缩前）。**当前磁盘文件仍是压缩前内容，压缩结果尚未落盘**——workflow 无文件系统权限，只返回 `result`，需人工应用。

## 方法论

SkillOpt 式验证门控：7 条规则 × {train, val} = 14 个 eval case，train 用于指导优化器提议避免重复踩坑，val 是留出集只用于验收门控（优化器提议阶段看不到 val 场景文本）。有界编辑循环，每 4 次接受做一次留出集验证，不掉分才接受。

## Workflow 执行记录

| Run ID | 状态 | 说明 |
|---|---|---|
| `wf_c44655d1-513` | **failed** | 第一次跑，Baseline 阶段（还没开始压缩）即崩溃：`Error: undefined is not an object (evaluating 'initialDrafts.about.length')`——args 被平台序列化成 JSON 字符串而非对象，脚本未做防御性解析 |
| `wf_ed66771e-9f4` | **completed**（task `w4gtkzcaq`） | 修复 bug 后重新 launch，303 个 agent 调用全部完成，无 error/skip。耗时约 4.3 小时（`durationMs: 15410707`），总 token 14,725,880 |

- **script 路径**：`/Users/yes365/.claude/projects/-Users-yes365-AI-nocode-evolve/69796499-2df4-4423-8d6b-59566fc06ec8/workflows/scripts/compress-model-md-skillopt-wf_c44655d1-513.js`
- **完整结果**：`/private/tmp/claude-501/-Users-yes365-AI-nocode-evolve/69796499-2df4-4423-8d6b-59566fc06ec8/tasks/w4gtkzcaq.output`（含三份 `finalDraft` 全文 + 每轮 `acceptedLog`）

## 执行结果

- **baseline eval**：12/14 pass；**final eval**：12/14 pass，同一路径下失败的是同两个 case（`search-semble:train`/`search-semble:val`）——**非压缩引入的回归**。核实 journal 里几十条实际记录：这个 eval case 判据是 `uses_semble_search_not_raw_grep`，但沙箱化的 eval subagent 环境本身没有挂载 `Agent` 工具，所以每次都正确按规则的 fallback 分支退到 `rg` 并如实报告——这是遵守规则的正确行为，只是撞上 eval 判据本身没覆盖 fallback 分支这个设计缺陷，基线和压缩后表现完全一致。
- **agent-catalog-using.md / agent-personal.md**：workflow 自己判定已在目标以内，`totalAccepted: 0`，未做任何编辑——安全，无需人工介入。
- **agent-about.md**：`totalAccepted: 100`（用满 `MAX_ROUNDS.about = 100` 预算）、`totalRejectedRegression: 24`、`totalRejectedBadMatch: 0`。7705 → 7289，只降了 416 字符（5.4%），距 ≤5000 目标还差 2289 字符。看起来是内容本身可压缩空间有限（后期大量尝试被留出集验证拦下），不是轮数不够。

## 落盘前必须做什么（尚未执行，等待决策）

1. **人工逐字抽查 `about` 的 `finalDraft`**（不能只信自动化验证门控）：本会话已发生过 2 次自动化编辑数据污染事故（`reviewing` description 被写成字面 schema 占位符、`dev-land` description 混入 YAML 语法泄漏），两次都逃过了留出集验证门控。抽查重点：占位符字面量、YAML 语法泄漏、事实性内容是否被误删。
2. **决定 about 未达标怎么处理**：三个选项——(a) 接受 5.4% 的部分改进直接落盘；(b) 换策略重新压一轮（不同 prompt / 更激进的编辑粒度）；(c) 认为 5000 字符对这份内容不现实，跟用户重新协商目标值。**用户尚未选择，不要擅自落盘。**
3. **确认后用 Edit 手动应用**（workflow 无文件系统权限，不会自动写盘）。
4. **按 CLAUDE.md 规则升版本号**：`model/` 属于插件加载文件，改动需同一 commit 内升级 `.claude-plugin/plugin.json` 的 `version`（当前 `9.6.0`）。

## 当前状态

Workflow 已完成，结果已核对（无真实回归），但 `about` 未达标、且尚未落盘。等用户对上面第 2 点拍板。
