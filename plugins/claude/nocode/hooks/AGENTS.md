# hooks/

本目录是插件的 hook 层：领域判断与平台 codec 共用，Claude Code / Codex adapter 分别生成各自支持的生命周期事件。两端都按约定自动读取生成发布物中的 `hooks/hooks.json`，无需在 manifest 显式声明路径。

## 动手前必须知道

1. **两类文件是生成物，禁止手改**（两条独立编译链，互不耦合）：
   - `hooks/pretooluse-rules.json`——源在 `scripts/compile.hooks.js`（规则硬编码在脚本内）。改
     PreToolUse 拦截靶 → 改 `compile.hooks.js` → 跑 `node scripts/compile.hooks.js` 重新生成。
   - `model/agent-rule-catalog-*.md`（不在本目录，但同一条生成链）——源是各 `rules/rule-*.md`
     顶部 frontmatter。改规则触发词 → 改对应文件的 frontmatter → 跑
     `node scripts/compile.rule.js` 重新生成。

   直接手改上述生成物会被下次重新生成覆盖，且会被 SessionStart 首个 segment 自动跑的两个
   `--check` 报 drift（只 warn 不阻断 session，但提交前应清干净）。

2. **hook 执行逻辑（各 `*.mjs` / `inject-nocode.sh`）不受这两条编译链约束**——直接改源文件即可，编译链只管"规则数据"，不管"hook 怎么跑"。

3. **新增/删改一个 SessionStart segment 或 PreToolUse/PostToolUse/Stop 挂载点**：编辑 `hooks/hooks.json`；若是新增 `model/` 下的常驻注入文件，还要同步在 `inject-nocode.sh` 的 `seg_file()` 加映射，否则会被 sanity check 警告"孤儿段"。

4. **改完必须跑**（先后顺序）：
   ```bash
   node scripts/compile.rule.js          # 如果碰了某 rules/rule-*.md 的 frontmatter
   node scripts/compile.rule.js --check  # 确认 exit 0，无 drift
   node scripts/compile.hooks.js         # 如果碰了 PreToolUse 规则数组
   node scripts/compile.hooks.js --check # 确认 exit 0，无 drift
   node --test 'hooks/*.test.mjs'        # 全量单测应全绿
   ```

5. **本目录文件全部参与插件运行或生成 → 任何改动都算插件更新**：编辑 `plugin/metadata.json` 的 `version`，运行 `node scripts/compile.platform.mjs`，按 SemVer 升级并入同一个 commit（新增 hook/skill 名单项 = minor；bug fix/文案 = patch；路径改名/行为语义反转 = major）。

6. **测试文件位置与被测模块可能不在同一目录**：`hooks/` 下多个 `*.test.mjs`（`dream-baseline` / `plugin-dream-baseline` / `personal-migrate` / `personal-snapshot` / `project-tree-detect` / `repo-lock` / `git-exec`）测试的其实是 `../scripts/` 里的同名模块——这是为了让 `node --test 'hooks/*.test.mjs'` 一条命令覆盖 hook 链间接依赖的全部底层模块。新增同类测试时遵循同一约定：测试文件放 `hooks/`，`import` 从 `../scripts/` 引入源模块。

7. **提交前如动了 vendor 相关内容**（通常与本目录无关）按仓库规则跑 `node scripts/vendor-sync.mjs --check`。

## 常见操作的正确入口

| 想做什么 | 正确入口 |
|---|---|
| 新增/改/删一条 rule（触发词、描述） | 改对应 `rules/rule-<id>.md` 的 frontmatter（新增则新建文件）→ `node scripts/compile.rule.js` |
| 新增一个 PreToolUse 危险命令拦截靶（deny/inject） | 在 `scripts/compile.hooks.js` 的 `RULES` 数组加 `{rule, pattern, decision, reason}` → `node scripts/compile.hooks.js` |
| 新增一个 SessionStart 常驻注入段（非 catalog 分片） | `model/*.md` 新增文件 → `inject-nocode.sh` 的 `seg_file()` 加映射 → `hooks.json` 的 SessionStart 数组加对应 command |
| 排查 SessionStart 注入是否与源漂移 | `node scripts/compile.rule.js --check` + `node scripts/compile.hooks.js --check`（SessionStart 首段也会自动跑一次，只 warn） |
| 单独调试某个 hook 的行为 | 各 hook 都是 stdin JSON → stdout JSON 的纯函数封装，可直接 `echo '<json>' \| node hooks/xxx.mjs`，或在对应 `.test.mjs` 里加用例（内部函数已 `export`） |

## 写新 hook 时的安全姿态约定

- 运行时失败一律偏向"放行"（fail-open）——参见 `handoff-stop-guard.mjs` 顶部注释：最坏退化为"hook 不存在"，不卡死 session。
- fork/subagent（payload 里 `agent_id` 非空）默认不拦截，除非明确要子 agent 也生效。
- 涉及落盘/写文件的 hook（如 `usage-tracker.mjs`）要用短超时的 `RepoLock`，拿不到锁就跳过，不能拖慢用户的正常操作。
- `pretooluse-guard.mjs` 的 bypass 观测日志（`.bypass-observations.jsonl`）默认关闭，只在设置 `NOCODE_EVOLVE_OBSERVE=1` 时落盘——避免命令片段（可能含 token/URL）被隐式持久化，新 hook 若要落盘同类敏感数据也应默认关闭、opt-in 开启。
