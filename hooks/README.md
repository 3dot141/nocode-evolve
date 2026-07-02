# hooks/

### 职责

Claude Code 插件生命周期 hook 的注册与实现：SessionStart 规则注入、PreToolUse 危险命令拦截 + 防跳步提醒、PostToolUse 用量统计、Stop 防跳步收口。配套单测（含物理放在本目录、但覆盖 `../scripts/` 模块的用例）。

### 文件清单

**注册与注入**

| 文件 | 作用 |
|---|---|
| `hooks.json` | hook 注册总表：SessionStart（11 条 command）、PreToolUse（`Bash` / `Skill` / `*` 三个 matcher）、PostToolUse（`*` / `Read` 两个 matcher）、Stop（`*`）。Claude Code 按约定自动读取本文件，`.claude-plugin/plugin.json` 不需要显式声明 hooks 路径。 |
| `inject-rules.sh` | SessionStart 注入脚本，按位置参数 `$1`（segment：`model-about` / `model-personal` / `model-karpathy` / `model-catalog-using` / `model-catalog-1`~`model-catalog-5` / `project`）读取对应文件，包一层 `hookSpecificOutput.additionalContext` JSON 输出。每个 segment（= 每个 command）独立判 10000 字符阈值（hook 官方硬编码截断线），避免旧版"合并输出"整坨超限被截断。首个 segment（`model-about`）额外跑一次 sanity check：manifest/生成物 drift、`model/*.md` 孤儿段（有文件无 segment 映射）、`rules/rule-*.md` 未被任一 catalog 分片引用、`skill-integration-map.md` 的 `last_verified` 是否超 90 天。 |

**规则生成链**

| 文件 | 作用 |
|---|---|
| `generate.mjs` | 单源生成器：`rules/manifest.json` → `model/agent-catalog-N.md`（按桶切片常驻注入，单片 ≤9000 字符 `SHARD_LIMIT`，最多 5 片 `MAX_CATALOG_SHARDS`）+ `hooks/pretooluse-rules.json` + `hooks/workflow-skills.json`。`node hooks/generate.mjs` 写文件（并清理残留旧分片）；`--check` 只比对生成物与源是否一致，不一致则打印 drift 列表并 `exit 1`。 |
| `pretooluse-rules.json` | **生成物，禁手改**。`pretooluse-guard.mjs` 的拦截靶数据：`{rule, pattern, decision, reason}[]`，源自各 rule 的 `pretooluse[]` 字段。 |
| `workflow-skills.json` | **生成物，禁手改**。`skill-entry-reminder.mjs` 消费的"防跳步" workflow skill 名单（当前 16 个，如 `nocode:devflow` / `nocode:dev-build` 等），源自 manifest 顶层 `workflow_skills[]`。 |
| `manifest.test.mjs` | 校验 `rules/manifest.json` 自身完整性：rule id 唯一、`bucket`/`also_buckets` 均在 `buckets` 里存在、必填字段齐全、schema 扩展字段（`depends_on`/`severity`/`lifecycle_stage`）齐全等，纯校验不落盘。 |
| `generate.test.mjs` | 校验 `generate.mjs` 的切片/渲染逻辑：当前 manifest 分片在阈值内、首片含头部指令、超长 manifest 切多片但桶不被切断、跨桶 rule（`also_buckets`）在目标桶可发现、`guard` 字段正确上浮等。 |

**PreToolUse hook**

| 文件 | 作用 |
|---|---|
| `pretooluse-guard.mjs` | matcher `Bash`。用 `pretooluse-rules.json` 的正则靶匹配即将执行的命令（先做空白规范化防换行绕过）：命中 `block` → `permissionDecision: deny` 并给理由；命中 `inject`（默认放行）→ 附加 `additionalContext` 提醒。可选环境变量 `NOCODE_EVOLVE_OBSERVE=1` 开启 bypass 观测落盘到 `.bypass-observations.jsonl`（默认关闭）。 |
| `skill-entry-reminder.mjs` | matcher `Skill`。进入 `workflow-skills.json` 名单内的 skill 时注入"防跳步三条提醒"（① Step 0 先建齐全部 task ② 走完所有 Step ③ 末尾交接下一阶段）。`agent_id` 非空（fork/subagent）时不触发；`tool_input.skill` 不在名单也不触发。 |

**Stop hook**

