# PRD: Lark 工具集整体梳理
> 状态: 已实施
> 作者: 3dot141
> 日期: 260626
> 调研: N/A（Light 场景，基于现状盘点）

## 问题

nocode-evolve 插件内的飞书/Lark 工具集缺乏统一组织，导致 agent 和用户在与飞书资源交互时体验碎片化。

**主因**：

1. **命名不统一**：外部 skills 用 `lark-*` 前缀，内部 rules 用 `feishu-*` 前缀，同一生态两套命名 [CONFIRMED]
2. **常用流程无引导**：读文档含图片需要手动处理 scope 授权和图片下载；FeishuProjectMcp 有 50+ 工具但只有 2 条 rule 覆盖极小一角 [CONFIRMED]
3. **外部 skill 与内部 rule 分裂**：底层能力（lark-cli skills）和工作流引导（nocode-evolve rules）没有明确分层关系 [CONFIRMED]

**辅因**：

- lark-doc 内引用的 lark-sheets/base/drive/whiteboard/note 本机未安装，形成空引用 [CONFIRMED]
- 缺少统一的触发路由，agent 需要记住「feishu-project 走 MCP rule，飞书文档走 lark-doc skill」这种不规则映射 [ASSUMED]

## 用户故事

- US-1: 作为使用 nocode-evolve 的开发者，我想贴一个飞书文档 URL 就能完整读取内容（含图片），以便快速获得设计讨论的上下文 [CONFIRMED]
- US-2: 作为使用 nocode-evolve 的开发者，我想在使用飞书项目 MCP 工具时有清晰的引导（该调哪个工具、什么顺序、怎么处理异常），以便不用自己研究 50+ MCP 工具 [CONFIRMED]
- US-3: 作为使用 nocode-evolve 的开发者，我想所有飞书相关工具有统一命名和可预测的路由触发，以便不用记「这个叫 lark- 那个叫 feishu-」 [CONFIRMED]
- US-4: 作为使用 nocode-evolve 的开发者，我想在文档引用了电子表格/多维表格/云空间文件时能跟进访问这些嵌入资源，以便不碰到空引用 [ASSUMED]
- US-5: 作为使用 nocode-evolve 的开发者，我想在 Lark 操作因权限不足失败时，agent 能主动引导我配置 scope，以便不用自己查文档找缺什么权限 [ASSUMED]

## 业务领域与使用路径

### 文档阅读
> 关注点: 把飞书文档（含图片/嵌入资源）完整读到 agent context 中

**使用路径**

- 文档阅读.P1: 完整读取飞书文档含图片 [开发者] [CONFIRMED]
  来源: US-1
  用户给 URL → 检查 media scope → 拉取文字内容 → 识别嵌入图片 → 下载图片（优先 +media-preview/+media-download，fallback 到 curl 直链） → 输出结构化内容
  | 异常: media scope 未授权 → 引导用户配置 `docs:document.media:download`
  | 异常: 直链 authcode 过期 → 提示重新获取
  | 边界: 嵌入的 sheets/base/whiteboard 识别后交给对应 skill

- 文档阅读.P2: 读取文档中嵌入的资源块（sheets/base/whiteboard） [开发者] [ASSUMED]
  来源: US-4
  读文档时识别 `<sheet>`/`<bitable>`/`<whiteboard>` 标签 → 提取 token → 路由到对应 lark-* skill 下钻
  | 异常: 对应 skill 未安装 → 报告哪个 skill 缺失，建议安装
  | 边界: 本路径只做识别和路由，数据操作在对应 skill

### 项目管理
> 关注点: 用 FeishuProjectMcp 管理飞书项目工作项

**使用路径**

- 项目管理.P1: 读取飞书项目工作项（含附件图片） [开发者] [CONFIRMED]
  来源: US-2
  用户给 project.feishu.cn URL → 加载 MCP 工具 → `get_workitem_brief(fields=["_all"])` → 处理 project_key 多匹配 → 下载附件（带 `X-Meego-File-Sign`） → 输出结构化工作项
  | 异常: simple_name 撞多空间 → 改用真实 24 位 hex project_key
  | 边界: 已有 rule 覆盖（`feishu-project-workitem-read`），需统一命名

- 项目管理.P2: PR merge 后流转工作项状态 [开发者] [CONFIRMED]
  来源: US-2
  PR merge → 提取 commit 中的任务号 → 查工作项状态 → 填必填字段 → 执行流转 → 确认
  | 异常: 非「组员开发」状态 → 报告不强行流转
  | 边界: 已有 rule 覆盖（`feishu-transition`），需统一命名

- 项目管理.P3: 搜索/筛选飞书项目工作项 [开发者] [ASSUMED]
  来源: US-2
  用户要查找工作项 → `search_by_mql` / list 相关工具 → 返回结果
  | 异常: MQL 语法错误 → 引导修正
  | 边界: 当前无 rule 覆盖，是缺口

