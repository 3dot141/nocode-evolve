# pd-vd

视觉设计 skill — 产品流第三阶段（视觉部分）。

以 `.ix.md` 为输入，通过视觉探索 + 方向选定 + 设计系统 + 原型生成 + Playwright 验证，产出 `.vd.md` + 可选原型。

## 产出

- `{topic}.vd.md` — 视觉方向、配色、排版、设计系统决策、验证记录
- `{topic}.prototype.html` — 可选原型（低保真 / 高保真 / 完整实现）

## 在产品流中的位置

```
pd-research → pd-prd → pd-ix → pd-vd → devflow
                                  ↑ 你在这里
```

pd-vd 以 pd-ix 产出的 `.ix.md` 为必要输入。没有 `.ix.md` 不能进入。

## 拆分历史

pd-ix 和 pd-vd 由原 pd-ui skill 拆分而来（260630）。拆分原因：交互和视觉混在一个 skill 里，边界不清导致跳步（跳过交互规范直接出原型）。拆开后每个 skill 范围更小，跳步空间被消除。

## 下游消费者

- `dev-design` — Step 2 读 `.vd.md` 理解视觉方向
- `dev-build` — 有原型时注入视觉清点纪律
- `dev-verify` — 复用 `interactions.json` / `screenshots/` 做验证
- `claude-design` — Step 3/4/6 调 claude-design 生成原型
