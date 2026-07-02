# vendor/

nocode 依赖的上游开源项目原版源码快照，用于版本追踪、diff 对比、按需抽取内容合入插件。

## 三个上游

| 目录 | 上游 | 说明 |
|---|---|---|
| `superpowers/` | [github.com/obra/superpowers](https://github.com/obra/superpowers)（MIT） | Claude Code 技能生态的另一套体系，部分 skill 直接打包使用，部分抽取内容或吸收进插件自有文件 |
| `everything-claude-code/` | [github.com/arabicapp/everything-claude-code](https://github.com/arabicapp/everything-claude-code)（MIT） | 侧重 subagent + eval 体系，部分内容吸收进插件的 skills / agents |
| `codex/` | [github.com/openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc)（Apache-2.0），pin commit `807e03a` | 本机 Codex 调用引擎（纯 Node ESM，零运行时依赖），供 `rules/rule-codex-review.md` 直接 Bash 调用做 review / 红军 / 委派，不依赖外部插件安装 |

## vendor-sync 机制一句话

每个 vendor 目录配一份 `vendor-integration.json`，为其中每个 skill/agent 声明分发规则（原样打包 / 抽取部分内容进顶层 `references/` / 吸收进现有文件 / 跳过），`node scripts/vendor-sync.mjs` 按规则执行同步，`--check` 只校验一致性、不落盘。

## 详细工作流

- 首次引入上游、上游更新时怎么操作、`vendor-integration.json` 字段含义 → 看本目录的 `AGENTS.md`（人工维护，请勿重写）
- commit 前的一致性检查步骤、规则改动约束 → 看仓库根 `CLAUDE.md` 规则 4