- 项目管理.P4: 创建/更新飞书项目工作项 [开发者] [ASSUMED]
  来源: US-2
  用户要创建或更新工作项 → `create_workitem` / `update_field` → 确认
  | 边界: 当前无 rule 覆盖，是缺口

### 工具路由
> 关注点: 统一命名和触发路由，让 agent 自动选对工具

**使用路径**

- 工具路由.P1: URL 驱动的自动路由 [agent] [CONFIRMED]
  来源: US-3
  agent 收到飞书相关 URL → 按 URL pattern 路由:
  `feishu.cn/docx/*` → lark-doc |
  `feishu.cn/wiki/*` → lark-wiki 或 lark-doc |
  `project.feishu.cn/*` → lark-project（FeishuProjectMcp） |
  `feishu.cn/task/*` → lark-task
  | 异常: URL 格式未知 → fallback 或报告
  | 边界: catalog 路由表负责，不在单个 skill 内

- 工具路由.P2: 统一命名迁移 [维护者] [CONFIRMED]
  来源: US-3
  `feishu-*` rules → 吸收进 `lark-project/references/` |
  catalog 飞书桶从 `feishu` → `lark`，无 `feishu-*` 残留
  | 边界: 改 manifest + 重生成 catalog

### 认证与权限
> 关注点: scope 不足时主动引导配置

**使用路径**

- 认证.P1: 操作因 scope 不足失败时引导配置 [开发者] [CONFIRMED]
  来源: US-5
  操作返回 `missing_scope` 错误 → 解析缺失的 scope → 引导 `lark-cli auth login --scope` → 用户完成授权
  | 异常: 离线无法授权 → 报告并建议稍后
  | 边界: lark-shared 已有此能力，需确保各 skill/rule 都正确引用

- 认证.P2: 高频场景 scope 前置提醒 [开发者] [ASSUMED]
  来源: US-5, US-1
  进入需要特定 scope 的流程前（如图片下载需要 `docs:document.media:download`）→ 提前提醒用户确认 scope 已配置
  | 边界: 按优先级覆盖高频场景，不做全量前置检查

## 跨领域路径

- 跨域.1: 读飞书文档 → 发现嵌入工作项链接 → 跟进读取工作项 [开发者] [ASSUMED]
  文档阅读.P1 → 项目管理.P1
  | 异常: 工作项无权限 → 报告

- 跨域.2: 读飞书项目工作项 → 附件含飞书文档链接 → 跟进读取文档 [开发者] [ASSUMED]
  项目管理.P1 → 文档阅读.P1
  | 异常: 文档无权限 → 报告

## 系统路径

- 系统.1: catalog 路由表自动匹配 Lark 工具 [CONFIRMED]
  agent 收到用户消息 → Step 0 扫 catalog 粗桶 → 命中飞书/Lark 相关桶 → 按 trigger 选具体 rule → 加载
  | 异常: 多条 rule trigger 同时命中 → URL pattern 优先于关键词

## 约束

- 约束.1: 不修改外部 lark-* skills 源码，只在 nocode-evolve 层添加引导 [CONFIRMED]
- 约束.2: 不写新的 lark-cli 命令，只用现有 lark-cli 能力 + FeishuProjectMcp [CONFIRMED]
- 约束.3: 命名统一为 `lark-*` 前缀，跨 nocode-evolve 全仓保持一致 [ASSUMED]

## 投入上限

本轮只做规划（PRD），不执行实施。[CONFIRMED]

后续实施预估 1-2 天（写 rule/skill 文档 + 调 manifest + 重生成 catalog）。超过 2 天说明范围失控，应裁剪。

## 方向草图

### 命名惯例

| 后缀 | 含义 | 例子 |
|---|---|---|
| `*hub` | 聚合入口（flat 意图分发，无连字符无阶段） | `larkhub`, `personalhub` |
| `*flow` | 工作流（sequential 阶段制，有 gate） | `devflow`, `pdflow` |

现有 `personal` skill 同步对齐为 `personalhub`（follow-up 变更）。

### 工具分层模型

```
Layer 4: nocode-evolve aggregation hub (新增)
  ┌─────────────────────────────────────────┐
  │              larkhub                   │
  │  (聚合入口: URL/意图 → 子动作分发)      │
  └──┬──────┬──────┬──────┬──────┬──────┬──┘
     │      │      │      │      │      │
Layer 3: nocode-evolve workflow skills (新增)
  ┌──────────────┐  ┌──────────────────┐  │
  │  lark-read   │  │  lark-project    │  │
  │  (文档完整   │  │  (项目管理       │  │
  │   阅读流程)  │  │   MCP 引导)      │  │
  └──────┬───────┘  └──────┬───────────┘  │
         │                 │              │
Layer 2: nocode-evolve catalog routing (已更新)
  ┌──────────────────────────────────────┐ │
  │  catalog 路由 (统一 lark-* 命名)     │ │
  │  feishu 桶 → lark 桶, 无残留        │ │
  └──────┬───────────────────┬───────────┘ │
         │                   │             │
Layer 1: external lark-* skills (不动 + 补齐)
  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
  │lark-doc  │ │lark-wiki │ │lark-task │ │lark-shared│
  └──────────┘ └──────────┘ └──────────┘ └──────────┘
  + 安装: lark-sheets, lark-base, lark-drive (填补空引用)
```

