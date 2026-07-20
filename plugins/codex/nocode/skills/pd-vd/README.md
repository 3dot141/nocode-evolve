# pd-vd

视觉设计 skill — 产品流第三阶段（视觉部分）。

以 `.ix.md` 为输入，通过视觉探索 + 方向选定 + 设计系统（tokens + components + 样张拍板 + 按交付线落点，全必做）+ 原型生成 + Playwright 验证，产出 `.vd.md` + 样张 + 高保真原型。

## 产出

- `{topic}.vd.md` — 视觉方向、tokens 冻结表、组件清单、原型清单、验证记录（模板：`references/vd-doc-template.md`）
- `styleguide.html` — 单页样张（tokens + 全部组件 + patterns 骨架，Step 3 拍板产物）
- `{topic}.prototype.html` — 高保真可交互原型（唯一档位，覆盖度恒 100%；Claude Design 线为原型项目 + DS 项目）

## 在产品流中的位置

```
pd-research → pd-prd → pd-ix → pd-vd → devflow
                                  ↑ 你在这里
```

pd-vd 以 pd-ix 产出的 `.ix.md` 为必要输入。没有 `.ix.md` 不能进入。

## 拆分历史

pd-ix 和 pd-vd 由原 pd-ui skill 拆分而来（260630）。拆分原因：交互和视觉混在一个 skill 里，边界不清导致跳步（跳过交互规范直接出原型）。拆开后每个 skill 范围更小，跳步空间被消除。

## 下游消费者

- `dev-design` — Step 2 读 `.vd.md` 理解视觉方向、tokens 冻结表（按名继承，禁改名）
- `dev-build` — 有原型时注入视觉清点纪律，样张作组件参考
- `dev-verify` — 复用 `interactions.json` / `screenshots/` 做验证
- `claude-design` — Step 3/4 调 claude-design 生成设计系统与原型

## 与 pd-ix 的分工

判据与共享术语单源在 `${PLUGIN_ROOT}/shared/references/ix-vd-contract.md`：行为语义归 pd-ix（`.ix.md` 行为规格），控件四态样式归本 skill（tokens 层统一定义）；原型阶段的补充决策走回流登记。
