# Example: PR 路径全景计划着陆（happy path 1 拦）

场景：worktree 内分支 `feat/search-zh`，base=main（`nocode-base` 配置），GitHub 仓库，push range 3 个 commit，commit 带任务号 `#m-8f3k2`（缺陷，当前状态「组员开发」）。用户说「提 PR」。

---

## Step 1-4（全部无独立 Gate）

```
Step 1 工具栈: remote 含 github.com → gh；补清检测: gh pr view → no pull requests found → 继续
Step 2 意图推定: 「提 PR」→ PR，不出菜单
Step 3 tests: npm test → 42 passing ✅
Step 4 材料收集: base=main(nocode-base) · push range 3 commits · 整理建议(1 个 wip 串)
       title/body(pr-body-contract) · Affected 3 文件 · reviewer=空(无 protection/CODEOWNERS)
       任务号 #m-8f3k2 → Read post-merge.md → 推定目标状态「创建者验收」
       远程坐标: origin/feat/search-zh
```

## Step 5: 全景计划（回合末尾文本，唯一主 Gate）

```
[全景计划] feat/search-zh → PR → origin/main（来源: nocode-base），确认后全自动:
  1. commit 整理   建议 squash d4e5f6a+b7c8d9e 进 a1b2c3d（默认: 跳过，原样进 PR）
  2. push + 建 PR  title「feat(search): 中文分词接入 ik analyzer」
                   body 与 Affected 见下；reviewer: 空
  3. 合并方式      approve 后自动合并（默认）；pr-check 每 5min 查一次（定时进程存活期间）
  4. 合并后清理    worktree ~/AI/acme-search-feat-search-zh + 本地 branch feat/search-zh；
                   远程 origin/feat/search-zh: 删除（默认）
  5. 合并后流转    #m-8f3k2: 组员开发 → 创建者验收

--- body ---
## 背景
中文查询在搜索接口直接落空——现有 analyzer 是默认英文分词器，无法切分中文词。
## 方案
搜索索引与查询链路接入 ik analyzer；配置集中在 src/search/analyzer.ts。
## 重点评审
> analyzer 配置同时影响索引和查询，优先检查配置一致性与旧索引兼容路径。
1. 看 **src/search/analyzer.ts**：核对冷启动首查是否同步加载词典；若是，首查延迟可能超出接口目标。
2. 看 **src/search/query.ts**：确认查询与建索引使用相同 analyzer；配置不一致会导致已索引内容无法命中。
3. 看 **test/search-zh.test.ts**：确认覆盖旧索引兼容或明确要求重建；缺少两者时，本 PR 的迁移路径不完整。
--- Affected（仅此处展示，不进 body）---
src/search/
├── analyzer.ts
└── query.ts
test/
└── search-zh.test.ts (新)

回「OK」全自动到底；或直接说改哪项。
```

用户回：「OK」——此后零交互。

## Step 6: 全自动执行

```
$ git push -u origin HEAD                            # 新分支无 non-ff
$ gh pr create --title "..." --base main --body "..."
→ https://github.com/acme/acme-search/pull/142
# reviewer 空 → 跳过加 reviewer
node pr-check.mjs --watch --interval-seconds 300 --toolchain gh --pr 142
→ managed long process 保存句柄
→ 报告: PR 已创建 #142，已启动 pr-check 定时监控（每 5min，执行进程存活期间有效）
```

## pr-check 定时进程（每 5min 自动）

```
第 1..N 轮: PR_CHECK state=OPEN mergeable=false approved=false
第 N+1 轮: PR_CHECK state=OPEN mergeable=true approved=true
             PR_WATCH reason=READY runs=N+1 → 进程退出并通知 agent
agent:       gh pr merge 142 --merge ✅
             单轮 pr-check → MERGED
             a. git worktree remove + prune ✅
             b. git branch -D feat/search-zh ✅
             c. git push origin --delete feat/search-zh ✅（全景默认删）
             d. Read post-merge.md → 平台原生 Skill 调用 → #m-8f3k2 流转「创建者验收」✅
             e. 通知用户 ✅
```

## 终态

PR 合并，worktree / 本地 branch / 远程分支三件套全清，任务已流转——**全程用户只确认了一次全景计划**。

> 对比旧链路：菜单 → 决策线 → commit-tidy 等待 → Gate Title-Body → Gate PR 共 5 拦，且合并后只清 worktree 留 branch 残留（生产实证的两个断点，本版已闭环）。

## 变体提醒

- 执行宿主退出或 managed process 句柄丢失 → 定时进程停止；下次进 dev-land 由 Step 2b 补清检测兜底
- tests fail + 用户说「提 PR」→ 作为风险项进入 PR 全景，由唯一一次全景确认决定；用户说「discard」→ 不跑 tests 直接走 Discard 全景
- PR 被 reviewer 关闭 → pr-check 输出 `PR_WATCH reason=CLOSED`，agent 报告「PR 被关未合，全部保留」
- push 执行时意外撞 non-fast-forward → 停止并报告，不追加 force 询问；用户要求继续时生成一份明确包含 `force-with-lease` 风险的新全景
