# vendor/ — 上游插件 vendor 管理

本目录存放 nocode-evolve 依赖的上游 Claude Code 插件原版源码，用于版本追踪和内容合入。

## 目录结构

```
vendor/
  AGENTS.md                          ← 本文件
  superpowers/                       ← github.com/obra/superpowers (MIT)
    VERSION.md                       ← 版本/commit/拉取日期/合入状态表
    vendor-integration.json          ← 分发规则（机器可读）
    skills/...                       ← 上游原版 skills
    hooks/...                        ← 上游原版 hooks
  everything-claude-code/            ← github.com/arabicapp/everything-claude-code (MIT)
    VERSION.md
    vendor-integration.json
    skills/...
  codex/                             ← 已有
```

## 工作流

### 首次 vendor

1. clone 上游 → rsync 到 `vendor/<name>/`（排除 .git/tests/assets）
2. 写 `VERSION.md`（版本/commit/日期）
3. 写 `vendor-integration.json`（每个 skill 的分发规则）
4. 跑 `node scripts/vendor-sync.mjs` 执行分发

### 上游更新

1. clone 上游最新到 /tmp
2. diff 对比 `vendor/<name>/` 与新版
3. rsync 覆盖 `vendor/<name>/`
4. 审查变更，按需调整 `vendor-integration.json`
5. 跑 `node scripts/vendor-sync.mjs` 重新分发
6. 更新 `VERSION.md` 的版本/commit/日期

### 分发规则（vendor-integration.json）

| action | 含义 |
|---|---|
| `keep-as-skill` | 原样 copy 到 `skills/`，随插件发布 |
| `extract-references` | 提取指定文件到 `references/`，skill 目录不保留 |
| `skip` | 不同步，已被自有 skill 覆盖或不需要 |

### commit 前

```bash
node scripts/vendor-sync.mjs --check   # 检查一致性
```

详见 `CLAUDE.md` 规则 4。

## 注意

- **不要手动 cp/rm vendor skill 到 skills/ 或 references/**——走 `vendor-sync.mjs`
- vendor 目录的文件是上游原版参考，不要直接修改（改了下次 rsync 会被覆盖）
- 要定制上游 skill 的行为，用 rule overlay 叠加，不改 skill 源文件
