# UI 设计源选型与消费

共享 reference，pd-ui / dev-design / dev-plan / dev-build 按需 Read。

## 设计源解析（共享流程）

**任何阶段遇到 UI 工作时，先跑这个流程确定设计源。** 上游已确定的设计源直接继承，不重复问。

```
1. 上游已有设计源？
   → 有 → 继承使用（DesignSync 项目 / .ui-prototype.html / 截图参考 / Figma）
   → 没有 → 进 2

2. 问用户（AskUserQuestion）：
   a. 有 Claude Design 设计系统？    → DesignSync get_file 读
   b. 有截图/参考产品想仿照？         → 用户贴图或给 URL
   c. 有 Figma 设计稿？              → figma-design-read 读取
   d. 都没有                         → 从 taste skills 选一个方向

3. 选定后记录设计源标识，下游继承不重复问
```

### 设计源标识格式

记录到 `.ui.md` / 设计文档 / plan task 中，供下游识别：

| 设计源 | 标识 |
|---|---|
| Claude Design | `[design-source: DesignSync <projectId>]` |
| 本地原型 | `[design-source: .ui-prototype.html <路径>]` |
| 截图/参考 | `[design-source: reference <描述或路径>]` |
| Figma | `[design-source: figma <fileKey>]` |
| Taste skill（兜底） | `[design-source: taste-skill <skill 名>]` |

## 各阶段怎么用

| 阶段 | 上游有设计源 | 上游没有 |
|---|---|---|
| **pd-ui** | 引用它，在此基础上设计 | 跑选择流程，产出设计稿 |
| **dev-design** | 引用到设计文档 `## UI 设计` 节 | 跑选择流程，记录到设计文档（定方向，不出视觉稿） |
| **dev-plan** | 继承，标注到 UI task | 跑选择流程，标注到 UI task |
| **dev-build** | 照着写，不发挥 | 跑选择流程，按选定方向实现 |

### Build 的消费规则

**有设计稿（DesignSync / prototype / 截图 / Figma）→ 严格照着实现，不自主发挥。**

只有设计源是 taste skill（兜底）时，Build 才有视觉上的自由度——加载对应 skill，按规范自行发挥。

优先级链（高→低）：

```
DesignSync .dc.html  >  .ui-prototype.html / 截图 / Figma  >  taste skill
```

## Claude.ai Design（DesignSync）

Claude.ai 上的可视化设计工具，通过内置 `DesignSync` 工具与 Claude Code 双向同步。需先 `/design-login` 认证。

**DesignSync 操作：**
- `list_projects` / `get_project` — 查看设计项目
- `list_files` / `get_file` — 读取设计文件（`.dc.html` 设计组件）
- `create_project` — 创建设计系统项目
- `finalize_plan` → `write_files` — 推送本地组件到设计项目（仅 `PROJECT_TYPE_DESIGN_SYSTEM` 类型）

## Taste Skills（兜底方向）

没有其他设计参考时，从这里选一个视觉方向。

| Skill | 视觉方向 | 适用场景 |
|---|---|---|
| `nocode-evolve:minimalist-ui` | 简约编辑风，暖单色调，平面网格 | 内容型产品、编辑器、笔记类 |
| `nocode-evolve:high-end-visual-design` | 高端质感，精确字号/间距/阴影 | 品牌官网、SaaS、需要精致感 |
| `nocode-evolve:industrial-brutalist-ui` | 机械工业风，瑞士排版，极端字号对比 | 数据密集仪表盘、作品集 |
| `nocode-evolve:design-taste-frontend` | 防模板化，反 AI 默认审美 | 落地页、作品集、改版 |
| `nocode-evolve:redesign-existing-projects` | 升级已有 UI，先审计再改 | 改造已有项目 |

### 选型决策树

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
