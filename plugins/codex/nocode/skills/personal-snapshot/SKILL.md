---
name: personal-snapshot
description: "手动为当前项目的 .agents-personal/ 创建备份快照；仅用于显式 snap/备份请求，不负责初始化、整理或健康检查"
argument-hint: (无参数)
---

# /personal-snapshot：创建个人知识快照

运行快照实现：

```bash
node "${PLUGIN_ROOT}/scripts/personal-snapshot.mjs" --json
```

按脚本回执报告 `committed`、`no_changes` 或 `error`；不要在本入口内追加整理、修复或初始化逻辑。
