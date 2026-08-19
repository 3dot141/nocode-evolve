# Header
- task: 补齐完整 grill-me / show-me 上游 skill，引用改指原版
- status: active
- type: feat
- predecessor: 无
- createdAt: 2026-08-19T23:05:00+0800
- artifacts:
  - log: ./design.log.md

# Decisions

## DEC-001
- 描述: 收录完整上游 skill 并改指原版引用
- 内容: ①收录 mattpocock/skills 的 grill-me + grilling（原始语）与 humanlayer/skills 的 show-me 三个完整上游 SKILL.md（逐字，可对照同步）；②skill 中对这两个的引用改为**直接调用**原版 skill（Skill(nocode:grilling) / Skill(nocode:show-me)），不内联、不改写；③仅 agent-about.md 保留引用 visual-forms.md；④grilling-loop.md 删除——dev-design/references/grilling.md 恢复为纯 Log 持久化协议 + 调用指向，不承载面试方法内容；⑤references/README.md 索引同步；⑥hooks/dev-design-contract.test.mjs 契约断言同步（存在性清单换三个新 skill、断言指向调用关系；另修复上一任务遗留的四件套旧断言与 platform fixture 哈希）。
- 后果: dev-design 面试方法学 = 上游 grilling 原文（rounds/frontier 模型）；grilling.md 只管 Log 落盘。已知点：上游 grill-me 原文写裸 "grilling" 调用，插件命名空间下实际为 nocode:grilling——保持逐字以保可同步性。
- 过程: 用户指令「补充两个完整 grill-me 和 show-me，skill 中直接引用这两个不要使用自己改动的了，只有 agent-about.md 可以引用 visual-forms」；中途澄清「下载两个 skill 到 skills 目录中，然后其他 skill 直接要求调用对应的 skill」——纠正了初版的「内容并入 grilling.md」做法（已撤回）。
- 引用: [ROUND-001]

# ROUND

## ROUND-001 — closed
### 背景
知乎对 grill-me 的批评（过度追问）触发盘点：本仓 grill-me/show-me 以蒸馏方式吸收（4502d06/c77e30d），产生 grilling-loop.md/visual-forms.md 两个改写副本。用户拍板改用完整上游 skill 直接引用。grill-me=mattpocock/skills（包装层→grilling 原语）；show-me=humanlayer/skills/plugins/show-me。
### 问题
蒸馏改写版与上游原版的关系怎么收？
### 方案
收录原版三文件；引用改指；grilling-loop.md 拆分删除（原创纪律并入 grilling.md）；visual-forms.md 仅 agent-about.md 保留。
### 回答
用户指令即拍板。形成 DEC-001。
