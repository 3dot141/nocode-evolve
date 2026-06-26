# Vendor: superpowers

| 字段 | 值 |
|---|---|
| 上游仓库 | https://github.com/obra/superpowers |
| 版本 | 5.1.0 |
| commit | e4a2375cb705ca5800f0833528ce36a3faf9017a |
| 拉取日期 | 2026-06-26 |
| 协议 | MIT |
| 排除 | .git/ tests/ .github/ assets/ .in_use/ *.svg *.png |

## 更新流程

```bash
# 1. 拉取上游最新
cd /tmp && git clone --depth 1 https://github.com/obra/superpowers.git superpowers-upstream

# 2. diff 对比（只看 skills/ hooks/ CLAUDE.md）
diff -rq /tmp/superpowers-upstream/skills vendor/superpowers/skills
diff -rq /tmp/superpowers-upstream/hooks vendor/superpowers/hooks

# 3. 逐文件审查变更，决定是否合入
# 4. 更新本文件的版本/commit/日期
# 5. 清理
rm -rf /tmp/superpowers-upstream
```

## 合入状态

每个 skill 的集成状态。agent 或人工合入内容后更新此表。

| skill | 状态 | nocode-evolve 对应 | 说明 |
|---|---|---|---|
| using-superpowers | **已合入** | `model/agent-catalog-using.md` | Red Flags + 调用纪律 + 指令优先级 |
| brainstorming | overlay | `rule-superpowers-brainstorming` | rule overlay 叠输出路径 + worktree |
| finishing-a-development-branch | overlay | `rule-finishing-branch` + `dev-land` | rule overlay 叠 Gate 体系 |
| using-git-worktrees | overlay | `rule-git-worktree` | rule overlay 叠 setup/teardown |
| writing-plans | 吸收 | `dev-plan` | 核心方法论已融进 dev-plan |
| test-driven-development | 吸收 | `dev-build` (TDD Iron Law) | Iron Law + testing-guide.md |
| verification-before-completion | 吸收 | `dev-verify` | 证据收集 + 验收核对 |
| requesting-code-review | 吸收 | `dev-review` + `codex-review` | 五轴评审 + Codex 红军 |
| receiving-code-review | 待评估 | — | 收到 review 反馈的处理流程 |
| dispatching-parallel-agents | 吸收 | `agents-launcher` + `research-engine` | 并行 agent 编排 |
| subagent-driven-development | 吸收 | `agents-launcher` | implementer/reviewer prompt 可参考 |
| executing-plans | 吸收 | `dev-build` | plan 执行循环 |
| systematic-debugging | **待合入** | — | 最大缺口：系统化调试流程 |
| writing-skills | 待评估 | — | 写 skill 的方法论 + best practices |
| using-superpowers/references/* | 不需要 | — | Codex/Copilot/Gemini 平台适配，不相关 |

### 状态定义

- **已合入**: 内容已融入 nocode-evolve 自有文件，vendor 版本仅做上游追踪参考
- **overlay**: nocode-evolve 通过 rule overlay 扩展该 skill，skill 本身仍由 superpowers 插件提供（卸载后需接管）
- **吸收**: 核心方法论已提取到自有 skill/reference，不再直接调用 superpowers 版本
- **待合入**: 有价值但尚未集成
- **待评估**: 可能有价值，需进一步判断
- **不需要**: 与 nocode-evolve 无关
