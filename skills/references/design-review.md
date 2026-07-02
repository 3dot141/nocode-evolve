# design-review — 技术设计评审

**评审对象**: dev-design 的设计文档产出

## 引入 reviewing 框架

本细则**引入 `reviewing` 框架**，通用流程（分档 / 对象界定 / 独立交叉 / 分级 / 收口）走框架，本文只填**设计领域的评审维度**（框架第 3 步注入点）。

1. `Read {NOCODE_SKILL_REF}/reviewing/skeleton.md` —— 套 7 步通用流程骨架。
2. `Read {NOCODE_SKILL_REF}/reviewing/findings-contract.md` —— 套 findings/verdict schema 与 C/W/S 分级、Evidence Gate。

**对象 → 方法**（skeleton §3 方法选择表「设计文档」行）：主方法 `checklist`（本文 10 维度，主路自审默认）；`dual-review`（异源双评 + 总结）是升档预案（skeleton §1a 命中才派）。

- **分档**（skeleton §1 自动判）：设计文档涉及架构/选型/不可逆决策 → **重档**（10 维度全量自审）；纯文案/局部澄清类轻量改动、拿不准 → **轻档** self-review（这是判档不是降档，agent 自判不需授权）。命中重档信号后要降 → 只认用户显式否定词。两档都不默认派独立交叉——何时派见 skeleton §1a 升档判据。
- **独立交叉**（skeleton 步骤 5 + §4.1/§4.2，仅升档——自审后命中 §1a 判据：无法自行裁决的 finding / 结论有争议 / 用户显式要求深审）：CLAIM 剥离 + Context Capsule 后把设计文档原文 + 本文维度表 + 中立事实包（已拍板决策 / 被否决方案及原因 / 非目标）交 Codex（经 `rule-codex-review`）独立评审——**不传主路结论、不传方案选择倾向**（设计评审特有：方案倾向最易污染独立路）。Codex 调用报错 → fallback 改派 general-purpose subagent 独立路单跑（标注降级，独立性记「同模型」），不自演。
- **分级 / 收口**（skeleton 步骤 6/7 + findings-contract）：findings 套统一 schema，C/W/S 分级，Critical 必修才放行。修完 findings 的重跑判据走 skeleton §4.6（delta review，纯修复不重跑独立路）。

## 审查维度（设计领域，框架第 3 步注入）

| 维度 | 检查什么 |
|---|---|
| 方案对比公正性 | 2-3 方案真正差异化？不是一个好方案 + 两个稻草人？pros/cons 各自列全了？ |
| 架构合理性 | 模块边界/职责划分/依赖方向合理？与现有 pattern 一致还是有理由偏离？ |
| TO 覆盖 | 每条路径和约束都有对应 TO？跨域 TO 和领域 TO 不重复也不遗漏？ |
| verify 策略可行 | 测试分层合理？不测项的风险评估充分？ |
| pre-mortem | 做了 pre-mortem 吗？top 3 死因在方案里有应对措施或显式接受风险？ |
| 安全 | 引入新攻击面吗？轻量 STRIDE 做了吗（涉及外部输入/认证/数据时）？ |
| 性能 | 数据量级/响应时间预估合理？同步异步/轮询推送选型有性能考量？ |
| 目标漂移 | 方案还在服务原始目标？有没有为了方案优雅偷偷改了目标？ |
| UI 设计（涉及前端时） | 有 UI 设计节吗？组件清单/布局/交互行为/design taste skill 引用到位？ |
| 简化检查 | 方案有没有过度工程？能不能用更简单的方案达到同样效果？有没有为假设的未来需求增加当前复杂度？ |

## findings 产出

按 `findings-contract.md` 产出：每条问题套 finding schema（`id`/`severity`/`kind`/`axis`=上表维度名/`location`/`evidence`/`finding`/`fix`/`source`），顶上加 verdict。设计评审多为方案/文档事实，代码事实类 finding（引用具体代码路径/签名）按 Evidence Gate 要求带 `location`。
