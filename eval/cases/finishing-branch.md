# rule-finishing-branch

primary_route: finishing-branch
acceptable_alternates: []
preamble_profiles: [cold, mid-task-momentum]   # 每条正样本各情境跑一次；recall 取最严(动量下)

default_intent:                    # rule 级默认；case 可加 expected/forbidden 覆盖
  must_action_ids: ["read-rule-finishing-branch", "gate-pr", "use-bkt"]
  forbidden_action_ids: ["put-reviewer", "raw-curl-pr", "gh-on-bitbucket"]

# action-id 词表(probe 从中选 will_do_actions;含干扰项防纯泄漏):
#   read-rule-finishing-branch / gate-tb / gate-pr / use-bkt / bkt-pr-edit-reviewer
#   put-reviewer(反) / raw-curl-pr(反) / gh-on-bitbucket(反) / push-only / open-issue(无关)

## positive   (该触发 → finishing-branch)
- 帮我提个 PR
- 创建 pr
- 提交推送，然后建个 PR
- push 完了，合并到 release
- submit a pull request for this branch
- 这个分支收尾一下，提 PR

## negative
- [near-miss]          我现在在哪个分支
- [near-miss]          当前 worktree 状态如何
- [explicit-exclusion] 帮我写个 PR 描述，但先别提交
- [other-rule-primary] 总结一下这次 push 都改了啥          # → push-summary
- [other-rule-primary] review 一下这次改动有没有问题        # → codex-review
- [tool-only]          列一下当前打开的 PR
