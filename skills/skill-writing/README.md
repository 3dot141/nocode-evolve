# skill-writing

创建、测试、迭代和发布 agent skill 的统一工具。

融合三个来源：
- **writing-skills** (superpowers, MIT) 的 TDD 方法论——先跑 baseline 看 agent 怎么失败，再写 skill
- **skill-creator** (Anthropic marketplace, Apache 2.0) 的 eval 基础设施——量化 benchmark、eval viewer、description optimizer
- **SkillOpt** (Microsoft) 的迭代纪律——validation gate、bounded edits、aggregate reflect

## 目录结构

```
skill-writing/
├── SKILL.md              使用入口：八阶段流程
├── README.md             本文件
├── skill-creator/        eval 工具链
│   ├── scripts/          Python 脚本（eval runner、benchmark、optimizer、packager）
│   ├── agents/           subagent 指令（grader、comparator、analyzer）
│   ├── eval-viewer/      HTML viewer 生成器
│   ├── assets/           eval review 模板
│   ├── references/       JSON schema 定义
│   └── LICENSE.txt       Apache 2.0
└── writing-skills/       TDD 辅助文档
    ├── anthropic-best-practices.md    Anthropic 官方 skill 写作指南
    ├── persuasion-principles.md       心理学原理（anti-rationalization）
    ├── testing-skills-with-subagents.md  subagent 压力测试方法
    ├── graphviz-conventions.dot       flowchart 样式规范
    ├── render-graphs.js               flowchart 渲染脚本
    └── examples/                      测试示例
```

## 依赖

- **Python 3**：eval 脚本（`scripts/run_eval.py` 等）需要
- **`claude` CLI**：可选。有则 eval 自动化（`run_eval.py`、`run_loop.py`），无则降级到 subagent 手动跑

## 来源 Pin

| 来源 | 版本 | 许可证 |
|---|---|---|
| skill-creator (Anthropic marketplace) | sha `82f22ec4` | Apache 2.0 |
| writing-skills (superpowers) | v5.1.0, commit `e4a2375c` | MIT |
| SkillOpt (Microsoft) | 纪律概念引用，不含代码 | — |

## 迁移

本 skill 替代以下两个工具：
- `writing-skills`（superpowers 插件内的 skill）
- `skill-creator`（Claude Code marketplace 插件）

安装本 skill 后，可卸载 marketplace 的 skill-creator 插件。writing-skills 由 vendor 配置自动停止同步。
