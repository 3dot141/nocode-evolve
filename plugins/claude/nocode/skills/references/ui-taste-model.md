# UI Taste Model — 视觉方向选型

没有设计参考（无 pd-vd 产出、无截图、无 Figma）时，从这里选视觉知识来源。选完后 taste model 的使命就结束——它被消化成具体的视觉值（配色/排版/间距），写进设计文档或 `.vd.md`，下游不再需要回来找它。

> pd-vd 场景不走本文——pd-vd Step 3a 有自己的取值决策树（含用户 Ask 环节）。本文服务无 pd-vd 产出时直接做 UI 决策的场景（如 devflow Design/Build）。

## 分层（这些 skill 不是同一维度的选项）

| 层 | Skill | 性质 | 加载规则 |
|---|---|---|---|
| **决策框架** | `frontend-design`、`nocode:design-taste-frontend` | 取值方法 + AI 套路反模式禁令，不锁风格 | **恒加载**（无论选不选风格包） |
| **风格预设包** | `nocode:minimalist-ui` / `nocode:high-end-visual-design` / `nocode:industrial-brutalist-ui` | 锁死一种美学，给具体值 | **互斥，一次最多一个**（三者在字体/圆角/阴影上互相矛盾，同载必打架） |
| **场景流程** | `nocode:redesign-existing-projects` | 改造已有 UI 的审计流程 | 按场景（改造 vs 新建），与风格正交 |
| **正交工具** | `dataviz` | 图表颜色语义编码 | 界面含图表/dashboard 时加载，图表色域独立于整站 accent |

## 风格包选型

| Skill | 视觉方向（三轴定位） | 适用场景 |
|---|---|---|
| `nocode:minimalist-ui` | 暖色极简 editorial（宽松 · 克制 · 中性偏友好） | 内容型产品、编辑器、笔记类 |
| `nocode:high-end-visual-design` | agency 精致感（中等 · 表现力 · 精致） | 品牌官网、SaaS、需要精致感 |
| `nocode:industrial-brutalist-ui` | 工业终端风（紧凑 · 硬朗克制 · 专业严肃） | 数据密集仪表盘、作品集 |

```
需要什么？
├─ 改造已有项目 UI → redesign-existing-projects（+ 尊重项目既有风格，不默认拉向 premium agency）
├─ 全新项目 → 决策框架恒加载，再看要不要风格包：
│  ├─ 数据密集 / 仪表盘 → industrial-brutalist-ui（含图表 → 另加 dataviz）
│  ├─ 内容/编辑器/干净风格 → minimalist-ui
│  ├─ 品牌/高端/需要精致感 → high-end-visual-design
│  └─ 都不像 / 怕锁死风格 → 不选风格包，纯决策框架推导
└─ 不确定 → 先问用户视觉偏好，再匹配
```

## 冲突仲裁

用户 brief 明示 > 项目已有品牌/设计系统 > 命中的风格预设包 > 决策框架默认。已知冲突点（同载即打架的证据）：Inter 字体（brutalist 推荐 / high-end 禁用）、`Instrument Serif`（minimalist 推荐 / taste 禁用）、OLED 黑+光晕（high-end 默认 / taste 与官方框架列为 AI 套路）、圆角与阴影哲学三向对立——所以风格包一次只能一个。

## 使用方式

选定后 `平台原生 Skill 调用` 加载：决策框架给取值方法与禁令，风格包给具体值（作初值，与 brief 冲突时 brief 赢）。把消化后的值写进设计文档 / `.vd.md`，taste model 的任务就完成了。
