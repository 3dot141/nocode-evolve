# UI Taste Model — 视觉方向选型

没有设计参考（无 pd-ui 产出、无截图、无 Figma）时，从这里选一个视觉方向。选完后 taste model 的使命就结束——它被消化成具体的视觉值（配色/排版/间距），写进设计文档或 `.ui.md`，下游不再需要回来找它。

## 选型表

| Skill | 视觉方向 | 适用场景 |
|---|---|---|
| `nocode-evolve:minimalist-ui` | 简约编辑风，暖单色调，平面网格 | 内容型产品、编辑器、笔记类 |
| `nocode-evolve:high-end-visual-design` | 高端质感，精确字号/间距/阴影 | 品牌官网、SaaS、需要精致感 |
| `nocode-evolve:industrial-brutalist-ui` | 机械工业风，瑞士排版，极端字号对比 | 数据密集仪表盘、作品集 |
| `nocode-evolve:design-taste-frontend` | 防模板化，反 AI 默认审美 | 落地页、作品集、改版 |
| `nocode-evolve:redesign-existing-projects` | 升级已有 UI，先审计再改 | 改造已有项目 |

## 决策树

```
需要什么？
├─ 改造已有项目 UI → redesign-existing-projects
├─ 全新项目
│  ├─ 数据密集 / 仪表盘 → industrial-brutalist-ui
│  ├─ 内容/编辑器/干净风格 → minimalist-ui
│  ├─ 品牌/高端/需要精致感 → high-end-visual-design
│  └─ 落地页/作品集/怕像 AI 做的 → design-taste-frontend
└─ 不确定 → 先问用户视觉偏好，再匹配
```

## 使用方式

选定后 `Skill()` 加载对应 skill，它会给出具体的设计原则（配色方案、字号体系、间距规则、组件风格）。把这些值写进设计文档 / `.ui.md`，taste model 的任务就完成了。