### `larkhub` 分发表

```
/larkhub → 意图识别 + URL pattern 分发
  ├─ read       → lark-read (文档完整阅读，含图片)
  ├─ project    → lark-project (飞书项目 MCP 引导)
  │   ├─ read       → lark-project-read (读工作项)
  │   ├─ transition → lark-project-transition (流转状态)
  │   ├─ search     → 搜索工作项
  │   └─ write      → 创建/更新工作项
  ├─ doc        → 外部 lark-doc (文档读写 API)
  ├─ wiki       → 外部 lark-wiki (知识空间管理)
  ├─ task       → 外部 lark-task (飞书任务)
  └─ auth       → 外部 lark-shared (认证/scope 配置)

URL 自动路由:
  feishu.cn/docx/*         → doc
  feishu.cn/wiki/*         → doc (内容) 或 wiki (空间管理)
  project.feishu.cn/*      → project
  feishu.cn/task/*         → task
  doubao.com/docx/* | /wiki/* → doc
```

### 新增/调整清单

| 动作 | 名称 | 类型 | 说明 |
|---|---|---|---|
| **新增** | `larkhub` | skill (nocode-evolve) | 聚合入口：URL/意图 → 子动作分发 |
| **新增** | `lark-read` | skill (nocode-evolve) | 文档完整阅读流程（text + images + scope 引导 + 嵌入资源路由） |
| **新增** | `lark-project` | skill (nocode-evolve) | FeishuProjectMcp 使用指南（覆盖读/写/搜索/流转） |
| **吸收** | `feishu-project-workitem-read` → `lark-project/references/workitem-read.md` | rule → skill reference | 内容迁入 lark-project skill，原 rule 文件 + manifest/catalog 条目删除 |
| **吸收** | `feishu-transition` → `lark-project/references/transition.md` | rule → skill reference | 内容迁入 lark-project skill，原 rule 文件 + manifest/catalog 条目删除 |
| **对齐** | `personal` → `personalhub` | skill (nocode-evolve) | 命名惯例对齐（follow-up） |
| ~~引入~~ | ~~lark-sheets, lark-base, lark-drive~~ | ~~安装到 skills-manager~~ | ✅ 已手动安装 |
| **调整** | catalog 飞书桶 | manifest | 桶名统一 + 补新路由 + 命名迁移 |

## 竞品分析

N/A（内部工具组织，无外部竞品）

## 成功指标

- 主要: agent 收到飞书 URL 后 1 次路由命中正确工具（目前可能 2-3 次试错） [ASSUMED]
- 次要: 所有飞书相关工具统一 `lark-*` 命名，catalog 内无 `feishu-*` 残留 [CONFIRMED]
- 护栏: 现有 `feishu-*` rule 功能不退化（重命名后行为完全等价） [CONFIRMED]

## 风险与不确定性

- ~~lark-sheets/base/drive 是否可从 skills-manager 源仓库直接安装？~~ ✅ 已安装
- 重命名 `feishu-*` → `lark-*` 需改 manifest + catalog + 代码/文档中所有硬编码引用，可能遗漏 [推断]
- `lark-project` skill 覆盖 FeishuProjectMcp 50+ 工具的广度 vs 深度权衡——全覆盖太重，只覆盖高频可能不够 [推断]

## 不做的事

- 不修改外部 lark-* skills 源码（只在 nocode-evolve 层叠加引导） [CONFIRMED]
- 不写新的 lark-cli 命令（只用现有能力） [CONFIRMED]
- 不重构 FeishuProjectMcp 本身（MCP server 是外部服务） [ASSUMED]
- 本轮不执行实施，只出规划 [CONFIRMED]

## 待定项

- [TBD] `lark-read` 的 scope 前置检查方式（skill 内检查 vs PreToolUse hook）
- [TBD] `lark-project` skill 覆盖的 MCP 工具清单（需盘点高频使用场景）
- [TBD] 未安装 lark-* skills 的引入顺序和优先级
- [TBD] catalog 桶名是否从「飞书项目读取 (feishu)」改为「飞书/Lark (lark)」

## 来源附录

- [SOURCE: ~/.skills-manager/skills/lark-doc/SKILL.md]
- [SOURCE: ~/.skills-manager/skills/lark-wiki/SKILL.md]
- [SOURCE: ~/.skills-manager/skills/lark-shared/SKILL.md]
- [SOURCE: ~/.skills-manager/skills/lark-task/SKILL.md]
- [SOURCE: rules/rule-feishu-project-workitem-read.md]
- [SOURCE: rules/rule-feishu-transition.md]
- [SOURCE: model/agent-catalog-1.md — 飞书桶路由定义]
