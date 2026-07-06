# Example: PR 路径全景计划着陆（happy path 1 拦）

场景：worktree 内分支 `feat/search-zh`，base=main（`nocode-base` 配置），GitHub 仓库，push range 3 个 commit，commit 带任务号 `#m-8f3k2`（当前状态「组员开发」）。用户说「提 PR」。

---

## Step 1-4（全部无交互）

```
Step 1 工具栈: remote 含 github.com → gh；补清检测: gh pr view → no pull requests found → 继续
Step 2 意图推定: 「提 PR」→ PR，不出菜单
Step 3 tests: npm test → 42 passing ✅
Step 4 材料收集: base=main(nocode-base) · push range 3 commits · 整理建议(1 个 wip 串)
       title/body(pr-body-contract) · Affected 3 文件 · reviewer=空(无 protection/CODEOWNERS)
       任务号 #m-8f3k2 → Read post-merge.md → 推定目标状态「研发已改待BUILD」
       远程坐标: origin/feat/search-zh
```

## Step 5: 全景计划（回合末尾文本，唯一主 Gate）

```
[全景计划] feat/search-zh → PR → origin/main（来源: nocode-base），确认后全自动:
  1. commit 整理   建议 squash d4e5f6a+b7c8d9e 进 a1b2c3d（默认: 跳过，原样进 PR）
  2. push + 建 PR  title「feat(search): 中文分词接入 ik analyzer」
                   body 与 Affected 见下；reviewer: 空
  3. 合并方式      approve 后自动合并（默认）；cron 每 5min 查一次（本会话内有效）
  4. 合并后清理    worktree ~/AI/acme-search-feat-search-zh + 本地 branch feat/search-zh；
                   远程 origin/feat/search-zh: 删除（默认）
  5. 合并后流转    #m-8f3k2: 组员开发 → 研发已改待BUILD

--- body ---
## 背景
中文查询在搜索接口直接落空——现有 analyzer 是默认英文分词器，无法切分中文词。
## 方案
搜索索引与查询链路接入 ik analyzer；配置集中在 src/search/analyzer.ts。重点评审：
ik 词典加载时机（冷启动首查延迟）与旧索引兼容性——旧索引需重建，本 PR 未含重建脚本。
--- Affected（仅此处展示，不进 body）---
src/search/analyzer.ts
src/search/query.ts
test/search-zh.test.ts

回「OK」全自动到底；或直接说改哪项。
```

用户回：「OK」——此后零交互。

## Step 6: 全自动执行

```
$ git push -u origin HEAD                            # 新分支无 non-ff
$ gh pr create --title "..." --base main --body "..."
→ https://github.com/acme/acme-search/pull/142
# reviewer 空 → 跳过加 reviewer
CronCreate(cron: "2-59/5 * * * *", prompt: "[pr-watch #142] 单轮检查…（prompt 自足:
  worktree/MAIN_ROOT/任务号 m-8f3k2/目标状态 研发已改待BUILD/远程坐标全写死）")
→ 报告: PR 已创建 #142，已注册 cron 监控（每 5min，本会话内有效）
```

## cron 轮（每 5min 自动）

```
第 1..N 轮: node pr-check.mjs --toolchain gh --pr 142
           → PR_CHECK state=OPEN mergeable=false approved=false → 本轮结束
第 N+1 轮: → PR_CHECK state=OPEN mergeable=true approved=true
           → gh pr merge 142 --merge ✅
第 N+2 轮: → PR_CHECK state=MERGED ...
           a. git worktree remove + prune ✅
           b. git branch -D feat/search-zh ✅
           c. git push origin --delete feat/search-zh ✅（全景默认删）
           d. Read post-merge.md → Skill(nocode:lark-project) → #m-8f3k2 流转「研发已改待BUILD」✅
           e. 通知用户 + CronList 找 "[pr-watch #142]" → CronDelete ✅
```

## 终态

PR 合并，worktree / 本地 branch / 远程分支三件套全清，任务已流转——**全程用户只确认了一次全景计划**。

> 对比旧链路：菜单 → 决策线 → commit-tidy 等待 → Gate Title-Body → Gate PR 共 5 拦，且合并后只清 worktree 留 branch 残留（生产实证的两个断点，本版已闭环）。

## 变体提醒

- 用户中途关会话 → cron job 消失；下次进 dev-finish-branch 由 Step 1 补清检测兜底
- tests fail + 用户说「提 PR」→ hard stop 不进全景；用户说「discard」→ 不跑 tests 直接走 Discard 全景
- PR 被 reviewer 关闭 → cron 轮报告「PR 被关未合，全部保留」+ 自删
