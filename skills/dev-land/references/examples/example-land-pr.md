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

PR title（≤50 字）：
```
feat(search): 支持中文分词搜索
```

PR body（含 Requirements Addressed + Verification 回链）：
```markdown
## 改了什么
搜索接口接入中文 analyzer，修复中文查询返回空的问题。

## Requirements Addressed
- SC1 (响应 < 200ms p95): ✅ 接入 analyzer 后 p95=156ms
- SC2 (无 lint warning): ✅ 0 warnings
- SC3 (支持中文搜索): ✅ "笔记本电脑" 正确命中

## Verification Evidence
- 全套件: 127 passed (npm test)
- 中文用例: curl '/api/search?q=笔记本' → 8 results
- 性能: npm run bench:search → p95=156ms
```

→ 用户确认 body，进下一步。

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
