# Commit 整理建议 (Merge + PR 路径共用，全景计划的材料提供者)

在材料收集阶段（SKILL.md Step 2e）被读，产出「整理建议 + 完整命令」作为**全景计划的一行**；不自带等待点——用户在全景回「我先整理 commit」才进入等待。agent 不自动跑 rebase (per spec Q4 决策)。

## 定位

```
材料收集: 列 push range → 按判定规则产出建议行        （本文件 Step 1-2）
全景计划: 「1. commit 整理  <建议行>（默认: 跳过）」    （嵌入展示, 无等待）
用户回「我先整理」: 贴完整命令 → 等「好了」→ 重收材料   （本文件 Step 3-4）
用户回「OK」: 建议不执行, commit 原样进 merge / PR
```

## Step 1: 列 push range commit

```bash
# base_branch 由 SKILL.md Step 2e 单源解析
git log --oneline "$(git merge-base HEAD $base_branch)..HEAD"
```

## Step 2: 判定规则 → 建议行

agent 扫每个 commit 的 subject (短 sha 后第一行)，按下列规则产出建议；**单 commit 命中多条时按 fixup > squash > reword 取更具体的一条**：

| 模式 | 建议 |
|---|---|
| 某 commit subject 是 "fix typo in X" / "address review comment Y" 且引用之前的 commit | **fixup** 到被引用的目标 commit |
| 连续 ≥2 个 commit 含关键字 `wip` / `tmp` / `fixup` / `fix typo` (大小写不敏感) | **squash** 这一串合并进它们之前最近的一个实质 commit |
| 单个 commit message 不符合 conventional commits (无 `<type>(<scope>):` 前缀) | **reword** 改成规范格式 |
| 都不命中 (commit 全部规范且独立有意义) | **无建议** — 全景该行写「无建议」，不强迫 reword 一切 |

## Step 3: 用户回「我先整理」→ 贴完整命令

### 命令: squash 连续 N 个 WIP commit

```bash
# 假设最近 4 个 commit 是 ["feat: 主体", "wip: 1", "wip: 2", "wip: 3"]
git rebase -i HEAD~4
# 编辑器内:
#   pick   <sha1> feat: 主体
#   squash <sha2> wip: 1     ← pick → squash
#   squash <sha3> wip: 2
#   squash <sha4> wip: 3
# 保存后弹出 message 编辑界面, 删 wip 行只留主体 message
```

### 命令: autosquash (commit 已用 `--fixup` 标记)

```bash
git add <changes>
git commit --fixup=<sha-of-target>
git rebase -i --autosquash HEAD~N
```

### 命令: reword 单个 commit

```bash
git rebase -i HEAD~N
# 编辑器内目标行: pick → reword, 保存后改写 message
```

### 命令: 区分已 push / 未 push (避免误改 published commit)

```bash
git log origin/<branch>..HEAD --oneline    # 仅本地未 push 的, 可安心 rebase
git log "$(git merge-base HEAD $base)..HEAD" --oneline   # 全 range, 含已 push (改了要 force-push)
```

> 已 push 的 commit rebase 后重 push 会撞 non-ff → 重展全景时必须把 `force-with-lease` 写成显式风险动作；未进入全景不得执行。

## Step 4: 等「好了」→ 重收材料

用户响应「好了 / 已整理 / 整理完成」→ push range 已变，重收 title/body/Affected 相关材料 → 重展全景计划。

## 不要

- **不要 agent 自动跑 rebase** — 交互式 rebase fail 会破坏 history; `GIT_SEQUENCE_EDITOR=true` 遇 conflict 会 hang, agent 没人工干预能力。给命令让用户跑
- **不要把整理建议做成独立等待点** — 建议只是全景计划的一行, 默认跳过; 用户主动说「我先整理」才等待（旧版独立等待与「全景确认后全自动」承诺冲突, 已废弃）
- **不要强迫用户整理** — 「OK」直接过 = 合法, 不二次劝诱
- **不要建议 reword 一切不规范 commit** — 只对明显问题 commit 建议; 其余是历史现实, 用户自己决定
- **不要在 commit-tidy 阶段加额外 lint** (commit-msg hook / branch name 校验) — 那是 pre-commit hook 的事
- **不要建议 squash 已 push 的 commit** 除非单仓直推且 force-push 安全 — 跨 fork PR 已 push 的 rebase 会逼 force-push; 整理只针对**未 push** 的, 已 push 的留给 review comment 触发的修订