| 文件 | 作用 |
|---|---|
| `handoff-stop-guard.mjs` | matcher `*`（防跳步 Hook B）。单遍重放 transcript 里的 `TaskCreate`/`TaskUpdate` 事件，重建各 task 的 `status`；若存在 `metadata.handoff === true` 且状态仍 `pending`/`in_progress`、且是当前唯一处于活动态的 task → `decision: block`，提示"交接未完成"。所有解析失败路径（transcript 读取失败、JSON 坏行、`agent_id` 非空、`stop_hook_active`）一律 fail-open 放行，不阻断 session。 |

**PostToolUse hook**

| 文件 | 作用 |
|---|---|
| `usage-tracker.mjs` | matcher `Read`。当 Read 命中 `.agents-personal/wiki/{pages,draft}/` 下的页面文件，在 `wiki/status.md` 聚合表里给对应 key 计数 +1、刷新最后引用时间（同一 key 只有一行，更新而非追加）。用 `RepoLock` 短超时（150ms，远小于默认 2000ms）防止锁竞争时拖慢用户的 Read 调用；拿不到锁直接跳过，漏记一次统计的代价远小于阻塞交互。 |

> `hooks.json` 里还注册了两个物理不在本目录的 hook：SessionStart 的 `node scripts/personal-snapshot.mjs`，以及 PreToolUse/PostToolUse 全量 matcher 上的 `skills/continuous-learning-v2/hooks/observe.sh`——都是本目录 hook 链的协作方，各自的实现和文档归属对应目录，本文件不重复维护。

**单测（部分测试文件测的是 `../scripts/` 模块）**

`dream-baseline.test.mjs` / `plugin-dream-baseline.test.mjs` / `personal-migrate.test.mjs` / `personal-snapshot.test.mjs` / `project-tree-detect.test.mjs` / `repo-lock.test.mjs` / `git-exec.test.mjs` 这 7 个测试文件物理放在 `hooks/`，但 `import` 的源模块在 `../scripts/`。这是有意为之：让 `node --test 'hooks/*.test.mjs'` 一条命令就能覆盖 hook 链间接依赖的全部底层工具模块（锁、git 封装、快照迁移等），不用额外记一条 `scripts/*.test.mjs` 命令。其余测试文件（`generate` / `manifest` / `handoff-stop-guard` / `pretooluse-guard` / `skill-entry-reminder` / `usage-tracker`）测的是本目录内的同名 `.mjs`。

### hook 注册机制

`hooks.json` 是 Claude Code 插件的标准 hook 清单，四类事件：

```
SessionStart  → 10× inject-rules.sh <segment>
                  (model-about / model-personal / model-karpathy / model-catalog-using /
                   model-catalog-1 ~ model-catalog-5 / project)
              → 1× node scripts/personal-snapshot.mjs
PreToolUse    → matcher=Bash   → pretooluse-guard.mjs          (危险命令 deny/inject)
              → matcher=Skill  → skill-entry-reminder.mjs      (防跳步提醒 Hook A)
              → matcher=*      → skills/continuous-learning-v2/hooks/observe.sh
PostToolUse   → matcher=*      → skills/continuous-learning-v2/hooks/observe.sh
              → matcher=Read   → usage-tracker.mjs              (wiki 引用计数)
Stop          → matcher=*      → handoff-stop-guard.mjs         (防跳步收口 Hook B)
```

`${CLAUDE_PLUGIN_ROOT}` 由 Claude Code 运行时注入插件安装路径；`inject-rules.sh` 处理 `model-about` segment 时会把它连同 `NOCODE_SKILL_REF` 一起写进 `$CLAUDE_ENV_FILE`，供同一 session 后续的 Bash tool 调用直接引用这两个环境变量。

### 生成链路

```
rules/manifest.json  (唯一真值源: buckets + rules + workflow_skills)
        │
        ▼  node hooks/generate.mjs
        ├─→ model/agent-catalog-1.md ~ agent-catalog-5.md   (按桶切片, 单片 ≤9000 字符, SessionStart 常驻注入)
        ├─→ hooks/pretooluse-rules.json                      (PreToolUse 拦截靶)
        └─→ hooks/workflow-skills.json                       (防跳步 skill 名单)
```

一致性兜底：SessionStart 首个 segment 自动跑 `generate.mjs --check`，drift 只 warn 不阻断 session；提交前应手动跑 `--check` 确认 `exit 0`。

### 如何测试

```bash
node --test 'hooks/*.test.mjs'        # 全量单测（含 ../scripts/ 模块），当前 163 例
node hooks/generate.mjs --check       # 生成物与 manifest 一致性校验
node hooks/generate.mjs               # 重新生成（改了 rules/manifest.json 之后）
```

单个 hook 手动调试（约定都是 stdin JSON → stdout JSON）：

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"git push --force"}}' \
  | node hooks/pretooluse-guard.mjs
```
