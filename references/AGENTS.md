# references/ — 插件级共享参考文档

> 顶层 `references/`，区别于各 skill 目录内部的 `skills/<name>/references/`（skill 私有细节，不共享）。本目录放**跨 skill 共享**或**从 vendor 抽取**的参考材料。

## 角色

- **共享 reference**：内容会被 2 个以上 skill 引用的材料放这里，避免同一段规则在多个 SKILL.md 里重复维护、各自漂移。
- **vendor 抽取物**：`vendor/superpowers/vendor-integration.json` 里 `action: "extract-references"` 的条目，由 `scripts/vendor-sync.mjs` 同步落到这里（机制见 `vendor/AGENTS.md`）。这部分文件的"真值源"在 vendor 侧，本目录只是分发落点，手改会在下次跑 sync 脚本时被上游覆盖。
- 本目录**不进 SessionStart 常驻注入**——内容不会自动进 agent context，只有被某个 SKILL.md 显式 `Read` 引用时才加载（progressive disclosure）。唯一的部分例外：`skill-integration-map.md` 的 `last_verified` frontmatter 字段会被 `hooks/inject-rules.sh` 在 SessionStart 读取做"超 90 天未核验"的过期告警，但只读这一个字段，不注入正文。

## 改动前必查引用方

改这里任何一个文件前，先跑一遍：

```bash
rg -l "<不带扩展名的文件名>" --glob '!references/*' -g '!.git' -g '!vendor/*'
```

确认谁在读它，理由：

1. **有些文件是 vendor 同步管理的**（下表"来源"列标 vendor 的行）——手改会在下次 `node scripts/vendor-sync.mjs` 时被上游覆盖。真要改，应该去改 `vendor/superpowers/vendor-integration.json` 的抽取规则，或者去改 vendor 侧的上游源，而不是直接编辑 `references/` 下的落点文件。
2. **有些文件已经没有活跃引用方**——是早期 skill-fusion RFC（`docs/superpowers/specs/3dot141/rfc-skill-fusion-pipeline.md`）阶段的产物，后来被各 skill 自己 `references/` 目录下的演化版本取代（例如 `implementer-prompt.md` / `spec-reviewer-prompt.md` 已被 `skills/dev-build/references/` 下同名但内容已明显分叉的版本取代——两者做了 diff，措辞、结构、字段都不一样了）。改这类文件前先确认是不是在改一份"没人读"的历史遗留；如果是，价值有限，优先考虑改真正被消费的那份。
3. **`receiving-code-review.md` 是重复文件**：内容与正式 skill `skills/receiving-code-review/SKILL.md`（`vendor/superpowers/vendor-integration.json` 标记 `keep-as-skill`）基本一致，是一份未清理的旧副本。不要在这两处各改一半——真正生效的是 `skills/receiving-code-review/SKILL.md`。

## 引用方速查（写本文档时核实，日后改动请重新核实一遍）

| 文件 | 谁在读 | 活跃度 |
|---|---|---|
| `debug-protocol.md` | `skills/devflow/SKILL.md`（Debug 阶段路由表） | 活跃 |
| `skill-integration-map.md` | `skills/devflow/SKILL.md`（skill 集成映射脚注）+ `hooks/inject-rules.sh`（SessionStart 只读 `last_verified` frontmatter 做过期 warn） | 活跃；改动时注意维护/更新文件头的 `last_verified: <yymmdd>` 字段 |
| `testing-anti-patterns.md` | `skills/systematic-debugging/SKILL.md` | 活跃；同时是 vendor 同步管理（来自 superpowers `test-driven-development`） |
| `code-reviewer-prompt.md` | 无活跃引用方 | vendor 同步管理（来自 superpowers `requesting-code-review`），仅供参考，dev-review 现走的是 ECC `agents/code-reviewer.md` |
| `plan-document-reviewer-prompt.md` | 无活跃引用方 | vendor 同步管理（来自 superpowers `writing-plans`），dev-plan 未引用 |
| `findings-schema.md` | 无活跃引用方 | 已被 `skills/references/reviewing/findings-contract.md` 取代为 findings 分级的当前单源（后者明确说明是为统一"历史上长出的 5 种分级体系"而生） |
| `implementer-prompt.md` | 无活跃引用方 | 已被 `skills/dev-build/references/implementer-prompt.md`（内容已分叉演化）取代 |
| `spec-reviewer-prompt.md` | 无活跃引用方 | 已被 `skills/dev-build/references/spec-reviewer-prompt.md`（内容已分叉演化）取代 |
| `code-quality-reviewer-prompt.md` | 无活跃引用方 | 对应的演化版本是 `skills/dev-build/references/quality-reviewer-prompt.md` |
| `receiving-code-review.md` | 无活跃引用方 | 与 `skills/receiving-code-review/SKILL.md` 内容重复，真源在后者 |

> 判定方法：命中 `skills/*/SKILL.md` 或 `hooks/` 下的脚本才算活跃引用；命中 `docs/superpowers/specs/` 下的 RFC/设计文档不算——那是历史决策记录，不是当前消费者。
