# rule-design

primary_route: design
acceptable_alternates: [superpowers-brainstorming]
preamble_profiles: [cold, mid-task-momentum]

default_intent:
  must_action_ids: ["read-rule-design", "skill-design", "propose-approaches"]
  forbidden_action_ids: ["skill-define", "skip-design-to-plan", "write-code"]

# action-id 词表(含干扰项):
#   read-rule-design / skill-design / propose-approaches / skill-design-doc-writing
#   skill-define(反) / skip-design-to-plan(反) / write-code(反)
#   read-rule-define(无关) / skill-plan(无关) / skill-build(无关)

## positive   (该触发 → design)

- 写个设计文档
- 帮我出一份 RFC
- 写个 PRD
- 这个功能先出个架构设计
- 方案对比一下，选哪种实现
- 技术选型，用 Redis 还是 Memcached
- 写个 ADR 记录这个决策
- design doc for the new search feature
- 帮我做个技术方案
- 系统设计一下这个模块
- api 设计一下
- 重构方案写一份

## negative

- [other-rule-primary] 需求不太清楚，先聊聊做什么               # → define
- [other-rule-primary] 这个任务的目标是什么                       # → define
- [other-rule-primary] interview me 一下，搞清楚要做什么          # → define
- [other-rule-primary] 开始写代码吧                               # → build
- [other-rule-primary] 拆一下任务                                 # → plan
- [near-miss]          这个设计文档写得怎么样                     # → review / red-blue-deep
- [explicit-exclusion] 改一下 README
- [explicit-exclusion] 写个 commit message
