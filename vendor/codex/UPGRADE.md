# vendor/codex — 升级与维护

`openai/codex-plugin-cc` 的**引擎部分**(纯 Node ESM,零运行时依赖)按快照 vendor 进本仓,
让 nocode-evolve 能自包含地调用本机 Codex 做 review / 红军 / 委派,**不依赖外部插件的安装与门控**。

调用方在 `rules/rule-codex-review.md`(直接 Bash 调下面的 companion verb)。

## 来源 / Pin

| 项 | 值 |
|---|---|
| 上游仓 | https://github.com/openai/codex-plugin-cc |
| pin commit | `807e03ac9d5aa23bc395fdec8c3767500a86b3cf` |
| 上游插件版本 | `1.0.4` (2026-04-18) |
| License | Apache-2.0(`LICENSE` / `NOTICE` 原样保留,vendored 文件未改动) |

## 前置(运行时)

只需本机 **Codex CLI**,不需要安装 `codex-plugin-cc` 插件:

```bash
npm i -g @openai/codex
codex login            # ChatGPT 账号或 API key
node vendor/codex/scripts/codex-companion.mjs setup --json   # ready:true 即可用
```

## vendor 了什么 / 裁剪了什么

**原样镜像(禁止编辑——保证 re-sync 零冲突):**

```
vendor/codex/
  scripts/                # companion 入口 + lib/ + broker(引擎全部)
  prompts/                # adversarial-review 等模板
  schemas/                # review 结构化输出 schema
  .claude-plugin/plugin.json   # app-server.mjs 启动读它取 version(纯数据)
  LICENSE  NOTICE         # Apache-2.0 必留
```

**裁掉(上游有,本仓不要):** `commands/` `agents/` `skills/` `hooks.json` `tests/` `.github/`。
原因:命令层带 `disable-model-invocation` 门控(Claude 无法自动触发)。本仓不走命令层,
由 `rules/rule-codex-review.md` 直接 Bash 调 companion verb → 全自动、无门控、也没有需要改动的文件。

> 路径自解析:`codex-companion.mjs` 用 `import.meta.url` 定位 `scripts/` 的父目录为 root,
> 再找 `schemas/` `prompts/` `.claude-plugin/`,**不读 `CLAUDE_PLUGIN_ROOT`**,所以脱离插件上下文也能独立 `node` 跑。

## 调用面(规则依赖的契约)

```bash
node vendor/codex/scripts/codex-companion.mjs review            [--wait|--background] [--base <ref>] [--scope auto|working-tree|branch]
node vendor/codex/scripts/codex-companion.mjs adversarial-review [--wait|--background] [--base <ref>] [--scope ...] [focus text]
node vendor/codex/scripts/codex-companion.mjs task              [--write] [--model <model|spark>] [--effort ...] [prompt]
```

升级若发现这三个 verb 的接口变了(flag 改名 / 行为变),同步改 `rules/rule-codex-review.md` 并更新本文件。

## 如何升级(re-sync)

引擎是干净镜像,升级 = 覆盖 3 个目录,无需手动 merge:

```bash
PIN=<新 commit 或 tag>            # 不填则取 main 最新
git clone --depth 1 https://github.com/openai/codex-plugin-cc.git /tmp/cpc
cd /tmp/cpc && [ -n "$PIN" ] && git fetch --depth 1 origin "$PIN" && git checkout "$PIN"; cd -

rm -rf vendor/codex/scripts vendor/codex/prompts vendor/codex/schemas vendor/codex/.claude-plugin
cp -R /tmp/cpc/plugins/codex/scripts   vendor/codex/scripts
cp -R /tmp/cpc/plugins/codex/prompts   vendor/codex/prompts
cp -R /tmp/cpc/plugins/codex/schemas   vendor/codex/schemas
cp -R /tmp/cpc/plugins/codex/.claude-plugin vendor/codex/.claude-plugin
cp /tmp/cpc/plugins/codex/LICENSE vendor/codex/LICENSE
cp /tmp/cpc/plugins/codex/NOTICE  vendor/codex/NOTICE

node vendor/codex/scripts/codex-companion.mjs help     # 跑通即 OK

# 然后:更新本文件的 pin commit / 版本,按 SemVer 升 .claude-plugin/plugin.json,一并 commit
```
