# Claude Design 工具体系

Claude Design 有三套接口，各管一件事。搞清楚分工才知道该用哪个。

## `/design` hub 命令（Claude Code 内置）

| 命令 | 作用 |
|---|---|
| `/design <brief>` | 创建/编辑设计项目（原型、演示、页面）。走 `claude_design` MCP，自动引用已有设计系统 |
| `/design sync` | 推本地 React 组件库作为设计系统（= `/design-sync`）。需要 Storybook 或 React 包 |
| `/design import` | 从 Claude Design 拉项目文件到本地工作目录 |
| `/design export` | 推本地文件到 Claude Design 项目 |
| `/design status` | 查已有设计系统 + 项目 + 授权状态 |
| `/design login` | 授权 design scope（`user:design:read` + `user:design:write`） |

## DesignSync 内置工具（低层 API）

- 只管 `PROJECT_TYPE_DESIGN_SYSTEM` 项目
- 方法：`list_projects` / `get_project` / `list_files` / `get_file` / `create_project` / `finalize_plan` / `write_files` / `delete_files`
- `create_project` 是**唯一能新建 DS 类型项目**的接口（MCP `create_project` 只建普通项目）
- 用于推 `.dc.html` 设计系统卡片（foundations / components / patterns）
- **不能**创建普通设计项目 / 原型

## Claude Design 网页端（claude.ai/design）

- 新建项目 4 种：**Prototype** / **Slide deck** / **From Template** / **Other**
- **Template** = 预制好的设计起点，选了有 80% 骨架
- **Design System** = 品牌渲染层，跟 Template 正交（结构 vs 品牌）
- 可在线创建设计系统（描述品牌生成），不依赖 `/design-sync`

## 三者关系

```
/design hub ──→ claude_design MCP ──→ 原型/设计项目
/design sync ──→ DesignSync 工具 ──→ 设计系统项目
                 DesignSync 工具 ──→ .dc.html CRUD
```

- `/design` 和 DesignSync 是两套独立接口，走不同 API
- `/design` 能做原型，DesignSync 只能做设计系统
- `/design sync` 包装了 DesignSync + React 组件转换

## 设计源标识

pd-vd 产出的设计源标识，记录在 `.vd.md` 中，下游继承：

| 标识 | 含义 | 下游怎么消费 |
|---|---|---|
| `[design-source: claude-design <projectId>]` | Claude Design 上有可交互原型 | `/design import` 拉回本地照做 |
| `[design-source: prototype <路径>]` | 本地有 HTML 原型 | 直接读文件照做 |

无标识时（dev-design 选了 taste model 或设计文档自含 UI 方案）→ 设计文档 `## UI 设计` 节就是全部视觉依据，不需要外部产物。
