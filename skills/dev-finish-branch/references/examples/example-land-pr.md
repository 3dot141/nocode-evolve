# Example: 走 Option 2 (PR) 着陆

场景：Review 通过后，分支 `feat/search-zh` 要走 PR 路径着陆。restate 有 SC1/SC2/SC3 三条，Verify 已全过。下面是 8a → 8c 的真实记录。

---

## 8a. Pre-flight

```
1. Review 状态：Review task ✅ completed，无未解决 Critical
2. 工作目录：$ git status → nothing to commit, working tree clean ✅
3. 分支新鲜度：$ node scripts/freshness-check.mjs → behind=2 (≤5) ✅
→ 三项全过，进 8b
```

## 8b. Disposition

用户选 **Option 2 (Push + 建 PR)**——本任务有 reviewer 需走 CI。

## 8c. Execute（PR 路径）

### Gate Title-Body

PR target：
```
upstream/main    ← 来源: nocode-base
```

PR title（≤50 字）：
```
feat(search): 支持中文分词搜索
```

PR body（背景 + 方案两段，`rule-push-summary` 契约）：
```markdown
## 背景
中文查询在搜索接口里直接落空，因为分词沿用了默认英文 analyzer，无法切分中文词。

## 方案
搜索接口接入中文 analyzer，替换原来的默认分词器。重点评审 src/search/analyzer.ts 的分词规则，p95=156ms 已跑过（SC1/SC2/SC3 均达标）。
```

Affected（仅 Gate 展示，不进 PR body）：
```
src/search/analyzer.ts
src/search/query.ts
```

→ 用户确认 target + title + body + Affected，进下一步。

### push + 建 PR + 加 reviewer

```
$ git push -u origin feat/search-zh
$ gh pr create --title "..." --body "..."
→ https://github.com/org/repo/pull/142 created

$ gh pr edit 142 --add-reviewer alice,bob
→ reviewers added ✅
```

### Gate Worktree-Cleanup

```
AskUserQuestion: PR 已建，worktree 怎么处理？
- 保留（可能要改 PR feedback）← 用户选这个
- 清理
→ 保留 worktree，结束
```

## 终态

Option 2 的终态是 **PR 已提交**，不是合并。不要 PR 创建后立刻 merge——等 reviewer。

> 注意 PR body 的两个回链节：reviewer 看 PR 就能追溯"为什么做"（Requirements）和"凭什么说做完了"（Verification），不用翻会话。这是 dev-land 区别于裸 `gh pr create` 的关键。
