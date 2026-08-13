# dev-design

primary_route: dev-design
acceptable_alternates: []
preamble_profiles: [cold, mid-task-momentum]

default_intent:
  must_action_ids: ["skill-dev-design", "persist-waiting-round", "ask-one-question"]
  forbidden_action_ids: ["write-code", "skip-to-plan", "solution-before-grilling", "split-clarification-skill"]

# action-id 词表(含干扰项):
#   skill-dev-design / persist-waiting-round / ask-one-question / write-design-md
#   write-code(反) / skip-to-plan(反) / solution-before-grilling(反) / split-clarification-skill(反)
#   skill-dev-plan(无关) / skill-dev-build(无关) / skill-dev-review(无关)

## positive

- 澄清一下这个工程任务，然后给技术设计
- 这个 feature 到底要解决什么问题，先追问我
- 帮我写一份技术设计文档
- 这个 bug 的 expected 和 actual 需要先对齐
- 给这个重构设计 Before / After / Invariants
- 方案对比一下，但先把所有关键问题问清楚
- 技术选型用 Redis 还是 Memcached
- design doc for the new search feature

## negative

- [other-rule-primary] 按 confirmed plan 开始写代码              # → dev-build
- [other-rule-primary] 把 DES-001 到 DES-004 拆成任务             # → dev-plan
- [other-rule-primary] review 一下这个 diff                       # → dev-review
- [other-rule-primary] 测试都跑完了，帮我提 PR                    # → dev-land
- [near-miss]          解释一下这个函数为什么这样写               # → 直接回答
- [near-miss]          看一下当前 git status                       # → 只读查询
- [explicit-exclusion] 只改 README 里这个错别字                    # → 直接执行
- [explicit-exclusion] 写个 commit message                         # → 直接回答
