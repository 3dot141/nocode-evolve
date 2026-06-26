# UI Taste Skills 选型表

共享 reference，pd-ui / dev-design / dev-plan / dev-build 按需 Read。

## 可用 Skills

| Skill | 视觉方向 | 适用场景 |
|---|---|---|
| `nocode-evolve:minimalist-ui` | 简约编辑风，暖单色调，平面网格，无渐变无重阴影 | 内容型产品、编辑器、笔记类、博客 |
| `nocode-evolve:high-end-visual-design` | 高端质感，精确字号/间距/阴影/动效 | 品牌官网、SaaS 产品、需要"贵"的感觉 |
| `nocode-evolve:industrial-brutalist-ui` | 机械工业风，瑞士排版，军事终端美学，极端字号对比 | 数据密集型仪表盘、作品集、编辑型网站 |
| `nocode-evolve:design-taste-frontend` | 防模板化，真实设计系统，反 AI 默认审美 | 落地页、作品集、改版——任何需要"不像 AI 做的" |
| `nocode-evolve:redesign-existing-projects` | 升级已有 UI 到高端水准，先审计再改 | 改造已有项目，不破坏功能前提下提升视觉 |

## 各阶段怎么用

| 阶段 | 动作 | 说明 |
|---|---|---|
| **pd-ui** | `Skill()` 加载 | 中/高保真出稿时，按用户选定的视觉方向加载对应 skill，按其规范产出视觉稿/原型 |
| **dev-design** | 文字推荐 | 设计文档 `## UI 设计` 节末尾标注推荐的 skill，不自己加载，留给 Build |
| **dev-plan** | 引用不加载 | UI task 写结构代码（组件/状态/props），视觉值标注"Build 按 taste skill 填充"，不硬编码具体样式值 |
| **dev-build** | `Skill()` 加载 | 实现 UI 时读设计文档推荐，加载对应 skill，按规范写具体视觉代码 |

## 选型决策树

没有完全匹配时选最接近的，不硬套。

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
