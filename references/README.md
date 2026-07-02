# references/

插件级共享参考文档。区别于 `skills/<name>/references/`（各 skill 私有细节），这里放跨 skill 共享，或从 vendor 抽取出来的参考材料。

## 清单

| 文件 | 一句话说明 | 来源 |
|---|---|---|
| `code-quality-reviewer-prompt.md` | dispatch "代码质量 reviewer" subagent 的 prompt 模板（完整性 / 质量 / 纪律 / 测试四维度自审清单） | 早期 skill-fusion RFC 手写 |
| `code-reviewer-prompt.md` | dispatch 通用 code reviewer subagent 的 prompt 模板（plan 对齐 + 代码质量检查） | vendor：superpowers `requesting-code-review` |
| `debug-protocol.md` | Build/Verify 阶段卡住时的横切调试流程（复现 → 定位 → 假设排序 → 根因确认），融合 superpowers systematic-debugging + agent-skills debugging-and-error-recovery | 早期 skill-fusion RFC 手写 |
| `findings-schema.md` | Design + Code Review 共用的 finding 结构定义（Critical / Warning / Suggestion / OpenQuestion / SelfAudit 五档 + override 策略） | 早期 skill-fusion RFC 手写 |
| `implementer-prompt.md` | dispatch implementer subagent 的 prompt 模板（任务描述 / 上下文 / 自审清单 / 报告格式） | vendor：superpowers `subagent-driven-development`（历史遗留，已被 `skills/dev-build/references/implementer-prompt.md` 取代） |
| `plan-document-reviewer-prompt.md` | dispatch plan 文档 reviewer subagent 的 prompt 模板（完整性 + 与 spec 对齐 + task 拆分质量） | vendor：superpowers `writing-plans` |
| `receiving-code-review.md` | 收到 code review 反馈时的处理方法论（验证优先，不盲从、不表演性认同） | vendor：superpowers `receiving-code-review`（与正式 skill `skills/receiving-code-review/SKILL.md` 内容重复的旧副本） |
| `skill-integration-map.md` | agent-skills（24 个）+ superpowers（14 个）全部 skill 到 devflow 8 阶段的完整映射表 | 早期 skill-fusion RFC 手写 |
| `spec-reviewer-prompt.md` | dispatch spec compliance reviewer subagent 的 prompt 模板（"不要相信 implementer 报告，去读代码核实"） | vendor：superpowers `subagent-driven-development`（历史遗留，已被 `skills/dev-build/references/spec-reviewer-prompt.md` 取代） |
| `testing-anti-patterns.md` | 测试反模式清单（mock 滥用 / 测试专用生产代码等），写测试或加 mock 前加载 | vendor：superpowers `test-driven-development` |

哪些文件还有活跃引用方、改动前要注意什么，见 `AGENTS.md`。
