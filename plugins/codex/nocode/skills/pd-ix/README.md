# pd-ix

交互设计 skill — 产品流第三阶段（交互部分）。

从 PRD 出发，通过竞品交互分析 + 逐交互五块拆解 + IA 汇总 + 场景脚本 + 完整性四查，产出 `.ix.md`（交互规范）。

## 产出

- `{topic}.ix.md` — 信息架构、页面流、交互清单、ASCII 线框、状态覆盖枚举、行为规格、场景脚本、完整性四查、下游澄清回流节

与 pd-vd 的分工判据与共享术语单源在 `${PLUGIN_ROOT}/shared/references/ix-vd-contract.md`。

## 在产品流中的位置

```
pd-research → pd-prd → pd-ix → pd-vd → devflow
                         ↑ 你在这里
```

pd-ix 产出 `.ix.md` 后，用户可以：
- 进 pd-vd 加视觉设计（推荐，有界面需求时）
- 直接进 devflow 开发（交互规范已足够指导实现）

## 拆分历史

pd-ix 和 pd-vd 由原 pd-ui skill 拆分而来（260630）。拆分原因：交互和视觉混在一个 skill 里，边界不清导致跳步（跳过交互规范直接出原型）。拆开后每个 skill 范围更小，跳步空间被消除。

## 下游消费者

- `pd-vd` — 以 `.ix.md` 为输入做视觉设计
- `dev-design` — Step 2 读 `.ix.md` 理解 UI 需求
- `dev-review` — 以 `.ix.md` 的覆盖矩阵对照前端实现完整度
- `dev-design` — 交互设计 → 细化为前端组件
